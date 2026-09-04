import { auth } from '../firebase';

export interface GeminiKeyStatus {
  configured: boolean;
  lastFour?: string;
}

interface GeminiGenerateRequest {
  model: string;
  contents: unknown;
  config?: unknown;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

const LOCAL_API_ORIGIN = 'https://v1-01-30846565412.us-west1.run.app';

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
    return `${LOCAL_API_ORIGIN}${path}`;
  }
  return path;
}

async function getAuthorizationHeader(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }
  return `Bearer ${await user.getIdToken()}`;
}

async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authorization = await getAuthorizationHeader();
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Authorization: authorization,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await response.json() as ApiErrorBody;
    } catch {
      // 서버가 JSON 오류 본문을 반환하지 못한 경우 기본 문구를 사용한다.
    }
    throw new Error(body.error?.message || '보안 API 요청을 처리하지 못했습니다.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function getGeminiKeyStatus(): Promise<GeminiKeyStatus> {
  return requestApi<GeminiKeyStatus>('/api/gemini-key');
}

export function saveGeminiApiKey(apiKey: string): Promise<GeminiKeyStatus> {
  return requestApi<GeminiKeyStatus>('/api/gemini-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export function deleteGeminiApiKey(): Promise<void> {
  return requestApi<void>('/api/gemini-key', { method: 'DELETE' });
}

export function generateGeminiContent(request: GeminiGenerateRequest): Promise<{ text: string }> {
  return requestApi<{ text: string }>('/api/gemini/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
