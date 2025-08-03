<template>
  <div class="document-review">
    <h1>Проверка документа</h1>
    
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      Загрузка документа...
    </div>
    
    <div v-else class="review-container">
      <form @submit.prevent="handleSubmit" class="review-form">
        <!-- Основные поля документа -->
        <div class="form-group">
          <label for="date">Дата поступления:</label>
          <input
            type="date"
            id="date"
            v-model="document.date"
            required
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label for="agency">Ведомство:</label>
          <input
            type="text"
            id="agency"
            v-model="document.agency"
            list="agencies"
            required
            class="form-input"
          />
          <datalist id="agencies">
            <option v-for="agency in agenciesList" :key="agency">{{ agency }}</option>
          </datalist>
        </div>
        
        <div class="form-group">
          <label for="originalText">Текст документа:</label>
          <textarea
            id="originalText"
            v-model="document.originalText"
            required
            class="form-textarea"
            rows="8"
            placeholder="Вставьте текст или загрузите файл"
          ></textarea>
        </div>
        
        <!-- Краткая суть -->
        <div class="form-group">
          <label for="summary">Краткая суть:</label>
          <div class="summary-container">
            <textarea
              id="summary"
              v-model="document.summary"
              required
              class="form-textarea"
              rows="3"
              placeholder="Будет заполнено автоматически"
            ></textarea>
            <button
              v-if="document.summary"
              type="button"
              @click="regenerateSummary"
              class="refresh-btn"
              :disabled="aiStore.isLoading"
              title="Перегенерировать краткую суть"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Ключевые параграфы -->
        <div class="form-group">
          <label>Существенные параграфы:</label>
          <div
            v-for="(paragraph, index) in document.keyParagraphs"
            :key="index"
            class="paragraph-item"
          >
            <textarea
              v-model="document.keyParagraphs[index]"
              required
              class="form-textarea"
              rows="2"
            ></textarea>
            <button
              type="button"
              @click="removeParagraph(index)"
              class="remove-btn"
              title="Удалить параграф"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            @click="addParagraph"
            class="add-btn"
            title="Добавить параграф"
          >
            + Добавить параграф
          </button>
        </div>
        
        <!-- Кнопки действий -->
        <div class="form-actions">
          <button
            type="button"
            @click="analyzeDocument"
            class="analyze-btn"
            :disabled="isAnalyzing || !document.originalText"
          >
            <span v-if="isAnalyzing" class="button-loader"></span>
            {{ isAnalyzing ? 'Идет анализ...' : 'Анализировать текст' }}
          </button>
          <button
            type="submit"
            class="save-btn"
            :disabled="isSaving || !document.summary"
          >
            {{ isSaving ? 'Сохранение...' : 'Сохранить документ' }}
          </button>
        </div>
      </form>

      <!-- Блок нарушений -->
      <div v-if="violationsText" class="violations-section">
        <div class="section-header">
          <h2>Выявленные нарушения</h2>
          <div class="model-status" :class="aiStore.apiStatus">
            {{ aiStore.activeModelName }} ({{ aiStore.apiStatus === 'ready' ? 'онлайн' : 'офлайн' }})
          </div>
          <button
            @click="toggleViolations"
            class="toggle-btn"
          >
            {{ showViolations ? 'Скрыть' : 'Показать' }}
          </button>
        </div>
        
        <div v-if="showViolations" class="violations-content">
          <pre class="violations-text">{{ violationsText }}</pre>
          
          <div class="violation-actions">
            <select
              v-model="selectedAgency"
              class="agency-select"
              :disabled="isGeneratingComplaint"
            >
              <option v-for="agency in aiStore.agencies" :key="agency" :value="agency">
                {{ agency }}
              </option>
            </select>
            <button
              @click="generateComplaint"
              class="complaint-btn"
              :disabled="isGeneratingComplaint || !aiStore.isServerOnline"
            >
              <span v-if="isGeneratingComplaint" class="button-loader"></span>
              {{ isGeneratingComplaint ? 'Генерация...' : 'Создать жалобу' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Уведомления об ошибках -->
      <div v-if="error" class="error-message">
        <div class="error-content">
          <span class="error-icon">!</span>
          <span>{{ error }}</span>
          <button @click="error = null" class="close-error" title="Закрыть">×</button>
        </div>
      </div>
    </div>
  <div class="raw-response-section" v-if="rawModelResponse">
    <h2>Полный ответ модели</h2>
    <textarea 
      v-model="rawModelResponse" 
      readonly
      class="raw-response-textarea"
      placeholder="Здесь будет отображаться полный ответ модели..."
    ></textarea>
  </div>
  </div>


</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAIStore } from '@/stores/aiStore'
import { useDocumentStore } from '@/stores/documentStore'
import { useRouter } from 'vue-router'

const rawModelResponse = ref('')

const aiStore = useAIStore()
const documentStore = useDocumentStore()
const router = useRouter()

// Состояние компонента
const isLoading = ref(true)
const isSaving = ref(false)
const isAnalyzing = ref(false)
const error = ref(null)
const violationsText = ref('')
const selectedAgency = ref('ФССП')
const isGeneratingComplaint = ref(false)
const showViolations = ref(true)

// Данные документа
const document = ref({
  date: new Date().toISOString().split('T')[0],
  agency: '',
  originalText: '',
  summary: '',
  keyParagraphs: [''],
  ...documentStore.currentDocument
})

// Список ведомств из хранилища
const agenciesList = computed(() => documentStore.agenciesList)

// Инициализация компонента
onMounted(async () => {
  try {
    // Проверка статуса сервера AI
    await aiStore.checkServerStatus()
    
    if (!document.value.id && !document.value.originalText) {
      router.push('/')
      return
    }
    
    if (document.value.id) {
      await documentStore.fetchDocumentById(document.value.id)
      document.value = { ...documentStore.currentDocument }
    }
  } catch (err) {
    error.value = 'Ошибка загрузки: ' + err.message
  } finally {
    isLoading.value = false
  }
})

// Управление параграфами
const addParagraph = () => {
  document.value.keyParagraphs.push('')
}

const removeParagraph = (index) => {
  document.value.keyParagraphs.splice(index, 1)
}

// Основной анализ документа
const analyzeDocument = async () => {
  isAnalyzing.value = true;
  error.value = null;
  rawModelResponse.value = '';

  try {
    const analysis = await aiStore.analyzeDocument(document.value.originalText);
    
    // Сохраняем полный ответ
    rawModelResponse.value = JSON.stringify({
      summary: analysis.summary,
      paragraphs: analysis.paragraphs,
      violations: analysis.violations,
      raw: analysis.rawResponse
    }, null, 2);

    // Безопасное обновление данных
    document.value.summary = analysis.summary;
    document.value.keyParagraphs = [
      ...analysis.paragraphs,
      ...Array(Math.max(0, 3 - analysis.paragraphs.length)).fill('')
    ].slice(0, 5);

    violationsText.value = analysis.violations;

  } catch (err) {
    error.value = 'Системная ошибка при анализе';
    rawModelResponse.value = JSON.stringify({
      error: err.message,
      stack: err.stack
    }, null, 2);
  } finally {
    isAnalyzing.value = false;
  }
};

// Перегенерация краткой сути
const regenerateSummary = async () => {
  isAnalyzing.value = true
  try {
    document.value.summary = await aiStore.generateSummary(document.value.originalText)
    rawModelResponse.value = `Сгенерирована краткая суть:\n${response}`
  } catch (err) {
    error.value = 'Ошибка перегенерации: ' + err.message
  } finally {
    isAnalyzing.value = false
  }
}

// Генерация жалобы
const generateComplaint = async () => {
  isGeneratingComplaint.value = true
  error.value = null
  
  try {
    const complaintText = await aiStore.generateComplaint(
      document.value.originalText,
      selectedAgency.value,
      violationsText.value
    )
    
    await documentStore.saveComplaint({
      text: complaintText,
      agency: selectedAgency.value,
      relatedDocumentId: document.value.id,
      violation: violationsText.value.split('\n')[0] || ''
    })
    
    showNotification(`Жалоба в ${selectedAgency.value} успешно создана!`)
  } catch (err) {
    error.value = 'Ошибка генерации жалобы: ' + err.message
  } finally {
    isGeneratingComplaint.value = false
  }
}

// Сохранение документа
const handleSubmit = async () => {
  isSaving.value = true
  error.value = null
  
  try {
    if (!document.value.summary.trim()) {
      throw new Error('Заполните краткую суть документа')
    }

    documentStore.currentDocument = { ...document.value }
    await documentStore.saveDocument()
    router.push('/documents')
  } catch (err) {
    error.value = 'Ошибка сохранения: ' + err.message
  } finally {
    isSaving.value = false
  }
}

// Вспомогательные функции
const toggleViolations = () => {
  showViolations.value = !showViolations.value
}

const showNotification = (message) => {
  const notification = document.createElement('div')
  notification.className = 'global-notification'
  notification.textContent = message
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.classList.add('fade-out')
    setTimeout(() => notification.remove(), 500)
  }, 3000)
}
</script>

