<template>
  <div class="chronicle-container">
    <!-- Отображение региона в правом верхнем углу страницы -->
    <div class="page-region-display">
      <span class="region-name">{{ documentStore.currentDocument?.regionCode ? documentStore.getRegionNameByCode(documentStore.currentDocument.regionCode) : 'Выберите регион' }}</span>
    </div>
    
    <!-- Основная область контента -->
    <div class="main-content">
      <!-- Раздел летописи (левая сторона) -->
      <div class="chronicle-section">
        <div class="chronicle-header">
          <h2>История взаимоотношений с ФССП</h2>
          <div class="header-buttons">
            <button class="add-info-btn" @click="addInfo">
              Добавить сведения
            </button>
            <button class="refresh-btn" @click="loadChronicleEntries">
              Обновить
            </button>
          </div>
        </div>
        
        <div class="chronicle-entries">
          <div 
            v-for="(entry, index) in chronicleEntries" 
            :key="entry.id || index"
            class="chronicle-entry"
          >
            <div v-if="editingEntryId === entry.id" class="entry-edit">
              <div class="entry-header">
                <input 
                  v-model="editingEntryData.date" 
                  type="date" 
                  class="entry-date-input"
                />
                <select 
                  v-model="editingEntryData.eventType" 
                  class="entry-type-select"
                >
                  <option value="document_created">Добавление документа</option>
                  <option value="document_analyzed">Анализ документа</option>
                  <option value="complaint_created">Создание жалобы</option>
                  <option value="complaint_submitted">Отправка жалобы</option>
                  <option value="response_received">Получен ответ</option>
                  <option value="generic">Общее событие</option>
                </select>
              </div>
              <textarea 
                v-model="editingEntryData.content" 
                class="entry-textarea"
                rows="4"
              ></textarea>
              <div class="entry-actions">
                <button class="save-btn" @click="saveEntry(entry.id)">Сохранить</button>
                <button class="cancel-btn" @click="cancelEdit">Отмена</button>
              </div>
            </div>
            
            <div v-else class="entry-content">
              <div class="entry-header-info">
                <div class="entry-date">{{ formatDate(entry.date) }}</div>
                <div class="entry-date-label">{{ formatEntryDate(entry.createdAt) }}</div>
                <div class="entry-type">{{ getEventTypeLabel(entry.eventType) }}</div>
              </div>
              <div class="entry-text">{{ entry.content }}</div>
              <div class="entry-actions">
                <button class="edit-btn" @click="startEdit(entry)">Редактировать</button>
                <button class="delete-btn" @click="deleteEntry(entry.id)">Удалить</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Раздел чата (правая сторона) -->
      <div class="chat-section">
        <div class="chat-header">
          <h3>Прямой доступ</h3>
        </div>
        <div class="chat-messages" ref="messagesContainer">
          <div 
            v-for="(message, index) in chatMessages" 
            :key="index" 
            :class="['message', message.sender]"
          >
            {{ message.text }}
          </div>
        </div>
        <div class="chat-input">
          <input 
            v-model="userInput" 
            @keypress.enter="sendMessage"
            placeholder="Введите сообщение..."
            class="full-width-input"
          />
          <button @click="sendMessage">Отправить</button>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useDocumentStore } from '@/stores/documentStore';
import axios from 'axios';

const router = useRouter();
const documentStore = useDocumentStore();

// Содержимое летописи
const chronicleEntries = ref([]);
// Состояние редактирования
const editingEntryId = ref(null);
const editingEntryData = ref({
  date: '',
  eventType: '',
  content: ''
});

// Функциональность чата
const chatMessages = ref([
  { sender: 'ai', text: 'Здесь можно внести уточнения в историю взаимодействия с ФССП или спросить юридический совет.' }
]);
const userInput = ref('');
const messagesContainer = ref(null);

const sendMessage = () => {
  if (userInput.value.trim() === '') return;
  
  // Добавить сообщение пользователя
  chatMessages.value.push({
    sender: 'user',
    text: userInput.value
  });
  
  // Симуляция ответа ИИ (в реальной реализации здесь будет вызов API)
  setTimeout(() => {
    chatMessages.value.push({
      sender: 'ai',
      text: 'Это автоматический ответ от нейросети. В реальной реализации здесь будет анализ вашего запроса.'
    });
  }, 1000);
  
  userInput.value = '';
};

// Форматирование типа события
const getEventTypeLabel = (eventType) => {
  const labels = {
    'document_created': 'Добавление документа',
    'document_analyzed': 'Анализ документа',
    'complaint_created': 'Создание жалобы',
    'complaint_submitted': 'Отправка жалобы',
    'response_received': 'Получен ответ',
    'generic': 'Общее событие'
  };
  return labels[eventType] || eventType;
};

// Начать редактирование записи
const startEdit = (entry) => {
  editingEntryId.value = entry.id;
  editingEntryData.value = {
    date: entry.date,
    eventType: entry.eventType || 'generic',
    content: entry.content
  };
};

// Отменить редактирование
const cancelEdit = () => {
  editingEntryId.value = null;
  editingEntryData.value = {
    date: '',
    eventType: '',
    content: ''
  };
};

// Сохранить изменения записи
const saveEntry = async (entryId) => {
  try {
    const response = await axios.put(`http://localhost:3001/api/chronicle/${entryId}`, editingEntryData.value);
    
    if (response.data.success) {
      // Обновляем запись в локальном массиве
      const index = chronicleEntries.value.findIndex(entry => entry.id === entryId);
      if (index !== -1) {
        chronicleEntries.value[index] = {
          ...chronicleEntries.value[index],
          ...editingEntryData.value
        };
      }
      
      // Сбрасываем состояние редактирования
      cancelEdit();
    } else {
      alert('Ошибка при сохранении записи: ' + response.data.message);
    }
  } catch (error) {
    console.error('Ошибка при сохранении записи:', error);
    alert('Ошибка при сохранении записи: ' + error.message);
  }
};

