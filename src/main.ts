import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import { createPinia } from 'pinia';

const app = createApp(App);
const pinia = createPinia();

app.use(Antd);
app.use(pinia);

app.mount('#app');
