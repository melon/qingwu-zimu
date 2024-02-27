import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { IMODEL } from '../../electron/models';
import { message } from 'ant-design-vue';
import { log } from '../log';
import { useTranscriptionsStore } from './transcriptions';
import { IOpenDownloadWindowOptions } from '../../electron/handlers/download-window';

export type SetModelsDirHooks = {
  onDirSelected: () => void;
};

export const useModelsStore = defineStore('modelsStore', () => {

  const transcriptionsStore = useTranscriptionsStore();

  const allModels = ref<IMODEL[]>([]);
  const coremlModels = ref<IMODEL[]>([]);
  const generalModels = computed(() => allModels.value.filter(model => model.type === 'general'));
  const englishModels = computed(() => allModels.value.filter(model => model.type === 'english'));
  const downloadedModel = computed(() => allModels.value.filter(model => model.status === 'downloaded'));
  const downloadedCoremlModel = computed(() => coremlModels.value.filter(model => model.status === 'downloaded'));
  const selectedFileName = ref<string>();
  const selectedModel = computed(() => {
    return downloadedModel.value.find(model => model.fileName === selectedFileName.value);
  });

  const coremlModelsMap = computed(() => {
    const map: Record<string, IMODEL> = {};
    coremlModels.value.forEach(model => {
      const mainModelName = model.fileName.replace('-encoder.mlmodelc.zip', '.bin');
      map[mainModelName] = model;
    });
    return map;
  });

  async function initModelsData() {
    const res = await window.exposedAPI.getStoreValue({
      keys: ['LAST_SELECTED_MODEL'],
    });
    if (res.errno) {
      log.error('initModelsData', res.errno);
      return;
    }
    // 可能的返回：{ values: [ undefined ] }，即 res.values![0] 为 undefined
    if (!res.values!.length || !res.values![0]) {
      log.error('initModelsData, no preferred model');
      return;
    }
    selectModel(res.values![0].value);
  }

  function keepPreviousSelectedOrSelectFirstAvailable() {
    if (downloadedModel.value.length) {
      // 数据更新后，selectedModel
      if (
        downloadedModel.value.find(model => model.fileName === selectedFileName.value)
      ) {
        if (transcriptionsStore.coremlEnabled) {
          if (
            downloadedCoremlModel.value.find(
              model => model.fileName === selectedFileName.value?.replace('.bin', '-encoder.mlmodelc.zip')
            )
          ) {
            // do nothing
          } else {
            selectedFileName.value = undefined; // 置空
            selectFirstAvailable();
          }
        } else { // 如果不是coreml模式，保持当前选中即可
          // do nothing
        }
      } else {
        selectedFileName.value = undefined; // 置空
        selectFirstAvailable();
      }
    } else {
      selectedFileName.value = undefined; // 置空
    }
  }

  function selectFirstAvailable() {
    let model: IMODEL | undefined;
    for (let i = 0; i < downloadedModel.value.length; i++) {
      const currentModel = downloadedModel.value[i];
      if (transcriptionsStore.coremlEnabled) {
        const coremlModel = coremlModelsMap.value[currentModel.fileName as keyof typeof coremlModelsMap.value];
        if (coremlModel && coremlModel.status === 'downloaded') {
          model = currentModel;
          break;
        }
      } else {
        model = currentModel;
      }
    }
    if (model) {
      selectedFileName.value = model.fileName;
    }
  }

  window.exposedAPI.onWatchModels((_event, data) => {
    switch (data.type) {
      case 'allModelsData': {
        allModels.value = data.models.filter(model => model.type2 === 'default');
        coremlModels.value = data.models.filter(model => model.type2 === 'coreml');
        keepPreviousSelectedOrSelectFirstAvailable();
        break;
      }
      case 'progress': {
        const model = allModels.value.find(model => model.fileName === data.fileName);
        if (model) {
          model.progress = data.percentage;
          model.status = data.status;
        }
        if (transcriptionsStore.coremlEnabled) {
          const model = coremlModels.value.find(model => model.fileName === data.fileName);
          if (model) {
            model.progress = data.percentage;
            model.status = data.status;
          }
        }
        break;
      }
      case 'completed': {
        const model = allModels.value.find(model => model.fileName === data.fileName);
        if (model) {
          model.progress = data.percentage;
          model.status = data.status;
        }
        if (transcriptionsStore.coremlEnabled) {
          const model = coremlModels.value.find(model => model.fileName === data.fileName);
          if (model) {
            model.progress = data.percentage;
            model.status = data.status;
          }
        }
        message.success(`文件 ${data.fileName} 下载成功`);
        break;
      }
      case 'failed': {
        const model = allModels.value.find(model => model.fileName === data.fileName);
        if (model) {
          model.progress = data.percentage;
          model.status = data.status;
        }
        if (transcriptionsStore.coremlEnabled) {
          const model = coremlModels.value.find(model => model.fileName === data.fileName);
          if (model) {
            model.progress = data.percentage;
            model.status = data.status;
          }
        }
        message.error(`文件 ${data.fileName} 下载失败，请稍后重试`);
        break;
      }
    }
  });

  window.exposedAPI.sendModelsCommand({
    command: 'watchModels',
  });

  function updateModelsStatus() {
    window.exposedAPI.sendModelsCommand({
      command: 'watchModels',
    });
  }

  function openDownloadWindow({ type }: IOpenDownloadWindowOptions) {
    window.exposedAPI.openDownloadWindow({ type });
  }

  function abortDownload(fileName: string) {
    window.exposedAPI.sendModelsCommand({
      command: 'abortDownload',
      fileName,
    });
  }

  async function selectModel(fileName: string) {
    const targetModel = downloadedModel.value.find(mdl => mdl.fileName === fileName);
    if (!targetModel) {
      return;
    }
    if (transcriptionsStore.coremlEnabled) {
      const coremlModel = coremlModelsMap.value[targetModel.fileName];
      if (coremlModel.status !== 'downloaded') {
        return;
      }
    }
    selectedFileName.value = targetModel.fileName;
    const res = await window.exposedAPI.setStoreValue({
      key: 'LAST_SELECTED_MODEL',
      value: targetModel.fileName,
    });
    if (res.errno) {
      log.error('selectModel setStoreValue error', res.errno);
    }
  }

  async function setModelsDir(hooks: SetModelsDirHooks) {
    const newPaths = await window.exposedAPI.openFile({
      title: '选择目标文件夹',
      properties: [
        'openDirectory',
      ],
    });
    if (newPaths && newPaths.length) {
      if (hooks.onDirSelected) {
        hooks.onDirSelected();
      }
      const setRes = await window.exposedAPI.setModelsDir(newPaths[0]);
      if (!setRes.errno) {
        return {};
      }
      log.error(`setModelsDir error`, setRes.errno);
      return setRes;
    }
  }

  watch(() => selectedModel.value, () => {
    if (selectedModel.value && selectedModel.value.type === 'english') {
      transcriptionsStore.setSelectedLanguageId('en');
    }
  });

  return {
    allModels,
    coremlModels,
    coremlModelsMap,
    generalModels,
    englishModels,
    selectedModel,
    openDownloadWindow,
    selectModel,
    updateModelsStatus,
    abortDownload,
    initModelsData,
    setModelsDir,
    keepPreviousSelectedOrSelectFirstAvailable,
  };
});
