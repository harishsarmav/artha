import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Release notes — FinBuddy",
  description: "Product updates for FinBuddy, your personal finance and planning workspace.",
};

export default function ReleaseNotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
