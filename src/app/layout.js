import { Archivo_Black, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Archivo_Black({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata = {
  title: "Take Me Somewhere",
  description: "A random corner of the internet, one click away.",
};

function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return null;

  return <>
    <Script async src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
    <Script id="google-analytics" strategy="afterInteractive">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });`}
    </Script>
  </>;
}

export default function RootLayout({ children }) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${mono.variable}`}><body><a className="skip-link" href="#main-content">Skip to content</a>{children}<GoogleAnalytics /></body></html>;
}
