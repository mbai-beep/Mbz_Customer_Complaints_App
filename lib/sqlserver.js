/* SQL Server (zRetailHQ0) connection for on-demand item lookups from Vercel.
   Credentials come from environment variables (set in Vercel):
     SQL_SERVER, SQL_PORT, SQL_DATABASE, SQL_USER, SQL_PASSWORD
     SQL_ENCRYPT (optional "true"/"false"), SQL_TRUST (optional) */
const sql = require('mssql');

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({
      server: process.env.SQL_SERVER,
      port: Number(process.env.SQL_PORT) || 1433,
      database: process.env.SQL_DATABASE,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      connectionTimeout: 20000,
      requestTimeout: 30000,
      pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
      options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST !== 'false'
      }
    }).catch(e => { poolPromise = null; throw e; });
  }
  return poolPromise;
}
module.exports = { sql, getPool };
