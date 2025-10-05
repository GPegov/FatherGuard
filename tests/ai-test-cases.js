import AIService from './services/aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

const testCases = [
  {
    input: "Арендодатель запрещает держать кошек в квартире"
    // Убираем expected, так как мы не используем Jest
  },
  {
    input: "Договор запрещает возврат товара в течение 14 дней"
    // Убираем expected, так как мы не используем Jest
  }
];

async function runTests() {
  for (const test of testCases) {
    try {
      console.log(`\nTesting: "${test.input.substring(0, 30)}..."`);
      const result = await aiService.analyzeLegalText(test.input);
      
      console.log("Result:", {
        violations: result.violations.map(v => v.article),
        summary: result.summary
      });

      if (!result.violations.length) {
        console.warn("⚠️ No violations detected for:", test.input);
      }
    } catch (error) {
      console.error(`❌ Failed on: "${test.input}"`, error.message);
    }
  }
}

runTests();