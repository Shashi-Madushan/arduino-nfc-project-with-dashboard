import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Canteen Orders Management",
  description: "NFC-based canteen ordering and collection system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-slate-50 text-slate-900 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
