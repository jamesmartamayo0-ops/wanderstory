import type { Metadata } from "next";
import { Sora, Inter, Poppins } from "next/font/google";
import "./globals.css";
import ThemeScript from "./theme-script";
import { resolveSiteOrigin } from "@/lib/site-url";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: resolveSiteOrigin(),
  title: "WanderStory",
  description:
    "Personal journeys, immersive travel stories, and meaningful destinations from around the world.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${sora.variable} ${inter.variable} ${poppins.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
