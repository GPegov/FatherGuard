import PromptService from '../backend/services/promptService.js';

const docData = { 
  summary: 'Test', 
  content: 'Test', 
  eventDate: '2025-10-13', 
  senderAgency: 'Test' 
};

console.log('Testing Chronicle Prompt Generation with sourceType...\n');

const userPrompt = PromptService.getChroniclePrompt(docData, 'document_created', [], 'user_explanation');
const officialPrompt = PromptService.getChroniclePrompt(docData, 'document_created', [], 'official_document');

console.log('User explanation prompt contains "описание ситуации":', userPrompt.includes('описание ситуации'));
console.log('User explanation prompt contains "официальный документ":', userPrompt.includes('официальный документ'));
console.log('Official document prompt contains "официальный документ":', officialPrompt.includes('официальный документ'));
console.log('Official document prompt contains "описание ситуации":', officialPrompt.includes('описание ситуации'));
console.log('Prompts are different:', userPrompt !== officialPrompt);

console.log('\nFirst 200 characters of user prompt:', userPrompt.substring(0, 200));
console.log('\nFirst 200 characters of official prompt:', officialPrompt.substring(0, 200));

// Test document_analyzed as well
const userPromptAnalysis = PromptService.getChroniclePrompt(docData, 'document_analyzed', [], 'user_explanation');
const officialPromptAnalysis = PromptService.getChroniclePrompt(docData, 'document_analyzed', [], 'official_document');

console.log('\n--- Testing document_analyzed ---');
console.log('User analysis prompt contains "ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ":', userPromptAnalysis.includes('ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ'));
console.log('User analysis prompt contains "ОФИЦИАЛЬНОГО ДОКУМЕНТА":', userPromptAnalysis.includes('ОФИЦИАЛЬНОГО ДОКУМЕНТА'));
console.log('Official analysis prompt contains "ОФИЦИАЛЬНОГО ДОКУМЕНТА":', officialPromptAnalysis.includes('ОФИЦИАЛЬНОГО ДОКУМЕНТА'));
console.log('Official analysis prompt contains "ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ":', officialPromptAnalysis.includes('ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ'));
console.log('Analysis prompts are different:', userPromptAnalysis !== officialPromptAnalysis);