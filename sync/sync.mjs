/* =====================================================================
   SQL Server (zRetailHQ0)  ->  Turso  sync for item lookup.

   Run this on a machine INSIDE your network that can reach SQL Server.
   Reads the 3 PowerBI views, keeps the latest row per ItemId, and upserts
   the combined item record into the Turso table `item_details`.

   Setup:  copy config.example.json to config.json and fill it in, then
     npm install
     node sync.mjs           (run manually, or via Windows Task Scheduler)
   ===================================================================== */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const KEY = cfg.keyColumn || 'ItemId';

function toDate(v) { return v == null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)); }

async function run() {
  // --- 1) read SQL Server ---
  const pool = await sql.connect({
    server: cfg.sqlserver.server,
    port: Number(cfg.sqlserver.port) || 1433,
    database: cfg.sqlserver.database,
    user: cfg.sqlserver.user,
    password: cfg.sqlserver.password,
    connectionTimeout: Number(cfg.sqlserver.connectionTimeout) || 30000,
    requestTimeout: Number(cfg.sqlserver.requestTimeout) || 600000,  // 10 min for big views
    options: {
      encrypt: !!cfg.sqlserver.encrypt,
      trustServerCertificate: cfg.sqlserver.trustServerCertificate !== false
    }
  });
  console.log('Connected to SQL Server', cfg.sqlserver.server);

  console.log('Querying sales view (this can take a while for large views)...');
  const sales = (await pool.request().query(cfg.queries.sales)).recordset;
  console.log('  sales rows:', sales.length);
  console.log('Querying purchase view...');
  const purchase = (await pool.request().query(cfg.queries.purchase)).recordset;
  console.log('  purchase rows:', purchase.length);
  console.log('Querying purchase-return view...');
  const prt = (await pool.request().query(cfg.queries.purchaseReturn)).recordset;
  console.log('  return rows:', prt.length);

  // --- 2) merge, keyed by ItemId ---
  const items = new Map();
  const get = id => { if (!items.has(id)) items.set(id, { itemid: id }); return items.get(id); };

  for (const r of sales) {
    const id = String(r[KEY]); if (!id || id === 'null') continue;
    const o = get(id);
    o.articleno = r.ArticleNo ?? o.articleno ?? '';
    o.colourname = r.ColourName ?? o.colourname ?? '';
    o.contrastname = r.ContrastName ?? o.contrastname ?? '';
    o.sizename = r.SizeName ?? o.sizename ?? '';
    o.solddate = toDate(r.CashmemoDt) || o.solddate || '';
    o.cashmemono = r.CashmemoNo ?? o.cashmemono ?? '';
    if (r.SupplierName != null) o.suppliername = r.SupplierName;   // aliased from SupplierAlias
  }
  for (const r of purchase) {
    const id = String(r[KEY]); if (!id || id === 'null') continue;
    const o = get(id);
    o.purchasedate = toDate(r.PurchaseDt) || o.purchasedate || '';
  }
  for (const r of prt) {
    const id = String(r[KEY]); if (!id || id === 'null') continue;
    const o = get(id);
    o.soldreturndate = toDate(r.SoldReturnDate) || o.soldreturndate || '';  // aliased from purreturndate
  }
  await pool.close();
  console.log('Merged items:', items.size);

  // --- 3) write to Turso ---
  const db = createClient({ url: cfg.turso.url, authToken: cfg.turso.authToken });
  await db.execute(`CREATE TABLE IF NOT EXISTS item_details (
    itemid TEXT PRIMARY KEY,
    articleno TEXT, colourname TEXT, contrastname TEXT, sizename TEXT,
    solddate TEXT, cashmemono TEXT, purchasedate TEXT, soldreturndate TEXT,
    suppliername TEXT, updatedat TEXT
  )`);

  const rows = [...items.values()];
  const now = new Date().toISOString();
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map(o => ({
      sql: `INSERT INTO item_details
        (itemid,articleno,colourname,contrastname,sizename,solddate,cashmemono,purchasedate,soldreturndate,suppliername,updatedat)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(itemid) DO UPDATE SET
        articleno=excluded.articleno, colourname=excluded.colourname, contrastname=excluded.contrastname,
        sizename=excluded.sizename, solddate=excluded.solddate, cashmemono=excluded.cashmemono,
        purchasedate=excluded.purchasedate, soldreturndate=excluded.soldreturndate,
        suppliername=excluded.suppliername, updatedat=excluded.updatedat`,
      args: [o.itemid, o.articleno || '', o.colourname || '', o.contrastname || '', o.sizename || '',
        o.solddate || '', o.cashmemono || '', o.purchasedate || '', o.soldreturndate || '',
        o.suppliername || '', now]
    }));
    await db.batch(batch, 'write');
    console.log('Upserted', Math.min(i + CHUNK, rows.length), '/', rows.length);
  }
  console.log('DONE. item_details now has the latest data.');
}

run().catch(e => { console.error('SYNC FAILED:', e.message); process.exit(1); });
