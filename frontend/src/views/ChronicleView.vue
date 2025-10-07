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
          <button class="add-info-btn" @click="addInfo">
            Добавить сведения
          </button>
        </div>
        
        <textarea 
          :value="chronicleContent" 
          class="chronicle-textarea"
          readonly
          placeholder="Здесь будет отображаться история взаимоотношений с судебными приставами..."
        ></textarea>
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

const router = useRouter();
const documentStore = useDocumentStore();

// Содержимое летописи
const chronicleContent = ref('');

// Функциональность чата
const chatMessages = ref([
  { sender: 'ai', text: 'Здесь можно внести уточнения в историю взаимодействия с ФССП или спросить юрдический совет.' }
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
  // Содержимое летописи будет заполняться локальной моделью ИИ
  chronicleContent.value = '';
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
  padding: 2rem 1.25rem; /* Уменьшаем горизонтальный отступ до 20px (1.25rem) */
  gap: 2rem;
  overflow: hidden;
}

.chronicle-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: -20px;
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

.add-info-btn {
  padding: 0.8rem 1.2rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s;
}

.add-info-btn:hover {
  background-color: #218838;
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

.chronicle-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
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
  padding: 0.75rem;  /* Уменьшаем отступы на 0.25rem (4px) */
  border-top: 1px solid #dee2e6;
  background-color: #f8f9fa;
}

.chat-input input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  margin-right: 0.5rem;
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
}

.chat-input button:hover {
  background-color: #0056b3;
}


</style>