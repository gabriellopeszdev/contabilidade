export type IaProvider = 'anthropic' | 'openai' | 'google' | 'deepseek';

export const IA_PROVIDERS: { id: IaProvider; label: string; modelLabel: string }[] = [
  { id: 'anthropic', label: 'Claude (Anthropic)', modelLabel: 'claude-haiku-4-5' },
  { id: 'openai',    label: 'GPT (OpenAI)',        modelLabel: 'gpt-4o-mini'      },
  { id: 'deepseek',  label: 'DeepSeek',            modelLabel: 'deepseek-chat'    },
  { id: 'google',    label: 'Gemini (Google)',      modelLabel: 'gemini-2.0-flash' },
];
