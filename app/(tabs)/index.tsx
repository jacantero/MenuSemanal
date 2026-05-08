import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { weeklyMenu, MOCK_RECIPES } from '../mockData';
import { FontAwesome } from '@expo/vector-icons';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function MenuScreen() {
  const [menuData, setMenuData] = useState(weeklyMenu);
  // --- ESTADOS PARA AÑADIR NUEVA COMIDA ---
  const [addMealVisible, setAddMealVisible] = useState(false);
  const [dayToAdd, setDayToAdd] = useState(null);
  const [newMealName, setNewMealName] = useState('');

  // NUEVO ESTADO: Guarda qué días están marcados en el modal de añadir comida
  const [selectedDays, setSelectedDays] = useState([]);
  // --- NUEVO: ESTADOS MODO SELECCIÓN MÚLTIPLE ---
  const [selectedMeals, setSelectedMeals] = useState([]); // Guardará strings como "Lunes|lunch"
  const isMultiSelectMode = selectedMeals.length > 0;

  // --- FUNCIONES DE SELECCIÓN MÚLTIPLE ---
  const handleLongPressTitle = (title) => {
    // Al mantener pulsado, buscamos TODOS los huecos de la semana que se llamen igual
    const newSelection = [];
    Object.keys(weeklyMenu).forEach(d => {
      weeklyMenu[d].forEach(m => {
        if (m.title === title) newSelection.push(`${d}|${m.id}`);
      });
    });
    setSelectedMeals(newSelection);
  };

  const handlePressTitle = (day, mealId) => {
    // Si no estamos en modo selección, no hacemos nada con el toque simple
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
    // Para que no haya saltos raros si hay dos seguidos, aplicamos el cambio normal
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
          setSelectedMeals([]); // Salimos del modo selección
        }
      }
    ]);
  };

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

  // --- FUNCIONES PARA REORDENAR Y BORRAR HUECOS ---
  const moveMealUp = (day, index) => {
    if (index === 0) return; // Si ya está arriba del todo, no hace nada
    const meals = [...weeklyMenu[day]];
    [meals[index - 1], meals[index]] = [meals[index], meals[index - 1]]; // Intercambia posiciones
    weeklyMenu[day] = meals;
    setMenuData({ ...weeklyMenu });
  };

  const moveMealDown = (day, index) => {
    if (index === weeklyMenu[day].length - 1) return; // Si ya está abajo del todo, no hace nada
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
            weeklyMenu[day].splice(index, 1); // Corta ese elemento de la lista
            setMenuData({ ...weeklyMenu });
          }
        }
      ]
    );
  };

  // --- FUNCIONES DEL MODAL ---
  const openAddMealModal = (day) => {
    setDayToAdd(day);
    setNewMealName('');
    setSelectedDays([day]); // NUEVO: Dejamos marcado por defecto el día actual
    setAddMealVisible(true);
  };

  // NUEVO: Función para marcar/desmarcar días en los botones
  const toggleDaySelection = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) // Si ya estaba, lo quitamos
        : [...prev, day]              // Si no estaba, lo añadimos
    );
  };

  const confirmAddMeal = () => {
    // Si no hay nombre o no han elegido ningún día, no hacemos nada
    if (newMealName.trim() === '' || selectedDays.length === 0) return;
    
    // NUEVO: Recorremos cada día seleccionado y le inyectamos la comida
    selectedDays.forEach((day, index) => {
      const newMeal = {
        id: `custom_${Date.now()}_${index}`, // ID único para evitar conflictos entre días
        title: `🍽️ ${newMealName.trim()}`,
        recipeId: null,
        diners: null
      };
      weeklyMenu[day].push(newMeal);
    });

    setMenuData({ ...weeklyMenu });
    setAddMealVisible(false);
  };

