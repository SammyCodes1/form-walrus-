import "@mysten/dapp-kit/dist/index.css";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./animations.css";
import { Providers } from "./providers";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "FormWalrus",
  description: "Walrus-native forms platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050507",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NavigationProgressBar />
        <ThemeProvider>
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
