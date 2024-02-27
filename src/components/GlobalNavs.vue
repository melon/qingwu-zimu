<script setup lang="ts">
import { useNavStore } from '../stores/nav';
import { SettingOutlined }  from '@ant-design/icons-vue';
import {
  PlusCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons-vue';
import GlobalSettings from './common/GlobalSettings.vue';
import { ref } from 'vue';

const iconMap = {
  PlusCircleOutlined,
  AppstoreOutlined,
};
const navStore = useNavStore();
const showGlobalSettings = ref(false);
</script>

<template>
  <div class="global-nav">
    <div class="logo-area">
      <img src="../../icon.png" alt="Qingwu" class="logo-img">
      <span class="logo-text">青梧字幕<sup class="logo-text-sup">AI</sup></span>
    </div>
    <div class="menu-area">
      <div
        class="menu-item"
        v-for="item in navStore.menus"
        :key="item.id"
        :class="[{ selected: item.id === navStore.selectedMenuId }]"
        @click="navStore.selectMenu(item.id)"
      >
        <component :is="iconMap[item.icon as keyof typeof iconMap]" class="menu-icon"></component>{{ item.name }}
      </div>
    </div>

    <div class="nav-footer">
      <SettingOutlined class="setting-icon" @click="showGlobalSettings = true"></SettingOutlined>
    </div>
    <GlobalSettings
      v-model="showGlobalSettings"
    ></GlobalSettings>
  </div>
</template>

<style scoped>
.global-nav {
  border-right: 1px solid var(--border-color);
  cursor: default;
  position: relative;
}
.logo-area {
  padding: 40px 10px 20px;
  -webkit-app-region: drag;
}
.logo-img {
  width: 50px;
  height: 50px;
  vertical-align: middle;
}
.logo-text {
  margin: 0 8px;
  font-size: 20px;
  vertical-align: middle;
  font-weight: bold;
  color: #555;
}
.logo-text-sup {
  color: var(--secondary-color);
  font-size: 15px;
  margin-left: 2px;
}
.menu-area {
  padding: 0 10px;
  user-select: none;
}
.menu-item {
  padding: 10px;
  opacity: 0.8;
}
.menu-item.selected {
  background: var(--primary-color);
  opacity: 1;
}
.menu-icon {
  margin-right: 5px;
}
.nav-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px;
  background: var(--bg-color);
}
.setting-icon {
  margin: 0 0 0 5px;
  padding: 5px;
  opacity: 0.8;
}
.setting-icon:hover {
  background-color: var(--primary-color);
  cursor: pointer;
  opacity: 1;
}
</style>
