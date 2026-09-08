import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import { useRouter } from "expo-router";

// Menú de navegación tipo hamburguesa.
// Solo incluye los puntos ya desarrollados (Inicio, Fibonacci, Factorial, Tablas).
const opciones = [
    { titulo: "Inicio", ruta: "/" },
    { titulo: "Fibonacci", ruta: "/home" },
    { titulo: "Factorial", ruta: "/factorial" },
    { titulo: "Tablas", ruta: "/tablas" },
    { titulo: "Notas", ruta: "/notas/digite" },
    { titulo: "Reto", ruta: "/reto" },
];

const MenuNavegacion = () => {
    const [visible, setVisible] = useState(false);
    const router = useRouter();

    const irA = (ruta) => {
        setVisible(false);
        router.push(ruta);
    };

    return (
        <>
            <TouchableOpacity style={styles.hamburguesa} onPress={() => setVisible(true)}>
                <View style={styles.linea} />
                <View style={styles.linea} />
                <View style={styles.linea} />
            </TouchableOpacity>

            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                {/* Fondo oscuro: tocar afuera cierra el menú */}
                <Pressable style={styles.fondo} onPress={() => setVisible(false)}>
                    <Pressable style={styles.panel} onPress={() => {}}>
                        <Text style={styles.tituloPanel}>Navegación</Text>
                        {opciones.map((op) => (
                            <TouchableOpacity
                                key={op.ruta}
                                style={styles.opcion}
                                onPress={() => irA(op.ruta)}
                            >
                                <Text style={styles.opcionTexto}>{op.titulo}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.cerrar} onPress={() => setVisible(false)}>
                            <Text style={styles.cerrarTexto}>Cerrar</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    hamburguesa: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 5,
        marginBottom: 15,
    },
    linea: {
        width: 28,
        height: 3,
        borderRadius: 2,
        backgroundColor: "#3b82f6",
    },
    fondo: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    panel: {
        width: "70%",
        height: "100%",
        backgroundColor: "#fff",
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    tituloPanel: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 20,
        color: "#333",
    },
    opcion: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    opcionTexto: {
        fontSize: 16,
        color: "#3b82f6",
        fontWeight: "600",
    },
    cerrar: {
        marginTop: 30,
        backgroundColor: "#f1f1f1",
        padding: 12,
        borderRadius: 8,
    },
    cerrarTexto: {
        textAlign: "center",
        color: "#333",
        fontWeight: "600",
    },
});

export default MenuNavegacion;
