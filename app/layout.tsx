import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContractorCopilot | Win more work with less paperwork",
  description: "AI-powered estimates, proposals, and deposits for specialty contractors.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
