import axios from 'axios';

// Тестовый текст для анализа
const testText = `
Уведомление о взыскании задолженности
Федеральная служба судебных приставов по Омской области
Отдел судебных приставов по Московскому району г. Омска

Взыскатель: Иванов И.И.
Адрес: г. Омск, ул. Ленина, д. 10, кв. 5

Должник: Петров П.П.
Адрес: г. Омск, ул. Советская, д. 15, кв. 20

На основании исполнительного листа от 15.03.2024 года № 1234567890
о взыскании с Петрова П.П. в пользу Иванова И.И. задолженности 
в размере 50 000 рублей плюс 3% годовых и судебные расходы 5 000 рублей.

Взыскано: 55 000 рублей
Остаток долга: 0 рублей

Дата взыскания: 20.04.2024
Подпись: ___________
Печать: Федеральная служба судебных приставов
`;

// Дополнительные инструкции
const instructions = "Обрати особое внимание на дату взыскания и сумму. Проверь, соответствует ли она законодательству.";

// Строгий режим анализа
const strictMode = true;

// URL для тестирования
const url = 'http://localhost:3000/api/documents/analyze-text';

async function testAnalyzeText() {
  try {
    console.log('Отправка запроса на анализ текста...');
    
    const response = await axios.post(url, {
      text: testText,
      instructions: instructions,
      strictMode: strictMode
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Ответ от сервера:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Ошибка при тестировании:');
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    } else {
      console.error('Сообщение:', error.message);
    }
  }
}

// Запуск теста
testAnalyzeText();