"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SmartParkingCard from "./SmartParkingCard";
import SaveParkingDialog from "./SaveParkingDialog";
import MiraVoiceControls from "./voice/MiraVoiceControls";
import { supabase } from "../../supabase";

type EmergencyAction = {
  id: string;
  label: string;
};

type MiraVehicleAction = {
  id: string;
  label: string;
  route: string;
};

type ProactiveAction = {
  id: string;
  label: string;
  route?: string;
  message?: string;
};

type ProactiveInsight = {
  id: string;
  category:
    | "document"
    | "service"
    | "vehicle_health"
    | "fuel"
    | "navigation"
    | "weather"
    | "emergency"
    | "general";
  priority: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  message: string;
  action?: ProactiveAction;
  dismissible: boolean;
};

type VehicleDashboard = {
  vehicle: {
    id: number;
    displayName: string;
    vehicleName?: string | null;
    registrationNumber?: string | null;
    vehicleType?: string | null;
    imageUrl?: string | null;
    brand?: string | null;
    model?: string | null;
    manufacturingYear?: number | null;
    fuelType?: string | null;
    odometer?: number | null;
    color?: string | null;
  } | null;
  documents: {
    total: number;
    expiredCount: number;
    expiringSoonCount: number;
    needsReviewCount: number;
    insurancePresent: boolean;
    pucPresent: boolean;
    rcPresent: boolean;
    drivingLicencePresent: boolean;
    insuranceExpiryDate?: string | null;
    pucExpiryDate?: string | null;
    rcExpiryDate?: string | null;
    drivingLicenceExpiryDate?: string | null;
  };
  fastag: {
    eligible: boolean;
    balance?: number | null;
  } | null;
  latestService: {
    serviceType?: string | null;
    workshopName?: string | null;
    serviceDate?: string | null;
    odometer?: number | null;
    totalCost?: number | null;
  } | null;
}
type ProactiveApiResponse = {
  greeting?: string;
  insights?: ProactiveInsight[];
  dashboard?: VehicleDashboard;
  error?: string;
};

type ChatMessage = {
  role: "user" | "mira";
  text: string;
  mode?: "normal" | "emergency";
  actions?: EmergencyAction[];
  vehicleActions?: MiraVehicleAction[];
};

type QuickAction = {
  label: string;
  route?: string;
  message?: string;
};

type MiraExecutionAction = {
  type:
    | "emergency_mode"
    | "open_route"
    | "request_location"
    | "request_vehicle"
    | "request_emergency_contact"
    | "request_notification"
    | "fetch_documents"
    | "fetch_vehicle_health"
    | "fetch_service_data"
    | "fetch_challans"
    | "fetch_parked_location"
    | "fetch_live_data"
    | "use_ai";
  route?: string;
  message?: string;
  requiresConfirmation?: boolean;
};

type MiraExecutionPlan = {
  intent?: string;
  source?: "my_vehicle" | "live_integration" | "openai" | "emergency";
  actions?: MiraExecutionAction[];
  shouldUseAI?: boolean;
  response?: string;
};

type MiraApiResponse = {
  reply?: string;
  error?: string;
  mode?: "ai" | "fallback" | "emergency" | "action";
  intent?: string;
  actions?: EmergencyAction[];
  executionPlan?: MiraExecutionPlan;
};

const quickActions: QuickAction[] = [
  {
    label: "🔧 Vehicle Health",
    route: "/vehicle-health",
  },
  {
    label: "📄 My Documents",
    route: "/documents",
  },
  {
    label: "📅 Next Service",
    message: "When is my next vehicle service?",
  },
  {
    label: "🚔 Check Challans",
    message: "Help me check my pending challans.",
  },
  {
    label: "🛠 Nearby Workshop",
    route: "/workshops",
  },
  {
    label: "🚨 Emergency SOS",
    message: "I need emergency roadside assistance.",
  },
  {
    label: "📍 Parked Location",
  },
];

function getDirectMiraRoute(
  userMessage: string
): { route: string; reply: string } | null {
  const text = userMessage.trim().toLowerCase();

  const hasDirectVerb =
    /\b(open|show|go to|take me to|launch|view|check|find|start)\b/.test(
      text
    );

  if (!hasDirectVerb) return null;

  if (
    /\b(navigation|navigate|route|directions|traffic)\b/.test(text)
  ) {
    return {
      route: "/navigation",
      reply: "Opening My Vehicle Navigation.",
    };
  }

  if (/\b(insurance|policy|renewal)\b/.test(text)) {
    return {
      route: "/insurance",
      reply: "Opening your Insurance section.",
    };
  }

  if (
    /\b(documents?|rc|puc|driving licence|driving license|dl)\b/.test(
      text
    )
  ) {
    return {
      route: "/documents",
      reply: "Opening your Vehicle Documents.",
    };
  }

  if (
    /\b(vehicle health|engine health|battery health|tyre health|tire health|maintenance)\b/.test(
      text
    )
  ) {
    return {
      route: "/vehicle-health",
      reply: "Opening Vehicle Health.",
    };
  }

  if (
    /\b(workshops?|mechanics?|service centres?|service centers?|roadside assistance)\b/.test(
      text
    )
  ) {
    return {
      route: "/workshops",
      reply: "Opening nearby Workshops and Assistance.",
    };
  }

  if (/\b(challans?|traffic fines?|traffic tickets?)\b/.test(text)) {
    return {
      route: "/challans",
      reply: "Opening your Challans section.",
    };
  }

  if (
    /\b(my vehicle|vehicle details|vehicle profile)\b/.test(text)
  ) {
    return {
      route: "/vehicle",
      reply: "Opening your active vehicle.",
    };
  }

  return null;
}

