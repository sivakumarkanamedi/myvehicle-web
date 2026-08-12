import type { Metadata } from "next";
import "./globals.css";

import AuthGate from "./AuthGate";
import AppNavigation from "./components/AppNavigation";

export const metadata: Metadata = {
  title: "My Vehicle",
  description:
    "India's First Proactive AI Vehicle Companion — Powered by Mira AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-slate-950 text-white antialiased">
        <AuthGate>
          <AppNavigation />

          <div className="min-h-screen w-full bg-slate-950 pb-24 lg:ml-72 lg:w-[calc(100%-18rem)] lg:pb-0">
            {children}
          </div>
        </AuthGate>
      </body>
    </html>
  );
}