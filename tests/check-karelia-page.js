import puppeteer from 'puppeteer';
import fs from 'fs';

async function checkKareliaPage() {
  let browser = null;
  
  try {
    console.log('Запуск браузера для проверки страницы ФССП Республики Карелия');
    
    // Запускаем браузер
    browser = await puppeteer.launch({
      headless: false, // Открываем не в headless режиме чтобы увидеть страницу
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Устанавливаем User-Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Переходим на страницу контактов
    console.log('Переход на страницу контактов: https://r10.fssp.gov.ru/contacts/contacts_osp');
    const response = await page.goto('https://r10.fssp.gov.ru/contacts/contacts_osp', {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Проверяем статус ответа
    console.log(`Статус ответа: ${response.status()}`);

    // Ждем загрузки контента
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Получаем HTML содержимое страницы
    const htmlContent = await page.content();
    console.log('Длина HTML содержимого:', htmlContent.length);
    
    // Сохраняем HTML в файл для анализа
    fs.writeFileSync('karelia-page.html', htmlContent, 'utf8');
    console.log('HTML содержимое сохранено в файл karelia-page.html');

    // Ищем таблицы
    const tables = await page.$$('table');
    console.log('Найдено таблиц:', tables.length);

    // Ищем другие элементы
    const lists = await page.$$('ul, ol');
    console.log('Найдено списков:', lists.length);

    // Ищем div с классами
    const divs = await page.$$('div');
    console.log('Найдено div элементов:', divs.length);

    // Проверяем содержимое страницы
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log('Текстовое содержимое (первые 500 символов):');
    console.log(textContent.substring(0, 500));
    
    // Ждем немного, чтобы увидеть страницу
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Ошибка при проверке страницы:', error.message);
    console.error('Стек ошибки:', error.stack);
  } finally {
    // Закрываем браузер
    if (browser) {
      await browser.close();
    }
  }
}

checkKareliaPage();