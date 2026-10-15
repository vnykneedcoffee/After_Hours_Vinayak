import type { Metadata } from "next";
import "./globals.css";
import { PointerGlow } from "../components/pointer-glow";

export const metadata: Metadata = {
  title: "AfterHours — Watch together, actually together",
  description: "A real-time cinema room for friends."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><PointerGlow />{children}</body></html>;
}
