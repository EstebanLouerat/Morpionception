import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RouterMounting from "./wrapper";
import AudioManager from "./audio/AudioManager";
import ThemeManager from "./theme/ThemeManager";
import { themeScript } from "./theme/themeScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Morpionception",
  description: "Some tictactoe inside a big tictactoe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme script sets data-theme / data-palette before React hydrates
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <RouterMounting>
          <ThemeManager />
          <AudioManager />
          {children}
        </RouterMounting>
      </body>
    </html>
  );
}
