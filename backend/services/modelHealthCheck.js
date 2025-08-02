import axios from 'axios';

export async function checkModelAvailability() {
  try {
    const response = await axios.get('http://localhost:11434', {
      timeout: 10000
    });
    return response.status === 200;
  } catch (error) {
    console.error('Модель недоступна:', error.message);
    return false;
  }
}