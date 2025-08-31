<template>
  <div class="documents-list">
    <div class="header">
      <h1>Архив входящих документов</h1>
      <router-link to="/" class="new-doc-btn">+ Новый документ</router-link>
    </div>

    <div class="filters">
      <input v-model="searchQuery" type="text" placeholder="Поиск по тексту" class="search-input" />
      <select v-model="selectedAgency" class="agency-select">
        <option value="">Все ведомства</option>
        <option v-for="agency in agenciesList" :key="agency" :value="agency">
          {{ agency }}
        </option>
      </select>
      <button @click="applyFilters" class="filter-btn">Применить</button>
      <button @click="resetFilters" class="filter-btn">Сбросить</button>
    </div>

    <div v-if="isLoading" class="loading">Загрузка документов...</div>
    <div v-else-if="filteredDocuments.length === 0" class="empty">
      Нет документов, соответствующих фильтрам
    </div>


    <ul v-else class="documents">
      <li v-for="doc in filteredDocuments" :key="doc.id" class="document-item">
        <div class="document-main" @click="viewDocument(doc.id)">
          <div class="document-meta">
            <span class="document-date">{{ formatDate(doc.date) }}</span>
            <span class="document-agency">{{ doc.agency }}</span>
          </div>
          <p class="document-summary">
            {{ doc.summary || doc.originalText.substring(0, 100) + '...' }}
          </p>
        </div>
        <div class="document-actions">
          <button @click.stop="openComplaintDialog(doc.id)" class="analyze-btn">
            Проверить законность
          </button>
          <button @click.stop="confirmDelete(doc.id)" class="delete-btn">
            Удалить
          </button>
        </div>
      </li>
    </ul>


    <!-- Модальное окно подтверждения удаления -->
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить этот документ?</p>
        <div class="modal-actions">
          <button @click="deleteDocument" class="confirm-btn">Да, удалить</button>
          <button @click="showDeleteModal = false" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>

    <!-- Модальное окно выбора органа для подачи жалобы -->
    <div v-if="showComplaintDialog" class="complaint-dialog" @click.self="showComplaintDialog = false">
      <div class="dialog-content">
        <h3>Выберите орган для подачи жалобы</h3>
        <div class="agency-selection">
          <select v-model="selectedComplaintAgency" class="agency-select">
            <option value="" disabled hidden>Выберите надзорный орган</option>
            <option v-for="agency in complaintAgencies" :key="agency" :value="agency">
              {{ agency }}
            </option>
          </select>
        </div>
        <div class="dialog-actions">
          <button 
            @click="generateComplaint" 
            class="action-btn primary"
            :disabled="!selectedComplaintAgency || isGeneratingComplaint"
          >
            {{ isGeneratingComplaint ? 'Генерация...' : 'Создать жалобу' }}
          </button>
          <button 
            @click="showComplaintDialog = false" 
            class="action-btn"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>

    <NotificationToast v-if="showNotification" :message="notificationMessage" :type="notificationType" :duration="1500"
      @close="showNotification = false" />

    <!-- Индикатор загрузки -->
    <div v-if="isGeneratingComplaint" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Генерация жалобы...</div>
        <div class="loading-subtext">Пожалуйста, подождите</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDocumentStore } from '@/stores/documentStore'
import { useComplaintStore } from '@/stores/complaintStore'
import { useRouter } from 'vue-router'
import NotificationToast from '@/components/ui/NotificationToast.vue'

const documentStore = useDocumentStore()
const complaintStore = useComplaintStore()
const router = useRouter()

const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const isLoading = ref(false)
const searchQuery = ref('')
const selectedAgency = ref('')

// Для удаления документов
const showDeleteModal = ref(false)
const documentToDelete = ref(null)

// Для модального окна жалобы
const showComplaintDialog = ref(false)
const selectedComplaintAgency = ref('')
const currentDocumentId = ref(null)
const isGeneratingComplaint = ref(false)

// Варианты надзорных органов
const complaintAgencies = computed(() => complaintStore.agenciesOptions)

// Открытие модального окна для выбора органа
const openComplaintDialog = (documentId) => {
  currentDocumentId.value = documentId
  selectedComplaintAgency.value = ''
  showComplaintDialog.value = true
}

