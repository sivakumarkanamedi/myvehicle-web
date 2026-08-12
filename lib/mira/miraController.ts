export type MiraIntent =
  | "emergency"
  | "documents"
  | "vehicle_health"
  | "service"
  | "navigation"
  | "fuel"
  | "challans"
  | "parked_location"
  | "vehicle_information"
  | "general_ai";

export type MiraDecision = {
  intent: MiraIntent;
  confidence: number;
  requiresLocation: boolean;
  requiresVehicle: boolean;
  requiresConfirmation: boolean;
  response?: string;
};

type IntentRule = {
  intent: Exclude<MiraIntent, "general_ai">;
  phrases: string[];
  keywords: string[];
  baseConfidence: number;
  requiresLocation:
    | boolean
    | ((message: string) => boolean);
  requiresVehicle: boolean;
  requiresConfirmation: boolean;
  response?: string;
};

const LOCATION_WORDS = [
  "near",
  "nearby",
  "nearest",
  "around me",
  "close to me",
  "my location",
  "current location",
  "here",
  "on my route",
  "along the route",
  "closest",
];

const EMERGENCY_RULE: IntentRule = {
  intent: "emergency",
  phrases: [
    "brake failed",
    "brakes failed",
    "vehicle is burning",
    "car is burning",
    "bike is burning",
    "engine is smoking",
    "need ambulance",
    "call ambulance",
    "need help immediately",
    "roadside emergency",
    "serious accident",
    "major accident",
    "airbag deployed",
    "vehicle rolled over",
    "car rolled over",
    "bike accident",
    "car accident",
    "someone is injured",
    "person is injured",
    "fuel is leaking",
    "petrol is leaking",
    "diesel is leaking",
    "cannot stop the vehicle",
    "vehicle caught fire",
  ],
  keywords: [
    "accident",
    "crash",
    "collision",
    "emergency",
    "sos",
    "ambulance",
    "injured",
    "fire",
    "burning",
    "rollover",
  ],
  baseConfidence: 0.98,
  requiresLocation: true,
  requiresVehicle: true,
  requiresConfirmation: true,
  response:
    "This may be an emergency. I can help you contact emergency services, share your location, notify your emergency contact or request roadside assistance.",
};

