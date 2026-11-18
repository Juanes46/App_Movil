import { Pressable, StyleSheet, Text } from "react-native";

import { COLORS } from "@/constants/pantry";
import { FONTS } from "@/theme/fonts";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: object;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "primary" && { color: COLORS.white },
          variant === "secondary" && { color: COLORS.primaryDark },
          variant === "danger" && { color: COLORS.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  danger: { backgroundColor: COLORS.dangerSoft },
  text: { fontSize: 16, fontFamily: FONTS.bodySemi },
});
