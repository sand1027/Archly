import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";

export const metadata: Metadata = {
  title: {
    default: "Archly — System Design Simulator",
    template: "%s | Archly",
  },
  description:
    "Design, simulate, and chaos-test distributed system architectures in the browser. 45+ components, live traffic simulation, 7 chaos types, and AI text-to-diagram.",
  keywords: [
    "system design",
    "architecture diagram",
    "distributed systems",
    "chaos engineering",
    "simulation",
    "excalidraw",
    "interview",
  ],
  openGraph: {
    title: "Archly — System Design Simulator",
    description:
      "Design, simulate, and chaos-test distributed system architectures in the browser.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: ThemeProvider adds/removes "dark" class on <html>
    // which causes a mismatch between SSR and client — this suppresses that warning.
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
