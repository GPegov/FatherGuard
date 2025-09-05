// simple-test-extract.js
import FSSPParser from './fssp-parser.js';

const parser = new FSSPParser();

// Тестовые адреса
const testAddresses = [
  "624222\ng. Нижняя Тура,\nул. Ильича, д. 2а",
  "623930\nc. Туринская Слобода,\nул. Первомайская, д. 6",
  "623900\ng. Туринск,\nул. Калинина, д. 17",
  "620062\ng. Екатеринбург,\nул. Чебышёва, д. 4"
];

console.log("Тестирование улучшенного метода extractCityFromAddress:");

testAddresses.forEach((addr, index) => {
  // Заменяем экранированные символы новой строки
  const address = addr.replace(/\\n/g, '\n');
  const result = parser.extractCityFromAddress(address);
  console.log(`Тест ${index + 1}: ${result}`);
  console.log(`  Адрес: ${addr}`);
});