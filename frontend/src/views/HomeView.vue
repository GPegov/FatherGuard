<template>
  <div class="home-view">
    <h1>Изложите суть Вашей ситуации:</h1>
    <textarea 
      v-model="userText" 
      placeholder="Подробно опишите вашу ситуацию..."
      class="text-input"
    ></textarea>
    
    <div class="upload-section">
      <p>Приложите входящие документы (.txt / .pdf)</p>
      <FileUpload 
        label="Загрузить документы"
        @files-selected="handleFilesSelected"
        accept=".txt,.pdf"
      />
      <div v-if="files.length > 0" class="files-preview">
        <p>Выбранные файлы: {{ files.map(f => f.name).join(', ') }}</p>
      </div>
    </div>

    <button 
      @click="submitData"
      :disabled="!isFormValid || isLoading"
      class="submit-btn"
    >
      <span v-if="!isLoading">Продолжить</span>
      <span v-else>Обработка...</span>
    </button>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import FileUpload from '@/components/common/FileUpload.vue';
import { useDocumentStore } from '@/stores/documentStore';

const documentStore = useDocumentStore();
const router = useRouter();
const userText = ref('');
const files = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');

const handleFilesSelected = (selectedFiles) => {
  files.value = selectedFiles;
  errorMessage.value = '';
};

const isFormValid = computed(() => {
  return userText.value.trim() !== '' || files.value.length > 0;
});

const submitData = async () => {
  if (!isFormValid.value || isLoading.value) return;

  isLoading.value = true;
  errorMessage.value = '';

  try {
    // Инициализируем новый документ с полной структурой
    const newDocument = {
      id: null, // Будет установлен при сохранении
      dateReceived: new Date().toISOString().split('T')[0],
      agency: '',
      originalText: userText.value,
      summary: '',
      documentDate: '',
      senderAgency: '',
      keyParagraphs: [],
      attachments: [],
      comments: userText.value,
      complaints: [],
      analysisStatus: 'pending',
      lastAnalyzedAt: null
    };

    // Обновляем документ в хранилище
    documentStore.currentDocument = newDocument;

    // Загружаем файлы (если есть)
    if (files.value.length > 0) {
      await documentStore.uploadFiles(files.value);
      // Предполагаем, что uploadFiles обновляет currentDocument.attachments
    }

    // Сохраняем документ
    const savedDoc = await documentStore.saveDocument();
    
    if (savedDoc?.id) {
      router.push({ 
        name: 'review', 
        params: { id: savedDoc.id },
        query: { new: 'true' } // Можно использовать для специальной обработки нового документа
      });
    } else {
      throw new Error('Документ не был сохранен: отсутствует ID');
    }
  } catch (error) {
    console.error('Ошибка при создании документа:', error);
    errorMessage.value = error.response?.data?.message || 
                         error.message || 
                         'Произошла ошибка при сохранении документа';
    
    // Сбрасываем статус анализа в случае ошибки
    documentStore.currentDocument.analysisStatus = 'failed';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.home-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Arial', sans-serif;
}

h1 {
  font-size: 1.5em;
  margin-bottom: 20px;
  color: #2c3e50;
  text-align: center;
}

.text-input {
  width: 100%;
  min-height: 150px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 1em;
  line-height: 1.5;
  resize: vertical;
  transition: border-color 0.3s;
}

.text-input:focus {
  border-color: #42b983;
  outline: none;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}

.upload-section {
  margin: 30px 0;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  border: 1px dashed #ddd;
}

.upload-section p {
  margin-bottom: 15px;
  color: #555;
  text-align: center;
  font-weight: 500;
}

.files-preview {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 0.9em;
}

.submit-btn {
  display: block;
  width: 100%;
  padding: 15px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 30px;
}

.submit-btn:hover {
  background-color: #369f6b;
  transform: translateY(-2px);
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
}

.error-message {
  margin-top: 20px;
  padding: 15px;
  background-color: #ffebee;
  color: #d32f2f;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid #d32f2f;
}
</style>