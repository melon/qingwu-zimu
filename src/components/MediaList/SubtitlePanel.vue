<script setup lang="ts">
import { ITranscriptItem } from '../../../electron/whisper-node/conversion';
import { useMediasStore } from '../../stores/media';
import { useSubtitlesStore } from '../../stores/subtitles';
import {
  DeleteOutlined,
  CaretUpFilled,
  CaretDownFilled,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons-vue';
import { useTranscriptionsStore } from '../../stores/transcriptions';
import TaskOptions from '../common/TaskOptions.vue';
import { ref, watch } from 'vue';

const mediasStore = useMediasStore();
const subtitlesStore = useSubtitlesStore();
const transcriptionsStore = useTranscriptionsStore();

const showTaskOptions = ref(false);
const scrollContainer = ref();

subtitlesStore.initSubtitlesData();

watch(() => subtitlesStore.activeIdx, (idx) => {
  if (!subtitlesStore.trackPositionWithVideo) return;
  const container = scrollContainer.value! as HTMLElement;
  if (container) {
    const item = container.querySelectorAll('.subtitle-item')[idx] as HTMLElement;
    item.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}, { immediate: true });

let lastText: string;
function onFocus(e: Event) {
  const ele = e.target! as HTMLElement;
  lastText = ele.innerText;
}
function onBlur(e: Event) {
  const ele = e.target! as HTMLElement;
  if (lastText !== ele.innerText) { // 有改动才推入历史堆栈
    subtitlesStore.subsPush();
  }
  subtitlesStore.clearSelectedId();
}
function onInput(e: Event, item: ITranscriptItem) {
  const ele = e.target! as HTMLElement;
  const originalText = ele.innerText;
  const text = originalText.replace(/\n/g, '');
  if (text !== originalText) {
    ele.innerText = text;

    const range = document.createRange();
    range.selectNodeContents(ele);
    range.collapse(false);
    var sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  item.content = text;
}

async function startTranscript() {
  if (mediasStore.selectedMedia) {
    await transcriptionsStore.addToTranscriptWaitingList(mediasStore.selectedMedia.id);
  }
}
</script>

<template>
  <div class="subtitle-panel" ref="scrollContainer">
    <div class="subtitle-wrapper" v-if="subtitlesStore.subtitles.length">
      <div
        class="subtitle-item"
        v-for="item, index in subtitlesStore.subtitles"
        :key="item.id"
        @click="subtitlesStore.setSelectedId(item.id)"
      >
        <div class="time-area">
          <div class="start-time timestamp-item">
            <div class="timestamp">{{ mediasStore.formatSrtTime(item.start) }}</div>
            <div class="time-modify">
              <CaretUpFilled
                class="time-modify-icon time-add"
                :class="[{ disabled: subtitlesStore.timeAddDisabled(item, 'start', subtitlesStore.subtitles, index) }]"
                @click="subtitlesStore.timeAdd(item, 'start', subtitlesStore.subtitles, index)"
              ></CaretUpFilled>
              <CaretDownFilled
                class="time-modify-icon time-minus"
                :class="[{ disabled: subtitlesStore.timeMinusDisabled(item, 'start', subtitlesStore.subtitles, index) }]"
                @click="subtitlesStore.timeMinus(item, 'start', subtitlesStore.subtitles, index)"
              ></CaretDownFilled>
            </div>
          </div>
          <div class="end-time timestamp-item">
            <div class="timestamp">{{ mediasStore.formatSrtTime(item.end) }}</div>
            <div class="time-modify">
              <CaretUpFilled
                class="time-modify-icon time-add"
                :class="[{ disabled: subtitlesStore.timeAddDisabled(item, 'end', subtitlesStore.subtitles, index) }]"
                @click="subtitlesStore.timeAdd(item, 'end', subtitlesStore.subtitles, index)"
              ></CaretUpFilled>
              <CaretDownFilled
                class="time-modify-icon time-minus"
                :class="[{ disabled: subtitlesStore.timeMinusDisabled(item, 'end', subtitlesStore.subtitles, index) }]"
                @click="subtitlesStore.timeMinus(item, 'end', subtitlesStore.subtitles, index)"
              ></CaretDownFilled>
            </div>
          </div>
        </div>
        <div
          class="subtitle-text"
          :class="[{ selected: subtitlesStore.selectedId === item.id, active: subtitlesStore.activeId === item.id }]"
        >
          <div
            class="subtitle-text-inner"
            @input="onInput($event, item)"
            @focus="onFocus($event)"
            @blur="onBlur($event)"
            v-if="subtitlesStore.currentSplittingItem === item"
          >
            <template v-for="word, wordIndex in subtitlesStore.contentToWords(item)">
              <span>{{ word }}</span>
              <span
                class="splitter-wrapper"
                v-if="wordIndex !== subtitlesStore.contentToWords(item).length - 1"
                @click="subtitlesStore.splitContent(item, index, wordIndex)"
              >
                <span class="splitter"> </span>
              </span>
            </template>
          </div>
          <div
            contenteditable
            class="subtitle-text-inner"
            :style="[{direction: subtitlesStore.subtitlesDirection }]"
            @input="onInput($event, item)"
            @focus="onFocus($event)"
            @blur="onBlur($event)"
            v-else
          >{{ item.content }}</div>
          <div
            contenteditable
            class="subtitle-text-inner"
            :style="[{direction: subtitlesStore.secondarySubtitlesDirection }]"
            @input="onInput($event, subtitlesStore.secondarySubtitles[index])"
            @focus="onFocus"
            @blur="onBlur"
            v-if="subtitlesStore.selectedTranlationLang && subtitlesStore.secondarySubtitles.length"
          >{{ subtitlesStore.secondarySubtitles[index]?.content }}</div>
        </div>
        <div class="options">
          <div>
            <div class="icon-wrapper"  v-if="subtitlesStore.mergeAboveBtnShown(index)" @click="subtitlesStore.mergeAbove(item, index)">
              <VerticalAlignTopOutlined></VerticalAlignTopOutlined>
            </div>
            <div class="icon-wrapper" v-if="subtitlesStore.mergeBottomBtnShown(index)" @click="subtitlesStore.mergeBottom(item, index)">
              <VerticalAlignBottomOutlined></VerticalAlignBottomOutlined>
            </div>
          </div>
          <div>
            <div class="icon-wrapper" v-if="subtitlesStore.enterSplitModeBtnShown" @click="subtitlesStore.enterSplitMode(item)">
              <SplitCellsOutlined></SplitCellsOutlined>
            </div>
            <div class="icon-wrapper" v-if="subtitlesStore.deleteCaptionBtnShown" @click="subtitlesStore.deleteCaption(item)">
              <DeleteOutlined></DeleteOutlined>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="empty-tip" v-else-if="subtitlesStore.panelStatus === 'transcriptionStarted'">
      <div>字幕提取中，请耐心等待...</div>
    </div>
    <div class="empty-tip" v-else-if="subtitlesStore.panelStatus === 'transcriptionWaiting'">
      <div>排队等待中，请耐心等待其他任务完成...</div>
    </div>
    <div class="empty-tip" v-else>
      <AButton type="primary" @click="showTaskOptions = true">开始提取字幕</AButton>
    </div>

    <TaskOptions
      v-model="showTaskOptions"
      @confirm="startTranscript"
    ></TaskOptions>
  </div>
</template>

<style scoped>
.subtitle-panel {
  --subtitle-bg-color: #f9f9f9;
  background-color: var(--subtitle-bg-color);
  overflow: auto;
  height: 100%;
}
.subtitle-wrapper {
  padding: 10px;
  min-height: 100%;
}
.subtitle-item {
  margin: 5px 0;
  display: flex;
}
.time-area {
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 84px;
  color: var(--secondary-color);
}
.timestamp {
  user-select: none;
  height: 24px;
  line-height: 24px;
}
.timestamp-item {
  display: flex;
  align-items: center;
}
.time-modify {
  width: 10px;
  display: flex;
  flex-direction: column;
  margin-left: 2px;
}
.time-modify-icon {
  height: 12px;
  opacity: 0.6;
  transition: transform 0.2s;
}
.time-modify-icon.disabled {
  color: #ccc;
}
.time-modify-icon:hover {
  opacity: 1;
  transform: scale(1.5);
}
.time-modify-icon.disabled:hover {
  opacity: 0.6;
  transform: none;
}
.subtitle-text {
  margin: 6px 0 6px 5px;
  flex: 1;
  border-radius: 6px;
}
.subtitle-text.active .subtitle-text-inner {
  background-color: var(--primary-color-light);
}
.subtitle-text.selected .subtitle-text-inner {
  box-shadow: 0 0 0px 1px var(--primary-color);
}
.subtitle-text-inner {
  padding: 8px 10px;
  border-radius: 6px;
  outline: none;
  margin: 3px 0;
}
.subtitle-text-inner:hover {
  box-shadow: 0 0 0px 1px var(--primary-color);
}
.options {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  margin: 0 0 0 10px;
}
.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: none;
  cursor: pointer;
}
.icon-wrapper:hover {
  background-color: #eaeaea;
}
.subtitle-item:hover .icon-wrapper {
  display: flex;
}
.empty-tip {
  min-height: 100%;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.splitter-wrapper {
  cursor: col-resize;
}
.splitter {
  display: inline-block;
  width: 1px;
  height: 24px;
  margin: 0 4px;
  border-right: 1px dashed var(--primary-deep-color);
  vertical-align: top;
}
.splitter-wrapper:hover .splitter{
  border-right: 3px dashed var(--primary-deep-color);
  width: 3px;
  margin: 0 3px;
}
</style>
