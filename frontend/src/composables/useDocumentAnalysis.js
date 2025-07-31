import { ref } from 'vue';
import { useAIStore } from '@/stores/aiStore';

export default function useDocumentAnalysis() {
  const aiStore = useAIStore();
  const isAnalyzing = ref(false);
  const analysisError = ref(null);

  const analyzeText = async (text) => {
    isAnalyzing.value = true;
    analysisError.value = null;
    try {
      return await aiStore.analyzeText(text);
    } catch (error) {
      analysisError.value = error.message;
      throw error;
    } finally {
      isAnalyzing.value = false;
    }
  };

  return {
    isAnalyzing,
    analysisError,
    analyzeText
  };
}