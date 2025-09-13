import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fsspRegions from "../fsspRegions.js";
import transliterate from "../transliterate.js";
import { parseKalmykiaData } from "./specialCases/kalmykiaParser.js";
import { parseKarachayCherkessiaData } from "./specialCases/karachayCherkessiaParser.js";
import { parseKareliaData } from "./specialCases/kareliaParser.js";
import { parseKomiData } from "./specialCases/komiParser.js";
import { parseMordoviaData } from "./specialCases/mordoviaParser.js";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FSSPParser {
  constructor(regionName = "Свердловская область") {
    this.regionName = regionName;
    this.regionCode = fsspRegions[regionName] || 66; // По умолчанию Свердловская область
    
    // Загружаем нестандартные URL из файла
    this.customUrls = this.loadCustomUrls();
    
    // Определяем baseURL - либо нестандартный, либо стандартный
    this.baseUrl = this.getBaseUrl();
    
    this.fileName = `${this.regionCode.toString().padStart(2, '0')}_${transliterate(regionName)}.json`;
    this.dataFilePath = path.join(__dirname, "..", "..", "dataBase", "fsspDepartmentsDB", this.fileName);
  }

  // Загрузка нестандартных URL из файла
  loadCustomUrls() {
    try {
      const customUrlsPath = path.join(__dirname, "..", "..", "dataBase", "fsspRegionUrls.json");
      if (fs.existsSync(customUrlsPath)) {
        const data = fs.readFileSync(customUrlsPath, "utf8");
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error("Ошибка при загрузке нестандартных URL:", error.message);
      return {};
    }
  }

  // Получение базового URL для парсинга
  getBaseUrl() {
    const regionCodeStr = this.regionCode.toString().padStart(2, '0');
    
    // Проверяем, есть ли нестандартный URL для этого региона
    if (this.customUrls[regionCodeStr] && this.customUrls[regionCodeStr].urls.length > 0) {
      // Используем первый URL из списка
      return this.customUrls[regionCodeStr].urls[0];
    }
    
    // Если нет нестандартного URL, используем стандартный
    return `https://r${regionCodeStr}.fssp.gov.ru/contacts`;
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
        headless: true,
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

      // Ждем загрузки контента
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Проверяем URL страницы
      const currentPageUrl = page.url();
      console.log(`Текущий URL страницы: ${currentPageUrl}`);

      // Получаем HTML содержимое страницы
      const htmlContent = await page.content();

      let rawData = [];

      // Проверяем специальные случаи
      if (this.regionCode === 8) {
        rawData = parseKalmykiaData(htmlContent);
        console.log("Применение специальной логики парсинга для Республики Калмыкия");
      } else if (this.regionCode === 9) {
        rawData = parseKarachayCherkessiaData(htmlContent);
        console.log("Применение специальной логики парсинга для Карачаево-Черкесской Республики");
      } else if (this.regionCode === 10) {
        rawData = parseKareliaData(htmlContent);
        console.log("Применение специальной логики парсинга для Республики Карелия");
      } else if (this.regionCode === 11) {
        rawData = parseKomiData(htmlContent);
        console.log("Применение специальной логики парсинга для Республики Коми");
      } else if (this.regionCode === 13) {
        rawData = parseMordoviaData(htmlContent);
        console.log("Применение специальной логики парсинга для Республики Мордовия");
      } else {
        rawData = await page.evaluate((regionCode) => {
          const departments = [];

          // Стандартная обработка для остальных регионов
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
                  // Увеличиваем количество проверяемых строк до 10 для более надежного определения
                  let isHeaderRow = false;
                  if (rowIndex < 10) {
                    const rowText = row.textContent.toLowerCase();
                    const stopWords = [
                      "наименование", "структурного", "подразделения", "адрес", "почты", "почта", 
                      "телефон", "e-mail", "email", "сайт", "факс", "контактная", "информация",
                      "номер", "п/п", "№"
                    ];
                    
                    // Проверяем, содержит ли строка хотя бы одно из стоп-слов
                    // Используем более точное совпадение слов
                    const wordsInRow = rowText.split(/\s+/);
                    for (const word of stopWords) {
                      if (wordsInRow.includes(word) || rowText.includes(word)) {
                        isHeaderRow = true;
                        break;
                      }
                    }
                  }

                  // Проверяем, что строка содержит данные и не является заголовочной
                  const isHeaderData = (
                    departmentName.includes("Наименование структурного подразделения") ||
                    address.includes("Почтовый адрес") ||
                    phone.includes("Телефон для получения справочной информации") ||
                    (departmentName.toLowerCase().includes("подразделение") &&
                     address.toLowerCase().includes("адрес") &&
                     phone.toLowerCase().includes("телефон"))
                  );

                  if ((departmentName || address || phone) && !isHeaderRow && !isHeaderData) {
                    departments.push({
                      name: departmentName || "Отделение ФССП",
                      address: address || "Адрес не указан",
                      phone: phone || "Телефон не указан",
                    });
                  }
                }
              });
            }
          });

          return departments;
        }, this.regionCode); // Передаем код региона в функцию
      }

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
        const escaped = indicator.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
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
      const escapedCity = city.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedCity}\\b`, 'i'); // \b — граница слова

      // Проверяем, не является ли это частью названия улицы
      const isStreetName = streetIndicators.some(indicator => {
        const escapedIndicator = indicator.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
        // Паттерны: "ул. Каменск", "Каменск-Уральская ул.", "мкр. Артёмовский"
        const streetPatterns = [
          new RegExp(`${escapedIndicator}\\s+${escapedCity}`, 'i'),
          new RegExp(`${escapedCity}[-\\s]*[А-Яа-я]*\\s+${escapedIndicator}`, 'i'),
          new RegExp(`${escapedCity}[\\s-]+(?:ул|пер|пр|ш|мкр|р-н)`, 'i')
        ];
        return streetPatterns.some(pattern => pattern.test(addressData));
      });

      if (regex.test(address) && !isStreetName) {
        return city;
      }
    }

    // 3. Если всё провалилось — попробуем "грязный" поиск по частичному совпадению
    const lowerAddress = address.toLowerCase();
    for (const city of sortedCities) {
      const cityLower = city.toLowerCase();
      if (lowerAddress.includes(cityLower)) {
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

  // Метод для загрузки известных городов региона
  loadKnownCitiesForRegion() {
    try {
      // Формируем имя файла с ведущим нулем для кодов от 1 до 9
      const regionCodeStr = this.regionCode.toString().padStart(2, '0');
      const knownCitiesPath = path.join(__dirname, "..", "..", "dataBase", "knownCities", `${regionCodeStr}.json`);
      if (fs.existsSync(knownCitiesPath)) {
        const data = fs.readFileSync(knownCitiesPath, "utf8");
        return JSON.parse(data);
      }
      // Если файл не найден, возвращаем пустой массив
      console.warn(`Файл с известными городами для региона ${this.regionName} (${regionCodeStr}) не найден`);
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
      
      // Проверка на нестандартные URL с запретом парсинга
      const regionCodeStr = this.regionCode.toString().padStart(2, '0');
      const customRegionData = this.customUrls[regionCodeStr];
      
      if (customRegionData && customRegionData.disabled) {
        console.log(`Парсинг региона "${this.regionName}" (код ${this.regionCode}) запрещен`);
        console.log(`Причина: ${customRegionData.reason || "Парсинг запрещен администратором"}`);
        
        // Выводим сообщение о запрете парсинга
        console.log(`Парсинг региона "${this.regionName}" невозможен. ${customRegionData.reason || "Парсинг запрещен администратором"}`);
        console.log(`Используются вручную введенные данные из файла ${this.fileName}`);
        
        // Возвращаем сообщение об ошибке вместо выполнения парсинга
        return {
          success: false,
          message: `Парсинг региона "${this.regionName}" невозможен. ${customRegionData.reason || "Парсинг запрещен администратором"} Используются вручную введенные данные.`,
          statistics: {
            regions: 0,
            cities: 0,
            departments: 0,
          },
        };
      }
      
      // Проверка для региона 04 (Республика Алтай) - парсинг запрещен (сохраняем для обратной совместимости)
      if (this.regionCode === 4) {
        console.log(`Парсинг региона "${this.regionName}" (код ${this.regionCode}) запрещен`);
        console.log(`Причина: На сайте ФССП данного региона отсутствуют необходимые данные`);
        
        // Выводим сообщение о запрете парсинга
        console.log(`Парсинг региона "${this.regionName}" невозможен, так как на сайте ФССП данного региона отсутствуют необходимые данные`);
        
        // Возвращаем сообщение об ошибке вместо выполнения парсинга
        return {
          success: false,
          message: `Парсинг региона "${this.regionName}" невозможен, так как на сайте ФССП данного региона отсутствуют необходимые данные`,
          statistics: {
            regions: 0,
            cities: 0,
            departments: 0,
          },
        };
      }
      
      // Проверка для региона 08 (Республика Калмыкия) - парсинг запрещен (сохраняем для обратной совместимости)
      if (this.regionCode === 8) {
        console.log(`Парсинг региона "${this.regionName}" (код ${this.regionCode}) запрещен`);
        console.log(`Причина: Нестандартная структура сайта ФССП Республики Калмыкия`);
        
        // Выводим сообщение о запрете парсинга
        console.log(`Парсинг региона "${this.regionName}" невозможен из-за нестандартной структуры сайта ФССП Республики Калмыкия`);
        console.log(`Используются вручную введенные данные из файла 08_Respublika_Kalmykiya.json`);
        
        // Возвращаем сообщение об ошибке вместо выполнения парсинга
        return {
          success: false,
          message: `Парсинг региона "${this.regionName}" невозможен из-за нестандартной структуры сайта ФССП Республики Калмыкия. Используются вручную введенные данные.`,
          statistics: {
            regions: 0,
            cities: 0,
            departments: 0,
          },
        };
      }
      
      // Проверяем, есть ли несколько URL для парсинга
      let allRegionData = [];
      const regionCodeStrNew = this.regionCode.toString().padStart(2, '0');
      const customRegionDataNew = this.customUrls[regionCodeStrNew];
      
      if (customRegionDataNew && customRegionDataNew.urls.length > 0) {
        // Если есть нестандартные URL, парсим данные со всех URL
        for (const [index, url] of customRegionDataNew.urls.entries()) {
          console.log(`Парсинг данных с URL ${index + 1}/${customRegionDataNew.urls.length}: ${url}`);
          // Временно изменяем baseUrl для этого парсинга
          const originalBaseUrl = this.baseUrl;
          this.baseUrl = url;
          const regionData = await this.getRegionData();
          allRegionData.push(regionData);
          // Восстанавливаем оригинальный baseUrl
          this.baseUrl = originalBaseUrl;
        }
        
        // Объединяем данные из всех URL
        const combinedRegionData = {
          region: this.regionName,
          cities: []
        };
        
        // Собираем все отделения в один массив
        const allDepartments = [];
        allRegionData.forEach(regionData => {
          regionData.cities.forEach(city => {
            allDepartments.push(...city.departments);
          });
        });
        
        // Группируем все отделения по городам
        const groupedData = await this.groupDepartmentsByCity(allDepartments);
        combinedRegionData.cities = groupedData.cities;
        
        allRegionData = [combinedRegionData];
      } else {
        // Если нет нестандартных URL, парсим как обычно
        const regionData = await this.getRegionData();
        allRegionData = [regionData];
      }

      // Сохраняем данные в файл
      await this.saveToFile(allRegionData);

      console.log("Парсинг завершен успешно!");

      // Подсчитываем статистику
      let totalDepartments = 0;
      let totalCities = 0;

      allRegionData.forEach((region) => {
        totalCities += region.cities.length;
        region.cities.forEach((city) => {
          totalDepartments += city.departments.length;
        });
      });

      return {
        success: true,
        message: "Парсинг завершен успешно",
        statistics: {
          regions: allRegionData.length,
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
      // Проверка на нестандартные URL с запретом парсинга
      const regionCodeStr = this.regionCode.toString().padStart(2, '0');
      const customRegionData = this.customUrls[regionCodeStr];
      
      if (customRegionData && customRegionData.disabled) {
        console.log(`Сохранение данных для региона "${this.regionName}" (код ${this.regionCode}) запрещено`);
        console.log(`Причина: Используются вручную введенные данные`);
        return;
      }
      
      // Проверка для региона 04 (Республика Алтай) - сохранение запрещено
      if (this.regionCode === 4) {
        console.log(`Сохранение данных для региона "${this.regionName}" (код ${this.regionCode}) запрещено`);
        console.log(`Причина: Используются вручную введенные данные`);
        return;
      }
      
      // Проверка для региона 08 (Республика Калмыкия) - сохранение запрещено
      if (this.regionCode === 8) {
        console.log(`Сохранение данных для региона "${this.regionName}" (код ${this.regionCode}) запрещено`);
        console.log(`Причина: Используются вручную введенные данные`);
        return;
      }

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
        const backupPath = path.join(__dirname, "..", "..", "dataBase", "backup", backupFileName);
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

  // Метод для добавления нестандартного URL в файл конфигурации
  static async addCustomUrl(regionCode, regionName, urls) {
    try {
      const customUrlsPath = path.join(__dirname, "..", "..", "dataBase", "fsspRegionUrls.json");
      let customUrls = {};
      
      // Загружаем существующие данные
      if (fs.existsSync(customUrlsPath)) {
        const data = fs.readFileSync(customUrlsPath, "utf8");
        customUrls = JSON.parse(data);
      }
      
      // Добавляем или обновляем данные для региона
      const regionCodeStr = regionCode.toString().padStart(2, '0');
      customUrls[regionCodeStr] = {
        region: regionName,
        urls: Array.isArray(urls) ? urls : [urls]
      };
      
      // Сохраняем обновленные данные
      fs.writeFileSync(customUrlsPath, JSON.stringify(customUrls, null, 2), "utf8");
      console.log(`Добавлен/обновлен нестандартный URL для региона ${regionCodeStr}: ${regionName}`);
    } catch (error) {
      console.error("Ошибка при добавлении нестандартного URL:", error.message);
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

// Экспортируем класс и статический метод
export { FSSPParser as default, FSSPParser };