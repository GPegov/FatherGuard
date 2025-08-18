import { defineStore } from "pinia";
import axios from "axios";
import AIService from "../../../backend/services/aiService";

export const useAIStore = defineStore("ai", {
  state: () => ({
    isLoading: false,
    error: null,
    apiStatus: "unknown",
    apiUrl: "http://localhost:11434/api/generate",
    model: "llama3.1/18/8192",
    availableModels: [
      {
        name: "llama3.1/18/8192",
        description: "using 18 treads with 8192 num_ctx",
        parameters: {
          temperature: 0.3,
          top_p: 0.9,
          // num_ctx: 16384,
        },
      },
    ],
    agencies: ["ФССП", "Прокуратура", "Суд", "Омбудсмен"],
  }),

  actions: {
    _initAIService() {
      return new AIService(this.apiUrl, this.model);
    },

    async checkServerStatus() {
      try {
        const response = await axios.get("http://localhost:11434/api/tags", {
          timeout: 3000,
        });
        this.apiStatus = response.status === 200 ? "ready" : "error";
        return this.apiStatus;
      } catch (error) {
        this.apiStatus = "offline";
        throw new Error("AI сервер недоступен");
      }
    },

    async generateSummary(text) {
      this.isLoading = true;
      this.error = null;

      try {
        const aiService = this._initAIService();
        const summary = await aiService.queryLocalModel(text, {
          taskType: "summary",
        });
        
        

        console.log("Сгенерированная краткая суть:", summary);
        return summary || "Не удалось сгенерировать краткую суть";
      } catch (error) {
        console.error("Ошибка генерации сводки:", error);
        this.error = error.message;
        return "Ошибка генерации краткой сводки";
      } finally {
        this.isLoading = false;
      }
    },

    async extractKeyParagraphs(text) {
      this.isLoading = true;
      this.error = null;

      try {
        const aiService = this._initAIService();
        const response = await aiService.analyzeLegalText(text);
        return response.paragraphs || [];
      } catch (error) {
        console.error("Ошибка extractKeyParagraphs:", error);
        this.error = error.message;
        return ["Не удалось извлечь ключевые параграфы"];
      } finally {
        this.isLoading = false;
      }
    },

    async detectViolations(text) {
      this.isLoading = true;
      this.error = null;

      try {
        const aiService = this._initAIService();
        const response = await aiService.queryLocalModel(text, {
          taskType: "violations",
          temperature: 0.5,
        });
        return response?.response || "Не удалось проанализировать нарушения";
      } catch (error) {
        console.error("Ошибка анализа нарушений:", error);
        this.error = error.message;
        return "Не удалось проанализировать нарушения. Проверьте текст документа.";
      } finally {
        this.isLoading = false;
      }
    },

    async analyzeAttachment(text) {
      this.isLoading = true;
      this.error = null;

      try {
        const aiService = this._initAIService();
        const response = await aiService.queryLocalModel(text, {
          taskType: "attachment",
          temperature: 0.3,
          format: "json",
        });
        return aiService.parseAttachmentAnalysis(response);
      } catch (error) {
        console.error("Ошибка анализа вложения:", error);
        this.error = error.message;
        return {
          documentType: "Неизвестный тип",
          sentDate: "",
          senderAgency: "",
          summary: "Ошибка анализа документа",
          keyParagraphs: [],
        };
      } finally {
        this.isLoading = false;
      }
    },

    async analyzeDocument(text) {
      this.isLoading = true;
      this.error = null;

      try {
        const [summary, paragraphs, violations] = await Promise.all([
          this.generateSummary(text),
          this.extractKeyParagraphs(text),
          this.detectViolations(text),
        ]);

        return {
          summary: summary || "Не удалось сгенерировать сводку",
          paragraphs: Array.isArray(paragraphs)
            ? paragraphs
            : ["Ошибка извлечения цитат"],
          violations: violations || "Ошибка анализа нарушений",
          status: "complete",
        };
        
      } catch (error) {
        console.error("Ошибка анализа документа:", error);
        this.error = error.message;
        return {
          summary: "Системная ошибка анализа",
          paragraphs: ["Системная ошибка"],
          violations: "Системная ошибка",
          status: "error",
        };
      } finally {
        this.isLoading = false;
      }
    },

    async generateAttachmentSummary(text) {
      const aiService = this._initAIService();
      return aiService.queryLocalModel(text, {
        taskType: "attachment",
        temperature: 0,
        format: "json",
      });
    },

    async generateComplaint(text, agency, violation = "") {
      this.isLoading = true;
      this.error = null;

      if (!this.agencies.includes(agency)) {
        this.error = "Указано недопустимое ведомство";
        throw new Error(this.error);
      }

      try {
        const aiService = this._initAIService();
        const prompt = `Сгенерируй официальную жалобу в ${agency} на основе документа.
                      ${violation ? `Выявленное нарушение:\n${violation}\n` : ""}
                      Текст документа:\n${text.substring(0, 3000)}`;

        const response = await aiService.queryLocalModel(prompt, {
          temperature: 0.5,
          max_tokens: 7000,
        });

        return (
          response?.response || this._generateFallbackComplaint(text, agency)
        );
      } catch (error) {
        console.error("Ошибка генерации жалобы:", error);
        this.error = error.message;
        return this._generateFallbackComplaint(text, agency);
      } finally {
        this.isLoading = false;
      }
    },

    _generateFallbackComplaint(text, agency) {
      return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${text.substring(
        0,
        500
      )}\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
    },
  },

  getters: {
    isServerOnline: (state) => state.apiStatus === "ready",
    activeModelName: (state) => {
      const model = state.availableModels.find(
        (m) => m.name === state.model
      );
      return model ? model.description : "Неизвестная модель";
    },
  },
});









