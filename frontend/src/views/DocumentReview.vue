<template>
  <div class="document-review">
    <div class="header">
      <h1>Предпросмотр документа</h1>
      <button @click="goBack" class="back-button">← Назад</button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка данных...</p>
    </div>

    <!-- Индикатор анализа -->
    <div v-if="isAnalyzing && !isLoading" class="analyzing-overlay">
      <div class="analyzing-content">
        <div class="loading-spinner"></div>
        <div class="analyzing-text">Анализ документа...</div>
        <div class="analyzing-subtext">Пожалуйста, подождите</div>
      </div>
    </div>

    <div v-else class="review-container">
      <form @submit.prevent="handleSubmit" class="review-form">
        <!-- Основные поля -->
        <div class="form-section">
          <h2>Основная информация</h2>
          <div class="form-group">
            <label for="date">Дата поступления:</label>
            <input type="date" id="date" v-model="document.date" required class="form-input" />
          </div>

          <div class="form-group">
            <label for="agency">Ведомство, допустившее нарушение:</label>
            <input type="text" id="agency" v-model="document.agency" list="agencies" required class="form-input"
              placeholder="Выберите ведомство" />
            <datalist id="agencies">
              <option v-for="agency in agenciesList" :key="agency">{{ agency }}</option>
            </datalist>
          </div>

          <div class="form-group">
            <label for="originalText">Текст документа:</label>
            <textarea id="originalText" v-model="document.originalText" required class="form-textarea" rows="15"
              placeholder="Введите текст документа"></textarea>
          </div>
        </div>

        <!-- Анализ документа -->
        <div class="form-section" v-if="document.analysisStatus !== 'pending'">
          <h2>Анализ документа</h2>

          <div class="form-group" v-if="document.analysisStatus === 'completed'">
            <label>Краткая суть:</label>
            <div class="summary-container">
              <textarea v-model="document.summary" required class="form-textarea" rows="12"
                placeholder="Анализ выполняется..."></textarea>
              <button type="button" @click="regenerateSummary" class="refresh-btn" :disabled="aiStore.isLoading"
                title="Перегенерировать краткую суть">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Важные предложения -->
          <div class="form-group" v-if="document.analysisStatus === 'completed'">
            <label>Важные предложения:</label>
            <div v-for="(sentence, index) in document.keySentences" :key="index" class="paragraph-item">
              <textarea v-model="document.keySentences[index]" required class="form-textarea" rows="3"></textarea>
              <button type="button" @click="removeSentence(index)" class="remove-btn" title="Удалить предложение">
                ×
              </button>
            </div>
            <button type="button" @click="addSentence" class="add-btn" title="Добавить предложение">
              + Добавить предложение
            </button>
          </div>
        </div>

        <!-- Отправитель вложенного документа (только при наличии вложений) -->
        <div class="form-section" v-if="document.attachments?.length">
          <h2>Отправитель вложенного документа</h2>
          
          <div class="form-group">
            <label>Дата отправления документа:</label>
            <input v-model="document.documentDate" type="date" class="form-input" />
          </div>

          <div class="form-group">
            <label>Ведомство-отправитель:</label>
            <input v-model="document.senderAgency" class="form-input" list="agencies" />
          </div>
        </div>

        <!-- Вложения -->
        <div class="form-section" v-if="document.attachments?.length">
          <h2>Вложенные документы</h2>
          <div v-for="(attachment, idx) in document.attachments" :key="attachment.id || idx"
            class="attachment-analysis">
            <div class="attachment-header">
              <h3>{{ attachment.name }}</h3>
              <span class="file-size">{{ formatFileSize(attachment.size) }}</span>
            </div>

            <div v-if="attachment.analysis" class="attachment-details">
              <div class="detail-row">
                <span class="detail-label">Тип документа:</span>
                <span>{{ attachment.analysis.documentType || 'Не указан' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Дата отправления:</span>
                <input type="date" v-model="attachment.documentDate" class="form-input small">
              </div>
              <div class="detail-row">
                <span class="detail-label">Ведомство-отправитель:</span>
                <input v-model="attachment.senderAgency" class="form-input small" list="agencies">
              </div>
              <div class="detail-row full-width">
                <span class="detail-label">Краткая суть:</span>
                <textarea v-model="attachment.summary" class="form-textarea" rows="3"></textarea>
              </div>
              <div class="detail-row full-width">
                <span class="detail-label">Полный текст:</span>
                <textarea v-model="attachment.text" class="form-textarea" rows="6" readonly></textarea>
              </div>

              <div class="key-paragraphs">
                <h4>Важные предложения:</h4>
                <div v-for="(sentence, index) in attachment.keySentences" :key="index" class="paragraph-item">
                  <textarea v-model="attachment.keySentences[index]" class="form-textarea" rows="2"></textarea>
                  <button type="button" @click="removeAttachmentSentence(attachment.id, index)" class="remove-btn"
                    title="Удалить предложение">
                    ×
                  </button>
                </div>
                <button type="button" @click="addAttachmentSentence(attachment.id)" class="add-btn"
                  title="Добавить предложение">
                  + Добавить предложение
                </button>
              </div>
            </div>
            <div v-else class="no-analysis">
              <p>Анализ не выполнен</p>
            </div>
          </div>
        </div>



        <!-- Кнопки действий -->
        <div class="form-actions">
          <button type="button" @click="analyzeDocument" class="analyze-btn"
            :disabled="isAnalyzing || (!document.originalText && (!document.attachments || document.attachments.length === 0))">
            <span v-if="isAnalyzing" class="button-loader"></span>
            {{ isAnalyzing ? 'Анализ...' : 'Анализировать документ' }}
          </button>

          <button type="submit" class="save-btn" :disabled="isSaving">
            {{ isSaving ? 'Сохранение...' : 'Сохранить документ' }}
          </button>
        </div>
      </form>

      <!-- Блок статуса -->
      <div class="status-section">
        <div class="status-indicator" :class="document.analysisStatus">
          Статус анализа:
          <span>{{ getStatusText(document.analysisStatus) }}</span>
        </div>
        <div v-if="document.lastAnalyzedAt" class="last-analyzed">
          Последний анализ: {{ formatDate(document.lastAnalyzedAt) }}
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
    
    <!-- Индикатор анализа -->
    <div v-if="isAnalyzing && !isLoading" class="analyzing-overlay">
      <div class="analyzing-content">
        <div class="loading-spinner"></div>
        <div class="analyzing-text">Анализ документа...</div>
        <div class="analyzing-subtext">Пожалуйста, подождите</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAIStore } from '@/stores/aiStore'
import { useDocumentStore } from '@/stores/documentStore'

const router = useRouter()
const aiStore = useAIStore()
const documentStore = useDocumentStore()

const isLoading = ref(true)
const isSaving = ref(false)
const isAnalyzing = ref(false)
const error = ref(null)

const document = ref({
  ...documentStore.currentDocument
})

const agenciesList = computed(() => documentStore.agenciesList)

onMounted(async () => {
  try {
    console.log('Инициализация компонента DocumentReview');
    await aiStore.checkServerStatus();

    // Проверяем, есть ли текст для анализа
    const hasOriginalText = document.value.originalText && document.value.originalText.trim().length > 0;
    const hasAttachmentsWithText = document.value.attachments?.some(att => att.text && att.text.trim().length > 0);
    
    console.log('Проверка текста при инициализации:', { hasOriginalText, hasAttachmentsWithText, document: document.value });
    
    if (!document.value.id && !hasOriginalText && !hasAttachmentsWithText) {
      console.log('Нет документа для анализа, перенаправление на главную');
      router.push('/');
      return;
    }

    if (document.value.id && document.value.id !== 'new') {
      console.log('Загрузка документа по ID:', document.value.id);
      await documentStore.fetchDocumentById(document.value.id);
      document.value = {
        ...documentStore.currentDocument,
        attachments: documentStore.currentDocument.attachments?.map(att => ({
          ...att,
          analysis: att.analysis || null
        })) || []
      };
      console.log('Документ загружен:', document.value);
    }
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    error.value = 'Ошибка загрузки: ' + err.message;
  } finally {
    isLoading.value = false;
  }
});

const addAttachmentSentence = (attachmentId) => {
  const attachment = document.value.attachments.find(a => a.id === attachmentId);
  if (attachment) {
    if (!attachment.keySentences) {
      attachment.keySentences = [];
    }
    attachment.keySentences.push('');
  }
};

const removeAttachmentSentence = (attachmentId, index) => {
  const attachment = document.value.attachments.find(a => a.id === attachmentId);
  if (attachment && attachment.keySentences) {
    attachment.keySentences.splice(index, 1);
  }
};

const addSentence = () => {
  document.value.keySentences.push('')
}

const removeSentence = (index) => {
  document.value.keySentences.splice(index, 1)
}

const analyzeDocument = async () => {
  isAnalyzing.value = true
  error.value = null

  try {
    // Обновляем currentDocument в хранилище перед анализом
    documentStore.currentDocument = document.value
    const updatedDocument = await documentStore.analyzeDocument()

    document.value = {
      ...updatedDocument
    }
    
    // Обновляем currentDocument в хранилище
    documentStore.currentDocument = document.value
  } catch (err) {
    error.value = 'Ошибка анализа: ' + err.message
  } finally {
    isAnalyzing.value = false
  }
}


const regenerateSummary = async () => {
  isAnalyzing.value = true
  try {
    // Вызываем бэкенд для генерации краткой сути
    const response = await axios.post('http://localhost:3001/api/documents/analyze-text', {
      text: document.value.originalText
    });
    const analysis = response.data;
    
    document.value.summary = analysis.summary || 'Не удалось сгенерировать краткую суть';
  } catch (err) {
    error.value = 'Ошибка перегенерации: ' + err.message
  } finally {
    isAnalyzing.value = false
  }
}

const handleSubmit = async () => {
  isSaving.value = true
  error.value = null

  try {
    // Обновляем currentDocument в хранилище перед сохранением
    documentStore.currentDocument = document.value
    await documentStore.saveDocument()
    router.push('/documents')
  } catch (err) {
    error.value = 'Ошибка сохранения: ' + err.message
  } finally {
    isSaving.value = false
  }
}

const goBack = () => {
  router.push('/')
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('ru-RU')
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 KB'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  )
}

const getStatusText = (status) => {
  const statusMap = {
    pending: 'Ожидает анализа',
    processing: 'В процессе',
    completed: 'Завершён',
    failed: 'Ошибка'
  }
  return statusMap[status] || status
}
</script>

<style scoped>
.form-input.small {
  padding: 6px 8px;
  font-size: 0.9em;
}

.detail-row {
  margin-bottom: 15px;
}

.detail-row.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
}

