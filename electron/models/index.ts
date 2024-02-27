import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { _getStoreValue, _setStoreValue } from '../handlers/key-value-store';
import { log } from '../log';

let modelsDir: string;
export function getModelsDir() {
  if (!modelsDir) {
    log.error(`getModelsDir not set: ${modelsDir}`);
  }
  return modelsDir;
}

export interface IMODEL {
  fileName: string;
  fullPath: string;
  name: string;
  reportedSize: string;
  type: 'general' | 'english';
  type2: 'default' | 'coreml';
  status: 'not-downloaded' | 'downloaded' | 'downloading';
  progress: number;
};
export const allModels: IMODEL[] = [
  { fileName: 'ggml-base.bin', type2: 'default', fullPath: '', name: '基础模型', reportedSize: '148MB', type: 'general', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-small.bin', type2: 'default', fullPath: '', name: '小模型', reportedSize: '488MB', type: 'general', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-medium.bin', type2: 'default', fullPath: '', name: '中模型', reportedSize: '1.53GB', type: 'general', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-large.bin', type2: 'default', fullPath: '', name: '大模型', reportedSize: '3.09GB', type: 'general', status: 'not-downloaded', progress: 0 },

  { fileName: 'ggml-base.en.bin', type2: 'default', fullPath: '', name: '基础模型', reportedSize: '148MB', type: 'english', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-small.en.bin', type2: 'default', fullPath: '', name: '小模型', reportedSize: '488MB', type: 'english', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-medium.en.bin', type2: 'default', fullPath: '', name: '中模型', reportedSize: '1.53GB', type: 'english', status: 'not-downloaded', progress: 0 },

  { fileName: 'ggml-base-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '基础模型', reportedSize: '37.9MB', type: 'general', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-small-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '小模型', reportedSize: '163MB', type: 'general', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-medium-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '中模型', reportedSize: '568MB', type: 'general', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-large-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '大模型', reportedSize: '1.17GB', type: 'general', status: 'not-downloaded', progress: 0 },

  { fileName: 'ggml-base.en-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '基础模型', reportedSize: '38MB', type: 'english', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-small.en-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '小模型', reportedSize: '163MB', type: 'english', status: 'not-downloaded', progress: 0 },
  { fileName: 'ggml-medium.en-encoder.mlmodelc.zip', type2: 'coreml', fullPath: '', name: '中模型', reportedSize: '567MB', type: 'english', status: 'not-downloaded', progress: 0 },
];

export async function initModelsDir() {
  try {
    const getRes = await _getStoreValue({
      keys: ['MODELS_DIR_PATH'],
    });
    // 可能的返回：{ values: [ undefined ] }，即 res.values![0] 为 undefined
    if (!getRes.errno && getRes.values?.length && getRes.values[0]) {
      modelsDir = getRes.values[0].value;
    } else {
      log.info(`_getStoreValue failed, using default models dir`);
      const userDataDir = app.getPath('userData');
      modelsDir = path.join(userDataDir, 'models');
    }

    log.info('initModelsDir: ', modelsDir);
    fs.mkdirSync(modelsDir, { recursive: true });

    allModels.forEach(model => {
      model.fullPath = path.join(getModelsDir(), model.fileName);
    });
  } catch (e) {
    log.error(`initModelsDir catch: `, e);
    return {
      errno: 'ERROR_INIT_MODELS_DIR_CAUGHT',
    };
  }
}

async function moveModelsDir(oldModelsDir: string, newModelsDir: string, level: number = 0, filter: (entry: fs.Dirent) => boolean) {
  await fsPromises.mkdir(newModelsDir, { recursive: true });
  let entries = await fsPromises.readdir(oldModelsDir, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(oldModelsDir, entry.name);
    let destPath = path.join(newModelsDir, entry.name);

    if (entry.isDirectory()) {
      if (level === 0) {
        if (filter(entry)) {
          await moveModelsDir(srcPath, destPath, level + 1, filter);
          await fsPromises.rm(srcPath, { recursive: true });
        }
      } else {
        await moveModelsDir(srcPath, destPath, level + 1, filter);
      }
    } else {
      if (level === 0) {
        if (filter(entry)) {
          await fsPromises.copyFile(srcPath, destPath);
          await fsPromises.rm(srcPath);
        }
      } else {
        await fsPromises.copyFile(srcPath, destPath);
        await fsPromises.rm(srcPath);
      }
    }
  }
}

export async function setModelsDir(_event: Electron.IpcMainInvokeEvent, dirPath: string) {
  return await _setModelsDir(dirPath);
}
export async function _setModelsDir(dirPath: string) {
  try {
    let oldModelsDir: string;
    const getRes = await _getStoreValue({
      keys: ['MODELS_DIR_PATH'],
    });
    // 可能的返回：{ values: [ undefined ] }
    if (!getRes.errno && getRes.values?.length && getRes.values[0]) {
      oldModelsDir = getRes.values[0].value;
    } else {
      log.info(`setModelsDir - _getStoreValue failed, using default models dir`);
      const userDataDir = app.getPath('userData');
      oldModelsDir = path.join(userDataDir, 'models');
    }

    try {
      // await fsPromises.mkdir(dirPath, { recursive: true });
      log.info('oldModelsDir: ', oldModelsDir);
      log.info('newModelsDir:', dirPath);
      await moveModelsDir(oldModelsDir, dirPath, 0, (entry: fs.Dirent) => {
        if (
          /^ggml-.*\.zip$/.test(entry.name)
          || /^ggml-.*\.mlmodelc$/.test(entry.name)
          || /^ggml-.*\.bin$/.test(entry.name)
        ) {
          return true;
        }
        return false;
      });

      const setRes = await _setStoreValue({
        key: 'MODELS_DIR_PATH',
        value: dirPath,
      });
      if (setRes.errno) {
        log.error(`setModelsDir - _setStoreValue failed, using default models dir`);
      } else {
        modelsDir = dirPath;
      }
    } catch (e) {
      log.error(`_setModelsDir fs error`, e);
    }

    log.info('setModelsDir: ', modelsDir);

    allModels.forEach(model => {
      model.fullPath = path.join(getModelsDir(), model.fileName);
    });

    return {};
  } catch (e) {
    log.error(`_setModelsDir catch: `, e);
    return {
      errno: 'ERROR_SET_MODELS_DIR_CAUGHT',
    };
  }
}

export async function updateModelStatus() {
  for (const model of allModels) {
    const filePath = path.join(getModelsDir(), model.fileName);
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      model.status = 'downloaded';
      model.progress = 100;
    } catch (e) {
      if (model.status === 'downloaded') { // downloading的状态不更新
        model.status = 'not-downloaded';
        model.progress = 0;
      }
    }
  }
}
