import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeClinicalText(field: 's' | 'o' | 'a' | 'p', text: string, context?: any) {
  const model = "gemini-3-flash-preview"; 

  let systemInstruction = "";
  let responseSchema: any = null;

  switch (field) {
    case 's':
      systemInstruction = `Você é um médico especialista em APS (Atenção Primária à Saúde) e classificação CIAP-2.
Sua tarefa é analisar o relato SUBJETIVO do paciente e sugerir códigos CIAP-2 para o MOTIVO DA CONSULTA.
FOCO PRINCIPAL: Analise prioritariamente a 'Queixa Principal' e a 'História da Doença Atual (HDA)'.
DIRETRIZES:
1. Use APENAS códigos CIAP-2 válidos no formato [LETRA][NÚMERO][NÚMERO].
2. Priorize o Componente 1 (Sinais e Sintomas): códigos 01-29.
3. Se houver menção a medos ou preocupações específicas, considere códigos de medo de doença (ex: A26, B26).
4. Utilize o Google Search para verificar se os sintomas descritos correspondem a critérios diagnósticos específicos da CIAP-2 se houver ambiguidade.`;
      responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            name: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["code", "name", "confidence", "reasoning"]
        }
      };
      break;
    case 'o':
      systemInstruction = `Você é um médico especialista em semiologia e classificação CIAP-2.
Sua tarefa é analisar o exame físico e achados OBJETIVOS para sugerir códigos CIAP-2 correspondentes.
DIRETRIZES:
1. Use APENAS códigos CIAP-2 válidos no formato [LETRA][NÚMERO][NÚMERO].
2. Foque em achados anormais descritos no exame físico.
3. Se houver resultados de exames laboratoriais ou de imagem, utilize-os para refinar a sugestão.
4. Utilize o Google Search para verificar se os achados físicos correspondem a critérios diagnósticos específicos da CIAP-2.`;
      responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            name: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["code", "name", "confidence", "reasoning"]
        }
      };
      break;
    case 'a':
      systemInstruction = `Você é um médico especialista em diagnóstico clínico e codificação CID-10 e CID-11.
Sua tarefa é analisar a AVALIAÇÃO (diagnósticos, hipóteses, problemas) e sugerir códigos CID-10 e CID-11 correspondentes.
DIRETRIZES:
1. Sugira códigos CID-10 (ex: E11.9) e CID-11 (ex: 5A11).
2. Forneça o nome oficial do diagnóstico para cada código.
3. Explique brevemente o raciocínio clínico para a escolha do código.
4. Utilize o Google Search para confirmar códigos se houver termos ambíguos ou novos diagnósticos.`;
      responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["CID-10", "CID-11"] },
            name: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["code", "type", "name", "confidence", "reasoning"]
        }
      };
      break;
    case 'p':
      systemInstruction = `Você é um médico especialista em terapêutica e codificação clínica (CID-10, CID-11 e CIAP-2).
Sua tarefa é analisar o PLANO terapêutico (medicamentos, condutas, encaminhamentos) e sugerir códigos CID-10/CID-11 para as condições sendo tratadas e códigos CIAP-2 para os procedimentos realizados (códigos 30-69).
DIRETRIZES:
1. Identifique as patologias mencionadas ou implícitas no plano e sugira códigos CID-10 e CID-11.
2. Identifique procedimentos, orientações ou exames e sugira códigos CIAP-2 (Componentes 2 a 6: códigos 30-69).
3. Utilize o Google Search para verificar as últimas recomendações de tratamento, doses e códigos de procedimentos atualizados.`;
      responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["CID-10", "CID-11", "CIAP-2"] },
            name: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["code", "type", "name", "confidence", "reasoning"]
        }
      };
      break;
  }

  const prompt = `Analise o seguinte texto clínico: ${text}
  Contexto adicional: ${JSON.stringify(context || {})}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        tools: [{ googleSearch: {} }]
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Analysis error:", error);
    return [];
  }
}

export async function checkInteractions(plan: string) {
  const prompt = `Analise as interações medicamentosas no seguinte plano: ${plan}. 
  Retorne um JSON com a lista de drogas e as interações encontradas (severidade, mecanismo, efeito, recomendação).
  Utilize o Google Search para buscar interações raras ou recentemente descobertas.`;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      drugs: { type: Type.ARRAY, items: { type: Type.STRING } },
      interactions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            drug1: { type: Type.STRING },
            drug2: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ["bloqueio", "grave", "moderada", "leve"] },
            mechanism: { type: Type.STRING },
            effect: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["drug1", "drug2", "severity", "mechanism", "effect", "recommendation"]
        }
      }
    },
    required: ["drugs", "interactions"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Você é um farmacologista clínico especializado em APS brasileira.",
        responseMimeType: "application/json",
        responseSchema,
        tools: [{ googleSearch: {} }]
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Interactions error:", error);
    return { drugs: [], interactions: [] };
  }
}

export async function runAudit(data: any) {
  const prompt = `Atue como um médico auditor especialista em medicina baseada em evidências. 
  Realize uma auditoria profunda e complexa do seguinte caso clínico: ${JSON.stringify(data)}.
  Considere diretrizes internacionais, segurança do paciente e coerência clínica total.`;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER },
      score_label: { type: Type.STRING },
      diagnostico: { type: Type.STRING },
      evidencia: { type: Type.STRING },
      seguranca: { type: Type.STRING },
      melhoria: { type: Type.STRING },
      parecer: { type: Type.STRING }
    },
    required: ["score", "score_label", "diagnostico", "evidencia", "seguranca", "melhoria", "parecer"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Forneça análise detalhada, fidedigna e baseada em evidências. Dê uma pontuação de 0 a 100.",
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Audit error:", error);
    return null;
  }
}

export async function searchCodes(query: string) {
  const prompt = `Pesquise códigos clínicos (CIAP-2, CID-10 ou CID-11) relacionados a: "${query}". 
  Retorne uma lista JSON de objetos com { code, name, type }.`;
  
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING },
        name: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["CIAP-2", "CID-10", "CID-11"] }
      },
      required: ["code", "name", "type"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Você é um especialista em codificação clínica internacional (CIAP-2, CID-10, CID-11).",
        responseMimeType: "application/json",
        responseSchema,
        tools: [{ googleSearch: {} }]
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Search codes error:", error);
    return [];
  }
}

export async function generateSummary(state: any) {
  const prompt = `Gere um resumo clínico conciso e profissional desta consulta SOAP: ${JSON.stringify(state)}. 
  O resumo deve ser adequado para transferência de cuidado ou registro em prontuário eletrônico.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Você é um médico especialista em documentação clínica. Gere resumos claros, objetivos e profissionais.",
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Summary error:", error);
    return "Erro ao gerar resumo.";
  }
}
