type OneSignalSdk = {
  init: (options: {
    appId: string;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
  }) => Promise<void>;
  Notifications: { requestPermission: () => Promise<unknown> };
  User: {
    PushSubscription: {
      optIn: () => Promise<unknown>;
      id?: string | null;
      optedIn?: boolean;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: OneSignalSdk) => void>;
    __miderOneSignalReady?: Promise<OneSignalSdk>;
  }
}

const ONESIGNAL_APP_ID = "1dc83317-d6c7-43ce-aa95-fdfff1ab2364";
const ONESIGNAL_SCRIPT_URL =
  "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

export function ensureOneSignalReady(): Promise<OneSignalSdk> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("OneSignal hanya dapat dijalankan di browser."));
  }

  if (window.__miderOneSignalReady) return window.__miderOneSignalReady;

  window.OneSignalDeferred = window.OneSignalDeferred || [];

  window.__miderOneSignalReady = new Promise<OneSignalSdk>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          "SDK OneSignal tidak merespons. Periksa koneksi internet dan pastikan skrip OneSignal tidak diblokir.",
        ),
      );
    }, 20000);

    window.OneSignalDeferred!.push(async (OneSignal) => {
      if (settled) return;
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/onesignal/" },
        });
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(OneSignal);
      } catch (error) {
        settled = true;
        window.clearTimeout(timeoutId);
        reject(error);
      }
    });

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="' + ONESIGNAL_SCRIPT_URL + '"]',
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = ONESIGNAL_SCRIPT_URL;
      script.defer = true;
      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        reject(
          new Error(
            "Skrip OneSignal gagal dimuat. Periksa koneksi internet atau pemblokir konten.",
          ),
        );
      };
      document.head.appendChild(script);
    }
  });

  // Allow a later retry if loading or initialization failed.
  window.__miderOneSignalReady.catch(() => {
    window.__miderOneSignalReady = undefined;
  });

  return window.__miderOneSignalReady;
}
