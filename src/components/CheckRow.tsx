import { Pressable, View } from "react-native";
import { COLORS as C, emojiFor } from "@/constants/pantry";
import { Txt, ui } from "./PantryUI";
export function CheckRow({
  name,
  category,
  subtitle,
  quantity = 1,
  checked,
  onPress,
}: {
  name: string;
  category: string;
  subtitle?: string;
  quantity?: number;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}
      onPress={onPress}
      style={[
        ui.row,
        {
          padding: 10,
          minHeight: 62,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 14,
          backgroundColor: "white",
        },
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: C.primary,
          backgroundColor: checked ? C.primary : "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Txt style={{ color: "white" }}>✓</Txt>}
      </View>
      <View style={[ui.image, { width: 40, height: 40, borderRadius: 10 }]}>
        <Txt style={{ fontSize: 24 }}>{emojiFor(category)}</Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt numberOfLines={2} style={{ fontWeight: "600", fontSize: 14 }}>
          {name}
        </Txt>
        {subtitle && (
          <Txt style={{ fontSize: 12, color: C.muted }}>{subtitle}</Txt>
        )}
      </View>
      <Txt style={{ fontWeight: "600" }}>x{quantity}</Txt>
    </Pressable>
  );
}