// Генерация жалобы
const generateComplaint = async () => {
  if (!selectedComplaintAgency.value) return

  isGeneratingComplaint.value = true
  try {
    const complaint = await complaintStore.generateComplaint(
      currentDocumentId.value,
      selectedComplaintAgency.value
    )

    // Показываем уведомление
    notificationMessage.value = 'Жалоба успешно создана'
    notificationType.value = 'success'
    showNotification.value = true

    // Закрываем диалог
    showComplaintDialog.value = false

    // Переходим к подробному просмотру созданной жалобы
    if (complaint && complaint.id) {
      router.push(`/complaints/${complaint.id}`)
    } else {
      // Если по какой-то причине ID жалобы не доступен, переходим к списку жалоб
      router.push('/complaints')
    }
  } catch (error) {
    console.error('Ошибка генерации жалобы:', error)

    // Уведомление об ошибке
    notificationMessage.value = 'Ошибка при создании жалобы'
    notificationType.value = 'error'
    showNotification.value = true
  } finally {
    isGeneratingComplaint.value = false
  }
}

const confirmDelete = (id) => {
  documentToDelete.value = id
  showDeleteModal.value = true
}

const deleteDocument = async () => {
  if (documentToDelete.value) {
    try {
      await documentStore.deleteDocument(documentToDelete.value)
      await documentStore.fetchDocuments()

      // Показываем уведомление
      notificationMessage.value = 'Документ успешно удалён'
      notificationType.value = 'success'
      showNotification.value = true
    } catch (error) {
      console.error('Ошибка удаления:', error)

      // Уведомление об ошибке
      notificationMessage.value = 'Ошибка при удалении документа'
      notificationType.value = 'error'
      showNotification.value = true
    }
  }
  showDeleteModal.value = false
}


const viewDocument = (id) => {
  router.push(`/documents/${id}`)
}

// Загружаем документы при монтировании
onMounted(async () => {
  isLoading.value = true
  try {
    await documentStore.fetchDocuments()
  } finally {
    isLoading.value = false
  }
})

// Получаем список ведомств
const agenciesList = computed(() => documentStore.agenciesList)

// Фильтрация документов
const filteredDocuments = computed(() => {
  return documentStore.documents.filter((doc) => {
    const matchesSearch =
      searchQuery.value === '' ||
      doc.summary.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      doc.originalText.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesAgency =
      selectedAgency.value === '' || doc.agency === selectedAgency.value

    return matchesSearch && matchesAgency
  })
})

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU')
}

const applyFilters = () => {
  // Фильтрация происходит автоматически через computed свойство
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedAgency.value = ''
}
</script>

<style scoped>
.documents-list {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

h1 {
  font-size: 1.5em;
  color: #2c3e50;
}

.new-doc-btn {
  background: #42b983;
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9em;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.agency-select {
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filter-btn {
  background: #f0f0f0;
  border: 1px solid #ddd;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.documents {
  list-style: none;
  padding: 0;
  margin: 0;
}

.document-item {
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.2s;
  cursor: pointer;
}

.document-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.document-main {
  flex: 1;
}

.document-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 8px;
  font-size: 0.9em;
  color: #666;
}

.document-date {
  font-weight: bold;
}

.document-agency {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.document-summary {
  margin: 0;
  line-height: 1.5;
}

.analyze-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 15px;
  white-space: nowrap;
}

.analyze-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.complaint-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

.complaint-dialog.closing {
  animation: fadeOut 0.3s ease-out forwards;
}

.dialog-content {
  background: white;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  animation: slideIn 0.3s ease-out;
}

.dialog-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.action-btn {
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-btn.primary {
  background: #42b983;
  color: white;
  border: none;
}

.action-btn.primary:hover {
  background: #359f6b;
}

/* Анимация загрузки */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease-out;
}

.loading-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  text-align: center;
  max-width: 300px;
  width: 90%;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(66, 185, 131, 0.3);
  border-top: 4px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.loading-text {
  font-size: 1.1em;
  color: #333;
  margin-bottom: 10px;
}

.loading-subtext {
  font-size: 0.9em;
  color: #666;
}

/* Анимации */
@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}


/* Стили для выбора органа */
.agency-selection {
  margin-bottom: 20px;
}

.agency-select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 16px;
  color: #333;
  appearance: none; /* Убираем стандартные стрелки в некоторых браузерах */
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

.agency-select:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}

/* Стиль для placeholder в select */
.agency-select option[disabled] {
  display: none;
}

.agency-select option {
  color: #333;
}

/* Удаление и модальное окно */

.document-actions {
  display: flex;
  gap: 10px;
  margin-left: 15px;
}

.delete-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.3s;
}

.delete-btn:hover {
  background: #cc0000;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 25px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  margin-top: 0;
  color: #2c3e50;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.confirm-btn {
  background: #ff4444;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background: #f0f0f0;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}
</style>