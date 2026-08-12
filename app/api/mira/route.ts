import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeRateLimit } from "../../../lib/rateLimit";

import {
  decideMiraIntent,
  type MiraDecision,
} from "../../../lib/mira/miraController";

import {
  checkMiraContext,
  getMiraContextSummary,
  type MiraDocumentSummary,
  type MiraUserContext,
  type MiraVehicleContext,
} from "../../../lib/mira/miraContext";

import { decideMiraExecution } from "../../../lib/mira/miraDecision";

export const runtime = "nodejs";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function createAuthClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

type ConversationMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type IncomingVehicle = {
  id?: number | string | null;
  displayName?: string | null;
  vehicleName?: string | null;
  registrationNumber?: string | null;
  vehicleType?: string | null;
  brand?: string | null;
  make?: string | null;
  model?: string | null;
  manufacturingYear?: number | null;
  year?: number | null;
  fuelType?: string | null;
  odometer?: number | null;
  color?: string | null;
};

type IncomingDocuments = {
  total?: number;
  verified?: number;
  needsReview?: number;
  needsReviewCount?: number;
  expired?: number;
  expiredCount?: number;
  expiringSoon?: number;
  expiringSoonCount?: number;
  insurancePresent?: boolean;
  pucPresent?: boolean;
  rcPresent?: boolean;
  drivingLicencePresent?: boolean;
  insuranceExpiryDate?: string | null;
  pucExpiryDate?: string | null;
  rcExpiryDate?: string | null;
  drivingLicenceExpiryDate?: string | null;
};

type IncomingVehicleContext = {
  vehicle?: IncomingVehicle | null;
  documents?: IncomingDocuments | null;
  fastag?: {
    eligible?: boolean;
    balance?: number | null;
  } | null;
  latestService?: {
    serviceType?: string | null;
    workshopName?: string | null;
    serviceDate?: string | null;
    odometer?: number | null;
    totalCost?: number | null;
  } | null;
};

type MiraRequestBody = {
  message?: string;
  language?: string;
  conversation?: ConversationMessage[];
  vehicleContext?: IncomingVehicleContext | null;
  userContext?: {
    userId?: string;
    fullName?: string | null;
    preferredLanguage?: string | null;
    hasLocationPermission?: boolean;
    hasNotificationPermission?: boolean;
    hasEmergencyContact?: boolean;
  } | null;
};

type OpenAIError = {
  status?: number;
  code?: string;
  message?: string;
};

function getIntentInstructions(decision: MiraDecision): string {
  switch (decision.intent) {
    case "documents":
      return `
The user is asking about vehicle documents.

Help with:
- RC
- Driving Licence
- Insurance
- PUC
- FASTag
- Document expiry
- Missing documents
- Document explanations

Use only the vehicle context supplied below.
Never claim that you checked a document or government database unless the supplied context confirms it.
`;

    case "vehicle_health":
      return `
The user is asking about vehicle health or a possible mechanical problem.

Ask relevant follow-up questions when information is insufficient.
Explain possible causes clearly.
Do not present guesses as confirmed diagnoses.
Advise professional inspection when required.
If the issue may be dangerous, tell the user to stop safely.
`;

    case "service":
      return `
The user is asking about service, repairs, workshops or maintenance.

Help with:
- Service schedules
- Maintenance guidance
- Engine oil
- Repairs
- Workshop preparation
- Questions to ask a mechanic

Use the supplied latest-service context when available.
Never claim that a service has been booked unless a confirmed booking integration says so.
`;

    case "navigation":
      return `
The user is asking about navigation, routes, traffic, parking, tolls or traffic signals.

Do not invent live routes, traffic conditions, closures or signal timings.
Clearly state when live map, GPS or traffic integration is required.
`;

    case "fuel":
      return `
The user is asking about petrol, diesel, mileage, fuel stations or EV charging.

Do not invent live fuel prices, nearby stations or charger availability.
Clearly state when location or a live provider integration is required.
`;

    case "challans":
      return `
The user is asking about traffic challans or fines.

Explain what information is required.
Never claim that a government challan database was checked unless a real integration confirms it.
`;

    case "parked_location":
      return `
The user is asking about their vehicle's parked location.

Do not invent a location.
Explain that My Vehicle must have a saved GPS or parking location to display it.
`;

    case "vehicle_information":
      return `
The user is asking for vehicle knowledge, comparisons or buying guidance.

Give balanced and practical information.
Mention when prices, variants or specifications require current verification.
Do not present uncertain specifications as confirmed facts.
`;

    case "general_ai":
      return `
The user may ask about general knowledge or everyday conversation.

Answer naturally as Mira.
Remain especially strong on vehicles, mobility, driving and travel.
`;

    default:
      return "";
  }
}

