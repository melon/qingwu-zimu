import { ref, computed, nextTick, watch } from 'vue';
import { defineStore } from 'pinia';
import { ITRANSCRIPTION_TASK } from '../../electron/sql';
import { log } from '../log';
import { useTranscriptionsStore } from './transcriptions';
import { useSubtitlesStore } from './subtitles';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const useMediasStore = defineStore('mediasStore', () => {

  const transcriptionsStore = useTranscriptionsStore();
  const subtitlesStore = useSubtitlesStore();

  const allTabs = [
    { id: 'all', name: '全部' },
    { id: 'video', name: '视频' },
    { id: 'audio', name: '音频' },
  ] as const;

  const allRawTasks = ref<ITRANSCRIPTION_TASK[]>([]);

  const exptectJumpedToTime = ref(0);
  const needUpdateJumpTime = ref(0); // timestamp

  type ITabsType = Pick<typeof allTabs[number], 'id'>['id'];

  const currentTabId = ref<ITabsType>('all');
  const currentTab = computed(() => {
    return allTabs.find(item => item.id === currentTabId.value)!;
  });

  const mediaTypeMap = {
    all: 0,
    video: 1,
    audio: 2,
  };
  const mediasOfCurrentTab = computed(() => {
    let filteredRawList = ref<ITRANSCRIPTION_TASK[]>([]);
    if (currentTabId.value !== 'all') {
      filteredRawList.value = allRawTasks.value.filter(item => {
        return item.media_type === mediaTypeMap[currentTabId.value];
      });
    } else {
      filteredRawList.value = allRawTasks.value;
    }

    return filteredRawList.value.map(item => {
      return {
        ...item,
        location: item.location && `local-media://${item.location}`,
        cover_img: item.cover_img && `local-media://${item.cover_img}`,
      };
    });

  });

  const selectedMedia = ref<ITRANSCRIPTION_TASK>();

  function selectMedia(id?: number) {
    selectedMedia.value = undefined;
    selectMediaWithoutFirstSetToUndefined(id);
  }

  function selectMediaWithoutFirstSetToUndefined(id?: number) {
    let media: ITRANSCRIPTION_TASK | undefined;
    if (id) {
      media = mediasOfCurrentTab.value.find(item => item.id === id);
    } else {
      media = mediasOfCurrentTab.value[0];
    }
    if (media) {
      nextTick(() => {
        selectedMedia.value = media;

        subtitlesStore.setSubtitlesOfTaskId(media!.id);
      });
    }
  }

  function formatSrtTime(timeStr: string) {
    return timeStr;
  }

  function jumptToTime(time: number) {
    exptectJumpedToTime.value = time;
    needUpdateJumpTime.value = Date.now();
  }

  async function fetchAllMedias() {
    const taskResult = await window.exposedAPI.getAllTranscriptionTasks();
    if (taskResult.errno) {
      log.error(taskResult.errno);
      return;
    }
    allRawTasks.value = taskResult.tasks!;
    if (allRawTasks.value.length) {
      if (!selectedMedia.value) {
        selectMedia();
      } else {
        if (allRawTasks.value.find(item => item.id === selectedMedia.value?.id)) { // 选中对象虽然内容可能相同，但对象地址已发生变化，需要重新选择
          selectMediaWithoutFirstSetToUndefined(selectedMedia.value?.id!);
        } else {
          selectMedia();
        }
      }
    }
  }

  fetchAllMedias();

  async function captureScreenshot(videoElement: HTMLVideoElement) {
    const currentMedia = selectedMedia.value;
    if (currentMedia && !currentMedia.cover_img) {
      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      canvas.getContext('2d')!.drawImage(videoElement, 0, 0, width, height);
      const dataURL = canvas.toDataURL();

      const coverImgUrl = await window.exposedAPI.saveBase64DataAsAnImage(dataURL);
      const updateResult = await window.exposedAPI.updateTranscriptionTask(currentMedia.id, {
        cover_img: coverImgUrl,
      });
      if (updateResult.errno) {
        log.error(updateResult.errno);
        return;
      }
      const rawMedia = allRawTasks.value.find(item => item.id === currentMedia.id);
      if (rawMedia) {
        rawMedia.cover_img = updateResult.task!.cover_img;
      }
    }
  }

  async function deleteTask() {
    const currentMedia = selectedMedia.value;
    if (currentMedia) {
      if (transcriptionsStore.currentTask?.taskId === currentMedia.id) { // 删除任务前，如果任务正在执行，先停止
        transcriptionsStore.stopTranscriptionTask();
      }
      const updateResult = await window.exposedAPI.updateTranscriptionTask(currentMedia.id, {
        delete_flag: 1,
      });
      if (updateResult.errno) {
        log.error(updateResult.errno);
        return;
      }
      fetchAllMedias();
    }
  }

  async function createTranscriptionTask(filePath: string) {
    const taskResult = await window.exposedAPI.createTranscriptionTask(filePath);
    if (!taskResult.errno) {
      allRawTasks.value.unshift(taskResult.task!);
      selectMedia(taskResult.task!.id); // 默认选中
    }
    return taskResult;
  }

  function transcribeStateText(task: ITRANSCRIPTION_TASK) {
    /**
     * CREATED: 1,
     * STARTED: 2,
     * COMPLETED: 3,
     * FAILED: 4,
     * DELETED: 5,
     */
    const stateMap = {
      1: '未提取',
      2: '提取中',
      4: '提取失败',
    };
    const state = task.transcribe_state as keyof typeof stateMap;
    let stateText = stateMap[state] || '';
    if (transcriptionsStore.taskIsInWaitingList(task.id)) {
      stateText = '等待中';
    }
    return stateText;
  }

  function toDayjsObj(timeStr: string) {
    return dayjs.tz(timeStr, 'GMT');
  }

  watch(currentTabId, () => {
    selectMedia();
  });

  function getTaskInfoByTaskId(taskId: number) {
    return allRawTasks.value.find(item => item.id === taskId);
  }

  return {
    allRawTasks,
    allTabs,
    currentTabId,
    currentTab,
    mediasOfCurrentTab,
    selectedMedia,
    selectMedia,
    formatSrtTime,
    exptectJumpedToTime,
    needUpdateJumpTime,
    jumptToTime,
    fetchAllMedias,
    captureScreenshot,
    transcribeStateText,
    createTranscriptionTask,
    toDayjsObj,
    deleteTask,
    getTaskInfoByTaskId,
  };
});
