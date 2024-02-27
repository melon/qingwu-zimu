import { getGlobalSettings } from "../session";
import { getTranslateSupportLangs } from "../translate";


const funcMap = {
  getGlobalSettings: getGlobalSettings,
  getTranslateSupportLangs: getTranslateSupportLangs,
};

export type IApiAgentOptions = {
  func: string,
  params: any[],
}
export async function apiAgent(_event: Electron.IpcMainInvokeEvent, options: IApiAgentOptions): Promise<any> {
  const finalFunc = funcMap[options.func as keyof typeof funcMap];
  if (!finalFunc) {
    return {
      errno: 'ERROR_API_AGENT_FUNC_NOT_FOUND',
    };
  }
  // @ts-ignore
  return await finalFunc(...options.params)
}
