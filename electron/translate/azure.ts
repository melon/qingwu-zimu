import { log } from '../log';
import fetch from 'node-fetch';
import { LANGS, connectDb } from '../sql';
import { wait } from '../utils';
import { ITranslateOptions, ITranslateResData } from '.';
import qs from 'qs';
import crypto from 'node:crypto';
import { trimText } from './common/common';

// https://learn.microsoft.com/zh-cn/azure/ai-services/Translator/quickstart-text-rest-api?tabs=nodejs

const langCodeMap: Record<keyof LANGS, string> = {
  en: 'en',
  zh_CN: 'zh-Hans',
  zh_TW: 'zh-Hant',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'es',
  ru: 'ru',
  ar: 'ar',
  th: 'th',
  de: 'de',
  pt: 'pt',
  it: 'it',
  hi: 'hi',
  id: 'id',
  tr: 'tr',
  vi: 'vi',
  he: 'he',
  el: 'el',
  pl: 'pl',
  nl: 'nl',
  hu: 'hu',
  no: 'nb', //
  sv: 'sv',
  fi: 'fi',
  cs: 'cs',
  da: 'da',
  lt: 'lt',
  sk: 'sk',
  ms: 'ms',
  ro: 'ro',
  bg: 'bg',
  hr: 'hr',
  lo: 'lo',
  ur: 'ur',
  ta: 'ta',
};

export const AzureTranslateSupportLangs = Object.keys(langCodeMap) as (keyof LANGS)[];

let subKey: string;
let subRegion: string;
async function initAccessKey() {
  const db = await connectDb();
  const result = await db.get<{ value: string }>(`SELECT value FROM key_value_store WHERE key = ?`, [
    'AZURE_TRANS_SETTINGS'
  ]);
  if (!result) {
    throw {
      errno: 'ERROR_TRANSLATE_AZURE_NO_SETTINGS',
    };
  }

  const keyObj = JSON.parse(result.value) as { subKey: string, subRegion: string };

  subKey = keyObj.subKey;
  subRegion = keyObj.subRegion;
}

type ITranslationItem = {
  translations: [{
    text: string;
    to?: string;
  }];
}
type IAzureTransAPIRes = {
  error: {
    code: number;
    message: string;
  }
} | ITranslationItem[];
async function translate({ textList, sourceLang , targetLang }: ITranslateOptions): Promise<ITranslateResData> {

  const MAX_RETRY_TIMES = 1;

  async function req(): Promise<ITranslateResData> {
    await initAccessKey();

    const query = {
      'api-version': '3.0',
      from: langCodeMap[sourceLang],
      to: langCodeMap[targetLang],
    };
    const body = textList.map(text => {
      return {
        Text: text,
      };
    });
    const bodyStr = JSON.stringify(body);

    // https://learn.microsoft.com/zh-cn/azure/ai-services/Translator/quickstart-text-rest-api?tabs=nodejs
    const res = await fetch(`https://api.cognitive.microsofttranslator.com/translate?${qs.stringify(query)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Ocp-Apim-Subscription-Key': subKey,
        'Ocp-Apim-Subscription-Region': subRegion,
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: bodyStr,
    });

    const data = await res.json() as IAzureTransAPIRes;

    // log.info(data);

    if (!Array.isArray(data) && data.error && data.error.code) {
      log.error(JSON.stringify(data));
      switch (data.error.code) {
        case 429000:
        case 429001:
        case 429002: {
          throw {
            errno: 'ERROR_TRANSLATE_AZURE_REQ_FLOW_CONTROL',
          };
        }
        default: {
          throw {
            errno: 'ERROR_TRANSLATE_AZURE_REQ_ERROR_CODE',
          };
        }
      }

    }

    const result = (data as ITranslationItem[]).map(item => {
      return trimText(item.translations[0].text);
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
      const errno = (e as ExtendedError).errno || 'ERROR_TRANSLATE_AZURE_REQ_FAIL';
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

const QPS_LIMIT = 10; // https://learn.microsoft.com/zh-cn/azure/ai-services/Translator/service-limits#text-translation
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
export function AzureTranslate(options: ITranslateOptions): Promise<ITranslateResData> {
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
    // https://learn.microsoft.com/zh-cn/azure/ai-services/Translator/service-limits#text-translation
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
