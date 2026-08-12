"use client";

import {
  ArrowLeft,
  BatteryCharging,
  Bookmark,
  BookmarkCheck,
  Camera,
  Car,
  ChevronDown,
  Droplets,
  ExternalLink,
  Filter,
  Gauge,
  Heart,
  MapPinned,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

type ProductCategory =
  | "accessories"
  | "tyres"
  | "batteries"
  | "engine-oil"
  | "car-care"
  | "dashcams"
  | "gps-trackers";

type MarketplaceProduct = {
  id: number;
  category: ProductCategory;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  compatibleWith: string[];
  description: string;
  recommended?: boolean;
  popular?: boolean;
  imageUrl?: string | null;
  amazonUrl?: string | null;
  flipkartUrl?: string | null;
};

type ProductFilter = "all" | ProductCategory;

const FALLBACK_PRODUCTS: MarketplaceProduct[] = [
  {
    id: 1,
    category: "dashcams",
    name: "RoadVision Pro Dashcam",
    brand: "RoadVision",
    price: 6999,
    originalPrice: 8499,
    rating: 4.7,
    reviews: 842,
    compatibleWith: ["Cars", "SUVs"],
    description:
      "2K recording, night vision, parking monitoring and mobile-app connectivity.",
    recommended: true,
    popular: true,
  },
  {
    id: 2,
    category: "gps-trackers",
    name: "TrackSafe GPS Tracker",
    brand: "TrackSafe",
    price: 3499,
    originalPrice: 4299,
    rating: 4.5,
    reviews: 624,
    compatibleWith: ["Cars", "Bikes", "Commercial Vehicles"],
    description:
      "Live location, geofence alerts, trip history and tamper notifications.",
    recommended: true,
  },
  {
    id: 3,
    category: "tyres",
    name: "Premium Touring Tyre",
    brand: "GripMax",
    price: 5799,
    rating: 4.6,
    reviews: 1182,
    compatibleWith: ["Honda City", "Hyundai Verna", "Maruti Ciaz"],
    description:
      "Quiet touring tyre with wet-grip performance and extended tread life.",
    popular: true,
  },
  {
    id: 4,
    category: "batteries",
    name: "Maintenance-Free Car Battery",
    brand: "PowerStart",
    price: 4899,
    originalPrice: 5299,
    rating: 4.4,
    reviews: 956,
    compatibleWith: ["Petrol Cars", "Diesel Cars"],
    description:
      "Reliable cold-start performance with long warranty support.",
  },
  {
    id: 5,
    category: "engine-oil",
    name: "Fully Synthetic Engine Oil 5W-30",
    brand: "MotoPure",
    price: 3199,
    rating: 4.8,
    reviews: 1504,
    compatibleWith: ["Petrol Cars", "Diesel Cars"],
    description:
      "Advanced wear protection, cleaner engine performance and smooth starts.",
    recommended: true,
  },
  {
    id: 6,
    category: "car-care",
    name: "Premium Car Care Kit",
    brand: "AutoShine",
    price: 1799,
    originalPrice: 2299,
    rating: 4.3,
    reviews: 433,
    compatibleWith: ["Cars", "SUVs"],
    description:
      "Interior cleaner, shampoo, polish, microfiber cloths and tyre dresser.",
  },
  {
    id: 7,
    category: "accessories",
    name: "Universal Mobile Holder",
    brand: "DriveMate",
    price: 899,
    rating: 4.4,
    reviews: 2211,
    compatibleWith: ["Cars", "SUVs"],
    description:
      "Strong dashboard mount with 360-degree rotation and one-hand operation.",
    popular: true,
  },
];

const FILTERS: Array<{
  value: ProductFilter;
  label: string;
}> = [
  { value: "all", label: "All Products" },
  { value: "accessories", label: "Accessories" },
  { value: "tyres", label: "Tyres" },
  { value: "batteries", label: "Batteries" },
  { value: "engine-oil", label: "Engine Oil" },
  { value: "car-care", label: "Car Care" },
  { value: "dashcams", label: "Dashcams" },
  { value: "gps-trackers", label: "GPS Trackers" },
];

function getCategoryDetails(category: ProductCategory) {
  if (category === "tyres") {
    return {
      label: "Tyres",
      icon: Gauge,
      className: "bg-amber-400/15 text-amber-300",
    };
  }

  if (category === "batteries") {
    return {
      label: "Batteries",
      icon: BatteryCharging,
      className: "bg-emerald-400/15 text-emerald-300",
    };
  }

  if (category === "engine-oil") {
    return {
      label: "Engine Oil",
      icon: Droplets,
      className: "bg-blue-400/15 text-blue-300",
    };
  }

  if (category === "car-care") {
    return {
      label: "Car Care",
      icon: Sparkles,
      className: "bg-violet-400/15 text-violet-300",
    };
  }

  if (category === "dashcams") {
    return {
      label: "Dashcams",
      icon: Camera,
      className: "bg-rose-400/15 text-rose-300",
    };
  }

  if (category === "gps-trackers") {
    return {
      label: "GPS Trackers",
      icon: MapPinned,
      className: "bg-cyan-400/15 text-cyan-300",
    };
  }

  return {
    label: "Accessories",
    icon: ShoppingBag,
    className: "bg-fuchsia-400/15 text-fuchsia-300",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<ProductFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] =
    useState("KA03KV0430");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [compareProduct, setCompareProduct] = useState<MarketplaceProduct | null>(null);

  useEffect(() => {
    async function loadMarketplaceProducts() {
      setProductsLoading(true);
      setProductsError("");

      const { data, error } = await supabase
        .from("marketplace_products")
        .select(
          "id, category, name, brand, price, original_price, rating, reviews, compatible_with, description, recommended, popular, image_url, amazon_url, flipkart_url"
        )
        .eq("is_active", true)
        .order("recommended", { ascending: false })
        .order("popular", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Marketplace load error:", error);
        setProductsError(
          "Could not load live Marketplace products. Showing local sample products."
        );
        setProducts(FALLBACK_PRODUCTS);
        setProductsLoading(false);
        return;
      }

      const mappedProducts: MarketplaceProduct[] = (data || []).map((row) => ({
        id: Number(row.id),
        category: row.category as ProductCategory,
        name: row.name,
        brand: row.brand,
        price: Number(row.price || 0),
        originalPrice:
          row.original_price === null || row.original_price === undefined
            ? undefined
            : Number(row.original_price),
        rating: Number(row.rating || 0),
        reviews: Number(row.reviews || 0),
        compatibleWith: Array.isArray(row.compatible_with)
          ? row.compatible_with
          : [],
        description: row.description || "",
        recommended: Boolean(row.recommended),
        popular: Boolean(row.popular),
        imageUrl: row.image_url || null,
        amazonUrl: row.amazon_url || null,
        flipkartUrl: row.flipkart_url || null,
      }));

      setProducts(mappedProducts);
      setProductsLoading(false);
    }

    void loadMarketplaceProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesFilter =
        activeFilter === "all" ||
        product.category === activeFilter;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.brand.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchTerm, products]);

  const recommendedCount = products.filter(
    (product) => product.recommended
  ).length;

  const popularCount = products.filter(
    (product) => product.popular
  ).length;

  function toggleSave(productId: number) {
    setSavedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                Vehicle Products
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Marketplace
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Discover useful vehicle products with compatibility guidance,
                price comparison and Mira recommendations.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
              <ShieldCheck size={18} />
              Vehicle compatibility first
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<PackageSearch size={22} />}
            label="Products"
            value={String(products.length)}
            helper="Curated catalogue"
            className="border-blue-400/20 bg-blue-500/10 text-blue-200"
          />

          <SummaryCard
            icon={<Sparkles size={22} />}
            label="Recommended"
            value={String(recommendedCount)}
            helper="Selected by Mira"
            className="border-violet-400/20 bg-violet-500/10 text-violet-200"
          />

          <SummaryCard
            icon={<Star size={22} />}
            label="Popular"
            value={String(popularCount)}
            helper="Frequently viewed"
            className="border-amber-400/20 bg-amber-500/10 text-amber-200"
          />

          <SummaryCard
            icon={<BookmarkCheck size={22} />}
            label="Saved"
            value={String(savedIds.length)}
            helper="Your shortlist"
            className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          />
        </section>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Sparkles size={22} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                  Mira Recommendation
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Dashcam and GPS tracker recommended
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  These products can improve journey evidence, parking
                  protection and vehicle-location visibility.
                </p>
              </div>
            </div>

            <Link
              href="/mira?prompt=Recommend%20products%20for%20my%20vehicle"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm font-black text-violet-200"
            >
              <Sparkles size={17} />
              Ask Mira
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tyres, batteries, dashcams or accessories"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40"
              />
            </div>

            <div className="relative">
              <Car
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={selectedVehicle}
                onChange={(event) =>
                  setSelectedVehicle(event.target.value)
                }
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-10 text-sm font-bold text-white outline-none"
              >
                <option value="KA03KV0430">KA03KV0430</option>
                <option value="KA05AB2211">KA05AB2211</option>
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>

            <div className="relative">
              <Filter
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={activeFilter}
                onChange={(event) =>
                  setActiveFilter(
                    event.target.value as ProductFilter
                  )
                }
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-10 text-sm font-bold text-white outline-none"
              >
                {FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                  activeFilter === filter.value
                    ? "border-blue-400/30 bg-blue-500/15 text-blue-200"
                    : "border-white/10 bg-slate-950/50 text-slate-500 hover:bg-white/[0.05]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {productsError ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {productsError}
          </section>
        ) : null}

        {productsLoading ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-14 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-slate-400">
              Loading Marketplace products...
            </p>
          </section>
        ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center md:col-span-2 xl:col-span-3">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
                <PackageSearch size={30} />
              </div>

              <h2 className="mt-5 text-xl font-black">
                No matching products found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Try another search or choose a different category.
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const category = getCategoryDetails(product.category);
              const CategoryIcon = category.icon;
              const saved = savedIds.includes(product.id);

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`grid h-14 w-14 place-items-center rounded-2xl ${category.className}`}
                      >
                        <CategoryIcon size={25} />
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {product.recommended ? (
                          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200">
                            Mira Pick
                          </span>
                        ) : null}

                        {product.popular ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
                            Popular
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-5 text-xs font-black uppercase tracking-[0.15em] text-blue-300">
                      {category.label}
                    </p>

                    <h2 className="mt-2 text-xl font-black leading-7">
                      {product.name}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {product.brand}
                    </p>

                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <Star
                        size={16}
                        className="fill-amber-300 text-amber-300"
                      />
                      <span className="font-black">
                        {product.rating.toFixed(1)}
                      </span>
                      <span className="text-slate-600">
                        ({product.reviews.toLocaleString("en-IN")})
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      {product.description}
                    </p>

                    <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                        <ShieldCheck size={15} />
                        Compatible
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {product.compatibleWith.join(" • ")}
                      </p>

                      <p className="mt-2 text-[11px] text-slate-600">
                        Selected vehicle: {selectedVehicle}
                      </p>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-black">
                          {formatCurrency(product.price)}
                        </p>

                        {product.originalPrice ? (
                          <p className="mt-1 text-xs text-slate-600 line-through">
                            {formatCurrency(product.originalPrice)}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSave(product.id)}
                        className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                          saved
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                        }`}
                        aria-label={
                          saved
                            ? "Remove saved product"
                            : "Save product"
                        }
                      >
                        {saved ? (
                          <BookmarkCheck size={17} />
                        ) : (
                          <Bookmark size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-slate-950/30 p-4">
                    <button
                      type="button"
                      onClick={() => setCompareProduct(product)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"
                    >
                      <ExternalLink size={15} />
                      Compare Price
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 text-xs font-black text-white"
                    >
                      <ShoppingBag size={15} />
                      View Product
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Wrench size={22} />}
            title="Compatibility First"
            description="Products are shown with vehicle-fit guidance before purchase."
          />

          <FeatureCard
            icon={<Heart size={22} />}
            title="Save for Later"
            description="Shortlist useful products without making the marketplace feel crowded."
          />

          <FeatureCard
            icon={<Sparkles size={22} />}
            title="Mira Recommendations"
            description="Mira can recommend products based on the selected vehicle and use case."
          />
        </section>

        {compareProduct ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setCompareProduct(null)}
          >
            <div
              className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
                    Compare Price
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {compareProduct.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {compareProduct.brand}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCompareProduct(null)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-xl text-slate-300"
                  aria-label="Close price comparison"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  My Vehicle Catalogue Price
                </p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <p className="text-3xl font-black">
                    {formatCurrency(compareProduct.price)}
                  </p>
                  {compareProduct.originalPrice ? (
                    <p className="text-sm text-slate-600 line-through">
                      {formatCurrency(compareProduct.originalPrice)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  href={
                    compareProduct.amazonUrl ||
                    `https://www.amazon.in/s?k=${encodeURIComponent(
                      `${compareProduct.brand} ${compareProduct.name}`
                    )}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]"
                >
                  <div>
                    <p className="text-sm font-black">Amazon India</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Check current listings
                    </p>
                  </div>
                  <ExternalLink size={18} className="text-blue-300" />
                </a>

                <a
                  href={
                    compareProduct.flipkartUrl ||
                    `https://www.flipkart.com/search?q=${encodeURIComponent(
                      `${compareProduct.brand} ${compareProduct.name}`
                    )}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]"
                >
                  <div>
                    <p className="text-sm font-black">Flipkart</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Check current listings
                    </p>
                  </div>
                  <ExternalLink size={18} className="text-blue-300" />
                </a>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
                  Live price integration
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  For now, My Vehicle opens the retailer search so the user can
                  verify the current price. Live in-app prices will be connected
                  through approved partner or affiliate APIs.
                </p>
              </div>

              <Link
                href={`/mira?prompt=${encodeURIComponent(
                  `Compare ${compareProduct.name} by ${compareProduct.brand} for my vehicle ${selectedVehicle} and tell me what I should check before buying.`
                )}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3.5 text-sm font-black text-white"
              >
                <Sparkles size={17} />
                Ask Mira Which One to Buy
              </Link>
            </div>
          </div>
        ) : null}

        {selectedProduct ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                    Product Details
                  </p>
                  <h2 className="mt-2 text-2xl font-black">{selectedProduct.name}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{selectedProduct.brand}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-xl text-slate-300"
                  aria-label="Close product details"
                >
                  ×
                </button>
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-400">
                {selectedProduct.description}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                    Compatibility
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {selectedProduct.compatibleWith.join(" • ")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Selected vehicle: {selectedVehicle}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Current Price
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {formatCurrency(selectedProduct.price)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Rating {selectedProduct.rating.toFixed(1)} •{" "}
                    {selectedProduct.reviews.toLocaleString("en-IN")} reviews
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-violet-200">
                  <Sparkles size={17} />
                  Ask Mira before you buy
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Mira can check suitability for your selected vehicle and explain
                  what you should verify before purchase.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => toggleSave(selectedProduct.id)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-slate-200"
                >
                  {savedIds.includes(selectedProduct.id)
                    ? "Remove from Saved"
                    : "Save Product"}
                </button>

                <Link
                  href={`/mira?prompt=${encodeURIComponent(
                    `Is ${selectedProduct.name} by ${selectedProduct.brand} suitable for my vehicle ${selectedVehicle}?`
                  )}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3 text-sm font-black text-white"
                >
                  <Sparkles size={17} />
                  Ask Mira
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development note:</strong> this MVP screen uses sample product
          records. Production requires partner catalogues, live inventory,
          verified compatibility, pricing, payments, order tracking and return
          integrations.
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  className: string;
}) {
  return (
    <article className={`rounded-3xl border p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black/15">
          {icon}
        </div>

        <span className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
          {label}
        </span>
      </div>

      <p className="mt-5 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs opacity-70">{helper}</p>
    </article>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
        {icon}
      </div>

      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </article>
  );
}