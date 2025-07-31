<template>
  <div class="document-review">
    <h1>Проверка документа</h1>
    
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      Загрузка документа...
    </div>
    
    <div v-else class="review-container">
      <!-- Форма редактирования документа -->
      <form @submit.prevent="handleSubmit" class="review-form">
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
          <label for="originalText">Дословный текст документа:</label>
          <textarea
            id="originalText"
            v-model="document.originalText"
            required
            class="form-textarea"
            rows="6"
            placeholder="Вставьте текст или загрузите файл"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="summary">Краткая суть:</label>
          <div class="summary-container">
            <textarea
              id="summary"
              v-model="document.summary"
              required
              class="form-textarea"
              rows="3"
              placeholder="Будет автоматически заполнено после анализа"
            ></textarea>
            <button
              v-if="document.summary"
              type="button"
              @click="regenerateSummary"
              class="refresh-btn"
              :disabled="isAnalyzing"
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
        
        <div class="form-group">
          <label>Существенные параграфы (дословно):</label>
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

      <!-- Блок анализа нарушений -->
      <div v-if="violations.length > 0" class="violations-section">
        <div class="section-header">
          <h2>Выявленные нарушения</h2>
          <button
            @click="toggleViolations"
            class="toggle-btn"
          >
            {{ showViolations ? 'Скрыть' : 'Показать' }}
          </button>
        </div>
        
        <div v-if="showViolations" class="violations-list">
          <div
            v-for="(violation, index) in violations"
            :key="index"
            class="violation-card"
          >
            <div class="violation-header">
              <h3>{{ violation.law }} {{ violation.article }}</h3>
              <span class="severity-badge" :class="getSeverityClass(violation)">
                {{ getSeverityText(violation) }}
              </span>
            </div>
            <p><strong>Описание:</strong> {{ violation.description }}</p>
            <p><strong>Доказательство:</strong> <em>"{{ violation.evidence }}"</em></p>
            
            <div class="violation-actions">
              <select
                v-model="selectedAgencies[index]"
                class="agency-select"
                :disabled="isGeneratingComplaint[index]"
              >
                <option value="ФССП">ФССП</option>
                <option value="Прокуратура">Прокуратура</option>
                <option value="Суд">Суд</option>
                <option value="Омбудсмен">Омбудсмен</option>
              </select>
              <button
                @click="generateComplaint(violation, index)"
                class="complaint-btn"
                :disabled="isGeneratingComplaint[index]"
              >
                <span v-if="isGeneratingComplaint[index]" class="button-loader"></span>
                {{ isGeneratingComplaint[index] ? 'Генерация...' : 'Создать жалобу' }}
              </button>
            </div>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDocumentStore } from '@/stores/documentStore'
import { useAIStore } from '@/stores/aiStore'
import { useRouter } from 'vue-router'

const documentStore = useDocumentStore()
const aiStore = useAIStore()
const router = useRouter()

// Состояние компонента
const isLoading = ref(true)
const isSaving = ref(false)
const isAnalyzing = ref(false)
const error = ref(null)
const violations = ref([])
const selectedAgencies = ref([])
const isGeneratingComplaint = ref([])
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

// Список ведомств
const agenciesList = computed(() => documentStore.agenciesList)

// Инициализация
onMounted(async () => {
  try {
    if (!document.value.id && !document.value.originalText) {
      router.push('/')
      return
    }
    
    // Если документ уже существует, загружаем его данные
    if (document.value.id) {
      await documentStore.fetchDocumentById(document.value.id)
      document.value = { ...documentStore.currentDocument }
    }
  } catch (err) {
    error.value = 'Ошибка загрузки документа: ' + err.message
    console.error('Document loading error:', err)
  } finally {
    isLoading.value = false
  }
})

// Добавление/удаление параграфов
const addParagraph = () => {
  document.value.keyParagraphs.push('')
}

const removeParagraph = (index) => {
  document.value.keyParagraphs.splice(index, 1)
}

// Анализ документа
const analyzeDocument = async () => {
  isAnalyzing.value = true;
  try {
    // Вариант 1: Через documentStore (с привязкой к документу)
    const analysis = await documentStore.analyzeDocument(document.value.id);
    
    // Вариант 2: Через aiStore (просто анализ текста)
    // const analysis = await aiStore.analyzeText(document.value.originalText);
    
    document.value.summary = analysis.summary;
    document.value.keyParagraphs = analysis.keyParagraphs;
    violations.value = analysis.violations || [];
  } catch (err) {
    error.value = 'Ошибка анализа: ' + err.message;
  } finally {
    isAnalyzing.value = false;
  }
};

