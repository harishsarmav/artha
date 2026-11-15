import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Release notes — DhanView",
  description: "Product updates for DhanView, your personal finance and planning workspace.",
};

export default function ReleaseNotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
