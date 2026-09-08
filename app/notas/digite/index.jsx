import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import MenuNavegacion from "../../../components/menu-navegacion";

const Punto_4 = () => {
    const [nota, setNota] = useState("");
    const [notas, setNotas] = useState([]);
    const router = useRouter();

    const agregarNota = () => {
        
        if (nota.trim() === "" || !/^\d+$/.test(nota.trim())) {
            return;
        }
        const valor = parseInt(nota);
        setNotas([...notas, valor]);
        setNota("");
    };

    const eliminarNota = (index) => {
        setNotas(notas.filter((_, i) => i !== index));
    };

    const irAResultado = () => {
        if (notas.length === 0) return;
        router.push({
            pathname: "/notas/mostrar",
            params: { notas: JSON.stringify(notas) },
        });
    };

    return (
        <View style={styles.container}>
            <MenuNavegacion />
            <Text style={styles.titulo}>Digite sus Notas</Text>
            <Text style={styles.label}>Ingresa un numero entero (se permite el 0)</Text>

            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={nota}
                onChangeText={setNota}
                placeholder="Ej: 4"
            />
            <TouchableOpacity style={styles.boton} onPress={agregarNota}>
                <Text style={styles.botonTexto}>Agregar Nota</Text>
            </TouchableOpacity>

            <ScrollView style={{ marginTop: 20 }}>
                {notas.map((n, index) => (
                    <View key={index} style={styles.filaNota}>
                        <Text style={styles.notaTexto}>Nota {index + 1}: {n}</Text>
                        <TouchableOpacity onPress={() => eliminarNota(index)}>
                            <Text style={styles.eliminar}>Eliminar</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            <TouchableOpacity
                style={[styles.boton, styles.botonResultado]}
                onPress={irAResultado}
            >
                <Text style={styles.botonTexto}>Ver Promedio</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "#fff" },
    titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
    label: { fontSize: 16, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 15 },
    boton: { backgroundColor: "#3b82f6", padding: 15, borderRadius: 10 },
    botonTexto: { color: "#fff", textAlign: "center", fontSize: 16, fontWeight: "600" },
    botonResultado: { marginTop: 20, backgroundColor: "#10b981" },
    filaNota: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    notaTexto: { fontSize: 16 },
    eliminar: { color: "#ef4444", fontWeight: "600" },
});

export default Punto_4;
