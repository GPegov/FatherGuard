import axios from "axios";
import crypto from "crypto";

class AIService {
  constructor(apiUrl, activeModel) {
    console.log("Инициализация AIService с параметрами:", { apiUrl, activeModel });
    this.apiUrl = apiUrl || "http://localhost:11434/api/generate";
    this.activeModel = activeModel || "llama3.1/18/8192";
    this.defaultOptions = {
      temperature: 0.3,
      repeat_penalty: 1.2,
      format: "json",
    };
    this.analysisCache = new Map();
    this.cacheTimestamps = new Map(); // Stores timestamps for cache entries
    this.maxCacheSize = 100; // Cache size limit
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes TTL in milliseconds
    this.maxRetries = 2;
    console.log("AIService инициализирован с параметрами:", {
      apiUrl: this.apiUrl,
      activeModel: this.activeModel,
      defaultOptions: this.defaultOptions
    });
    // Explicit method binding
    this.queryLocalModel = this.queryLocalModel.bind(this);
    this.analyzeLegalText = this.analyzeLegalText.bind(this);
    this.safeParseResponse = this.safeParseResponse.bind(this);
    this.analyzeAttachment = this.analyzeAttachment.bind(this);
  }

  async queryLocalModel(prompt, customOptions = {}) {
    try {
      console.log("Начало queryLocalModel");
      console.log("API URL:", this.apiUrl);
      console.log("Model:", this.activeModel);
      console.log("Prompt type:", typeof prompt);
      console.log("Custom options:", customOptions);
      
      // Limit prompt length
      let processedPrompt = prompt;
      if (typeof prompt === 'string' && prompt.length > 25000) {
        processedPrompt = prompt.substring(0, 25000);
        console.log("Prompt truncated to 25000 characters");
      } else if (typeof prompt === 'object' && JSON.stringify(prompt).length > 25000) {
        // For objects, limit JSON string length
        processedPrompt = JSON.stringify(prompt).substring(0, 25000);
        console.log("Prompt object truncated to 25000 characters");
      }

      // Prepare parameters for Ollama API
      const ollamaOptions = {
        temperature: customOptions.temperature || this.defaultOptions.temperature,
        repeat_penalty: customOptions.repeat_penalty || this.defaultOptions.repeat_penalty,
        // max_tokens is not used in Ollama API, there are other parameters instead
      };

      // Prepare prompt with strictMode consideration
      const promptOptions = {
        ...customOptions,
        strictMode: customOptions.strictMode || false
      };
      const preparedPrompt = this.preparePrompt(processedPrompt, customOptions.taskType, customOptions);

      console.log("Sending request to AI model:", {
        url: this.apiUrl,
        model: this.activeModel,
        prompt: typeof preparedPrompt === 'object' ? JSON.stringify(preparedPrompt, null, 2) : preparedPrompt.substring(0, 200) + '...',
        options: ollamaOptions
      });

      try {
        // Подготавливаем параметры напрямую, а не вложенным объектом
        const requestData = {
          model: this.activeModel,
          prompt: typeof preparedPrompt === 'object' ? JSON.stringify(preparedPrompt, null, 2) : preparedPrompt,
          stream: false,
          ...ollamaOptions, // Параметры передаем напрямую
        };

        // If format=json, add format directly to requestData
        if (customOptions.format === "json") {
          requestData.format = "json";
          // Add clear instruction to prompt for JSON return
          requestData.prompt += "\n\nSTRICT RESPONSE REQUIREMENTS:\n" +
            "1. RESPOND ONLY IN JSON FORMAT\n" +
            "2. DO NOT ADD ANY ADDITIONAL TEXTS OR COMMENTS\n" +
            "3. DO NOT USE Markdown OR OTHER FORMATS\n" +
            "4. RETURN ONLY VALID JSON\n" +
            "RESPONSE FORMAT EXAMPLE:\n" +
            "{\n" +
            "  \"summary\": \"here is the brief summary\",\n" +
            "  \"keySentences\": [\"sentence 1\", \"sentence 2\"],\n" +
            "  \"violations\": []\n" +
            "}";
        }

        console.log("Sending request to Ollama API");
        const response = await axios.post(
          this.apiUrl,
          requestData,
          { 
            timeout: 500000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        console.log("Response from Ollama API received");

        console.log("Response from AI model:", response.data);
        const result = this.safeParseResponse(response.data);
        console.log("Parsed response:", result);
        return result;
      } catch (error) {
        console.error("Error requesting model:", error);
        console.error("Error stack:", error.stack);
        if (error.code === 'ECONNREFUSED') {
          throw new Error("Не удалось подключиться к Ollama. Пожалуйста, убедитесь, что Ollama запущена и доступна по адресу " + this.apiUrl);
        }
        if (error.code === 'ECONNRESET') {
          throw new Error("Соединение с Ollama было сброшено. Пожалуйста, проверьте стабильность подключения.");
        }
        if (error.response) {
          // Server responded with error status
          console.error("Response error data:", error.response.data);
          console.error("Response error status:", error.response.status);
          console.error("Response error headers:", error.response.headers);
          throw new Error(`AI Model error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          // Request was made but no response received
          console.error("No response received:", error.request);
          throw new Error("No response received from AI Model. Please check if the service is running.");
        } else {
          // Something else happened
          console.error("Error message:", error.message);
          throw new Error(`Error in AI Model request: ${error.message}`);
        }
      }
    } catch (error) {
      console.error("Unexpected error in queryLocalModel:", error);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  async analyzeLegalText(text, instructions = "", strictMode = false) {
    try {
      console.log("Начало analyzeLegalText");
      console.log("analyzeLegalText called with text length:", text ? text.length : 0);
      console.log("Instructions:", instructions);
      console.log("Strict mode:", strictMode);
      
      if (!text || typeof text !== 'string') {
        console.log("Invalid text input");
        return {
          summary: "Invalid text input",
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: "",
        };
      }
      
      // Limit text length for processing
      let processedText = text;
      if (text.length > 25000) {
        processedText = text.substring(0, 25000);
        console.log("Text truncated to 25000 characters");
      }
      
      console.log("Sending text:", processedText.substring(0, 200) + "...");
      
      // Clean up expired cache entries
      this.cleanupExpiredCache();
      
      const cacheKey = this.generateCacheKey(processedText, instructions);

      // Check cache with TTL consideration
      if (this.analysisCache.has(cacheKey)) {
        const timestamp = this.cacheTimestamps.get(cacheKey);
        if (timestamp && (Date.now() - timestamp <= this.cacheTTL)) {
          console.log("Returning cached result");
          return this.analysisCache.get(cacheKey);
        } else {
          // Remove expired entry
          this.analysisCache.delete(cacheKey);
          this.cacheTimestamps.delete(cacheKey);
        }
      }

      try {
        console.log("Building analysis prompt");
        const promptData = this.buildAnalysisPrompt(processedText, instructions, strictMode);
        console.log("Prompt built, calling queryLocalModel");
        
        const result = await this.queryLocalModel(promptData, {
          temperature: 0.3,
          format: "json",
        });

        console.log("Model response received:", typeof result);
        if (typeof result === 'string') {
          console.log("Model response (first 200 chars):", result.substring(0, 200));
        }

        const parsedResult = this.safeParseResponse(result);
        console.log("Parsed result:", parsedResult);

        // If parsing failed, return error object
        if (!parsedResult) {
          console.log("Failed to parse model response");
          return {
            summary: "Failed to parse model response",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: "",
          };
        }

        // Extract data from result
        const summary = parsedResult.summary || parsedResult.content || "Failed to generate brief summary";
        const keySentences = Array.isArray(parsedResult.keySentences) 
          ? parsedResult.keySentences.filter((p) => p && p.length > 5)
          : (Array.isArray(parsedResult.content) 
            ? parsedResult.content.filter((p) => p && p.length > 5)
            : []);
        const violations = Array.isArray(parsedResult.violations) 
          ? parsedResult.violations
          : [];
        const documentDate = parsedResult.documentDate || parsedResult.sentDate || this.extractDate(processedText) || "";
        const senderAgency = parsedResult.senderAgency || parsedResult.agency || this.extractAgency(processedText) || "";

        const enhancedResult = {
          summary,
          keySentences,
          violations,
          documentDate,
          senderAgency,
        };

        // Cache size management
        if (this.analysisCache.size >= this.maxCacheSize) {
          // Remove first element (least recently used)
          const firstKey = this.analysisCache.keys().next().value;
          if (firstKey) {
            this.analysisCache.delete(firstKey);
            this.cacheTimestamps.delete(firstKey);
          }
        }
        
        // Save result to cache with timestamp
        this.analysisCache.set(cacheKey, enhancedResult);
        this.cacheTimestamps.set(cacheKey, Date.now());
        
        console.log("Analysis completed successfully:", enhancedResult);
        return {
          success: true,
          data: enhancedResult,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error("Error in analyzeLegalText:", error);
        console.error("Error stack:", error.stack);
        // Return default object in case of error
        return {
          success: true,
          data: {
            summary: "Error analyzing document: " + error.message,
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: "",
          },
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error("Unexpected error in analyzeLegalText:", error);
      console.error("Error stack:", error.stack);
      return {
        success: true,
        data: {
          summary: "Unexpected error: " + error.message,
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: "",
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  safeParseResponse(response) {
    console.log("Начало safeParseResponse");
    console.log("Тип ответа:", typeof response);
    // If response is already an object, return it as is
    if (typeof response === "object" && response !== null) {
      console.log("Ответ уже является объектом");
      return response;
    }
    
    // If response is a string
    if (typeof response === "string") {
      console.log("Ответ является строкой, попытка парсинга");
      // Attempt 1: Direct parsing of entire string as JSON
      try {
        const parsed = JSON.parse(response);
        console.log("Успешный парсинг JSON");
        return parsed;
      } catch (directParseError) {
        console.error("Direct JSON parse failed:", directParseError);
        // Attempt 2: Extract JSON from markdown code blocks
        try {
          const jsonMatch = response.match(/```(?:json)?\s*({.*?})\s*```/s);
          if (jsonMatch && jsonMatch[1]) {
            const parsed = JSON.parse(jsonMatch[1]);
            console.log("Успешный парсинг JSON из markdown");
            return parsed;
          }
        } catch (markdownParseError) {
          console.error("Markdown JSON parse failed:", markdownParseError);
        }
        
        // Attempt 3: Manual extraction of key fields
        try {
          const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/);
          const keySentencesMatch = response.match(/"keySentences"\s*:\s*($[^$]*$)/);
          const violationsMatch = response.match(/"violations"\s*:\s*($[^$]*$)/);
          
          const result = {
            summary: summaryMatch ? summaryMatch[1] : "Failed to extract summary",
            keySentences: keySentencesMatch ? JSON.parse(keySentencesMatch[1]) : [],
            violations: violationsMatch ? JSON.parse(violationsMatch[1]) : []
          };
          console.log("Успешная ручная распаковка ответа");
          return result;
        } catch (manualParseError) {
          console.error("Manual JSON parse failed:", manualParseError);
        }
      }
    }
    
    // If all parsing attempts failed
    console.error("All parsing attempts failed for response:", response);
    return null;
  }

  async analyzeAttachment(text, instructions = "") {
    try {
      console.log("Начало analyzeAttachment");
      console.log("analyzeAttachment called with text length:", text ? text.length : 0);
      
      if (!text || typeof text !== 'string') {
        console.log("Invalid text input for attachment");
        return {
          documentType: "Invalid input",
          sentDate: "",
          senderAgency: "",
          summary: "Invalid text input",
          keySentences: [],
        };
      }
      
      // Limit text length for processing
      let processedText = text;
      if (text.length > 25000) {
        processedText = text.substring(0, 25000);
        console.log("Attachment text truncated to 25000 characters");
      }
      
      console.log("Sending attachment text:", processedText.substring(0, 200) + "...");
      
      // Анализируем вложение через AI-сервис, используя тот же промпт, что и для основного документа
      console.log("Вызов analyzeLegalText для анализа вложения");
      const analysisResult = await this.analyzeLegalText(processedText, instructions, false);
      console.log("Результат анализа вложения:", analysisResult);

      // Формируем результат в формате вложения
      const attachmentResult = {
        documentType: "Документ", // Будет определен моделью
        sentDate: analysisResult.documentDate || "",
        senderAgency: analysisResult.senderAgency || "",
        summary: analysisResult.summary || "Не удалось сгенерировать краткую суть",
        keySentences: Array.isArray(analysisResult.keySentences) 
          ? analysisResult.keySentences.filter((p) => p && p.length > 5)
          : []
      };
      
      console.log("Возвращаем результат анализа вложения:", attachmentResult);
      return attachmentResult;

    } catch (error) {
      console.error("Error in analyzeAttachment:", error);
      return {
        documentType: "Неизвестный тип",
        sentDate: "",
        senderAgency: "",
        summary: "Error analyzing attachment: " + error.message,
        keySentences: [],
      };
    }
  }

  extractDate(text) {
    console.log("Начало extractDate");
    console.log("Text length:", text ? text.length : 0);
    // Implementation for date extraction
    const dateRegex = /(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})|(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2})/;
    const match = text.match(dateRegex);
    const result = match ? match[0] : "";
    console.log("Extracted date:", result);
    return result;
  }

  extractAgency(text) {
    console.log("Начало extractAgency");
    console.log("Text length:", text ? text.length : 0);
    // Implementation for agency extraction
    const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен"];
    const result = agencies.find((agency) => text.includes(agency)) || "";
    console.log("Extracted agency:", result);
    return result;
  }

  buildAnalysisPrompt(text, instructions, strictMode) {
    console.log("Начало buildAnalysisPrompt");
    console.log("Text length:", text ? text.length : 0);
    console.log("Instructions:", instructions);
    console.log("Strict mode:", strictMode);
    // Implementation for building analysis prompt
    const result = {
      task: "legal_analysis",
      text: text,
      instructions: instructions,
      strictMode: strictMode
    };
    console.log("Сформированный prompt объект:", result);
    return result;
  }

  buildComplaintPrompt(analysisData, agency) {
    console.log("Начало buildComplaintPrompt");
    console.log("Agency:", agency);
    console.log("Analysis data:", analysisData);
    
    // Создаем структурированные данные для AI
    const promptData = {
      task: "generate_complaint",
      agency: agency,
      mainDocument: {
        summary: analysisData.summary,
        keySentences: analysisData.keySentences?.slice(0, 10) || [], // Ограничиваем количество
        violations: analysisData.violations || [],
        documentDate: analysisData.documentDate,
        senderAgency: analysisData.senderAgency
      },
      hasRelatedDocuments: analysisData.attachments && analysisData.attachments.length > 0,
      relatedDocumentsCount: analysisData.attachments?.length || 0
    };

    console.log("Сформированный prompt объект:", promptData);
    return promptData;
  }

  preparePrompt(prompt, taskType, options) {
    console.log("Начало preparePrompt");
    console.log("Тип prompt:", typeof prompt);
    console.log("Task type:", taskType);
    console.log("Options:", options);
    // Если prompt является объектом (как в случае с buildAnalysisPrompt), используем его поля
    if (typeof prompt === 'object' && prompt !== null) {
      const { text, instructions, strictMode, task } = prompt;
      console.log("Prompt является объектом, поля:", { text: text ? text.substring(0, 100) : 'null', instructions, strictMode, task });
      
      // Формируем промпт в зависимости от типа задачи
      let basePrompt = text || "";
      
      // Добавляем инструкции, если они есть
      if (instructions && instructions.trim()) {
        basePrompt = `${basePrompt}

ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:
${instructions}`;
      }
      
      // Добавляем указания по режиму строгого анализа
      if (strictMode) {
        basePrompt = `${basePrompt}

ПРИМЕНЯЙТЕ СТРОГИЙ АНАЛИЗ ДОКУМЕНТА.`;
      }
      
      // Добавляем общие указания по формату ответа в зависимости от типа задачи
      switch (task) {
        case 'legal_analysis':
          basePrompt = `${basePrompt}

ПРОАНАЛИЗИРУЙТЕ ДОКУМЕНТ И ПРЕДОСТАВЬТЕ СТРУКТУРИРОВАННЫЙ ОТВЕТ В ФОРМАТЕ JSON С ПОЛЯМИ:
- summary: краткая суть документа
- keySentences: массив важных предложений
- violations: массив выявленных нарушений
- documentDate: дата документа
- senderAgency: ведомство-отправитель`;
          break;
        case 'generate_complaint':
          basePrompt = `${basePrompt}

СОЗДАЙТЕ ОФИЦИАЛЬНУЮ ЖАЛОБУ В ${agency} ОТ ПЕРВОГО ЛИЦА ЗАЯВИТЕЛЯ.
ОСНОВНЫЕ ТРЕБОВАНИЯ:
1. ИСПОЛЬЗУЙТЕ ДЕЛОВОЙ СТИЛЬ, СТРОГО ПО СУЩЕСТВУ
2. УКАЖИТЕ КОНКРЕТНЫЕ НАРУШЕНИЯ ЗАКОНОВ
3. СДЕЛАЙТЕ ССЫЛКИ НА СТАТЬИ ЗАКОНОВ
4. ПРЕДЛОЖИТЕ КОНКРЕТНЫЕ ТРЕБОВАНИЯ
5. НЕ ВКЛЮЧАЙТЕ ПОЛНЫЙ ТЕКСТ ДОКУМЕНТА

ВЕРНИТЕ РЕЗУЛЬТАТ В ФОРМАТЕ JSON:
{
  "content": "текст жалобы"
}`;
          break;
      }
      
      console.log("Сформированный prompt (первые 200 символов):", basePrompt.substring(0, 200));
      return basePrompt;
    }
    
    // Если prompt - строка, возвращаем её как есть
    console.log("Prompt является строкой");
    return prompt;
  }

  generateCacheKey(text, instructions) {
    // Создаем более уникальный ключ, используя хэш от полного текста и инструкций
    const hash = crypto.createHash('md5');
    hash.update(text + instructions);
    return hash.digest('hex');
  }

  cleanupExpiredCache() {
    console.log("Начало cleanupExpiredCache");
    // Implementation for cleaning up expired cache
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.cacheTTL) {
        this.analysisCache.delete(key);
        this.cacheTimestamps.delete(key);
        cleanedCount++;
      }
    }
    console.log("Очищено записей из кэша:", cleanedCount);
  }

  clearCache() {
    console.log("Начало clearCache");
    // Implementation for clearing cache
    this.analysisCache.clear();
    this.cacheTimestamps.clear();
    console.log("Cache cleared");
  }

  getCacheStats() {
    console.log("Начало getCacheStats");
    // Implementation for getting cache stats
    const stats = {
      size: this.analysisCache.size,
      max_size: this.maxCacheSize,
      ttl: this.cacheTTL
    };
    console.log("Cache stats:", stats);
    return stats;
  }

  normalizeError(error) {
    console.log("Начало normalizeError");
    console.log("Error:", error);
    // Implementation for normalizing error
    return error;
  }
}

export default AIService;