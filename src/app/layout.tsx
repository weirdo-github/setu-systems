import type { Metadata } from "next";
import "../styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "setu systems",
  description: "Unified Setu Systems portal family for finance, referral, and discovery operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
