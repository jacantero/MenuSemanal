import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. IMPORTAMOS EL HOOK DEL CONTEXTO GLOBAl (Ajusta la ruta si es necesario)
import { useHousehold } from '../HouseholdContext';

// Importaciones actualizadas (hemos quitado assignRecipeToMenu y weeklyMenu de aquí, ahora viven en el Contexto)
import { MOCK_RECIPES, getTotalEatOutCost, initAppData, consumeRecipeFromPantry, INGREDIENTS_DB, getCanonicalName, normalizeToBase } from '../tempData';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// --- OBJETIVOS Y LÍMITES DIARIOS MÁXIMOS RECOMENDADOS (OMS / IDR) ---
let kcals = 2000;
let kcal_fat = 9;
let kcal_protein = 4;
let kcal_carb = 4;
let perc_fat = 25;
let perc_fatSat = 10;
let perc_carbs = 50;
let perc_sugar = 10;
let perc_protein = 25;

const NUTRITION_LIMITS = {
  kcals: kcals,
  protein: (perc_protein * kcals / (100 * kcal_protein)),
  carbsTotal: (perc_carbs * kcals / (100 * kcal_carb)),
  fatsTotal: (perc_fat * kcals / (100 * kcal_fat)),
  sugarsMax: (perc_sugar * kcals / (100 * kcal_carb)),      // Máx 50g azúcares libres
  fatsSatMax: (perc_fatSat * kcals / (100 * kcal_fat)),     // Máx 10% de la energía diaria en saturadas
  saltMax: 5,         // Máx 5g de sal al día según la OMS
  vitC: 80,           // mg
  vitD: 15,           // mcg
  vitB1: 1.1,         // mg
  vitB2: 1.5,         // mg
  vitB3: 17,          // mg
  vitB6: 1.7,         // mg
  vitB9: 400,         // mcg
  vitB12: 2.5,        // mcg
  calcio: 950,        // mg
  fosforo: 700,       // mg
  hierro: 15,         // mg
  magnesio: 350,      // mg
  potasio: 3500,      // mg
};

