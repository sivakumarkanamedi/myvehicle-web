export type VehicleImageInput = {
  brand?: string | null;
  model?: string | null;
  colour?: string | null;
  vehicleType?: string | null;
  vehicleNumber?: string | null;
  generatedImageUrl?: string | null;
};

const VEHICLE_IMAGE_LIBRARY: Record<string, string> = {
  // Add licensed local images here.
  // Example:
  // "bmw|series 5|alpine white": "/vehicles/bmw-series-5-alpine-white.webp",
  // "honda|city|white": "/vehicles/honda-city-white.webp",
  // "hyundai|creta|black": "/vehicles/hyundai-creta-black.webp",
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] || character
  );
}

function colourToHex(value: string | null | undefined) {
  const colour = normalize(value);

  if (colour.includes("white")) return "#e5e7eb";
  if (colour.includes("black")) return "#111827";
  if (colour.includes("blue")) return "#2563eb";
  if (colour.includes("red")) return "#dc2626";
  if (colour.includes("green")) return "#15803d";
  if (colour.includes("silver")) return "#9ca3af";
  if (colour.includes("grey") || colour.includes("gray")) return "#6b7280";
  if (colour.includes("yellow")) return "#eab308";
  if (colour.includes("orange")) return "#ea580c";
  if (colour.includes("brown")) return "#78350f";
  return "#334155";
}

function buildFallbackSvg(input: VehicleImageInput) {
  const brand = escapeXml(input.brand || "My Vehicle");
  const model = escapeXml(input.model || "");
  const plate = escapeXml(
    (input.vehicleNumber || "VEHICLE")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16)
  );
  const bodyColour = colourToHex(input.colour);
  const vehicleType = normalize(input.vehicleType);

  const isBike =
    vehicleType.includes("bike") ||
    vehicleType.includes("scooter") ||
    vehicleType.includes("two");

  const body = isBike
    ? `
      <circle cx="395" cy="660" r="92" fill="#0f172a" stroke="#94a3b8" stroke-width="16"/>
      <circle cx="1125" cy="660" r="92" fill="#0f172a" stroke="#94a3b8" stroke-width="16"/>
      <path d="M420 630 L650 430 L920 500 L1095 630" fill="none" stroke="${bodyColour}" stroke-width="58" stroke-linecap="round"/>
      <path d="M650 430 L760 330 L875 345" fill="none" stroke="${bodyColour}" stroke-width="36" stroke-linecap="round"/>
      <rect x="690" y="445" width="270" height="70" rx="35" fill="${bodyColour}"/>
    `
    : `
      <ellipse cx="768" cy="735" rx="590" ry="62" fill="rgba(0,0,0,0.35)"/>
      <path d="M250 610 C320 440 470 350 665 330 L930 330 C1080 355 1210 450 1285 610 L1310 650 C1325 690 1295 725 1250 725 L285 725 C240 725 210 690 225 650 Z" fill="${bodyColour}"/>
      <path d="M520 360 C620 290 850 285 1000 360 L1090 500 L430 500 Z" fill="#0f172a" opacity="0.9"/>
      <circle cx="455" cy="705" r="105" fill="#111827" stroke="#94a3b8" stroke-width="18"/>
      <circle cx="1080" cy="705" r="105" fill="#111827" stroke="#94a3b8" stroke-width="18"/>
      <circle cx="455" cy="705" r="48" fill="#cbd5e1"/>
      <circle cx="1080" cy="705" r="48" fill="#cbd5e1"/>
      <rect x="605" y="625" width="325" height="82" rx="14" fill="#f8fafc" stroke="#111827" stroke-width="8"/>
      <text x="768" y="682" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="800" letter-spacing="5" fill="#111827">${plate}</text>
    `;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
      <defs>
        <radialGradient id="bg" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#1e3a8a"/>
          <stop offset="48%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="18" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="1536" height="1024" fill="url(#bg)"/>
      <ellipse cx="768" cy="700" rx="650" ry="210" fill="#2563eb" opacity="0.10" filter="url(#glow)"/>
      ${body}
      <text x="768" y="145" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" fill="#f8fafc">${brand} ${model}</text>
      <text x="768" y="205" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="600" letter-spacing="4" fill="#93c5fd">${escapeXml((input.colour || "").toUpperCase())}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveVehicleImage(input: VehicleImageInput) {
  if (input.generatedImageUrl) {
    return input.generatedImageUrl;
  }

  const brand = normalize(input.brand);
  const model = normalize(input.model);
  const colour = normalize(input.colour);

  const exactKey = `${brand}|${model}|${colour}`;
  const modelKey = `${brand}|${model}|`;
  const brandKey = `${brand}||`;

  return (
    VEHICLE_IMAGE_LIBRARY[exactKey] ||
    VEHICLE_IMAGE_LIBRARY[modelKey] ||
    VEHICLE_IMAGE_LIBRARY[brandKey] ||
    buildFallbackSvg(input)
  );
}