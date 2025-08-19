import axios from "axios";

class AIService {
  constructor(apiUrl, activeModel) {
    this.apiUrl = "http://localhost:11434/api/generate";
    this.activeModel = "llama3.1/18/8192";
    this.defaultOptions = {
      temperature: 0.3,
      max_tokens: 16384,
      repeat_penalty: 1.2,
      format: "json",
    };
    this.analysisCache = new Map();
    this.maxRetries = 2;
    // Явная привязка методов
    this.queryLocalModel = this.queryLocalModel.bind(this);
    this.analyzeLegalText = this.analyzeLegalText.bind(this);
    this.safeParseResponse = this.safeParseResponse.bind(this);
    this.generateComplaintV2 = this.generateComplaintV2.bind(this);
    this.analyzeAttachment = this.analyzeAttachment.bind(this);
    this.parseAttachmentAnalysis = this.parseAttachmentAnalysis.bind(this);
  }

  async queryLocalModel(prompt, customOptions = {}) {
    const options = {
      method: "POST",
      ...this.defaultOptions,
      ...customOptions,
      prompt: this.preparePrompt(prompt, customOptions.taskType),
    };

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.activeModel,
          prompt,
          stream: false,
          format: "json",
          ...options,
        },
        { timeout: 500000 }
      );

      return this.safeParseResponse(response.data);
    } catch (error) {
      console.error("Ошибка запроса к модели:", error);
      throw this.normalizeError(error);
    }
  }

  async analyzeLegalText(text, instructions = "", strictMode = false) {
    console.log("Отправляемый текст:", text.substring(0, 200) + "...");
    const cacheKey = this.generateCacheKey(text, instructions);

    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    const prompt = this.buildAnalysisPrompt(text, instructions, strictMode);
    const result = await this.queryLocalModel(prompt, {
      temperature: 0.3,
      format: "json",
    });

    const parsedResult = this.safeParseResponse(result);

    if (!parsedResult) {
      throw new Error("Не удалось разобрать ответ модели");
    }

    const enhancedResult = {
      summary: parsedResult.summary || "Не удалось сгенерировать краткую суть",
      keySentences: Array.isArray(parsedResult.keySentences)
        ? parsedResult.keySentences.filter((p) => p && p.length > 10)
        : [],
      violations: Array.isArray(parsedResult.violations)
        ? parsedResult.violations
        : [],
      documentDate: parsedResult.documentDate || this.extractDate(text),
      senderAgency: parsedResult.senderAgency || this.extractAgency(text),
    };

    this.analysisCache.set(cacheKey, enhancedResult);
    return enhancedResult;
  }

  safeParseResponse(response) {
    try {
      if (typeof response === "string") {
        // Попытка найти JSON в строке
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      }
      return response;
    } catch (e) {
      console.error("Ошибка парсинга ответа:", e);
      return null;
    }
  }

  async generateComplaintV2(
    documentText,
    agency,
    relatedDocuments = [],
    instructions = ""
  ) {
    const prompt = this.buildComplaintPromptV2(
      documentText,
      agency,
      relatedDocuments,
      instructions
    );
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.5,
      max_tokens: 7000,
    });

    return {
      content:
        response.content || this.generateDefaultComplaint(documentText, agency),
      violations: response.violations || [],
    };
  }

  async analyzeAttachment(text) {
    const prompt = this.buildAttachmentPrompt(text);
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.2,
      format: "json",
    });

    return this.parseAttachmentAnalysis(response);
  }

  preparePrompt(text, taskType = "default") {
    const baseSystemPrompt = `
    [SYSTEM] Ты - юридический ассистент. 
    Проанализируй текст как юридический документ.
     
`;

    const taskSpecificPrompts = {
      summary: `${baseSystemPrompt}
Сгенерируй краткую суть документа объемом от трёх до пяти предложений: 
1. Повествование о клиенте в следующем стиле: 'Вы оспорили... Вы подали прошение...'
2. Без вступительных фраз вроде 'Документ:' или 
  'Краткая суть текста:' - сразу сгенерированная краткая суть!
[TEXT]: ${text.substring(0, 12000)}
[SUMMARY]:`,
      paragraphs: `${baseSystemPrompt}
      Выбери из текста несколько самых важных предложений и передай их 
      в своём ответе полностью, дословно, без редактирования.   
[TEXT]: ${text.substring(0, 12000)}
[keySentences]:`,

      violations: `${baseSystemPrompt}
Найди нарушения в тексте. Формат:
- Закон: [название]
- Статья: [номер]
- Описание: [текст]
- Доказательство: [цитата]
[TEXT]: ${text.substring(0, 9000)}
[VIOLATIONS]:`,

      attachment: `${baseSystemPrompt}
Проанализируй вложение. Верни JSON:
{
  "documentType": "тип",
  "sentDate": "дата",
  "senderAgency": "ведомство",
  "summary": "суть",
  "keySentences": ["важные предложения документа во вложении"]
}
[TEXT]: ${text.substring(0, 9000)}
[ANALYSIS]:`,

      default: `${baseSystemPrompt}
[TEXT]: ${text.substring(0, 9000)}
[RESULT]:`,
    };

    return taskSpecificPrompts[taskType] || taskSpecificPrompts.default;
  }

  buildAnalysisPrompt(text, instructions, strictMode) {
    return JSON.stringify({
      task: "ANALYZE_LEGAL_DOCUMENT",
      text: text.substring(0, 10000),
      requirements: {
        summaryLength: "3-5 предложений",
        keySentences: {
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

  buildComplaintPromptV2(text, agency, relatedDocuments, instructions = "") {
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
        additionalInstructions: instructions,
      },
    });
  }

  buildAttachmentPrompt(text) {
    return this.preparePrompt(text, "attachment");
  }

  parseAttachmentAnalysis(response) {
    try {
      const parsed = this.safeParseResponse(response);
      return {
        documentType: parsed?.documentType || "Неизвестный тип",
        sentDate: parsed?.sentDate || "",
        senderAgency: parsed?.senderAgency || "",
        summary: parsed?.summary || "Не удалось сгенерировать краткую суть",
        keySentences: parsed?.keySentences || [],
      };
    } catch (e) {
      console.error("Ошибка парсинга анализа вложения:", e);
      return {
        documentType: "Неизвестный тип",
        sentDate: "",
        senderAgency: "",
        summary: "Ошибка анализа вложения",
        keySentences: [],
      };
    }
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
    const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен"];
    return agencies.find((agency) => text.includes(agency)) || "";
  }

  generateDefaultComplaint(text, agency) {
    return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${text.substring(
      0,
      500
    )}\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
  }

  normalizeError(error) {
    const serverError = error.response?.data?.error;
    return serverError ? new Error(`Ошибка модели: ${serverError}`) : error;
  }
}

export default AIService;
