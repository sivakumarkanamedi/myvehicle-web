"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../supabase";

const publicRoutes = [
  "/login",
  "/signup",
  "/reset-password",
  "/forgot-password",
  "/terms",
  "/privacy",
  "/insurance/verify",
];

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);

  const isPublicRoute = useMemo(() => {
    return publicRoutes.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`)
    );
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function resolveSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          console.warn(
            "Unable to check authentication session:",
            error.message
          );
        }

        if (!session && !isPublicRoute) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        if (session && isPublicRoute && pathname !== "/insurance/verify") {
          setLoading(false);
          router.replace("/");
          return;
        }

        setLoading(false);
      } catch (error) {
        if (!active) return;

        console.error("Auth session check failed:", error);

        setLoading(false);

        if (!isPublicRoute) {
          router.replace("/login");
        }
      }
    }

    void resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session && !isPublicRoute) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      if (
        session &&
        isPublicRoute &&
        pathname !== "/insurance/verify"
      ) {
        setLoading(false);
        router.replace("/");
        return;
      }

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isPublicRoute, pathname, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

          <p className="mt-4 text-sm text-slate-400">
            Loading My Vehicle...
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}