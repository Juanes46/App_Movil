import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import MenuNavegacion from "../../components/menu-navegacion";

const Punto_1 = () => {
    const [numero, setNumero] = useState("");
    const [serie, setSerie] = useState([]);

    const generarFibonacci = () => {
        const n = parseInt(numero);
        if (isNaN(n) || n < 0) {
            setSerie(["Ingresa un numero valido"]);
            return;
        }

        
        let resultado = [];
        let a = 0, b = 1;
        while (a <= n) {
            resultado.push(a);
            [a, b] = [b, a + b];
        }
        setSerie(resultado);
    };

    return (
        <View style={styles.container}>
            <MenuNavegacion />
            <Text style={styles.titulo}>Serie de Fibonacci</Text>
            <Text style={styles.label}>Digita un numero y se mostrara la serie hasta ese valor</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={numero}
                onChangeText={setNumero}
                placeholder="Ej: 50"
            />
            <TouchableOpacity style={styles.boton} onPress={generarFibonacci}>
                <Text style={styles.botonTexto}>Generar</Text>
            </TouchableOpacity>

            <ScrollView style={{ marginTop: 20 }}>
                <Text style={styles.resultado}>{serie.join(", ")}</Text>
            </ScrollView>
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
    resultado: { fontSize: 18, lineHeight: 26 },
});

export default Punto_1;
