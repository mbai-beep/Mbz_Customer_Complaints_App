/* Turso (libSQL) access via the built-in HTTP pipeline API (uses global fetch).
   Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.
   NOTE: writing complaints requires a READ-WRITE token. */
const RAW_URL = process.env.TURSO_DATABASE_URL || '';
const TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function endpoint() {
  return RAW_URL.replace(/^libsql:\/\//i, 'https://').replace(/\/+$/, '') + '/v2/pipeline';
}
function arg(v) { return { type: 'text', value: v == null ? '' : String(v) }; }

async function pipeline(stmts) {
  if (!RAW_URL || !TOKEN) throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set');
  const requests = stmts.map(s => ({
    type: 'execute',
    stmt: (s.args && s.args.length) ? { sql: s.sql, args: s.args.map(arg) } : { sql: s.sql }
  }));
  requests.push({ type: 'close' });
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) throw new Error('Turso HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const j = await res.json();
  return (j.results || []).map(r => {
    if (r.type !== 'ok') throw new Error('Turso query failed: ' + JSON.stringify(r.error || r));
    const result = r.response.result;
    const cols = (result.cols || []).map(c => c.name);
    const rows = (result.rows || []).map(row => {
      const o = {}; row.forEach((cell, i) => { o[cols[i]] = cell == null ? null : (cell.value !== undefined ? cell.value : cell); });
      return o;
    });
    return { cols, rows };
  });
}

async function query(sql, args = []) { return (await pipeline([{ sql, args }]))[0]; }
async function batch(stmts) { return pipeline(stmts); }

module.exports = { query, batch };
