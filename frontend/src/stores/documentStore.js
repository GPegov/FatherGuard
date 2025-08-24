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


  const currentDocument = ref({
    id: uuidv4(),
    date: new Date().toISOString(), // Дата поступления (п.1)
    originalText: "", // Дословный текст (п.2)
    agencyTarget: "", // Ведомство (п.3)
    summary: "", // Краткая суть (п.4)
    keySentences: [], // Важные предложения (п.5)
    // Расшифровка документа (п.6)
    documentDate: "",
    senderAgency: "",
    documentSummary: "",
    attachments: [],
    complaints: [],
    analysisStatus: "pending",
    lastAnalyzedAt: null,
    violations: [],
  });

  // Геттеры
  const agenciesList = computed(() => {
    // Базовый список ведомств, в которые можно подавать жалобы
    const complaintAgencies = new Set(["ФССП", "Прокуратура", "Суд", "Омбудсмен"]);
    
    // Множество для хранения всех упомянутых ведомств
    const allAgencies = new Set(complaintAgencies);
    
    // Добавляем ведомства, упомянутые в документах как нарушители
    documents.value.forEach((doc) => {
      // Проверяем поля, которые могут содержать информацию о нарушителе
      const agency = doc.agency || doc.agencyTarget || doc.senderAgency;
      if (agency && typeof agency === 'string') {
        // Добавляем ведомство в список, если оно не входит в список для жалоб
        // Это предотвращает появление ведомств, предназначенных для жалоб, 
        // в списке нарушителей
        if (!complaintAgencies.has(agency)) {
          allAgencies.add(agency);
        }
      }
    });
    
    // Возвращаем отсортированный массив всех ведомств
    return Array.from(allAgencies).sort();
  });

  const hasAttachments = computed(() => {
    return currentDocument.value.attachments?.length > 0;
  });

  const analyzedDocuments = computed(() => {
    return documents.value.filter((doc) => doc.analysisStatus === "completed");
  });

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
      currentDocument.value = normalizeDocumentData(data);
      return data;
    });
  };

  const uploadFiles = async (files) => {
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

      currentDocument.value = {
        ...normalizeDocumentData(data),
        originalText: data.originalText || currentDocument.value.originalText,
      };
      return data;
    });
  };

  const saveDocument = async () => {
    return handleApiCall(async () => {
      const docToSave = prepareDocumentForSave(currentDocument.value);
      let savedDocument;

      if (docToSave.id) {
        const { data } = await axios.put(
          `${API_BASE}/api/documents/${docToSave.id}`,
          docToSave
        );
        savedDocument = data;
      } else {
        const { data } = await axios.post(
          `${API_BASE}/api/documents`,
          docToSave
        );
        savedDocument = data;
      }

      updateDocumentsList(savedDocument);
      currentDocument.value = normalizeDocumentData(savedDocument);
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

  const analyzeDocument = async () => {
    if (!currentDocument.value.originalText?.trim()) {
      error.value = "Нет текста для анализа";
      return;
    }
    isAnalyzing.value = true;
    error.value = null;

    try {
      currentDocument.value.analysisStatus = "processing";
      await saveDocument();

      const analysis = await analyzeDocumentContent(currentDocument.value.originalText);
      const attachmentsAnalysis = await analyzeAttachments();

      currentDocument.value = {
        ...currentDocument.value,
        ...analysis,
        attachments: attachmentsAnalysis,
        analysisStatus: "completed",
        lastAnalyzedAt: new Date().toISOString(),
      };

      await saveDocument();
      return analysis;
    } catch (err) {
      currentDocument.value.analysisStatus = "failed";
      await saveDocument();
      throw err;
    } finally {
      isAnalyzing.value = false;
    }
  };

  // Вспомогательные функции

  const normalizeDocumentData = (data) => ({
    id: data.id || null,
    date: data.date || new Date().toISOString().split("T")[0],
    agency: data.agency || "", // старое поле (оставляем для обратной совместимости)
    agencyTarget: data.agencyTarget || "", // новое поле (п.3)
    originalText: data.originalText || "", // п.2
    summary: data.summary || "", // п.4
    keySentences: data.keySentences || [], // п.5 (важные предложения вместо параграфов)
    // Поля для расшифровки документа (п.6)
    documentDate: data.documentDate || "",
    senderAgency: data.senderAgency || "",
    documentSummary: data.documentSummary || data.summary || "", // п.6в (используем summary если нет отдельного поля)
    attachments:
      data.attachments?.map((att) => ({
        id: att.id || uuidv4(),
        name: att.name,
        type: att.type,
        size: att.size,
        path: att.path,
        text: att.text || "",
        analysis: att.analysis || null,
        // Добавляем поля для анализа вложений (п.6 для вложений)
        documentDate: att.documentDate || "",
        senderAgency: att.senderAgency || "",
        attachmentSummary: att.attachmentSummary || att.documentSummary || "",
        fullText: att.text || "", // Используем text вместо fullText
        keySentences: att.keySentences || [], // Важные предложения для вложений
      })) || [],
    complaints: data.complaints || [],
    analysisStatus: data.analysisStatus || "pending",
    lastAnalyzedAt: data.lastAnalyzedAt || null,
    violations: data.violations || [],
  });

  const prepareDocumentForSave = (doc) => {
    // Убедимся, что все поля документа корректно сериализуются
    const preparedDoc = {
      id: doc.id,
      date: doc.date,
      agency: doc.agency || "",
      agencyTarget: doc.agencyTarget || "",
      originalText: doc.originalText || "",
      summary: doc.summary || "",
      keySentences: Array.isArray(doc.keySentences) 
        ? doc.keySentences.filter((p) => p && p.trim()) 
        : [],
      documentDate: doc.documentDate || "",
      senderAgency: doc.senderAgency || "",
      documentSummary: doc.documentSummary || "",
      attachments: Array.isArray(doc.attachments) 
        ? doc.attachments.map((att) => ({
            id: att.id || uuidv4(),
            name: att.name || "",
            type: att.type || "",
            size: att.size || 0,
            path: att.path || "",
            text: att.text || "",
            analysis: att.analysis || null,
            documentDate: att.documentDate || "",
            senderAgency: att.senderAgency || "",
            attachmentSummary: att.attachmentSummary || "",
            fullText: att.text || "", // Используем text вместо fullText
            keySentences: Array.isArray(att.keySentences) 
              ? att.keySentences.filter((p) => p && p.trim()) 
              : []
          }))
        : [],
      complaints: Array.isArray(doc.complaints) ? doc.complaints : [],
      analysisStatus: doc.analysisStatus || "pending",
      lastAnalyzedAt: doc.lastAnalyzedAt || null,
      violations: Array.isArray(doc.violations) ? doc.violations : [],
    };
    
    return preparedDoc;
  };

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

const analyzeDocumentContent = async (docText) => {
  try {
    // Вызываем API для анализа документа
    const { data } = await axios.post(`${API_BASE}/api/documents/${currentDocument.value.id}/analyze`, {
      text: docText
    });

    // Выводим полный ответ модели в консоль
    console.log("Полный ответ модели:", data);
    
    // Проверяем, что keySentences является массивом
    if (!Array.isArray(data.keySentences)) {
      console.warn("keySentences не является массивом:", data.keySentences);
    }
    
    // Гарантируем, что keySentences будет массивом
    return {
      summary: data.summary || "Не удалось сгенерировать краткую суть",
      keySentences: Array.isArray(data.keySentences) ? 
        data.keySentences : 
        [],
      violations: Array.isArray(data.violations) ?
        data.violations :
        [],
      documentDate: data.documentDate || "",
      senderAgency: data.senderAgency || ""
    };
  } catch (error) {
    console.error("Ошибка анализа документа:", error);
    return {
      summary: "Ошибка анализа документа",
      keySentences: [],
      violations: [],
      documentDate: "",
      senderAgency: ""
    };
  }
};


  const determineTargetAgency = (text) => {
    const violations = text.match(/нарушен[ия]|незаконн|жалоб[аы]/gi);
    if (!violations) return "";

    if (text.includes("ФССП") || text.includes("судебн")) return "ФССП";
    if (text.includes("прокурор")) return "Прокуратура";
    if (text.includes("суд")) return "Суд";
    if (text.includes("омбудсмен")) return "Омбудсмен";

    return "ФССП"; // По умолчанию
  };

  const analyzeAttachments = async () => {
  if (!currentDocument.value.attachments?.length) return [];

  isAnalyzing.value = true;
  try {
    // Анализ вложений будет происходить на бэкенде при анализе документа
    // Здесь мы просто возвращаем существующие вложения
    return currentDocument.value.attachments;
  } catch (err) {
    error.value = 'Ошибка анализа вложений: ' + err.message;
    throw err;
  } finally {
    isAnalyzing.value = false;
  }
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
      id: uuidv4(),
      date: new Date().toISOString(),
      originalText: "",
      agencyTarget: "",
      summary: "",
      keySentences: [],
      documentDate: "",
      senderAgency: "",
      documentSummary: "",
      attachments: [],
      complaints: [],
      analysisStatus: "pending",
      lastAnalyzedAt: null,
      violations: [],
    };
  };

  const viewDocument = async (id) => {
    await fetchDocumentById(id);
    router.push(`/documents/${id}`);
  };

  const regenerateAttachmentAnalysis = async (attachmentId) => {
    // Перегенерация анализа вложения будет происходить на бэкенде
    // Здесь мы просто вызываем анализ документа заново
    return await analyzeDocument();
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
    }

  return {
    currentDocument,
    documents,
    isLoading,
    error,
    isAnalyzing,
    agenciesList,
    hasAttachments,
    analyzedDocuments,
    fetchDocuments,
    fetchDocumentById,
    uploadFiles,
    saveDocument,
    deleteDocument,
    analyzeDocument,
    regenerateAttachmentAnalysis,
    fetchComplaints,
    resetCurrentDocument,
    viewDocument,
  }
})

