// GET  /api/identify → how many free photos this person has left.
// POST /api/identify → receives a JPEG photo (base64), asks the AI what it shows,
//                      and returns a structured answer.
// Works with OpenAI or Anthropic (Claude). API keys stay on the server.

import { check, record, LIMITS } from '../lib/usage.js';

// Which AI to use: set AI_PROVIDER to "openai" or "anthropic".
// If it's not set, OpenAI is used when OPENAI_API_KEY exists, otherwise Claude.
const PROVIDER = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'anthropic')).toLowerCase();

// First try uses the fast, cheap model. "Not it? Try again" uses the stronger one.
// All of these can be changed in Vercel without touching code.
const MODELS = {
  openai: {
    fast: process.env.OPENAI_MODEL_FAST || 'gpt-5-mini',
    strong: process.env.OPENAI_MODEL_STRONG || 'gpt-5.4-mini',
  },
  anthropic: {
    fast: process.env.CLAUDE_MODEL_FAST || 'claude-haiku-4-5-20251001',
    strong: process.env.CLAUDE_MODEL_STRONG || 'claude-sonnet-5-5',
  },
};

const TYPES = {
  animal: 'Animal', bird: 'Bird', insect: 'Insect', plant: 'Plant', mushroom: 'Mushroom',
  food: 'Food', toy: 'Toy', tool: 'Tool', vehicle: 'Vehicle', electronics: 'Electronics',
  clothing: 'Clothing', art: 'Art', rock: 'Rock or mineral', landmark: 'Landmark', household: 'Household item',
};

// Short-burst limit per network, on top of the daily/weekly/monthly free limits.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

// The shape of every answer. (Strict JSON schema: every field is required;
// fields that don't apply come back as an empty string or empty list.)
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    identified: { type: 'boolean', description: 'false if the subject cannot be identified, or is a person' },
    name: { type: 'string', description: 'Common name in Title Case, e.g. "Northern Cardinal", "Pipe Wrench"' },
    specific: { type: 'string', description: 'Scientific name, model, variant or maker. Empty string if not applicable.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    category: { type: 'string', enum: [...Object.keys(TYPES), 'other'] },
    summary: { type: 'string', description: 'What it is and the visual clues that give it away' },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', description: '1-2 words, e.g. "Size", "Eats", "Made by"' },
          value: { type: 'string', description: 'Short value, at most 6 words' },
        },
        required: ['label', 'value'],
      },
    },
    lookalikes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Title Case name' },
          tell: { type: 'string', description: 'One short sentence on how to tell them apart' },
        },
        required: ['name', 'tell'],
      },
    },
    notes: { type: 'array', items: { type: 'string' }, description: 'Interesting or useful details' },
    caution: { type: 'string', description: 'Safety warning if relevant (venomous, toxic, sharp, allergen). Otherwise empty string.' },
    reason_if_not: { type: 'string', description: 'Only when identified is false: why, and what photo would help. Otherwise empty string.' },
  },
  required: ['identified', 'name', 'specific', 'confidence', 'category', 'summary', 'facts', 'lookalikes', 'notes', 'caution', 'reason_if_not'],
};

function buildPrompt(type, detail, exclude) {
  const quick = detail === 'quick';
  const lines = [
    'You power "What\'s this?", a phone app that identifies whatever is in a photo: animals, plants, insects, mushrooms, food, toys, tools, vehicles, electronics, clothing, art, rocks, landmarks, household objects and more.',
    type ? `The user says it is: ${TYPES[type]}. If the photo clearly shows something else, identify what is actually there.` : 'The user did not say what kind of thing it is.',
  ];
  if (exclude.length) {
    lines.push(`The user says these earlier answers were WRONG: ${exclude.join('; ')}. Give your next most likely identification, different from all of them, and lower the confidence if you are unsure.`);
  }
  lines.push(
    'Identify the main subject as specifically as the photo allows (species or breed; make, model and approximate years; exact tool or product type; style or period).',
    'Write names in Title Case. Use plain, friendly English.',
    'If the main subject is a person, do not say who they are: set identified to false and explain that the app identifies things, animals and plants, not people.',
    'Never say a wild mushroom, berry or plant is safe to eat.',
    quick
      ? 'Keep it short: a 1-2 sentence summary, exactly 4 facts, 0-2 lookalikes and 1-2 notes.'
      : 'Give a 2-3 sentence summary, exactly 6 facts, 1-3 lookalikes and 2-3 notes.',
    'Choose facts that suit the kind of thing (animal: size, eats, found in, lifespan; vehicle: maker, years, engine, body style; tool: used for, how to use; food: origin, taste, how it\'s eaten).',
  );
  return lines.join('\n');
}

class AiError extends Error {
  constructor(status, error, message) { super(message); this.status = status; this.error = error; }
}

async function post(url, headers, payload) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    });
    return { status: r.status, ok: r.ok, data: await r.json().catch(() => null) };
  } catch {
    throw new AiError(504, 'timeout', 'The AI took too long to answer. Try again.');
  }
}