function getExecutionPlanActions(
  executionPlan?: MiraExecutionPlan
): MiraVehicleAction[] {
  const actions: MiraVehicleAction[] = [];

  for (const action of executionPlan?.actions ?? []) {
    if (!action.route) continue;

    const labelMap: Partial<
      Record<MiraExecutionAction["type"], string>
    > = {
      open_route: "🧭 Open Navigation",
      request_vehicle: "🚗 Select Vehicle",
      request_emergency_contact: "👤 Add Emergency Contact",
      request_notification: "🔔 Open Notification Settings",
      fetch_documents: "📄 Open Documents",
      fetch_vehicle_health: "🔧 Open Vehicle Health",
      fetch_service_data: "🛠️ Open Workshops",
      fetch_challans: "🚔 Open Challans",
      fetch_parked_location: "📍 Open Parked Location",
      fetch_live_data: "📡 Open Live Module",
    };

    const label = labelMap[action.type];

    if (
      label &&
      !actions.some(
        (item) =>
          item.route === action.route ||
          item.id === `execution-${action.type}`
      )
    ) {
      actions.push({
        id: `execution-${action.type}`,
        label,
        route: action.route,
      });
    }
  }

  return actions.slice(0, 3);
}

function getMiraVehicleActions(
  userMessage: string,
  intent?: string
): MiraVehicleAction[] {
  const combined = `${intent || ""} ${userMessage}`.toLowerCase();
  const actions: MiraVehicleAction[] = [];

  function addAction(action: MiraVehicleAction) {
    if (!actions.some((item) => item.id === action.id)) {
      actions.push(action);
    }
  }

  if (
    combined.includes("navigation") ||
    combined.includes("navigate") ||
    combined.includes("route") ||
    combined.includes("direction") ||
    combined.includes("traffic")
  ) {
    addAction({
      id: "open-navigation",
      label: "🧭 Open Navigation",
      route: "/navigation",
    });
  }

  if (
    combined.includes("insurance") ||
    combined.includes("policy") ||
    combined.includes("renewal")
  ) {
    addAction({
      id: "open-insurance",
      label: "🛡️ Open Insurance",
      route: "/insurance",
    });
  }

  if (
    combined.includes("document") ||
    combined.includes("rc") ||
    combined.includes("puc") ||
    combined.includes("driving licence") ||
    combined.includes("driving license") ||
    combined.includes("dl")
  ) {
    addAction({
      id: "open-documents",
      label: "📄 Open Documents",
      route: "/documents",
    });
  }

  if (
    combined.includes("health") ||
    combined.includes("engine") ||
    combined.includes("battery") ||
    combined.includes("tyre") ||
    combined.includes("tire") ||
    combined.includes("maintenance")
  ) {
    addAction({
      id: "open-vehicle-health",
      label: "🔧 Open Vehicle Health",
      route: "/vehicle-health",
    });
  }

  if (
    combined.includes("workshop") ||
    combined.includes("mechanic") ||
    combined.includes("service centre") ||
    combined.includes("service center") ||
    combined.includes("roadside")
  ) {
    addAction({
      id: "open-workshops",
      label: "🛠️ Find Workshops",
      route: "/workshops",
    });
  }

  if (
    combined.includes("challan") ||
    combined.includes("fine") ||
    combined.includes("traffic ticket")
  ) {
    addAction({
      id: "open-challans",
      label: "🚔 Check Challans",
      route: "/challans",
    });
  }

  if (
    combined.includes("vehicle") &&
    (combined.includes("show") ||
      combined.includes("open") ||
      combined.includes("details"))
  ) {
    addAction({
      id: "open-vehicle",
      label: "🚗 View Vehicle",
      route: "/vehicle",
    });
  }

  return actions.slice(0, 3);
}

const priorityStyles: Record<
  ProactiveInsight["priority"],
  {
    border: string;
    background: string;
    badgeBackground: string;
    badgeColor: string;
    icon: string;
  }
> = {
  critical: {
    border: "#ef4444",
    background: "#450a0a",
    badgeBackground: "#7f1d1d",
    badgeColor: "#fecaca",
    icon: "🚨",
  },
  high: {
    border: "#f97316",
    background: "#431407",
    badgeBackground: "#7c2d12",
    badgeColor: "#fed7aa",
    icon: "⚠️",
  },
  medium: {
    border: "#eab308",
    background: "#422006",
    badgeBackground: "#713f12",
    badgeColor: "#fef08a",
    icon: "🔔",
  },
  low: {
    border: "#3b82f6",
    background: "#172554",
    badgeBackground: "#1e3a8a",
    badgeColor: "#bfdbfe",
    icon: "ℹ️",
  },
  info: {
    border: "#06b6d4",
    background: "#083344",
    badgeBackground: "#155e75",
    badgeColor: "#cffafe",
    icon: "✨",
  },
};

