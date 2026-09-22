# Push Notifications — One-Time Setup

This adds real device notifications for new chat messages and announcements —
including when the app/APK is closed, not just while it's open. Two things
need to be configured once. Everything else (the buttons, the bell icon, the
banner) already works in the code.

## What was added to your project

- `index.html` — updated with:
  - A "🔔 Enable" bell button in the chat header, and a dismissible banner
    inviting users to turn notifications on.
  - Firebase Cloud Messaging wired up: requests permission, saves each
    device's push token to Firestore (`artifacts/{appId}/public/data/fcmTokens`),
    and shows an in-app toast for messages that arrive while the app is open.
  - Posting an announcement, or sending a chat message (general room, class
    chat, section chat, or a DM), now calls `/api/send-push` so the right
    people get notified.
- `firebase-messaging-sw.js` — **must sit at the site root**, next to
  `index.html`. This is what shows the notification when the app is closed.
- `api/send-push.js` — a Vercel serverless function that actually asks
  Firebase to deliver the notification (the browser can never be trusted
  with the credentials to do this directly).
- `package.json` — declares the `firebase-admin` dependency the function
  above needs. If you already have a `package.json` in the repo, just add
  `"firebase-admin": "^12.7.0"` to its `dependencies` instead of replacing
  the whole file.

## Step 1 — Generate a Web Push VAPID key (2 minutes)

1. Go to the [Firebase Console](https://console.firebase.google.com/) →
   select your **pumma-competency-dashboard** project.
2. Click the ⚙️ gear → **Project settings** → **Cloud Messaging** tab.
3. Scroll to **Web configuration** → **Web Push certificates** →
   **Generate key pair**.
4. Copy the long key it gives you.
5. Open `index.html`, find this line (search for `PASTE_YOUR_VAPID_KEY_HERE`):
   ```js
   const FCM_VAPID_KEY = "PASTE_YOUR_VAPID_KEY_HERE";
   ```
   and paste your key in between the quotes.

## Step 2 — Generate a Firebase service account key (2 minutes)

1. Still in **Project settings**, go to the **Service accounts** tab.
2. Click **Generate new private key** → confirm. A `.json` file downloads.
3. Open that file in a text editor and copy its **entire contents**
   (it starts with `{"type": "service_account", ...}`).

## Step 3 — Add it to Vercel (2 minutes)

1. Go to your project on [vercel.com](https://vercel.com/) →
   **Settings** → **Environment Variables**.
2. Add a new variable:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value:** paste the entire JSON you copied in Step 2.
   - Environment: Production (and Preview, if you want it there too).
3. Save, then redeploy the project (push any commit, or use Vercel's
   "Redeploy" button) so the new environment variable takes effect.

## Step 4 — Push the files to GitHub

Commit and push `index.html`, `firebase-messaging-sw.js`, `api/send-push.js`,
and `package.json` (or your merged one) to your repo the same way you
normally do — Vercel will redeploy automatically.

## Step 5 — Rebuild the APK

Because this project is a PWA, the notifications will work correctly in an
APK **only if the APK is built as a Trusted Web Activity (TWA)** — this is
what [PWABuilder](https://www.pwabuilder.com/) produces when you feed it
your live Vercel URL. A TWA is literally Chrome running your site full-screen,
so it gets full, real Android push notifications, an app icon, and a splash
screen — all for free, no native code needed.

If the APK was instead made with a generic "put my website in a WebView"
tool that isn't TWA-based, push notifications typically will **not** reach
the system tray while the app is closed, even though everything above is
set up correctly. If you're not sure how your current APK was built, rebuild
it with PWABuilder — it's free, a few clicks, and is the standard way to
turn a PWA like this into a real Play Store-ready app.

## Testing it

1. Open the live site (not localhost — push notifications need HTTPS) on a
   phone or in Chrome desktop.
2. Log in, open the chat, tap the bell icon → allow notifications when
   prompted.
3. From another browser/device, post an announcement or send a chat message.
4. You should see a system notification pop up within a few seconds — even
   if you close the tab/app first.

## Notes on scope

- Announcements notify **everyone** with notifications enabled.
- The general Ship's Comms chat also notifies everyone; class chat and
  section chat notify only members of that class/section; DMs notify only
  the other person.
- The sender never gets notified about their own message/announcement.
- If a device's push token goes stale (uninstalled app, cleared data), it's
  automatically cleaned out of Firestore the next time a push is sent.
