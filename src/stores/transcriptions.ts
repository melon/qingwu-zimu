import { defineStore } from 'pinia';
import { message } from 'ant-design-vue';
import { getErrorTexts } from '../configs/error-texts';
import { useMediasStore } from './media';
import { useSubtitlesStore } from './subtitles';
import { computed, ref } from 'vue';
import { log } from '../log';
import { LANGS } from '../../electron/sql';
import { useModelsStore } from './models';
import { ITranscriptItem } from '../../electron/whisper-node/conversion';
import { parseVttOrSrtTimeToSeconds, wait } from './utils';
import { watch } from 'vue';
import { useSessionStore } from './session';
import { availableLangs } from '../configs/langs';

export interface IWaitingItem {
  taskId: number;
  modelPath: string;
  gpuEnabled: boolean;
  coremlEnabled: boolean;
  whisperOptions: {
    language: 'auto' | keyof LANGS;
    prompt: string,
    max_len?: number,
  };
}

export const useTranscriptionsStore = defineStore('transcriptionsStore', () => {

  const waitingList: IWaitingItem[] = [];

  const mediasStore = useMediasStore();
  const subtitlesStore = useSubtitlesStore();
  const modelsStore = useModelsStore();
  const sessionStore = useSessionStore();

  const currentTask = ref<IWaitingItem>();
  const languages = ref([
    { id: 'auto', name: '自动检测', },
    ...availableLangs,
  ]);
  const selectedLanguageId = ref<'auto' | keyof LANGS>('auto');
  const selectedLanguage = computed(() => {
    return languages.value.find(item => item.id === selectedLanguageId.value)!;
  });

  const selectLanguageDisabled = computed(() => {
    if (modelsStore.selectedModel && modelsStore.selectedModel.type === 'english') {
      return true;
    }
    return false;
  });

  const currentTaskInfo = computed(() => {
    if (currentTask.value) {
      return mediasStore.getTaskInfoByTaskId(currentTask.value.taskId);
    }
    return undefined;
  });

  const currentPrompt = ref<string>('');
  const maxLenEnabled = ref(false);
  const maxLen = ref(100);
  const lastSubsPacket = ref<ITranscriptItem>();
  const gpuEnabled = ref(false);
  const coremlEnabled = ref(false);

  let globalResolve: any;

  function setSelectedLanguageId(langCode: 'auto' | keyof LANGS) {
    selectedLanguageId.value = langCode;
  }

  async function initTranscribeData() {
    const res = await window.exposedAPI.getStoreValue({
      keys: ['LAST_GPU_SETTING_ENABLED', 'LAST_COREML_SETTING_ENABLED'],
    });
    if (res.errno) {
      log.error('initTranscribeData', res.errno);
      return;
    }
    // 可能的返回：{ values: [ undefined ] }，即 res.values![0] 为 undefined
    if (!res.values!.length) {
      log.error('initTranscribeData, no preferred gpu setting');
      return;
    }
    gpuEnabled.value = res.values![0] && res.values![0].value === '1' ? true : false;
    coremlEnabled.value = res.values![1] && res.values![1].value === '1' ? true : false;
  }

  initTranscribeData();

  watch(() => gpuEnabled.value, async () => {
    const res = await window.exposedAPI.setStoreValue({
      key: 'LAST_GPU_SETTING_ENABLED',
      value: gpuEnabled.value ? '1' : '0',
    });
    if (res.errno) {
      log.error('set LAST_GPU_SETTING_ENABLED failed', res.errno);
    }
  });

  watch(() => coremlEnabled.value, async () => {
    modelsStore.keepPreviousSelectedOrSelectFirstAvailable();
    const res = await window.exposedAPI.setStoreValue({
      key: 'LAST_COREML_SETTING_ENABLED',
      value: coremlEnabled.value ? '1' : '0',
    });
    if (res.errno) {
      log.error('set LAST_COREML_SETTING_ENABLED failed', res.errno);
    }
  });

  const currentProgress = computed(() => {
    if (currentTaskInfo.value && lastSubsPacket.value) {
      const lastTime = parseVttOrSrtTimeToSeconds(lastSubsPacket.value.end);
      let percentage =  Math.floor(lastTime * 1000 / currentTaskInfo.value.duration! * 100);
      if (percentage > 100) {
        percentage = 100;
      }
      return percentage;
    } else {
      return 0;
    }
  });

  window.exposedAPI.onReceiveTranscript(async (_event, data) => {
    function onComplete() {
      if (globalResolve) {
        globalResolve();
      } else {
        // 当后台正在执行task，但前端刷新时，当前task并未在waitingList中
        mediasStore.fetchAllMedias(); // update state of all tasks
      }
    }
    // log.info(data);
    switch (data.type) {
      case 'start': {
        lastSubsPacket.value = undefined;
        mediasStore.fetchAllMedias(); // 每个任务的状态需要更新，这样正在执行的任务才能出现进度条,即transcribe state变成2 TODO:优化
        const task = mediasStore.selectedMedia;
        if (task && data.taskId === task.id) {
          log.info('onReceiveTranscript start: ', data, task);
          subtitlesStore.setSubtitlesOfTaskId(task.id);
        }
        break;
      }
      case 'data': {
        lastSubsPacket.value = data.value[data.value.length - 1];
        const task = mediasStore.selectedMedia;
        if (task && data.taskId === task.id) {
          // log.info('onReceiveTranscript data: ');
          await subtitlesStore.setSubtitlesOfTaskId(task.id);
          await wait(2000);
          const res = await subtitlesStore.diffTranslate({
            onBatchCompleted: () => {
              subtitlesStore.setSubtitlesOfTaskId(task.id);
            }
          });
          if (res.errno) {
            message.error(getErrorTexts(res.errno));
          }
        }
        break;
      }
      case 'error': {
        log.error(`exposedAPI.onReceiveTranscript: error ${data.errno}`);
        lastSubsPacket.value = undefined; // TODO: 多任务
        message.error(getErrorTexts(data.errno));
        onComplete();
        break;
      }
      case 'abort': {
        log.info('exposedAPI.onReceiveTranscript: abort');
        lastSubsPacket.value = undefined;
        message.error(getErrorTexts(data.errno));
        onComplete();
        break;
      }
      case 'success': {
        log.info('exposedAPI.onReceiveTranscript: success');
        lastSubsPacket.value = undefined;
        onComplete();
        break;
      }
    }
  });

  const isExecutingWaitingList = ref(false);
  async function startExecuteWaitingList() {
    if (isExecutingWaitingList.value) return;
    isExecutingWaitingList.value = true;
    while (waitingList.length) {
      const nextTask = waitingList.shift()!;
      currentTask.value = nextTask;
      await new Promise(resolve => {
        log.info(`startExecuteWaitingList: taskId ${nextTask.taskId} started`);
        window.exposedAPI.requestTranscript(nextTask);
        globalResolve = async function() {
          log.info(`startExecuteWaitingList: taskId ${nextTask.taskId} completed`);
          currentTask.value = undefined;
          await mediasStore.fetchAllMedias(); // update state of all tasks
          resolve(undefined);
        }
      });
    }
    isExecutingWaitingList.value = false;
  }

  function taskIsInWaitingList(taskId: number) {
    if (waitingList.find(item => item.taskId === taskId)) {
      return true;
    }
    return false;
  }

  async function addToTranscriptWaitingList(taskId: number) {
    let isGpuEnabled = false;
    let isCoremlEnabled = false;
    if (sessionStore.gpuSettingEnabled) {
      isGpuEnabled = gpuEnabled.value;
    } else { // 触发重置数据库中的值为false
      gpuEnabled.value = false;
    }
    if (sessionStore.coremlSettingEnabled) {
      isCoremlEnabled = coremlEnabled.value;
    } else { // 触发重置数据库中的值为false
      coremlEnabled.value = false;
    }
    log.info('gpu enabled: ', isGpuEnabled);
    log.info('coreml enabled: ', isCoremlEnabled);
    const item = {
      taskId,
      modelPath: modelsStore.selectedModel?.fullPath!,
      gpuEnabled: isGpuEnabled,
      coremlEnabled: isCoremlEnabled,
      whisperOptions: {
        language: selectedLanguageId.value,
        prompt: currentPrompt.value,
        max_len: maxLenEnabled.value ? maxLen.value : 0,
      },
    };
    log.info('waiting item: ', item);
    waitingList.push(item);
    await startExecuteWaitingList();
  }

  function stopTranscriptionTask() {
    window.exposedAPI.stopTranscripting();
  }

  return {
    currentTask,
    languages,
    selectedLanguageId,
    selectedLanguage,
    addToTranscriptWaitingList,
    stopTranscriptionTask,
    taskIsInWaitingList,
    currentPrompt,
    maxLenEnabled,
    maxLen,
    currentTaskInfo,
    currentProgress,
    gpuEnabled,
    coremlEnabled,
    selectLanguageDisabled,
    setSelectedLanguageId,
  };
});
