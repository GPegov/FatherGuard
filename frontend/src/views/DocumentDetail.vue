<template>
  <div class="document-detail">
    <button @click="goBack" class="back-button">← Назад к списку</button>
    
    <div v-if="loading" class="loading-state">
      <p>Загрузка документа...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>Ошибка загрузки: {{ error }}</p>
    </div>

    <div v-else-if="!document" class="empty-state">
      <p>Документ не найден</p>
    </div>

    <div v-else class="document-content">
      <div class="document-header">
        <h1>Документ #{{ document.id }}</h1>
        <span class="document-date">{{ formatDate(document.date) }}</span>
      </div>

      <div class="document-meta">
        <div v-if="document.agency" class="meta-field">
          <span class="meta-label">Ведомство:</span>
          <span class="meta-value">{{ document.agency }}</span>
        </div>
        
        <div class="meta-field">
          <span class="meta-label">Дата создания:</span>
          <span class="meta-value">{{ formatDateTime(document.createdAt) }}</span>
        </div>
      </div>

      <div class="document-section">
        <h2>Исходный текст</h2>
        <pre class="original-text">{{ document.originalText }}</pre>
      </div>

      <div v-if="document.summary" class="document-section">
        <h2>Краткое содержание</h2>
        <p class="summary-text">{{ document.summary }}</p>
      </div>

      <div v-if="document.keyParagraphs?.length" class="document-section">
        <h2>Ключевые параграфы</h2>
        <ul class="paragraphs-list">
          <li v-for="(para, index) in document.keyParagraphs" :key="index">
            {{ para }}
          </li>
        </ul>
      </div>

      <div v-if="document.attachments?.length" class="document-section">
        <h2>Прикрепленные файлы</h2>
        <div class="attachments-list">
          <div v-for="file in document.attachments" :key="file.id" class="attachment-item">
            <div class="attachment-info">
              <span class="attachment-name">{{ file.name }}</span>
              <span class="attachment-size">{{ formatFileSize(file.size) }}</span>
            </div>
            <a 
              :href="getFileUrl(file.path)" 
              target="_blank"
              class="download-button"
            >
              Скачать
            </a>
          </div>
        </div>
      </div>

      <div v-if="document.comments" class="document-section">
        <h2>Комментарии</h2>
        <p class="comments-text">{{ document.comments }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentStore } from '@/stores/documentStore'

const route = useRoute()
const router = useRouter()
const documentStore = useDocumentStore()

const document = ref(null)
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    loading.value = true
    error.value = null
    await documentStore.fetchDocumentById(route.params.id)
    document.value = { ...documentStore.currentDocument }
  } catch (err) {
    error.value = err.message || 'Не удалось загрузить документ'
    console.error('Ошибка загрузки документа:', err)
  } finally {
    loading.value = false
  }
})

const formatDate = (dateString) => {
  return dateString ? new Date(dateString).toLocaleDateString('ru-RU') : 'Дата не указана'
}

const formatDateTime = (dateString) => {
  if (!dateString) return 'Дата не указана'
  const options = {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
  return new Date(dateString).toLocaleString('ru-RU', options)
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 KB'
  return `${(bytes / 1024).toFixed(2)} KB`
}

const getFileUrl = (path) => {
  return path.startsWith('http') ? path : `http://localhost:3001${path}`
}

const goBack = () => {
  router.push('/documents')
}
</script>

<style scoped>
.document-detail {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.back-button {
  background: none;
  border: none;
  color: #42b983;
  cursor: pointer;
  font-size: 1em;
  margin-bottom: 20px;
  padding: 5px 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.back-button:hover {
  text-decoration: underline;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 1.2em;
}

.error-state {
  color: #ff4444;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.document-header h1 {
  margin: 0;
  font-size: 1.8em;
  color: #2c3e50;
}

.document-date {
  color: #666;
  font-size: 0.9em;
}

.document-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 25px;
  flex-wrap: wrap;
}

.meta-field {
  display: flex;
  gap: 5px;
}

.meta-label {
  font-weight: bold;
  color: #555;
}

.meta-value {
  color: #333;
}

.document-section {
  margin-bottom: 30px;
}

.document-section h2 {
  font-size: 1.3em;
  color: #2c3e50;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.original-text {
  white-space: pre-wrap;
  background: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  line-height: 1.6;
  font-family: inherit;
}

.summary-text {
  line-height: 1.6;
  padding-left: 10px;
}

.paragraphs-list {
  padding-left: 20px;
}

.paragraphs-list li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f5f5f5;
  border-radius: 4px;
}

.attachment-info {
  display: flex;
  flex-direction: column;
}

.attachment-name {
  font-weight: 500;
}

.attachment-size {
  font-size: 0.8em;
  color: #666;
}

.download-button {
  background: #42b983;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9em;
}

.download-button:hover {
  background: #369f6b;
}

.comments-text {
  padding: 10px;
  background: #f0f8ff;
  border-radius: 4px;
  line-height: 1.6;
}
</style>