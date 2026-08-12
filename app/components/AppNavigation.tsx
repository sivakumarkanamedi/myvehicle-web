"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "../../supabase";

type NavigationItem = {
  label: string;
  shortLabel: string;
  icon: string;
  path: string;
  activePaths: string[];
};

const navigationItems: NavigationItem[] = [
  {
    label: "Home",
    shortLabel: "Home",
    icon: "🏠",
    path: "/",
    activePaths: ["/"],
  },
  {
    label: "Workshops",
    shortLabel: "Workshop",
    icon: "🛠️",
    path: "/workshops",
    activePaths: ["/workshops", "/workshop", "/booking", "/service-booking"],
  },
  {
    label: "Marketplace",
    shortLabel: "Market",
    icon: "🛍️",
    path: "/marketplace",
    activePaths: ["/marketplace"],
  },
  {
    label: "Reminders",
    shortLabel: "Reminders",
    icon: "🔔",
    path: "/reminders",
    activePaths: ["/reminders"],
  },
  {
    label: "Service History",
    shortLabel: "History",
    icon: "🧾",
    path: "/service-history",
    activePaths: ["/service-history"],
  },
];

const hiddenNavigationPaths = [
  "/login",
  "/signup",
  "/reset-password",
  "/forgot-password",
];

function isNavigationItemActive(
  pathname: string,
  item: NavigationItem,
  index: number
) {
  if (index === 0) {
    return pathname === "/";
  }

  return item.activePaths.some(
    (activePath) =>
      pathname === activePath || pathname.startsWith(`${activePath}/`)
  );
}

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const shouldHideNavigation = useMemo(
    () =>
      hiddenNavigationPaths.some(
        (hiddenPath) =>
          pathname === hiddenPath || pathname.startsWith(`${hiddenPath}/`)
      ),
    [pathname]
  );

  function navigateTo(item: NavigationItem) {
    router.push(item.path);
  }

  async function handleLogout() {
    const confirmed = window.confirm(
      "Are you sure you want to sign out of My Vehicle?"
    );

    if (!confirmed) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        window.alert(error.message);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      window.alert("Unable to sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (shouldHideNavigation) {
    return null;
  }

  return (
    <>
      <aside
        className={`fixed bottom-0 left-0 top-0 z-40 hidden border-r border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col ${
          sidebarCollapsed ? "w-24" : "w-72"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Go to My Vehicle home"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl shadow-lg shadow-blue-950/50">
              🚘
            </div>

            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold tracking-tight text-white">
                  My Vehicle
                </p>

                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                  Powered by Mira AI
                </p>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label={
              sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            title={
              sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
            }
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-5 pt-5">
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/15 to-indigo-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-xl">
                  🤖
                </div>

                <div>
                  <p className="text-sm font-bold text-blue-100">
                    Mira is ready
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-100/65">
                    Your proactive AI vehicle companion.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/mira")}
                className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500"
              >
                Ask Mira
              </button>
            </div>
          </div>
        )}

        <nav className="mt-5 flex-1 space-y-1.5 overflow-y-auto px-3 pb-5">
          {navigationItems.map((item, index) => {
            const active = isNavigationItemActive(pathname, item, index);

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigateTo(item)}
                className={`group relative flex w-full items-center rounded-2xl border text-left transition ${
                  sidebarCollapsed
                    ? "justify-center px-3 py-3.5"
                    : "gap-3 px-4 py-3.5"
                } ${
                  active
                    ? "border-blue-500/30 bg-blue-500/15 text-blue-100 shadow-lg shadow-blue-950/20"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-500" />
                )}

                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl transition ${
                    active
                      ? "bg-blue-500/20"
                      : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                  }`}
                >
                  {item.icon}
                </span>

                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.label}
                    </p>
                  </div>
                )}

                {!sidebarCollapsed && active && (
                  <span className="text-sm text-blue-300">›</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!sidebarCollapsed ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
              <p className="text-xs font-bold text-slate-400">
                My Vehicle MVP
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                Powered by Mira AI
              </p>
            </div>
          ) : (
            <div className="mx-auto h-2 w-2 rounded-full bg-emerald-400" />
          )}
        </div>
      </aside>

      <div className="fixed right-5 top-4 z-50 hidden lg:block">
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((current) => !current)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl transition ${
              profileOpen
                ? "border-blue-400/25 bg-blue-500/15 text-blue-100"
                : "border-white/10 bg-slate-950/90 text-slate-200 hover:border-blue-400/20 hover:bg-slate-900"
            }`}
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white">
              👤
            </span>

            <span className="text-sm font-black">
              Profile
            </span>

            <span className="text-xs text-slate-500">
              {profileOpen ? "▲" : "▼"}
            </span>
          </button>

          {profileOpen ? (
            <>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="fixed inset-0 z-[-1]"
                aria-label="Close profile menu"
              />

              <div className="absolute right-0 top-[calc(100%+0.65rem)] w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05]">
                    👤
                  </span>
                  <span className="text-sm font-semibold">
                    My Profile
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05]">
                    ⚙️
                  </span>
                  <span className="text-sm font-semibold">
                    Settings
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05]">
                    🆘
                  </span>
                  <span className="text-sm font-semibold">
                    Emergency Contacts
                  </span>
                </button>

                <div className="my-2 h-px bg-white/10" />

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    void handleLogout();
                  }}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-400/10">
                    ↪
                  </span>
                  <span className="text-sm font-semibold">
                    {loggingOut ? "Signing out..." : "Sign out"}
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {navigationItems.slice(0, 4).map((item, index) => {
            const active = isNavigationItemActive(pathname, item, index);

            return (
              <MobileNavigationButton
                key={item.label}
                item={item}
                active={active}
                onClick={() => navigateTo(item)}
              />
            );
          })}

          <MobileMoreMenu
            pathname={pathname}
            router={router}
            loggingOut={loggingOut}
            onLogout={handleLogout}
          />
        </div>
      </nav>
    </>
  );
}

