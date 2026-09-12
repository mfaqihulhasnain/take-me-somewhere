import { Archivo_Black, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo_Black({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata = {
  title: "Take Me Somewhere",
  description: "A random corner of the internet, one click away.",
};

export default function RootLayout({ children }) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${mono.variable}`}><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
