<script setup lang="ts">
import { Modal } from 'ant-design-vue';
import { ITRANSCRIPTION_TASK } from '../../../electron/sql';
import { useMediasStore } from '../../stores/media';
import { useSubtitlesStore } from '../../stores/subtitles';
import { useTranscriptionsStore } from '../../stores/transcriptions';

const mediasStore = useMediasStore();
const transcriptionsStore = useTranscriptionsStore();
const subtitlesStore = useSubtitlesStore();

function selectTask(taskItem: ITRANSCRIPTION_TASK) {
  if (subtitlesStore.saveBtnShown) {
    Modal.confirm({
      title: '提示',
      content: '当前还有未保存的字幕，如果继续，未保存的字幕将丢失，是否继续？',
      maskClosable: true,
      okText: '继续',
      cancelText: '取消',
      onOk: () => {
        confirmSelectTask(taskItem);
      },
      onCancel: () => {},
    });
  } else {
    confirmSelectTask(taskItem);
  }
}
function confirmSelectTask(taskItem: ITRANSCRIPTION_TASK) {
  mediasStore.selectMedia(taskItem.id)
}
</script>

<template>
  <div class="inner-list">
    <div class="tab-list">
      <div
        class="tab-item"
        :class="[{ 'active': mediasStore.currentTabId === item.id }]"
        v-for="item in mediasStore.allTabs"
        :key="item.id"
        @click="mediasStore.currentTabId = item.id"
      >
        {{ item.name }}
      </div>
    </div>
    <div class="body-list">
      <div class="body-inner-list" v-if="mediasStore.mediasOfCurrentTab.length">
        <div
          class="media-item"
          :class="[{ selected: mediasStore.selectedMedia?.id === item.id }]"
          v-for="item in mediasStore.mediasOfCurrentTab"
          :key="item.id"
          @click="selectTask(item)"
        >
          <div class="media-snapshot" :style="[{ backgroundImage: `url('${item.cover_img}')` }]">
            <div
              class="progress-bar"
              v-if="item.id === transcriptionsStore.currentTask?.taskId && item.transcribe_state === 2"
            >
              <AProgress
                type="circle"
                :size="50"
                :percent="transcriptionsStore.currentProgress"
              />
            </div>
            <div
              class="task-state"
              v-else-if="mediasStore.transcribeStateText(item)"
            >{{ mediasStore.transcribeStateText(item) }}</div>
            <div
              class="media-type-tag"
              :class="[{ video: item.media_type === 1, audio: item.media_type === 2 }]"
              v-if="item.media_type"
            >
              {{ item.media_type === 1 ? '视频' : (item.media_type === 2 ? '音频' : '') }}
            </div>
          </div>
          <div class="media-info">
            {{ item.task_name }}
          </div>
          <div class="sample-transcript">
            {{ mediasStore.toDayjsObj(item.create_time).format('MM-DD HH:mm') }}
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else>当前任务列表为空</div>
    </div>
  </div>
</template>

<style scoped>
.inner-list {
  height: calc(100% - 100px - (var(--container-width) * 0.5625));
  overflow: hidden;
}
.tab-list {
  display: flex;
  padding: 10px 5px;
}
.tab-item {
  padding: 3px 10px;
  margin: 0 5px;
}
.tab-item.active {
  background: var(--primary-color);
  border-radius: 4px;
}
.body-list {
  overflow: auto;
  height: calc(100% - 50px);
}
.body-inner-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  margin: 0 10px;
}
@media (min-width: 1800px) {
  .body-inner-list {
    grid-template-columns: repeat(4, 1fr);
  }
}
.media-snapshot {
  width: 100%;
  height: 100px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: no-repeat 0 0 #fff;
  background-size: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.media-item {
  margin: 10px 0;
  padding: 10px;
  font-size: 14px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  box-sizing: border-box;
}
.media-item:hover {
  background-color: #eee;
}
.media-item.selected {
  background-color: #ddd;
}
.media-info {
  margin: 6px 0 3px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* number of lines to show */
          line-clamp: 2;
  -webkit-box-orient: vertical;
}
.sample-transcript {
  font-size: 13px;
  color: #999;
}
.task-state {
  padding: 3px 8px;
  background-color: red;
  box-shadow: 0 0 4px 1px rgba(0, 0, 0, 0.1);
  color: #fff;
  border-radius: 4px;
}
.progress-bar {
  background: #fff;
  border-radius: 50%;
  border: 1px solid transparent;
  box-shadow: 0 0 10px 1px rgba(0, 0, 0, 0.1);
}
.media-type-tag {
  position: absolute;
  top: 0;
  right: 0;
  color: #fff;
  padding: 1px 5px;
  font-size: 12px;
  border-radius: 0 4px 0 4px;
}
.media-type-tag.video {
  background-color: var(--secondary-color);
}
.media-type-tag.audio {
  background-color: var(--primary-color);
  color: #666;
}
.empty-tip {
  padding: 30px 10px;
  text-align: center;
  font-size: 14px;
  color: #666;
}
</style>
