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

  const analyzeDocumentContent = async (documentId) => {
    try {
      const id = documentId || currentDocument.value.id;
      console.log('Анализ содержимого документа, ID:', id);
      // Правильная передача параметров анализа
      const { data } = await axios.post(
        `${API_BASE}/api/documents/${id}/analyze`,
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
      // Возвращаем объект с полями по умолчанию в случае ошибки
      return {
        summary: "Ошибка анализа документа: " + (error.response?.data?.message || error.message),
        keySentences: [],
        violations: [],
        documentDate: "",
        senderAgency: ""
      };
    }
  };

  const analyzeAttachments = async () => {
    console.log(
      "Анализ вложений, количество:",
      currentDocument.value.attachments?.length
    );
    if (!currentDocument.value.attachments?.length)
      return currentDocument.value.attachments;

    const analyzedAttachments = [];
    for (const attachment of currentDocument.value.attachments) {
      console.log("Анализ вложения:", attachment.id);
      if (attachment.text) {
        try {
          const { data } = await axios.post(
            `${API_BASE}/api/attachments/analyze`,
            { text: attachment.text }
          );
          console.log("Результат анализа вложения:", data);
          analyzedAttachments.push({
            ...attachment,
            analysis: data,
            documentDate: data.documentDate || "",
            senderAgency: data.senderAgency || "",
            summary: data.summary || "",
            keySentences: data.keySentences || [],
          });
        } catch (error) {
          console.error("Ошибка анализа вложения:", error);
          // Даже в случае ошибки добавляем вложение, но с полями по умолчанию
          analyzedAttachments.push({
            ...attachment,
            analysis: {
              documentType: "Неизвестный тип",
              sentDate: "",
              senderAgency: "",
              summary:
                "Ошибка анализа вложения: " +
                (error.response?.data?.message || error.message),
              keySentences: [],
            },
            documentDate: "",
            senderAgency: "",
            summary:
              "Ошибка анализа вложения: " +
              (error.response?.data?.message || error.message),
            keySentences: [],
          });
        }
      } else {
        console.log("Вложение не содержит текста:", attachment.id);
        analyzedAttachments.push(attachment);
      }
    }
    console.log("Анализ вложений завершен:", analyzedAttachments);
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
  };

  // Действия
  const fetchDocuments = async () => {
    return handleApiCall(async () => {
      const { data } = await axios.get(`${API_BASE}/api/documents`);
      documents.value = data.items || data;
    });
  };

  const fetchDocumentById = async (id) => {
    console.log("Загрузка документа по ID:", id);
    return handleApiCall(async () => {
      const { data } = await axios.get(`${API_BASE}/api/documents/${id}`);
      console.log("Загруженный документ:", data);
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
      // Бэкенд возвращает созданный документ в правильной структуре
      currentDocument.value = {
        ...currentDocument.value,
        ...data,
        // Убедимся, что originalText правильно установлен
        originalText:
          data.originalText || currentDocument.value.originalText || "",
      };
      return data;
    });
  };

  const saveDocument = async () => {
    console.log("Сохранение документа:", currentDocument.value);
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
      if (currentDocument.value.id) {
        console.log("Обновление существующего документа");
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
          id: currentDocument.value.id || uuidv4(),
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
    console.log("Анализ документа, ID:", documentId);
    // Если передан ID документа, загружаем его
    if (documentId) {
      await fetchDocumentById(documentId);
    }

    // Проверяем, есть ли текст для анализа
    const hasOriginalText =
      currentDocument.value.originalText &&
      currentDocument.value.originalText.trim().length > 0;
    const hasAttachmentsWithText = currentDocument.value.attachments?.some(
      (att) => att.text && att.text.trim().length > 0
    );

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
      currentDocument.value.analysisStatus = "processing";

      const analysis = await analyzeDocumentContent(currentDocument.value.id);
      const attachmentsAnalysis = await analyzeAttachments();

      currentDocument.value = {
        ...currentDocument.value,
        ...analysis,
        attachments: attachmentsAnalysis,
        analysisStatus: "completed",
        lastAnalyzedAt: new Date().toISOString(),
      };

      const savedDocument = await saveDocument();
      return savedDocument;
    } catch (err) {
      console.error("Ошибка анализа документа:", err);
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
      const attachment = currentDocument.value.attachments.find(
        (a) => a.id === attachmentId
      );
      if (!attachment || !attachment.text) {
        throw new Error("Вложение не найдено или не содержит текст");
      }

      const { data } = await axios.post(`${API_BASE}/api/attachments/analyze`, {
        text: attachment.text,
      });

      const updatedAttachment = {
        ...attachment,
        analysis: data,
        documentDate: data.documentDate || "",
        senderAgency: data.senderAgency || "",
        summary: data.summary || "",
        keySentences: data.keySentences || [],
      };

      const index = currentDocument.value.attachments.findIndex(
        (a) => a.id === attachmentId
      );
      if (index !== -1) {
        currentDocument.value.attachments[index] = updatedAttachment;
        await saveDocument();
      }

      return updatedAttachment;
    } catch (err) {
      error.value = "Ошибка перегенерации анализа: " + err.message;
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
