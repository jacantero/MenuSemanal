import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weeklyMenu, MOCK_RECIPES, INGREDIENTS_DB, COMMON_INGREDIENTS } from '../tempData';

// --- DICCIONARIO DE EMOJIS (Automático, sin edición) ---
export const getEmojiForIngredient = (name) => {
  const n = name.toLowerCase().trim();
  const foundKey = Object.keys(INGREDIENTS_DB).find(
    key => n.includes(key) || n.includes(INGREDIENTS_DB[key].name.toLowerCase())
  );
  if (foundKey) return INGREDIENTS_DB[foundKey].emoji;
  return '🛒';
};

const STANDARD_UNITS = ['ud', 'kg', 'g', 'L', 'ml', 'pack', 'bote', 'lata', 'paquete'];

// --- COLORES Y LETRAS PARA LOS DÍAS ---
const DAY_BADGES = {
  'Lunes': { text: 'L', color: '#ef4444' }, // Rojo
  'Martes': { text: 'M', color: '#f97316' }, // Naranja
  'Miércoles': { text: 'X', color: '#eab308' }, // Amarillo
  'Jueves': { text: 'J', color: '#22c55e' }, // Verde
  'Viernes': { text: 'V', color: '#3b82f6' }, // Azul
  'Sábado': { text: 'S', color: '#8b5cf6' }, // Morado
  'Domingo': { text: 'D', color: '#d946ef' }, // Rosa
};

