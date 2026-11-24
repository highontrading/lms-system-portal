import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Script from "next/script";
import { themeCss, themeScript } from "@/lib/theme";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/server/url";
import "./globals.css";

// Every page reads live settings and the session, so routes render at request time
// rather than from a build-time shell. Segments add their own loading states.
export const instant = false;

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { general, seo } = await getSettings();
  const title = seo.metaTitle || general.siteName;
  const description = seo.metaDescription || general.tagline;
  return {
    metadataBase: new URL(appUrl()),
    title: { default: title, template: `%s · ${general.siteName}` },
    description,
    applicationName: general.siteName,
    icons: general.faviconUrl ? { icon: general.faviconUrl } : undefined,
    openGraph: {
      type: "website",
      siteName: general.siteName,
      title,
      description,
      images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined,
    },
    robots: seo.allowIndexing ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#12111a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { branding, seo } = await getSettings();

  return (
    <html lang="en" data-theme={branding.defaultTheme === "dark" ? "dark" : "light"} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss(branding) }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript(branding.defaultTheme) }} />
      </head>
      <body className={`${inter.variable} ${display.variable} font-sans`}>
        <Providers>{children}</Providers>
        <Toaster />
        {seo.googleAnalyticsId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seo.googleAnalyticsId}');`}
            </Script>
          </>
        ) : null}
        {seo.metaPixelId ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.metaPixelId}');fbq('track','PageView');`}
          </Script>
        ) : null}
      </body>
    </html>
  );
}