function getCategoryIcon(
  category: ProactiveInsight["category"]
): string {
  switch (category) {
    case "document":
      return "📄";
    case "service":
      return "🔧";
    case "vehicle_health":
      return "🚗";
    case "fuel":
      return "⛽";
    case "navigation":
      return "🧭";
    case "weather":
      return "🌦️";
    case "emergency":
      return "🚨";
    default:
      return "✨";
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "Not added";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not added";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}



function DashboardIcon({
  kind,
  size = 22,
}: {
  kind: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (kind) {
    case "insurance":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6l-7-3Z" />
          <path d="m9.5 12 1.7 1.7 3.6-4" />
        </svg>
      );

    case "rc":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8" cy="11" r="2" />
          <path d="M5.5 16c.7-1.7 4.3-1.7 5 0M13 9h5M13 13h5M13 16h3" />
        </svg>
      );

    case "puc":
      return (
        <svg {...common}>
          <path d="M20 4c-7 .2-12.1 3.1-14.5 8.5C4.3 15.2 5.8 19 9 20c4.8 1.4 8.7-2.6 9.4-7.5C18.8 9.7 19.4 6.8 20 4Z" />
          <path d="M5 19c2.1-4.7 5.3-8.2 10-10.5" />
        </svg>
      );

    case "dl":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="9" cy="10" r="2.5" />
          <path d="M5.5 17c.8-2.3 6.2-2.3 7 0M14.5 9H19M14.5 13H19" />
        </svg>
      );

    case "documents":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h5M10 12h5M10 16h5" />
        </svg>
      );

    case "service":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.1 5.1L4 17l3 3 5.6-5.6a4 4 0 0 0 5.1-5.1l-2.2 2.2-3-3 2.2-2.2Z" />
        </svg>
      );

    case "fastag":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h4M7 14h2M15 10h2M15 14h2" />
          <path d="M12 4v2M12 18v2" />
        </svg>
      );

    case "fuel":
      return (
        <svg {...common}>
          <path d="M6 3h8v18H6zM6 8h8" />
          <path d="M14 7h2l2 3v7a2 2 0 0 0 4 0v-5l-2-2" />
        </svg>
      );

    case "vehicle":
      return (
        <svg {...common}>
          <path d="m5 16 1.5-5h11L19 16" />
          <path d="M3 16h18v3H3zM7 19v2M17 19v2M7.5 13h9" />
        </svg>
      );

    default:
      return null;
  }
}

