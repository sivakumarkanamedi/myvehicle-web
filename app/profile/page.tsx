"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import PushNotificationsSetup from "../components/PushNotificationsSetup";
import { supabase } from "@/supabase";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SectionId =
  | "profile"
  | "language"
  | "notifications"
  | "security";

type LanguageCode =
  | "en"
  | "hi"
  | "as"
  | "bn"
  | "brx"
  | "doi"
  | "gu"
  | "kn"
  | "ks"
  | "kok"
  | "mai"
  | "ml"
  | "mni"
  | "mr"
  | "ne"
  | "or"
  | "pa"
  | "sa"
  | "sat"
  | "sd"
  | "ta"
  | "te"
  | "ur";

type LanguageOption = {
  code: LanguageCode;
  name: string;
  nativeName: string;
};

type NotificationSettings = {
  service: boolean;
  insurance: boolean;
  puc: boolean;
  fastag: boolean;
  challan: boolean;
  battery: boolean;
  fuel: boolean;
  tyre: boolean;
  recall: boolean;
  whatsapp: boolean;
};

type EmergencyContactRecord = {
  id: number;
  user_id: string;
  contact_name: string;
  relationship: string | null;
  mobile_number: string;
  is_primary: boolean;
  is_active: boolean;
};

const languages: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "brx", name: "Bodo", nativeName: "बड़ो" },
  { code: "doi", name: "Dogri", nativeName: "डोगरी" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ks", name: "Kashmiri", nativeName: "کٲشُر" },
  { code: "kok", name: "Konkani", nativeName: "कोंकणी" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mni", name: "Manipuri", nativeName: "মৈতৈলোন্" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
  { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
];

const sections: Array<{
  id: SectionId;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: "profile",
    label: "Personal Profile",
    description: "Identity and contact details",
    icon: "👤",
  },
  {
    id: "language",
    label: "Language Center",
    description: "App, Mira and translation",
    icon: "🌐",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and reminders",
    icon: "🔔",
  },
  {
    id: "security",
    label: "Privacy & Security",
    description: "Account protection",
    icon: "🔐",
  },
];

export default function ProfilePage() {
  const [activeSection, setActiveSection] =
    useState<SectionId>("profile");

  const [notice, setNotice] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [primaryContactId, setPrimaryContactId] =
    useState<number | null>(null);
  const [secondaryContactId, setSecondaryContactId] =
    useState<number | null>(null);
  const [sosReady, setSosReady] = useState(false);

  const [profile, setProfile] = useState({
    fullName: "Siva Kumar",
    mobile: "+91 98765 43210",
    email: "siva@example.com",
    city: "Bengaluru",
    state: "Karnataka",
    address: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyMobile: "",
    secondaryEmergencyName: "",
    secondaryEmergencyMobile: "",
  });

  const [languagePreferences, setLanguagePreferences] = useState({
    appLanguage: "en" as LanguageCode,
    miraLanguage: "en" as LanguageCode,
    voiceInputLanguage: "en" as LanguageCode,
    voiceOutputLanguage: "en" as LanguageCode,
    mechanicLanguage: "kn" as LanguageCode,
    whatsappLanguage: "en" as LanguageCode,
    notificationLanguage: "en" as LanguageCode,
    navigationLanguage: "en" as LanguageCode,
    automaticDetection: true,
  });

  const [notifications, setNotifications] =
    useState<NotificationSettings>({
      service: true,
      insurance: true,
      puc: true,
      fastag: true,
      challan: true,
      battery: true,
      fuel: false,
      tyre: true,
      recall: true,
      whatsapp: true,
    });

  const activeSectionDetails = useMemo(
    () => sections.find((section) => section.id === activeSection),
    [activeSection]
  );

  function normalizePhoneNumber(value: string) {
    return value.replace(/[^\d+]/g, "").trim();
  }

  function isValidPhoneNumber(value: string) {
    const normalized = normalizePhoneNumber(value);
    return /^\+?[1-9]\d{7,14}$/.test(normalized);
  }

  async function loadEmergencyContacts() {
    setLoadingContacts(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { data, error } = await supabase
        .from("emergency_contacts")
        .select(
          "id, user_id, contact_name, relationship, mobile_number, is_primary, is_active"
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;

      const contacts = (data || []) as EmergencyContactRecord[];
      const primary =
        contacts.find((contact) => contact.is_primary) ||
        contacts[0] ||
        null;
      const secondary =
        contacts.find(
          (contact) => primary && contact.id !== primary.id
        ) || null;

      setPrimaryContactId(primary?.id ?? null);
      setSecondaryContactId(secondary?.id ?? null);
      setSosReady(Boolean(primary?.is_active));

      setProfile((current) => ({
        ...current,
        emergencyName: primary?.contact_name || "",
        emergencyRelationship: primary?.relationship || "",
        emergencyMobile: primary?.mobile_number || "",
        secondaryEmergencyName: secondary?.contact_name || "",
        secondaryEmergencyMobile: secondary?.mobile_number || "",
      }));
    } catch (caughtError) {
      showNotice(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load emergency contacts."
      );
    } finally {
      setLoadingContacts(false);
    }
  }

  useEffect(() => {
    void loadEmergencyContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showNotice(message: string) {
    setNotice(message);

    window.setTimeout(() => {
      setNotice(null);
    }, 3000);
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (savingProfile) return;

    if (
      !profile.emergencyName.trim() ||
      !profile.emergencyRelationship.trim() ||
      !profile.emergencyMobile.trim()
    ) {
      showNotice(
        "Primary emergency contact name, relationship and mobile number are required."
      );
      return;
    }

    if (!isValidPhoneNumber(profile.emergencyMobile)) {
      showNotice("Enter a valid primary mobile number.");
      return;
    }

    const hasSecondaryContact =
      profile.secondaryEmergencyName.trim() ||
      profile.secondaryEmergencyMobile.trim();

    if (
      hasSecondaryContact &&
      (!profile.secondaryEmergencyName.trim() ||
        !profile.secondaryEmergencyMobile.trim())
    ) {
      showNotice(
        "Enter both secondary contact name and mobile number, or leave both blank."
      );
      return;
    }

    if (
      hasSecondaryContact &&
      !isValidPhoneNumber(profile.secondaryEmergencyMobile)
    ) {
      showNotice("Enter a valid secondary mobile number.");
      return;
    }

    setSavingProfile(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const primaryPayload = {
        user_id: user.id,
        contact_name: profile.emergencyName.trim(),
        relationship: profile.emergencyRelationship.trim(),
        mobile_number: normalizePhoneNumber(
          profile.emergencyMobile
        ),
        is_primary: true,
        is_active: true,
      };

      let savedPrimaryContactId = primaryContactId;

      if (primaryContactId) {
        const { error: updatePrimaryError } = await supabase
          .from("emergency_contacts")
          .update(primaryPayload)
          .eq("id", primaryContactId)
          .eq("user_id", user.id);

        if (updatePrimaryError) throw updatePrimaryError;
      } else {
        const { data: createdPrimary, error: createPrimaryError } =
          await supabase
            .from("emergency_contacts")
            .insert(primaryPayload)
            .select("id")
            .single();

        if (createPrimaryError) throw createPrimaryError;

        savedPrimaryContactId = createdPrimary.id;
        setPrimaryContactId(createdPrimary.id);
      }

      const { error: clearOtherPrimaryError } = await supabase
        .from("emergency_contacts")
        .update({ is_primary: false })
        .eq("user_id", user.id)
        .neq("id", savedPrimaryContactId);

      if (clearOtherPrimaryError) {
        throw clearOtherPrimaryError;
      }

      if (hasSecondaryContact) {
        const secondaryPayload = {
          user_id: user.id,
          contact_name:
            profile.secondaryEmergencyName.trim(),
          relationship: null,
          mobile_number: normalizePhoneNumber(
            profile.secondaryEmergencyMobile
          ),
          is_primary: false,
          is_active: true,
        };

        if (secondaryContactId) {
          const { error: updateSecondaryError } =
            await supabase
              .from("emergency_contacts")
              .update(secondaryPayload)
              .eq("id", secondaryContactId)
              .eq("user_id", user.id);

          if (updateSecondaryError) {
            throw updateSecondaryError;
          }
        } else {
          const {
            data: createdSecondary,
            error: createSecondaryError,
          } = await supabase
            .from("emergency_contacts")
            .insert(secondaryPayload)
            .select("id")
            .single();

          if (createSecondaryError) {
            throw createSecondaryError;
          }

          setSecondaryContactId(createdSecondary.id);
        }
      } else if (secondaryContactId) {
        const { error: deactivateSecondaryError } =
          await supabase
            .from("emergency_contacts")
            .update({
              is_active: false,
              is_primary: false,
            })
            .eq("id", secondaryContactId)
            .eq("user_id", user.id);

        if (deactivateSecondaryError) {
          throw deactivateSecondaryError;
        }

        setSecondaryContactId(null);
      }

      setSosReady(true);
      showNotice(
        "Profile and emergency contacts saved successfully."
      );

      await loadEmergencyContacts();
    } catch (caughtError) {
      showNotice(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save emergency contacts."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function saveLanguagePreferences() {
    showNotice("Language and translation preferences saved.");
  }

  
  
  function toggleNotification(
    key: keyof NotificationSettings
  ) {
    setNotifications((currentSettings) => ({
      ...currentSettings,
      [key]: !currentSettings[key],
    }));
  }

  return (
    <main className="min-h-screen bg-[#070b18] text-white">
      {notice && (
        <div className="fixed left-1/2 top-5 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/95 px-5 py-4 text-sm font-semibold text-emerald-100 shadow-2xl backdrop-blur-xl">
            ✅ {notice}
          </div>
        </div>
      )}

      <section className="border-b border-white/10 bg-gradient-to-r from-[#08132c] via-[#0b1024] to-[#171038]">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <Link
                href="/"
                className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white"
              >
                <ArrowLeft size={18} />
                Back to Dashboard
              </Link>

              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
                My Vehicle Digital Identity
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Profile & Settings
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage your identity, emergency contacts, languages,
                notifications and account security from one place.
              </p>
            </div>

          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-3xl border border-white/10 bg-[#0c1224] p-3 shadow-2xl shadow-black/20 lg:sticky lg:top-6">
          <div className="mb-3 rounded-2xl border border-blue-400/15 bg-gradient-to-br from-blue-500/15 to-indigo-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
              Account completion
            </p>

            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-black">78%</p>
              <p className="text-xs text-slate-400">Almost ready</p>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            </div>
          </div>

          <nav className="space-y-2">
            {sections.map((section) => {
              const active = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition ${
                    active
                      ? "border border-blue-400/20 bg-blue-500/15 shadow-lg shadow-blue-950/40"
                      : "border border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                      active
                        ? "bg-blue-500/20"
                        : "bg-white/[0.04]"
                    }`}
                  >
                    {section.icon}
                  </span>

                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-bold ${
                        active ? "text-blue-200" : "text-slate-200"
                      }`}
                    >
                      {section.label}
                    </span>

                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {activeSectionDetails?.icon}
              </span>

              <div>
                <h2 className="text-2xl font-black">
                  {activeSectionDetails?.label}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {activeSectionDetails?.description}
                </p>
              </div>
            </div>
          </div>

          {activeSection === "profile" && (
            <ProfileSection
              profile={profile}
              setProfile={setProfile}
              onSubmit={saveProfile}
              loadingContacts={loadingContacts}
              savingProfile={savingProfile}
              sosReady={sosReady}
            />
          )}

          {activeSection === "language" && (
            <LanguageSection
              preferences={languagePreferences}
              setPreferences={setLanguagePreferences}
              onSave={saveLanguagePreferences}
            />
          )}

          {activeSection === "notifications" && (
            <NotificationsSection
              settings={notifications}
              onToggle={toggleNotification}
              onSave={() =>
                showNotice("Notification preferences saved.")
              }
            />
          )}

          {activeSection === "security" && (
            <SecuritySection
              onAction={(message) => showNotice(message)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function ProfileSection({
  profile,
  setProfile,
  onSubmit,
  loadingContacts,
  savingProfile,
  sosReady,
}: {
  profile: {
    fullName: string;
    mobile: string;
    email: string;
    city: string;
    state: string;
    address: string;
    emergencyName: string;
    emergencyRelationship: string;
    emergencyMobile: string;
    secondaryEmergencyName: string;
    secondaryEmergencyMobile: string;
  };
  setProfile: React.Dispatch<
    React.SetStateAction<{
      fullName: string;
      mobile: string;
      email: string;
      city: string;
      state: string;
      address: string;
      emergencyName: string;
      emergencyRelationship: string;
      emergencyMobile: string;
      secondaryEmergencyName: string;
      secondaryEmergencyMobile: string;
    }>
  >;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loadingContacts: boolean;
  savingProfile: boolean;
  sosReady: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <SettingsCard
        title="Personal Information"
        description="Your identity and contact information"
        icon="👤"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Full name"
            value={profile.fullName}
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                fullName: value,
              }))
            }
          />

          <InputField
            label="Mobile number"
            value={profile.mobile}
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                mobile: value,
              }))
            }
          />

          <InputField
            label="Email address"
            type="email"
            value={profile.email}
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                email: value,
              }))
            }
          />

          <InputField
            label="Current city"
            value={profile.city}
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                city: value,
              }))
            }
          />

          <InputField
            label="State"
            value={profile.state}
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                state: value,
              }))
            }
          />

          <InputField
            label="Address"
            value={profile.address}
            placeholder="Add your address"
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                address: value,
              }))
            }
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Emergency Contact Setup"
        description="Mira can contact this person and share your live location during an SOS event"
        icon="🆘"
      >
        <div
          className={`mb-5 rounded-2xl border p-4 ${
            sosReady
              ? "border-emerald-400/20 bg-emerald-400/10"
              : "border-amber-400/20 bg-amber-400/10"
          }`}
        >
          <p
            className={`text-sm font-black ${
              sosReady
                ? "text-emerald-200"
                : "text-amber-200"
            }`}
          >
            {loadingContacts
              ? "Loading emergency contact status..."
              : sosReady
                ? "SOS Ready"
                : "Add one active primary emergency contact"}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            During SOS, Mira can use this contact for emergency alerts and live
            location sharing. The secondary contact is optional.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Primary contact name"
            value={profile.emergencyName}
            placeholder="Emergency contact name"
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                emergencyName: value,
              }))
            }
            disabled={loadingContacts || savingProfile}
          />

          <InputField
            label="Relationship"
            value={profile.emergencyRelationship}
            placeholder="Example: Spouse, Parent, Friend"
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                emergencyRelationship: value,
              }))
            }
            disabled={loadingContacts || savingProfile}
          />

          <InputField
            label="Primary mobile number"
            value={profile.emergencyMobile}
            placeholder="+91"
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                emergencyMobile: value,
              }))
            }
            disabled={loadingContacts || savingProfile}
          />

          <div className="hidden md:block" />

          <InputField
            label="Secondary contact name (optional)"
            value={profile.secondaryEmergencyName}
            placeholder="Secondary emergency contact"
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                secondaryEmergencyName: value,
              }))
            }
            disabled={loadingContacts || savingProfile}
          />

          <InputField
            label="Secondary mobile number (optional)"
            value={profile.secondaryEmergencyMobile}
            placeholder="+91"
            onChange={(value) =>
              setProfile((current) => ({
                ...current,
                secondaryEmergencyMobile: value,
              }))
            }
            disabled={loadingContacts || savingProfile}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-300">
            SOS confirmation
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            By saving this profile, you confirm that Mira may use the emergency
            contact details only for SOS, accident alerts and live-location
            sharing initiated by you or an approved emergency trigger.
          </p>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <PrimaryButton
          type="submit"
          disabled={savingProfile || loadingContacts}
        >
          {savingProfile
            ? "Saving emergency contacts..."
            : "Save profile"}
        </PrimaryButton>
      </div>
    </form>
  );
}

