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

export function classifyGeminiError(error, phase) {
  if (phase === 'credentials') return [503, 'key-read-failed', '저장된 API 키를 불러오지 못했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 문의해 주세요.'];
  const status = Number(error?.status || error?.code || 0);
  if (status === 401 || status === 403) return [403, 'gemini-key-rejected', 'Gemini API 키의 유효성과 API 사용 권한을 확인해 주세요.'];
  if (status === 400) return [400, 'gemini-invalid-request', 'API 키 또는 요청 형식을 확인해 주세요. 이미지 형식이나 선택한 모델을 바꾸어 다시 시도해 주세요.'];
  if (status === 404) return [404, 'gemini-model-unavailable', '이 API 키에서 사용할 수 있는 모델을 찾지 못했습니다. 설정에서 다른 AI 모델을 선택해 주세요.'];
  if (status === 429) return [429, 'gemini-quota-exceeded', 'Gemini 사용량 한도에 도달했습니다. AI Studio에서 무료 사용량·결제 설정을 확인하거나 잠시 후 다시 시도해 주세요.'];
  return [502, 'gemini-request-failed', 'Gemini 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.'];
}
