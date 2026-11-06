import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Release notes — Artha",
  description: "Product updates for Artha, your personal finance and planning workspace.",
};

export default function ReleaseNotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
