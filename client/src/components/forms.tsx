import { useRef, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { Copy, ErrorNotice, useTheme } from "./ui";
import { message } from "../lib/session-client";

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4, maxWidth: 580 }}>
      <Copy kind="label">{label}</Copy>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.instruction}
        style={{
          borderWidth: 1,
          borderColor: theme.hairline,
          backgroundColor: theme.panel,
          color: theme.ink,
          padding: 12,
          fontSize: 16,
          minHeight: 46,
        }}
        {...props}
      />
    </View>
  );
}

/** A synchronous lock prevents double taps; failed writes leave the caller's draft intact. */
export function useWrite() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, setNotice, run };
}
export function WriteNotice({ state }: { state: ReturnType<typeof useWrite> }) {
  return (
    <>
      <ErrorNotice error={state.error} />
      {state.notice && (
        <Copy accessibilityLiveRegion="polite">{state.notice}</Copy>
      )}
    </>
  );
}
