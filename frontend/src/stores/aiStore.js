import { defineStore } from "pinia";
import axios from "axios";

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
    async checkServerStatus() {
      try {
        // Проверяем статус сервера через бэкенд
        const response = await axios.get("http://localhost:3001/api/status");
        this.apiStatus = response.data.status;
        return this.apiStatus;
      } catch (error) {
        this.apiStatus = "offline";
        throw new Error("AI сервер недоступен");
      }
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