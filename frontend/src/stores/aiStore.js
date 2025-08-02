import { defineStore } from 'pinia'
import axios from 'axios'

export const useAIStore = defineStore('ai', {
  state: () => ({
    isLoading: false,
    error: null,
    apiUrl: 'http://localhost:11434/api/generate',
    model: 'deepseek-r1:14b',
    agencies: ['ФССП', 'Прокуратура', 'Суд', 'Омбудсмен']
  }),

  actions: {
    /**
     * Базовый метод для запросов к AI
     * @param {string} prompt - Текст запроса
     * @param {number} [temperature=0.3] - Параметр температуры
     * @returns {Promise<string>} - Ответ нейросети (строка)
     */
    async _queryAI(prompt, temperature = 0.3) {
      this.isLoading = true
      try {
        const response = await axios.post(this.apiUrl, {
          model: this.model,
          prompt: prompt,
          format: 'text',
          temperature: temperature,
          stream: false
        })
        return response.data?.response?.trim() || ''
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Генерация краткой сути документа
     * @param {string} text - Текст документа
     * @returns {Promise<string>} - Краткая суть (2-3 предложения)
     */
    async generateSummary(text) {
      const prompt = `Сгенерируй краткую суть (2-3 предложения) следующего текста:\n\n${text.substring(0, 5000)}\n\nКраткая суть:`
      return this._queryAI(prompt, 0.2)
    },

    /**
     * Извлечение ключевых параграфов
     * @param {string} text - Текст документа
     * @returns {Promise<string[]>} - Массив важных параграфов
     */
    async extractKeyParagraphs(text) {
      const prompt = `Выдели 3-5 самых важных дословных цитат из текста. Каждую цитату выдели с новой строки и начинай с "- ":\n\n${text.substring(0, 5000)}`
      const response = await this._queryAI(prompt, 0.1)
      
      // Парсинг ответа: разделяем по строкам и фильтруем пустые
      return response.split('\n')
        .map(line => line.replace(/^- /, '').trim())
        .filter(line => line.length > 0)
    },

    /**
     * Генерация жалобы
     * @param {string} text - Текст документа
     * @param {string} agency - Ведомство
     * @param {string} [violation] - Описание нарушения
     * @returns {Promise<string>} - Текст жалобы
     */
    async generateComplaint(text, agency, violation = '') {
      if (!this.agencies.includes(agency)) {
        throw new Error('Указано недопустимое ведомство')
      }

      const prompt = `Сгенерируй официальную жалобу в ${agency} на основе документа.\n
                    ${violation ? `Выявленное нарушение: ${violation}\n` : ''}
                    Текст документа:\n\n${text.substring(0, 3000)}\n\nЖалоба:`
      
      return this._queryAI(prompt, 0.5)
    },

    /**
     * Поиск нарушений в тексте
     * @param {string} text - Текст документа
     * @returns {Promise<string>} - Описание нарушений (текстовый формат)
     */
    async detectViolations(text) {
      const prompt = `Проанализируй текст на нарушения законодательства. Опиши нарушения в таком формате:
                    - Закон: [название], Статья: [номер]
                    - Описание: [текст]
                    - Доказательство: [цитата из текста]
                    
                    Текст для анализа:\n\n${text.substring(0, 5000)}`
      
      return this._queryAI(prompt, 0.3)
    }
  }
})