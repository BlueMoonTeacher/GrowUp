import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWithModelFallback, classifyGeminiError } from './geminiGateway.mjs';

test('missing model retries with an available approved model and preserves the image/schema', async () => {
  const calls = [];
  const request = { model: 'missing', contents: { parts: [{ inlineData: { data: 'test', mimeType: 'image/png' } }] }, config: { responseMimeType: 'application/json' } };
  const ai = { models: {
    generateContent: async input => { calls.push(input); if (input.model === 'missing') throw { status: 404 }; return { text: '[]' }; },
    list: async function* () { yield { name: 'models/unapproved', supportedActions: ['generateContent'] }; yield { name: 'models/available', supportedActions: ['generateContent'] }; },
  } };
  assert.deepEqual(await generateWithModelFallback(ai, request, new Set(['missing', 'available'])), { text: '[]' });
  assert.deepEqual(calls[1], { ...request, model: 'available' });
  assert.equal(calls.length, 2);
});

for (const status of [400, 401, 403, 429, 503]) {
  test(`does not retry or list models for ${status}`, async () => {
    const error = { status };
    const ai = { models: { generateContent: async () => { throw error; }, list: () => assert.fail('unexpected model listing') } };
    await assert.rejects(generateWithModelFallback(ai, {}, new Set()), e => e === error);
  });
}

test('credential service failures are not reported as invalid user API keys', () => {
  assert.equal(classifyGeminiError({ code: 7 }, 'credentials')[1], 'key-read-failed');
  assert.equal(classifyGeminiError({ status: 404 }, 'generate')[1], 'gemini-model-unavailable');
  assert.equal(classifyGeminiError({ status: 429 }, 'generate')[1], 'gemini-quota-exceeded');
});
