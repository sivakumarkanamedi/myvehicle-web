export type MiraProactivePriority =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type MiraProactiveCategory =
  | "document"
  | "service"
  | "vehicle_health"
  | "fuel"
  | "navigation"
  | "weather"
  | "emergency"
  | "general";

export type MiraProactiveAction = {
  id: string;
  label: string;
  route?: string;
  message?: string;
};

export type MiraProactiveInsight = {
  id: string;
  category: MiraProactiveCategory;
  priority: MiraProactivePriority;
  title: string;
  message: string;
  action?: MiraProactiveAction;
  dismissible: boolean;
};

export type MiraProactiveContext = {
  userName?: string | null;

  selectedVehicle?: {
    id: string | number;
    make?: string | null;
    model?: string | null;
    registrationNumber?: string | null;
  } | null;

  documents?: {
    insuranceExpiryDate?: string | null;
    pucExpiryDate?: string | null;
    rcExpiryDate?: string | null;
    expiredCount?: number;
    expiringSoonCount?: number;
    needsReviewCount?: number;
  } | null;

  service?: {
    nextServiceDate?: string | null;
    nextServiceOdometer?: number | null;
    currentOdometer?: number | null;
    lastServiceDate?: string | null;
  } | null;

  vehicleHealth?: {
    healthScore?: number | null;
    activeWarnings?: number;
    batteryStatus?: "good" | "check" | "critical" | null;
  } | null;

  location?: {
    permissionGranted: boolean;
    latitude?: number | null;
    longitude?: number | null;
  };

  notificationsEnabled: boolean;
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function daysUntil(dateValue?: string | null): number | null {
  if (!dateValue) return null;

  const expiryDate = new Date(dateValue);

  if (Number.isNaN(expiryDate.getTime())) {
    return null;
  }

  const now = new Date();

  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const expiryUtc = Date.UTC(
    expiryDate.getUTCFullYear(),
    expiryDate.getUTCMonth(),
    expiryDate.getUTCDate()
  );

  return Math.ceil((expiryUtc - todayUtc) / DAY_IN_MS);
}

function pluralise(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return count === 1 ? singular : plural;
}

function clampNumber(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function buildExpiryInsight({
  id,
  title,
  documentName,
  expiryDate,
  warningWindow,
  highPriorityWindow,
  route = "/documents",
}: {
  id: string;
  title: string;
  documentName: string;
  expiryDate?: string | null;
  warningWindow: number;
  highPriorityWindow: number;
  route?: string;
}): MiraProactiveInsight | null {
  const days = daysUntil(expiryDate);

  if (days === null) {
    return null;
  }

  if (days < 0) {
    return {
      id: `${id}-expired`,
      category: "document",
      priority: "critical",
      title: `${documentName} expired`,
      message: `Your ${documentName} expired ${Math.abs(days)} ${pluralise(
        Math.abs(days),
        "day"
      )} ago.`,
      action: {
        id: `review-${id}`,
        label: `Review ${documentName}`,
        route,
      },
      dismissible: false,
    };
  }

  if (days > warningWindow) {
    return null;
  }

  return {
    id,
    category: "document",
    priority:
      days <= highPriorityWindow ? "high" : "medium",
    title,
    message:
      days === 0
        ? `Your ${documentName} expires today.`
        : `Your ${documentName} expires in ${days} ${pluralise(
            days,
            "day"
          )}.`,
    action: {
      id: `review-${id}`,
      label: `Review ${documentName}`,
      route,
    },
    dismissible: true,
  };
}

function buildDocumentInsights(
  context: MiraProactiveContext
): MiraProactiveInsight[] {
  const insights: MiraProactiveInsight[] = [];
  const documents = context.documents;

  if (!documents) {
    return insights;
  }

  if ((documents.expiredCount ?? 0) > 0) {
    const count = documents.expiredCount ?? 0;

    insights.push({
      id: "expired-documents",
      category: "document",
      priority: "critical",
      title: "Expired vehicle documents",
      message: `${count} vehicle ${pluralise(
        count,
        "document"
      )} ${count === 1 ? "has" : "have"} expired and require immediate attention.`,
      action: {
        id: "open-documents",
        label: "Review Documents",
        route: "/documents",
      },
      dismissible: false,
    });
  }

  const expiryInsights = [
    buildExpiryInsight({
      id: "insurance-expiry",
      title: "Insurance renewal approaching",
      documentName: "vehicle insurance",
      expiryDate: documents.insuranceExpiryDate,
      warningWindow: 30,
      highPriorityWindow: 7,
    }),
    buildExpiryInsight({
      id: "puc-expiry",
      title: "PUC renewal approaching",
      documentName: "PUC certificate",
      expiryDate: documents.pucExpiryDate,
      warningWindow: 15,
      highPriorityWindow: 3,
    }),
    buildExpiryInsight({
      id: "rc-expiry",
      title: "RC expiry approaching",
      documentName: "registration certificate",
      expiryDate: documents.rcExpiryDate,
      warningWindow: 60,
      highPriorityWindow: 15,
    }),
  ].filter(
    (
      insight
    ): insight is MiraProactiveInsight =>
      insight !== null
  );

  insights.push(...expiryInsights);

  if ((documents.needsReviewCount ?? 0) > 0) {
    const count = documents.needsReviewCount ?? 0;

    insights.push({
      id: "documents-review",
      category: "document",
      priority: "medium",
      title: "Documents need review",
      message: `${count} ${pluralise(
        count,
        "document"
      )} ${count === 1 ? "needs" : "need"} your attention.`,
      action: {
        id: "review-documents",
        label: "Review Now",
        route: "/documents",
      },
      dismissible: true,
    });
  }

  if (
    (documents.expiringSoonCount ?? 0) > 0 &&
    expiryInsights.length === 0
  ) {
    const count = documents.expiringSoonCount ?? 0;

    insights.push({
      id: "documents-expiring-soon",
      category: "document",
      priority: "medium",
      title: "Documents expiring soon",
      message: `${count} vehicle ${pluralise(
        count,
        "document"
      )} ${count === 1 ? "is" : "are"} approaching expiry.`,
      action: {
        id: "review-expiring-documents",
        label: "Check Expiry Dates",
        route: "/documents",
      },
      dismissible: true,
    });
  }

  return insights;
}

function buildServiceInsights(
  context: MiraProactiveContext
): MiraProactiveInsight[] {
  const insights: MiraProactiveInsight[] = [];
  const service = context.service;

  if (!service) {
    return insights;
  }

  const serviceDays = daysUntil(service.nextServiceDate);

  let kilometresRemaining: number | null = null;

  if (
    service.nextServiceOdometer !== null &&
    service.nextServiceOdometer !== undefined &&
    service.currentOdometer !== null &&
    service.currentOdometer !== undefined
  ) {
    kilometresRemaining =
      service.nextServiceOdometer -
      service.currentOdometer;
  }

  const overdueByDate =
    serviceDays !== null && serviceDays < 0;

  const overdueByMileage =
    kilometresRemaining !== null &&
    kilometresRemaining < 0;

  if (overdueByDate || overdueByMileage) {
    const messageParts: string[] = [];

    if (overdueByDate && serviceDays !== null) {
      messageParts.push(
        `The scheduled service date passed ${Math.abs(
          serviceDays
        )} ${pluralise(Math.abs(serviceDays), "day")} ago.`
      );
    }

    if (
      overdueByMileage &&
      kilometresRemaining !== null
    ) {
      messageParts.push(
        `The service interval has been exceeded by approximately ${Math.abs(
          kilometresRemaining
        )} km.`
      );
    }

    insights.push({
      id: "service-overdue",
      category: "service",
      priority: "critical",
      title: "Vehicle service overdue",
      message: messageParts.join(" "),
      action: {
        id: "service-overdue-details",
        label: "View Service Options",
        route: "/workshops",
      },
      dismissible: false,
    });

    return insights;
  }

  const dateIsApproaching =
    serviceDays !== null &&
    serviceDays >= 0 &&
    serviceDays <= 30;

  const mileageIsApproaching =
    kilometresRemaining !== null &&
    kilometresRemaining >= 0 &&
    kilometresRemaining <= 1000;

  if (!dateIsApproaching && !mileageIsApproaching) {
    return insights;
  }

  const isHighPriority =
    (serviceDays !== null && serviceDays <= 7) ||
    (kilometresRemaining !== null &&
      kilometresRemaining <= 250);

  const messageParts: string[] = [];

  if (dateIsApproaching && serviceDays !== null) {
    messageParts.push(
      serviceDays === 0
        ? "Your scheduled vehicle service is due today."
        : `Your scheduled vehicle service is due in ${serviceDays} ${pluralise(
            serviceDays,
            "day"
          )}.`
    );
  }

  if (
    mileageIsApproaching &&
    kilometresRemaining !== null
  ) {
    messageParts.push(
      `Approximately ${kilometresRemaining} km remain before the next service.`
    );
  }

  insights.push({
    id: "next-service-due",
    category: "service",
    priority: isHighPriority ? "high" : "medium",
    title: "Next service approaching",
    message: messageParts.join(" "),
    action: {
      id: "service-details",
      label: "View Service Details",
      route: "/workshops",
    },
    dismissible: true,
  });

  return insights;
}

function buildHealthInsights(
  context: MiraProactiveContext
): MiraProactiveInsight[] {
  const insights: MiraProactiveInsight[] = [];
  const health = context.vehicleHealth;

  if (!health) {
    return insights;
  }

  if ((health.activeWarnings ?? 0) > 0) {
    const count = health.activeWarnings ?? 0;

    insights.push({
      id: "active-health-warnings",
      category: "vehicle_health",
      priority: "high",
      title: "Vehicle warning detected",
      message: `${count} vehicle health ${pluralise(
        count,
        "warning"
      )} ${count === 1 ? "requires" : "require"} attention.`,
      action: {
        id: "open-health",
        label: "Check Vehicle Health",
        route: "/vehicle-health",
      },
      dismissible: false,
    });
  }

  if (health.batteryStatus === "critical") {
    insights.push({
      id: "battery-critical",
      category: "vehicle_health",
      priority: "critical",
      title: "Battery attention required",
      message:
        "Your battery status indicates that immediate inspection may be required.",
      action: {
        id: "battery-help",
        label: "Ask Mira About Battery",
        message:
          "Mira, explain my battery warning and what I should do.",
      },
      dismissible: false,
    });
  } else if (health.batteryStatus === "check") {
    insights.push({
      id: "battery-check",
      category: "vehicle_health",
      priority: "medium",
      title: "Battery check recommended",
      message:
        "Your battery may need testing before it becomes unreliable.",
      action: {
        id: "battery-check-details",
        label: "Check Battery Guidance",
        route: "/vehicle-health",
      },
      dismissible: true,
    });
  }

  if (
    health.healthScore !== null &&
    health.healthScore !== undefined
  ) {
    const score = clampNumber(
      Math.round(health.healthScore),
      0,
      100
    );

    if (score < 70) {
      insights.push({
        id: "low-health-score",
        category: "vehicle_health",
        priority: score < 45 ? "critical" : "high",
        title: "Vehicle health needs attention",
        message: `Your current vehicle health score is ${score}%.`,
        action: {
          id: "view-health-score",
          label: "View Health Details",
          route: "/vehicle-health",
        },
        dismissible: true,
      });
    }
  }

  return insights;
}

function deduplicateInsights(
  insights: MiraProactiveInsight[]
): MiraProactiveInsight[] {
  const seen = new Set<string>();

  return insights.filter((insight) => {
    if (seen.has(insight.id)) {
      return false;
    }

    seen.add(insight.id);
    return true;
  });
}

function sortInsights(
  insights: MiraProactiveInsight[]
): MiraProactiveInsight[] {
  const priorityOrder: Record<
    MiraProactivePriority,
    number
  > = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
    info: 5,
  };

  return [...insights].sort((first, second) => {
    const priorityDifference =
      priorityOrder[first.priority] -
      priorityOrder[second.priority];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return first.title.localeCompare(second.title);
  });
}

export function generateMiraProactiveInsights(
  context: MiraProactiveContext
): MiraProactiveInsight[] {
  const insights = [
    ...buildDocumentInsights(context),
    ...buildServiceInsights(context),
    ...buildHealthInsights(context),
  ];

  if (!context.selectedVehicle) {
    insights.push({
      id: "select-vehicle",
      category: "general",
      priority: "info",
      title: "Select your vehicle",
      message:
        "Choose a vehicle so Mira can provide personalised reminders and recommendations.",
      action: {
        id: "choose-vehicle",
        label: "Select Vehicle",
        route: "/vehicle",
      },
      dismissible: false,
    });
  }

  if (!context.notificationsEnabled) {
    insights.push({
      id: "enable-notifications",
      category: "general",
      priority: "low",
      title: "Enable proactive alerts",
      message:
        "Allow notifications so Mira can alert you about document expiry, service dates and urgent vehicle issues.",
      action: {
        id: "notification-settings",
        label: "Enable Notifications",
        route: "/profile",
      },
      dismissible: true,
    });
  }

  return sortInsights(
    deduplicateInsights(insights)
  ).slice(0, 8);
}

export function buildMiraProactiveGreeting(
  context: MiraProactiveContext,
  insights: MiraProactiveInsight[]
): string {
  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

  const name = context.userName?.trim();

  if (insights.length === 0) {
    return `${greeting}${name ? `, ${name}` : ""}. Everything looks fine right now. How can I help you today?`;
  }

  const urgentCount = insights.filter(
    (insight) =>
      insight.priority === "critical" ||
      insight.priority === "high"
  ).length;

  if (urgentCount > 0) {
    return `${greeting}${name ? `, ${name}` : ""}. I found ${urgentCount} important ${pluralise(
      urgentCount,
      "item"
    )} that may need your attention.`;
  }

  return `${greeting}${name ? `, ${name}` : ""}. I found ${insights.length} ${pluralise(
    insights.length,
    "update"
  )} for your vehicle.`;
}