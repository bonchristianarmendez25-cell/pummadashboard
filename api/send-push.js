// api/send-push.js
// Vercel serverless function (Node.js). Deploy path: /api/send-push
//
// The browser can never be trusted to send push notifications directly —
// that would require exposing a secret key to every visitor. So the
// dashboard's client-side code just calls this endpoint, and THIS code
// (running privately on Vercel's servers) looks up who should be notified
// and delivers to them over TWO channels:
//   1. Firebase Cloud Messaging (web push) — best-effort, browser dependent
//   2. Telegram — reliable fallback, works identically on every device
//
// ─── ONE-TIME SETUP (see NOTIFICATIONS-SETUP.md for full steps) ───
// 1. Firebase Console → Project settings → Service accounts → Generate new
//    private key. This downloads a JSON file.
// 2. In Vercel → your project → Settings → Environment Variables, add:
//      FIREBASE_SERVICE_ACCOUNT_KEY = <paste the ENTIRE JSON file contents>
//      TELEGRAM_BOT_TOKEN = <your bot token from @BotFather>
// 3. Redeploy. That's it — this file needs no other configuration.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  const serviceAccount = JSON.parse(raw);
  initializeApp({ credential: cert(serviceAccount) });
}

function matchesAudience(entry, audienceKind, audienceValue) {
  if (audienceKind === 'all') return true;
  if (audienceKind === 'admin') return entry.role === 'admin';
  if (audienceKind === 'alumni_general') return !!entry.isAlumni;
  if (audienceKind === 'alumni_batch') return !!entry.isAlumni && String(entry.alumniBatchYear || '') === audienceValue;
  if (audienceKind === 'class') return String(entry.classNum ?? '') === audienceValue;
  if (audienceKind === 'section') return String(entry.section || '').toUpperCase() === audienceValue.toUpperCase();
  if (audienceKind === 'dm') return entry.userId === audienceValue;
  return false;
}

async function sendTelegramBatch(db, appId, audienceKind, audienceValue, excludeUserId, title, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, failed: 0, note: 'TELEGRAM_BOT_TOKEN not set' };

  const snap = await db.collection('artifacts').doc(appId)
    .collection('public').doc('data').collection('telegramChats').get();

  const chatIds = [];
  snap.forEach((docSnap) => {
    const t = docSnap.data();
    if (!t?.chatId) return;
    if (excludeUserId && t.userId === excludeUserId) return;
    if (matchesAudience(t, audienceKind, audienceValue)) chatIds.push(t.chatId);
  });

  const uniqueChatIds = [...new Set(chatIds)];
  if (uniqueChatIds.length === 0) return { sent: 0, failed: 0 };

  const text = `<b>${escapeHtml(String(title).slice(0, 120))}</b>\n${escapeHtml(String(body).slice(0, 500))}`;

  let sent = 0, failed = 0;
  // Telegram has no multicast API — send one at a time, small delay-free
  // loop is fine at this scale (a few hundred cadets, at most).
  await Promise.all(uniqueChatIds.map(async (chatId) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) sent++; else failed++;
      // Clean up chats the bot got blocked from / that no longer exist
      if (!j.ok && (j.error_code === 403 || j.error_code === 400)) {
        await db.collection('artifacts').doc(appId).collection('public').doc('data')
          .collection('telegramChats').doc(String(chatId)).delete().catch(() => {});
      }
    } catch (e) { failed++; }
  }));

  return { sent, failed };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initAdmin();

    const { appId, audience, title, body, excludeUserId } = req.body || {};
    if (!appId || !audience || !title || !body) {
      res.status(400).json({ error: 'Missing required fields: appId, audience, title, body' });
      return;
    }

    const db = getFirestore();

    let audienceKind = 'all';
    let audienceValue = null;
    if (audience !== 'all') {
      const [kind, ...rest] = String(audience).split(':');
      audienceKind = kind;
      audienceValue = rest.join(':');
    }

    // ─── Channel 1: Firebase Cloud Messaging (web push) ───
    const tokensSnap = await db
      .collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('fcmTokens')
      .get();

    const tokens = [];
    tokensSnap.forEach((docSnap) => {
      const t = docSnap.data();
      if (!t?.token) return;
      if (excludeUserId && t.userId === excludeUserId) return; // don't notify the sender
      if (matchesAudience(t, audienceKind, audienceValue)) tokens.push(t.token);
    });

    const uniqueTokens = [...new Set(tokens)].slice(0, 500); // FCM multicast hard limit is 500

    let fcmResult = { sent: 0, failed: 0, pruned: 0 };
    if (uniqueTokens.length > 0) {
      const response = await getMessaging().sendEachForMulticast({
        tokens: uniqueTokens,
        notification: { title: String(title).slice(0, 120), body: String(body).slice(0, 300) },
        webpush: {
          fcmOptions: { link: '/' },
          notification: { icon: '/MOCKBOAT%20LOGO.png' }
        }
      });

      // Housekeeping: prune tokens FCM says are dead.
      const deadTokens = [];
      response.responses.forEach((r, i) => {
        const code = r.error?.code;
        if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
          deadTokens.push(uniqueTokens[i]);
        }
      });
      await Promise.all(deadTokens.map((t) =>
        db.collection('artifacts').doc(appId).collection('public').doc('data').collection('fcmTokens').doc(t).delete().catch(() => {})
      ));

      fcmResult = { sent: response.successCount, failed: response.failureCount, pruned: deadTokens.length };
    }

    // ─── Channel 2: Telegram ───
    const telegramResult = await sendTelegramBatch(db, appId, audienceKind, audienceValue, excludeUserId, title, body);

    res.status(200).json({ fcm: fcmResult, telegram: telegramResult });
  } catch (err) {
    console.error('send-push error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
