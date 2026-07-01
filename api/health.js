/* GET /api/health  — diagnostic. Visit https://<your-app>/api/health
   Reports whether env vars are set and whether the Turso table is reachable.
   Does NOT reveal secret values. Remove this file once everything works. */
const { query } = require('../lib/turso');

module.exports = async (req, res) => {
  const out = {
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    hasSpreadsheetId: !!process.env.SPREADSHEET_ID,
    hasDriveFolderId: !!process.env.DRIVE_FOLDER_ID,
    hasGoogleCreds: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64)
  };
  try {
    const r = await query('SELECT COUNT(*) AS n FROM storecode_table');
    out.tursoTable = 'ok';
    out.storeCount = r.rows[0] ? r.rows[0].n : null;
    out.columns = r.cols;
    // show the first row's column names/values (helps confirm the code column)
    const sample = await query('SELECT * FROM storecode_table LIMIT 1');
    out.sampleColumns = sample.cols;
    out.sampleRow = sample.rows[0] || null;
  } catch (e) {
    out.tursoTable = 'ERROR: ' + e.message;
  }
  res.status(200).json(out);
};
