import { Pressable, StyleSheet, Text, View } from "react-native";

import { CATEGORIES, COLORS } from "@/constants/pantry";

type Props = {
  value: string;
  onChange: (category: string) => void;
};

export function CategoryChips({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {CATEGORIES.map((c) => {
        const selected = c.name === value;
        return (
          <Pressable
            key={c.name}
            onPress={() => onChange(c.name)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text
              style={[styles.chipText, selected && styles.chipTextSelected]}
            >
              {c.emoji} {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: { color: COLORS.text, fontSize: 14 },
  chipTextSelected: { color: "#FFFFFF", fontWeight: "600" },
});
