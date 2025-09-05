<template>
  <div class="fssp-container">
    <div class="header">
      <h1>Отделения Федеральной службы Судебных Приставов</h1>
      <button 
        @click="startParsing" 
        :disabled="isParsing" 
        class="parse-button"
      >
        {{ isParsing ? 'Парсинг выполняется...' : 'Запустить парсинг данных' }}
      </button>
    </div>

    <div v-if="parsingResult" class="parsing-result">
      <h2>Результаты последнего парсинга</h2>
      <div v-if="parsingResult.success" class="success-message">
        <p>✅ {{ parsingResult.message }}</p>
        <div v-if="parsingResult.statistics" class="statistics">
          <p><strong>Статистика:</strong></p>
          <ul>
            <li>Регионов: {{ parsingResult.statistics.regions }}</li>
            <li>Городов: {{ parsingResult.statistics.cities }}</li>
            <li>Отделений: {{ parsingResult.statistics.departments }}</li>
          </ul>
        </div>
      </div>
      <div v-else class="error-message">
        <p>❌ {{ parsingResult.message }}</p>
      </div>
    </div>

    <div v-if="fsspData" class="data-container">
      <h2>Данные отделений ФССП</h2>
      <p class="last-update">Последнее обновление: {{ formatDate(fsspData.timestamp) }}</p>
      
      <div class="regions-list">
        <div 
          v-for="region in fsspData.regions" 
          :key="region.region" 
          class="region-card"
        >
          <h3 class="region-name">{{ region.region }}</h3>
          <div class="cities-list">
            <div 
              v-for="city in region.cities" 
              :key="city.name" 
              class="city-card"
            >
              <h4 class="city-name">{{ city.name }}</h4>
              <div class="departments-list">
                <div 
                  v-for="(dept, index) in city.departments" 
                  :key="index" 
                  class="department-card"
                >
                  <h5 class="department-name">{{ dept.name }}</h5>
                  <p class="department-address">📍 {{ dept.address }}</p>
                  <p class="department-phone">📞 {{ dept.phone }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-data">
      <p>Данные пока не загружены. Нажмите кнопку "Запустить парсинг данных" для получения информации.</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import axios from 'axios';

export default {
  name: 'FSSPDataView',
  setup() {
    const isParsing = ref(false);
    const fsspData = ref(null);
    const parsingResult = ref(null);

    // Загрузка данных при монтировании компонента
    const loadData = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/fssp/data');
        if (response.data.success) {
          fsspData.value = response.data.data;
        }
      } catch (error) {
        console.error('Ошибка загрузки данных ФССП:', error);
      }
    };

    // Запуск парсинга
    const startParsing = async () => {
      isParsing.value = true;
      parsingResult.value = null;
      
      try {
        const response = await axios.post('http://localhost:3001/api/fssp/parse');
        parsingResult.value = response.data;
        
        // После успешного парсинга перезагружаем данные
        if (response.data.success) {
          await loadData();
        }
      } catch (error) {
        parsingResult.value = {
          success: false,
          message: 'Ошибка при запуске парсинга: ' + (error.response?.data?.message || error.message)
        };
        console.error('Ошибка при запуске парсинга:', error);
      } finally {
        isParsing.value = false;
      }
    };

    // Форматирование даты
    const formatDate = (dateString) => {
      if (!dateString) return 'Неизвестно';
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU');
    };

    // Загрузка данных при монтировании
    onMounted(() => {
      loadData();
    });

    return {
      isParsing,
      fsspData,
      parsingResult,
      startParsing,
      formatDate
    };
  }
};
</script>

<style scoped>
.fssp-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
}

.header h1 {
  margin: 0;
  color: #333;
}

.parse-button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.parse-button:hover:not(:disabled) {
  background-color: #45a049;
}

.parse-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.parsing-result {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.success-message {
  color: #2e7d32;
}

.error-message {
  color: #c62828;
}

.statistics ul {
  margin: 10px 0;
  padding-left: 20px;
}

.data-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 20px;
}

.last-update {
  color: #666;
  font-style: italic;
  margin-bottom: 20px;
}

.regions-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.region-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background-color: #fafafa;
}

.region-name {
  margin: 0 0 15px 0;
  color: #333;
  border-bottom: 2px solid #4CAF50;
  padding-bottom: 10px;
}

.cities-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.city-card {
  background-color: white;
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 1px 5px rgba(0,0,0,0.05);
}

.city-name {
  margin: 0 0 10px 0;
  color: #555;
}

.departments-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
}

.department-card {
  background-color: #f5f5f5;
  border-radius: 6px;
  padding: 15px;
  border-left: 4px solid #4CAF50;
}

.department-name {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
}

.department-address,
.department-phone {
  margin: 5px 0;
  font-size: 14px;
  color: #666;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .parse-button {
    width: 100%;
  }
  
  .departments-list {
    grid-template-columns: 1fr;
  }
}
</style>