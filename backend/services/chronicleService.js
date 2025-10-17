// backend/services/chronicleService.js
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import AIService from "./aiService.js";
import { aiService } from './documentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ChronicleService {
  constructor(chronicleDbPath) {
    this.chronicleDbPath = chronicleDbPath;
    // Используем общий экземпляр AIService из documentService
    this.aiService = aiService;
  }

  /**
   * Чтение данных летописи из файла
   */
  async readChronicleData() {
    try {
      const data = await fs.readFile(this.chronicleDbPath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      // Если файл не существует или поврежден, создаем пустую структуру
      console.warn(
        "Ошибка при чтении файла летописи, создаем пустую структуру:",
        error.message
      );
      const defaultData = { entries: [] };
      try {
        await this.writeChronicleData(defaultData);
      } catch (writeError) {
        console.error(
          "Ошибка при создании файла летописи:",
          writeError.message
        );
        // Возвращаем данные в памяти, даже если не удалось записать в файл
        return defaultData;
      }
      return defaultData;
    }
  }

  /**
   * Запись данных летописи в файл
   */
  async writeChronicleData(data) {
    try {
      await fs.writeFile(this.chronicleDbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Ошибка при записи файла летописи:", error);
      throw error;
    }
  }

  /**
   * Получить все записи летописи в хронологическом порядке (от новых к старым)
   * @returns {Array} Отсортированные по дате события записи летописи (от новых к старым)
   */
  async getAllChronicleEntries() {
    const data = await this.readChronicleData();
    // Сортируем по дате события (от новых к старым)
    return data.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Получить все записи летописи в хронологическом порядке (от старых к новым)
   * @returns {Array} Отсортированные по дате события записи летописи (от старых к новым)
   */
  async getChronicleEntriesChronologically() {
    const data = await this.readChronicleData();
    // Сортируем по дате события (от старых к новым)
    return data.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Получить все записи летописи в хронологическом порядке (от старых к новым)
   * @returns {Array} Отсортированные по дате события записи летописи (от старых к новым)
   */
  async getChronologicallySortedChronicle() {
    const data = await this.readChronicleData();
    // Сортируем по дате события (от старых к новым)
    return data.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Создать новую запись летописи
   * @param {Object} entryData - Данные для записи
   * @returns {Object} Созданная запись
   */
  async createChronicleEntry(entryData, options = {}) {
    const { integrateChronologically = true } = options;
    const data = await this.readChronicleData();

    const newEntry = {
      id: entryData.id || uuidv4(),
      date: entryData.date || new Date().toISOString().split("T")[0],
      eventType: entryData.eventType || "generic",
      title: entryData.title || "",
      content: entryData.content || "",
      documentId: entryData.documentId || null,
      sourceType: entryData.sourceType || "user_explanation", // новый параметр
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (integrateChronologically) {
      const existingTimeline = await this.getChronicleEntriesChronologically(); // от старых к новым
      // Передаём ВСЮ летопись
      const chronicleContent = await this.aiService.generateChronicleText(
        { ...entryData, sourceType: entryData.sourceType },
        entryData.eventType,
        existingTimeline // ← вся история
      );
      newEntry.content = chronicleContent;
    }

    // Вставляем в правильную хронологическую позицию
    const insertIndex = this.findChronologicalInsertIndex(
      data.entries,
      newEntry
    );
    data.entries.splice(insertIndex, 0, newEntry);

    await this.writeChronicleData(data);
    return newEntry;
  }

  /**
   * Обновить запись летописи
   * @param {string} id - ID записи
   * @param {Object} updateData - Данные для обновления
   * @returns {Object} Обновленная запись или null если не найдена
   */
  async updateChronicleEntry(id, updateData) {
    const data = await this.readChronicleData();

    const entryIndex = data.entries.findIndex((entry) => entry.id === id);
    if (entryIndex === -1) {
      return null;
    }

    const existingEntry = data.entries[entryIndex];
    const updatedEntry = {
      ...existingEntry,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    // Удаляем существующую запись
    data.entries.splice(entryIndex, 1);

    // Находим новое правильное место для обновленной записи по дате события
    const insertIndex = this.findChronologicalInsertIndex(
      data.entries,
      updatedEntry
    );
    data.entries.splice(insertIndex, 0, updatedEntry);

    await this.writeChronicleData(data);
    return updatedEntry;
  }

  /**
   * Удалить запись летописи
   * @param {string} id - ID записи
   * @returns {boolean} true если запись была удалена
   */
  async deleteChronicleEntry(id) {
    const data = await this.readChronicleData();

    const initialLength = data.entries.length;
    data.entries = data.entries.filter((entry) => entry.id !== id);

    if (data.entries.length === initialLength) {
      return false; // Запись не найдена
    }

    await this.writeChronicleData(data);
    return true;
  }

  /**
   * Генерировать текст записи летописи для нового документа
   * @param {Object} document - Документ, для которого создается запись
   * @param {string} userComment - Комментарий пользователя (если есть)
   * @returns {string} Текст записи летописи
   */
  async generateEntryTextForDocument(document, userComment = null) {
    // Пример: "08 октября 2025г - [комментарий пользователя или описание документа]"
    const date = this.formatDate(
      document.date || document.createdAt.split("T")[0]
    );
    let action = "";

    // Если есть комментарий пользователя, добавляем его
    if (userComment && userComment.trim()) {
      action = userComment;
    } else {
      // Если нет комментария, создаем базовое описание на основе заголовка или типа документа
      if (document.summary && document.summary.trim()) {
        action = document.summary;
      } else {
        action = "Добавил информацию для анализа";
      }
    }

    return `${date} - ${action}`;
  }

  /**
   * Генерировать текст записи летописи для проанализированного документа
   * @param {Object} document - Проанализированный документ
   * @returns {string} Текст записи летописи
   */
  async generateEntryTextForAnalysis(document) {
    const date = this.formatDate(
      document.updatedAt
        ? document.updatedAt.split("T")[0]
        : new Date().toISOString().split("T")[0]
    );

    // Если у документа есть краткое содержание в дневниковом стиле, используем его как основу для записи летописи
    if (document.summary && document.summary.trim()) {
      // Убираем дату из начала, если она там есть (чтобы не дублировать)
      let summary = document.summary.trim();
      // Убираем возможные префиксы с датой, оставляя только содержательную часть
      const datePattern = /^\d{1,2}\s[а-яё]+\s\d{4}г\s*-?\s*/i;
      summary = summary.replace(datePattern, "");

      return `${date} - ${summary}`;
    }

    let action = "Проанализировал полученный документ";

    // Добавляем информацию о результатах анализа (резервный вариант)
    if (document.senderAgency && document.senderAgency.trim()) {
      action += ` от ${document.senderAgency}`;
    }
    if (
      document.violations &&
      Array.isArray(document.violations) &&
      document.violations.length > 0
    ) {
      action += `. Обнаружено нарушений: ${document.violations.length}`;
    }

    return `${date} - ${action}`;
  }

  /**
   * Генерировать текст записи летописи для созданной жалобы
   * @param {Object} complaint - Созданная жалоба
   * @param {Object} document - Документ, для которого создается жалоба
   * @returns {string} Текст записи летописи
   */
  async generateEntryTextForComplaint(complaint, document) {
    const date = this.formatDate(new Date().toISOString().split("T")[0]);
    let action = `Подал официальную жалобу`;

    if (complaint.targetAgency && complaint.targetAgency.trim()) {
      action += ` в ${complaint.targetAgency}`;
    }

    if (document && document.summary) {
      action += `. Основание: ${document.summary}`;
    }

    return `${date} - ${action}`;
  }

  /**
   * Форматировать дату в нужный формат (например, "08 октября 2025г")
   * @param {string} dateString - Дата в формате YYYY-MM-DD
   * @returns {string} Форматированная дата
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}г`;
  }

  /**
   * Найти подходящую дату для события из документа
   * @param {Object} document - Документ для анализа
   * @returns {string} Дата события в формате YYYY-MM-DD
   */
  findEventDate(document) {
    // Сначала пытаемся использовать дату из анализа документа (если она была извлечена)
    if (document.documentDate && document.documentDate.trim()) {
      // Если дата в формате DD.MM.YYYY, конвертируем в YYYY-MM-DD
      const dateRegex = /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/;
      const match = document.documentDate.match(dateRegex);
      if (match) {
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
      // Если уже в формате YYYY-MM-DD, возвращаем как есть
      if (document.documentDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return document.documentDate;
      }
    }

    // Затем используем дату создания документа
    if (document.createdAt) {
      return document.createdAt.split("T")[0];
    }

    // В крайнем случае, используем текущую дату
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Создать хронологическую запись для нового документа
   * @param {Object} document - Новый документ
   * @param {string} userComment - Комментарий пользователя (если есть)
   * @returns {Object} Созданная запись летописи
   */
  /**
   * Создать хронологическую запись для документа (нового или проанализированного)
   * @param {Object} document - Документ, для которого создается запись
   * @returns {Object} Созданная запись летописи
   */
  async createEntryForAnalyzedDocument(document) {
    const eventDate = this.findEventDate(document);
    const sourceType = this.determineSourceType(document);

    // ИСПОЛЬЗУЕМ ГОТОВЫЙ combinedText ИЗ ДОКУМЕНТА!
    const combinedText = document.combinedText || "СПРАВКА: Данные для анализа отсутствуют.";
    
    return await this.createChronicleEntry(
      {
        date: eventDate,
        eventType: document.analysisStatus === 'pending' ? "document_created" : "document_analyzed",
        title: document.analysisStatus === 'pending' ? "Добавление документа" : "Анализ документа завершен",
        content: "", // сгенерется автоматически
        documentId: document.id,
        sourceType: sourceType,
        combinedText: combinedText // ← передаём готовый текст
      },
      { integrateChronologically: true }
    );
  }

  /**
   * Создать хронологическую запись для созданной жалобы
   * @param {Object} complaint - Созданная жалоба
   * @param {Object} document - Документ, для которого создается жалоба
   * @returns {Object} Созданная запись летописи
   */
  async createEntryForComplaint(complaint, document) {
    const eventDate = new Date().toISOString().split("T")[0];
    const content = await this.generateEntryTextForComplaint(
      complaint,
      document
    );

    return await this.createChronicleEntry({
      date: eventDate,
      eventType: "complaint_created",
      title: "Создание жалобы",
      content: content,
      documentId: document ? document.id : null,
    });
  }

  /**
   * Получить летопись для конкретного документа
   * @param {string} documentId - ID документа
   * @returns {Array} Записи летописи, связанные с документом
   */
  async getChronicleForDocument(documentId) {
    const data = await this.readChronicleData();
    return data.entries
      .filter((entry) => entry.documentId === documentId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Найти правильное место для вставки новой записи в хронологическом порядке
   * @param {Array} entries - Существующие записи летописи
   * @param {Object} newEntry - Новая запись
   * @returns {number} Индекс для вставки
   */
  findChronologicalInsertIndex(entries, newEntry) {
    // Находим правильное место для новой записи по дате события
    for (let i = 0; i < entries.length; i++) {
      if (new Date(entries[i].date) > new Date(newEntry.date)) {
        continue;
      } else {
        return i;
      }
    }
    // Если не нашли подходящее место, вставляем в конец
    return entries.length;
  }

  determineSourceType(document) {
    // Определяем тип источника на основе данных документа
    if (document.documentType || document.attachments?.length > 0) {
      return "official_document";
    }
    return "user_explanation";
  }
}

export default ChronicleService;
