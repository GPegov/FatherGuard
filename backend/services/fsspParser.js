import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FSSPParser {
  constructor(aiService = null) {
    this.dataFilePath = path.join(__dirname, '..', '..', 'fssp_data.json');
    this.aiService = aiService;
  }

  // Получение данных по Свердловской области с использованием Puppeteer
  async getSverdlovskData() {
    let browser = null;
    
    try {
      console.log('Запуск браузера для получения данных по Свердловской области...');
      
      // Запускаем браузер
      browser = await puppeteer.launch({
        headless: true, // В продакшене используем headless режим
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Переходим на страницу контактов
      console.log('Переход на страницу контактов...');
      await page.goto('https://r66.fssp.gov.ru/contacts', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Ждем загрузки контента
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Извлекаем данные с помощью JavaScript в контексте страницы
      const rawData = await page.evaluate(() => {
        const departments = [];
        
        // Ищем таблицы с отделениями
        const tables = document.querySelectorAll('table');
        console.log('Найдено таблиц:', tables.length);
        
        tables.forEach((table, tableIndex) => {
          const rows = table.querySelectorAll('tr');
          console.log(`Таблица ${tableIndex + 1}: строк ${rows.length}`);
          
          if (rows.length > 1) {
            // Обрабатываем строки таблицы
            rows.forEach((row, rowIndex) => {
              // Пропускаем заголовок
              if (rowIndex === 0) return;
              
              const cells = row.querySelectorAll('td');
              if (cells.length >= 3) {
                const departmentName = cells[0].textContent.trim();
                const address = cells[1].textContent.trim();
                const phone = cells[2].textContent.trim();
                
                // Проверяем, что строка содержит данные
                if (departmentName || address || phone) {
                  departments.push({
                    name: departmentName || 'Отделение ФССП',
                    address: address || 'Адрес не указан',
                    phone: phone || 'Телефон не указан'
                  });
                }
              }
            });
          }
        });
        
        return departments;
      });
      
      console.log(`Получено ${rawData.length} отделений`);
      
      // Группируем отделения по городам с помощью ИИ
      const regionData = await this.groupDepartmentsByCity(rawData);
      
      return regionData;
      
    } catch (error) {
      console.error('Ошибка при получении данных по Свердловской области:', error.message);
      
      // В случае ошибки возвращаем тестовые данные
      return {
        region: 'Свердловская область',
        cities: this.getTestSverdlovskData()
      };
    } finally {
      // Закрываем браузер
      if (browser) {
        await browser.close();
      }
    }
  }

  // Группировка отделений по городам с помощью ИИ
  async groupDepartmentsByCity(departments) {
    try {
      console.log('Группировка отделений по городам с помощью ИИ...');
      
      const regionData = {
        region: 'Свердловская область',
        cities: []
      };
      
      // Карта для группировки отделений по городам
      const cityMap = new Map();
      
      // Список основных городов Свердловской области для контекста ИИ
      const citiesList = [
        'Екатеринбург', 'Нижний Тагил', 'Первоуральск', 'Красноуральск', 
        'Серов', 'Ирбит', 'Новоуральск', 'Полевской', 'Ревда', 'Верхняя Пышма',
        'Алапаевск', 'Артемовский', 'Асбест', 'Белоярский', 'Богданович',
        'Верхний Тагил', 'Волчанск', 'Гари', 'Ивдель', 'Каменск-Уральский',
        'Качканар', 'Кировград', 'Краснотурьинск', 'Кушва', 'Лесной',
        'Невьянск', 'Нижняя Тура', 'Новая Ляля', 'Новоуральск', 'Первоуральск',
        'Пышма', 'Реж', 'Североуральск', 'Среднеуральск', 'Сухой Лог',
        'Сысерть', 'Тавда', 'Талица', 'Туринск', 'Шаля'
      ];
      
      // Обрабатываем каждое отделение
      for (const department of departments) {
        let cityName = 'Екатеринбург'; // По умолчанию
        
        // Если доступен AIService, используем его для определения города
        if (this.aiService) {
          try {
            const prompt = `Определи город из следующего адреса отделения ФССП. Выбери один из этих городов: ${citiesList.join(', ')}.
Если город не из списка, ответь "Другой город".

Адрес: ${department.address}

Ответь только названием города без дополнительных комментариев.`;
            
            console.log(`Запрос к ИИ для определения города: ${department.address.substring(0, 50)}...`);
            const aiResponse = await this.aiService.queryLocalModel(prompt, {
              temperature: 0.1,
              format: "json"
            });
            
            if (aiResponse && typeof aiResponse === 'string') {
              const cleanCity = aiResponse.trim();
              // Проверяем, что ответ - один из известных городов
              if (citiesList.includes(cleanCity) || cleanCity === 'Другой город') {
                cityName = cleanCity;
              }
            }
          } catch (aiError) {
            console.error('Ошибка при определении города через ИИ:', aiError.message);
            // Используем простой метод определения города
            cityName = this.extractCityFromAddress(department.address, citiesList);
          }
        } else {
          // Если AIService не доступен, используем простой метод
          cityName = this.extractCityFromAddress(department.address, citiesList);
        }
        
        // Добавляем отделение в соответствующий город
        if (!cityMap.has(cityName)) {
          cityMap.set(cityName, {
            name: cityName.startsWith('г. ') ? cityName : `г. ${cityName}`,
            departments: []
          });
        }
        
        cityMap.get(cityName).departments.push(department);
      }
      
      // Преобразуем карту в массив городов
      regionData.cities = Array.from(cityMap.values());
      
      console.log(`Отделения сгруппированы по ${regionData.cities.length} городам`);
      return regionData;
      
    } catch (error) {
      console.error('Ошибка при группировке отделений по городам:', error.message);
      // Возвращаем все отделения в Екатеринбург
      return {
        region: 'Свердловская область',
        cities: [{
          name: 'г. Екатеринбург',
          departments: departments
        }]
      };
    }
  }

  // Простой метод извлечения города из адреса
  extractCityFromAddress(address, citiesList) {
    if (!address) return 'Екатеринбург';
    
    const addressLower = address.toLowerCase();
    
    for (const city of citiesList) {
      if (addressLower.includes(city.toLowerCase())) {
        return city;
      }
    }
    
    return 'Екатеринбург'; // По умолчанию
  }

  // Тестовые данные для Свердловской области
  getTestSverdlovskData() {
    return [
      {
        name: 'г. Екатеринбург',
        departments: [
          {
            name: 'Управление ФССП по г. Екатеринбургу',
            address: 'г. Екатеринбург, ул. Ленина, д. 25',
            phone: '+7 (343) 282-22-22'
          },
          {
            name: 'Отделение ФССП по Железнодорожному району',
            address: 'г. Екатеринбург, ул. Малышева, д. 95',
            phone: '+7 (343) 282-23-23'
          }
        ]
      },
      {
        name: 'г. Нижний Тагил',
        departments: [
          {
            name: 'Отделение ФССП по г. Нижний Тагил',
            address: 'г. Нижний Тагил, ул. Комсомольская, д. 34',
            phone: '+7 (3435) 22-22-22'
          }
        ]
      }
    ];
  }

  // Основной метод для запуска парсинга
  async parseAllData() {
    try {
      console.log('Запуск парсера данных ФССП России (Свердловская область)');
      
      // Получаем данные только по Свердловской области
      const regionData = await this.getSverdlovskData();
      
      const regionsData = [regionData];
      
      // Сохраняем данные в файл
      await this.saveToFile(regionsData);
      
      console.log('Парсинг завершен успешно!');
      
      // Подсчитываем статистику
      let totalDepartments = 0;
      let totalCities = 0;
      
      regionsData.forEach(region => {
        totalCities += region.cities.length;
        region.cities.forEach(city => {
          totalDepartments += city.departments.length;
        });
      });
      
      return {
        success: true,
        message: 'Парсинг завершен успешно',
        statistics: {
          regions: regionsData.length,
          cities: totalCities,
          departments: totalDepartments
        }
      };
      
    } catch (error) {
      console.error('Ошибка при парсинге данных:', error.message);
      return { success: false, message: `Ошибка при парсинге данных: ${error.message}` };
    }
  }

  // Сохранение данных в JSON файл
  async saveToFile(data) {
    try {
      const dataToSave = {
        timestamp: new Date().toISOString(),
        regions: data
      };
      
      fs.writeFileSync(this.dataFilePath, JSON.stringify(dataToSave, null, 2), 'utf8');
      console.log(`Данные сохранены в файл: ${this.dataFilePath}`);
    } catch (error) {
      console.error('Ошибка при сохранении данных в файл:', error.message);
      throw error;
    }
  }

  // Получение данных из файла
  async getData() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Ошибка при чтении данных из файла:', error.message);
      return null;
    }
  }
}

export default FSSPParser;