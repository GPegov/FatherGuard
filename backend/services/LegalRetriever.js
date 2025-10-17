// backend/services/legalRetriever.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEGAL_BASE_DIR = path.join(__dirname, '../dataBase/legalBase');
const REGISTRY_PATH = path.join(LEGAL_BASE_DIR, 'registry.json');

let registry = null;
const articleCache = new Map(); // Кэширование содержимого файлов

/**
 * Загружает реестр статей один раз при первом вызове
 */
async function loadRegistry() {
  if (!registry) {
    const data = await fs.readFile(REGISTRY_PATH, 'utf8');
    registry = JSON.parse(data);
  }
  return registry;
}

/**
 * Читает текст статьи из файла с кэшированием
 */
async function readArticleFile(filename) {
  if (articleCache.has(filename)) {
    return articleCache.get(filename);
  }
  const filePath = path.join(LEGAL_BASE_DIR, filename);
  const text = await fs.readFile(filePath, 'utf8');
  articleCache.set(filename, text.trim());
  return text.trim();
}

/**
 * Находит релевантные статьи по запросу (тексту пользователя или документа)
 * @param {string} query — текст для анализа (обычно combinedText или его начало)
 * @param {number} maxResults — макс. число статей для возврата (по умолчанию 5)
 * @returns {Array<{id: string, name: string, title: string, text: string}>}
 */
export async function findRelevantArticles(query, maxResults = 5) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const registry = await loadRegistry();
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scoredEntries = [];

  // Проходим по всем записям в реестре
  for (const [id, meta] of Object.entries(registry)) {
    const searchableText = `${meta.name} ${meta.title} ${meta.description}`.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (searchableText.includes(term)) {
        score += 1;
      }
    }

    if (score > 0) {
      scoredEntries.push({ id, meta, score });
    }
  }

  // Сортируем по релевантности и ограничиваем количество
  const topEntries = scoredEntries
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  // Загружаем тексты статей
  const results = [];
  for (const { id, meta } of topEntries) {
    try {
      const text = await readArticleFile(meta.filename);
      results.push({
        id,
        name: meta.name,
        title: meta.title,
        text
      });
    } catch (err) {
      console.warn(`Не удалось загрузить статью ${meta.filename}:`, err.message);
      // Пропускаем статью, если файл отсутствует
    }
  }

  return results;
}

/**
 * Формирует контекст для промпта: только тексты статей, без метаданных
 * @param {string} query
 * @param {number} maxResults
 * @returns {string} — готовый блок текста для вставки в промпт
 */
export async function buildLegalContext(query, maxResults = 5) {
  const articles = await findRelevantArticles(query, maxResults);
  if (articles.length === 0) {
    return "Нет релевантных нормативных актов.";
  }

  return articles
    .map(a => `[${a.name}] ${a.title}\n${a.text}`)
    .join('\n\n---\n\n');
}