function LanguageSection({
  preferences,
  setPreferences,
  onSave,
}: {
  preferences: {
    appLanguage: LanguageCode;
    miraLanguage: LanguageCode;
    voiceInputLanguage: LanguageCode;
    voiceOutputLanguage: LanguageCode;
    mechanicLanguage: LanguageCode;
    whatsappLanguage: LanguageCode;
    notificationLanguage: LanguageCode;
    navigationLanguage: LanguageCode;
    automaticDetection: boolean;
  };
  setPreferences: React.Dispatch<
    React.SetStateAction<{
      appLanguage: LanguageCode;
      miraLanguage: LanguageCode;
      voiceInputLanguage: LanguageCode;
      voiceOutputLanguage: LanguageCode;
      mechanicLanguage: LanguageCode;
      whatsappLanguage: LanguageCode;
      notificationLanguage: LanguageCode;
      navigationLanguage: LanguageCode;
      automaticDetection: boolean;
    }>
  >;
  onSave: () => void;
}) {
  function updateLanguage(
    key: keyof typeof preferences,
    value: LanguageCode | boolean
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Mira Language Engine"
        description="All 22 scheduled Indian languages plus English"
        icon="🌐"
      >
        <div className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.07] p-5">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🗣️</span>

            <div>
              <h3 className="font-black text-blue-100">
                Customer ↔ Mechanic Language Bridge
              </h3>

              <p className="mt-2 text-sm leading-6 text-blue-100/60">
                A customer can speak Telugu while a mechanic speaks
                Kannada. Mira translates both sides automatically through
                text and, once connected, real-time voice.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <LanguageSelect
            label="App interface language"
            description="Menus, buttons, forms and pages"
            value={preferences.appLanguage}
            onChange={(value) =>
              updateLanguage("appLanguage", value)
            }
          />

          <LanguageSelect
            label="Ask Mira language"
            description="The language Mira uses in chat"
            value={preferences.miraLanguage}
            onChange={(value) =>
              updateLanguage("miraLanguage", value)
            }
          />

          <LanguageSelect
            label="Voice input language"
            description="Language spoken by the customer"
            value={preferences.voiceInputLanguage}
            onChange={(value) =>
              updateLanguage("voiceInputLanguage", value)
            }
          />

          <LanguageSelect
            label="Voice response language"
            description="Language Mira speaks back"
            value={preferences.voiceOutputLanguage}
            onChange={(value) =>
              updateLanguage("voiceOutputLanguage", value)
            }
          />

          <LanguageSelect
            label="Mechanic language"
            description="Language used by the workshop or mechanic"
            value={preferences.mechanicLanguage}
            onChange={(value) =>
              updateLanguage("mechanicLanguage", value)
            }
          />

          <LanguageSelect
            label="WhatsApp language"
            description="Booking and service updates"
            value={preferences.whatsappLanguage}
            onChange={(value) =>
              updateLanguage("whatsappLanguage", value)
            }
          />

          <LanguageSelect
            label="Notification language"
            description="Alerts, reminders and expiry messages"
            value={preferences.notificationLanguage}
            onChange={(value) =>
              updateLanguage("notificationLanguage", value)
            }
          />

          <LanguageSelect
            label="Navigation voice language"
            description="Turn-by-turn directions and alerts"
            value={preferences.navigationLanguage}
            onChange={(value) =>
              updateLanguage("navigationLanguage", value)
            }
          />
        </div>

        <div className="mt-6">
          <ToggleRow
            title="Automatic language detection"
            description="Mira identifies the language spoken or typed and responds appropriately."
            enabled={preferences.automaticDetection}
            onToggle={() =>
              updateLanguage(
                "automaticDetection",
                !preferences.automaticDetection
              )
            }
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Live Interpreter Preview"
        description="Customer and mechanic can communicate in different languages"
        icon="🔄"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <InterpreterPanel
            title="Customer"
            badge="Telugu"
            microphoneLabel="Customer microphone"
            original="నా కారు స్టార్ట్ అవ్వడం లేదు."
            translated="ನನ್ನ ಕಾರು ಸ್ಟಾರ್ಟ್ ಆಗುತ್ತಿಲ್ಲ."
          />

          <InterpreterPanel
            title="Mechanic"
            badge="Kannada"
            microphoneLabel="Mechanic microphone"
            original="ಬ್ಯಾಟರಿ ದುರ್ಬಲವಾಗಿದೆ."
            translated="బ్యాటరీ బలహీనంగా ఉంది."
          />
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <PrimaryButton type="button" onClick={onSave}>
          Save language preferences
        </PrimaryButton>
      </div>
    </div>
  );
}

