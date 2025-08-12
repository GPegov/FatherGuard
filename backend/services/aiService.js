// import axios from 'axios';

// class AIService {
//   constructor() {
//     this.localModelUrl = process.env.LOCAL_MODEL_URL || "http://localhost:11434";
//     this.modelName = "llama3:8b";
//     this.defaultOptions = {
//       temperature: 0.3,
//       max_tokens: 4000,
//       repeat_penalty: 1.2,
//       format: "json"
//     };
//     this.analysisCache = new Map();
//     this.maxRetries = 2;
//   }

//   async queryLocalModel(prompt, customOptions = {}) {
//     const options = {
//       ...this.defaultOptions,
//       ...customOptions,
//       prompt: this.preparePrompt(prompt, customOptions.taskType)
//     };

//     let retries = 0;
//     let lastError = null;

//     while (retries <= this.maxRetries) {
//       try {
//         const response = await axios.post(
//           `${this.localModelUrl}/api/generate`,
//           {
//             model: this.modelName,
//             ...options
//           },
//           {
//             timeout: 500000
//           }
//         );

//         return this.parseModelResponse(response.data);
//       } catch (error) {
//         lastError = error;
//         if (retries < this.maxRetries) {
//           await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
//           retries++;
//           continue;
//         }
//         throw this.normalizeError(error);
//       }
//     }
//   }

//   async analyzeLegalText(text, instructions = "", strictMode = false) {
//     const cacheKey = this.generateCacheKey(text, instructions);
//     if (this.analysisCache.has(cacheKey)) {
//       return this.analysisCache.get(cacheKey);
//     }

//     const prompt = this.buildLegalAnalysisPrompt(text, instructions, strictMode);
//     const result = await this.queryLocalModel(prompt, {
//       temperature: strictMode ? 0.1 : 0.3
//     });

//     const validatedResult = this.validateLegalAnalysis(result, text);
//     this.analysisCache.set(cacheKey, validatedResult);
//     return validatedResult;
//   }

//   async generateComplaint(documentText, agency, relatedDocuments = [], instructions = "") {
//     const prompt = this.buildComplaintPrompt(documentText, agency, relatedDocuments, instructions);
//     const response = await this.queryLocalModel(prompt, {
//       temperature: 0.5,
//       max_tokens: 7000
//     });

//     return this.validateComplaintResponse(response, documentText, agency);
//   }

//   async analyzeAttachment(text) {
//     const prompt = this.buildAttachmentPrompt(text);
//     const response = await this.queryLocalModel(prompt, {
//       temperature: 0.2
//     });

//     return this.validateAttachmentAnalysis(response);
//   }

//   // ========== Вспомогательные методы ==========

//   buildLegalAnalysisPrompt(text, instructions, strictMode) {
//     return `Ты - юридический ассистент. Проанализируй документ и верни JSON:
// {
//   "summary": "Краткая суть (3-5 предложений)",
//   "keyParagraphs": ["Дословные цитаты"],
//   "documentDate": "ДД.ММ.ГГГГ",
//   "senderAgency": "Ведомство",
//   "violations": [{
//     "law": "Название закона",
//     "article": "Статья",
//     "description": "Описание нарушения",
//     "evidence": "Дословная цитата"
//   }]
// }

// Требования:
// 1. Сохраняй оригинальную орфографию
// 2. Для дат используй формат ДД.ММ.ГГГГ
// 3. Указывай полные названия ведомств
// 4. ${strictMode ? "Выявляй все возможные нарушения" : "Выявляй явные нарушения"}

// ${instructions ? `Дополнительные инструкции: ${instructions}` : ''}

// Текст документа:
// ${text.substring(0, 10000)}`;
//   }

//   buildComplaintPrompt(documentText, agency, relatedDocuments, instructions) {
//     return `Сгенерируй официальную жалобу в ${agency} на основании документа:

