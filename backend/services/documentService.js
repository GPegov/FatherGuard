import AIService from './aiService.js';
import { AIConfig } from '../config/aiConfig.js';
import { buildLegalContext } from './legalRetriever.js';

// Создаем общий экземпляр AIService
const aiService = new AIService();

class DocumentService {
  constructor() {
    // Привязка методов
    this.analyzeText = this.analyzeText.bind(this);
    this.analyzeDocument = this.analyzeDocument.bind(this);

  }

  /**
   * Анализ произвольного текста
   * @param {string} text - Текст для анализа
   * @param {string} instructions - Дополнительные инструкции для анализа
   * @param {boolean} strictMode - Режим строгого анализа
   * @returns {Promise<Object>} Результат анализа
   */
  async analyzeText(text, instructions = "", strictMode = false, useCombinedPrompt = false) {
    try {
      console.log("=== НАЧАЛО ANALYZE TEXT ===");
      console.log('Анализ текста, длина текста:', text ? text.length : 0);
      console.log('Использовать комбинированный промпт:', useCombinedPrompt);
      
      // Проверка входных данных
      if (!text || typeof text !== 'string') {
        console.log('Предупреждение: текст не является строкой или отсутствует');
        return {
          success: true,
          data: {
            summary: "Текст не содержит данных для анализа",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: ""
          },
          timestamp: new Date().toISOString()
        };
      }
      
      // Удаляем пробельные символы по краям
      const trimmedText = text.trim();
      console.log('Текст после trim, длина:', trimmedText.length);
      
      if (trimmedText.length === 0) {
        console.log('Предупреждение: текст пуст после обрезки пробелов');
        return {
          success: true,
          data: {
            summary: "Текст не содержит данных для анализа",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: ""
          },
          timestamp: new Date().toISOString()
        };
      }

      console.log('Анализ текста (первые 100 символов):', trimmedText.substring(0, 100) + '...');
      
      // Проверяем доступность Ollama перед вызовом
      try {
        console.log('Проверка доступности Ollama API:', aiService.apiUrl);
        // Используем AbortController для установки таймаута
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(aiService.apiUrl.replace('/api/generate', '/api/tags'), { 
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('Ollama API доступна');
      } catch (ollamaError) {
        console.error('Ollama API недоступна:', olлamaError.message);
        console.error('Stack trace:', olлamaError.stack);
        return {
          success: true,
          data: {
            summary: "Сервис анализа временно недоступен. Пожалуйста, убедитесь, что Ollama запущена.",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: ""
          },
          timestamp: new Date().toISOString()
        };
      }
      
      // Получаем правовой контекст на основе текста
      const legalContext = await buildLegalContext(trimmedText, 5);

      const diaryStyleInstructions = `На основе всех представленных текстов (пояснений пользователя и вложений) создайте краткое содержание в дневниковом стиле.
...
Также используйте следующие нормативные акты для анализа нарушений:

${legalContext}

Если нарушение не подпадает под эти статьи — НЕ ВЫДУМЫВАЙ ССЫЛКИ.
`;

      let analysisResult;
      if (useCombinedPrompt) {
        // Используем комбинированный анализ для текста, содержащего пояснения и вложения
        console.log('Вызов aiService.analyzeCombinedText');
        analysisResult = await aiService.analyzeCombinedText(
          trimmedText,
          instructions + diaryStyleInstructions,
          strictMode
        );
      } else {
        // Используем обычный анализ для текста пояснений пользователя
        console.log('Вызов aiService.analyzeLegalText');
        analysisResult = await aiService.analyzeLegalText(
          trimmedText,
          instructions + diaryStyleInstructions,
          strictMode
        );
      }
      
      console.log('Результат анализа текста:', analysisResult);
      
      // Теперь анализ возвращает результат напрямую без обертки
      // Убедимся, что все поля присутствуют
      const cleanResult = {
        summary: analysisResult.summary || "Не удалось сгенерировать краткую суть",
        keySentences: Array.isArray(analysisResult.keySentences) ? analysisResult.keySentences : [],
        violations: Array.isArray(analysisResult.violations) ? analysisResult.violations : [],
        documentDate: analysisResult.documentDate || "",
        senderAgency: analysisResult.senderAgency || ""
      };
      
      console.log('Возвращаем результат анализа:', cleanResult);
      return {
        success: true,
        data: cleanResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Ошибка анализа текста:', error);
      console.error('Стек ошибки:', error.stack);
      return {
        success: true,
        data: {
          summary: "Ошибка анализа текста: " + error.message,
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: ""
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Комплексный анализ документа с вложениями
   * @param {Object} document - Объект документа
   * @param {string} instructions - Дополнительные инструкции для анализа
   * @param {boolean} strictMode - Режим строгого анализа
   * @returns {Promise<Object>} Результат анализа документа
   */
  async analyzeDocument(document, instructions = "", strictMode = false) {
    try {
      console.log("Начало analyzeDocument");
      console.log('Анализ документа, ID:', document.id);
      
      // Проверка входных данных
      if (!document || typeof document !== 'object') {
        console.log('Предупреждение: документ не является объектом или отсутствует');
        return {
          success: true,
          data: {
            summary: "Документ не содержит данных для анализа",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: ""
          },
          timestamp: new Date().toISOString()
        };
      }
      
      // Собираем весь текст для объединенного анализа
      let combinedText = `СПРАВКА ДЛЯ ИИ:
Вы — юрист, защищающий права отца-плательщика алиментов.
ВАША ЗАДАЧА:
1. Проанализировать ВСЕ представленные материалы.
2. Отличать субъективные пояснения пользователя от официальных документов.
3. Оценивать действия обеих сторон на соответствие законодательству РФ.
4. Выявлять нарушения со стороны госорганов, а также указывать, если пользователь сам нарушает закон.
5. Сформировать краткую суть, ключевые предложения, список нарушений и дневниковую запись.

ИНСТРУКЦИИ ПО ФОРМАТАМ:
- ПОЯСНЕНИЯ ПОЛЬЗОВАТЕЛЯ: субъективны, могут содержать эмоции, неточности, но отражают его восприятие ситуации.
- ОФИЦИАЛЬНЫЕ ДОКУМЕНТЫ: юридически значимы, но могут содержать ошибки, нарушения сроков, неправомерные действия.

ТЕКСТЫ ДЛЯ АНАЛИЗА:
`;

      let hasOriginalText = false;
      let hasAttachmentText = false;
      
      // Добавляем основной текст документа
      if (document.originalText && typeof document.originalText === 'string' && document.originalText.trim()) {
        combinedText += `
[НАЧАЛО ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ]
${document.originalText.trim()}
[КОНЕЦ ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ]
`;
        hasOriginalText = true;
      }
      
      // Добавляем тексты вложений
      if (Array.isArray(document.attachments) && document.attachments.length > 0) {
        for (const attachment of document.attachments) {
          if (attachment.text && typeof attachment.text === 'string' && attachment.text.trim()) {
            combinedText += `
[НАЧАЛО ОФИЦИАЛЬНОГО ДОКУМЕНТА: "${attachment.name || 'Без названия'}"]
${attachment.text.trim()}
[КОНЕЦ ОФИЦИАЛЬНОГО ДОКУМЕНТА]
`;
            hasAttachmentText = true;
          }
        }
      }
      
      // Если нет ни основного текста, ни вложений, возвращаем ошибку
      if (!combinedText.trim()) {
        console.log('Нет текста для анализа');
        return {
          success: true,
          data: {
            summary: "Документ не содержит текста для анализа",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: ""
          },
          timestamp: new Date().toISOString()
        };
      }
      
      // Теперь анализируем объединенный текст с указанием, что нужно генерировать краткую суть в дневниковом стиле
      console.log('Анализ объединенного текста, длина:', combinedText.length);
      console.log('Текст (первые 200 символов):', combinedText.substring(0, 200));
      
      // Получаем правовой контекст на основе объединенного текста
      const legalContext = await buildLegalContext(combinedText, 5);

      const diaryStyleInstructions = `На основе всех представленных текстов (пояснений пользователя и вложений) создайте краткое содержание в дневниковом стиле.
...
Также используйте следующие нормативные акты для анализа нарушений:

${legalContext}

Если нарушение не подпадает под эти статьи — НЕ ВЫДУМЫВАЙ ССЫЛКИ.
`;
      
      // Используем новый метод для комбинированного анализа
      console.log('Вызов aiService.analyzeCombinedText для объединенного анализа');
      const analysisResult = await aiService.analyzeCombinedText(
        combinedText,
        instructions + diaryStyleInstructions,
        strictMode
      );
      
      // Формируем результат в нужном формате
      const result = {
        success: true,
        data: analysisResult,
        timestamp: new Date().toISOString()
      };
      console.log('Результат объединенного анализа:', result);
      
      let combinedAnalysis = {
        summary: "Не удалось сгенерировать объединенную краткую суть",
        keySentences: [],
        violations: [],
        documentDate: "",
        senderAgency: ""
      };
      
      if (result.success) {
        combinedAnalysis = result.data;
      }
      
      // Комбинируем результаты - теперь у нас есть только объединённый анализ
      const combinedResult = {
        summary: combinedAnalysis.summary,
        keySentences: combinedAnalysis.keySentences,
        violations: combinedAnalysis.violations,
        documentDate: combinedAnalysis.documentDate || "",
        senderAgency: combinedAnalysis.senderAgency || "",
        attachments: [], // Убрали отдельный анализ вложений
        combinedText: combinedText  // Добавляем объединённый текст для отладки
      };
      
      console.log('Возвращаем результат анализа документа:', JSON.stringify(combinedResult, null, 2));
      return {
        success: true,
        data: combinedResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Ошибка анализа документа:', error);
      console.error('Стек ошибки:', error.stack);
      return {
        success: true,
        data: {
          summary: "Ошибка анализа документа: " + error.message,
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: ""
        },
        timestamp: new Date().toISOString()
      };
    }
  }

}

// Создаем экземпляр сервиса
const documentService = new DocumentService();

// Экспортируем методы
export const analyzeText = documentService.analyzeText.bind(documentService);
export const analyzeDocument = documentService.analyzeDocument.bind(documentService);


// Экспортируем класс для тестирования
export { DocumentService };

// Экспортируем экземпляр сервиса для прямого использования
export default documentService;

// Экспортируем общий экземпляр AIService для использования в других сервисах
export { aiService };