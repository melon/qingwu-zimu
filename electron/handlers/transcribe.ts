import { dialog } from 'electron';
import path from 'node:path';
import { exec } from 'child_process';
import nodeUtil from 'node:util';
import { getTranscript, type ITranscriptData } from '../whisper-node/index';
import { getFileInfo, extractAudio } from '../ffmpeg/index';
import { getFileStat } from '../utils';
import { log } from '../log';
import { connectDb, ITRANSCRIBE_STATE, LANGS, type ITRANSCRIPTION_TASK } from '../sql';
import { arrayToVttWithoutHeader } from '../whisper-node/conversion';
import { LANGUAGES } from '../config';
import { simple2Traditional, traditional2Simple } from '../whisper-node/zh-conversion';

const promisedExec = nodeUtil.promisify(exec);
const ffmpegChildProcess = new WeakMap();

export async function handleFileOpen(_event: Electron.IpcMainInvokeEvent, options: Electron.OpenDialogOptions) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    ...options,
  });
  if (!canceled) {
    return filePaths;
  }
}

export async function handleStopTranscripting(event: Electron.IpcMainInvokeEvent) {
  const webContents = event.sender;
  try {
    const childProcess = ffmpegChildProcess.get(webContents);
    if (childProcess) {
      log.info('start kill process');
      if (process.platform === 'win32') {
        try {
          log.info('kill execution fired');
          await promisedExec(`taskkill.exe /PID ${childProcess.pid} /T /F`);
          ffmpegChildProcess.delete(webContents);
          return {};
        } catch (e) {
          log.info('kill execution might failed');
          return {
            errno: 'ERROR_STOP_TRANSCRIPTION_MIGHT_FAILED',
          };
        }
      } else {
        childProcess.kill('SIGKILL');
        if (childProcess.killed) {
          log.info('kill execution fired');
          ffmpegChildProcess.delete(webContents);
          return {};
        } else {
          log.info('kill execution failed');
          return {
            errno: 'ERROR_STOP_TRANSCRIPTION_FAILED',
          };
        }
      }
    }
    log.info('no corresponding process');
    return {};
  } catch (e) {
    return {
      errno: 'ERROR_STOP_TRANSCRIPTION_UNKNOWN_ERR',
    };
  }
}

export async function createTranscriptionTask(_event: Electron.IpcMainInvokeEvent, filePath: string) {

  function sendError(errno: string) {
    const data = {
      errno,
    };
    log.error(`task:createTranscriptionTask - error - ${data.errno}`);
    return data;
  }

  try {
    log.info(`task:createTranscriptionTask - selectd file path: ${filePath}`);
    const fileStat = await getFileStat(filePath);
    if (!fileStat.isFile()) {
      return sendError('ERROR_INPUT_NOT_A_FILE');
    }
    let fileType;
    let duration;
    try {
      const fileInfo = await getFileInfo(filePath);
      fileType = fileInfo.media_type;
      duration = fileInfo.duration;
    } catch (e) {
      return sendError('ERROR_INVALID_FILE_TYPE');
    }
    if (fileType !== 'video' && fileType !== 'audio') {
      return sendError('ERROR_INVALID_FILE_TYPE');
    }

    const db = await connectDb();
    let taskId: number;
    const { lastID: subtitlesId, changes } = await db.run(`INSERT INTO subtitles (en) VALUES (NULL)`);
    if (changes > 0) {
      const { lastID: _taskId, changes } = await db.run(`INSERT INTO transcription_tasks
        (task_name, subtitles_id, transcribe_state, media_type, location, duration)
        VALUES ($task_name, $subtitles_id, $transcribe_state, $media_type, $location, $duration)`, {
        $task_name: path.basename(filePath),
        $subtitles_id: subtitlesId,
        $transcribe_state: ITRANSCRIBE_STATE.CREATED, // CREATED = 1, STARTED = 2, COMPLETED = 3, ABORTED = 4
        $media_type: fileType === 'video' ? 1 : 2,
        $location: filePath,
        $duration: duration,
      });
      if (!changes) {
        return sendError('ERROR_CREATE_TASK');
      }
      taskId = _taskId;
    } else {
      return sendError('ERROR_CREATE_SUBTITLES');
    }

    const task = await db.get<ITRANSCRIPTION_TASK>(`SELECT * FROM transcription_tasks WHERE id = ? AND delete_flag = 0`, taskId);

    return {
      task,
    };
  } catch(e) {
    log.error('ERROR_CREATE_TRANSCRIPTION_TASK_CAUGHT: ', e);
    return sendError('ERROR_CREATE_TRANSCRIPTION_TASK_CAUGHT');
  }
}