function toVehicleContext(
  incoming?: IncomingVehicle | null
): MiraVehicleContext | null {
  if (!incoming?.id) {
    return null;
  }

  return {
    id: incoming.id,
    make:
      incoming.make ||
      incoming.brand ||
      incoming.vehicleName ||
      incoming.displayName ||
      null,
    model: incoming.model || null,
    registrationNumber:
      incoming.registrationNumber || null,
    fuelType: incoming.fuelType || null,
    year:
      incoming.year ||
      incoming.manufacturingYear ||
      null,
  };
}

function toDocumentSummary(
  incoming?: IncomingDocuments | null
): MiraDocumentSummary | null {
  if (!incoming) {
    return null;
  }

  return {
    total: incoming.total ?? 0,
    verified:
      incoming.verified ??
      Math.max(
        0,
        (incoming.total ?? 0) -
          (incoming.needsReviewCount ??
            incoming.needsReview ??
            0) -
          (incoming.expiredCount ??
            incoming.expired ??
            0)
      ),
    needsReview:
      incoming.needsReviewCount ??
      incoming.needsReview ??
      0,
    expired:
      incoming.expiredCount ??
      incoming.expired ??
      0,
    expiringSoon:
      incoming.expiringSoonCount ??
      incoming.expiringSoon ??
      0,
  };
}

function buildUserContext(
  body: MiraRequestBody,
  authenticatedUserId: string
): MiraUserContext {
  return {
    userId: authenticatedUserId,
    fullName: body.userContext?.fullName ?? null,
    preferredLanguage:
      body.language ||
      body.userContext?.preferredLanguage ||
      null,
    selectedVehicle: toVehicleContext(
      body.vehicleContext?.vehicle
    ),
    documents: toDocumentSummary(
      body.vehicleContext?.documents
    ),
    hasLocationPermission:
      body.userContext?.hasLocationPermission ?? false,
    hasNotificationPermission:
      body.userContext?.hasNotificationPermission ?? false,
    hasEmergencyContact:
      body.userContext?.hasEmergencyContact ?? false,
  };
}

function sanitizeConversation(
  conversation: ConversationMessage[] | undefined,
  currentMessage: string
): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  const cleaned = (conversation ?? [])
    .filter(
      (
        item
      ): item is {
        role: "user" | "assistant";
        content: string;
      } =>
        (item.role === "user" ||
          item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));

  const lastMessage = cleaned.at(-1);

  if (
    !lastMessage ||
    lastMessage.role !== "user" ||
    lastMessage.content !== currentMessage
  ) {
    cleaned.push({
      role: "user",
      content: currentMessage,
    });
  }

  return cleaned;
}

