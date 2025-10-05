import aiService from './services/aiService.js';

const bailiffTestCases = [
  {
    description: "Сокрытие доходов от алиментов",
    text: "Плательщик алиментов не указал доходы от сдачи квартиры в аренду",
    expected: { article: "ст. 115 СК РФ" }
  },
  {
    description: "Нарушение сроков уведомления",
    text: "Судебный пристав не направил постановление в течение 3 дней",
    expected: { article: "ст. 30 229-ФЗ" }
  }
];

async function runBailiffTests() {
  let passed = 0;
  
  for (const test of bailiffTestCases) {
    try {
      console.log(`\nТест: ${test.description}`);
      const result = await aiService.analyzeLegalText(test.text);
      
      const foundViolation = result.violations.some(v => 
        v.article.includes(test.expected.article)
      );
      
      if (foundViolation) {
        passed++;
        console.log(`✅ Найдено нарушение: ${test.expected.article}`);
      } else {
        console.warn(`❌ Не обнаружено: ${test.expected.article}`);
        console.log("Полный ответ:", result);
      }
    } catch (error) {
      console.error(`Ошибка в тесте "${test.description}":`, error.message);
    }
  }
  
  console.log(`\nРезультат: ${passed}/${bailiffTestCases.length} тестов пройдено`);
}

runBailiffTests();