import {isNativeApp} from "../native/platform.js";
let registration;
export async function initializeOffline() {
  if(isNativeApp())return null;
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  if (!registration) {
    registration = navigator.serviceWorker.register("/ayah-offline-sw.js", {
      scope: "/",
    }).catch((e) => {
      registration = null;
      throw e;
    });
  }
  return registration;
}
export async function prepareOfflineShell() {
  if(isNativeApp())return; // Frontend, fonts and verified free audio ship in the app.
  const registration = await initializeOffline();
  if (!registration) {
    throw Error("Offline reloads require HTTPS and service worker support.");
  }
  await navigator.serviceWorker.ready;
  const worker = registration.active || registration.waiting ||
    registration.installing;
  if (!worker) {
    throw Error("Offline app worker is unavailable. Reload and retry.");
  }
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel(),
      timer = setTimeout(
        () =>
          reject(
            Error("Offline app download timed out. Retry when connected."),
          ),
        120000,
      );
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      channel.port1.close();
      e.data.ok ? resolve() : reject(Error(e.data.error));
    };
    worker.postMessage({ type: "PREPARE_FREE_SHELL" }, [channel.port2]);
  });
}
