import { saveMenuToStorage, saveRecipesToStorage, saveMetadataToStorage, loadAppData } from './storage';
import ingredientsData from './ingredientsDB.json'
import recipesData from './recipesDB.json'
import { doc, collection, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig'; // Ajusta la ruta si es necesario

export let MOCK_RECIPES = [...recipesData];
export let USER_CUSTOM_INGREDIENTS = {};

export const addRecipe = (newRecipe) => {
  MOCK_RECIPES.push(newRecipe);
  saveRecipesToStorage(MOCK_RECIPES); // Autoguardado
};

export const deleteRecipe = (id) => {
  const index = MOCK_RECIPES.findIndex(r => String(r.id) === String(id));
  if (index !== -1) {
    MOCK_RECIPES.splice(index, 1);
    saveRecipesToStorage(MOCK_RECIPES); // Autoguardado
  }
};

export const updateRecipe = (id, updatedData) => {
  const index = MOCK_RECIPES.findIndex(r => String(r.id) === String(id));
  if (index !== -1) {
    MOCK_RECIPES[index] = { ...updatedData, id }; 
    saveRecipesToStorage(MOCK_RECIPES); // Autoguardado
  }
};

// --- 2. MENÚ SEMANAL ---
const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export let weeklyMenu = {};

DAYS_OF_WEEK.forEach(day => {
  weeklyMenu[day] = [
    { id: 'lunch', title: '☀️ Comida', recipeId: null, diners: null },
    { id: 'dinner', title: '🌙 Cena', recipeId: null, diners: null }
  ];
});

export const assignRecipeToMenu = (day, mealId, recipeId, diners = null) => {
  if (weeklyMenu[day]) {
    const mealIndex = weeklyMenu[day].findIndex(m => m.id === mealId);
    if (mealIndex !== -1) {
      if (!recipeId) {
        weeklyMenu[day][mealIndex].recipeId = null;
        weeklyMenu[day][mealIndex].diners = null;
      } else if (recipeId === 'eat_out') {
        weeklyMenu[day][mealIndex].recipeId = 'eat_out';
        weeklyMenu[day][mealIndex].diners = 1;
      } else {
        weeklyMenu[day][mealIndex].recipeId = recipeId;
        weeklyMenu[day][mealIndex].diners = diners || 2;
      }
      saveMenuToStorage(weeklyMenu); // Autoguardado
    }
  }
};

export const updateEatOutDetails = (day, mealId, place, cost) => {
  if (weeklyMenu[day]) {
    const mealIndex = weeklyMenu[day].findIndex(m => m.id === mealId);
    if (mealIndex !== -1) {
      weeklyMenu[day][mealIndex].eatOutPlace = place;
      weeklyMenu[day][mealIndex].eatOutCost = cost;
      saveMenuToStorage(weeklyMenu); // Autoguardado
    }
  }
};

// --- 3. ECONOMÍA (Faltaba esta parte) ---
export let weeklyMetadata = {
  supermarketCost: ''
};

export const updateSupermarketCost = (cost) => {
  weeklyMetadata.supermarketCost = cost;
  saveMetadataToStorage(weeklyMetadata); // Autoguardado
};

export const getTotalEatOutCost = () => {
  let total = 0;
  Object.values(weeklyMenu).forEach(dayMeals => {
    dayMeals.forEach(meal => {
      if (meal.recipeId === 'eat_out' && meal.eatOutCost) {
        total += Number(meal.eatOutCost);
      }
    });
  });
  return total;
};


// --- 4. LISTA DE LA COMPRA ---
// 1. Exportamos la base de datos completa. 
// Esto lo usaremos en el futuro para buscar las calorías rápidamente: INGREDIENTS_DB["pollo"].macros
export const INGREDIENTS_DB = ingredientsData;

// 2. Adaptamos los datos para tu lista de la compra y buscador de recetas.
// Object.values() coge todos los ingredientes del JSON y los convierte en un Array normal.
export const COMMON_INGREDIENTS = Object.values(ingredientsData)
  .map(item => ({
    name: item.name,
    unit: item.unit
  }))
  .sort((a, b) => a.name.localeCompare(b.name)); // Y de paso, te los ordeno alfabéticamente para que quede profesional

export let EXTRA_SHOPPING_ITEMS = [];

export const addExtraItem = (name, amount, unit) => {
  EXTRA_SHOPPING_ITEMS.push({
    id: Date.now().toString(),
    name,
    amount: parseFloat(amount) || 1,
    unit: unit || 'ud'
  });
};

// --- 5. INICIALIZACIÓN (EL CEREBRO DEL ARRANQUE) ---
// --- 5. INICIALIZACIÓN (EL CEREBRO DEL ARRANQUE) ---
export const initAppData = async () => {
  // --- NUEVO: 2. Leer los ingredientes creados por el usuario ---
  try {
    const savedCustomIngs = await AsyncStorage.getItem('@custom_ingredients');
    if (savedCustomIngs) {
      USER_CUSTOM_INGREDIENTS = JSON.parse(savedCustomIngs);
      
      // Fusionamos los del usuario con los de serie en la memoria RAM
      Object.assign(INGREDIENTS_DB, USER_CUSTOM_INGREDIENTS);
      
      // También los metemos en la lista común para que el buscador predictivo los sugiera
      Object.values(USER_CUSTOM_INGREDIENTS).forEach(ing => {
        // Evitamos duplicados en las sugerencias
        if (!COMMON_INGREDIENTS.some(c => c.name === ing.name)) {
          COMMON_INGREDIENTS.push({ name: ing.name, unit: ing.unit, emoji: ing.emoji });
        }
      });
    }
  } catch (e) {
    console.log("No hay ingredientes personalizados guardados");
  }
  // -------------------------------------------------------------

  const data = await loadAppData();
  
  // 3. Menú (Se queda igual que antes)
  if (data.menu) {
    Object.keys(weeklyMenu).forEach(key => delete weeklyMenu[key]);
    Object.assign(weeklyMenu, data.menu);
  } else {
    saveMenuToStorage(weeklyMenu);
  }

  // 4. RECETAS (¡Aquí está la magia de la fusión!)
  if (data.recipes) {
    const localRecipes = [...data.recipes];

    // Buscamos las recetas del JSON que NO están guardadas en el móvil
    const newRecipesFromUpdate = recipesData.filter(jsonRec => 
      !localRecipes.some(localRec => String(localRec.id) === String(jsonRec.id))
    );

    // Si hay recetas nuevas, las inyectamos y guardamos
    if (newRecipesFromUpdate.length > 0) {
      localRecipes.push(...newRecipesFromUpdate);
      await saveRecipesToStorage(localRecipes);
      console.log(`✨ ¡Sincronizadas ${newRecipesFromUpdate.length} recetas nuevas!`);
    }

    MOCK_RECIPES.length = 0;
    MOCK_RECIPES.push(...localRecipes);
  } else {
    saveRecipesToStorage(MOCK_RECIPES);
  }

  // 5. Gastos y Metadatos (Se queda igual que antes)
  if (data.metadata) {
    weeklyMetadata.supermarketCost = data.metadata.supermarketCost || '';
  } else {
    saveMetadataToStorage(weeklyMetadata);
  }
};
// --- NUEVO: FUNCIÓN PARA CONSUMIR RECETAS DESDE EL MENÚ ---
import AsyncStorage from '@react-native-async-storage/async-storage';

export const consumeRecipeFromPantry = (pantryItems, recipe, plannedDiners) => {
  if (!recipe || !recipe.ingredients || !pantryItems || pantryItems.length === 0) {
    return { updatedPantry: pantryItems, success: false };
  }

  // 1. Clonamos la despensa para trabajar de forma segura sin mutar estados reactivos
  const updatedPantry = JSON.parse(JSON.stringify(pantryItems));
  let itemsConsumed = false;

  const currentDiners = plannedDiners || recipe.baseDiners || 1;
  const baseDiners = recipe.baseDiners || 1;

  // 2. Recorremos los ingredientes de la receta
  recipe.ingredients.forEach(ing => {
    const canonicalName = getCanonicalName(ing.name);
    const rawAmountToConsume = (ing.amount / baseDiners) * currentDiners;
    
    // 3. Pasamos lo que pide la receta a su unidad base (g, ml, ud...)
    const normalizedNeeded = normalizeToBase(rawAmountToConsume, ing.unit);

    // 4. Buscamos el ingrediente en la despensa usando su nombre canónico unificado
    const pantryMatch = updatedPantry.find(p => getCanonicalName(p.name) === canonicalName);

    if (pantryMatch) {
      // 5. Convertimos lo que hay en la despensa a unidad base para restar manzanas con manzanas
      const normalizedPantry = normalizeToBase(pantryMatch.amount, pantryMatch.unit);

      if (normalizedPantry.unit === normalizedNeeded.unit) {
        // Restamos con seguridad de no bajar de cero
        const newAmountBase = Math.max(0, normalizedPantry.amount - normalizedNeeded.amount);

        // 6. Devolvemos el valor a la unidad original que prefiere ver el usuario en su tarjeta
        if (pantryMatch.unit === 'kg' && normalizedPantry.unit === 'g') {
          pantryMatch.amount = newAmountBase / 1000;
        } else if (pantryMatch.unit === 'L' && normalizedPantry.unit === 'ml') {
          pantryMatch.amount = newAmountBase / 1000;
        } else {
          pantryMatch.amount = newAmountBase;
        }

        pantryMatch.amount = Math.round(pantryMatch.amount * 100) / 100;
        itemsConsumed = true; // Confirmamos que se ha modificado al menos un producto
      }
    }
  });

  // Devolvemos el nuevo array calculado y el indicador de éxito
  return { updatedPantry, success: itemsConsumed };
};

// ==========================================
// 🛠️ MOTOR UNIVERSAL DE CONVERSIÓN DE UNIDADES
// ==========================================

/**
 * Convierte cualquier cantidad y unidad a la métrica base de la app (gramos, mililitros o unidades).
 * Ideal para calcular macros y sumar en la lista de la compra.
 */
export const normalizeToBase = (amount, unit) => {
  if (!unit) return { amount, unit: 'ud' };
  
  const u = unit.toLowerCase().trim();
  let baseAmount = parseFloat(amount) || 0;
  let baseUnit = 'ud';

  // --- CONVERSIONES DE PESO (-> gramos) ---
  if (u === 'kg' || u === 'kilo' || u === 'kilos') {
    baseAmount *= 1000;
    baseUnit = 'g';
  } else if (u === 'g' || u === 'gr' || u === 'gramo' || u === 'gramos') {
    baseUnit = 'g';
  } 
  // --- CONVERSIONES DE VOLUMEN (-> mililitros) ---
  else if (u === 'l' || u === 'litro' || u === 'litros') {
    baseAmount *= 1000;
    baseUnit = 'ml';
  } else if (u === 'cl' || u === 'centilitro' || u === 'centilitros') {
    baseAmount *= 10;
    baseUnit = 'ml';
  } else if (u === 'ml' || u === 'mililitro' || u === 'mililitros') {
    baseUnit = 'ml';
  } 

  return { amount: baseAmount, unit: baseUnit };
};

/**
 * Lee el texto de "purchaseUnit" de la base de datos (ej. "Bandeja 500g") 
 * y devuelve de cuánto es el paquete en unidades base (500, "g").
 */
export const getPackageSize = (purchaseUnitText) => {
  if (!purchaseUnitText) return { amount: 1, unit: 'ud' };
  
  const text = purchaseUnitText.toLowerCase();
  
  // Extraemos el primer número que encontremos
  const match = text.match(/[\d.,]+/);
  let amount = match ? parseFloat(match[0].replace(',', '.')) : 1;

  // Extraemos la unidad del texto
  let unit = 'ud';
  if (text.includes('kg')) unit = 'kg';
  else if (text.includes('g') && !text.includes('kg')) unit = 'g';
  else if (text.includes(' l') || text.endsWith('l') || text.includes('litro')) unit = 'l';
  else if (text.includes('ml')) unit = 'ml';
  else if (text.includes('cl')) unit = 'cl';
  else if (text.includes('docena')) { amount = 12; unit = 'ud'; }

  // Lo pasamos por el normalizador para que nos devuelva gramos o mililitros
  return normalizeToBase(amount, unit);
};

/**
 * Calcula cuántos paquetes enteros tienes que comprar en el supermercado.
 * @param {number} requiredAmount - Cantidad total necesaria (en baseUnit, ej: 1200g)
 * @param {number} packageAmount - Cantidad que trae el paquete (en baseUnit, ej: 500g)
 */
export const calculatePurchaseLots = (requiredAmount, packageAmount) => {
  if (!packageAmount || packageAmount <= 0) return requiredAmount;
  const packagesNeeded = Math.ceil(requiredAmount / packageAmount);
  return packagesNeeded * packageAmount;
};

/**
 * Normalizador de nombres. 
 * Entradas como "Sésamo", "sesamo", "huevo" o "huevos" devolverán el nombre oficial de la BD.
 */
/**
 * Normalizador de nombres inteligente (Anti-Caníbales)
 */
export const getCanonicalName = (rawName) => {
  if (!rawName) return '';
  const cleanName = rawName.toLowerCase().trim();

  // 1. MATCH EXACTO: Como ahora tus recetas usan el nombre oficial, esto atrapa el 95%
  const exactMatch = Object.values(INGREDIENTS_DB).find(
    item => item.name.toLowerCase() === cleanName
  );
  if (exactMatch) return exactMatch.name;

  // 2. Match por la clave principal del JSON (ej: "arroz")
  if (INGREDIENTS_DB[cleanName]) return INGREDIENTS_DB[cleanName].name;

  // 3. Match quitando el plural (ej: "cebollas" -> "cebolla")
  const noPlural = cleanName.endsWith('s') ? cleanName.slice(0, -1) : cleanName;
  if (INGREDIENTS_DB[noPlural]) return INGREDIENTS_DB[noPlural].name;

  // 4. Búsqueda por PALABRA COMPLETA (Regex \b)
  // Exige que "sal" sea una palabra separada, evitando que se coma a "sal-món"
  const foundKey = Object.keys(INGREDIENTS_DB).find(key => {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    return regex.test(cleanName);
  });

  if (foundKey) return INGREDIENTS_DB[foundKey].name;

  // 5. Si no está en la BD (ej. un extra manual), lo ponemos bonito y listo
  return rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
};

/**
 * Registra un ingrediente nuevo si no existe en la base de datos.
 * Lo normaliza, lo guarda en el disco duro y lo inyecta en la RAM.
 */
/**
 * Registra un ingrediente nuevo recibiendo sus datos nutricionales.
 */
export const registerCustomIngredient = async (rawName, unit = 'g', fetchedMacros = null) => {
  const cleanName = rawName.toLowerCase().trim();
  const canonical = getCanonicalName(cleanName);
  
  const isFallbackName = canonical === rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
  const alreadyExistsInDB = Object.keys(INGREDIENTS_DB).some(k => INGREDIENTS_DB[k].name === canonical);

  if (isFallbackName && !alreadyExistsInDB) {
    const newKey = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    
    // Si la pantalla nos pasa macros, los usamos. Si no, a 0.
    const finalMacros = fetchedMacros || { kcals: 0, protein: 0, carbs: { total: 0, sugars: 0 }, fats: { total: 0, saturated: 0, monounsaturated: 0, polyunsaturated: 0 }, fiber: 0, salt: 0 };

    const newIngredient = {
      name: canonical,
      unit: unit,
      emoji: "🛒", 
      purchaseUnit: `1 ${unit}`,
      macros: finalMacros,
      micros: { calcium_mg: 0, iron_mg: 0, magnesium_mg: 0, potassium_mg: 0, zinc_mg: 0, vitE_mg: 0, vitC_mg: 0 },
      source: fetchedMacros ? "OpenFoodFacts" : "USER_CUSTOM"
    };

    INGREDIENTS_DB[newKey] = newIngredient;
    COMMON_INGREDIENTS.push({ name: canonical, unit: unit, emoji: "🛒" });
    USER_CUSTOM_INGREDIENTS[newKey] = newIngredient;

    try {
      await AsyncStorage.setItem('@custom_ingredients', JSON.stringify(USER_CUSTOM_INGREDIENTS));
    } catch (e) {
      console.error("Error guardando ingrediente personalizado", e);
    }
  }

  return canonical; 
};


/**
 * Sobreescribe los datos de un ingrediente existente.
 * Lo guarda en USER_CUSTOM_INGREDIENTS para que el cambio persista al reiniciar.
 */
export const updateIngredientDatabase = async (canonicalName, updatedData) => {
  // Buscamos su clave original, o le creamos una si hiciera falta
  const key = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonicalName) 
          || canonicalName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
  
  // 1. Lo actualizamos en la memoria RAM
  INGREDIENTS_DB[key] = updatedData;
  
  // 2. Lo metemos en la mochila de personalizaciones del usuario
  USER_CUSTOM_INGREDIENTS[key] = updatedData; 
  
  try {
    // 3. Guardamos la mochila en el disco duro
    await AsyncStorage.setItem('@custom_ingredients', JSON.stringify(USER_CUSTOM_INGREDIENTS));
  } catch (e) {
    console.error("Error guardando edición de ingrediente", e);
  }
};