const INTENT_RULES: IntentRule[] = [
  {
    intent: "parked_location",
    phrases: [
      "parked location",
      "where is my vehicle",
      "where is my car",
      "where is my bike",
      "find my vehicle",
      "find my car",
      "find my bike",
      "last parked",
      "saved parking",
      "parking location",
      "where did i park",
      "locate my vehicle",
    ],
    keywords: ["parked", "parking", "locate"],
    baseConfidence: 0.96,
    requiresLocation: true,
    requiresVehicle: true,
    requiresConfirmation: false,
  },
  {
    intent: "challans",
    phrases: [
      "traffic fine",
      "traffic fines",
      "pending fine",
      "pending fines",
      "e challan",
      "e-challan",
      "check challan",
      "check challans",
      "pending challan",
      "pending challans",
      "traffic ticket",
      "traffic tickets",
    ],
    keywords: ["challan", "challans", "echallan", "fine", "fines"],
    baseConfidence: 0.96,
    requiresLocation: false,
    requiresVehicle: true,
    requiresConfirmation: false,
  },
  {
    intent: "fuel",
    phrases: [
      "fuel price",
      "petrol price",
      "diesel price",
      "fuel station",
      "petrol pump",
      "ev charger",
      "charging station",
      "charge my vehicle",
      "nearest petrol pump",
      "nearest fuel station",
      "nearest charger",
      "low fuel",
      "fuel is low",
      "battery charging",
      "charging point",
      "ev charging",
    ],
    keywords: [
      "fuel",
      "petrol",
      "diesel",
      "mileage",
      "charger",
      "charging",
      "cng",
    ],
    baseConfidence: 0.93,
    requiresLocation: (message) =>
      containsAny(message, LOCATION_WORDS) ||
      containsAny(message, [
        "station",
        "pump",
        "charger",
        "charging point",
      ]),
    requiresVehicle: false,
    requiresConfirmation: false,
  },
  {
    intent: "navigation",
    phrases: [
      "take me to",
      "go to",
      "navigate to",
      "show route",
      "alternate route",
      "alternative route",
      "avoid traffic",
      "avoid toll",
      "signal timing",
      "traffic signal",
      "live traffic",
      "route guidance",
      "start navigation",
      "open navigation",
      "how do i reach",
      "directions to",
      "traffic ahead",
    ],
    keywords: [
      "navigate",
      "navigation",
      "route",
      "directions",
      "traffic",
      "toll",
      "signal",
      "destination",
      "eta",
    ],
    baseConfidence: 0.92,
    requiresLocation: true,
    requiresVehicle: false,
    requiresConfirmation: false,
  },
  {
    intent: "vehicle_health",
    phrases: [
      "vehicle health",
      "car health",
      "bike health",
      "engine light",
      "warning light",
      "battery health",
      "brake noise",
      "engine overheating",
      "tyre pressure",
      "tire pressure",
      "strange noise",
      "vehicle problem",
      "car problem",
      "bike problem",
      "not starting",
      "won't start",
      "will not start",
      "engine problem",
      "battery problem",
      "brake problem",
      "steering problem",
      "check engine",
      "engine warning",
      "car shaking",
      "vehicle vibrating",
      "smell from engine",
      "oil warning",
      "temperature warning",
    ],
    keywords: [
      "overheating",
      "battery",
      "brake",
      "engine",
      "tyre",
      "tire",
      "warning",
      "noise",
      "vibration",
      "smoke",
      "leak",
      "starting",
    ],
    baseConfidence: 0.93,
    requiresLocation: false,
    requiresVehicle: true,
    requiresConfirmation: false,
  },
  {
    intent: "service",
    phrases: [
      "next service",
      "book service",
      "service history",
      "oil change",
      "engine oil",
      "service centre",
      "service center",
      "nearby workshop",
      "nearest workshop",
      "nearby mechanic",
      "nearest mechanic",
      "maintenance schedule",
      "service reminder",
      "repair estimate",
      "book a workshop",
      "schedule service",
      "roadside assistance",
    ],
    keywords: [
      "service",
      "maintenance",
      "workshop",
      "mechanic",
      "repair",
      "garage",
    ],
    baseConfidence: 0.91,
    requiresLocation: (message) =>
      containsAny(message, LOCATION_WORDS) ||
      containsAny(message, [
        "workshop",
        "mechanic",
        "garage",
        "service centre",
        "service center",
      ]),
    requiresVehicle: true,
    requiresConfirmation: false,
  },
  {
    intent: "documents",
    phrases: [
      "registration certificate",
      "driving licence",
      "driving license",
      "pollution certificate",
      "insurance document",
      "insurance policy",
      "insurance expiry",
      "insurance renewal",
      "puc expiry",
      "rc expiry",
      "dl expiry",
      "document expiry",
      "missing documents",
      "vehicle documents",
      "show my rc",
      "show my insurance",
      "show my puc",
      "show my dl",
      "open documents",
      "fastag document",
    ],
    keywords: [
      "document",
      "documents",
      "rc",
      "dl",
      "insurance",
      "puc",
      "fastag",
      "expiry",
      "expires",
      "expired",
      "policy",
      "licence",
      "license",
    ],
    baseConfidence: 0.94,
    requiresLocation: false,
    requiresVehicle: true,
    requiresConfirmation: false,
  },
  {
    intent: "vehicle_information",
    phrases: [
      "vehicle comparison",
      "petrol vs diesel",
      "ev vs petrol",
      "what is abs",
      "what is adas",
      "what is esp",
      "what is traction control",
      "what is cruise control",
      "explain engine",
      "best car",
      "best bike",
      "which car",
      "which bike",
      "compare cars",
      "compare bikes",
      "car features",
      "bike features",
      "vehicle specifications",
      "pros and cons",
      "on road price",
      "ex showroom price",
    ],
    keywords: [
      "compare",
      "comparison",
      "features",
      "specifications",
      "specs",
      "variant",
      "model",
      "abs",
      "adas",
      "esp",
    ],
    baseConfidence: 0.89,
    requiresLocation: false,
    requiresVehicle: false,
    requiresConfirmation: false,
  },
];

