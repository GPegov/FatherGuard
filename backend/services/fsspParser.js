import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fsspRegions from "./fsspRegions.js";
import transliterate from "./transliterate.js";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FSSPParser {
  constructor(regionName = "Свердловская область") {
    this.regionName = regionName;
    this.regionCode = fsspRegions[regionName] || 66; // По умолчанию Свердловская область
    this.baseUrl = `https://r${this.regionCode}.fssp.gov.ru/contacts`;
    this.fileName = `${this.regionCode}_${transliterate(regionName)}.json`;
    this.dataFilePath = path.join(__dirname, "..", "dataBase", "fsspDepartmentsDB", this.fileName);
  }

  // Получение данных по региону с использованием Puppeteer
  async getRegionData() {
    let browser = null;

    try {
      console.log(
        `Запуск браузера для получения данных по региону: ${this.regionName} (${this.regionCode})`
      );
      console.log(`URL для парсинга: ${this.baseUrl}`);

      // Запускаем браузер
      browser = await puppeteer.launch({
        headless: true, // В продакшене используем headless режим
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // Устанавливаем User-Agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      );

      // Переходим на страницу контактов
      console.log(`Переход на страницу контактов: ${this.baseUrl}`);
      const response = await page.goto(this.baseUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Проверяем статус ответа
      console.log(`Статус ответа: ${response.status()}`);

      // Ждем загрузки контента (уменьшаем время ожидания)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Проверяем URL страницы
      const currentPageUrl = page.url();
      console.log(`Текущий URL страницы: ${currentPageUrl}`);

      // Извлекаем данные с помощью JavaScript в контексте страницы
      const rawData = await page.evaluate(() => {
        const departments = [];

        // Ищем таблицы с отделениями
        const tables = document.querySelectorAll("table");
        console.log("Найдено таблиц:", tables.length);

        tables.forEach((table, tableIndex) => {
          const rows = table.querySelectorAll("tr");
          console.log(`Таблица ${tableIndex + 1}: строк ${rows.length}`);

          if (rows.length > 1) {
            // Обрабатываем строки таблицы
            rows.forEach((row, rowIndex) => {
              const cells = row.querySelectorAll("td, th");
              
              // Структура таблицы на сайте:
              // 0 - порядковый номер (не нужен)
              // 1 - название отделения
              // 2 - адрес отделения
              // 3 - email отделения
              // 4 - телефон отделения
              if (cells.length >= 5) {
                const departmentName = cells[1].textContent.trim();
                const address = cells[2].textContent.trim();
                const phone = cells[4].textContent.trim();

                // Проверяем, является ли строка заголовочной
                // Проверяем первые 5 строк на наличие стоп-слов
                let isHeaderRow = false;
                if (rowIndex < 5) {
                  const rowText = row.textContent.toLowerCase();
                  const stopWords = ["наименование", "структурного", "подразделения", "адрес", "почты", "почта", "телефон"];
                  
                  // Проверяем, содержит ли строка хотя бы одно из стоп-слов
                  for (const word of stopWords) {
                    if (rowText.includes(word)) {
                      isHeaderRow = true;
                      break;
                    }
                  }
                }

                // Проверяем, что строка содержит данные и не является заголовочной
                if ((departmentName || address || phone) && !isHeaderRow) {
                  // Дополнительная проверка на заголовочные данные
                  const isHeaderData = (
                    departmentName.includes("Наименование структурного подразделения") ||
                    address.includes("Почтовый адрес") ||
                    phone.includes("Телефон для получения справочной информации")
                  );

                  // Добавляем только если это не заголовочные данные
                  if (!isHeaderData) {
                    departments.push({
                      name: departmentName || "Отделение ФССП",
                      address: address || "Адрес не указан",
                      phone: phone || "Телефон не указан",
                    });
                  }
                }
              }
            });
          }
        });

        return departments;
      });

      console.log(`Получено ${rawData.length} отделений`);

      // Группируем отделения по городам
      const regionData = await this.groupDepartmentsByCity(rawData);

      return regionData;
    } catch (error) {
      console.error(
        `Ошибка при получении данных по региону ${this.regionName}:`,
        error.message
      );
      console.error("Стек ошибки:", error.stack);

      // В случае ошибки возвращаем тестовые данные
      return {
        region: this.regionName,
        cities: this.getTestRegionData(),
      };
    } finally {
      // Закрываем браузер
      if (browser) {
        await browser.close();
      }
    }
  }

  // Группировка отделений по городам
  async groupDepartmentsByCity(departments) {
    try {
      console.log(
        "Группировка отделений по городам с помощью упрощенного метода..."
      );

      const regionData = {
        region: this.regionName,
        cities: [],
      };

      // Карта для группировки отделений по городам
      const cityMap = new Map();

      // Обрабатываем каждое отделение
      for (const department of departments) {
        // Используем упрощенный метод извлечения города
        const cityName = this.extractCityFromAddress(department.address);

        // Добавляем отделение в соответствующий город
        if (!cityMap.has(cityName)) {
          cityMap.set(cityName, {
            name: cityName,
            departments: [],
          });
        }

        cityMap.get(cityName).departments.push(department);
      }

      // Преобразуем карту в массив городов
      regionData.cities = Array.from(cityMap.values());

      console.log(
        `Отделения сгруппированы по ${regionData.cities.length} городам`
      );
      return regionData;
    } catch (error) {
      console.error(
        "Ошибка при группировке отделений по городам:",
        error.message
      );
      // Возвращаем все отделения в Екатеринбург
      return {
        region: this.regionName,
        cities: [
          {
            name: `г. ${this.regionName.split(" ")[0]}`,
            departments: departments,
          },
        ],
      };
    }
  }

  // ПРОСТОЙ И НАДЁЖНЫЙ метод извлечения города
  extractCityFromAddress(addressData) {
    // Приводим к строке и нормализуем пробелы
    let address = addressData.toString().replace(/\s+/g, ' ').trim();

    // Удаляем почтовый индекс в начале (6 цифр)
    address = address.replace(/^\d{6}\s*/, '');

    // Загружаем известные города для текущего региона
    const knownCitiesData = this.loadKnownCitiesForRegion();
    const knownCities = knownCitiesData.cities || [];

    // Сортируем по длине (сначала самые длинные — важно!)
    const sortedCities = [...knownCities].sort((a, b) => b.length - a.length);

    // Паттерны, указывающие на улицу, дом и т.п.
    const streetIndicators = [
      'ул.', 'улица', 'пер.', 'переулок', 'пр.', 'проспект', 'ш.', 'шоссе',
      'мкр.', 'микрорайон', 'д.', 'дом', 'корп.', 'корпус', 'стр.', 'строение',
      'обл.', 'область', 'р-н', 'район', 'пл.', 'площадь'
    ];

    // 1. Пытаемся найти город по префиксу: "г.", "город", "с.", "п."
    const prefixMatch = address.match(/(?:г\.|город|с\.|село|п\.|посёлок|пос\.)\s*([^\d,;]+)/i);
    if (prefixMatch) {
      let cityPart = prefixMatch[1].trim();

      // Обрезаем всё, что идёт после улицы/дома
      for (const indicator of streetIndicators) {
        const escaped = indicator.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
        const regex = new RegExp(`\\s*${escaped}.*`, 'i');
        cityPart = cityPart.replace(regex, '');
      }

      // Убираем лишние символы в конце
      cityPart = cityPart.replace(/[.,;].*$/, '').trim();

      // Проверяем, совпадает ли с известным городом (с приоритетом по длине)
      for (const city of sortedCities) {
        if (cityPart.startsWith(city)) {
          return city;
        }
      }
    }

    // 2. Если префикс не найден — ищем любой известный город в строке
    for (const city of sortedCities) {
      const escapedCity = city.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedCity}\\b`, 'i'); // \b — граница слова

      if (regex.test(address)) {
        // Проверяем, не является ли это частью названия улицы
        const isStreetName = streetIndicators.some(indicator => {
          const escapedIndicator = indicator.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
          // Паттерны: "ул. Каменск", "Каменск-Уральская ул.", "мкр. Артёмовский"
          const streetPatterns = [
            new RegExp(`${escapedIndicator}\\s+${escapedCity}`, 'i'),
            new RegExp(`${escapedCity}[-\\s]*[А-Яа-я]*\\s+${escapedIndicator}`, 'i'),
            new RegExp(`${escapedCity}[\\s-]+(?:ул|пер|пр|ш|мкр|р-н)`, 'i')
          ];
          return streetPatterns.some(pattern => pattern.test(addressData));
        });

        if (!isStreetName) {
          return city;
        }
      }
    }

    // 3. Если всё провалилось — попробуем "грязный" поиск по частичному совпадению
    // (на случай опечаток или нестандартных форматов)
    const lowerAddress = address.toLowerCase();
    for (const city of sortedCities) {
      const cityLower = city.toLowerCase();
      if (lowerAddress.includes(cityLower)) {
        // Проверяем, не входит ли в название улицы
        const streetPatterns = ['ул', 'пер', 'пр', 'ш', 'мкр', 'р-н'];
        const isLikelyStreet = streetPatterns.some(p => {
          return lowerAddress.includes(`${cityLower} ${p}`) || lowerAddress.includes(`${p}.${cityLower}`);
        });

        if (!isLikelyStreet) {
          return city;
        }
      }
    }

    // Если всё провалилось
    return "Город не определен";
  }

  // Метод для загрузки известных городов региона
  loadKnownCitiesForRegion() {
    try {
      const knownCitiesPath = path.join(__dirname, "..", "dataBase", "knownCities", `${this.regionCode}.json`);
      if (fs.existsSync(knownCitiesPath)) {
        const data = fs.readFileSync(knownCitiesPath, "utf8");
        return JSON.parse(data);
      }
      // Если файл не найден, возвращаем пустой массив
      console.warn(`Файл с известными городами для региона ${this.regionName} (${this.regionCode}) не найден`);
      return { cities: [] };
    } catch (error) {
      console.error(`Ошибка при загрузке известных городов для региона ${this.regionName}:`, error.message);
      return { cities: [] };
    }
  }

  // Тестовые данные для региона
  getTestRegionData() {
    return [
      {
        name: `г. ${this.regionName.split(" ")[0]}`,
        departments: [
          {
            name: `Управление ФССП по г. ${this.regionName.split(" ")[0]}`,
            address: `г. ${this.regionName.split(" ")[0]}, ул. Ленина, д. 25`,
            phone: "+7 (xxx) xxx-xx-xx",
          },
          {
            name: `Отделение ФССП по Центральному району`,
            address: `г. ${this.regionName.split(" ")[0]}, ул. Мира, д. 10`,
            phone: "+7 (xxx) xxx-xx-xx",
          },
        ],
      },
    ];
  }

  // Основной метод для запуска парсинга
  async parseAllData() {
    try {
      console.log(`Запуск парсера данных ФССП России (${this.regionName})`);

      // Получаем данные по региону
      const regionData = await this.getRegionData();

      const regionsData = [regionData];

      // Сохраняем данные в файл
      await this.saveToFile(regionsData);

      console.log("Парсинг завершен успешно!");

      // Подсчитываем статистику
      let totalDepartments = 0;
      let totalCities = 0;

      regionsData.forEach((region) => {
        totalCities += region.cities.length;
        region.cities.forEach((city) => {
          totalDepartments += city.departments.length;
        });
      });

      return {
        success: true,
        message: "Парсинг завершен успешно",
        statistics: {
          regions: regionsData.length,
          cities: totalCities,
          departments: totalDepartments,
        },
      };
    } catch (error) {
      console.error("Ошибка при парсинге данных:", error.message);
      return {
        success: false,
        message: `Ошибка при парсинге данных: ${error.message}`,
      };
    }
  }

  // Сохранение данных в JSON файл
  async saveToFile(data) {
    try {
      const dataToSave = {
        timestamp: new Date().toISOString(),
        regions: data,
      };

      // Если файл не существует, создаем его с начальной структурой
      if (!fs.existsSync(this.dataFilePath)) {
        // Создаем папку, если она не существует
        const dbDir = path.dirname(this.dataFilePath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        
        // Создаем файл с начальной структурой
        fs.writeFileSync(
          this.dataFilePath,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            regions: []
          }, null, 2),
          "utf8"
        );
        console.log(`Создан файл базы данных для региона "${this.regionName}": ${this.fileName}`);
      }

      // Создаем резервную копию текущего файла, если он существует
      if (fs.existsSync(this.dataFilePath)) {
        // Формируем имя файла для резервной копии с суффиксом _backup
        const backupFileName = this.fileName.replace('.json', '_backup.json');
        const backupPath = path.join(__dirname, "..", "dataBase", "backup", backupFileName);
        // Создаем папку backup, если она не существует
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        fs.copyFileSync(this.dataFilePath, backupPath);
        console.log(`Резервная копия создана: ${backupPath}`);
      }

      fs.writeFileSync(
        this.dataFilePath,
        JSON.stringify(dataToSave, null, 2),
        "utf8"
      );
      console.log(`Данные сохранены в файл: ${this.dataFilePath}`);
    } catch (error) {
      console.error("Ошибка при сохранении данных в файл:", error.message);
      throw error;
    }
  }

  // Получение данных из файла
  async getData() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, "utf8");
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error("Ошибка при чтении данных из файла:", error.message);
      return null;
    }
  }
}

export default FSSPParser;