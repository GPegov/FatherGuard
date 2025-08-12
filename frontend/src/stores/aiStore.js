import { defineStore } from "pinia";
import axios from "axios";

export const useAIStore = defineStore("ai", {
  state: () => ({
    isLoading: false,
    error: null,
    apiStatus: "unknown", // 'ready', 'error', 'offline'
    apiUrl: "http://localhost:11434/api/generate",
    activeModel: "llama3.1:latest",
    
    agencies: ["ФССП", "Прокуратура", "Суд", "Омбудсмен"],
  }),

  actions: {
    /**
     * Фильтр для удаления предложений с латинскими символами (>15)
     */
    _filterLatinText(text) {
      if (!text) return text;

      return text
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => {
          const latinChars = (sentence.match(/[a-zA-Z]/g) || []).length;
          return latinChars <= 15;
        })
        .join(" ")
        .trim();
    },
    

    /**
     * Формат промптов
     */
    _formatPrompt(text, model, taskType = 'default') {
      
        const systemMessages = {
          summary: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
Ты — юридический ассистент. Сгенерируй краткую суть документа по правилам:
1. Только факты из текста (без рассуждений)
2. Объем: 3-5 предложений
3. Укажи ведомство-отправитель, если оно есть
4. Выдели дату документа, если указана
5. Формат: "Документ от [дата] от [ведомство]. [Суть]"
6. Без вступительных фраз

Текст:
${text.substring(0, 7000)}

Краткая суть:`,

          paragraphs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
Выдели 3-5 УНИКАЛЬНЫХ ключевых цитат по правилам:
1. Только дословные цитаты в кавычках
2. Без повторов и похожих формулировок
3. Каждая с новой строки
4. Выделяй полные предложения (не обрезай)
5. Приоритет: цитаты с датами, номерами, ведомствами
6. Отвечай только на русском языке!
7. Без вступительных фраз!

Текст:
${text.substring(0, 7000)}

Ключевые цитаты:`,

          documentAnalysis: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
Проанализируй вложенный документ и верни JSON:
{
  "documentType": "тип (приказ, постановление и т.д.)",
  "sentDate": "дата в формате ДД.ММ.ГГГГ",
  "senderAgency": "ведомство-отправитель",
  "summary": "краткая суть (3-5 предложений)",
  "keyParagraphs": ["дословные цитаты"]
}

Текст:
${text.substring(0, 7000)}

Анализ:`,

          violations: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
Найди юридические нарушения в тексте. Формат:
- Закон: [название]
- Статья: [номер]
- Описание: [текст]
- Доказательство: [цитата (предложение полностью)]
<</SYS>>

Текст:
${text.substring(0, 7000)}

Выявленные нарушения:`
        };
        return systemMessages[taskType] || text;
      
      
    },

    /**
     * Проверка доступности AI сервера
     */
    async checkServerStatus() {
      try {
        const response = await axios.get("http://localhost:11434", {
          timeout: 3000,
        });
        this.apiStatus = response.status === 200 ? "ready" : "error";
        return this.apiStatus;
      } catch (error) {
        this.apiStatus = "offline";
        throw new Error("AI сервер недоступен");
      }
    },

    /**
     * Универсальный метод запроса к AI
     */
    async _makeAIRequest(prompt, model = state.activeModel, customOptions = {}, taskType = null) {
      const currentModel = model || this.activeModel;
      const modelConfig = this.availableModels.find(m => m.name === currentModel)?.parameters || {};
      
      const payload = {
        model: currentModel,
        prompt: this._formatPrompt(prompt, currentModel, taskType),
        stream: false,
        options: {
          temperature: customOptions.temperature ?? modelConfig.temperature ?? 0.3,
          top_p: customOptions.top_p ?? modelConfig.top_p ?? 0.9,
          num_ctx: customOptions.num_ctx ?? modelConfig.num_ctx ?? 8192
        }
      };

      try {
        const response = await axios.post(
          this.apiUrl,
          payload,
          {
            timeout: 500000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.data?.response) {
          throw new Error("Некорректный ответ от сервера AI");
        }

        return response.data.response;
      } catch (error) {
        console.error("AI Request Error:", {
          config: error.config,
          response: error.response?.data,
          error: error.message
        });

        
      
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Генерация краткой сводки
     */
    async generateSummary(text) {
      try {
        const response = await this._makeAIRequest(
          text,
          state.activeModel,
          { temperature: 0.3 },
          'summary'
        );
        
        return response.split("\n")[0].replace(/^"|"$/g, "") ||
               "Не удалось сгенерировать краткую суть";
      } catch (error) {
        console.error("Ошибка генерации сводки:", error);
        return "Ошибка генерации краткой сводки";
      }
    },

    /**
     * Извлечение ключевых параграфов
     */
    async extractKeyParagraphs(text) {
      try {
        const response = await this._makeAIRequest(
          text,
          state.activeModel,
          { temperature: 0.3 },
          'paragraphs'
        );

        const paragraphs = (response || '').split('\n')
          .map(p => p.trim().replace(/^["']|["']$/g, ''))
          .filter(p => p.length > 10)
          .slice(0, 5);

        return paragraphs.length > 0 
          ? paragraphs 
          : ['Не удалось извлечь значимые цитаты'];
      } catch (error) {
        console.error('Ошибка extractKeyParagraphs:', error);
        return ['Ошибка обработки документа'];
      }
    },

    /**
     * Поиск юридических нарушений
     */
    async detectViolations(text) {
      try {
        return await this._makeAIRequest(
          text,
          state.activeModel,
          { temperature: 0.5 },
          'violations'
        );
      } catch (error) {
        console.error("Ошибка анализа нарушений:", error);
        return "Не удалось проанализировать нарушения. Проверьте текст документа.";
      }
    },

    /**
     * Анализ вложенного документа
     */
    async analyzeAttachment(text) {
      try {
        const response = await this._makeAIRequest(
          text,
          state.activeModel,
          { temperature: 0.2 },
          'documentAnalysis'
        );
        
        return typeof response === 'string' ? JSON.parse(response) : response;
      } catch (error) {
        console.error("Ошибка анализа вложения:", error);
        return {
          documentType: "Неизвестный тип",
          sentDate: "",
          senderAgency: "",
          summary: "Ошибка анализа документа",
          keyParagraphs: []
        };
      }
    },

    /**
     * Полный анализ документа
     */
    async analyzeDocument(text) {
      try {
        const [summary, paragraphs, violations] = await Promise.all([
          this.generateSummary(text),
          this.extractKeyParagraphs(text),
          this.detectViolations(text)
        ]);

        return {
          summary: summary || "Не удалось сгенерировать сводку",
          paragraphs: Array.isArray(paragraphs) ? paragraphs : ['Ошибка извлечения цитат'],
          violations: violations || 'Ошибка анализа нарушений',
          status: "complete"
        };
      } catch (error) {
        console.error("Ошибка анализа документа:", error);
        return {
          summary: "Системная ошибка анализа",
          paragraphs: ["Системная ошибка"],
          violations: "Системная ошибка",
          status: "error"
        };
      }
    },

    /**
     * Генерация жалобы
     */
    async generateComplaint(text, agency, violation = "") {
      if (!this.agencies.includes(agency)) {
        throw new Error("Указано недопустимое ведомство");
      }

      try {
        const prompt = `Сгенерируй официальную жалобу в ${agency} на основе документа.
                      ${violation ? `Выявленное нарушение:\n${violation}\n` : ""}
                      Текст документа:\n${text.substring(0, 3000)}`;

        return await this._makeAIRequest(
          prompt,
          null,
          { temperature: 0.5 }
        );
      } catch (error) {
        console.error("Ошибка генерации жалобы:", error);
        return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${text.substring(0, 500)}\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
      }
    },

    /**
     * Обработка параграфов
     */
    _postProcessParagraphs(text) {
      if (!text) return ["Не найдено значимых цитат"];
      
      return (text || '').split('\n')
        .map(p => {
          let cleaned = p.replace(/<\|.*?\|\>|```/g, '')
                       .replace(/^["']+|["']+$/g, '')
                       .trim();
          return cleaned.length > 15 ? cleaned : null;
        })
        .filter(Boolean)
        .filter((item, index, arr) => 
          index === arr.findIndex(i => i.substring(0, 50) === item.substring(0, 50))
        )
        .slice(0, 5);
    }
  },

  getters: {
    isServerOnline: (state) => state.apiStatus === "ready",
    activeModelName: (state) => {
      const model = state.activeModel
      
      return model ? model.description : "Неизвестная модель";
    },
  },
});

export default useAIStore


























// import { defineStore } from "pinia";
// import axios from "axios";

// export const useAIStore = defineStore("ai", {
//   state: () => ({
//     isLoading: false,
//     error: null,
//     apiStatus: "unknown", // 'ready', 'error', 'offline'
//     apiUrl: "http://localhost:11434/api/generate",
//     activeModel: "llama3:8b",
//     availableModels: [
//       {
//         name: "llama3:8b",
//         description: "Оптимизированная модель для анализа документов",
//         parameters: {
//           temperature: 0.3,
//           top_p: 0.9,
//           num_ctx: 4096
//         }
//       },
//       { 
//         name: "deepseek-r1:14b", 
//         description: "Базовая модель" 
//       },
//       { 
//         name: "hf.co/mradermacher/Medra4b-i1-GGUF:Q4_K_M",
//         description: "Резервная модель" 
//       },
//     ],
//     agencies: ["ФССП", "Прокуратура", "Суд", "Омбудсмен"],
//   }),

//   actions: {
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
//      * Улучшенный формат промпта для Medra4b
//      */
//     _formatMedraPrompt(text, taskType = "default") {
//       const prompts = {
//         summary: `[INST] <<SYS>>
// Ты - юридический ассистент. Сгенерируй краткую суть документа по правилам:
// 1. Только констатация сути предоставленного текста.
// 2. Максимально кратко (2-3 предложения)
// 4. Никаких пояснений.
// <</SYS>>

// Текст:
// ${text.substring(0, 5000)}

// Краткая суть: [/INST]`,

//         paragraphs: `[INST] <<SYS>>
// Ты — юридический эксперт. Выдели 3-5 самых важных УНИКАЛЬНЫХ цитат из документа по правилам:
// 1. Только разные по смыслу предложения
// 2. НЕ повторяй одинаковые формулировки
// 3. Каждая цитата должна раскрывать новую мысль
// 4. Если предложения повторяются — выбери только один вариант
// 5. Формат: "Точная цитата в кавычках"
// <</SYS>>

// Текст:
// ${text.substring(0, 5000)}

// Цитаты: [/INST]`,

//         default: `[INST] <<SYS>>
// Ты - юридический ассистент. Сгенерируй краткую суть документа по правилам:
// 1. Только констатация сути предоставленного текста.
// 2. Максимально кратко (2-3 предложения)
// 4. Никаких пояснений.
// <</SYS>>

// ${text} [/INST]`,
//       };

//       return prompts[taskType] || prompts.default;
//     },

//     /**
//      * Формат промптов для Llama3
//      */
//     _formatPrompt(text, model, taskType = 'default') {
//       if (model.includes('llama3')) {
//         const systemMessages = {
//           summary: `
//   <|begin_of_text|><|start_header_id|>system<|end_header_id|>
//   Ты — юридический ассистент. Сгенерируй краткую суть документа:
//   1. Только факты (без рассуждений)
//   2. Объем: 2-3 предложения.
//   3. Без вступительных фраз вроде "Here is a brief summary of the document:"

//   <</SYS>>

//   Текст:
//   ${text.substring(0, 7000)}

//   Краткая суть:`,
          
//           paragraphs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
//   Выдели 3-5 УНИКАЛЬНЫХ ключевых цитат:
//   1. Только дословные цитаты
//   2. Без повторов
//   3. Каждая с новой строки
//   4. Без вступительных фраз вроде "Here are 3-5 unique key quotes from the text:"
//   5. Без перевода, строго только на русском языке.
//   6. Объем каждого существенного параграфа - от 1 до 3 предложений. 
//   7. Предложения выделяй только полностью, не обрезая, чтобы не терялась суть.
//   >
//   <</SYS>>

//   Текст:
//   ${text.substring(0, 7000)}

//   Ключевые цитаты:`,
          
//           violations: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
// Найди юридические нарушения в тексте. Формат:
// - Закон: [название]
// - Статья: [номер]
// - Описание: [текст]
// - Доказательство: [цитата (предложение полностью)]
// <</SYS>>

// Текст:
// ${text.substring(0, 7000)}

// Выявленные нарушения:`
//         };
//         return systemMessages[taskType] || text;
//       }
//       return this._formatMedraPrompt(text, taskType);
//     },

//     /**
//      * Проверка доступности AI сервера
//      */
//     async checkServerStatus() {
//       try {
//         const response = await axios.get("http://localhost:11434", {
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
//      * Универсальный метод запроса к AI
//      */
//     async _makeAIRequest(prompt, model = null, customOptions = {}, taskType = null) {
//       const currentModel = model || this.activeModel;
//       const modelConfig = this.availableModels.find(m => m.name === currentModel)?.parameters || {};
      
//       const payload = {
//         model: currentModel,
//         prompt: this._formatPrompt(prompt, currentModel, taskType),
//         stream: false,
//         options: {
//           temperature: customOptions.temperature ?? modelConfig.temperature ?? 0.3,
//           top_p: customOptions.top_p ?? modelConfig.top_p ?? 0.9,
//           num_ctx: customOptions.num_ctx ?? modelConfig.num_ctx ?? 4096
//         }
//       };

//       try {
//         const response = await axios.post(
//           this.apiUrl,
//           payload,
//           {
//             timeout: 500000,
//             headers: {
//               'Content-Type': 'application/json'
//             }
//           }
//         );

//         if (!response.data?.response) {
//           throw new Error("Некорректный ответ от сервера AI");
//         }

//         return response.data.response;
//       } catch (error) {
//         console.error("AI Request Error:", {
//           config: error.config,
//           response: error.response?.data,
//           error: error.message
//         });

//         // Fallback на другую модель
//         if (currentModel !== 'llama2') {
//           console.warn("Пробуем использовать резервную модель");
//           return this._makeAIRequest(prompt, 'llama2', customOptions, taskType);
//         }

//         throw new Error(`Ошибка AI: ${error.message}`);
//       } finally {
//         this.isLoading = false;
//       }
//     },

//     /**
//      * Генерация краткой сводки
//      */
//     async generateSummary(text) {
//       try {
//         const response = await this._makeAIRequest(
//           text,
//           null,
//           { temperature: 0.3 },
//           'summary'
//         );
        
//         return response.split("\n")[0].replace(/^"|"$/g, "") ||
//                "Не удалось сгенерировать краткую суть";
//       } catch (error) {
//         console.error("Ошибка генерации сводки:", error);
//         return "Ошибка генерации краткой сводки";
//       }
//     },

//     /**
//      * Извлечение ключевых параграфов
//      */
//     async extractKeyParagraphs(text) {
//       try {
//         const response = await this._makeAIRequest(
//           text,
//           null,
//           { temperature: 0.1 },
//           'paragraphs'
//         );

//         const paragraphs = (response || '').split('\n')
//           .map(p => p.trim().replace(/^["']|["']$/g, ''))
//           .filter(p => p.length > 10)
//           .slice(0, 5);

//         return paragraphs.length > 0 
//           ? paragraphs 
//           : ['Не удалось извлечь значимые цитаты'];
//       } catch (error) {
//         console.error('Ошибка extractKeyParagraphs:', error);
//         return ['Ошибка обработки документа'];
//       }
//     },

//     /**
//      * Поиск юридических нарушений
//      */
//     async detectViolations(text) {
//       try {
//         return await this._makeAIRequest(
//           text,
//           null,
//           { temperature: 0.5 },
//           'violations'
//         );
//       } catch (error) {
//         console.error("Ошибка анализа нарушений:", error);
//         return "Не удалось проанализировать нарушения. Проверьте текст документа.";
//       }
//     },

//     /**
//      * Полный анализ документа
//      */
//     async analyzeDocument(text) {
//       try {
//         const [summary, paragraphs, violations] = await Promise.all([
//           this.generateSummary(text),
//           this.extractKeyParagraphs(text),
//           this.detectViolations(text)
//         ]);

//         return {
//           summary: summary || "Не удалось сгенерировать сводку",
//           paragraphs: Array.isArray(paragraphs) ? paragraphs : ['Ошибка извлечения цитат'],
//           violations: violations || 'Ошибка анализа нарушений',
//           status: "complete"
//         };
//       } catch (error) {
//         console.error("Ошибка анализа документа:", error);
//         return {
//           summary: "Системная ошибка анализа",
//           paragraphs: ["Системная ошибка"],
//           violations: "Системная ошибка",
//           status: "error"
//         };
//       }
//     },

//     /**
//      * Генерация жалобы
//      */
//     async generateComplaint(text, agency, violation = "") {
//       if (!this.agencies.includes(agency)) {
//         throw new Error("Указано недопустимое ведомство");
//       }

//       try {
//         const prompt = `Сгенерируй официальную жалобу в ${agency} на основе документа.
//                       ${violation ? `Выявленное нарушение:\n${violation}\n` : ""}
//                       Текст документа:\n${text.substring(0, 3000)}`;

//         return await this._makeAIRequest(
//           prompt,
//           null,
//           { temperature: 0.7 }
//         );
//       } catch (error) {
//         console.error("Ошибка генерации жалобы:", error);
//         return `В ${agency}\n\nЗаявитель: [ФИО]\n\nЖалоба на документ:\n${text.substring(0, 500)}\n\nТребования: Провести проверку\n\nДата: ${new Date().toLocaleDateString()}`;
//       }
//     },

//     /**
//      * Обработка параграфов
//      */
//     _postProcessParagraphs(text) {
//       if (!text) return ["Не найдено значимых цитат"];
      
//       return (text || '').split('\n')
//         .map(p => {
//           let cleaned = p.replace(/<\|.*?\|\>|```/g, '')
//                        .replace(/^["']+|["']+$/g, '')
//                        .trim();
//           return cleaned.length > 15 ? cleaned : null;
//         })
//         .filter(Boolean)
//         .filter((item, index, arr) => 
//           index === arr.findIndex(i => i.substring(0, 50) === item.substring(0, 50))
//         )
//         .slice(0, 5);
//     }
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