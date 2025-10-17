// backend/services/aiService.js
import PromptService from './promptService.js';
import axios from 'axios';
import crypto from 'crypto';
import { AIConfig } from '../config/aiConfig.js';

class AIService {
  constructor(apiUrl, activeModel) {
    console.log("Инициализация AIService с параметрами:", { apiUrl, activeModel });
    this.apiUrl = apiUrl || "http://localhost:11434/api/generate";
    this.activeModel = activeModel || process.env.MODEL_NAME || "llama3.1/18/8192";
    this.defaultOptions = {
      temperature: AIConfig.TEMPERATURE.DEFAULT,
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
    
  }

  async queryLocalModel(prompt, customOptions = {}) {
    try {
      console.log("=== НАЧАЛО QUERY LOCAL MODEL ===");
      console.log("API URL:", this.apiUrl);
      console.log("Model:", this.activeModel);
      console.log("Prompt type:", typeof prompt);
      console.log("Custom options:", customOptions);
      
      // Limit prompt length
      let processedPrompt = prompt;
      if (typeof prompt === 'string' && prompt.length > AIConfig.MAX_PROMPT_LENGTH) {
        processedPrompt = prompt.substring(0, AIConfig.MAX_PROMPT_LENGTH);
        console.log(`Prompt truncated to ${AIConfig.MAX_PROMPT_LENGTH} characters`);
      } else if (typeof prompt === 'object' && JSON.stringify(prompt).length > AIConfig.MAX_PROMPT_LENGTH) {
        // For objects, limit JSON string length
        processedPrompt = JSON.stringify(prompt).substring(0, AIConfig.MAX_PROMPT_LENGTH);
        console.log(`Prompt object truncated to ${AIConfig.MAX_PROMPT_LENGTH} characters`);
      }

      // Prepare parameters for Ollama API
      const ollamaOptions = {
        temperature: customOptions.temperature || this.defaultOptions.temperature,
        repeat_penalty: customOptions.repeat_penalty || this.defaultOptions.repeat_penalty,
        // max_tokens is not used in Ollama API, there are other parameters instead
      };

      console.log("Sending request to AI model:", {
        url: this.apiUrl,
        model: this.activeModel,
        prompt: typeof processedPrompt === 'object' ? JSON.stringify(processedPrompt, null, 2) : processedPrompt.substring(0, 200) + '...',
        options: ollamaOptions
      });

      try {
        // Подготавливаем параметры напрямую, а не вложенным объектом
        // Всегда отправляем prompt как строку
        let finalPrompt = typeof processedPrompt === 'string' ? processedPrompt : String(processedPrompt);
        
        // If format=json, add clear instruction to prompt for JSON return
        if (customOptions.format === "json") {
          finalPrompt += "\n\nSTRICT RESPONSE REQUIREMENTS:\n" +
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

        const requestData = {
          model: this.activeModel,
          prompt: finalPrompt,
          stream: false,
          ...ollamaOptions, // Параметры передаем напрямую
        };

        // If format=json, add format directly to requestData
        if (customOptions.format === "json") {
          requestData.format = "json";
        }

        console.log("=== ОТПРАВКА ЗАПРОСА К OLLAMA API ===");
        console.log("Request data:", JSON.stringify(requestData, null, 2));
        console.log("Prompt length:", requestData.prompt.length);
        console.log("Prompt preview (first 500 chars):", requestData.prompt.substring(0, 500));
        
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
        console.log("=== КОНЕЦ ОТПРАВКИ ЗАПРОСА К OLLAMA API ===");

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

  // Метод для анализа юридических пояснений пользователя
  async analyzeLegalText(text, instructions = "", strictMode = false) {
    try {
      console.log("=== НАЧАЛО ANALYZE LEGAL TEXT ===");
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
      if (text.length > AIConfig.MAX_TEXT_LENGTH) {
        processedText = text.substring(0, AIConfig.MAX_TEXT_LENGTH);
        console.log(`Text truncated to ${AIConfig.MAX_TEXT_LENGTH} characters`);
      }
      
      console.log("Sending text:", processedText.substring(0, 200) + "...");
      
      // // Clean up expired cache entries
      // this.cleanupExpiredCache();
      // 
      // const cacheKey = this.generateCacheKey(processedText, instructions);
      // 
      // // Check cache with TTL consideration
      // if (this.analysisCache.has(cacheKey)) {
      //   const timestamp = this.cacheTimestamps.get(cacheKey);
      //   if (timestamp && (Date.now() - timestamp <= this.cacheTTL)) {
      //     console.log("Returning cached result");
      //     return this.analysisCache.get(cacheKey);
      //   } else {
      //     // Remove expired entry
      //     this.analysisCache.delete(cacheKey);
      //     this.cacheTimestamps.delete(cacheKey);
      //   }
      // }

      try {
        // Используем PromptService для генерации промпта
        const prompt = PromptService.getAnalysisPrompt(processedText, {
          sourceType: 'user_explanation',
          instructions,
          strictMode
        });

        console.log("Prompt built, calling queryLocalModel");
        console.log("Prompt data preview:", typeof prompt === 'string' ? prompt.substring(0, 200) : JSON.stringify(prompt, null, 2));
        console.log("=== КОНЕЦ ANALYZE LEGAL TEXT ===");
        
        // Основной запрос с температурой для анализа юридических текстов
        const mainResult = await this.queryLocalModel(prompt, {
          temperature: AIConfig.TEMPERATURE.ANALYSIS,
          format: "json"
        });

        console.log("Main model response received:", typeof mainResult);
        if (typeof mainResult === 'string') {
          console.log("Main model response (first 200 chars):", mainResult.substring(0, 200));
        }

        const parsedMainResult = this.safeParseResponse(mainResult);
        console.log("Parsed main result:", parsedMainResult);

        // If parsing failed, return error object
        if (!parsedMainResult) {
          console.log("Failed to parse main model response");
          return {
            summary: "Failed to parse model response",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: "",
          };
        }

        // Извлекаем основную информацию из результата
        const summary = parsedMainResult.summary || parsedMainResult.content || "Failed to generate brief summary";
        const violations = Array.isArray(parsedMainResult.violations) 
          ? parsedMainResult.violations
          : [];
        const documentDate = parsedMainResult.eventDate || parsedMainResult.documentDate || parsedMainResult.sentDate || "";
        const senderAgency = parsedMainResult.senderAgency || parsedMainResult.agency || "";

        // Извлечение ключевых предложений с использованием PromptService
        const keySentences = await this.extractKeySentences(processedText, 'user_explanation');

        const enhancedResult = {
          summary,
          keySentences,
          violations,
          eventDate: documentDate, // Use the extracted date as eventDate for chronicle purposes
          documentDate: documentDate,
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
        
        // // Save result to cache with timestamp
        // this.analysisCache.set(cacheKey, enhancedResult);
        // this.cacheTimestamps.set(cacheKey, Date.now());
        
        console.log("Analysis completed successfully:", enhancedResult);
        return enhancedResult;
      } catch (error) {
        console.error("Error in analyzeLegalText:", error);
        console.error("Error stack:", error.stack);
        // Return default object in case of error with same format as successful result
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
      // Return default object in case of error with same format as successful result
      return {
        summary: "Unexpected error: " + error.message,
        keySentences: [],
        violations: [],
        documentDate: "",
        senderAgency: "",
      };
    }
  }

  // Метод для комбинированного анализа текста, включая пояснения пользователя и официальные документы
  async analyzeCombinedText(combinedText, instructions = "", strictMode = false) {
    try {
      console.log("=== НАЧАЛО ANALYZE COMBINED TEXT ===");
      console.log("analyzeCombinedText called with combined text length:", combinedText ? combinedText.length : 0);
      console.log("Instructions:", instructions);
      console.log("Strict mode:", strictMode);
      
      if (!combinedText || typeof combinedText !== 'string') {
        console.log("Invalid combined text input");
        return {
          summary: "Invalid text input",
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: "",
        };
      }
      
      // Limit text length for processing
      let processedText = combinedText;
      if (combinedText.length > AIConfig.MAX_COMBINED_TEXT_LENGTH) {
        processedText = combinedText.substring(0, AIConfig.MAX_COMBINED_TEXT_LENGTH);
        console.log(`Combined text truncated to ${AIConfig.MAX_COMBINED_TEXT_LENGTH} characters`);
      }
      
      console.log("Sending combined text:", processedText.substring(0, 200) + "...");
      
      // // Clean up expired cache entries
      // this.cleanupExpiredCache();
      // 
      // const cacheKey = this.generateCacheKey(processedText, instructions);
      // 
      // // Check cache with TTL consideration
      // if (this.analysisCache.has(cacheKey)) {
      //   const timestamp = this.cacheTimestamps.get(cacheKey);
      //   if (timestamp && (Date.now() - timestamp <= this.cacheTTL)) {
      //     console.log("Returning cached result");
      //     return this.analysisCache.get(cacheKey);
      //   } else {
      //     // Remove expired entry
      //     this.analysisCache.delete(cacheKey);
      //     this.cacheTimestamps.delete(cacheKey);
      //   }
      // }

      try {
        // Используем новый PromptService для генерации комбинированного промпта
        const prompt = PromptService.getCombinedAnalysisPrompt(processedText);

        console.log("Combined prompt built, calling queryLocalModel");
        console.log("Prompt data preview:", typeof prompt === 'string' ? prompt.substring(0, 200) : JSON.stringify(prompt, null, 2));
        console.log("=== КОНЕЦ ANALYZE COMBINED TEXT ===");
        
        // Основной запрос с температурой для анализа юридических текстов
        const mainResult = await this.queryLocalModel(prompt, {
          temperature: AIConfig.TEMPERATURE.ANALYSIS,
          format: "json"
        });

        console.log("Main model response received:", typeof mainResult);
        if (typeof mainResult === 'string') {
          console.log("Main model response (first 200 chars):", mainResult.substring(0, 200));
        }

        const parsedMainResult = this.safeParseResponse(mainResult);
        console.log("Parsed main result:", parsedMainResult);

        // If parsing failed, return error object
        if (!parsedMainResult) {
          console.log("Failed to parse main model response");
          return {
            summary: "Failed to parse model response",
            keySentences: [],
            violations: [],
            documentDate: "",
            senderAgency: "",
          };
        }

        // Извлекаем основную информацию из результата
        const summary = parsedMainResult.summary || parsedMainResult.content || "Failed to generate brief summary";
        const keySentences = Array.isArray(parsedMainResult.keySentences) 
          ? parsedMainResult.keySentences
          : [];
        const violations = Array.isArray(parsedMainResult.violations) 
          ? parsedMainResult.violations
          : [];
        
        // Обработка нарушений для извлечения даты и ведомства
        let documentDate = parsedMainResult.eventDate || parsedMainResult.documentDate || parsedMainResult.sentDate || "";
        let senderAgency = parsedMainResult.senderAgency || parsedMainResult.agency || "";
        
        // Если не нашли дату и ведомство в основном ответе, ищем в массиве нарушений
        if (!documentDate && violations.length > 0) {
          const violationWithDate = violations.find(v => v.date);
          if (violationWithDate) {
            documentDate = violationWithDate.date;
          }
        }
        if (!senderAgency && violations.length > 0) {
          const violationWithAgency = violations.find(v => v.agency);
          if (violationWithAgency) {
            senderAgency = violationWithAgency.agency;
          }
        }

        const enhancedResult = {
          summary,
          keySentences,
          violations,
          eventDate: documentDate, // Use the extracted date as eventDate for chronicle purposes
          documentDate: documentDate,
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
        
        // // Save result to cache with timestamp
        // this.analysisCache.set(cacheKey, enhancedResult);
        // this.cacheTimestamps.set(cacheKey, Date.now());
        
        console.log("Combined analysis completed successfully:", enhancedResult);
        return enhancedResult;
      } catch (error) {
        console.error("Error in analyzeCombinedText:", error);
        console.error("Error stack:", error.stack);
        // Return default object in case of error with same format as successful result
        return {
          summary: "Error analyzing document: " + error.message,
          keySentences: [],
          violations: [],
          documentDate: "",
          senderAgency: "",
        };
      }
    } catch (error) {
      console.error("Unexpected error in analyzeCombinedText:", error);
      console.error("Error stack:", error.stack);
      // Return default object in case of error with same format as successful result
      return {
        summary: "Unexpected error: " + error.message,
        keySentences: [],
        violations: [],
        documentDate: "",
        senderAgency: "",
      };
    }
  }

  // Универсальный метод анализа текста через PromptService
  async analyzeText(text, options = {}) {
    const { sourceType = 'user_explanation', instructions = '', strictMode = false, ...otherOptions } = options;
    
    const prompt = PromptService.getAnalysisPrompt(text, {
      sourceType,
      instructions,
      strictMode,
      ...otherOptions
    });
    
    const result = await this.queryLocalModel(prompt, {
      temperature: AIConfig.TEMPERATURE.ANALYSIS,
      format: "json"
    });

    // Добавляем тип источника в результат
    return {
      ...result,
      sourceType,
      analyzedAt: new Date().toISOString()
    };
  }

  // Генерация текста для летописи
  async generateChronicleText(documentData, eventType, existingTimeline = []) {
    const sourceType = documentData.sourceType || 'user_explanation'; // Default to user_explanation if not specified
    
    const prompt = PromptService.getChroniclePrompt(
      documentData, 
      eventType, 
      existingTimeline,
      sourceType // Pass sourceType to PromptService
    );
    
    // Для летописи используем JSON формат, чтобы получить структурированный ответ
    const response = await this.queryLocalModel(prompt, {
      temperature: AIConfig.TEMPERATURE.CHRONICLE,
      format: "json"
    });
    
    // Обработка ответа от ИИ - ожидаем JSON с полем content
    if (typeof response === 'object' && response !== null) {
      // Возвращаем только поле content из JSON ответа
      return response.content || response.text || response.summary || JSON.stringify(response);
    } else if (typeof response === 'string') {
      // Если получили строку, пробуем распарсить как JSON и извлечь content
      try {
        const parsed = JSON.parse(response);
        return parsed.content || parsed.text || parsed.summary || response;
      } catch (e) {
        // Если не удалось распарсить, возвращаем строку как есть
        return response;
      }
    } else {
      return String(response);
    }
  }

  // Извлечение ключевых предложений
  async extractKeySentences(text, sourceType) {
    const prompt = PromptService.getKeySentencesPrompt(text, sourceType);
    const result = await this.queryLocalModel(prompt, {
      temperature: AIConfig.TEMPERATURE.KEY_SENTENCES,
      format: "json"
    });
    
    // Возвращаем результат, который должен быть массивом предложений
    if (Array.isArray(result)) {
      return result.filter((p) => p && p.length > 5);
    } else if (typeof result === 'object' && result !== null && Array.isArray(result.keySentences)) {
      return result.keySentences.filter((p) => p && p.length > 5);
    } else {
      // Если не получили массив, возвращаем пустой массив
      return [];
    }
  }

  // Генерация жалобы
  async generateComplaint(analysisData, targetAgency, sourceType) {
    const prompt = PromptService.getComplaintPrompt(analysisData, targetAgency, sourceType);
    return await this.queryLocalModel(prompt, {
      temperature: AIConfig.TEMPERATURE.COMPLAINT,
      format: "json"
    });
  }



  // Вспомогательные методы




  // Методы управления кэшем
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

  safeParseResponse(response) {
    console.log("=== НАЧАЛО SAFE PARSE RESPONSE ===");
    console.log("Тип ответа:", typeof response);
    console.log("Ответ (первые 500 символов):", typeof response === 'string' ? response.substring(0, 500) : JSON.stringify(response, null, 2));
    
    // If response is an object from Ollama API, extract the actual response
    if (typeof response === "object" && response !== null && response.response) {
      console.log("Ответ является объектом Ollama API, извлекаем response");
      // Check if response.response is already parsed
      if (typeof response.response === "object") {
        console.log("response.response уже является объектом");
        console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
        return response.response;
      }
      
      // If response.response is a string, parse it
      if (typeof response.response === "string") {
        console.log("response.response является строкой, парсим её");
        try {
          const parsed = JSON.parse(response.response);
          console.log("Успешный парсинг JSON из response.response");
          console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
          return parsed;
        } catch (parseError) {
          console.error("Failed to parse response.response:", parseError);
          // Fall through to string parsing logic
          response = response.response;
        }
      }
    }
    
    // If response is already an object, return it as is
    if (typeof response === "object" && response !== null) {
      console.log("Ответ уже является объектом");
      console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
      return response;
    }
    
    // If response is a string
    if (typeof response === "string") {
      console.log("Ответ является строкой, попытка парсинга");
      // Attempt 1: Direct parsing of entire string as JSON
      try {
        const parsed = JSON.parse(response);
        console.log("Успешный парсинг JSON");
        console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
        return parsed;
      } catch (directParseError) {
        console.error("Direct JSON parse failed:", directParseError);
        // Attempt 2: Extract JSON from markdown code blocks
        try {
          const jsonMatch = response.match(/```(?:json)?\s*({.*?})\s*```/s);
          if (jsonMatch && jsonMatch[1]) {
            const parsed = JSON.parse(jsonMatch[1]);
            console.log("Успешный парсинг JSON из markdown");
            console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
            return parsed;
          }
        } catch (markdownParseError) {
          console.error("Markdown JSON parse failed:", markdownParseError);
        }
        
        // Attempt 3: Manual extraction of key fields
        try {
          const summaryMatch = response.match(/"summary"\s*:\s*"([^\"]+)"/);
          const keySentencesMatch = response.match(/"keySentences"\s*:\s*(\[.*?\])/);
          const violationsMatch = response.match(/"violations"\s*:\s*(\[.*?\])/);
          
          const result = {
            summary: summaryMatch ? summaryMatch[1] : "Failed to extract summary",
            keySentences: keySentencesMatch ? JSON.parse(keySentencesMatch[1]) : [],
            violations: violationsMatch ? JSON.parse(violationsMatch[1]) : []
          };
          console.log("Успешная ручная распаковка ответа");
          console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
          return result;
        } catch (manualParseError) {
          console.error("Manual JSON parse failed:", manualParseError);
        }
      }
    }
    
    // If all parsing attempts failed
    console.error("All parsing attempts failed for response:", response);
    console.log("=== КОНЕЦ SAFE PARSE RESPONSE ===");
    return null;
  }

  normalizeError(error) {
    console.log("Начало normalizeError");
    console.log("Error:", error);
    // Implementation for normalizing error
    return error;
  }
}
export default AIService


