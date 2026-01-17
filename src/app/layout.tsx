import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Broker Portal",
  description: "Business funding, secured.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-bg-primary)]">
        <div className="relative z-10 min-h-screen">
          <Providers>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
