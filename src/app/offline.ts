import { showToast } from "../components/toast";

/** A day: an update prompt stays reachable long enough to be noticed. */
const UPDATE_TOAST_DURATION = 24 * 60 * 60 * 1000;

function offerUpdate(worker: ServiceWorker): void {
  showToast("È disponibile una nuova versione.", {
    actionLabel: "Aggiorna",
    duration: UPDATE_TOAST_DURATION,
    onAction: () => worker.postMessage("activate-update"),
  });
}

/**
 * Registers the service worker that makes the app work offline, and asks the
 * browser not to evict the data. Only in production builds: the development
 * server has no `sw.js` and must always serve fresh files.
 */
export function enableOfflineUse(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  // Best effort: installed web apps on iOS are already exempt from eviction.
  void navigator.storage?.persist?.().catch(() => undefined);

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");

      // A new version downloaded while an old one is in use waits for consent.
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });

      // Once the new version takes over, reload to run its files.
      let hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController) window.location.reload();
        hadController = true;
      });
    } catch {
      // Offline use is an enhancement: the app works without it.
    }
  });
}
