import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api/chronicle';

// Тестирование всех эндпоинтов летописи
async function testChronicleAPI() {
  console.log('Тестирование эндпоинтов летописи...\n');
  
  try {
    // 1. Получение всех записей летописи
    console.log('1. Получение всех записей летописи...');
    let response = await axios.get(API_BASE_URL);
    console.log('✓ Успешно получено записей:', response.data.data?.length || 0);
    
    // 2. Создание новой записи летописи
    console.log('\n2. Создание новой записи летописи...');
    const newEntry = {
      date: new Date().toISOString().split('T')[0],
      eventType: 'test_event',
      title: 'Тестовая запись',
      content: 'Это тестовая запись для проверки API летописи'
    };
    
    response = await axios.post(API_BASE_URL, newEntry);
    const createdEntry = response.data.data;
    console.log('✓ Запись создана с ID:', createdEntry.id);
    
    // 3. Получение конкретной записи по ID
    console.log('\n3. Получение конкретной записи по ID...');
    response = await axios.get(`${API_BASE_URL}/${createdEntry.id}`);
    console.log('✓ Запись получена:', response.data.data.title);
    
    // 4. Обновление записи
    console.log('\n4. Обновление записи...');
    const updatedData = {
      ...createdEntry,
      content: 'Обновленное содержание тестовой записи'
    };
    
    response = await axios.put(`${API_BASE_URL}/${createdEntry.id}`, {
      content: 'Обновленное содержание тестовой записи',
      eventType: 'test_updated'
    });
    
    console.log('✓ Запись обновлена:', response.data.message);
    
    // 5. Повторная проверка обновленной записи
    console.log('\n5. Проверка обновленной записи...');
    response = await axios.get(`${API_BASE_URL}/${createdEntry.id}`);
    console.log('✓ Обновленное содержание:', response.data.data.content);
    
    // 6. Получение записей в хронологическом порядке
    console.log('\n6. Получение записей в хронологическом порядке...');
    response = await axios.get(`${API_BASE_URL}/chronological`);
    console.log('✓ Хронологические записи получены, количество:', response.data.data?.length || 0);
    
    // 7. Получение записей для конкретного типа события
    console.log('\n7. Получение записей для конкретного типа события...');
    response = await axios.get(`${API_BASE_URL}/type/test_updated`);
    console.log('✓ Записи по типу события получены, количество:', response.data.data?.length || 0);
    
    // 8. Получение статистики
    console.log('\n8. Получение статистики летописи...');
    response = await axios.get(`${API_BASE_URL}/stats`);
    console.log('✓ Статистика получена, всего записей:', response.data.data?.totalEntries || 0);
    
    // 9. Удаление созданной записи
    console.log('\n9. Удаление созданной записи...');
    response = await axios.delete(`${API_BASE_URL}/${createdEntry.id}`);
    console.log('✓ Запись удалена:', response.data.message);
    
    // 10. Проверка, что запись действительно удалена
    console.log('\n10. Проверка удаления...');
    try {
      await axios.get(`${API_BASE_URL}/${createdEntry.id}`);
      console.log('✗ Запись не была удалена');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✓ Запись успешно удалена (404 при попытке получения)');
      } else {
        console.log('✗ Ошибка при проверке удаления:', error.message);
      }
    }
    
    console.log('\n✓ Все тесты пройдены успешно!');
  } catch (error) {
    console.error('\n✗ Ошибка при тестировании:', error.response?.data || error.message);
  }
}

// Запуск тестов
testChronicleAPI();