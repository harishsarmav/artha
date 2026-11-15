import type { Metadata } from "next";
import "./globals.css";
import { ThemeSync } from "./theme-sync";

export const metadata: Metadata = {
  title: "DhanView — Personal finance & planning",
  description: "A thoughtful personal finance and life planning workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ThemeSync />{children}</body></html>;
}
