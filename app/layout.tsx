import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = { title: "DrawSQL — Visual Oracle schema design", description: "Draw, model, and ship Oracle schemas visually." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(mono.variable, "font-sans", inter.variable)}>
      <body>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
