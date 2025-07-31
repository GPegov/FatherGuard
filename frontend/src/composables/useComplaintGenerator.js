import { ref } from 'vue';
import { useAIStore } from '@/stores/aiStore';

export default function useComplaintGenerator() {
  const aiStore = useAIStore();
  const isGenerating = ref(false);
  const generationError = ref(null);

  const generateComplaint = async (text, agency) => {
    isGenerating.value = true;
    generationError.value = null;
    try {
      return await aiStore.generateComplaint(text, agency);
    } catch (error) {
      generationError.value = error.message;
      throw error;
    } finally {
      isGenerating.value = false;
    }
  };

  return {
    isGenerating,
    generationError,
    generateComplaint
  };
}