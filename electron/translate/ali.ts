import Client, * as $alimt from '@alicloud/alimt20181012';
import * as $OpenApi from '@alicloud/openapi-client';
import { log } from '../log';
import { LANGS, connectDb } from '../sql';
import { wait } from '../utils';
import { ITranslateOptions, ITranslateResData } from '.';
import { trimText } from './common/common';

// https://help.aliyun.com/document_detail/215387.html

const langCodeMap: Record<keyof LANGS, string> = {
  en: 'en',
  zh_CN: 'zh',
  zh_TW: 'zh-tw',
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
  hr: 'hbs', //
  lo: 'lo',
  ur: 'ur',
  ta: 'ta',
};

export const AliTranslateSupportLangs = Object.keys(langCodeMap) as (keyof LANGS)[];

let client: Client;
let accessKeyId: string;
let accessKeySecret: string;
async function initClient() {
  const db = await connectDb();
  const result = await db.get<{ value: string }>(`SELECT value FROM key_value_store WHERE key = ?`, [
    'ALI_MT_SETTINGS'
  ]);
  if (!result) {
    throw {
      errno: 'ERROR_TRANSLATE_ALI_NO_SETTINGS',
    };
  }

  const key = JSON.parse(result.value) as { accessKeyId: string, accessKeySecret: string };

  // 首次、或者accessKeyId或accessKeySecret有变更时才初始化client
  if (!client || accessKeyId !== key.accessKeyId || accessKeySecret !== key.accessKeySecret) {
    accessKeyId = key.accessKeyId;
    accessKeySecret = key.accessKeySecret;

    let config = new $OpenApi.Config({
      accessKeyId: key.accessKeyId,
      accessKeySecret: key.accessKeySecret,
    });
    // 访问的域名
    config.endpoint = "mt.cn-hangzhou.aliyuncs.com";

    client = new Client(config);
  }

  return client;
}

interface ITranslatedItem {
  code: number;
  wordCount: number;
  detectedLanguage: 'string';
  index: string;
  translated: string;
}

async function translate({ textList, sourceLang , targetLang }: ITranslateOptions): Promise<ITranslateResData> {
  // await wait(Math.random() * 5000);
  // return {
  //   data: textList.map(item => 'T+' + item),
  //   totalWordCount: textList.length,
  // };

  const MAX_RETRY_TIMES = 1;

  async function req(): Promise<ITranslateResData> {
    const textMap = textList.reduce<Record<string, string>>((map, item, index) => {
      map[index] = item;
      return map;
    }, {});
    const client = await initClient();
    const request = new $alimt.GetBatchTranslateRequest({
      sourceLanguage: langCodeMap[sourceLang],
      targetLanguage: langCodeMap[targetLang],
      formatType: 'text',
      sourceText: JSON.stringify(textMap),
      apiType: 'translate_standard',
      scene: 'general',
    });

    const res = await client.getBatchTranslate(request);

    if (res.statusCode !== 200) {
      log.error('ali req status code', res.statusCode);
      throw {
        errno: 'ERROR_TRANSLATE_ALI_REQ_ERROR_STATUS_CODE',
      };
    }

    if (res.body.code !== 200) {
      log.error(JSON.stringify(res.body));
      switch (res.body.code) {
        default: {
          throw {
            errno: 'ERROR_TRANSLATE_ALI_REQ_ERROR_CODE',
          };
        }
      }
    }

    let totalWordCount = 0;
    const result: string[] = [];

    (res.body.translatedList as ITranslatedItem[]).forEach(item => {
      result[item.index as unknown as number] = trimText(item.translated) || '';
      totalWordCount += Number(item.wordCount || 0);
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
      const errno = (e as ExtendedError).errno || 'ERROR_TRANSLATE_ALI_REQ_FAIL';
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

const QPS_LIMIT = 10; // 文档上说QPS有50，但实际只有10，true QPS超过10就有可能出现限流错误
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
export function AliTranslate(options: ITranslateOptions): Promise<ITranslateResData> {
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


// let execQueueCount = 0;
// const QPS_LIMIT = 50;
// const waitingQueue: IQueueItem[] = [];
// let isExecutingWaitingList = false;

// async function exec<T extends (data: ITranslate) => Promise<ITranslateResData>>(execFunc: T) {
//   if (isExecutingWaitingList) {
//     return;
//   }
//   isExecutingWaitingList = true;
//   let outerResolve: Function;
//   while (waitingQueue.length > 0) {
//     if (execQueueCount < QPS_LIMIT) {
//       log.info('execQueueCount', execQueueCount);
//       const item = waitingQueue.shift()!;
//       execFunc(item.translateData).then((translateResData: ITranslateResData) => {
//         item.callback({
//           startIndex: item.startIndex,
//           endIndex: item.endIndex,
//           translateResData,
//         });
//         return;
//       }).finally(() => {
//         execQueueCount--;
//         if (execQueueCount < QPS_LIMIT && outerResolve) {
//           outerResolve();
//         }
//       });
//       execQueueCount++;
//     } else {
//       await new Promise(resolve => {
//         outerResolve = resolve;
//       });
//     }
//   }
//   isExecutingWaitingList = false;
// }

// const MAX_COUNT_PER_GROUP = 1;
// export function AliTranslate(options: ITranslate) {
//   // return await translate(options);
//   return new Promise((resolve) => {
//     const result: string[] = Array(options.textList.length);
//     let wordCount = 0;
//     let count = 0;
//     function callback(data: IQueueCallbackData) {
//       if (data.translateResData.errno === undefined) {
//         result.splice(data.startIndex, data.endIndex - data.startIndex, ...data.translateResData.data);
//         log.info('startIndex, endIndex', data.startIndex, data.endIndex);
//         wordCount += data.translateResData.totalWordCount;
//       } else {
//         log.info('errno occur', data.translateResData.errno);
//       }
//       count++;
//       log.info('callback count', count, result, wordCount);
//       if (count === groupsLen) {
//         resolve({
//           data: result,
//           totalWordCount: wordCount,
//         });
//       }
//     }
//     const groupsLen = Math.ceil(options.textList.length / MAX_COUNT_PER_GROUP);
//     for (let i = 0; i < groupsLen; i++) {
//       const startIndex = i * MAX_COUNT_PER_GROUP;
//       const endIndex = Math.min(startIndex + MAX_COUNT_PER_GROUP, options.textList.length);
//       waitingQueue.push({
//         translateData: {
//           ...options,
//           textList: options.textList.slice(startIndex, endIndex),
//         },
//         startIndex,
//         endIndex,
//         callback,
//       });
//     }
//     exec(translate);
//   });
// }