export default function MenuScreen() {

  const context = useHousehold();

  // 🔍 EL "DEBUG" DEFINITIVO
  // console.log("--- CONTENIDO DEL CONTEXTO ---");
  // console.log(Object.keys(context)); // Esto te dirá qué propiedades SI existen
  // console.log(context);              // Esto te mostrará el objeto completo
  // 2. DOSIS DE MAGIA: Traemos todos los estados y funciones mágicas del contexto
  const {
    isReady,
    householdId,
    weeklyMenu: menuData,
    startNewWeek,
    createHousehold,
    joinHousehold,
    updateMenu
  } = useHousehold();

  // --- ESTADOS LOCALES (UI) ---
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isHouseholdLoading, setIsHouseholdLoading] = useState(false);
  const [supermarketCost, setSupermarketCost] = useState(0);
  const [dashboardVisible, setDashboardVisible] = useState(false);

  // Controlará cuándo initAppData() ha terminado
  const [dataLoaded, setDataLoaded] = useState(false);

  const [addMealVisible, setAddMealVisible] = useState(false);
  const [dayToAdd, setDayToAdd] = useState(null);
  const [newMealName, setNewMealName] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);

  const [selectedMeals, setSelectedMeals] = useState([]);
  const isMultiSelectMode = selectedMeals.length > 0;

  const [eatOutModalVisible, setEatOutModalVisible] = useState(false);
  const [eatOutTarget, setEatOutTarget] = useState({ day: null, mealId: null });
  const [eatOutPlace, setEatOutPlace] = useState('');
  const [eatOutCost, setEatOutCost] = useState('');

  const { pantryItems, updatePantry } = useHousehold();

  // --- NUEVOS ESTADOS PARA EL DESGLOSE DE NUTRIENTES ---
  const [isNutritionModalVisible, setIsNutritionModalVisible] = useState(false);
  const [nutritionSelectedDay, setNutritionSelectedDay] = useState('');

  useEffect(() => {
    const loadData = async () => {
      await initAppData();
      // Primera lectura rápida del presupuesto
      try {
        const savedCost = await AsyncStorage.getItem('@estimated_shopping_cost');
        if (savedCost) setSupermarketCost(parseFloat(savedCost));
      } catch (e) { console.error(e) }

      // Avisamos a React de que ya puede pintar la pantalla
      setDataLoaded(true);
    };
    loadData();
  }, []);

  const totalEatOut = getTotalEatOutCost(menuData); // ⚠️ Asegúrate de que getTotalEatOutCost en tempData acepta menuData como parámetro
  const totalWeekly = supermarketCost + totalEatOut;

  // --- LECTURA CONSTANTE AL VOLVER A LA PANTALLA ---
  useFocusEffect(
    useCallback(() => {
      const fetchCost = async () => {
        try {
          const savedCost = await AsyncStorage.getItem('@estimated_shopping_cost');
          if (savedCost) setSupermarketCost(parseFloat(savedCost));
        } catch (e) { }
      };
      fetchCost();
    }, [])
  );

  // --- FUNCIÓN PARA REINICIAR LA SEMANA ---
  const handleStartNewWeek = () => {
    Alert.alert(
      "🔄 Empezar nueva semana",
      "¿Seguro que quieres borrar el menú actual? Esto también limpiará los elementos tachados de tu lista de la compra.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, limpiar todo",
          style: "destructive",
          onPress: async () => {
            await startNewWeek(); // 👈 Llama a la función de tu Contexto
            // Opcional: Mostrar un aviso de éxito
            // Alert.alert("¡Hecho!", "El menú ha quedado en blanco para la nueva semana.");
          }
        }
      ]
    );
  };

  // --- FUNCIONES DE EMPAREJAMIENTO FIREBASE ---
  // Ahora estas funciones llaman a los métodos blindados del Contexto
  const handleCreateHousehold = async () => {
    setIsHouseholdLoading(true);
    const newCode = await createHousehold();
    setIsHouseholdLoading(false);
    if (newCode) {
      Alert.alert("¡Familia Creada!", `Tu código es: ${newCode}\nCompártelo para que se unan a tu familia.`);
    } else {
      Alert.alert("Error", "No se pudo crear el hogar. Comprueba tu conexión.");
    }
  };

  const handleJoinHousehold = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length !== 5) {
      Alert.alert("Código inválido", "El código debe tener 5 caracteres.");
      return;
    }
    setIsHouseholdLoading(true);
    const success = await joinHousehold(code);
    setIsHouseholdLoading(false);
    if (success) {
      Alert.alert("¡Éxito!", "Te has unido a la familia correctamente.");
    } else {
      Alert.alert("Error", "No se pudo verificar el código o no existe.");
    }
  };

  // --- CÁLCULO PROFUNDO DE MACROS Y MICROS PROPORCIONAL POR COMENSALES ---
  const calculateDayNutrition = (day) => {
    const dayMeals = menuData[day] || [];
    let totals = {
      kcals: 0, protein: 0, carbsTotal: 0, sugars: 0, fatsTotal: 0, fatsSat: 0, salt: 0,
      vitC: 0, vitD: 0, vitB1: 0, vitB2: 0, vitB3: 0, vitB6: 0, vitB9: 0, vitB12: 0,
      calcio: 0, fosforo: 0, hierro: 0, magnesio: 0, potasio: 0
    };

    dayMeals.forEach(meal => {
      if (meal.recipeId && meal.recipeId !== 'eat_out') {
        const recipe = MOCK_RECIPES.find(r => String(r.id) === String(meal.recipeId));
        if (recipe) {
          const actualDinersEating = 1;
          const recipeBaseDiners = recipe.baseDiners || 1;

          recipe.ingredients.forEach(ing => {
            const canonicalName = getCanonicalName(ing.name);
            const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonicalName);
            const dbItem = dbKey ? INGREDIENTS_DB[dbKey] : null;

            if (dbItem) {
              let amountForThisMeal = (ing.amount / recipeBaseDiners) * actualDinersEating;
              const normalized = normalizeToBase(amountForThisMeal, ing.unit);
              const amountIn100g = normalized.amount / 100;

              if (dbItem.macros) {
                totals.kcals += (dbItem.macros.kcals || 0) * amountIn100g;
                totals.protein += (dbItem.macros.protein || 0) * amountIn100g;
                totals.carbsTotal += (dbItem.macros.carbs?.total || 0) * amountIn100g;
                totals.sugars += (dbItem.macros.carbs?.sugars || 0) * amountIn100g;
                totals.fatsTotal += (dbItem.macros.fats?.total || 0) * amountIn100g;
                totals.fatsSat += (dbItem.macros.fats?.saturated || 0) * amountIn100g;
                totals.salt += (dbItem.macros.salt || 0) * amountIn100g;
              }
              if (dbItem.micros) {
                totals.vitC += (dbItem.micros.vitC_mg || 0) * amountIn100g;
                totals.vitD += (dbItem.micros.vitD_mcg || 0) * amountIn100g;
                totals.vitB1 += (dbItem.micros.vitB1_mg || 0) * amountIn100g;
                totals.vitB2 += (dbItem.micros.vitB2_mg || 0) * amountIn100g;
                totals.vitB3 += (dbItem.micros.vitB3_mg || 0) * amountIn100g;
                totals.vitB6 += (dbItem.micros.vitB6_mg || 0) * amountIn100g;
                totals.vitB9 += (dbItem.micros.vitB9_mcg || 0) * amountIn100g;
                totals.vitB12 += (dbItem.micros.vitB12_mcg || 0) * amountIn100g;
                totals.calcio += (dbItem.micros.calcium_mg || 0) * amountIn100g;
                totals.fosforo += (dbItem.micros.phosphorus_mg || 0) * amountIn100g;
                totals.hierro += (dbItem.micros.iron_mg || 0) * amountIn100g;
                totals.magnesio += (dbItem.micros.magnesium_mg || 0) * amountIn100g;
                totals.potasio += (dbItem.micros.potassium_mg || 0) * amountIn100g;
              }
            }
          });
        }
      }
    });

    Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k] * 10) / 10);
    return totals;
  };

  const getDayScore = (totals) => {
    if (totals.kcals === 0) return { score: 0, text: "Sin recetas planificadas", color: "#64748b" };

    if (totals.sugars > NUTRITION_LIMITS.sugarsMax || totals.fatsSat > NUTRITION_LIMITS.fatsSatMax || totals.salt > NUTRITION_LIMITS.saltMax) {
      return { score: 100, text: "⚠️ Excede límites saludables", color: "#ef4444" };
    }

    const kcalPercent = (totals.kcals / NUTRITION_LIMITS.kcals) * 100;
    if (kcalPercent < 60) return { score: kcalPercent, text: "Déficit Calórico", color: "#f59e0b" };
    if (kcalPercent <= 110) return { score: kcalPercent, text: "Menú Equilibrado", color: "#10b981" };
    return { score: kcalPercent, text: "Superávit Calórico", color: "#3b82f6" };
  };

  const currentNutritionData = useMemo(() => {
    return nutritionSelectedDay ? calculateDayNutrition(nutritionSelectedDay) : null;
  }, [nutritionSelectedDay, menuData]);

  // --- FUNCIONES DE SELECCIÓN MÚLTIPLE Y MODALES ---
  // Ahora todas las modificaciones sobre el Menú se hacen clonando `menuData` y enviándoselo a `updateMenu`

  const handleLongPressTitle = (title) => {
    const newSelection = [];
    Object.keys(menuData).forEach(d => {
      menuData[d].forEach(m => {
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

  const bulkMoveUp = async () => {
    const newMenu = JSON.parse(JSON.stringify(menuData)); // Clonación profunda para no mutar el estado directamente
    selectedMeals.forEach(key => {
      const [d, mId] = key.split('|');
      const idx = newMenu[d].findIndex(m => m.id === mId);
      if (idx > 0) [newMenu[d][idx - 1], newMenu[d][idx]] = [newMenu[d][idx], newMenu[d][idx - 1]];
    });
    await updateMenu(newMenu);
  };

  const bulkMoveDown = async () => {
    const newMenu = JSON.parse(JSON.stringify(menuData));
    selectedMeals.forEach(key => {
      const [d, mId] = key.split('|');
      const idx = newMenu[d].findIndex(m => m.id === mId);
      if (idx !== -1 && idx < newMenu[d].length - 1) {
        [newMenu[d][idx + 1], newMenu[d][idx]] = [newMenu[d][idx], newMenu[d][idx + 1]];
      }
    });
    await updateMenu(newMenu);
  };

  const bulkDelete = () => {
    Alert.alert("Borrar selección", `¿Borrar los ${selectedMeals.length} momentos seleccionados?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar", style: "destructive", onPress: async () => {
          const newMenu = JSON.parse(JSON.stringify(menuData));
          selectedMeals.forEach(key => {
            const [d, mId] = key.split('|');
            newMenu[d] = newMenu[d].filter(m => m.id !== mId);
          });
          await updateMenu(newMenu);
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
          onPress: async () => {
            const newMenu = JSON.parse(JSON.stringify(menuData));
            selectedMeals.forEach(key => {
              const [d, mId] = key.split('|');
              const meal = newMenu[d].find(m => m.id === mId);
              if (meal) { meal.recipeId = null; meal.diners = null; meal.eatOutPlace = null; meal.eatOutCost = null; }
            });
            await updateMenu(newMenu);
            setSelectedMeals([]);
          }
        }
      ]
    );
  };

  const getRecipeName = (recipeId) => {
    if (!recipeId) return null;
    if (recipeId === 'eat_out') return 'Comer fuera';
    const recipe = MOCK_RECIPES.find(r => String(r.id) === String(recipeId));
    return recipe ? recipe.name : 'Receta borrada';
  };

  const moveMealUp = async (day, index) => {
    if (index === 0) return;
    const newMenu = JSON.parse(JSON.stringify(menuData));
    const meals = newMenu[day];
    [meals[index - 1], meals[index]] = [meals[index], meals[index - 1]];
    await updateMenu(newMenu);
  };

  const moveMealDown = async (day, index) => {
    if (index === menuData[day].length - 1) return;
    const newMenu = JSON.parse(JSON.stringify(menuData));
    const meals = newMenu[day];
    [meals[index + 1], meals[index]] = [meals[index], meals[index + 1]];
    await updateMenu(newMenu);
  };

  const deleteMealSlot = (day, index, title) => {
    Alert.alert(
      "Borrar momento del día",
      `¿Quieres eliminar el hueco de "${title}" del ${day}? (Se borrará también la receta)`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            const newMenu = JSON.parse(JSON.stringify(menuData));
            newMenu[day].splice(index, 1);
            await updateMenu(newMenu);
          }
        }
      ]
    );
  };

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

  const confirmAddMeal = async (shouldAssign) => {
    if (newMealName.trim() === '' || selectedDays.length === 0) return;

    const newMenu = JSON.parse(JSON.stringify(menuData));
    const createdTargets = [];

    selectedDays.forEach((day, index) => {
      const newId = `custom_${Date.now()}_${index}`;
      const newMeal = {
        id: newId,
        title: `🍽️ ${newMealName.trim()}`,
        recipeId: null,
        diners: null
      };
      newMenu[day].push(newMeal);
      createdTargets.push(`${day}|${newId}`);
    });

    await updateMenu(newMenu);
    setAddMealVisible(false);

    if (shouldAssign) {
      router.push({
        pathname: '/recipe/select',
        params: { bulkMeals: createdTargets.join(',') }
      });
    }
  };

  const openEatOutModal = (day, mealObject) => {
    setEatOutTarget({ day, mealId: mealObject.id });
    setEatOutPlace(mealObject.eatOutPlace || '');
    setEatOutCost(mealObject.eatOutCost ? String(mealObject.eatOutCost) : '');
    setEatOutModalVisible(true);
  };

  const saveEatOutDetails = async () => {
    const costNumber = parseFloat(eatOutCost.replace(',', '.')) || null;

    const newMenu = JSON.parse(JSON.stringify(menuData));
    const meal = newMenu[eatOutTarget.day].find(m => m.id === eatOutTarget.mealId);

    if (meal) {
      meal.eatOutPlace = eatOutPlace;
      meal.eatOutCost = costNumber;
    }

    await updateMenu(newMenu);
    setEatOutModalVisible(false);
  };

  // Esta función no toca el menú, sino la despensa, por lo que asumo que tu "consumeRecipeFromPantry" 
  // ya hace el AsyncStorage.setItem correspondiente. Si la despensa se sincroniza con el Contexto,
  // aquí tendrías que llamar a la función de despensa del Contexto.
  // Asegúrate de extraer "pantryItems" y "updatePantry" del useHousehold() arriba en tu componente:
  // const { pantryItems, updatePantry } = useHousehold();

  const handleConsumeRecipe = (recipeId, plannedDiners) => {
    const recipe = MOCK_RECIPES.find(r => String(r.id) === String(recipeId));

    Alert.alert(
      "Cocinar receta",
      `¿Quieres restar de tu despensa los ingredientes necesarios para cocinar "${recipe?.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cocinar y Restar",
          onPress: async () => {
            // 1. Le pasamos la despensa actual del contexto a la función de tempData
            const { updatedPantry, success } = consumeRecipeFromPantry(pantryItems, recipe, plannedDiners);

            if (success) {
              // 2. Guardamos los nuevos datos a través del contexto global (¡Esto actualizará la UI al instante!)
              await updatePantry(updatedPantry);
              Alert.alert("¡Que aproveche! 🍽️", "Los ingredientes se han descontado de la despensa.");
            } else {
              Alert.alert("Despensa Inalterada", "No tenías ninguno de los ingredientes de esta receta registrados en tu despensa.");
            }
          }
        }
      ]
    );
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

              {assignedRecipeId === 'eat_out' ? (
                <TouchableOpacity style={styles.editDataBtn} onPress={() => openEatOutModal(day, mealObject)}>
                  <Text style={styles.editDataBtnText}>
                    {mealObject.eatOutPlace ? '✏️ Editar' : '✏️ Añadir Datos'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.consumeBtn} onPress={() => handleConsumeRecipe(assignedRecipeId, plannedDiners)}>
                  <FontAwesome name="fire" size={16} color="#e65100" style={{ marginRight: 4 }} />
                  <Text style={styles.consumeBtnText}>Cocinar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.unassignBtn} onPress={async () => {
                const newMenu = JSON.parse(JSON.stringify(menuData));
                const meal = newMenu[day].find(m => m.id === mealObject.id);
                if (meal) { meal.recipeId = null; meal.diners = null; meal.eatOutPlace = null; meal.eatOutCost = null; }
                await updateMenu(newMenu);
              }}>
                <FontAwesome name="eraser" size={18} color="#ff5252" />
              </TouchableOpacity>
            </View>

          </View>
        ) : (
          <TouchableOpacity style={styles.emptySlot} onPress={() => router.push({ pathname: '/recipe/select', params: { day, meal: mealObject.id } })}>
            <Text style={styles.emptySlotText}>+ Asignar receta</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDayCard = (day) => {
    const dayMeals = menuData[day] || [];
    const dayNutrition = calculateDayNutrition(day);
    const dayScoreInfo = getDayScore(dayNutrition);

    const barWidth = dayScoreInfo.score > 100 ? 100 : dayScoreInfo.score;

    if (!isReady) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Cargando Menú...</Text></View>;
    return (
      <View key={day} style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{day}</Text>
          <TouchableOpacity style={styles.addMealSmallBtn} onPress={() => openAddMealModal(day)}>
            <FontAwesome name="plus-circle" size={16} color="#2f95dc" />
            <Text style={styles.addMealSmallBtnText}>Añadir momento del día</Text>
          </TouchableOpacity>
        </View>

        {/* --- INDICADOR INTEGRADO INTERACTIVO --- */}
        <TouchableOpacity
          style={styles.nutritionIndicatorBar}
          activeOpacity={0.7}
          onPress={() => { setNutritionSelectedDay(day); setIsNutritionModalVisible(true); }}
        >
          <View style={styles.nutritionMetaRow}>
            <Text style={styles.nutritionMetaText}>{Math.round(dayNutrition.kcals)} / {Math.round(NUTRITION_LIMITS.kcals)} Kcal</Text>
            <Text style={[styles.nutritionStatusText, { color: dayScoreInfo.color }]}>{dayScoreInfo.text} 📊</Text>
          </View>
          <View style={styles.nutritionProgressTrack}>
            <View style={[styles.nutritionProgressBar, { width: `${barWidth || 5}%`, backgroundColor: dayScoreInfo.color }]} />
          </View>
        </TouchableOpacity>

        {dayMeals.map((mealObject, index) =>
          renderMealSlot(day, mealObject, index, dayMeals.length)
        )}
      </View>
    );
  };

  if (!isReady || !dataLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e6f7ff' }}>
        <Text style={{ fontSize: 18, color: '#2f95dc', fontWeight: 'bold' }}>Cargando tu menú...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Mi Menú Semanal</Text>
          <TouchableOpacity style={styles.miniDashboardBtn} onPress={() => setDashboardVisible(true)}>
            <Text style={styles.miniDashboardText}>💰 Gastos: {totalWeekly.toFixed(2)} €</Text>
            <FontAwesome name="chevron-right" size={12} color="#2f95dc" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0509f1',
              borderWidth: 1,
              borderColor: '#000000',
              paddingVertical: 8,       // Controla la altura interna del botón
              paddingHorizontal: 16,     // Controla el espacio a los lados del texto
              borderRadius: 20,          // Bordes redondeados estilo pastilla
              alignSelf: 'center'        // 🔥 Esto hace que el botón mida SOLO lo que mide su contenido
            }}
            onPress={handleStartNewWeek}
          >
            <FontAwesome name="refresh" size={14} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#eee4e4' }}>
              Borrar todo y empezar nueva semana
            </Text>
          </TouchableOpacity>
        </View>

        {DAYS_OF_WEEK.map(renderDayCard)}
      </ScrollView>

      {isMultiSelectMode && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity onPress={() => setSelectedMeals([])} style={styles.bulkBtn}>
            <FontAwesome name="times" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.bulkText}>{selectedMeals.length}</Text>

          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={bulkMoveUp} style={styles.bulkBtnAction}><FontAwesome name="arrow-up" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={bulkMoveDown} style={styles.bulkBtnAction}><FontAwesome name="arrow-down" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={bulkAssign} style={[styles.bulkBtnAction, { backgroundColor: '#2f95dc', borderColor: '#2f95dc' }]}><FontAwesome name="cutlery" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={bulkUnassignRecipes} style={[styles.bulkBtnAction, { backgroundColor: '#ff5252', borderColor: '#ff5252' }]}><FontAwesome name="eraser" size={16} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={bulkDelete} style={[styles.bulkBtnAction, { backgroundColor: '#ff5252', borderColor: '#ff5252' }]}><FontAwesome name="trash" size={18} color="#fff" /></TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================
          🧾 MODAL: DIAGNÓSTICO NUTRICIONAL AVANZADO
          ======================================================== */}
      <Modal visible={isNutritionModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsNutritionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeaderCloseRow}>
              <Text style={styles.modalAdvancedTitle}>📊 Balance Técnico: {nutritionSelectedDay}</Text>
              <TouchableOpacity onPress={() => setIsNutritionModalVisible(false)} style={{ padding: 4 }}><FontAwesome name="times" size={22} color="#64748b" /></TouchableOpacity>
            </View>

            {currentNutritionData && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
                {/* 1. SECCIÓN ENERGÍA Y MACROS */}
                <Text style={styles.subBlockTitle}>🍎 Energía y Macronutrientes</Text>
                <View style={styles.cardNutrientRow}>
                  <Text style={styles.nutrientName}>Calorías:</Text>
                  <Text style={styles.nutrientVal}>{currentNutritionData.kcals} / {Math.round(NUTRITION_LIMITS.kcals)} kcal</Text>
                </View>
                <View style={styles.cardNutrientRow}>
                  <Text style={styles.nutrientName}>Proteínas:</Text>
                  <Text style={styles.nutrientVal}>{currentNutritionData.protein}g / {Math.round(NUTRITION_LIMITS.protein)}g</Text>
                </View>
                <View style={styles.cardNutrientRow}>
                  <Text style={styles.nutrientName}>Carbohidratos:</Text>
                  <Text style={styles.nutrientVal}>{currentNutritionData.carbsTotal}g / {Math.round(NUTRITION_LIMITS.carbsTotal)}g</Text>
                </View>
                <View style={styles.cardNutrientRow}>
                  <Text style={styles.nutrientName}>Grasas (Totales):</Text>
                  <Text style={styles.nutrientVal}>{currentNutritionData.fatsTotal}g / {Math.round(NUTRITION_LIMITS.fatsTotal)}g</Text>
                </View>

                {/* 2. ALERTAS DE CONTROL CRÍTICO */}
                <Text style={[styles.subBlockTitle, { color: '#b91c1c', marginTop: 15 }]}>🛑 Límites Clínicos Máximos</Text>

                <View style={[styles.alertNutrientBox, currentNutritionData.sugars > NUTRITION_LIMITS.sugarsMax && styles.alertTriggered]}>
                  <Text style={styles.nutrientName}>🍬 Azúcares Libres:</Text>
                  <Text style={[styles.nutrientVal, currentNutritionData.sugars > NUTRITION_LIMITS.sugarsMax && { color: '#b91c1c', fontWeight: 'bold' }]}>
                    {currentNutritionData.sugars}g / {Math.round(NUTRITION_LIMITS.sugarsMax)}g max {currentNutritionData.sugars > NUTRITION_LIMITS.sugarsMax ? '🚨' : '✅'}
                  </Text>
                </View>

                <View style={[styles.alertNutrientBox, currentNutritionData.fatsSat > NUTRITION_LIMITS.fatsSatMax && styles.alertTriggered]}>
                  <Text style={styles.nutrientName}>🥩 Grasas Saturadas:</Text>
                  <Text style={[styles.nutrientVal, currentNutritionData.fatsSat > NUTRITION_LIMITS.fatsSatMax && { color: '#b91c1c', fontWeight: 'bold' }]}>
                    {currentNutritionData.fatsSat}g / {Math.round(NUTRITION_LIMITS.fatsSatMax)}g max {currentNutritionData.fatsSat > NUTRITION_LIMITS.fatsSatMax ? '🚨' : '✅'}
                  </Text>
                </View>

                <View style={[styles.alertNutrientBox, currentNutritionData.salt > NUTRITION_LIMITS.saltMax && styles.alertTriggered]}>
                  <Text style={styles.nutrientName}>🧂 Sal Común:</Text>
                  <Text style={[styles.nutrientVal, currentNutritionData.salt > NUTRITION_LIMITS.saltMax && { color: '#b91c1c', fontWeight: 'bold' }]}>
                    {currentNutritionData.salt}g / {NUTRITION_LIMITS.saltMax}g max {currentNutritionData.salt > NUTRITION_LIMITS.saltMax ? '🚨' : '✅'}
                  </Text>
                </View>

                {/* 3. DESGLOSE DE VITAMINAS Y MINERALES */}
                <Text style={[styles.subBlockTitle, { color: '#0369a1', marginTop: 15 }]}>🔬 Micronutrientes Esenciales</Text>

                <View style={styles.cardNutrientRow}>
                  <Text style={styles.nutrientName}>☀️ Vitamina D:</Text>
                  <Text style={styles.nutrientVal}>{currentNutritionData.vitD} mcg / {NUTRITION_LIMITS.vitD} mcg ({Math.round((currentNutritionData.vitD / NUTRITION_LIMITS.vitD) * 100)}%)</Text>
                </View>
                <View style={styles.cardNutrientRow}>
                  <Text style={styles.nutrientName}>🍊 Vitamina C:</Text>
                  <Text style={styles.nutrientVal}>{currentNutritionData.vitC} mg / {NUTRITION_LIMITS.vitC} mg ({Math.round((currentNutritionData.vitC / NUTRITION_LIMITS.vitC) * 100)}%)</Text>
                </View>

                <Text style={styles.microGroupLabel}>⚡ Complejo Vitamínico B:</Text>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>B1 (Tiamina):</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.vitB1}mg ({Math.round((currentNutritionData.vitB1 / NUTRITION_LIMITS.vitB1) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>B2 (Riboflavina):</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.vitB2}mg ({Math.round((currentNutritionData.vitB2 / NUTRITION_LIMITS.vitB2) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>B3 (Niacina):</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.vitB3}mg ({Math.round((currentNutritionData.vitB3 / NUTRITION_LIMITS.vitB3) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>B6 (Piridoxina):</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.vitB6}mg ({Math.round((currentNutritionData.vitB6 / NUTRITION_LIMITS.vitB6) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>B9 (Ácido Fólico):</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.vitB9}mcg ({Math.round((currentNutritionData.vitB9 / NUTRITION_LIMITS.vitB9) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>B12 (Cobalamina):</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.vitB12}mcg ({Math.round((currentNutritionData.vitB12 / NUTRITION_LIMITS.vitB12) * 100)}%)</Text>
                </View>

                <Text style={styles.microGroupLabel}>🪨 Minerales Clave:</Text>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>Calcio:</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.calcio}mg ({Math.round((currentNutritionData.calcio / NUTRITION_LIMITS.calcio) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>Fósforo:</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.fosforo}mg ({Math.round((currentNutritionData.fosforo / NUTRITION_LIMITS.fosforo) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>Hierro:</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.hierro}mg ({Math.round((currentNutritionData.hierro / NUTRITION_LIMITS.hierro) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>Magnesio:</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.magnesio}mg ({Math.round((currentNutritionData.magnesio / NUTRITION_LIMITS.magnesio) * 100)}%)</Text>
                </View>
                <View style={styles.microIndentRow}>
                  <Text style={styles.microIndentName}>Potasio:</Text>
                  <Text style={styles.microIndentVal}>{currentNutritionData.potasio}mg ({Math.round((currentNutritionData.potasio / NUTRITION_LIMITS.potasio) * 100)}%)</Text>
                </View>

              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseFullBtn} onPress={() => setIsNutritionModalVisible(false)}>
              <Text style={styles.modalCloseFullBtnText}>Cerrar Diagnóstico</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                <FontAwesome name="magic" size={16} color="#fff" style={{ marginRight: 10 }} />
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

      {/* MODAL DEL DASHBOARD ECONÓMICO */}
      <Modal animationType="slide" transparent={true} visible={dashboardVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>📊 Resumen de Gastos</Text>
              <TouchableOpacity onPress={() => setDashboardVisible(false)} style={{ padding: 5 }}><FontAwesome name="times" size={24} color="#888" /></TouchableOpacity>
            </View>
            <View style={styles.dashboardRow}>
              <View style={styles.dashboardItem}>
                <Text style={styles.dashboardLabel}>🛒 Súper (Estimado)</Text>
                <Text style={styles.dashboardValue}>{supermarketCost.toFixed(2)} €</Text>
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
      {/* ========================================================
          🚀 MODAL DE BIENVENIDA (PROTEGIDO CONTRA EL TECLADO)
          ======================================================== */}
      <Modal visible={isReady && !householdId} animationType="slide" transparent={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, backgroundColor: '#2f95dc', justifyContent: 'center', padding: 20 }}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }}>
              <FontAwesome name="home" size={60} color="#2f95dc" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' }}>Bienvenido a tu Cocina</Text>
              <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 }}>
                Para sincronizar la despensa y el menú en tiempo real, necesitas crear una familia o unirte a una existente.
              </Text>

              {/* BOTÓN CREAR */}
              <TouchableOpacity
                style={{ backgroundColor: '#10b981', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 20 }}
                onPress={handleCreateHousehold}
                disabled={isHouseholdLoading}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                  {isHouseholdLoading ? 'Cargando...' : '✨ Crear Nueva Familia'}
                </Text>
              </TouchableOpacity>

              <View style={{ width: '100%', height: 1, backgroundColor: '#eee', marginVertical: 10 }} />
              <Text style={{ fontSize: 14, color: '#999', marginBottom: 15, fontWeight: 'bold' }}>O ÚNETE A UNA EXISTENTE</Text>

              {/* INPUT UNIRSE */}
              <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 18, textAlign: 'center', textTransform: 'uppercase' }}
                  placeholder="CÓDIGO"
                  maxLength={5}
                  value={joinCodeInput}
                  onChangeText={setJoinCodeInput}
                />
                <TouchableOpacity
                  style={{ backgroundColor: '#2f95dc', paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center', opacity: joinCodeInput.length === 5 ? 1 : 0.5 }}
                  onPress={handleJoinHousehold}
                  disabled={joinCodeInput.length !== 5 || isHouseholdLoading}
                >
                  <FontAwesome name="arrow-right" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
    paddingHorizontal: 8, 
    gap: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  miniDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
    paddingVertical: 8,
    paddingHorizontal: 4,
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
  dayTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
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

  // --- NUEVO: Estilos para la barra nutricional ---
  nutritionIndicatorBar: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, marginBottom: 15 },
  nutritionMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nutritionMetaText: { fontSize: 12, color: '#475569', fontWeight: '700' },
  nutritionStatusText: { fontSize: 11, fontWeight: '800' },
  nutritionProgressTrack: { height: 6, backgroundColor: '#cbd5e1', borderRadius: 3, overflow: 'hidden' },
  nutritionProgressBar: { height: '100%', borderRadius: 3 },

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

  consumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe0b2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#ffb74d'
  },
  consumeBtnText: {
    color: '#e65100',
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
    marginBottom: 5,
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

  // --- ESTILOS DEL NUEVO MODAL NUTRICIONAL ---
  modalHeaderCloseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  modalAdvancedTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  subBlockTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardNutrientRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  alertNutrientBox: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#f8fafc', marginBottom: 6 },
  alertTriggered: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' },
  nutrientName: { fontSize: 14, fontWeight: '600', color: '#475569' },
  nutrientVal: { fontSize: 14, fontWeight: '700', color: '#334155' },
  microGroupLabel: { fontSize: 13, fontWeight: 'bold', color: '#0284c7', marginTop: 10, marginBottom: 4 },
  microIndentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingLeft: 12 },
  microIndentName: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  microIndentVal: { fontSize: 13, fontWeight: '700', color: '#334155' },
  modalCloseFullBtn: { backgroundColor: '#2f95dc', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  modalCloseFullBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});