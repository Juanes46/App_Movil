import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import MenuNavegacion from "../../components/menu-navegacion";

const Punto_3 = () => {
    const [numero, setNumero] = useState("");
    const [tabla, setTabla] = useState([]);

    const generarTabla = () => {
        const n = parseInt(numero);
        if (isNaN(n)) {
            setTabla(["Ingresa un numero valido"]);
            return;
        }

        let resultado = [];
        for (let i = 1; i <= 10; i++) { 
            resultado.push(`${n} x ${i} = ${n * i}`);
        }
        setTabla(resultado);
    };

    return (
        <View style={styles.container}>
            <MenuNavegacion />
            <Text style={styles.titulo}>Tablas de Multiplicar</Text>
            <Text style={styles.label}>¿De que numero quieres la tabla?</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={numero}
                onChangeText={setNumero}
                placeholder="Ej: 7"
            />
            <TouchableOpacity style={styles.boton} onPress={generarTabla}>
                <Text style={styles.botonTexto}>Generar Tabla</Text>
            </TouchableOpacity>

            <ScrollView style={{ marginTop: 20 }}>
                {tabla.map((linea, index) => (
                    <Text key={index} style={styles.resultado}>{linea}</Text>
                ))}
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
    resultado: { fontSize: 18, paddingVertical: 3 },
});

export default Punto_3;
