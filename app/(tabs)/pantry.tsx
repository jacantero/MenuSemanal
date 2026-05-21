import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weeklyMenu, MOCK_RECIPES, INGREDIENTS_DB, getCanonicalName, normalizeToBase, getPackageSize, calculatePurchaseLots } from '../tempData';

// --- DICCIONARIO DE EMOJIS SEGURO ---
export const getEmojiForIngredient = (rawName) => {
  const canonical = getCanonicalName(rawName);
  const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
  if (dbKey) return INGREDIENTS_DB[dbKey].emoji;
  return '🛒';
};

// --- FORMATEADOR VISUAL DE CANTIDADES ---
const formatAmount = (amount, unit) => {
  if (!amount) return `0 ${unit}`;
  // Si pasa de 1000g o 1000ml, lo mostramos como Kg o L para que sea más legible
  if (unit === 'g' && amount >= 1000) return `${Math.round(amount / 100) / 10} kg`;
  if (unit === 'ml' && amount >= 1000) return `${Math.round(amount / 100) / 10} L`;
  return `${Math.round(amount * 10) / 10} ${unit}`;
};

export default function PantryScreen() {
  const [isReady, setIsReady] = useState(false);
  const [pantryItems, setPantryItems] = useState([]);

  // --- 1. CARGAR LA DESPENSA AL ENTRAR ---
  const loadPantry = async () => {
    try {
      const savedPantry = await AsyncStorage.getItem('@pantry_items');
      if (savedPantry) setPantryItems(JSON.parse(savedPantry));
    } catch (e) {
      console.error("Error cargando la despensa", e);
    } finally {
      setIsReady(true);
    }
  };

  // --- 2. DETECTAR SI HAY COMPRA PENDIENTE ---
  const checkForFinishedShopping = async () => {
    try {
      const savedChecked = await AsyncStorage.getItem('@shopping_checked');
      const checkedSet = savedChecked ? new Set(JSON.parse(savedChecked)) : new Set();
      
      if (checkedSet.size > 0) {
        Alert.alert(
          "🛒 ¡Compra detectada!",
          "Tienes ingredientes tachados en tu lista de la compra. ¿Quieres guardarlos en tu despensa?",
          [
            { text: "No por ahora", style: "cancel" },
            { text: "Sí, guardar", onPress: () => processTransfer(checkedSet) }
          ]
        );
      }
    } catch (e) {
      console.error("Error leyendo compras", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPantry().then(checkForFinishedShopping);
    }, [])
  );

  // --- 3. LÓGICA DE TRANSFERENCIA Y LOTES DE COMPRA ---
  const processTransfer = async (checkedSet) => {
    const savedExtras = await AsyncStorage.getItem('@shopping_extras');
    const extraItems = savedExtras ? JSON.parse(savedExtras) : [];
    const savedDeleted = await AsyncStorage.getItem('@shopping_deleted');
    const deletedSet = savedDeleted ? new Set(JSON.parse(savedDeleted)) : new Set();

    const ingredientMap = {};

    // 3.1. Reconstruimos los datos (IDENTICO A buy_list.tsx para que los IDs encajen)
    Object.keys(weeklyMenu).forEach(day => {
      const dayMealsList = weeklyMenu[day] || [];
      dayMealsList.forEach(assignment => {
        const actualRecipeId = assignment?.recipeId;
        if (actualRecipeId && actualRecipeId !== 'eat_out') {
          const recipe = MOCK_RECIPES.find(r => r && String(r.id) === String(actualRecipeId));
          if (recipe) {
            const currentDiners = assignment?.diners || recipe.baseDiners || 1;
            recipe.ingredients.forEach(ing => {
              // ID IDÉNTICO AL DE LA LISTA DE LA COMPRA
              const canonicalName = getCanonicalName(ing.name);
              const cleanSafeId = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
              const itemId = `menu-${cleanSafeId}`; 

              if (deletedSet.has(itemId)) return; 

              let adjustedAmount = (ing.amount / (recipe.baseDiners || 1)) * currentDiners;
              const normalized = normalizeToBase(adjustedAmount, ing.unit);

              if (ingredientMap[canonicalName]) {
                ingredientMap[canonicalName].amount += normalized.amount; 
              } else {
                ingredientMap[canonicalName] = { 
                  id: itemId, 
                  name: canonicalName, 
                  amount: normalized.amount, 
                  unit: normalized.unit 
                };
              }
            });
          }
        }
      });
    });

    // 3.2 Filtramos los que están marcados como "comprados"
    let itemsToTransfer = Object.values(ingredientMap).filter(item => checkedSet.has(item.id));
    
    extraItems.forEach(extra => {
      if (checkedSet.has(extra.id) && !deletedSet.has(extra.id)) {
        const canonicalName = getCanonicalName(extra.name);
        const normalized = normalizeToBase(extra.amount, extra.unit);
        itemsToTransfer.push({
          id: extra.id,
          name: canonicalName,
          amount: normalized.amount,
          unit: normalized.unit
        });
      }
    });

    let currentPantry = await AsyncStorage.getItem('@pantry_items');
    currentPantry = currentPantry ? JSON.parse(currentPantry) : [];

    // 3.3. Cálculo de paquetes del súpermercado
    itemsToTransfer.forEach(newItem => {
      const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === newItem.name);
      const dbItem = dbKey ? INGREDIENTS_DB[dbKey] : null;

      let finalAmountToAdd = newItem.amount;
      let finalUnit = newItem.unit;
      let purchaseFormat = null;

      if (dbItem && dbItem.purchaseUnit) {
        const packageInfo = getPackageSize(dbItem.purchaseUnit);
        if (packageInfo.amount > 0) {
          // Redondeamos hacia arriba para comprar paquetes enteros
          finalAmountToAdd = calculatePurchaseLots(newItem.amount, packageInfo.amount);
          finalUnit = packageInfo.unit; 
          purchaseFormat = dbItem.purchaseUnit; // Guardamos el texto "Bolsa 500g"
        }
      }

      const cleanAmountToAdd = Math.round(finalAmountToAdd * 100) / 100;
      let existing = currentPantry.find(p => p.name === newItem.name);

      if (existing) {
        existing.amount += cleanAmountToAdd;
        if (existing.amount > existing.maxAmount) {
          existing.maxAmount = existing.amount; 
        }
        if (purchaseFormat) existing.purchaseUnit = purchaseFormat; // Actualizamos el formato
      } else {
        currentPantry.push({
          id: `pantry-${Date.now()}-${Math.random()}`,
          name: newItem.name,
          unit: finalUnit,
          amount: cleanAmountToAdd,
          maxAmount: cleanAmountToAdd,
          purchaseUnit: purchaseFormat
        });
      }
    });

    setPantryItems(currentPantry);
    await AsyncStorage.setItem('@pantry_items', JSON.stringify(currentPantry));

    checkedSet.forEach(id => deletedSet.add(id));
    await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(deletedSet)));
    await AsyncStorage.removeItem('@shopping_checked'); 
    
    Alert.alert("✅ Despensa actualizada", "Las cantidades se han ajustado según los formatos de venta del supermercado.");
  };

  const simulateConsumption = async (itemId) => {
    const updatedPantry = pantryItems.map(item => {
      if (item.id === itemId) {
        const consumed = item.maxAmount * 0.25;
        const newAmount = Math.max(0, item.amount - consumed);
        return { ...item, amount: newAmount };
      }
      return item;
    });

    setPantryItems(updatedPantry);
    await AsyncStorage.setItem('@pantry_items', JSON.stringify(updatedPantry));
  };

  if (!isReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Abriendo armarios...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>🗄️ Mi Despensa</Text>

      {pantryItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Tu despensa está vacía.</Text>
          <Text style={styles.emptySubText}>Ve a la lista de la compra, tacha los ingredientes que has comprado y vuelve aquí.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          <View style={styles.gridWrapper}>
            {pantryItems.map(ing => {
              const emoji = getEmojiForIngredient(ing.name);
              const percentage = ing.maxAmount > 0 ? (ing.amount / ing.maxAmount) : 0;
              
              let cardStyle = styles.cardGreen; 
              let textColor = '#166534';
              
              if (percentage <= 0.1) {
                cardStyle = styles.cardRed; 
                textColor = '#991b1b';
              } else if (percentage <= 0.5) {
                cardStyle = styles.cardOrange; 
                textColor = '#c2410c';
              }

              const displayPercentage = Math.round(percentage * 100);

              return (
                <TouchableOpacity 
                  key={ing.id}
                  style={[styles.gridCard, cardStyle]} 
                  onPress={() => simulateConsumption(ing.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardEmoji}>{emoji}</Text>
                  
                  <Text style={[styles.cardName, { color: textColor }]} numberOfLines={2}>
                    {ing.name}
                  </Text>
                  
                  <View style={[styles.cardAmountBadge, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                    <Text style={[styles.cardAmountText, { color: textColor }]}>
                      {formatAmount(ing.amount, ing.unit)}
                    </Text>
                  </View>

                  {/* Mostramos el formato de compra del súper si lo tiene */}
                  {ing.purchaseUnit && (
                    <Text style={[styles.purchaseUnitText, { color: textColor }]} numberOfLines={1}>
                      ({ing.purchaseUnit})
                    </Text>
                  )}

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${displayPercentage}%`, backgroundColor: textColor }]} />
                  </View>
                  <Text style={[styles.percentageText, { color: textColor }]}>
                    Queda {displayPercentage}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333', marginTop: 10 },
  listContainer: { paddingBottom: 40, paddingTop: 10 },
  
  gridWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: '3.5%', rowGap: 12 },
  
  gridCard: {
    width: '31%', 
    aspectRatio: 1, 
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  
  cardGreen: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  cardOrange: { backgroundColor: '#ffedd5', borderColor: '#fed7aa' },
  cardRed: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },

  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardName: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14, marginBottom: 4 },
  
  cardAmountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginBottom: 2 },
  cardAmountText: { fontSize: 11, fontWeight: 'bold' },

  purchaseUnitText: { fontSize: 9, opacity: 0.7, marginBottom: 4, textAlign: 'center', fontWeight: '500' },

  progressBarBg: { width: '80%', height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 2 },
  progressBarFill: { height: '100%', borderRadius: 3 },
  percentageText: { fontSize: 9, fontWeight: '600', opacity: 0.8 },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 22 }
});