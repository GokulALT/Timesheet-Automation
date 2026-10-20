/**
 * Accepts a natural-language task summary, extracts individual tasks from it,
 * then distributes them across the provided working dates — all in one LLM call.
 *
 * Uses dynamic import() to load the ESM-only `ollama` package from CommonJS.
 *
 * @param {string[]} dates        - Array of "YYYY-MM-DD" working day strings
 * @param {string}   taskSummary  - Free-form natural language description of the work
 * @returns {Promise<Array<{ date: string, tasks: string[] }>>}
 */
const { Agent, fetch: undiciFetch } = require('undici');

/**
 * Ollama does not send HTTP response headers until generation finishes, and
 * for a cloud-proxied model it withholds the entire response until then.
 * undici allows only 300 seconds for headers to arrive, so a long schedule
 * blows past that and Node reports "TypeError: fetch failed" with cause
 * UND_ERR_HEADERS_TIMEOUT -- which reads like an unreachable server when in
 * fact the model is still working normally.
 *
 * Measured on nemotron-3-ultra:cloud with a 15-day schedule: headers arrived
 * at 148s, 168s and >306s on three consecutive runs, so the failure is
 * intermittent and gets likelier as the schedule grows. Streaming does not
 * help, because the cloud proxy buffers: all 117KB arrived in the final 0.4s.
 *
 * This dispatcher disables the deadline for Ollama calls only; nothing else in
 * the process is affected. It must be used with undici's own fetch -- Node's
 * global fetch rejects a dispatcher from the standalone package with
 * UND_ERR_INVALID_ARG.
 */
const ollamaDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

async function scheduleWithAI(dates, taskSummary) {
  const { Ollama } = await import('ollama');

  const model = process.env.OLLAMA_MODEL || 'llama3';

  const client = new Ollama({
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    fetch: (input, init) => undiciFetch(input, { ...init, dispatcher: ollamaDispatcher }),
  });

  const prompt =
    `You are an expert project manager. You will be given a natural language description of a project ` +
    `and a list of working dates.\n\n` +
    `Your job is to:\n` +
    `1. Read the description and identify all individual tasks mentioned.\n` +
    `2. Group related tasks logically and distribute them across the provided dates.\n` +
    `3. For each day, assign a duration in hours to every task.\n` +
    `4. CRITICAL: The total duration across all entries for each day MUST equal exactly 8 hours.\n` +
    `5. If tasks do not fill a day, pad with a general task like "Documentation & Review" for the remaining hours.\n\n` +
    `Project description:\n"${taskSummary}"\n\n` +
    `Working dates: ${JSON.stringify(dates)}\n\n` +
    `Respond ONLY with a valid JSON array in this exact format — no explanation, no markdown:\n` +
    `[{ "date": "YYYY-MM-DD", "entries": [{ "task": "task description", "duration": 4 }, { "task": "another task", "duration": 4 }] }]\n\n` +
    `IMPORTANT: Each day's entries must sum to exactly 8 hours total.`;

  // Stream the response rather than waiting for a single complete reply.
  //
  // With stream:false Ollama withholds the HTTP response *headers* until the
  // whole generation is finished, so a long generation trips undici's
  // headersTimeout and surfaces as "TypeError: fetch failed" with cause
  // UND_ERR_HEADERS_TIMEOUT -- as though the server were unreachable, when in
  // fact the model is working normally and simply taking a while. Streaming
  // sends headers straight away and keeps data flowing, so no timeout applies
  // no matter how long the model thinks.
  const stream = await client.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  let rawContent = '';
  for await (const part of stream) {
    // Reasoning models put chain-of-thought in `thinking`; only `content`
    // carries the answer, so accumulating just this keeps the JSON clean.
    rawContent += (part && part.message && part.message.content) || '';
  }

  if (!rawContent.trim()) {
    throw new Error('The model "' + model + '" returned an empty response.');
  }

  // Strip markdown code fences if the model wraps the JSON in ```json ... ```
  const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const schedule = JSON.parse(cleaned);
  return schedule;
}

module.exports = { scheduleWithAI };
