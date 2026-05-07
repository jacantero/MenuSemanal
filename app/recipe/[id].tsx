import { Alert } from 'react-native';
import { deleteRecipe, assignRecipeToMenu } from '../mockData';
import { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { MOCK_RECIPES } from '../mockData';
import { FontAwesome } from '@expo/vector-icons';

export default function RecipeDetailScreen() {
  const { id, day, meal, plannedDiners } = useLocalSearchParams();
  
  const recipe = MOCK_RECIPES.find((r) => String(r.id) === String(id));

  const [diners, setDiners] = useState(plannedDiners ? parseInt(plannedDiners, 10) : (recipe?.baseDiners || 1));

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
            router.replace('/'); 
          } 
        }
      ]
    );
  };

  const handleEdit = () => {
    router.push({
      pathname: '/newRecipe', 
      params: { editId: recipe.id }
    });
  };

  const handleDinersChange = (newAmount) => {
    const validAmount = Math.max(1, newAmount);
    setDiners(validAmount);
    
    if (day && meal && recipe) {
      assignRecipeToMenu(day, meal, recipe.id, validAmount);
    }
  };

  // --- NUEVA FUNCIÓN PARA DESASIGNAR DEL MENÚ ---
  const handleUnassign = () => {
    if (day && meal) {
      assignRecipeToMenu(day, meal, null);
      router.back();
    }
  };

  if (!recipe) return <Text style={{ padding: 20 }}>Receta no encontrada</Text>;

  const calculateAmount = (baseAmount) => {
    return ((baseAmount / recipe.baseDiners) * diners).toFixed(1).replace('.0', '');
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Detalle',
          headerRight: undefined
        }} 
      />
      
      <Stack.Screen options={{ title: recipe.name }} />

      <Image source={{ uri: recipe.imageUrl }} style={styles.image} />

      <View style={styles.content}>
        <Text style={styles.title}>{recipe.name}</Text>

        {/* Zona del chivato visual y el botón de desasignar */}
        {day && meal && (
          <View style={styles.contextContainer}>
            <Text style={styles.contextText}>
              📅 Planificado para el {day}
            </Text>
            <TouchableOpacity style={styles.unassignButton} onPress={handleUnassign}>
              <FontAwesome name="calendar-times-o" size={16} color="#ff5252" style={{ marginRight: 6 }} />
              <Text style={styles.unassignButtonText}>Quitar del menú</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.calculatorContainer}>
          <Text style={styles.sectionTitle}>Comensales:</Text>
          <View style={styles.counter}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => handleDinersChange(diners - 1)}
            >
              <Text style={styles.buttonText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.dinersNumber}>{diners}</Text>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => handleDinersChange(diners + 1)}
            >
              <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ingredientes:</Text>
        <View style={styles.ingredientsBox}>
          {recipe.ingredients.map((ing, index) => (
            <View key={index} style={styles.ingredientRow}>
              <Text style={styles.ingredientName}>• {ing.name}</Text>
              <Text style={styles.ingredientAmount}>
                {calculateAmount(ing.amount)} {ing.unit}
              </Text>
            </View>
          ))}
        </View>

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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 }, 
  
  // Estilos nuevos para el contenedor y botón de desasignar
  contextContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  contextText: { fontSize: 16, color: '#2f95dc', fontWeight: 'bold' },
  unassignButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', paddingHorizontal: 4, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ffcdd2' },
  unassignButtonText: { color: '#ff5252', fontWeight: 'bold', fontSize: 14 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  calculatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#000', marginBottom: 15 },
  counter: { flexDirection: 'row', alignItems: 'center' },
  button: { backgroundColor: '#2f95dc', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 28 },
  dinersNumber: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 20 },
  ingredientsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#000' },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ingredientName: { fontSize: 16 },
  ingredientAmount: { fontSize: 16, fontWeight: 'bold', color: '#2f95dc' },
  stepText: { fontSize: 16, marginBottom: 12, lineHeight: 24, backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' }
});