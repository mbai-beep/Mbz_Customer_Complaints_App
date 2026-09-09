/* POST /api/forgot  — 3-step OTP password reset.
   actions:
     sendOtp      { storecode, mobile }            -> verify mobile, issue OTP (demo: returned)
     verifyOtp    { storecode, otp }               -> check OTP
     resetPassword{ storecode, otp, newPassword }  -> apply rules, set password (60-day expiry) */
const { query, ensureUsersTable, getUser, storeInfo, roleFor } = require('../lib/users');

const OTP_TTL_MIN = 5;
const EXPIRY_DAYS = 60;

async function checkOtp(code, otp) {
  const r = await query('SELECT * FROM otp_codes WHERE storecode = ?', [code]);
  const row = r.rows[0];
  if (!row) return 'No OTP requested. Please Send OTP again.';
  if (Date.now() > Date.parse(row.expiresat)) return 'OTP expired. Please Send OTP again.';
  if (String(row.otp) !== String(otp).trim()) return 'Incorrect OTP.';
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = req.body || {};
  const code = String(b.storecode || '').trim();
  if (!code) return res.json({ ok: false, error: 'Employee/Store ID required' });
  try {
    await ensureUsersTable();

    if (b.action === 'sendOtp') {
      const info = await storeInfo(code);
      if (!info) return res.json({ ok: false, error: 'Employee/Store ID not found.' });
      const given = String(b.mobile || '').replace(/\D/g, '');
      if (!info.mobile) return res.json({ ok: false, error: 'No mobile number on record for this ID. Contact admin.' });
      if (given !== info.mobile) return res.json({ ok: false, error: 'Mobile number does not match our records.' });
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresat = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();
      await query(`INSERT INTO otp_codes (storecode,otp,expiresat) VALUES (?,?,?)
        ON CONFLICT(storecode) DO UPDATE SET otp=excluded.otp, expiresat=excluded.expiresat`, [code, otp, expiresat]);
      // SMS gateway not configured -> demo mode returns the OTP so it can be shown on screen
      return res.json({ ok: true, demo: true, otp });
    }

    if (b.action === 'verifyOtp') {
      const err = await checkOtp(code, b.otp);
      if (err) return res.json({ ok: false, error: err });
      return res.json({ ok: true });
    }

    if (b.action === 'resetPassword') {
      const err = await checkOtp(code, b.otp);
      if (err) return res.json({ ok: false, error: err });
      const np = String(b.newPassword || '');
      if (np.length < 6) return res.json({ ok: false, error: 'Password must be at least 6 characters.' });

      const u = await getUser(code);
      const current = u ? u.password : ('MBZ' + code);
      let hist = [];
      try { hist = u && u.passwordhistory ? JSON.parse(u.passwordhistory) : []; } catch (_) {}
      const recent = [current, ...hist].filter(Boolean);
      if (recent.slice(0, 3).includes(np)) return res.json({ ok: false, error: 'Cannot match any of your last 3 passwords.' });

      const newHist = [current, ...hist].filter(Boolean).slice(0, 3);
      const expiry = new Date(Date.now() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString();
      const now = new Date().toISOString();
      const role = (await storeInfo(code))?.role || roleFor(code);
      if (u) {
        await query('UPDATE users SET password=?, passwordhistory=?, passwordexpiry=?, enabled=?, updatedat=? WHERE storecode=?',
          [np, JSON.stringify(newHist), expiry, '1', now, code]);
      } else {
        await query(`INSERT INTO users (storecode,password,role,enabled,passwordhistory,passwordexpiry,updatedat)
          VALUES (?,?,?,?,?,?,?)`, [code, np, role, '1', JSON.stringify(newHist), expiry, now]);
      }
      await query('DELETE FROM otp_codes WHERE storecode = ?', [code]);
      return res.json({ ok: true });
    }

    return res.json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
