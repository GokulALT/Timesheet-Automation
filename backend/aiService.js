'use strict';

const { Agent, fetch: undiciFetch } = require('undici');

// One dispatcher per process: zero timeouts, SSL permissive.
// Scoped here so it never affects other code.
const aiAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout:    0,
  connect:        { rejectUnauthorized: false },
});

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(dates, taskSummary) {
  return (
    `You are an expert project manager. You will be given a natural language description of a project ` +
    `and a list of working dates.\n\n` +
    `Your job is to:\n` +
    `1. Read the description and identify all individual tasks mentioned.\n` +
    `2. Group related tasks logically and distribute them across the provided dates.\n` +
    `3. For each day, assign a duration in hours to every task.\n` +
    `4. CRITICAL: The total duration across all entries for each day MUST equal exactly 8 hours.\n` +
    `5. If tasks do not fill a day, pad with a general task like "Documentation & Review" for the remaining hours.\n` +
    `6. For each task, set the "activity" field to either "product" or "delivery":\n` +
    `   - "product"  → design, development, coding, testing, bug fixes, documentation, reviews, research\n` +
    `   - "delivery" → deployment, release, go-live, customer handover, production support, demos\n\n` +
    `Project description:\n"${taskSummary}"\n\n` +
    `Working dates: ${JSON.stringify(dates)}\n\n` +
    `Respond ONLY with a valid JSON array in this exact format — no explanation, no markdown:\n` +
    `[{ "date": "YYYY-MM-DD", "entries": [{ "task": "task description", "duration": 4, "activity": "product" }] }]\n\n` +
    `IMPORTANT: Each day's entries must sum to exactly 8 hours total. Every entry must have an "activity" field.`
  );
}

// ── JSON parse with truncation recovery ───────────────────────────────────────

function parseAIResponse(raw, model) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  if (!cleaned) throw new Error(`Model "${model}" returned an empty response.`);

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    const lastClose = cleaned.lastIndexOf('}]},');
    const altClose  = cleaned.lastIndexOf('}]}');
    const cut = Math.max(lastClose, altClose);
    if (cut !== -1) {
      const recovered = cleaned.slice(0, cut + (lastClose >= altClose ? 4 : 3));
      const fixedJson = recovered.endsWith('}]}') ? recovered + ']' : recovered.replace(/,\s*$/, '') + ']';
      try {
        const partial = JSON.parse(fixedJson);
        console.warn(`AI response truncated; recovered ${partial.length} day(s). Normalizer will fill the rest.`);
        return partial;
      } catch (_) { /* fall through */ }
    }
    throw new Error(`AI returned invalid JSON. Try fewer days or a simpler description. Detail: ${parseErr.message}`);
  }
}

// ── OpenAI-compatible (OpenAI, NVIDIA NIM, Ollama, Groq, etc.) ───────────────

async function callOpenAICompatible({ baseUrl, apiKey, model, prompt }) {
  const res = await undiciFetch(`${baseUrl}/chat/completions`, {
    method:     'POST',
    dispatcher: aiAgent,
    headers: {
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful project management assistant. Respond only with valid JSON when asked.' },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.5,
      top_p:       1,
      max_tokens:  8192,
      stream:      false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${err.message || err.error?.message || JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────

async function callAnthropic({ apiKey, model, prompt }) {
  const res = await undiciFetch('https://api.anthropic.com/v1/messages', {
    method:     'POST',
    dispatcher: aiAgent,
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: 'You are a helpful project management assistant. Respond only with valid JSON when asked.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${err.error?.message || JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

// ── Provider defaults ─────────────────────────────────────────────────────────

const PROVIDER_DEFAULTS = {
  nvidia:    { baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'z-ai/glm-5.3-flash' },
  openai:    { baseUrl: 'https://api.openai.com/v1',           model: 'gpt-4o-mini' },
  anthropic: { baseUrl: null,                                  model: 'claude-haiku-5-5' },
  ollama:    { baseUrl: 'http://localhost:11434/v1',            model: 'llama3' },
  groq:      { baseUrl: 'https://api.groq.com/openai/v1',      model: 'llama-3.1-8b-instant' },
  lmstudio:  { baseUrl: 'http://localhost:1234/v1',             model: 'local-model' },
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a schedule using whichever AI provider the caller specifies.
 *
 * @param {string[]} dates
 * @param {string}   taskSummary
 * @param {object}   [providerConfig]  { provider, apiKey, model, baseUrl }
 *   Falls back to env vars (NVIDIA NIM) when omitted.
 */
async function scheduleWithAI(dates, taskSummary, providerConfig = {}) {
  const provider = providerConfig.provider || 'nvidia';
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.nvidia;

  // The env key and model are NVIDIA's; never send them to any other provider.
  const isNvidia = provider === 'nvidia';
  const apiKey  = providerConfig.apiKey  || (isNvidia ? process.env.NVIDIA_API_KEY : '');
  const model   = providerConfig.model   || (isNvidia && process.env.AI_MODEL) || defaults.model;
  const baseUrl = providerConfig.baseUrl || defaults.baseUrl;

  // Local servers accept a key only when authentication is turned on.
  const keyOptional = provider === 'ollama' || provider === 'lmstudio';
  if (!apiKey && !keyOptional) {
    throw new Error(`No API key provided for provider "${provider}".`);
  }

  const prompt = buildPrompt(dates, taskSummary);

  let rawContent;
  if (provider === 'anthropic') {
    rawContent = await callAnthropic({ apiKey, model, prompt });
  } else {
    rawContent = await callOpenAICompatible({ baseUrl, apiKey, model, prompt });
  }

  return parseAIResponse(rawContent, model);
}

module.exports = { scheduleWithAI, PROVIDER_DEFAULTS };
