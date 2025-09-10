import puppeteer from "puppeteer";

// Отладочный скрипт для изучения структуры сайта ФССП Республики Калмыкия
async function debugKalmykiaSite() {
  let browser = null;
  
  try {
    console.log("Запуск браузера для отладки...");
    
    // Запускаем браузер
    browser = await puppeteer.launch({
      headless: false, // Открываем визуальный браузер для отладки
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Устанавливаем User-Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Переходим на страницу контактов
    console.log("Переход на страницу контактов: https://r08.fssp.gov.ru/kontakt");
    const response = await page.goto("https://r08.fssp.gov.ru/kontakt", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Проверяем статус ответа
    console.log(`Статус ответа: ${response.status()}`);

    // Ждем загрузки контента
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Получаем HTML содержимое страницы
    const htmlContent = await page.content();
    console.log("Длина HTML содержимого:", htmlContent.length);
    
    // Ищем элементы на странице
    const lists = await page.$$("ol");
    console.log("Найдено списков <ol>:", lists.length);
    
    const tables = await page.$$("table");
    console.log("Найдено таблиц <table>:", tables.length);
    
    // Получаем текстовое содержимое списков
    for (let i = 0; i < Math.min(lists.length, 3); i++) {
      const list = lists[i];
      const items = await list.$$("li");
      console.log(`Список ${i + 1}: элементов ${items.length}`);
      
      // Получаем текст первых 3 элементов
      for (let j = 0; j < Math.min(items.length, 3); j++) {
        const text = await items[j].evaluate(el => el.textContent.trim());
        console.log(`  Элемент ${j + 1}: ${text.substring(0, 100)}...`);
      }
    }
    
    // Проверяем видимость элементов
    const isVisible = await page.evaluate(() => {
      const lists = document.querySelectorAll("ol");
      if (lists.length > 0) {
        const list = lists[0];
        const style = window.getComputedStyle(list);
        return style.display !== "none" && style.visibility !== "hidden";
      }
      return false;
    });
    
    console.log("Первый список видим:", isVisible);
    
  } catch (error) {
    console.error("Ошибка при отладке:", error.message);
    console.error("Стек ошибки:", error.stack);
  } finally {
    // Закрываем браузер
    if (browser) {
      await browser.close();
    }
  }
}

// Запускаем отладку
debugKalmykiaSite();