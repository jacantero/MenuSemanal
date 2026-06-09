import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router'; 
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import { decode } from 'base-64';
import { addRecipe, MOCK_RECIPES, updateRecipe, deleteRecipe, registerCustomIngredient, COMMON_INGREDIENTS, INGREDIENTS_DB, getCanonicalName } from '../tempData'; 

const STANDARD_UNITS = ['ud', 'g', 'kg', 'ml', 'L', 'cuch.', 'taza', 'pizca', 'paquete'];
const UNSPLASH_ACCESS_KEY = "NyeS7XJO0PCjojHXrcphQ2co-C-tyt8tpWvywPdlDGQ";

export default function NewRecipeScreen() {
  const { editId } = useLocalSearchParams();
  const isEditing = !!editId;

  // --- ESTADOS PARA GESTIONAR EL MODAL DE INGREDIENTES ---
  const [isIngModalVisible, setIsIngModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // null si es nuevo, número si estamos editando
  
  // --- ESTADO PARA CONTROLAR SI AÑADIMOS/EDITAMOS 1 INGREDIENTE O GUARDAMOS RECETA ---
  const [pendingAction, setPendingAction] = useState(null); // 'ADD_SINGLE' | 'EDIT_SINGLE' | 'SAVE_RECIPE'

  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [codeToImport, setCodeToImport] = useState('');

  const [name, setName] = useState('');
  const [baseDiners, setBaseDiners] = useState('2');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState([]);
  
  // Estados de los inputs del modal de ingredientes
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingUnit, setIngUnit] = useState('g'); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  const [instructions, setInstructions] = useState([]);
  const [instructionText, setInstructionText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isImgModalVisible, setIsImgModalVisible] = useState(false);
  const [imgQuery, setImgQuery] = useState('');
  const [fetchedImages, setFetchedImages] = useState([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);

  // Estados del modal de ficha técnica
  const [pendingIngredients, setPendingIngredients] = useState([]);
  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);
  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [isFetchingNutrients, setIsFetchingNutrients] = useState(false);
  const [activeTab, setActiveTab] = useState('datos');

  const [formUnit, setFormUnit] = useState('g');
  const [formEmoji, setFormEmoji] = useState('🛒');
  const [formFormat, setFormFormat] = useState('1kg');
  const [formPrice, setFormPrice] = useState('0.00');
  const [formMacros, setFormMacros] = useState({
    kcals: '0', protein: '0', carbsTotal: '0', carbsSugars: '0', 
    fatsTotal: '0', fatsSat: '0', fatsMono: '0', fatsPoly: '0', fiber: '0', salt: '0'
  });
  const [formMicros, setFormMicros] = useState({
    calcium: '0', iron: '0', magnesium: '0', potassium: '0', zinc: '0', vitE: '0', vitC: '0'
  });

  const suggestions = ingName.trim().length > 0 
    ? COMMON_INGREDIENTS.filter(ing => ing.name.toLowerCase().includes(ingName.toLowerCase()))
    : [];

  useEffect(() => {
    if (isEditing) {
      const recipeToEdit = MOCK_RECIPES.find(r => String(r.id) === String(editId));
      if (recipeToEdit) {
        setName(recipeToEdit.name);
        setBaseDiners(String(recipeToEdit.baseDiners));
        setImageUrl(recipeToEdit.imageUrl);
        setIngredients(recipeToEdit.ingredients);
        setInstructions(recipeToEdit.instructions);
      }
    }
  }, [editId]);

  const handleDelete = () => {
    Alert.alert("¿Borrar receta?", "Esta acción no se puede deshacer. ¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => { deleteRecipe(editId); router.dismissAll(); router.replace('/'); } }
    ]);
  };

  const handleSelectSuggestion = (suggestion) => {
    setIngName(suggestion.name);
    if (!hasManuallySelectedUnit) setIngUnit(suggestion.unit || 'g');
    setShowSuggestions(false);
  };

  const pickImageFromGallery = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled) { setImageUrl(result.assets[0].uri); setIsImgModalVisible(false); }
    } catch (e) { Alert.alert("Error", "No se pudo acceder a la galería."); }
  };

  const takePhotoWithCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) { Alert.alert("Permiso denegado", "Necesitas dar permiso para usar la cámara."); return; }
      let result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled) { setImageUrl(result.assets[0].uri); setIsImgModalVisible(false); }
    } catch (e) { Alert.alert("Error", "No se pudo abrir la cámara."); }
  };

  const searchPhotosOnline = async () => {
    if (!imgQuery.trim()) return;
    setIsSearchingImages(true);
    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(imgQuery.trim())}&per_page=12&client_id=${UNSPLASH_ACCESS_KEY}`);
      const data = await response.json();
      setFetchedImages(data.results || []);
    } catch (e) { Alert.alert("Error", "No se han podido cargar las imágenes."); } 
    finally { setIsSearchingImages(false); }
  };

  const normalizeToGramsIfUnit = (name, amount, unit) => {
    if (unit.toLowerCase() === 'ud') {
      const canonical = getCanonicalName(name.trim());
      const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
      if (dbKey && INGREDIENTS_DB[dbKey].weightPerUnit) {
        return {
          name: name.trim(),
          amount: Math.round(amount * INGREDIENTS_DB[dbKey].weightPerUnit),
          unit: 'g', 
          originalUd: amount 
        };
      }
    }
    return { name: name.trim(), amount, unit, originalUd: null };
  };

  // --- LÓGICA DE GESTIÓN DEL MODAL DE INGREDIENTES ---
  const openAddIngredientModal = () => {
    setEditingIndex(null);
    setIngName('');
    setIngAmount('1');
    setIngUnit('g');
    setHasManuallySelectedUnit(false);
    setIsIngModalVisible(true);
  };

  const openEditIngredientModal = (index) => {
    const ing = ingredients[index];
    setEditingIndex(index);
    setIngName(ing.name);
    setIngAmount(ing.originalUd ? String(ing.originalUd) : String(ing.amount));
    setIngUnit(ing.originalUd ? 'ud' : ing.unit);
    setHasManuallySelectedUnit(true);
    setIsIngModalVisible(true);
  };

  const handleRemoveIngredient = (indexToRemove) => {
    setIngredients(ingredients.filter((_, index) => index !== indexToRemove));
  };

  const saveIngredientFromModal = () => {
    if (!ingName.trim()) return;
    const parsedAmount = parseFloat(ingAmount) || 1;
    const rawName = ingName.trim();
    const canonical = getCanonicalName(rawName);

    const alreadyExists = Object.keys(INGREDIENTS_DB).some(k => INGREDIENTS_DB[k].name === canonical);

    if (!alreadyExists) {
      // Ocultamos el modal de ingrediente y mostramos el de ficha técnica
      setIsIngModalVisible(false);
      setPendingAction(editingIndex !== null ? 'EDIT_SINGLE' : 'ADD_SINGLE');
      setPendingIngredients([{ name: rawName, amount: parsedAmount, unit: ingUnit.trim() }]);
      setCurrentPendingIndex(0);
      setIsRegisterModalVisible(true);
      fetchNutrientsFromAPI(rawName, ingUnit.trim());
    } else {
      // Lo añadimos o actualizamos directamente
      const newIng = normalizeToGramsIfUnit(rawName, parsedAmount, ingUnit.trim());
      
      if (editingIndex !== null) {
        const updatedIngs = [...ingredients];
        updatedIngs[editingIndex] = newIng;
        setIngredients(updatedIngs);
      } else {
        setIngredients([...ingredients, newIng]);
      }
      setIsIngModalVisible(false);
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      const response = await fetch(importUrl.trim());
      const html = await response.text();
      const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let match; let recipeData = null;
      while ((match = scriptRegex.exec(html)) !== null) {
        try {
          const json = JSON.parse(match[1]);
          const findRecipe = (obj) => {
            if (!obj) return null;
            if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) return obj;
            if (obj['@graph']) { const graphRecipe = obj['@graph'].find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))); if (graphRecipe) return graphRecipe; }
            if (Array.isArray(obj)) { const arrRecipe = obj.find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))); if (arrRecipe) return arrRecipe; }
            return null;
          };
          const found = findRecipe(json);
          if (found) { recipeData = found; break; }
        } catch (e) {}
      }
      if (recipeData) {
        if (recipeData.name) setName(recipeData.name);
        let extractedImg = '';
        if (recipeData.image) {
          if (Array.isArray(recipeData.image)) extractedImg = recipeData.image[0].url || recipeData.image[0];
          else if (typeof recipeData.image === 'string') extractedImg = recipeData.image;
          else if (recipeData.image.url) extractedImg = recipeData.image.url;
        }
        if (!extractedImg || !extractedImg.startsWith('http')) {
          const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
          if (ogMatch && ogMatch[1]) extractedImg = ogMatch[1];
        }
        setImageUrl(typeof extractedImg === 'string' && extractedImg.startsWith('http') ? extractedImg : '');
        if (recipeData.recipeYield) {
          const yieldNum = recipeData.recipeYield.toString().match(/\d+/);
          if (yieldNum) setBaseDiners(yieldNum[0]);
        }
        if (recipeData.recipeIngredient) {
          const newIngs = recipeData.recipeIngredient.map(ing => {
            const rawStr = typeof ing === 'string' ? ing.trim() : '';
            if (!rawStr) return null;
            let amount = 1; let unit = 'ud'; let parsedName = rawStr;
            const matchIng = rawStr.match(/^([\d.,\/]+)\s*(g|kg|ml|l|litros?|tazas?|cucharadas?|cucharaditas?|gramos?|paquetes?|botes?|latas?|dientes?)?\s*(de\s+)?(.*)/i);
            if (matchIng) {
              let numStr = matchIng[1].replace(',', '.');
              if (numStr.includes('/')) { const [num, den] = numStr.split('/'); if (den && parseInt(den) !== 0) amount = parseFloat(num) / parseFloat(den); } else { amount = parseFloat(numStr) || 1; }
              amount = Math.round(amount * 100) / 100;
              if (matchIng[2]) {
                unit = matchIng[2].toLowerCase();
                if (unit.startsWith('gramo')) unit = 'g'; if (unit.startsWith('litro')) unit = 'L'; if (unit.startsWith('taza')) unit = 'taza'; if (unit.startsWith('cucharada')) unit = 'cuch.'; if (unit.startsWith('cucharadita')) unit = 'cuch.'; if (unit.startsWith('diente')) unit = 'ud';
              }
              parsedName = (matchIng[4] || rawStr).trim();
            }
            parsedName = parsedName.charAt(0).toUpperCase() + parsedName.slice(1);
            return normalizeToGramsIfUnit(parsedName, amount, unit);
          }).filter(i => i !== null);
          setIngredients(newIngs);
        }
        if (recipeData.recipeInstructions) {
          const steps = recipeData.recipeInstructions.map(step => step.text ? step.text.replace(/<[^>]*>?/gm, '') : step.toString().replace(/<[^>]*>?/gm, ''));
          setInstructions(steps);
        }
        Alert.alert('¡Éxito!', 'La receta se ha extraído correctamente.');
      } else { Alert.alert('Vaya...', 'No hemos podido encontrar el formato estándar de receta en este enlace.'); }
    } catch (error) { Alert.alert('Error', 'No se ha podido leer el enlace.'); } finally { setIsImporting(false); setImportUrl(''); }
  };

  const openImportModal = () => setIsImportModalVisible(true);
  
  const handleImportRecipe = () => {
    try {
      const cleanCode = codeToImport.trim();
      if (cleanCode.startsWith("APP-RECIPE:")) {
        const base64Data = cleanCode.split(":")[1];
        const jsonString = decode(base64Data);
        const importedRecipe = JSON.parse(jsonString);
        
        addRecipe(importedRecipe);
        setIsImportModalVisible(false);
        setCodeToImport('');
        Alert.alert("¡Éxito!", `Receta "${importedRecipe.name}" importada.`);
        router.back();
      } else { Alert.alert("Error", "El código no parece ser válido."); }
    } catch (e) { Alert.alert("Error", "No se pudo descifrar la receta."); }
  };

  const handleAddInstruction = () => { if (!instructionText.trim()) return; setInstructions([...instructions, instructionText.trim()]); setInstructionText(''); };
  const handleRemoveInstruction = (indexToRemove) => setInstructions(instructions.filter((_, index) => index !== indexToRemove));

  const fetchNutrientsFromAPI = async (ingredientName, baseUnit) => {
    setIsFetchingNutrients(true);
    setActiveTab('datos'); 
    setFormUnit(baseUnit);
    setFormEmoji('🛒');
    setFormFormat(`1${baseUnit}`);
    setFormPrice('1.50');

    try {
      const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(ingredientName)}&search_simple=1&action=process&json=1&page_size=1`);
      const data = await response.json();

      if (data.products && data.products.length > 0) {
        const prod = data.products[0];
        const nut = prod.nutriments || {};
        
        setFormEmoji(prod.image_front_thumb ? '📦' : '🛒');
        setFormMacros({
          kcals: String(Math.round(nut['energy-kcal_100g'] || 0)), protein: String(Math.round((nut['proteins_100g'] || 0) * 10) / 10), carbsTotal: String(Math.round((nut['carbohydrates_100g'] || 0) * 10) / 10), carbsSugars: String(Math.round((nut['sugars_100g'] || 0) * 10) / 10), fatsTotal: String(Math.round((nut['fat_100g'] || 0) * 10) / 10), fatsSat: String(Math.round((nut['saturated-fat_100g'] || 0) * 10) / 10), fatsMono: String(Math.round((nut['monounsaturated-fat_100g'] || 0) * 10) / 10), fatsPoly: String(Math.round((nut['polyunsaturated-fat_100g'] || 0) * 10) / 10), fiber: String(Math.round((nut['fiber_100g'] || 0) * 10) / 10), salt: String(Math.round((nut['salt_100g'] || 0) * 100) / 100)
        });

        setFormMicros({
          calcium: String(nut['calcium_100g'] ? Math.round(nut['calcium_100g'] * 1000) : 0), iron: String(nut['iron_100g'] ? Math.round(nut['iron_100g'] * 1000) : 0), magnesium: String(nut['magnesium_100g'] ? Math.round(nut['magnesium_100g'] * 1000) : 0), potassium: String(nut['potassium_100g'] ? Math.round(nut['potassium_100g'] * 1000) : 0), zinc: String(nut['zinc_100g'] ? Math.round(nut['zinc_100g'] * 1000) : 0), vitE: '0', vitC: String(nut['vitamin-c_100g'] ? Math.round(nut['vitamin-c_100g'] * 1000) : 0)
        });
      } else { resetFormFields(baseUnit); }
    } catch (e) { resetFormFields(baseUnit); } finally { setIsFetchingNutrients(false); }
  };

  const resetFormFields = (bu) => {
    setFormMacros({ kcals: '0', protein: '0', carbsTotal: '0', carbsSugars: '0', fatsTotal: '0', fatsSat: '0', fatsMono: '0', fatsPoly: '0', fiber: '0', salt: '0' });
    setFormMicros({ calcium: '0', iron: '0', magnesium: '0', potassium: '0', zinc: '0', vitE: '0', vitC: '0' });
  };

  const handleSaveInit = async () => {
    if (name.trim() === '') return;
    const unknownIngs = ingredients.filter(ing => {
      const canonical = getCanonicalName(ing.name);
      return !Object.keys(INGREDIENTS_DB).some(k => INGREDIENTS_DB[k].name === canonical);
    });

    if (unknownIngs.length > 0) {
      setPendingAction('SAVE_RECIPE');
      setPendingIngredients(unknownIngs);
      setCurrentPendingIndex(0);
      setIsRegisterModalVisible(true);
      fetchNutrientsFromAPI(unknownIngs[0].name, unknownIngs[0].unit);
      return; 
    }
    executeFinalSave();
  };

  const confirmPendingIngredient = async () => {
    const currentIng = pendingIngredients[currentPendingIndex];
    if (!currentIng) {
      setIsRegisterModalVisible(false);
      return;
    }

    const advancedIngredientObject = {
      name: getCanonicalName(currentIng.name), unit: formUnit, emoji: formEmoji.trim() || '🛒', purchaseUnit: formFormat.trim() || `1 ${formUnit}`, purchasePrice: parseFloat(formPrice) || 0,
      macros: { kcals: parseFloat(formMacros.kcals) || 0, protein: parseFloat(formMacros.protein) || 0, carbs: { total: parseFloat(formMacros.carbsTotal) || 0, sugars: parseFloat(formMacros.carbsSugars) || 0 }, fats: { total: parseFloat(formMacros.fatsTotal) || 0, saturated: parseFloat(formMacros.fatsSat) || 0, monounsaturated: parseFloat(formMacros.fatsMono) || 0, polyunsaturated: parseFloat(formMacros.fatsPoly) || 0 }, fiber: parseFloat(formMacros.fiber) || 0, salt: parseFloat(formMacros.salt) || 0 },
      micros: { calcium_mg: parseFloat(formMicros.calcium) || 0, iron_mg: parseFloat(formMicros.iron) || 0, magnesium_mg: parseFloat(formMicros.magnesium) || 0, potassium_mg: parseFloat(formMicros.potassium) || 0, zinc_mg: parseFloat(formMicros.zinc) || 0, vitE_mg: parseFloat(formMicros.vitE) || 0, vitC_mg: parseFloat(formMicros.vitC) || 0 },
      source: "USER_CUSTOM"
    };

    await registerCustomIngredient(currentIng.name, formUnit, advancedIngredientObject);

    // Si estábamos editando o añadiendo UN solo ingrediente
    if (pendingAction === 'ADD_SINGLE' || pendingAction === 'EDIT_SINGLE') {
      const newIng = normalizeToGramsIfUnit(currentIng.name, currentIng.amount, currentIng.unit);
      
      if (pendingAction === 'EDIT_SINGLE' && editingIndex !== null) {
        const updatedIngs = [...ingredients];
        updatedIngs[editingIndex] = newIng;
        setIngredients(updatedIngs);
      } else {
        setIngredients(prev => [...prev, newIng]);
      }
      
      setIsRegisterModalVisible(false);
    } else {
      // Loop de guardado final de toda la receta
      if (currentPendingIndex + 1 < pendingIngredients.length) {
        setCurrentPendingIndex(prev => prev + 1);
        fetchNutrientsFromAPI(pendingIngredients[currentPendingIndex + 1].name, pendingIngredients[currentPendingIndex + 1].unit);
      } else {
        setIsRegisterModalVisible(false);
        executeFinalSave();
      }
    }
  };

  const executeFinalSave = async () => {
    setIsSaving(true);
    try {
      const processedIngredients = await Promise.all(ingredients.map(async (ing) => {
        const canonicalName = getCanonicalName(ing.name);
        let finalAmt = ing.amount || 0;
        let finalUnit = ing.unit || 'g';
        let origUd = ing.originalUd || null;

        if (finalUnit.toLowerCase() === 'ud') {
          const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonicalName);
          if (dbKey && INGREDIENTS_DB[dbKey].weightPerUnit) {
            origUd = finalAmt;
            finalAmt = Math.round(finalAmt * INGREDIENTS_DB[dbKey].weightPerUnit);
            finalUnit = 'g';
          } else {
            origUd = finalAmt;
            finalAmt = finalAmt * 100; 
            finalUnit = 'g';
          }
        }

        return { name: canonicalName, amount: finalAmt, unit: finalUnit, originalUd: origUd };
      }));

      const recipeData = { name: name.trim(), imageUrl: imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80', baseDiners: parseInt(baseDiners) || 2, ingredients: processedIngredients, instructions: instructions.length > 0 ? instructions : ['Cocinar con mucho amor.'] };
      isEditing ? updateRecipe(editId, recipeData) : addRecipe({ ...recipeData, id: `recipe-${Date.now()}` });
      router.back(); 
    } catch (e) { Alert.alert("Error", "No se pudo guardar."); } finally { setIsSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: isEditing ? 'Editar Receta' : 'Nueva Receta' }} />
        
        {!isEditing && (
          <View>
            <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1 }]}>
              <Text style={styles.sectionTitle}>🔗 Importar desde web</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="https://..." value={importUrl} onChangeText={setImportUrl} autoCapitalize="none" />
                <TouchableOpacity style={[styles.importButton, !importUrl.trim() && { opacity: 0.5 }]} onPress={handleImportUrl} disabled={!importUrl.trim() || isImporting || isSaving}>
                  {isImporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.importButtonText}>Extraer</Text>}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, marginTop: 10 }]} 
              onPress={openImportModal}
            >
              <FontAwesome name="download" size={16} color="#15803d" />
              <Text style={{ color: '#15803d', fontWeight: 'bold', marginLeft: 10 }}>Importar receta desde código</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Nombre de la receta *</Text>
          <TextInput style={styles.input} placeholder="Ej. Tortilla de patatas..." value={name} onChangeText={setName} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Comensales</Text>
              <TextInput style={[styles.input, { textAlign: 'center' }]} keyboardType="numeric" value={baseDiners} onChangeText={setBaseDiners} />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Foto de la receta</Text>
              <TouchableOpacity style={[styles.input, styles.imageSelectorButton]} onPress={() => { setIsImgModalVisible(true); if (name.trim()) setImgQuery(name.trim()); }}>
                <FontAwesome name="image" size={16} color="#2f95dc" style={{ marginRight: 8 }} />
                <Text style={{ color: imageUrl ? '#333' : '#94a3b8', fontSize: 15 }} numberOfLines={1}>
                  {imageUrl ? "✅ Imagen lista" : "📷 Elegir foto..."}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🛒 Ingredientes</Text>
          
          {ingredients.map((ing, idx) => (
            <View key={idx} style={styles.addedItemRow}>
              <Text style={[styles.addedItemText, { flex: 1 }]}>
                • {ing.originalUd ? `${ing.originalUd} uds (${ing.amount}${ing.unit})` : `${ing.amount} ${ing.unit}`} de {ing.name}
              </Text>
              <View style={styles.row}>
                {/* BOTÓN LÁPIZ PARA EDITAR */}
                <TouchableOpacity onPress={() => openEditIngredientModal(idx)} style={{ padding: 5, marginRight: 10 }}>
                  <FontAwesome name="pencil" size={18} color="#2f95dc" />
                </TouchableOpacity>
                {/* BOTÓN BASURA PARA BORRAR */}
                <TouchableOpacity onPress={() => handleRemoveIngredient(idx)} style={{ padding: 5 }}>
                  <FontAwesome name="trash" size={18} color="#ff5252" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {/* BOTÓN PARA ABRIR MODAL DE AÑADIR */}
          <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={openAddIngredientModal}>
            <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.secondaryButtonText}>Añadir ingrediente</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👨‍🍳 Pasos a seguir</Text>
          {instructions.map((step, idx) => (
            <View key={idx} style={styles.addedItemRow}>
              <Text style={[styles.addedItemText, { flex: 1 }]}>{idx + 1}. {step}</Text>
              <TouchableOpacity onPress={() => handleRemoveInstruction(idx)} style={{ marginLeft: 10 }}>
                <FontAwesome name="trash" size={18} color="#ff5252" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.addBlock}>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Ej. Cortar las patatas..." multiline numberOfLines={3} value={instructionText} onChangeText={setInstructionText} />
            <TouchableOpacity style={styles.secondaryButton} onPress={handleAddInstruction}>
              <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Añadir Paso</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveButton, (!name.trim() || isSaving) && { opacity: 0.5 }]} onPress={handleSaveInit} disabled={!name.trim() || isSaving}>
          {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Guardar Cambios' : 'Guardar Receta Definitiva'}</Text>}
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <FontAwesome name="trash" size={18} color="#ff5252" style={{ marginRight: 8 }} />
            <Text style={styles.deleteButtonText}>Eliminar Receta para siempre</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ========================================================
          🛒 MODAL DE AÑADIR/EDITAR INGREDIENTE 
          ======================================================== */}
      <Modal visible={isIngModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: 300 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>{editingIndex !== null ? '✏️ Editar Ingrediente' : '➕ Nuevo Ingrediente'}</Text>
              <TouchableOpacity onPress={() => setIsIngModalVisible(false)} style={{ padding: 4 }}>
                <FontAwesome name="times" size={24} color="#888" />
              </TouchableOpacity>
            </View>

          <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
              
            <View style={{ flex:3 }}>
              <Text style={styles.label}>¿Qué ingrediente?</Text>
              <TextInput style={styles.input} placeholder="Ej: Tomate, Harina..." value={ingName} onChangeText={(text) => { setIngName(text); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} autoFocus={true} />
              
              {showSuggestions && suggestions.length > 0 && (
                <View style={[styles.suggestionsBox, { top: 75 }]}>
                  {suggestions.map((s, idx) => (
                    <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(s)}>
                      <Text style={styles.suggestionText}>{s.name} <Text style={{ color: '#888', fontSize: 12 }}>({s.unit})</Text></Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
              <View style={{ flex: 1}}>
                <Text style={[styles.label, {textAlign: 'center'}]}>Cantidad</Text>
                <TextInput style={[styles.input, { textAlign: 'center' }]} keyboardType="numeric" value={ingAmount} onChangeText={setIngAmount} />
              </View>
          </View>
            <View>
                <Text style={styles.label}>Unidad</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
                  {STANDARD_UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.unitChip, ingUnit === u && styles.unitChipSelected]} onPress={() => { setIngUnit(u); setHasManuallySelectedUnit(true); }}>
                      <Text style={[styles.unitChipText, ingUnit === u && styles.unitChipTextSelected]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
            </View>
            <TouchableOpacity style={[styles.saveButton, !ingName.trim() && { opacity: 0.5 }]} onPress={saveIngredientFromModal} disabled={!ingName.trim()}>
              <Text style={styles.saveButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL DE FICHA TÉCNICA --- */}
      <Modal visible={isRegisterModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✨ Configurar Ficha Técnica</Text>
            {isFetchingNutrients ? (
              <View style={{ alignItems: 'center', padding: 30 }}><ActivityIndicator size="large" color="#2f95dc" /><Text style={{ marginTop: 15, color: '#64748b' }}>Consultando OpenFoodFacts...</Text></View>
            ) : (
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.modalSubtitle}>Ingrediente: {pendingIngredients[currentPendingIndex]?.name}</Text>
                <View style={styles.tabContainer}>
                  <TouchableOpacity style={[styles.tabButton, activeTab === 'datos' && styles.tabActive]} onPress={() => setActiveTab('datos')}><Text style={[styles.tabText, activeTab === 'datos' && styles.tabTextActive]}>Súper</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tabButton, activeTab === 'macros' && styles.tabActive]} onPress={() => setActiveTab('macros')}><Text style={[styles.tabText, activeTab === 'macros' && styles.tabTextActive]}>Macros (100g)</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tabButton, activeTab === 'micros' && styles.tabActive]} onPress={() => setActiveTab('micros')}><Text style={[styles.tabText, activeTab === 'micros' && styles.tabTextActive]}>Micros</Text></TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                  {activeTab === 'datos' && (
                    <View style={styles.gridWrapperModal}>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Emoji</Text><TextInput style={styles.macroInput} value={formEmoji} onChangeText={setFormEmoji} placeholder="Ej: 🍅" /></View>
                      <View style={[styles.macroBox, { width: '100%' }]}><Text style={styles.macroLabel}>Unidad Base</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.unitsScroll, { marginTop: 4, paddingBottom: 4 }]}>
                          {STANDARD_UNITS.map((u) => (<TouchableOpacity key={u} style={[styles.unitChip, formUnit === u && styles.unitChipSelected, { paddingHorizontal: 12, paddingVertical: 6, marginBottom: 0 }]} onPress={() => setFormUnit(u)}><Text style={[styles.unitChipText, formUnit === u && styles.unitChipTextSelected, { fontSize: 12 }]}>{u}</Text></TouchableOpacity>))}
                        </ScrollView>
                      </View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Formato Venta</Text><TextInput style={styles.macroInput} value={formFormat} onChangeText={setFormFormat} placeholder="Ej: Malla 1kg" /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Precio Venta (€)</Text><TextInput style={styles.macroInput} keyboardType="decimal-pad" value={formPrice} onChangeText={setFormPrice} /></View>
                    </View>
                  )}
                  {activeTab === 'macros' && (
                    <View style={styles.gridWrapperModal}>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Kcals</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.kcals} onChangeText={t => setFormMacros({...formMacros, kcals: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Proteínas (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.protein} onChangeText={t => setFormMacros({...formMacros, protein: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Carbos Totales (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.carbsTotal} onChangeText={t => setFormMacros({...formMacros, carbsTotal: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Azúcares (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.carbsSugars} onChangeText={t => setFormMacros({...formMacros, carbsSugars: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Grasas Totales (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsTotal} onChangeText={t => setFormMacros({...formMacros, fatsTotal: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Saturadas (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsSat} onChangeText={t => setFormMacros({...formMacros, fatsSat: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Monoinsat. (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsMono} onChangeText={t => setFormMacros({...formMacros, fatsMono: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Poliinsat. (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fatsPoly} onChangeText={t => setFormMacros({...formMacros, fatsPoly: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Fibra (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.fiber} onChangeText={t => setFormMacros({...formMacros, fiber: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Sal (g)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMacros.salt} onChangeText={t => setFormMacros({...formMacros, salt: t})} /></View>
                    </View>
                  )}
                  {activeTab === 'micros' && (
                    <View style={styles.gridWrapperModal}>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Calcio (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.calcium} onChangeText={t => setFormMicros({...formMicros, calcium: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Hierro (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.iron} onChangeText={t => setFormMicros({...formMicros, iron: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Magnesio (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.magnesium} onChangeText={t => setFormMicros({...formMicros, magnesium: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Potasio (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.potassium} onChangeText={t => setFormMicros({...formMicros, potassium: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Zinc (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.zinc} onChangeText={t => setFormMicros({...formMicros, zinc: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Vit E (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.vitE} onChangeText={t => setFormMicros({...formMicros, vitE: t})} /></View>
                      <View style={styles.macroBox}><Text style={styles.macroLabel}>Vit C (mg)</Text><TextInput style={styles.macroInput} keyboardType="numeric" value={formMicros.vitC} onChangeText={t => setFormMicros({...formMicros, vitC: t})} /></View>
                    </View>
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.confirmModalBtn} onPress={confirmPendingIngredient}><Text style={styles.confirmModalBtnText}>Aceptar Ficha</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL MEJORADO DE SELECCIÓN DE IMAGEN --- */}
      <Modal visible={isImgModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.modalTitle}>Añadir Imagen</Text>
              <TouchableOpacity onPress={() => setIsImgModalVisible(false)} style={{ padding: 4 }}>
                <FontAwesome name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1, marginTop: 0, backgroundColor: '#10b981' }]} onPress={takePhotoWithCamera}>
                <FontAwesome name="camera" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.secondaryButtonText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1, marginTop: 0, backgroundColor: '#8b5cf6' }]} onPress={pickImageFromGallery}>
                <FontAwesome name="image" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.secondaryButtonText}>Galería</Text>
              </TouchableOpacity>
            </View>

            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
              <View style={{flex: 1, height: 1, backgroundColor: '#e2e8f0'}} />
              <Text style={{marginHorizontal: 10, color: '#64748b', fontSize: 11, fontWeight: 'bold'}}>O BUSCAR EN UNSPLASH</Text>
              <View style={{flex: 1, height: 1, backgroundColor: '#e2e8f0'}} />
            </View>

            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Ej: Pasta carbonara..." value={imgQuery} onChangeText={setImgQuery} onSubmitEditing={searchPhotosOnline}/>
              <TouchableOpacity style={styles.unsplashSearchBtn} onPress={searchPhotosOnline} disabled={isSearchingImages}>
                {isSearchingImages ? <ActivityIndicator color="#fff" size="small" /> : <FontAwesome name="search" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>

            {isSearchingImages ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2f95dc" /></View>
            ) : (
              <ScrollView contentContainerStyle={styles.imageGridContainer} style={{ marginTop: 15, flex: 1 }}>
                {fetchedImages.length === 0 ? (
                  <Text style={styles.noImagesText}>Escribe qué plato buscas y pulsa la lupa.</Text>
                ) : (
                  fetchedImages.map((img) => (
                    <TouchableOpacity key={img.id} style={styles.imageGridItem} onPress={() => { setImageUrl(img.urls.regular); setIsImgModalVisible(false); }}>
                      <View style={{ width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                        <Image source={{ uri: img.urls.small }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <View style={{position:'absolute', bottom:4, right:4, backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:4, paddingVertical:2, borderRadius:4}}>
                           <Text style={{fontSize:9, color:'#fff', fontWeight: 'bold'}}>📸 {img.user.name.substring(0, 12)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isImportModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pegar código de receta</Text>
            <TextInput style={styles.modalInput} placeholder="APP-RECIPE:..." value={codeToImport} onChangeText={setCodeToImport} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#cbd5e1'}]} onPress={() => setIsImportModalVisible(false)}><Text style={{fontWeight: 'bold'}}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#10b981'}]} onPress={handleImportRecipe}><Text style={{color: '#fff', fontWeight: 'bold'}}>Importar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16, color: '#333' },
  textArea: { height: 80, textAlignVertical: 'top', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  addBlock: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0', zIndex: 10 },
  suggestionsBox: { position: 'absolute', top: 55, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, zIndex: 20, maxHeight: 150 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionText: { fontSize: 15, color: '#333' },
  unitsScroll: { flexDirection: 'row', paddingVertical: 4 },
  unitChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f1f5f9', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  unitChipSelected: { backgroundColor: '#e0f2fe', borderColor: '#0284c7' },
  unitChipText: { color: '#64748b', fontWeight: '500', fontSize: 13 },
  unitChipTextSelected: { color: '#0284c7', fontWeight: 'bold' },
  addedItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9ff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#bae6fd' },
  addedItemText: { fontSize: 15, color: '#0369a1' },
  secondaryButton: { flexDirection: 'row', backgroundColor: '#94a3b8', padding: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  secondaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  saveButton: { backgroundColor: '#2f95dc', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  deleteButton: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 1, borderColor: '#ff5252' },
  deleteButtonText: { color: '#ff5252', fontSize: 16, fontWeight: 'bold' },
  importButton: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, marginLeft: 10, justifyContent: 'center', alignItems: 'center', height: 50, minWidth: 90 },
  importButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontWeight: '700', color: '#2f95dc', textAlign: 'center', marginBottom: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1e293b', fontWeight: 'bold' },

  gridWrapperModal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  macroBox: { width: '48%', backgroundColor: '#f8fafc', padding: 8, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  macroLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4, paddingLeft: 4 },
  macroInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14, fontWeight: 'bold', color: '#334155' },
  confirmModalBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 15 },
  confirmModalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  imageSelectorButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  unsplashSearchBtn: { backgroundColor: '#2f95dc', width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  imageGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20 },
  imageGridItem: { width: '31%', aspectRatio: 1, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  noImagesText: { width: '100%', textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 14, fontWeight: '500' },

  modalInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, height: 100, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
});