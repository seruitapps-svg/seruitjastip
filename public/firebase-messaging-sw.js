/* eslint-disable no-restricted-globals */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const queryConfig = Object.fromEntries(params.entries());
const firebaseConfig = {
  apiKey: queryConfig.apiKey || "AIzaSyAuRDJSTHaKdJFsTHobXbqFaPy4D2IKMYA",
  projectId: queryConfig.projectId || "mider-web",
  appId: queryConfig.appId || "1:803891035138:web:0b61998d8469b9d1c57b1b",
  messagingSenderId: queryConfig.messagingSenderId || "803891035138",
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const urgent = data.event_type === "order_created" || data.event_type === "merchant_order_ready";
    const title = payload.notification?.title || data.title || "Mider Jastip";
    const options = {
      body: payload.notification?.body || data.body || "Ada pembaruan pesanan.",
      icon: "/favicon.ico",
      tag: (data.event_type || "evt") + "-" + (data.order_id || "mider"),
      renotify: true,
      silent: false,
      requireInteraction: urgent,
      vibrate: urgent ? [500, 200, 500, 200, 800] : [200, 100, 200],
      timestamp: Date.now(),
      data: { url: data.url || (data.order_id ? "/pesanan/" + data.order_id : "/") },
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
