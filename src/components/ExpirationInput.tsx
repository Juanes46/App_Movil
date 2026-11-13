import { StyleSheet, Text, TextInput, View } from "react-native";

import { COLORS } from "@/constants/pantry";
import {
  daysUntil,
  getStatus,
  maskDateInput,
  parseDate,
  STATUS_INFO,
  statusText,
} from "@/utils/expiration";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Mensaje de error externo (por ejemplo, "Ingresa la fecha"). */
  error?: string;
};

/**
 * Campo de fecha DD/MM/AAAA: pone las barras solo y, cuando la fecha es
 * válida, muestra en vivo el estado que tendría el producto.
 */
export function ExpirationInput({ value, onChangeText, error }: Props) {
  const complete = value.length === 10;
  const date = complete ? parseDate(value) : null;
  const invalid = complete && !date;

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(maskDateInput(t))}
        placeholder="DD/MM/AAAA"
        placeholderTextColor={COLORS.muted}
        keyboardType="number-pad"
        maxLength={10}
        style={[styles.input, (invalid || !!error) && styles.inputError]}
      />

      {date && (
        <View
          style={[
            styles.badge,
            { backgroundColor: STATUS_INFO[getStatus(date)].bg },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: STATUS_INFO[getStatus(date)].color },
            ]}
          >
            {STATUS_INFO[getStatus(date)].emoji}{" "}
            {STATUS_INFO[getStatus(date)].label} · {statusText(daysUntil(date))}
          </Text>
        </View>
      )}

      {invalid && (
        <Text style={styles.error}>
          Esa fecha no existe. Revisa día, mes y año.
        </Text>
      )}
      {!invalid && !!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 76,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    fontSize: 24,
    fontFamily: "Jakarta",
    fontWeight: "700",
    letterSpacing: 1,
    color: COLORS.text,
  },
  inputError: { borderColor: COLORS.danger },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontSize: 13, fontWeight: "700" },
  error: { color: COLORS.danger, fontSize: 13 },
});
