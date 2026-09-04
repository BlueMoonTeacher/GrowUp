export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const GEMINI_MODELS = [
  { value: 'gemini-3.8-flash', label: '3.8 Flash (기본 · 최신 안정 모델)' },
  { value: 'gemini-3.7-flash', label: '3.7 Flash (안정 모델)' },
  { value: 'gemini-3.6-flash', label: '3.6 Flash (속도·효율)' },
  { value: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite (경량·저비용)' },
  { value: 'gemini-3.5-flash', label: '3.5 Flash (이전 안정 모델)' },
  { value: 'gemini-3.1-pro-preview', label: '3.1 Pro Preview (고성능 · 미리보기)' },
  { value: 'gemini-2.5-flash', label: '2.5 Flash (레거시 호환)' },
  { value: 'gemini-2.5-pro', label: '2.5 Pro (레거시 호환)' },
];

const SUPPORTED_GEMINI_MODELS = new Set(GEMINI_MODELS.map(model => model.value));

const MODEL_MIGRATIONS: Record<string, string> = {
  'gemini-3-flash-preview': DEFAULT_GEMINI_MODEL,
  'gemini-3.1-flash-lite': 'gemini-3.5-flash-lite',
};

export function normalizeGeminiModel(model?: string): string {
  if (model && MODEL_MIGRATIONS[model]) {
    return MODEL_MIGRATIONS[model];
  }
  if (!model || !SUPPORTED_GEMINI_MODELS.has(model)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return model;
}
