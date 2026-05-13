//Almacena los datos persistentes, incluyendo recetas, valores nutricionales y gastos
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definimos las "etiquetas" de nuestras cajas fuertes
const STORAGE_KEYS = {
  MENU: '@weekly_menu',
  RECIPES: '@my_recipes',
  METADATA: '@weekly_metadata',
};

// --- FUNCIONES PARA GUARDAR DATOS ---
//Guardamos el menu
export const saveMenuToStorage = async (menuData) => {
  try {
    const jsonValue = JSON.stringify(menuData);
    await AsyncStorage.setItem(STORAGE_KEYS.MENU, jsonValue);
  } catch (e) {
    console.error("Error guardando el menú:", e);
  }
};
//Guardamos las recetas
export const saveRecipesToStorage = async (recipesData) => {
  try {
    const jsonValue = JSON.stringify(recipesData);
    await AsyncStorage.setItem(STORAGE_KEYS.RECIPES, jsonValue);
  } catch (e) {
    console.error("Error guardando las recetas:", e);
  }
};
//Guardamos los metadatos
export const saveMetadataToStorage = async (metadata) => {
  try {
    const jsonValue = JSON.stringify(metadata);
    await AsyncStorage.setItem(STORAGE_KEYS.METADATA, jsonValue);
  } catch (e) {
    console.error("Error guardando los gastos:", e);
  }
};

// --- FUNCIONES PARA CARGAR DATOS ---

export const loadAppData = async () => {
  try {
    const menuValue = await AsyncStorage.getItem(STORAGE_KEYS.MENU);
    const recipesValue = await AsyncStorage.getItem(STORAGE_KEYS.RECIPES);
    const metadataValue = await AsyncStorage.getItem(STORAGE_KEYS.METADATA);

    return {
      // Si hay datos guardados los parseamos, si no, devolvemos null
      menu: menuValue != null ? JSON.parse(menuValue) : null,
      recipes: recipesValue != null ? JSON.parse(recipesValue) : null,
      metadata: metadataValue != null ? JSON.parse(metadataValue) : null,
    };
  } catch (e) {
    console.error("Error cargando los datos iniciales:", e);
    return { menu: null, recipes: null, metadata: null };
  }
};