import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAppDictionary } from "@/i18n/app";
import { requestI18n } from "@/i18n/server";
import { AppI18nProvider } from "./_lib/i18n";
import { SessionProvider } from "./_lib/session";
import "./app.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await requestI18n();
  const dict = await getAppDictionary(locale);
  return { title: dict["shell.title"], description: dict["shell.description"] };
}

/** The language comes from the same cookie and Accept-Language rule as the rest of the site. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { locale } = await requestI18n();
  const dict = await getAppDictionary(locale);
  return (
    <AppI18nProvider locale={locale} dict={dict}>
      <SessionProvider>{children}</SessionProvider>
    </AppI18nProvider>
  );
}