<style scoped>


.raw-response-section {
  margin-top: 40px;
  padding: 20px;
  background-color: #f8f8f8;
  border-radius: 8px;
}

.raw-response-section h2 {
  font-size: 1.3em;
  color: #2c3e50;
  margin-bottom: 15px;
}

.raw-response-textarea {
  width: 100%;
  min-height: 150px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  background-color: #fefefe;
  resize: vertical;
  white-space: pre;
  overflow-x: auto;
}



.document-review {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.loading {
  text-align: center;
  padding: 40px;
  font-size: 1.2em;
  color: #666;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #42b983;
  animation: spin 1s ease-in-out infinite;
}

.review-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.review-form {
  background: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 20px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  transition: border-color 0.3s;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.summary-container {
  position: relative;
}

.refresh-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.paragraph-item {
  margin-bottom: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.remove-btn {
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn {
  background: #4ecdc4;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.2s;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  gap: 15px;
}

.save-btn, .analyze-btn {
  border: none;
  border-radius: 4px;
  padding: 12px 20px;
  cursor: pointer;
  font-size: 1em;
  flex: 1;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.button-loader {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

.violations-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.model-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  background: #f0f0f0;
}

.model-status.ready {
  background: #e8f5e9;
  color: #2e7d32;
}

.model-status.error, .model-status.offline {
  background: #ffebee;
  color: #c62828;
}

.violations-text {
  white-space: pre-wrap;
  background: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  line-height: 1.5;
}

.violation-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.agency-select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.complaint-btn {
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 4px;
  margin-top: 20px;
  border-left: 4px solid #c62828;
}

.global-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #42b983;
  color: white;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slide-in 0.3s ease-out;
}

.fade-out {
  animation: fade-out 0.5s ease-out forwards;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes slide-in {
  from { transform: translateY(100px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>