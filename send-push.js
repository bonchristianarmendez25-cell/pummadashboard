// api/send-push.js
// Vercel serverless function (Node.js). Deploy path: /api/send-push
//
// The browser can never be trusted to send push notifications directly —
// that would require exposing a secret key to every visitor. So the
// dashboard's client-side code just calls this endpoint, and THIS code
// (running privately on Vercel's servers) looks up who should be notified
// and asks Firebase Cloud Messaging to actually deliver it.
//
// ─── ONE-TIME SETUP (see NOTIFICATIONS-SETUP.md for full steps) ───
// 1. Firebase Console → Project settings → Service accounts → Generate new
//    private key. This downloads a JSON file.
// 2. In Vercel → your project → Settings → Environment Variables, add:
//      FIREBASE_SERVICE_ACCOUNT_KEY = <paste the ENTIRE JSON file contents>
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
    const tokensSnap = await db
      .collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('fcmTokens')
      .get();

    let audienceKind = 'all';
    let audienceValue = null;
    if (audience !== 'all') {
      const [kind, ...rest] = String(audience).split(':');
      audienceKind = kind;
      audienceValue = rest.join(':');
    }

    const tokens = [];
    tokensSnap.forEach((docSnap) => {
      const t = docSnap.data();
      if (!t?.token) return;
      if (excludeUserId && t.userId === excludeUserId) return; // don't notify the sender
      if (audienceKind === 'all') { tokens.push(t.token); return; }
      if (audienceKind === 'class' && String(t.classNum ?? '') === audienceValue) { tokens.push(t.token); return; }
      if (audienceKind === 'section' && String(t.section || '').toUpperCase() === audienceValue.toUpperCase()) { tokens.push(t.token); return; }
      if (audienceKind === 'dm' && t.userId === audienceValue) { tokens.push(t.token); return; }
    });

    const uniqueTokens = [...new Set(tokens)].slice(0, 500); // FCM multicast hard limit is 500
    if (uniqueTokens.length === 0) {
      res.status(200).json({ sent: 0, note: 'No matching, registered devices for this audience.' });
      return;
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title: String(title).slice(0, 120), body: String(body).slice(0, 300) },
      webpush: {
        fcmOptions: { link: '/' },
        notification: { icon: '/MOCKBOAT%20LOGO.png' }
      }
    });

    // Housekeeping: prune tokens FCM says are dead (uninstalled app,
    // cleared browser data, etc.) so the audience list stays accurate.
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

    res.status(200).json({ sent: response.successCount, failed: response.failureCount, pruned: deadTokens.length });
  } catch (err) {
    console.error('send-push error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