const renderMealSlot = (day, mealObject, index, totalMeals) => {
    // Sacamos los datos directamente del objeto
    const assignedRecipeId = mealObject.recipeId;
    const plannedDiners = mealObject.diners;
    const recipeName = getRecipeName(assignedRecipeId);
    const isLast = index === totalMeals - 1;

    const handlePressFilled = () => {
      Alert.alert(
        "Gestionar comida",
        `¿Qué quieres hacer con "${recipeName}"?`,
        [
          { 
            text: "Ver detalles / Cambiar", 
            onPress: () => {
              if (assignedRecipeId === 'eat_out') {
                router.push({ pathname: '/recipe/select', params: { day, meal: mealObject.id } });
              } else {
                router.push({ pathname: `/recipe/${assignedRecipeId}`, params: { day, meal: mealObject.id, plannedDiners } });
              }
            } 
          },
          { 
            text: "Quitar receta del menú", 
            style: "destructive",
            onPress: () => {
              assignRecipeToMenu(day, mealObject.id, null);
              setMenuData({ ...weeklyMenu }); 
            } 
          },
          { text: "Cancelar", style: "cancel" }
        ]
      );
    };

    return (
      <View key={mealObject.id} style={[styles.mealSection, isLast && { marginBottom: 0 }]}>
        
    {/* CABECERA: Título (Seleccionable) y Botones de control */}
        <View style={styles.mealHeader}>
          <TouchableOpacity 
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onLongPress={() => handleLongPressTitle(mealObject.title)}
            onPress={() => handlePressTitle(day, mealObject.id)}
            delayLongPress={300} // Tiempo que tiene que mantener pulsado (300ms)
          >
            {/* Si estamos en modo selección, mostramos un checkbox */}
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
          
          {/* Si NO estamos en modo selección, mostramos los controles individuales de siempre */}
          {!isMultiSelectMode && (
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => moveMealUp(day, index)} disabled={index === 0} style={[styles.controlBtn, index === 0 && { opacity: 0.2 }]}>
                <FontAwesome name="chevron-up" size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveMealDown(day, index)} disabled={index === totalMeals - 1} style={[styles.controlBtn, index === totalMeals - 1 && { opacity: 0.2 }]}>
                <FontAwesome name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteMealSlot(day, index)} style={styles.controlBtnTrash}>
                <FontAwesome name="trash" size={14} color="#ff5252" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* ZONA DE ASIGNACIÓN (Verde o vacía) */}
        {recipeName && recipeName !== 'Receta borrada' ? (
          <TouchableOpacity style={styles.filledSlot} onPress={handlePressFilled}>
            <Text style={styles.filledSlotText}>
              {assignedRecipeId === 'eat_out' ? '🍽️' : '🍲'} {recipeName}
              {assignedRecipeId !== 'eat_out' && plannedDiners && ` (👥 ${plannedDiners})`}
            </Text>
          </TouchableOpacity>
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
        {/* NUEVO: Cabecera del día con título y botón al lado */}
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
        
        {/* Bucle dinámico */}
        {dayMeals.map((mealObject, index) => 
          renderMealSlot(day, mealObject, index, dayMeals.length)
        )}
      </View>
    );
  };

return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Mi Menú Semanal</Text>
        {DAYS_OF_WEEK.map(renderDayCard)}
      </ScrollView>

      {/* --- NUEVO: BARRA INFERIOR DE SELECCIÓN MÚLTIPLE --- */}
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

            {/* --- NUEVA SECCIÓN DE DÍAS DENTRO DEL MODAL --- */}
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
                      {day.substring(0, 3)} {/* Muestra solo Lun, Mar, Mié... */}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* ---------------------------------------------- */}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddMealVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, newMealName.trim() === '' && { opacity: 0.5 }]} 
                onPress={confirmAddMeal}
                disabled={newMealName.trim() === ''}
              >
                <Text style={styles.modalConfirmText}>Añadir</Text>
              </TouchableOpacity>
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
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#000' },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#000', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  dayTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', borderBottomColor: '#eee', paddingBottom: 8 },
  mealSection: { marginBottom: 16 },
  mealTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#555' },
  emptySlot: { backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#2f95dc', borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  emptySlotText: { color: '#2f95dc', fontWeight: 'bold' },
  filledSlot: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4caf50', borderRadius: 8, padding: 12 },
  filledSlotText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 16 },

  // Estilos de la cabecera dinámica
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  controlBtn: { paddingHorizontal: 12, paddingVertical: 5 },
  controlBtnTrash: { paddingHorizontal: 12, paddingVertical: 5, marginLeft: 5 },

  // Estilos del Botón Añadir
  addMealBtn: { marginTop: 10, paddingVertical: 12, backgroundColor: '#f0f8ff', borderRadius: 8, borderWidth: 1, borderColor: '#2f95dc', borderStyle: 'dashed', alignItems: 'center' },
  addMealBtnText: { color: '#2f95dc', fontWeight: 'bold' },
  
  // Estilos del Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 20, width: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: '#f9f9f9' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalConfirmBtn: { flex: 1, backgroundColor: '#2f95dc', padding: 15, borderRadius: 10, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10, alignItems: 'center' },
  modalCancelText: { color: '#888', fontWeight: 'bold', fontSize: 16 },

  // Estilos de la nueva sección de selección de días en el modal
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 10, alignSelf: 'flex-start', marginLeft: 5 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25, justifyContent: 'center' },
  dayChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  dayChipSelected: { backgroundColor: '#e6f7ff', borderColor: '#2f95dc' },
  dayChipText: { color: '#666', fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: '#2f95dc', fontWeight: 'bold' },

  // 2. NUEVO: Contenedor para alinear título y botón
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },

  // 3. NUEVO: Estilo del botón pequeño
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

  // Estilos de la Barra de Selección Múltiple
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
});