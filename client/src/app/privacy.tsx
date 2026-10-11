import { Link } from "expo-router";
import { Linking, Platform } from "react-native";
import type { PrivacyPolicyResponse } from "../generated/contracts";
import { useResource } from "../lib/use-resource";
import { Action, Copy, ErrorNotice, LoadingRows, Row, Screen } from "../components/ui";

export default function Privacy() {
  const { data, error, loading, reload } = useResource<PrivacyPolicyResponse>("/api/privacy-policy");
  return <Screen title="Privacy & permissions">
    <Copy>Camera access is optional. Files are selected individually and need your upload action. Your profile is used for the club services you request.</Copy>
    <ErrorNotice error={error} />
    {loading && !data && <LoadingRows />}
    {error && <Action onPress={() => void reload()}>Retry policy</Action>}
    {data && <><Copy>{data.organization} · Effective {data.effectiveDate} · Version {data.version}</Copy>{data.sections.map((section) => <Row key={section.title}><Copy kind="label" accessibilityRole="header">{section.title}</Copy><Copy>{section.text}</Copy></Row>)}<Row><Copy kind="label">Privacy contact</Copy><Copy>{data.contactEmail}{data.localContact ? " — local example only; contact your club administrator directly." : ""}</Copy></Row></>}
    {Platform.OS !== "web" && <Action onPress={() => void Linking.openSettings()}>Open device permission settings</Action>}
    <Copy>The native app follows your device theme and does not save optional website preferences. Exported Expo web uses essential sign-in cookies; the main MODE website provides its cookie controls at /privacy.</Copy>
    <Link href="/">Back to MODE</Link>
  </Screen>;
}
