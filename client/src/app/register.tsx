import { useState } from "react";
import { Switch, View } from "react-native";
import { PRIVACY_POLICY_VERSION } from "../generated/contracts";
import { Link } from "expo-router";
import { useSession } from "../lib/session";
import { AuthRedirect } from "../lib/auth-redirect";
import { authHref } from "../lib/return-target";
import { useScreenSearchParams } from "../lib/use-screen-search-params";
import { Field } from "../components/forms";
import { Action, Copy, ErrorNotice, LoadingRows, Screen } from "../components/ui";
export default function Register() {
  const { client, status, user, busy, error } = useSession();
  const { returnTo } = useScreenSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  if (user) return <AuthRedirect user={user} returnTo={returnTo} />;
  if (status === "loading") return <Screen title="Opening your register"><LoadingRows /></Screen>;
  return (
    <Screen title="Join the club">
      <Copy>
        Create your account to get your member pass. An officer records dues to
        activate your membership.
      </Copy>
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        editable={!busy}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!busy}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!busy}
      />
      <ErrorNotice error={error} />
      <Link href="/privacy">Read privacy policy & permissions</Link>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Switch value={privacyAccepted} onValueChange={setPrivacyAccepted} disabled={busy} accessibilityLabel="I have read the privacy policy and understand how MODE uses my profile and club activity" /><Copy style={{ flex: 1 }}>I have read the policy and understand how my profile and club activity are used to run my account.</Copy></View>
      <Copy>Camera access is optional. Files are shared only when you select and upload them. Essential cookies or device storage keep you signed in.</Copy>
      <Action
        disabled={busy || !privacyAccepted || !name.trim() || !email.trim() || !password}
        onPress={() => void client.signUp(name, email, password, privacyAccepted ? PRIVACY_POLICY_VERSION : "")}
      >
        Create account
      </Action>
      {status === "unavailable" && (
        <Action onPress={() => void client.bootstrap()}>Retry saved session</Action>
      )}
      <Link replace href={authHref("/login", returnTo)}>Go to sign in</Link>
    </Screen>
  );
}
