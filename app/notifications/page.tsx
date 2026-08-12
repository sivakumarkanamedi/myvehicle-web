"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileText,
  Filter,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type NotificationCategory =
  | "documents"
  | "services"
  | "challans"
  | "sos"
  | "mira";

type AppNotification = {
  id: number;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  priority: "normal" | "important" | "urgent";
};

type FilterOption =
  | "all"
  | "unread"
  | NotificationCategory;

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 1,
    category: "documents",
    title: "Insurance expires in 12 days",
    message:
      "Your insurance policy for KA03KV0430 expires on 18 Aug 2026. Review the policy before renewal.",
    createdAt: "Today, 8:45 AM",
    read: false,
    actionLabel: "Open Documents",
    actionHref: "/documents",
    priority: "important",
  },
  {
    id: 2,
    category: "challans",
    title: "2 traffic challans are pending",
    message:
      "The total pending amount recorded for your selected vehicle is ₹1,500.",
    createdAt: "Today, 7:20 AM",
    read: false,
    actionLabel: "View Challans",
    actionHref: "/challans",
    priority: "urgent",
  },
  {
    id: 3,
    category: "services",
    title: "Service reminder is approaching",
    message:
      "Your next service reminder is due within 8 days. Review the service history and book a workshop.",
    createdAt: "Yesterday, 6:15 PM",
    read: false,
    actionLabel: "View Reminders",
    actionHref: "/reminders",
    priority: "important",
  },
  {
    id: 4,
    category: "mira",
    title: "Mira recommendation",
    message:
      "Your documents are mostly up to date. Renew insurance and clear pending challans before your next long journey.",
    createdAt: "Yesterday, 9:30 AM",
    read: true,
    actionLabel: "Ask Mira",
    actionHref: "/mira",
    priority: "normal",
  },
  {
    id: 5,
    category: "sos",
    title: "Emergency contact not added",
    message:
      "Add one emergency contact so Mira can share your live location during an SOS event.",
    createdAt: "04 Aug 2026, 4:10 PM",
    read: true,
    actionLabel: "Open Profile",
    actionHref: "/profile",
    priority: "important",
  },
  {
    id: 6,
    category: "documents",
    title: "PUC document is valid",
    message:
      "Your PUC document is recorded and no immediate renewal action is required.",
    createdAt: "02 Aug 2026, 11:05 AM",
    read: true,
    actionLabel: "Open Documents",
    actionHref: "/documents",
    priority: "normal",
  },
];

const FILTERS: Array<{
  value: FilterOption;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "documents", label: "Documents" },
  { value: "services", label: "Services" },
  { value: "challans", label: "Challans" },
  { value: "sos", label: "SOS" },
  { value: "mira", label: "Mira" },
];

