import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router'; 
import { FontAwesome } from '@expo/vector-icons';
import { addRecipe, MOCK_RECIPES, updateRecipe, deleteRecipe, registerCustomIngredient, COMMON_INGREDIENTS, INGREDIENTS_DB, getCanonicalName } from '../tempData'; 

const STANDARD_UNITS = ['ud', 'g', 'kg', 'ml', 'L', 'cuch.', 'taza', 'pizca', 'paquete'];

export default function NewRecipeScreen() {
  const { editId } = useLocalSearchParams();
  const isEditing = !!editId;

  const [name, setName] = useState('');
  const [baseDiners, setBaseDiners] = useState('2');
  const [imageUrl, setImageUrl] = useState('');

  const [ingredients, setIngredients] = useState([]);
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingUnit, setIngUnit] = useState('g'); 

  const [instructions, setInstructions] = useState([]);
  const [instructionText, setInstructionText] = useState('');

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasManuallySelectedUnit, setHasManuallySelectedUnit] = useState(false);

  // --- ESTADOS CONTROLADORES DEL MODAL NUTRICIONAL ---
  const [pendingIngredients, setPendingIngredients] = useState([]);
  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);
  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [isFetchingNutrients, setIsFetchingNutrients] = useState(false);
  const [activeTab, setActiveTab] = useState('datos'); // 'datos' | 'macros' | 'micros'

  // --- CAMPOS EDITABLES COMPLETOS DEL INGREDIENTE ---
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
            return { name: parsedName, amount, unit };
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

  const handleAddIngredient = () => {
    if (!ingName.trim()) return;
    setIngredients([...ingredients, { name: ingName.trim(), amount: parseFloat(ingAmount) || 1, unit: ingUnit.trim() }]);
    setIngName(''); setIngAmount('1'); setHasManuallySelectedUnit(false); setShowSuggestions(false);
  };

  const handleRemoveIngredient = (indexToRemove) => setIngredients(ingredients.filter((_, index) => index !== indexToRemove));
  const handleAddInstruction = () => { if (!instructionText.trim()) return; setInstructions([...instructions, instructionText.trim()]); setInstructionText(''); };
  const handleRemoveInstruction = (indexToRemove) => setInstructions(instructions.filter((_, index) => index !== indexToRemove));

  // --- ESCÁNER DE APIS CON DATOS AVANZADOS ---
  const fetchNutrientsFromAPI = async (ingredientName, baseUnit) => {
    setIsFetchingNutrients(true);
    setActiveTab('datos'); // Reseteamos a la pestaña de datos básicos
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
          kcals: String(Math.round(nut['energy-kcal_100g'] || 0)),
          protein: String(Math.round((nut['proteins_100g'] || 0) * 10) / 10),
          carbsTotal: String(Math.round((nut['carbohydrates_100g'] || 0) * 10) / 10),
          carbsSugars: String(Math.round((nut['sugars_100g'] || 0) * 10) / 10),
          fatsTotal: String(Math.round((nut['fat_100g'] || 0) * 10) / 10),
          fatsSat: String(Math.round((nut['saturated-fat_100g'] || 0) * 10) / 10),
          fatsMono: String(Math.round((nut['monounsaturated-fat_100g'] || 0) * 10) / 10),
          fatsPoly: String(Math.round((nut['polyunsaturated-fat_100g'] || 0) * 10) / 10),
          fiber: String(Math.round((nut['fiber_100g'] || 0) * 10) / 10),
          salt: String(Math.round((nut['salt_100g'] || 0) * 100) / 100)
        });

        setFormMicros({
          calcium: String(nut['calcium_100g'] ? Math.round(nut['calcium_100g'] * 1000) : 0),
          iron: String(nut['iron_100g'] ? Math.round(nut['iron_100g'] * 1000) : 0),
          magnesium: String(nut['magnesium_100g'] ? Math.round(nut['magnesium_100g'] * 1000) : 0),
          potassium: String(nut['potassium_100g'] ? Math.round(nut['potassium_100g'] * 1000) : 0),
          zinc: String(nut['zinc_100g'] ? Math.round(nut['zinc_100g'] * 1000) : 0),
          vitE: '0', vitC: String(nut['vitamin-c_100g'] ? Math.round(nut['vitamin-c_100g'] * 1000) : 0)
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
      return canonical === ing.name.charAt(0).toUpperCase() + ing.name.slice(1).toLowerCase() && !Object.keys(INGREDIENTS_DB).some(k => INGREDIENTS_DB[k].name === canonical);
    });

    if (unknownIngs.length > 0) {
      setPendingIngredients(unknownIngs);
      setCurrentPendingIndex(0);
      setIsRegisterModalVisible(true);
      fetchNutrientsFromAPI(unknownIngs[0].name, unknownIngs[0].unit);
      return; 
    }
    executeFinalSave();
  };

  // --- CONSTRUCCIÓN DEL OBJETO COMPLETO DE SÚPER Y NUTRICIÓN ---
  const confirmPendingIngredient = async () => {
    const currentIng = pendingIngredients[currentPendingIndex];
    
    const advancedIngredientObject = {
      name: getCanonicalName(currentIng.name),
      unit: formUnit,
      emoji: formEmoji.trim() || '🛒',
      purchaseUnit: formFormat.trim() || `1 ${formUnit}`,
      purchasePrice: parseFloat(formPrice) || 0,
      macros: {
        kcals: parseFloat(formMacros.kcals) || 0,
        protein: parseFloat(formMacros.protein) || 0,
        carbs: { total: parseFloat(formMacros.carbsTotal) || 0, sugars: parseFloat(formMacros.carbsSugars) || 0 },
        fats: { total: parseFloat(formMacros.fatsTotal) || 0, saturated: parseFloat(formMacros.fatsSat) || 0, monounsaturated: parseFloat(formMacros.fatsMono) || 0, polyunsaturated: parseFloat(formMacros.fatsPoly) || 0 },
        fiber: parseFloat(formMacros.fiber) || 0,
        salt: parseFloat(formMacros.salt) || 0
      },
      micros: {
        calcium_mg: parseFloat(formMicros.calcium) || 0,
        iron_mg: parseFloat(formMicros.iron) || 0,
        magnesium_mg: parseFloat(formMicros.magnesium) || 0,
        potassium_mg: parseFloat(formMicros.potassium) || 0,
        zinc_mg: parseFloat(formMicros.zinc) || 0,
        vitE_mg: parseFloat(formMicros.vitE) || 0,
        vitC_mg: parseFloat(formMicros.vitC) || 0
      },
      source: "USER_CUSTOM"
    };

    await registerCustomIngredient(currentIng.name, formUnit, advancedIngredientObject);

    if (currentPendingIndex + 1 < pendingIngredients.length) {
      setCurrentPendingIndex(prev => prev + 1);
      fetchNutrientsFromAPI(pendingIngredients[currentPendingIndex + 1].name, pendingIngredients[currentPendingIndex + 1].unit);
    } else {
      setIsRegisterModalVisible(false);
      executeFinalSave();
    }
  };

  const executeFinalSave = async () => {
    setIsSaving(true);
    try {
      const processedIngredients = await Promise.all(ingredients.map(async (ing) => ({ name: await registerCustomIngredient(ing.name, ing.unit), amount: ing.amount, unit: ing.unit })));
      const recipeData = { name: name.trim(), imageUrl: imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80', baseDiners: parseInt(baseDiners) || 2, ingredients: processedIngredients, instructions: instructions.length > 0 ? instructions : ['Cocinar con mucho amor.'] };
      isEditing ? updateRecipe(editId, recipeData) : addRecipe({ ...recipeData, id: `recipe-${Date.now()}` });
      router.back(); 
    } catch (e) { Alert.alert("Error", "No se pudo guardar."); } finally { setIsSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: isEditing ? 'Editar Receta' : 'Nueva Receta' }} />
        
        {/* --- TUS SECCIONES DE SIEMPRE (Importación, datos base, ingredientes, pasos) --- */}
        {!isEditing && (
          <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1 }]}>
            <Text style={styles.sectionTitle}>🔗 Importar desde web</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="https://..." value={importUrl} onChangeText={setImportUrl} autoCapitalize="none" />
              <TouchableOpacity style={[styles.importButton, !importUrl.trim() && { opacity: 0.5 }]} onPress={handleImportUrl} disabled={!importUrl.trim() || isImporting || isSaving}>
                {isImporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.importButtonText}>Extraer</Text>}
              </TouchableOpacity>
            </View>
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
              <Text style={styles.label}>URL Foto</Text>
              <TextInput style={styles.input} placeholder="https://..." value={imageUrl} onChangeText={setImageUrl} />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🛒 Ingredientes</Text>
          {ingredients.map((ing, idx) => (
            <View key={idx} style={styles.addedItemRow}>
              <Text style={styles.addedItemText}>• {ing.amount} {ing.unit} de {ing.name}</Text>
              <TouchableOpacity onPress={() => handleRemoveIngredient(idx)}>
                <FontAwesome name="trash" size={18} color="#ff5252" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.addBlock}>
            <View style={[styles.row, { zIndex: 10, position: 'relative' }]}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Ingrediente..." value={ingName} onChangeText={(text) => { setIngName(text); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} />
                {showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {suggestions.map((s, idx) => (
                      <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(s)}>
                        <Text style={styles.suggestionText}>{s.name} <Text style={{ color: '#888', fontSize: 12 }}>({s.unit})</Text></Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0, textAlign: 'center' }]} placeholder="Cant." keyboardType="numeric" value={ingAmount} onChangeText={setIngAmount} />
            </View>
            <View style={{ marginTop: 15, marginBottom: 5 }}>
              <Text style={styles.label}>Unidad:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
                {STANDARD_UNITS.map((u) => (
                  <TouchableOpacity key={u} style={[styles.unitChip, ingUnit === u && styles.unitChipSelected]} onPress={() => { setIngUnit(u); setHasManuallySelectedUnit(true); }}>
                    <Text style={[styles.unitChipText, ingUnit === u && styles.unitChipTextSelected]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleAddIngredient}>
              <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Añadir a la receta</Text>
            </TouchableOpacity>
          </View>
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
          🎛️ MODAL PREMIUM CON PESTAÑAS E INPUTS COMPLETOS 
          ======================================================== */}
      <Modal visible={isRegisterModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✨ Configurar Ficha Técnica</Text>
            
            {isFetchingNutrients ? (
              <View style={{ alignItems: 'center', padding: 30 }}>
                <ActivityIndicator size="large" color="#2f95dc" />
                <Text style={{ marginTop: 15, color: '#64748b' }}>Consultando OpenFoodFacts...</Text>
              </View>
            ) : (
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.modalSubtitle}>Ingrediente: {pendingIngredients[currentPendingIndex]?.name}</Text>

                {/* SELECTOR DE PESTAÑAS */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity style={[styles.tabButton, activeTab === 'datos' && styles.tabActive]} onPress={() => setActiveTab('datos')}>
                    <Text style={[styles.tabText, activeTab === 'datos' && styles.tabTextActive]}>Súper</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tabButton, activeTab === 'macros' && styles.tabActive]} onPress={() => setActiveTab('macros')}>
                    <Text style={[styles.tabText, activeTab === 'macros' && styles.tabTextActive]}>Macros (100g)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tabButton, activeTab === 'micros' && styles.tabActive]} onPress={() => setActiveTab('micros')}>
                    <Text style={[styles.tabText, activeTab === 'micros' && styles.tabTextActive]}>Micros</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                  {/* PESTAÑA 1: DATOS DE COMPRA */}
                  {activeTab === 'datos' && (
                    <View style={styles.gridWrapperModal}>
                      <View style={styles.macroBox}>
                        <Text style={styles.macroLabel}>Emoji</Text>
                        <TextInput style={styles.macroInput} value={formEmoji} onChangeText={setFormEmoji} placeholder="Ej: 🍅" />
                      </View>
                      {/* --- NUEVO: SELECTOR EN CHIPS PARA LA UNIDAD BASE --- */}
                      <View style={[styles.macroBox, { width: '100%' }]}>
                        <Text style={styles.macroLabel}>Unidad Base</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.unitsScroll, { marginTop: 4, paddingBottom: 4 }]}>
                          {STANDARD_UNITS.map((u) => (
                            <TouchableOpacity 
                              key={u} 
                              style={[styles.unitChip, formUnit === u && styles.unitChipSelected, { paddingHorizontal: 12, paddingVertical: 6, marginBottom: 0 }]} 
                              onPress={() => setFormUnit(u)}
                            >
                              <Text style={[styles.unitChipText, formUnit === u && styles.unitChipTextSelected, { fontSize: 12 }]}>{u}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={styles.macroBox}>
                        <Text style={styles.macroLabel}>Formato Venta</Text>
                        <TextInput style={styles.macroInput} value={formFormat} onChangeText={setFormFormat} placeholder="Ej: Malla 1kg" />
                      </View>
                      <View style={styles.macroBox}>
                        <Text style={styles.macroLabel}>Precio Venta (€)</Text>
                        <TextInput style={styles.macroInput} keyboardType="decimal-pad" value={formPrice} onChangeText={setFormPrice} />
                      </View>
                    </View>
                  )}

                  {/* PESTAÑA 2: MACRONUTRIENTES (POR 100G) */}
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

                  {/* PESTAÑA 3: MICRONUTRIENTES (POR 100G) */}
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

                <TouchableOpacity style={styles.confirmModalBtn} onPress={confirmPendingIngredient}>
                  <Text style={styles.confirmModalBtnText}>
                    Aceptar Ficha
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scrollContent: { padding: 16, paddingBottom: 40 },
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

  // --- ESTILOS DEL SELECCIONADOR DE PESTAÑAS ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontWeight: '700', color: '#2f95dc', textAlign: 'center', marginBottom: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 15 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1e293b', fontWeight: 'bold' },

  // --- CUADRÍCULA DE CAMPOS ---
  gridWrapperModal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  macroBox: { width: '48%', backgroundColor: '#f8fafc', padding: 8, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  macroLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4, paddingLeft: 4 },
  macroInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14, fontWeight: 'bold', color: '#334155' },
  confirmModalBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 15 },
  confirmModalBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});