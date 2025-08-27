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
    this.cacheTimestamps = new Map(); // Stores timestamps for cache entries
    this.maxCacheSize = 100; // Cache size limit
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes TTL in milliseconds
    this.maxRetries = 2;
    // Explicit method binding
    this.queryLocalModel = this.queryLocalModel.bind(this);
    this.analyzeLegalText = this.analyzeLegalText.bind(this);
    this.safeParseResponse = this.safeParseResponse.bind(this);
    this.analyzeAttachment = this.analyzeAttachment.bind(this);
  }

  async queryLocalModel(prompt, customOptions = {}) {
    try {
      console.log("queryLocalModel called");
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
      const preparedPrompt = this.preparePrompt(processedPrompt, customOptions.taskType, promptOptions);

      console.log("Sending request to AI model:", {
        url: this.apiUrl,
        model: this.activeModel,
        prompt: typeof preparedPrompt === 'object' ? JSON.stringify(preparedPrompt, null, 2) : preparedPrompt.substring(0, 200) + '...',
        options: ollamaOptions
      });

      try {
        const requestData = {
          model: this.activeModel,
          prompt: typeof preparedPrompt === 'object' ? JSON.stringify(preparedPrompt, null, 2) : preparedPrompt,
          stream: false,
          options: ollamaOptions,
        };

        // If format=json, add format to options
        if (customOptions.format === "json") {
          requestData.options.format = "json";
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
        throw this.normalizeError(error);
      }
    } catch (error) {
      console.error("Unexpected error in queryLocalModel:", error);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  async analyzeLegalText(text, instructions = "", strictMode = false) {
    try {
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
        return enhancedResult;
      } catch (error) {
        console.error("Error in analyzeLegalText:", error);
        console.error("Error stack:", error.stack);
        // Return default object in case of error
        return {
          summary: "Error analyzing document: " + error.message,
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: "",
        };
      }
    } catch (error) {
      console.error("Unexpected error in analyzeLegalText:", error);
      console.error("Error stack:", error.stack);
      return {
        summary: "Unexpected error: " + error.message,
        keySentences: [],
        violations: [],
        documentDate: "",
        senderAgency: "",
      };
    }
  }

  safeParseResponse(response) {
    // If response is already an object, return it as is
    if (typeof response === "object" && response !== null) {
      return response;
    }
    
    // If response is a string
    if (typeof response === "string") {
      // Attempt 1: Direct parsing of entire string as JSON
      try {
        return JSON.parse(response);
      } catch (directParseError) {
        console.error("Direct JSON parse failed:", directParseError);
        // Attempt 2: Extract JSON from markdown code blocks
        try {
          const jsonMatch = response.match(/```(?:json)?\s*({.*?})\s*```/s);
          if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
          }
        } catch (markdownParseError) {
          console.error("Markdown JSON parse failed:", markdownParseError);
        }
        
        // Attempt 3: Manual extraction of key fields
        try {
          const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/);
          const keySentencesMatch = response.match(/"keySentences"\s*:\s*($$[^$$]*$$)/);
          const violationsMatch = response.match(/"violations"\s*:\s*($$[^$$]*$$)/);
          
          return {
            summary: summaryMatch ? summaryMatch[1] : "Failed to extract summary",
            keySentences: keySentencesMatch ? JSON.parse(keySentencesMatch[1]) : [],
            violations: violationsMatch ? JSON.parse(violationsMatch[1]) : []
          };
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
      
      const promptData = this.buildAttachmentAnalysisPrompt(processedText, instructions);
      
      const result = await this.queryLocalModel(promptData, {
        temperature: 0.2,
        format: "json",
        taskType: "attachment"
      });

      const parsedResult = this.safeParseResponse(result);
      
      if (!parsedResult) {
        return {
          documentType: "Failed to parse",
          sentDate: "",
          senderAgency: "",
          summary: "Failed to parse model response",
          keySentences: [],
        };
      }

      return {
        documentType: parsedResult.documentType || "Unknown",
        sentDate: parsedResult.sentDate || parsedResult.documentDate || "",
        senderAgency: parsedResult.senderAgency || parsedResult.agency || "",
        summary: parsedResult.summary || parsedResult.content || "Failed to generate summary",
        keySentences: Array.isArray(parsedResult.keySentences) 
          ? parsedResult.keySentences.filter((p) => p && p.length > 5)
          : (Array.isArray(parsedResult.content) 
            ? parsedResult.content.filter((p) => p && p.length > 5)
            : []),
      };
    } catch (error) {
      console.error("Error in analyzeAttachment:", error);
      return {
        documentType: "Error",
        sentDate: "",
        senderAgency: "",
        summary: "Error analyzing attachment: " + error.message,
        keySentences: [],
      };
    }
  }

  extractDate(text) {
    // Implementation for date extraction
    const dateRegex = /(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})|(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2})/;
    const match = text.match(dateRegex);
    return match ? match[0] : "";
  }

  extractAgency(text) {
    // Implementation for agency extraction
    const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен"];
    return agencies.find((agency) => text.includes(agency)) || "";
  }

  buildAnalysisPrompt(text, instructions, strictMode) {
    // Implementation for building analysis prompt
    return {
      task: "legal_analysis",
      text: text,
      instructions: instructions,
      strictMode: strictMode
    };
  }

  buildAttachmentAnalysisPrompt(text, instructions = "") {
    // Implementation for building attachment analysis prompt
    return {
      task: "attachment_analysis",
      text: text,
      instructions: instructions
    };
  }

  preparePrompt(prompt, taskType, options) {
    // Если prompt является объектом (как в случае с buildAnalysisPrompt), используем его поля
    if (typeof prompt === 'object' && prompt !== null) {
      const { text, instructions, strictMode, task } = prompt;
      
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
        case 'summary':
          basePrompt = `${basePrompt}

СОЗДАЙТЕ КРАТКУЮ СУТЬ ДОКУМЕНТА.`;
          break;
        case 'paragraphs':
          basePrompt = `${basePrompt}

ИЗВЛЕЧИТЕ ВАЖНЫЕ ПРЕДЛОЖЕНИЯ ИЗ ДОКУМЕНТА.`;
          break;
        case 'violations':
          basePrompt = `${basePrompt}

ВЫЯВИТЕ ВОЗМОЖНЫЕ НАРУШЕНИЯ В ДОКУМЕНТЕ.`;
          break;
        case 'attachment_analysis':
          basePrompt = `${basePrompt}

ПРОАНАЛИЗИРУЙТЕ ВЛОЖЕНИЕ И ПРЕДОСТАВЬТЕ СТРУКТУРИРОВАННЫЙ ОТВЕТ В ФОРМАТЕ JSON С ПОЛЯМИ:
- documentType: тип документа
- sentDate: дата отправки
- senderAgency: ведомство-отправитель
- summary: краткая суть
- keySentences: массив важных предложений`;
          break;
      }
      
      return basePrompt;
    }
    
    // Если prompt - строка, возвращаем её как есть
    return prompt;
  }

  generateCacheKey(text, instructions) {
    // Implementation for generating cache key
    return `${text.substring(0, 100)}_${instructions}`;
  }

  cleanupExpiredCache() {
    // Implementation for cleaning up expired cache
    const now = Date.now();
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.cacheTTL) {
        this.analysisCache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  clearCache() {
    // Implementation for clearing cache
    this.analysisCache.clear();
    this.cacheTimestamps.clear();
  }

  getCacheStats() {
    // Implementation for getting cache stats
    return {
      size: this.analysisCache.size,
      max_size: this.maxCacheSize,
      ttl: this.cacheTTL
    };
  }

  normalizeError(error) {
    // Implementation for normalizing error
    return error;
  }
}

export default AIService;