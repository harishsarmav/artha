import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Release notes — Dhanive",
  description: "Product updates for Dhanive, your personal finance and planning workspace.",
};

export default function ReleaseNotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
