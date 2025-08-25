import { useDocumentStore } from '@/stores/documentStore';
import { useAIStore } from '@/stores/aiStore';

export const useDocumentAnalysis = () => {
  const documentStore = useDocumentStore();
  const aiStore = useAIStore();

  const analyzeCurrentDocument = async () => {
    return await documentStore.analyzeDocument();
  };

  const analyzeTextWithLLM = async (text) => {
    return await aiStore.analyzeText(text);
  };

  return {
    analyzeCurrentDocument,
    analyzeTextWithLLM
  };
};