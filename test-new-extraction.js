// test-new-extraction.js
import FSSPParser from './fssp-parser.js';

const parser = new FSSPParser();

// Тестовые адреса
const testCases = [
  {
    address: "624222\\nг. Нижняя Тура,\\nул. Ильича, д. 2а",
    expected: "Нижняя Тура"
  },
  {
    address: "623900\\nг. Туринск,\\nул. Калинина, д. 17",
    expected: "Туринск"
  },
  {
    address: "624222\\nНижняя Тура,\\nул. Ильича, д. 2а",
    expected: "Нижняя Тура"
  },
  {
    address: "623900\\nТуринск,\\nул. Калинина, д. 17",
    expected: "Туринск"
  },
  {
    address: "624222\\nНижняя Тура\\nул. Ильича, д. 2а",
    expected: "Нижняя Тура"
  },
  {
    address: "623900\\nТуринск\\nул. Калинина, д. 17",
    expected: "Туринск"
  }
];

console.log("Тестирование обновленного метода extractCityFromAddress:");

testCases.forEach((testCase, index) => {
  // Заменяем экранированные символы новой строки на реальные
  const address = testCase.address.replace(/\\n/g, '\n');
  const result = parser.extractCityFromAddress(address);
  const passed = result === testCase.expected;
  
  console.log(`\nТест ${index + 1}: ${passed ? 'ПРОЙДЕН' : 'НЕ ПРОЙДЕН'}`);
  console.log(`  Адрес: ${testCase.address}`);
  console.log(`  Ожидаемый результат: ${testCase.expected}`);
  console.log(`  Фактический результат: ${result}`);
});