// import { defineStore } from "pinia";
// import axios from "axios";
// import AIService from "../../../backend/services/aiService";

// export const useAIStore = defineStore("ai", {
//   state: () => ({
//     isLoading: false,
//     error: null,
//     apiStatus: "unknown", // 'ready', 'error', 'offline'
//     apiUrl: "http://localhost:11434/api/generate",
//     model: "llama3.1:latest",
//     availableModels: [
//       {
//         name: "llama3.1:latest",
//         description: "Llama 3.1 (latest)",
//         parameters: {
//           temperature: 0.3,
//           top_p: 0.9,
//           num_ctx: 16384,
//         },
//       },
//     ],
//     agencies: ["ФССП", "Прокуратура", "Суд", "Омбудсмен"],
//   }),

//   actions: {
//     /**
//      * Инициализация AI сервиса
//      */
//     _initAIService() {
//       return new AIService(this.apiUrl, this.activeModel);
//     },

//     /**
//      * Фильтр для удаления предложений с латинскими символами (>15)
//      */
//     _filterLatinText(text) {
//       if (!text) return text;

//       return text
//         .split(/(?<=[.!?])\s+/)
//         .filter((sentence) => {
//           const latinChars = (sentence.match(/[a-zA-Z]/g) || []).length;
//           return latinChars <= 15;
//         })
//         .join(" ")
//         .trim();
//     },

//     /**
//      * Проверка доступности AI сервера
//      */
//     async checkServerStatus() {
//       try {
//         const response = await axios.get("http://localhost:11434/api/tags", {
//           timeout: 3000,
//         });
//         this.apiStatus = response.status === 200 ? "ready" : "error";
//         return this.apiStatus;
//       } catch (error) {
//         this.apiStatus = "offline";
//         throw new Error("AI сервер недоступен");
//       }
//     },

//     /**
//      * Генерация краткой сводки
//      */
//     async generateSummary(text) {
//       this.isLoading = true;
//       this.error = null;

//       try {
//         const aiService = this._initAIService();
//         const filteredText = this._filterLatinText(text);
//         const summary = await aiService.queryLocalModel(filteredText, {
//           taskType: "summary",
//         });

//         return summary?.response || "Не удалось сгенерировать краткую суть";
//       } catch (error) {
//         console.error("Ошибка генерации сводки:", error);
//         this.error = error.message;
//         return "Ошибка генерации краткой сводки";
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     /**
//      * Извлечение ключевых параграфов
//      */
//     async extractKeyParagraphs(text) {
//       this.isLoading = true;
//       this.error = null;

//       try {
//         const aiService = this._initAIService();
//         const response = await aiService.analyzeLegalText(text);

//         // Возвращаем нормализованные параграфы
//         return response.keyParagraphs || [];
//       } catch (error) {
//         console.error("Ошибка extractKeyParagraphs:", error);
//         this.error = error.message;
//         return ["Не удалось извлечь ключевые параграфы"];
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     /**
//      * Поиск юридических нарушений
//      */
//     async detectViolations(text) {
//       this.isLoading = true;
//       this.error = null;

//       try {
//         const aiService = this._initAIService();
//         const filteredText = this._filterLatinText(text);
//         const response = await aiService.queryLocalModel(filteredText, {
//           taskType: "violations",
//           temperature: 0.5,
//         });

