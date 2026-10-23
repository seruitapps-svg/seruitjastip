/* eslint-disable no-restricted-globals */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const queryConfig = Object.fromEntries(params.entries());

// Gunakan config dari URL atau fallback langsung ke project Mider
const firebaseConfig = {
  apiKey: queryConfig.apiKey || "AIzaSyAuRDJSTHaKdJFsTHobXbqFaPy4D2IKMYA",
  projectId: queryConfig.projectId || "mider-web",
  appId: queryConfig.appId || "1:803891035138:web:0b61998d8469b9d1c57b1b",
  messagingSenderId: queryConfig.messagingSenderId || "803891035138",
};

// Inisialisasi Firebase di Service Worker
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = payload.notification?.title || data.title || "Mider Jastip";
    const options = {
      body: payload.notification?.body || data.body || "Ada pembaruan pesanan.",
      icon: "/favicon.ico",
      tag: data.order_id || "mider-order",
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || (data.order_id ? `/pesanan/${data.order_id}` : "/"),
      },
    };
    return self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