function failure(status, msg, keyName) {
  console.error('AI error', status, msg);
  if (status === 401 || status === 403) return new AiError(502, 'server_key', `The app's API key was rejected. Check ${keyName} in Vercel.`);
  if (/insufficient_quota|credit|billing|balance/i.test(msg)) return new AiError(502, 'no_credit', "The app's AI account is out of credit.");
  if (status === 429) return new AiError(503, 'busy', 'Too many requests right now. Try again in a minute.');
  if (status === 400 && /image/i.test(msg)) return new AiError(400, 'bad_image', 'That photo could not be read. Try another one.');
  return new AiError(502, 'upstream', 'The AI is having trouble right now. Try again.');
}

// ---------- OpenAI ----------
async function askOpenAI(image, prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiError(500, 'not_configured', 'The server is missing its OPENAI_API_KEY.');
  const payload = {
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' } },
      ],
    }],
    response_format: { type: 'json_schema', json_schema: { name: 'identification', strict: true, schema: SCHEMA } },
    max_completion_tokens: 6000,
    reasoning_effort: 'low', // faster and cheaper; removed automatically for models that don't support it
  };
  const headers = { Authorization: `Bearer ${key}` };
  let r = await post('https://api.openai.com/v1/chat/completions', headers, payload);
  const errMsg = (x) => (x.data && x.data.error ? `${x.data.error.code || ''} ${x.data.error.message || ''}` : '');
  if (r.status === 400 && /reasoning_effort|reasoning/i.test(errMsg(r))) {
    delete payload.reasoning_effort;
    r = await post('https://api.openai.com/v1/chat/completions', headers, payload);
  }
  if (!r.ok) throw failure(r.status, errMsg(r), 'OPENAI_API_KEY');
  const msg = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message;
  if (msg && msg.refusal) {
    return { identified: false, name: '', specific: '', confidence: 'low', category: 'other', summary: '', facts: [], lookalikes: [], notes: [], caution: '', reason_if_not: "This photo can't be identified. Try a photo of an object, animal or plant." };
  }
  try { return JSON.parse(msg.content); } catch { throw new AiError(502, 'no_answer', 'No answer came back. Try again.'); }
}

// ---------- Anthropic (Claude) ----------
async function askClaude(image, prompt, model, detail) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError(500, 'not_configured', 'The server is missing its ANTHROPIC_API_KEY.');
  const tool = { name: 'report_identification', description: 'Report what the main subject of the photo is.', input_schema: SCHEMA };
  const payload = {
    model,
    max_tokens: detail === 'quick' ? 800 : 1400,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        { type: 'text', text: prompt + '\nReport your answer with the report_identification tool.' },
      ],
    }],
  };
  const r = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload);
  if (!r.ok) throw failure(r.status, r.data && r.data.error ? r.data.error.message || '' : '', 'ANTHROPIC_API_KEY');
  const used = r.data && Array.isArray(r.data.content) ? r.data.content.find((c) => c.type === 'tool_use') : null;
  if (!used || !used.input) throw new AiError(502, 'no_answer', 'No answer came back. Try again.');
  return used.input;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const PERIOD_WORD = { day: 'today', week: 'this week', month: 'this month' };

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const rawDevice = String(req.headers['x-device-id'] || '');
  const device = /^[A-Za-z0-9-]{8,64}$/.test(rawDevice) ? rawDevice : `anon-${ip}`;
  const tz = Math.max(-840, Math.min(840, Math.round(Number(req.headers['x-tz-offset']) || 0)));

  if (req.method === 'GET') {
    const u = await check(device, ip, tz);
    return send(res, 200, { usage: u.usage, limits: LIMITS });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  if (limited(ip)) return send(res, 429, { error: 'rate_limited', message: 'Too many photos in a short time. Wait a few minutes and try again.' });

  const quota = await check(device, ip, tz);
  if (!quota.allowed) {
    const n = LIMITS[quota.blockedBy];
    return send(res, 429, {
      error: 'limit_reached',
      period: quota.blockedBy,
      resetsAt: quota.resetsAt,
      usage: quota.usage,
      message: `You've used your ${n} free ${n === 1 ? 'photo' : 'photos'} ${PERIOD_WORD[quota.blockedBy]}.`,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const image = body && body.image;
  if (typeof image !== 'string' || image.length < 200 || image.length > 4_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(image.slice(-100))) {
    return send(res, 400, { error: 'bad_image', message: 'That photo could not be read.' });
  }
  const type = body.type && TYPES[body.type] ? body.type : null;
  const detail = body.detail === 'quick' ? 'quick' : 'detailed';
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.filter((x) => typeof x === 'string' && x.trim()).slice(0, 6).map((x) => x.trim().slice(0, 80))
    : [];
  const strong = body.retry === true || exclude.length > 0;

  const models = MODELS[PROVIDER] || MODELS.anthropic;
  const model = strong ? models.strong : models.fast;
  const prompt = buildPrompt(type, detail, exclude);

  let result;
  try {
    result = PROVIDER === 'openai' ? await askOpenAI(image, prompt, model) : await askClaude(image, prompt, model, detail);
  } catch (e) {
    if (e instanceof AiError) return send(res, e.status, { error: e.error, message: e.message });
    console.error(e);
    return send(res, 500, { error: 'server', message: 'Something went wrong on our side. Try again.' });
  }

  await record(device, ip, tz);
  const usage = quota.usage
    ? Object.fromEntries(Object.entries(quota.usage).map(([k, v]) => [k, { ...v, used: v.used + 1 }]))
    : null;
  return send(res, 200, { result, usage });
}
