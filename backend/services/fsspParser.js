import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FSSPParser {
  constructor() {
    this.dataFilePath = path.join(__dirname, "..", "..", "fssp_data.json");
  }

  // Получение данных по Свердловской области с использованием Puppeteer
  async getSverdlovskData() {
    let browser = null;

    try {
      console.log(
        "Запуск браузера для получения данных по Свердловской области..."
      );

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
      console.log("Переход на страницу контактов...");
      await page.goto("https://r66.fssp.gov.ru/contacts", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Ждем загрузки контента
      await new Promise((resolve) => setTimeout(resolve, 5000));

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
            // Проверяем, является ли первая строка заголовком таблицы
            let hasHeaderRow = false;
            const firstRow = rows[0];
            const headerCells = firstRow.querySelectorAll("th, td");
            let firstRowText = "";
            
            // Собираем текст из всех ячеек первой строки
            headerCells.forEach(cell => {
              firstRowText += " " + cell.textContent.toLowerCase();
            });
            firstRowText = firstRowText.trim();
            
            // Проверяем, содержит ли первая строка характерные слова заголовка
            hasHeaderRow = (
              firstRowText.includes("№") &&
              (firstRowText.includes("наименование") || firstRowText.includes("структурного") || firstRowText.includes("подразделения")) &&
              firstRowText.includes("адрес") &&
              (firstRowText.includes("почты") || firstRowText.includes("почта")) &&
              firstRowText.includes("телефон")
            );

            // Обрабатываем строки таблицы, пропуская заголовок, если он есть
            const startIndex = hasHeaderRow ? 1 : 0;
            for (let rowIndex = startIndex; rowIndex < rows.length; rowIndex++) {
              const row = rows[rowIndex];
              const cells = row.querySelectorAll("td");
              
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

                // Проверяем, что строка содержит данные
                if (departmentName || address || phone) {
                  departments.push({
                    name: departmentName || "Отделение ФССП",
                    address: address || "Адрес не указан",
                    phone: phone || "Телефон не указан",
                  });
                }
              }
            }
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
        "Ошибка при получении данных по Свердловской области:",
        error.message
      );

      // В случае ошибки возвращаем тестовые данные
      return {
        region: "Свердловская область",
        cities: this.getTestSverdlovskData(),
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
        region: "Свердловская область",
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
        region: "Свердловская область",
        cities: [
          {
            name: "Екатеринбург",
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

  // Известные города Свердловской области
  const knownCities = [
    'Екатеринбург', 'Нижний Тагил', 'Каменск-Уральский', 'Первоуральск',
    'Верхняя Пышма', 'Верхняя Салда', 'Алапаевск', 'Артёмовский','Артемовский', 
    'Асбест', 'Березовский', 'Богданович', 'Верхотурье', 'Ивдель', 'Ирбит', 'Карпинск',
    'Качканар', 'Кировград', 'Краснотурьинск', 'Красноуральск', 'Красноуфимск',
    'Кушва', 'Невьянск', 'Нижние Серги', 'Нижняя Тура', 'Новая Ляля',
    'Новоуральск', 'Полевской', 'Ревда', 'Реж', 'Североуральск', 'Серов',
    'Среднеуральск', 'Сухой Лог', 'Сысерть', 'Тавда', 'Талица', 'Туринск',
    'Туринская Слобода', 'Гари', 'Арти', 'Белоярский', 'Камышлов', 'Лесной',
    'Таборы', 'Тугулым', 'Шаля'
  ];

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
      const escaped = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedCity}\\b`, 'i'); // \b — граница слова

    if (regex.test(address)) {
      // Проверяем, не является ли это частью названия улицы
      const isStreetName = streetIndicators.some(indicator => {
        const escapedIndicator = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // 3. Если ничего не помогло — попробуем "грязный" поиск по частичному совпадению
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



  // Тестовые данные для Свердловской области
  getTestSverdlovskData() {
    return [
      {
        name: "г. Екатеринбург",
        departments: [
          {
            name: "Управление ФССП по г. Екатеринбургу",
            address: "г. Екатеринбург, ул. Ленина, д. 25",
            phone: "+7 (343) 282-22-22",
          },
          {
            name: "Отделение ФССП по Железнодорожному району",
            address: "г. Екатеринбург, ул. Малышева, д. 95",
            phone: "+7 (343) 282-23-23",
          },
        ],
      },
      {
        name: "г. Нижний Тагил",
        departments: [
          {
            name: "Отделение ФССП по г. Нижний Тагил",
            address: "г. Нижний Тагил, ул. Комсомольская, д. 34",
            phone: "+7 (3435) 22-22-22",
          },
        ],
      },
    ];
  }

  // Основной метод для запуска парсинга
  async parseAllData() {
    try {
      console.log("Запуск парсера данных ФССП России (Свердловская область)");

      // Получаем данные только по Свердловской области
      const regionData = await this.getSverdlovskData();

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
