import { Stack } from "expo-router";

export default function RootLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: "Inicio" }} />
            <Stack.Screen name="home/index" options={{ title: "Fibonacci" }} />
            <Stack.Screen name="factorial/index" options={{ title: "Factorial" }} />
            <Stack.Screen name="tablas/index" options={{ title: "Tablas de Multiplicar" }} />
            <Stack.Screen name="notas/digite/index" options={{ title: "Digitar Notas" }} />
            <Stack.Screen name="notas/mostrar/index" options={{ title: "Resultado" }} />
            <Stack.Screen name="reto/index" options={{ title: "Reto" }} />
        </Stack>
    );
}
