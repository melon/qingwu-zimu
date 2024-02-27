<script setup lang="ts">
import CreateExtract from './CreateExtract.vue';
import InnerList from './InnerList.vue';
import VideoPlayer from './VideoPlayer.vue';
import SubtitlePanel from './SubtitlePanel.vue';
import { useSubtitlesStore } from '../../stores/subtitles';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import TaskOptions from '../common/TaskOptions.vue';
import DownloadSubsOptions from '../common/DownloadSubsOptions.vue';
import ImportSubsOptions from '../common/ImportSubsOptions.vue';
import {
  DeleteOutlined,
  StopOutlined,
  DownloadOutlined,
  InteractionOutlined,
  AimOutlined,
  TranslationOutlined,
  CheckCircleFilled,
  SaveOutlined,
  EnterOutlined,
  RetweetOutlined,
  MinusCircleFilled,
  ImportOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons-vue'
import { useMediasStore } from '../../stores/media';
import { useTranscriptionsStore } from '../../stores/transcriptions';
import { LANGS } from '../../../electron/sql';
import TranslationOptions from '../common/TranslationOptions.vue';
import { getErrorTexts } from '../../configs/error-texts';

const leftPanel = ref();
const mediasStore = useMediasStore();
const subtitlesStore = useSubtitlesStore();
const transcriptionsStore = useTranscriptionsStore();
const showTaskOptions = ref(false);
const showDownloadSubsOptions = ref(false);
const showImportSubsOptions = ref(false);
let isRetranslate = false;

watch(() => mediasStore.mediasOfCurrentTab.length, (currentLen, lastLen) => {
  if (lastLen === 0 && currentLen > 0) {
    setTimeout(() => {
      onLeftPanelResize();
    }, 100);
  }
});

const leftPanelStyles = ref<Record<string, any>>({});
function onLeftPanelResize() {
  if (leftPanel.value) {
    leftPanelStyles.value['--container-width'] = leftPanel.value.clientWidth + 'px';
  }
}

function reextractSubtitles() {
  Modal.confirm({
    title: '提示',
    content: '重新提取字幕将删除现有全部字幕（包括翻译好的字幕），请谨慎确认，建议下载保存当前版本的字幕后再继续',
    okText: '继续',
    cancelText: '取消',
    maskClosable: true,
    onOk: () => {
      showTaskOptions.value = true;
    },
  });
}

function importSubtitlesWarn() {
  Modal.confirm({
    title: '提示',
    content: '导入字幕将删除现有全部字幕（包括翻译好的字幕），请谨慎确认，建议下载保存当前版本的字幕后再继续',
    okText: '继续',
    cancelText: '取消',
    maskClosable: true,
    onOk: () => {
      showImportSubsOptions.value = true;
    },
  });
}

function retranslate() {
  isRetranslate = true;
  showTranslationOptions.value = true;
}

async function confirmTranscribe() {
  if (mediasStore.selectedMedia) {
    transcriptionsStore.addToTranscriptWaitingList(mediasStore.selectedMedia.id);
  }
}

async function confirmDownloadSubs() {
  await subtitlesStore.downloadSubtitles();
}

const showTranslationOptions = ref(false);

function translationOptionsCancel() {
  subtitlesStore.cancelTranslate();
}

async function onClickSelect() {
  if (subtitlesStore.saveBtnShown) {
    await save();
    subtitlesStore.resetSubsStack();
  }
}
async function onLangSelect(lang: keyof LANGS) {
  subtitlesStore.setSelectedTranlationLang(lang);
  const res = await subtitlesStore.translate();
  if (res && res.action === 'ACTION_CONFIRM_TRANSLATION') { // 未翻译过，让用户确认需要翻译
    showTranslationOptions.value = true;
  }
}
async function onConfirmTranlationOptions() {
  Modal.confirm({
    title: '提示',
    content: '翻译将消耗您的翻译账户的配额，请留意配额余量，以免超限',
    maskClosable: true,
    okText: '确认翻译',
    cancelText: '取消翻译',
    onOk: () => {
      (async () => {
        if (subtitlesStore.saveBtnShown) {
          await save();
          subtitlesStore.resetSubsStack();
        }
        if (isRetranslate) {
          // 先清空旧翻译
          await subtitlesStore.clearSubtitles();
        }
        const res = await subtitlesStore.diffTranslate({
          onBatchCompleted: () => {
            subtitlesStore.setSubtitlesOfTaskId(mediasStore.selectedMedia?.id);
          }
        });
        if (res.errno) {
          message.error(getErrorTexts(res.errno));
        }
      })();
      isRetranslate = false;
    },
    onCancel: () => {
      subtitlesStore.cancelTranslate();
      isRetranslate = false;
    },
  });
}

async function save() {
  const res = await subtitlesStore.save();
  if (res.action === 'ACTION_SHOW_SAVE_ERROR') {
    message.error('改动保存失败，请重试');
  } else if (res.action === 'ACTION_SHOW_SAVE_SUCCESS') {
    message.success('改动保存成功');
  }
}

function deleteTask() {
  Modal.confirm({
    title: '提示',
    content: '确定删除这一条提取任务吗？',
    maskClosable: true,
    okText: '确认删除',
    cancelText: '取消',
    onOk: () => {
      mediasStore.deleteTask();
    },
  });
}

async function onConfirmImportSubsOptions() {
  const importRes = await subtitlesStore.importSubtitles({
    language: subtitlesStore.selectedImportLanguageId,
  });
  if (importRes.errno) {
    message.error(getErrorTexts(importRes.errno));
  } else {
    message.success('字幕导入成功');
  }
  subtitlesStore.setSubtitlesOfTaskId(mediasStore.selectedMedia?.id);
}

onMounted(() => {
  window.addEventListener('resize', onLeftPanelResize);
  setTimeout(() => {
    onLeftPanelResize();
  }, 0);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onLeftPanelResize);
});
</script>

