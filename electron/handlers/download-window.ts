import { BrowserWindow, app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { log } from '../log';
import { getModelsDir, allModels, IMODEL, updateModelStatus } from '../models';
import { globalSettings } from '../session';
import { extractFile } from './file-utils';

let mainWebContents: Electron.WebContents;
const downloadItems: Record<string, Electron.DownloadItem> = {};

function fileExists(path: string) {
  try {
    fs.accessSync(path, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export type ISendModelsCommandOptions = {
  command: 'watchModels';
} | {
  command: 'abortDownload';
  fileName: string;
}
export async function sendModelsCommand(event: Electron.IpcMainInvokeEvent, options: ISendModelsCommandOptions) {
  switch (options.command) {
    case 'watchModels': {
      mainWebContents = event.sender;

      await updateModelStatus();

      const data: IModelDownloadData = {
        type: 'allModelsData',
        models: allModels,
      };
      mainWebContents && mainWebContents.send('task:onWatchModels', data);
      break;
    }
    case 'abortDownload': {
      if (downloadItems[options.fileName]) {
        downloadItems[options.fileName].cancel();
      }
      break;
    }
  }
}

export type IModelDownloadData = {
  type: 'allModelsData';
  models: IMODEL[];
} | {
  type: 'completed';
  fileName: string;
  percentage: number;
  status: IMODEL['status'];
} | {
  type: 'progress';
  fileName: string;
  percentage: number;
  status: IMODEL['status'];
} | {
  type: 'failed';
  fileName: string;
  percentage: number;
  status: IMODEL['status'];
}

export type IOpenDownloadWindowOptions = {
  type: 'default' | 'coreml';
}
export function openDownloadWindow(_event: Electron.IpcMainInvokeEvent, { type }: IOpenDownloadWindowOptions) {

  const win = new BrowserWindow({
    backgroundColor: '#fff',
    icon: path.join(process.env.PUBLIC, 'icon.png'),
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
  });

  const availableFileNames = allModels.map(model => {
    return model.fileName;
  });
  const needExtractFileNames = allModels.filter(model => {
    if (model.type2 === 'coreml') {
      return true;
    }
    return false;
  }).map(model => model.fileName);
  const defaultModelDownloadUrl = 'https://huggingface.co/ggerganov/whisper.cpp/tree/main';
  const modelDownloadUrl = globalSettings.modelDownloadUrl! || defaultModelDownloadUrl;
  const coremlModelDownloadUrl = globalSettings.coremlModelDownloadUrl! || defaultModelDownloadUrl;
  const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/109.0.1518.55';
  const userAgent = globalSettings.userAgent || defaultUserAgent;

  if (type === 'default') {
    win.loadURL(modelDownloadUrl, {
      userAgent,
    });
  } else if (type === 'coreml') {
    win.loadURL(coremlModelDownloadUrl, {
      userAgent,
    });
  }

  const didFailLoadHandler = (_event: Electron.Event, errorCode: number, errorDescription: string) => {
    log.error(`openDownloadWindow - did-fail-load - ${errorCode} - ${errorDescription}`);
    win.destroy();
  }
  win.webContents.on('did-fail-load', didFailLoadHandler);

  const downloadingFiles: Record<string, boolean> = {};

  const willDownloadHandler = (event: Electron.Event, downloadItem:  Electron.DownloadItem, _webContents: Electron.WebContents) => { // 不能用异步模式，否则取消文件下载的逻辑可能失效
    const fileName = downloadItem.getFilename();
    const model = allModels.find(model => model.fileName === fileName);
    log.info('getURL: ', downloadItem.getURL());
    log.info('getFilename: ', fileName);
    // log.info('getContentDisposition: ', downloadItem.getContentDisposition());
    // log.info('getURLChain: ', downloadItem.getURLChain());

    if (!availableFileNames.includes(fileName)) {
      // event.preventDefault(); // cancel download. https://www.electronjs.org/docs/latest/api/session#event-will-download
      // downloadItem.cancel();
      log.warn('not model file, cancelled: ', fileName);
      // dialog.showErrorBox('提示', '您选择的不是模型文件');
      return;
    }

    if (downloadingFiles[fileName]) {
      event.preventDefault();
      downloadItem.cancel();
      log.warn(`file is processing, locking`, fileName);
      delete downloadingFiles[fileName];
      return;
    }
    downloadingFiles[fileName] = true;

    const savePath = path.join(getModelsDir(), fileName);
    if (fileExists(savePath)) {
      event.preventDefault();
      downloadItem.cancel();
      log.warn('file already downloaded, cancelled: ', fileName);
      dialog.showErrorBox('提示', '该模型文件已经下载过， 无须重新下载');
      delete downloadingFiles[fileName];
      return;
    }

    const totalBytes = downloadItem.getTotalBytes();
    // log.info('getTotalBytes: ', totalBytes);

    const tempSavePath = path.join(app.getPath('temp'), fileName);

    downloadItem.setSavePath(tempSavePath);

    downloadItems[fileName] = downloadItem;

    log.info('hide window');
    win.hide();

    let data: IModelDownloadData;

    if (model) {
      model.status = 'downloading';
      model.progress = 0;
    }
    data = {
      type: 'progress',
      fileName,
      percentage: 0,
      status: 'downloading',
    };
    mainWebContents && mainWebContents.send('task:onWatchModels', data);

    downloadItem.on('updated', (_event, state) => {
      if (state === 'interrupted') {
        log.info(`${fileName} download is interrupted`);
      } else if (state === 'progressing') {
        if (downloadItem.isPaused()) {
          log.info(`${fileName} download is paused`);
        } else {
          const receivedBytes = downloadItem.getReceivedBytes();
          const percentage = Math.floor(receivedBytes / totalBytes * 100);
          log.info(`${fileName} download: ${percentage}%`);

          data = {
            type: 'progress',
            fileName,
            percentage,
            status: 'downloading',
          };
          if (model) {
            model.status = 'downloading';
            model.progress = percentage;
          }
          mainWebContents && mainWebContents.send('task:onWatchModels', data);
        }
      }
    });
    downloadItem.once('done', async (_event, state) => {
      if (state === 'completed') {
        try {
          log.info(`${fileName} download completed`);

          fs.renameSync(tempSavePath, savePath); // move file from temp location

          if (needExtractFileNames.includes(fileName)) { // 如果是压缩文件，解压缩到models文件夹
            await extractFile(savePath, getModelsDir());
          }

          if (model) {
            model.status = 'downloaded';
            model.progress = 100;
          }

          data = {
            type: 'completed',
            fileName,
            percentage: 100,
            status: 'downloaded',
          };
          mainWebContents && mainWebContents.send('task:onWatchModels', data);

        } catch (e) {
          log.error(`${fileName} extract or move failed`, e);

          if (model) {
            model.status = 'not-downloaded';
            model.progress = 0;
          }
          data = {
            type: 'failed',
            fileName,
            percentage: 0,
            status: 'not-downloaded',
          }
          mainWebContents && mainWebContents.send('task:onWatchModels', data);
        }
      } else {
        log.info(`${fileName} download failed: ${state}`);

        if (model) {
          model.status = 'not-downloaded';
          model.progress = 0;
        }
        data = {
          type: 'failed',
          fileName,
          percentage: 0,
          status: 'not-downloaded',
        }
        mainWebContents && mainWebContents.send('task:onWatchModels', data);
      }
      delete downloadItems[fileName];
      delete downloadingFiles[fileName];
      try {
        win.webContents.session.off('will-download', willDownloadHandler);
      } catch (e) {
        log.info(`win.webContents already destroyed`);
      }
      win.destroy();
    });
  }

  const session = win.webContents.session;

  session.on('will-download', willDownloadHandler); // session似乎是所有window公用的，所以这里的on需要在window关闭时off掉，不然这个handler不会释放

  win.once('close', () => { // trigger only when close window
    log.debug('window close event triggered');
  });
  win.once('closed', () => { // trigger when close or destroy window
    log.debug('window closed event triggered');
    session.off('will-download', willDownloadHandler);
    // win.webContents.off('did-fail-load', didFailLoadHandler);
  });
}
