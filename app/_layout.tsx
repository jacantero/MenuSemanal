import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// 1. IMPORTAMOS NUESTRO CONTEXTO
// ⚠️ Ajusta esta ruta dependiendo de dónde hayas guardado HouseholdContext.js
// Si creaste una carpeta "contexts" en la raíz, suele ser '@/contexts/HouseholdContext' o '../contexts/HouseholdContext'
import { HouseholdProvider, HouseholdContext } from './HouseholdContext'; 

// Dentro de tu componente:
//console.log("ID del objeto Contexto:", HouseholdContext);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // 2. ENVOLVEMOS TODA LA APP CON EL PROVEEDOR
    <HouseholdProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </HouseholdProvider>
  );
}
