
import axios from "axios";

export class AIService {
  constructor() {
    this.baseUrl = "http://localhost:11434/api/generate";
    this.model = "deepseek-r1:14b";
  }

  /**
   * Базовый метод для строковых запросов
   */
  async queryModelString(prompt, options = {}) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.model,
          prompt: prompt,
          format: "text", // Запрашиваем текстовый ответ
          stream: false,
          options: {
            temperature: options.temperature || 0.3,
            max_tokens: options.max_tokens || 4096,
          },
        },
        {
          timeout: 500000,
          headers: { "Content-Type": "application/json" },
        }
      );

      // Возвращаем чистый текст ответа
      return response.data?.response || response.data;
    } catch (error) {
      console.error("Ошибка запроса к модели:", error);
      throw error;
    }
  }

  /**
   * Генерация краткой сути (этап 1)
   */
  async generateSummary(text) {
    const prompt = `Сгенерируй краткую суть (3-5 предложений) следующего текста:\n\n${text.substring(
      0,
      5000
    )}\n\nКраткая суть:`;
    const summary = await this.queryModelString(prompt, { temperature: 0.2 });
    return summary.trim();
  }

  /**
   * Выделение ключевых параграфов (этап 2)
   */
  async extractKeyParagraphs(text) {
    const prompt = `Выдели 3-5 самых важных дословных цитат из текста (сохрани оригинальную формулировку):\n\n${text.substring(
      0,
      5000
    )}\n\nЦитаты (в формате JSON-массива): ["цитата1", "цитата2"]`;
    const paragraphsStr = await this.queryModelString(prompt, {
      temperature: 0.1,
    });

    try {
      // Пытаемся извлечь JSON из ответа
      const jsonMatch = paragraphsStr.match(/\[.*\]/s);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [paragraphsStr];
    } catch (e) {
      console.warn("Не удалось распарсить цитаты, возвращаем текст как есть");
      return [paragraphsStr];
    }
  }
  async detectViolations(text) {
    const prompt = `Проанализируй текст на нарушения законодательства. Верни JSON-массив:
[
  {
    "law": "Название закона",
    "article": "Статья",
    "description": "Описание нарушения"
  }
]

Текст: ${text.substring(0, 5000)}`;

    const violationsStr = await this.queryModelString(prompt);
    try {
      return JSON.parse(violationsStr.match(/\[.*\]/s)[0]);
    } catch {
      return [];
    }
  }
  /**
   * 
  

   * Полный анализ документа (последовательные запросы)
   */
  async analyzeDocument(text) {
    const [summary, keyParagraphs] = await Promise.all([
      this.generateSummary(text),
      this.extractKeyParagraphs(text),
    ]);

    return {
      summary,
      keyParagraphs,
      violations: [], 
    };
  }
}

export default new AIService();