.attachment-details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
}

.document-review {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.back-button {
  background: none;
  border: none;
  color: #42b983;
  cursor: pointer;
  font-size: 1em;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: #f0f0f0;
}

.loading-state {
  text-align: center;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
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

.form-section {
  background: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-section h2 {
  margin-top: 0;
  color: #2c3e50;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  transition: border-color 0.3s;
}

.form-input:focus,
.form-textarea:focus {
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
  background: #f5f5f5;
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
  background: #e0e0e0;
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

.remove-btn:hover {
  background: #ff4444;
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
  background: #3dbeb5;
}

.attachment-analysis {
  background: #f8f8f8;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.attachment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.attachment-header h3 {
  margin: 0;
  color: #2c3e50;
}

.file-size {
  color: #666;
  font-size: 0.9em;
}

.attachment-details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-label {
  font-weight: bold;
  color: #555;
}

.key-paragraphs {
  grid-column: 1 / -1;
  margin-top: 10px;
}

.key-paragraphs h4 {
  margin-bottom: 5px;
  color: #2c3e50;
}

.key-paragraphs ul {
  padding-left: 20px;
}

.key-paragraphs li {
  margin-bottom: 5px;
  font-style: italic;
}

.no-analysis {
  text-align: center;
  padding: 20px;
  color: #666;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  gap: 15px;
}

.analyze-btn,
.save-btn {
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

.analyze-btn {
  background: #42b983;
  color: white;
}

.analyze-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.save-btn {
  background: #2c3e50;
  color: white;
}

.save-btn:disabled {
  background: #cccccc;
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

.status-section {
  background: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.status-indicator {
  font-weight: 500;
}

.status-indicator.pending {
  color: #666;
}

.status-indicator.processing {
  color: #ffbb33;
}

.status-indicator.completed {
  color: #42b983;
}

.status-indicator.failed {
  color: #ff4444;
}

.last-analyzed {
  font-size: 0.9em;
  color: #666;
  margin-top: 5px;
}

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
  font-weight: bold;
}

.close-error {
  background: none;
  border: none;
  cursor: pointer;
  margin-left: auto;
  font-size: 1.2em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Анимация анализа */
.analyzing-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease-out;
}

.analyzing-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  text-align: center;
  max-width: 300px;
  width: 90%;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(66, 185, 131, 0.3);
  border-top: 4px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.analyzing-text {
  font-size: 1.1em;
  color: #333;
  margin-bottom: 10px;
}

.analyzing-subtext {
  font-size: 0.9em;
  color: #666;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>