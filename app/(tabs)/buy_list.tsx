import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, ScrollView, Platform, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Lo dejamos solo para el coste estimado

// 1. IMPORTAMOS EL HOOK DEL CONTEXTO GLOBAl (Ajusta la ruta si es necesario)
import { useHousehold } from '../HouseholdContext';

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
  // 2. DOSIS DE MAGIA: Traemos los estados y la función de guardado unificada del contexto
  const { 
    isReady: contextReady, 
    extraItems, 
    checkedItems, 
    deletedItems, 
    pantryItems, 
    updateShopping,
    updatePantry 
  } = useHousehold();

  const [shoppingItems, setShoppingItems] = useState([]);

  // ESTADOS DEL MODAL AAÑADIR EXTRAS
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('1'); 
  const [newItemUnit, setNewItemUnit] = useState('ud');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  // ESTADOS DEL MODAL DE EDICIÓN DE INGREDIENTE (LONG PRESS)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingIngName, setEditingIngName] = useState('');
  const [activeTab, setActiveTab] = useState('datos'); 

  const [formUnit, setFormUnit] = useState('g');
  const [formEmoji, setFormEmoji] = useState('🛒');
  const [formFormat, setFormFormat] = useState('1kg');
  const [formPrice, setFormPrice] = useState('0.00');

  const [formMacros, setFormMacros] = useState({ kcals: '0', protein: '0', carbsTotal: '0', carbsSugars: '0', fatsTotal: '0', fatsSat: '0', fatsMono: '0', fatsPoly: '0', fiber: '0', salt: '0' });
  const [formMicros, setFormMicros] = useState({ calcium: '0', iron: '0', magnesium: '0', potassium: '0', zinc: '0', vitE: '0', vitC: '0' });

  // --- ESTADOS PARA EL MODAL DEL TICKET (PRESUPUESTO) Y SUS EDICIONES ---
  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
  const [tempPrices, setTempPrices] = useState({});
  const [ticketOverrides, setTicketOverrides] = useState({});

  const suggestions = newItemName.trim().length > 0 
    ? COMMON_INGREDIENTS.filter(ing => ing.name.toLowerCase().includes(newItemName.toLowerCase()))
    : [];

  // 3. REACCIÓN AUTOMÁTICA: Cada vez que el contexto cambie algo (venga de Firebase o local), recalculamos la lista
  useEffect(() => {
    if (contextReady) {
      calculateList();
    }
  }, [contextReady, extraItems, checkedItems, deletedItems, pantryItems]);

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
              let normalized = normalizeToBase(adjustedAmount, ing.unit);

              if (ingredientMap[canonicalName]) {
                ingredientMap[canonicalName].amount += normalized.amount; 
                ingredientMap[canonicalName].days.add(day); 
              } else {
                ingredientMap[canonicalName] = { 
                  id: itemId, 
                  name: canonicalName, 
                  amount: normalized.amount, 
                  unit: normalized.unit, 
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

    const menuList = Object.values(ingredientMap).map(ing => {
      const pantryMatch = pantryItems.find(p => getCanonicalName(p.name) === ing.name);
      let finalAmount = ing.amount;
      
      if (pantryMatch) {
        const normalizedPantry = normalizeToBase(pantryMatch.amount, pantryMatch.unit);
        if (normalizedPantry.unit === ing.unit) {
          finalAmount = Math.max(0, ing.amount - normalizedPantry.amount);
        }
      }

      return { 
        ...ing, 
        amount: Math.round(finalAmount * 100) / 100, 
        days: Array.from(ing.days) 
      };
    }).filter(ing => ing.amount > 0);

    const extrasList = extraItems.map(item => {
      const normalizedExtra = normalizeToBase(item.amount, item.unit);
      return { 
        ...item, 
        amount: Math.round(normalizedExtra.amount * 100) / 100, 
        unit: normalizedExtra.unit, 
        checked: checkedItems.has(item.id), 
        isExtra: true, 
        days: [] 
      };
    }).filter(item => !deletedItems.has(item.id));

    const finalFlatList = [...menuList, ...extrasList].sort((a, b) => {
      if (a.checked === b.checked) return a.name.localeCompare(b.name);
      return a.checked ? 1 : -1;
    });

    setShoppingItems(finalFlatList);
  };

  // --- LÓGICA DE PRESUPUESTO BLINDADA ---
  const budgetDetails = useMemo(() => {
    let total = 0;
    const items = shoppingItems.map(item => {
      const canonicalName = getCanonicalName(item.name || '').toLowerCase().trim();

      const dbKey = Object.keys(INGREDIENTS_DB).find(k => {
        const cleanKey = k.toLowerCase();
        if (cleanKey === canonicalName || canonicalName.includes(cleanKey)) return true;

        const dbName = INGREDIENTS_DB[k]?.name;
        if (!dbName) return false;

        const synonyms = dbName.toLowerCase().split('/').map(name => name.trim());
        return synonyms.some(syn => syn.includes(canonicalName) || canonicalName.includes(syn));
      });

      const dbItem = INGREDIENTS_DB[dbKey];
      let unitPrice = dbItem ? (tempPrices[item.name] !== undefined ? tempPrices[item.name] : (dbItem.purchasePrice || 0)) : 0;
      unitPrice = Number(unitPrice) || 0; 
      
      let leadingWord = null;
      let pAmount = 1;
      let lots = 1;
      let pUnit = 'ud';
      let purchaseFormat = dbItem ? dbItem.purchaseUnit : '1 ud';
      
      if (dbItem && dbItem.purchaseUnit) {
        const match = dbItem.purchaseUnit.match(/^(?:([a-zñáéíóú]+)(?:\s+de)?\s+)?([\d.]+)\s*(g|kg|ml|l|ud|docena|pack|bote|lata|paquete|manojo|sarta|cajita|pastilla|barra|bolsa|bandeja|tarro|brik)/i);
        if (match) {
          leadingWord = match[1];
          pAmount = parseFloat(match[2]) || 1;
          pUnit = match[3].toLowerCase();
          
          let itemAmt = item.amount;
          let pkgAmt = pAmount;
          
          if ((item.unit === 'g' || item.unit ==='ud') && pUnit === 'kg') pkgAmt = pAmount * 1000;
          if (item.unit === 'kg' && pUnit === 'g') itemAmt = item.amount * 1000;
          if (item.unit === 'ml' && pUnit === 'l') pkgAmt = pAmount * 1000;
          if (item.unit === 'l' && pUnit === 'ml') itemAmt = item.amount * 1000;
          if (pUnit === 'docena') pkgAmt = 12;
          if (item.unit === "ud") itemAmt = itemAmt * dbItem.weightPerUnit;
          if (pUnit === "ud") pkgAmt = pAmount * dbItem.weightPerUnit;
          
          lots = Math.ceil(itemAmt / pkgAmt) || 1;
        }
      }

      const override = ticketOverrides[item.id];
      const currentLotsStr = override ? override.lotsStr : String(lots);
      const currentLotsNum = parseFloat(currentLotsStr) || 0;
      const currentUnit = override ? override.unit : pUnit;

      const itemTotalCost = currentLotsNum * unitPrice;
      total += itemTotalCost;

      if (leadingWord) pUnit = leadingWord;

      return {
        ...item,
        dbKey,
        unitPrice,
        purchaseFormat,
        lots: currentLotsNum,
        currentLotsStr,
        currentUnit,
        itemTotalCost,
        pUnit
      };     
    });

    return { total, items };
  }, [shoppingItems, tempPrices, ticketOverrides]);

  useEffect(() => {
    const safeTotal = budgetDetails.total || 0;
    AsyncStorage.setItem('@estimated_shopping_cost', safeTotal.toString())
      .catch(e => console.error("Error guardando el presupuesto:", e));
  }, [budgetDetails.total]);

  const updatePriceInTicket = async (itemName, dbKey, newPriceStr) => {
    const newPrice = parseFloat(newPriceStr.replace(',', '.'));
    if (isNaN(newPrice)) return;

    setTempPrices(prev => ({ ...prev, [itemName]: newPrice }));
    if (dbKey && INGREDIENTS_DB[dbKey]) {
      const updatedIng = { ...INGREDIENTS_DB[dbKey], purchasePrice: newPrice };
      await updateIngredientDatabase(itemName, updatedIng);
    }
  };

  // 🛒 FUNCIÓN MAESTRA: Transferir del Carrito a la Despensa usando los lotes de buy_list
  const handleTransferToPantry = async () => {
    // 1. Filtramos solo los productos que el usuario ha tachado (comprado)
    const checkedItemsToTransfer = budgetDetails.items.filter(item => item.checked);

    if (checkedItemsToTransfer.length === 0) {
      Alert.alert("Carrito vacío", "No tienes ningún ingrediente marcado (tachado) para enviar a la despensa.");
      return;
    }

    // 2. Clonamos la despensa actual de forma segura
    const currentPantry = JSON.parse(JSON.stringify(pantryItems));

    checkedItemsToTransfer.forEach(item => {
      let finalAmountToAdd = item.amount; // Caída de seguridad
      let finalUnit = item.unit;          // Unidad base calculada (g, ml, ud)

      // Si el ingrediente tiene formato en la base de datos (Ej: "Botella 250ml")
      if (item.purchaseFormat) {
        // Usamos exactamente tu mismo Regex de budgetDetails para abrir el paquete
        const match = item.purchaseFormat.match(/^(?:([a-zñáéíóú]+)(?:\s+de)?\s+)?([\d.]+)\s*(g|kg|ml|l|ud|docena|pack|bote|lata|paquete|manojo|sarta|cajita|pastilla|barra|bolsa|bandeja|tarro|brik)/i);
        
        if (match) {
          const pAmount = parseFloat(match[2]) || 1;
          const pUnit = match[3].toLowerCase();
          
          // Multiplicamos: Cantidad del paquete * Número de lotes que calculó buy_list
          const totalPurchasedInPackageUnit = item.lots * pAmount;
          
          // Lo normalizamos a la unidad base antes de guardarlo (Ej: 1 kg -> 1000g / 0.25 L -> 250ml)
          const normalized = normalizeToBase(totalPurchasedInPackageUnit, pUnit);
          
          finalAmountToAdd = normalized.amount;
          finalUnit = normalized.unit;
        }
      }

      const cleanAmountToAdd = Math.round(finalAmountToAdd * 100) / 100;

      // 3. Buscamos si ya existe en la despensa
      let existing = currentPantry.find(p => getCanonicalName(p.name) === getCanonicalName(item.name));

      if (existing) {
        existing.amount += cleanAmountToAdd;
        if (existing.amount > existing.maxAmount) {
          existing.maxAmount = existing.amount; // Actualizamos el tope de la barra de progreso
        }
      } else {
        // Si es nuevo, lo creamos con el formato limpio de la base de datos
        currentPantry.push({
          id: `pantry-${Date.now()}-${Math.random()}`,
          name: item.name,
          unit: finalUnit, // 'ml', 'g', etc.
          amount: cleanAmountToAdd,
          maxAmount: cleanAmountToAdd,
          purchaseUnit: item.purchaseFormat
        });
      }
    });

    try {
      // 4. Guardamos la nueva despensa unificada en el contexto (sube a Firebase/AsyncStorage solo)
      await updatePantry(currentPantry);

      // 5. Limpiamos los elementos comprados de la lista de la compra de golpe
      await performClear();

      Alert.alert("¡Despensa Actualizada! 🥳", "Los productos se han sumado a tu inventario y el carrito se ha limpiado.");
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar la compra en la despensa.");
    }
  };

  // 4. ACCIÓN MANUAL: Añadir manda la orden directa al contexto
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
      
      // Enviamos el cambio al contexto
      await updateShopping(updatedExtras, checkedItems, deletedItems);

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

  const openIngredientEditor = (ingredientName) => {
    const canonical = getCanonicalName(ingredientName);
    const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
    
    if (dbKey) {
      const dbData = INGREDIENTS_DB[dbKey];
      setEditingIngName(canonical);
      setActiveTab('datos');
      
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

    await updateIngredientDatabase(editingIngName, advancedIngredientObject);
    setIsEditModalVisible(false);
    calculateList(); 
    Alert.alert("¡Ficha actualizada!", `Los datos de "${editingIngName}" se han guardado correctamente.`);
  };

  // 5. MARCAR ÍTEMS: Actualizamos el contexto y mantenemos tu genial efecto visual de retardo
  const toggleCheck = useCallback(async (itemId) => {
    
    // 1. TACHADO INMEDIATO (La magia visual va primero)
    setShoppingItems(prevItems => 
      prevItems.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item)
    );

    // 2. Preparamos los datos para el Contexto
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) newChecked.delete(itemId); else newChecked.add(itemId);
    
    // 3. Enviamos a la base de datos (Como ya hemos tachado la UI, no nos importa si esto tarda un poco)
    await updateShopping(extraItems, newChecked, deletedItems);

    // 4. Tu truco de reordenar la lista un segundo después en la pantalla
    setTimeout(() => {
      setShoppingItems(currentItems => [...currentItems].sort((a, b) => { 
        if (a.checked === b.checked) return a.name.localeCompare(b.name); 
        return a.checked ? 1 : -1; 
      }));
    }, 1000);

  }, [extraItems, checkedItems, deletedItems, updateShopping]);

  // 6. BORRAR ÍTEM: Limpio, asíncrono y centralizado
  const handleDeleteItem = async (itemToDelete) => {
    const newDeleted = new Set(deletedItems);
    newDeleted.add(itemToDelete.id);

    let updatedExtras = extraItems;
    if (itemToDelete.isExtra) {
      updatedExtras = extraItems.filter(ext => ext.id !== itemToDelete.id);
    }

    await updateShopping(updatedExtras, checkedItems, newDeleted);
  };

