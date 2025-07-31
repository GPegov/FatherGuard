import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

export const useDocumentStore = defineStore('document', () => {
  const router = useRouter()
  
  // Состояние хранилища
  
  const currentDocument = ref({
    id: null,
    date: new Date().toISOString().split('T')[0],
    agency: '',
    originalText: '',
    summary: '',
    keyParagraphs: [],
    attachments: [],
    comments: ''
  })
  
  const documents = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const isAnalyzing = ref(false)



  // Геттеры
  const agenciesList = computed(() => {
    const agencies = new Set(documents.value.map(doc => doc.agency))
    return Array.from(agencies).filter(Boolean)
  })

  const hasAttachments = computed(() => {
    return currentDocument.value.attachments?.length > 0
  })

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
      if (!currentDocument.value.complaints) currentDocument.value.complaints = [];
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
    isLoading.value = true
    error.value = null
    
    try {
      const formData = new FormData()
      
      // Добавляем текст документа если есть
      if (currentDocument.value.originalText) {
        formData.append('text', currentDocument.value.originalText)
      }
      
      // Добавляем файлы
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })

      const { data } = await axios.post('http://localhost:3001/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Обновляем текущий документ
      currentDocument.value = {
        ...currentDocument.value,
        originalText: data.originalText || currentDocument.value.originalText,
        attachments: data.attachments || [],
        id: data.id
      }
      
      return data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const saveDocument = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      let savedDocument
      const docData = {
        ...currentDocument.value,
        // Убедимся что attachments массив
        attachments: currentDocument.value.attachments || []
      }

      // Если есть файлы - используем upload endpoint
      if (docData.attachments.length > 0) {
        const formData = new FormData()
        formData.append('text', docData.originalText)
        formData.append('comments', docData.comments)
        
        // Отправляем существующие файлы через отдельный запрос
        const { data } = await axios.post(
          'http://localhost:3001/api/documents/upload', 
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' }
          }
        )
        savedDocument = data
      } 
      // Если только текст - используем обычный endpoint
      else if (docData.originalText) {
        const { data } = await axios.post(
          'http://localhost:3001/api/documents',
          docData
        )
        savedDocument = data
      } 
      // Если нет ни текста ни файлов - ошибка
      else {
        throw new Error('Документ должен содержать текст или файлы')
      }

      // Обновляем локальное состояние
      if (docData.id) {
        const index = documents.value.findIndex(d => d.id === docData.id)
        if (index !== -1) {
          documents.value[index] = savedDocument
        }
      } else {
        documents.value.unshift(savedDocument)
      }
      
      currentDocument.value = savedDocument
      return savedDocument
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteDocument = async (id) => {
  isLoading.value = true
  try {
    console.log('Пытаемся удалить документ с ID:', id)  
    const response = await axios.delete(`http://localhost:3001/api/documents/${id}`)
    console.log('Ответ сервера:', response.status)  
    documents.value = documents.value.filter(doc => doc.id !== id)
  } catch (err) {
    console.error('Ошибка удаления:', err)  
    error.value = err.response?.data?.message || err.message
    throw err
  } finally {
    isLoading.value = false
  }
}

  const fetchDocuments = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const { data } = await axios.get('http://localhost:3001/api/documents')
      documents.value = data.items || data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchDocumentById = async (id) => {
  isLoading.value = true
  error.value = null
  
  try {
    const { data } = await axios.get(`http://localhost:3001/api/documents/${id}`)
    currentDocument.value = data // Важно: сохраняем в currentDocument
    return data
  } catch (err) {
    error.value = err.response?.data?.message || err.message
    throw err
  } finally {
    isLoading.value = false
  }
}

  // Остальные методы остаются без изменений
  const addAttachment = async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const { data } = await axios.post(
        'http://localhost:3001/api/documents/attachments', 
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )

      currentDocument.value.attachments.push(data)
      return data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  const removeAttachment = async (attachmentId) => {
    try {
      await axios.delete(`http://localhost:3001/api/documents/attachments/${attachmentId}`)
      currentDocument.value.attachments = currentDocument.value.attachments.filter(
        att => att.id !== attachmentId
      )
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  
const analyzeDocument = async (documentId) => {
  isAnalyzing.value = true;
  try {
    const docText = currentDocument.value.originalText;
    const { data } = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'deepseek-r1:14b',
        prompt: `Проанализируй юридический документ и выдели:\n1. Краткую суть (3-5 предложений)\n2. Ключевые параграфы\n3. Возможные нарушения\n\nТекст документа:\n${docText}`,
        format: 'json',
        temperature: 0.3
      },
      {
        timeout: 200000
      }
    );

    if (currentDocument.value.id === documentId) {
      currentDocument.value.summary = data.summary;
      currentDocument.value.keyParagraphs = data.keyParagraphs;
      currentDocument.value.violations = data.violations;
    }

    return data;
  } finally {
    isAnalyzing.value = false;
  }
};



//   const analyzeDocument = async (documentId) => {
//     isAnalyzing.value = true;
//     error.value = null;
    
//     try {
//       // 1. Отправляем запрос с дополнительными параметрами
//       const { data } = await axios.post(
//         `http://localhost:3001/api/documents/${documentId}/analyze`,
//         {
//           model: 'deepseek-r1:14b',
//           instructions: 'Выделите краткую суть и существенные параграфы',
//           strictMode: true 
//         },
//         {
//           timeout: 100000, 
//           headers: {
//             'X-Requested-With': 'XMLHttpRequest'
//           }
//         }
//       );

//       // 2. Валидация ответа
//       if (!data.summary || !Array.isArray(data.keyParagraphs)) {
//         throw new Error('Некорректный формат ответа от сервера');
//       }

//       // 3. Обновляем текущий документ
//       if (currentDocument.value.id === documentId) {
//         currentDocument.value = {
//           ...currentDocument.value,
//           summary: data.summary,
//           keyParagraphs: data.keyParagraphs,
//           lastAnalyzedAt: new Date().toISOString()
//         };
//       }

//       // 4. Обновляем документ в общем списке
//       const index = documents.value.findIndex(d => d.id === documentId);
//       if (index !== -1) {
//         documents.value[index] = {
//           ...documents.value[index],
//           summary: data.summary,
//           keyParagraphs: data.keyParagraphs,
//           updatedAt: new Date().toISOString()
//         };
//       }

//       // 5. Логирование успешного анализа
//       console.log(`Документ ${documentId} успешно проанализирован`);
//       return data;

//     } catch (err) {
//       // Улучшенная обработка ошибок
//       const errorMessage = err.response?.data?.message 
//         || err.message 
//         || 'Неизвестная ошибка при анализе';
      
//       error.value = errorMessage;
//       console.error('Ошибка анализа:', {
//         documentId,
//         error: err.response?.data || err.message,
//         stack: err.stack
//       });

//       // Возвращаем структурированную ошибку
//       throw {
//         type: 'ANALYSIS_ERROR',
//         message: errorMessage,
//         documentId,
//         originalError: err
//       };
//     } finally {
//       isAnalyzing.value = false;
//     }
// }


  const resetCurrentDocument = () => {
    currentDocument.value = {
      id: null,
      date: new Date().toISOString().split('T')[0],
      agency: '',
      originalText: '',
      summary: '',
      keyParagraphs: [],
      attachments: [],
      comments: ''
    }
  }

  const setCurrentDocument = (doc) => {
    currentDocument.value = { ...doc }
  }

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
    await fetchDocumentById(id)
    router.push(`/documents/${id}`)
  }
  }
})