// En tempData.js
export const archiveCurrentWeek = async (currentMenu, totalCost) => { // 👈 Añadimos currentMenu aquí
  try {
    const householdId = await AsyncStorage.getItem('@household_id');
    if (!householdId) {
      console.warn("🚨 No hay hogar configurado en el almacenamiento local.");
      return false;
    }

    // 1. Conseguimos los datos actuales de la compra desde Firebase
    const householdRef = doc(db, "households", householdId);
    const docSnap = await getDoc(householdRef);
    const currentData = docSnap.exists() ? docSnap.data() : {};

    // 2. Creamos el documento en la subcolección "history"
    const historyRef = collection(db, "households", householdId, "history");
    await addDoc(historyRef, {
      date: new Date().toISOString(),
      menu: currentMenu, // 👈 Ahora sí usamos el menú real que le pasamos
      shoppingExtras: currentData.extras || [],
      shoppingChecked: currentData.checked || [],
      totalCost: totalCost || 0
    });

    // // 3. Limpiamos la compra en Firebase
    // await updateDoc(householdRef, {
    //   extras: [],
    //   checked: [],
    //   deleted: []
    // });

    // 4. Limpiamos el menú (asumiendo que tu objeto se llama MOCK_RECIPES o similar, 
    // pero para Firebase lo importante es que el paso 2 ya se ha guardado en la nube).
    
    return true;
  } catch (error) {
    console.error("🚨 Error real al archivar en Firebase:", error); // Esto nos chivará el error en la terminal
    return false;
  }
};