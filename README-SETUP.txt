SHAKARAMBHAM WEBSITE – LANGUAGE DOWNLOAD + YOUTUBE SUBSCRIPTION GATE

1. Keep the existing assets folder exactly as it is.
2. Replace the restored home file with index.html.
3. Add read.html, read.js, subscribe.html and app.js.
4. Keep styles.css and its existing visual layout. The only appended CSS changes are for the two-card download controls.
5. The download selector supports Telugu, English, Hindi, Tamil and Kannada.
6. IMPORTANT: this package does NOT invent the four missing language PDFs. Put the real files in assets/ with these exact names:
   - Shakarambham-Telugu.pdf
   - Shakarambham-English.pdf
   - Shakarambham-Hindi.pdf
   - Shakarambham-Tamil.pdf
   - Shakarambham-Kannada.pdf
   The supplied conversation currently contains only Shakarambham-merged.pdf, so the five real language editions were not available to package.
7. For REAL subscription enforcement, the PDF files must NOT be publicly accessible in assets/. Move them outside the public web root and serve them from a server endpoint only after YouTube OAuth verification.
8. The YouTube channel used is:
   https://www.youtube.com/channel/UCT6nDBzL6iwljJscE3iEYlg
9. A browser-only JavaScript check cannot securely verify a YouTube subscription. The production implementation must use Google/YouTube OAuth and YouTube Data API subscriptions.list with the authenticated user's account, then return a protected PDF stream/download only when the subscription is verified.
10. Updated flow: subscribe.html opens the YouTube channel in a new tab. The website watches for the visitor to leave the page and automatically starts the Google/YouTube OAuth verification when the visitor returns. There is no separate Verify Subscription button. If verification succeeds, subscribe.html?verified=1 is shown and the Download PDF button appears. The PDF is not downloaded automatically.

11. Real OAuth setup:
   - Create a Google Cloud project and enable YouTube Data API v3.
   - Create an OAuth 2.0 Web application client.
   - Add http://localhost:5500/auth/youtube as the authorized redirect URI for local testing.
   - Set environment variables GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET.
   - Run: npm install
   - Run: npm start
12. Put the five real PDFs in private-pdfs/ (NOT assets/). The server will return a PDF only after the authenticated YouTube account is verified as subscribed.
13. The browser cannot make the subscription decision by itself. The server uses the authenticated Google account and YouTube Data API for the check.


Important: YouTube itself does not send a direct callback to an external website when the Subscribe button is pressed. The website therefore keeps the subscription page open, opens YouTube in a new tab, detects when the visitor returns, and automatically begins OAuth verification. The actual subscription decision is made server-side through the authenticated YouTube account.


LOCAL 404 FIX
--------------
If clicking Subscribe sends you to http://localhost:5500/auth/youtube and shows a plain "Error response / 404 File not found", you are running a static server (such as VS Code Live Server/python http.server). That server cannot execute server.js routes.

Do this instead:
1. Stop Live Server.
2. Put the project folder on your computer.
3. Copy .env.example to .env and fill in the Google OAuth values.
4. Run start.bat, or run `npm install` and then `npm start`.
5. Open http://localhost:5500/ in the browser.
6. Test http://localhost:5500/health — it should show JSON with ok:true.

Do not open index.html directly and do not use a static Live Server port for the final subscription flow.
