import { computed, reactive, ref, toRaw, watch } from 'vue';
import { defineStore } from 'pinia';
import { useMediasStore } from './media';
import { ITranscriptItem, vttToArray } from '../../electron/whisper-node/conversion';
import { log } from '../log';
import { ISUBTITLE, LANGS } from '../../electron/sql';
import { availableLangs } from '../configs/langs';
import { useTranscriptionsStore } from './transcriptions';
import { LANGUAGES } from '../../electron/config';
import { CreateStackRes, createStack, msToVttTime, parseVttOrSrtTimeToSeconds, randomAlphanumericStr, vttTimeToMs } from './utils';
import { message } from 'ant-design-vue';
import { getErrorTexts } from '../configs/error-texts';
import { ITranslateResData } from '../../electron/translate';
import { useTransProvidersStore } from './translation-providers';

const rtlLangs = ['ar', 'he'];

function subsToVtt(subs: ITranscriptItem[], secondarySubs: ITranscriptItem[], subsDirection: 'ltr' | 'rtl') {
  const NEW_LINE = '\n';
  const HEADER = `WEBVTT${NEW_LINE}`;
  return HEADER + subs.map((item, index) => {
    const ts = `${item.start} --> ${item.end}`;
    let content = item.content;
    if (secondarySubs && secondarySubs.length) {
      const tag = subsDirection === 'rtl' ? 'i' : 'b';
      content = `${secondarySubs[index]?.content || ''}<${tag}>${content}</${tag}>`;
    }
    return `${ts}${NEW_LINE}${content}${NEW_LINE}`;
  }).join(NEW_LINE);
}

