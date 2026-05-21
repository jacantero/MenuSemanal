import { saveMenuToStorage, saveRecipesToStorage, saveMetadataToStorage, loadAppData } from './storage';
import ingredientsData from './ingredientsDB.json'
import recipesData from './recipesDB.json'

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
export const initAppData = async () => {
  // NUEVO: Leer los emojis personalizados guardados
  try {
    const savedEmojis = await AsyncStorage.getItem('customEmojis');
    if (savedEmojis) {
      USER_CUSTOM_EMOJIS = JSON.parse(savedEmojis);
    }
  } catch (e) {
    console.log("No hay emojis personalizados guardados");
  }
  const data = await loadAppData();
  
  // 1. Menú (Se queda igual que antes)
  if (data.menu) {
    Object.keys(weeklyMenu).forEach(key => delete weeklyMenu[key]);
    Object.assign(weeklyMenu, data.menu);
  } else {
    saveMenuToStorage(weeklyMenu);
  }

  // 2. RECETAS (¡Aquí está la magia de la fusión!)
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

  // 3. Gastos y Metadatos (Se queda igual que antes)
  if (data.metadata) {
    weeklyMetadata.supermarketCost = data.metadata.supermarketCost || '';
  } else {
    saveMetadataToStorage(weeklyMetadata);
  }
};

// --- NUEVO: FUNCIÓN PARA CONSUMIR RECETAS DESDE EL MENÚ ---
import AsyncStorage from '@react-native-async-storage/async-storage';

export const consumeRecipeFromPantry = async (recipe, plannedDiners) => {
  if (!recipe || !recipe.ingredients) return false;

  try {
    const savedPantry = await AsyncStorage.getItem('@pantry_items');
    if (!savedPantry) return false; // Despensa vacía

    let currentPantry = JSON.parse(savedPantry);
    const currentDiners = plannedDiners || recipe.baseDiners || 1;

    let itemsConsumed = false;

    // Recorremos los ingredientes de la receta
    recipe.ingredients.forEach(ing => {
      const nameLower = ing.name.toLowerCase().trim();
      const amountToConsume = (ing.amount / (recipe.baseDiners || 1)) * currentDiners;

      // Buscamos si tenemos este ingrediente en la despensa
      const pantryIndex = currentPantry.findIndex(p => p.name.toLowerCase().trim() === nameLower);

      if (pantryIndex !== -1) {
        // Le restamos la cantidad, asegurándonos de no bajar de 0
        const newAmount = Math.max(0, currentPantry[pantryIndex].amount - amountToConsume);
        currentPantry[pantryIndex].amount = newAmount;
        itemsConsumed = true;
      }
    });

    // Guardamos la despensa actualizada
    if (itemsConsumed) {
      await AsyncStorage.setItem('@pantry_items', JSON.stringify(currentPantry));
      return true; // Devuelve true si al menos un ingrediente fue restado
    }
    return false;

  } catch (e) {
    console.error("Error consumiendo receta:", e);
    return false;
  }
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
  // --- CONVERSIONES CULINARIAS ESTÁNDAR ---
  else if (u.includes('cucharadita') || u.includes('cuch. peq')) {
    baseAmount *= 5; // 1 cucharadita = ~5g o 5ml
    baseUnit = 'g';  // Lo asumimos como peso por defecto
  } else if (u.includes('cuch')) {
    baseAmount *= 15; // 1 cucharada = ~15g o 15ml
    baseUnit = 'g';
  } else if (u.includes('taza')) {
    baseAmount *= 250; // 1 taza = ~250g o 250ml
    baseUnit = 'g';
  } else if (u.includes('docena')) {
    baseAmount *= 12;
    baseUnit = 'ud';
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