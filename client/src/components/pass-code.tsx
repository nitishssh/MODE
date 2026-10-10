import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Copy } from "./ui";
export function PassCode({ token, code }: { token?: string; code: string }) {
  return (
    <View style={{ gap: 12, alignItems: "flex-start" }}>
      {token && (
        <View
          accessibilityLabel={`QR code. Typed alternative: ${code}`}
          style={{ backgroundColor: "white", padding: 16 }}
        >
          <QRCode value={token} size={160} />
        </View>
      )}
      <Copy selectable kind="mono" style={{ fontSize: 26 }}>
        {code}
      </Copy>
    </View>
  );
}
