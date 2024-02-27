<script lang="ts" setup>
import { ref } from 'vue';
import { useModelsStore } from '../../stores/models';
import { useTranscriptionsStore } from '../../stores/transcriptions';
import { SelectOutlined, CheckCircleFilled, CloseCircleFilled, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useSessionStore } from '../../stores/session';
import { getErrorTexts } from '../../configs/error-texts';

defineProps({
  modelValue: Boolean,
});
const emit = defineEmits(['update:modelValue', 'confirm']);

const modelsStore = useModelsStore();
const transcriptionsStore = useTranscriptionsStore();
const sessionStore = useSessionStore();

modelsStore.initModelsData();

const showLanguageModal = ref(false);
const showModelsModal = ref(false);
const showCustomDownloadModal = ref(false);
const modelsGroup = ref([
  { id: 'general', name: '多语言通用模型', list: 'generalModels' },
  { id: 'english', name: '英文专用模型', list: 'englishModels' },
] as const);

function cancel() {
  emit('update:modelValue', false);
}
function confirm() {
  emit('confirm');
  cancel();
}
function hideLanguageModal() {
  showLanguageModal.value = false;
}
function openModelsModal() {
  modelsStore.updateModelsStatus();
  showModelsModal.value = true;
}
function hideModelsModal() {
  showModelsModal.value = false;
}
function hideCustomDownloadModal() {
  showCustomDownloadModal.value = false;
}

const isDragOver = ref(false);
// dragover event fired repeatedly hovering over a drop target
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
    await loadFiles(Array.from(files).map(file => file.path));
    hideCustomDownloadModal();
  }
}
let lastSelectedNewFilePaths: string[] = [];
async function readFiles() {
  const newFilePaths = await window.exposedAPI.openFile({
    filters: [
      { name: 'Models', extensions: ['bin'] }
    ],
    properties: [
      'openFile',
      'multiSelections',
    ],
  });
  if (newFilePaths) {
    lastSelectedNewFilePaths = newFilePaths;
    await loadFiles(lastSelectedNewFilePaths);
    hideCustomDownloadModal();
    lastSelectedNewFilePaths = [];
  }
}
async function loadFiles(filePaths: string[]) {
  const availableFileNames = modelsStore.allModels.map(item => item.fileName);
  if (transcriptionsStore.coremlEnabled) {
    availableFileNames.push(...modelsStore.coremlModels.map(item => item.fileName));
  }
  const availableFilesPaths = filePaths.filter(filePath => {
    const fileSegs = filePath.split('/');
    const basename = fileSegs[fileSegs.length - 1];
    if (availableFileNames.indexOf(basename) !== -1) {
      return true;
    }
    return false;
  })
  if (availableFilesPaths.length === 0) {
    message.warn('没有选中有效的模型文件');
  } else if (filePaths.length !== availableFilesPaths.length) {
    message.warn(`有${filePaths.length - availableFilesPaths.length}个文件不是模型文件，仅加载其余的${availableFilesPaths.length}个模型`)
  }
  const res = await window.exposedAPI.copyFilesToDir({
    filePaths,
    targetDir: 'models',
    extractFile: /\.zip$/,
  });
  if (res.errno) {
    message.error('模型加载出错，请重试');
    modelsStore.updateModelsStatus();
    return;
  }
  if (res.succeeded!.length) {
    message.success(`成功加载${res.succeeded!.length}个模型文件`);
  }
  if (res.failed!.length) {
    message.error(`${res.failed!.length}个模型文件加载失败`);
  }
  modelsStore.updateModelsStatus();
}

async function setModelsDir() {
  const res = await modelsStore.setModelsDir({
    onDirSelected: () => {
      message.info('更改文件夹路径需耗时一段时间，请耐心等待');
      hideModelsModal();
      cancel();
    },
  });
  if (res) {
    if (!res.errno) {
      modelsStore.updateModelsStatus();
      message.success('模型文件夹路径修改成功');
    } else {
      message.error(getErrorTexts(res.errno));
    }
  }
}

