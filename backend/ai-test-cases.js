import aiService from './services/aiService.js';

const testCases = [
  {
    input: "Арендодатель запрещает держать кошек в квартире",
    expected: { violations: [{ article: expect.any(String) }] }
  },
  {
    input: "Договор запрещает возврат товара в течение 14 дней",
    expected: { violations: [{ article: "ст. 25 ЗПП" }] }
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