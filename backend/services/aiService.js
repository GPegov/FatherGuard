import axios from "axios";

class AIService {
  constructor(apiUrl, activeModel) {
    this.apiUrl = apiUrl || "http://localhost:11434/api/generate";
    this.activeModel = activeModel || "llama3.1/18/8192";
    this.defaultOptions = {
      temperature: 0.3,
      repeat_penalty: 1.2,
      format: "json",
    };
    this.analysisCache = new Map();
    this.maxRetries = 2;
    // Явная привязка методов
    this.queryLocalModel = this.queryLocalModel.bind(this);
    this.analyzeLegalText = this.analyzeLegalText.bind(this);
    this.safeParseResponse = this.safeParseResponse.bind(this);
    this.analyzeAttachment = this.analyzeAttachment.bind(this);
    this.parseAttachmentAnalysis = this.parseAttachmentAnalysis.bind(this);
  }

  async queryLocalModel(prompt, customOptions = {}) {
    // Ограничение длины промпта
    let processedPrompt = prompt;
    if (typeof prompt === 'string' && prompt.length > 25000) {
      processedPrompt = prompt.substring(0, 25000);
    } else if (typeof prompt === 'object' && JSON.stringify(prompt).length > 25000) {
      // Для объектов ограничиваем длину JSON-строки
      processedPrompt = JSON.stringify(prompt).substring(0, 25000);
    }

    // Подготовка параметров для Ollama API
    const ollamaOptions = {
      temperature: customOptions.temperature || this.defaultOptions.temperature,
      repeat_penalty: customOptions.repeat_penalty || this.defaultOptions.repeat_penalty,
      // max_tokens не используется в Ollama API, вместо этого есть другие параметры
    };

    // Подготовка промпта
    const preparedPrompt = this.preparePrompt(processedPrompt, customOptions.taskType, customOptions);

    console.log("Отправка запроса к AI-модели:", {
      url: this.apiUrl,
      model: this.activeModel,
      prompt: preparedPrompt,
      options: ollamaOptions
    });

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.activeModel,
          prompt: preparedPrompt,
          stream: false,
          format: customOptions.format || this.defaultOptions.format,
          options: ollamaOptions,
        },
        { timeout: 500000 }
      );

      console.log("Ответ от AI-модели:", response.data);
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

  async analyzeAttachment(text) {
    const prompt = this.buildAttachmentPrompt(text);
    const response = await this.queryLocalModel(prompt, {
      temperature: 0.2,
      format: "json",
    });

    return this.parseAttachmentAnalysis(response);
  }

  preparePrompt(text, taskType = "default", options = {}) {
    // Если text уже является объектом (например, JSON), преобразуем его в строку
    const promptText = typeof text === 'object' ? JSON.stringify(text) : text;
    
    // Ограничение длины текста будет применяться централизованно в queryLocalModel
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
[TEXT]: ${promptText}
[SUMMARY]:`,
      paragraphs: `${baseSystemPrompt}
      Выбери из текста несколько самых важных предложений и передай их 
      в своём ответе полностью, дословно, без редактирования.
      Не добавляй никакие вводные фразы типа "Из текста выбраны следующие важные предложения:".
      Верни только список предложений, разделенных новой строкой.
[TEXT]: ${promptText}
[keySentences]:`,

      violations: `${baseSystemPrompt}
Найди нарушения в тексте. Формат:
- Закон: [название]
- Статья: [номер]
- Описание: [текст]
- Доказательство: [цитата]
[TEXT]: ${promptText}
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
[TEXT]: ${promptText}
[ANALYSIS]:`,

      default: `${baseSystemPrompt}
[TEXT]: ${promptText}
[RESULT]:`,
    };

    return taskSpecificPrompts[taskType] || taskSpecificPrompts.default;
  }

  buildAnalysisPrompt(text, instructions, strictMode) {
    return JSON.stringify({
      task: "ANALYZE_LEGAL_DOCUMENT",
      text: text,
      requirements: {
        summaryLength: "3-5 предложений",
        keySentences: {
          format: "list",
          noIntroPhrases: true
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

  normalizeError(error) {
    const serverError = error.response?.data?.error;
    return serverError ? new Error(`Ошибка модели: ${serverError}`) : error;
  }
}

export default AIService;