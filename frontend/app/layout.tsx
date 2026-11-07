import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Suspense } from "react";
import Shell from "@/components/Shell";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Viva",
  description: "Prove it, don't police it. Understanding checks for university assessment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="h-full">
        <AppProvider>
          <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#14284b] text-white" role="status"><p className="font-serif text-xl">Viva</p><span className="ml-3 text-sm text-white/70">Loading…</span></div>}><Shell>{children}</Shell></Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
