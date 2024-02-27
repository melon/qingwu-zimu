<script setup lang="ts">
import { ref } from 'vue';
import { Modal } from 'ant-design-vue';
import { useTranscriptionsStore } from '../../stores/transcriptions';
import { useMediasStore } from '../../stores/media';
import {
  PlusOutlined,
} from '@ant-design/icons-vue';
import TaskOptions from '../common/TaskOptions.vue';
import { getErrorTexts } from '../../configs/error-texts';

const isDragOver = ref(false);
const showTaskOptions = ref(false);
const mediasStore = useMediasStore();
const transcriptionsStore = useTranscriptionsStore();
let lastSelectedNewFilePaths: string[] = [];

async function startTranscribe() {
  const newFilePaths = await window.exposedAPI.openFile({
    filters: [
      { name: 'Media', extensions: ['mp4', 'mov', 'webm', 'ogv', 'mp3', 'wav', 'ogg'] }
    ],
    properties: [
      'openFile',
      'multiSelections',
    ],
  });
  if (newFilePaths) {
    lastSelectedNewFilePaths = newFilePaths;
    showTaskOptions.value = true;
  }
}

async function confirmTranscribe() {
  createTranscriptionTasks(lastSelectedNewFilePaths);
  lastSelectedNewFilePaths = [];
}

function onDragover(e: DragEvent) {
  isDragOver.value = true;
  e.preventDefault();
}

function onDragleave(e: Event) {
  isDragOver.value = false;
  e.preventDefault();
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false;
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (files) {
    createTranscriptionTasks(Array.from(files).map(file => file.path));
  }
}

async function createTranscriptionTasks(filePaths: string[]) {
  for (let filePath of filePaths) {
      const taskResult = await mediasStore.createTranscriptionTask(filePath);
      if (taskResult.errno) {
        Modal.error({
          title: '提示',
          content: getErrorTexts(taskResult.errno),
          maskClosable: true,
        });
        return;
      }
      transcriptionsStore.addToTranscriptWaitingList(taskResult.task!.id);
    }
}
</script>

<template>
  <div
    class="create-button"
    :class="[{ 'drag-over': !!isDragOver }]"
    @dragover="onDragover"
    @dragleave="onDragleave"
    @drop="onDrop"
    @click="startTranscribe"
  >
    <PlusOutlined class="add-icon"/>
    <div class="select-text">
      <div>开始提取字幕</div>
      <div class="select-tip">选择文件 或 拖动文件到这里</div>
    </div>
    <TaskOptions
      v-model="showTaskOptions"
      @confirm="confirmTranscribe"
    ></TaskOptions>
  </div>
</template>

<style scoped>
.create-button {
  border: 1px solid var(--secondary-color);
  border-radius: 4px;
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 18px;
  background-color: var(--primary-color);
  color: var(--secondary-color);
  opacity: 0.9;
}
.create-button:hover {
  box-shadow: 0 0 4px 2px #ddd inset;
  opacity: 1;
  border-width: 2px;
}
.create-button.drag-over {
  box-shadow: 0 0 4px 2px #ddd inset;
  opacity: 1;
  border-width: 2px;
}
.add-icon {
  font-size: 30px;
  color: var(--secondary-color);
  margin-right: 10px;
}
.select-text {
  text-align: left;
  font-size: 20px;
}
.select-tip {
  font-size: 14px;
}
</style>
