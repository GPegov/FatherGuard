import { useAIStore } from "@/stores/aiStore";
import AIService from "@/services/aiService";

export function useAI() {
  const aiStore = useAIStore();
  const aiService = new AIService(aiStore.apiUrl, aiStore.activeModel);
  return { aiService };
}