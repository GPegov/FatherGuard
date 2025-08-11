import axios from 'axios';
import { readFile } from 'fs/promises';

class AIService {
  constructor() {
    this.localModelUrl = process.env.LOCAL_MODEL_URL || "http://localhost:11434";
    this.modelName = "llama3:8b";
    this.defaultOptions = {
      temperature: 0.3,
      max_tokens: 4000,
      repeat_penalty: 1.2,
      format: "json"
    };
    this.analysisCache = new Map();
    this.maxRetries = 2;
  }

  /**
   * Основной метод для запросов к AI
   */
  async queryLocalModel(prompt, customOptions = {}) {
    const options = {
      ...this.defaultOptions,
      ...customOptions,
      prompt: this.preparePrompt(prompt, customOptions.taskType)
    };

    let retries = 0;
    let lastError = null;

    while (retries <= this.maxRetries) {
      try {
        const response = await axios.post(
          `${this.localModelUrl}/api/generate`,
          {
            model: this.modelName,
            ...options
          },
          {
            timeout: 500000
          }
        );
        
        return this.parseModelResponse(response.data);
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${retries + 1} failed:`, error.message);
        
        if (retries < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
          retries++;
          continue;
        }
        
        throw this.normalizeError(error);
      }
    }
  }

  /**
   * Анализ юридического текста с улучшенной обработкой
   */
  async analyzeLegalText(text, instructions = "", strictMode = false) {
    const cacheKey = this.generateCacheKey(text, instructions);
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    const prompt = this.buildAnalysisPrompt(text, instructions, strictMode);
    const result = await this.queryLocalModel(prompt, {
      temperature: strictMode ? 0.1 : 0.3
    });

    if (!result.summary) {
      console.error("Invalid model response format:", result);
      throw new Error("Отсутствует поле summary в ответе модели");
    }

    const enhancedResult = this.enhanceAnalysisResult(result, text);
    this.analysisCache.set(cacheKey, enhancedResult);
    return enhancedResult;
  }

  /**
   * Генерация жалобы (версия 2)
   */
  async generateComplaintV2(documentText, agency, relatedDocuments = []) {
    const prompt = this.buildComplaintPromptV2(documentText, agency, relatedDocuments);
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.5,
      max_tokens: 7000
    });

    return {
      content: response.content || this.generateDefaultComplaint(documentText, agency),
      violations: response.identifiedViolations || [],
      analysis: response.legalAnalysis || "",
      relatedDocuments: response.relatedDocuments || []
    };
  }

  /**
   * Анализ вложенного документа
   */
  async analyzeAttachment(text) {
    const prompt = this.buildAttachmentPrompt(text);
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.2,
      format: "json"
    });

    return this.parseAttachmentAnalysis(response);
  }

  // ========== Вспомогательные методы ==========

  preparePrompt(text, taskType = "default") {
    const prompts = {
      summary: `[SYSTEM] Ты - юридический ассистент. Сгенерируй краткую суть документа:
1. Только факты
2. 3-5 предложений
3. Укажи ведомство и дату если есть
4. Без вводных фраз, сразу к сути дела
5. Повествование от имени клиента в первом лице
[TEXT]: ${text.substring(0, 8000)}
[SUMMARY]:`,

      violations: `[SYSTEM] Найди нарушения в тексте. Формат:
- Закон: [название]
- Статья: [номер]
- Описание: [текст]
- Доказательство: [цитата]
[TEXT]: ${text.substring(0, 7000)}
[VIOLATIONS]:`,

      attachment: `[SYSTEM] Проанализируй вложение. Верни JSON:
{
  "documentType": "тип",
  "sentDate": "дата",
  "senderAgency": "ведомство",
  "summary": "суть",
  "keyParagraphs": []
}
[TEXT]: ${text.substring(0, 7000)}
[ANALYSIS]:`,

      default: `[SYSTEM] Проанализируй текст как юридический документ
[TEXT]: ${text.substring(0, 7000)}
[RESULT]:`
    };

    return prompts[taskType] || prompts.default;
  }

  buildAnalysisPrompt(text, instructions, strictMode) {
    return JSON.stringify({
      task: "ANALYZE_LEGAL_DOCUMENT",
      text: text.substring(0, 10000),
      requirements: {
        summaryLength: "3-5 предложений",
        keyParagraphs: {
          count: 3,
          exactQuotes: true
        },
        extractDates: true,
        identifyAgencies: true,
        strictAnalysis: strictMode,
        additionalInstructions: instructions
      },
      lawsToCheck: [
        "Федеральный закон 'Об исполнительном производстве' №229-ФЗ",
        "Семейный кодекс РФ",
        "КоАП РФ",
        "ФЗ 'Об исполнительном производстве'"
      ]
    });
  }

  buildComplaintPromptV2(text, agency, relatedDocuments) {
    return JSON.stringify({
      task: "GENERATE_COMPLAINT_V2",
      agency,
      sourceText: text.substring(0, 5000),
      relatedDocuments: relatedDocuments.map(doc => doc.substring(0, 2000)),
      requirements: {
        style: "Официальный",
        sections: [
          "Шапка (кому/от кого)",
          "Описание ситуации",
          "Ссылки на документы",
          "Нарушения",
          "Требования",
          "Приложения"
        ],
        includeReferences: true,
        citeLaws: true
      }
    });
  }

  buildAttachmentPrompt(text) {
    return this.preparePrompt(text, "attachment");
  }

  enhanceAnalysisResult(result, text) {
    return {
      ...result,
      documentDate: this.extractDate(text) || result.documentDate || "",
      senderAgency: this.extractAgency(text) || result.senderAgency || "",
      keyParagraphs: result.keyParagraphs || []
    };
  }

  parseAttachmentAnalysis(response) {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      return {
        documentType: parsed.documentType || "Неизвестный тип",
        sentDate: parsed.sentDate || "",
        senderAgency: parsed.senderAgency || "",
        summary: parsed.summary || "Не удалось сгенерировать краткую суть",
        keyParagraphs: parsed.keyParagraphs || []
      };
    } catch (e) {
      console.error("Ошибка парсинга анализа вложения:", e);
      return {
        documentType: "Неизвестный тип",
        sentDate: "",
        senderAgency: "",
        summary: "Ошибка анализа вложения",
        keyParagraphs: []
      };
    }
  }

  parseModelResponse(data) {
    try {
      const rawResponse = data.response || data;
      
      if (typeof rawResponse === 'string') {
        // Пытаемся извлечь JSON из строки если есть
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return { response: rawResponse };
      }
      
      return rawResponse;
    } catch (e) {
      console.error("Ошибка парсинга ответа модели:", e);
      throw new Error("Неверный формат ответа от модели");
    }
  }

  normalizeError(error) {
    const serverError = error.response?.data?.error;
    if (serverError) {
      return new Error(`Ошибка модели: ${serverError}`);
    }
    return error;
  }

  generateCacheKey(text, instructions = "") {
    const str = text.substring(0, 200) + instructions;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  extractDate(text) {
    const dateRegex = /(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/;
    const match = text.match(dateRegex);
    return match ? match[0] : null;
  }

  extractAgency(text) {
    const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен", "МВД", "Росреестр"];
    return agencies.find(agency => text.includes(agency)) || null;
  }

  generateDefaultComplaint(text, agency) {
    return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${
      text.substring(0, 500)
    }\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
  }
}

export default new AIService();






// import axios from "axios";
// import { readFile } from "fs/promises";

// class AIService {
//   constructor() {
//     this.localModelUrl = process.env.LOCAL_MODEL_URL || "http://localhost:11434";
//     this.modelName = "llama3:8b";
//     this.defaultOptions = {
//       temperature: 0.3,
//       max_tokens: 3000,
//       repeat_penalty: 1.2,
//       format: "json"
//     };
//     this.analysisCache = new Map();
//   }

//   /**
//    * Основной метод для взаимодействия с локальной моделью
//    */
//   async queryLocalModel(prompt, customOptions = {}) {
//     const options = {
//       ...this.defaultOptions,
//       ...customOptions,
//       prompt: this.preparePrompt(prompt)
//     };

//     try {
//       const response = await axios.post(
//         `${this.localModelUrl}/api/generate`,
//         {
//           model: this.modelName,
//           ...options
//         },
//         {
//           timeout: 120000
//         }
//       );
      
//       return this.parseModelResponse(response.data);
//     } catch (error) {
//       console.error("Model query error:", {
//         error: error.response?.data || error.message,
//         config: error.config
//       });
//       throw this.normalizeError(error);
//     }
//   }

//   /**
//    * Улучшенный анализ юридического текста
//    */
//   async analyzeLegalText(text, instructions = "", strictMode = false) {
//     const cacheKey = this.generateCacheKey(text, instructions);
//     if (this.analysisCache.has(cacheKey)) {
//       return this.analysisCache.get(cacheKey);
//     }

//     const prompt = this.buildAnalysisPrompt(text, instructions, strictMode);
//     const result = await this.queryLocalModel(prompt, {
//       temperature: strictMode ? 0.1 : 0.3
      
//     });
//     if (!result.summary) {
//       console.error("Некорректный формат ответа от модели:", result);
//       throw new Error("Отсутствует поле summary в ответе модели");
// }
//     // Добавляем автоматическое извлечение даты и ведомства
//     const enhancedResult = {
//       ...result,
//       documentDate: this.extractDate(text) || "",
//       senderAgency: this.extractAgency(text) || ""
//     };

//     this.analysisCache.set(cacheKey, enhancedResult);
//     return enhancedResult;
//   }

//   /**
//    * Генерация жалобы с улучшенным промптом (версия 2)
//    */
//   async generateComplaintV2(documentText, agency, relatedDocuments = []) {
//     const prompt = this.buildComplaintPromptV2(documentText, agency, relatedDocuments);
//     const response = await this.queryLocalModel(prompt, {
//       temperature: 0.5,
//       max_tokens: 3000
//     });

//     return {
//       content: response.content || this.generateDefaultComplaint(documentText, agency),
//       violations: response.identifiedViolations || [],
//       analysis: response.legalAnalysis || ""
//     };
//   }

//   // Вспомогательные методы:

//   preparePrompt(text) {
//     return `Ты - юридический ассистент. Анализируй документы и создавай жалобы.
// Требования к ответу:
// 1. Всегда возвращай валидный JSON
// 2. Будь точным в цитатах
// 3. Ссылайся на конкретные законы
// 4. Извлекай даты и ведомства из текста

// ${text}`;
//   }

//   buildAnalysisPrompt(text, instructions, strictMode) {
//     return JSON.stringify({
//       task: "ANALYZE_LEGAL_DOCUMENT",
//       text: text.substring(0, 10000),
//       requirements: {
//         summaryLength: "3-5 предложений",
//         keyParagraphs: {
//           count: 3,
//           exactQuotes: true
//         },
//         extractDates: true,
//         identifyAgencies: true,
//         strictAnalysis: strictMode,
//         additionalInstructions: instructions
//       },
//       lawsToCheck: [
//         "Федеральный закон 'Об исполнительном производстве' №229-ФЗ",
//         "Семейный кодекс РФ",
//         "КоАП РФ",
//         "ФЗ 'О судебных приставах'"
//       ]
//     });
//   }

//   buildComplaintPromptV2(text, agency, relatedDocuments) {
//     return JSON.stringify({
//       task: "GENERATE_COMPLAINT_V2",
//       agency,
//       sourceText: text.substring(0, 5000),
//       relatedDocuments: relatedDocuments.map(doc => doc.substring(0, 2000)),
//       requirements: {
//         style: "Официальный",
//         sections: [
//           "Шапка (кому/от кого)",
//           "Описание ситуации",
//           "Ссылки на связанные документы",
//           "Нарушения",
//           "Требования",
//           "Приложения"
//         ],
//         includeReferences: true,
//         citeLaws: true
//       }
//     });
//   }

//   extractDate(text) {
//     // Простая логика извлечения даты (можно улучшить)
//     const dateRegex = /(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/;
//     const match = text.match(dateRegex);
//     return match ? match[0] : null;
//   }

//   extractAgency(text) {
//     // Базовое извлечение ведомств
//     const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен", "МВД", "Росреестр"];
//     return agencies.find(agency => text.includes(agency)) || null;
//   }

//   generateDefaultComplaint(text, agency) {
//     return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${
//       text.substring(0, 500)
//     }\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
//   }

//   parseModelResponse(data) {
//     try {
//       const rawResponse = data.response || data;
//       const parsed = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
      
//       if (parsed.error) {
//         throw new Error(parsed.error);
//       }
      
//       return parsed;
//     } catch (e) {
//       console.error("Response parsing error:", e);
//       throw new Error("Неверный формат ответа от модели");
//     }
//   }

//   normalizeError(error) {
//     const serverError = error.response?.data?.error;
//     if (serverError) {
//       return new Error(`Модель вернула ошибку: ${serverError}`);
//     }
//     return error;
//   }

//   generateCacheKey(text, instructions = "") {
//     const str = text.substring(0, 200) + instructions;
//     let hash = 0;
//     for (let i = 0; i < str.length; i++) {
//       hash = (hash << 5) - hash + str.charCodeAt(i);
//       hash |= 0;
//     }
//     return hash.toString(36);
//   }
// }

// export default new AIService();