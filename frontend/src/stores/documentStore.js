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
    keyParagraphs: [], // Существенные параграфы (п.5)
    // Расшифровка документа (п.6)
    documentDate: "",
    senderAgency: "",
    documentSummary: "",
    fullText: "",
    attachments: [],
    complaints: [],
    analysisStatus: "pending",
    lastAnalyzedAt: null,
    violations: [],
  });

  // Геттеры
  const agenciesList = computed(() => {
    const agencies = new Set(["ФССП", "Прокуратура", "Суд", "Омбудсмен"]);
    documents.value.forEach((doc) => {
      if (doc.agency) agencies.add(doc.agency);
      if (doc.senderAgency) agencies.add(doc.senderAgency);
    });
    return Array.from(agencies).sort();
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

  // Вспомогательные функции

  const normalizeDocumentData = (data) => ({
    id: data.id || null,
    date: data.date || new Date().toISOString().split("T")[0],
    agency: data.agency || "", // старое поле (оставляем для обратной совместимости)
    agencyTarget: data.agencyTarget || "", // новое поле (п.3)
    originalText: data.originalText || "", // п.2
    summary: data.summary || "", // п.4
    keyParagraphs: data.keyParagraphs || [], // п.5
    // Поля для расшифровки документа (п.6)
    documentDate: data.documentDate || "",
    senderAgency: data.senderAgency || "",
    documentSummary: data.documentSummary || data.summary || "", // п.6в (используем summary если нет отдельного поля)
    fullText: data.fullText || data.originalText || "", // п.6г
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
        fullText: att.fullText || att.text || "",
        keyParagraphs: att.keyParagraphs || [],
      })) || [],
    complaints: data.complaints || [],
    analysisStatus: data.analysisStatus || "pending",
    lastAnalyzedAt: data.lastAnalyzedAt || null,
    violations: data.violations || [],
  });

  const prepareDocumentForSave = (doc) => ({
    ...doc,
    keyParagraphs: doc.keyParagraphs.filter((p) => p.trim()),
    attachments: doc.attachments.map((att) => ({
      id: att.id || uuidv4(),
      name: att.name,
      type: att.type,
      size: att.size,
      path: att.path,
      text: att.text || "",
      analysis: att.analysis || null,
    })),
  });

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
    const docText = currentDocument.value.originalText;
    const analysis = await aiStore.analyzeDocument(docText);

    // Выводим полный ответ модели в консоль
    console.log("Полный ответ модели:", analysis);
    
    // Гарантируем, что keyParagraphs будет массивом
    return {
      summary: analysis.summary || "Не удалось сгенерировать краткую суть",
      keyParagraphs: Array.isArray(analysis.paragraphs) ? 
        analysis.paragraphs : 
        [],
      violations: Array.isArray(analysis.violations) ?
        analysis.violations :
        [],
      documentDate: analysis.documentDate || "",
      senderAgency: analysis.senderAgency || ""
    };
  } catch (error) {
    console.error("Ошибка анализа документа:", error);
    return {
      summary: "Ошибка анализа документа",
      keyParagraphs: [],
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
    const updatedAttachments = await Promise.all(
      currentDocument.value.attachments.map(async (att) => {
        if (!att.text) return att;
        
        const analysis = await aiStore.analyzeAttachment(att.text);
        const attachmentSummary = await aiStore.generateAttachmentSummary(att.text);
        
        return {
          ...att,
          analysis,
          documentDate: extractDate(att.text),
          senderAgency: extractAgency(att.text),
          attachmentSummary: attachmentSummary.summary || "", // Чёткое название
          fullText: att.text,
          keyParagraphs: analysis.keyParagraphs || []
        };
      })
    );

    currentDocument.value.attachments = updatedAttachments;
    return updatedAttachments;
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
    currentDocument.value = createEmptyDocument();
  };

  const viewDocument = async (id) => {
    await fetchDocumentById(id);
    router.push(`/documents/${id}`);
  };

  const regenerateAttachmentAnalysis = async (attachmentId) => {
    const attachment = currentDocument.value.attachments.find(
      (a) => a.id === attachmentId
    );
    if (!attachment) return;

    try {
      const analysis = await aiStore.analyzeAttachment(attachment.text);
      const updatedAttachment = {
        ...attachment,
        analysis,
        documentDate: extractDate(attachment.text),
        senderAgency: extractAgency(attachment.text),
        documentSummary: analysis.summary || "",
        fullText: attachment.text,
        keyParagraphs: analysis.paragraphs || [],
      };

      const index = currentDocument.value.attachments.findIndex(
        (a) => a.id === attachmentId
      );
      currentDocument.value.attachments[index] = updatedAttachment;
      await saveDocument();

      return updatedAttachment;
    } catch (err) {
      error.value = "Ошибка перегенерации анализа вложения: " + err.message;
      throw err;
    }
  };

  const generateComplaint = async (documentId, agency) => {
    return handleApiCall(async () => {
      const doc = documents.value.find((d) => d.id === documentId);
      if (!doc) throw new Error("Документ не найден");

      const relatedDocs = documents.value.filter(
        (d) => d.date <= doc.date && d.id !== documentId
      );

      const { data } = await axios.post(`${API_BASE}/api/complaints`, {
        documentId,
        agency,
        relatedDocuments: relatedDocs.map((d) => d.id),
      });

      if (currentDocument.value.id === documentId) {
        currentDocument.value.complaints = [
          ...(currentDocument.value.complaints || []),
          data,
        ];
        await saveDocument();
      }

      return data;
    });
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
    generateComplaint,
    fetchComplaints,
    resetCurrentDocument,
    viewDocument,
  }
})

