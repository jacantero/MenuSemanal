import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ⚠️ IMPORTANTE: Asegúrate de importar getDoc y setDoc de Firebase
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore'; 
import { db } from './firebaseConfig'; 

export const HouseholdContext = createContext();

// Función auxiliar para generar el código
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
  const [pantryItems, setPantryItems] = useState([]);
  const [weeklyMenu, setWeeklyMenuState] = useState({});
  const [customIngredients, setCustomIngredients] = useState({});

  // 🛡️ RELOJES DE ESCUDO OFFLINE
  const localShoppingTime = useRef(0);
  const localPantryTime = useRef(0);
  const localMenuTime = useRef(0);
  const localIngredientsTime = useRef(0);

  // 🚀 INICIALIZACIÓN
  useEffect(() => {
    const initApp = async () => {
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
        const sMenu = await AsyncStorage.getItem('@weekly_menu'); // Cargamos el menú local

        if (sExtras) setExtraItems(JSON.parse(sExtras));
        if (sChecked) setCheckedItems(new Set(JSON.parse(sChecked)));
        if (sDeleted) setDeletedItems(new Set(JSON.parse(sDeleted)));
        if (sPantry) setPantryItems(JSON.parse(sPantry));
        if (sMenu) setWeeklyMenuState(JSON.parse(sMenu));

        const hId = await AsyncStorage.getItem('@household_id');
        setHouseholdId(hId);

        if (!hId) {
          setIsReady(true);
          return;
        }

        const docRef = doc(db, "households", hId);
        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();

            if ((data.shoppingUpdatedAt || 0) >= localShoppingTime.current) {
              localShoppingTime.current = data.shoppingUpdatedAt || 0;
              if (data.extras) setExtraItems(data.extras);
              if (data.checked) setCheckedItems(new Set(data.checked));
              if (data.deleted) setDeletedItems(new Set(data.deleted));
            }

            if ((data.pantryUpdatedAt || 0) >= localPantryTime.current) {
              localPantryTime.current = data.pantryUpdatedAt || 0;
              if (data.pantry) {
                setPantryItems(data.pantry);
                await AsyncStorage.setItem('@pantry_items', JSON.stringify(data.pantry));
              }
            }

            // 🛡️ ESCUDO MENÚ SEMANAL AÑADIDO
            if ((data.menuUpdatedAt || 0) >= localMenuTime.current) {
              localMenuTime.current = data.menuUpdatedAt || 0;
              if (data.weeklyMenu) {
                setWeeklyMenuState(data.weeklyMenu);
                await AsyncStorage.setItem('@weekly_menu', JSON.stringify(data.weeklyMenu));
              }
            }
          }
          setIsReady(true);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error en Contexto:", error);
        setIsReady(true);
      }
    };
    initApp();
  }, []);

  const syncModuleToFirebase = async (updates, moduleTimeKey, localTimeRef) => {
    const now = Date.now();
    localTimeRef.current = now;
    if (!householdId) return;
    try {
      const docRef = doc(db, "households", householdId);
      await updateDoc(docRef, { ...updates, [moduleTimeKey]: now });
    } catch (e) { console.log(`[Offline] Datos guardados localmente.`); }
  };

  // --- FUNCIONES MAESTRAS DE LA COMPRA Y DESPENSA ---
  const updateShopping = async (newExtras, newChecked, newDeleted) => {
    setExtraItems(newExtras);
    setCheckedItems(newChecked);
    setDeletedItems(newDeleted);
    await AsyncStorage.setItem('@shopping_extras', JSON.stringify(newExtras));
    await AsyncStorage.setItem('@shopping_checked', JSON.stringify(Array.from(newChecked)));
    await AsyncStorage.setItem('@shopping_deleted', JSON.stringify(Array.from(newDeleted)));
    await AsyncStorage.setItem('@shopping_extras_time', Date.now().toString());
    await syncModuleToFirebase({ extras: newExtras, checked: Array.from(newChecked), deleted: Array.from(newDeleted) }, 'shoppingUpdatedAt', localShoppingTime);
  };

  const updatePantry = async (newPantry) => {
    setPantryItems(newPantry);
    await AsyncStorage.setItem('@pantry_items', JSON.stringify(newPantry));
    await AsyncStorage.setItem('@pantry_items_time', Date.now().toString());
    await syncModuleToFirebase({ pantry: newPantry }, 'pantryUpdatedAt', localPantryTime);
  };

  // 🌟 --- NUEVAS FUNCIONES MAESTRAS PARA EL MENÚ Y EL HOGAR --- 🌟
  
  const updateMenu = async (newMenu) => {
    setWeeklyMenuState(newMenu);
    await AsyncStorage.setItem('@weekly_menu', JSON.stringify(newMenu));
    await AsyncStorage.setItem('@weekly_menu_time', Date.now().toString());
    await syncModuleToFirebase({ weeklyMenu: newMenu }, 'menuUpdatedAt', localMenuTime);
  };

  const createHousehold = async () => {
    const newCode = generateRandomCode();
    try {
      await setDoc(doc(db, "households", newCode), { createdAt: new Date(), supermarketCost: 0 });
      await AsyncStorage.setItem('@household_id', newCode);
      setHouseholdId(newCode);
      return newCode; // Devolvemos el código para mostrarlo en la Alerta de la pantalla
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
        return true; // Éxito
      }
      return false; // No existe
    } catch (error) {
      return false;
    }
  };

  return (
    <HouseholdContext.Provider value={{
      isReady,
      householdId, // ¡Añadido!
      extraItems, checkedItems, deletedItems, updateShopping,
      pantryItems, updatePantry,
      weeklyMenu, updateMenu, // ¡Añadido updateMenu (sustituye a setWeeklyMenuState)!
      customIngredients, setCustomIngredients,
      createHousehold, // ¡Añadido!
      joinHousehold    // ¡Añadido!
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  
  // 🛡️ ESTA LÍNEA ES CLAVE
  if (context === undefined || context === null) {
    throw new Error('¡ERROR CRÍTICO! El hook useHousehold se está llamando fuera de un HouseholdProvider. Revisa si el Provider está envolviendo correctamente este componente.');
  }
  
  return context;
};