import axios from 'axios';

async function findDataSources() {
  try {
    console.log('Поиск источников данных на странице ФССП по Свердловской области...');
    
    const url = 'https://r66.fssp.gov.ru/contacts';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    // Ищем в содержимом ссылки на возможные источники данных
    const dataPattern = /\/(api|json|data|ajax|xhr)/gi;
    const matches = response.data.match(dataPattern);
    
    if (matches) {
      console.log('Найдены возможные источники данных:');
      console.log(matches);
    } else {
      console.log('Явные источники данных не найдены');
    }
    
    // Ищем URL, которые могут содержать данные
    // Используем более простой подход для поиска URL
    const urls = [];
    const urlMatches = response.data.match(/https?:\/\/[^\s"'>]+/gi);
    
    if (urlMatches) {
      console.log(`\nНайдено ${urlMatches.length} URL в содержимом страницы`);
      // Фильтруем URL, которые могут содержать данные
      const dataUrls = urlMatches.filter(url => 
        url.includes('contacts') || 
        url.includes('department') || 
        url.includes('api') || 
        url.includes('json') ||
        url.includes('data')
      );
      
      if (dataUrls.length > 0) {
        console.log('Потенциальные источники данных:');
        dataUrls.slice(0, 10).forEach(url => console.log('  -', url));
      }
    }
    
    // Проверим, есть ли в коде упоминания XHR или fetch
    if (response.data.includes('XMLHttpRequest') || response.data.includes('fetch')) {
      console.log('\nНайдены упоминания XMLHttpRequest или fetch - данные загружаются динамически');
    }
    
  } catch (error) {
    console.error('Ошибка при поиске источников данных:', error.message);
  }
}

findDataSources();