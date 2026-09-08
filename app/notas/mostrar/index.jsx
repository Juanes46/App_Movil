import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MenuNavegacion from "../../../components/menu-navegacion";

const Punto_4_mostrar = () => {
    const { notas } = useLocalSearchParams();
    const router = useRouter();

    const listaNotas = notas ? JSON.parse(notas) : [];

    const suma = listaNotas.reduce((acc, n) => acc + n, 0);
    const promedio = listaNotas.length > 0
        ? Math.round((suma / listaNotas.length) * 100) / 100  // hasta 2 decimales
        : 0;

    const aprobo = promedio >= 3.0;

    return (
        <View style={styles.container}>
            <MenuNavegacion />
            <Text style={styles.titulo}>Resultado</Text>

            <ScrollView style={styles.listaNotas}>
                {listaNotas.map((n, index) => (
                    <Text key={index} style={styles.notaTexto}>Nota {index + 1}: {n}</Text>
                ))}
            </ScrollView>

            <Text style={styles.promedio}>Promedio: {promedio.toFixed(2)}</Text>

            <Text style={[styles.estado, aprobo ? styles.aprobado : styles.reprobado]}>
                {aprobo ? "Usted ha aprobado " : "No aprobaste estudia mas "}
            </Text>

            <TouchableOpacity
                style={styles.boton}
                onPress={() => router.push("/notas/digite")}
            >
                <Text style={styles.botonTexto}>Digitar otras notas</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "#fff" },
    titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },
    listaNotas: { maxHeight: 200, marginBottom: 15 },
    notaTexto: { fontSize: 16, paddingVertical: 3 },
    promedio: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 10 },
    estado: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginVertical: 15 },
    aprobado: { color: "#10b981" },
    reprobado: { color: "#ef4444" },
    boton: { backgroundColor: "#3b82f6", padding: 15, borderRadius: 10, marginTop: 10 },
    botonTexto: { color: "#fff", textAlign: "center", fontSize: 16, fontWeight: "600" },
});

export default Punto_4_mostrar;
