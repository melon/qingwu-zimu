import { IApiAgentOptions } from "./handlers/api-agent";
import { ICopyFilesToDirOptions } from "./handlers/copy-files-to-dir";
import { IOpenDownloadWindowOptions, ISendModelsCommandOptions } from "./handlers/download-window";
import { IGetStoreValue, ISetStoreValue } from "./handlers/key-value-store";
import { IDownloadSubsOptions, IImportSubsOptions, ISaveSubsOptions } from "./handlers/subtitles";
import { IRequestTranscriptOptions, IUpdateTranscriptionTaskObj } from "./handlers/transcribe";
import { ISaveSessionId } from "./session";
import { ITranslateOptions } from "./translate";
import { IDiffTranslateOptions } from "./translate/queue";

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exposedAPI', {
  // renderer <-> main
  openFile: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:openFile', options),
  createTranscriptionTask: (filePath: string) => ipcRenderer.invoke('task:createTranscriptionTask', filePath),
  stopTranscripting: () => ipcRenderer.invoke('task:stopTranscripting'),
  getAllTranscriptionTasks: () => ipcRenderer.invoke('task:getAllTranscriptionTasks'),
  saveBase64DataAsAnImage: (data: string) => ipcRenderer.invoke('task:saveBase64DataAsAnImage', data),
  updateTranscriptionTask: (taskId: number, updateObj: IUpdateTranscriptionTaskObj) => ipcRenderer.invoke('task:updateTranscriptionTask', taskId, updateObj),
  getSubtitles: (taskId: number) => ipcRenderer.invoke('task:getSubtitles', taskId),
  downloadSubtitles: (options: IDownloadSubsOptions) => ipcRenderer.invoke('task:downloadSubtitles', options),
  openDownloadWindow: (options: IOpenDownloadWindowOptions) => ipcRenderer.invoke('task:openDownloadWindow', options),
  sendModelsCommand: (options: ISendModelsCommandOptions) => ipcRenderer.invoke('task:sendModelsCommand', options),
  translate: (options: ITranslateOptions) => ipcRenderer.invoke('task:translate', options),
  saveSubtitles: (options: ISaveSubsOptions) => ipcRenderer.invoke('task:saveSubtitles', options),
  getStoreValue: (options: IGetStoreValue) => ipcRenderer.invoke('task:getStoreValue', options),
  setStoreValue: (options: ISetStoreValue) => ipcRenderer.invoke('task:setStoreValue', options),
  saveSessionId: (options: ISaveSessionId) => ipcRenderer.invoke('task:saveSessionId', options),
  apiAgent: (options: IApiAgentOptions) => ipcRenderer.invoke('task:apiAgent', options),
  copyFilesToDir: (options: ICopyFilesToDirOptions) => ipcRenderer.invoke('task:copyFilesToDir', options),
  diffTranslate: (options: IDiffTranslateOptions) => ipcRenderer.invoke('task:diffTranslate', options),
  setModelsDir: (dirPath: string) => ipcRenderer.invoke('task:setModelsDir', dirPath),
  importSubtitles: (options: IImportSubsOptions) => ipcRenderer.invoke('task:importSubtitles', options),

  // renderer -> main
  requestTranscript: (options: IRequestTranscriptOptions) => ipcRenderer.send('task:requestTranscript', options),

  // renderer <- main
  onReceiveTranscript: (
    callback: (
      event: Electron.IpcRendererEvent,
      data: string,
    ) => void
  ) => ipcRenderer.on('task:onReceiveTranscript', callback),
  onWatchModels: (
    callback: (
      event: Electron.IpcRendererEvent,
      data: string,
    ) => void
  ) => ipcRenderer.on('task:onWatchModels', callback),
  // onReceiveTranslation: (
  //   callback: (
  //     event: Electron.IpcRendererEvent,
  //     data: string,
  //   ) => void
  // ) => ipcRenderer.on('task:onReceiveTranslation', callback),
});



function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #f5f5f5;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = e => {
  e.data.payload === 'removeLoading' && removeLoading()
}

// setTimeout(removeLoading, 4999)
