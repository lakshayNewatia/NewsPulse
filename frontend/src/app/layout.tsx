import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "News Pulse — Topic-Clustered News Timeline",
  description:
    "Live news articles automatically grouped into topic clusters and visualised on a timeline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-ink text-text font-body antialiased">
        {children}
      </body>
    </html>
  );
}
