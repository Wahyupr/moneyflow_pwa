"use client";

/**
 * Manages Web Push subscription lifecycle for the current user/device.
 *
 * Usage: mount once in settings page. Renders a toggle button that:
 *  - Requests Notification permission if not yet granted
 *  - Subscribes the device and saves the subscription to the server
 *  - Or unsubscribes and removes it from the server
 */
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output.buffer as ArrayBuffer;
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function PushNotificationManager() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // On mount: check current state
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
    }).catch(() => undefined);
  }, []);

  async function subscribe() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") {
        setStatusMsg("Izin notifikasi ditolak. Aktifkan di pengaturan browser.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const json = sub.toJSON();
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }
        })
      });

      if (res.ok) {
        setSubscribed(true);
        setStatusMsg("Notifikasi diaktifkan!");
      } else {
        setStatusMsg("Gagal menyimpan subscription. Coba lagi.");
      }
    } catch {
      setStatusMsg("Terjadi kesalahan saat mengaktifkan notifikasi.");
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatusMsg("Notifikasi dinonaktifkan.");
    } catch {
      setStatusMsg("Gagal menonaktifkan notifikasi.");
    } finally {
      setLoading(false);
    }
  }

  if (permission === "unsupported" || !VAPID_PUBLIC_KEY) {
    return (
      <p className="text-sm text-muted">
        Push notification tidak didukung di browser/perangkat ini.
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-sm text-muted">
        Izin notifikasi diblokir. Aktifkan secara manual di pengaturan browser.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold shadow-card transition active:scale-[0.98] disabled:opacity-60 ${
          subscribed
            ? "bg-surface-container text-ink"
            : "bg-primary text-white"
        }`}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : subscribed ? (
          <BellOff size={18} />
        ) : (
          <Bell size={18} />
        )}
        {loading
          ? "Memproses..."
          : subscribed
            ? "Nonaktifkan Notifikasi"
            : "Aktifkan Notifikasi"}
      </button>
      {statusMsg ? (
        <p className="text-sm font-medium text-primary">{statusMsg}</p>
      ) : null}
    </div>
  );
}