export default function ShoppingScreen() {
  const [isReady, setIsReady] = useState(false);
  
  // Lista plana de ingredientes
  const [shoppingItems, setShoppingItems] = useState([]);
  
  const [extraItems, setExtraItems] = useState([]);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [deletedItems, setDeletedItems] = useState(new Set());

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('1'); 
  const [newItemUnit, setNewItemUnit] = useState('ud');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  const suggestions = newItemName.trim().length > 0 
    ? COMMON_INGREDIENTS.filter(ing => ing.name.toLowerCase().includes(newItemName.toLowerCase()))
    : [];

  useEffect(() => {
    const loadMemory = async () => {
      try {
        const savedExtras = await AsyncStorage.getItem('@shopping_extras');
        const savedChecked = await AsyncStorage.getItem('@shopping_checked');
        const savedDeleted = await AsyncStorage.getItem('@shopping_deleted');

        if (savedExtras) setExtraItems(JSON.parse(savedExtras));
        if (savedChecked) setCheckedItems(new Set(JSON.parse(savedChecked)));
        if (savedDeleted) setDeletedItems(new Set(JSON.parse(savedDeleted)));
      } catch (e) {
        console.error("Error cargando la lista:", e);
      } finally {
        setIsReady(true);
      }
    };
    loadMemory();
  }, []);

  const handleSelectSuggestion = (suggestion) => {
    setNewItemName(suggestion.name);
    if (!hasManuallySelectedUnit) setNewItemUnit(suggestion.unit);
    setShowSuggestions(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (isReady) calculateList();
    }, [isReady, extraItems, checkedItems, deletedItems])
  );

  // --- LÓGICA DE CÁLCULO Y SUMA DE CANTIDADES ---
  const calculateList = () => {
    const ingredientMap = {};

    Object.keys(weeklyMenu).forEach(day => {
      const dayMealsList = weeklyMenu[day] || [];
      
      dayMealsList.forEach(assignment => {
        const actualRecipeId = assignment?.recipeId;
        const plannedDiners = assignment?.diners;

        if (actualRecipeId && actualRecipeId !== 'eat_out') {
          const recipe = MOCK_RECIPES.find(r => r && String(r.id) === String(actualRecipeId));
          
          if (recipe) {
            const currentDiners = plannedDiners || recipe.baseDiners || 1;

            recipe.ingredients.forEach(ing => {
              const nameLower = ing.name.toLowerCase().trim();
              const itemId = `menu-${nameLower}`; 

              if (deletedItems.has(itemId)) return; 

              let adjustedAmount = (ing.amount / (recipe.baseDiners || 1)) * currentDiners;

              // Si el ingrediente ya existe de otra receta, le SUMAMOS la cantidad
              if (ingredientMap[nameLower]) {
                ingredientMap[nameLower].amount += adjustedAmount; 
                // Redondeamos para evitar decimales infinitos de JavaScript (ej. 1.3333333)
                ingredientMap[nameLower].amount = Math.round(ingredientMap[nameLower].amount * 100) / 100;
                // Le añadimos la etiqueta de este nuevo día
                ingredientMap[nameLower].days.add(day); 
              } else {
                // Si es la primera vez que vemos este ingrediente, lo creamos
                ingredientMap[nameLower] = {
                  id: itemId,
                  name: ing.name, 
                  amount: Math.round(adjustedAmount * 100) / 100,
                  unit: ing.unit,
                  days: new Set([day]),
                  checked: checkedItems.has(itemId), 
                  isExtra: false
                };
              }
            });
          }
        }
      });
    });

    const menuList = Object.values(ingredientMap).map(ing => ({
      ...ing,
      days: Array.from(ing.days) 
    }));

    const extrasList = extraItems.map(item => ({ 
      ...item, 
      checked: checkedItems.has(item.id), 
      isExtra: true, 
      days: [] 
    })).filter(item => !deletedItems.has(item.id));

    const finalFlatList = [...menuList, ...extrasList].sort((a, b) => {
      if (a.checked === b.checked) return a.name.localeCompare(b.name);
      return a.checked ? 1 : -1;
    });

    setShoppingItems(finalFlatList);
  };

  const handleAddManual = async () => {
    if (newItemName.trim() && newItemAmount.trim()) {
      const finalAmount = parseFloat(newItemAmount) || 1; 
      const itemId = `extra-${newItemName.trim().toLowerCase()}`;
      
      const newItem = { id: itemId, name: newItemName.trim(), amount: finalAmount, unit: newItemUnit };
      const updatedExtras = [...extraItems, newItem];
      
      setExtraItems(updatedExtras);
      await AsyncStorage.setItem('@shopping_extras', JSON.stringify(updatedExtras));

      if (deletedItems.has(itemId)) {
        const newDeleted = new Set(deletedItems);
        newDeleted.delete(itemId);
        setDeletedItems(newDeleted);
        await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(newDeleted)));
      }

      setNewItemName(''); setNewItemAmount('1'); setNewItemUnit('ud');
      setHasManuallySelectedUnit(false); setShowSuggestions(false); setIsModalVisible(false);
    }
  };

  const toggleCheck = async (itemId) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) newChecked.delete(itemId);
    else newChecked.add(itemId);
    
    setCheckedItems(newChecked);
    await AsyncStorage.setItem('@shopping_checked', JSON.stringify(Array.from(newChecked)));
  };

  const handleDeleteItem = async (itemToDelete) => {
    const newDeleted = new Set(deletedItems);
    newDeleted.add(itemToDelete.id);
    
    setDeletedItems(newDeleted);
    await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(newDeleted)));

    if (itemToDelete.isExtra) {
      const updatedExtras = extraItems.filter(ext => ext.id !== itemToDelete.id);
      setExtraItems(updatedExtras);
      await AsyncStorage.setItem('@shopping_extras', JSON.stringify(updatedExtras));
    }
  };

  const handleClearChecked = async () => {
    const newDeleted = new Set(deletedItems);
    const extrasToRemove = new Set();

    shoppingItems.forEach(item => {
      if (item.checked) {
        newDeleted.add(item.id); 
        if (item.isExtra) extrasToRemove.add(item.id);
      }
    });

    setDeletedItems(newDeleted);
    await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(newDeleted)));

    if (extrasToRemove.size > 0) {
      const updatedExtras = extraItems.filter(ext => !extrasToRemove.has(ext.id));
      setExtraItems(updatedExtras);
      await AsyncStorage.setItem('@shopping_extras', JSON.stringify(updatedExtras));
    }
  };

  // --- RENDERIZADO DE LAS MINI ETIQUETAS DE DÍAS ---
  const renderDayBadges = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return null;

    const order = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const sortedDays = [...daysArray].sort((a, b) => order.indexOf(a) - order.indexOf(b));

    return (
      <View style={styles.daysSidebar}>
        {sortedDays.map(d => {
          const badgeInfo = DAY_BADGES[d] || { text: d[0], color: '#ccc' };
          return (
            <View key={d} style={[styles.dayBadge, { backgroundColor: badgeInfo.color }]}>
              <Text style={styles.dayBadgeText}>{badgeInfo.text}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (!isReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Preparando el carrito...</Text>
      </View>
    );
  }

  const hasCheckedItems = shoppingItems.some(i => i.checked);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>🛒 Mi Compra</Text>
      
      <TouchableOpacity style={styles.fakeSearchInput} activeOpacity={0.8} onPress={() => setIsModalVisible(true)}>
        <FontAwesome name="plus-circle" size={20} color="#2f95dc" style={{ marginRight: 10 }} />
        <Text style={styles.fakeSearchText}>Añadir algo que falte en casa...</Text>
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir a la lista</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
                <FontAwesome name="times" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={{ zIndex: 10 }}>
              <Text style={styles.inputLabel}>¿Qué necesitas?</Text>
              <TextInput style={styles.modalInput} placeholder="Ej. Tomates, Leche..." value={newItemName} onChangeText={(text) => { setNewItemName(text); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} autoFocus={true} />
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {suggestions.map((s, idx) => (
                    <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(s)}>
                      <Text style={styles.suggestionText}>{s.name} <Text style={{ color: '#888', fontSize: 13 }}>({s.unit})</Text></Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.amountUnitContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Cant.</Text>
                <TextInput style={[styles.modalInput, { textAlign: 'center' }]} value={newItemAmount} onChangeText={setNewItemAmount} keyboardType="numeric" />
              </View>
              <View style={{ flex: 3, marginLeft: 16 }}>
                <Text style={styles.inputLabel}>Unidad</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
                  {STANDARD_UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.unitChip, newItemUnit === u && styles.unitChipSelected]} onPress={() => { setNewItemUnit(u); setHasManuallySelectedUnit(true); }}>
                      <Text style={[styles.unitChipText, newItemUnit === u && styles.unitChipTextSelected]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={[styles.confirmButton, !newItemName.trim() && { opacity: 0.5 }]} onPress={handleAddManual} disabled={!newItemName.trim()}>
              <Text style={styles.confirmButtonText}>Añadir a mi carrito</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {shoppingItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Tu carrito está vacío.</Text>
          <Text style={styles.emptySubText}>Toca arriba para añadir cosas sueltas o planifica tu Menú.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          <View style={styles.gridWrapper}>
            {shoppingItems.map(ing => {
              const emoji = getEmojiForIngredient(ing.name);
              
              return (
                <View 
                  key={ing.id}
                  style={[styles.gridCard, ing.checked && styles.gridCardChecked]} 
                >
                  {/* Mini-labels laterales */}
                  {renderDayBadges(ing.days)}

                  <TouchableOpacity onPress={() => handleDeleteItem(ing)} style={styles.cardDeleteBtn}>
                    <FontAwesome name="times-circle" size={18} color="#94a3b8" style={{ opacity: 0.5 }} />
                  </TouchableOpacity>

                  <Text style={[styles.cardEmoji, ing.checked && { opacity: 0.4 }]}>
                    {emoji}
                  </Text>

                  <Text style={[styles.cardName, ing.checked && styles.textStrikethrough]} numberOfLines={2}>
                    {ing.name}
                  </Text>
                  
                  <View style={styles.cardAmountBadge}>
                    <Text style={styles.cardAmountText}>{ing.amount} {ing.unit}</Text>
                  </View>

                  {/* Capa para tachar la tarjeta */}
                  <TouchableOpacity 
                    style={styles.absoluteTouchOverlay}
                    onPress={() => toggleCheck(ing.id)}
                    activeOpacity={0.7}
                  />

                  {ing.checked && (
                    <View style={styles.checkOverlay} pointerEvents="none">
                      <FontAwesome name="check" size={40} color="#fff" />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          
          {hasCheckedItems && (
            <TouchableOpacity style={styles.clearAllButton} onPress={handleClearChecked}>
              <FontAwesome name="trash" size={18} color="#ff5252" style={{ marginRight: 8 }} />
              <Text style={styles.clearAllText}>Borrar todo lo tachado</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333', marginTop: 10 },
  listContainer: { paddingBottom: 80, paddingTop: 10 },
  
  gridWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: '3%', marginLeft:5 },
  
  gridCard: {
    width: '31%', 
    aspectRatio: 1, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0', 
    backgroundColor: '#ffffff', 
    padding: 8,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  gridCardChecked: { opacity: 0.5, transform: [{ scale: 0.95 }], backgroundColor: '#f1f5f9' },
  
  // ESTILOS DE LOS LABELS LATERALES
  daysSidebar: {
    position: 'absolute',
    top: 6,
    left: -6, 
    flexDirection: 'column', 
    flexWrap: 'wrap', 
    height: '80%', 
    gap: 4,
    zIndex: 20
  },
  dayBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  dayBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold'
  },

  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardName: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14, color: '#334155' },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#94a3b8' },
  
  cardAmountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  cardAmountText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  
  cardDeleteBtn: { position: 'absolute', top: 4, right: 4, padding: 4, zIndex: 30 },
  
  absoluteTouchOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 },
  checkOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 40 },

  fakeSearchInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  fakeSearchText: { fontSize: 16, color: '#94a3b8', flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  closeButton: { padding: 4 },
  
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  modalInput: { backgroundColor: '#f9f9f9', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee', fontSize: 16 },
  
  amountUnitContainer: { flexDirection: 'row', marginTop: 20, marginBottom: 30, zIndex: 1 },
  unitsScroll: { flexDirection: 'row', paddingVertical: 4 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f0f0f0', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  unitChipSelected: { backgroundColor: '#e6f7ff', borderColor: '#2f95dc' },
  unitChipText: { color: '#666', fontWeight: '500' },
  unitChipTextSelected: { color: '#2f95dc', fontWeight: 'bold' },

  confirmButton: { backgroundColor: '#2f95dc', padding: 16, borderRadius: 14, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  suggestionsBox: { position: 'absolute', top: 75, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, zIndex: 20, maxHeight: 160 },
  suggestionItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionText: { fontSize: 16, color: '#333' },

  clearAllButton: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ffcdd2', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  clearAllText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 16, color: '#888', textAlign: 'center' }
});