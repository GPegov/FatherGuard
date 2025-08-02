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