export type ITransLangOpts = {
  id: keyof LANGS | '';
  name: string;
}[];
export type IDownloadableSecondaryLangOpts = {
  id: keyof LANGS | '';
  name: string;
}[];
export const useSubtitlesStore = defineStore('subtitlesStore', () => {

  const mediasStore = useMediasStore();
  const transcriptionsStore = useTranscriptionsStore();
  const transProvidersStore = useTransProvidersStore();
  const selectedId = ref('');
  const activeId = ref('');
  const activeItem = ref<ITranscriptItem>();
  const activeIdx = ref(0);
  const currentSubtitlesId = computed(() => {
    const currentTask = mediasStore.selectedMedia;
    if (currentTask) {
      return currentTask.subtitles_id!;
    }
    return 0;
  });
  const subtitles = reactive<ITranscriptItem[]>([]);
  const secondarySubtitles = reactive<ITranscriptItem[]>([]);
  let subtitlesOriginal = ref<ITranscriptItem[]>([]);
  let secondarySubtitlesOriginal = ref<ITranscriptItem[]>([]);

  const importLanguages = ref([
    ...availableLangs,
  ]);
  const selectedImportLanguageId = ref<keyof LANGS>('en');

  const subtitlesChanged = computed(() => {
    if (subtitles.length !== subtitlesOriginal.value.length) return true;
    for (let i = 0; i < subtitles.length; i++) {
      const current = subtitles[i];
      const original = subtitlesOriginal.value[i];
      if (
        current.content !== original.content
        || current.start !== original.start
        || current.end !== original.end
      ) {
        return true;
      }
    }
    return false;
  });
  const secondarySubtitlesChanged = computed(() => {
    if (secondarySubtitles.length !== secondarySubtitlesOriginal.value.length) return true;
    for (let i = 0; i < secondarySubtitles.length; i++) {
      const current = secondarySubtitles[i];
      const original = secondarySubtitlesOriginal.value[i];
      if (
        current.content !== original.content
        || current.start !== original.start
        || current.end !== original.end
      ) {
        return true;
      }
    }
    return false;
  });

  const currentLang = ref<keyof LANGS>(); // 识别出的主语言
  const translationLangOptions = computed(() => {
    const langs: ITransLangOpts = availableLangs.filter(lang => lang.id !== currentLang.value);
    langs.unshift({
      id: '',
      name: '无',
    });
    return langs;
  });
  const selectedTranlationLang = ref<keyof LANGS | ''>('');
  const alreadyTranslatedLangs = ref<(keyof LANGS)[]>([]);
  const partialTranslatedLangs = ref<(keyof LANGS)[]>([]);

  const subtitlesDirection = computed(() => {
    if (rtlLangs.includes(currentLang.value || '')) return 'rtl';
    return 'ltr';
  });
  const secondarySubtitlesDirection = computed(() => {
    if (rtlLangs.includes(selectedTranlationLang.value || '')) return 'rtl';
    return 'ltr';
  });

  const trackPositionWithVideo = ref(false);

  type SubtiltlesStack = {
    subtitles: ITranscriptItem[],
    secondarySubtitles: ITranscriptItem[],
    selectedTranlationLang: keyof LANGS | '',
  };
  let subsStack: CreateStackRes<SubtiltlesStack> | undefined;

  async function initSubtitlesData() {
    const res = await window.exposedAPI.getStoreValue({
      keys: ['LAST_TRACK_POSITION_SETTING'],
    });
    if (res.errno) {
      log.error('initSubtitlesData', res.errno);
      return;
    }
    // 可能的返回：{ values: [ undefined ] }，即 res.values![0] 为 undefined
    if (!res.values!.length) {
      log.error('initSubtitlesData, no preferred trackPositionWithVideo setting');
      return;
    }
    trackPositionWithVideo.value = res.values![0] && res.values![0].value === '1' ? true : false;
  }


  const vttTrackSrc = computed(() => {
    if (!subtitles.length) {
      return '';
    }
    const vttText = subsToVtt(
      subtitles,
      selectedTranlationLang.value ? secondarySubtitles : [],
      rtlLangs.includes(currentLang.value || '') ? 'rtl' : 'ltr',
    );
    const blob = new Blob([vttText], { type: 'text/vtt' });
    const blobSrc = URL.createObjectURL(blob);
    return blobSrc;
  });

  const panelStatus = computed(() => {
    if (transcriptionsStore.currentTask) {
      const transcribingTaskId = transcriptionsStore.currentTask.taskId;
      const activeTaskId = mediasStore.selectedMedia?.id;
      if (transcribingTaskId === activeTaskId) {
        if (subtitles.length === 0) {
          return 'transcriptionStarted';
        } else {
          return 'transcriptionDataStreaming';
        }
      } else {
        if (activeTaskId && transcriptionsStore.taskIsInWaitingList(activeTaskId)) {
          return 'transcriptionWaiting';
        }
      }
    }
    return 'normal';
  });

  const isDiffTranslating = ref(false);
  const selectedTaskIsTranscribing = computed(() => {
    return transcriptionsStore.currentTask && (transcriptionsStore.currentTask.taskId === mediasStore.selectedMedia?.id);
  });
  const stopTranscriptionTaskBtnShown = computed(() => {
    return selectedTaskIsTranscribing.value;
  });
  const reextractSubtitlesBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value && subtitles.length !== 0;
  });
  const translateBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value && subtitles.length !== 0;
  });
  const realtimeTranslateBtnShown = computed(() => {
    return selectedTaskIsTranscribing.value && currentLang.value;
  });
  const retranslateBtnShown = computed(() => {
    return translateBtnShown.value
      && !isDiffTranslating.value
      && selectedTranlationLang.value
      && (
        alreadyTranslatedLangs.value.includes(selectedTranlationLang.value)
        || partialTranslatedLangs.value.includes(selectedTranlationLang.value)
      );
  });
  const translateUndoneBtnShown = computed(() => {
    return translateBtnShown.value
      && !isDiffTranslating.value
      && selectedTranlationLang.value
      && partialTranslatedLangs.value.includes(selectedTranlationLang.value)
      && subtitles.length !== secondarySubtitles.length; // 主语言都未全部翻译完成时，如果主语言和副语言长度一致，本按钮也不展示
  });
  const downloadSubtitlesBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value && subtitles.length !== 0;
  });
  const saveBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value && (subtitlesChanged.value || secondarySubtitlesChanged.value);
  });
  const importSubtitlesBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value;
  });
  const prevBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value && subtitles.length !== 0;
  });
  const nextBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value && subtitles.length !== 0;
  });

  function pushSubtitles(itemList: ITranscriptItem[]) {
    subtitles.push(...itemList);
  }

  function getTranslatedLangsInfo(subtitle: ISUBTITLE, defaultSubsArr: ITranscriptItem[]) {
    alreadyTranslatedLangs.value = [];
    partialTranslatedLangs.value = [];
    for (const k in LANGUAGES) {
      const langCode = k as keyof LANGS;
      if (subtitle[langCode] && langCode !== subtitle.default_lang) {
        if (mediasStore.selectedMedia?.transcribe_state === 3) {
          const transSubsArr = vttToArray(subtitle[langCode]!);
          if (defaultSubsArr.length === transSubsArr.length) {
            alreadyTranslatedLangs.value.push(langCode);
          } else {
            partialTranslatedLangs.value.push(langCode);
          }
        } else {
          partialTranslatedLangs.value.push(langCode);
        }
      }
    }
  }

  async function setSubtitlesOfTaskId(taskId?: number) {
    if (!taskId) return;

    const subs = await window.exposedAPI.getSubtitles(taskId);

    // 切换时状态重置（状态忘记重置会导致错误发生⚠️⚠️⚠️）
    setSelectedTranlationLang(''); // 清空选择的翻译语言
    // currentTranslatingLang.value = undefined; // 清空当前正在翻译的语言
    downloadPrimaryLang.value = undefined; // 清空下载字幕面板中的主语言选择
    downloadSecondaryLang.value = ''; // 清空下载字幕面板中的副语言选择
    secondarySubtitles.splice(0, secondarySubtitles.length);
    secondarySubtitlesOriginal.value = [];

    if (subs.errno) {
      log.error(subs.errno);
      return;
    }

    currentLang.value = subs.subtitle.default_lang || undefined;
    // 不能放在下列if语句中，因为不管有没有主语言，用户选择的语言需要被选中并存入数据库，当前setSubtitlesOfTaskId方法会频繁被调用，需要及时存储
    initSelectedTranlationLangFromDb(subs.subtitle);
    // currentTaskMediaDuration.value = subs.media_duration;
    const vttText = currentLang.value && subs.subtitle[currentLang.value]!;
    if (vttText) {
      const subsArr = vttToArray(vttText);
      subtitles.splice(0, subtitles.length, ...subsArr);
      subtitlesOriginal.value = structuredClone(subsArr);

      getTranslatedLangsInfo(subs.subtitle, subsArr);

      resetSubsStack();
      subsPush();

    } else {
      log.info('no vtt text yet');
      subtitles.splice(0, subtitles.length);
      subtitlesOriginal.value = [];
    }
  }

  function setActiveId(seconds: number) {
    for (let item of subtitles) {
      const { start, end, id } = item;
      const startTime = parseVttOrSrtTimeToSeconds(start);
      const endTime = parseVttOrSrtTimeToSeconds(end);

      if (seconds >= startTime && seconds < endTime) {
        activeId.value = id;
        activeItem.value = item;
        activeIdx.value = subtitles.findIndex(item => item.id === id);
        return;
      }
    }
  }

  function setSelectedId(id: string) {
    const item = subtitles.find(item => item.id === id);
    if (item) {
      selectedId.value = id;
      if (currentSplittingItem.value !== item) {
        currentSplittingItem.value = undefined; // 清除当前active的分割字幕
      }
      const exptectJumpedToTime = parseVttOrSrtTimeToSeconds(item.start);
      mediasStore.jumptToTime(exptectJumpedToTime);
    }
  }

  function clearSelectedId() {
    selectedId.value = '';
  }

  async function toggleSubtitleTracktion() {
    trackPositionWithVideo.value = !trackPositionWithVideo.value;
    const res = await window.exposedAPI.setStoreValue({
      key: 'LAST_TRACK_POSITION_SETTING',
      value: trackPositionWithVideo.value ? '1' : '0',
    });
    if (res.errno) {
      log.error('toggleSubtitleTracktion setStoreValue error', res.errno);
    }
  }

  async function downloadSubtitles() {
    const currentTask = mediasStore.selectedMedia;
    if (currentTask && downloadPrimaryLang.value) {
      let fileBaseName;
      try {
        const fileNameArr = currentTask.task_name.split('.');
        const ext = fileNameArr[fileNameArr.length - 1];
        if (['mp4', 'mov', 'webm', 'ogv', 'mp3', 'wav', 'ogg'].includes(ext)) { // TODO
          fileBaseName = fileNameArr.slice(0, -1).join('.');
        }
      } catch (e) {
        fileBaseName = currentTask.task_name;
      }
      const res = await window.exposedAPI.downloadSubtitles({
        id: currentSubtitlesId.value,
        language: downloadPrimaryLang.value,
        secondaryLanguage: downloadSecondaryLang.value,
        fileBaseName,
      });
      if (res.errno) {
        message.error(getErrorTexts(res.errno) || '字幕下载未成功');
      } else {
        message.success('字幕下载成功');
      }
    }
  }

  async function translate() {
    if (currentLang.value && selectedTranlationLang.value && mediasStore.selectedMedia) {
      const taskId = mediasStore.selectedMedia.id;
      const subs = await window.exposedAPI.getSubtitles(taskId);
      if (subs.errno) {
        log.error(subs.errno);
        return;
      }
      const vttText = subs.subtitle[selectedTranlationLang.value];
      if (vttText) { // 已翻译过，则从数据库读取
        const subsArr = vttToArray(vttText);
        secondarySubtitles.splice(0, secondarySubtitles.length, ...subsArr);
        secondarySubtitlesOriginal.value = structuredClone(subsArr);
      } else { // 否则进行翻译
        secondarySubtitles.splice(0, secondarySubtitles.length);
        secondarySubtitlesOriginal.value = [];
        return {
          action: 'ACTION_CONFIRM_TRANSLATION',
        };
      }
    } else {
      secondarySubtitles.splice(0, secondarySubtitles.length);
      secondarySubtitlesOriginal.value = [];
    }
  }

  type DiffTranslateOptions = {
    onBatchCompleted: (data: ITranslateResData) => void;
  }
  async function diffTranslate({ onBatchCompleted }: DiffTranslateOptions): Promise<ITranslateResData> {
    try {
      isDiffTranslating.value = true;
      if (currentLang.value && selectedTranlationLang.value && mediasStore.selectedMedia && transProvidersStore.selectedProviderId) {
        let res: ITranslateResData = {};
        const subtitlesId = currentSubtitlesId.value;
        const sourceLang = currentLang.value;
        const targetLang = selectedTranlationLang.value;
        const providerId = transProvidersStore.selectedProviderId;
        const deeplAccType = transProvidersStore.deeplAccType;
        while (!res.nodiff && !res.errno) {
          res = await window.exposedAPI.diffTranslate({
            subtitlesId,
            sourceLang,
            targetLang,
            providerId,
            deeplAccType,
            batchSize: 50,
          });
          onBatchCompleted(res);
        }
        return res;
      }
      return {};
    } catch (e) {
      return {};
    } finally {
      isDiffTranslating.value = false;
    }
  }

  function cancelTranslate() {
    log.info('cancelTranslate');
    // 如果取消前选择的语言之前没有翻译成功过，则清空选择，置为“无”，避免出现选择一个未翻译的语言
    if (
      selectedTranlationLang.value
      && !alreadyTranslatedLangs.value.includes(selectedTranlationLang.value)
      && !partialTranslatedLangs.value.includes(selectedTranlationLang.value)
    ) {
      log.info('setSelectedTranlationLang cancelTranslate');
      setSelectedTranlationLang('');
    }
  }

  function initSelectedTranlationLangFromDb(subtitle: ISUBTITLE) {
    const lang = subtitle.selected_translation_lang;
    if (lang
      // && (
      //   alreadyTranslatedLangs.value.includes(lang)
      //   || partialTranslatedLangs.value.includes(lang)
      // )
    ) {
      log.info('setSelectedTranlationLang from db', lang);
      setSelectedTranlationLang(lang);

      const vttText = subtitle[lang];
      if (vttText) { // 已翻译过，则从数据库读取
        const subsArr = vttToArray(vttText);
        secondarySubtitles.splice(0, secondarySubtitles.length, ...subsArr);
        secondarySubtitlesOriginal.value = structuredClone(subsArr);
      }
    }
  }

  function setSelectedTranlationLang(lang: keyof LANGS | '') {
    selectedTranlationLang.value = lang;
  }

  watch(selectedTranlationLang, async (lang) => {
    await window.exposedAPI.saveSubtitles({
      id: currentSubtitlesId.value,
      selected_translation_lang: lang,
    });
  });

  type ISaveRes = {
    action: 'ACTION_SHOW_SAVE_ERROR' | 'ACTION_SHOW_SAVE_SUCCESS';
  }
  async function save(): Promise<ISaveRes> {
    if (currentSubtitlesId.value && currentLang.value) {
      const res = await window.exposedAPI.saveSubtitles({
        id: currentSubtitlesId.value,
        language: currentLang.value,
        subtitles: toRaw(subtitles),
      });
      if (res.errno) {
        log.error('saveSubtitles error', res.errno);
        return {
          action: 'ACTION_SHOW_SAVE_ERROR',
        };
      } else {
        subtitlesOriginal.value = structuredClone(toRaw(subtitles)); // 更新
      }
    }
    if (currentSubtitlesId.value && selectedTranlationLang.value && secondarySubtitles.length) {
      let secondarySubs = toRaw(secondarySubtitles)
      if (subtitles.length !== secondarySubtitles.length) {
        log.error('subtitles.length and secondarySubtitles.length not match');
        secondarySubs = secondarySubs.slice(0, subtitles.length);
      }
      const res = await window.exposedAPI.saveSubtitles({
        id: currentSubtitlesId.value,
        language: selectedTranlationLang.value,
        subtitles: secondarySubs,
      });
      if (res.errno) {
        return {
          action: 'ACTION_SHOW_SAVE_ERROR',
        };
      } else {
        secondarySubtitlesOriginal.value = structuredClone(toRaw(secondarySubtitles)); // 更新
      }
    }

    resetSubsStack();
    return {
      action: 'ACTION_SHOW_SAVE_SUCCESS',
    };
  }

  async function clearSubtitles() {
    if (currentSubtitlesId.value && selectedTranlationLang.value) {
      log.info('clearSubtitles start');
      const res = await window.exposedAPI.saveSubtitles({
        id: currentSubtitlesId.value,
        language: selectedTranlationLang.value,
        clear: true,
      });
      if (res.errno) {
        log.error('clearSubtitles error', res.errno);
        return res;
      }
    }
    return {};
  }

  const downloadPrimaryLang = ref<keyof LANGS>();
  const downloadSecondaryLang = ref<keyof LANGS | ''>('');
  const downloadablePrimaryLangOptions = computed(() => {
    const translatedLangs = availableLangs.filter(lang => {
      if (
        alreadyTranslatedLangs.value.includes(lang.id)
        || partialTranslatedLangs.value.includes(lang.id)
      ) {
        return true;
      }
      return false;
    });
    const currentLangObj = availableLangs.find(item => {
      return item.id === currentLang.value;
    });
    return currentLangObj ? [currentLangObj].concat(translatedLangs) : translatedLangs;
  });
  const downloadableSecondaryLangOptions = computed(() => {
    const langs: IDownloadableSecondaryLangOpts = downloadablePrimaryLangOptions.value.filter(lang => {
      return lang.id === downloadPrimaryLang.value ? false : true;
    });
    langs.unshift({
      id: '',
      name: '无',
    });
    return langs;
  });
  watch(downloadablePrimaryLangOptions, () => {
    if (!downloadPrimaryLang.value) {
      downloadPrimaryLang.value = downloadablePrimaryLangOptions.value[0]?.id;
    }
  });
  watch(downloadPrimaryLang, () => {
    if (downloadPrimaryLang.value === downloadSecondaryLang.value) {
      downloadSecondaryLang.value = '';
    }
  });

  async function importSubtitles({ language }: { language: keyof LANGS }) {
    if (currentSubtitlesId.value) {
      const newPaths = await window.exposedAPI.openFile({
        title: '选择要导入的字幕',
        filters: [
          { name: 'Subtitles', extensions: ['srt', 'vtt', 'lrc'] }
        ],
        properties: [
          'openFile',
        ],
      });
      if (newPaths && newPaths.length) {
        const importRes = await window.exposedAPI.importSubtitles({
          filePath: newPaths[0],
          subtitlesId: currentSubtitlesId.value,
          language,
        });
        if (!importRes.errno) {
          return {};
        }
        log.error(`importSubtitles error`, importRes.errno);
        return importRes;
      }
    }
    return {};
  }

  // window.exposedAPI.onReceiveTranslation((_event, data) => {
  //   switch (data.type) {
  //     case 'allModelsData': {
  //     }
  //   }
  // });

  const deleteCaptionBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value;
  });
  function deleteCaption(item: ITranscriptItem) {
    const idx = subtitles.findIndex(itm => itm === item);
    subtitles.splice(idx, 1);
    secondarySubtitles.splice(idx, 1);
    subsPush();
  }

  const undoDisabled = ref(true);
  const redoDisabled = ref(true);
  function subsPush() {
    if (!subsStack) {
      subsStack = createStack<SubtiltlesStack>({
        subtitles: structuredClone(toRaw(subtitles)),
        secondarySubtitles: structuredClone(toRaw(secondarySubtitles)),
        selectedTranlationLang: selectedTranlationLang.value,
      });
    } else {
      subsStack.push({
        subtitles: structuredClone(toRaw(subtitles)),
        secondarySubtitles: structuredClone(toRaw(secondarySubtitles)),
        selectedTranlationLang: selectedTranlationLang.value,
      });
    }
    undoDisabled.value = subsStack.isOldest;
    redoDisabled.value = subsStack.isNewest;
  }
  function resetSubsStack() {
    subsStack = undefined;
    undoDisabled.value = true;
    redoDisabled.value = true;
  }

  function subsUndo() {
    if (!subsStack) return;
    if (undoDisabled.value) return;
    let lastSubs = subsStack.undo();
    subtitles.splice(0, subtitles.length, ...structuredClone(lastSubs.subtitles));
    secondarySubtitles.splice(0, secondarySubtitles.length, ...structuredClone(lastSubs.secondarySubtitles));
    setSelectedTranlationLang(lastSubs.selectedTranlationLang);
    undoDisabled.value = subsStack.isOldest;
    redoDisabled.value = subsStack.isNewest;
  }

  function subsRedo() {
    if (!subsStack) return;
    if (redoDisabled.value) return;
    let lastSubs = subsStack.redo();
    subtitles.splice(0, subtitles.length, ...structuredClone(lastSubs.subtitles));
    secondarySubtitles.splice(0, secondarySubtitles.length, ...structuredClone(lastSubs.secondarySubtitles));
    setSelectedTranlationLang(lastSubs.selectedTranlationLang);
    undoDisabled.value = subsStack.isOldest;
    redoDisabled.value = subsStack.isNewest;
  }

  const STEP = 200;
  function timeAdd(item: ITranscriptItem, key: 'start' | 'end', list: ITranscriptItem[], index: number) {
    if (timeAddDisabled(item, key, list, index)) {
      return;
    }
    const ts = vttTimeToMs(item[key]);
    item[key] = msToVttTime(ts + STEP);
  }
  function timeMinus(item: ITranscriptItem, key: 'start' | 'end', list: ITranscriptItem[], index: number) {
    if (timeMinusDisabled(item, key, list, index)) {
      return;
    }
    const ts = vttTimeToMs(item[key]);
    item[key] = msToVttTime(ts - STEP > 0 ? ts - STEP : 0);
  }
  function timeAddDisabled(item: ITranscriptItem, key: 'start' | 'end', list: ITranscriptItem[], index: number) {
    if (selectedTaskIsTranscribing.value) return true;
    const currentTs = vttTimeToMs(item[key]);
    if (key === 'start') {
      const endTs = vttTimeToMs(item.end);
      if (currentTs + STEP >= endTs) {
        return true;
      }
    } else if (key === 'end' && index < list.length - 1) {
      const startTsOfNext = vttTimeToMs(list[index + 1].start);
      if (currentTs + STEP > startTsOfNext) {
        return true;
      }
    }
    return false;
  }
  function timeMinusDisabled(item: ITranscriptItem, key: 'start' | 'end', list: ITranscriptItem[], index: number) {
    if (selectedTaskIsTranscribing.value) return true;
    const currentTs = vttTimeToMs(item[key]);
    if (key === 'start') {
      if (index > 0) {
        const endTsOfPrev = vttTimeToMs(list[index - 1].end);
        if (currentTs - STEP < endTsOfPrev) {
          return true;
        }
      } else {
        if (currentTs - STEP < 0) {
          return true;
        }
      }
    } else if (key === 'end') {
      const startTs = vttTimeToMs(item.start);
      if (currentTs - STEP <= startTs) {
        return true;
      }
    }
    return false;
  }

  function mergeAboveBtnShown(index: number) {
    return !selectedTaskIsTranscribing.value && subtitles.length && index >= 1;
  };
  function mergeBottomBtnShown(index: number) {
    return !selectedTaskIsTranscribing.value && subtitles.length && index <= subtitles.length - 2
  };
  function mergeAbove(item: ITranscriptItem, index: number) {
    const prev = subtitles[index - 1];
    const current = item;
    prev.content = prev.content + ' ' + current.content;
    prev.end = current.end;
    subtitles.splice(index, 1);

    if (secondarySubtitles.length) {
      const secondaryPrev = secondarySubtitles[index - 1];
      const secondaryCurrent = secondarySubtitles[index];
      if (secondaryPrev && secondaryCurrent) {
        secondaryPrev.content = secondaryPrev.content + ' ' + secondaryCurrent.content;
        secondaryPrev.end = secondaryCurrent.end;
        secondarySubtitles.splice(index, 1);
      }
    }

    subsPush();
  }
  function mergeBottom(item: ITranscriptItem, index: number) {
    const next = subtitles[index + 1];
    const current = item;
    current.content = current.content + ' ' + next.content;
    current.end = next.end;
    subtitles.splice(index + 1, 1);

    if (secondarySubtitles.length) {
      const secondaryNext = secondarySubtitles[index + 1];
      const secondaryCurrent = secondarySubtitles[index];
      if (secondaryNext && secondaryCurrent) {
        secondaryCurrent.content = secondaryCurrent.content + ' ' + secondaryNext.content;
        secondaryCurrent.end = secondaryNext.end;
        secondarySubtitles.splice(index + 1, 1);
      }
    }

    subsPush();
  }

  const noSplitterLangs = ['zh_CN', 'zh_TW', 'ja'];
  function contentToWords(item: ITranscriptItem) {
    if (!currentLang.value) return [];
    if (noSplitterLangs.includes(currentLang.value)) {
      return item.content.split('');
    }
    return item.content.split(/\s/);
  }
  function splitContent(item: ITranscriptItem, index: number, wordIndex: number) {
    if (!currentLang.value) return;
    const wordsArr = contentToWords(item);

    const itemStart = vttTimeToMs(item.start);
    const itemEnd = vttTimeToMs(item.end);
    const splitTime = msToVttTime(Math.floor(itemStart + (itemEnd - itemStart) * wordIndex / wordsArr.length));

    let rightContent = '';
    if (noSplitterLangs.includes(currentLang.value)) {
      item.content = wordsArr.slice(0, wordIndex + 1).join('');
      rightContent = wordsArr.slice(wordIndex + 1).join('');
    } else {
      item.content = wordsArr.slice(0, wordIndex + 1).join(' ');
      rightContent = wordsArr.slice(wordIndex + 1).join(' ');
    }
    const newItem: ITranscriptItem = {
      start: splitTime,
      end: item.end,
      content: rightContent,
      id: randomAlphanumericStr(6),
    };
    const secondaryNewItem: ITranscriptItem = {
      start: splitTime,
      end: item.end,
      content: '',
      id: randomAlphanumericStr(6),
    };
    item.end = splitTime;

    subtitles.splice(index + 1, 0, newItem);

    if (secondarySubtitles.length) {
      secondarySubtitles.splice(index + 1, 0, secondaryNewItem);
    }

    subsPush();

    currentSplittingItem.value = undefined;
  }
  const enterSplitModeBtnShown = computed(() => {
    return !selectedTaskIsTranscribing.value;
  });
  const currentSplittingItem = ref<ITranscriptItem>();
  function enterSplitMode(item: ITranscriptItem) {
    currentSplittingItem.value = item;
  }

  return {
    currentSubtitlesId,
    subtitles,
    selectedId,
    activeId,
    activeItem,
    activeIdx,
    setActiveId,
    setSelectedId,
    clearSelectedId,
    trackPositionWithVideo,
    toggleSubtitleTracktion,
    pushSubtitles,
    vttTrackSrc,
    setSubtitlesOfTaskId,
    downloadSubtitles,
    secondarySubtitles,
    translationLangOptions,
    selectedTranlationLang,
    translate,
    setSelectedTranlationLang,
    stopTranscriptionTaskBtnShown,
    reextractSubtitlesBtnShown,
    translateBtnShown,
    realtimeTranslateBtnShown,
    retranslateBtnShown,
    translateUndoneBtnShown,
    downloadSubtitlesBtnShown,
    saveBtnShown,
    importSubtitlesBtnShown,
    prevBtnShown,
    nextBtnShown,
    save,
    alreadyTranslatedLangs,
    cancelTranslate,
    downloadPrimaryLang,
    downloadSecondaryLang,
    downloadablePrimaryLangOptions,
    downloadableSecondaryLangOptions,
    panelStatus,
    subtitlesChanged,
    secondarySubtitlesChanged,
    diffTranslate,
    partialTranslatedLangs,
    initSubtitlesData,
    importSubtitles,
    importLanguages,
    selectedImportLanguageId,
    subsPush,
    subsUndo,
    subsRedo,
    deleteCaptionBtnShown,
    deleteCaption,
    undoDisabled,
    redoDisabled,
    resetSubsStack,
    timeAdd,
    timeMinus,
    timeAddDisabled,
    timeMinusDisabled,
    clearSubtitles,
    mergeAbove,
    mergeBottom,
    mergeAboveBtnShown,
    mergeBottomBtnShown,
    contentToWords,
    splitContent,
    enterSplitMode,
    currentSplittingItem,
    enterSplitModeBtnShown,
    subtitlesDirection,
    secondarySubtitlesDirection,
  };
});