//         return response?.response || "Не удалось проанализировать нарушения";
//       } catch (error) {
//         console.error("Ошибка анализа нарушений:", error);
//         this.error = error.message;
//         return "Не удалось проанализировать нарушения. Проверьте текст документа.";
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     /**
//      * Анализ вложенного документа
//      */
//     async analyzeAttachment(text) {
//       this.isLoading = true;
//       this.error = null;

//       try {
//         const aiService = this._initAIService();
//         const filteredText = this._filterLatinText(text);
//         const response = await aiService.queryLocalModel(filteredText, {
//           taskType: "attachment",
//           temperature: 0.2,
//           format: "json",
//         });

//         return aiService.parseAttachmentAnalysis(response);
//       } catch (error) {
//         console.error("Ошибка анализа вложения:", error);
//         this.error = error.message;
//         return {
//           documentType: "Неизвестный тип",
//           sentDate: "",
//           senderAgency: "",
//           summary: "Ошибка анализа документа",
//           keyParagraphs: [],
//         };
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     /**
//      * Полный анализ документа
//      */
//     async analyzeDocument(text) {
//       this.isLoading = true;
//       this.error = null;

//       try {
//         const [summary, paragraphs, violations] = await Promise.all([
//           this.generateSummary(text),
//           this.extractKeyParagraphs(text),
//           this.detectViolations(text),
//         ]);

//         return {
//           summary: summary || "Не удалось сгенерировать сводку",
//           paragraphs: Array.isArray(paragraphs)
//             ? paragraphs
//             : ["Ошибка извлечения цитат"],
//           violations: violations || "Ошибка анализа нарушений",
//           status: "complete",
//         };
//       } catch (error) {
//         console.error("Ошибка анализа документа:", error);
//         this.error = error.message;
//         return {
//           summary: "Системная ошибка анализа",
//           paragraphs: ["Системная ошибка"],
//           violations: "Системная ошибка",
//           status: "error",
//         };
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     async generateAttachmentSummary(text) {
//       return this.queryLocalModel(text, {
//         taskType: "attachment",
//         temperature: 0,
//         format: "json",
//       });
//     },

//     /**
//      * Генерация жалобы
//      */
//     async generateComplaint(text, agency, violation = "") {
//       this.isLoading = true;
//       this.error = null;

//       if (!this.agencies.includes(agency)) {
//         this.error = "Указано недопустимое ведомство";
//         throw new Error(this.error);
//       }

//       try {
//         const aiService = this._initAIService();
//         const prompt = `Сгенерируй официальную жалобу в ${agency} на основе документа.
//                       ${
//                         violation ? `Выявленное нарушение:\n${violation}\n` : ""
//                       }
//                       Текст документа:\n${text.substring(0, 3000)}`;

//         const response = await aiService.queryLocalModel(prompt, {
//           temperature: 0.5,
//           max_tokens: 7000,
//         });

//         return (
//           response?.response || this._generateFallbackComplaint(text, agency)
//         );
//       } catch (error) {
//         console.error("Ошибка генерации жалобы:", error);
//         this.error = error.message;
//         return this._generateFallbackComplaint(text, agency);
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     /**
//      * Обработка параграфов
//      */
//     _postProcessParagraphs(text) {
//       if (!text) return ["Не найдено значимых цитат"];

//       // Обрабатываем как строку, если text не объект
//       const textToProcess =
//         typeof text === "string" ? text : text.response || text.content || "";

//       return textToProcess
//         .split(/(?<=[.!?])\s+/)
//         .map((p) => {
//           let cleaned = p
//             .replace(/<\|.*?\|\>|```/g, "")
//             .replace(/^["']+|["']+$/g, "")
//             .trim();
//           return cleaned.length > 15 ? cleaned : null;
//         })
//         .filter(Boolean)
//         .filter(
//           (item, index, arr) =>
//             index ===
//             arr.findIndex((i) => i.substring(0, 50) === item.substring(0, 50))
//         )
//         .slice(0, 5);
//     },

//     /**
//      * Генерация резервной жалобы при ошибке
//      */
//     _generateFallbackComplaint(text, agency) {
//       return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${text.substring(
//         0,
//         500
//       )}\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
//     },
//   },

//   getters: {
//     isServerOnline: (state) => state.apiStatus === "ready",
//     activeModelName: (state) => {
//       const model = state.availableModels.find(
//         (m) => m.name === state.activeModel
//       );
//       return model ? model.description : "Неизвестная модель";
//     },
//   },
// });

// export default useAIStore;
