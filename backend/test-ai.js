import aiService from './services/aiService.js';

async function test() {
  try {
    console.log("Testing AI connection...");
    const result = await aiService.analyzeLegalText(
      "Арендодатель запрещает держать животных в квартире"
    );
    console.log("✅ Success:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  } finally {
    process.exit();
  }
}

test();