export type MiraVehicleContext = {
  id: number | string;
  make?: string | null;
  model?: string | null;
  registrationNumber?: string | null;
  fuelType?: string | null;
  year?: number | null;
};

export type MiraDocumentSummary = {
  total: number;
  verified: number;
  needsReview: number;
  expired: number;
  expiringSoon: number;
};

export type MiraUserContext = {
  userId?: string;
  fullName?: string | null;
  preferredLanguage?: string | null;
  selectedVehicle?: MiraVehicleContext | null;
  documents?: MiraDocumentSummary | null;
  hasLocationPermission: boolean;
  hasNotificationPermission: boolean;
  hasEmergencyContact: boolean;
};

export type MiraContextRequirement =
  | "vehicle"
  | "location"
  | "emergency_contact"
  | "notification";

export type MiraContextRequirements = {
  requiresVehicle: boolean;
  requiresLocation: boolean;
  requiresEmergencyContact?: boolean;
  requiresNotification?: boolean;
};

export type MiraContextCheck = {
  ready: boolean;
  missing: MiraContextRequirement[];
  response?: string;
  canContinueWithLimitedSupport: boolean;
};

function hasUsableVehicle(
  vehicle?: MiraVehicleContext | null
): boolean {
  if (!vehicle) return false;

  return (
    vehicle.id !== undefined &&
    vehicle.id !== null &&
    String(vehicle.id).trim().length > 0
  );
}

function buildMissingContextResponse(
  missing: MiraContextRequirement[]
): string {
  const missingVehicle = missing.includes("vehicle");
  const missingLocation = missing.includes("location");
  const missingEmergencyContact =
    missing.includes("emergency_contact");
  const missingNotification = missing.includes("notification");

  if (
    missingVehicle &&
    missingLocation &&
    missingEmergencyContact
  ) {
    return "Please select a vehicle, allow location access and add an emergency contact so I can safely complete this request.";
  }

  if (missingVehicle && missingLocation) {
    return "Please select a vehicle and allow location access so I can help with this request.";
  }

  if (missingLocation && missingEmergencyContact) {
    return "Please allow location access and add an emergency contact so I can assist safely.";
  }

  if (missingVehicle && missingEmergencyContact) {
    return "Please select a vehicle and add an emergency contact before continuing.";
  }

  if (missingVehicle) {
    return "Please select a vehicle first so I can give you the correct information.";
  }

  if (missingLocation) {
    return "I need your location permission to help with this request.";
  }

  if (missingEmergencyContact) {
    return "Please add an emergency contact in your profile so I can notify them during an emergency.";
  }

  if (missingNotification) {
    return "Please allow notifications so Mira can send reminders and important vehicle alerts.";
  }

  return "Some required information or permissions are missing. Please review your My Vehicle settings and try again.";
}

function canContinueWithout(
  missing: MiraContextRequirement[]
): boolean {
  if (missing.includes("emergency_contact")) {
    return false;
  }

  if (missing.includes("vehicle")) {
    return false;
  }

  return missing.every(
    (item) =>
      item === "location" || item === "notification"
  );
}

export function checkMiraContext(
  context: MiraUserContext,
  requirements: MiraContextRequirements
): MiraContextCheck {
  const missing: MiraContextRequirement[] = [];

  if (
    requirements.requiresVehicle &&
    !hasUsableVehicle(context.selectedVehicle)
  ) {
    missing.push("vehicle");
  }

  if (
    requirements.requiresLocation &&
    !context.hasLocationPermission
  ) {
    missing.push("location");
  }

  if (
    requirements.requiresEmergencyContact &&
    !context.hasEmergencyContact
  ) {
    missing.push("emergency_contact");
  }

  if (
    requirements.requiresNotification &&
    !context.hasNotificationPermission
  ) {
    missing.push("notification");
  }

  if (missing.length === 0) {
    return {
      ready: true,
      missing: [],
      canContinueWithLimitedSupport: false,
    };
  }

  return {
    ready: false,
    missing,
    response: buildMissingContextResponse(missing),
    canContinueWithLimitedSupport: canContinueWithout(
      missing
    ),
  };
}

export function getMiraContextSummary(
  context: MiraUserContext
): string {
  const vehicle = context.selectedVehicle;

  const vehicleName = vehicle
    ? [vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ")
        .trim()
    : "";

  const documentSummary = context.documents
    ? [
        `${context.documents.total} total`,
        `${context.documents.verified} verified`,
        `${context.documents.needsReview} need review`,
        `${context.documents.expired} expired`,
        `${context.documents.expiringSoon} expiring soon`,
      ].join(", ")
    : "No document summary available";

  return [
    `User: ${context.fullName || "Unknown"}`,
    `Preferred language: ${
      context.preferredLanguage || "Not set"
    }`,
    `Vehicle: ${
      vehicle
        ? vehicleName ||
          vehicle.registrationNumber ||
          String(vehicle.id)
        : "Not selected"
    }`,
    `Registration number: ${
      vehicle?.registrationNumber || "Not available"
    }`,
    `Fuel type: ${vehicle?.fuelType || "Not available"}`,
    `Vehicle year: ${vehicle?.year || "Not available"}`,
    `Documents: ${documentSummary}`,
    `Location permission: ${
      context.hasLocationPermission ? "Granted" : "Not granted"
    }`,
    `Notification permission: ${
      context.hasNotificationPermission
        ? "Granted"
        : "Not granted"
    }`,
    `Emergency contact: ${
      context.hasEmergencyContact
        ? "Available"
        : "Not available"
    }`,
  ].join("\n");
}