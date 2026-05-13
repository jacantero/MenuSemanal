import { saveMenuToStorage, saveRecipesToStorage, saveMetadataToStorage, loadAppData } from './storage';

// --- 1. RECETAS ---
export let MOCK_RECIPES = [
  {
    id: '1',
    name: 'Espaguetis a la carbonara',
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=400&q=80',
    baseDiners: 2,
    ingredients: [
      { name: 'Espaguetis', amount: 200, unit: 'g' },
      { name: 'Guanciale', amount: 100, unit: 'g' },
      { name: 'Yemas de huevo', amount: 3, unit: 'ud' },
    ],
    instructions: ['Hervir la pasta en agua con mucha sal.', 'Dorar el guanciale en una sartén sin aceite extra.', 'Mezclar las yemas con el queso pecorino y un poco de agua de cocción.', 'Unir todo fuera del fuego para que el huevo no se cuaje.']
  },
  {
    id: '2',
    name: 'Lentejas estofadas',
    imageUrl: 'https://images.unsplash.com/photo-1538220856186-0be0e085984d?auto=format&fit=crop&w=400&q=80',
    baseDiners: 4,
    ingredients: [
      { name: 'Lentejas pardinas', amount: 400, unit: 'g' },
      { name: 'Zanahoria', amount: 2, unit: 'ud' },
      { name: 'Chorizo', amount: 1, unit: 'ud' },
    ],
    instructions: ['Picar finamente las verduras.', 'Hacer un sofrito a fuego lento.', 'Añadir las lentejas, el chorizo entero y cubrir con agua fría.', 'Cocer a fuego medio durante 40-45 minutos.']
  },
];

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
export const COMMON_INGREDIENTS = [
  { name: 'Leche', unit: 'L' },
  { name: 'Huevos', unit: 'ud' },
  { name: 'Pan de molde', unit: 'paquete' },
  { name: 'Aceite de Oliva', unit: 'L' },
  { name: 'Papel higiénico', unit: 'pack' },
  { name: 'Manzanas', unit: 'kg' },
  { name: 'Plátanos', unit: 'kg' },
  { name: 'Tomate frito', unit: 'bote' },
  { name: 'Agua mineral', unit: 'garrafa' },
  { name: 'Cerveza', unit: 'lata' },
  { name: 'Sal gruesa', unit: 'kg' },
  { name: 'Azúcar', unit: 'kg' },
  { name: 'Café molido', unit: 'paquete' }
];

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
  const data = await loadAppData();
  
  if (data.menu) {
    Object.keys(weeklyMenu).forEach(key => delete weeklyMenu[key]);
    Object.assign(weeklyMenu, data.menu);
  } else {
    saveMenuToStorage(weeklyMenu);
  }

  if (data.recipes) {
    MOCK_RECIPES.length = 0; 
    MOCK_RECIPES.push(...data.recipes);
  } else {
    saveRecipesToStorage(MOCK_RECIPES);
  }

  if (data.metadata) {
    weeklyMetadata.supermarketCost = data.metadata.supermarketCost || '';
  } else {
    saveMetadataToStorage(weeklyMetadata);
  }
};