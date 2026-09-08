import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import MenuNavegacion from "../../components/menu-navegacion";

const Punto_2 = () => {
    const [numero, setNumero] = useState("");
    const [sucesion, setSucesion] = useState("");
    const [resultado, setResultado] = useState(null);

    const calcularFactorial = () => {
        const n = parseInt(numero);
        if (isNaN(n) || n < 0) {
            setSucesion("Ingresa un numero entero positivo");
            setResultado(null);
            return;
        }

        if (n === 0) {
            setSucesion("0! = 1");
            setResultado(1);
            return;
        }

        let fact = 1;
        let partes = [];
        for (let i = n; i >= 1; i--) {
            fact *= i;
            partes.push(i);
        }
        setSucesion(`${n}! = ${partes.join(" x ")} = ${fact}`);
        setResultado(fact);
    };

    return (
        <View style={styles.container}>
            <MenuNavegacion />
            <Text style={styles.titulo}>Factorial de un número</Text>
            <Text style={styles.label}>Ingresa un número</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={numero}
                onChangeText={setNumero}
                placeholder="Ej: 5"
            />
            <TouchableOpacity style={styles.boton} onPress={calcularFactorial}>
                <Text style={styles.botonTexto}>Calcular Factorial</Text>
            </TouchableOpacity>

            {resultado !== null && (
                <Text style={styles.resultado}>{sucesion}</Text>
            )}
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
    resultado: { fontSize: 18, marginTop: 20, fontWeight: "bold", textAlign: "center" },
});

export default Punto_2;
