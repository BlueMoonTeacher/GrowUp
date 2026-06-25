export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export const GEMINI_MODELS = [
  { value: 'gemini-3.5-flash', label: '3.5 Flash (기본 - 최신 안정 모델)' },
  { value: 'gemini-3.1-pro-preview', label: '3.1 Pro Preview (고성능)' },
  { value: 'gemini-3-flash-preview', label: '3.0 Flash Preview (빠른 최신 모델)' },
  { value: 'gemini-3.1-flash-lite', label: '3.1 Flash-Lite (경량/저비용)' },
  { value: 'gemini-2.5-flash', label: '2.5 Flash (호환성)' },
  { value: 'gemini-2.5-pro', label: '2.5 Pro (호환성)' },
];

const SUPPORTED_GEMINI_MODELS = new Set(GEMINI_MODELS.map(model => model.value));

export function normalizeGeminiModel(model?: string): string {
  if (!model || !SUPPORTED_GEMINI_MODELS.has(model)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return model;
}
