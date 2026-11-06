import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artha — Plan with confidence",
  description: "A thoughtful personal finance and life planning assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
