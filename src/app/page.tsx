import { LandingEntry } from "@/components/landing-entry";

export default function Home() {
  return <LandingEntry expoWeb={process.env.MODE_EXPO_WEB === "1"} />;
}
