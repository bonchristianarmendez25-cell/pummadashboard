// firebase-messaging-sw.js
// Must live at the SITE ROOT (same folder as index.html) — Firebase Cloud
// Messaging only looks for it at /firebase-messaging-sw.js.
//
// This is what lets a notification pop up in the Android notification tray
// even when the PUMMA Dashboard app/APK is fully closed or in the
// background. Without this file, "enable notifications" will still work
// while the app is open (foreground toast) but nothing will show up once
// the app is closed.

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// Same public Firebase config already used by index.html. These values are
// safe to expose client-side — they identify the project, they are not
// secret keys.
firebase.initializeApp({
  apiKey: "AIzaSyBtg153ugQ-TPWuPPQm280j8MnQ2Hz-s5I",
  authDomain: "pumma-competency-dashboard.firebaseapp.com",
  projectId: "pumma-competency-dashboard",
  storageBucket: "pumma-competency-dashboard.firebasestorage.app",
  messagingSenderId: "818515996308",
  appId: "1:818515996308:web:18e9ad670a788e580d0e81"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'PUMMA Dashboard';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/MOCKBOAT%20LOGO.png',
    badge: '/MOCKBOAT%20LOGO.png',
    tag: 'pumma-notification', // collapses rapid-fire notifications instead of spamming the tray
    renotify: true,
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

// Tapping the notification brings the app to the front (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
