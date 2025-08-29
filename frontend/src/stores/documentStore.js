import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { v4 as uuidv4 } from "uuid";
import { useAIStore } from "@/stores/aiStore";

export const useDocumentStore = defineStore("document", () => {
  const router = useRouter();
  const aiStore = useAIStore();
  const API_BASE = "http://localhost:3001";

  // Состояние хранилища
  const documents = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isAnalyzing = ref(false);

  // Вспомогательная функция для проверки типа ID документа
  const validateDocumentId = (doc, source = "unknown") => {
    if (doc && doc.id !== undefined && doc.id !== null) {
      if (typeof doc.id !== 'string' && typeof doc.id !== 'number') {
        console.warn(`ВНИМАНИЕ: ID документа имеет неожиданный тип в ${source}:`, {
          id: doc.id,
          type: typeof doc.id,
          value: doc.id
        });
        return false;
      }
    }
    return true;
  };

  const currentDocument = ref({
    id: null, // Не устанавливаем ID сразу
    date: new Date().toISOString().split("T")[0],
    agency: "",
    originalText: "",
    summary: "",
    keySentences: [],
    documentDate: "",
    senderAgency: "",
    attachments: [],
    complaints: [],
    analysisStatus: "pending",
    lastAnalyzedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    violations: [],
  });

  // Геттеры
  const agenciesList = computed(() => {
    const complaintAgencies = new Set([
      "ФССП",
      "Прокуратура",
      "Суд",
      "Омбудсмен",
    ]);
    const allAgencies = new Set(complaintAgencies);

    documents.value.forEach((doc) => {
      const agency = doc.agency || doc.senderAgency;
      if (
        agency &&
        typeof agency === "string" &&
        !complaintAgencies.has(agency)
      ) {
        allAgencies.add(agency);
      }
    });

    return Array.from(allAgencies).sort();
  });

  const hasAttachments = computed(() => {
    return currentDocument.value.attachments?.length > 0;
  });

  const analyzedDocuments = computed(() => {
    return documents.value.filter((doc) => doc.analysisStatus === "completed");
  });

  // Вспомогательные функции

  const updateDocumentsList = (savedDocument) => {
    const index = documents.value.findIndex((d) => d.id === savedDocument.id);
    if (index !== -1) {
      documents.value[index] = savedDocument;
    } else {
      documents.value.unshift(savedDocument);
    }
  };

  const handleApiCall = async (apiFunction) => {
    isLoading.value = true;
    error.value = null;
    try {
      return await apiFunction();
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const determineTargetAgency = (text) => {
    const violations = text.match(/нарушен[ия]|незаконн|жалоб[аы]/gi);
    if (!violations) return "";

    if (text.includes("ФССП") || text.includes("судебн")) return "ФССП";
    if (text.includes("прокурор")) return "Прокуратура";
    if (text.includes("суд")) return "Суд";
    if (text.includes("омбудсмен")) return "Омбудсмен";

    return "ФССП";
  };

  const extractDate = (text) => {
    const dateRegex = /(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/;
    const match = text.match(dateRegex);
    return match ? match[0] : "";
  };

  const extractAgency = (text) => {
    const agencies = ["ФССП", "Прокуратура", "Суд", "Омбудсмен"];
    return agencies.find((agency) => text.includes(agency)) || "";
  };

  const resetCurrentDocument = () => {
    currentDocument.value = {
      id: null, // Не устанавливаем ID сразу
      date: new Date().toISOString().split("T")[0],
      agency: "",
      originalText: "",
      summary: "",
      keySentences: [],
      documentDate: "",
      senderAgency: "",
      attachments: [],
      complaints: [],
      analysisStatus: "pending",
      lastAnalyzedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      violations: [],
    };
    
    // Проверяем тип ID после сброса
    validateDocumentId(currentDocument.value, "resetCurrentDocument");
  };

  // Действия
  const fetchDocuments = async () => {
    return handleApiCall(async () => {
      const { data } = await axios.get(`${API_BASE}/api/documents`);
      documents.value = data.items || data;
    });
  };

  const fetchDocumentById = async (id) => {
    
    return handleApiCall(async () => {
      const { data } = await axios.get(`${API_BASE}/api/documents/${id}`);
      
      // Документ уже в правильной структуре, просто присваиваем
      // Убедимся, что originalText правильно установлен
      currentDocument.value = {
        ...data,
        originalText: data.originalText !== undefined ? data.originalText : "",
      };
      return data;
    });
  };

  const uploadFiles = async (files) => {
    console.log("Загрузка файлов:", files);
    return handleApiCall(async () => {
      const formData = new FormData();
      if (currentDocument.value.originalText) {
        formData.append("text", currentDocument.value.originalText);
      }

      Array.from(files).forEach((file) => formData.append("files", file));

      const { data } = await axios.post(
        `${API_BASE}/api/documents/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      console.log("Результат загрузки файлов:", data);
      
      // Проверяем тип ID в возвращенных данных
      validateDocumentId(data, "uploadFiles (response)");
      
      // Бэкенд возвращает созданный документ в правильной структуре
      currentDocument.value = {
        ...currentDocument.value,
        ...data,
        // Убедимся, что originalText правильно установлен
        originalText:
          data.originalText || currentDocument.value.originalText || "",
      };
      
      // Проверяем тип ID после обновления
      validateDocumentId(currentDocument.value, "uploadFiles (after update)");
      
      return data;
    });
  };

  const saveDocument = async () => {
    console.log("Сохранение документа:", currentDocument.value);
    
    // Проверяем тип ID документа
    validateDocumentId(currentDocument.value, "saveDocument");
    
    return handleApiCall(async () => {
      // Убедимся, что у документа есть все необходимые поля
      // и актуальная дата обновления
      currentDocument.value.updatedAt = new Date().toISOString();

      // Убедимся, что originalText не undefined
      currentDocument.value.originalText =
        currentDocument.value.originalText !== undefined
          ? currentDocument.value.originalText
          : "";

      let savedDocument;
      // Проверяем, является ли ID "истинным" значением для определения PUT/POST
      if (currentDocument.value.id && typeof currentDocument.value.id === 'string') {
        
        const { data } = await axios.put(
          `${API_BASE}/api/documents/${currentDocument.value.id}`,
          currentDocument.value
        );
        savedDocument = data;
      } else {
        console.log("Создание нового документа");
        // Убедимся, что новый документ имеет правильную структуру
        const newDocToSave = {
          ...currentDocument.value,
          id: typeof currentDocument.value.id === 'string' ? currentDocument.value.id : uuidv4(),
          createdAt:
            currentDocument.value.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          originalText:
            currentDocument.value.originalText !== undefined
              ? currentDocument.value.originalText
              : "",
        };
        const { data } = await axios.post(
          `${API_BASE}/api/documents`,
          newDocToSave
        );
        savedDocument = data;
      }

      updateDocumentsList(savedDocument);
      // После сохранения обновляем currentDocument значением от сервера
      currentDocument.value = {
        ...currentDocument.value,
        ...savedDocument,
        // Убедимся, что originalText правильно установлен
        originalText:
          savedDocument.originalText !== undefined
            ? savedDocument.originalText
            : currentDocument.value.originalText || "",
      };
      
      // Проверяем тип ID после сохранения
      validateDocumentId(currentDocument.value, "saveDocument (after save)");
      
      console.log("Документ сохранен:", savedDocument);
      return savedDocument;
    });
  };

  const deleteDocument = async (id) => {
    return handleApiCall(async () => {
      await axios.delete(`${API_BASE}/api/documents/${id}`);
      documents.value = documents.value.filter((doc) => doc.id !== id);

      if (currentDocument.value.id === id) {
        resetCurrentDocument();
      }
    });
  };

  const analyzeDocument = async (documentId = null) => {
    
    // Если передан ID документа, загружаем его
    if (documentId) {
      await fetchDocumentById(documentId);
    }

    // Проверяем, есть ли текст для анализа
    const hasOriginalText = currentDocument.value.originalText && currentDocument.value.originalText.trim().length > 0;
    const hasAttachmentsWithText = currentDocument.value.attachments?.some((att) => att.text && att.text.trim().length > 0);

    console.log("Проверка текста для анализа:", {
      hasOriginalText,
      hasAttachmentsWithText,
    });

    if (!hasOriginalText && !hasAttachmentsWithText) {
      error.value = "Нет текста для анализа";
      console.log("Нет текста для анализа");
      return;
    }

    isAnalyzing.value = true;
    error.value = null;

    try {
      // Проверяем тип ID перед анализом
      validateDocumentId(currentDocument.value, "analyzeDocument (before analysis)");
      
      // Если у документа есть ID (строка), анализируем его по ID
      if (currentDocument.value.id && typeof currentDocument.value.id === 'string') {
        currentDocument.value.analysisStatus = "processing";

        // Вызываем бэкенд для анализа документа
        const { data } = await axios.post(
          `${API_BASE}/api/documents/${currentDocument.value.id}/analyze`,
          {
            instructions: "",
            strictMode: false
          }
        );

        currentDocument.value = {
          ...currentDocument.value,
          summary: data.summary || "Не удалось сгенерировать краткую суть",
          keySentences: Array.isArray(data.keySentences) ? 
            data.keySentences : 
            [],
          violations: Array.isArray(data.violations) ?
            data.violations :
            [],
          documentDate: data.documentDate || "",
          senderAgency: data.senderAgency || "",
          attachments: data.attachments ? 
            currentDocument.value.attachments.map(attachment => {
              // Найдем соответствующий анализ в результатах
              const analysis = data.attachments.find(a => a.id === attachment.id);
              if (analysis) {
                return {
                  ...attachment,
                  analysis: {
                    documentType: analysis.documentType || "Документ",
                    sentDate: analysis.sentDate || "",
                    senderAgency: analysis.senderAgency || "",
                    summary: analysis.summary || "",
                    keySentences: analysis.keySentences || []
                  },
                  documentDate: analysis.sentDate || attachment.documentDate || "",
                  senderAgency: analysis.senderAgency || attachment.senderAgency || "",
                  summary: analysis.summary || attachment.summary || "",
                  keySentences: analysis.keySentences || attachment.keySentences || []
                };
              }
              return attachment;
            }) : 
            currentDocument.value.attachments,
          analysisStatus: "completed",
          lastAnalyzedAt: new Date().toISOString(),
        };

        const savedDocument = await saveDocument();
        return savedDocument;
      } 
      // Если у документа нет ID (новый документ), анализируем его напрямую по тексту
      else {
        // Подготавливаем данные для анализа
        const documentData = {
          originalText: currentDocument.value.originalText || "",
          attachments: currentDocument.value.attachments || []
        };

        // Вызываем бэкенд для анализа текста напрямую
        const { data } = await axios.post(
          `${API_BASE}/api/documents/analyze`,
          {
            text: documentData.originalText,
            instructions: "",
            strictMode: false
          }
        );

        // Обновляем документ результатами анализа
        currentDocument.value = {
          ...currentDocument.value,
          summary: data.summary || "Не удалось сгенерировать краткую суть",
          keySentences: Array.isArray(data.keySentences) ? 
            data.keySentences : 
            [],
          violations: Array.isArray(data.violations) ?
            data.violations :
            [],
          documentDate: data.documentDate || "",
          senderAgency: data.senderAgency || "",
          analysisStatus: "completed",
          lastAnalyzedAt: new Date().toISOString(),
        };

        // Возвращаем обновленный документ без сохранения
        return currentDocument.value;
      }
    } catch (err) {
      console.error("Ошибка анализа документа:", err);
      currentDocument.value.analysisStatus = "failed";
      // Для новых документов не вызываем saveDocument в случае ошибки
      if (currentDocument.value.id && typeof currentDocument.value.id === 'string') {
        await saveDocument();
      }
      throw err;
    } finally {
      isAnalyzing.value = false;
    }
  };

  

  const fetchComplaints = async (documentId) => {
    return handleApiCall(async () => {
      const { data } = await axios.get(
        `${API_BASE}/api/documents/${documentId}/complaints`
      );

      if (currentDocument.value.id === documentId) {
        currentDocument.value.complaints = data;
      }

      return data;
    });
  };

  const viewDocument = async (id) => {
    await fetchDocumentById(id);
    router.push(`/documents/${id}`);
  };

  // Экспортируемые значения
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
    analyzedDocuments,

    // Действия
    fetchDocuments,
    fetchDocumentById,
    uploadFiles,
    saveDocument,
    deleteDocument,
    analyzeDocument,
    fetchComplaints,
    resetCurrentDocument,
    viewDocument,
  };
});
