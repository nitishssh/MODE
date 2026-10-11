import { useState } from "react";
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
      <Action
        disabled={busy || !name.trim() || !email.trim() || !password}
        onPress={() => void client.signUp(name, email, password)}
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
