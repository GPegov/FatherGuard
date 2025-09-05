import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

class FSSPParser {
  constructor() {
    this.baseUrl = "https://r66.fssp.gov.ru/contacts";
  }

  extractCityFromAddress(addressData) {
    const locations = [
      "Екатеринбург", "Нижний Тагил", "Каменск-Уральский", "Первоуральск",
      "Верхняя Пышма", "Алапаевск", "Артёмовский", "Асбест", "Березовский",
      "Богданович", "Верхотурье", "Ивдель", "Ирбит", "Карпинск",
      "Качканар", "Кировград", "Краснотурьинск", "Красноуральск",
      "Красноуфимск", "Кушва", "Невьянск", "Нижние Серги",
      "Нижняя Тура", "Новая Ляля", "Новоуральск", "Полевской", "Ревда", "Реж", 
      "Североуральск", "Серов", "Среднеуральск", "Сухой Лог", "Сысерть", "Тавда",
      "Талица", "Туринск", "Туринская Слобода", "Гари", "Арти", "Белоярский",
      "Камышлов", "Лесной", "Таборы", "Тугулым", "Шаля",
    ];

    // Нормализуем адрес
    const normalizedAddress = addressData
      .toLowerCase()
      .replace(/[^а-яё0-9\s.,]/g, "") // убираем лишние символы, но оставляем пробелы и точки
      .replace(/\s+/g, " ")
      .trim();

    // Сортируем города по длине (сначала самые длинные — чтобы "Туринская Слобода" нашлась раньше "Туринск")
    const sortedLocations = [...locations].sort((a, b) => b.length - a.length);

    for (const location of sortedLocations) {
      const cleanLocation = location.toLowerCase().replace(/[^а-яё]/g, ""); // убираем дефисы и т.п. для сравнения

      // Экранируем спецсимволы и ищем как целое слово
      const escaped = cleanLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");

      if (regex.test(normalizedAddress)) {
        // ВАЖНО: проверим, что это НЕ часть улицы
        const streetPatterns = [
          /ул\.\s*${escaped}/i,
          /улица\s+${escaped}/i,
          /пр-д\s*${escaped}/i,
          /проезд\s+${escaped}/i,
          /шоссе\s+${escaped}/i,
        ];

        const isPartOfStreet = streetPatterns.some((pattern) =>
          pattern.test(addressData)
        );
        if (isPartOfStreet) {
          continue; // это улица, а не город — пропускаем
        }

        return location; // возвращаем оригинальное название
      }
    }

    return "Екатеринбург"; // по умолчанию
  }

  // Получение данных по региону
  async getRegionData(region) {
    try {
      console.log(`Обработка региона: ${region.name}`);
      const response = await axios.get(region.url);
      const $ = cheerio.load(response.data);

      const regionData = {
        region: region.name,
        cities: [],
      };

      // Используем Map для группировки отделений по городам
      const citiesMap = new Map();

      // Поиск отделений в регионе
      $(".contacts-item").each((index, element) => {
        $(element)
          .find(".contacts-department")
          .each((depIndex, depElement) => {
            const departmentName = $(depElement)
              .find(".contacts-department-title")
              .text()
              .trim();
            const address = $(depElement)
              .find(".contacts-department-address")
              .text()
              .trim();
            const phone = $(depElement)
              .find(".contacts-department-phone")
              .text()
              .trim();

            if (departmentName) {
              const city = this.extractCityFromAddress(address);

              if (!citiesMap.has(city)) {
                citiesMap.set(city, {
                  name: city,
                  departments: [],
                });
              }

              citiesMap.get(city).departments.push({
                name: departmentName || "Название не указано",
                address: address || "Адрес не указан",
                phone: phone || "Телефон не указан",
              });
            }
          });
      });

      // Преобразуем Map в массив
      regionData.cities = Array.from(citiesMap.values());

      return regionData;
    } catch (error) {
      console.error(
        `Ошибка при обработке региона ${region.name}:`,
        error.message
      );
      return {
        region: region.name,
        cities: [],
      };
    }
  }

  // Основной метод для запуска парсинга
  async parseAllData() {
    try {
      console.log("Запуск парсера данных ФССП России");

      const regionData = await this.getRegionData({
        name: "Свердловская область",
        url: `${this.baseUrl}`,
      });

      this.regionsData = [regionData];

      await this.saveToFile();

      console.log("Парсинг завершен успешно!");
      console.log(`Обработано регионов: ${this.regionsData.length}`);
    } catch (error) {
      console.error("Ошибка при парсинге данных:", error.message);
    }
  }

  // Сохранение данных в JSON файл
  async saveToFile() {
    try {
      const fileName = "fssp_data.json";
      const dataToSave = {
        timestamp: new Date().toISOString(),
        regions: this.regionsData,
      };

      fs.writeFileSync(fileName, JSON.stringify(dataToSave, null, 2), "utf8");
      console.log(`Данные сохранены в файл: ${fileName}`);
    } catch (error) {
      console.error("Ошибка при сохранении данных в файл:", error.message);
    }
  }

  // Вывод статистики
  printStatistics() {
    let totalDepartments = 0;
    let totalCities = 0;

    this.regionsData.forEach((region) => {
      totalCities += region.cities.length;
      region.cities.forEach((city) => {
        totalDepartments += city.departments.length;
      });
    });

    console.log("\n=== СТАТИСТИКА ===");
    console.log(`Всего регионов: ${this.regionsData.length}`);
    console.log(`Всего городов: ${totalCities}`);
    console.log(`Всего отделений: ${totalDepartments}`);
  }
}

// Запуск парсера
async function runParser() {
  const parser = new FSSPParser();
  await parser.parseAllData();
  parser.printStatistics();
}

// Экспортируем класс
export default FSSPParser;

// Запуск при прямом вызове файла
if (import.meta.url === `file://${process.argv[1]}`) {
  runParser();
}
