import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export interface MenuItem {
  id: string;
  name: string;
  icon: string;
  body: string;
}
export const useNavStore = defineStore('navStore', () => {

  const menus: MenuItem[] = [
    {
      id: 'create',
      name: '字幕提取',
      icon: 'PlusCircleOutlined',
      body: 'MediaList',
    },
  ];

  const selectedMenuId = ref(menus[0].id);
  const selectedMenu = computed(() => {
    return menus.find(item => item.id === selectedMenuId.value);
  });

  function selectMenu(id: string) {
    selectedMenuId.value = id;
  }

  return {
    menus,
    selectedMenuId,
    selectedMenu,
    selectMenu,
  };
});
