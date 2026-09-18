// Credentials are opaque: Google can change their prefix and encoded length.
// This checks safe transport only; Gemini remains responsible for authentication.
export function isValidGeminiKeyInput(value) {
  return typeof value === 'string' && /^[\x21-\x7e]{20,2048}$/.test(value);
}

export async function generateWithModelFallback(ai, request, supportedModels) {
  try {
    return await ai.models.generateContent(request);
  } catch (error) {
    // Retry only missing models, never invalid keys, quota errors or bad inputs.
    if (Number(error?.status) !== 404) throw error;
    const available = new Set();
    const models = await ai.models.list();
    for await (const model of models) {
      if (model.supportedActions?.includes('generateContent')) {
        available.add(model.name?.replace(/^models\//, ''));
      }
    }
    const fallback = [...supportedModels].find(model => model !== request.model && available.has(model));
    if (!fallback) throw error;
    return ai.models.generateContent({ ...request, model: fallback });
  }
}

export function getGeminiQuotaDetails(error) {
  let body = error;
  try { body = JSON.parse(error?.message); } catch { /* SDKs may expose details directly. */ }
  const details = body?.error?.details || body?.details || [];
  const violations = Array.isArray(details) ? details.flatMap(detail =>
    detail?.['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && Array.isArray(detail.violations) ? detail.violations : []) : [];
  const metrics = [...new Set(violations.map(item => item.quotaMetric).filter(value =>
    typeof value === 'string' && /^generativelanguage\.googleapis\.com\/[a-z0-9_]{1,160}$/.test(value)))];
  const zeroLimit = violations.some(item => item.quotaValue === 0 || item.quotaValue === '0') ||
    /Quota exceeded for metric: generativelanguage\.googleapis\.com\/[a-z0-9_]+, limit: 0(?:\D|$)/.test(body?.error?.message || body?.message || '');
  return { metrics, zeroLimit };
}

export function classifyGeminiError(error, phase) {
  if (phase === 'credentials') return [503, 'key-read-failed', '저장된 API 키를 불러오지 못했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.'];
  const status = Number(error?.status || error?.code || 0);
  if (status === 401 || status === 403) return [403, 'gemini-key-rejected', 'Gemini API 키의 유효성과 API 사용 권한을 확인해 주세요.'];
  if (status === 400) return [400, 'gemini-invalid-request', 'API 키 또는 요청 형식을 확인해 주세요. 이미지 형식이나 선택한 모델을 바꾸어 다시 시도해 주세요.'];
  if (status === 404) return [404, 'gemini-model-unavailable', '이 API 키에서 사용할 수 있는 모델을 찾지 못했습니다. 설정에서 다른 AI 모델을 선택해 주세요.'];
  if (status === 429) {
    const quota = getGeminiQuotaDetails(error);
    if (quota.zeroLimit) return [429, 'gemini-quota-unavailable', 'Google이 이 모델의 프로젝트 할당량을 0으로 응답했습니다. 새 키 발급으로는 해결되지 않습니다. AI Studio에서 해당 프로젝트의 모델 사용 한도와 사용 등급을 확인해 주세요.'];
    return [429, 'gemini-quota-exceeded', 'Google이 프로젝트의 요청 또는 사용 한도를 이유로 호출을 제한했습니다(429). 새 키도 같은 프로젝트 한도를 공유합니다. AI Studio의 모델별 사용 한도를 확인해 주세요.'];
  }
  return [502, 'gemini-request-failed', 'Gemini 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.'];
}
