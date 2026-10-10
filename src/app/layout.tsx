import type { Metadata } from "next";
import { I18nProvider } from "@/i18n/client";
import { requestI18n } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await requestI18n();
  return { title: dict["app.title"], description: dict["app.description"] };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, info, dict } = await requestI18n();
  return (
    <html lang={locale} dir={info.dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400..800;1,400..800&family=DM+Sans:wght@300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