<template>
  <div class="media-container">
    <div class="left-panel" :style="leftPanelStyles" ref="leftPanel">
      <div class="video-container">
        <VideoPlayer v-if="mediasStore.mediasOfCurrentTab.length"></VideoPlayer>
      </div>
      <div class="create-area">
        <CreateExtract></CreateExtract>
      </div>
      <InnerList></InnerList>
    </div>
    <div class="right-panel" v-if="mediasStore.mediasOfCurrentTab.length">
      <div class="subtitle-panel-wrapper">
        <SubtitlePanel></SubtitlePanel>
      </div>
      <div class="footer-bar">
        <div class="float-left">
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.downloadSubtitlesBtnShown">
            <template #title>下载字幕</template>
            <div class="icon-wrapper" @click="showDownloadSubsOptions = true">
              <DownloadOutlined class="icon-body"></DownloadOutlined>
            </div>
          </ATooltip>
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.importSubtitlesBtnShown">
            <template #title>导入字幕</template>
            <div class="icon-wrapper" @click="importSubtitlesWarn">
              <ImportOutlined class="icon-body"></ImportOutlined>
            </div>
          </ATooltip>
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.reextractSubtitlesBtnShown">
            <template #title>重新提取字幕</template>
            <div class="icon-wrapper" @click="reextractSubtitles">
              <InteractionOutlined class="icon-body"></InteractionOutlined>
            </div>
          </ATooltip>
          <div class="icon-group" v-if="subtitlesStore.translateBtnShown">
            <ATooltip class="tooltiped-icon main-icon">
              <template #title>翻译</template>
              <div class="icon-wrapper">
                <TranslationOutlined class="icon-body"></TranslationOutlined>
                <div @mouseover.stop @hover.stop @mouseenter.stop>
                  <a-select
                    v-model:value="subtitlesStore.selectedTranlationLang"
                    :dropdown-match-select-width="false"
                    :dropdown-style="{ zIndex: 2000 }"
                    placement="topLeft"
                    class="translation-select"
                    @click="onClickSelect"
                    @select="onLangSelect"
                  >
                    <a-select-option
                      v-for="opt in subtitlesStore.translationLangOptions"
                      :value="opt.id"
                    >
                      {{ opt.name }}
                      <MinusCircleFilled
                        class="icon-loading-partial-download"
                        v-if="opt.id && subtitlesStore.partialTranslatedLangs.indexOf(opt.id) !== -1"
                      ></MinusCircleFilled>
                      <CheckCircleFilled
                        class="icon-loading-downloaded"
                        v-else-if="opt.id && subtitlesStore.alreadyTranslatedLangs.indexOf(opt.id) !== -1"
                      ></CheckCircleFilled>
                    </a-select-option>
                  </a-select>
                </div>
              </div>
            </ATooltip>
            <ATooltip class="tooltiped-icon sub-icon" v-if="subtitlesStore.retranslateBtnShown">
              <template #title>重新翻译</template>
              <div class="icon-wrapper" @click="retranslate">
                <RetweetOutlined class="icon-body"></RetweetOutlined>
              </div>
            </ATooltip>
            <ATooltip class="tooltiped-icon sub-icon" v-if="subtitlesStore.translateUndoneBtnShown">
              <template #title>翻译剩余部分</template>
              <div class="icon-wrapper" @click="retranslate">
                <EnterOutlined class="icon-body"></EnterOutlined>
              </div>
            </ATooltip>
          </div>
          <div class="icon-group" v-if="subtitlesStore.realtimeTranslateBtnShown">
            <ATooltip class="tooltiped-icon main-icon">
              <template #title>实时翻译</template>
              <div class="icon-wrapper">
                <TranslationOutlined class="icon-body"></TranslationOutlined>
                <div @mouseover.stop @hover.stop @mouseenter.stop>
                  <a-select
                    v-model:value="subtitlesStore.selectedTranlationLang"
                    :dropdown-match-select-width="false"
                    :dropdown-style="{ zIndex: 2000 }"
                    placement="topLeft"
                    class="translation-select"
                    @select="onLangSelect"
                  >
                    <a-select-option
                      v-for="opt in subtitlesStore.translationLangOptions"
                      :value="opt.id"
                    >
                      {{ opt.name }}
                      <MinusCircleFilled
                        class="icon-loading-partial-download"
                        v-if="opt.id && subtitlesStore.partialTranslatedLangs.indexOf(opt.id) !== -1"
                      ></MinusCircleFilled>
                      <CheckCircleFilled
                        class="icon-loading-downloaded"
                        v-else-if="opt.id && subtitlesStore.alreadyTranslatedLangs.indexOf(opt.id) !== -1"
                      ></CheckCircleFilled>
                    </a-select-option>
                  </a-select>
                </div>
              </div>
            </ATooltip>
          </div>
          <ATooltip class="tooltiped-icon" >
            <template #title>字幕自动跟踪</template>
            <div
              class="icon-wrapper"
              :class="[{ active: subtitlesStore.trackPositionWithVideo }]"
              @click="subtitlesStore.toggleSubtitleTracktion"
            >
              <AimOutlined class="icon-body"></AimOutlined>
            </div>
          </ATooltip>
        </div>
        <div class="float-right">
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.saveBtnShown">
            <template #title>保存</template>
            <div class="icon-wrapper" @click="save">
              <SaveOutlined class="icon-body"></SaveOutlined>
            </div>
          </ATooltip>
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.prevBtnShown">
            <template #title>回退</template>
            <div class="icon-wrapper" :class="[{ disabled: subtitlesStore.undoDisabled }]" @click="subtitlesStore.subsUndo">
              <ArrowLeftOutlined class="icon-body"></ArrowLeftOutlined>
            </div>
          </ATooltip>
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.nextBtnShown">
            <template #title>前进</template>
            <div class="icon-wrapper" :class="[{ disabled: subtitlesStore.redoDisabled }]" @click="subtitlesStore.subsRedo">
              <ArrowRightOutlined class="icon-body"></ArrowRightOutlined>
            </div>
          </ATooltip>
          <ATooltip class="tooltiped-icon" v-if="subtitlesStore.stopTranscriptionTaskBtnShown">
            <template #title>终止提取任务</template>
            <div class="icon-wrapper warn" @click="transcriptionsStore.stopTranscriptionTask">
              <StopOutlined class="icon-body"></StopOutlined>
            </div>
          </ATooltip>
          <ATooltip class="tooltiped-icon" placement="topRight">
            <template #title>完全删除本次任务</template>
            <div class="icon-wrapper warn" @click="deleteTask">
              <DeleteOutlined class="icon-body"></DeleteOutlined>
            </div>
          </ATooltip>
        </div>
      </div>
    </div>
    <TaskOptions
      v-model="showTaskOptions"
      @confirm="confirmTranscribe"
    ></TaskOptions>
    <DownloadSubsOptions
      v-model="showDownloadSubsOptions"
      @confirm="confirmDownloadSubs"
    ></DownloadSubsOptions>
    <TranslationOptions
      v-model="showTranslationOptions"
      @confirm="onConfirmTranlationOptions"
      @cancel="translationOptionsCancel"
    ></TranslationOptions>
    <ImportSubsOptions
      v-model="showImportSubsOptions"
      @confirm="onConfirmImportSubsOptions"
    ></ImportSubsOptions>
  </div>