// Удалить запись
const deleteEntry = async (entryId) => {
  if (!confirm('Вы уверены, что хотите удалить эту запись из летописи?')) {
    return;
  }
  
  try {
    const response = await axios.delete(`http://localhost:3001/api/chronicle/${entryId}`);
    
    if (response.data.success) {
      // Удаляем запись из локального массива
      chronicleEntries.value = chronicleEntries.value.filter(entry => entry.id !== entryId);
    } else {
      alert('Ошибка при удалении записи: ' + response.data.message);
    }
  } catch (error) {
    console.error('Ошибка при удалении записи:', error);
    alert('Ошибка при удалении записи: ' + error.message);
  }
};

// Форматирование даты события с пояснением
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0'); // Добавляем ведущий ноль
  const monthNames = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}г - дата описанного события`;
};

// Форматирование даты внесения записи в журнал
const formatEntryDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0'); // Добавляем ведущий ноль
  const monthNames = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}г - дата внесения записи в журнал`;
};

// Загрузка записей летописи
const loadChronicleEntries = async () => {
  try {
    const response = await axios.get('http://localhost:3001/api/chronicle');
    chronicleEntries.value = response.data.data;
  } catch (error) {
    console.error('Ошибка при загрузке летописи:', error);
    // Если не удалось загрузить с сервера, можно использовать временное решение
    chronicleEntries.value = [
      { id: '1', date: new Date().toISOString().split('T')[0], content: 'Здесь будет отображаться история взаимоотношений с судебными приставами...' }
    ];
  }
};

// Автоматическая прокрутка вниз чата
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Отслеживание новых сообщений и прокрутка вниз
import { watch } from 'vue';
watch(chatMessages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

const addInfo = () => {
  // Временно открываем страницу создания документа
  // В реальной реализации здесь будет диалог или переход к добавлению информации
  router.push('/create');
};

onMounted(() => {
  loadChronicleEntries();
});
</script>

<style scoped>
.chronicle-container {
  display: flex;
  flex-direction: column;
  max-height: 100vh;
  background-color: #f8f9fa;
  position: relative;
}

.page-region-display {
  position: absolute;
  top: -5px;
  right: 20px;
  z-index: 1;
  font-weight: bold;
  color: #007bff;
  font-size: 1.2rem;
}

.page-region-display .region-name {
  font-size: 1.1rem;
}

.main-content {
  display: flex;
  flex: 1;
  padding: 2rem 0;
  margin: 0 -1.875rem;
  gap: 2rem;
  overflow: hidden;
  min-height: 75vh;
}

.chronicle-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: -20px;
  min-height: 70vh;
}

.chronicle-info {
  padding: 0.5rem;
  background-color: #e9ecef;
  border-radius: 4px;
  font-style: italic;
  color: #6c757d;
  text-align: center;
}

textarea[readonly] {
  background-color: #f8f9fa;
}

.chronicle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
}

.add-info-btn, .refresh-btn {
  padding: 0.8rem 1.2rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s;
}

.add-info-btn:hover, .refresh-btn:hover {
  background-color: #218838;
}

.refresh-btn {
  background-color: #17a2b8;
}

.refresh-btn:hover {
  background-color: #138496;
}

.chronicle-textarea {
  width: 100%;
  height: 70vh;
  padding: 0.75rem; 
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  font-family: Arial, sans-serif;
  resize: none;
}

.chronicle-entries {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 70vh;
  max-height: 70vh;
  overflow-y: auto;
}

.chronicle-entry {
  padding: 0.75rem;
  background-color: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  word-wrap: break-word;
  white-space: pre-wrap;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.entry-date-input {
  padding: 0.25rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
}

.entry-type-select {
  padding: 0.25rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  background-color: white;
}

.entry-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  font-family: Arial, sans-serif;
  resize: vertical;
  margin-bottom: 0.5rem;
}

.entry-header-info {
  margin-bottom: 0.5rem;
}

.entry-date {
  font-weight: bold;
  color: #007bff;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.entry-date-label {
  font-weight: normal;
  color: #6c757d;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  font-style: italic;
}

.entry-type {
  display: inline-block;
  background-color: #e9ecef;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #495057;
  margin-top: 0.25rem;
}

.entry-text {
  color: #495057;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
  margin-bottom: 0.5rem;
}

.entry-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.edit-btn, .delete-btn, .save-btn, .cancel-btn {
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.3s;
}

.edit-btn {
  background-color: #007bff;
  color: white;
}

.edit-btn:hover {
  background-color: #0056b3;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
}

.delete-btn:hover {
  background-color: #c82333;
}

.save-btn {
  background-color: #28a745;
  color: white;
}

.save-btn:hover {
  background-color: #218838;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background-color: #5a6268;
}

.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-top: 5px;
  min-height: 70vh;
}

.chat-header {
  padding: 1rem;
  background-color: #007bff;
  color: white;
  text-align: center;
}

.chat-messages {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 60vh;
}

.message {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  max-width: 80%;
  word-wrap: break-word;
}

.message.user {
  align-self: flex-end;
  background-color: #007bff;
  color: white;
}

.message.ai {
  align-self: flex-start;
  background-color: #e9ecef;
  color: #333;
}

.chat-input {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  border-top: 1px solid #dee2e6;
  background-color: #f8f9fa;
  gap: 0.5rem;
}

.chat-input input {
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  width: 100%;
  font-size: 1.1rem;
}

.chat-input input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.chat-input button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  align-self: flex-end;
}

.chat-input button:hover {
  background-color: #0056b3;
}
</style>