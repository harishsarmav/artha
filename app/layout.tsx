import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artha — Your AI Financial Coach",
  description: "Understand your money, track your finances and get practical AI-powered guidance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
