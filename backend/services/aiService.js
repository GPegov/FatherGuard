import axios from "axios";
import { readFile } from "fs/promises";

// Кеш для хранения результатов анализа
const analysisCache = new Map();

// Загрузка справочника статей
let legalReferences = {};
try {
  const data = await readFile(new URL("./legal_references.json", import.meta.url));
  legalReferences = JSON.parse(data);
} catch (err) {
  console.warn("Не удалось загрузить legal_references.json", err.message);
}

class AIService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    this.legalLaws = [
      'Федеральный закон "Об исполнительном производстве" №229-ФЗ',
      "Семейный кодекс РФ (раздел V)",
      'Федеральный закон "О судебных приставах" №118-ФЗ',
    ];
    
    
    
  }



  async generateComplaintV2(documentId, agency, db) {
  try {
    // Найти документ в базе
    const doc = db.data.documents.find(d => d.id === documentId);
    if (!doc) throw new Error('Документ не найден');

    // Проанализировать текст если еще не анализировался
    if (!doc.summary || doc.keyParagraphs.length === 0) {
      const analysis = await this.analyzeLegalText(doc.originalText);
      Object.assign(doc, {
        summary: analysis.summary,
        keyParagraphs: analysis.keyParagraphs
      });
      await db.write();
    }

    // Сгенерировать жалобу
    const prompt = this.buildEnhancedComplaintPrompt(doc, agency);
    const response = await this.sendToOllama(prompt);

    // Сохранить жалобу
    const complaint = {
      id: uuidv4(),
      documentId,
      agency,
      content: this.parseComplaintResponse(response),
      status: 'draft',
      createdAt: new Date().toISOString(),
      violations: doc.violations || []
    };

    if (!db.data.complaints) db.data.complaints = [];
    db.data.complaints.push(complaint);
    await db.write();

    return complaint;
  } catch (error) {
    console.error('Ошибка генерации жалобы:', error);
    throw error;
  }
}

// Новый улучшенный промпт
buildEnhancedComplaintPrompt(doc, agency) {
  return `
    Сгенерируй официальную жалобу в ${agency} на основе следующего документа:
    
    Требования:
    1. Формат: Официальное заявление
    2. Укажи все нарушения законов:
       ${doc.violations.map(v => `${v.law} ${v.article}`).join(", ")}
    3. Включи цитаты из ключевых параграфов:
       ${doc.keyParagraphs.slice(0, 3).join("\n       ")}
    4. Требуй конкретных действий:
       - Прекратить нарушения
       - Привлечь виновных к ответственности
       - Возместить ущерб

    Структура:
    [Шапка с реквизитами]
    Заявление
    Суть: ${doc.summary}
    Нарушения: ${doc.violations.map(v => `${v.law} ${v.article}: ${v.description}`).join("; ")}
    Требования: [Конкретные действия]
    Приложения: [Ссылки на документы]
    Дата, подпись

    Дополнительная информация:
    ${doc.originalText.substring(0, 1500)}
  `;
}










  async analyzeLegalText(text) {
    const cacheKey = this.generateHash(text);
    if (analysisCache.has(cacheKey)) {
      return analysisCache.get(cacheKey);
    }

    console.log("[AI Service] Анализ текста...");
    const truncatedText = text.length > 3000 
      ? text.substring(0, 3000) + "... [текст сокращен]" 
      : text;

    const prompt = this.buildAnalysisPrompt(truncatedText);
    console.log("Отправляемый промпт:", prompt.substring(0, 200) + "...");

    try {
      const result = await this.sendToOllama(prompt);
      const parsedResult = this.parseAnalysisResponse(result);
      
      analysisCache.set(cacheKey, parsedResult);
      return parsedResult;
    } catch (error) {
      console.error("Ошибка анализа текста:", error);
      return {
        summary: "Не удалось проанализировать текст",
        keyParagraphs: [],
        violations: [],
      };
    }
  }

  

  async sendToOllama(prompt) {
    const response = await axios.post(
      `${this.baseUrl}/api/generate`,
      {
        model: "deepseek-r1:14b",
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.3,
          num_predict: 1024,
          repeat_penalty: 1.2,
        },
      },
      {
        timeout: 100000,
      }
    );
    return response.data;
  }

  parseAnalysisResponse(data) {
    try {
      const result = typeof data.response === "string" 
        ? JSON.parse(data.response) 
        : data.response;

      // Валидация структуры ответа
      if (!result.summary || !result.keyParagraphs) {
        throw new Error("Отсутствуют summary или keyParagraphs в ответе");
      }

      return {
        summary: result.summary,
        keyParagraphs: Array.isArray(result.keyParagraphs)
          ? result.keyParagraphs.slice(0, 5).filter(p => p.trim())
          : [],
        violations: Array.isArray(result.violations)
          ? result.violations.map(v => ({
              ...v,
              reference: this.getLegalReference(v.law, v.article)
            }))
          : [],
      };
    } catch (e) {
      console.error("Ошибка парсинга ответа:", e.message);
      return {
        summary: "Ошибка анализа текста",
        keyParagraphs: [],
        violations: [],
      };
    }
  }

  getLegalReference(law, article) {
    if (!legalReferences[law]) return "Справочник не найден";
    const articleNumber = article.replace("ст. ", "");
    return legalReferences[law].articles?.[articleNumber] || "Статья не найдена";
  }

  async generateComplaint(text, agency) {
    const analysis = await this.analyzeLegalText(text);
    const prompt = this.buildComplaintPrompt(text, analysis, agency);
    
    try {
      const response = await this.sendToOllama(prompt);
      return {
        content: this.parseComplaintResponse(response),
        analysis,
      };
    } catch (error) {
      console.error("Ошибка генерации жалобы:", error);
      throw new Error("Не удалось сформировать жалобу");
    }
  }

  buildComplaintPrompt(text, analysis, agency) {
    return `
      Сгенерируй официальную жалобу в ${agency} по следующим требованиям:
      
      1. Формат: Официальное заявление
      2. Укажи нарушения: 
         ${analysis.violations.map(v => `${v.law} ${v.article}`).join(", ")}
      3. Включи цитаты из текста
      4. Ссылки на законы
      5. Требуемые действия

      Пример структуры:
      "В ${agency}
      Заявитель: [Данные]
      Суть: [Кратко]
      Нарушения: [Перечень]
      Требование: [Действия]"

      Анализ нарушений: ${JSON.stringify(analysis.violations)}
      Исходный текст: "${text.substring(0, 1500)}"
    `;
  }

  parseComplaintResponse(data) {
    try {
      return typeof data.response === "string"
        ? JSON.parse(data.response)
        : data.response;
    } catch {
      return data.response || "Текст жалобы не сформирован";
    }
  }

  generateHash(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 100); i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  getFriendlyError(error) {
    if (error.code === "ECONNABORTED") return "Таймаут запроса к нейросети";
    if (error.response?.status === 404) return "Модель не найдена";
    return "Ошибка сервера, попробуйте позже";
  }
}

const aiServiceInstance = new AIService();
export default aiServiceInstance;