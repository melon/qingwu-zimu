import { ref } from 'vue';
import { defineStore } from 'pinia';
import { log } from '../log';
import { INotificationItem, ISettingLink, ISettingsApiRes } from '../../electron/session';

export interface MenuItem {
  id: string;
  name: string;
  icon: string;
  body: string;
}
export const useSessionStore = defineStore('sessionStore', () => {

  const isLoggedIn = ref();
  const logInQrcode = ref('');
  const logInQrcodeExpired = ref(false);
  const tosHtml = ref('');
  const globalNotifications = ref<INotificationItem[]>([]);
  const avatarUrl = ref();
  const nickname = ref();
  const settingLinks = ref<ISettingLink[]>([]);
  const translationProviderIds = ref<string[]>([]);
  const translationHelpUrl = ref('');
  const currentVersion = ref('');
  const newestVersion = ref('');
  const appDownloadUrl = ref('');
  const gpuSettingEnabled = ref(false);
  const coremlSettingEnabled = ref(false);

  async function getGlobalSettings() {
    const res = await window.exposedAPI.apiAgent({
      func: 'getGlobalSettings',
      params: [],
    }) as ISettingsApiRes;
    if (res.errno) {
      log.error('getGlobalSettings error', res.errno);
      return;
    }
    console.log(res);
    tosHtml.value = res.tosHtml!;
    globalNotifications.value = res.globalNotifications!;
    settingLinks.value = res.settingLinks!;
    translationProviderIds.value = res.translationProviderIds!;
    translationHelpUrl.value = res.translationHelpUrl!;
    currentVersion.value = res.currentVersion!;
    newestVersion.value = res.newestVersion!;
    appDownloadUrl.value = res.appDownloadUrl!;
    gpuSettingEnabled.value = res.gpuSettingEnabled!;
    coremlSettingEnabled.value = res.coremlSettingEnabled!;
  }

  return {
    isLoggedIn,
    logInQrcode,
    tosHtml,
    logInQrcodeExpired,
    getGlobalSettings,
    globalNotifications,
    avatarUrl,
    nickname,
    settingLinks,
    translationProviderIds,
    translationHelpUrl,
    currentVersion,
    newestVersion,
    appDownloadUrl,
    gpuSettingEnabled,
    coremlSettingEnabled,
  };
});
