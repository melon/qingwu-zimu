import { md5 } from "../common/crypto";
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

// https://fanyi-api.baidu.com/doc/21
const langCodeMap: Record<keyof LANGS, string> = {
  en: 'en',
  zh_CN: 'zh',
  zh_TW: 'cht',
  ja: 'jp',
  ko: 'kor',
  fr: 'fra',
  es: 'spa',
  ru: 'ru',
  ar: 'ara',
  th: 'th',
  de: 'de',
  pt: 'pt',
  it: 'it',
  hi: 'hi',
  id: 'id',
  tr: 'tr',
  vi: 'vie', //
  he: 'heb', //
  el: 'el',
  pl: 'pl',
  nl: 'nl',
  hu: 'hu',
  no: 'nor', //
  sv: 'swe', //
  fi: 'fi',
  cs: 'cs',
  da: 'dan', //
  lt: 'lit', //
  sk: 'sk',
  ms: 'may', //
  ro: 'rom', //
  bg: 'bul', //
  hr: 'hrv', //
  lo: 'lao', //
  ur: 'urd', //
  ta: 'tam', //
};

export const BaiduTranslateSupportLangs = Object.keys(langCodeMap) as (keyof LANGS)[];

async function initAccessKey() { // 每次都需要从数据库读取appid和key，因为用户可能会修改
  const db = await connectDb();
  const result = await db.get<{ value: string }>(`SELECT value FROM key_value_store WHERE key = ?`, [
    'BAIDU_MT_SETTINGS'
  ]);
  if (!result) {
    throw {
      errno: 'ERROR_TRANSLATE_BAIDU_NO_SETTINGS',
    };
  }

  const keyObj = JSON.parse(result.value) as { appid: string, key: string };

  appid = keyObj.appid;
  key = keyObj.key;
}

type IBaiduTransAPIRes = {
  error_code: string;
  error_msg: string;
  from?: never;
  to?: never;
  trans_result?: never;
} | {
  error_code?: never;
  error_msg?: never;
  from: string;
  to: string;
  trans_result: {
    src: string;
    dst: string;
  }[];
}
async function translate({ textList, sourceLang , targetLang }: ITranslateOptions): Promise<ITranslateResData> {

  const MAX_RETRY_TIMES = 1;

  async function req(): Promise<ITranslateResData> {
    await initAccessKey();
    const salt = Date.now();
    const text = textList.join('\n');
    const rawStr = appid + text + salt + key;
    const sign = md5(rawStr);

    const res = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: qs.stringify({
        q: text,
        appid,
        salt,
        from: langCodeMap[sourceLang],
        to: langCodeMap[targetLang],
        sign,
      }),
    });

    // log.info('query text', text);

    const data = await res.json() as IBaiduTransAPIRes;

    // log.info(data);

    if (data.error_code) {
      log.error(JSON.stringify(data));
      switch (data.error_code) {
        case '54003': {
          throw {
            errno: 'ERROR_TRANSLATE_BAIDU_REQ_FLOW_CONTROL',
          };
        }
        case '58003': {
          throw {
            errno: 'ERROR_TRANSLATE_BAIDU_REQ_IP_BLOCK',
          };
        }
        default: {
          throw {
            errno: 'ERROR_TRANSLATE_BAIDU_REQ_ERROR_CODE',
          };
        }
      }
    }

    let totalWordCount = 0;
    const result = textList.map(origItem => {
      const resultItem = data.trans_result!.find(item => item.src === origItem);
      if (resultItem) {
        totalWordCount += (origItem.length || 0); // 每调用一次API，即计算一次字符量。如果未发生调用或调用失败，将不会产生费用。https://fanyi-api.baidu.com/product/112
        return trimText(resultItem.dst);
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
      const errno = (e as ExtendedError).errno || 'ERROR_TRANSLATE_BAIDU_REQ_FAIL';
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

const QPS_LIMIT = 1; // https://fanyi-api.baidu.com/product/112
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

// const MAX_COUNT_PER_GROUP = 100;
export async function BaiduTranslate(options: ITranslateOptions): Promise<ITranslateResData> {
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
      if (currentBytesLen > 1500) { // 1500*3=4500 encoded字符 百度文档规定是6000以下
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
