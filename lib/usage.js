// Free-use limits: how many photos one person can identify per day, week and month.
// Counts are kept in Upstash Redis (free tier, added from Vercel's Marketplace).
// Without Redis the limits still work, but only per server instance (best effort).

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d);
export const LIMITS = {
  day: num(process.env.FREE_PER_DAY, 3),
  week: num(process.env.FREE_PER_WEEK, 21),   // 3 a day, every day
  month: num(process.env.FREE_PER_MONTH, 93), // 3 a day, every day
};
// A looser cap per network (IP address), so clearing the browser doesn't reset everything.
const IP_MULTIPLIER = 3;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
export const hasRedis = Boolean(REDIS_URL && REDIS_TOKEN);

// Periods follow the user's local calendar (their phone sends its time-zone offset).
function periods(offsetMin = 0, now = Date.now()) {
  const shift = offsetMin * 60000;           // getTimezoneOffset(): minutes behind UTC
  const local = new Date(now - shift);         // local wall-clock time, read with getUTC*
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  const dow = (local.getUTCDay() + 6) % 7;    // week starts Monday
  const monday = new Date(Date.UTC(y, m, d - dow));
  return {
    keys: { day: `${y}-${pad(m + 1)}-${pad(d)}`, week: `w${monday.toISOString().slice(0, 10)}`, month: `${y}-${pad(m + 1)}` },
    resets: {
      day: Date.UTC(y, m, d + 1) + shift,
      week: Date.UTC(y, m, d - dow + 7) + shift,
      month: Date.UTC(y, m + 1, 1) + shift,
    },
  };
}

async function redis(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  return out.map((x) => x.result);
}

const memory = new Map();
const TTL = { day: 2 * 86400, week: 8 * 86400, month: 32 * 86400 };

function keysFor(subjects, p) {
  const list = [];
  for (const s of subjects) for (const period of ['day', 'week', 'month']) list.push({ s, period, key: `wt:${s}:${p.keys[period]}` });
  return list;
}

// Read current counts. Returns { allowed, usage, blockedBy, resetsAt }.
export async function check(device, ip, offsetMin = 0) {
  const p = periods(offsetMin);
  const subjects = [`dev:${device}`, `ip:${ip}`];
  const list = keysFor(subjects, p);
  let counts;
  try {
    counts = hasRedis ? (await redis([['MGET', ...list.map((k) => k.key)]]))[0] : list.map((k) => memory.get(k.key) || 0);
  } catch (e) {
    console.error('usage check failed', e.message);
    return { allowed: true, usage: null }; // fail open so the app keeps working
  }
  const usage = {};
  let blockedBy = null;
  list.forEach((k, i) => {
    const used = Number(counts[i] || 0);
    const limit = k.s.startsWith('ip:') ? LIMITS[k.period] * IP_MULTIPLIER : LIMITS[k.period];
    if (k.s.startsWith('dev:')) usage[k.period] = { used, limit, resetsAt: p.resets[k.period] };
    if (used >= limit && (!blockedBy || p.resets[k.period] > p.resets[blockedBy])) blockedBy = k.period;
  });
  return { allowed: !blockedBy, usage, blockedBy, resetsAt: blockedBy ? p.resets[blockedBy] : null };
}

// Count one photo.
export async function record(device, ip, offsetMin = 0) {
  const p = periods(offsetMin);
  const list = keysFor([`dev:${device}`, `ip:${ip}`], p);
  try {
    if (hasRedis) {
      await redis(list.flatMap((k) => [['INCR', k.key], ['EXPIRE', k.key, TTL[k.period]]]));
    } else {
      for (const k of list) memory.set(k.key, (memory.get(k.key) || 0) + 1);
      if (memory.size > 20000) memory.clear();
    }
  } catch (e) {
    console.error('usage record failed', e.message);
  }
}
