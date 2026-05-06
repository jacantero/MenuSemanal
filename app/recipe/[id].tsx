//Pantalla de detalle de la receta
import { Alert } from 'react-native';
import { deleteRecipe } from '../mockData';
import { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { MOCK_RECIPES } from '../mockData';
import { FontAwesome } from '@expo/vector-icons';

export default function RecipeDetailScreen() {
  // 1. Obtenemos el 'id' de la receta que hemos tocado
  const { id } = useLocalSearchParams();
  //console.log("ID recibido de la URL:", id, "| Tipo:", typeof id);
  
  // 2. Buscamos esa receta en nuestros datos falsos
  const recipe = MOCK_RECIPES.find((r) => {
    //console.log(`Comparando -> ID de receta (${r.name}):`, r.id, "| Tipo:", typeof r.id);
    
    // Comparamos forzando que ambos sean texto por si acaso
    return String(r.id) === String(id);
  });

  // 3. ESTADO (Memoria de React): Aquí guardamos el número de comensales elegidos.
  // Empieza con el número base que tenga la receta (ej. 2 para la carbonara).
  const [diners, setDiners] = useState(recipe?.baseDiners || 1);

  const handleDelete = () => {
    Alert.alert(
      "¿Borrar receta?",
      "Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta receta de tu libro personal?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Borrar", 
          style: "destructive", 
          onPress: () => {
            deleteRecipe(recipe.id);
            router.back();
          } 
        }
      ]
    );
  };

  // --- FUNCIÓN DE EDICIÓN ---
  const handleEdit = () => {
    // Navegamos a la pantalla de nueva receta pero pasando el ID para que sepa que es edición
    router.push({
      pathname: './new_recipe',
      params: { editId: recipe.id }
    });
  };

  // Si por algún error no encuentra la receta, mostramos esto
  if (!recipe) return <Text style={{ padding: 20 }}>Receta no encontrada</Text>;

  // 4. FUNCIÓN MATEMÁTICA: La regla de 3 para recalcular ingredientes
  const calculateAmount = (baseAmount) => {
    return ((baseAmount / recipe.baseDiners) * diners).toFixed(1).replace('.0', '');
  };

  return (
    // Usamos ScrollView en lugar de View para poder deslizar si la receta es muy larga
    <ScrollView style={styles.container}>
      {/* Botones de acción en la cabecera */}
      <Stack.Screen 
        options={{ 
          title: 'Detalle',
          headerRight: () => (
            <View style={{ flexDirection: 'row', marginRight: 10 }}>
              <TouchableOpacity onPress={handleEdit} style={{ marginRight: 20 }}>
                <FontAwesome name="pencil" size={22} color="#2f95dc" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <FontAwesome name="trash" size={22} color="#ff5252" />
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      
      {/* Esto cambia el título de la cabecera superior por el nombre de la receta */}
      <Stack.Screen options={{ title: recipe.name }} />

      <Image source={{ uri: recipe.imageUrl }} style={styles.image} />

      <View style={styles.content}>
        <Text style={styles.title}>{recipe.name}</Text>

        {/* --- CALCULADORA DE COMENSALES --- */}
        <View style={styles.calculatorContainer}>
          <Text style={styles.sectionTitle}>Comensales:</Text>
          <View style={styles.counter}>
            <TouchableOpacity 
              style={styles.button} 
              // Math.max evita que bajes de 1 comensal (no puedes cocinar para 0 personas)
              onPress={() => setDiners(Math.max(1, diners - 1))}
            >
              <Text style={styles.buttonText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.dinersNumber}>{diners}</Text>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => setDiners(diners + 1)}
            >
              <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- LISTA DE INGREDIENTES --- */}
        <Text style={styles.sectionTitle}>Ingredientes:</Text>
        <View style={styles.ingredientsBox}>
          {recipe.ingredients.map((ing, index) => (
            <View key={index} style={styles.ingredientRow}>
              <Text style={styles.ingredientName}>• {ing.name}</Text>
              {/* Aquí usamos la función matemática que creamos arriba */}
              <Text style={styles.ingredientAmount}>
                {calculateAmount(ing.amount)} {ing.unit}
              </Text>
            </View>
          ))}
        </View>

        {/* --- INSTRUCCIONES --- */}
        <Text style={styles.sectionTitle}>Preparación:</Text>
        {recipe.instructions.map((step, index) => (
          <Text key={index} style={styles.stepText}>
            {index + 1}. {step}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  image: { width: '100%', height: 250 },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  
  // Estilos de la Calculadora
  calculatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#000', marginBottom: 15 },
  counter: { flexDirection: 'row', alignItems: 'center' },
  button: { backgroundColor: '#2f95dc', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 28 },
  dinersNumber: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 20 },
  
  // Estilos de Ingredientes y Pasos
  ingredientsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#000' },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ingredientName: { fontSize: 16 },
  ingredientAmount: { fontSize: 16, fontWeight: 'bold', color: '#2f95dc' },
  stepText: { fontSize: 16, marginBottom: 12, lineHeight: 24, backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' }
});