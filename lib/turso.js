/* =====================================================================
   Turso (libSQL) access via the built-in HTTP pipeline API — no extra
   npm dependency needed (uses Node's global fetch).

   Environment variables (set in Vercel, never committed):
     TURSO_DATABASE_URL   e.g. libsql://<db>.turso.io
     TURSO_AUTH_TOKEN     the database token
   ===================================================================== */

const RAW_URL = process.env.TURSO_DATABASE_URL || '';
const TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function endpoint() {
  return RAW_URL.replace(/^libsql:\/\//i, 'https://').replace(/\/+$/, '') + '/v2/pipeline';
}

/* Run one SQL statement. args is an optional array of values (bound as text). */
async function query(sql, args = []) {
  if (!RAW_URL || !TOKEN) throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set');
  const stmt = args.length
    ? { sql, args: args.map(v => ({ type: 'text', value: String(v) })) }
    : { sql };

  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt }, { type: 'close' }] })
  });
  if (!res.ok) throw new Error('Turso HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));

  const j = await res.json();
  const r0 = j.results && j.results[0];
  if (!r0 || r0.type !== 'ok') throw new Error('Turso query failed: ' + JSON.stringify(r0 && r0.error || r0));

  const result = r0.response.result;
  const cols = (result.cols || []).map(c => c.name);
  const rows = (result.rows || []).map(row => {
    const o = {};
    row.forEach((cell, i) => { o[cols[i]] = cell == null ? null : (cell.value !== undefined ? cell.value : cell); });
    return o;
  });
  return { cols, rows };
}

module.exports = { query };
