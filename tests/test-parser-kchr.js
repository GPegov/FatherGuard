import FSSPParser from "../backend/services/fsspParser.js";

async function testParser() {
  // Создаем экземпляр парсера для Карачаево-Черкесской Республики
  const parser = new FSSPParser("Карачаево-Черкесская Республика");
  
  // Запускаем парсинг
  const result = await parser.parseAllData();
  
  console.log("Результат парсинга:");
  console.log(JSON.stringify(result, null, 2));
  
  // Выводим данные из файла
  const fileData = await parser.getData();
  if (fileData) {
    console.log("\nДанные из файла:");
    console.log(JSON.stringify(fileData, null, 2));
  }
}

testParser().catch(console.error);