import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Suspense } from "react";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Socratic",
  description: "Prove it, don't police it. Understanding checks for university assessment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">
        <AppProvider>
          <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#f5f5f5] text-ink" role="status"><p className="font-sans text-xl">Socratic</p><span className="ml-3 text-sm text-ink2">Loading…</span></div>}><Shell>{children}</Shell></Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
