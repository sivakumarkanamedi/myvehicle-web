import type {
  MiraDecision,
  MiraIntent,
} from "./miraController";

import type {
  MiraContextCheck,
  MiraUserContext,
} from "./miraContext";

export type MiraActionType =
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

export type MiraAction = {
  type: MiraActionType;
  route?: string;
  message?: string;
  requiresConfirmation?: boolean;
};

export type MiraExecutionPlan = {
  intent: MiraIntent;
  source:
    | "my_vehicle"
    | "live_integration"
    | "openai"
    | "emergency";
  actions: MiraAction[];
  shouldUseAI: boolean;
  response?: string;
};

function buildMissingContextPlan(
  decision: MiraDecision,
  contextCheck: MiraContextCheck
): MiraExecutionPlan {
  const actions: MiraAction[] = [];

  if (contextCheck.missing.includes("vehicle")) {
    actions.push({
      type: "request_vehicle",
      route: "/vehicle",
      message: "Please select a vehicle first.",
    });
  }

  if (contextCheck.missing.includes("location")) {
    actions.push({
      type: "request_location",
      message: "Location permission is required.",
    });
  }

  if (contextCheck.missing.includes("emergency_contact")) {
    actions.push({
      type: "request_emergency_contact",
      route: "/profile",
      message: "Please add an emergency contact.",
    });
  }

  if (contextCheck.missing.includes("notification")) {
    actions.push({
      type: "request_notification",
      route: "/profile",
      message: "Please allow notifications for reminders and alerts.",
    });
  }

  return {
    intent: decision.intent,
    source: "my_vehicle",
    actions,
    shouldUseAI: contextCheck.canContinueWithLimitedSupport,
    response:
      contextCheck.response ||
      "I need a little more information before I can help.",
  };
}

function createAIPlan(
  intent: MiraIntent,
  response?: string
): MiraExecutionPlan {
  return {
    intent,
    source: "openai",
    shouldUseAI: true,
    response,
    actions: [
      {
        type: "use_ai",
      },
    ],
  };
}

export function decideMiraExecution(
  decision: MiraDecision,
  context: MiraUserContext,
  contextCheck: MiraContextCheck
): MiraExecutionPlan {
  if (decision.intent === "emergency") {
    return {
      intent: "emergency",
      source: "emergency",
      shouldUseAI: false,
      response:
        decision.response ||
        "This may be an emergency. I can help you contact emergency services, share your location, notify your emergency contact or request roadside assistance.",
      actions: [
        {
          type: "emergency_mode",
          requiresConfirmation: false,
        },
      ],
    };
  }

  if (!contextCheck.ready) {
    return buildMissingContextPlan(decision, contextCheck);
  }

  switch (decision.intent) {
    case "documents":
      return {
        intent: decision.intent,
        source: "my_vehicle",
        shouldUseAI: false,
        response:
          context.documents && context.documents.total > 0
            ? "I found the document summary for your selected vehicle."
            : "I’ll open the documents section for your selected vehicle.",
        actions: [
          {
            type: "fetch_documents",
            route: "/documents",
          },
        ],
      };

    case "vehicle_health":
      return {
        intent: decision.intent,
        source: "my_vehicle",
        shouldUseAI: true,
        response:
          "I’ll check your available vehicle health information and explain anything that may need attention.",
        actions: [
          {
            type: "fetch_vehicle_health",
            route: "/vehicle-health",
          },
          {
            type: "use_ai",
          },
        ],
      };

    case "service":
      return {
        intent: decision.intent,
        source: decision.requiresLocation
          ? "live_integration"
          : "my_vehicle",
        shouldUseAI: true,
        response:
          decision.requiresLocation
            ? "I’ll use your location to help find suitable service options."
            : "I’ll check your service information and help you understand the next steps.",
        actions: [
          {
            type: "fetch_service_data",
            route: "/workshops",
          },
          ...(decision.requiresLocation
            ? [
                {
                  type: "fetch_live_data" as const,
                  route: "/workshops",
                },
              ]
            : []),
          {
            type: "use_ai",
          },
        ],
      };

    case "navigation":
      return {
        intent: decision.intent,
        source: "live_integration",
        shouldUseAI: false,
        response:
          "I’ll open My Vehicle Navigation. Live routing, traffic and signal information require the connected map provider.",
        actions: [
          {
            type: "open_route",
            route: "/navigation",
          },
          {
            type: "fetch_live_data",
            route: "/navigation",
          },
        ],
      };

    case "fuel":
      return {
        intent: decision.intent,
        source: "live_integration",
        shouldUseAI: false,
        response:
          "I’ll open the fuel and charging section. Live prices and nearby availability require location and provider data.",
        actions: [
          {
            type: "open_route",
            route: "/fuel",
          },
          {
            type: "fetch_live_data",
            route: "/fuel",
          },
        ],
      };

    case "challans":
      return {
        intent: decision.intent,
        source: "live_integration",
        shouldUseAI: false,
        response:
          "I’ll open the challan section for your selected vehicle. A connected government service is required for confirmed live challan results.",
        actions: [
          {
            type: "fetch_challans",
            route: "/challans",
          },
        ],
      };

    case "parked_location":
      return {
        intent: decision.intent,
        source: "my_vehicle",
        shouldUseAI: false,
        response:
          "I’ll check the last saved parking location for your selected vehicle.",
        actions: [
          {
            type: "fetch_parked_location",
            route: "/mira",
          },
        ],
      };

    case "vehicle_information":
      return createAIPlan(
        decision.intent,
        "I’ll help with the vehicle information, comparison or explanation you requested."
      );

    case "general_ai":
    default:
      return createAIPlan(decision.intent);
  }
}