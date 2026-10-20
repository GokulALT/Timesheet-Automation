'use strict';

const { Agent, fetch: undiciFetch } = require('undici');

// Disable timeouts for the same reason as ollamaService: the model may take
// well over 120s to respond on first call. undici's default 300s headers
// timeout fires before the response arrives, surfacing as a confusing
// "fetch failed" rather than a slow model.
const nvidiaAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout:    0,
  connect:        { rejectUnauthorized: false },
});

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * Generate a day-by-day task schedule using the NVIDIA NIM API.
 * The NIM endpoint is OpenAI-compatible, so the request/response
 * shape is identical to the OpenAI chat completions API.
 *
 * @param {string[]} dates        YYYY-MM-DD working day strings
 * @param {string}   taskSummary  Free-form description of the sprint work
 * @returns {Promise<Array<{ date: string, entries: Array<{ task: string, duration: number }> }>>}
 */
async function scheduleWithAI(dates, taskSummary) {
  const apiKey = process.env.NVIDIA_API_KEY;
  const model  = process.env.AI_MODEL || 'z-ai/glm-5.3-flash';

  if (!apiKey) throw new Error('NVIDIA_API_KEY is not set in backend/.env');

  const prompt =
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
    `[{ "date": "YYYY-MM-DD", "entries": [{ "task": "task description", "duration": 4, "activity": "product" }, { "task": "another task", "duration": 4, "activity": "delivery" }] }]\n\n` +
    `IMPORTANT: Each day's entries must sum to exactly 8 hours total. Every entry must have an "activity" field.`;

  const res = await undiciFetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method:     'POST',
    dispatcher: nvidiaAgent,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
    throw new Error(`NVIDIA NIM ${res.status}: ${err.message || JSON.stringify(err)}`);
  }

  const data       = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content || '';

  if (!rawContent.trim()) {
    throw new Error(`Model "${model}" returned an empty response.`);
  }

  // Strip markdown code fences if the model wraps the JSON in ```json ... ```
  const cleaned = rawContent
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    // Model truncated mid-JSON (hit token limit). Recover by keeping only the
    // complete day objects before the cut point.
    const lastClose = cleaned.lastIndexOf('}]},');
    const altClose  = cleaned.lastIndexOf('}]}');
    const cut = Math.max(lastClose, altClose);
    if (cut !== -1) {
      const recovered = cleaned.slice(0, cut + (lastClose >= altClose ? 4 : 3));
      const fixedJson = recovered.endsWith('}]}') ? recovered + ']' : recovered.replace(/,\s*$/, '') + ']';
      try {
        const partial = JSON.parse(fixedJson);
        console.warn(`AI response truncated; recovered ${partial.length} complete day(s). Normalizer will fill the rest.`);
        return partial;
      } catch (_) { /* fall through to original error */ }
    }
    throw new Error(`AI returned invalid JSON (likely truncated at token limit). Try fewer days or a simpler task description. Detail: ${parseErr.message}`);
  }
}

module.exports = { scheduleWithAI };
