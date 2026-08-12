"use client";

import {
  ArrowLeft,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Building2,
  Car,
  ChevronDown,
  ExternalLink,
  Filter,
  Megaphone,
  Newspaper,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  TrafficCone,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type NewsCategory =
  | "launches"
  | "recalls"
  | "government"
  | "ev"
  | "fuel"
  | "safety";

type NewsItem = {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  miraSummary?: string | null;
  personalized?: boolean;
  important?: boolean;
};

type NewsApiResponse = {
  articles?: Array<{
    id: string;
    title: string;
    description: string;
    url: string;
    image_url: string | null;
    source: string;
    published_at: string;
    category: NewsCategory;
    important?: boolean;
    mira_summary?: string | null;
  }>;
  live?: boolean;
  source?: string;
  generated_at?: string;
  message?: string;
};

type NewsFilter = "all" | NewsCategory;

const FILTERS: Array<{
  value: NewsFilter;
  label: string;
}> = [
  { value: "all", label: "All News" },
  { value: "launches", label: "Launches" },
  { value: "ev", label: "EV" },
  { value: "recalls", label: "Recalls" },
  { value: "government", label: "Government & RTO" },
  { value: "fuel", label: "Fuel" },
  { value: "safety", label: "Safety" },
];

function getCategoryDetails(category: NewsCategory) {
  if (category === "launches") {
    return {
      label: "Vehicle Launch",
      icon: Car,
      iconClass: "bg-blue-400/15 text-blue-300",
      badgeClass:
        "border-blue-400/20 bg-blue-400/10 text-blue-200",
    };
  }

  if (category === "recalls") {
    return {
      label: "Recall",
      icon: ShieldAlert,
      iconClass: "bg-rose-400/15 text-rose-300",
      badgeClass:
        "border-rose-400/20 bg-rose-400/10 text-rose-200",
    };
  }

  if (category === "government") {
    return {
      label: "Government & RTO",
      icon: Building2,
      iconClass: "bg-amber-400/15 text-amber-300",
      badgeClass:
        "border-amber-400/20 bg-amber-400/10 text-amber-200",
    };
  }

  if (category === "ev") {
    return {
      label: "EV",
      icon: Sparkles,
      iconClass: "bg-cyan-400/15 text-cyan-300",
      badgeClass:
        "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    };
  }

  if (category === "fuel") {
    return {
      label: "Fuel",
      icon: BellRing,
      iconClass: "bg-emerald-400/15 text-emerald-300",
      badgeClass:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    };
  }

  return {
    label: "Road Safety",
    icon: Megaphone,
    iconClass: "bg-violet-400/15 text-violet-300",
    badgeClass:
      "border-violet-400/20 bg-violet-400/10 text-violet-200",
  };
}

function formatPublishedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NewsPage() {
  const [activeFilter, setActiveFilter] = useState<NewsFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveNews, setLiveNews] = useState(false);
  const [providerMessage, setProviderMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem("myvehicle.saved-news");

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        setSavedIds(parsed);
      }
    } catch {
      // Ignore invalid saved data.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNews();
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, searchTerm]);

  async function loadNews() {
    setLoading(true);
    setProviderMessage("");

    try {
      const params = new URLSearchParams();

      if (activeFilter !== "all") {
        params.set("category", activeFilter);
      }

      if (searchTerm.trim()) {
        params.set("q", searchTerm.trim());
      }

      const response = await fetch(
        `/api/news?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = (await response.json()) as NewsApiResponse;

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load vehicle news."
        );
      }

      const mapped: NewsItem[] = (data.articles || []).map(
        (article) => ({
          id: article.id,
          category: article.category,
          title: article.title,
          summary: article.description,
          source: article.source,
          publishedAt: formatPublishedAt(article.published_at),
          url: article.url,
          imageUrl: article.image_url,
          miraSummary: article.mira_summary,
          important: Boolean(article.important),
          personalized: Boolean(article.important),
        })
      );

      setNewsItems(mapped);
      setLiveNews(Boolean(data.live));
      setProviderMessage(data.message || "");
    } catch (caughtError) {
      setNewsItems([]);
      setLiveNews(false);
      setProviderMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load vehicle news."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredNews = useMemo(() => newsItems, [newsItems]);

  const personalizedCount = newsItems.filter(
    (item) => item.personalized
  ).length;

  const importantCount = newsItems.filter(
    (item) => item.important
  ).length;

  const miraHeadline =
    newsItems.find((item) => item.important)?.miraSummary ||
    newsItems[0]?.miraSummary ||
    newsItems[0]?.summary ||
    "Mira will summarize important vehicle updates here.";

  function toggleSave(newsId: string) {
    setSavedIds((current) => {
      const next = current.includes(newsId)
        ? current.filter((id) => id !== newsId)
        : [...current, newsId];

      window.localStorage.setItem(
        "myvehicle.saved-news",
        JSON.stringify(next)
      );

      return next;
    });
  }

  async function shareNews(item: NewsItem) {
    const text = `${item.title}\n\n${item.summary}\n${item.url}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: item.summary,
          url: item.url,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      window.alert("News link copied to clipboard.");
    } catch {
      // Sharing was cancelled or unavailable.
    }
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
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Vehicle Intelligence Feed
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Vehicle News
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Relevant vehicle launches, recalls, government updates, road
                rules, traffic advisories, safety alerts and insurance news.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm font-bold text-violet-200">
              <Sparkles size={18} />
              Personalized by Mira
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-2 text-xs font-bold ${
              liveNews
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/20 bg-amber-400/10 text-amber-200"
            }`}
          >
            {liveNews ? "● Live news connected" : "● Demo news mode"}
          </span>

          {providerMessage ? (
            <span className="text-xs text-amber-200/80">
              {providerMessage}
            </span>
          ) : null}
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Newspaper size={22} />}
            label="Latest Updates"
            value={String(newsItems.length)}
            helper="Vehicle-focused news"
            className="border-blue-400/20 bg-blue-500/10 text-blue-200"
          />

          <SummaryCard
            icon={<Sparkles size={22} />}
            label="For Your Vehicle"
            value={String(personalizedCount)}
            helper="Personalized stories"
            className="border-violet-400/20 bg-violet-500/10 text-violet-200"
          />

          <SummaryCard
            icon={<ShieldAlert size={22} />}
            label="Important"
            value={String(importantCount)}
            helper="Needs attention"
            className="border-rose-400/20 bg-rose-500/10 text-rose-200"
          />

          <SummaryCard
            icon={<BookmarkCheck size={22} />}
            label="Saved"
            value={String(savedIds.length)}
            helper="Read later"
            className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          />
        </section>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                Mira News Summary
              </p>

              <h2 className="mt-1 text-xl font-black">
                Two updates may require your attention
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Review the latest recall notice and transport-department update
                before your next service or document renewal.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search launches, recalls, RTO updates or safety news"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40"
              />
            </div>

            <div className="relative min-w-[220px]">
              <Filter
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={activeFilter}
                onChange={(event) =>
                  setActiveFilter(event.target.value as NewsFilter)
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

        <section className="grid gap-5 lg:grid-cols-2">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center lg:col-span-2">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
              <p className="mt-4 text-sm text-slate-500">
                Mira is loading vehicle news…
              </p>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center lg:col-span-2">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
                <Newspaper size={30} />
              </div>

              <h2 className="mt-5 text-xl font-black">
                No matching vehicle news
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Try another search or choose a different category.
              </p>
            </div>
          ) : (
            filteredNews.map((item) => {
              const category = getCategoryDetails(item.category);
              const CategoryIcon = category.icon;
              const saved = savedIds.includes(item.id);

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl"
                >
                  {item.imageUrl ? (
                    <div className="h-48 overflow-hidden border-b border-white/10 bg-slate-950/50">
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`grid h-13 w-13 min-h-13 min-w-13 place-items-center rounded-2xl p-3 ${category.iconClass}`}
                      >
                        <CategoryIcon size={23} />
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {item.personalized ? (
                          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200">
                            For your vehicle
                          </span>
                        ) : null}

                        {item.important ? (
                          <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-200">
                            Important
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`mt-5 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${category.badgeClass}`}
                    >
                      {category.label}
                    </span>

                    <h2 className="mt-4 text-xl font-black leading-8">
                      {item.title}
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {item.summary}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-slate-600">
                      <span>{item.source}</span>
                      <span>{item.publishedAt}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/30 px-5 py-4 sm:px-6">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"
                    >
                      <ExternalLink size={15} />
                      Read More
                    </a>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSave(item.id)}
                        className={`grid h-10 w-10 place-items-center rounded-xl border transition ${
                          saved
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                        }`}
                        aria-label={saved ? "Remove bookmark" : "Save article"}
                      >
                        {saved ? (
                          <BookmarkCheck size={16} />
                        ) : (
                          <Bookmark size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void shareNews(item)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08]"
                        aria-label="Share article"
                      >
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 text-sm leading-6 text-blue-100">
          <strong>Mira News:</strong>{" "}
          {liveNews
            ? "Live automobile news is connected through the secure server API."
            : "The page is running in demo mode. Add NEWS_API_KEY in .env.local to enable live news."}
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