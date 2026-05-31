import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

export type { IaProvider } from './aiProviders';
export { IA_PROVIDERS }    from './aiProviders';
import type { IaProvider } from './aiProviders';

export interface IaConfig {
  provider: IaProvider;
  apiKey:   string;
}

export interface IaMessage {
  role:    'user' | 'assistant';
  content: string;
}

// Returns a plain text completion from the chosen provider.
// All providers receive a system prompt + user message and return a string.
export async function chatCompletion(
  config:       IaConfig,
  systemPrompt: string,
  userMessage:  string,
): Promise<string> {
  switch (config.provider) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey: config.apiKey });
      const msg = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      });
      const block = msg.content[0];
      return block.type === 'text' ? block.text : '';
    }

    case 'openai': {
      const client = new OpenAI({ apiKey: config.apiKey });
      const resp = await client.chat.completions.create({
        model:    'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
      });
      return resp.choices[0]?.message.content ?? '';
    }

    case 'deepseek': {
      const client = new OpenAI({
        apiKey:  config.apiKey,
        baseURL: 'https://api.deepseek.com/v1',
      });
      const resp = await client.chat.completions.create({
        model:    'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
      });
      return resp.choices[0]?.message.content ?? '';
    }

    case 'google': {
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const resp = await client.models.generateContent({
        model:    'gemini-2.5-flash',
        contents: `${systemPrompt}\n\n${userMessage}`,
      });
      return resp.text ?? '';
    }

    default:
      throw new Error(`Provider desconhecido: ${config.provider}`);
  }
}

