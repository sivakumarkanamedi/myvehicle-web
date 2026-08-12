import { NextRequest, NextResponse } from "next/server";

type Category = "all" | "launches" | "ev" | "government" | "recalls" | "fuel" | "safety";

const categoryTerms: Record<Exclude<Category, "all">, string> = {
  launches: "car launch OR bike launch OR vehicle launch India",
  ev: "electric vehicle OR EV India",
  government: "vehicle rules OR RTO OR transport ministry OR road transport India",
  recalls: "vehicle recall India",
  fuel: "petrol diesel price India",
  safety: "Bharat NCAP OR car safety India",
};

function demoArticles() {
  const now = Date.now();
  return [
    {
      id: "demo-launch",
      title: "New vehicle launches and updates will appear here",
      description: "Connect NEWS_API_KEY to show fresh automobile launches, prices and industry updates.",
      url: "/news",
      image_url: null,
      source: "My Vehicle",
      published_at: new Date(now).toISOString(),
      category: "launches",
      mira_summary: "Vehicle News is ready. Add a news provider key to switch from demo mode to live content.",
    },
    {
      id: "demo-recall",
      title: "Vehicle recall alerts can be highlighted as important",
      description: "My Vehicle can surface recall and safety stories prominently and later connect them to proactive push alerts.",
      url: "/news",
      image_url: null,
      source: "Mira AI",
      published_at: new Date(now - 3600000).toISOString(),
      category: "recalls",
      important: true,
    },
    {
      id: "demo-ev",
      title: "EV launches, charging and battery news in one feed",
      description: "Users can focus on electric vehicles, charging networks, battery developments and EV launches.",
      url: "/news",
      image_url: null,
      source: "My Vehicle",
      published_at: new Date(now - 7200000).toISOString(),
      category: "ev",
    },
    {
      id: "demo-government",
      title: "Government and RTO rule changes get a dedicated category",
      description: "Important transport rules, compliance updates and policy changes can be surfaced separately.",
      url: "/news",
      image_url: null,
      source: "My Vehicle",
      published_at: new Date(now - 10800000).toISOString(),
      category: "government",
      important: true,
    },
    {
      id: "demo-fuel",
      title: "Fuel price and fuel-related updates can be tracked",
      description: "The news feed supports a fuel category that can later connect with live city-level fuel price data.",
      url: "/news",
      image_url: null,
      source: "My Vehicle",
      published_at: new Date(now - 14400000).toISOString(),
      category: "fuel",
    },
    {
      id: "demo-safety",
      title: "Safety ratings and Bharat NCAP stories have their own feed",
      description: "Users can quickly find crash-test, safety-rating and important vehicle-safety developments.",
      url: "/news",
      image_url: null,
      source: "My Vehicle",
      published_at: new Date(now - 18000000).toISOString(),
      category: "safety",
    },
  ];
}

function inferCategory(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("recall") || text.includes("defect")) return "recalls";
  if (text.includes("electric") || text.includes(" ev ") || text.includes("battery")) return "ev";
  if (text.includes("rto") || text.includes("government") || text.includes("ministry") || text.includes("rule")) return "government";
  if (text.includes("petrol") || text.includes("diesel") || text.includes("fuel")) return "fuel";
  if (text.includes("ncap") || text.includes("safety") || text.includes("crash")) return "safety";
  return "launches";
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEWS_API_KEY?.trim() || "";
  const category = (request.nextUrl.searchParams.get("category") || "all") as Category;
  const search = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!apiKey) {
    let articles = demoArticles();
    if (category !== "all") articles = articles.filter((a) => a.category === category);
    if (search) {
      const q = search.toLowerCase();
      articles = articles.filter((a) => `${a.title} ${a.description}`.toLowerCase().includes(q));
    }

    return NextResponse.json({
      articles,
      live: false,
      source: "My Vehicle Demo Feed",
      generated_at: new Date().toISOString(),
      message: "NEWS_API_KEY is not configured. Showing demo automobile news.",
    });
  }

  try {
    const base = category === "all"
      ? "automobile OR car OR bike OR vehicle India"
      : categoryTerms[category];

    const q = search ? `(${base}) AND (${search})` : base;
    const params = new URLSearchParams({
      q,
      language: "en",
      sortBy: "publishedAt",
      pageSize: "30",
      apiKey,
    });

    const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
      headers: { "User-Agent": "MyVehicle/1.0" },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "News provider request failed.");
    }

    const articles = (data.articles || [])
      .filter((a: any) => a?.title && a?.url && a?.description && a.title !== "[Removed]")
      .map((a: any, index: number) => {
        const inferred = inferCategory(a.title, a.description);
        return {
          id: `${a.url}-${index}`,
          title: a.title,
          description: a.description,
          url: a.url,
          image_url: a.urlToImage || null,
          source: a.source?.name || "News source",
          published_at: a.publishedAt || new Date().toISOString(),
          category: category === "all" ? inferred : category,
          important: inferred === "recalls" || inferred === "government",
          mira_summary: a.description.length > 180 ? `${a.description.slice(0, 177)}...` : a.description,
        };
      });

    return NextResponse.json({
      articles,
      live: true,
      source: "NewsAPI",
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        articles: [],
        live: false,
        source: "NewsAPI",
        generated_at: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Unable to load live vehicle news.",
      },
      { status: 502 }
    );
  }
}