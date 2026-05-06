import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { weeklyMenu, MOCK_RECIPES, EXTRA_SHOPPING_ITEMS, addExtraItem, COMMON_INGREDIENTS } from '../mockData';

// --- MEMORIA DE SESIÓN GLOBAL ---
// Esto sobrevive aunque cambies de pestaña, guardando lo que tachas o borras.
const checkedItemsMemory = new Set();
const deletedItemsMemory = new Set();

// --- SISTEMA DE COLORES ---
const getTagStyle = (tagText) => {
  if (tagText.includes('Extra')) return { backgroundColor: '#fff3e0', borderColor: '#ffe0b2', color: '#e65100' };

  const partes = tagText.split(' - ');
  const nombreReceta = partes.length > 1 ? partes[1] : tagText;

  let hash = 0;
  for (let i = 0; i < nombreReceta.length; i++) {
    hash = nombreReceta.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsl(${hue}, 80%, 92%)`,
    borderColor: `hsl(${hue}, 80%, 82%)`,
    color: `hsl(${hue}, 80%, 30%)`
  };
};

// --- DICCIONARIO DE EMOJIS ESTILO "BRING!" ---
const getEmojiForIngredient = (name) => {
  const n = name.toLowerCase();
  if (n.includes('leche') || n.includes('nata')) return '🥛';
  if (n.includes('tomate')) return '🍅';
  if (n.includes('queso') || n.includes('parmesano')) return '🧀';
  if (n.includes('cebolla')) return '🧅';
  if (n.includes('ajo')) return '🧄';
  if (n.includes('huevo')) return '🥚';
  if (n.includes('pan')) return '🥖';
  if (n.includes('carne') || n.includes('ternera') || n.includes('cerdo') || n.includes('guanciale')) return '🥩';
  if (n.includes('pollo') || n.includes('pavo')) return '🍗';
  if (n.includes('pescado') || n.includes('salmón') || n.includes('atún')) return '🐟';
  if (n.includes('manzana')) return '🍎';
  if (n.includes('plátano') || n.includes('banana')) return '🍌';
  if (n.includes('lechuga') || n.includes('ensalada') || n.includes('espinaca')) return '🥬';
  if (n.includes('patata')) return '🥔';
  if (n.includes('zanahoria')) return '🥕';
  if (n.includes('arroz')) return '🍚';
  if (n.includes('pasta') || n.includes('espagueti') || n.includes('macarron')) return '🍝';
  if (n.includes('aceite')) return '🫒';
  if (n.includes('agua')) return '💧';
  if (n.includes('cerveza')) return '🍺';
  if (n.includes('vino')) return '🍷';
  if (n.includes('papel')) return '🧻';
  if (n.includes('limpieza') || n.includes('jabón')) return '🧼';
  return '🛒';
};

const STANDARD_UNITS = ['ud', 'kg', 'g', 'L', 'ml', 'pack', 'bote', 'lata', 'paquete'];

export default function ShoppingScreen() {
  const [sections, setSections] = useState([]);
  const [collapsedSections, setCollapsedSections] = useState(new Set()); 
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('1'); 
  const [newItemUnit, setNewItemUnit] = useState('ud');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  const suggestions = newItemName.trim().length > 0 
    ? COMMON_INGREDIENTS.filter(ing => ing.name.toLowerCase().includes(newItemName.toLowerCase()))
    : [];

  const handleSelectSuggestion = (suggestion) => {
    setNewItemName(suggestion.name);
    if (!hasManuallySelectedUnit) setNewItemUnit(suggestion.unit);
    setShowSuggestions(false);
  };

  useFocusEffect(
    useCallback(() => {
      calculateList();
    }, [])
  );

  const calculateList = () => {
    const ingredientMap = {};

    Object.keys(weeklyMenu).forEach(day => {
      const meals = weeklyMenu[day];
      ['lunch', 'dinner'].forEach(mealType => {
        const recipeId = meals[mealType];
        if (recipeId && recipeId !== 'eat_out') {
          const recipe = MOCK_RECIPES.find(r => r.id === recipeId);
          if (recipe) {
            const shortName = recipe.name.length > 12 ? recipe.name.substring(0, 12) + '...' : recipe.name;
            const recipeLabel = `${day} (${mealType === 'lunch' ? 'Com' : 'Cen'}) - ${shortName}`;

            recipe.ingredients.forEach(ing => {
              const nameLower = ing.name.toLowerCase();
              const itemId = `menu-${nameLower}`; // <-- ID DETERMINISTA

              // Si el usuario lo borró de la lista, lo ignoramos
              if (deletedItemsMemory.has(itemId)) return; 

              if (ingredientMap[nameLower]) {
                ingredientMap[nameLower].amount += ing.amount;
                if (!ingredientMap[nameLower].recipeLabels.includes(recipeLabel)) {
                  ingredientMap[nameLower].recipeLabels.push(recipeLabel);
                }
              } else {
                ingredientMap[nameLower] = {
                  id: itemId,
                  name: ing.name, 
                  amount: ing.amount,
                  unit: ing.unit,
                  recipeLabels: [recipeLabel],
                  checked: checkedItemsMemory.has(itemId), // <-- RECUPERAMOS EL ESTADO
                  isExtra: false
                };
              }
            });
          }
        }
      });
    });

    const sectionsGroups = {};

    Object.values(ingredientMap).forEach(ing => {
      const sortedLabels = [...ing.recipeLabels].sort();
      const groupKey = sortedLabels.join('|');

      if (!sectionsGroups[groupKey]) {
        sectionsGroups[groupKey] = { labels: sortedLabels, data: [] };
      }
      sectionsGroups[groupKey].data.push(ing);
    });

    const newSections = [];

    Object.values(sectionsGroups).forEach(group => {
      let title = group.labels.length === 1 ? `🍽️ ${group.labels[0]}` : `🔄 ${group.labels.join(' + ')}`;
      newSections.push({
        title: title,
        data: [group.data] 
      });
    });

    const extrasList = EXTRA_SHOPPING_ITEMS.map(item => {
      const itemId = `extra-${item.name.toLowerCase()}`;
      return { 
        ...item, 
        id: itemId,
        checked: checkedItemsMemory.has(itemId), 
        isExtra: true, 
        recipeLabels: [] 
      };
    }).filter(item => !deletedItemsMemory.has(item.id));

    if (extrasList.length > 0) {
      newSections.push({ title: '🛒 Cosas Extra', data: [extrasList] });
    }

    setSections(newSections);
  };

  const handleAddManual = () => {
    if (newItemName.trim() && newItemAmount.trim()) {
      const finalAmount = parseFloat(newItemAmount) || 1; 
      
      // Si antes lo habíamos borrado, le quitamos la "amnesia"
      const itemId = `extra-${newItemName.trim().toLowerCase()}`;
      deletedItemsMemory.delete(itemId);

      addExtraItem(newItemName.trim(), finalAmount, newItemUnit); 
      calculateList(); 
      
      setNewItemName(''); setNewItemAmount('1'); setNewItemUnit('ud');
      setHasManuallySelectedUnit(false); setShowSuggestions(false); setIsModalVisible(false);
    }
  };

  const toggleSection = (title) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) newSet.delete(title);
      else newSet.add(title);
      return newSet;
    });
  };

  const toggleCheck = (itemId, sectionTitle) => {
    // 1. Guardamos en la memoria global
    if (checkedItemsMemory.has(itemId)) {
      checkedItemsMemory.delete(itemId);
    } else {
      checkedItemsMemory.add(itemId);
    }

    // 2. Actualizamos la vista local
    setSections(currentSections => 
      currentSections.map(section => {
        if (section.title === sectionTitle) {
          const updatedIngredients = section.data[0].map(item => item.id === itemId ? { ...item, checked: !item.checked } : item);
          return { ...section, data: [updatedIngredients] };
        }
        return section;
      })
    );
  };

  const handleDeleteItem = (itemToDelete, sectionTitle) => {
    // 1. Guardamos en la memoria de borrados
    deletedItemsMemory.add(itemToDelete.id);

    if (itemToDelete.isExtra) {
      const index = EXTRA_SHOPPING_ITEMS.findIndex(ext => ext.name === itemToDelete.name);
      if (index > -1) EXTRA_SHOPPING_ITEMS.splice(index, 1);
    }
    
    // 2. Actualizamos la vista local
    setSections(currentSections => {
      return currentSections.map(section => {
        if (section.title === sectionTitle) {
          const updatedIngredients = section.data[0].filter(i => i.id !== itemToDelete.id);
          return { ...section, data: [updatedIngredients] };
        }
        return section;
      }).filter(section => section.data[0].length > 0); 
    });
  };

  const handleClearChecked = () => {
    sections.forEach(section => {
      section.data[0].forEach(item => {
        if (item.checked) {
          deletedItemsMemory.add(item.id); // Guardamos en memoria todo lo borrado
          
          if (item.isExtra) {
            const index = EXTRA_SHOPPING_ITEMS.findIndex(ext => ext.name === item.name);
            if (index > -1) EXTRA_SHOPPING_ITEMS.splice(index, 1);
          }
        }
      });
    });

    setSections(currentSections => {
      return currentSections.map(section => ({
        ...section,
        data: [section.data[0].filter(item => !item.checked)]
      })).filter(section => section.data[0].length > 0);
    });
  };

  const renderSectionHeader = ({ section }) => {
    const isSectionComplete = section.data[0].length > 0 && section.data[0].every(item => item.checked);

    return (
      <TouchableOpacity 
        style={[styles.sectionHeader, isSectionComplete && styles.sectionHeaderComplete]} 
        onPress={() => toggleSection(section.title)} 
        activeOpacity={0.8}
      >
        <Text style={[styles.sectionTitle, isSectionComplete && styles.textStrikethrough]} numberOfLines={2}>
          {section.title}
        </Text>
        <FontAwesome 
          name={collapsedSections.has(section.title) ? "chevron-down" : "chevron-up"} 
          size={16} 
          color={isSectionComplete ? "#94a3b8" : "#555"} 
          style={{ marginLeft: 10 }} 
        />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item: sectionIngredients, section }) => {
    if (collapsedSections.has(section.title)) return null;

    const tagColors = getTagStyle(section.title); 

    return (
      <View style={styles.gridWrapper}>
        {sectionIngredients.map(ing => {
          const emoji = getEmojiForIngredient(ing.name);
          
          return (
            <TouchableOpacity 
              key={ing.id}
              style={[styles.gridCard, { backgroundColor: tagColors.backgroundColor, borderColor: tagColors.borderColor }, ing.checked && styles.gridCardChecked]} 
              onPress={() => toggleCheck(ing.id, section.title)}
              activeOpacity={0.7}
            >
              <TouchableOpacity onPress={() => handleDeleteItem(ing, section.title)} style={styles.cardDeleteBtn}>
                <FontAwesome name="times-circle" size={18} color={tagColors.color} style={{ opacity: 0.5 }} />
              </TouchableOpacity>

              <Text style={[styles.cardEmoji, ing.checked && { opacity: 0.4 }]}>{emoji}</Text>
              <Text style={[styles.cardName, { color: tagColors.color }, ing.checked && styles.textStrikethrough]} numberOfLines={2}>
                {ing.name}
              </Text>
              
              <View style={styles.cardAmountBadge}>
                <Text style={styles.cardAmountText}>{ing.amount} {ing.unit}</Text>
              </View>

              {ing.checked && (
                <View style={styles.checkOverlay}>
                  <FontAwesome name="check" size={40} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const hasCheckedItems = sections.some(s => s.data[0].some(i => i.checked));

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

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Tu carrito está vacío.</Text>
          <Text style={styles.emptySubText}>Toca arriba para añadir cosas sueltas o planifica tu Menú.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => 'section-' + index}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContainer}
          stickySectionHeadersEnabled={false}
          ListFooterComponent={
            hasCheckedItems ? (
              <TouchableOpacity style={styles.clearAllButton} onPress={handleClearChecked}>
                <FontAwesome name="trash" size={18} color="#ff5252" style={{ marginRight: 8 }} />
                <Text style={styles.clearAllText}>Borrar todo lo tachado</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333', marginTop: 10 },
  listContainer: { paddingBottom: 80 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e2e8f0', padding: 12, borderRadius: 10, marginTop: 15, marginBottom: 10 },
  sectionHeaderComplete: { backgroundColor: '#f1f5f9', opacity: 0.6 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#334155' },
  
  gridWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: '3%' },
  
  gridCard: {
    width: '31%', 
    aspectRatio: 1, 
    borderRadius: 16,
    borderWidth: 1,
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
  gridCardChecked: { opacity: 0.4, transform: [{ scale: 0.95 }] },
  
  cardEmoji: { fontSize: 32, marginBottom: 4 },
  cardName: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  textStrikethrough: { textDecorationLine: 'line-through', color: '#94a3b8' },
  
  cardAmountBadge: { backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  cardAmountText: { fontSize: 10, fontWeight: 'bold', color: '#555' },
  
  cardDeleteBtn: { position: 'absolute', top: 4, right: 4, padding: 4, zIndex: 10 },
  checkOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

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
  emptySubText: { fontSize: 16, color: '#888', textAlign: 'center' }
});