import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router'; // Añadimos useLocalSearchParams
import { FontAwesome } from '@expo/vector-icons';
import { addRecipe, MOCK_RECIPES, updateRecipe, deleteRecipe } from '../mockData'; // Importamos las nuevas funciones

export default function NewRecipeScreen() {
  // 1. Detectamos si venimos a editar o a crear
  const { editId } = useLocalSearchParams();
  const isEditing = !!editId;

  const [name, setName] = useState('');
  const [baseDiners, setBaseDiners] = useState('2');
  const [imageUrl, setImageUrl] = useState('');

  const [ingredients, setIngredients] = useState([]);
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingUnit, setIngUnit] = useState('ud');

  const [instructions, setInstructions] = useState([]);
  const [instructionText, setInstructionText] = useState('');

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // 2. Si estamos editando, cargamos los datos de la receta al iniciar
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

  // --- LÓGICA DE ELIMINAR CON CONFIRMACIÓN ---
  const handleDelete = () => {
    Alert.alert(
      "¿Borrar receta?",
      "Esta acción no se puede deshacer. ¿Estás seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Borrar", 
          style: "destructive", 
          onPress: () => {
            deleteRecipe(editId);
            router.dismissAll(); // Limpiamos el historial para evitar volver a una receta que no existe
            router.replace('/'); // Volvemos al inicio
          } 
        }
      ]
    );
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);

    try {
      const response = await fetch(importUrl.trim());
      const html = await response.text();

      const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      let recipeData = null;

      while ((match = scriptRegex.exec(html)) !== null) {
        try {
          const json = JSON.parse(match[1]);
          const findRecipe = (obj) => {
            if (!obj) return null;
            if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) return obj;
            if (obj['@graph']) {
              const graphRecipe = obj['@graph'].find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
              if (graphRecipe) return graphRecipe;
            }
            if (Array.isArray(obj)) {
              const arrRecipe = obj.find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
              if (arrRecipe) return arrRecipe;
            }
            return null;
          };

          const found = findRecipe(json);
          if (found) {
            recipeData = found;
            break;
          }
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

            let amount = 1;
            let unit = 'ud';
            let parsedName = rawStr;

            const matchIng = rawStr.match(/^([\d.,\/]+)\s*(g|kg|ml|l|litros?|tazas?|cucharadas?|cucharaditas?|gramos?|paquetes?|botes?|latas?|dientes?)?\s*(de\s+)?(.*)/i);
            
            if (matchIng) {
              let numStr = matchIng[1].replace(',', '.');
              if (numStr.includes('/')) {
                const [num, den] = numStr.split('/');
                if (den && parseInt(den) !== 0) amount = parseFloat(num) / parseFloat(den);
              } else {
                amount = parseFloat(numStr) || 1;
              }
              amount = Math.round(amount * 100) / 100;

              if (matchIng[2]) {
                unit = matchIng[2].toLowerCase();
                if (unit.startsWith('gramo')) unit = 'g';
                if (unit.startsWith('litro')) unit = 'L';
                if (unit.startsWith('taza')) unit = 'taza';
                if (unit.startsWith('cucharada')) unit = 'cuch.';
                if (unit.startsWith('cucharadita')) unit = 'cuch.';
                if (unit.startsWith('diente')) unit = 'ud';
              }
              parsedName = (matchIng[4] || rawStr).trim();
            }

            parsedName = parsedName.charAt(0).toUpperCase() + parsedName.slice(1);
            return { name: parsedName, amount, unit };
          }).filter(i => i !== null);

          setIngredients(newIngs);
        }

        if (recipeData.recipeInstructions) {
          const steps = recipeData.recipeInstructions.map(step => {
            return step.text ? step.text.replace(/<[^>]*>?/gm, '') : step.toString().replace(/<[^>]*>?/gm, '');
          });
          setInstructions(steps);
        }

        Alert.alert('¡Éxito!', 'La receta se ha extraído correctamente.');
      } else {
        Alert.alert('Vaya...', 'No hemos podido encontrar el formato estándar de receta en este enlace.');
      }

    } catch (error) {
      Alert.alert('Error', 'No se ha podido leer el enlace.');
    } finally {
      setIsImporting(false);
      setImportUrl(''); 
    }
  };

  const handleAddIngredient = () => {
    if (!ingName.trim()) return;
    setIngredients([...ingredients, { name: ingName.trim(), amount: parseFloat(ingAmount) || 1, unit: ingUnit.trim() }]);
    setIngName(''); setIngAmount('1'); setIngUnit('ud');
  };

  const handleRemoveIngredient = (indexToRemove) => {
    setIngredients(ingredients.filter((_, index) => index !== indexToRemove));
  };

  const handleAddInstruction = () => {
    if (!instructionText.trim()) return;
    setInstructions([...instructions, instructionText.trim()]);
    setInstructionText('');
  };

  const handleRemoveInstruction = (indexToRemove) => {
    setInstructions(instructions.filter((_, index) => index !== indexToRemove));
  };

  const handleSave = () => {
    if (name.trim() === '') return;
    
    const finalImageUrl = (typeof imageUrl === 'string' && imageUrl.startsWith('http')) 
      ? imageUrl.trim() 
      : 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80';

    const recipeData = {
      name: name.trim(),
      imageUrl: finalImageUrl,
      baseDiners: parseInt(baseDiners) || 2,
      ingredients: ingredients,
      instructions: instructions.length > 0 ? instructions : ['Cocinar con mucho amor.']
    };

    if (isEditing) {
      updateRecipe(editId, recipeData);
      Alert.alert("¡Éxito!", "Receta actualizada correctamente.");
    } else {
      addRecipe({ ...recipeData, id: `recipe-${Date.now()}` });
      Alert.alert("¡Éxito!", "Receta creada correctamente.");
    }
    
    router.back(); 
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* El título cambia según el modo */}
        <Stack.Screen options={{ title: isEditing ? 'Editar Receta' : 'Nueva Receta' }} />
        
        {/* El importador solo se muestra si NO estamos editando para no sobreescribir por error */}
        {!isEditing && (
          <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1 }]}>
            <Text style={styles.sectionTitle}>🔗 Importar desde web</Text>
            <Text style={{fontSize: 12, color: '#666', marginBottom: 10}}>Pega un enlace de un blog de cocina y haremos la magia.</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="https://..."
                value={importUrl}
                onChangeText={setImportUrl}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={[styles.importButton, !importUrl.trim() && { opacity: 0.5 }]} 
                onPress={handleImportUrl}
                disabled={!importUrl.trim() || isImporting}
              >
                {isImporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.importButtonText}>Extraer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* --- DATOS BÁSICOS --- */}
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

        {/* --- INGREDIENTES --- */}
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
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 2, marginRight: 8, marginBottom: 0 }]} placeholder="Ingrediente" value={ingName} onChangeText={setIngName} />
              <TextInput style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0, textAlign: 'center' }]} placeholder="Cant." keyboardType="numeric" value={ingAmount} onChangeText={setIngAmount} />
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0, textAlign: 'center' }]} placeholder="Ud." value={ingUnit} onChangeText={setIngUnit} />
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleAddIngredient}>
              <FontAwesome name="plus" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Añadir a la lista</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- INSTRUCCIONES --- */}
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

        {/* --- BOTONES FINALES --- */}
        <TouchableOpacity style={[styles.saveButton, !name.trim() && { opacity: 0.5 }]} onPress={handleSave} disabled={!name.trim()}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Guardar Cambios' : 'Guardar Receta Definitiva'}</Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <FontAwesome name="trash" size={18} color="#ff5252" style={{ marginRight: 8 }} />
            <Text style={styles.deleteButtonText}>Eliminar Receta para siempre</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
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
  addBlock: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  addedItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f9ff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#bae6fd' },
  addedItemText: { fontSize: 15, color: '#0369a1' },
  secondaryButton: { flexDirection: 'row', backgroundColor: '#94a3b8', padding: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  saveButton: { backgroundColor: '#2f95dc', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  deleteButton: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 1, borderColor: '#ff5252' },
  deleteButtonText: { color: '#ff5252', fontSize: 16, fontWeight: 'bold' },
  importButton: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, marginLeft: 10, justifyContent: 'center', alignItems: 'center', height: 50, minWidth: 90 },
  importButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});