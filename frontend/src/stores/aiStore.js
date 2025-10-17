import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";
import { AITemperatureConfig } from "../config/aiConfig.js";

export const useAIStore = defineStore("ai", () => {
  // Состояние
  const isLoading = ref(false);
  const error = ref(null);
  const apiStatus = ref("unknown");
  
  const apiUrl = ref("http://localhost:11434/api/generate");
  const model = ref("qwen3:30b");
  
  const availableModels = ref([
    {
      name: "qwen3:30b",
      description: "Qwen 3 30B model",
      parameters: {
        temperature: AITemperatureConfig.DEFAULT,
        top_p: 0.9,
      },
    },
  ]);
  


  const agencies = ref(["ФССП", "Прокуратура", "Суд", "Омбудсмен"]);

  // Действия
  const checkServerStatus = async () => {
    try {
      // Проверяем непосредственно AI сервер (Ollama)
      const response = await axios.get("http://localhost:11434/api/tags", {
        timeout: 5000
      });
      apiStatus.value = "ready";
      return true;
    } catch (error) {
      apiStatus.value = "offline";
      throw new Error("AI сервер недоступен");
    }
  };

  const analyzeText = async (text, options = {}) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await axios.post(apiUrl.value, {
        model: model.value,
        prompt: text,
        stream: false,
        options: {
          temperature: options.temperature || AITemperatureConfig.DEFAULT,
          top_p: options.top_p || 0.9,
        }
      }, { timeout: 30000 });
      
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Геттеры
  const isServerOnline = computed(() => apiStatus.value === "ready");
  
  const activeModelName = computed(() => {
    const modelObj = availableModels.value.find(m => m.name === model.value);
    return modelObj ? modelObj.description : "Неизвестная модель";
  });

  return {
    // Состояние
    isLoading,
    error,
    apiStatus,
    apiUrl,
    model,
    availableModels,
    agencies,

    // Действия
    checkServerStatus,
    analyzeText,

    // Геттеры
    isServerOnline,
    activeModelName
  };
});