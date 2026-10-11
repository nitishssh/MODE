import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, View } from "react-native";
import { Link } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { ScanResult } from "../generated/contracts";
import { useSession } from "../lib/session";
import { doorTone } from "../lib/journey";
import { notifyDoorResult } from "../lib/door-haptics";
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
  const [cameraPrompt, setCameraPrompt] = useState(false);
  const [permission, askPermission] = useCameraPermissions();
  const scanned = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") setCamera(false); });
    return () => subscription.remove();
  }, []);
  useEffect(() => { setCamera(false); setCameraPrompt(false); }, [eventId]);
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
        await notifyDoorResult(next);
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
            onPress={() => setCameraPrompt(true)}
          >
            Scan QR with camera
          </Action>
          {cameraPrompt && <Row>
            <Copy kind="label">Allow camera for QR scanning?</Copy>
            <Copy>Codes are read on your device. Only the decoded pass or ticket code is sent to MODE for check-in. Video and audio are not recorded or uploaded. You can type a short code instead.</Copy>
            <Link href="/privacy">Privacy policy</Link>
            <Action onPress={() => setCameraPrompt(false)}>Not now — type a code</Action>
            <Action disabled={write.busy}
            onPress={() =>
              void write.run(async () => {
                setCameraPrompt(false);
                if (permission && !permission.granted && !permission.canAskAgain) {
                  write.setNotice("Camera access is blocked. Enable it in device settings or type the short code.");
                  return;
                }
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
            Continue to camera
          </Action>
          </Row>}
          {permission && !permission.granted && !permission.canAskAgain && <Action onPress={() => void Linking.openSettings()}>Open camera permission settings</Action>}
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
