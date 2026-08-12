"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type MiraMessage = {
  id: string;
  role: "user" | "mira";
  content: string;
  createdAt: string;
};

type InsuranceSettings = {
  language: string;
  voiceEnabled: boolean;
  proactiveAlerts: boolean;
  renewalReminders: boolean;
  claimUpdates: boolean;
  paymentAlerts: boolean;
  documentExpiryAlerts: boolean;
  fraudAlerts: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
};

const defaultSettings: InsuranceSettings = {
  language: "English",
  voiceEnabled: true,
  proactiveAlerts: true,
  renewalReminders: true,
  claimUpdates: true,
  paymentAlerts: true,
  documentExpiryAlerts: true,
  fraudAlerts: true,
  emailNotifications: true,
  smsNotifications: true,
  whatsappNotifications: false,
};

const quickPrompts = [
  "Explain my policy coverage",
  "Check my renewal status",
  "Help me register a claim",
  "Why was my claim delayed?",
  "Explain my NCB",
  "Show cancellation and refund status",
];

export default function MiraInsuranceCenterPage() {
  const [messages, setMessages] = useState<MiraMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "mira",
      content:
        "Hello. I am Mira, your AI Insurance Assistant. I can help with policies, claims, renewals, NCB, documents, refunds and coverage questions.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settings, setSettings] =
    useState<InsuranceSettings>(defaultSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error: settingsError } = await supabase
        .from("insurance_user_settings")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (settingsError) {
        console.warn(
          "Unable to load insurance settings:",
          settingsError.message
        );
        return;
      }

      if (data) {
        setSettings({
          language: data.language ?? "English",
          voiceEnabled: Boolean(data.voice_enabled),
          proactiveAlerts: Boolean(data.proactive_alerts),
          renewalReminders: Boolean(data.renewal_reminders),
          claimUpdates: Boolean(data.claim_updates),
          paymentAlerts: Boolean(data.payment_alerts),
          documentExpiryAlerts: Boolean(data.document_expiry_alerts),
          fraudAlerts: Boolean(data.fraud_alerts),
          emailNotifications: Boolean(data.email_notifications),
          smsNotifications: Boolean(data.sms_notifications),
          whatsappNotifications: Boolean(
            data.whatsapp_notifications
          ),
        });
      }
    } catch (caughtError) {
      console.error("Settings load error:", caughtError);
    }
  }

  async function sendMessage(
    event?: FormEvent<HTMLFormElement>,
    promptOverride?: string
  ) {
    event?.preventDefault();

    const messageText = (promptOverride ?? input).trim();

    if (!messageText || sending) {
      return;
    }

    const userMessage: MiraMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        throw new Error(
          "Please sign in again before using Mira Insurance."
        );
      }

      const response = await fetch("/api/mira", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: messageText,
          context: "insurance",
          instructions:
            "Answer only insurance-related questions about policies, claims, renewals, NCB, documents, endorsements, cancellations, refunds, underwriting and coverage. Keep the response clear, practical and user friendly.",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Mira could not answer right now."
        );
      }

      const miraReply =
        result?.reply ||
        result?.message ||
        result?.output ||
        "I could not generate a response.";

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "mira",
          content: String(miraReply),
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mira could not answer right now."
      );
    } finally {
      setSending(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMessage("");
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Please sign in again before saving settings."
        );
      }

      const { error: upsertError } = await supabase
        .from("insurance_user_settings")
        .upsert(
          {
            user_id: user.id,
            language: settings.language,
            voice_enabled: settings.voiceEnabled,
            proactive_alerts: settings.proactiveAlerts,
            renewal_reminders: settings.renewalReminders,
            claim_updates: settings.claimUpdates,
            payment_alerts: settings.paymentAlerts,
            document_expiry_alerts:
              settings.documentExpiryAlerts,
            fraud_alerts: settings.fraudAlerts,
            email_notifications:
              settings.emailNotifications,
            sms_notifications:
              settings.smsNotifications,
            whatsapp_notifications:
              settings.whatsappNotifications,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (upsertError) {
        throw upsertError;
      }

      setSettingsMessage(
        "Insurance settings saved successfully."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save settings."
      );
    } finally {
      setSavingSettings(false);
    }
  }

  const lastMessage = useMemo(
    () => messages[messages.length - 1],
    [messages]
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-fuchsia-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-fuchsia-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Mira AI Insurance & Settings Center
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Ask Mira about insurance and control your alerts,
            language, voice and communication preferences from one
            place.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 text-xl font-bold text-fuchsia-200">
                  M
                </div>

                <div>
                  <h2 className="text-xl font-bold">
                    Ask Mira Insurance
                  </h2>

                  <p className="text-sm text-slate-500">
                    Policy, claim, renewal and coverage support
                  </p>
                </div>
              </div>
            </div>

            <div className="h-[430px] space-y-4 overflow-y-auto p-5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                />
              ))}

              {sending ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                    Mira is thinking...
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() =>
                      void sendMessage(
                        undefined,
                        prompt
                      )
                    }
                    className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 transition hover:border-fuchsia-400/30 hover:text-fuchsia-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form
                onSubmit={sendMessage}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  placeholder="Ask Mira about your insurance..."
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-fuchsia-400/50"
                />

                <button
                  type="submit"
                  disabled={
                    !input.trim() || sending
                  }
                  className="rounded-2xl bg-fuchsia-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </form>

              <p className="mt-3 text-xs text-slate-600">
                Last activity:{" "}
                {formatTime(lastMessage?.createdAt)}
              </p>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <div>
              <h2 className="text-xl font-bold">
                Insurance Settings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Control how Mira and insurance notifications work.
              </p>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preferred language
                </span>

                <select
                  value={settings.language}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      language: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                >
                  <option>English</option>
                  <option>Kannada</option>
                  <option>Telugu</option>
                  <option>Hindi</option>
                  <option>Tamil</option>
                  <option>Malayalam</option>
                  <option>Bengali</option>
                  <option>Odia</option>
                </select>
              </label>

              <SettingsGroup title="Mira Preferences">
                <ToggleRow
                  label="Voice enabled"
                  checked={settings.voiceEnabled}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "voiceEnabled",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="Proactive alerts"
                  checked={settings.proactiveAlerts}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "proactiveAlerts",
                      value
                    )
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="Insurance Alerts">
                <ToggleRow
                  label="Renewal reminders"
                  checked={settings.renewalReminders}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "renewalReminders",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="Claim updates"
                  checked={settings.claimUpdates}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "claimUpdates",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="Payment alerts"
                  checked={settings.paymentAlerts}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "paymentAlerts",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="Document expiry alerts"
                  checked={
                    settings.documentExpiryAlerts
                  }
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "documentExpiryAlerts",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="Fraud alerts"
                  checked={settings.fraudAlerts}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "fraudAlerts",
                      value
                    )
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="Communication Channels">
                <ToggleRow
                  label="Email"
                  checked={settings.emailNotifications}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "emailNotifications",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="SMS"
                  checked={settings.smsNotifications}
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "smsNotifications",
                      value
                    )
                  }
                />

                <ToggleRow
                  label="WhatsApp"
                  checked={
                    settings.whatsappNotifications
                  }
                  onChange={(value) =>
                    updateSetting(
                      setSettings,
                      "whatsappNotifications",
                      value
                    )
                  }
                />
              </SettingsGroup>

              {settingsMessage ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {settingsMessage}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  void saveSettings()
                }
                disabled={savingSettings}
                className="w-full rounded-2xl bg-fuchsia-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSettings
                  ? "Saving..."
                  : "Save settings"}
              </button>
            </div>
          </article>
        </section>

        <div className="pb-4">
          <Link
            href="/insurance/dashboard"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Insurance Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function MessageBubble(props: {
  message: MiraMessage;
}) {
  const isUser = props.message.role === "user";

  return (
    <div
      className={
        isUser
          ? "flex justify-end"
          : "flex justify-start"
      }
    >
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-fuchsia-400 px-4 py-3 text-sm leading-6 text-slate-950"
            : "max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-slate-200"
        }
      >
        {props.message.content}
      </div>
    </div>
  );
}

function SettingsGroup(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-300">
        {props.title}
      </h3>

      <div className="mt-3 space-y-2">
        {props.children}
      </div>
    </section>
  );
}

function ToggleRow(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">
        {props.label}
      </span>

      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) =>
          props.onChange(event.target.checked)
        }
        className="h-5 w-5 rounded border-white/20 bg-slate-900"
      />
    </label>
  );
}

function updateSetting<
  K extends keyof InsuranceSettings
>(
  setter: React.Dispatch<
    React.SetStateAction<InsuranceSettings>
  >,
  key: K,
  value: InsuranceSettings[K]
) {
  setter((current) => ({
    ...current,
    [key]: value,
  }));
}

function formatTime(
  value: string | undefined
) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}