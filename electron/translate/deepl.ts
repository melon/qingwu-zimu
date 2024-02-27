import { log } from '../log';
import fetch from 'node-fetch';
import { LANGS, connectDb } from '../sql';
import { wait } from '../utils';
import { ITranslateOptions, ITranslateResData } from '.';
import { trimText } from './common/common';

// https://www.deepl.com/docs-api/translate-text/translate-text

type PickedLangs = 'en' | 'zh_CN' | 'ja' | 'ko' | 'fr' | 'es' | 'ru' | 'de' | 'pt' | 'it' | 'id' | 'tr' | 'vi' | 'el' | 'pl' | 'nl' | 'hu' | 'no' | 'sv' | 'fi' | 'cs' | 'da' | 'lt' | 'sk' | 'ro' | 'bg' ;

const langCodeMap: Pick<LANGS, PickedLangs> = {
  en: 'EN',
  zh_CN: 'ZH',
  // zh_TW: '', // 繁体中文不支持
  ja: 'JA',
  ko: 'KO',
  fr: 'FR',
  es: 'ES',
  ru: 'RU',
  // ar: '', // 阿拉伯语不支持
  // th: '', // 泰语暂不支持
  de: 'DE',
  pt: 'PT',
  it: 'IT',
  // hi: '', // 印地文不支持
  id: 'ID',

  tr: 'TR',
  // vi: '',
  // he: '',
  el: 'EL',
  pl: 'PL',
  nl: 'NL',
  hu: 'HU',
  no: 'NB', //
  sv: 'SV',
  fi: 'FI',
  cs: 'CS',
  da: 'DA',
  lt: 'LT',
  sk: 'SK',
  // ms: '',
  ro: 'RO',
  bg: 'BG',
  // hr: '', // 克罗地亚
  // lo: '',
  // ur: '',
  // ta: '',
};

export const DeeplTranslateSupportLangs = Object.keys(langCodeMap) as (keyof typeof langCodeMap)[];

let authKey: string;
async function initAccessKey() {
  const db = await connectDb();
  const result = await db.get<{ value: string }>(`SELECT value FROM key_value_store WHERE key = ?`, [
    'DEEPL_TRANS_SETTINGS'
  ]);
  if (!result) {
    throw {
      errno: 'ERROR_TRANSLATE_DEEPL_NO_SETTINGS',
    };
  }

  const keyObj = JSON.parse(result.value) as { authKey: string };

  authKey = keyObj.authKey;
}

