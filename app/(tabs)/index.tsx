import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { weeklyMenu, MOCK_RECIPES } from '../mockData';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function MenuScreen() {
  const [menuData, setMenuData] = useState(weeklyMenu);

  useFocusEffect(
    useCallback(() => {
      setMenuData({ ...weeklyMenu }); 
    }, [])
  );

  const getRecipeName = (recipeId) => {
    if (!recipeId) return null;
    if (recipeId === 'eat_out') return 'Comer fuera'; 
    const recipe = MOCK_RECIPES.find(r => String(r.id) === String(recipeId));
    return recipe ? recipe.name : 'Receta borrada';
  };

  const renderMealSlot = (day, mealType, title, isLast) => {
    // Leemos el nuevo formato de objeto { recipeId, diners } o el string antiguo
    const assignment = menuData[day][mealType];
    const assignedRecipeId = assignment?.recipeId || (typeof assignment === 'string' ? assignment : null);
    const plannedDiners = assignment?.diners || null;
    
    const recipeName = getRecipeName(assignedRecipeId);

    return (
      <View style={[styles.mealSection, isLast && { marginBottom: 0 }]}>
        <Text style={styles.mealTitle}>{title}</Text>
        
        {recipeName ? (
          <TouchableOpacity 
            style={styles.filledSlot} 
            onPress={() => {
              if (assignedRecipeId === 'eat_out') {
                // Si es comer fuera, permitimos reasignar directamente
                router.push({ pathname: '/recipe/select', params: { day, meal: mealType } });
              } else {
                // Si es una receta normal, vamos a SU PANTALLA DE DETALLE, pasándole el día y los comensales
                router.push({ 
                  pathname: `/recipe/${assignedRecipeId}`, 
                  params: { day, meal: mealType, plannedDiners: plannedDiners } 
                });
              }
            }}
          >
            <Text style={styles.filledSlotText}>
              {assignedRecipeId === 'eat_out' ? '🍽️' : '🍲'} {recipeName}
              {/* Añadimos el chivato visual de los comensales si es una receta */}
              {assignedRecipeId !== 'eat_out' && plannedDiners && ` (👥 ${plannedDiners})`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.emptySlot} 
            onPress={() => router.push({ pathname: '/recipe/select', params: { day, meal: mealType } })}
          >
            <Text style={styles.emptySlotText}>+ Asignar receta</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDayCard = (day) => (
    <View key={day} style={styles.dayCard}>
      <Text style={styles.dayTitle}>{day}</Text>
      {renderMealSlot(day, 'lunch', '☀️ Comida', false)}
      {renderMealSlot(day, 'dinner', '🌙 Cena', true)}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerTitle}>Mi Menú Semanal</Text>
      {DAYS_OF_WEEK.map(renderDayCard)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#000' },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#000', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  dayTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  mealSection: { marginBottom: 16 },
  mealTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#555' },
  emptySlot: { backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#2f95dc', borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  emptySlotText: { color: '#2f95dc', fontWeight: 'bold' },
  filledSlot: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4caf50', borderRadius: 8, padding: 12 },
  filledSlotText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 16 }
});