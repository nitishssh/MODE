import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import type { ScanResult } from "../generated/contracts";
import { useSession } from "../lib/session";
import { doorTone } from "../lib/journey";
import { Action, Copy, Row, useTheme } from "./ui";
import { Field, useWrite, WriteNotice } from "./forms";

export function Door({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const { client } = useSession();
  const theme = useTheme();
  const write = useWrite();
  const [credential, setCredential] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [camera, setCamera] = useState(false);
  const [permission, askPermission] = useCameraPermissions();
  const scanned = useRef(false);
  function scan(value: string) {
    if (scanned.current || !value.trim()) return;
    scanned.current = true;
    setCamera(false);
    setResult(null);
    void write.run(async () => {
      try {
        const next = await client.request<ScanResult>(
          `/api/events/${encodeURIComponent(eventId)}/scan`,
          {
            method: "POST",
            body: JSON.stringify({ credential: value.trim() }),
          },
        );
        setResult(next);
        if (Platform.OS !== "web")
          await Haptics.notificationAsync(
            next.admitted
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Error,
          ).catch(() => {});
      } finally {
        scanned.current = false;
      }
    });
  }
  return (
    <Row>
      <Copy kind="title">Door check-in</Copy>
      <Copy>Selected event: {eventTitle}</Copy>
      <Field
        label="Member or ticket short code"
        value={credential}
        onChangeText={setCredential}
        editable={!write.busy}
        autoCapitalize="characters"
      />
      <Action
        disabled={write.busy || !credential.trim()}
        onPress={() => scan(credential)}
      >
        Check admission
      </Action>
      {Platform.OS !== "web" && (
        <>
          <Action
            disabled={write.busy}
            onPress={() =>
              void write.run(async () => {
                const allowed =
                  permission?.granted || (await askPermission()).granted;
                if (allowed) setCamera(true);
                else
                  write.setNotice(
                    "Camera permission denied. Enter the short code instead.",
                  );
              })
            }
          >
            Scan QR with camera
          </Action>
          {camera && permission?.granted && (
            <>
              <View style={{ height: 260 }}>
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={(value) => scan(value.data)}
                />
              </View>
              <Action onPress={() => setCamera(false)}>Close camera</Action>
            </>
          )}
        </>
      )}
      <WriteNotice state={write} />
      {result && (
        <Row>
          <Copy
            accessibilityLiveRegion="assertive"
            kind="title"
            style={{ color: theme[doorTone(result)] }}
          >
            {result.message}
          </Copy>
          {result.attendee && (
            <Copy>
              {result.attendee.name} · membership {result.attendee.membership}
            </Copy>
          )}
          {result.checkedInAt && (
            <Copy>
              Original admission:{" "}
              {new Date(result.checkedInAt).toLocaleString()}
            </Copy>
          )}
        </Row>
      )}
    </Row>
  );
}
