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
    id: uuidv4(), // Устанавливаем ID сразу при создании
    date: new Date().toISOString().split("T")[0],
    fsspDepartment: "", // конкретное отделение ФССП, которое допустило нарушение
    originalText: "",
    summary: "",
    keySentences: [],
    documentDate: "",
    senderAgency: "",
    attachments: [],
    complaints: [],
    regionCode: "",
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
      const fsspDepartment = doc.fsspDepartment || doc.senderAgency;
      if (
        fsspDepartment &&
        typeof fsspDepartment === "string" &&
        !complaintAgencies.has(fsspDepartment)
      ) {
        allAgencies.add(fsspDepartment);
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

  const isCurrentDocumentAnalyzed = computed(() => {
    return currentDocument.value.analysisStatus === "completed";
  });

  const regionsList = ref([]);

  // Загружаем список регионов при инициализации хранилища
  const loadRegionsList = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/fssp/regions`);
      if (response.data.success) {
        regionsList.value = response.data.regions;
      } else {
        console.error('Ошибка загрузки списка регионов:', response.data.message);
      }
    } catch (error) {
      console.error('Ошибка загрузки списка регионов:', error);
    }
  };
  
  // Инициализируем список регионов при создании хранилища
  loadRegionsList();

  const getRegionNameByCode = computed(() => {
    return (code) => {
      if (!code) return 'Регион не выбран';
      const region = regionsList.value.find(r => r.code === code);
      return region ? region.name : `Регион ${code}`;
    };
  });

  // Вычисляемое свойство для получения списка отделений ФССП по региону
  const fsspDepartmentsByRegion = ref({}); // Кэш для отделений по регионам

  const getFSSPDepartmentsList = computed(() => {
    return (regionCode) => {
      if (!regionCode) return [];
      
      const regionData = fsspDepartmentsByRegion.value[regionCode];
      if (!regionData || !regionData.regions) return [];

      const departments = [];
      // Обрабатываем разные возможные структуры данных
      if (Array.isArray(regionData.regions)) {
        // Случай, когда в data.regions содержится массив регионов
        regionData.regions.forEach(region => {
          if (region.cities) {
            region.cities.forEach(city => {
              if (city.departments) {
                city.departments.forEach(dept => {
                  departments.push(dept.name);
                });
              }
            });
          }
        });
      } else if (regionData.cities) {
        // Стандартный случай
        const region = regionData;
        if (region.cities) {
          region.cities.forEach(city => {
            if (city.departments) {
              city.departments.forEach(dept => {
                departments.push(dept.name);
              });
            }
          });
        }
      }

      return departments.sort();
    };
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
      id: uuidv4(), // Устанавливаем новый ID при сбросе
      date: new Date().toISOString().split("T")[0],
      fsspDepartment: "",
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

  // Добавляем функцию для получения отделений ФССП по коду региона
  const fetchFSSPDepartmentsByRegion = async (regionCode) => {
    try {
      const response = await axios.get(`${API_BASE}/api/fssp/data?regionCode=${regionCode}`);
      if (response.data.success) {
        // Кэшируем данные
        fsspDepartmentsByRegion.value[regionCode] = response.data.data;
        return response.data.data;
      } else {
        console.error('Ошибка получения данных ФССП:', response.data.message);
        return null;
      }
    } catch (error) {
      console.error('Ошибка запроса к API ФССП:', error);
      throw error;
    }
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
      
      // Обновляем только вложения, чтобы не потерять другие поля документа (например, regionCode)
      if (data.attachments && Array.isArray(data.attachments)) {
        currentDocument.value.attachments = data.attachments;
      }
      
      // Также обновляем originalText, если он пришел с сервера
      if (data.originalText !== undefined) {
        currentDocument.value.originalText = data.originalText;
      }
      
      // Возвращаем обновленные данные (но без ID документа, так как документ еще не создан в базе)
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
      
      // Проверяем, существует ли документ в локальном списке (это означает, что он уже был сохранен)
      const isDocumentInList = documents.value.some(doc => doc.id === currentDocument.value.id);
      
      if (isDocumentInList && currentDocument.value.id && typeof currentDocument.value.id === 'string') {
        // Документ уже существует в списке, обновляем его
        console.log("Обновление существующего документа");
        const { data } = await axios.put(
          `${API_BASE}/api/documents/${currentDocument.value.id}`,
          currentDocument.value
        );
        savedDocument = data;
      } else {
        // Документ новый или не в списке, создаем его
        console.log("Создание нового документа");
        const newDocToSave = {
          ...currentDocument.value,
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
    // Защита от повторного вызова во время анализа
    if (isAnalyzing.value) {
      console.log("Анализ уже выполняется, пропускаем повторный вызов");
      return;
    }
    
    // Если передан ID документа, проверим, существует ли он в локальном списке
    if (documentId) {
      const isDocumentInList = documents.value.some(doc => doc.id === documentId);
      
      if (isDocumentInList) {
        // Документ существует в локальном списке, можем безопасно загрузить его с сервера
        try {
          await fetchDocumentById(documentId);
        } catch (fetchErr) {
          // Если документ не найден на сервере, несмотря на наличие в списке, используем currentDocument
          console.log("Документ с ID не найден на сервере, используем currentDocument:", fetchErr.message);
        }
      } else {
        // Документ не существует в локальном списке, пропускаем загрузку с сервера
        console.log("Документ не найден в локальном списке, используем currentDocument (новый документ)");
      }
    }

    // Проверяем, есть ли текст для анализа
    const hasOriginalText = currentDocument.value.originalText && currentDocument.value.originalText.trim().length > 0;
    const hasAttachmentsWithText = currentDocument.value.attachments?.some((att) => att.text && att.text.trim().length > 0);

    console.log("Проверка текста для анализа:", {
      hasOriginalText,
      hasAttachmentsWithText,
    });

    // Если есть вложения, но нет основного текста (пояснений пользователя), показываем ошибку
    if (hasAttachmentsWithText && !hasOriginalText) {
      error.value = "Для анализа вложений необходимо добавить пояснения пользователя в основной текст документа";
      console.log("Нет пояснений пользователя для анализа вложений");
      return;
    }

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
      
      // Всегда используем один и тот же эндпоинт для анализа - по ID
      // Даже если документ не сохранен, мы передаем все необходимые данные в теле запроса
      currentDocument.value.analysisStatus = "processing";

      // Подготовим данные для анализа
      const analyzeData = {
        originalText: currentDocument.value.originalText || "",
        attachments: currentDocument.value.attachments || [],
        instructions: "",
        strictMode: false
      };

      // Вызываем бэкенд для анализа документа по ID
      const { data } = await axios.post(
        `${API_BASE}/api/documents/${currentDocument.value.id}/analyze`,
        analyzeData
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
                keySentences: analysis.keySentences || attachment.keySentences || [],
                text: attachment.text || ""  // Сохраняем исходный текст вложения
              };
            }
            return attachment;
          }) : 
          currentDocument.value.attachments,
        // Сохраняем объединённый текст для отладки
        combinedText: data.combinedText || currentDocument.value.combinedText || "",
        analysisStatus: "completed",
        lastAnalyzedAt: new Date().toISOString(),
      };

      // Возвращаем обновленный документ
      return currentDocument.value;
    } catch (err) {
      console.error("Ошибка анализа документа:", err);
      console.error("Статус:", err.response?.status);
      console.error("Данные ошибки:", err.response?.data);

      currentDocument.value.analysisStatus = "failed";
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
    getRegionNameByCode,
    getFSSPDepartmentsList,
    isCurrentDocumentAnalyzed,

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
    fetchFSSPDepartmentsByRegion,
  };
});
