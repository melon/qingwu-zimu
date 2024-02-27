import { ISUBTITLE, ITRANSCRIPTION_TASK, LANGS, connectDb } from '../sql';
import { app, dialog } from 'electron';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
//@ts-ignore
import subsrt from './utils/subsrt';
import { log } from '../log';
import { ITranscriptItem, arrayToLrc, arrayToSrt, arrayToVtt, vttToArray } from '../whisper-node/conversion';
import { LANGUAGES } from '../config';
import { transformSubs } from './utils/subtitles';

export async function getSubtitles(_event: Electron.IpcMainInvokeEvent, taskId: number) {
  try {
    const db = await connectDb();
    const task = await db.get<ITRANSCRIPTION_TASK>(`SELECT * FROM transcription_tasks WHERE id = ? AND delete_flag = 0`, taskId);
    if (!task) {
      log.error('getSubtitles - task not exist');
      return {
        errno: 'ERROR_SUBTITLES_TASK_NOT_EXIST',
      };
    }
    const result = await db.get<ISUBTITLE>(`SELECT * FROM subtitles WHERE subtitles_id = ?`, [
      task.subtitles_id,
    ]);
    if (!result) {
      log.error('getSubtitles - subtitle not exist');
      return {
        errno: 'ERROR_SUBTITLES_GET_FAILED',
      };
    }
    return {
      subtitle: result,
      media_duration: task.duration!,
    };
  } catch (e) {
    log.error('getSubtitles', e);
    return {
      errno: 'ERROR_SUBTITLES_GET_FAILED_CAUGHT',
    };
  }
}

export async function writeToFile(contentConverter: (ext: string) => string, fileBaseName?: string) {
  try {
    const defaultDownloadsDir = app.getPath('downloads');
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: path.join(defaultDownloadsDir, fileBaseName || ''),
      title: '选择字幕格式保存',
      filters: [
        {
          name: 'Subrip (.srt)',
          extensions: ['srt'],
        },
        {
          name: 'WebVTT (.vtt)',
          extensions: ['vtt'],
        },
        {
          name: 'LyRiCs (.lrc)',
          extensions: ['lrc'],
        },
        // {
        //   name: 'Advanced SubStation Alpha (.ass)',
        //   extensions: ['ass'],
        // },
      ],
      properties: [
        'showOverwriteConfirmation', // for linux only
      ],
    });
    if (!canceled) {
      const ext = path.extname(filePath!);
      log.info('expected file extension: ', ext);
      const strData = contentConverter(ext);
      await fsPromises.writeFile(filePath!, strData);
      return {};
    } else {
      return {
        errno: 'CANCEL_WRITE_TO_FILE',
      };
    }
  } catch (err) {
    log.error('writeToFile error: ', err);
    return {
      errno: 'ERROR_WRITE_TO_FILE_CAUGHT',
    };
  }
}

function combileFileStrOfTwoLangsToArr(primaryFileStr: string, secondaryFileStr: string) {
  const primaryArr = vttToArray(primaryFileStr);
  const secondaryArr = vttToArray(secondaryFileStr);
  return primaryArr.map((item, index) => {
    return {
      ...item,
      content: item.content + '\n' + (secondaryArr[index]?.content || ''),
    };
  });
}

export interface IDownloadSubsOptions {
  id: number;
  language: keyof LANGS;
  secondaryLanguage: keyof LANGS | '';
  fileBaseName?: string;
}
export async function downloadSubtitles(_event: Electron.IpcMainInvokeEvent, options: IDownloadSubsOptions) {
  const { id, language, secondaryLanguage } = options;
  const db = await connectDb();
  const result = await db.get<ISUBTITLE>(`SELECT * FROM subtitles WHERE subtitles_id = ?`, [
    id,
  ]);
  if (!result) {
    return {
      errno: 'ERROR_SUBTITLES_GET_FAILED',
    };
  }

  function contentConverter(ext: string) {
    let fileStr = result[language]!;
    let arr: ITranscriptItem[];
    if (secondaryLanguage) {
      const secondaryFileStr = result[secondaryLanguage]!;
      arr = combileFileStrOfTwoLangsToArr(fileStr, secondaryFileStr);
    } else {
      arr = vttToArray(fileStr);
    }
    switch (ext) {
      case '.srt': {
        return arrayToSrt(arr);
      }
      case '.lrc': {
        return arrayToLrc(arr);
      }
      case '.vtt':
      default: {
        return arrayToVtt(arr);
      }
    }
  }
  return await writeToFile(contentConverter, options.fileBaseName);
}

