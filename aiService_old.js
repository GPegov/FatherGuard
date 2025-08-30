commit 7a0a3187a3883a026a0ac4056114288e9b7d43cc
Author: GPegov <0280029@bk.ru>
Date:   Sat Aug 9 23:33:48 2025 +0500

    анализ текса работает, краткая суть выделяется, но существенные параграфы нет.

diff --git a/backend/services/aiService.js b/backend/services/aiService.js
index 57092a1..7f4f1e7 100644
--- a/backend/services/aiService.js
+++ b/backend/services/aiService.js
@@ -1,113 +1,204 @@
-
 import axios from "axios";
+import { readFile } from "fs/promises";
 
-export class AIService {
+class AIService {
   constructor() {
-    this.baseUrl = "http://localhost:11434/api/generate";
-    this.model = "deepseek-r1:14b";
+    this.localModelUrl = process.env.LOCAL_MODEL_URL || "http://localhost:11434";
+    this.modelName = "llama3:8b";
+    this.defaultOptions = {
+      temperature: 0.3,
+      max_tokens: 3000,
+      repeat_penalty: 1.2,
+      format: "json"
+    };
+    this.analysisCache = new Map();
   }
 
   /**
-   * Базовый метод для строковых запросов
+   * Основной метод для взаимодействия с локальной моделью
    */
-  async queryModelString(prompt, options = {}) {
+  async queryLocalModel(prompt, customOptions = {}) {
+    const options = {
+      ...this.defaultOptions,
+      ...customOptions,
+      prompt: this.preparePrompt(prompt)
+    };
+
     try {
       const response = await axios.post(
-        this.baseUrl,
+        `${this.localModelUrl}/api/generate`,
         {
-          model: this.model,
-          prompt: prompt,
-          format: "text", // Запрашиваем текстовый ответ
-          stream: false,
-          options: {
-            temperature: options.temperature || 0.3,
-            max_tokens: options.max_tokens || 4096,
-          },
+          model: this.modelName,
+          ...options
         },
         {
-          timeout: 500000,
-          headers: { "Content-Type": "application/json" },
+          timeout: 120000
         }
       );
-
-      // Возвращаем чистый текст ответа
-      return response.data?.response || response.data;
+      
+      return this.parseModelResponse(response.data);
     } catch (error) {
-      console.error("Ошибка запроса к модели:", error);
-      throw error;
+      console.error("Model query error:", {
+        error: error.response?.data || error.message,
+        config: error.config
+      });
+      throw this.normalizeError(error);
     }
   }
 
   /**
-   * Генерация краткой сути (этап 1)
+   * Улучшенный анализ юридического текста
    */
-  async generateSummary(text) {
-    const prompt = `Сгенерируй краткую суть (3-5 предложений) следующего текста:\n\n${text.substring(
-      0,
-      5000
-    )}\n\nКраткая суть:`;
-    const summary = await this.queryModelString(prompt, { temperature: 0.2 });
-    return summary.trim();
+  async analyzeLegalText(text, instructions = "", strictMode = false) {
+    const cacheKey = this.generateCacheKey(text, instructions);
+    if (this.analysisCache.has(cacheKey)) {
+      return this.analysisCache.get(cacheKey);
+    }
+
+    const prompt = this.buildAnalysisPrompt(text, instructions, strictMode);
+    const result = await this.queryLocalModel(prompt, {
+      temperature: strictMode ? 0.1 : 0.3
+    });
+
+    // Добавляем автоматическое извлечение даты и ведомства
+    const enhancedResult = {
+      ...result,
+      documentDate: this.extractDate(text) || "",
+      senderAgency: this.extractAgency(text) || ""
+    };
+
+    this.analysisCache.set(cacheKey, enhancedResult);
+    return enhancedResult;
   }
 
   /**
-   * Выделение ключевых параграфов (этап 2)
+   * Генерация жалобы с улучшенным промптом (версия 2)
    */
-  async extractKeyParagraphs(text) {
-    const prompt = `Выдели 3-5 самых важных дословных цитат из текста (сохрани оригинальную формулировку):\n\n${text.substring(
-      0,
-      5000
-    )}\n\nЦитаты (в формате JSON-массива): ["цитата1", "цитата2"]`;
-    const paragraphsStr = await this.queryModelString(prompt, {
-      temperature: 0.1,
+  async generateComplaintV2(documentText, agency, relatedDocuments = []) {
+    const prompt = this.buildComplaintPromptV2(documentText, agency, relatedDocuments);
+    const response = await this.queryLocalModel(prompt, {
+      temperature: 0.5,
+      max_tokens: 3000
     });
 
-    try {
-      // Пытаемся извлечь JSON из ответа
-      const jsonMatch = paragraphsStr.match(/\[.*\]/s);
-      return jsonMatch ? JSON.parse(jsonMatch[0]) : [paragraphsStr];
-    } catch (e) {
-      console.warn("Не удалось распарсить цитаты, возвращаем текст как есть");
-      return [paragraphsStr];
-    }
+    return {
+      content: response.content || this.generateDefaultComplaint(documentText, agency),
+      violations: response.identifiedViolations || [],
+      analysis: response.legalAnalysis || ""
+    };
   }
-  async detectViolations(text) {
-    const prompt = `Проанализируй текст на нарушения законодательства. Верни JSON-массив:
-[
-  {
-    "law": "Название закона",
-    "article": "Статья",
-    "description": "Описание нарушения"
+
+  // Вспомогательные методы:
+
+  preparePrompt(text) {
+    return `Ты - юридический ассистент. Анализируй документы и создавай жалобы.
+Требования к ответу:
+1. Всегда возвращай валидный JSON
+2. Будь точным в цитатах
+3. Ссылайся на конкретные законы
+4. Извлекай даты и ведомства из текста
+
+${text}`;
   }
-]
 
-Текст: ${text.substring(0, 5000)}`;
+  buildAnalysisPrompt(text, instructions, strictMode) {
+    return JSON.stringify({
+      task: "ANALYZE_LEGAL_DOCUMENT",
+      text: text.substring(0, 10000),
+      requirements: {
+        summaryLength: "3-5 предложений",
+        keyParagraphs: {
+          count: 3,
+          exactQuotes: true
+        },
+        extractDates: true,
+        identifyAgencies: true,
+        strictAnalysis: strictMode,
+        additionalInstructions: instructions
+      },
+      lawsToCheck: [
+        "Федеральный закон 'Об исполнительном производстве' №229-ФЗ",
+        "Семейный кодекс РФ",
+        "КоАП РФ",
+        "ФЗ 'О судебных приставах'"
+      ]
+    });
+  }
+
+  buildComplaintPromptV2(text, agency, relatedDocuments) {
+    return JSON.stringify({
+      task: "GENERATE_COMPLAINT_V2",
+      agency,
+      sourceText: text.substring(0, 5000),
+      relatedDocuments: relatedDocuments.map(doc => doc.substring(0, 2000)),
+      requirements: {
+        style: "Официальный",
+        sections: [
+          "Шапка (кому/от кого)",
+          "Описание ситуации",
+          "Ссылки на связанные документы",
+          "Нарушения",
+          "Требования",
+          "Приложения"
+        ],
+        includeReferences: true,
+        citeLaws: true
+      }
+    });
+  }
 
-    const violationsStr = await this.queryModelString(prompt);
+  extractDate(text) {
+    // Простая логика извлечения даты (можно улучшить)
+    const dateRegex = /(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/;
+    const match = text.match(dateRegex);
+    return match ? match[0] : null;
+  }
+
+  extractAgency(text) {
+    // Базовое извлечение ведомств
+    const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен", "МВД", "Росреестр"];
+    return agencies.find(agency => text.includes(agency)) || null;
+  }
+
+  generateDefaultComplaint(text, agency) {
+    return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${
+      text.substring(0, 500)
+    }\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
+  }
+
+  parseModelResponse(data) {
     try {
-      return JSON.parse(violationsStr.match(/\[.*\]/s)[0]);
-    } catch {
-      return [];
+      const rawResponse = data.response || data;
+      const parsed = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
+      
+      if (parsed.error) {
+        throw new Error(parsed.error);
+      }
+      
+      return parsed;
+    } catch (e) {
+      console.error("Response parsing error:", e);
+      throw new Error("Неверный формат ответа от модели");
     }
   }
-  /**
-   * 
-  
 
-   * Полный анализ документа (последовательные запросы)
-   */
-  async analyzeDocument(text) {
-    const [summary, keyParagraphs] = await Promise.all([
-      this.generateSummary(text),
-      this.extractKeyParagraphs(text),
-    ]);
+  normalizeError(error) {
+    const serverError = error.response?.data?.error;
+    if (serverError) {
+      return new Error(`Модель вернула ошибку: ${serverError}`);
+    }
+    return error;
+  }
 
-    return {
-      summary,
-      keyParagraphs,
-      violations: [], 
-    };
+  generateCacheKey(text, instructions = "") {
+    const str = text.substring(0, 200) + instructions;
+    let hash = 0;
+    for (let i = 0; i < str.length; i++) {
+      hash = (hash << 5) - hash + str.charCodeAt(i);
+      hash |= 0;
+    }
+    return hash.toString(36);
   }
 }
 
-export default new AIService();
+export default new AIService();
\ No newline at end of file
