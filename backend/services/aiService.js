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
      console.log("=== НАЧАЛО QUERY LOCAL MODEL ===");
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
        // Всегда отправляем prompt как строку
        let finalPrompt = typeof preparedPrompt === 'string' ? preparedPrompt : String(preparedPrompt);
        
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
        console.log("Prompt data preview:", typeof promptData === 'string' ? promptData.substring(0, 200) : JSON.stringify(promptData, null, 2));
        console.log("=== КОНЕЦ ANALYZE LEGAL TEXT ===");
        
        // Основной запрос с температурой 0.4 для получения краткой сути, нарушений и другой информации
        const mainResult = await this.queryLocalModel(promptData, {
          temperature: 0.4,
          format: "json",
          taskType: "legal_analysis"
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
        const documentDate = parsedMainResult.documentDate || parsedMainResult.sentDate || this.extractDate(processedText) || "";
        const senderAgency = parsedMainResult.senderAgency || parsedMainResult.agency || this.extractAgency(processedText) || "";

        // Дополнительный запрос с температурой 0.1 для извлечения важных предложений
        console.log("=== НАЧАЛО ИЗВЛЕЧЕНИЯ ВАЖНЫХ ПРЕДЛОЖЕНИЙ ===");
        const keySentencesPrompt = `Выступи в роли опытного юриста. Тщательно проанализируй нижеприведённый текст документа и предоставь массив из 5 самых важных предложений из документа.

Текст документа для анализа:
${processedText || ""}

Верни только массив предложений в формате JSON:
[
  "предложение 1",
  "предложение 2",
  "предложение 3",
  "предложение 4",
  "предложение 5"
]`;

        console.log("Key sentences prompt built, calling queryLocalModel with temperature 0.1");
        const keySentencesResult = await this.queryLocalModel(keySentencesPrompt, {
          temperature: 0.1,
          format: "json",
        });

        console.log("Key sentences model response received:", typeof keySentencesResult);
        if (typeof keySentencesResult === 'string') {
          console.log("Key sentences model response (first 200 chars):", keySentencesResult.substring(0, 200));
        }

        const parsedKeySentencesResult = this.safeParseResponse(keySentencesResult);
        console.log("Parsed key sentences result:", parsedKeySentencesResult);

        // Извлекаем важные предложения из результата
        const keySentences = Array.isArray(parsedKeySentencesResult) 
          ? parsedKeySentencesResult.filter((p) => p && p.length > 5)
          : (Array.isArray(parsedMainResult.keySentences) 
            ? parsedMainResult.keySentences.filter((p) => p && p.length > 5)
            : []);

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
          const summaryMatch = response.match(/"summary"\s*:\s*"([^"]+)"/);
          const keySentencesMatch = response.match(/"keySentences"\s*:\s*($[^$]*$)/);
          const violationsMatch = response.match(/"violations"\s*:\s*($[^$]*$)/);
          
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
      
      // Анализируем вложение через AI-сервис, используя специализированный промпт для официальных документов
      console.log("Вызов queryLocalModel для анализа вложения с использованием специализированного промпта");
      const promptData = this.buildAttachmentAnalysisPrompt(processedText, instructions);
      const analysisResult = await this.queryLocalModel(promptData, {
        temperature: 0.4,
        format: "json",
        taskType: "attachment_analysis"
      });

      const parsedResult = this.safeParseResponse(analysisResult);
      console.log("Parsed attachment analysis result:", parsedResult);

      // Извлекаем основную информацию из результата
      const documentType = parsedResult.documentType || parsedResult.type || "Документ";
      const summary = parsedResult.summary || parsedResult.content || "Не удалось сгенерировать краткую суть";
      const sentDate = parsedResult.sentDate || parsedResult.documentDate || this.extractDate(processedText) || "";
      const senderAgency = parsedResult.senderAgency || parsedResult.agency || this.extractAgency(processedText) || "";
      const violations = Array.isArray(parsedResult.violations) 
        ? parsedResult.violations
        : [];

      // Дополнительный запрос с температурой 0.1 для извлечения важных предложений из официального документа
      console.log("=== НАЧАЛО ИЗВЛЕЧЕНИЯ ВАЖНЫХ ПРЕДЛОЖЕНИЙ ИЗ ВЛОЖЕНИЯ ===");
      const keySentencesPrompt = `Выступи в роли опытного юриста. Тщательно проанализируй нижеприведённый текст официального документа (ответ органа на жалобу, постановление, уведомление и т.п.) и предоставь массив из 5 самых важных предложений, касающихся сути ответа, требований, ограничений или изменений в статусе.

Текст официального документа для анализа:
${processedText || ""}

Верни только массив предложений в формате JSON:
[
  "предложение 1",
  "предложение 2",
  "предложение 3",
  "предложение 4",
  "предложение 5"
]`;

      console.log("Key sentences prompt for attachment built, calling queryLocalModel with temperature 0.1");
      const keySentencesResult = await this.queryLocalModel(keySentencesPrompt, {
        temperature: 0.1,
        format: "json",
        taskType: "attachment_analysis"
      });

      const parsedKeySentencesResult = this.safeParseResponse(keySentencesResult);
      console.log("Parsed key sentences result for attachment:", parsedKeySentencesResult);

      // Извлекаем важные предложения из результата
      const keySentences = Array.isArray(parsedKeySentencesResult) 
        ? parsedKeySentencesResult.filter((p) => p && p.length > 5)
        : (Array.isArray(parsedResult.keySentences) 
          ? parsedResult.keySentences.filter((p) => p && p.length > 5)
          : []);

      // Формируем результат в формате вложения
      const attachmentResult = {
        documentType,
        sentDate,
        senderAgency,
        summary,
        keySentences,
        violations: violations // также сохраняем нарушения, обнаруженные в официальном документе
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
        violations: []
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
    console.log("=== НАЧАЛО BUILD ANALYSIS PROMPT ===");
    console.log("Text length:", text ? text.length : 0);
    console.log("Instructions:", instructions);
    console.log("Strict mode:", strictMode);
    
    // Формируем строку промпта для анализа пояснений клиента
    let prompt = `Выступи в роли опытного юриста. Тщательно проанализируй нижеприведённый текст - это пояснение клиента, в котором он описывает ситуацию с его слов. Предоставь структурированный ответ в формате JSON с полями:
- summary: краткая суть пояснения клиента (2-3 предложения) - изложи суть от лица клиента, например: "Я подал прошение", "в отношении меня завели исполнительное производство"
- keySentences: массив из 5 самых важных предложений из пояснений клиента
- violations: массив выявленных нарушений законодательства (если есть)
- documentDate: дата, упомянутая в пояснениях (если указана)
- senderAgency: ведомство, упомянутое в пояснениях как нарушитель (если указано)

Текст пояснений клиента для анализа:
${text || ""}`;
    
    // Добавляем инструкции, если они есть
    if (instructions && instructions.trim()) {
      prompt = `${prompt}

ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:
${instructions}`;
    }
    
    // Добавляем указания по режиму строгого анализа
    if (strictMode) {
      prompt = `${prompt}

ПРИМЕНЯЙТЕ СТРОГИЙ АНАЛИЗ ДОКУМЕНТА.`;
    }
    
    console.log("Сформированный prompt (первые 200 символов):", prompt.substring(0, 200));
    console.log("Общая длина prompt:", prompt.length);
    console.log("=== КОНЕЦ BUILD ANALYSIS PROMPT ===");
    return prompt;
  }

  buildAttachmentAnalysisPrompt(text, instructions) {
    console.log("=== НАЧАЛО BUILD ATTACHMENT ANALYSIS PROMPT ===");
    console.log("Text length:", text ? text.length : 0);
    console.log("Instructions:", instructions);
    
    // Формируем строку промпта для анализа официального документа (вложения)
    let prompt = `Выступи в роли опытного юриста. Тщательно проанализируй нижеприведённый официальный документ (ответ органа на жалобу, постановление, уведомление и т.п.) и предоставь структурированный ответ в формате JSON с полями:
- documentType: тип документа (постановление, уведомление, ответ на жалобу и т.д.)
- summary: краткая суть официального документа (2-3 предложения) - изложи суть от лица получателя документа, например: "Отказано в удовлетворении жалобы", "Производство приостановлено"
- keySentences: массив из 5 самых важных предложений из официального документа
- violations: массив выявленных нарушений законодательства в действиях/бездействии органа (если есть)
- sentDate: дата документа (если указана)
- senderAgency: ведомство-отправитель (если указано)

Текст официального документа для анализа:
${text || ""}`;
    
    // Добавляем инструкции, если они есть
    if (instructions && instructions.trim()) {
      prompt = `${prompt}

ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:
${instructions}`;
    }
    
    console.log("Сформированный prompt для анализа вложения (первые 200 символов):", prompt.substring(0, 200));
    console.log("Общая длина prompt:", prompt.length);
    console.log("=== КОНЕЦ BUILD ATTACHMENT ANALYSIS PROMPT ===");
    return prompt;
  }

  buildComplaintPrompt(analysisData, agency) {
    console.log("=== НАЧАЛО BUILD COMPLAINT PROMPT ===");
    console.log("Agency:", agency);
    console.log("Analysis data:", analysisData);
    
    // Создаем текстовое представление данных для анализа
    let textContent = "Краткая суть документа: " + (analysisData.summary || 'не указана') + "\n\n" +
                      "Важные предложения из документа:\n" +
                      (Array.isArray(analysisData.keySentences) ? analysisData.keySentences.slice(0, 5).map((s, i) => `${i+1}. ${s}`).join('\n') : 'не указаны') + "\n\n" +
                      "Выявленные нарушения:\n" +
                      (Array.isArray(analysisData.violations) && analysisData.violations.length > 0 ? 
                        analysisData.violations.map((v, i) => `${i+1}. ${v}`).join('\n') : 
                        'нарушения не выявлены') + "\n\n" +
                      "Дата документа: " + (analysisData.documentDate || 'не указана') + "\n" +
                      "Ведомство-отправитель: " + (analysisData.senderAgency || 'не указано');

    // Добавляем информацию о вложениях, если есть
    if (Array.isArray(analysisData.attachments) && analysisData.attachments.length > 0) {
      textContent += `

Связанные документы (${analysisData.attachments.length} шт.):`;
      
      analysisData.attachments.slice(0, 3).forEach((att, index) => {
        textContent += `

Документ ${index + 1}:
Краткая суть: ${att.summary || 'не указана'}
Дата: ${att.documentDate || 'не указана'}
Ведомство: ${att.senderAgency || 'не указано'}`;
      });
    }

    // Создаем структурированные данные для AI
    const promptData = {
      task: "generate_complaint",
      agency: agency,
      text: textContent
    };

    console.log("Сформированный prompt объект:", promptData);
    console.log("Длина текста в prompt:", textContent.length);
    console.log("Текст prompt (первые 500 символов):", textContent.substring(0, 500));
    console.log("=== КОНЕЦ BUILD COMPLAINT PROMPT ===");
    return promptData;
  }

  preparePrompt(prompt, taskType, options) {
    console.log("=== НАЧАЛО PREPARE PROMPT ===");
    console.log("Тип prompt:", typeof prompt);
    console.log("Task type:", taskType);
    console.log("Options:", options);
    
    // Если prompt является объектом (как в случае с buildAnalysisPrompt), используем его поля
    if (typeof prompt === 'object' && prompt !== null) {
      const { text, instructions, strictMode, task, agency } = prompt;
      console.log("Prompt является объектом, поля:", { text: text ? text.substring(0, 100) : 'null', instructions, strictMode, task, agency });
      
      // Формируем промпт в зависимости от типа задачи
      let basePrompt = "";
      
      // Для анализа пояснений клиента передаем только текст пользователя
      if (task === 'legal_analysis') {
        basePrompt = `Выступи в роли опытного юриста. Тщательно проанализируй нижеприведённый текст - это пояснение клиента, в котором он описывает ситуацию с его слов. Предоставь структурированный ответ в формате JSON с полями:
- summary: краткая суть пояснения клиента (2-3 предложения) - изложи суть от лица клиента, например: "Я подал прошение", "в отношении меня завели исполнительное производство"
- keySentences: массив из 5 самых важных предложений из пояснений клиента
- violations: массив выявленных нарушений законодательства (если есть)
- documentDate: дата, упомянутая в пояснениях (если указана)
- senderAgency: ведомство, упомянутое в пояснениях как нарушитель (если указано)

Текст пояснений клиента для анализа:
${text || ""}`;
      }
      
      // Для анализа официальных документов (вложений) используем специализированный промпт
      else if (task === 'attachment_analysis') {
        basePrompt = `Выступи в роли опытного юриста. Тщательно проанализируй нижеприведённый официальный документ (ответ органа на жалобу, постановление, уведомление и т.п.) и предоставь структурированный ответ в формате JSON с полями:
- documentType: тип документа (постановление, уведомление, ответ на жалобу и т.д.)
- summary: краткая суть официального документа (2-3 предложения) - изложи суть от лица получателя документа, например: "Отказано в удовлетворении жалобы", "Производство приостановлено"
- keySentences: массив из 5 самых важных предложений из официального документа
- violations: массив выявленных нарушений законодательства в действиях/бездействии органа (если есть)
- sentDate: дата документа (если указана)
- senderAgency: ведомство-отправитель (если указано)

Текст официального документа для анализа:
${text || ""}`;
      }
      
      // Для генерации жалоб передаем только текст
      else if (task === 'generate_complaint') {
        basePrompt = `Выступи в роли опытного юриста. Создай официальную жалобу в ${agency} от первого лица заявителя.
ОСНОВНЫЕ ТРЕБОВАНИЯ:
1. ИСПОЛЬЗУЙТЕ ДЕЛОВОЙ СТИЛЬ, СТРОГО ПО СУЩЕСТВУ
2. УКАЖИТЕ КОНКРЕТНЫЕ НАРУШЕНИЯ ЗАКОНОВ
3. СДЕЛАЙТЕ ССЫЛКИ НА СТАТЬИ ЗАКОНОВ
4. ПРЕДЛОЖИТЕ КОНКРЕТНЫЕ ТРЕБОВАНИЯ
5. НЕ ВКЛЮЧАЙТЕ ПОЛНЫЙ ТЕКСТ ДОКУМЕНТА

ВЕРНИТЕ РЕЗУЛЬТАТ В ФОРМАТЕ JSON:
{
  "content": "текст жалобы"
}

Текст для анализа и создания жалобы:
${text || ""}`;
      }
      
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
      
      console.log("Сформированный prompt (первые 200 символов):", basePrompt.substring(0, 200));
      console.log("Общая длина prompt:", basePrompt.length);
      console.log("=== КОНЕЦ PREPARE PROMPT ===");
      return basePrompt;
    }
    
    // Если prompt - строка, возвращаем её как есть
    console.log("Prompt является строкой");
    console.log("Длина prompt:", typeof prompt === 'string' ? prompt.length : 'unknown');
    console.log("=== КОНЕЦ PREPARE PROMPT ===");
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