export interface IRequestTranscriptOptions {
  taskId: number;
  modelPath: string;
  gpuEnabled: boolean;
  coremlEnabled: boolean;
  whisperOptions: {
    language: 'auto' | keyof LANGS;
    prompt: string;
    max_len?: number;
  };
}
export async function requestTranscript(event: Electron.IpcMainInvokeEvent, {
  taskId,
  modelPath,
  gpuEnabled,
  coremlEnabled,
  whisperOptions,
} : IRequestTranscriptOptions) {

  const {
    language,
  } = whisperOptions;

  function sendError(errno: string, webContents: Electron.WebContents, { taskId } : { taskId?: number } = {} ) {
    const data: ITranscriptData = {
      type: 'error',
      errno,
      taskId,
    };
    log.error(`task:onReceiveTranscript - error - ${data.errno}`);
    webContents.send('task:onReceiveTranscript', data);
  }

  const webContents = event.sender;
  try {
    log.info('task:requestTranscript - start');
    const db = await connectDb();
    const task = await db.get<ITRANSCRIPTION_TASK>(`SELECT * FROM transcription_tasks WHERE id = ? AND delete_flag = 0`, taskId);
    if (!task) {
      sendError('ERROR_ON_REQ_TRANS_INVALID_TASKID', webContents);
      return;
    }

    const filePath = task.location!;

    log.info('task:requestTranscript - start - extractAudio');
    const { audioFilePath } = await extractAudio(filePath);

    let detectedLang: IRequestTranscriptOptions['whisperOptions']['language'] | 'zh';
    let vttStr = 'WEBVTT\n\n';

    log.info('task:requestTranscript - start - getTranscript');
    const { childProcess } = getTranscript(audioFilePath, async (data) => {
      try {
        data.taskId = task.id;
        if (data.type === 'start') {
          log.info('task:onReceiveTranscript - start - update task');
          await db.run(`UPDATE transcription_tasks SET transcribe_state = ? WHERE id = ?`, [
            ITRANSCRIBE_STATE.STARTED,
            taskId,
          ]);

          const toClearFields = Object.keys(LANGUAGES).concat(['default_lang', 'selected_translation_lang']);
          log.info('task:onReceiveTranscript - start - clear all translations', language, task.subtitles_id);
          // 清空所有语言的翻译以及选中的翻译偏好
          await db.run(`UPDATE subtitles SET ${toClearFields.map(l => l + ' = ?').join(',')} WHERE subtitles_id = ?`, [
            ...toClearFields.map(_ => null),
            task.subtitles_id,
          ]);

          if (language !== 'auto') { // 如果是auto，此处不存入数据库，后面detectLanguage处再写入
            log.info('task:onReceiveTranscript - start - set default_lang', language, task.subtitles_id);
            await db.run(`UPDATE subtitles SET default_lang = ? WHERE subtitles_id = ?`, [
              language,
              task.subtitles_id,
            ]);
          }

          log.info('task:onReceiveTranscript - start - send msg');
          webContents.send('task:onReceiveTranscript', data);

        } else if (data.type === 'data') {

          log.info('task:onReceiveTranscript - data');
          let str = arrayToVttWithoutHeader(data.value);

          let finalLang: keyof LANGS;
          if (language === 'auto') {
            if (!detectedLang || detectedLang === 'auto') { // 如果没有侦测到目标语言，则视为发生错误，终止
              log.error('not able to detect target language, thus abort transcribing');
              handleStopTranscripting(event);
              return;
            }
            if (detectedLang === 'zh') {
              if (str === simple2Traditional(str)) {
                detectedLang = 'zh_TW';
              } else {
                detectedLang = 'zh_CN';
              }
              log.info(`detectedLang(in data callback): ${detectedLang}`);
              await db.run(`UPDATE subtitles SET default_lang = ? WHERE subtitles_id = ?`, [
                detectedLang,
                task.subtitles_id,
              ]);
            }
            finalLang = detectedLang;
          } else {
            finalLang = language;
          }
          if (finalLang === 'zh_CN') {
            str = traditional2Simple(str);
          } else if (finalLang === 'zh_TW') {
            str = simple2Traditional(str);
          }
          vttStr += str + '\n';

          if (!LANGUAGES[finalLang]) { // 防止SQL注入
            log.error('invalid lang code, preventing sql injection');
            handleStopTranscripting(event);
            sendError('ERROR_ON_REQ_TRANS_INVALID_LANG_CODE', webContents, { taskId: data.taskId });
            return;
          }
          log.info('task:onReceiveTranscript - data - update subtitles');
          await db.run(`UPDATE subtitles SET ${finalLang} = ? WHERE subtitles_id = ?`, [
            vttStr,
            task.subtitles_id,
          ]);
          webContents.send('task:onReceiveTranscript', data);
        } else if (data.type === 'error') {
          log.info('task:onReceiveTranscript - error - update task');
          await db.run(`UPDATE transcription_tasks SET transcribe_state = ? WHERE id = ?`, [
            ITRANSCRIBE_STATE.FAILED,
            taskId,
          ]);
          log.info('childProcess.killed', childProcess.killed);
          if (childProcess.killed) {
            const newData = {
              type: 'abort',
              errno: 'ERROR_ON_REQ_TRANS_ABORT_TASK',
              taskId,
            };
            webContents.send('task:onReceiveTranscript', newData);
          } else {
            sendError(data.errno, webContents, { taskId: data.taskId });
          }
        } else if (data.type === 'detectedLang') {
          detectedLang = data.language;
          log.info('task:onReceiveTranscript - detectedLang - set default_lang: ', detectedLang, task.subtitles_id);
          if (detectedLang === 'zh') {
            // 此时尚不清楚是简体还是繁体，需要在有数据返回之后再判断
          } else {
            log.info(`detectedLang(in detectedLang callback): ${detectedLang}`);
            await db.run(`UPDATE subtitles SET default_lang = ? WHERE subtitles_id = ?`, [
              detectedLang,
              task.subtitles_id,
            ]);
          }
        } else { // success
          await db.run(`UPDATE transcription_tasks SET transcribe_state = ? WHERE id = ?`, [
            ITRANSCRIBE_STATE.COMPLETED,
            taskId,
          ]);
          log.info('task:onReceiveTranscript - success');
          webContents.send('task:onReceiveTranscript', data);
        }
      } catch (err) {
        log.error(err);
        sendError('ERROR_UPDATE_TRANSCRIBING_STATE', webContents, { taskId: data.taskId });
      }
    }, {
      modelPath,
      gpuEnabled,
      coremlEnabled,
      whisperOptions,
    });

    log.info('childProcess pid:', childProcess.pid);
    ffmpegChildProcess.set(webContents, childProcess);

  } catch(e) {
    log.error('ERROR_ON_REQ_TRANS_CAUGHT: ', e);
    sendError('ERROR_ON_REQ_TRANS_CAUGHT', webContents);
  }
}

