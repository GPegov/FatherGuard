import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { v4 as uuidv4 } from "uuid";

export const useDocumentStore = defineStore("document", () => {
  const router = useRouter();

  const API_BASE = "http://localhost:3001";

  // Состояние хранилища
  const currentDocument = ref({
    id: null,
    date: new Date().toISOString().split("T")[0],
    agency: "",
    originalText: "",
    summary: "",
    documentDate: "",
    senderAgency: "",
    keyParagraphs: [],
    attachments: [],
    complaints: [],
    complaintAgency: "",
    analysisStatus: "pending", // 'pending' | 'processing' | 'completed' | 'failed'
    lastAnalyzedAt: null,
  });

  const documents = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isAnalyzing = ref(false);

  // Геттеры
  const agenciesList = computed(() => {
    const agencies = new Set();
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
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await axios.get(`${API_BASE}/api/documents`);
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
      currentDocument.value = {
        id: data.id,
        date: data.date || new Date().toISOString().split("T")[0],
        agency: data.agency || "",
        originalText: data.originalText || "",
        summary: data.summary || "",
        documentDate: data.documentDate || "",
        senderAgency: data.senderAgency || "",
        keyParagraphs: data.keyParagraphs || [],
        attachments: data.attachments || [],
        comments: data.comments || "",
        complaints: data.complaints || [],
        analysisStatus: data.analysisStatus || "pending",
        lastAnalyzedAt: data.lastAnalyzedAt || null,
      };
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

      if (currentDocument.value.originalText) {
        formData.append("text", currentDocument.value.originalText);
      }

      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const { data } = await axios.post(
        "http://localhost:3001/api/documents/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

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
      const docToSave = {
        ...currentDocument.value,
        keyParagraphs: currentDocument.value.keyParagraphs.filter((p) =>
          p.trim()
        ),
        attachments: currentDocument.value.attachments.map((att) => ({
          id: att.id || uuidv4(),
          name: att.name,
          type: att.type,
          size: att.size,
          path: att.path,
          text: att.text || "",
          analysis: att.analysis || null,
        })),
      };

      let savedDocument;

      if (docToSave.id) {
        const { data } = await axios.put(
          `${API_BASE}/api/documents/${docToSave.id}`,
          docToSave
        );
        savedDocument = data;
      } else {
        const { data } = await axios.post(
          "http://localhost:3001/api/documents",
          docToSave
        );
        savedDocument = data;
      }

      if (docToSave.id) {
        const index = documents.value.findIndex((d) => d.id === docToSave.id);
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
      await axios.delete(`http://localhost:3001/api/documents/${id}`);
      documents.value = documents.value.filter((doc) => doc.id !== id);

      if (currentDocument.value.id === id) {
        resetCurrentDocument();
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const analyzeDocument = async () => {
    isAnalyzing.value = true;
    error.value = null;

    try {
      // Обновляем статус документа
      currentDocument.value.analysisStatus = "processing";
      await saveDocument();

      const docText = currentDocument.value.originalText;
      const { data } = await axios.post(
        "http://localhost:11434/api/generate",
        {
          model: "llama3:8b",
          prompt: `Проанализируй юридический документ и выдели:
1. Краткую суть (3-5 предложений)
2. От 1 до 3 ключевых параграфа (дословно)
3. Возможные нарушения
4. Дату документа (если есть)
5. Ведомство-отправитель (если есть)

Текст документа:
${docText.substring(0, 10000)}`,
          format: "json",
          temperature: 0.3,
        },
        {
          timeout: 800000,
        }
      );

      // Обновляем документ с результатами анализа
      currentDocument.value = {
        ...currentDocument.value,
        summary: data.summary || "",
        keyParagraphs: data.keyParagraphs || [],
        documentDate: data.documentDate || "",
        senderAgency: data.senderAgency || "",
        analysisStatus: "completed",
        lastAnalyzedAt: new Date().toISOString(),
      };

      // Анализ вложений
      if (currentDocument.value.attachments?.length) {
        for (const attachment of currentDocument.value.attachments) {
          if (attachment.text) {
            const { data: analysis } = await axios.post(
              "http://localhost:11434/api/generate",
              {
                model: "llama3:8b",
                prompt: `Проанализируй вложенный документ:
1. Укажи тип документа
2. Выдели дату отправления (ДД.ММ.ГГГГ)
3. Определи ведомство-отправитель
4. Сгенерируй краткую суть
5. Выдели от 1 до 3 ключевых параграфа (дословно)

Текст документа:
${attachment.text.substring(0, 10000)}`,
                format: "json",
                temperature: 0.2,
              }
            );
            attachment.analysis = analysis;
          }
        }
      }

      await saveDocument();
      return data;
    } catch (err) {
      currentDocument.value.analysisStatus = "failed";
      await saveDocument();
      error.value =
        "Ошибка анализа: " + (err.response?.data?.message || err.message);
      throw err;
    } finally {
      isAnalyzing.value = false;
    }
  };


  

  const generateComplaint = async (documentId, agency) => {
    isAnalyzing.value = true;
    error.value = null;

    try {
      const doc = documents.value.find((d) => d.id === documentId);
      if (!doc) throw new Error("Документ не найден");

      const relatedDocs = documents.value.filter(
        (d) => d.date <= doc.date && d.id !== documentId
      );

      const { data } = await axios.post(
        "http://localhost:11434/api/generate",
        {
          documentId,
          agency,
          relatedDocuments: relatedDocs.map((d) => d.id),
        }
      );

      if (currentDocument.value.id === documentId) {
        if (!currentDocument.value.complaints) {
          currentDocument.value.complaints = [];
        }
        currentDocument.value.complaints.push(data);
        await saveDocument();
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

      if (currentDocument.value.id === documentId) {
        currentDocument.value.complaints = data;
      }

      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const resetCurrentDocument = () => {
    currentDocument.value = {
      id: null,
      date: new Date().toISOString().split("T")[0],
      agency: "",
      originalText: "",
      summary: "",
      documentDate: "",
      senderAgency: "",
      keyParagraphs: [],
      attachments: [],
      comments: "",
      complaints: [],
      analysisStatus: "pending",
      lastAnalyzedAt: null,
    };
  };

  const viewDocument = async (id) => {
    await fetchDocumentById(id);
    router.push(`/documents/${id}`);
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
    analyzedDocuments,

    // Действия
    fetchDocuments,
    fetchDocumentById,
    uploadFiles,
    saveDocument,
    deleteDocument,
    analyzeDocument,
    generateComplaint,
    fetchComplaints,
    resetCurrentDocument,
    viewDocument,
  };
});
