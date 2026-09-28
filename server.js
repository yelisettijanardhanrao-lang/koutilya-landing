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

app.use(express.static(__dirname, { index: 'index.html' }));

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

  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  return fs.createReadStream(filePath).pipe(res);
});

app.listen(PORT, () => {
  console.log(`Shakarambham server running at http://localhost:${PORT}`);
});
