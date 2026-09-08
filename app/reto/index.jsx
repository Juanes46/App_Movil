import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import MenuNavegacion from "../../components/menu-navegacion";

const Punto_5 = () => {
    const [datos, setDatos] = useState({
        nombre: "",
        edad: "",
        email: "",
        telefono: "",
        ocupacion: "",
        direccion: "",
    });
    const [modoLectura, setModoLectura] = useState(false);

    const actualizarCampo = (campo, valor) => {
        setDatos({ ...datos, [campo]: valor });
    };

    const guardar = () => {
        setModoLectura(true);
    };

    const editar = () => {
        setModoLectura(false);
    };

    const edadNum = parseInt(datos.edad);
    const esMayor = !isNaN(edadNum) && edadNum >= 18;

    return (
        <ScrollView style={styles.container}>
            <MenuNavegacion />
            <Text style={styles.titulo}>Datos Personales</Text>

            {!modoLectura ? (
                <>
                    <Text style={styles.label}>Nombre</Text>
                    <TextInput
                        style={styles.input}
                        value={datos.nombre}
                        onChangeText={(v) => actualizarCampo("nombre", v)}
                        placeholder="Ej: Juan Perez"
                    />

                    <Text style={styles.label}>Edad</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={datos.edad}
                        onChangeText={(v) => actualizarCampo("edad", v)}
                        placeholder="Ej: 20"
                    />

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="email-address"
                        value={datos.email}
                        onChangeText={(v) => actualizarCampo("email", v)}
                        placeholder="Ej: correo@ejemplo.com"
                    />

                    <Text style={styles.label}>Telefono</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="phone-pad"
                        value={datos.telefono}
                        onChangeText={(v) => actualizarCampo("telefono", v)}
                        placeholder="Ej: 3001234567"
                    />

                    <Text style={styles.label}>Ocupacion</Text>
                    <TextInput
                        style={styles.input}
                        value={datos.ocupacion}
                        onChangeText={(v) => actualizarCampo("ocupacion", v)}
                        placeholder="Ej: Estudiante"
                    />

                    <Text style={styles.label}>Direccion</Text>
                    <TextInput
                        style={styles.input}
                        value={datos.direccion}
                        onChangeText={(v) => actualizarCampo("direccion", v)}
                        placeholder="Ej: Calle 10 #5-20"
                    />

                    <TouchableOpacity style={styles.boton} onPress={guardar}>
                        <Text style={styles.botonTexto}>Guardar</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <View style={styles.filaDato}>
                        <Text style={styles.etiqueta}>Nombre:</Text>
                        <Text style={styles.valor}>{datos.nombre}</Text>
                    </View>

                    <View style={styles.filaDato}>
                        <Text style={styles.etiqueta}>Edad:</Text>
                        <Text style={styles.valor}>
                            {datos.edad} ({esMayor ? "Mayor de edad" : "Menor de edad"})
                        </Text>
                    </View>

                    <View style={styles.filaDato}>
                        <Text style={styles.etiqueta}>Email:</Text>
                        <Text style={styles.valor}>{datos.email}</Text>
                    </View>

                    <View style={styles.filaDato}>
                        <Text style={styles.etiqueta}>Telefono:</Text>
                        <Text style={styles.valor}>{datos.telefono}</Text>
                    </View>

                    <TouchableOpacity style={styles.boton} onPress={editar}>
                        <Text style={styles.botonTexto}>Editar Datos</Text>
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "#fff" },
    titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },
    label: { fontSize: 16, marginBottom: 5 },
    input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 15 },
    boton: { backgroundColor: "#3b82f6", padding: 15, borderRadius: 10, marginTop: 10, marginBottom: 30 },
    botonTexto: { color: "#fff", textAlign: "center", fontSize: 16, fontWeight: "600" },
    filaDato: {
        flexDirection: "row",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    etiqueta: { fontSize: 16, fontWeight: "bold", width: 100 },
    valor: { fontSize: 16, flex: 1 },
});

export default Punto_5;
