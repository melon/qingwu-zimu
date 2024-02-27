<script lang="ts" setup>
import { CloseCircleFilled } from '@ant-design/icons-vue';
import { useSessionStore } from '../../stores/session';
import defaultAvatar from '../../assets/imgs/default-avatar.png';

defineProps({
  modelValue: Boolean,
});
const emit = defineEmits(['update:modelValue']);

const sessionStore = useSessionStore();

function cancel() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <div class="custom-modal" v-if="modelValue"  @click="cancel">
      <div class="custom-modal-body" @click.stop>
        <div class="modal-content">
          <div class="avatar">
            <img class="avatar-img" :src="sessionStore.avatarUrl || defaultAvatar">
          </div>
          <div class="nickname">{{ sessionStore.nickname }}</div>
          <div class="product-type">
            <div class="product-type-name">免费版</div>
          </div>
          <div class="version-wrapper">
            <div class="version">v{{ sessionStore.currentVersion }}</div>
          </div>
          <div class="version-wrapper">
            <a v-if="sessionStore.currentVersion !== sessionStore.newestVersion" :href="sessionStore.appDownloadUrl" target="_blank" class="upgrade-version">更新软件</a>
            <span v-else>（当前已是最新版）</span>
          </div>
          <div class="links">
            <a :href="item.link" target="_blank" v-for="item in sessionStore.settingLinks" :key="item.link">{{ item.name }}</a>
          </div>
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
.avatar-img {
  width: 60px;
  height: 60px;
  border-radius: 5px;
  vertical-align: middle;
  border: 1px solid #f4f4f4;
  box-shadow: 0 0 30px 0 rgba(0, 0, 0, 0.05);
}
.avatar {
  text-align: center;
  margin: 15px 0 10px;
  height: 60px;
}
.nickname {
  text-align: center;
  margin: 10px 0 5px;
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
.product-type {
  display: flex;
  justify-content: center;
}
.product-type-name {
  background-color: #2eb981;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
}
.version-wrapper {
  display: flex;
  justify-content: center;
  margin: 4px 0;
  font-size: 14px;
}
.version {
  font-weight: bold;
}
.upgrade-version {
  margin: 0 4px;
}
.links {
  margin: 40px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.links > a {
  font-size: 14px;
  margin: 0 4px;
}
</style>
