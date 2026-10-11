import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Platform, TextInput, View } from "react-native";
import { useSession } from "../lib/session";
import { AuthRedirect } from "../lib/auth-redirect";
import { authHref, safeReturnTarget } from "../lib/return-target";
import { hostLoginTarget } from "../lib/host-login";
import { useScreenSearchParams } from "../lib/use-screen-search-params";
import {
  Action,
  Copy,
  ErrorNotice,
  LoadingRows,
  Screen,
  useTheme,
} from "../components/ui";
import { fonts, radius } from "../constants/theme";
export default function Login() {
  const { status, user, busy, error, client } = useSession();
  const { returnTo } = useScreenSearchParams();
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Internal Expo links still resolve this route. In the combined web delivery,
  // cross the document boundary so Azman's Next sign-in owns the screen.
  const hosted = Platform.OS === "web" && typeof document !== "undefined" &&
    document.querySelector('meta[name="mode-host"][content="next"]') !== null;
  const loginTarget = hostLoginTarget(safeReturnTarget(returnTo));
  useEffect(() => {
    if (hosted) window.location.replace(loginTarget);
  }, [hosted, loginTarget]);
  if (hosted) return <Screen title="Opening sign in"><LoadingRows /></Screen>;
  if (user) return <AuthRedirect user={user} returnTo={returnTo} />;
  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.hairline,
    borderRadius: radius.input,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: theme.ink,
    backgroundColor: theme.panel,
  };
  return (
    <Screen title="Your club, on the record.">
      <Copy>Sign in to see your membership, tasks and club register.</Copy>
      {status === "loading" ? (
        <LoadingRows />
      ) : (
        <View style={{ gap: 12, width: "100%", maxWidth: 440 }}>
          <Copy kind="label">Email</Copy>
          <TextInput
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            style={inputStyle}
            editable={!busy}
          />
          <Copy kind="label">Password</Copy>
          <TextInput
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            style={inputStyle}
            editable={!busy}
            onSubmitEditing={() => {
              if (email && password) void client.signIn(email, password);
            }}
          />
          <ErrorNotice error={error} />
          <Action
            primary
            disabled={busy || !email.trim() || !password}
            onPress={() => void client.signIn(email, password)}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Action>
          {status === "unavailable" && (
            <Action onPress={() => void client.bootstrap()}>
              Retry saved session
            </Action>
          )}
        </View>
      )}
      <Copy style={{ color: theme.instruction }}>
        Payments are recorded by club officers. No payment is charged in this
        app.
      </Copy>
      <Link replace href={authHref("/register", returnTo)}>Create an account</Link>
      <Link href="/privacy">Privacy policy & permissions</Link>
      <Link href="/booking">Guest event booking</Link>
      <Link href="/archive">Public announcement archive</Link>
    </Screen>
  );
}
