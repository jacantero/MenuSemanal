import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

// 1. IMPORTAMOS NUESTRO CONTEXTO MÁGICO
import { useHousehold } from '../HouseholdContext';

// 2. Importaciones reducidas al mínimo necesario para el CRUD manual
import { INGREDIENTS_DB, getCanonicalName, COMMON_INGREDIENTS } from '../tempData';

const STANDARD_UNITS = ['ud', 'g', 'kg', 'ml', 'L', 'cuch.', 'taza', 'pizca', 'paquete'];

export const getEmojiForIngredient = (rawName) => {
  const canonical = getCanonicalName(rawName);
  const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
  if (dbKey) return INGREDIENTS_DB[dbKey].emoji;
  return '🛒';
};

const formatAmount = (amount, unit) => {
  if (!amount) return `0 ${unit}`;
  if (unit === 'g' && amount >= 1000) return `${Math.round(amount / 100) / 10} kg`;
  if (unit === 'ml' && amount >= 1000) return `${Math.round(amount / 100) / 10} L`;
  return `${Math.round(amount * 10) / 10} ${unit}`;
};

export default function PantryScreen() {
  // 🌟 CONTEXTO SÚPER LIGERO: Solo pedimos la despensa y la función para guardarla
  const { 
    isReady: contextReady,
    pantryItems, 
    updatePantry
  } = useHousehold();

  // --- ESTADOS DEL MODAL CRUD ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentItemId, setCurrentItemId] = useState(null);
  
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingMaxAmount, setIngMaxAmount] = useState('');
  const [ingUnit, setIngUnit] = useState('g');

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  const suggestions = ingName.trim().length > 0 
    ? COMMON_INGREDIENTS.filter(ing => ing.name.toLowerCase().includes(ingName.toLowerCase()))
    : [];

  // --- FUNCIONES CRUD DEL MODAL (AÑADIR / EDITAR MANUAMENTE) ---
  const handleSelectSuggestion = (suggestion) => {
    setIngName(suggestion.name);
    if (!hasManuallySelectedUnit) setIngUnit(suggestion.unit || 'g');
    setShowSuggestions(false);
  };

  const openAddModal = () => {
    setEditMode(false);
    setCurrentItemId(null);
    setIngName('');
    setIngAmount('1');
    setIngMaxAmount('');
    setIngUnit('g');
    setHasManuallySelectedUnit(false);
    setShowSuggestions(false);
    setIsModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditMode(true);
    setCurrentItemId(item.id);
    setIngName(item.name);
    setIngAmount(String(item.amount));
    setIngMaxAmount(String(item.maxAmount));
    setIngUnit(item.unit);
    setHasManuallySelectedUnit(true);
    setShowSuggestions(false);
    setIsModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!ingName.trim() || !ingAmount.trim()) return;

    const canonicalName = getCanonicalName(ingName);
    const parsedAmount = parseFloat(ingAmount) || 0;
    const parsedMax = parseFloat(ingMaxAmount) || parsedAmount; 

    let updatedPantry = [...pantryItems];

    if (editMode) {
      updatedPantry = updatedPantry.map(item => {
        if (item.id === currentItemId) {
          return { 
            ...item, 
            name: canonicalName, 
            amount: parsedAmount, 
            maxAmount: Math.max(parsedAmount, parsedMax),
            unit: ingUnit 
          };
        }
        return item;
      });
    } else {
      updatedPantry.push({
        id: `pantry-manual-${Date.now()}`,
        name: canonicalName,
        amount: parsedAmount,
        maxAmount: parsedMax,
        unit: ingUnit,
        purchaseUnit: `1 ${ingUnit}`
      });
    }

    await updatePantry(updatedPantry);
    setIsModalVisible(false);
  };

  const handleDeleteItem = async () => {
    Alert.alert("Borrar ingrediente", `¿Eliminar ${ingName} de la despensa?`, [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Eliminar", 
        style: "destructive", 
        onPress: async () => {
          const updatedPantry = pantryItems.filter(item => item.id !== currentItemId);
          await updatePantry(updatedPantry);
          setIsModalVisible(false);
        }
      }
    ]);
  };

  const handleQuickConsume = () => {
    const max = parseFloat(ingMaxAmount) || parseFloat(ingAmount);
    const consumption = max * 0.25;
    const current = parseFloat(ingAmount) || 0;
    const newAmount = Math.max(0, current - consumption);
    setIngAmount(String(Math.round(newAmount * 100) / 100));
  };

  // --- UI ---
  if (!contextReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Abriendo armarios...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>🗄️ Mi Despensa</Text>

      <TouchableOpacity style={styles.fakeSearchInput} activeOpacity={0.8} onPress={openAddModal}>
        <FontAwesome name="plus-circle" size={20} color="#2f95dc" style={{ marginRight: 10 }} />
        <Text style={styles.fakeSearchText}>Añadir ingrediente manualmente...</Text>
      </TouchableOpacity>

      {pantryItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Tu despensa está vacía.</Text>
          <Text style={styles.emptySubText}>Ve a la lista de la compra, tacha los ingredientes que has comprado y dale a finalizar para llenar esto.</Text>
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
                  onPress={() => openEditModal(ing)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardEmoji}>{emoji}</Text>
                  <Text style={[styles.cardName, { color: textColor }]} numberOfLines={2}>{ing.name}</Text>
                  <View style={[styles.cardAmountBadge, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                    <Text style={[styles.cardAmountText, { color: textColor }]}>{formatAmount(ing.amount, ing.unit)}</Text>
                  </View>
                  {ing.purchaseUnit && (
                    <Text style={[styles.purchaseUnitText, { color: textColor }]} numberOfLines={1}>({ing.purchaseUnit})</Text>
                  )}
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${displayPercentage}%`, backgroundColor: textColor }]} />
                  </View>
                  <Text style={[styles.percentageText, { color: textColor }]}>Queda {displayPercentage}%</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* MODAL DE AÑADIR / EDITAR INGREDIENTE */}
      <Modal visible={isModalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editMode ? '✏️ Editar Ingrediente' : '✨ Añadir a Despensa'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={{ padding: 4 }}>
                <FontAwesome name="times" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={{ zIndex: 10 }}>
              <Text style={styles.inputLabel}>Nombre del ingrediente</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Ej. Arroz, Leche..." 
                value={ingName} 
                onChangeText={(text) => { setIngName(text); setShowSuggestions(true); }} 
                onFocus={() => setShowSuggestions(true)} 
              />
              {showSuggestions && !editMode && suggestions.length > 0 && (
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
                <Text style={styles.inputLabel}>Queda</Text>
                <TextInput style={[styles.modalInput, { textAlign: 'center' }]} value={ingAmount} onChangeText={setIngAmount} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.inputLabel}>Capacidad Total</Text>
                <TextInput style={[styles.modalInput, { textAlign: 'center' }]} placeholder="Ej: 1000" value={ingMaxAmount} onChangeText={setIngMaxAmount} keyboardType="numeric" />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>Unidad</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
                {STANDARD_UNITS.map((u) => (
                  <TouchableOpacity key={u} style={[styles.unitChip, ingUnit === u && styles.unitChipSelected]} onPress={() => { setIngUnit(u); setHasManuallySelectedUnit(true); }}>
                    <Text style={[styles.unitChipText, ingUnit === u && styles.unitChipTextSelected]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {editMode && (
              <TouchableOpacity style={styles.quickConsumeBtn} onPress={handleQuickConsume}>
                <FontAwesome name="minus-circle" size={16} color="#d97706" style={{ marginRight: 8 }} />
                <Text style={styles.quickConsumeText}>Consumir un 25% rápido</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.confirmButton, !ingName.trim() && { opacity: 0.5 }]} onPress={handleSaveItem} disabled={!ingName.trim()}>
              <Text style={styles.confirmButtonText}>Guardar en Despensa</Text>
            </TouchableOpacity>

            {editMode && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteItem}>
                <FontAwesome name="trash" size={18} color="#ff5252" style={{ marginRight: 8 }} />
                <Text style={styles.deleteButtonText}>Eliminar por completo</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333', marginTop: 10 },
  listContainer: { paddingBottom: 80, paddingTop: 5 },
  
  fakeSearchInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  fakeSearchText: { fontSize: 16, color: '#94a3b8', flex: 1 },

  gridWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: '3.5%', rowGap: 12 },
  
  gridCard: { width: '31%', aspectRatio: 1, borderRadius: 16, borderWidth: 1, padding: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
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
  emptySubText: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 22 },

  // --- ESTILOS DEL MODAL ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  modalInput: { backgroundColor: '#f9f9f9', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee', fontSize: 16 },
  amountUnitContainer: { flexDirection: 'row', marginTop: 15, marginBottom: 15, zIndex: 1 },
  
  unitsScroll: { flexDirection: 'row', paddingVertical: 4 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f0f0f0', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  unitChipSelected: { backgroundColor: '#e6f7ff', borderColor: '#2f95dc' },
  unitChipText: { color: '#666', fontWeight: '500' },
  unitChipTextSelected: { color: '#2f95dc', fontWeight: 'bold' },

  quickConsumeBtn: { flexDirection: 'row', backgroundColor: '#fef3c7', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  quickConsumeText: { color: '#d97706', fontSize: 14, fontWeight: 'bold' },

  confirmButton: { backgroundColor: '#2f95dc', padding: 16, borderRadius: 14, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  deleteButton: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: '#ffcdd2' },
  deleteButtonText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' },

  suggestionsBox: { position: 'absolute', top: 75, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, zIndex: 20, maxHeight: 160 },
  suggestionItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionText: { fontSize: 16, color: '#333' }
});