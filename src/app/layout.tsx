import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ReactiveBackground } from "@/components/ReactiveBackground";

export const metadata: Metadata = {
  title: "Floka",
  description: "Business funding, secured.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[var(--color-bg-primary)]">
        <ThemeProvider>
          <ReactiveBackground />
          <div className="relative z-10 min-h-screen">
            <Providers>
              {children}
            </Providers>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
