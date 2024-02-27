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
          <div class="header-title">导入字幕设置</div>
        </div>
        <div class="modal-content">
          <div class="language-select-wrapper">
            <div class="language-select-title">选择字幕语言（仅支持单语字幕）</div>
            <ASelect
              class="language-select"
              v-model:value="subtitlesStore.selectedImportLanguageId"
              size="large"
              :fieldNames="{ label: 'name', value: 'id' }"
              :options="subtitlesStore.importLanguages"
            ></ASelect>
          </div>
        </div>
        <div class="modal-footer">
          <AButton class="modal-btn" @click="cancel">取消</AButton>
          <AButton class="modal-btn" type="primary" @click="confirm">下一步</AButton>
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
  width: 300px;
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
.language-select-wrapper {
  padding: 20px 0;
}
.language-select-title {
  margin: 0 0 10px;
}
.language-select {
  width: 120px;
}
</style>
