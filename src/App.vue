<script setup lang="ts">
import { log } from './log';
import GlobalNavs from './components/GlobalNavs.vue';
import BodyContainer from './components/BodyContainer.vue';
import { useSessionStore } from './stores/session';
import { notification } from 'ant-design-vue';

const sessionStore = useSessionStore();


async function init() {
  await sessionStore.getGlobalSettings();
  for (let item of sessionStore.globalNotifications) {
    notification.info({
      message: item.message,
      description: item.description,
      duration: item.duration,
    });
  }
  postMessage({ payload: 'removeLoading' }, '*');
}

init();

log.info('app start');
</script>

<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#f9cc8f',
      },
    }"
  >
    <div class="global-container">
      <GlobalNavs></GlobalNavs>
      <BodyContainer></BodyContainer>
    </div>
  </a-config-provider>
</template>

<style scoped>
.global-container {
  background: var(--bg-color);
  display: grid;
  grid-template-columns: 200px auto;
  grid-template-rows: 100%;
  height: 100%;
}
.transcript-item {
  text-align: left;
}
.srt-line {
  line-height: 1.2;
  margin: 0;
}
.blank-line::after {
  content: '';
  display: block;
  height: 1em;
}
</style>
