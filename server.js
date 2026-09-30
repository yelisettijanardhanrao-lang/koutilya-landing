const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5500;

const CHANNEL_ID = 'UCT6nDBzL6iwljJscE3iEYlg';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const LANG_FILES = {
  te: 'Shakarambham-merged.pdf',
  en: 'Shakarambham-English.pdf'
};

const PRIVATE_DIR = path.join(__dirname, 'private-pdfs');

app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE_THIS_SESSION_SECRET',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(express.static(__dirname, {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    else if (ext === '.js' || ext === '.mjs') res.setHeader('Content-Type', 'text/javascript; charset=UTF-8');
    else if (ext === '.css') res.setHeader('Content-Type', 'text/css; charset=UTF-8');
  }
}));

function oauthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/youtube`
  );
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'shakarambham-subscription-gate' });
});

app.get('/auth/youtube', async (req, res) => {
  try {
    if (req.query.code) {
      const code = String(req.query.code);
      const lang = req.session.downloadLang;

      if (!lang || !LANG_FILES[lang]) {
        return res.status(400).send('Invalid verification request.');
      }

      const client = oauthClient();
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      const youtube = google.youtube({ version: 'v3', auth: client });
      const result = await youtube.subscriptions.list({
        part: ['snippet'],
        mine: true,
        forChannelId: CHANNEL_ID,
        maxResults: 1
      });

      const subscribed = Array.isArray(result.data.items) && result.data.items.length > 0;

      if (!subscribed) {
        req.session.verifiedLang = null;
        return res.redirect('/subscribe.html?lang=' + encodeURIComponent(lang) + '&verified=0');
      }

      req.session.verifiedLang = lang;
      return res.redirect('/subscribe.html?lang=' + encodeURIComponent(lang) + '&verified=1');
    }

    const lang = String(req.query.lang || '').toLowerCase();

    if (!LANG_FILES[lang]) {
      return res.status(400).send('Invalid language.');
    }

    req.session.downloadLang = lang;

    const client = oauthClient();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [YOUTUBE_SCOPE]
    });

    return res.redirect(authUrl);
  } catch (err) {
    console.error('YouTube OAuth error:', {
      message: err?.message,
      code: err?.code,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data
    });

    const status = Number(err?.response?.status) || 500;

    if (status === 403) {
      return res.status(503).send('YouTube verification is unavailable. Please make sure YouTube Data API v3 is enabled for the Google Cloud project used by this website.');
    }

    if (status === 400) {
      return res.status(500).send('YouTube verification could not be completed. Check the Google OAuth redirect URI and OAuth client configuration.');
    }

    return res.status(500).send('YouTube verification could not be completed. Check the server logs for the exact error.');
  }
});

app.get('/download/:lang', (req, res) => {
  const lang = String(req.params.lang || '').toLowerCase();
  const fileName = LANG_FILES[lang];

  if (!fileName) {
    return res.status(400).send('Invalid language.');
  }

  if (req.session.verifiedLang !== lang) {
    return res.status(403).send('Please complete YouTube subscription verification first.');
  }

  const filePath = path.join(PRIVATE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`The ${lang} language PDF is not installed on the server yet.`);
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', String(fs.statSync(filePath).size));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return fs.createReadStream(filePath).on('error', err => {
    console.error('PDF download error:', err);
    if (!res.headersSent) res.status(500).send('PDF download failed.');
  }).pipe(res);
});

app.get('/read-pdf/:lang', (req, res) => {
  const lang = String(req.params.lang || '').toLowerCase();
  const fileName = LANG_FILES[lang];

  if (!fileName) {
    return res.status(400).send('Invalid language.');
  }

  const filePath = path.join(PRIVATE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('PDF not installed.');
  }

  const size = fs.statSync(filePath).size;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

  // Safari/iOS PDF viewer relies on HTTP byte-range requests for large PDFs.
  const range = req.headers.range;

  if (!range) {
    res.setHeader('Content-Length', String(size));
    return fs.createReadStream(filePath).pipe(res);
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`);
    return res.end();
  }

  let startByte = match[1] ? Number(match[1]) : 0;
  let endByte = match[2] ? Number(match[2]) : size - 1;

  if (!Number.isInteger(startByte) || !Number.isInteger(endByte) ||
      startByte < 0 || endByte < startByte || startByte >= size) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`);
    return res.end();
  }

  endByte = Math.min(endByte, size - 1);
  const chunkSize = endByte - startByte + 1;

  res.status(206);
  res.setHeader('Content-Range', `bytes ${startByte}-${endByte}/${size}`);
  res.setHeader('Content-Length', String(chunkSize));

  return fs.createReadStream(filePath, { start: startByte, end: endByte }).pipe(res);
});

app.head('/read-pdf/:lang', (req, res) => {
  const lang = String(req.params.lang || '').toLowerCase();
  const fileName = LANG_FILES[lang];
  if (!fileName) return res.status(400).end();

  const filePath = path.join(PRIVATE_DIR, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const size = fs.statSync(filePath).size;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', 'inline');
  return res.status(200).end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shakarambham server running at http://localhost:${PORT}`);
});
