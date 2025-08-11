<template>
  <div class="app">
    <header class="app-header">
      <nav class="nav-container">
        <router-link to="/" class="nav-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" class="logo-icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span class="logo-text">Юридическая Защита Отцов</span>
        </router-link>
        <div class="nav-links">
          <router-link to="/" class="nav-link" exact-active-class="active">Главная</router-link>
          <router-link to="/documents" class="nav-link" exact-active-class="active">Документы</router-link>
          <router-link to="/complaints" class="nav-link" exact-active-class="active">Жалобы</router-link>
        </div>
      </nav>
    </header>

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="app-footer">
      <div class="footer-content">
        <p>© 2025 Юридический сервис "Защита Отцов".</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { useDocumentStore } from '@/stores/documentStore'
import { useComplaintStore } from '@/stores/complaintStore'

const documentStore = useDocumentStore()
const complaintStore = useComplaintStore()

// Загружаем данные при первом открытии соответствующих страниц
watch(
  () => documentStore.documents,
  (newVal) => {
    if (newVal.length === 0) { 
      documentStore.fetchDocuments()
    }
  },
  { immediate: true }
)
watch(
  () => documentStore.documents,
  (newVal) => {
    if (newVal.length === 0) { 
      documentStore.fetchComplaints()
    }
  },
  { immediate: true }
)
</script>

<style>
/* Базовые сбросы */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #42b983;
  --secondary-color: #35495e;
  --light-gray: #f5f5f5;
  --dark-gray: #333;
  --border-color: #e0e0e0;
}

body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  color: var(--dark-gray);
  background-color: var(--light-gray);
}

/* Основная структура */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Шапка */
.app-header {
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.nav-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: var(--secondary-color);
  font-weight: bold;
  font-size: 1.2rem;
  gap: 10px;
}

.logo-icon {
  color: var(--primary-color);
}

.logo-text {
  font-family: 'Verdana', sans-serif;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-link {
  text-decoration: none;
  color: var(--secondary-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  color: var(--primary-color);
  background-color: rgba(66, 185, 131, 0.1);
}

.nav-link.active {
  color: var(--primary-color);
  font-weight: bold;
  border-bottom: 2px solid var(--primary-color);
}

/* Подвал */
.app-footer {
  background-color: var(--secondary-color);
  color: white;
  padding: 1.5rem;
  text-align: center;
  margin-top: auto;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-model-info {
  font-size: 0.8rem;
  opacity: 0.8;
  margin-top: 0.5rem;
}

/* Анимации */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Адаптивность */
@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }

  .nav-links {
    width: 100%;
    justify-content: space-around;
  }

  .app-main {
    padding: 15px;
  }
}
</style>