import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { addRecipe } from '../mockData';

export default function NewRecipeScreen() {
  const [name, setName] = useState('');

  const handleSave = () => {
    // Si el nombre está vacío, no hacemos nada
    if (name.trim() === '') return;
    
    // Creamos un objeto de receta falso con datos por defecto
    const newRecipe = {
      id: Date.now().toString(), // Genera un ID único usando la fecha y hora exacta
      name: name,
      imageUrl: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=400&q=80', // Una foto de comida genérica
      baseDiners: 2,
      ingredients: [], // Dejamos los ingredientes vacíos por ahora
      instructions: ['Instrucciones pendientes de añadir...']
    };

    addRecipe(newRecipe); // La guardamos en nuestra "memoria"
    router.back(); // Volvemos a la pantalla anterior
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Nueva Receta' }} />
      
      <Text style={styles.label}>Nombre de la receta:</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Tortilla de patatas..."
        value={name}
        onChangeText={setName}
        autoFocus // Abre el teclado automáticamente
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Guardar Receta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#e6f7ff' },
  label: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 10, padding: 15, fontSize: 16, marginBottom: 20 },
  saveButton: { backgroundColor: '#2f95dc', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});