import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'


const app = createApp(App)

const pinia = createPinia()
app.use(pinia)


app.use(router)
console.log('API Base:', import.meta.env.VITE_API_BASE)
console.log('Model URL:', import.meta.env.VITE_LOCAL_MODEL_URL)

app.mount('#app')