import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";

export const useAIStore = defineStore("ai", () => {
  // Состояние
  const isLoading = ref(false);
  const error = ref(null);
  const apiStatus = ref("unknown");
  
  const apiUrl = ref("http://localhost:11434/api/generate");
  const model = ref("llama3.1/18/8192");
  
  const availableModels = ref([
    {
      name: "llama3.1/18/8192",
      description: "using 18 threads with 8192 num_ctx",
      parameters: {
        temperature: 0.3,
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
          temperature: options.temperature || 0.3,
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