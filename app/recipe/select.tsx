import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, Stack } from 'expo-router';
import { MOCK_RECIPES, assignRecipeToMenu, deleteRecipe } from '../mockData';
import { FontAwesome } from '@expo/vector-icons';
import Fuse from "fuse.js";

export default function SelectRecipeScreen() {
  const { day, meal } = useLocalSearchParams();

  // --- ESTADOS ---
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState(MOCK_RECIPES.filter(r => r !== null));

  useFocusEffect(
    useCallback(() => {
      // Recarga la lista al entrar y limpia posibles nulos
      setRecipes([...MOCK_RECIPES.filter(r => r !== null)]); 
    }, [])
  );

  // --- BUSCADOR FUSE.JS ---
  const fuse = new Fuse(recipes, {
    keys: ['name'], 
    threshold: 0.4, 
  });

  const filteredRecipes = searchQuery 
    ? fuse.search(searchQuery).map(result => result.item) 
    : recipes;

  // --- ACCIONES DE SELECCIÓN ---
  const handleSelectRecipe = (recipe) => {
    if (recipe === 'eat_out') {
      assignRecipeToMenu(day, meal, 'eat_out', 1);
      router.back();
    } else {
      assignRecipeToMenu(day, meal, recipe.id, 2);
      router.back();
    }
  };

  // --- ACCIONES DE GESTIÓN (EDITAR / BORRAR) ---
  const confirmDelete = (recipe) => {
    if (!recipe) return;
    Alert.alert(
      "¿Borrar receta?",
      `¿Estás seguro de que quieres eliminar "${recipe.name}" para siempre?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Borrar", 
          style: "destructive", 
          onPress: () => {
            deleteRecipe(recipe.id);
            setRecipes([...MOCK_RECIPES.filter(r => r !== null)]); 
          } 
        }
      ]
    );
  };

  const renderRecipeItem = ({ item }) => {
    if (!item) return null;
    return (
      <View style={styles.cardContainer}>
        {/* Zona clickeable para SELECCIONAR la receta */}
        <TouchableOpacity style={styles.cardInfo} onPress={() => handleSelectRecipe(item)}>
          <View style={styles.textContainer}>
            <Text style={styles.recipeTitle}>{item.name}</Text>
            <Text style={styles.recipeSubtitle}>👥 {item.baseDiners} pers. base</Text>
          </View>
          <Image source={{ uri: item.imageUrl }} style={styles.recipeImage} />
        </TouchableOpacity>

        {/* Botones de gestión integrados en la tarjeta */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            onPress={() => router.push({ pathname: './new_recipe', params: { editId: item.id } })}
            style={styles.iconBtn}
          >
            <FontAwesome name="pencil" size={18} color="#2f95dc" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => confirmDelete(item)}
            style={styles.iconBtn}
          >
            <FontAwesome name="trash" size={18} color="#ff5252" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Elegir para ${day}` }} />
      
      {/* --- BUSCADOR --- */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar receta..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* --- LISTA DE RECETAS --- */}
      <FlatList
        data={filteredRecipes}
        keyExtractor={(item) => item?.id?.toString() || Math.random().toString()}
        renderItem={renderRecipeItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View>
            <TouchableOpacity style={styles.eatOutCard} onPress={() => handleSelectRecipe('eat_out')}>
              <Text style={styles.eatOutText}>🍽️ Voy a comer fuera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.eatOutCard, { backgroundColor: '#e6f7ff', borderColor: '#2f95dc', marginBottom: 20 }]} 
              onPress={() => router.push('./new_recipe')}
            >
              <Text style={[styles.eatOutText, { color: '#2f95dc' }]}>➕ Crear o Importar Nueva Receta</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hemos encontrado "{searchQuery}"</Text>
            <TouchableOpacity 
              style={styles.createButton} 
              onPress={() => router.push('./new_recipe')}
            >
              <Text style={styles.createButtonText}>+ Añadir nueva receta</Text>
            </TouchableOpacity>
          </View>
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 80 },
  
  // Buscador
  searchBar: { backgroundColor: '#fff', margin: 16, padding: 12, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  searchInput: { fontSize: 16, height: 40 },
  
  // Tarjetas (Opciones especiales)
  eatOutCard: { backgroundColor: '#fff3e0', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ff9800', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  eatOutText: { fontSize: 16, fontWeight: 'bold', color: '#e65100' },
  
  // Tarjeta de Receta
  cardContainer: { backgroundColor: '#fff', flexDirection: 'column', marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#000' },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  textContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  recipeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  recipeSubtitle: { fontSize: 13, color: '#666', marginTop: 4 },
  recipeImage: { width: 100, height: 90, borderLeftWidth: 1, borderColor: '#000' },
  
  // Botones de acción integrados
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', padding: 8, backgroundColor: '#f9fafb', borderTopWidth: 1, borderColor: '#eee' },
  iconBtn: { paddingHorizontal: 15, paddingVertical: 5, marginLeft: 10 },
  
  // Estado Vacío
  emptyContainer: { alignItems: 'center', marginTop: 20 },
  emptyText: { textAlign: 'center', fontSize: 16, color: '#666', fontStyle: 'italic' },
  createButton: { backgroundColor: '#2f95dc', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 15 },
  createButtonText: { color: '#fff', fontWeight: 'bold' }
});