import "@/components/login-page.css";
import { LoginPage } from "@/components/login-page";
import { safeReturnTarget } from "../../../shared/return-target";

export default async function Login({ searchParams }: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = safeReturnTarget((await searchParams).returnTo) ?? "/dashboard";
  return <LoginPage returnTo={returnTo} registrationEnabled={process.env.MODE_EXPO_WEB === "1"} />;
}
