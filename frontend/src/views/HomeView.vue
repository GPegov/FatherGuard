<template>
  <div class="home-view">
    <h1>Изложите суть Вашей ситуации:</h1>
    <textarea 
      v-model="userText" 
      placeholder="Подробно опишите вашу ситуацию ..."
      class="text-input"
    ></textarea>
    
    <div class="upload-section">
      <p>Приложите входящие документы (.txt / .pdf)</p>
      <FileUpload 
        label="Загрузить документы"
        @files-selected="handleFilesSelected"
      />
    </div>

    <button 
      @click="submitData"
      :disabled="!isFormValid"
      class="submit-btn"
    >
      Продолжить
    </button>
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

const handleFilesSelected = (selectedFiles) => {
  files.value = selectedFiles;
};

const isFormValid = computed(() => {
  return userText.value.trim() !== '' || files.value.length > 0;
});

const submitData = async () => {
  try {
    // Создаем документ с текстом
    documentStore.currentDocument.originalText = userText.value;
    documentStore.currentDocument.comments = userText.value;
    
    // Загружаем файлы (если есть)
    if (files.value.length > 0) {
      await documentStore.uploadFiles(files.value);
    }
    
    // Сохраняем документ
    await documentStore.saveDocument();
    
    router.push('/review');
  } catch (error) {
    console.error('Ошибка сохранения:', error);
  }
};
</script>

<style scoped>
.home-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 1.5em;
  margin-bottom: 20px;
  color: #2c3e50;
}

.text-input {
  width: 100%;
  min-height: 150px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 20px;
  font-family: inherit;
  resize: vertical;
}

.upload-section {
  margin: 30px 0;
}

.upload-section p {
  margin-bottom: 10px;
  color: #555;
}

.submit-btn {
  display: block;
  width: 100%;
  padding: 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1em;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-btn:hover {
  background-color: #369f6b;
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>