export type ISaveSubsOptions = {
  id: number;
  language: keyof LANGS;
  clear?: never;
  subtitles: ITranscriptItem[];
  selected_translation_lang?: never;
} | {
  id: number;
  language?: never;
  clear?: never;
  subtitles?: never;
  selected_translation_lang: keyof LANGS | '';
} | {
  id: number;
  language: keyof LANGS;
  clear: boolean;
  subtitles?: never;
  selected_translation_lang?: never;
}
export async function saveSubtitles(_event: Electron.IpcMainInvokeEvent, options: ISaveSubsOptions) {
  return await _saveSubtitles(options);
}
export async function _saveSubtitles(options: ISaveSubsOptions) {
  try {
    const { id, language, subtitles, selected_translation_lang, clear } = options;
    const db = await connectDb();

    if (id && language && clear === true) {
      log.info(`clearSubtitles: `, id, language);
      await db.run(`UPDATE subtitles SET ${language} = ? WHERE subtitles_id = ?`, [
        null,
        id,
      ]);

      return {};
    }

    if (id && language && subtitles) {
      log.info(`saveSubtitles, id: ${id}, lang: ${language}`);
      if (!LANGUAGES[language]) {
        log.error('saveSubtitles invalid lang code');
        return {
          errno: 'ERROR_INVALID_LANGUAGE_CODE',
        };
      }

      const prevSubtitles = await db.get<ISUBTITLE>(`SELECT * FROM subtitles WHERE subtitles_id = ?`, [
        id,
      ]);
      if (!prevSubtitles) {
        log.error('saveSubtitles - subtitle not exist');
        return {
          errno: 'ERROR_SUBTITLES_GET_FAILED',
        };
      }

      if (language === prevSubtitles.default_lang) {
        const vttStr = arrayToVtt(subtitles);
        await db.run(`UPDATE subtitles SET ${language} = ? WHERE subtitles_id = ?`, [
          vttStr,
          id,
        ]);

        const newDefaultSubsArr = subtitles;
        for (let lang in LANGUAGES) {
          if (lang === language) { // 默认语言跳过
            continue;
          }
          const prevTrans = prevSubtitles[lang as keyof LANGS];
          if (prevTrans) {
            const transformedSubs = transformSubs(vttToArray(prevTrans), newDefaultSubsArr);
            await db.run(`UPDATE subtitles SET ${lang} = ? WHERE subtitles_id = ?`, [
              arrayToVtt(transformedSubs),
              id,
            ]);
          }
        }
      } else if (prevSubtitles.default_lang) {
        const prevDefaultSubs = prevSubtitles[prevSubtitles.default_lang!];
        const prevDefaultSubsArr = vttToArray(prevDefaultSubs!);
        const transformedSubs = transformSubs(subtitles, prevDefaultSubsArr);
        await db.run(`UPDATE subtitles SET ${language} = ? WHERE subtitles_id = ?`, [
          arrayToVtt(transformedSubs),
          id,
        ]);
      } else { // 首次保存，没有历史默认语言
        await db.run(`UPDATE subtitles SET ${language} = ? WHERE subtitles_id = ?`, [
          arrayToVtt(subtitles),
          id,
        ]);
      }

      return {};
    } else if (selected_translation_lang) {
      log.info(`saveSubtitles, selected_translation_lang: ${selected_translation_lang}`);
      if (!LANGUAGES[selected_translation_lang]) {
        log.error('saveSubtitles preference invalid lang code');
        return {
          errno: 'ERROR_INVALID_SELECTED_LANGUAGE_CODE',
        };
      }
      const db = await connectDb();
      await db.run(`UPDATE subtitles SET selected_translation_lang = ? WHERE subtitles_id = ?`, [
        selected_translation_lang,
        id,
      ]);

      return {};
    }
    return {};
  } catch (err) {
    log.error('saveSubtitles error: ', err);
    return {
      errno: 'ERROR_SUBTITLES_SAVE_FAILED',
    };
  }
}

export type IImportSubsOptions = {
  filePath: string;
  subtitlesId: number;
  language: keyof LANGS;
}
export async function importSubtitles(_event: Electron.IpcMainInvokeEvent, options: IImportSubsOptions) {
  return _importSubtitles(options);
}
export async function _importSubtitles(options: IImportSubsOptions) {
  try {
    const { filePath, subtitlesId, language } = options;

    const fileContent = await fsPromises.readFile(filePath, 'utf-8');
    const vttStr = subsrt.convert(fileContent, { format: 'vtt', eol: '\n' });
    const vttArr = vttToArray(vttStr);

    const db = await connectDb();

    const toClearFields = Object.keys(LANGUAGES).concat(['default_lang', 'selected_translation_lang']);
    log.info('_importSubtitles - clear all translations', language, subtitlesId);
    // 清空所有语言的翻译以及选中的翻译偏好
    await db.run(`UPDATE subtitles SET ${toClearFields.map(l => l + ' = ?').join(',')} WHERE subtitles_id = ?`, [
      ...toClearFields.map(_ => null),
      subtitlesId,
    ]);

    const saveRes = await _saveSubtitles({
      id: subtitlesId,
      language,
      subtitles: vttArr,
    });

    if (saveRes.errno) {
      return saveRes;
    }

    await db.run(`UPDATE subtitles SET default_lang = ? WHERE subtitles_id = ?`, [
      language,
      subtitlesId,
    ]);

    return {};
  } catch (e) {
    log.error(`_importSubtitles catch`, e);
    return {
      errno: 'ERROR_IMPORT_SUBS_CAUGHT',
    };
  }
}