function getCategoryDetails(category: NotificationCategory) {
  if (category === "documents") {
    return {
      label: "Documents",
      icon: FileText,
      iconClass: "bg-cyan-400/15 text-cyan-300",
      badgeClass:
        "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    };
  }

  if (category === "services") {
    return {
      label: "Services",
      icon: Wrench,
      iconClass: "bg-amber-400/15 text-amber-300",
      badgeClass:
        "border-amber-400/20 bg-amber-400/10 text-amber-200",
    };
  }

  if (category === "challans") {
    return {
      label: "Challans",
      icon: ShieldAlert,
      iconClass: "bg-rose-400/15 text-rose-300",
      badgeClass:
        "border-rose-400/20 bg-rose-400/10 text-rose-200",
    };
  }

  if (category === "sos") {
    return {
      label: "SOS",
      icon: Zap,
      iconClass: "bg-red-400/15 text-red-300",
      badgeClass:
        "border-red-400/20 bg-red-400/10 text-red-200",
    };
  }

  return {
    label: "Mira",
    icon: Sparkles,
    iconClass: "bg-violet-400/15 text-violet-300",
    badgeClass:
      "border-violet-400/20 bg-violet-400/10 text-violet-200",
  };
}

function getPriorityDetails(priority: AppNotification["priority"]) {
  if (priority === "urgent") {
    return {
      label: "Urgent",
      icon: CircleAlert,
      className:
        "border-rose-400/20 bg-rose-400/10 text-rose-200",
    };
  }

  if (priority === "important") {
    return {
      label: "Important",
      icon: AlertTriangle,
      className:
        "border-amber-400/20 bg-amber-400/10 text-amber-200",
    };
  }

  return {
    label: "Update",
    icon: CheckCircle2,
    className:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] =
    useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] =
    useState<FilterOption>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const filteredNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "unread" && !notification.read) ||
        notification.category === activeFilter;

      const matchesSearch =
        !query ||
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, notifications, searchTerm]);

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  }

  function toggleRead(notificationId: number) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              read: !notification.read,
            }
          : notification
      )
    );
  }

  function dismissNotification(notificationId: number) {
    setNotifications((current) =>
      current.filter(
        (notification) => notification.id !== notificationId
      )
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

          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Alerts & Updates
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Notification Center
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Review document expiry alerts, service reminders, challans,
                SOS updates and Mira recommendations in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-200 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck size={18} />
              Mark all as read
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Bell size={22} />}
            label="Total Alerts"
            value={String(notifications.length)}
            helper="All notifications"
            className="border-blue-400/20 bg-blue-500/10 text-blue-200"
          />

          <SummaryCard
            icon={<CircleAlert size={22} />}
            label="Unread"
            value={String(unreadCount)}
            helper="Needs review"
            className="border-amber-400/20 bg-amber-500/10 text-amber-200"
          />

          <SummaryCard
            icon={<ShieldAlert size={22} />}
            label="Challans"
            value={String(
              notifications.filter(
                (notification) =>
                  notification.category === "challans"
              ).length
            )}
            helper="Compliance alerts"
            className="border-rose-400/20 bg-rose-500/10 text-rose-200"
          />

          <SummaryCard
            icon={<Sparkles size={22} />}
            label="Mira Updates"
            value={String(
              notifications.filter(
                (notification) =>
                  notification.category === "mira"
              ).length
            )}
            helper="AI recommendations"
            className="border-violet-400/20 bg-violet-500/10 text-violet-200"
          />
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
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search notifications"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40"
              />
            </div>

            <div className="relative min-w-[190px]">
              <Filter
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={activeFilter}
                onChange={(event) =>
                  setActiveFilter(
                    event.target.value as FilterOption
                  )
                }
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-10 text-sm font-bold text-white outline-none"
              >
                {FILTERS.map((filter) => (
                  <option
                    key={filter.value}
                    value={filter.value}
                  >
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

        <section className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 size={30} />
              </div>

              <h2 className="mt-5 text-xl font-black">
                No notifications found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                You are all caught up or no notification matches the
                selected filter.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const category = getCategoryDetails(
                notification.category
              );
              const priority = getPriorityDetails(
                notification.priority
              );
              const CategoryIcon = category.icon;
              const PriorityIcon = priority.icon;

              return (
                <article
                  key={notification.id}
                  className={`overflow-hidden rounded-3xl border shadow-xl transition ${
                    notification.read
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-blue-400/20 bg-blue-500/[0.06]"
                  }`}
                >
                  <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div
                        className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${category.iconClass}`}
                      >
                        <CategoryIcon size={25} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${category.badgeClass}`}
                          >
                            {category.label}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${priority.className}`}
                          >
                            <PriorityIcon size={12} />
                            {priority.label}
                          </span>

                          {!notification.read ? (
                            <span className="rounded-full bg-blue-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                              New
                            </span>
                          ) : null}
                        </div>

                        <h2 className="mt-3 text-lg font-black sm:text-xl">
                          {notification.title}
                        </h2>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                          {notification.message}
                        </p>

                        <p className="mt-3 text-xs font-semibold text-slate-600">
                          {notification.createdAt}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleRead(notification.id)
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"
                      >
                        {notification.read
                          ? "Mark unread"
                          : "Mark read"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          dismissNotification(notification.id)
                        }
                        className="grid h-10 w-10 place-items-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-200 transition hover:bg-rose-400/15"
                        aria-label="Dismiss notification"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {notification.actionHref &&
                  notification.actionLabel ? (
                    <div className="border-t border-white/10 bg-slate-950/30 px-5 py-4 sm:px-6">
                      <Link
                        href={notification.actionHref}
                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-950/30"
                      >
                        {notification.actionLabel}
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
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