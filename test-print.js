import fs from 'fs';
import path from 'path';

console.log("process.cwd():", process.cwd());
const filePath = path.join(process.cwd(), '.env.local');
console.log("filePath:", filePath);
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);
lines.forEach((line, index) => {
  if (line.includes('GEMINI_API_KEY')) {
    console.log(`Line ${index + 1}: "${line}"`);
  }
});
