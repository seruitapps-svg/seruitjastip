/* Standard Web Push service worker for Mider. No Firebase SDK is used here. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const data = payload.data || {};
  const title = payload.title || "Mider Jastip";
  const options = {
    body: payload.body || "Ada pembaruan pesanan.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.event_type && data.order_id
      ? String(data.event_type) + "-" + String(data.order_id)
      : "mider-web-push",
    renotify: false,
    data: {
      url: payload.url || data.url || (data.order_id ? "/pesanan/" + data.order_id : "/"),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || "/";
  const targetUrl = new URL(requestedUrl, self.location.origin);
  if (targetUrl.origin !== self.location.origin) targetUrl.href = self.location.origin + "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.navigate(targetUrl.href);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl.href);
      return undefined;
    }),
  );
});