function NotificationsSection({
  settings,
  onToggle,
  onSave,
}: {
  settings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings) => void;
  onSave: () => void;
}) {
  const items: Array<{
    key: keyof NotificationSettings;
    title: string;
    description: string;
    icon: string;
  }> = [
    {
      key: "service",
      title: "Service reminders",
      description: "Upcoming and overdue vehicle service alerts",
      icon: "🔧",
    },
    {
      key: "insurance",
      title: "Insurance alerts",
      description: "Policy expiry, renewal and document reminders",
      icon: "🛡️",
    },
    {
      key: "puc",
      title: "PUC reminders",
      description: "Pollution certificate expiry alerts",
      icon: "🌿",
    },
    {
      key: "fastag",
      title: "FASTag alerts",
      description: "Low balance and transaction updates",
      icon: "🛣️",
    },
    {
      key: "challan",
      title: "Challan alerts",
      description: "New traffic challan and payment status",
      icon: "🚦",
    },
    {
      key: "tyre",
      title: "Tyre alerts",
      description: "Pressure, wear and replacement reminders",
      icon: "🛞",
    },
    {
      key: "recall",
      title: "Vehicle recalls",
      description: "Manufacturer safety and recall notifications",
      icon: "📢",
    },
    {
      key: "whatsapp",
      title: "WhatsApp updates",
      description: "Service booking and workshop communication",
      icon: "💬",
    },
  ];

  return (
    <div className="space-y-6">
      <PushNotificationsSetup />

      <SettingsCard
        title="Alert Preferences"
        description="Choose what Mira should proactively monitor"
        icon="🔔"
      >
        <div className="grid gap-3">
          {items.map((item) => (
            <ToggleRow
              key={item.key}
              title={`${item.icon} ${item.title}`}
              description={item.description}
              enabled={settings[item.key]}
              onToggle={() => onToggle(item.key)}
            />
          ))}
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <PrimaryButton type="button" onClick={onSave}>
          Save notification preferences
        </PrimaryButton>
      </div>
    </div>
  );
}

