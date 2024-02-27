import { app, ipcMain } from 'electron';
import path from 'node:path';
import { log } from './log';
import { changeSessionDataDir, changeTempDir, changeUserDataDirInDev } from './init';
import { registerLocalVideoProtocol } from './utils';
import { initDb, setDatabaseDir } from './sql';
import { createTranscriptionTask, getAllTranscriptionTasks, handleFileOpen, handleStopTranscripting, requestTranscript, updateTranscriptionTask } from './handlers/transcribe';
import { createWindow } from './handlers/create-window';
import { saveBase64DataAsAnImage, setImagesDir } from './handlers/file-utils';
import { downloadSubtitles, getSubtitles, importSubtitles, saveSubtitles } from './handlers/subtitles';
import { openDownloadWindow, sendModelsCommand } from './handlers/download-window';
import { translate } from './translate';
import { initModelsDir, setModelsDir } from './models';
import { getStoreValue, setStoreValue } from './handlers/key-value-store';
import { saveSessionId } from './session';
import { apiAgent } from './handlers/api-agent';
import { copyFilesToDir } from './handlers/copy-files-to-dir';
import { diffTranslate } from './translate/queue';

log.info('main start');

changeUserDataDirInDev();
changeSessionDataDir();
changeTempDir();
setImagesDir();
setDatabaseDir();
initModelsDir();
initDb();

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist');
process.env.PUBLIC = path.join(process.env.DIST, '../public');
process.env.ZIMU_ORIGIN = 'http://localhost:4000';

app.whenReady().then(() => {
  log.info('main ready');
  registerLocalVideoProtocol();
  // one-way
  ipcMain.on('task:requestTranscript', requestTranscript);
  // two-way
  ipcMain.handle('dialog:openFile', handleFileOpen);
  ipcMain.handle('task:createTranscriptionTask', createTranscriptionTask);
  ipcMain.handle('task:stopTranscripting', handleStopTranscripting);
  ipcMain.handle('task:getAllTranscriptionTasks', getAllTranscriptionTasks);
  ipcMain.handle('task:saveBase64DataAsAnImage', saveBase64DataAsAnImage);
  ipcMain.handle('task:updateTranscriptionTask', updateTranscriptionTask);
  ipcMain.handle('task:getSubtitles', getSubtitles);
  ipcMain.handle('task:downloadSubtitles', downloadSubtitles);
  ipcMain.handle('task:openDownloadWindow', openDownloadWindow);
  ipcMain.handle('task:sendModelsCommand', sendModelsCommand);
  ipcMain.handle('task:translate', translate);
  ipcMain.handle('task:saveSubtitles', saveSubtitles);
  ipcMain.handle('task:getStoreValue', getStoreValue);
  ipcMain.handle('task:setStoreValue', setStoreValue);
  ipcMain.handle('task:saveSessionId', saveSessionId);
  ipcMain.handle('task:apiAgent', apiAgent);
  ipcMain.handle('task:copyFilesToDir', copyFilesToDir);
  ipcMain.handle('task:diffTranslate', diffTranslate);
  ipcMain.handle('task:setModelsDir', setModelsDir);
  ipcMain.handle('task:importSubtitles', importSubtitles);
  createWindow();
});
