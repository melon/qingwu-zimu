import { BaiduTranslate, BaiduTranslateSupportLangs } from "./baidu";
import { AliTranslate, AliTranslateSupportLangs } from "./ali";
import { LANGS } from "../sql";
import { YoudaoTranslate, YoudaoTranslateSupportLangs } from "./youdao";
import { HuoshanTranslate, HuoshanTranslateSupportLangs } from "./huoshan";
import { log } from "../log";
import { AzureTranslate, AzureTranslateSupportLangs } from "./azure";
import { DeeplTranslate, DeeplTranslateSupportLangs } from "./deepl";

export type TransProviderIds = 'baidu' | 'ali' | 'youdao' | 'huoshan'
 | 'azure' | 'deepl';

const translatorMap: Record<TransProviderIds, Function> = {
  baidu: BaiduTranslate,
  ali: AliTranslate,
  youdao: YoudaoTranslate,
  huoshan: HuoshanTranslate,
  azure: AzureTranslate,
  deepl: DeeplTranslate,
};

const translatorSupportLangs: Record<TransProviderIds, (keyof LANGS)[]> = {
  baidu: BaiduTranslateSupportLangs,
  ali: AliTranslateSupportLangs,
  youdao: YoudaoTranslateSupportLangs,
  huoshan: HuoshanTranslateSupportLangs,
  azure: AzureTranslateSupportLangs,
  deepl: DeeplTranslateSupportLangs,
};

export type ITranslateOptions = {
  textList: string[]; // 多个text可以用\n连接  如 text='apple\norange\nbanana\npear'
  sourceLang: keyof LANGS;
  targetLang: keyof LANGS;
  providerId: TransProviderIds;
  deeplAccType?: 'free' | 'pro';
}

export type ITranslateResData = {
  errno?: never;
  data?: never;
  totalWordCount?: never;
  nodiff?: never;
} | {
  errno?: never;
  data?: never;
  totalWordCount?: never;
  nodiff: boolean;
} | {
  errno: string;
  data?: never;
  totalWordCount?: never;
  nodiff?: never;
} | {
  errno?: never;
  data: string[];
  totalWordCount: number;
  nodiff?: never;
}


export async function translate(_event: Electron.IpcMainInvokeEvent, options: ITranslateOptions): Promise<ITranslateResData> {
  return await _translate(options);
}
export async function _translate(options: ITranslateOptions): Promise<ITranslateResData> {

  const translator = translatorMap[options.providerId];
  if (!translator) {
    return {
      errno: 'ERROR_NO_USER_SELECTED_PROVIDER',
    };
  }

  const res = await translator(options) as ITranslateResData;
  if (!res.errno) {
    log.info('totalWordCount: ', res.totalWordCount);
  }
  return res;
}

export type GetTranslateSupportLangsRes = (keyof LANGS)[];
export function getTranslateSupportLangs(options: { providerId: TransProviderIds }): GetTranslateSupportLangsRes {
  const langs = translatorSupportLangs[options.providerId];
  return langs;
}
