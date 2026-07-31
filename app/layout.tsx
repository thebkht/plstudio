import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Oracle Schema Designer", description: "Oracle PL/SQL schema design workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