export async function getAllTranscriptionTasks() {
  try {
    const db = await connectDb();

    const rows = await db.all<ITRANSCRIPTION_TASK>(`SELECT * FROM transcription_tasks WHERE delete_flag = 0 ORDER BY id DESC`, []);

    return {
      tasks: rows,
    };
  } catch (e) {
    log.error('ERROR_ALL_TRANS_TASKS_CAUGHT', e);
    return {
      errno: 'ERROR_ALL_TRANS_TASKS_CAUGHT',
    };
  }
}

export interface IUpdateTranscriptionTaskObj {
  task_name: string;
  cover_img: string;
}
export async function updateTranscriptionTask(_event: Electron.IpcMainInvokeEvent, taskId: number, updateObj: IUpdateTranscriptionTaskObj) {
  try {
    const db = await connectDb();

    const updatableField = [
      'task_name',
      'cover_img',
      'delete_flag',
    ];
    const filtered: Record<string, any> = {};
    const setStatment = [];
    for (const k in updateObj) {
      if (updatableField.indexOf(k) !== -1) {
        filtered[`\$${k}`] = updateObj[k as keyof IUpdateTranscriptionTaskObj];
        setStatment.push(`${k} = \$${k}`);
      }
    }
    await db.run(`UPDATE transcription_tasks SET ${setStatment.join(', ')} WHERE id = $id`, {
      ...filtered,
      $id: taskId,
    });
    const task = await db.get<ITRANSCRIPTION_TASK>(`SELECT * FROM transcription_tasks WHERE id = ? AND delete_flag = 0`, taskId);
    return {
      task,
    };
  } catch (e) {
    log.error('ERROR_UPDATE_TRANS_TASK_CAUGHT', e);
    return {
      errno: 'ERROR_UPDATE_TRANS_TASK_CAUGHT',
    };
  }
}
