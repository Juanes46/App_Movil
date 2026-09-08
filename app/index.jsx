import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const opciones = [
    { titulo: "Punto 1 - Serie de Fibonacci", ruta: "/home" },
    { titulo: "Punto 2 - Factorial", ruta: "/factorial" },
    { titulo: "Punto 3 - Tablas de Multiplicar", ruta: "/tablas" },
    { titulo: "Punto 4 - Notas", ruta: "/notas/digite" },
    { titulo: "Punto 5 - Reto", ruta: "/reto" },
];

export default function Index() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.titulo}>Taller Apps Móviles</Text>
            {opciones.map((op) => (
                <TouchableOpacity
                    key={op.ruta}
                    style={styles.boton}
                    onPress={() => router.push(op.ruta)}
                >
                    <Text style={styles.botonTexto}>{op.titulo}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#fff" },
    titulo: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 30 },
    boton: { backgroundColor: "#3b82f6", padding: 15, borderRadius: 10, marginBottom: 15 },
    botonTexto: { color: "#fff", textAlign: "center", fontSize: 16, fontWeight: "600" },
});