function selectModel() {
  if (!transcriptionsStore.selectLanguageDisabled) {
    showLanguageModal.value = true;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="custom-modal" v-if="modelValue">
      <div class="custom-modal-body">
        <div class="modal-header">
          <div class="header-title">提取设置</div>
        </div>
        <div class="modal-content">
          <div class="extract-settings">
            <div class="setting-name" v-if="sessionStore.coremlSettingEnabled">
              使用CoreML
              <ATooltip class="tooltiped-icon">
                <template #title>CoreML可以加快提取速度，仅支持苹果Arm芯片，首次使用时，提取耗时可能会比较长，请耐心等待</template>
                <QuestionCircleOutlined class="tooltiped-icon-body"></QuestionCircleOutlined>
              </ATooltip>
            </div>
            <div class="setting-value gpu-setting" v-if="sessionStore.coremlSettingEnabled">
              <a-switch v-model:checked="transcriptionsStore.coremlEnabled" />
            </div>
            <div class="setting-name" v-if="sessionStore.gpuSettingEnabled">
              使用Nvidia GPU
              <ATooltip class="tooltiped-icon">
                <template #title>GPU可以大大加快提取速度，仅支持Windows系统</template>
                <QuestionCircleOutlined class="tooltiped-icon-body"></QuestionCircleOutlined>
              </ATooltip>
            </div>
            <div class="setting-value gpu-setting" v-if="sessionStore.gpuSettingEnabled">
              <a-switch v-model:checked="transcriptionsStore.gpuEnabled" />
            </div>
            <div class="setting-name">
              选择模型
              <ATooltip class="tooltiped-icon">
                <template #title>模型越大，效果越好，但对电脑性能要求更高</template>
                <QuestionCircleOutlined class="tooltiped-icon-body"></QuestionCircleOutlined>
              </ATooltip>
            </div>
            <div class="setting-value">
              <div class="box-wrapper" @click="openModelsModal">
                <span v-if="modelsStore.selectedModel">
                  {{ modelsStore.selectedModel.type === 'general' ? '多语言通用' : '英文专用' }} - {{ modelsStore.selectedModel.name }}
                </span>
                <span v-else>未选中模型</span>
                <SelectOutlined class="select-icon"></SelectOutlined>
              </div>
            </div>
            <div class="setting-name">
              选择语言
              <ATooltip class="tooltiped-icon">
                <template #title>指视频中原本使用的语言</template>
                <QuestionCircleOutlined class="tooltiped-icon-body"></QuestionCircleOutlined>
              </ATooltip>
            </div>
            <div class="setting-value">
              <div
                class="box-wrapper"
                :class="[{ disabled: transcriptionsStore.selectLanguageDisabled }]"
                @click="selectModel"
              >
                <span>{{ transcriptionsStore.selectedLanguage.name }}</span>
                <SelectOutlined class="select-icon"></SelectOutlined>
              </div>
            </div>
            <div class="setting-name">
              设置提示词
              <ATooltip class="tooltiped-icon">
                <template #title>合适的提示词可以优化提取效果</template>
                <QuestionCircleOutlined class="tooltiped-icon-body"></QuestionCircleOutlined>
              </ATooltip>
            </div>
            <div class="setting-value">
              <ATextarea
                v-model:value="transcriptionsStore.currentPrompt"
                :auto-size="{ minRows: 2, maxRows: 10 }"
                placeholder="合适的提示词可以优化提取效果"
                allow-clear
              ></ATextarea>
            </div>
            <div class="setting-name">设置每句话最大字数</div>
            <div class="setting-value max-len-setting">
              <a-slider class="max-len-slider"
                v-model:value="transcriptionsStore.maxLen"
                :disabled="!transcriptionsStore.maxLenEnabled"
                :min="1"
                :max="300"
                v-show="transcriptionsStore.maxLenEnabled"
              />
              <a-input-number
                v-model:value="transcriptionsStore.maxLen"
                :min="1"
                :max="300"
                class="max-len-input"
                v-show="transcriptionsStore.maxLenEnabled"
              />
              <a-switch v-model:checked="transcriptionsStore.maxLenEnabled" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <AButton class="modal-btn" @click="cancel">取消</AButton>
          <AButton class="modal-btn" type="primary" @click="confirm">确定提取</AButton>
        </div>
        <CloseCircleFilled class="close-btn" @click="cancel"></CloseCircleFilled>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <div class="custom-modal language-modal" v-if="showLanguageModal" @click="hideLanguageModal">
      <div class="custom-modal-body" @click.stop>
        <div class="modal-header">
          <div class="header-title">选择语言</div>
        </div>
        <div class="modal-content">
          <ASelect
            class="language-select"
            v-model:value="transcriptionsStore.selectedLanguageId"
            size="large"
            :fieldNames="{ label: 'name', value: 'id' }"
            :options="transcriptionsStore.languages"
            @select="hideLanguageModal"
          ></ASelect>
        </div>
        <CloseCircleFilled class="close-btn" @click="hideLanguageModal"></CloseCircleFilled>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <div class="custom-modal models-modal" v-if="showModelsModal" @click="hideModelsModal">
      <div class="custom-modal-body" @click.stop>
        <div class="modal-header">
          <div class="header-title">选取模型</div>
        </div>
        <div class="modal-content">
          <div class="manual-load-btn-wrapper">
            <AButton
              class="manual-load-btn"
              size="small"
              type="link"
              @click="showCustomDownloadModal = true"
            >⭐ 已有下载好的模型文件？点此手动加载</AButton>
            <AButton
              class="change-models-dir-btn"
              size="small"
              type="link"
              @click="setModelsDir"
            >⭐ 更改模型文件夹路径</AButton>
            <!-- <AButton
              class="manual-load-btn"
              size="small"
              type="link"
              @click="showCustomDownloadModal = true"
            >更换下载源</AButton> -->
          </div>
          <div class="model-select">
            <template v-for="group in modelsGroup" :key="group.id">
              <div :class="[`${group.id}-models`]">
                <div class="models-group-title">{{ group.name }}</div>
                <div class="models-list">
                  <div
                    class="models-item"
                    :class="[{ coreml: transcriptionsStore.coremlEnabled }]"
                    v-for="item in modelsStore[group.list]"
                    :key="item.fileName"
                  >
                    <div class="model-title">{{ item.name }}</div>
                    <div class="model-info">
                      {{ transcriptionsStore.coremlEnabled ? '主: ' : '' }}{{ item.fileName }} ({{ item.reportedSize }})
                    </div>
                    <div v-if="transcriptionsStore.coremlEnabled" class="coreml-model-info">
                      CoreML: {{ modelsStore.coremlModelsMap[item.fileName].fileName }} ({{ modelsStore.coremlModelsMap[item.fileName].reportedSize }})
                    </div>
                    <div class="model-options">
                      <div class="downloading" v-if="item.status === 'downloading'">
                        <AProgress
                          type="circle"
                          :size="50"
                          :percent="item.progress"
                        />
                        <div class="abort-download" @click="modelsStore.abortDownload(item.fileName)">
                          <CloseCircleFilled></CloseCircleFilled>
                        </div>
                      </div>
                      <div class="downloading" v-else-if="
                        transcriptionsStore.coremlEnabled
                        && modelsStore.coremlModelsMap[item.fileName].status === 'downloading'
                      ">
                        <AProgress
                          type="circle"
                          :size="50"
                          :percent="modelsStore.coremlModelsMap[item.fileName].progress"
                        />
                        <div
                          class="abort-download"
                          @click="modelsStore.abortDownload(modelsStore.coremlModelsMap[item.fileName].fileName)"
                        >
                          <CloseCircleFilled></CloseCircleFilled>
                        </div>
                      </div>
                      <AButton
                        size="small"
                        type="link"
                        @click="modelsStore.openDownloadWindow({ type: 'default' })"
                        v-else-if="item.status === 'not-downloaded'"
                      >{{ transcriptionsStore.coremlEnabled ? '下载主模型' : '下载模型' }}</AButton>
                      <AButton
                        size="small"
                        type="link"
                        @click="modelsStore.openDownloadWindow({ type: 'coreml' })"
                        v-else-if="
                          transcriptionsStore.coremlEnabled
                          && modelsStore.coremlModelsMap[item.fileName].status === 'not-downloaded'
                        "
                      >下载CoreML模型</AButton>
                      <AButton
                        size="small"
                        type="primary"
                        v-else-if="modelsStore.selectedModel?.fileName === item.fileName"
                        @click="modelsStore.selectModel(item.fileName); hideModelsModal()"
                      >
                        <template #icon><CheckCircleFilled></CheckCircleFilled></template>
                        使用中
                      </AButton>
                      <AButton
                        size="small"
                        v-else
                        @click="modelsStore.selectModel(item.fileName); hideModelsModal()"
                      >使用该模型</AButton>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <CloseCircleFilled class="close-btn" @click="hideModelsModal"></CloseCircleFilled>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <div class="custom-modal custom-download-modal" v-if="showCustomDownloadModal" @click="hideCustomDownloadModal">
      <div class="custom-modal-body" @click.stop>
        <div class="modal-header">
          <div class="header-title">手动加载模型</div>
        </div>
        <div class="modal-content">
          <div
            class="load-btn"
            :class="[{ 'drag-over': !!isDragOver }]"
            @dragover="onDragover"
            @dragleave="onDragleave"
            @drop="onDrop"
            @click="readFiles"
          >
            <PlusOutlined class="add-icon"/>
            <div class="select-text">
              <div>加载模型</div>
              <div class="select-tip">选择文件 或 拖动文件到这里</div>
            </div>
          </div>
        </div>
        <CloseCircleFilled class="close-btn" @click="hideCustomDownloadModal"></CloseCircleFilled>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.custom-modal {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(2px);
}
.custom-modal-body {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  background-color: #fff;
  border-radius: 10px;
  padding: 24px;
  user-select: none;
}
.custom-modal-body :deep(.ant-btn >.anticon+span) {
  margin-inline-start: 4px;
}
.header-title {
  font-weight: bold;
  font-size: 18px;
}
.modal-footer {
  display: flex;
  justify-content: right;
}
.modal-btn {
  margin-left: 10px;
}
.extract-settings {
  display: grid;
  grid-template-columns: 150px auto;
  margin: 20px 10px 30px;
}
.setting-name {
  font-size: 15px;
  color: #555;
  display: flex;
  align-items: center;
}
.setting-value {
  display: flex;
  align-items: center;
  justify-content: right;
  min-height: 54px;
}
.box-wrapper {
  border: 1px solid #eee;
  background-color: #f9f9f9;
  border-radius: 3px;
  padding: 4px 12px;
  cursor: pointer;
}
.box-wrapper.disabled {
  cursor: not-allowed;
}
.box-wrapper:hover {
  background-color: #f2f2f2;
}
.box-wrapper.disabled:hover {
  background-color: #f9f9f9;
}
.select-icon {
  color: var(--primary-deep-color);
  font-size: 14px;
  opacity: 0.6;
  margin-left: 8px;
}
.box-wrapper:hover .select-icon {
  opacity: 1;
}
.box-wrapper.disabled:hover .select-icon {
  opacity: 0.6;
}
.language-modal .custom-modal-body {
  width: 300px;
}
.language-select {
  width: 100%;
  margin: 20px 0;
}
.models-modal .custom-modal-body {
  width: 1100px;
}
.manual-load-btn-wrapper {
  margin: 5px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.model-select {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto;
  grid-gap: 30px;
  margin: 5px 0 0
}
.models-group-title {
  font-size: 18px;
  color: var(--primary-deep-color);
}
.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 18px;
  color: #333;
  cursor: pointer;
}
.close-btn:hover {
  color: #ff3c3c;
}
.models-list {
  margin: 30px 0 0;
}
.models-item {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  /* grid-template-rows: 1fr 1fr; */
  margin: 20px 0;
}
/* .models-item.coreml {
  grid-template-rows: 1fr 1fr 1fr;
} */
.model-title {
  grid-column: 1 / span 3;
  grid-row: 1 / span 1;
  font-weight: bold;
}
.model-info {
  grid-column: 1 / span 3;
  grid-row: 2 / span 1;
  color: #999;
  font-size: 14px;
}
.coreml-model-info {
  grid-column: 1 / span 3;
  grid-row: 3 / span 1;
  color: #999;
  font-size: 14px;
}
.model-options {
  grid-column: 4 / span 1;
  grid-row: 1 / span 2;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: right;
}
.models-item.coreml .model-options {
  grid-row: 1 / span 3;
}
.downloading {
  position: relative;
}
.abort-download {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  width: 42px;
  height: 42px;
  border-radius: 21px;
  align-items: center;
  justify-content: center;
  color: #ff3c3c;
  display: flex;
  opacity: 0;
  transition: opacity ease-in-out 0.2s;
}
.downloading:hover .abort-download {
  opacity: 1;
}
.max-len-setting {
  display: flex;
  justify-content: right;
  align-items: center ;
}
.max-len-slider {
  width: 200px;
}
.max-len-input {
  width: 64px;
  margin: 0 10px;
}
.custom-download-modal .custom-modal-body {
  width: 400px;
}
.load-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--secondary-color);
  border-radius: 4px;
  padding: 40px 10px;
  margin: 20px 0 10px;
  background-color: var(--primary-color);
  cursor: pointer;
}
.load-btn:hover {
  box-shadow: 0 0 10px 2px #ddd inset;
}
.load-btn.drag-over {
  box-shadow: 0 0 10px 2px #ddd inset;
  border-width: 2px;
  padding: 39px 9px;
}
.add-icon {
  font-size: 26px;
  color: var(--secondary-color);
  margin-right: 10px;
}
.select-text {
  text-align: left;
  font-size: 16px;
}
.select-tip {
  font-size: 13px;
}
.tooltiped-icon-body {
  margin: 0 4px;
  font-size: 16px;
}
</style>