function MobileNavigationButton({
  item,
  active,
  onClick,
}: {
  item: NavigationItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 transition ${
        active
          ? "bg-blue-500/15 text-blue-300"
          : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
      }`}
    >
      {active && (
        <span className="absolute -top-2 h-1 w-8 rounded-b-full bg-blue-500" />
      )}

      <span className="text-xl leading-none">{item.icon}</span>

      <span className="mt-1 max-w-full truncate text-[10px] font-semibold">
        {item.shortLabel}
      </span>
    </button>
  );
}

function MobileMoreMenu({
  pathname,
  router,
  loggingOut,
  onLogout,
}: {
  pathname: string;
  router: ReturnType<typeof useRouter>;
  loggingOut: boolean;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const profileItem: NavigationItem = {
    label: "Profile",
    shortLabel: "Profile",
    icon: "👤",
    path: "/profile",
    activePaths: ["/profile", "/settings"],
  };

  const moreItems = [...navigationItems.slice(4), profileItem];

  const moreSectionActive = moreItems.some((item) =>
    item.activePaths.some(
      (activePath) =>
        pathname === activePath || pathname.startsWith(`${activePath}/`)
    )
  );

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <div className="relative">
      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[-1] bg-black/40"
            aria-label="Close navigation menu"
          />

          <div className="absolute bottom-[calc(100%+0.75rem)] right-0 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
            <div className="border-b border-white/10 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
                My Vehicle
              </p>

              <p className="mt-1 text-sm font-bold text-white">More options</p>
            </div>

            <div className="py-2">
              {moreItems.map((item) => {
                const active = item.activePaths.some(
                  (activePath) =>
                    pathname === activePath ||
                    pathname.startsWith(`${activePath}/`)
                );

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      active
                        ? "bg-blue-500/15 text-blue-200"
                        : "text-slate-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-lg">
                      {item.icon}
                    </span>

                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-2">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => {
                  setOpen(false);
                  void onLogout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-lg">
                  ↪
                </span>

                <span className="text-sm font-semibold">
                  {loggingOut ? "Signing out..." : "Sign out"}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`relative flex w-full min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 transition ${
          moreSectionActive || open
            ? "bg-blue-500/15 text-blue-300"
            : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
        }`}
      >
        {(moreSectionActive || open) && (
          <span className="absolute -top-2 h-1 w-8 rounded-b-full bg-blue-500" />
        )}

        <span className="text-xl leading-none">☰</span>
        <span className="mt-1 text-[10px] font-semibold">More</span>
      </button>
    </div>
  );
}