function buildVehicleDetails(
  vehicleContext?: IncomingVehicleContext | null
): string {
  if (!vehicleContext) {
    return "No detailed vehicle dashboard context was supplied.";
  }

  return JSON.stringify(
    {
      vehicle: vehicleContext.vehicle ?? null,
      documents: vehicleContext.documents ?? null,
      fastag: vehicleContext.fastag ?? null,
      latestService:
        vehicleContext.latestService ?? null,
    },
    null,
    2
  );
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Authentication is required to use Mira.",
        },
        { status: 401 }
      );
    }

    const supabase = createAuthClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Your login session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const rateLimit = await consumeRateLimit({
      userId: user.id,
      key: "mira_chat",
      windowSeconds: 60,
      maxRequests: 20,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many Mira requests. Please wait a moment and try again.",
          retry_after: rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": rateLimit.resetAt,
          },
        }
      );
    }

    const body = (await request.json()) as MiraRequestBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "Please enter a message.",
        },
        { status: 400 }
      );
    }

    const decision = decideMiraIntent(message);
    const context = buildUserContext(body, user.id);

    const contextCheck = checkMiraContext(context, {
      requiresVehicle: decision.requiresVehicle,
      requiresLocation: decision.requiresLocation,
      requiresEmergencyContact:
        decision.intent === "emergency",
    });

    const executionPlan = decideMiraExecution(
      decision,
      context,
      contextCheck
    );

    if (executionPlan.source === "emergency") {
      return NextResponse.json({
        reply:
          executionPlan.response ||
          "This may be an emergency. Stop the vehicle safely if possible and contact emergency services immediately.",
        mode: "emergency",
        intent: decision.intent,
        decision,
        executionPlan,
        actions: [
          {
            id: "call-emergency",
            label: "Call Emergency Services",
          },
          {
            id: "share-location",
            label: "Share My Location",
          },
          {
            id: "contact-family",
            label: "Contact Emergency Person",
          },
          {
            id: "roadside-assistance",
            label: "Request Roadside Assistance",
          },
        ],
      });
    }

    if (!executionPlan.shouldUseAI) {
      return NextResponse.json({
        reply:
          executionPlan.response ||
          "I have prepared the correct My Vehicle action for your request.",
        mode: "action",
        intent: decision.intent,
        decision,
        executionPlan,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        reply:
          executionPlan.response ||
          "I understood your request, but my AI connection is not active yet. You can continue using the available My Vehicle features.",
        mode: "fallback",
        intent: decision.intent,
        decision,
        executionPlan,
      });
    }

    const openai = new OpenAI({
      apiKey,
    });

    const intentInstructions =
      getIntentInstructions(decision);

    const conversation = sanitizeConversation(
      body.conversation,
      message
    );

    const response = await openai.responses.create({
      model: "gpt-5",
      instructions: `
You are Mira, the proactive AI companion inside the My Vehicle application.

IDENTITY

You are vehicle-first, but not vehicle-only.

Your strongest expertise is vehicle ownership, mobility, travel and road safety.
You should also behave like a capable everyday AI companion for safe general topics.

YOU CAN HELP WITH

VEHICLE AND MOBILITY
- Vehicles
- Mobility
- Driving
- Navigation
- Travel
- Repairs
- Maintenance
- Insurance
- RC
- Driving Licence
- PUC
- Challans
- Service reminders
- Workshops
- Roadside assistance
- Vehicle documents
- Vehicle comparisons
- SOS and accident guidance
- Trip planning

GENERAL TOPICS
- General knowledge
- Places, cities and countries
- Geography
- Nature
- History
- Culture
- Science
- Technology
- Artificial intelligence
- Weather
- News
- Sports
- Movies
- Music
- Books
- Languages
- Careers
- Motivation
- Fitness
- Cooking
- Everyday conversation

GENERAL TOPIC RULES

- Answer safe general questions naturally.
- Never say that you are only a vehicle assistant.
- When the topic is unrelated to vehicles, answer directly and helpfully.
- For current news, weather, sports scores, prices, laws, regulations or other changing information, never invent an answer.
- Clearly say that live verification is required unless a connected live source is available.
- For controversial topics, remain neutral, factual and non-persuasive.
- Do not promote political parties, candidates, religious beliefs, ideologies or extremist viewpoints.
- You may provide balanced educational explanations of political, religious, historical or social topics.
- Clearly separate established facts, disputed claims and opinions.
- Do not present rumours or allegations as facts.
- Avoid inflammatory, hateful or demeaning content about protected groups.
- When reliable information is unavailable, say so.

SAFETY BOUNDARIES

- Refuse instructions that enable violence, self-harm, illegal activity, weapons misuse, hacking, fraud or dangerous wrongdoing.
- Refuse explicit sexual content.
- Do not provide hate, harassment or extremist propaganda.
- Do not diagnose medical conditions.
- You may provide basic first-aid and emergency guidance while encouraging professional help.
- Do not give personalized legal, medical or investment decisions as certainty.
- Never shame or insult the user.
- Keep refusals brief, calm and helpful.

BEHAVIOUR

- Always respond as Mira.
- Be friendly, calm, natural and useful.
- Keep answers clear and conversational.
- Use the user's preferred language when possible.
- Ask one focused follow-up question only when necessary.
- Never invent user vehicle data.
- Never invent live location, traffic, weather, prices, closures or availability.
- Never claim an action was completed without confirmation from an integration.
- Clearly distinguish facts, possibilities and recommendations.
- For safety, legal, financial or mechanical matters, recommend verification.
- Prioritize practical help over long explanations.
- Do not repeat internal classifications, confidence scores or execution plans to the user.

CURRENT REQUEST CLASSIFICATION

Intent: ${decision.intent}
Confidence: ${decision.confidence}
Requires location: ${decision.requiresLocation}
Requires selected vehicle: ${decision.requiresVehicle}
Requires confirmation: ${decision.requiresConfirmation}

EXECUTION PLAN

Source: ${executionPlan.source}
Should use AI: ${executionPlan.shouldUseAI}
Planned actions: ${executionPlan.actions
        .map((action) => action.type)
        .join(", ")}

USER CONTEXT

${getMiraContextSummary(context)}

DETAILED VEHICLE DASHBOARD CONTEXT

${buildVehicleDetails(body.vehicleContext)}

INTENT-SPECIFIC GUIDANCE

${intentInstructions}
`,
      input: conversation,
      max_output_tokens: 600,
    });

    const reply = response.output_text?.trim();

    if (!reply) {
      return NextResponse.json(
        {
          error: "Mira did not return a response.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply,
      mode: "ai",
      intent: decision.intent,
      decision,
      executionPlan,
    });
  } catch (error: unknown) {
    console.error("Mira API Error:", error);

    const apiError = error as OpenAIError;

    if (
      apiError.status === 429 ||
      apiError.code === "insufficient_quota"
    ) {
      return NextResponse.json({
        reply:
          "My AI connection is temporarily unavailable because the API quota has been reached. You can continue using the other My Vehicle features while full Mira AI access is restored.",
        mode: "fallback",
      });
    }

    return NextResponse.json(
      {
        error:
          apiError.message ||
          "Mira is temporarily unavailable. Please try again.",
      },
      { status: 500 }
    );
  }
}