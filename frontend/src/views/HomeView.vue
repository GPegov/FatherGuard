<template>
  <div class="home-view">
    <h1>Опишите, как именно были нарушены ваши права:</h1>
    <textarea 
      v-model="userText" 
      placeholder="В свободной форме изложите детали нарушения..."
      class="text-input"
      rows="15"
    ></textarea>
    
    <div class="region-selection-section">
      <p>Выберите регион, в котором произошло нарушение:</p>
      <RegionAutocomplete
        :regions="regionsList"
        v-model="selectedRegionName"
        @region-selected="onRegionSelected"
        class="region-autocomplete"
        :disabled="isLoading || regionsList.length === 0"
      />
      <div v-if="regionLoading" class="loading-regions">
        Загрузка списка регионов...
      </div>
    </div>
    
    <div class="upload-section">
      <p>Приложите входящие документы (.doc / .docx / .txt / .pdf)</p>
      <FileUpload 
        label="Добавить документы"
        @files-selected="handleFilesSelected"
        accept=".doc,.docx,.txt,.pdf"
      />
      <div v-if="files.length > 0" class="files-preview">
        <p>Выбранные файлы: {{ files.map(f => f.name).join(', ') }}</p>
      </div>
    </div>

    <button 
      @click="submitData"
      :disabled="!isFormValid || isLoading || !selectedRegionCode"
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { v4 as uuidv4 } from 'uuid';
import FileUpload from '@/components/common/FileUpload.vue';
import RegionAutocomplete from '@/components/RegionAutocomplete.vue';
import { useDocumentStore } from '@/stores/documentStore';

const documentStore = useDocumentStore();
const router = useRouter();
const userText = ref('');
const files = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const selectedRegionName = ref(''); // Изменяем на имя региона
const selectedRegionCode = ref(''); // Добавляем отдельное состояние для кода региона
const regionsList = ref([]);
const regionLoading = ref(false);

// Загружаем список регионов при монтировании компонента
onMounted(async () => {
  await loadRegions();
});

const loadRegions = async () => {
  regionLoading.value = true;
  try {
    const response = await fetch('http://localhost:3001/api/fssp/regions');
    const data = await response.json();
    if (data.success) {
      regionsList.value = data.regions;
    } else {
      console.error('Ошибка загрузки регионов:', data.message);
      errorMessage.value = 'Ошибка загрузки списка регионов';
    }
  } catch (error) {
    console.error('Ошибка загрузки регионов:', error);
    errorMessage.value = 'Ошибка соединения с сервером';
  } finally {
    regionLoading.value = false;
  }
};

// Обработка выбора региона через автозаполнение
const onRegionSelected = (regionName) => {
  selectedRegionName.value = regionName;
  // Найти код региона по имени
  const region = regionsList.value.find(r => r.name === regionName);
  selectedRegionCode.value = region ? region.code : '';
};

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
    // Инициализируем новый документ с полной структурой (временно, до сохранения)
    const newDocument = {
      id: uuidv4(), // Генерируем уникальный ID сразу при создании документа
      date: new Date().toISOString().split('T')[0],
      fsspDepartment: '', // Вначале оставляем пустым, будет заполнено конкретным отделением ФССП позже
      originalText: userText.value,
      summary: '',
      documentDate: '',
      senderAgency: '',
      keySentences: [],
      attachments: [],
      comments: userText.value,
      complaints: [],
      analysisStatus: 'pending',
      lastAnalyzedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      violations: [],
      regionCode: selectedRegionCode.value // Сохраняем код региона для загрузки отделений ФССП
    };

    // Обновляем документ в хранилище
    documentStore.currentDocument = newDocument;

    // Если есть файлы для загрузки, сначала загружаем их (но документ в базе не создаем)
    if (files.value.length > 0) {
      try {
        // Загружаем файлы и обновляем документ
        await documentStore.uploadFiles(files.value);
      } catch (uploadError) {
        console.error('Ошибка загрузки файлов:', uploadError);
        errorMessage.value = 'Ошибка загрузки файлов: ' + uploadError.message;
        return;
      }
    }
    
    // Обновляем документ в хранилище, чтобы убедиться, что regionCode сохранен
    // (сервер может не возвращать regionCode в ответе, но он нужен для дальнейшей работы)
    documentStore.currentDocument = {
      ...documentStore.currentDocument,
      regionCode: selectedRegionCode.value
    };

    // Переходим к предпросмотру без сохранения документа в базе
    // Используем реальный ID документа
    router.push({ 
      name: 'review', 
      params: { id: newDocument.id }
    });
  } catch (error) {
    console.error('Ошибка при подготовке документа:', error);
    errorMessage.value = error.response?.data?.message || 
                         error.message || 
                         'Произошла ошибка при подготовке документа';
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

.region-selection-section {
  margin: 20px 0;
  padding: 15px;
  background-color: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #d0e6ff;
}

.region-selection-section p {
  margin-bottom: 10px;
  color: #555;
  font-weight: 500;
}

.region-autocomplete {
  width: 100%;
}

.loading-regions {
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
  text-align: center;
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