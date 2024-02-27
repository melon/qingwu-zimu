import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { log } from '../log';
import { useSessionStore } from './session';
import { GetTranslateSupportLangsRes, TransProviderIds } from '../../electron/translate';

export interface ITranslationProvider {
  id: TransProviderIds;
  name: string;
  key: string;
  enabled: boolean;
  modelFields: { id: string; name: string, type: string, rules: Record<string, any>[] }[],
  model: Record<string, any>,
  tempModel: Record<string, any>,
}

export const useTransProvidersStore = defineStore('transProvidersStore', () => {

  const sessionStore = useSessionStore();

  const allProviders = ref<ITranslationProvider[]>([
    {
      id: 'deepl',
      name: 'DeepL翻译',
      key: 'DEEPL_TRANS_SETTINGS',
      enabled: false,
      modelFields: [
        {
          id: 'authKey',
          name: 'authKey',
          type: 'input-password',
          rules: [],
        },
        { id:'deeplAccType',
          name: '是否为付费版',
          type: 'switch',
          rules: [],
        },
      ],
      model: {
        authKey: '',
        deeplAccType: 'free',
      },
      tempModel: {
        authKey: '',
        deeplAccType: 'free',
      },
    },
    {
      id: 'baidu',
      name: '百度翻译',
      key: 'BAIDU_MT_SETTINGS',
      enabled: false,
      modelFields: [
        {
          id: 'appid',
          name: 'appid',
          type: 'input',
          rules: [],
        },
        { id:'key',
          name: 'key',
          type: 'input-password',
          rules: [],
        },
      ],
      model: {
        appid: '',
        key: '',
      },
      tempModel: {
        appid: '',
        key: '',
      },
    },
    {
      id: 'azure',
      name: '微软翻译',
      key: 'AZURE_TRANS_SETTINGS',
      enabled: false,
      modelFields: [
        {
          id: 'subKey',
          name: '密钥',
          type: 'input-password',
          rules: [],
        },
        { id:'subRegion',
          name: '区域',
          type: 'input',
          rules: [],
        },
      ],
      model: {
        subKey: '',
        subRegion: '',
      },
      tempModel: {
        subKey: '',
        subRegion: '',
      },
    },
    {
      id: 'huoshan',
      name: '火山翻译',
      key: 'HUOSHAN_MT_SETTINGS',
      enabled: false,
      modelFields: [
        {
          id: 'accessKeyID',
          name: 'accessKeyID',
          type: 'input',
          rules: [],
        },
        { id:'secretAccessKey',
          name: 'secretAccessKey',
          type: 'input-password',
          rules: [],
        },
      ],
      model: {
        accessKeyID: '',
        secretAccessKey: '',
      },
      tempModel: {
        accessKeyID: '',
        secretAccessKey: '',
      },
    },
    {
      id: 'youdao',
      name: '网易有道翻译',
      key: 'YOUDAO_TRANS_SETTINGS',
      enabled: false,
      modelFields: [
        {
          id: 'appid',
          name: 'appid',
          type: 'input',
          rules: [],
        },
        { id:'key',
          name: 'key',
          type: 'input-password',
          rules: [],
        },
      ],
      model: {
        appid: '',
        key: '',
      },
      tempModel: {
        appid: '',
        key: '',
      },
    },
    {
      id: 'ali',
      name: '阿里翻译',
      key: 'ALI_MT_SETTINGS',
      enabled: false,
      modelFields: [
        {
          id: 'accessKeyId',
          name: 'accessKeyId',
          type: 'input',
          rules: [],
        },
        { id:'accessKeySecret',
          name: 'accessKeySecret',
          type: 'input-password',
          rules: [],
        },
      ],
      model: {
        accessKeyId: '',
        accessKeySecret: '',
      },
      tempModel: {
        accessKeyId: '',
        accessKeySecret: '',
      },
    },
  ]);
  const availableModels = computed(() => {
    return allProviders.value.filter(model => {
      return sessionStore.translationProviderIds.includes(model.id);
    });
  });
  const selectedProviderId = ref<TransProviderIds | undefined>();
  const deeplAccType = computed(() => {
    const deepl = allProviders.value.find(item => item.id === 'deepl')!;
    return deepl.model.deeplAccType;
  });
  const selectedProvider = computed(() => {
    return availableModels.value.find(item => item.id === selectedProviderId.value);
  });
  const editingProvider = ref<ITranslationProvider>();

  async function initProvidersData() {
    const providerKeys = allProviders.value.map(provider => provider.key);
    const res = await window.exposedAPI.getStoreValue({
      keys: [...providerKeys, 'USER_SELECTED_TRANS_PROVIDER'],
    });
    if (res.errno) {
      log.error(res.errno);
      return;
    }
    // 可能的返回：{ values: [ undefined ] }，即 res.values![0] 为 undefined
    res.values!.forEach(item => {
      if (!item) return;
      if (item.key === 'USER_SELECTED_TRANS_PROVIDER') {
        if (availableModels.value.find(provider => provider.id === item.value)) { // 保存用户选择的翻译供应商
          selectedProviderId.value = item.value as TransProviderIds;
        }
      } else {
        const provider = allProviders.value.find(provider => provider.key === item.key);
        if (provider) {
          try {
            const key = JSON.parse(item.value) as any;
            let enabled = true;
            provider.modelFields.forEach(field => {
              provider.model[field.id] = key[field.id];
              provider.tempModel[field.id] = key[field.id];
              if (!key[field.id]) {
                enabled = false;
              }
            });
            provider.enabled = enabled;
          } catch (e) {
            log.error('initProvidersData: error parsing json');
          }
        }
      }
    });
  }

  async function updateProvidersData(item: ITranslationProvider) {
    const data: Record<string, any> = {};
    item.modelFields.forEach(field => {
      data[field.id] = item.model[field.id];
    });
    const jsonStr = JSON.stringify(data);
    const res = await window.exposedAPI.setStoreValue({
      key: item.key,
      value: jsonStr,
    });
    if (res.errno) {
      log.error('updateProvidersData - setStoreValue error');
      return;
    }
    item.enabled = true;
  }

  async function updateSelectedProviderInDb(item: ITranslationProvider) {
    const res = await window.exposedAPI.setStoreValue({
      key: 'USER_SELECTED_TRANS_PROVIDER',
      value: item.id,
    });
    if (res.errno) {
      log.error('updateSelectedProviderInDb - setStoreValue error');
      return;
    }
  }

  function getProvider(id: string) {
    return allProviders.value.find(item => item.id === id);
  }

  async function selectProvider(item: ITranslationProvider) {
    if (item.enabled) {
      await updateSelectedProviderInDb(item);
      selectedProviderId.value = item.id;
    }
  }

  function editProvider(item: ITranslationProvider) {
    editingProvider.value = item;
  }

  async function saveEditingProvider() {
    if (editingProvider.value) {
      const providerModel = editingProvider.value.model;
      const providerTempModel = editingProvider.value.tempModel;
      for (let k in providerModel) {
        providerModel[k] = providerTempModel[k];
      }
      await updateProvidersData(editingProvider.value);
      await selectProvider(editingProvider.value);
      editingProvider.value = undefined;
    }
  }

  function cancelEditingProvider() {
    if (editingProvider.value) {
      const providerModel = editingProvider.value.model;
      const providerTempModel = editingProvider.value.tempModel;
      for (let k in providerModel) {
        providerTempModel[k] = providerModel[k];
      }
      editingProvider.value = undefined;
    }
  }

  async function getTranslateSupportLangs() {
    if (selectedProviderId.value) {
      const langs = await window.exposedAPI.apiAgent({
        func: 'getTranslateSupportLangs',
        params: [{
          providerId: selectedProviderId.value,
        }],
      }) as GetTranslateSupportLangsRes;
      return langs;
    }
    return [];
  }

  return {
    availableModels,
    selectedProviderId,
    selectProvider,
    selectedProvider,
    getProvider,
    editingProvider,
    editProvider,
    saveEditingProvider,
    cancelEditingProvider,
    initProvidersData,
    updateSelectedProviderInDb,
    deeplAccType,
    getTranslateSupportLangs,
  };
});
