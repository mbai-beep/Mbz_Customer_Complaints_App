/* GET /api/image?id=<driveFileId>
   Streams the actual Drive file bytes via the service account, so images render
   correctly and reliably regardless of per-file public-sharing state or Google's
   thumbnail CDN (which can serve a stale/wrong image for some files). */
const { driveClient } = require('../lib/google');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '').trim();
  if (!id || !/^[-\w]{10,}$/.test(id)) { res.status(400).end(); return; }
  try {
    const drive = await driveClient();
    // Uploads are always JPEG (client compresses to image/jpeg), so skip the
    // extra metadata lookup for speed.
    const r = await drive.files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    const buf = Buffer.from(r.data);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch (e) {
    res.status(404).end();
  }
};