// Требования к жалобе:
// 1. Официальный стиль
// 2. Четкая структура:
//    - Шапка (кому/от кого)
//    - Изложение фактов
//    - Ссылки на нарушения
//    - Требования
//    - Приложения
// 3. Используй дословные цитаты из документа
// 4. Ссылайся на законы

// ${instructions ? `Дополнительные инструкции: ${instructions}` : ''}

// Текст документа:
// ${documentText.substring(0, 5000)}

// ${relatedDocuments.length ? `Связанные документы:
// ${relatedDocuments.map(doc => `- ${doc.substring(0, 1000)}`).join('\n')}` : ''}`;
//   }

//   buildAttachmentPrompt(text) {
//     return `Проанализируй вложение и верни JSON:
// {
//   "documentType": "Тип документа",
//   "sentDate": "ДД.ММ.ГГГГ",
//   "senderAgency": "Ведомство",
//   "summary": "Краткая суть",
//   "keyParagraphs": ["Дословные цитаты"]
// }

// Текст вложения:
// ${text.substring(0, 7000)}`;
//   }

//   validateLegalAnalysis(result, originalText) {
//     const defaultResult = {
//       summary: "",
//       keyParagraphs: [],
//       documentDate: this.extractDate(originalText) || "",
//       senderAgency: this.extractAgency(originalText) || "",
//       violations: []
//     };

//     if (!result || typeof result !== 'object') return defaultResult;

//     return {
//       summary: result.summary || defaultResult.summary,
//       keyParagraphs: Array.isArray(result.keyParagraphs)
//         ? result.keyParagraphs.filter(p => p && typeof p === 'string')
//         : defaultResult.keyParagraphs,
//       documentDate: result.documentDate || defaultResult.documentDate,
//       senderAgency: result.senderAgency || defaultResult.senderAgency,
//       violations: Array.isArray(result.violations)
//         ? result.violations.filter(v => v.law && v.article && v.evidence)
//         : defaultResult.violations
//     };
//   }

//   validateComplaintResponse(response, documentText, agency) {
//     if (!response || typeof response !== 'object') {
//       return {
//         content: this.generateDefaultComplaint(documentText, agency),
//         violations: [],
//         status: 'draft'
//       };
//     }

//     return {
//       content: response.content || this.generateDefaultComplaint(documentText, agency),
//       violations: Array.isArray(response.violations)
//         ? response.violations
//         : [],
//       status: 'draft'
//     };
//   }

//   validateAttachmentAnalysis(response) {
//     const defaultResult = {
//       documentType: "Неизвестный тип",
//       sentDate: "",
//       senderAgency: "",
//       summary: "",
//       keyParagraphs: []
//     };

//     if (!response || typeof response !== 'object') return defaultResult;

//     return {
//       documentType: response.documentType || defaultResult.documentType,
//       sentDate: response.sentDate || defaultResult.sentDate,
//       senderAgency: response.senderAgency || defaultResult.senderAgency,
//       summary: response.summary || defaultResult.summary,
//       keyParagraphs: Array.isArray(response.keyParagraphs)
//         ? response.keyParagraphs
//         : defaultResult.keyParagraphs
//     };
//   }

//   generateDefaultComplaint(text, agency) {
//     return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${
//       text.substring(0, 500)
//     }\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString('ru-RU')}`;
//   }

//   extractDate(text) {
//     const dateRegex = /(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/;
//     const match = text.match(dateRegex);
//     return match ? match[0] : null;
//   }

//   extractAgency(text) {
//     const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен"];
//     return agencies.find(agency => text.includes(agency)) || null;
//   }

//   parseModelResponse(data) {
//     try {
//       if (typeof data === 'string') {
//         const jsonMatch = data.match(/\{[\s\S]*\}/);
//         return jsonMatch ? JSON.parse(jsonMatch[0]) : { response: data };
//       }
//       return data.response || data;
//     } catch (e) {
//       console.error("Ошибка парсинга ответа модели:", e);
//       return null;
//     }
//   }

//   normalizeError(error) {
//     return error.response?.data?.error
//       ? new Error(`Ошибка модели: ${error.response.data.error}`)
//       : error;
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

