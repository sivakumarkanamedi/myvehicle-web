import { NextRequest, NextResponse } from "next/server";

type MarketplaceCategory =
  | "tyres"
  | "battery"
  | "engine_oil"
  | "accessories"
  | "dashcam"
  | "lights"
  | "car_care"
  | "tools"
  | "spares"
  | "ev_charger";

type MarketplaceProduct = {
  id: string;
  name: string;
  brand: string;
  category: MarketplaceCategory;
  image_url: string | null;
  price: number;
  mrp: number | null;
  currency: "INR";
  seller: string;
  verified_seller: boolean;
  rating: number | null;
  review_count: number;
  installation_available: boolean;
  installation_price: number | null;
  compatible_vehicle_types: string[];
  compatible_makes: string[];
  compatible_models: string[];
  mira_recommended: boolean;
  best_value: boolean;
  affiliate_url: string;
  source: string;
};

type ProductResponse = {
  products: MarketplaceProduct[];
  live: boolean;
  source: string;
  generated_at: string;
  message?: string;
};

const PRODUCTS: MarketplaceProduct[] = [
  {
    id: "tyre-001",
    name: "Premium Touring Tyre 195/65 R15",
    brand: "RoadMax",
    category: "tyres",
    image_url: null,
    price: 5899,
    mrp: 6499,
    currency: "INR",
    seller: "AutoGrip India",
    verified_seller: true,
    rating: 4.5,
    review_count: 318,
    installation_available: true,
    installation_price: 450,
    compatible_vehicle_types: ["car"],
    compatible_makes: ["Honda", "Hyundai", "Maruti Suzuki", "Toyota"],
    compatible_models: ["City", "Verna", "Ciaz", "Corolla"],
    mira_recommended: true,
    best_value: true,
    affiliate_url: "https://example.com/marketplace/tyre-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "battery-001",
    name: "Maintenance-Free Car Battery 45Ah",
    brand: "VoltPro",
    category: "battery",
    image_url: null,
    price: 5299,
    mrp: 5899,
    currency: "INR",
    seller: "Battery World",
    verified_seller: true,
    rating: 4.6,
    review_count: 211,
    installation_available: true,
    installation_price: 299,
    compatible_vehicle_types: ["car"],
    compatible_makes: ["Honda", "Hyundai", "Maruti Suzuki", "Tata"],
    compatible_models: ["City", "i20", "Baleno", "Nexon"],
    mira_recommended: true,
    best_value: false,
    affiliate_url: "https://example.com/marketplace/battery-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "oil-001",
    name: "Fully Synthetic Engine Oil 5W-30 4L",
    brand: "MotorPure",
    category: "engine_oil",
    image_url: null,
    price: 2499,
    mrp: 2899,
    currency: "INR",
    seller: "Auto Fluids",
    verified_seller: true,
    rating: 4.7,
    review_count: 487,
    installation_available: true,
    installation_price: 350,
    compatible_vehicle_types: ["car"],
    compatible_makes: ["Honda", "Hyundai", "Toyota", "Volkswagen"],
    compatible_models: ["City", "Creta", "Innova", "Virtus"],
    mira_recommended: true,
    best_value: true,
    affiliate_url: "https://example.com/marketplace/oil-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "dashcam-001",
    name: "4K Dual Channel Dash Camera",
    brand: "DriveEye",
    category: "dashcam",
    image_url: null,
    price: 8999,
    mrp: 10499,
    currency: "INR",
    seller: "DriveTech Store",
    verified_seller: true,
    rating: 4.4,
    review_count: 154,
    installation_available: true,
    installation_price: 799,
    compatible_vehicle_types: ["car", "suv", "mpv"],
    compatible_makes: [],
    compatible_models: [],
    mira_recommended: true,
    best_value: false,
    affiliate_url: "https://example.com/marketplace/dashcam-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "accessory-001",
    name: "Premium All-Weather Floor Mat Set",
    brand: "CabinShield",
    category: "accessories",
    image_url: null,
    price: 2199,
    mrp: 2699,
    currency: "INR",
    seller: "CarStyle Hub",
    verified_seller: true,
    rating: 4.3,
    review_count: 192,
    installation_available: false,
    installation_price: null,
    compatible_vehicle_types: ["car", "suv"],
    compatible_makes: [],
    compatible_models: [],
    mira_recommended: false,
    best_value: true,
    affiliate_url: "https://example.com/marketplace/accessory-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "light-001",
    name: "LED Headlamp Upgrade Kit",
    brand: "LumaDrive",
    category: "lights",
    image_url: null,
    price: 3499,
    mrp: 3999,
    currency: "INR",
    seller: "Auto Light House",
    verified_seller: true,
    rating: 4.2,
    review_count: 88,
    installation_available: true,
    installation_price: 599,
    compatible_vehicle_types: ["car", "suv"],
    compatible_makes: [],
    compatible_models: [],
    mira_recommended: false,
    best_value: false,
    affiliate_url: "https://example.com/marketplace/light-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "care-001",
    name: "Ceramic Car Care Starter Kit",
    brand: "GlossGuard",
    category: "car_care",
    image_url: null,
    price: 1599,
    mrp: 1899,
    currency: "INR",
    seller: "Detailing Depot",
    verified_seller: true,
    rating: 4.5,
    review_count: 133,
    installation_available: false,
    installation_price: null,
    compatible_vehicle_types: ["car", "suv", "mpv"],
    compatible_makes: [],
    compatible_models: [],
    mira_recommended: false,
    best_value: true,
    affiliate_url: "https://example.com/marketplace/care-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "tool-001",
    name: "Portable Tyre Inflator with Digital Gauge",
    brand: "RoadMate",
    category: "tools",
    image_url: null,
    price: 1899,
    mrp: 2299,
    currency: "INR",
    seller: "Garage Essentials",
    verified_seller: true,
    rating: 4.6,
    review_count: 274,
    installation_available: false,
    installation_price: null,
    compatible_vehicle_types: ["car", "bike", "suv"],
    compatible_makes: [],
    compatible_models: [],
    mira_recommended: true,
    best_value: true,
    affiliate_url: "https://example.com/marketplace/tool-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "spare-001",
    name: "Front Brake Pad Set",
    brand: "StopSure",
    category: "spares",
    image_url: null,
    price: 2799,
    mrp: 3299,
    currency: "INR",
    seller: "Parts Direct",
    verified_seller: true,
    rating: 4.4,
    review_count: 97,
    installation_available: true,
    installation_price: 699,
    compatible_vehicle_types: ["car"],
    compatible_makes: ["Honda", "Hyundai"],
    compatible_models: ["City", "Verna"],
    mira_recommended: false,
    best_value: false,
    affiliate_url: "https://example.com/marketplace/spare-001",
    source: "My Vehicle Demo Marketplace",
  },
  {
    id: "ev-001",
    name: "7.4kW Smart Home EV Charger",
    brand: "ChargeNest",
    category: "ev_charger",
    image_url: null,
    price: 42999,
    mrp: 46999,
    currency: "INR",
    seller: "EV Home Systems",
    verified_seller: true,
    rating: 4.7,
    review_count: 61,
    installation_available: true,
    installation_price: 4999,
    compatible_vehicle_types: ["ev"],
    compatible_makes: [],
    compatible_models: [],
    mira_recommended: true,
    best_value: false,
    affiliate_url: "https://example.com/marketplace/ev-001",
    source: "My Vehicle Demo Marketplace",
  },
];

