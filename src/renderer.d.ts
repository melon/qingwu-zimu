import { ITranscriptItem } from "../electron/whisper-node/conversion";
import { ITranscriptData } from "../electron/whisper-node/index";
import { ISUBTITLE, ITRANSCRIPTION_TASK } from "../electron/sql";
import { IRequestTranscriptOptions } from "../electron/handlers/transcribe";
import { IDownloadSubsOptions, IImportSubsOptions, ISaveSubsOptions } from "../electron/handlers/subtitles";
import { IModelDownloadData, ISendModelsCommandOptions } from "../electron/handlers/download-window";
import { ITranslateOptions, ITranslateResData } from "../electron/translate";
import { IGetStoreValue, IKeyValueStoreRes, ISetStoreValue, ISetStoreValueRes } from "../electron/handlers/key-value-store";
import { ISaveSessionId } from "../electron/session";
import { IApiAgentOptions } from "../electron/handlers/api-agent";
import { ICopyFilesToDirOptions, ICopyFilesToDirRes } from "../electron/handlers/copy-files-to-dir";
import { IDiffTranslateOptions } from "../electron/translate/queue";

export interface IExposedAPI {
  // renderer -> main
  requestTranscript: (options: IRequestTranscriptOptions) => Promise<void>,

  // main -> renderer
  onReceiveTranscript: (
    callback: (
      event: Electron.IpcRendererEvent,
      data: ITranscriptData,
    ) => void
  ) => void,
  onWatchModels: (
    callback: (
      event: Electron.IpcRendererEvent,
      data: IModelDownloadData,
    ) => void
  ) => void,
  // onReceiveTranslation: (
  //   callback: (
  //     event: Electron.IpcRendererEvent,
  //     data: string,
  //   ) => void
  // ) => void,

  // renderer <-> main
  openFile: (options: Electron.OpenDialogOptions) => Promise<string[] | undefined>,
  createTranscriptionTask: (filePath: string) => Promise<{
    errno?: string;
    task?: ITRANSCRIPTION_TASK;
  }>,
  stopTranscripting: () => Promise<{ errno?: string; }>,
  getAllTranscriptionTasks: () => Promise<{
    errno?: string;
    tasks?: ITRANSCRIPTION_TASK[];
  }>,
  saveBase64DataAsAnImage: (data: string) => Promise<string>,
  updateTranscriptionTask: (taskId: number, updateObj: IUpdateTranscriptionTaskObj) => Promise<{
    errno?: string;
    task?: ITRANSCRIPTION_TASK;
  }>,
  getSubtitles: (taskId: number) => Promise<{
    errno?: string;
    subtitle: ISUBTITLE;
    media_duration: number;
  }>,
  downloadSubtitles: (options: IDownloadSubsOptions) => Promise<{
    errno?: string;
  }>,
  openDownloadWindow: (options: IOpenDownloadWindowOptions) => Promise<{ errno?: string }>,
  sendModelsCommand: (options: ISendModelsCommandOptions) => Promise<void>,
  translate: (options: ITranslateOptions) => Promise<ITranslateResData>,
  saveSubtitles: (options: ISaveSubsOptions) => Promise<{ errno?: string }>,
  getStoreValue: (options: IGetStoreValue) => Promise<IKeyValueStoreRes>,
  setStoreValue: (options: ISetStoreValue) => Promise<ISetStoreValueRes>,
  saveSessionId: (options: ISaveSessionId) => Promise<ISetStoreValueRes>,
  apiAgent: (options: IApiAgentOptions) => Promise<any>,
  copyFilesToDir: (options: ICopyFilesToDirOptions) => Promise<ICopyFilesToDirRes>,
  diffTranslate: (options: IDiffTranslateOptions) => Promise<ITranslateResData>,
  setModelsDir: (dirPath: string) => Promise<{ errno?: string }>,
  importSubtitles: (options: IImportSubsOptions) => Promise<{ errno?: string }>,
}

declare global {
  interface Window {
    exposedAPI: IExposedAPI
  }
}
