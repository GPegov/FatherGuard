<!-- src/components/complaints/ComplaintForm.vue -->
<template>
  <div class="complaint-form">
    <div class="header">
      <button @click="goBack" class="back-button">← Назад</button>
      <h1>Создание жалобы</h1>
    </div>

    <div v-if="loading" class="loading">
      <p>Загрузка данных...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>Ошибка: {{ error }}</p>
    </div>
    
    <div v-else class="complaint-form-content">
      <div class="document-preview">
        <h2>Документ для жалобы</h2>
        <div class="document-info">
          <div class="info-row">
            <span class="label">Дата поступления:</span>
            <span class="value">{{ formatDate(document.date) }}</span>
          </div>
          <div class="info-row">
            <span class="label">Ведомство:</span>
            <span class="value">{{ document.agency || 'Не указано' }}</span>
          </div>
          <div class="info-row">
            <span class="label">Дата документа:</span>
            <span class="value">{{ document.documentDate || 'Не указана' }}</span>
          </div>
          <div class="info-row">
            <span class="label">Краткая суть:</span>
            <span class="value">{{ document.summary || 'Нет краткой сводки' }}</span>
          </div>
        </div>
      </div>

      <div class="agency-selection">
        <h2>Выберите ведомство</h2>
        <select v-model="selectedAgency" @change="onAgencyChange" class="agency-select">
          <option value="">-- Выберите ведомство --</option>
          <option 
            v-for="agency in agenciesOptions" 
            :key="agency" 
            :value="agency"
          >
            {{ agency }}
          </option>
        </select>
      </div>

      <div class="instructions-section">
        <h2>Дополнительные инструкции</h2>
        <textarea 
          v-model="customInstructions" 
          placeholder="Введите дополнительные инструкции для нейросети (необязательно)"
          class="instructions-input"
          rows="4"
        ></textarea>
      </div>

      <div class="actions">
        <button 
          @click="generateComplaint" 
          :disabled="isGenerating || !selectedAgency"
          class="generate-btn"
        >
          {{ isGenerating ? 'Генерация...' : 'Создать жалобу' }}
        </button>
        <button @click="goBack" class="cancel-btn">Отмена</button>
      </div>

      <div v-if="generatedComplaint" class="complaint-result">
        <h2>Сгенерированная жалоба</h2>
        <div class="complaint-content">
          <pre>{{ generatedComplaint }}</pre>
        </div>
        <div class="result-actions">
          <button @click="copyToClipboard" class="copy-btn">Копировать</button>
          <button @click="saveComplaint" class="save-btn">Сохранить в документ</button>
        </div>
      </div>
    </div>

    <NotificationToast 
      v-if="showNotification"
      :message="notificationMessage"
      :type="notificationType"
      :duration="2000"
      @close="showNotification = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentStore } from '@/stores/documentStore'
import { useComplaintStore } from '@/stores/complaintStore'
import NotificationToast from '@/components/ui/NotificationToast.vue'

const route = useRoute()
const router = useRouter()
const documentStore = useDocumentStore()
const complaintStore = useComplaintStore()

// Состояния (все в Pinia store)
const selectedAgency = ref('')
const customInstructions = ref('')
const generatedComplaint = ref(null)

// Геттеры из store
const agenciesOptions = computed(() => complaintStore.agenciesOptions)
const isGenerating = computed(() => complaintStore.isGenerating)
const loading = computed(() => documentStore.loading)
const error = computed(() => documentStore.error)

// Методы из store
const formatDate = (dateString) => {
  return dateString ? new Date(dateString).toLocaleDateString('ru-RU') : 'Дата не указана'
}

const onAgencyChange = () => {
  // Логика при изменении выбора ведомства
}

const generateComplaint = async () => {
  if (!selectedAgency.value) return
  
  try {
    const payload = {
      documentId: route.params.id,
      agency: selectedAgency.value,
      instructions: customInstructions.value
    }
    
    // Используем метод из store
    await complaintStore.generateComplaint(payload)
    generatedComplaint.value = complaintStore.generatedComplaint
    
    // Сбросим состояние после успешной генерации
    selectedAgency.value = ''
    customInstructions.value = ''
  } catch (err) {
    console.error('Ошибка генерации жалобы:', err)
    // Обработка ошибки через store или уведомления
  }
}

const copyToClipboard = () => {
  if (generatedComplaint.value) {
    navigator.clipboard.writeText(generatedComplaint.value)
    // Уведомление через store
  }
}

const saveComplaint = async () => {
  if (!generatedComplaint.value) return
  
  try {
    const complaintData = {
      documentId: route.params.id,
      agency: selectedAgency.value,
      content: generatedComplaint.value,
      status: 'draft'
    }
    
    await complaintStore.saveComplaintToDocument(complaintData)
    
    // После сохранения обновляем документ
    await documentStore.fetchDocumentById(route.params.id)
    router.push(`/documents/${route.params.id}`)
  } catch (err) {
    console.error('Ошибка сохранения жалобы:', err)
  }
}

const goBack = () => {
  router.push(`/documents/${route.params.id}`)
}

// Загрузка данных документа
onMounted(async () => {
  try {
    await documentStore.fetchDocumentById(route.params.id)
  } catch (err) {
    console.error('Ошибка загрузки документа:', err)
  }
})
</script>

<style scoped>
.complaint-form {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
  gap: 15px;
}

.back-button {
  background: none;
  border: none;
  color: #42b983;
  cursor: pointer;
  font-size: 1em;
  padding: 5px 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.back-button:hover {
  text-decoration: underline;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 1.2em;
}

.error {
  color: #ff4444;
}

.complaint-form-content {
  background: white;
  border-radius: 8px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.document-preview h2,
.agency-selection h2,
.instructions-section h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #2c3e50;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.document-info {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 25px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.label {
  font-weight: bold;
  color: #555;
}

.value {
  color: #333;
  text-align: right;
  flex: 1;
  margin-left: 15px;
}

.agency-select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  margin-bottom: 25px;
}

.instructions-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 25px;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.generate-btn, .cancel-btn {
  padding: 12px 25px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.generate-btn {
  background-color: #4CAF50;
  color: white;
}

.generate-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.generate-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: #f44336;
  color: white;
}

.cancel-btn:hover {
  background-color: #da190b;
}

.complaint-result {
  margin-top: 30px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 20px;
  background-color: #fff;
}

.complaint-result h2 {
  margin-top: 0;
  color: #2c3e50;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.complaint-content {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 14px;
}

.result-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.copy-btn, .save-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.copy-btn {
  background-color: #2196F3;
  color: white;
}

.copy-btn:hover {
  background-color: #1976D2;
}

.save-btn {
  background-color: #FF9800;
  color: white;
}

.save-btn:hover {
  background-color: #F57C00;
}

@media (max-width: 768px) {
  .complaint-form {
    padding: 10px;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .result-actions {
    flex-direction: column;
  }
  
  .info-row {
    flex-direction: column;
    gap: 5px;
  }
  
  .value {
    text-align: left;
  }
}
</style>