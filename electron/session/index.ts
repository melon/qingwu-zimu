import { getStoreValue, setStoreValue } from "../handlers/key-value-store";
import { log } from "../log";
import { version } from '../../package.json';

export type ISaveSessionId = {
  session_id: string;
};

export async function saveSessionId(_event: Electron.IpcMainInvokeEvent, options: ISaveSessionId) {
  const res = await setStoreValue(_event, {
    key: 'SESSION_ID',
    value: options.session_id,
  });
  if (res.errno) {
    return res;
  }
  return {};
}

export async function getSessionId() {
  const res = await getStoreValue({} as Electron.IpcMainInvokeEvent, {
    keys: ['SESSION_ID'],
  });
  if (res.errno) {
    log.error(`getSessionId: ${res.errno}`);
    return undefined;
  }
  // 可能的返回：{ values: [ undefined ] }，即 res.values![0] 为 undefined
  if (!res.values!.length || !res.values![0]) {
    log.error(`getSessionId: session id not found`);
    return undefined;
  }
  return res.values![0].value;
}

export type IZimuUser = {
  id: number;
  nickname: string | null;
  sex: number | null;
  avatar_url: string | null;
}
export type IUserInfoRes = {
  errno?: never;
  user: IZimuUser;
} | {
  errno: string;
  user?: never;
}

export interface INotificationItem {
  message: string;
  description: string;
  duration: number | null;
}
export interface ISettingLink {
  link: string;
  name: string;
}
export type ISettingsApiRes = {
  errno: string;
  modelDownloadUrl?: never;
  coremlModelDownloadUrl?: never;
  userAgent?: never;
  needLogin?: never;
  tosHtml?: never;
  globalNotifications?: never;
  settingLinks?: never;
  translationProviderIds?: never;
  translationHelpUrl?: never;
  currentVersion?: never;
  newestVersion?: never;
  appDownloadUrl?: never;
  gpuSettingEnabled?: never;
  coremlSettingEnabled?: never;
} | {
  errno?: never;
  modelDownloadUrl: string;
  coremlModelDownloadUrl: string;
  userAgent: string;
  needLogin: boolean;
  tosHtml: string;
  globalNotifications: INotificationItem[];
  settingLinks: ISettingLink[];
  translationProviderIds: string[];
  translationHelpUrl: string;
  currentVersion: string;
  newestVersion: string;
  appDownloadUrl: string;
  gpuSettingEnabled: boolean;
  coremlSettingEnabled: boolean;
}
export let globalSettings:ISettingsApiRes = {
  modelDownloadUrl: '',
  coremlModelDownloadUrl: '',
  userAgent: '',
  needLogin: true,
  tosHtml: '',
  globalNotifications: [],
  settingLinks: [],
  translationProviderIds: [],
  translationHelpUrl: '',
  currentVersion: version,
  newestVersion: '',
  appDownloadUrl: '',
  gpuSettingEnabled: false,
  coremlSettingEnabled: false,
};
export async function getGlobalSettings() {
  try {

    globalSettings = {
      modelDownloadUrl: 'https://www.123pan.com/s/xjNqVv-w3kCd.html',
      coremlModelDownloadUrl: 'https://www.123pan.com/s/xjNqVv-J3kCd.html',
      userAgent: '',
      needLogin: true,
      tosHtml: '',
      globalNotifications: [],
      settingLinks: [
        {
          name: '反馈与帮助',
          link: 'https://c8lzozw51w.feishu.cn/docx/XOyrdvCmwoUhboxrcT0csCP5nRf',
        },
      ],
      translationProviderIds: ['baidu', 'ali', 'youdao', 'huoshan', 'azure', 'deepl'],
      translationHelpUrl: 'https://zimu.qijingdict.com/zimu/translation-providers',
      currentVersion: version,
      newestVersion: '',
      appDownloadUrl: 'https://www.123pan.com/s/xjNqVv-P6kCd.html',
      gpuSettingEnabled: false,
      coremlSettingEnabled: false,
    } as unknown as ISettingsApiRes;

    // 非windows系统不展示GPU选项
    if (process.platform !== 'win32') {
      globalSettings.gpuSettingEnabled = false;
    }

    // 非苹果arm芯片不展示CoreML选项
    if (process.platform !== 'darwin' || process.arch !== 'arm64') {
      globalSettings.coremlSettingEnabled = false;
    }

    return globalSettings;
  } catch (e) {
    log.error(`getGlobalSettings catch: `, e);
    return {
      errno: 'ERROR_GET_GLOBAL_SETTINGS_CATCH',
    };
  }
}
