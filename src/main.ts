import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'krds-uiux/resources/css/token/krds_tokens.css'
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/base.css'
import './styles/print.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).mount('#app')
