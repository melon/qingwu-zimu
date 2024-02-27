<script lang="ts" setup>
import { useSubtitlesStore } from '../../stores/subtitles';
import { CloseCircleFilled } from '@ant-design/icons-vue';

defineProps({
  modelValue: Boolean,
});
const emit = defineEmits(['update:modelValue', 'confirm']);

const subtitlesStore = useSubtitlesStore();

function cancel() {
  emit('update:modelValue', false);
}
function confirm() {
  emit('confirm');
  cancel();
}
</script>

<template>
  <Teleport to="body">
    <div class="custom-modal" v-if="modelValue"  @click="cancel">
      <div class="custom-modal-body" @click.stop>
        <div class="modal-header">
          <div class="header-title">下载字幕设置</div>
        </div>
        <div class="modal-content">
          <div class="download-settings">
            <div class="lang-group">
              <div class="lang-group-title">主语言</div>
              <a-radio-group v-model:value="subtitlesStore.downloadPrimaryLang" button-style="solid">
                <a-radio-button
                  v-for="opt in subtitlesStore.downloadablePrimaryLangOptions"
                  :value="opt.id"
                >
                  {{ opt.name }}
                </a-radio-button>
              </a-radio-group>
            </div>
            <div class="lang-group">
              <div class="lang-group-title">副语言</div>
              <a-radio-group v-model:value="subtitlesStore.downloadSecondaryLang" button-style="solid">
                <a-radio-button
                  v-for="opt in subtitlesStore.downloadableSecondaryLangOptions"
                  :value="opt.id"
                >
                  {{ opt.name }}
                </a-radio-button>
              </a-radio-group>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <AButton class="modal-btn" @click="cancel">取消</AButton>
          <AButton class="modal-btn" type="primary" @click="confirm">
            {{ subtitlesStore.downloadSecondaryLang ? '下载双语字幕' : '下载单语字幕' }}
          </AButton>
        </div>
        <CloseCircleFilled class="close-btn" @click="cancel"></CloseCircleFilled>
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
}
.custom-modal-body :deep(.ant-btn >.anticon+span) {
  margin-inline-start: 4px;
}
.custom-modal-body :deep(.ant-radio-button-wrapper) {
  margin: 0 0 5px 0;
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
.download-settings {
  margin: 20px 0 30px;
}
.lang-group {
  margin: 10px 0;
}
.lang-group-title {
  font-size: 16px;
  font-weight: bold;
  margin: 10px 0 4px;
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
</style>
