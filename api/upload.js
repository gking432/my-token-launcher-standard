const { put } = require('@vercel/blob');

const MAX_BYTES = 512 * 1024; // 512KB server-side guard

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, contentType, data } = req.body || {};
  if (!filename || !contentType || !data) {
    return res.status(400).json({ error: 'Missing filename, contentType, or data' });
  }
  if (!contentType.startsWith('image/')) {
    return res.status(400).json({ error: 'Only image uploads allowed' });
  }

  const buffer = Buffer.from(data, 'base64');
  if (buffer.byteLength > MAX_BYTES) {
    return res.status(413).json({ error: 'Image exceeds 512KB limit' });
  }

  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const pathname = `token-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const blob = await put(pathname, buffer, { access: 'public', contentType });
    return res.json({ url: blob.url });
  } catch (err) {
    console.error('[upload] Vercel Blob put failed:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
};
