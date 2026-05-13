import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
// --- NUEVO: Importaciones actualizadas ---
import { weeklyMenu, MOCK_RECIPES, updateEatOutDetails, assignRecipeToMenu, weeklyMetadata, updateSupermarketCost, getTotalEatOutCost, initAppData } from '../tempData';
import { FontAwesome } from '@expo/vector-icons';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function MenuScreen() {
  // --- NUEVO: ESTADO DE CARGA ---
  const [isReady, setIsReady] = useState(false);

  const [menuData, setMenuData] = useState(weeklyMenu);
  
  // --- NUEVO: ESTADOS DEL DASHBOARD ECONÓMICO ---
  const [supermarketInput, setSupermarketInput] = useState('');
  const [dashboardVisible, setDashboardVisible] = useState(false);

  // --- ESTADOS PARA AÑADIR NUEVA COMIDA ---
  const [addMealVisible, setAddMealVisible] = useState(false);
  const [dayToAdd, setDayToAdd] = useState(null);
  const [newMealName, setNewMealName] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  
  // --- ESTADOS MODO SELECCIÓN MÚLTIPLE ---
  const [selectedMeals, setSelectedMeals] = useState([]);
  const isMultiSelectMode = selectedMeals.length > 0;

  // --- ESTADOS PARA EL MODAL DE COMER FUERA ---
  const [eatOutModalVisible, setEatOutModalVisible] = useState(false);
  const [eatOutTarget, setEatOutTarget] = useState({ day: null, mealId: null });
  const [eatOutPlace, setEatOutPlace] = useState('');
  const [eatOutCost, setEatOutCost] = useState('');

  // --- NUEVO: ARRANQUE DE LA APP (Carga la memoria) ---
  useEffect(() => {
    const loadData = async () => {
      await initAppData(); // Espera a que el disco duro lea todo
      setMenuData({ ...weeklyMenu }); // Refresca los estados
      setSupermarketInput(weeklyMetadata.supermarketCost || '');
      setIsReady(true); // ¡Luz verde para pintar la pantalla!
    };
    loadData();
  }, []);

  // --- NUEVO: CÁLCULOS ECONÓMICOS ---
  const totalEatOut = getTotalEatOutCost();
  const totalSupermarket = parseFloat(supermarketInput.replace(',', '.')) || 0; 
  const totalWeekly = totalSupermarket + totalEatOut;

  // --- FUNCIONES DE SELECCIÓN MÚLTIPLE ---
  const handleLongPressTitle = (title) => {
    const newSelection = [];
    Object.keys(weeklyMenu).forEach(d => {
      weeklyMenu[d].forEach(m => {
        if (m.title === title) newSelection.push(`${d}|${m.id}`);
      });
    });
    setSelectedMeals(newSelection);
  };

  const handlePressTitle = (day, mealId) => {
    if (!isMultiSelectMode) return; 
    const key = `${day}|${mealId}`;
    setSelectedMeals(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // --- FUNCIONES DE ACCIÓN EN BLOQUE ---
  const bulkMoveUp = () => {
    selectedMeals.forEach(key => {
      const [d, mId] = key.split('|');
      const idx = weeklyMenu[d].findIndex(m => m.id === mId);
      if (idx > 0) [weeklyMenu[d][idx - 1], weeklyMenu[d][idx]] = [weeklyMenu[d][idx], weeklyMenu[d][idx - 1]];
    });
    setMenuData({ ...weeklyMenu });
  };

  const bulkMoveDown = () => {
    selectedMeals.forEach(key => {
      const [d, mId] = key.split('|');
      const idx = weeklyMenu[d].findIndex(m => m.id === mId);
      if (idx !== -1 && idx < weeklyMenu[d].length - 1) {
        [weeklyMenu[d][idx + 1], weeklyMenu[d][idx]] = [weeklyMenu[d][idx], weeklyMenu[d][idx + 1]];
      }
    });
    setMenuData({ ...weeklyMenu });
  };

  const bulkDelete = () => {
    Alert.alert("Borrar selección", `¿Borrar los ${selectedMeals.length} momentos seleccionados?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => {
          selectedMeals.forEach(key => {
            const [d, mId] = key.split('|');
            weeklyMenu[d] = weeklyMenu[d].filter(m => m.id !== mId);
          });
          setMenuData({ ...weeklyMenu });
          setSelectedMeals([]); 
        }
      }
    ]);
  };

  const bulkAssign = () => {
    router.push({
      pathname: '/recipe/select',
      params: { bulkMeals: selectedMeals.join(',') }
    });
    setSelectedMeals([]); 
  };

  const bulkUnassignRecipes = () => {
    Alert.alert(
      "Desasignar recetas",
      `¿Quieres borrar las recetas de los ${selectedMeals.length} momentos seleccionados?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Quitar todas", 
          style: "destructive", 
          onPress: () => {
            selectedMeals.forEach(key => {
              const [d, mId] = key.split('|');
              assignRecipeToMenu(d, mId, null);
            });
            setMenuData({ ...weeklyMenu });
            setSelectedMeals([]); 
          } 
        }
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (isReady) setMenuData({ ...weeklyMenu }); 
    }, [isReady])
  );

  const getRecipeName = (recipeId) => {
    if (!recipeId) return null;
    if (recipeId === 'eat_out') return 'Comer fuera'; 
    const recipe = MOCK_RECIPES.find(r => String(r.id) === String(recipeId));
    return recipe ? recipe.name : 'Receta borrada';
  };

  // --- FUNCIONES PARA REORDENAR Y BORRAR HUECOS ---
  const moveMealUp = (day, index) => {
    if (index === 0) return; 
    const meals = [...weeklyMenu[day]];
    [meals[index - 1], meals[index]] = [meals[index], meals[index - 1]]; 
    weeklyMenu[day] = meals;
    setMenuData({ ...weeklyMenu });
  };

  const moveMealDown = (day, index) => {
    if (index === weeklyMenu[day].length - 1) return; 
    const meals = [...weeklyMenu[day]];
    [meals[index + 1], meals[index]] = [meals[index], meals[index + 1]];
    weeklyMenu[day] = meals;
    setMenuData({ ...weeklyMenu });
  };

  const deleteMealSlot = (day, index, title) => {
    Alert.alert(
      "Borrar momento del día",
      `¿Quieres eliminar el hueco de "${title}" del ${day}? (Se borrará también la receta)`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", style: "destructive", 
          onPress: () => {
            weeklyMenu[day].splice(index, 1); 
            setMenuData({ ...weeklyMenu });
          }
        }
      ]
    );
  };

  // --- FUNCIONES DEL MODAL PARA AÑADIR COMIDA---
  const openAddMealModal = (day) => {
    setDayToAdd(day);
    setNewMealName('');
    setSelectedDays([day]); 
    setAddMealVisible(true);
  };

  const toggleDaySelection = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]              
    );
  };

  const confirmAddMeal = (shouldAssign) => {
    if (newMealName.trim() === '' || selectedDays.length === 0) return;
    
    const createdTargets = []; 
    
    selectedDays.forEach((day, index) => {
      const newId = `custom_${Date.now()}_${index}`;
      const newMeal = {
        id: newId,
        title: `🍽️ ${newMealName.trim()}`,
        recipeId: null,
        diners: null
      };
      weeklyMenu[day].push(newMeal);
      createdTargets.push(`${day}|${newId}`); 
    });

    setMenuData({ ...weeklyMenu });
    setAddMealVisible(false);

    if (shouldAssign) {
      router.push({ 
        pathname: '/recipe/select', 
        params: { bulkMeals: createdTargets.join(',') } 
      });
    }
  };

  // --- FUNCIONES PARA DETALLES DE COMER FUERA ---
  const openEatOutModal = (day, mealObject) => {
    setEatOutTarget({ day, mealId: mealObject.id });
    setEatOutPlace(mealObject.eatOutPlace || '');
    setEatOutCost(mealObject.eatOutCost ? String(mealObject.eatOutCost) : '');
    setEatOutModalVisible(true);
  };

  const saveEatOutDetails = () => {
    const costNumber = parseFloat(eatOutCost.replace(',', '.')) || null;
    updateEatOutDetails(eatOutTarget.day, eatOutTarget.mealId, eatOutPlace, costNumber);
    setMenuData({ ...weeklyMenu });
    setEatOutModalVisible(false);
  };

  const renderMealSlot = (day, mealObject, index, totalMeals) => {
    const assignedRecipeId = mealObject.recipeId;
    const plannedDiners = mealObject.diners;
    const recipeName = getRecipeName(assignedRecipeId);
    const isLast = index === totalMeals - 1;

    const handlePressFilled = () => {
      if (assignedRecipeId === 'eat_out') {
        openEatOutModal(day, mealObject); 
      } else {
        router.push({ pathname: `/recipe/${assignedRecipeId}`, params: { day, meal: mealObject.id, plannedDiners } });
      }
    };

    return (
      <View key={mealObject.id} style={[styles.mealSection, isLast && { marginBottom: 0 }]}>
        
        <View style={styles.mealHeader}>
          <TouchableOpacity 
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onLongPress={() => handleLongPressTitle(mealObject.title)}
            onPress={() => handlePressTitle(day, mealObject.id)}
            delayLongPress={300}
          >
            {isMultiSelectMode && (
              <FontAwesome 
                name={selectedMeals.includes(`${day}|${mealObject.id}`) ? "check-circle" : "circle-o"} 
                size={18} 
                color={selectedMeals.includes(`${day}|${mealObject.id}`) ? "#2f95dc" : "#ccc"} 
                style={{ marginRight: 8 }} 
              />
            )}
            <Text style={styles.mealTitle} numberOfLines={1}>{mealObject.title}</Text>
          </TouchableOpacity>
          
          {!isMultiSelectMode && (
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => moveMealUp(day, index, mealObject.title)} disabled={index === 0} style={[styles.controlBtn, index === 0 && { opacity: 0.2 }]}>
                <FontAwesome name="chevron-up" size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveMealDown(day, index, mealObject.title)} disabled={index === totalMeals - 1} style={[styles.controlBtn, index === totalMeals - 1 && { opacity: 0.2 }]}>
                <FontAwesome name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteMealSlot(day, index, mealObject.title)} style={styles.controlBtnTrash}>
                <FontAwesome name="trash" size={14} color="#ff5252" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {recipeName && recipeName !== 'Receta borrada' ? (
          <View style={styles.filledSlot}>
            
            <TouchableOpacity style={{ flex: 1 }} onPress={handlePressFilled}>
              <Text style={styles.filledSlotText} numberOfLines={1}>
                {assignedRecipeId === 'eat_out' 
                  ? `🍽️ ${mealObject.eatOutPlace || 'Comer fuera'} ${mealObject.eatOutCost ? `(${mealObject.eatOutCost}€)` : ''}`
                  : `🍲 ${recipeName}${plannedDiners ? ` (👥 ${plannedDiners})` : ''}`
                }
              </Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              
              {assignedRecipeId === 'eat_out' && (
                <TouchableOpacity 
                  style={styles.editDataBtn} 
                  onPress={() => openEatOutModal(day, mealObject)}
                >
                  <Text style={styles.editDataBtnText}>
                    {mealObject.eatOutPlace ? '✏️ Editar' : '✏️ Añadir Datos'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.unassignBtn} 
                onPress={() => {
                  assignRecipeToMenu(day, mealObject.id, null);
                  setMenuData({ ...weeklyMenu }); 
                }}
              >
                <FontAwesome name="eraser" size={18} color="#ff5252" />
              </TouchableOpacity>
            </View>

          </View>
        ) : (
          <TouchableOpacity 
            style={styles.emptySlot} 
            onPress={() => router.push({ pathname: '/recipe/select', params: { day, meal: mealObject.id } })}
          >
            <Text style={styles.emptySlotText}>+ Asignar receta</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDayCard = (day) => {
    const dayMeals = menuData[day] || [];

    return (
      <View key={day} style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{day}</Text>
          <TouchableOpacity 
            style={styles.addMealSmallBtn} 
            onPress={() => openAddMealModal(day)}
          >
            <FontAwesome name="plus-circle" size={16} color="#2f95dc" />
            <Text style={styles.addMealSmallBtnText}>Añadir momento del día</Text>
          </TouchableOpacity>
        </View>
        
        {dayMeals.map((mealObject, index) => 
          renderMealSlot(day, mealObject, index, dayMeals.length)
        )}
      </View>
    );
  };

  // --- NUEVO: PANTALLA DE CARGA ---
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e6f7ff' }}>
        <Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Cargando tu menú...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        
        {/* --- NUEVO: CABECERA CON CHIVATO ECONÓMICO --- */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Mi Menú Semanal</Text>
          <TouchableOpacity style={styles.miniDashboardBtn} onPress={() => setDashboardVisible(true)}>
            <Text style={styles.miniDashboardText}>💰 Gastos: {totalWeekly.toFixed(2)} €</Text>
            <FontAwesome name="chevron-right" size={12} color="#2f95dc" style={{marginLeft: 8}}/>
          </TouchableOpacity>
        </View>

        {DAYS_OF_WEEK.map(renderDayCard)}
      </ScrollView>

      {/* BARRA INFERIOR DE SELECCIÓN MÚLTIPLE */}
      {isMultiSelectMode && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity onPress={() => setSelectedMeals([])} style={styles.bulkBtn}>
            <FontAwesome name="times" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.bulkText}>{selectedMeals.length}</Text>
          
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={bulkMoveUp} style={styles.bulkBtnAction}>
              <FontAwesome name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={bulkMoveDown} style={styles.bulkBtnAction}>
              <FontAwesome name="arrow-down" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={bulkAssign} style={[styles.bulkBtnAction, { backgroundColor: '#2f95dc', borderColor: '#2f95dc' }]}>
              <FontAwesome name="cutlery" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={bulkUnassignRecipes} style={[styles.bulkBtnAction, { backgroundColor: '#ff5252', borderColor: '#ff5252' }]}>
              <FontAwesome name="eraser" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={bulkDelete} style={[styles.bulkBtnAction, { backgroundColor: '#ff5252', borderColor: '#ff5252' }]}>
              <FontAwesome name="trash" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL PARA ESCRIBIR EL NOMBRE DEL HUECO */}
      <Modal visible={addMealVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Añadir al {dayToAdd}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Desayuno, Merienda, Snack..."
              value={newMealName}
              onChangeText={setNewMealName}
              autoFocus={true}
            />

            <Text style={styles.inputLabel}>¿En qué días quieres añadirlo?</Text>
            <View style={styles.daysGrid}>
              {DAYS_OF_WEEK.map(day => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity 
                    key={day} 
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => toggleDaySelection(day)}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonsColumn}>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, (newMealName.trim() === '' || selectedDays.length === 0) && { opacity: 0.5 }]} 
                onPress={() => confirmAddMeal(true)}
                disabled={newMealName.trim() === '' || selectedDays.length === 0}
              >
                <FontAwesome name="magic" size={16} color="#fff" style={{marginRight: 10}} />
                <Text style={styles.modalConfirmText}>Añadir y elegir receta</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalSecondaryBtn, (newMealName.trim() === '' || selectedDays.length === 0) && { opacity: 0.5 }]} 
                onPress={() => confirmAddMeal(false)}
                disabled={newMealName.trim() === '' || selectedDays.length === 0}
              >
                <Text style={styles.modalSecondaryBtnText}>Solo añadir huecos vacíos</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddMealVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA DETALLES DE COMER FUERA */}
      <Modal animationType="fade" transparent={true} visible={eatOutModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Detalles de Comer Fuera</Text>
            
            <Text style={styles.inputLabel}>¿Dónde has comido/cenado?</Text>
            <TextInput 
              onChangeText={setEatOutPlace} 
              placeholder="Ej: Burger King, La Tagliatella..." 
              style={styles.modalInput} 
              value={eatOutPlace}
            />

            <Text style={styles.inputLabel}>¿Cuánto te ha costado? (€)</Text>
            <TextInput 
              keyboardType="decimal-pad" 
              onChangeText={setEatOutCost} 
              placeholder="Ej: 15.50" 
              style={styles.modalInput} 
              value={eatOutCost}
            />

            <View style={styles.modalButtonsColumn}>
              <TouchableOpacity onPress={saveEatOutDetails} style={styles.modalConfirmBtn}>
                <FontAwesome name="save" size={16} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.modalConfirmText}>Guardar detalles</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  setEatOutModalVisible(false);
                  router.push({ pathname: '/recipe/select', params: { day: eatOutTarget.day, meal: eatOutTarget.mealId } });
                }} 
              >
                <Text style={styles.modalSecondaryBtnText}>Cambiar por una receta</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEatOutModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- NUEVO: MODAL DEL DASHBOARD ECONÓMICO --- */}
      <Modal animationType="slide" transparent={true} visible={dashboardVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>📊 Resumen de Gastos</Text>
              <TouchableOpacity onPress={() => setDashboardVisible(false)} style={{ padding: 5 }}>
                <FontAwesome name="times" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.dashboardRow}>
              <View style={styles.dashboardItem}>
                <Text style={styles.dashboardLabel}>🛒 Súper</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.dashboardInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    value={supermarketInput}
                    onChangeText={(val) => {
                      setSupermarketInput(val);
                      updateSupermarketCost(val);
                    }}
                  />
                  <Text style={styles.currency}>€</Text>
                </View>
              </View>

              <View style={styles.dashboardDivider} />

              <View style={styles.dashboardItem}>
                <Text style={styles.dashboardLabel}>🍽️ Fuera</Text>
                <Text style={styles.dashboardValue}>{totalEatOut.toFixed(2)} €</Text>
              </View>
            </View>

            <View style={styles.dashboardTotal}>
              <Text style={styles.dashboardTotalLabel}>Total Semanal:</Text>
              <Text style={styles.dashboardTotalValue}>{totalWeekly.toFixed(2)} €</Text>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  // --- ESTILOS DE LA CABECERA MODIFICADOS ---
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  miniDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2f95dc'
  },
  miniDashboardText: {
    color: '#2f95dc',
    fontWeight: 'bold',
    fontSize: 14,
  },

  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#000', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  dayTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', borderBottomColor: '#eee', paddingBottom: 8 },
  mealSection: { marginBottom: 16 },
  mealTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#555' },
  emptySlot: { backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#2f95dc', borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  emptySlotText: { color: '#2f95dc', fontWeight: 'bold' },
  filledSlot: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      backgroundColor: '#e8f5e9', 
      borderWidth: 1, 
      borderColor: '#4caf50', 
      borderRadius: 8, 
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 8 
    },
    
  filledSlotText: { 
    color: '#2e7d32', 
    fontWeight: 'bold', 
    fontSize: 16,
    paddingRight: 10
  },

  editDataBtn: {
    backgroundColor: '#c8e6c9', 
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#a5d6a7'
  },
  editDataBtnText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: 'bold',
  },

  unassignBtn: {
    backgroundColor: '#c8e6c9', 
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderLeftWidth: 1,
    borderColor: '#a5d6a7',
    marginLeft: 2,
  },

  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  controlBtn: { paddingHorizontal: 12, paddingVertical: 5 },
  controlBtnTrash: { paddingHorizontal: 12, paddingVertical: 5, marginLeft: 5 },

  addMealBtn: { marginTop: 10, paddingVertical: 12, backgroundColor: '#f0f8ff', borderRadius: 8, borderWidth: 1, borderColor: '#2f95dc', borderStyle: 'dashed', alignItems: 'center' },
  addMealBtnText: { color: '#2f95dc', fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 20, width: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: '#f9f9f9' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalCancelText: { color: '#888', fontWeight: 'bold', fontSize: 16 },

  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 10, alignSelf: 'flex-start', marginLeft: 5 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25, justifyContent: 'center' },
  dayChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  dayChipSelected: { backgroundColor: '#e6f7ff', borderColor: '#2f95dc' },
  dayChipText: { color: '#666', fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: '#2f95dc', fontWeight: 'bold' },

  modalButtonsColumn: {
    width: '100%',
    gap: 10,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    backgroundColor: '#2f95dc',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSecondaryBtn: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2f95dc',
  },
  modalSecondaryBtnText: {
    color: '#2f95dc',
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    padding: 10,
    alignItems: 'center',
  },

  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },

  addMealSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2f95dc',
  },

  addMealSmallBtnText: {
    color: '#2f95dc',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 5,
  },

  bulkActionBar: {
    position: 'absolute',
    bottom: 25,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8
  },
  bulkText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  bulkBtn: { padding: 5 },
  bulkBtnAction: { 
    width: 40, height: 40, borderRadius: 20, 
    borderWidth: 1, borderColor: '#475569', 
    justifyContent: 'center', alignItems: 'center' 
  },

  // --- NUEVOS: ESTILOS DEL MODAL DEL DASHBOARD ---
  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dashboardItem: { flex: 1, alignItems: 'center' },
  dashboardDivider: { width: 1, height: 40, backgroundColor: '#e2e8f0', marginHorizontal: 10 },
  dashboardLabel: { fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: '600' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  dashboardInput: { fontSize: 16, fontWeight: 'bold', color: '#334155', textAlign: 'right', minWidth: 50, paddingVertical: 6 },
  currency: { fontSize: 14, color: '#64748b', marginLeft: 4, fontWeight: 'bold' },
  dashboardValue: { fontSize: 18, fontWeight: 'bold', color: '#f59e0b' },
  
  dashboardTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  dashboardTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  dashboardTotalValue: { fontSize: 20, fontWeight: '900', color: '#2f95dc' },
});