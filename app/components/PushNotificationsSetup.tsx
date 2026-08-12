"use client";

import { Bell, BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/supabase";

type SetupStatus =
  | "checking"
  | "unsupported"
  | "blocked"
  | "disabled"
  | "enabled"
  | "working";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) => character.charCodeAt(0))
  );
}

export default function PushNotificationsSetup() {
  const [status, setStatus] =
    useState<SetupStatus>("checking");
  const [message, setMessage] = useState("");
  const [subscription, setSubscription] =
    useState<PushSubscription | null>(null);

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";

  useEffect(() => {
    void inspectCurrentState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function inspectCurrentState() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }

    try {
      const registration =
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

      await navigator.serviceWorker.ready;

      const existing =
        await registration.pushManager.getSubscription();

      setSubscription(existing);
      setStatus(existing ? "enabled" : "disabled");

      if (existing) {
        await saveSubscription(existing);
      }
    } catch (error) {
      setStatus("disabled");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to initialize notifications."
      );
    }
  }

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    if (!session?.access_token) {
      throw new Error("Please sign in again.");
    }

    return session.access_token;
  }

  async function saveSubscription(
    value: PushSubscription
  ) {
    const accessToken = await getAccessToken();

    const response = await fetch(
      "/api/notifications/subscribe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subscription: value.toJSON(),
          userAgent: navigator.userAgent,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to save push subscription."
      );
    }
  }

  async function enableNotifications() {
    if (!vapidPublicKey) {
      setMessage(
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing in .env.local."
      );
      return;
    }

    setStatus("working");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(
          permission === "denied" ? "blocked" : "disabled"
        );
        return;
      }

      const registration =
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

      await navigator.serviceWorker.ready;

      const existing =
        await registration.pushManager.getSubscription();

      const created =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidPublicKey),
        }));

      await saveSubscription(created);

      setSubscription(created);
      setStatus("enabled");
      setMessage(
        "Push notifications are enabled on this device."
      );
    } catch (error) {
      setStatus("disabled");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable push notifications."
      );
    }
  }

  async function disableNotifications() {
    if (!subscription) return;

    setStatus("working");
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const endpoint = subscription.endpoint;

      await subscription.unsubscribe();

      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint }),
      });

      setSubscription(null);
      setStatus("disabled");
      setMessage(
        "Push notifications are disabled on this device."
      );
    } catch (error) {
      setStatus("enabled");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to disable notifications."
      );
    }
  }

  async function sendTestNotification() {
    setStatus("working");
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      const response = await fetch(
        "/api/notifications/test",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to send test notification."
        );
      }

      setStatus("enabled");
      setMessage(data.message || "Test notification sent.");
    } catch (error) {
      setStatus("enabled");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send test notification."
      );
    }
  }

  const blocked = status === "blocked";
  const enabled = status === "enabled";

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0c1224] p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
              enabled
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-blue-400/15 text-blue-300"
            }`}
          >
            {enabled ? (
              <CheckCircle2 size={22} />
            ) : (
              <Bell size={22} />
            )}
          </div>

          <div>
            <h3 className="text-lg font-black">
              Browser Push Notifications
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Receive document expiry, service, challan, SOS and
              Mira alerts even when My Vehicle is not open.
            </p>

            <p className="mt-3 text-xs font-bold text-slate-400">
              Status:{" "}
              {status === "checking"
                ? "Checking"
                : status === "working"
                  ? "Working"
                  : status === "unsupported"
                    ? "Not supported"
                    : status === "blocked"
                      ? "Blocked by browser"
                      : enabled
                        ? "Enabled"
                        : "Disabled"}
            </p>

            {message ? (
              <p className="mt-2 text-xs leading-5 text-amber-300">
                {message}
              </p>
            ) : null}

            {blocked ? (
              <p className="mt-2 text-xs text-rose-300">
                Open browser site settings and allow notifications
                for this website.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "checking" || status === "working" ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-400"
            >
              <Loader2 size={17} className="animate-spin" />
              Please wait
            </button>
          ) : enabled ? (
            <>
              <button
                type="button"
                onClick={() => void sendTestNotification()}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
              >
                Send Test
              </button>

              <button
                type="button"
                onClick={() => void disableNotifications()}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200"
              >
                <BellOff size={17} />
                Disable
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enableNotifications()}
              disabled={blocked || status === "unsupported"}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Bell size={17} />
              Enable Notifications
            </button>
          )}
        </div>
      </div>
    </section>
  );
}