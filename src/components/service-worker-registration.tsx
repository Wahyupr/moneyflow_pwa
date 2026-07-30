"use client";

import { useEffect } from "react";

export function shouldRegisterServiceWorker(nodeEnv: string | undefined, hasServiceWorker: boolean): boolean {
  return nodeEnv === "production" && hasServiceWorker;
}

export function isMoneyFlowCacheName(cacheName: string): boolean {
  return /^mf-(shell|static|api)-/.test(cacheName);
}

async function clearMoneyFlowServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js") || registration.scope === `${window.location.origin}/`)
      .map((registration) => registration.unregister())
  );

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter(isMoneyFlowCacheName).map((key) => caches.delete(key)));
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (shouldRegisterServiceWorker(process.env.NODE_ENV, "serviceWorker" in navigator)) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    } else if (process.env.NODE_ENV !== "production") {
      clearMoneyFlowServiceWorkers().catch(() => undefined);
    }
  }, []);

  return null;
}
