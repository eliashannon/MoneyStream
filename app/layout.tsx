import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoneyStream — your money, in focus",
  description: "A private, browser-only personal finance workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
