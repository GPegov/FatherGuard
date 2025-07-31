<template>
  <div class="file-upload">
    <input 
      type="file" 
      id="fileInput"
      ref="fileInput"
      :accept="allowedExtensions"
      @change="handleFileUpload"
      multiple
      hidden
    />
    <label for="fileInput" class="upload-button">
      {{ label }}
    </label>
    <div v-if="files.length > 0" class="file-list">
      <div v-for="(file, index) in files" :key="index" class="file-item">
        <span class="file-name">{{ file.name }}</span>
        <span class="file-size">{{ formatFileSize(file.size) }}</span>
        <button @click="removeFile(index)" class="remove-btn">×</button>
      </div>
    </div>
    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  label: {
    type: String,
    default: 'Выберите файлы'
  },
  maxSize: {
    type: Number,
    default: 10 * 1024 * 1024 // 10MB по умолчанию
  }
});

const emit = defineEmits(['files-selected', 'upload-error']);

const fileInput = ref(null);
const files = ref([]);
const error = ref(null);
const allowedExtensions = '.pdf,.txt,.doc,.docx';

const handleFileUpload = (event) => {
  error.value = null;
  const newFiles = Array.from(event.target.files);
  
  // Проверка каждого файла
  for (const file of newFiles) {
    // 1. Проверка расширения
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'doc', 'docx'].includes(extension)) {
      error.value = `Файл ${file.name}: недопустимое расширение`;
      emit('upload-error', error.value);
      return;
    }

    // 2. Проверка MIME-типа (клиентская проверка ненадежна, но лучше чем ничего)
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (file.type && !allowedMimes.includes(file.type)) {
      error.value = `Файл ${file.name}: недопустимый тип`;
      emit('upload-error', error.value);
      return;
    }

    // 3. Проверка размера
    if (file.size > props.maxSize) {
      error.value = `Файл ${file.name}: превышен максимальный размер (${props.maxSize / 1024 / 1024}MB)`;
      emit('upload-error', error.value);
      return;
    }
  }

  // Если все проверки пройдены
  files.value = [...files.value, ...newFiles];
  updateFileInput();
  emit('files-selected', files.value);
};

const removeFile = (index) => {
  files.value.splice(index, 1);
  updateFileInput();
  emit('files-selected', files.value);
};

const updateFileInput = () => {
  const dataTransfer = new DataTransfer();
  files.value.forEach(file => dataTransfer.items.add(file));
  fileInput.value.files = dataTransfer.files;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload-button {
  display: inline-block;
  padding: 10px 20px;
  background-color: #42b983;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  text-align: center;
}

.upload-button:hover {
  background-color: #369f6b;
}

.file-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.file-name {
  flex-grow: 1;
  margin-right: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.8em;
  color: #666;
  margin-right: 10px;
}

.remove-btn {
  background: none;
  border: none;
  color: #ff4444;
  cursor: pointer;
  font-size: 1.2em;
  padding: 0 5px;
}

.error-message {
  color: #ff4444;
  font-size: 0.9em;
  margin-top: 5px;
}
</style>