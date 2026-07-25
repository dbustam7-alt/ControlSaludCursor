import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

async function test() {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  const apiKeyLine = envContent.split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
  if (!apiKeyLine) {
    console.error("No GEMINI_API_KEY in .env.local");
    return;
  }
  const apiKey = apiKeyLine.split('GEMINI_API_KEY=')[1].trim();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const list = await ai.models.list();
    console.log("Available models:");
    for (const m of list || []) {
      console.log(`- ${m.name}`);
    }
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

test();
