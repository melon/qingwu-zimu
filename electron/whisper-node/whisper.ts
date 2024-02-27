import path from 'node:path';
import shell from 'shelljs';
import { log } from '../log';

type CppCommandTypes = {
  filePath: string;
  modelPath?: string;
  gpuEnabled?: boolean;
  coremlEnabled?: boolean;
  options?: IFlagTypes;
}
export type IFlagTypes = {
  language?: string;
  prompt?: string;
  output_txt?: boolean;
  output_srt?: boolean;
  output_vtt?: boolean;
  max_len?: number;
}


export const createCppCommand = ({ filePath, modelPath, gpuEnabled, coremlEnabled, options = {} }: CppCommandTypes) => {

  // https://github.com/ggerganov/whisper.cpp#quick-start
  const getFlags = (flags: IFlagTypes): string => {
    let s = '';

    let finalLanguage = flags['language'];
    let finalPrompt = flags['prompt'] || '';
    if (flags['language'] === 'zh_CN') {
      finalLanguage = 'zh';
      finalPrompt += ' 简体中文';
    } else if (flags['language'] === 'zh_TW') {
      finalLanguage = 'zh';
    }
    if (finalLanguage) {
      s += ` -l ${finalLanguage}`;
    }

    if (finalPrompt) {
      s += ` --prompt "${finalPrompt}"`;
    }

    if (flags['output_txt']) s += ' -otxt';
    if (flags['output_srt']) s += ' -osrt';
    if (flags['output_vtt']) s += ' -ovtt';

    if (flags['max_len']) s += ` -ml ${flags['max_len']}`;

    return s;
  }

  const WHISPER_PARENT_DIR = path.join(__dirname, '../extraResources/');

  if (process.platform === 'win32') {
    if (gpuEnabled) {
      const WHISPER_CPP_PATH = path.join(WHISPER_PARENT_DIR, 'whisper/build-win32-x64-gpu/bin/Release/');
      shell.cd(WHISPER_CPP_PATH);
      log.info('WHISPER_CPP_PATH(GPU)', WHISPER_CPP_PATH);
      return `main.exe ${getFlags(options)} -m "${modelPath}" -f "${filePath}"`;
    } else {
      const WHISPER_CPP_PATH = path.join(WHISPER_PARENT_DIR, 'whisper/build-win32-x64/bin/Release/');
      shell.cd(WHISPER_CPP_PATH);
      log.info('WHISPER_CPP_PATH', WHISPER_CPP_PATH);
      return `main.exe ${getFlags(options)} -m "${modelPath}" -f "${filePath}"`;
    }
  } else {
    if (coremlEnabled) {
      const WHISPER_CPP_PATH = path.join(WHISPER_PARENT_DIR, `whisper/build-${process.platform}-${process.arch}-coreml/bin/`);
      shell.cd(WHISPER_CPP_PATH);
      log.info('WHISPER_CPP_PATH', WHISPER_CPP_PATH);
      return `DYLD_LIBRARY_PATH="${WHISPER_CPP_PATH}../" ./main ${getFlags(options)} -m "${modelPath}" -f "${filePath}"`;
    } else {
      const WHISPER_CPP_PATH = path.join(WHISPER_PARENT_DIR, `whisper/build-${process.platform}-${process.arch}/bin/`);
      shell.cd(WHISPER_CPP_PATH);
      log.info('WHISPER_CPP_PATH', WHISPER_CPP_PATH);
      return `DYLD_LIBRARY_PATH="${WHISPER_CPP_PATH}../" ./main ${getFlags(options)} -m "${modelPath}" -f "${filePath}"`;
    }
  }
}
