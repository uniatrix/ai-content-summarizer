import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Content Summarizer",
  description:
    "Paste a URL or text and get a clean, structured summary — TL;DR, key points, topics, and sentiment — powered by Llama 3.3 70B via Groq.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
