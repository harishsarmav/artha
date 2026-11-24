import type { Metadata } from "next";
import "./globals.css";
import { ThemeSync } from "./theme-sync";

export const metadata: Metadata = {
  title: "FinBuddy — Personal finance, made clear",
  description: "A private personal finance workspace for spending, saving, goals, and reminders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ThemeSync />{children}</body></html>;
}
