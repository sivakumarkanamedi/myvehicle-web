export type MiraMemoryRole = "user" | "mira";

export type MiraMemoryMessage = {
  role: MiraMemoryRole;
  text: string;
  createdAt: string;
};

export type MiraPendingAction = {
  id: string;
  title: string;
  status: "pending" | "completed" | "dismissed";
  createdAt: string;
};

export type MiraConversationMemory = {
  userId?: string;
  selectedVehicleId?: string | number | null;
  preferredLanguage?: string | null;
  recentMessages: MiraMemoryMessage[];
  pendingActions: MiraPendingAction[];
  lastIntent?: string | null;
  updatedAt: string;
};

const MAX_RECENT_MESSAGES = 12;

export function createEmptyMiraMemory(
  userId?: string
): MiraConversationMemory {
  return {
    userId,
    selectedVehicleId: null,
    preferredLanguage: null,
    recentMessages: [],
    pendingActions: [],
    lastIntent: null,
    updatedAt: new Date().toISOString(),
  };
}

export function addMiraMessage(
  memory: MiraConversationMemory,
  message: MiraMemoryMessage
): MiraConversationMemory {
  const recentMessages = [
    ...memory.recentMessages,
    message,
  ].slice(-MAX_RECENT_MESSAGES);

  return {
    ...memory,
    recentMessages,
    updatedAt: new Date().toISOString(),
  };
}

export function setMiraLastIntent(
  memory: MiraConversationMemory,
  intent: string
): MiraConversationMemory {
  return {
    ...memory,
    lastIntent: intent,
    updatedAt: new Date().toISOString(),
  };
}

export function setMiraSelectedVehicle(
  memory: MiraConversationMemory,
  vehicleId: string | number | null
): MiraConversationMemory {
  return {
    ...memory,
    selectedVehicleId: vehicleId,
    updatedAt: new Date().toISOString(),
  };
}

export function setMiraPreferredLanguage(
  memory: MiraConversationMemory,
  language: string | null
): MiraConversationMemory {
  return {
    ...memory,
    preferredLanguage: language,
    updatedAt: new Date().toISOString(),
  };
}

export function addMiraPendingAction(
  memory: MiraConversationMemory,
  action: MiraPendingAction
): MiraConversationMemory {
  const existingAction = memory.pendingActions.find(
    (currentAction) => currentAction.id === action.id
  );

  const pendingActions = existingAction
    ? memory.pendingActions.map((currentAction) =>
        currentAction.id === action.id
          ? action
          : currentAction
      )
    : [...memory.pendingActions, action];

  return {
    ...memory,
    pendingActions,
    updatedAt: new Date().toISOString(),
  };
}

export function updateMiraPendingActionStatus(
  memory: MiraConversationMemory,
  actionId: string,
  status: MiraPendingAction["status"]
): MiraConversationMemory {
  return {
    ...memory,
    pendingActions: memory.pendingActions.map((action) =>
      action.id === actionId
        ? {
            ...action,
            status,
          }
        : action
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function getActiveMiraPendingActions(
  memory: MiraConversationMemory
): MiraPendingAction[] {
  return memory.pendingActions.filter(
    (action) => action.status === "pending"
  );
}

export function buildMiraMemorySummary(
  memory: MiraConversationMemory
): string {
  const recentConversation = memory.recentMessages
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n");

  const pendingActions = getActiveMiraPendingActions(memory)
    .map((action) => `- ${action.title}`)
    .join("\n");

  return `
Selected vehicle ID: ${
    memory.selectedVehicleId ?? "Not selected"
  }

Preferred language: ${
    memory.preferredLanguage ?? "Not set"
  }

Last intent: ${memory.lastIntent ?? "None"}

Recent conversation:
${recentConversation || "No recent messages"}

Pending actions:
${pendingActions || "No pending actions"}
`.trim();
}