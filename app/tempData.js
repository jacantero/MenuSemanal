import { saveMenuToStorage, saveRecipesToStorage, saveMetadataToStorage, loadAppData } from './storage';
import ingredientsData from './ingredientsDB.json'
import recipesData from './recipesDB.json'

export let MOCK_RECIPES = [...recipesData];

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