function SecuritySection({
  onAction,
}: {
  onAction: (message: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsCard
        title="Account Protection"
        description="Secure access to your vehicles and documents"
        icon="🔐"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SecurityCard
            icon="🔢"
            title="App PIN"
            description="Protect My Vehicle with a secure PIN."
            status="Not enabled"
            action="Set PIN"
            onClick={() =>
              onAction("PIN security setup will be connected.")
            }
          />

          <SecurityCard
            icon="👆"
            title="Biometric login"
            description="Use fingerprint or face authentication."
            status="Available on mobile"
            action="Enable"
            onClick={() =>
              onAction("Biometric login requires the mobile app.")
            }
          />

          <SecurityCard
            icon="🛡️"
            title="Two-factor authentication"
            description="Require an additional verification step."
            status="Recommended"
            action="Configure"
            onClick={() =>
              onAction("Two-factor authentication setup opened.")
            }
          />

          <SecurityCard
            icon="📱"
            title="Trusted devices"
            description="Review devices signed in to your account."
            status="1 active device"
            action="Review"
            onClick={() =>
              onAction("Trusted devices review opened.")
            }
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Data & Privacy"
        description="Control your personal information"
        icon="🗂️"
      >
        <div className="space-y-3">
          <PrivacyAction
            title="Download my data"
            description="Export your profile, vehicles and activity."
            action="Request export"
            onClick={() =>
              onAction("Your data export request has been created.")
            }
          />

          <PrivacyAction
            title="Login history"
            description="Review recent account access."
            action="View history"
            onClick={() => onAction("Login history opened.")}
          />

          <PrivacyAction
            title="Delete account"
            description="Permanently remove your account and stored information."
            action="Delete"
            danger
            onClick={() =>
              onAction(
                "Account deletion requires identity confirmation."
              )
            }
          />
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0c1224] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-2xl">
            {icon}
          </span>

          <div>
            <h3 className="text-lg font-black">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          </div>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function InputField({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-white/10 bg-[#080d1c] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function LanguageSelect({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <span className="block text-sm font-black">{label}</span>
      <span className="mt-1 block text-xs text-slate-500">
        {description}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as LanguageCode)
        }
        className="mt-4 w-full rounded-xl border border-white/10 bg-[#080d1c] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/50"
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.nativeName} — {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div>
        <p className="text-sm font-bold text-slate-200">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          enabled ? "bg-blue-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function InterpreterPanel({
  title,
  badge,
  microphoneLabel,
  original,
  translated,
}: {
  title: string;
  badge: string;
  microphoneLabel: string;
  original: string;
  translated: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#080d1c] p-5">
      <div className="flex items-center justify-between">
        <h4 className="font-black">{title}</h4>

        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
          {badge}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Original
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-200">
          {original}
        </p>
      </div>

      <div className="my-3 text-center text-slate-600">↓ Mira</div>

      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.07] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
          Translated
        </p>

        <p className="mt-2 text-sm leading-6 text-blue-100">
          {translated}
        </p>
      </div>

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500"
      >
        🎤 {microphoneLabel}
      </button>
    </div>
  );
}

function AccessCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <span className="text-2xl">{icon}</span>
      <h4 className="mt-3 font-black">{title}</h4>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function SecurityCard({
  icon,
  title,
  description,
  status,
  action,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>

        <div>
          <h4 className="font-black">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500">
          {status}
        </span>

        <SecondaryButton type="button" onClick={onClick}>
          {action}
        </SecondaryButton>
      </div>
    </div>
  );
}

function PrivacyAction({
  title,
  description,
  action,
  danger = false,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center">
      <div>
        <h4 className="text-sm font-black">{title}</h4>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
          danger
            ? "border-red-400/20 bg-red-500/[0.07] text-red-300 hover:bg-red-500/15"
            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
        }`}
      >
        {action}
      </button>
    </div>
  );
}

function PrimaryButton({
  children,
  type,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  type: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  type,
  onClick,
}: {
  children: React.ReactNode;
  type: "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-blue-400/20 hover:bg-blue-500/10 hover:text-blue-200"
    >
      {children}
    </button>
  );
}