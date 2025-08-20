<!-- src/views/ComplaintDetail.vue -->
<template>
  <div class="complaint-detail">
    <button @click="goBack" class="back-button">← Назад к списку</button>
    
    <div v-if="loading" class="loading-state">
      <p>Загрузка жалобы...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>Ошибка загрузки: {{ error }}</p>
    </div>
    <div v-else-if="!complaint" class="empty-state">
      <p>Жалоба не найдена</p>
    </div>
    <div v-else class="complaint-content">
      <div class="complaint-header">
        <h1>Жалоба #{{ complaint.id }}</h1>
        <span class="complaint-date">{{ formatDate(complaint.createdAt) }}</span>
      </div>
      <div class="complaint-meta">
        <div class="meta-field">
          <span class="meta-label">Ведомство:</span>
          <span class="meta-value">{{ complaint.agency }}</span>
        </div>
        
        <div class="meta-field">
          <span class="meta-label">Статус:</span>
          <span class="meta-value">{{ complaint.status }}</span>
        </div>
      </div>
      
      <div class="complaint-section">
        <h2>Текст жалобы</h2>
        <div class="complaint-text">{{ complaint.content }}</div>
      </div>
      
      <div v-if="complaint.analysis?.violations?.length" class="complaint-section">
        <h2>Выявленные нарушения</h2>
        <ul class="violations-list">
          <li v-for="(violation, index) in complaint.analysis.violations" :key="index" class="violation-item">
            <div class="violation-law">Закон: {{ violation.law }}</div>
            <div class="violation-article">Статья: {{ violation.article }}</div>
            <div class="violation-description">Описание: {{ violation.description }}</div>
            <div class="violation-evidence">Доказательство: {{ violation.evidence }}</div>
          </li>
        </ul>
      </div>
      
      <div class="complaint-actions">
        <button @click="exportComplaint('txt')" class="export-btn">Экспорт в TXT</button>
        <button @click="exportComplaint('doc')" class="export-btn">Экспорт в DOC</button>
        <button @click="deleteComplaint" class="delete-btn">Удалить жалобу</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useComplaintStore } from '@/stores/complaintStore'

const route = useRoute()
const router = useRouter()
const complaintStore = useComplaintStore()

const complaint = ref(null)
const loading = ref(false)
const error = ref(null)

onMounted(async () => {
  await loadComplaint()
})

const loadComplaint = async () => {
  loading.value = true
  error.value = null
  try {
    // Получаем список всех жалоб
    await complaintStore.fetchComplaints()
    // Находим нужную жалобу по ID
    complaint.value = complaintStore.complaints.find(c => c.id === route.params.id)
    if (!complaint.value) {
      error.value = 'Жалоба не найдена'
    }
  } catch (err) {
    console.error('Ошибка загрузки жалобы:', err)
    error.value = err.message || 'Не удалось загрузить жалобу'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/complaints')
}

const exportComplaint = async (format) => {
  try {
    await complaintStore.exportComplaint(complaint.value.id, format)
  } catch (err) {
    console.error('Ошибка экспорта:', err)
    error.value = 'Не удалось экспортировать жалобу'
  }
}

const deleteComplaint = async () => {
  if (confirm('Вы уверены, что хотите удалить эту жалобу?')) {
    try {
      await complaintStore.deleteComplaint(complaint.value.id)
      router.push('/complaints')
    } catch (err) {
      console.error('Ошибка удаления:', err)
      error.value = 'Не удалось удалить жалобу'
    }
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU')
}
</script>

<style scoped>
.complaint-detail {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.back-button {
  background: #f0f0f0;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;
}

.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.complaint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
}

.complaint-header h1 {
  margin: 0;
  color: #2c3e50;
}

.complaint-date {
  color: #666;
  font-size: 0.9em;
}

.complaint-meta {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.meta-field {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-weight: bold;
  font-size: 0.9em;
  color: #666;
}

.meta-value {
  font-size: 1em;
}

.complaint-section {
  margin-bottom: 30px;
}

.complaint-section h2 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.complaint-text {
  white-space: pre-wrap;
  background: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #eee;
  line-height: 1.5;
}

.violations-list {
  list-style: none;
  padding: 0;
}

.violation-item {
  background: #f9f9f9;
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 4px;
  border: 1px solid #eee;
}

.violation-law, .violation-article, .violation-description, .violation-evidence {
  margin-bottom: 5px;
}

.violation-evidence {
  font-style: italic;
  color: #666;
}

.complaint-actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.export-btn, .delete-btn {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.export-btn {
  background: #42b983;
  color: white;
}

.delete-btn {
  background: #ff4444;
  color: white;
}
</style>