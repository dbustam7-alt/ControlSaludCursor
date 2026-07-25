import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

async function test() {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  console.log("File content length:", envContent.length);
  const lines = envContent.split(/\r?\n/);
  const apiKeyLine = lines.find(line => line.includes('GEMINI_API_KEY='));
  if (!apiKeyLine) {
    console.error("No API key found in .env.local, lines were:", lines);
    return;
  }
  const apiKey = apiKeyLine.split('GEMINI_API_KEY=')[1].trim();
  console.log("Found key starting with:", apiKey.substring(0, 5));
  const ai = new GoogleGenAI({ apiKey });

  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
  
  for (const model of modelsToTry) {
    console.log(`Trying model: ${model}...`);
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: "Hola, responde 'ok' si puedes leer esto.",
      });
      console.log(`Success with ${model}:`, response.text);
      break;
    } catch (err) {
      console.error(`Failed with ${model}:`, err.message || err);
    }
  }
}

test();
