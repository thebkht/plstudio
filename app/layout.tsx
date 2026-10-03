import "./globals.css";
import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = { title: "PLStudio — Visual Oracle schema design", description: "Draw, model, and ship Oracle schemas visually." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // next-themes stamps data-theme on <html> before first paint, so the server
    // markup and the hydrated attribute legitimately differ.
    <html lang="en" className={cn(mono.variable, "font-sans", geist.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