// Исправленный regenerateSummary
const regenerateSummary = async () => {
  isAnalyzing.value = true;
  try {
    const analysis = await aiStore.analyzeText(document.value.originalText);
    document.value.summary = analysis.summary || document.value.summary;
  } catch (err) {
    error.value = 'Ошибка при перегенерации краткой сути: ' + err.message;
  } finally {
    isAnalyzing.value = false;
  }
};

// Генерация жалобы
const generateComplaint = async (violation, index) => {
  isGeneratingComplaint.value[index] = true
  error.value = null
  
  try {
    const agency = selectedAgencies.value[index]
    const complaintData = await aiStore.generateComplaint(
      document.value.originalText,
      agency
    )
    
    // Сохранение жалобы
    await documentStore.saveComplaint({
      ...complaintData,
      relatedDocumentId: document.value.id,
      violation: `${violation.law} ${violation.article}`,
      agency
    })
    
    // Уведомление об успехе
    showNotification(`Жалоба в ${agency} успешно создана!`)
  } catch (err) {
    error.value = 'Ошибка генерации жалобы: ' + err.message
    console.error('Complaint generation error:', err)
  } finally {
    isGeneratingComplaint.value[index] = false
  }
}

// Сохранение документа
const handleSubmit = async () => {
  isSaving.value = true
  error.value = null
  
  try {
    // Валидация обязательных полей
    if (!document.value.summary.trim()) {
      throw new Error('Заполните краткую суть документа')
    }

    documentStore.currentDocument = { ...document.value }
    await documentStore.saveDocument()
    
    // Перенаправление после успешного сохранения
    router.push('/documents')
  } catch (err) {
    error.value = 'Ошибка сохранения: ' + err.message
    console.error('Save error:', err)
  } finally {
    isSaving.value = false
  }
}

// Вспомогательные функции
const toggleViolations = () => {
  showViolations.value = !showViolations.value
}

const getSeverityClass = (violation) => {
  if (violation.penalty?.includes('уголовная')) return 'severity-high'
  if (violation.penalty?.includes('административная')) return 'severity-medium'
  return 'severity-low'
}

const getSeverityText = (violation) => {
  if (violation.penalty?.includes('уголовная')) return 'Высокая'
  if (violation.penalty?.includes('административная')) return 'Средняя'
  return 'Низкая'
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
.document-review {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 1.8em;
  margin-bottom: 25px;
  color: #2c3e50;
  text-align: center;
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

@keyframes spin {
  to { transform: rotate(360deg); }
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

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 0.95em;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  transition: border-color 0.3s;
}

.form-input:focus, .form-textarea:focus {
  border-color: #42b983;
  outline: none;
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

.refresh-btn:hover {
  background-color: #f0f0f0;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.paragraph-item {
  margin-bottom: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.paragraph-item textarea {
  flex-grow: 1;
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

.remove-btn:hover {
  background: #ff5252;
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

.add-btn:hover {
  background: #3dbbb3;
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

.save-btn {
  background: #42b983;
  color: white;
}

.analyze-btn {
  background: #2196F3;
  color: white;
}

.save-btn:hover, .analyze-btn:hover {
  opacity: 0.9;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-loader {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

/* Стили для блока нарушений */
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

.section-header h2 {
  font-size: 1.4em;
  color: #2c3e50;
  margin: 0;
}

.toggle-btn {
  background: none;
  border: none;
  color: #2196F3;
  cursor: pointer;
  font-size: 0.9em;
}

.violation-card {
  background: #f9f9f9;
  border-left: 4px solid #ff6b6b;
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 0 4px 4px 0;
}

.violation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.violation-card h3 {
  color: #2c3e50;
  margin: 0;
  font-size: 1.1em;
}

.severity-badge {
  font-size: 0.8em;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: bold;
}

.severity-high {
  background-color: #ffebee;
  color: #c62828;
}

.severity-medium {
  background-color: #fff8e1;
  color: #ff8f00;
}

.severity-low {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.violation-card p {
  margin: 5px 0;
  font-size: 0.95em;
}

.violation-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  align-items: center;
}

.agency-select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9em;
}

.complaint-btn {
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 5px;
}

.complaint-btn:hover {
  background: #ff5252;
}

/* Стили для ошибок */
.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 4px;
  margin-top: 20px;
  border-left: 4px solid #c62828;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-icon {
  background: #c62828;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.close-error {
  margin-left: auto;
  background: none;
  border: none;
  color: #c62828;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0 5px;
}

/* Глобальные стили для уведомлений */
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

@keyframes slide-in {
  from { transform: translateY(100px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>