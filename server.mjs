import express from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { GoogleGenAI } from '@google/genai';
import { generateWithModelFallback, classifyGeminiError, isValidGeminiKeyInput } from './services/geminiGateway.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Cloud Run 호스팅 프로젝트와 Firebase 데이터 프로젝트가 서로 다르다.
// 토큰 audience와 Firestore 대상이 흔들리지 않도록 Firebase 프로젝트를 명시한다.
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'forstudents-e1117';
const kmsKeyName = process.env.GEMINI_KEY_KMS_NAME || '';
const port = Number(process.env.PORT || 8080);
const credentialCollection = '_privateGeminiCredentials';

if (getApps().length === 0) {
  initializeApp({ projectId: firebaseProjectId });
}

const auth = getAuth();
const db = getFirestore();
const kms = new KeyManagementServiceClient();
const app = express();

const supportedModels = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

const requestWindows = new Map();
const rateLimitWindowMs = 60_000;
const maxAiRequestsPerWindow = 30;
const parseKeyRequest = express.json({ limit: '4kb' });
const parseAiRequest = express.json({ limit: '20mb' });

app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.get('origin') || '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  if (req.method === 'OPTIONS' && req.path.startsWith('/api/')) {
    return res.status(204).send();
  }
  next();
});

function sendApiError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

async function requireFirebaseUser(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return sendApiError(res, 401, 'authentication-required', '로그인이 필요합니다.');
  }

  try {
    req.firebaseUser = await auth.verifyIdToken(match[1]);
    return next();
  } catch {
    return sendApiError(res, 401, 'invalid-token', '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.');
  }
}

function requireKmsConfiguration(_req, res, next) {
  if (!kmsKeyName) {
    return sendApiError(res, 503, 'kms-not-configured', 'API 키 보관 기능이 아직 설정되지 않았습니다.');
  }
  return next();
}

function enforceAiRateLimit(req, res, next) {
  const uid = req.firebaseUser.uid;
  const now = Date.now();
  const current = requestWindows.get(uid);

  if (!current || now - current.startedAt >= rateLimitWindowMs) {
    requestWindows.set(uid, { startedAt: now, count: 1 });
    return next();
  }

  if (current.count >= maxAiRequestsPerWindow) {
    return sendApiError(res, 429, 'rate-limit-exceeded', 'AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  }

  current.count += 1;
  return next();
}

async function encryptApiKey(apiKey) {
  const [result] = await kms.encrypt({
    name: kmsKeyName,
    plaintext: Buffer.from(apiKey, 'utf8'),
  });
  return Buffer.from(result.ciphertext).toString('base64');
}

async function decryptApiKey(ciphertext) {
  const [result] = await kms.decrypt({
    name: kmsKeyName,
    ciphertext: Buffer.from(ciphertext, 'base64'),
  });
  return Buffer.from(result.plaintext).toString('utf8');
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/gemini-key', requireFirebaseUser, requireKmsConfiguration, async (req, res) => {
  try {
    const snapshot = await db.collection(credentialCollection).doc(req.firebaseUser.uid).get();
    if (!snapshot.exists) {
      return res.json({ configured: false });
    }
    const data = snapshot.data() || {};
    return res.json({ configured: true, lastFour: data.lastFour || '' });
  } catch {
    return sendApiError(res, 500, 'key-status-failed', 'API 키 등록 상태를 확인하지 못했습니다.');
  }
});

app.post('/api/gemini-key', requireFirebaseUser, requireKmsConfiguration, parseKeyRequest, async (req, res) => {
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!isValidGeminiKeyInput(apiKey)) {
    return sendApiError(res, 400, 'invalid-api-key', '올바른 형식의 Gemini API 키를 입력해 주세요.');
  }

  let phase = 'encrypt';
  try {
    const ciphertext = await encryptApiKey(apiKey);
    phase = 'store';
    await db.collection(credentialCollection).doc(req.firebaseUser.uid).set({
      ciphertext,
      lastFour: apiKey.slice(-4),
      keyVersion: 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return res.json({ configured: true, lastFour: apiKey.slice(-4) });
  } catch (error) {
    // Log only stage/status, never the key or the upstream error body.
    console.error(JSON.stringify({ event: 'gemini-key-save-failure', phase, status: Number(error?.code || error?.status || 0) }));
    return sendApiError(res, 503, phase === 'encrypt' ? 'key-encryption-failed' : 'key-storage-failed',
      phase === 'encrypt'
        ? '서버의 API 키 암호화 서비스에 연결하지 못했습니다. 관리자에게 문의해 주세요.'
        : '암호화된 API 키를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
});

app.delete('/api/gemini-key', requireFirebaseUser, requireKmsConfiguration, async (req, res) => {
  try {
    await db.collection(credentialCollection).doc(req.firebaseUser.uid).delete();
    return res.status(204).send();
  } catch {
    return sendApiError(res, 500, 'key-delete-failed', 'API 키를 삭제하지 못했습니다.');
  }
});

app.post(
  '/api/gemini/generate',
  requireFirebaseUser,
  requireKmsConfiguration,
  parseAiRequest,
  enforceAiRateLimit,
  async (req, res) => {
    const { model, contents, config } = req.body || {};
    if (!supportedModels.has(model)) {
      return sendApiError(res, 400, 'unsupported-model', '지원하지 않는 Gemini 모델입니다.');
    }
    if (!contents || typeof contents !== 'object') {
      return sendApiError(res, 400, 'invalid-request', 'AI 요청 내용이 없습니다.');
    }

    let plaintextKey = '';
    let phase = 'credentials';
    try {
      const snapshot = await db.collection(credentialCollection).doc(req.firebaseUser.uid).get();
      if (!snapshot.exists || !snapshot.data()?.ciphertext) {
        return sendApiError(res, 412, 'gemini-key-required', '설정에서 개인 Gemini API 키를 먼저 등록해 주세요.');
      }

      plaintextKey = await decryptApiKey(snapshot.data().ciphertext);
      const ai = new GoogleGenAI({ apiKey: plaintextKey });
      phase = 'generate';
      const response = await generateWithModelFallback(ai, { model, contents, config }, supportedModels);
      if (!response.text?.trim()) {
        return sendApiError(res, 422, 'gemini-empty-response', 'AI가 분석 결과를 반환하지 않았습니다. 이미지 내용을 확인하고 다시 시도해 주세요.');
      }
      return res.json({ text: response.text });
    } catch (error) {
      // Never log upstream messages: they may contain credentials or user content.
      console.error(JSON.stringify({ event: 'gemini-failure', phase, model, status: Number(error?.status || error?.code || 0) }));
      return sendApiError(res, ...classifyGeminiError(error, phase));
    } finally {
      plaintextKey = '';
    }
  },
);

// 과거 공용 프록시 경로는 명시적으로 폐쇄한다.
app.all('/api-proxy/*', (_req, res) => res.status(404).send('Not Found'));
app.all('/api/*', (_req, res) => sendApiError(res, 404, 'not-found', '요청한 API를 찾을 수 없습니다.'));

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(currentDirectory, 'dist');
app.use('/assets', express.static(path.join(distDirectory, 'assets'), {
  immutable: true,
  maxAge: '180d',
}));
app.use(express.static(distDirectory, { maxAge: 0 }));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distDirectory, 'index.html'));
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    return sendApiError(res, 413, 'request-too-large', '첨부파일을 포함한 AI 요청은 20MB 이하여야 합니다.');
  }
  return sendApiError(res, 400, 'invalid-json', '요청 형식이 올바르지 않습니다.');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`GrowUp server listening on port ${port}`);
});