function getDocumentStatus(
  isPresent: boolean,
  dateValue?: string | null
): { primary: string; secondary: string; tone: string } {
  if (!isPresent) {
    return {
      primary: "Missing",
      secondary: "Document missing",
      tone: "#94a3b8",
    };
  }

  if (!dateValue) {
    return {
      primary: "Available",
      secondary: "Expiry date not recorded",
      tone: "#86efac",
    };
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return {
      primary: "Needs review",
      secondary: "Invalid expiry date",
      tone: "#fca5a5",
    };
  }

  const days = Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    return {
      primary: "Expired",
      secondary: `${Math.abs(days)} day${
        Math.abs(days) === 1 ? "" : "s"
      } ago`,
      tone: "#fca5a5",
    };
  }

  if (days === 0) {
    return {
      primary: "Expires today",
      secondary: formatDate(dateValue),
      tone: "#fdba74",
    };
  }

  if (days <= 30) {
    return {
      primary: "Expiring",
      secondary: `${days} day${days === 1 ? "" : "s"} remaining`,
      tone: "#fde68a",
    };
  }

  return {
    primary: "Valid",
    secondary: `Until ${formatDate(dateValue)}`,
    tone: "#86efac",
  };
}
export default function MiraChat() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [parkingDialogOpen, setParkingDialogOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [miraUserContext, setMiraUserContext] = useState({
    userId: undefined as string | undefined,
    fullName: null as string | null,
    hasLocationPermission: false,
    hasNotificationPermission: false,
    hasEmergencyContact: false,
  });

  const [proactiveGreeting, setProactiveGreeting] = useState(
    "Hello! I am Mira, your AI Vehicle Companion. How can I help you today?"
  );
  const [proactiveInsights, setProactiveInsights] = useState<
    ProactiveInsight[]
  >([]);
  const [proactiveLoading, setProactiveLoading] = useState(true);
  const [proactiveError, setProactiveError] = useState("");
  const [dashboard, setDashboard] = useState<VehicleDashboard | null>(null);

  const latestMiraReply =
    [...messages]
      .reverse()
      .find((item) => item.role === "mira")?.text || "";

  const suggestedQuestions = (() => {
    const suggestions: string[] = [];

    function addSuggestion(question: string) {
      if (!suggestions.includes(question)) {
        suggestions.push(question);
      }
    }

    if (dashboard?.vehicle) {
      addSuggestion("Give me a complete status of my active vehicle.");
    }

    if (!dashboard?.documents.insurancePresent) {
      addSuggestion("How do I add my insurance document?");
    } else {
      addSuggestion("Is my vehicle insurance currently valid?");
    }

    if (!dashboard?.documents.pucPresent) {
      addSuggestion("My PUC is missing. What should I do?");
    } else {
      addSuggestion("When does my PUC expire?");
    }

    if (!dashboard?.latestService?.serviceDate) {
      addSuggestion("Help me plan my next vehicle service.");
    } else {
      addSuggestion("When should I service my vehicle next?");
    }

    if (
      dashboard?.fastag?.eligible &&
      (dashboard.fastag.balance === null ||
        dashboard.fastag.balance === undefined)
    ) {
      addSuggestion("How do I connect my FASTag?");
    }

    addSuggestion("Open Navigation.");
    addSuggestion("Find a nearby workshop.");
    addSuggestion("Check my pending challans.");

    return suggestions.slice(0, 4);
  })();

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedHistory = localStorage.getItem("mira-chat-history");

      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory) as ChatMessage[];

        if (Array.isArray(parsedHistory)) {
          setMessages(parsedHistory.slice(-50));
        }
      }
    } catch {
      localStorage.removeItem("mira-chat-history");
    } finally {
      setChatHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!chatHistoryLoaded || typeof window === "undefined") return;

    localStorage.setItem(
      "mira-chat-history",
      JSON.stringify(messages.slice(-50))
    );
  }, [messages, chatHistoryLoaded]);

  useEffect(() => {
    async function loadMiraUserContext() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let hasLocationPermission = false;

        if (
          typeof navigator !== "undefined" &&
          navigator.permissions
        ) {
          try {
            const permission = await navigator.permissions.query({
              name: "geolocation",
            });

            hasLocationPermission =
              permission.state === "granted";
          } catch {
            hasLocationPermission = false;
          }
        }

        const hasNotificationPermission =
          typeof Notification !== "undefined" &&
          Notification.permission === "granted";

        const metadata = session?.user?.user_metadata ?? {};

        setMiraUserContext({
          userId: session?.user?.id,
          fullName:
            metadata.full_name ||
            metadata.name ||
            null,
          hasLocationPermission,
          hasNotificationPermission,
          hasEmergencyContact: Boolean(
            metadata.emergency_contact ||
              metadata.emergency_contact_number
          ),
        });
      } catch {
        setMiraUserContext((current) => ({
          ...current,
          hasLocationPermission: false,
          hasNotificationPermission: false,
        }));
      }
    }

    loadMiraUserContext();
  }, []);

  useEffect(() => {
    async function loadProactiveMira() {
      setProactiveLoading(true);
      setProactiveError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Please sign in again.");
        }

        const response = await fetch("/api/mira/proactive", {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const data =
          (await response.json()) as ProactiveApiResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Proactive Mira could not load vehicle updates."
          );
        }

        setProactiveGreeting(
          data.greeting ||
            "Hello! I am Mira. How can I help you today?"
        );

        setProactiveInsights(data.insights || []);
        setDashboard(data.dashboard || null);
      } catch (error) {
        setProactiveError(
          error instanceof Error
            ? error.message
            : "Proactive updates are temporarily unavailable."
        );
      } finally {
        setProactiveLoading(false);
      }
    }

    loadProactiveMira();
  }, []);

  async function submitMessage(messageToSend: string) {
    const trimmedMessage = messageToSend.trim();

    if (!trimmedMessage || loading) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: trimmedMessage,
        mode: "normal",
      },
    ]);

    setMessage("");
    setActionStatus("");

    const directAction = getDirectMiraRoute(trimmedMessage);

    if (directAction) {
      setMessages((current) => [
        ...current,
        {
          role: "mira",
          text: directAction.reply,
          mode: "normal",
        },
      ]);

      window.setTimeout(() => {
        router.push(directAction.route);
      }, 350);

      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/mira", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          language: selectedLanguage,
          conversation: [
            ...messages.slice(-12).map((item) => ({
              role: item.role === "mira" ? "assistant" : "user",
              content: item.text,
            })),
            {
              role: "user",
              content: trimmedMessage,
            },
          ],
          vehicleContext: dashboard
            ? {
                vehicle: dashboard.vehicle,
                documents: dashboard.documents,
                fastag: dashboard.fastag,
                latestService: dashboard.latestService,
              }
            : null,
          userContext: {
            userId: miraUserContext.userId,
            fullName: miraUserContext.fullName,
            preferredLanguage: selectedLanguage,
            hasLocationPermission:
              miraUserContext.hasLocationPermission,
            hasNotificationPermission:
              miraUserContext.hasNotificationPermission,
            hasEmergencyContact:
              miraUserContext.hasEmergencyContact,
          },
        }),
      });

      const data = (await response.json()) as MiraApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Mira could not respond.");
      }

      const isEmergency = data.mode === "emergency";

      if (isEmergency) {
        setEmergencyMode(true);
      }

      const vehicleActions = isEmergency
        ? []
        : [
            ...getExecutionPlanActions(data.executionPlan),
            ...getMiraVehicleActions(trimmedMessage, data.intent),
          ].filter(
            (action, index, allActions) =>
              allActions.findIndex(
                (item) =>
                  item.route === action.route ||
                  item.id === action.id
              ) === index
          ).slice(0, 3);

      const proactiveNotes: string[] = [];

      if (dashboard) {
        const insuranceStatus = getDocumentStatus(
          dashboard.documents.insurancePresent,
          dashboard.documents.insuranceExpiryDate
        );

        const pucStatus = getDocumentStatus(
          dashboard.documents.pucPresent,
          dashboard.documents.pucExpiryDate
        );

        if (insuranceStatus.primary === "Expiring") {
          proactiveNotes.push("🛡️ Your insurance is nearing expiry.");
        }

        if (insuranceStatus.primary === "Expired") {
          proactiveNotes.push("🚨 Your insurance has expired.");
        }

        if (pucStatus.primary === "Expiring") {
          proactiveNotes.push("⚠️ Your PUC is nearing expiry.");
        }

        if (pucStatus.primary === "Expired") {
          proactiveNotes.push("⚠️ Your PUC has expired.");
        }

        const fastagBalance = dashboard.fastag?.balance;

        if (
          typeof fastagBalance === "number" &&
          fastagBalance < 200
        ) {
          proactiveNotes.push("💳 Your FASTag balance is low.");
        }
      }

      const requiresLocationPermission =
        data.executionPlan?.actions?.some(
          (action) => action.type === "request_location"
        ) ?? false;

      const permissionNote =
        requiresLocationPermission &&
        !miraUserContext.hasLocationPermission
          ? "📍 Allow location access in your browser to continue with this request."
          : "";

      const additionalNotes = [
        ...proactiveNotes,
        ...(permissionNote ? [permissionNote] : []),
      ];

      const replyText =
        additionalNotes.length > 0
          ? `${data.reply || "Mira could not return a response."}\n\n${additionalNotes.join("\n")}`
          : data.reply || "Mira could not return a response.";

      setMessages((current) => [
        ...current,
        {
          role: "mira",
          text: replyText,
          mode: isEmergency ? "emergency" : "normal",
          actions: data.actions,
          vehicleActions,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "mira",
          text:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
          mode: "normal",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage(message);
  }

  async function handleQuickAction(action: QuickAction) {
    if (loading) return;

    if (action.label === "📍 Parked Location") {
      setParkingDialogOpen(true);
      return;
    }

    if (action.route) {
      router.push(action.route);
      return;
    }

    if (action.message) {
      await submitMessage(action.message);
    }
  }

  function handleProactiveAction(action?: ProactiveAction) {
    if (!action) return;

    if (action.route) {
      router.push(action.route);
      return;
    }

    if (action.message) {
      submitMessage(action.message);
    }
  }

  function dismissProactiveInsight(insightId: string) {
    setProactiveInsights((current) =>
      current.filter((insight) => insight.id !== insightId)
    );
  }

  function handleEmergencyAction(actionId: string) {
    switch (actionId) {
      case "call-emergency":
        window.location.href = "tel:112";
        break;

      case "share-location":
        shareCurrentLocation();
        break;

      case "contact-family":
        setActionStatus(
          "Emergency contact integration is not configured yet. We will connect this to the saved emergency contact in the user profile."
        );
        break;

      case "roadside-assistance":
        router.push("/workshops");
        break;

      default:
        setActionStatus(
          "This emergency action is not available yet."
        );
    }
  }

  function shareCurrentLocation() {
    if (!navigator.geolocation) {
      setActionStatus(
        "Location services are not supported by this browser."
      );
      return;
    }

    setActionStatus("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

        const shareText = `Emergency: This is my current location: ${locationUrl}`;

        try {
          if (navigator.share) {
            await navigator.share({
              title: "Emergency Location",
              text: shareText,
              url: locationUrl,
            });

            setActionStatus(
              "Your location sharing window was opened."
            );
            return;
          }

          await navigator.clipboard.writeText(shareText);

          setActionStatus(
            "Your emergency location link has been copied. You can paste it into WhatsApp or SMS."
          );
        } catch {
          setActionStatus(`Location found: ${locationUrl}`);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setActionStatus(
            "Location permission was denied. Please allow location access and try again."
          );
          return;
        }

        setActionStatus(
          "Mira could not get your current location. Please check that GPS is enabled."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function clearChatHistory() {
    const confirmed = window.confirm(
      "Clear your Ask Mira conversation history?"
    );

    if (!confirmed) return;

    setMessages([]);
    setMessage("");
    setActionStatus("");

    if (typeof window !== "undefined") {
      localStorage.removeItem("mira-chat-history");

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  function exitEmergencyMode() {
    setEmergencyMode(false);
    setActionStatus("");

    setMessages((current) => [
      ...current,
      {
        role: "mira",
        text: "Emergency Mode has been closed. I am still here if you need help.",
        mode: "normal",
      },
    ]);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: emergencyMode ? "#160507" : "#020617",
        color: "white",
        padding: "32px",
        transition: "background 0.3s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          margin: "0 auto",
          background: emergencyMode ? "#25090d" : "#0f172a",
          border: emergencyMode
            ? "1px solid #ef4444"
            : "1px solid #1e293b",
          borderRadius: "24px",
          overflow: "hidden",
          boxShadow: emergencyMode
            ? "0 0 40px rgba(239, 68, 68, 0.22)"
            : "0 24px 60px rgba(0, 0, 0, 0.24)",
        }}
      >
        <header
          style={{
            padding: "24px",
            borderBottom: emergencyMode
              ? "1px solid #7f1d1d"
              : "1px solid #1e293b",
            background: emergencyMode
              ? "#3f0c13"
              : "linear-gradient(135deg, #0f172a, #111c35)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "18px",
                background: emergencyMode
                  ? "#7f1d1d"
                  : "linear-gradient(135deg, #06b6d4, #2563eb)",
                fontSize: "25px",
              }}
            >
              {emergencyMode ? "🚨" : "✨"}
            </div>

            <div>
              <h1 style={{ margin: 0 }}>
                {emergencyMode
                  ? "Emergency Mode"
                  : "Ask Mira"}
              </h1>

              <p
                style={{
                  marginTop: "8px",
                  marginBottom: 0,
                  color: emergencyMode
                    ? "#fecaca"
                    : "#94a3b8",
                }}
              >
                {emergencyMode
                  ? "Immediate assistance and safety actions"
                  : "Your proactive AI Vehicle Companion"}
              </p>
            </div>

            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              {!emergencyMode && messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChatHistory}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "12px",
                    border: "1px solid #475569",
                    background: "#1e293b",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  🗑 Clear Chat
                </button>
              )}

              {emergencyMode && (
                <button
                  type="button"
                  onClick={exitEmergencyMode}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "12px",
                    border: "1px solid #f87171",
                    background: "transparent",
                    color: "#fecaca",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Exit Emergency Mode
                </button>
              )}
            </div>
          </div>
        </header>

        <MiraVoiceControls
          disabled={loading || emergencyMode}
          latestMiraReply={latestMiraReply}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          onTranscript={(text) => setMessage(text)}
          onSubmitTranscript={(text) => submitMessage(text)}
        />

        {!emergencyMode && (
          <>
            <section
              style={{
                padding: "22px",
                borderBottom: "1px solid #1e293b",
                background: "#0b1222",
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderRadius: "18px",
                  border: "1px solid #164e63",
                  background:
                    "linear-gradient(135deg, #083344, #172554)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "25px",
                    }}
                  >
                    🤖
                  </div>

                  <div>
                    <div
                      style={{
                        color: "#67e8f9",
                        fontWeight: 800,
                        marginBottom: "6px",
                      }}
                    >
                      Mira
                    </div>

                    <div
                      style={{
                        fontSize: "17px",
                        lineHeight: 1.6,
                      }}
                    >
                      {proactiveLoading
                        ? "Checking your vehicle updates..."
                        : proactiveGreeting}
                    </div>
                  </div>
                </div>
              </div>

              {!proactiveLoading && dashboard?.vehicle && (
                <section
                  style={{
                    marginTop: "18px",
                    padding: "20px",
                    borderRadius: "20px",
                    border: "1px solid #334155",
                    background:
                      "linear-gradient(145deg, rgba(30,41,59,0.96), rgba(15,23,42,0.96))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "18px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {dashboard.vehicle.imageUrl ? (
                      <img
                        src={dashboard.vehicle.imageUrl}
                        alt={dashboard.vehicle.displayName}
                        style={{
                          width: "96px",
                          height: "72px",
                          objectFit: "cover",
                          borderRadius: "16px",
                          border: "1px solid #475569",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "96px",
                          height: "72px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "16px",
                          background: "#172554",
                          border: "1px solid #1d4ed8",
                          fontSize: "34px",
                        }}
                      >
                        🚗
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: "220px" }}>
                      <div
                        style={{
                          color: "#67e8f9",
                          fontSize: "12px",
                          fontWeight: 900,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                        }}
                      >
                        Active vehicle
                      </div>

                      <h2
                        style={{
                          margin: "6px 0 3px",
                          fontSize: "30px",
                          lineHeight: 1.1,
                          fontWeight: 900,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {dashboard.vehicle.displayName}
                      </h2>

                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        {dashboard.vehicle.registrationNumber ||
                          "Registration number not added"}
                        {dashboard.vehicle.vehicleType
                          ? ` • ${dashboard.vehicle.vehicleType}`
                          : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push("/vehicle")}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.transform =
                          "translateY(-2px)";
                        event.currentTarget.style.borderColor =
                          "#67e8f9";
                        event.currentTarget.style.background =
                          "#24344d";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.transform =
                          "translateY(0)";
                        event.currentTarget.style.borderColor =
                          "#475569";
                        event.currentTarget.style.background =
                          "#1e293b";
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "9px",
                        padding: "11px 16px",
                        borderRadius: "12px",
                        border: "1px solid #475569",
                        background: "#1e293b",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 800,
                        transition:
                          "transform 160ms ease, border-color 160ms ease, background 160ms ease",
                      }}
                    >
                      <DashboardIcon kind="vehicle" size={18} />
                      View Vehicle
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: "20px",
                      color: "#cbd5e1",
                      fontSize: "15px",
                      fontWeight: 900,
                    }}
                  >
                    Vehicle & Driver Status
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "12px",
                      marginTop: "12px",
                    }}
                  >
                    {[
                      {
                        label: "Insurance",
                        icon: "insurance",
                        present: dashboard.documents.insurancePresent,
                        date: dashboard.documents.insuranceExpiryDate,
                      },
                      {
                        label: "RC",
                        icon: "rc",
                        present: dashboard.documents.rcPresent,
                        date: dashboard.documents.rcExpiryDate,
                      },
                      {
                        label: "PUC",
                        icon: "puc",
                        present: dashboard.documents.pucPresent,
                        date: dashboard.documents.pucExpiryDate,
                      },
                      {
                        label: "DL",
                        icon: "dl",
                        present:
                          dashboard.documents.drivingLicencePresent,
                        date:
                          dashboard.documents
                            .drivingLicenceExpiryDate,
                      },
                    ].map((item) => {
                      const status = getDocumentStatus(
                        item.present,
                        item.date
                      );

                      return (
                        <div
                          key={item.label}
                          style={{
                            minHeight: "118px",
                            padding: "16px",
                            borderRadius: "18px",
                            background:
                              "linear-gradient(145deg, rgba(11,18,34,0.98), rgba(15,23,42,0.98))",
                            border: "1px solid #263449",
                            boxShadow:
                              "0 10px 24px rgba(2,6,23,0.18)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#67e8f9",
                                background:
                                  "rgba(103,232,249,0.08)",
                                border:
                                  "1px solid rgba(103,232,249,0.16)",
                              }}
                            >
                              <DashboardIcon
                                kind={item.icon}
                                size={21}
                              />
                            </div>

                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "7px",
                                padding: "6px 9px",
                                borderRadius: "999px",
                                background: `${status.tone}14`,
                                border: `1px solid ${status.tone}33`,
                                color: status.tone,
                                fontSize: "11px",
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "999px",
                                  background: status.tone,
                                  boxShadow: `0 0 0 3px ${status.tone}22`,
                                  flexShrink: 0,
                                }}
                              />
                              {status.primary}
                            </div>
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: "15px",
                                fontWeight: 900,
                              }}
                            >
                              {item.label}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "12px",
                      marginTop: "12px",
                    }}
                  >
                    <div
                      style={{
                        height: "132px",
                        boxSizing: "border-box",
                        padding: "16px",
                        borderRadius: "18px",
                        background:
                          "linear-gradient(145deg, #0f172a, #111c31)",
                        border: "1px solid #263449",
                        boxShadow:
                          "0 10px 24px rgba(2,6,23,0.18)",
                      }}
                    >
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "13px",
                          fontWeight: 800,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <DashboardIcon
                            kind="documents"
                            size={18}
                          />
                          Documents
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          fontSize: "22px",
                          fontWeight: 900,
                        }}
                      >
                        {dashboard.documents.total} Stored
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          color:
                            dashboard.documents.expiredCount > 0
                              ? "#fca5a5"
                              : "#86efac",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {dashboard.documents.expiredCount > 0
                          ? `${dashboard.documents.expiredCount} expired`
                          : "No expired records"}
                      </div>
                    </div>

                    <div
                      style={{
                        height: "132px",
                        boxSizing: "border-box",
                        padding: "16px",
                        borderRadius: "18px",
                        background:
                          "linear-gradient(145deg, #0f172a, #111c31)",
                        border: "1px solid #263449",
                        boxShadow:
                          "0 10px 24px rgba(2,6,23,0.18)",
                      }}
                    >
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "13px",
                          fontWeight: 800,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <DashboardIcon
                            kind="service"
                            size={18}
                          />
                          Service
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          fontSize: "22px",
                          fontWeight: 900,
                        }}
                      >
                        {dashboard.latestService?.serviceDate
                          ? formatDate(
                              dashboard.latestService.serviceDate
                            )
                          : "Not recorded"}
                      </div>

                      {dashboard.latestService?.serviceType && (
                        <div
                          style={{
                            marginTop: "6px",
                            color: "#94a3b8",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {dashboard.latestService.serviceType}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        height: "132px",
                        boxSizing: "border-box",
                        padding: "16px",
                        borderRadius: "18px",
                        background:
                          "linear-gradient(145deg, #0f172a, #111c31)",
                        border: "1px solid #263449",
                        boxShadow:
                          "0 10px 24px rgba(2,6,23,0.18)",
                      }}
                    >
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "13px",
                          fontWeight: 800,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <DashboardIcon
                            kind="fastag"
                            size={18}
                          />
                          FASTag
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          fontSize: "22px",
                          fontWeight: 900,
                        }}
                      >
                        {!dashboard.fastag?.eligible
                          ? "Not Applicable"
                          : dashboard.fastag.balance !== null &&
                              dashboard.fastag.balance !== undefined
                            ? `₹${new Intl.NumberFormat("en-IN", {
                                maximumFractionDigits: 2,
                              }).format(dashboard.fastag.balance)}`
                            : "Not Linked"}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          color: "#94a3b8",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {!dashboard.fastag?.eligible
                          ? "Two-wheeler vehicle"
                          : dashboard.fastag.balance !== null &&
                              dashboard.fastag.balance !== undefined
                            ? "Verified balance"
                            : "Tap to connect"}
                      </div>
                    </div>

                    <div
                      style={{
                        height: "132px",
                        boxSizing: "border-box",
                        padding: "16px",
                        borderRadius: "18px",
                        background:
                          "linear-gradient(145deg, #0f172a, #111c31)",
                        border: "1px solid #263449",
                        boxShadow:
                          "0 10px 24px rgba(2,6,23,0.18)",
                      }}
                    >
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "13px",
                          fontWeight: 800,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <DashboardIcon
                            kind="fuel"
                            size={18}
                          />
                          Fuel
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          fontSize: "22px",
                          fontWeight: 900,
                        }}
                      >
                        {dashboard.vehicle.fuelType || "Not added"}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {proactiveError && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "14px",
                    borderRadius: "14px",
                    border: "1px solid #7f1d1d",
                    background: "#450a0a",
                    color: "#fecaca",
                  }}
                >
                  {proactiveError}
                </div>
              )}

              {!proactiveLoading &&
                proactiveInsights.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "14px",
                      marginTop: "18px",
                    }}
                  >
                    {proactiveInsights.map((insight) => {
                      const style =
                        priorityStyles[insight.priority];

                      return (
                        <article
                          key={insight.id}
                          style={{
                            position: "relative",
                            padding: "18px",
                            borderRadius: "17px",
                            border: `1px solid ${style.border}`,
                            background: style.background,
                          }}
                        >
                          {insight.dismissible && (
                            <button
                              type="button"
                              aria-label={`Dismiss ${insight.title}`}
                              onClick={() =>
                                dismissProactiveInsight(
                                  insight.id
                                )
                              }
                              style={{
                                position: "absolute",
                                top: "10px",
                                right: "10px",
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                border:
                                  "1px solid rgba(255,255,255,0.16)",
                                background:
                                  "rgba(255,255,255,0.06)",
                                color: "white",
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </button>
                          )}

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              paddingRight: insight.dismissible
                                ? "34px"
                                : "0",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "22px",
                              }}
                            >
                              {getCategoryIcon(
                                insight.category
                              )}
                            </span>

                            <div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  lineHeight: 1.4,
                                }}
                              >
                                {insight.title}
                              </div>

                              <span
                                style={{
                                  display: "inline-block",
                                  marginTop: "6px",
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  background:
                                    style.badgeBackground,
                                  color: style.badgeColor,
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                }}
                              >
                                {style.icon}{" "}
                                {insight.priority}
                              </span>
                            </div>
                          </div>

                          <p
                            style={{
                              marginTop: "14px",
                              marginBottom: "16px",
                              color: "#e2e8f0",
                              lineHeight: 1.55,
                            }}
                          >
                            {insight.message}
                          </p>

                          {insight.action && (
                            <button
                              type="button"
                              onClick={() =>
                                handleProactiveAction(
                                  insight.action
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "11px 14px",
                                borderRadius: "12px",
                                border:
                                  "1px solid rgba(255,255,255,0.18)",
                                background:
                                  "rgba(255,255,255,0.09)",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 800,
                              }}
                            >
                              {insight.action.label}
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
            </section>

            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid #1e293b",
              }}
            >
              <SmartParkingCard />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "12px",
                padding: "20px",
                borderBottom: "1px solid #1e293b",
              }}
            >
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() =>
                    handleQuickAction(action)
                  }
                  disabled={loading}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "white",
                    cursor: loading
                      ? "not-allowed"
                      : "pointer",
                    fontWeight: 600,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}

        <section
          style={{
            minHeight: "350px",
            maxHeight: "650px",
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {messages.length === 0 && !emergencyMode && (
            <div
              style={{
                color: "#64748b",
                textAlign: "center",
                padding: "30px 10px",
              }}
            >
              Ask Mira anything about your vehicle, documents,
              service, navigation, emergencies or general
              questions.
            </div>
          )}

          {messages.map((chatMessage, index) => {
            const isUser = chatMessage.role === "user";
            const isEmergencyMessage =
              chatMessage.mode === "emergency";

            return (
              <div
                key={`${chatMessage.role}-${index}`}
                style={{
                  alignSelf: isUser
                    ? "flex-end"
                    : "flex-start",
                  width: isEmergencyMessage
                    ? "100%"
                    : "auto",
                  maxWidth: isEmergencyMessage
                    ? "100%"
                    : "75%",
                  padding: isEmergencyMessage
                    ? "22px"
                    : "14px 18px",
                  borderRadius: "18px",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  background: isUser
                    ? "#2563eb"
                    : isEmergencyMessage
                      ? "#450a0a"
                      : "#1e293b",
                  border: isEmergencyMessage
                    ? "1px solid #ef4444"
                    : "none",
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      marginBottom: "7px",
                      color: isEmergencyMessage
                        ? "#fca5a5"
                        : "#67e8f9",
                      fontWeight: 700,
                    }}
                  >
                    {isEmergencyMessage
                      ? "🚨 Mira Emergency Assistance"
                      : "Mira"}
                  </div>
                )}

                <div>{chatMessage.text}</div>

                {!isUser &&
                  !isEmergencyMessage &&
                  chatMessage.vehicleActions &&
                  chatMessage.vehicleActions.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginTop: "16px",
                      }}
                    >
                      {chatMessage.vehicleActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => router.push(action.route)}
                          style={{
                            minHeight: "42px",
                            padding: "10px 14px",
                            borderRadius: "12px",
                            border: "1px solid #0891b2",
                            background: "#083344",
                            color: "#cffafe",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 800,
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                {isEmergencyMessage &&
                  chatMessage.actions &&
                  chatMessage.actions.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                        marginTop: "22px",
                      }}
                    >
                      {chatMessage.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() =>
                            handleEmergencyAction(
                              action.id
                            )
                          }
                          style={{
                            minHeight: "64px",
                            padding: "14px",
                            borderRadius: "14px",
                            border:
                              action.id ===
                              "call-emergency"
                                ? "1px solid #fca5a5"
                                : "1px solid #7f1d1d",
                            background:
                              action.id ===
                              "call-emergency"
                                ? "#dc2626"
                                : "#7f1d1d",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "15px",
                            fontWeight: 800,
                          }}
                        >
                          {action.id ===
                            "call-emergency" && "📞 "}
                          {action.id ===
                            "share-location" && "📍 "}
                          {action.id ===
                            "contact-family" && "👨‍👩‍👧 "}
                          {action.id ===
                            "roadside-assistance" && "🚗 "}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}

          {actionStatus && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "14px",
                background: emergencyMode
                  ? "#3f0c13"
                  : "#172554",
                border: emergencyMode
                  ? "1px solid #7f1d1d"
                  : "1px solid #1d4ed8",
                color: emergencyMode
                  ? "#fecaca"
                  : "#bfdbfe",
              }}
            >
              {actionStatus}
            </div>
          )}

          {loading && (
            <div
              style={{
                alignSelf: "flex-start",
                padding: "14px 18px",
                borderRadius: "18px",
                background: "#1e293b",
                color: "#94a3b8",
              }}
            >
              Mira is analysing your request...
            </div>
          )}
        </section>

        {!emergencyMode && suggestedQuestions.length > 0 && (
          <section
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #1e293b",
              background: "#0b1222",
            }}
          >
            <div
              style={{
                marginBottom: "10px",
                color: "#94a3b8",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Suggested questions
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => submitMessage(question)}
                  disabled={loading}
                  style={{
                    padding: "10px 13px",
                    borderRadius: "999px",
                    border: "1px solid #334155",
                    background: "#172033",
                    color: "#dbeafe",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    opacity: loading ? 0.55 : 1,
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </section>
        )}

        {!emergencyMode && (
          <form
            onSubmit={sendMessage}
            style={{
              display: "flex",
              gap: "12px",
              padding: "20px",
              borderTop: "1px solid #1e293b",
            }}
          >
            <input
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Ask Mira anything..."
              disabled={loading}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #334155",
                background: "#020617",
                color: "white",
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={!message.trim() || loading}
              style={{
                padding: "0 24px",
                border: "none",
                borderRadius: "14px",
                background: "#2563eb",
                color: "white",
                cursor:
                  !message.trim() || loading
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !message.trim() || loading ? 0.5 : 1,
                fontWeight: 600,
              }}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        )}

        {emergencyMode && (
          <footer
            style={{
              padding: "18px 24px",
              borderTop: "1px solid #7f1d1d",
              background: "#3f0c13",
              color: "#fecaca",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Move to a safe location when possible. For immediate
            danger or serious injury, call emergency services.
          </footer>
        )}
      </div>

      <SaveParkingDialog
        open={parkingDialogOpen}
        onClose={() => setParkingDialogOpen(false)}
      />
    </main>
  );
}