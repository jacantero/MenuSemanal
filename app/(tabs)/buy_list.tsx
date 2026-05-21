import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, ScrollView, Platform, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Añadimos updateIngredientDatabase a la importación
import { weeklyMenu, MOCK_RECIPES, INGREDIENTS_DB, COMMON_INGREDIENTS, normalizeToBase, getCanonicalName, registerCustomIngredient, updateIngredientDatabase } from '../tempData';

export const getEmojiForIngredient = (rawName) => {
  const canonical = getCanonicalName(rawName);
  const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
  if (dbKey) return INGREDIENTS_DB[dbKey].emoji;
  return '🛒';
};

const STANDARD_UNITS = ['ud', 'kg', 'g', 'L', 'ml', 'pack', 'bote', 'lata', 'paquete'];

const DAY_BADGES = {
  'Lunes': { text: 'L', color: '#ef4444' }, 'Martes': { text: 'M', color: '#f97316' },
  'Miércoles': { text: 'X', color: '#eab308' }, 'Jueves': { text: 'J', color: '#22c55e' },
  'Viernes': { text: 'V', color: '#3b82f6' }, 'Sábado': { text: 'S', color: '#8b5cf6' },
  'Domingo': { text: 'D', color: '#d946ef' },
};

export default function ShoppingScreen() {
  const [isReady, setIsReady] = useState(false);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [extraItems, setExtraItems] = useState([]);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [deletedItems, setDeletedItems] = useState(new Set());

  // ESTADOS DEL MODAL AÑADIR EXTRAS
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('1'); 
  const [newItemUnit, setNewItemUnit] = useState('ud');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  // --- NUEVO: ESTADOS DEL MODAL DE EDICIÓN DE INGREDIENTE ---
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingIngName, setEditingIngName] = useState('');
  const [activeTab, setActiveTab] = useState('datos'); 

  const [formUnit, setFormUnit] = useState('g');
  const [formEmoji, setFormEmoji] = useState('🛒');
  const [formFormat, setFormFormat] = useState('1kg');
  const [formPrice, setFormPrice] = useState('0.00');

  const [formMacros, setFormMacros] = useState({ kcals: '0', protein: '0', carbsTotal: '0', carbsSugars: '0', fatsTotal: '0', fatsSat: '0', fatsMono: '0', fatsPoly: '0', fiber: '0', salt: '0' });
  const [formMicros, setFormMicros] = useState({ calcium: '0', iron: '0', magnesium: '0', potassium: '0', zinc: '0', vitE: '0', vitC: '0' });


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
      } catch (e) {} finally { setIsReady(true); }
    };
    loadMemory();
  }, []);

  useFocusEffect(useCallback(() => { if (isReady) calculateList(); }, [isReady, extraItems, checkedItems, deletedItems]));

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
              const canonicalName = getCanonicalName(ing.name);
              const cleanSafeId = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
              const itemId = `menu-${cleanSafeId}`; 

              if (deletedItems.has(itemId)) return; 
              let adjustedAmount = (ing.amount / (recipe.baseDiners || 1)) * currentDiners;
              const normalized = normalizeToBase(adjustedAmount, ing.unit);

              if (ingredientMap[canonicalName]) {
                ingredientMap[canonicalName].amount += normalized.amount; 
                ingredientMap[canonicalName].amount = Math.round(ingredientMap[canonicalName].amount * 100) / 100;
                ingredientMap[canonicalName].days.add(day); 
              } else {
                ingredientMap[canonicalName] = { id: itemId, name: canonicalName, amount: Math.round(normalized.amount * 100) / 100, unit: normalized.unit, days: new Set([day]), checked: checkedItems.has(itemId), isExtra: false };
              }
            });
          }
        }
      });
    });

    const menuList = Object.values(ingredientMap).map(ing => ({ ...ing, days: Array.from(ing.days) }));
    const extrasList = extraItems.map(item => {
      const normalizedExtra = normalizeToBase(item.amount, item.unit);
      return { ...item, amount: Math.round(normalizedExtra.amount * 100) / 100, unit: normalizedExtra.unit, checked: checkedItems.has(item.id), isExtra: true, days: [] };
    }).filter(item => !deletedItems.has(item.id));

    const finalFlatList = [...menuList, ...extrasList].sort((a, b) => {
      if (a.checked === b.checked) return a.name.localeCompare(b.name);
      return a.checked ? 1 : -1;
    });

    setShoppingItems(finalFlatList);
  };

  const handleSelectSuggestion = (suggestion) => {
    setNewItemName(suggestion.name);
    if (!hasManuallySelectedUnit) setNewItemUnit(suggestion.unit || 'ud');
    setShowSuggestions(false);
  };

  const handleAddManual = async () => {
    if (!newItemName.trim() || !newItemAmount.trim()) return;

    const rawName = newItemName.trim();
    const canonicalName = getCanonicalName(rawName);
    const isFallbackName = canonicalName === rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    const alreadyExistsInDB = Object.keys(INGREDIENTS_DB).some(k => INGREDIENTS_DB[k].name === canonicalName);

    const proceedToAdd = async (finalName) => {
      const cleanSafeId = finalName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const finalAmount = parseFloat(newItemAmount) || 1; 
      const itemId = `extra-${cleanSafeId}-${Date.now()}`;
      
      const newItem = { id: itemId, name: finalName, amount: finalAmount, unit: newItemUnit };
      const updatedExtras = [...extraItems, newItem];
      
      setExtraItems(updatedExtras);
      await AsyncStorage.setItem('@shopping_extras', JSON.stringify(updatedExtras));

      setNewItemName(''); setNewItemAmount('1'); setNewItemUnit('ud');
      setHasManuallySelectedUnit(false); setShowSuggestions(false); setIsModalVisible(false);
    };

    if (isFallbackName && !alreadyExistsInDB) {
      Alert.alert(
        "✨ Ingrediente Nuevo",
        `Parece que "${canonicalName}" no está en tu base de datos. ¿Quieres que la aplicación se lo aprenda?`,
        [
          { text: "Solo por hoy", style: "cancel", onPress: () => proceedToAdd(canonicalName) },
          { text: "Sí, aprender", style: "default", onPress: async () => {
              const registeredName = await registerCustomIngredient(rawName, newItemUnit);
              proceedToAdd(registeredName);
          }}
        ]
      );
    } else { proceedToAdd(canonicalName); }
  };

  // --- LÓGICA DE EDICIÓN MEDIANTE LONG PRESS ---
  const openIngredientEditor = (ingredientName) => {
    const canonical = getCanonicalName(ingredientName);
    const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
    
    if (dbKey) {
      const dbData = INGREDIENTS_DB[dbKey];
      setEditingIngName(canonical);
      setActiveTab('datos');
      
      // Rellenamos el modal con los datos existentes
      setFormUnit(dbData.unit || 'g');
      setFormEmoji(dbData.emoji || '🛒');
      setFormFormat(dbData.purchaseUnit || `1${dbData.unit}`);
      setFormPrice(String(dbData.purchasePrice || 0));

      const mac = dbData.macros || {};
      setFormMacros({
        kcals: String(mac.kcals || 0), protein: String(mac.protein || 0),
        carbsTotal: String(mac.carbs?.total || 0), carbsSugars: String(mac.carbs?.sugars || 0),
        fatsTotal: String(mac.fats?.total || 0), fatsSat: String(mac.fats?.saturated || 0),
        fatsMono: String(mac.fats?.monounsaturated || 0), fatsPoly: String(mac.fats?.polyunsaturated || 0),
        fiber: String(mac.fiber || 0), salt: String(mac.salt || 0)
      });

      const mic = dbData.micros || {};
      setFormMicros({
        calcium: String(mic.calcium_mg || 0), iron: String(mic.iron_mg || 0), magnesium: String(mic.magnesium_mg || 0),
        potassium: String(mic.potassium_mg || 0), zinc: String(mic.zinc_mg || 0), vitE: String(mic.vitE_mg || 0), vitC: String(mic.vitC_mg || 0)
      });

      setIsEditModalVisible(true);
    }
  };

  const saveIngredientEdit = async () => {
    const advancedIngredientObject = {
      name: editingIngName,
      unit: formUnit, emoji: formEmoji.trim() || '🛒', purchaseUnit: formFormat.trim() || `1 ${formUnit}`, purchasePrice: parseFloat(formPrice) || 0,
      macros: { kcals: parseFloat(formMacros.kcals) || 0, protein: parseFloat(formMacros.protein) || 0, carbs: { total: parseFloat(formMacros.carbsTotal) || 0, sugars: parseFloat(formMacros.carbsSugars) || 0 }, fats: { total: parseFloat(formMacros.fatsTotal) || 0, saturated: parseFloat(formMacros.fatsSat) || 0, monounsaturated: parseFloat(formMacros.fatsMono) || 0, polyunsaturated: parseFloat(formMacros.fatsPoly) || 0 }, fiber: parseFloat(formMacros.fiber) || 0, salt: parseFloat(formMacros.salt) || 0 },
      micros: { calcium_mg: parseFloat(formMicros.calcium) || 0, iron_mg: parseFloat(formMicros.iron) || 0, magnesium_mg: parseFloat(formMicros.magnesium) || 0, potassium_mg: parseFloat(formMicros.potassium) || 0, zinc_mg: parseFloat(formMicros.zinc) || 0, vitE_mg: parseFloat(formMicros.vitE) || 0, vitC_mg: parseFloat(formMicros.vitC) || 0 },
      source: "USER_CUSTOM"
    };

    // Actualizamos la base de datos RAM y el disco duro
    await updateIngredientDatabase(editingIngName, advancedIngredientObject);
    setIsEditModalVisible(false);
    
    // Forzamos recálculo de la lista para que el emoji o unidad se actualicen al instante
    calculateList(); 
    Alert.alert("¡Ficha actualizada!", `Los datos de "${editingIngName}" se han guardado correctamente.`);
  };

  const toggleCheck = useCallback(async (itemId) => {
    setCheckedItems(prev => {
      const newChecked = new Set(prev);
      if (newChecked.has(itemId)) newChecked.delete(itemId); else newChecked.add(itemId);
      AsyncStorage.setItem('@shopping_checked', JSON.stringify(Array.from(newChecked))).catch(e => console.error(e));
      return newChecked;
    });

    setShoppingItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item));
    setTimeout(() => {
      setShoppingItems(currentItems => [...currentItems].sort((a, b) => { if (a.checked === b.checked) return a.name.localeCompare(b.name); return a.checked ? 1 : -1; }));
    }, 1000);
  }, []);

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

  const handleClearChecked = () => {
    Alert.alert("¿Añadir a la despensa?", "Si borras los ingredientes tachados aquí se perderán. Para guardar tu compra, ve a la pestaña de 'Despensa' y se limpiarán automáticamente.", [
      { text: "Solo borrarlos", style: "destructive", onPress: performClear },
      { text: "Entendido", style: "cancel" }
    ]);
  };

  const performClear = async () => {
    const newDeleted = new Set(deletedItems);
    const extrasToRemove = new Set();

    shoppingItems.forEach(item => {
      if (item.checked) { newDeleted.add(item.id); if (item.isExtra) extrasToRemove.add(item.id); }
    });

    setDeletedItems(newDeleted);
    await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(newDeleted)));

    if (extrasToRemove.size > 0) {
      const updatedExtras = extraItems.filter(ext => !extrasToRemove.has(ext.id));
      setExtraItems(updatedExtras);
      await AsyncStorage.setItem('@shopping_extras', JSON.stringify(updatedExtras));
    }
  };

  const renderDayBadges = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return null;
    const order = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const sortedDays = [...daysArray].sort((a, b) => order.indexOf(a) - order.indexOf(b));

    return (
      <View style={styles.daysSidebar}>
        {sortedDays.map(d => {
          const badgeInfo = DAY_BADGES[d] || { text: d[0], color: '#ccc' };
          return <View key={d} style={[styles.dayBadge, { backgroundColor: badgeInfo.color }]}><Text style={styles.dayBadgeText}>{badgeInfo.text}</Text></View>;
        })}
      </View>
    );
  };

  if (!isReady) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Preparando el carrito...</Text></View>;

  const hasCheckedItems = shoppingItems.some(i => i.checked);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>🛒 Mi Compra</Text>
      
      <TouchableOpacity style={styles.fakeSearchInput} activeOpacity={0.8} onPress={() => setIsModalVisible(true)}>
        <FontAwesome name="plus-circle" size={20} color="#2f95dc" style={{ marginRight: 10 }} />
        <Text style={styles.fakeSearchText}>Añadir algo que falte en casa...</Text>
      </TouchableOpacity>

      <Text style={styles.helperText}>💡 Mantén pulsado un ingrediente para editar su ficha técnica.</Text>

      {/* --- MODAL PARA AÑADIR MANUAL --- */}
      <Modal visible={isModalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir a la lista</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}><FontAwesome name="times" size={24} color="#888" /></TouchableOpacity>
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

      {/* --- GRID DE LA COMPRA --- */}
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
                <View key={ing.id} style={[styles.gridCard, ing.checked && styles.gridCardChecked]}>
                  {renderDayBadges(ing.days)}

                  <TouchableOpacity onPress={() => handleDeleteItem(ing)} style={styles.cardDeleteBtn}>
                    <FontAwesome name="times-circle" size={18} color="#94a3b8" style={{ opacity: 0.5 }} />
                  </TouchableOpacity>

                  <Text style={[styles.cardEmoji, ing.checked && { opacity: 0.4 }]}>{emoji}</Text>
                  <Text style={[styles.cardName, ing.checked && styles.textStrikethrough]} numberOfLines={2}>{ing.name}</Text>
                  
                  <View style={styles.cardAmountBadge}>
                    <Text style={styles.cardAmountText}>{ing.amount} {ing.unit}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.absoluteTouchOverlay}
                    onPress={() => toggleCheck(ing.id)}
                    onLongPress={() => openIngredientEditor(ing.name)}
                    delayLongPress={400}
                    activeOpacity={0.7}
                  />

                  {ing.checked && <View style={styles.checkOverlay} pointerEvents="none"><FontAwesome name="check" size={40} color="#fff" /></View>}
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

      {/* ========================================================
          🎛️ MODAL EDICIÓN DE FICHA TÉCNICA (LONG PRESS)
          ======================================================== */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✨ Editar Ficha Técnica</Text>
            
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.modalSubtitle}>Ingrediente: {editingIngName}</Text>

              <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'datos' && styles.tabActive]} onPress={() => setActiveTab('datos')}>
                  <Text style={[styles.tabText, activeTab === 'datos' && styles.tabTextActive]}>Súper</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'macros' && styles.tabActive]} onPress={() => setActiveTab('macros')}>
                  <Text style={[styles.tabText, activeTab === 'macros' && styles.tabTextActive]}>Macros (100g)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'micros' && styles.tabActive]} onPress={() => setActiveTab('micros')}>
                  <Text style={[styles.tabText, activeTab === 'micros' && styles.tabTextActive]}>Micros</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                {activeTab === 'datos' && (
                  <View style={styles.gridWrapperModal}>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Emoji</Text><TextInput style={styles.macroInput} value={formEmoji} onChangeText={setFormEmoji} /></View>
                    <View style={[styles.macroBox, { width: '100%' }]}>
                      <Text style={styles.macroLabel}>Unidad Base</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.unitsScroll, { marginTop: 4, paddingBottom: 4 }]}>
                        {STANDARD_UNITS.map((u) => (
                          <TouchableOpacity key={u} style={[styles.unitChip, formUnit === u && styles.unitChipSelected, { paddingHorizontal: 12, paddingVertical: 6, marginBottom: 0 }]} onPress={() => setFormUnit(u)}>
                            <Text style={[styles.unitChipText, formUnit === u && styles.unitChipTextSelected, { fontSize: 12 }]}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Formato Venta</Text><TextInput style={styles.macroInput} value={formFormat} onChangeText={setFormFormat} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Precio Venta (€)</Text><TextInput style={styles.macroInput} keyboardType="decimal-pad" value={formPrice} onChangeText={setFormPrice} /></View>
                  </View>
                )}

                {activeTab === 'macros' && (
                  <View style={styles.gridWrapperModal}>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Kcals</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.kcals} onChangeText={t => setFormMacros({...formMacros, kcals: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Proteínas (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.protein} onChangeText={t => setFormMacros({...formMacros, protein: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Carbos (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.carbsTotal} onChangeText={t => setFormMacros({...formMacros, carbsTotal: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Azúcares (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.carbsSugars} onChangeText={t => setFormMacros({...formMacros, carbsSugars: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Grasas (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsTotal} onChangeText={t => setFormMacros({...formMacros, fatsTotal: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Saturadas (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsSat} onChangeText={t => setFormMacros({...formMacros, fatsSat: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Fibra (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fiber} onChangeText={t => setFormMacros({...formMacros, fiber: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Sal (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.salt} onChangeText={t => setFormMacros({...formMacros, salt: t})} /></View>
                  </View>
                )}

                {activeTab === 'micros' && (
                  <View style={styles.gridWrapperModal}>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Calcio (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.calcium} onChangeText={t => setFormMicros({...formMicros, calcium: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Hierro (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.iron} onChangeText={t => setFormMicros({...formMicros, iron: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Magnesio (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.magnesium} onChangeText={t => setFormMicros({...formMicros, magnesium: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Potasio (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.potassium} onChangeText={t => setFormMicros({...formMicros, potassium: t})} /></View>
                  </View>
                )}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                <TouchableOpacity style={[styles.confirmModalBtn, { flex: 1, backgroundColor: '#cbd5e1' }]} onPress={() => setIsEditModalVisible(false)}>
                  <Text style={[styles.confirmModalBtnText, { color: '#334155' }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmModalBtn, { flex: 2 }]} onPress={saveIngredientEdit}>
                  <Text style={styles.confirmModalBtnText}>Guardar Cambios</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: '#333', marginTop: 10 },
  helperText: { fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 15, fontStyle: 'italic' },
  listContainer: { paddingBottom: 80, paddingTop: 5 },
  
  gridWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: '3%', marginLeft:5 },
  gridCard: { width: '31%', aspectRatio: 1, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', padding: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'center', position: 'relative', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  gridCardChecked: { opacity: 0.5, transform: [{ scale: 0.95 }], backgroundColor: '#f1f5f9' },
  
  daysSidebar: { position: 'absolute', top: 6, left: -6, flexDirection: 'column', flexWrap: 'wrap', height: '80%', gap: 4, zIndex: 20 },
  dayBadge: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 1, elevation: 2 },
  dayBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardName: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14, color: '#334155' },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#94a3b8' },
  cardAmountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  cardAmountText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  cardDeleteBtn: { position: 'absolute', top: 4, right: 4, padding: 4, zIndex: 30 },
  
  absoluteTouchOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 },
  checkOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 40 },

  fakeSearchInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 5, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
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
  emptySubText: { fontSize: 16, color: '#888', textAlign: 'center' },

  // --- ESTILOS DEL MODAL DE EDICIÓN NUTRICIONAL ---
  modalSubtitle: { fontSize: 14, fontWeight: '700', color: '#2f95dc', textAlign: 'center', marginBottom: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1e293b', fontWeight: 'bold' },
  gridWrapperModal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  macroBox: { width: '48%', backgroundColor: '#f8fafc', padding: 8, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  macroLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4, paddingLeft: 4 },
  macroInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14, fontWeight: 'bold', color: '#334155' },
  confirmModalBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmModalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});