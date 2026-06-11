import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const HouseholdContext = createContext();

// Función auxiliar para generar el código de invitación
const generateRandomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

export const HouseholdProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [householdId, setHouseholdId] = useState(null);

  // 📦 ESTADOS GLOBALES
  const [extraItems, setExtraItems] = useState([]);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [deletedItems, setDeletedItems] = useState(new Set());
  const [pantryItems, setPantryItems] = useState([]); // Array de la despensa [{id, name, amount, maxAmount, unit...}]
  const [weeklyMenu, setWeeklyMenuState] = useState({});
  const [customIngredients, setCustomIngredients] = useState({});

  // 🛡️ RELOJES DE ESCUDO OFFLINE
  const localShoppingTime = useRef(0);
  const localPantryTime = useRef(0);
  const localMenuTime = useRef(0);
  const localIngredientsTime = useRef(0);

  // 🚀 INICIALIZACIÓN Y ESCUCHA EN TIEMPO REAL (FIREBASE + ASYNCSTORAGE)
  // 📦 1. EFECTO: CARGA INICIAL DE ASYNCSTORAGE (Solo al abrir la app)
  useEffect(() => {
    const initLocalData = async () => {
      try {
        const tShop = await AsyncStorage.getItem('@shopping_extras_time');
        const tPantry = await AsyncStorage.getItem('@pantry_items_time');
        const tMenu = await AsyncStorage.getItem('@weekly_menu_time');
        const tIngs = await AsyncStorage.getItem('@custom_ingredients_time');
        
        if (tShop) localShoppingTime.current = parseInt(tShop, 10);
        if (tPantry) localPantryTime.current = parseInt(tPantry, 10);
        if (tMenu) localMenuTime.current = parseInt(tMenu, 10);
        if (tIngs) localIngredientsTime.current = parseInt(tIngs, 10);

        const sExtras = await AsyncStorage.getItem('@shopping_extras');
        const sChecked = await AsyncStorage.getItem('@shopping_checked');
        const sDeleted = await AsyncStorage.getItem('@shopping_deleted');
        const sPantry = await AsyncStorage.getItem('@pantry_items');
        const sMenu = await AsyncStorage.getItem('@weekly_menu');

        if (sExtras) setExtraItems(JSON.parse(sExtras));
        if (sChecked) setCheckedItems(new Set(JSON.parse(sChecked)));
        if (sDeleted) setDeletedItems(new Set(JSON.parse(sDeleted)));
        if (sPantry) setPantryItems(JSON.parse(sPantry));

        if (sMenu) {
          setWeeklyMenuState(JSON.parse(sMenu));
        } else {
          // Estructura limpia por defecto si la app es totalmente nueva
          const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
          const freshMenuStructure = {};
          DAYS_OF_WEEK.forEach(day => {
            freshMenuStructure[day] = [
              { id: 'lunch', title: '☀️ Comida', recipeId: null, diners: null },
              { id: 'dinner', title: '🌙 Cena', recipeId: null, diners: null }
            ];
          });
          setWeeklyMenuState(freshMenuStructure);
        }

        // Leemos si ya existía una familia guardada
        const hId = await AsyncStorage.getItem('@household_id');
        setHouseholdId(hId);

        // 🛡️ Si NO hay familia, la app local ya está lista para usarse de forma individual
        if (!hId) {
          setIsReady(true);
        }
      } catch (error) {
        console.error("Error cargando local storage:", error);
        setIsReady(true);
      }
    };
    initLocalData();
  }, []);

  // 🚀 2. EFECTO: ESCUCHA DE FIREBASE EN TIEMPO REAL (Reacciona cuando cambia householdId)
  useEffect(() => {
    // Si no hay id de familia, no hay nada que escuchar en Firebase
    if (!householdId) return;

    // ⚡ DOSIS DE MAGIA: Ponemos la app temporalmente en "Cargando..." mientras 
    // se conecta a Firebase y descarga los datos reales de la nueva familia
    setIsReady(false);

    const docRef = doc(db, "households", householdId);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Sincronización Módulo Compra
        if ((data.shoppingUpdatedAt || 0) >= localShoppingTime.current) {
          localShoppingTime.current = data.shoppingUpdatedAt || 0;
          if (data.extras) setExtraItems(data.extras);
          if (data.checked) setCheckedItems(new Set(data.checked));
          if (data.deleted) setDeletedItems(new Set(data.deleted));
        }

        // Sincronización Módulo Despensa
        if ((data.pantryUpdatedAt || 0) >= localPantryTime.current) {
          localPantryTime.current = data.pantryUpdatedAt || 0;
          if (data.pantry) {
            setPantryItems(data.pantry);
            await AsyncStorage.setItem('@pantry_items', JSON.stringify(data.pantry));
          }
        }

        // Sincronización Módulo Menú Semanal
        if ((data.menuUpdatedAt || 0) >= localMenuTime.current) {
          localMenuTime.current = data.menuUpdatedAt || 0;
          if (data.weeklyMenu) {
            setWeeklyMenuState(data.weeklyMenu);
            await AsyncStorage.setItem('@weekly_menu', JSON.stringify(data.weeklyMenu));
          }
        }
      }
      
      // En cuanto los datos reales de la nube impactan en el contexto, liberamos la pantalla
      setIsReady(true);
    }, (error) => {
      console.error("Error en Firebase onSnapshot:", error);
      setIsReady(true);
    });

    // Limpiamos el escuchador antiguo si el householdId vuelve a cambiar
    return () => unsubscribe();
  }, [householdId]); // 👈 ¡ESTA ES LA CLAVE! Ejecuta este efecto cada vez que cambie el ID

  // Función genérica para empujar datos locales hacia Firebase protegiendo las versiones
  const syncModuleToFirebase = async (updates, moduleTimeKey, localTimeRef) => {
    const now = Date.now();
    localTimeRef.current = now;
    if (!householdId) return;
    try {
      const docRef = doc(db, "households", householdId);
      await updateDoc(docRef, { ...updates, [moduleTimeKey]: now });
    } catch (e) {
      console.log(`[Offline] Datos guardados localmente.`);
    }
  };

  // --- FUNCIONES MAESTRAS (MUTACIONES) ---

  const updateShopping = async (newExtras, newChecked, newDeleted) => {
    setExtraItems(newExtras);
    setCheckedItems(newChecked);
    setDeletedItems(newDeleted);
    await AsyncStorage.setItem('@shopping_extras', JSON.stringify(newExtras));
    await AsyncStorage.setItem('@shopping_checked', JSON.stringify(Array.from(newChecked)));
    await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(newDeleted)));
    await AsyncStorage.setItem('@shopping_extras_time', Date.now().toString());
    await syncModuleToFirebase({
      extras: newExtras,
      checked: Array.from(newChecked),
      deleted: Array.from(newDeleted)
    }, 'shoppingUpdatedAt', localShoppingTime);
  };

  const updatePantry = async (newPantry) => {
    setPantryItems(newPantry);
    await AsyncStorage.setItem('@pantry_items', JSON.stringify(newPantry));
    await AsyncStorage.setItem('@pantry_items_time', Date.now().toString());
    await syncModuleToFirebase({ pantry: newPantry }, 'pantryUpdatedAt', localPantryTime);
  };

  const updateMenu = async (newMenu) => {
    setWeeklyMenuState(newMenu);
    await AsyncStorage.setItem('@weekly_menu', JSON.stringify(newMenu));
    await AsyncStorage.setItem('@weekly_menu_time', Date.now().toString());
    await syncModuleToFirebase({ weeklyMenu: newMenu }, 'menuUpdatedAt', localMenuTime);
  };

  const startNewWeek = async () => {
    const now = Date.now();

    // 1. Generamos la estructura base limpia (Comida y Cena para cada día)
    const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const freshMenuStructure = {};

    DAYS_OF_WEEK.forEach(day => {
      freshMenuStructure[day] = [
        { id: 'lunch', title: '☀️ Comida', recipeId: null, diners: null },
        { id: 'dinner', title: '🌙 Cena', recipeId: null, diners: null }
      ];
    });

    // 2. Actualizamos los estados de React con la estructura limpia
    setWeeklyMenuState(freshMenuStructure);
    setDeletedItems(new Set());
    setCheckedItems(new Set());

    try {
      await AsyncStorage.setItem('@weekly_menu', JSON.stringify({}));
      await AsyncStorage.setItem('@weekly_menu_time', now.toString());
      await AsyncStorage.setItem('@shopping_deleted', JSON.stringify([]));
      await AsyncStorage.setItem('@shopping_checked', JSON.stringify([]));
      await AsyncStorage.setItem('@shopping_extras_time', now.toString());

      localMenuTime.current = now;
      localShoppingTime.current = now;

      if (!householdId) return;
      const docRef = doc(db, "households", householdId);
      await updateDoc(docRef, {
        weeklyMenu: freshMenuStructure,
        menuUpdatedAt: now,
        deleted: [],
        checked: [],
        shoppingUpdatedAt: now
      });
    } catch (e) {
      console.log(`[Offline] Nueva semana guardada localmente.`);
    }
  };

  // 🍳 FUNCIÓN MAESTRA: CONSUMIR INGREDIENTES DE UNA RECETA
  const consumeRecipeIngredients = useCallback(async (recipe, plannedDiners) => {
    if (!recipe || !recipe.ingredients || pantryItems.length === 0) return false;

    let hasIngredients = false;
    const recipeBaseDiners = recipe.baseDiners || 1;
    const diners = plannedDiners || recipeBaseDiners;

    // Clonamos el array actual de la despensa de forma segura
    const newPantry = JSON.parse(JSON.stringify(pantryItems));

    recipe.ingredients.forEach(recipeIng => {
      // Buscamos coincidencia por ID o por nombre normalizado (ignorando mayúsculas y espacios)
      const pantryIndex = newPantry.findIndex(pantryItem =>
        (pantryItem.id && recipeIng.id && pantryItem.id === recipeIng.id) ||
        (pantryItem.name.toLowerCase().trim() === recipeIng.name.toLowerCase().trim())
      );

      if (pantryIndex !== -1) {
        hasIngredients = true;
        // Escalado de porciones: (Cantidad base / Comensales base) * Comensales reales
        const amountNeeded = (recipeIng.amount / recipeBaseDiners) * diners;

        // Restamos cantidad evitando números negativos
        newPantry[pantryIndex].amount = Math.max(0, newPantry[pantryIndex].amount - amountNeeded);
      }
    });

    if (!hasIngredients) {
      return false; // Ninguno de los ingredientes de la receta estaba en la despensa
    }

    // Guardamos la despensa optimizada (Sincroniza UI, AsyncStorage y Firebase automáticamente)
    await updatePantry(newPantry);
    return true;
  }, [pantryItems]);

  // --- GESTIÓN DE CASAS/HOGARES ---

  const createHousehold = async () => {
    const newCode = generateRandomCode();
    try {
      await setDoc(doc(db, "households", newCode), { createdAt: new Date(), supermarketCost: 0 });
      await AsyncStorage.setItem('@household_id', newCode);
      setHouseholdId(newCode);
      return newCode;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const joinHousehold = async (code) => {
    try {
      const docRef = doc(db, "households", code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await AsyncStorage.setItem('@household_id', code);
        setHouseholdId(code);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  return (
    <HouseholdContext.Provider value={{
      isReady,
      householdId,
      extraItems, checkedItems, deletedItems, updateShopping,
      pantryItems, updatePantry,
      weeklyMenu, updateMenu,
      startNewWeek,
      consumeRecipeIngredients,
      customIngredients, setCustomIngredients,
      createHousehold,
      joinHousehold
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (context === undefined || context === null) {
    throw new Error('¡ERROR CRÍTICO! El hook useHousehold se está llamando fuera de un HouseholdProvider.');
  }
  return context;
};