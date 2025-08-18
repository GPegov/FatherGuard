Основные модули
1. Frontend (Vue 3 Composition API)
Технологии: Vue 3, Pinia, Vue Router, Vite

Главные компоненты:
App.vue - Корневой компонент

Main.js - Инициализация приложения

Router - Маршрутизация между страницами

Хранилища (Pinia Stores):
aiStore.js - Взаимодействие с AI моделями

documentStore.js - Управление документами

complaintStore.js - Управление жалобами

Компоненты:
FileUpload.vue - Загрузка файлов (PDF, DOCX, TXT)

NotificationToast.vue - Уведомления

DocumentReview.vue - Предпросмотр и редактирование документов

DocumentsList.vue - Список документов

ComplaintsList.vue - Список жалоб

ComplaintForm.vue - Форма создания жалобы

2. Backend (Node.js)
Технологии: Express, LowDB (JSON DB), Multer (загрузка файлов)

Основные модули:
app.mjs - Инициализация сервера

db.json - База данных (документы и жалобы)

Контроллеры:
aiController.js - Взаимодействие с AI

documentController.js - Управление документами

complaintController.js - Управление жалобами

Сервисы:
aiService.js - Основная логика работы с AI

pdfService.js - Извлечение текста из PDF

Критически важные зависимости
1. Взаимодействие между компонентами
text
Frontend:
  App.vue → Router → Views → Components
  Components ↔ Stores (Pinia)
  Stores ↔ Backend API

Backend:
  Controllers ↔ Services
  Services ↔ DB (db.json)
2. Ключевые функции и их взаимосвязи
Документы:
uploadFiles (FileUpload.vue) → uploadFiles (documentStore) → POST /api/documents/upload

analyzeDocument (DocumentReview.vue) → analyzeDocument (documentStore) → analyzeDocumentContent (aiStore) → POST /api/documents/:id/analyze

Жалобы:
generateComplaint (ComplaintForm.vue) → generateComplaint (complaintStore) → generateComplaint (aiStore) → POST /api/complaints/generate

exportComplaint (ComplaintsList.vue) → exportComplaint (complaintStore) → GET /api/complaints/:id/export

3. Структура данных
Документ (db.json):
json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "agency": "ФССП/Прокуратура/Суд",
  "originalText": "Полный текст",
  "summary": "Краткая суть",
  "documentDate": "Дата документа",
  "senderAgency": "Ведомство-отправитель",
  "keyParagraphs": ["цитата1", "цитата2"],
  "attachments": [],
  "complaints": [],
  "analysisStatus": "pending/processing/completed/failed",
  "violations": []
}
Жалоба (db.json):
json
{
  "id": "uuid",
  "documentId": "ссылка на документ",
  "agency": "ФССП/Прокуратура/Суд",
  "content": "Текст жалобы",
  "relatedDocuments": [],
  "status": "draft/sent",
  "createdAt": "timestamp"
}
Важные технические детали
1. Работа с AI (aiStore.js)
Модель: llama3.1:latest (локально через Ollama)

Основные методы:

generateSummary - Генерация краткой сводки

extractKeyParagraphs - Извлечение ключевых цитат

detectViolations - Поиск юридических нарушений

generateComplaint - Генерация жалобы

2. Безопасность и валидация
Проверка MIME-типов и расширений файлов

Лимит размера файлов (10MB по умолчанию)

Валидация JSON на бэкенде

Обработка ошибок на всех уровнях

3. Производительность
Кэширование результатов анализа

Пакетная обработка вложений

Оптимизированные запросы к локальной модели

Рекомендации для LLM
Не изменять:

Структуру хранилищ Pinia

Имена методов в aiStore.js

Формат данных в db.json

Маршруты в router.js

Приоритеты изменений:

Улучшение промптов в aiService.js

Оптимизация UI компонентов

Добавление новых полей в DocumentReview.vue

Опасные зоны:

Логика обработки PDF (pdfService.js)

Методы сохранения в documentStore.js
