import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { getActiveClient } from "@/lib/client-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const brand = getActiveClient().brand;

export const metadata: Metadata = {
  title: brand.metaTitle,
  description: brand.metaDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: brand.clerk.colorPrimary,
          colorBackground: brand.clerk.colorBackground,
          colorForeground: brand.clerk.colorText,
        },
        elements: {
          formButtonPrimary:
            "bg-accent-primary hover:bg-accent-primary/90 text-white transition-all",
          card: "shadow-soft border border-border",
        }
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        style={brand.cssVars as React.CSSProperties}
      >
        <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-accent-primary/10 selection:text-accent-primary">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
