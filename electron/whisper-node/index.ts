import path from 'node:path';
import { type ChildProcess } from 'node:child_process';
import shell from 'shelljs';
import { createCppCommand, IFlagTypes } from './whisper';
import { whisperOutputToArray, ITranscriptItem } from './conversion';
import { log } from '../log';
import { LANGS } from '../sql';

interface IShellOptions {
  silent?: boolean,
  async?: boolean
}

interface IOptions {
  modelPath: string, // custom path for model
  gpuEnabled: boolean,
  coremlEnabled: boolean,
  whisperOptions: IFlagTypes
  shellOptions?: IShellOptions
}

shell.config.execPath = String(shell.which('node') || shell.which('nodejs'));


export type ITranscriptData = {
  type: 'start';
  taskId: number;
} | {
  type: 'success';
  taskId: number;
} | {
  type: 'data';
  value: ITranscriptItem[];
  taskId: number;
} | {
  type: 'error';
  errno: string;
  taskId?: number;
} | {
  type: 'detectedLang';
  language: keyof LANGS | 'zh';
  taskId: number;
} | {
  type: 'abort';
  errno: string;
  taskId: number;
}

interface IGetTranscriptRes {
  childProcess: ChildProcess;
}
export const getTranscript = (filePath: string, onData: (data: ITranscriptData) => void, options?: IOptions): IGetTranscriptRes => {

  try {
    log.info(`getTranscript start: ${filePath}`);

    const command = createCppCommand({
      filePath: path.normalize(filePath),
      modelPath: options?.modelPath,
      coremlEnabled: options?.coremlEnabled,
      gpuEnabled: options?.gpuEnabled,
      options: options?.whisperOptions
    });

    log.info(`whisper command: ${command}`);

    const finalShellOptions = {
      silent: true,
      async: true,
      ...options?.shellOptions,
    };

    log.info(`command: ${command}`);
    // docs: https://github.com/shelljs/shelljs#execcommand--options--callback
    const child = shell.exec(
      command,
      finalShellOptions,
      (code: number, stdout: string, stderr: string) => {
        log.info(`shell exec callback, code: ${code}`);
        if (code === 0) {
          onData({
            type: 'success',
            taskId: 0, // temp value
          });
        } else {
          log.info(`shell exec callback, stdout: ${stdout}`);
          log.error(`shell exec callback, stderr: ${stderr}`);
          onData({
            type: 'error',
            errno: 'ERROR_WHISPER_CALL',
            taskId: 0, // temp value
          });
        }
      }
    );

    onData({
      type: 'start',
      taskId: 0, // temp value
    });

    // https://stackoverflow.com/questions/10232192/exec-display-stdout-live
    child.stdout!.on('data', (data: Buffer) => {
      const strData = data.toString();

      const value = whisperOutputToArray(strData);
      if (value.length) { // data might be '\n', which leads value to be []
        onData({
          type: 'data',
          value,
          taskId: 0, // temp value
        });
      }
    });
    child.stderr!.on('data', (data: Buffer) => {
      const str = data.toString();
      log.error(`stderr: ${str}`);
      const result = /language: (.+) \(p = /.exec(str);
      if (result) {
        const detectedLang = result[1] as keyof LANGS | 'zh';
        log.info('detectedLang: ', detectedLang);
        onData({
          type: 'detectedLang',
          language: detectedLang,
          taskId: 0, // temp value
        });
      }
    });
    child.on('error', (err) => {
      log.error('whisper error event');
      log.error(err);
    });
    child.on('close', (code, signal) => {
      log.info(`whisper close event: ${code}`, signal);
    });
    child.on('exit', (code) => {
      log.info(`whisper exit event: ${code}`);
    });

    return {
      childProcess: child,
    };
  } catch (e: any) {
    log.info(`Error getting transcript: ${e && e.stack}`);
    throw e;
  }
};