type IDeeplTransAPIRes = {
  message?: string;
  translations?: [{
    text: string;
    detected_source_language: string;
  }];
};
async function translate({ textList, sourceLang , targetLang, deeplAccType }: ITranslateOptions): Promise<ITranslateResData> {

  const MAX_RETRY_TIMES = 1;

  async function req(): Promise<ITranslateResData> {
    await initAccessKey();

    const body = {
      text: textList,
      source_lang: langCodeMap[sourceLang as keyof Pick<LANGS, PickedLangs>],
      target_lang: langCodeMap[targetLang as keyof Pick<LANGS, PickedLangs>],
      split_sentences: '0',
    };
    const bodyStr = JSON.stringify(body);

    // https://www.deepl.com/docs-api/translate-text/large-volumes
    let origin = 'https://api-free.deepl.com';
    if (deeplAccType === 'pro') {
      origin = 'https://api.deepl.com';
    }
    const res = await fetch(`${origin}/v2/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `DeepL-Auth-Key ${authKey}`,
      },
      body: bodyStr,
    });

    if (res.status !== 200) {
      log.error(`translate status: ${res.status}`);
      switch (res.status) {
        case 429:
          throw {
            errno: 'ERROR_TRANSLATE_DEEPL_REQ_FLOW_CONTROL',
          };
        case 456:
          throw {
            errno: 'ERROR_TRANSLATE_DEEPL_QUOTA_EXCEEDED',
          };
        case 403:
          throw {
            errno: 'ERROR_TRANSLATE_DEEPL_FORBIDDEN',
          };
      }
      throw {
        errno: 'ERROR_TRANSLATE_DEEPL_REQ_ERROR_CODE',
      };
    }

    const data = await res.json() as IDeeplTransAPIRes;

    log.info(data);

    if (data.message) {
      log.error(JSON.stringify(data));
      throw {
        errno: 'ERROR_TRANSLATE_DEEPL_REQ_ERROR_CODE',
      };
    }

    const result = data.translations!.map(item => {
      return trimText(item.text);
    });

    return {
      data: result,
      totalWordCount: textList.join('').length,
    };
  }

  let retryTimes = 0;
  async function main(): Promise<ITranslateResData> {
    try {
      return await req();
    } catch (e) {
      const errno = (e as ExtendedError).errno || 'ERROR_TRANSLATE_DEEPL_REQ_FAIL';
      log.error(errno, e);
      if (++retryTimes <= MAX_RETRY_TIMES) {
        await wait(1000 * retryTimes); // 等待一段时间后再重试
        log.info(`translate retry ${retryTimes}`);
        return await main();
      }
      return {
        errno,
      };
    }
  }

  return await main();
}


interface IQueueCallbackData {
  startIndex: number;
  endIndex: number;
  translateResData: ITranslateResData;
}
interface IQueueItem {
  translateData: ITranslateOptions;
  startIndex: number;
  endIndex: number;
  callback: (data: IQueueCallbackData) => void;
}

const QPS_LIMIT = 10;
const requestTSQueue: number[] = [];
const waitingQueue: IQueueItem[] = [];
let isExecutingWaitingList = false;

function calcQPS() {
  const startIdx = Math.max(0, requestTSQueue.length - QPS_LIMIT);
  const qps = Math.min(requestTSQueue.length, QPS_LIMIT) / ((performance.now() - requestTSQueue[startIdx]) / 1000);
  return qps;
}

async function exec<T extends (data: ITranslateOptions) => Promise<ITranslateResData>>(execFunc: T) {
  if (isExecutingWaitingList) {
    return;
  }
  isExecutingWaitingList = true;
  while (waitingQueue.length > 0) {
    if (requestTSQueue.length < QPS_LIMIT || calcQPS() < QPS_LIMIT) {
      const now = performance.now();
      requestTSQueue.push(now);
      while (requestTSQueue.length > QPS_LIMIT + 1) { // 保证数组不至于太长
        requestTSQueue.shift();
      }
      const item = waitingQueue.shift()!;
      // log.info(performance.now(), item.translateData.textList[0]);
      // log.info('true QPS', calcQPS());
      execFunc(item.translateData).then((translateResData: ITranslateResData) => {
        item.callback({
          startIndex: item.startIndex,
          endIndex: item.endIndex,
          translateResData,
        });
      })
      await wait(100); // 避免纯并发请求，所以增加了100ms的间距 TODO
    } else {
      const startIdx = Math.max(0, requestTSQueue.length - QPS_LIMIT);
      const waitTime = Math.max(requestTSQueue[startIdx] + 1000 - performance.now(), 0);
      // log.info('waitTime', waitTime);
      await wait(waitTime);
    }
  }
  isExecutingWaitingList = false;
}

const MAX_COUNT_PER_GROUP = 50;
export function DeeplTranslate(options: ITranslateOptions): Promise<ITranslateResData> {
  // const startTime = performance.now();
  return new Promise((resolve) => {
    if (!options.textList.length) {
      return resolve({
        data: [],
        totalWordCount: 0,
      });
    }
    const result: string[] = Array(options.textList.length);
    let wordCount = 0;
    let count = 0;
    function callback(data: IQueueCallbackData) {
      if (data.translateResData.errno === undefined) {
        result.splice(data.startIndex, data.endIndex - data.startIndex, ...data.translateResData.data!);
        wordCount += data.translateResData.totalWordCount!;
      } else { // TODO
        log.error('errno occur', data.translateResData.errno);
        return resolve(data.translateResData);
      }
      count++;
      if (count === groupsLen) {
        // log.info('total time: ', performance.now() - startTime);
        resolve({
          data: result,
          totalWordCount: wordCount,
        });
      }
    }
    const groupsLen = Math.ceil(options.textList.length / MAX_COUNT_PER_GROUP);
    for (let i = 0; i < groupsLen; i++) {
      const startIndex = i * MAX_COUNT_PER_GROUP;
      const endIndex = Math.min(startIndex + MAX_COUNT_PER_GROUP, options.textList.length);
      waitingQueue.push({
        translateData: {
          ...options,
          textList: options.textList.slice(startIndex, endIndex),
        },
        startIndex,
        endIndex,
        callback,
      });
    }
    exec(translate);
  });
}