function normalizeMessage(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\u0900-\u097f\u0C80-\u0CFF\u0C00-\u0C7F\u0B80-\u0BFF\u0D00-\u0D7F\u0980-\u09FF\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(message: string, phrase: string): boolean {
  const escaped = phrase
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i").test(message);
}

function containsAny(message: string, keywords: string[]): boolean {
  return keywords.some((keyword) => containsPhrase(message, keyword));
}

function countMatches(
  message: string,
  values: string[]
): number {
  return values.reduce(
    (count, value) =>
      containsPhrase(message, value) ? count + 1 : count,
    0
  );
}

function calculateRuleScore(
  message: string,
  rule: IntentRule
): {
  score: number;
  phraseMatches: number;
  keywordMatches: number;
} {
  const phraseMatches = countMatches(message, rule.phrases);
  const keywordMatches = countMatches(message, rule.keywords);

  const score =
    phraseMatches * 5 +
    keywordMatches * 2 +
    (phraseMatches > 0 && keywordMatches > 0 ? 2 : 0);

  return {
    score,
    phraseMatches,
    keywordMatches,
  };
}

function calculateConfidence(
  rule: IntentRule,
  phraseMatches: number,
  keywordMatches: number,
  winningScore: number,
  secondScore: number
): number {
  let confidence = rule.baseConfidence;

  if (phraseMatches > 0) {
    confidence += Math.min(phraseMatches * 0.015, 0.04);
  }

  if (keywordMatches >= 2) {
    confidence += 0.015;
  }

  if (winningScore - secondScore <= 1) {
    confidence -= 0.06;
  } else if (winningScore - secondScore <= 3) {
    confidence -= 0.025;
  }

  return Number(
    Math.max(0.55, Math.min(confidence, 0.99)).toFixed(2)
  );
}

function isNonEmergencyHistoricalQuestion(
  message: string
): boolean {
  return containsAny(message, [
    "what causes an accident",
    "how to avoid an accident",
    "accident prevention",
    "crash test",
    "collision warning",
    "explain collision",
    "accident history",
    "insurance after accident",
  ]);
}

function decideEmergency(message: string): MiraDecision | null {
  if (isNonEmergencyHistoricalQuestion(message)) {
    return null;
  }

  const phraseMatches = countMatches(
    message,
    EMERGENCY_RULE.phrases
  );
  const keywordMatches = countMatches(
    message,
    EMERGENCY_RULE.keywords
  );

  const urgentLanguage = containsAny(message, [
    "now",
    "immediately",
    "help",
    "urgent",
    "quick",
    "please help",
    "right now",
  ]);

  const strongEmergency =
    phraseMatches > 0 ||
    keywordMatches >= 2 ||
    (keywordMatches >= 1 && urgentLanguage);

  if (!strongEmergency) {
    return null;
  }

  return {
    intent: "emergency",
    confidence: phraseMatches > 0 ? 0.99 : 0.97,
    requiresLocation: true,
    requiresVehicle: true,
    requiresConfirmation: true,
    response: EMERGENCY_RULE.response,
  };
}

export function decideMiraIntent(
  userMessage: string
): MiraDecision {
  const message = normalizeMessage(userMessage);

  if (!message) {
    return {
      intent: "general_ai",
      confidence: 0.5,
      requiresLocation: false,
      requiresVehicle: false,
      requiresConfirmation: false,
    };
  }

  const emergencyDecision = decideEmergency(message);

  if (emergencyDecision) {
    return emergencyDecision;
  }

  const rankedRules = INTENT_RULES.map((rule) => {
    const result = calculateRuleScore(message, rule);

    return {
      rule,
      ...result,
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const winner = rankedRules[0];

  if (!winner) {
    return {
      intent: "general_ai",
      confidence: 0.67,
      requiresLocation: false,
      requiresVehicle: false,
      requiresConfirmation: false,
    };
  }

  const secondScore = rankedRules[1]?.score ?? 0;

  return {
    intent: winner.rule.intent,
    confidence: calculateConfidence(
      winner.rule,
      winner.phraseMatches,
      winner.keywordMatches,
      winner.score,
      secondScore
    ),
    requiresLocation:
      typeof winner.rule.requiresLocation === "function"
        ? winner.rule.requiresLocation(message)
        : winner.rule.requiresLocation,
    requiresVehicle: winner.rule.requiresVehicle,
    requiresConfirmation:
      winner.rule.requiresConfirmation,
    response: winner.rule.response,
  };
}