function normalize(value: string | null) {
  return (value || "").trim().toLowerCase();
}

function matchesVehicle(
  product: MarketplaceProduct,
  make: string,
  model: string,
  vehicleType: string
) {
  const normalizedMake = normalize(make);
  const normalizedModel = normalize(model);
  const normalizedType = normalize(vehicleType);

  const typeMatches =
    !normalizedType ||
    product.compatible_vehicle_types.length === 0 ||
    product.compatible_vehicle_types.some(
      (item) => item.toLowerCase() === normalizedType
    );

  const makeMatches =
    !normalizedMake ||
    product.compatible_makes.length === 0 ||
    product.compatible_makes.some(
      (item) => item.toLowerCase() === normalizedMake
    );

  const modelMatches =
    !normalizedModel ||
    product.compatible_models.length === 0 ||
    product.compatible_models.some(
      (item) => item.toLowerCase() === normalizedModel
    );

  return typeMatches && makeMatches && modelMatches;
}

export async function GET(
  request: NextRequest
) {
  const search = normalize(
    request.nextUrl.searchParams.get("q")
  );
  const category = normalize(
    request.nextUrl.searchParams.get("category")
  );
  const make = normalize(
    request.nextUrl.searchParams.get("make")
  );
  const model = normalize(
    request.nextUrl.searchParams.get("model")
  );
  const vehicleType = normalize(
    request.nextUrl.searchParams.get("vehicle_type")
  );

  const onlyRecommended =
    request.nextUrl.searchParams.get("recommended") === "true";
  const onlyBestValue =
    request.nextUrl.searchParams.get("best_value") === "true";
  const installationOnly =
    request.nextUrl.searchParams.get("installation") === "true";

  let products = PRODUCTS.filter((product) => {
    const matchesSearch =
      !search ||
      [
        product.name,
        product.brand,
        product.seller,
        product.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesCategory =
      !category || product.category === category;

    const matchesRecommendation =
      !onlyRecommended || product.mira_recommended;

    const matchesBestValue =
      !onlyBestValue || product.best_value;

    const matchesInstallation =
      !installationOnly ||
      product.installation_available;

    const matchesCompatibility = matchesVehicle(
      product,
      make,
      model,
      vehicleType
    );

    return (
      matchesSearch &&
      matchesCategory &&
      matchesRecommendation &&
      matchesBestValue &&
      matchesInstallation &&
      matchesCompatibility
    );
  });

  products = products.sort((a, b) => {
    if (a.mira_recommended !== b.mira_recommended) {
      return Number(b.mira_recommended) -
        Number(a.mira_recommended);
    }

    if (a.best_value !== b.best_value) {
      return Number(b.best_value) -
        Number(a.best_value);
    }

    return a.price - b.price;
  });

  const response: ProductResponse = {
    products,
    live: false,
    source: "My Vehicle Demo Marketplace",
    generated_at: new Date().toISOString(),
    message:
      "Marketplace is running in demo mode. Partner, affiliate and live inventory APIs can be connected later.",
  };

  return NextResponse.json(response);
}