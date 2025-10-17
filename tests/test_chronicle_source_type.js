import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import AIService from '../backend/services/aiService.js';
import PromptService from '../backend/services/promptService.js';
import ChronicleService from '../backend/services/chronicleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=== Тестирование функциональности sourceType в летописи ===");

async function testChroniclePromptsWithSourceType() {
  console.log("\n1. Тестируем генерацию промптов с разными типами источника...");
  
  // Подготовим тестовые данные
  const documentData = {
    summary: "Пользователь подал документ на рассмотрение",
    content: "Документ содержит важную информацию",
    eventDate: "2025-10-13",
    senderAgency: "ФССП",
    combinedText: "СПРАВКА: Ниже представлены пояснения пользователя и вложенные официальные документы. Объедините всю информацию в аналитическую запись летописи.\n\nПОЯСНЕНИЯ ПОЛЬЗОВАТЕЛЯ (субъективное описание проблемы):\nТекст пояснений пользователя\n\nВЛОЖЕНИЕ \"test.pdf\" (официальный документ):\nТекст официального документа"
  };

  // Тестируем генерацию промптов для разных типов источника
  const userExplanationPrompt = PromptService.getChroniclePrompt(
    documentData,
    'document_created',
    [],
    'user_explanation'
  );
  
  const officialDocumentPrompt = PromptService.getChroniclePrompt(
    documentData,
    'document_created', 
    [],
    'official_document'
  );
  
  console.log("\n--- Промпт для пояснений пользователя ---");
  console.log("Содержит 'пользователь добавил описание ситуации'?", userExplanationPrompt.includes('пользователь добавил описание ситуации'));
  console.log("Содержит 'пользователь добавил официальный документ'?", userExplanationPrompt.includes('пользователь добавил официальный документ'));
  
  console.log("\n--- Промпт для официального документа ---");
  console.log("Содержит 'пользователь добавил официальный документ'?", officialDocumentPrompt.includes('пользователь добавил официальный документ'));
  console.log("Содержит 'пользователь добавил описание ситуации'?", officialDocumentPrompt.includes('пользователь добавил описание ситуации'));
  
  // Проверим, что промпты отличаются
  const promptsAreDifferent = userExplanationPrompt !== officialDocumentPrompt;
  const hasCorrectContent = 
    userExplanationPrompt.includes('пользователь добавил описание ситуации') && 
    !userExplanationPrompt.includes('пользователь добавил официальный документ') &&
    officialDocumentPrompt.includes('пользователь добавил официальный документ') && 
    !officialDocumentPrompt.includes('пользователь добавил описание ситуации');
  
  console.log("\nПромпты для разных sourceType различаются:", promptsAreDifferent);
  console.log("Содержат корректные варианты текста:", hasCorrectContent);
  
  if (promptsAreDifferent && hasCorrectContent) {
    console.log("✓ Тест пройден: промпты различаются в зависимости от sourceType");
  } else {
    console.log("✗ Тест не пройден: промпты не различаются или содержат некорректный текст");
  }
  
  return promptsAreDifferent;
}

async function testChronicleService() {
  console.log("\n2. Тестируем ChronicleService...");
  
  // Создаем временный файл для тестирования
  const testChroniclePath = path.join(__dirname, 'test_chronicle.json');
  
  try {
    // Создаем ChronicleService с временным файлом
    const chronicleService = new ChronicleService(testChroniclePath);
    
    // Тестируем определение типа источника
    const docWithAttachments = {
      originalText: "Пояснения пользователя",
      attachments: [{ text: "Текст официального документа" }]
    };
    
    const docWithoutAttachments = {
      originalText: "Пояснения пользователя",
      attachments: []
    };
    
    const sourceTypeWithAttachments = chronicleService.determineSourceType(docWithAttachments);
    const sourceTypeWithoutAttachments = chronicleService.determineSourceType(docWithoutAttachments);
    
    console.log("Тип источника для документа с вложениями:", sourceTypeWithAttachments);
    console.log("Тип источника для документа без вложений:", sourceTypeWithoutAttachments);
    
    const correctSourceTypeDetection = 
      sourceTypeWithAttachments === 'official_document' && 
      sourceTypeWithoutAttachments === 'user_explanation';
    
    console.log("✓ Тест определения типа источника:", correctSourceTypeDetection);
    
    // Удаляем временный файл
    try {
      await fs.unlink(testChroniclePath);
    } catch (e) {
      // Игнорируем ошибку, если файл не существует
    }
    
    return correctSourceTypeDetection;
    
  } catch (error) {
    console.error("Ошибка при тестировании ChronicleService:", error);
    return false;
  }
}

async function runTests() {
  console.log("Запуск тестов...");
  
  const test1Result = await testChroniclePromptsWithSourceType();
  const test2Result = await testChronicleService();
  
  const allTestsPassed = test1Result && test2Result;
  
  console.log("\n=== Результаты тестов ===");
  console.log("Тест 1 (генерация промптов с sourceType):", test1Result ? "ПРОЙДЕН" : "НЕ ПРОЙДЕН");
  console.log("Тест 2 (определение типа источника):", test2Result ? "ПРОЙДЕН" : "НЕ ПРОЙДЕН");
  console.log("Все тесты пройдены:", allTestsPassed ? "ДА" : "НЕТ");
  
  return allTestsPassed;
}

// Запускаем тесты
runTests()
  .then(success => {
    if (success) {
      console.log("\n✓ Все тесты пройдены успешно! Изменения в системе обработки sourceType работают корректно.");
    } else {
      console.log("\n✗ Некоторые тесты не пройдены. Проверьте реализацию.");
    }
  })
  .catch(error => {
    console.error("\nОшибка при выполнении тестов:", error);
  });