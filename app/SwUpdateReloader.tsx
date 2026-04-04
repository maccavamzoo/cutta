"use client";
import { useEffect } from "react";

// When a new service worker activates and claims this client, reload so the
// page is fetched fresh through the new SW (NetworkOnly for navigation).
export default function SwUpdateReloader() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);
  return null;
}
