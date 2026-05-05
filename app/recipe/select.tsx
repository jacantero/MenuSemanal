import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { MOCK_RECIPES, assignRecipeToMenu } from '../mockData';

export default function SelectRecipeScreen() {
  // Recibimos qué día y qué comida estamos configurando
  const { day, meal } = useLocalSearchParams();

  const handleSelectRecipe = (recipeId) => {
    // 1. Guardamos la receta en la memoria
    assignRecipeToMenu(day, meal, recipeId);
    // 2. Volvemos atrás
    router.back();
  };

  const renderRecipeItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelectRecipe(item.id)}>
      <Image source={{ uri: item.imageUrl }} style={styles.image} />
      <Text style={styles.title}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Elegir para ${day}` }} />
      <FlatList
        data={MOCK_RECIPES}
        keyExtractor={(item) => item.id}
        renderItem={renderRecipeItem}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <TouchableOpacity 
            style={styles.eatOutCard} 
            onPress={() => handleSelectRecipe('eat_out')} // Le pasamos un ID especial
          >
            <Text style={styles.eatOutText}>🍽️ Voy a comer fuera</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  card: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  image: { width: 80, height: 80 },
  title: { flex: 1, fontSize: 16, fontWeight: 'bold', paddingHorizontal: 16 },
  // Añade estos estilos debajo de los que ya tienes en select.tsx
  eatOutCard: {
    backgroundColor: '#fff3e0', // Un tono naranja suave para diferenciarlo
    padding: 16,
    borderRadius: 8,
    marginBottom: 20, // Más margen para separarlo de las recetas normales
    borderWidth: 1,
    borderColor: '#ff9800',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  eatOutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
  }
});