import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { CATEGORIES, COLORS } from "@/constants/pantry";
import { FONTS } from "@/theme/fonts";

type Props = {
  value: string;
  onChange: (category: string) => void;
};

/** Chips de categoría en una sola fila con scroll horizontal (son 14). */
export function CategoryChips({ value, onChange }: Props) {
  // Una categoría antigua que ya no está en la lista se muestra igual, al inicio.
  const legacy = value && !CATEGORIES.some((c) => c.name === value);
  const items = legacy ? [{ name: value, emoji: "📦" }, ...CATEGORIES] : CATEGORIES;
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel="Categoría"
    >
      {items.map((c) => {
        const selected = c.name === value;
        return (
          <Pressable
            key={c.name}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(c.name)}
            // Al abrir, la fila se desplaza hasta la categoría elegida (p. ej. "Otros", al final).
            onLayout={(e) => {
              if (!selected || scrolled.current) return;
              scrolled.current = true;
              scroll.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
            }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {c.emoji} {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 8, paddingRight: 8 },
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
  chipText: { color: COLORS.text, fontSize: 14, fontFamily: FONTS.body },
  chipTextSelected: { color: COLORS.white, fontFamily: FONTS.bodySemi },
});
