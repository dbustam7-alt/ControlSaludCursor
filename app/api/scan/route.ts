import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Simple types for the response
interface ExtractedData {
  type: 'appointment' | 'order' | 'medication';
  appointment?: {
    doctorName: string;
    specialty: string;
    location: string;
    dateTime: string;
    notes: string;
  };
  order?: {
    examType: string;
    institution: string;
    requiredAuthorization: boolean;
    expirationDate: string;
    notes: string;
  };
  medication?: {
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate: string | null;
    stockQuantity: number;
    lowStockAlert: number;
    notes: string;
  };
}

export async function POST(request: Request) {
  try {
    const { fileBase64, fileName, fileType } = await request.json();

    if (!fileBase64) {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // SIMULATION FALLBACK (If GEMINI_API_KEY is missing)
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is missing. Simulating Gemini AI extraction...');
      
      // Artificial delay to simulate AI processing
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Generate realistic mock data based on the filename or type
      const lowerName = (fileName || '').toLowerCase();
      
      let simulated: ExtractedData;

      if (lowerName.includes('receta') || lowerName.includes('medicamento') || lowerName.includes('pildora') || lowerName.includes('farmacia')) {
        simulated = {
          type: 'medication',
          medication: {
            name: 'Atorvastatina 20mg',
            dosage: '1 tableta',
            frequency: 'Cada 24 horas (en la noche)',
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            stockQuantity: 30,
            lowStockAlert: 7,
            notes: 'Controlar el colesterol. Tomar preferentemente después de la cena.',
          },
        };
      } else if (lowerName.includes('cita') || lowerName.includes('control') || lowerName.includes('doctor') || lowerName.includes('medico') || lowerName.includes('agenda')) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 5);
        futureDate.setHours(10, 30, 0, 0);

        simulated = {
          type: 'appointment',
          appointment: {
            doctorName: 'Dr. Alejandro Silva',
            specialty: 'Oftalmología',
            location: 'Centro Médico Apoquindo, Box 204',
            dateTime: futureDate.toISOString(),
            notes: 'Asistir con lentes ópticos actuales y receta anterior. Dilatación de pupilas requerida.',
          },
        };
      } else {
        // Default to order/exam if unclear
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 60); // 2 months validity

        simulated = {
          type: 'order',
          order: {
            examType: 'Perfil Lipídico, Hemoglobina Glicosilada y Creatinina',
            institution: 'Laboratorios Megasalud Sucursal Alameda',
            requiredAuthorization: true,
            expirationDate: expDate.toISOString().split('T')[0],
            notes: 'Requiere 12 horas de ayuno estricto. Tomar agua permitida.',
          },
        };
      }

      return NextResponse.json({ success: true, isSimulated: true, data: simulated });
    }

    // ACTUAL GEMINI AI INTEGRATION
    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 string
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
    const mimeType = fileType || 'image/jpeg';

    const systemPrompt = `
      Eres un extractor de datos de documentos médicos en español de alta precisión.
      Tu tarea es analizar la imagen o PDF médico provisto y extraer la información clave de forma estructurada.

      Primero debes identificar qué tipo de documento es:
      1. 'appointment': Si es un recordatorio de cita médica, tarjeta de hora, o similar.
      2. 'order': Si es una orden de exámenes de laboratorio, imágenes (radiografía, resonancia), derivación o interconsulta.
      3. 'medication': Si es una receta de medicamentos, prescripción de fármacos o indicación de tratamiento farmacéutico.

      Devuelve un objeto JSON estructurado con el siguiente esquema exacto:
      {
        "type": "appointment" | "order" | "medication",
        "appointment": { // Solo si type es "appointment"
          "doctorName": "Nombre del doctor con prefijo (Ej. Dr. Juan Pérez)",
          "specialty": "Especialidad médica (Ej. Cardiología)",
          "location": "Lugar de la cita (Ej. Clinica Santa María, Box 301)",
          "dateTime": "Fecha y hora en formato ISO 8601 (YYYY-MM-DDTHH:MM:SSZ). Si no tiene año, asume el año 2026. Si no tiene hora exacta, usa las 09:00:00Z.",
          "notes": "Preparaciones necesarias o notas descritas"
        },
        "order": { // Solo si type es "order"
          "examType": "Nombre o tipo de examen (Ej. Hemograma Completo)",
          "institution": "Lugar sugerido o institución emisora",
          "requiredAuthorization": true | false, // true si es de alto costo o indica requerir bono/autorización, de lo contrario false
          "expirationDate": "Fecha de vencimiento estimada en formato YYYY-MM-DD. Si no se especifica, calcula 30 o 60 días desde hoy (2026-07-25)",
          "notes": "Indicaciones previas (ayuno, suspender medicamentos, etc.)"
        },
        "medication": { // Solo si type es "medication"
          "name": "Nombre comercial o principio activo del medicamento",
          "dosage": "Dosis (Ej. 1 tableta, 5ml, 500mg)",
          "frequency": "Frecuencia de toma (Ej. Cada 8 horas, 1 vez al día, con el desayuno)",
          "startDate": "Fecha de inicio en formato YYYY-MM-DD. Si no hay, usa la fecha de hoy: 2026-07-25",
          "endDate": "Fecha de término en formato YYYY-MM-DD o null si es tratamiento crónico indefinido",
          "stockQuantity": 30, // Default estimado por defecto para recetas de un mes
          "lowStockAlert": 7, // Límite por defecto para alertas
          "notes": "Instrucciones de ingesta adicionales descritas"
        }
      }

      Asegúrate de responder UNICAMENTE con el objeto JSON válido. No uses bloques de markdown con backticks, solo la cadena JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        systemPrompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '{}';
    const parsedData = JSON.parse(text);

    return NextResponse.json({ success: true, isSimulated: false, data: parsedData });
  } catch (error: any) {
    console.error('Error in Gemini AI route:', error);
    return NextResponse.json({ 
      error: 'Error al procesar el documento con Inteligencia Artificial.', 
      details: error.message || error 
    }, { status: 500 });
  }
}
