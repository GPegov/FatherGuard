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
        await fetch(aiService.apiUrl.replace('/api/generate', '/api/tags'), { 
          method: 'GET',
          timeout: 5000
        });
        console.log('Ollama API доступен');
      } catch (ollamaError) {
        console.error('Ollama API недоступен:', ollamaError.message);
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
        console.log('Анализ основного текста документа');
        const result = await this.analyzeText(document.originalText, instructions, strictMode);
        if (result.success) {
          mainAnalysis = result.data;
        }
      }
      
      // Анализ вложений
      const attachmentsAnalysis = [];
      if (Array.isArray(document.attachments) && document.attachments.length > 0) {
        console.log('Анализ вложений документа, количество:', document.attachments.length);
        
        for (const attachment of document.attachments) {
          if (attachment.text && typeof attachment.text === 'string' && attachment.text.trim()) {
            console.log('Анализ вложения:', attachment.id);
            const result = await this.analyzeAttachment(attachment.text, instructions);
            if (result.success) {
              attachmentsAnalysis.push({
                id: attachment.id,
                ...result.data
              });
            }
          }
        }
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
      
      console.log('Возвращаем результат анализа документа:', combinedResult);
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

      // Убедимся, что все поля присутствуют
      const cleanResult = {
        documentType: analysisResult.documentType || "Неизвестный тип",
        sentDate: analysisResult.sentDate || "",
        senderAgency: analysisResult.senderAgency || "",
        summary: analysisResult.summary || "Не удалось сгенерировать краткую суть",
        keySentences: Array.isArray(analysisResult.keySentences) ? analysisResult.keySentences : []
      };
      
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