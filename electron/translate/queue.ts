import { ISUBTITLE, connectDb } from "../sql";
import { log } from "../log";
import { ITranscriptItem, vttToArray } from "../whisper-node/conversion";
import { _saveSubtitles } from "../handlers/subtitles";
import { ITranslateOptions, ITranslateResData, _translate } from ".";


export type IDiffTranslateOptions = Omit<{
  subtitlesId: number;
  batchSize?: number;
} & ITranslateOptions, 'textList'>

export type TranslationWaitingItem = {
  event: Electron.IpcMainInvokeEvent,
  options: IDiffTranslateOptions,
  resolve: (value: ITranslateResData) => void,
}
function getDiffSubs(sourceArr: ITranscriptItem[], targetArr: ITranscriptItem[], batchSize?: number) {
  const subs = [];
  for (let i = 0; i < sourceArr.length; i++) {
    if (batchSize && subs.length >= batchSize) {
      break;
    }
    if (!targetArr[i]) {
      subs.push(sourceArr[i]);
    }
  }
  return subs;
}

const tranlationWaitingList: TranslationWaitingItem[] = [];
let isExecutingWaitingList = false;
async function startExecuteWaitingList() {
  if (isExecutingWaitingList) return;
  isExecutingWaitingList = true;
  while (tranlationWaitingList.length) {
    const nextOne = tranlationWaitingList.shift()!;
    log.info(`translation queue - start - subId ${nextOne.options.subtitlesId}`);
    try {
      const res = await _diffTranslate(nextOne.options);
      nextOne.resolve(res);
    } catch (e) {
      log.error(`translation queue - diffTranslation - ERROR_DIFFTRANSLATE_CAUGHT`, e);
      nextOne.resolve({
        errno: `ERROR_DIFFTRANSLATE_CAUGHT`,
      });
    }
    log.info(`translation queue - end - subId ${nextOne.options.subtitlesId}`);
  }
  isExecutingWaitingList = false;
}

export async function diffTranslate(event: Electron.IpcMainInvokeEvent, options: IDiffTranslateOptions) {
  return new Promise((resolve: (value: ITranslateResData) => void) => {
    log.info('diffTranslate - add to list', options);
    tranlationWaitingList.push({
      event, // TODO, remove?
      options,
      resolve,
    });
    startExecuteWaitingList();
  });
}

export async function _diffTranslate(options: IDiffTranslateOptions) {
  const subId = options.subtitlesId;
  try {
    const db = await connectDb();
    const subtitlesRes = await db.get<ISUBTITLE>(`SELECT * FROM subtitles WHERE subtitles_id = ?`, [
      subId,
    ]);
    if (!subtitlesRes) {
      log.error('diffTranslate - subtitle not exist');
      return {
        errno: 'ERROR_SUBTITLES_GET_FAILED',
      };
    }

    const sourceText = subtitlesRes[options.sourceLang] || '';
    const targetText = subtitlesRes[options.targetLang] || '';
    const sourceArr = vttToArray(sourceText);
    const targetArr = vttToArray(targetText);

    const subs = getDiffSubs(sourceArr, targetArr, options.batchSize);
    if (!subs.length) {
      log.info('_diffTranslate - no diff');
      return {
        nodiff: true,
      };
    }

    const translateOptions: ITranslateOptions = {
      sourceLang: options.sourceLang,
      targetLang: options.targetLang,
      textList: subs.map(item => item.content),
      providerId: options.providerId,
      deeplAccType: options.deeplAccType,
    };
    const translateRes = await _translate(translateOptions);
    if (translateRes.errno) {
      log.error('diffTranslate - translate error', translateRes.errno);
      return translateRes;
    }
    for (let i = 0, j = 0; j < subs.length; j++) {
      const sub = subs[j];
      while (i < sourceArr.length) {
        const subtitle = sourceArr[i];
        if (sub.start === subtitle.start && sub.end === subtitle.end) {
          targetArr[i] = {
            ...sub,
            content: translateRes.data![j],
          };
          i++;
          break;
        }
        i++;
      }
    }
    const saveRes = await _saveSubtitles({
      id: subId,
      language: options.targetLang,
      subtitles: targetArr,
    }); // 翻译完成后自动保存
    if (saveRes.errno) {
      log.error('diffTranslate - save error');
      return {
        errno: saveRes.errno,
      };
    }
    log.info('_diffTranslate save success', saveRes);

    return translateRes;
  } catch (e) {
    log.error('diffTranslate - catch', e);
    return {
      errno: 'ERROR_DIFF_TRANS_ERR_CAUGHT',
    };
  }
}
