import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const systemInstruction = `You are an AI tour guide for Hainan Wenchang Tourism (海南文昌文旅).
Always provide detailed, engaging, and accurate information about Wenchang, Hainan.
Include recommendations for food (like Wenchang Chicken), sights (like Dongjiao Coconut Grove, Wenchang Spacecraft Launch Site), culture, and itineraries.
Respond in markdown format. Keep the tone friendly and helpful. Please ALWAYS reply and converse using simplified Chinese (简体中文).
请规范答案格式，确保序号和标题排版整齐一致。在回答中适当加入符合当地风情和内容的emoji表情（如 🌴, 🥥, 🚀, 🍗 等），增加回答的趣味性和阅读体验。`;

function getClient() {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      client: new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' }),
      type: 'deepseek' as const,
    };
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('DEEPSEEK_API_KEY or GEMINI_API_KEY environment variable is required');
  }
  return {
    client: new GoogleGenAI({ apiKey: geminiKey }),
    type: 'gemini' as const,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, history = [] } = req.body ?? {};
    const { client, type } = getClient();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (type === 'deepseek') {
      const messages = [
        { role: 'system', content: systemInstruction },
        ...history.map((msg: { role: string; content: string }) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: prompt || 'Introduce Wenchang' },
      ];

      const responseStream = await (client as OpenAI).chat.completions.create({
        model: 'deepseek-chat',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: true,
      });

      for await (const chunk of responseStream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    } else {
      const contents = history.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      contents.push({
        role: 'user',
        parts: [{ text: prompt || 'Introduce Wenchang' }],
      });

      const responseStream = await (client as GoogleGenAI).models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction },
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate response';
    console.error('Chat API Error:', error);
    const isQuotaError =
      message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED');
    if (!res.headersSent) {
      return res.status(isQuotaError ? 429 : 500).json({ error: message });
    }
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};
