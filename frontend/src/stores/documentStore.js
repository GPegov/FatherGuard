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
    date: new Date().toISOString().split('T')[0],
    agency: '',
    originalText: '',
    summary: '',
    keySentences: [],
    documentDate: '',
    senderAgency: '',
    attachments: [],
    complaints: [],
    analysisStatus: 'pending',
    lastAnalyzedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    violations: []
  });

  // Геттеры
  const agenciesList = computed(() => {
    const complaintAgencies = new Set(["ФССП", "Прокуратура", "Суд", "Омбудсмен"]);
    const allAgencies = new Set(complaintAgencies);
    
    documents.value.forEach((doc) => {
      const agency = doc.agency || doc.senderAgency;
      if (agency && typeof agency === 'string' && !complaintAgencies.has(agency)) {
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

  const analyzeDocumentContent = async () => {
    try {
      const { data } = await axios.post(
        `${API_BASE}/api/documents/${currentDocument.value.id}/analyze`,
        {
          instructions: "",
          strictMode: false
        }
      );

      console.log("Полный ответ модели:", data);
      
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

  const analyzeAttachments = async () => {
    if (!currentDocument.value.attachments?.length) return currentDocument.value.attachments;

    const analyzedAttachments = [];
    for (const attachment of currentDocument.value.attachments) {
      if (attachment.text) {
        try {
          const { data } = await axios.post(
            `${API_BASE}/api/attachments/analyze`,
            { text: attachment.text }
          );
          analyzedAttachments.push({
            ...attachment,
            analysis: data,
            documentDate: data.documentDate || "",
            senderAgency: data.senderAgency || "",
            summary: data.summary || "",
            keySentences: data.keySentences || []
          });
        } catch (error) {
          console.error("Ошибка анализа вложения:", error);
          analyzedAttachments.push(attachment);
        }
      } else {
        analyzedAttachments.push(attachment);
      }
    }
    return analyzedAttachments;
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
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      agency: '',
      originalText: '',
      summary: '',
      keySentences: [],
      documentDate: '',
      senderAgency: '',
      attachments: [],
      complaints: [],
      analysisStatus: 'pending',
      lastAnalyzedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      violations: []
    };
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
      currentDocument.value = data;
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

      // Бэкенд возвращает созданный документ в правильной структуре
      currentDocument.value = data;
      return data;
    });
  };

  const saveDocument = async () => {
    return handleApiCall(async () => {
      // Убедимся, что у документа есть все необходимые поля
      // и актуальная дата обновления
      currentDocument.value.updatedAt = new Date().toISOString();
      
      let savedDocument;
      if (currentDocument.value.id) {
        const { data } = await axios.put(
          `${API_BASE}/api/documents/${currentDocument.value.id}`,
          currentDocument.value
        );
        savedDocument = data;
      } else {
        // Убедимся, что новый документ имеет правильную структуру
        const newDocToSave = {
          ...currentDocument.value,
          id: currentDocument.value.id || uuidv4(),
          createdAt: currentDocument.value.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const { data } = await axios.post(
          `${API_BASE}/api/documents`,
          newDocToSave
        );
        savedDocument = data;
      }

      updateDocumentsList(savedDocument);
      // После сохранения обновляем currentDocument значением от сервера
      currentDocument.value = savedDocument;
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

      const analysis = await analyzeDocumentContent();
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

  const regenerateAttachmentAnalysis = async (attachmentId) => {
    isAnalyzing.value = true;
    try {
      const attachment = currentDocument.value.attachments.find(a => a.id === attachmentId);
      if (!attachment || !attachment.text) {
        throw new Error("Вложение не найдено или не содержит текст");
      }

      const { data } = await axios.post(
        `${API_BASE}/api/attachments/analyze`,
        { text: attachment.text }
      );

      const updatedAttachment = {
        ...attachment,
        analysis: data,
        documentDate: data.documentDate || "",
        senderAgency: data.senderAgency || "",
        summary: data.summary || "",
        keySentences: data.keySentences || []
      };

      const index = currentDocument.value.attachments.findIndex(a => a.id === attachmentId);
      if (index !== -1) {
        currentDocument.value.attachments[index] = updatedAttachment;
        await saveDocument();
      }

      return updatedAttachment;
    } catch (err) {
      error.value = 'Ошибка перегенерации анализа: ' + err.message;
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
    regenerateAttachmentAnalysis,
    fetchComplaints,
    resetCurrentDocument,
    viewDocument,
  };
});








