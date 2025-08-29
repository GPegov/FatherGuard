import AIService from './aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

class DocumentService {
  constructor() {
    // Привязка методов
    this.analyzeText = this.analyzeText.bind(this);
    this.analyzeDocument = this.analyzeDocument.bind(this);
    this.analyzeAttachment = this.analyzeAttachment.bind(this);
  }

  /**
   * Анализ произвольного текста
   * @param {string} text - Текст для анализа
   * @param {string} instructions - Дополнительные инструкции для анализа
   * @param {boolean} strictMode - Режим строгого анализа
   * @returns {Promise<Object>} Результат анализа
   */
  async analyzeText(text, instructions = "", strictMode = false) {
    try {
      console.log("=== НАЧАЛО ANALYZE TEXT ===");
      console.log('Анализ текста, длина текста:', text ? text.length : 0);
      
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
        console.log('Ollama API доступен');
      } catch (ollamaError) {
        console.error('Ollama API недоступен:', olлamaError.message);
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
      
      // Анализируем текст через AI-сервис
      console.log('Вызов aiService.analyzeLegalText');
      const analysisResult = await aiService.analyzeLegalText(
        trimmedText,
        instructions,
        strictMode
      );
      console.log('Результат анализа текста:', analysisResult);
      
      // Проверяем, есть ли у результата поле data (новый формат)
      if (analysisResult && analysisResult.data) {
        // Новый формат - возвращаем результат как есть
        return analysisResult;
      }
      
      // Старый формат - оборачиваем в новый формат
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
      
      // Анализ основного текста документа
      let mainAnalysis = {
        summary: "Документ не содержит текста для анализа",
        keySentences: [],
        violations: [],
        documentDate: "",
        senderAgency: ""
      };
      
      if (document.originalText && typeof document.originalText === 'string' && document.originalText.trim()) {
        console.log('Анализ основного текста документа, длина:', document.originalText.length);
        console.log('Текст (первые 200 символов):', document.originalText.substring(0, 200));
        const result = await this.analyzeText(document.originalText, instructions, strictMode);
        console.log('Результат анализа основного текста:', result);
        if (result.success) {
          mainAnalysis = result.data;
        }
      } else {
        console.log('Основной текст документа отсутствует или пуст');
      }
      
      // Анализ вложений
      const attachmentsAnalysis = [];
      if (Array.isArray(document.attachments) && document.attachments.length > 0) {
        console.log('Анализ вложений документа, количество:', document.attachments.length);
        
        for (const attachment of document.attachments) {
          if (attachment.text && typeof attachment.text === 'string' && attachment.text.trim()) {
            console.log('Анализ вложения:', attachment.id, 'длина текста:', attachment.text.length);
            console.log('Текст вложения (первые 200 символов):', attachment.text.substring(0, 200));
            const result = await this.analyzeAttachment(attachment.text, instructions);
            console.log('Результат анализа вложения:', result);
            // Проверяем, есть ли у результата поле data (новый формат)
            if (result && result.data) {
              attachmentsAnalysis.push({
                id: attachment.id,
                ...result.data
              });
            } else if (result && result.success && result.success.data) {
              // Альтернативный формат
              attachmentsAnalysis.push({
                id: attachment.id,
                ...result.success.data
              });
            } else {
              // Старый формат
              attachmentsAnalysis.push({
                id: attachment.id,
                ...result
              });
            }
          } else {
            console.log('Вложение', attachment.id, 'не содержит текста для анализа');
          }
        }
      } else {
        console.log('Вложения отсутствуют');
      }
      
      // Комбинируем результаты
      const combinedResult = {
        summary: mainAnalysis.summary,
        keySentences: mainAnalysis.keySentences,
        violations: mainAnalysis.violations,
        documentDate: mainAnalysis.documentDate || "",
        senderAgency: mainAnalysis.senderAgency || "",
        attachments: attachmentsAnalysis
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

  /**
   * Анализ вложения
   * @param {string} text - Текст вложения
   * @param {string} instructions - Дополнительные инструкции для анализа
   * @returns {Promise<Object>} Результат анализа вложения
   */
  async analyzeAttachment(text, instructions = "") {
    try {
      console.log("Начало analyzeAttachment");
      console.log('Анализ вложения, длина текста:', text ? text.length : 0);
      
      // Проверка входных данных
      if (!text || typeof text !== 'string') {
        console.log('Предупреждение: текст вложения не является строкой или отсутствует');
        return {
          success: true,
          data: {
            documentType: "Пустой документ",
            sentDate: "",
            senderAgency: "",
            summary: "Вложение не содержит текста для анализа",
            keySentences: []
          },
          timestamp: new Date().toISOString()
        };
      }
      
      // Удаляем пробельные символы по краям
      const trimmedText = text.trim();
      
      if (trimmedText.length === 0) {
        console.log('Предупреждение: текст вложения пуст после обрезки пробелов');
        return {
          success: true,
          data: {
            documentType: "Пустой документ",
            sentDate: "",
            senderAgency: "",
            summary: "Вложение не содержит текста для анализа",
            keySentences: []
          },
          timestamp: new Date().toISOString()
        };
      }

      console.log('Анализ вложения (первые 100 символов):', trimmedText.substring(0, 100) + '...');
      
      // Анализируем вложение через AI-сервис
      console.log('Вызов aiService.analyzeAttachment');
      const analysisResult = await aiService.analyzeAttachment(trimmedText, instructions);
      console.log('Результат анализа вложения:', analysisResult);

      // Проверяем формат результата
      let cleanResult;
      if (analysisResult && analysisResult.data) {
        // Новый формат
        cleanResult = {
          documentType: analysisResult.data.documentType || "Неизвестный тип",
          sentDate: analysisResult.data.sentDate || "",
          senderAgency: analysisResult.data.senderAgency || "",
          summary: analysisResult.data.summary || "Не удалось сгенерировать краткую суть",
          keySentences: Array.isArray(analysisResult.data.keySentences) ? analysisResult.data.keySentences : []
        };
      } else {
        // Старый формат
        cleanResult = {
          documentType: analysisResult.documentType || "Неизвестный тип",
          sentDate: analysisResult.sentDate || "",
          senderAgency: analysisResult.senderAgency || "",
          summary: analysisResult.summary || "Не удалось сгенерировать краткую суть",
          keySentences: Array.isArray(analysisResult.keySentences) ? analysisResult.keySentences : []
        };
      }
      
      console.log('Возвращаем результат анализа вложения:', cleanResult);
      return {
        success: true,
        data: cleanResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Ошибка анализа вложения:', error);
      return {
        success: true,
        data: {
          documentType: "Неизвестный тип",
          sentDate: "",
          senderAgency: "",
          summary: "Ошибка анализа вложения: " + error.message,
          keySentences: []
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
export const analyzeAttachment = documentService.analyzeAttachment.bind(documentService);

// Экспортируем класс для тестирования
export { DocumentService };

// Экспортируем экземпляр сервиса для прямого использования
export default documentService;