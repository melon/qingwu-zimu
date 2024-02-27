import { sha256 } from "../common/crypto";
import fetch from 'node-fetch';
import qs from 'node:querystring';
import { Buffer } from 'node:buffer';
import { log } from "../log";
import { LANGS, connectDb } from "../sql";
import { wait } from "../utils";
import { ITranslateOptions, ITranslateResData } from ".";
import { trimText } from "./common/common";

let appid = '';
let key = '';

// https://ai.youdao.com/DOCSIRMA/html/trans/api/plwbfy/index.html
const langCodeMap: Record<keyof LANGS, string> = {
  en: 'en',
  zh_CN: 'zh-CHS',
  zh_TW: 'zh-CHT',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'sp',
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
  no: 'no',
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

export const YoudaoTranslateSupportLangs = Object.keys(langCodeMap) as (keyof LANGS)[];

async function initAccessKey() { // 每次都需要从数据库读取appid和key，因为用户可能会修改
  const db = await connectDb();
  const result = await db.get<{ value: string }>(`SELECT value FROM key_value_store WHERE key = ?`, [
    'YOUDAO_TRANS_SETTINGS'
  ]);
  if (!result) {
    throw {
      errno: 'ERROR_TRANSLATE_YOUDAO_NO_SETTINGS',
    };
  }

  const keyObj = JSON.parse(result.value) as { appid: string, key: string };

  appid = keyObj.appid;
  key = keyObj.key;
}

type IYoudaoTransAPIRes = {
  errorCode: string; // string, e.g. '0' | '401'
  errorIndex: number[];
  translateResults: {
    query: string;
    translation: string;
    type: string;
    verifyResult: string;
  }[];
}
async function translate({ textList, sourceLang , targetLang }: ITranslateOptions): Promise<ITranslateResData> {

  const MAX_RETRY_TIMES = 1;

  function truncate(q: string){
    var len = q.length;
    if(len <= 20) return q;
    return q.substring(0, 10) + len + q.substring(len-10, len);
  }

  async function req(): Promise<ITranslateResData> {
    await initAccessKey();
    const salt = Date.now();
    const curtime = Math.round(Date.now()/1000);
    const text = textList;
    const rawStr = appid + truncate(text.join("")) + salt + curtime + key;
    const sign = sha256(rawStr);

    const res = await fetch('https://openapi.youdao.com/v2/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: qs.stringify({
        q: textList,
        appKey: appid,
        salt,
        from: langCodeMap[sourceLang],
        to: langCodeMap[targetLang],
        sign,
        signType: 'v3',
        curtime,
      }),
    });

    // log.info('query text', text);

    const data = await res.json() as IYoudaoTransAPIRes;

    // log.info(data);

    if (data.errorCode !== '0') {
      log.error(JSON.stringify(data));
      // https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html
      switch (data.errorCode) {
        case '411': {
          throw {
            errno: 'ERROR_TRANSLATE_YOUDAO_REQ_FLOW_CONTROL',
          };
        }
        default: {
          throw {
            errno: 'ERROR_TRANSLATE_YOUDAO_REQ_ERROR_CODE',
          };
        }
      }
    }

    let totalWordCount = 0;
    const result = textList.map(origItem => {
      const resultItem = data.translateResults!.find(item => item.query === origItem);
      if (resultItem) {
        totalWordCount += (origItem.length || 0); // 每调用一次API，即计算一次字符量。如果未发生调用或调用失败，将不会产生费用。https://fanyi-api.baidu.com/product/112
        return trimText(resultItem.translation);
      }
      return '';
    });

    return {
      data: result,
      totalWordCount,
    };
  }

  let retryTimes = 0;
  async function main(): Promise<ITranslateResData> {
    try {
      return await req();
    } catch (e) {
      const errno = (e as ExtendedError).errno || 'ERROR_TRANSLATE_YOUDAO_REQ_FAIL';
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

const QPS_LIMIT = 1; // 有道文档里似乎只有说“每小时最大查询次数100万次，每小时最大查询字符数120万字”
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
      const waitTime = Math.max(requestTSQueue[startIdx] + 1000 - performance.now(), 0) + 500;
      // log.info('waitTime', waitTime);
      await wait(waitTime);
    }
  }
  isExecutingWaitingList = false;
}

export async function YoudaoTranslate(options: ITranslateOptions): Promise<ITranslateResData> {
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
    let groupsLen = 0;
    let currentBytesLen = 0;
    let startIndex = 0;
    const textList = options.textList;
    for (let i = 0; i < textList.length; i++) {
      const currentLen = Buffer.byteLength(textList[i], 'utf-8');
      currentBytesLen += currentLen;
      if (currentBytesLen > 1500) { // 1500*3=4500 encoded字符 有道文档规定是5000以下 https://ai.youdao.com/DOCSIRMA/html/trans/faq/wbfy/index.html
        waitingQueue.push({
          translateData: {
            sourceLang: options.sourceLang,
            targetLang: options.targetLang,
            textList: textList.slice(startIndex, i),
            providerId: options.providerId,
          },
          startIndex,
          endIndex: i,
          callback,
        });
        groupsLen++;
        startIndex = i;
        currentBytesLen = currentLen;
      } else {
        continue;
      }
    }
    waitingQueue.push({
      translateData: {
        sourceLang: options.sourceLang,
        targetLang: options.targetLang,
        textList: textList.slice(startIndex, textList.length),
        providerId: options.providerId,
      },
      startIndex,
      endIndex: textList.length,
      callback,
    });
    groupsLen++;
    exec(translate);
  });
}
