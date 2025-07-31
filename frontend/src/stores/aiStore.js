import { defineStore } from 'pinia'
import axios from 'axios'


export const useAIStore = defineStore("ai", {
  state: () => ({
    isLoading: false,
    error: null,
  }),
  actions: {
    async analyzeDocument(documentId, text) {
      this.isLoading = true;
      try {
        const response = await axios.post(
          'http://localhost:11434/api/generate',
          {
            model: 'deepseek-r1:14b',
            prompt: `Проанализируй юридический документ: ${text}`,
            format: 'json'
          }
        );
        return response.data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async generateComplaint(text, agency) {
      this.isLoading = true;
      try {
        const response = await axios.post(
          'http://localhost:11434/api/generate',
          {
            model: 'deepseek-r1:14b',
            prompt: `Сгенерируй жалобу для ${agency} на основе текста: ${text}`,
            format: 'json',
            temperature: 0.5
          }
        );
        return response.data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
  


    // async analyzeText(text) {
    //   this.isLoading = true;
    //   this.error = null;
    //   try {
    //     const response = await axios.post(
    //       "http://localhost:3001/api/ai/analyze",
    //       { text },
    //       {
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         timeout: 30000,
    //       }
    //     );
    //     return response.data;
    //   } catch (error) {
    //     this.error = error.response?.data?.error || error.message;
    //     console.error("AI Analysis error:", {
    //       config: error.config,
    //       response: error.response?.data,
    //       stack: error.stack,
    //     });
    //     throw error;
    //   } finally {
    //     this.isLoading = false;
    //   }
    // },

    async generateComplaint(text, agency) {
      this.isLoading = true;
      try {
        const response = await axios.post(
          "http://localhost:3001/api/ai/generate-complaint",
          { text, agency },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || error.message;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
