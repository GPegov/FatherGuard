// Тестовый скрипт для проверки правильности формирования пути к файлу
import FSSPParser from "../backend/services/fsspParser.js";
import fs from "fs";

function testFilePathGeneration() {
  console.log('Тестирование формирования пути к файлу для Республики Калмыкия');
  
  // Создаем парсер для Республики Калмыкия
  const parser = new FSSPParser("Республика Калмыкия");
  
  console.log("Код региона:", parser.regionCode);
  console.log("Имя файла:", parser.fileName);
  console.log("Путь к файлу:", parser.dataFilePath);
  
  // Проверяем существование файла
  console.log("Файл существует:", fs.existsSync(parser.dataFilePath));
  
  // Проверяем также файл без ведущего нуля
  const oldFileName = `${parser.regionCode}_${parser.fileName.split('_')[1]}`;
  const oldFilePath = parser.dataFilePath.replace(parser.fileName, oldFileName);
  console.log("Старый файл существует:", fs.existsSync(oldFilePath));
  console.log("Путь к старому файлу:", oldFilePath);
}

// Запускаем тест
testFilePathGeneration();