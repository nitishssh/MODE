import { useState } from "react";
import { Link, Redirect } from "expo-router";
import { useSession } from "../lib/session";
import { Field } from "../components/forms";
import { Action, Copy, ErrorNotice, Screen } from "../components/ui";
export default function Register() {
  const { client, user, busy, error } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  if (user) return <Redirect href="/" />;
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
      <Link href="/login">Go to sign in</Link>
    </Screen>
  );
}
