const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 5500);
const CHANNEL_ID = 'UCT6nDBzL6iwljJscE3iEYlg';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const LANG_FILES = {
  te: 'Shakarambham-merged.pdf',
  en: 'Shakarambham-English.pdf',
  hi: 'Shakarambham-Hindi.pdf',
  ta: 'Shakarambham-Tamil.pdf',
  kn: 'Shakarambham-Kannada.pdf'
};

const PRIVATE_DIR = path.join(__dirname, 'private-pdfs');

if (process.env.NODE_ENV === 'production') {
  const required = ['SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
  }
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(express.json({ limit: '100kb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'LOCAL_ONLY_CHANGE_THIS_SECRET',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 1000
  }
}));

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/youtube`
  );
}

function safeLang(value) {
  const lang = String(value || '').toLowerCase();
  return LANG_FILES[lang] ? lang : null;
}

/*
 * Only expose the files that are intended to be public.
 * Do NOT expose __dirname as a static root: private-pdfs, server.js,
 * package files and deployment documents must never be public.
 */
const PUBLIC_FILES = [
  'index.html',
  'about.html',
  'author.html',
  'contact.html',
  'read.html',
  'subscribe.html',
  'styles.css',
  'app.js',
  'read.js'
];

for (const file of PUBLIC_FILES) {
  app.get(`/${file}`, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  index: false,
  dotfiles: 'deny',
  maxAge: '7d'
}));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'shakarambham-subscription-gate' });
});

/*
 * Start/complete Google OAuth.
 * The random state is stored in the user's session to prevent OAuth CSRF.
 */
app.get('/auth/youtube', async (req, res) => {
  try {
    if (req.query.error) {
      return res.redirect('/subscribe.html?lang=' +
        encodeURIComponent(req.session.downloadLang || 'te') +
        '&verified=0');
    }

    if (req.query.code) {
      const expectedState = req.session.oauthState;
      const receivedState = String(req.query.state || '');

      delete req.session.oauthState;

      if (!expectedState || !receivedState ||
          !crypto.timingSafeEqual(
            Buffer.from(expectedState),
            Buffer.from(receivedState)
          )) {
        return res.status(400).send('Invalid OAuth state. Please start verification again.');
      }

      const lang = safeLang(req.session.downloadLang);
      if (!lang) {
        return res.status(400).send('Invalid verification request.');
      }

      const client = oauthClient();
      const { tokens } = await client.getToken(String(req.query.code));
      client.setCredentials(tokens);

      const youtube = google.youtube({ version: 'v3', auth: client });
      const result = await youtube.subscriptions.list({
        part: ['snippet'],
        mine: true,
        forChannelId: CHANNEL_ID,
        maxResults: 1
      });

      const subscribed =
        Array.isArray(result.data.items) &&
        result.data.items.length > 0;

      if (!subscribed) {
        req.session.verifiedLang = null;
        return res.redirect(
          '/subscribe.html?lang=' + encodeURIComponent(lang) + '&verified=0'
        );
      }

      req.session.verifiedLang = lang;

      return res.redirect(
        '/subscribe.html?lang=' + encodeURIComponent(lang) + '&verified=1'
      );
    }

    const lang = safeLang(req.query.lang);
    if (!lang) {
      return res.status(400).send('Invalid language.');
    }

    req.session.downloadLang = lang;
    req.session.verifiedLang = null;

    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;

    const client = oauthClient();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
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
      return res.status(503).send(
        'YouTube verification is unavailable. Please make sure YouTube Data API v3 is enabled for the Google Cloud project.'
      );
    }

    if (status === 400) {
      return res.status(500).send(
        'YouTube verification could not be completed. Check the Google OAuth redirect URI and OAuth client configuration.'
      );
    }

    return res.status(500).send(
      'YouTube verification could not be completed. Please try again.'
    );
  }
});

app.get('/download/:lang', (req, res) => {
  const lang = safeLang(req.params.lang);

  if (!lang) {
    return res.status(400).send('Invalid language.');
  }

  if (req.session.verifiedLang !== lang) {
    return res.status(403).send(
      'Please complete YouTube subscription verification first.'
    );
  }

  const fileName = LANG_FILES[lang];
  const filePath = path.join(PRIVATE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(
      `The ${lang} language PDF is not installed on the server yet.`
    );
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return fs.createReadStream(filePath).pipe(res);
});

app.get('/read-pdf/:lang', (req, res) => {
  const lang = safeLang(req.params.lang);

  if (!lang) {
    return res.status(400).send('Invalid language.');
  }

  const filePath = path.join(PRIVATE_DIR, LANG_FILES[lang]);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('PDF not installed.');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return fs.createReadStream(filePath).pipe(res);
});

app.use((req, res) => {
  res.status(404).send('Page not found.');
});

app.listen(PORT, () => {
  console.log(`Shakarambham server running on port ${PORT}`);
});
