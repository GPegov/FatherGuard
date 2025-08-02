import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import cors from 'cors'

const corsOptions = {
  origin: 'http://localhost:5173', 
  optionsSuccessStatus: 200
}


function simplifyError(error) {
  if (error.message.includes('timeout')) return 'Превышено время ожидания (400 секунд)'
  if (error.response?.status === 500) return 'Ошибка сервера AI'
  if (error.message.includes('недостаточно памяти')) return 'Недостаточно памяти для обработки'
  return error.message || 'Неизвестная ошибка анализа'
}

export const useDocumentStore = defineStore("document", () => {
  
  const router = useRouter();

  // Состояние хранилища

  const currentDocument = ref({
    id: null,
    date: new Date().toISOString().split("T")[0],
    agency: "",
    originalText: "",
    summary: "",
    keyParagraphs: [],
    attachments: [],
    comments: "",
  });

  const documents = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isAnalyzing = ref(false);

  // Геттеры
  const agenciesList = computed(() => {
    const agencies = new Set(documents.value.map((doc) => doc.agency));
    return Array.from(agencies).filter(Boolean);
  });

  const hasAttachments = computed(() => {
    return currentDocument.value.attachments?.length > 0;
  });

  // Действия

  const generateComplaint = async (documentId, agency) => {
    isAnalyzing.value = true;
    try {
      const { data } = await axios.post(
        `http://localhost:3001/api/documents/${documentId}/complaints`,
        { agency }
      );

      // Обновляем текущий документ
      if (currentDocument.value.id === documentId) {
        if (!currentDocument.value.complaints)
          currentDocument.value.complaints = [];
        currentDocument.value.complaints.push(data);
      }

      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isAnalyzing.value = false;
    }
  };

  const fetchComplaints = async (documentId) => {
    isLoading.value = true;
    try {
      const { data } = await axios.get(
        `http://localhost:3001/api/documents/${documentId}/complaints`
      );
      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const uploadFiles = async (files) => {
    isLoading.value = true;
    error.value = null;

    try {
      const formData = new FormData();

      // Добавляем текст документа если есть
      if (currentDocument.value.originalText) {
        formData.append("text", currentDocument.value.originalText);
      }

      // Добавляем файлы
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const { data } = await axios.post(
        "http://localhost:3001/api/documents/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Обновляем текущий документ
      currentDocument.value = {
        ...currentDocument.value,
        originalText: data.originalText || currentDocument.value.originalText,
        attachments: data.attachments || [],
        id: data.id,
      };

      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const saveDocument = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      let savedDocument;
      const docData = {
        ...currentDocument.value,
        // Убедимся что attachments массив
        attachments: currentDocument.value.attachments || [],
      };

      // Если есть файлы - используем upload endpoint
      if (docData.attachments.length > 0) {
        const formData = new FormData();
        formData.append("text", docData.originalText);
        formData.append("comments", docData.comments);

        // Отправляем существующие файлы через отдельный запрос
        const { data } = await axios.post(
          "http://localhost:3001/api/documents/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        savedDocument = data;
      }
      // Если только текст - используем обычный endpoint
      else if (docData.originalText) {
        const { data } = await axios.post(
          "http://localhost:3001/api/documents",
          docData
        );
        savedDocument = data;
      }
      // Если нет ни текста ни файлов - ошибка
      else {
        throw new Error("Документ должен содержать текст или файлы");
      }

      // Обновляем локальное состояние
      if (docData.id) {
        const index = documents.value.findIndex((d) => d.id === docData.id);
        if (index !== -1) {
          documents.value[index] = savedDocument;
        }
      } else {
        documents.value.unshift(savedDocument);
      }

      currentDocument.value = savedDocument;
      return savedDocument;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteDocument = async (id) => {
    isLoading.value = true;
    try {
      console.log("Пытаемся удалить документ с ID:", id);
      const response = await axios.delete(
        `http://localhost:3001/api/documents/${id}`
      );
      console.log("Ответ сервера:", response.status);
      documents.value = documents.value.filter((doc) => doc.id !== id);
    } catch (err) {
      console.error("Ошибка удаления:", err);
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchDocuments = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await axios.get("http://localhost:3001/api/documents");
      documents.value = data.items || data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchDocumentById = async (id) => {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await axios.get(
        `http://localhost:3001/api/documents/${id}`
      );
      currentDocument.value = data; // Важно: сохраняем в currentDocument
      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  
  const addAttachment = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axios.post(
        "http://localhost:3001/api/documents/attachments",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      currentDocument.value.attachments.push(data);
      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    }
  };

  const removeAttachment = async (attachmentId) => {
    try {
      await axios.delete(
        `http://localhost:3001/api/documents/attachments/${attachmentId}`
      );
      currentDocument.value.attachments =
        currentDocument.value.attachments.filter(
          (att) => att.id !== attachmentId
        );
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    }
  };

  

  const analyzeDocument = async (documentId) => {
  isAnalyzing.value = true;
  const MAX_TEXT_LENGTH = 30000; // Увеличено до 30k символов
  const ANALYSIS_TIMEOUT = 400000; // 400 секунд в миллисекундах
  let analysisProgress = ref('Подготовка к анализу');
  
  try {
    const docText = currentDocument.value.originalText;
    if (!docText) throw new Error("Нет текста для анализа");

    // Проверка и обрезка текста
    const textToAnalyze = docText.length > MAX_TEXT_LENGTH 
      ? docText.substring(0, MAX_TEXT_LENGTH) + "\n\n[Текст был обрезан до 30 000 символов]"
      : docText;

    console.log(`Начало анализа документа (${textToAnalyze.length} символов)...`);
    
    // Проверка доступности модели
    analysisProgress.value = 'Проверка модели...';
    const isModelAvailable = await aiService.checkModelStatus();
    if (!isModelAvailable) {
      throw new Error("Модель AI недоступна. Проверьте сервер Ollama.");
    }

    // 1. Генерация краткой сути с увеличенным таймаутом
    analysisProgress.value = 'Анализ (1/2): Генерация краткой сути...';
    console.log("Этап 1/2: Генерация краткой сути");
    
    const summary = await Promise.race([
      aiService.generateSummary(textToAnalyze),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Таймаут генерации сути (превышено 400 секунд)")), ANALYSIS_TIMEOUT)
      )
    ]);
    
    console.log("Сгенерированная суть:", summary);
    if (!summary || summary.length < 10) {
      throw new Error("Не удалось сгенерировать содержательную краткую суть");
    }

    // 2. Извлечение ключевых параграфов с увеличенным таймаутом
    analysisProgress.value = 'Анализ (2/2): Извлечение цитат...';
    console.log("Этап 2/2: Извлечение цитат");
    
    let keyParagraphs = await Promise.race([
      aiService.extractKeyParagraphs(textToAnalyze),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Таймаут извлечения цитат (превышено 400 секунд)")), ANALYSIS_TIMEOUT)
      )
    ]);

    console.log("Извлеченные цитаты:", keyParagraphs);
    if (!Array.isArray(keyParagraphs) || keyParagraphs.length === 0) {
      console.warn("Модель не вернула валидные цитаты, используется fallback");
      keyParagraphs = [textToAnalyze.substring(0, 500) + "..."]; // Увеличенный fallback
    }

    // 3. Валидация и сохранение результатов
    analysisProgress.value = 'Сохранение результатов...';
    const result = {
      summary: summary.trim(),
      keyParagraphs: keyParagraphs.slice(0, 10), // Увеличено до 10 цитат
      analyzedAt: new Date().toISOString(),
      originalTextLength: docText.length,
      processedTextLength: textToAnalyze.length
    };

    if (currentDocument.value.id === documentId) {
      currentDocument.value = {
        ...currentDocument.value,
        ...result,
        status: 'analyzed'
      };
      await documentStore.saveDocument();
    }

    return result;
  } catch (error) {
    console.error("Ошибка анализа:", {
      error: error.message,
      stack: error.stack,
      documentId,
      textLength: currentDocument.value.originalText?.length,
      timestamp: new Date().toISOString()
    });
    
    if (currentDocument.value.id === documentId) {
      currentDocument.value.analysisError = {
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
    
    throw new Error(`Анализ не удался: ${simplifyError(error)}`);
  } finally {
    isAnalyzing.value = false;
    analysisProgress.value = '';
  }
};

  

  const resetCurrentDocument = () => {
    currentDocument.value = {
      id: null,
      date: new Date().toISOString().split("T")[0],
      agency: "",
      originalText: "",
      summary: "",
      keyParagraphs: [],
      attachments: [],
      comments: "",
    };
  };

  const setCurrentDocument = (doc) => {
    currentDocument.value = { ...doc };
  };

 

  return {
    // Состояние
    currentDocument,
    documents,
    isLoading,
    error,
    isAnalyzing,

    // Геттеры
    agenciesList,
    hasAttachments,

    // Действия
    generateComplaint,
    fetchComplaints,
    uploadFiles,
    addAttachment,
    removeAttachment,
    saveDocument,
    fetchDocuments,
    fetchDocumentById,
    analyzeDocument,
    resetCurrentDocument,
    setCurrentDocument,
    deleteDocument,

    viewDocument: async (id) => {
      await fetchDocumentById(id);
      router.push(`/documents/${id}`);
    },
  };
});