</template>

<style scoped>
.media-container {
  display: grid;
  grid-template-columns: 50% auto;
  grid-template-rows: 100%;
  cursor: default;
  height: 100%;
}
.video-container {
  height: calc(var(--container-width)  * 0.5625);
  background: #000;
}
@media (min-width: 1600px) {
  .media-container {
    grid-template-columns: 50% auto;
  }
}
.left-panel {
  border-right: 1px solid var(--border-color);
  background-color: #f5f5f5;
  height: 100%;
}
.right-panel {
  position: relative;
  height: 100%;
}
.subtitle-panel-wrapper {
  height: calc(100% - 50px);
}
.footer-bar {
  height: 50px;
  padding: 0 10px 0 5px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.footer-btn {
  margin: 0 5px;
}
.create-area {
  height: 100px;
  border-bottom: 1px solid var(--border-color);
  padding: 10px;
}
.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}
.icon-wrapper:hover {
  background-color: #eaeaea;
}
.icon-wrapper.warn:hover {
  background-color: var(--primary-deep-color);
  color: #fff;
}
.icon-wrapper.active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}
.icon-wrapper.disabled {
  opacity: 0.3;
  cursor: default;
}
.icon-wrapper.disabled:hover {
  background-color: transparent;
}
.tooltiped-icon {
  margin: 0 5px;
  position: relative;
}
.icon-group {
  display: inline-flex;
  align-items: flex-end;
  margin: 0 5px;
}
.icon-group .main-icon {
  margin: 0;
}
.icon-group .sub-icon {
  width: 22px;
  height: 22px;
  margin: 0 0 0 4px;
}
.icon-group .sub-icon:last-child {
  margin-right: 0;
}
.icon-body {
  font-size: 14px;
}
.float-right {
  justify-self: flex-end;
}
.translation-select {
  opacity: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.icon-loading-select {
  margin: 0 4px;
  color: #ccc;
}
.icon-loading-partial-download {
  margin: 0 4px;
  color: var(--border-color);
}
.icon-loading-downloaded {
  margin: 0 4px;
  color: var(--secondary-color);
}
</style>

<style>
.ant-select-item.ant-select-item-option.ant-select-item-option-selected {
  background-color: var(--primary-color);
}
</style>
