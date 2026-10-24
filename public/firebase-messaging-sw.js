/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

let firebaseLoaded = true;
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
} catch (error) {
  firebaseLoaded = false;
  console.error("Gagal memuat Firebase di service worker:", error);
}

const params = new URL(self.location.href).searchParams;
const queryConfig = Object.fromEntries(params.entries());
const firebaseConfig = {
  apiKey: queryConfig.apiKey || "AIzaSyAuRDJSTHaKdJFsTHobXbqFaPy4D2IKMYA",
  projectId: queryConfig.projectId || "mider-web",
  appId: queryConfig.appId || "1:803891035138:web:0b61998d8469b9d1c57b1b",
  messagingSenderId: queryConfig.messagingSenderId || "803891035138",
};

const URGENT = new Set(["order_created", "merchant_order_ready"]);

function tagFor(data) {
  return (data.event_type || "evt") + "-" + (data.order_id || "mider");
}

function buildNotification(data, notification) {
  const urgent = URGENT.has(data.event_type);
  const title = (notification && notification.title) || data.title || "Mider Jastip";
  const options = {
    body: (notification && notification.body) || data.body || "Ada pembaruan pesanan.",
    icon: "/pwa-192.png",
    badge: "/pwa-badge-96.png",
    tag: tagFor(data),
    renotify: true,
    requireInteraction: urgent,
    vibrate: urgent ? [500, 200, 500, 200, 800] : [200, 100, 200],
    timestamp: Date.now(),
    data: { url: data.url || (data.order_id ? "/pesanan/" + data.order_id : "/") },
  };
  return { title, options };
}

if (firebaseLoaded) {
  try {
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      firebase.initializeApp(firebaseConfig);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const data = payload.data || {};
        const { title, options } = buildNotification(data, payload.notification);
        return self.registration.showNotification(title, options);
      });
    }
  } catch (error) {
    console.error("Inisialisasi Firebase Messaging gagal:", error);
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data ? event.data.json() : {};
      } catch (error) {
        return;
      }
      const data = payload.data || {};
      if (!data.title && !data.body && !payload.notification) return;

      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === "visible")) return;

      if (firebaseLoaded) await new Promise((resolve) => setTimeout(resolve, 1000));

      const existing = await self.registration.getNotifications({ tag: tagFor(data) });
      if (existing.length > 0) return;

      const { title, options } = buildNotification(data, payload.notification);
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          try {
            if ("navigate" in client) await client.navigate(targetUrl);
          } catch (error) {
            /* tetap fokuskan jendela */
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
