<script lang="ts" setup>
import { ref } from 'vue';
import { ITranslationProvider, useTransProvidersStore } from '../../stores/translation-providers';
import { useSessionStore } from '../../stores/session';
import { FormOutlined, CheckCircleFilled, CloseCircleFilled, QuestionCircleOutlined } from '@ant-design/icons-vue';
import { useSubtitlesStore } from '../../stores/subtitles';

defineProps({
  modelValue: Boolean,
});
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const transProvidersStore = useTransProvidersStore();
const subtitlesStore = useSubtitlesStore();
const sessionStore = useSessionStore();

const showProviderModal = ref(false);

const alertMessage = ref('');
const alertVisible = ref(false);

function hide() {
  emit('update:modelValue', false);
}
function cancel() {
  hide();
  emit('cancel');
}
async function confirm() {
  const supportedLangs = await transProvidersStore.getTranslateSupportLangs();
  if (subtitlesStore.selectedTranlationLang && !supportedLangs.includes(subtitlesStore.selectedTranlationLang)) {
    const langInfo = subtitlesStore.translationLangOptions.find(item => item.id === subtitlesStore.selectedTranlationLang);
    alertMessage.value = `选中的翻译服务商不支持【${langInfo ? langInfo.name : '选中语言'}】`;
    alertVisible.value = true;
    setTimeout(() => {
      alertVisible.value = false;
      alertMessage.value = '';
    }, 3000);
    return;
  }

  emit('confirm');
  hide();
}

transProvidersStore.initProvidersData();

function openEditPanel(item: ITranslationProvider) {
  transProvidersStore.editProvider(item);
  showProviderModal.value = true;
}
function hideProviderModal() {
  showProviderModal.value = false;
}
</script>

<template>
  <Teleport to="body">
    <div class="custom-modal" v-if="modelValue">
      <div class="custom-modal-body">
        <div class="modal-header">
          <div class="header-title">翻译服务商设置</div>
        </div>
        <div class="modal-content">
          <div class="download-settings">
            <div class="modal-group">
              <div class="modal-group-title">
                选择一个翻译服务商
                <a :href="sessionStore.translationHelpUrl" target="_blank">
                  <QuestionCircleOutlined class="tooltiped-icon-body"></QuestionCircleOutlined>
                </a>
              </div>
              <div class="modal-group-content provider-list">
                <div
                  class="provider-item"
                  :class="[{
                    enabled: item.enabled,
                    checked: transProvidersStore.selectedProviderId === item.id,
                  }]"
                  v-for="item in transProvidersStore.availableModels"
                  @click="transProvidersStore.selectProvider(item)"
                >
                  <CheckCircleFilled class="check-icon" v-if="transProvidersStore.selectedProviderId === item.id"></CheckCircleFilled>
                  <a-tag
                    color="#ddd"
                    class="no-config-tag"
                    v-if="!item.enabled"
                  >未配置</a-tag>
                  <div class="provider-name">{{ item.name }}</div>
                  <ATooltip class="tooltiped-icon" placement="right">
                    <template #title>{{ item.enabled ? '编辑' : '去配置' }}</template>
                    <FormOutlined class="edit-icon" @click.stop="openEditPanel(item)"></FormOutlined>
                  </ATooltip>
                </div>
              </div>
              <a-alert v-if="alertVisible" :message="alertMessage" type="warning" show-icon class="bottom-alert" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <AButton class="modal-btn" @click="cancel">取消</AButton>
          <AButton class="modal-btn" :disabled="!transProvidersStore.selectedProviderId" type="primary" @click="confirm">继续</AButton>
        </div>
        <CloseCircleFilled class="close-btn" @click="cancel"></CloseCircleFilled>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <div class="custom-modal provider-modal" v-if="showProviderModal" @click="hideProviderModal">
      <div class="custom-modal-body" @click.stop>
        <div class="modal-header">
          <div class="header-title">配置参数</div>
        </div>
        <div class="modal-content">
          <a-form
            v-if="transProvidersStore.editingProvider"
            :model="transProvidersStore.editingProvider.tempModel"
            name="basic"
            :label-col="{ span: 8 }"
            :wrapper-col="{ span: 14 }"
            autocomplete="off"
            class="provider-form"
            @finish="transProvidersStore.saveEditingProvider(); hideProviderModal()"
          >
            <a-form-item
              :label="item.name"
              :name="item.id"
              :rules="item.rules"
              v-for="item in transProvidersStore.editingProvider?.modelFields"
            >
              <a-input v-if="item.type === 'input'" v-model:value="transProvidersStore.editingProvider.tempModel[item.id]" />
              <a-input-password v-if="item.type === 'input-password'" v-model:value="transProvidersStore.editingProvider.tempModel[item.id]" />
              <a-switch
                v-if="item.type === 'switch'"
                v-model:checked="transProvidersStore.editingProvider.tempModel[item.id]"
                checked-children="是"
                un-checked-children="否"
                checked-value="pro"
                un-checked-value="free"
              ></a-switch>
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 13, span: 16 }">
              <a-button class="modal-btn" @click="transProvidersStore.cancelEditingProvider(); hideProviderModal()">取消</a-button>
              <a-button type="primary" class="modal-btn" html-type="submit">保存配置</a-button>
            </a-form-item>
          </a-form>
        </div>
        <CloseCircleFilled class="close-btn" @click="hideProviderModal"></CloseCircleFilled>
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
  z-index: 2100;
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
.modal-group-title {
  margin: 20px 0 15px;
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

.provider-list {
  margin: 10px 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  column-gap: 10px;
  row-gap: 10px;
}
.provider-item {
  position: relative;
  border: 1px dashed #eee;
  background-color: transparent;
  border-radius: 3px;
  cursor: pointer;
  padding: 40px 10px 10px;
  cursor: default;
  user-select: none;
}
.provider-item.enabled {
  background-color: #f9f9f9;
  cursor: pointer;
}
.provider-item.enabled:hover {
  background-color: #f2f2f2;
}
.provider-item.enabled {
  border-style: solid;
}
.provider-item.enabled.checked {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}
.check-icon {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  color: var(--secondary-color);
  font-size: 20px;
}
.provider-name {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
}
.no-config-tag {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
}
.edit-icon {
  opacity: 0.6;
}
.edit-icon:hover {
  opacity: 1;
}

.provider-modal {
  z-index: 2200;
}
.provider-modal .custom-modal-body {
  width: 500px;
}
.provider-form {
  margin: 20px 0 0;
}

.bottom-alert {
  margin: 10px 0;
}
</style>
