import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Alert, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, Stack } from 'expo-router';

import { MOCK_RECIPES, deleteRecipe } from '../tempData';
import { useHousehold } from '../HouseholdContext';

import { FontAwesome } from '@expo/vector-icons';
import Fuse from "fuse.js";


export default function SelectRecipeScreen() {

  const { weeklyMenu, updateMenu } = useHousehold(); // <--- Aquí tienes las herramientas
  // 1. Añadimos bulkMeals a los parámetros que recibimos
  const { day, meal, bulkMeals } = useLocalSearchParams();

  // --- ESTADOS ---
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState(MOCK_RECIPES.filter(r => r !== null));

  // NUEVO: ESTADOS PARA FILTROS
  const [showFilters, setShowFilters] = useState(false);
  const [includeIngredients, setIncludeIngredients] = useState('');
  const [excludeIngredients, setExcludeIngredients] = useState('');

  // 🆕 ESTADOS PARA SELECCIÓN DE COMENSALES
  const [isDinersModalVisible, setIsDinersModalVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [dinersCount, setDinersCount] = useState('2'); // Sugiriendo 2 por defecto

  const assignToTargets = async (recipeId, dinersAmount) => {
    // 1. Clonamos el menú actual para no mutar el estado directamente
    const newMenu = JSON.parse(JSON.stringify(weeklyMenu));

    // 2. Aplicamos los cambios
    if (bulkMeals) {
      const targets = bulkMeals.split(',');
      targets.forEach(target => {
        const [tDay, tMeal] = target.split('|');
        const targetMeal = newMenu[tDay]?.find(m => m.id === tMeal);
        if (targetMeal) {
          targetMeal.recipeId = recipeId;
          targetMeal.diners = dinersAmount;
        }
      });
    } else if (day && meal) {
      const targetMeal = newMenu[day]?.find(m => m.id === meal);
      if (targetMeal) {
        targetMeal.recipeId = recipeId;
        targetMeal.diners = dinersAmount;
      }
    }

    // 3. ¡EL PASO CRÍTICO!: Actualizamos el Contexto
    await updateMenu(newMenu);
  };

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

// 1. Búsqueda por nombre (Fuse)
  const fuseResults = searchQuery 
    ? fuse.search(searchQuery).map(result => result.item) 
    : recipes;

  // 2. Filtro avanzado por ingredientes
  const filteredRecipes = fuseResults.filter(recipe => {
    if (!recipe) return false;

    // Filtro de INCLUSIÓN (Debe tener TODOS los separados por coma)
    const includesList = includeIngredients.split(',').map(i => i.trim().toLowerCase()).filter(i => i);
    const matchesIncludes = includesList.length === 0 || includesList.every(reqIngredient => 
      recipe.ingredients?.some(recipeIng => recipeIng.name.toLowerCase().includes(reqIngredient))
    );

    // Filtro de EXCLUSIÓN (No debe tener NINGUNO de los separados por coma)
    const excludesList = excludeIngredients.split(',').map(i => i.trim().toLowerCase()).filter(i => i);
    const matchesExcludes = excludesList.length === 0 || excludesList.every(excIngredient => 
      !recipe.ingredients?.some(recipeIng => recipeIng.name.toLowerCase().includes(excIngredient))
    );

    return matchesIncludes && matchesExcludes;
  });

  // En handleConfirmDiners:
  const handleConfirmDiners = async () => {
    const finalDiners = parseInt(dinersCount, 10) || 2;
    if (selectedRecipe) {
      await assignToTargets(selectedRecipe.id, finalDiners); // <--- await
      setIsDinersModalVisible(false);
      router.back();
    }
  };

  // En handleSelectRecipe (para el caso 'eat_out'):
  const handleSelectRecipe = async (recipe) => {
    if (recipe === 'eat_out') {
      await assignToTargets('eat_out', 1); // <--- await
      router.back();
    } else {
      setSelectedRecipe(recipe);
      setDinersCount('2');
      setIsDinersModalVisible(true);
    }
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
      
      {/* --- BUSCADOR Y FILTROS --- */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Buscar receta..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          <TouchableOpacity 
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]} 
            onPress={() => setShowFilters(!showFilters)}
          >
            <FontAwesome name="sliders" size={20} color={showFilters ? '#fff' : '#2f95dc'} />
          </TouchableOpacity>
        </View>

        {/* PANEL DE FILTROS DESPLEGABLE */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterLabel}>✅ Debe contener (separar con comas):</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="Ej: pollo, arroz, tomate"
              value={includeIngredients}
              onChangeText={setIncludeIngredients}
            />
            
            <Text style={styles.filterLabel}>❌ NO debe contener (alergias/gustos):</Text>
            <TextInput
              style={[styles.filterInput, { borderColor: '#ffcdd2' }]}
              placeholder="Ej: queso, gluten, nueces"
              value={excludeIngredients}
              onChangeText={setExcludeIngredients}
            />
            
            {(includeIngredients !== '' || excludeIngredients !== '') && (
              <TouchableOpacity 
                style={styles.clearFiltersBtn} 
                onPress={() => { setIncludeIngredients(''); setExcludeIngredients(''); }}
              >
                <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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

      {/* 🆕 MODAL DE CONFIRMACIÓN DE COMENSALES */}
      <Modal visible={isDinersModalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>👥 ¿Cuántos comensales?</Text>
            <Text style={styles.modalSubtitle}>Ajustaremos los ingredientes de "{selectedRecipe?.name}" automáticamente.</Text>
            
            {/* Control numérico con botones rápidos +/- */}
            <View style={styles.counterRow}>
              <TouchableOpacity 
                style={styles.counterBtn} 
                onPress={() => setDinersCount(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))}
              >
                <FontAwesome name="minus" size={16} color="#2f95dc" />
              </TouchableOpacity>
              
              <TextInput 
                style={styles.modalInput} 
                keyboardType="numeric" 
                value={dinersCount} 
                onChangeText={setDinersCount}
                maxLength={2}
              />

              <TouchableOpacity 
                style={styles.counterBtn} 
                onPress={() => setDinersCount(prev => String((parseInt(prev, 10) || 0) + 1))}
              >
                <FontAwesome name="plus" size={16} color="#2f95dc" />
              </TouchableOpacity>
            </View>

            {/* Acciones del Modal */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsDinersModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmDiners}>
                <Text style={styles.confirmBtnText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 80 },
  
// Buscador y Filtros
  searchContainer: { margin: 16, marginBottom: 4 }, // Agrupa la barra y el panel
  searchRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2, padding: 4 },
  searchInput: { flex: 1, fontSize: 16, height: 40, paddingHorizontal: 12 },
  
  filterBtn: { padding: 10, borderRadius: 16, backgroundColor: '#f0f8ff', justifyContent: 'center', alignItems: 'center', width: 44, height: 44 },
  filterBtnActive: { backgroundColor: '#2f95dc' },
  
  filtersPanel: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  filterLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5 },
  filterInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginBottom: 15, fontSize: 14 },
  
  clearFiltersBtn: { alignSelf: 'flex-end', paddingVertical: 5 },
  clearFiltersText: { color: '#ef4444', fontWeight: 'bold', fontSize: 13 },
  
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
  createButtonText: { color: '#fff', fontWeight: 'bold' },

  // --- NUEVOS ESTILOS PARA EL MODAL ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 24, borderRadius: 20, width: '85%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  counterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f8ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#bcdffc' },
  modalInput: { width: 60, height: 44, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#333', borderBottomWidth: 2, borderColor: '#2f95dc', marginHorizontal: 20 },
  modalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 15 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2f95dc', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});