const handleClearChecked = () => {
    Alert.alert(
      "🛒 Procesar Compra", 
      "¿Qué quieres hacer con los ingredientes comprados (tachados)?", 
      [
        { 
          text: "Sumar a la Despensa y Limpiar", 
          style: "default", 
          onPress: handleTransferToPantry // 👈 Tu nueva función unificada
        },
        { 
          text: "Borrarlos de la lista", 
          style: "destructive", 
          onPress: performClear 
        },
        { 
          text: "Cancelar", 
          style: "cancel" 
        }
      ]
    );
  };

  // 7. LIMPIAR COMPLETADOS: Un solo tiro al contexto
  const performClear = async () => {
    const newDeleted = new Set(deletedItems);
    const extrasToRemove = new Set();

    shoppingItems.forEach(item => {
      if (item.checked) { 
        newDeleted.add(item.id); 
        if (item.isExtra) extrasToRemove.add(item.id); 
      }
    });

    let updatedExtras = extraItems;
    if (extrasToRemove.size > 0) {
      updatedExtras = extraItems.filter(ext => !extrasToRemove.has(ext.id));
    }

    await updateShopping(updatedExtras, checkedItems, newDeleted);
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

  // Usamos el loader del contexto global
  if (!contextReady) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Preparando el carrito...</Text></View>;

  const hasCheckedItems = shoppingItems.some(i => i.checked);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>🛒 Mi Compra</Text>

      <TouchableOpacity style={styles.budgetCard} activeOpacity={0.8} onPress={() => setIsBudgetModalVisible(true)}>
        <View style={styles.budgetTextContainer}>
          <Text style={styles.budgetLabel}>Presupuesto Estimado</Text>
          <Text style={styles.budgetValue}>{(budgetDetails.total || 0).toFixed(2)} €</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <FontAwesome name="calculator" size={24} color="#0284c7" style={{ opacity: 0.8, marginBottom: 4 }} />
          <Text style={{ fontSize: 10, color: '#0369a1', fontWeight: '600' }}>Ver ticket</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.fakeSearchInput} activeOpacity={0.8} onPress={() => setIsModalVisible(true)}>
        <FontAwesome name="plus-circle" size={20} color="#2f95dc" style={{ marginRight: 10 }} />
        <Text style={styles.fakeSearchText}>Añadir algo que falte en casa...</Text>
      </TouchableOpacity>

      <Text style={styles.helperText}>💡 Mantén pulsado un ingrediente para editar su ficha técnica.</Text>

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
            <TouchableOpacity style={styles.processButton} onPress={handleClearChecked}>
              <FontAwesome name="check-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.processButtonText}>Procesar Compra</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ========================================================
          🧾 MODAL TICKET CON EDICIÓN DE CANTIDAD Y UNIDAD INLINE
          ======================================================== */}
      <Modal visible={isBudgetModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%', paddingBottom: 20 }]}>
            
            {/* 1. CABECERA DEL MODAL */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.modalTitle}>🧾 Ticket Estimado</Text>
              <TouchableOpacity onPress={() => setIsBudgetModalVisible(false)} style={{ padding: 4 }}>
                <FontAwesome name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* 2. CABECERA DE LA TABLA */}
            <View style={styles.ticketHeaderRow}>
              <Text style={[styles.ticketHeaderCol, { flex: 1.5 }]}>PRODUCTO</Text>
              <Text style={[styles.ticketHeaderCol, { flex: 1.2, textAlign: 'center' }]}>COMPRA</Text>
              <Text style={[styles.ticketHeaderCol, { flex: 1.3, textAlign: 'right' }]}>PRECIO TOTAL</Text>
            </View>

            {/* 3. LISTA DE INGREDIENTES (SOLO LECTURA) */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {budgetDetails.items.map((item) => (
                <View key={item.id} style={styles.ticketRow}>
                  
                  {/* Columna Izquierda: Nombre y Cantidad Requerida */}
                  <View style={{ flex: 1.5, paddingRight: 5 }}>
                    <Text style={styles.ticketItemName} numberOfLines={1}>
                      {getEmojiForIngredient(item.name)} {item.name}
                    </Text>
                    <Text style={styles.ticketItemDesc}>
                      Req: {item.amount}{item.unit}
                    </Text>
                  </View>

                  {/* Columna Central: Lotes y Formato de Compra */}
                  <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[styles.ticketUnitText, { fontWeight: '600', color: '#334155', fontSize: 13 }]}>
                      {item.currentLotsStr} x {item.purchaseFormat}
                    </Text>
                  </View>

                  {/* Columna Derecha: Precio Unitario y Subtotal */}
                  <View style={{ flex: 1.3, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={[styles.ticketSubtotalText, { fontSize: 15, fontWeight: 'bold', color: '#0f172a' }]}>
                      {(item.itemTotalCost || 0).toFixed(2)}€
                    </Text>
                  </View>

                </View>
              ))}
            </ScrollView>

            {/* 4. PIE DEL TICKET (TOTALES) */}
            <View style={styles.ticketFooter}>
              <Text style={styles.ticketFooterLabel}>TOTAL APROXIMADO</Text>
              <Text style={styles.ticketFooterTotal}>{(budgetDetails.total || 0).toFixed(2)} €</Text>
            </View>

            {/* 5. BOTÓN CERRAR */}
            <TouchableOpacity 
              style={[styles.confirmButton, { marginTop: 15 }]} 
              onPress={() => setIsBudgetModalVisible(false)}
            >
              <Text style={styles.confirmButtonText}>Cerrar Ticket</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

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
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Monoinsat. (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsMono} onChangeText={t => setFormMacros({...formMacros, fatsMono: t})} /></View>
                    <View style={styles.macroBox}><Text style={styles.macroLabel}>Poliinsat. (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsPoly} onChangeText={t => setFormMacros({...formMacros, fatsPoly: t})} /></View>
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
  
  budgetCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#0284c7', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  budgetTextContainer: { flexDirection: 'column' },
  budgetLabel: { fontSize: 13, fontWeight: '700', color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5 },
  budgetValue: { fontSize: 26, fontWeight: '900', color: '#0284c7', marginTop: 2 },

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

  ticketHeaderRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 10 },
  ticketHeaderCol: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 },
  ticketItemName: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  ticketItemDesc: { fontSize: 10, color: '#64748b' },
  ticketQtyInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 6, width: 45, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#334155' },
  ticketUnitBtn: { backgroundColor: '#e2e8f0', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 6, marginLeft: 4 },
  ticketUnitText: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  inlineUnitSelector: { backgroundColor: '#f8fafc', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ticketPriceInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 6, width: 55, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#0284c7', marginBottom: 4 },
  ticketSubtotalText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  ticketFooter: { borderTopWidth: 2, borderTopColor: '#e2e8f0', paddingTop: 15, marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketFooterLabel: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  ticketFooterTotal: { fontSize: 24, fontWeight: '900', color: '#0284c7' },

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
  confirmModalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  processButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e', // Un verde vibrante de éxito
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 10,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3, // Sombra en Android
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});