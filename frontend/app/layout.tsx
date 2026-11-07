import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Least Privilege",
  description: "GreatUniHack 2026 skeleton",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
