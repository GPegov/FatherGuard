import axios from "axios";
import { readFile } from "fs/promises";

class AIService {
  constructor() {
    // Настройки для локальной модели
    this.localModelUrl = process.env.LOCAL_MODEL_URL || "http://localhost:11434";
    this.modelName = "deepseek-r1:14b";
    this.defaultOptions = {
      temperature: 0.3,
      max_tokens: 2000,
      repeat_penalty: 1.2,
      format: "json" // Запрашиваем ответ в JSON формате
    };
    
    // Кеш для результатов анализа
    this.analysisCache = new Map();
  }

  /**
   * Основной метод для взаимодействия с локальной моделью
   */
  async queryLocalModel(prompt, customOptions = {}) {
    const options = {
      ...this.defaultOptions,
      ...customOptions,
      prompt: this.preparePrompt(prompt)
    };

    try {
      const response = await axios.post(
        `${this.localModelUrl}/api/generate`,
        {
          model: this.modelName,
          ...options
        },
        {
          timeout: 120000 // 2 минуты на обработку
        }
      );
      
      return this.parseModelResponse(response.data);
    } catch (error) {
      console.error("Model query error:", {
        error: error.response?.data || error.message,
        config: error.config
      });
      throw this.normalizeError(error);
    }
  }

  /**
   * Улучшенный анализ юридического текста
   */
  async analyzeLegalText(text, instructions = "", strictMode = false) {
    const cacheKey = this.generateCacheKey(text, instructions);
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    const prompt = this.buildAnalysisPrompt(text, instructions, strictMode);
    const result = await this.queryLocalModel(prompt, {
      temperature: strictMode ? 0.1 : 0.3 // Более строгие ответы в strictMode
    });

    this.analysisCache.set(cacheKey, result);
    return result;
  }

  /**
   * Генерация жалобы с улучшенным промптом
   */
  async generateComplaint(documentText, agency, violations = []) {
    const prompt = this.buildComplaintPrompt(documentText, agency, violations);
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.5, // Больше креативности для генерации текста
      max_tokens: 3000
    });

    return {
      content: response.content,
      violations: response.identifiedViolations || []
    };
  }

  // Вспомогательные методы:

  preparePrompt(text) {
    return `Ты - юридический ассистент. Анализируй документы и создавай жалобы.
Требования к ответу:
1. Всегда возвращай валидный JSON
2. Будь точным в цитатах
3. Ссылайся на конкретные законы

${text}`;
  }

  buildAnalysisPrompt(text, instructions, strictMode) {
    return JSON.stringify({
      task: "ANALYZE_LEGAL_DOCUMENT",
      text: text.substring(0, 10000), // Ограничение длины
      requirements: {
        summaryLength: "3-5 предложений",
        keyParagraphs: {
          count: 3,
          exactQuotes: true
        },
        strictAnalysis: strictMode,
        additionalInstructions: instructions
      },
      lawsToCheck: [
        "Федеральный закон 'Об исполнительном производстве' №229-ФЗ",
        "Семейный кодекс РФ",
        "КоАП РФ"
      ]
    });
  }

  buildComplaintPrompt(text, agency, violations) {
    return JSON.stringify({
      task: "GENERATE_COMPLAINT",
      agency,
      violations,
      sourceText: text.substring(0, 5000),
      requirements: {
        style: "Официальный",
        sections: [
          "Шапка (кому/от кого)",
          "Описание ситуации",
          "Нарушения",
          "Требования",
          "Приложения"
        ]
      }
    });
  }

  parseModelResponse(data) {
    try {
      // Обработка stream и non-stream ответов
      const rawResponse = data.response || data;
      const parsed = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
      
      // Валидация структуры ответа
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      
      return parsed;
    } catch (e) {
      console.error("Response parsing error:", e);
      throw new Error("Неверный формат ответа от модели");
    }
  }

  normalizeError(error) {
    const serverError = error.response?.data?.error;
    if (serverError) {
      return new Error(`Модель вернула ошибку: ${serverError}`);
    }
    return error;
  }

  generateCacheKey(text, instructions = "") {
    // Упрощенная хеш-функция для кеширования
    const str = text.substring(0, 200) + instructions;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }
}





export default new AIService();