import axios from "axios";
import useAIStore from '@/stores/aiStore'
import pinia from 'pinia'

app.use(pinia)

class AIService {
  constructor() {
    this.aiStore = useAIStore();
    this.localModelUrl = import.meta.env.VITE_LOCAL_MODEL_URL;
    this.defaultOptions = {
      temperature: 0.3,
      max_tokens: 6000,
      repeat_penalty: 1.2,
      format: "json",
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
      prompt: this.preparePrompt(prompt, customOptions.taskType),
    };

    let retries = 0;
    let lastError = null;

    while (retries <= this.maxRetries) {
      try {
        const response = await axios.post(
          this.aiStore.apiUrl,
          {
            model: this.aiStore.activeModel, // Используем активную модель из хранилища
            prompt,
            stream: false,
            format: "json",
            ...options,
          },
          {
            timeout: 500000,
          }
        );

        return this.parseModelResponse(response.data);
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${retries + 1} failed:`, error.message);

        if (retries < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (retries + 1))
          );
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
      temperature: strictMode ? 0.1 : 0.3,
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
    const prompt = this.buildComplaintPromptV2(
      documentText,
      agency,
      relatedDocuments
    );
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.5,
      max_tokens: 7000,
    });

    return {
      content:
        response.content || this.generateDefaultComplaint(documentText, agency),
      violations: response.identifiedViolations || [],
      analysis: response.legalAnalysis || "",
      relatedDocuments: response.relatedDocuments || [],
    };
  }

  /**
   * Анализ вложенного документа
   */
  async analyzeAttachment(text) {
    const prompt = this.buildAttachmentPrompt(text);
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.2,
      format: "json",
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
[RESULT]:`,
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
          exactQuotes: true,
        },
        extractDates: true,
        identifyAgencies: true,
        strictAnalysis: strictMode,
        additionalInstructions: instructions,
      },
      lawsToCheck: [
        "Федеральный закон 'Об исполнительном производстве' №229-ФЗ",
        "Семейный кодекс РФ",
        "КоАП РФ",
      ],
    });
  }

  buildComplaintPromptV2(text, agency, relatedDocuments) {
    return JSON.stringify({
      task: "GENERATE_COMPLAINT_V2",
      agency,
      sourceText: text.substring(0, 5000),
      relatedDocuments: relatedDocuments.map((doc) => doc.substring(0, 2000)),
      requirements: {
        style: "Официальный",
        sections: [
          "Шапка (кому/от кого)",
          "Описание ситуации",
          "Ссылки на документы",
          "Нарушения",
          "Требования",
          "Приложения",
        ],
        includeReferences: true,
        citeLaws: true,
      },
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
      keyParagraphs: result.keyParagraphs || [],
    };
  }

  parseAttachmentAnalysis(response) {
    try {
      const parsed =
        typeof response === "string" ? JSON.parse(response) : response;
      return {
        documentType: parsed.documentType || "Неизвестный тип",
        sentDate: parsed.sentDate || "",
        senderAgency: parsed.senderAgency || "",
        summary: parsed.summary || "Не удалось сгенерировать краткую суть",
        keyParagraphs: parsed.keyParagraphs || [],
      };
    } catch (e) {
      console.error("Ошибка парсинга анализа вложения:", e);
      return {
        documentType: "Неизвестный тип",
        sentDate: "",
        senderAgency: "",
        summary: "Ошибка анализа вложения",
        keyParagraphs: [],
      };
    }
  }

  parseModelResponse(data) {
    try {
      const rawResponse = data.response || data;

      if (typeof rawResponse === "string") {
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
    const agencies = [
      "ФССП",
      "Прокуратура",
      "Суд",
      "Омбудсмен",
      "МВД",
      "Росреестр",
    ];
    return agencies.find((agency) => text.includes(agency)) || null;
  }

  generateDefaultComplaint(text, agency) {
    return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${text.substring(
      0,
      500
    )}\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
  }
}

export default new AIService();
