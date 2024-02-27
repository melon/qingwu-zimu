<script setup lang="ts">
import { useNavStore } from '../stores/nav';

import MediaList from './MediaList/MediaList.vue';

const bodyMap = {
  MediaList,
};
const navStore = useNavStore();
</script>

<template>
  <component :is="bodyMap[navStore.selectedMenu?.body as keyof typeof bodyMap]"></component>
</template>
