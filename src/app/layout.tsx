import type { Metadata } from "next";
import "@/styles/game.css";
import { WipeTransitionProvider } from "@/components/WipeTransition";

export const metadata: Metadata = {
  title: "Fighting Game Engine",
  description: "Browser-based 2D fighting game powered by WebAssembly",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:ital,wght@0,400;0,600;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WipeTransitionProvider>{children}</WipeTransitionProvider>
      </body>
    </html>
  );
}
