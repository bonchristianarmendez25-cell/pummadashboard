// api/telegram-webhook.js
// Vercel serverless function (Node.js). Deploy path: /api/telegram-webhook
//
// Telegram calls this URL every time someone messages your bot. We only
// care about the /start command, which fires when a cadet taps the
// "Connect Telegram" deep link from inside the dashboard — that link
// carries their dashboard userId as a payload, e.g.:
//   https://t.me/YourBotUsername?start=abc123
// which Telegram turns into the message text "/start abc123".
//
// ─── ONE-TIME SETUP (see NOTIFICATIONS-SETUP.md) ───
// 1. Message @BotFather on Telegram, send /newbot, follow the prompts.
//    You'll get a bot token like 123456789:AAExampleTokenAbcDef
// 2. In Vercel → Settings → Environment Variables, add:
//      TELEGRAM_BOT_TOKEN = <that token>
// 3. After deploying, register this URL as your bot's webhook by visiting
//    (once, in any browser):
//      https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://pummadashboard.vercel.app/api/telegram-webhook
//    You should see {"ok":true,"result":true,...}

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const APP_ID = 'pumma-2026-production';

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  const serviceAccount = JSON.parse(raw);
  initializeApp({ credential: cert(serviceAccount) });
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  }).catch(() => {});
}

module.exports = async (req, res) => {
  // Always respond 200 quickly — Telegram retries aggressively on non-200s,
  // and we never want a bad update to cause a retry storm.
  try {
    if (req.method !== 'POST') { res.status(200).json({ ok: true }); return; }
    initAdmin();

    const update = req.body || {};
    const msg = update.message;
    if (!msg || !msg.text) { res.status(200).json({ ok: true }); return; }

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!text.startsWith('/start')) { res.status(200).json({ ok: true }); return; }

    const parts = text.split(' ');
    const userId = parts[1] || null;

    if (!userId) {
      await sendTelegramMessage(chatId,
        "👋 Welcome to <b>PUMMA Dashboard</b> notifications!\n\n" +
        "To link your account, open the dashboard, go to chat, and tap the " +
        "\"Connect Telegram\" button — that gives you the correct link to start this bot with."
      );
      res.status(200).json({ ok: true });
      return;
    }

    const db = getFirestore();

    // Try to enrich with the cadet's class/section so class/section-only
    // broadcasts can reach them correctly, same as the FCM token records.
    let role = 'cadet', classNum = null, section = null, name = 'Unknown';
    try {
      const cadetSnap = await db.collection('artifacts').doc(APP_ID)
        .collection('public').doc('data').collection('cadets').doc(userId).get();
      if (cadetSnap.exists) {
        const c = cadetSnap.data();
        classNum = c.classNum ?? null;
        section = (c.section || '').toUpperCase() || null;
        name = c.name || name;
      } else {
        role = 'staff'; // not found as a cadet — likely an instructor/admin account
      }
    } catch (e) { /* enrichment is best-effort, ignore failures */ }

    await db.collection('artifacts').doc(APP_ID).collection('public').doc('data')
      .collection('telegramChats').doc(String(chatId)).set({
        chatId: String(chatId),
        userId, role, classNum, section, name,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

    await sendTelegramMessage(chatId,
      "✅ <b>You're connected!</b>\n\nYou'll now get PUMMA Dashboard chat and announcement alerts right here."
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('telegram-webhook error:', err);
    res.status(200).json({ ok: true });
  }
};
