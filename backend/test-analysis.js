import AIService from './services/aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

// Тестовый текст
const testText = `Уважаемые сотрудники Заводского РОСП г. Саратова. 
Из ответа Прокуратуры Заводского района г. Саратова мне стало известно о том, что мой долг по ИП 6225/22/64041-ИП от 11.03.2019, по непонятным причинам, вырос в 2 раза, со 178 323.42 руб. до 331 776 руб.`;

async function testAnalysis() {
  try {
    console.log('Начало теста анализа документа');
    console.log('Текст для анализа:', testText.substring(0, 100) + '...');
    
    const result = await aiService.analyzeLegalText(testText);
    console.log('Результат анализа:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Ошибка при анализе:', error);
    console.error('Стек ошибки:', error.stack);
  }
}

testAnalysis();