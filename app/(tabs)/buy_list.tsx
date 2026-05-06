import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { weeklyMenu, MOCK_RECIPES, EXTRA_SHOPPING_ITEMS, addExtraItem, COMMON_INGREDIENTS } from '../mockData';

// --- SISTEMA DE COLORES DINÁMICOS POR RECETA ---
// --- SISTEMA DE COLORES DINÁMICOS INFINITOS POR RECETA ---
const getTagStyle = (tagText) => {
  // Los ingredientes manuales siguen con su color naranja por defecto
  if (tagText.includes('Extra')) {
    return { backgroundColor: '#fff3e0', borderColor: '#ffe0b2', color: '#e65100' };
  }

  const partes = tagText.split(' - ');
  const nombreReceta = partes.length > 1 ? partes[1] : tagText;

  // Calculamos el hash de la receta
  let hash = 0;
  for (let i = 0; i < nombreReceta.length; i++) {
    hash = nombreReceta.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convertimos el hash en un Tono (Hue) de la rueda de colores (0 a 360 grados)
  const hue = Math.abs(hash) % 360;

  // Devolvemos el color en formato HSL garantizando que siempre sea un tono pastel legible
  return {
    backgroundColor: `hsl(${hue}, 80%, 92%)`, // Fondo muy claro (92% luminosidad)
    borderColor: `hsl(${hue}, 80%, 82%)`,     // Borde un poco más oscuro
    color: `hsl(${hue}, 80%, 30%)`            // Texto oscuro para máximo contraste
  };
};

export default function ShoppingScreen() {
  const [shoppingList, setShoppingList] = useState([]);
  
  // Estados para el formulario de nuevo ingrediente
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('1'); // Nuevo campo de cantidad (texto por defecto '1')
  const [newItemUnit, setNewItemUnit] = useState('ud');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filtramos la base de datos de ingredientes comunes
  const suggestions = newItemName.trim().length > 0 
    ? COMMON_INGREDIENTS.filter(ing => ing.name.toLowerCase().includes(newItemName.toLowerCase()))
    : [];

  const handleSelectSuggestion = (suggestion) => {
    setNewItemName(suggestion.name);
    setNewItemUnit(suggestion.unit);
    setShowSuggestions(false);
  };
  //Lee los datos y refresca la lista de ingredientes
  useFocusEffect(
    useCallback(() => {
      const ingredientsMap = {};

      Object.keys(weeklyMenu).forEach(day => {
        const meals = weeklyMenu[day];
        ['lunch', 'dinner'].forEach(mealType => {
          const recipeId = meals[mealType];
          if (recipeId && recipeId !== 'eat_out') {
            const recipe = MOCK_RECIPES.find(r => r.id === recipeId);
            
            if (recipe) {
              const shortName = recipe.name.length > 15 ? recipe.name.substring(0, 15) + '...' : recipe.name;
              const label = `${day} (${mealType === 'lunch' ? 'Com' : 'Cen'}) - ${shortName}`;

              recipe.ingredients.forEach(ing => {
                if (ingredientsMap[ing.name]) {
                  ingredientsMap[ing.name].amount += ing.amount;
                  if (!ingredientsMap[ing.name].tags.includes(label)) {
                    ingredientsMap[ing.name].tags.push(label);
                  }
                } else {
                  ingredientsMap[ing.name] = { amount: ing.amount, unit: ing.unit, tags: [label] };
                }
              });
            }
          }
        });
      });

      const listFromMenu = Object.keys(ingredientsMap).map((name, index) => ({
        id: `menu-${index}`,
        name,
        amount: ingredientsMap[name].amount,
        unit: ingredientsMap[name].unit,
        tags: ingredientsMap[name].tags,
        checked: false
      }));

      const listExtras = EXTRA_SHOPPING_ITEMS.map(item => ({
        ...item,
        tags: ['Extra'],
        checked: false
      }));

      setShoppingList([...listFromMenu, ...listExtras]);
    }, [])
  );

  const handleAddManual = () => {
      if (newItemName.trim() && newItemAmount.trim()) {
        const finalAmount = parseFloat(newItemAmount) || 1; 
        
        // 1. Lo guardamos en la "memoria" por si cambiamos de pestaña
        addExtraItem(newItemName.trim(), finalAmount, newItemUnit); 
        
        // 2. Creamos la "tarjeta" del ingrediente para la vista actual
        const newExtraItem = {
          id: `extra-${Date.now()}`, // Le damos un ID único
          name: newItemName.trim(),
          amount: finalAmount,
          unit: newItemUnit,
          tags: ['Extra'],
          checked: false
        };

        // 3. Lo inyectamos directamente en la lista sin recargar nada más
        // (Así no perdemos los artículos que ya tuviéramos tachados)
        setShoppingList(currentList => [...currentList, newExtraItem]);
        
        // 4. Reseteamos el formulario
        setNewItemName('');
        setNewItemAmount('1');
        setNewItemUnit('ud');
        setShowSuggestions(false);
      }
    };

  const toggleCheck = (id) => {
    setShoppingList(currentList => 
      currentList.map(item => item.id === id ? { ...item, checked: !item.checked } : item)
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.itemRow, item.checked && styles.itemRowChecked]} 
      onPress={() => toggleCheck(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.mainInfo}>
        <View style={styles.topRow}>
          <FontAwesome name={item.checked ? "check-square-o" : "square-o"} size={22} color={item.checked ? "#aaa" : "#2f95dc"} />
          <Text style={[styles.itemName, item.checked && styles.itemTextChecked]}>{item.name}</Text>
          <Text style={[styles.itemAmount, item.checked && styles.itemTextChecked]}>{item.amount} {item.unit}</Text>
        </View>

        {/* --- ETIQUETAS DE DÍAS (AHORA CON COLORES) --- */}
        <View style={styles.tagsContainer}>
          {item.tags.map((tag, idx) => {
            const tagColors = getTagStyle(tag); // Obtenemos el color según el texto de la etiqueta
            return (
              <View key={idx} style={[styles.tag, { backgroundColor: tagColors.backgroundColor, borderColor: tagColors.borderColor }]}>
                <Text style={[styles.tagText, { color: tagColors.color }]}>{tag}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>🛒 Lista de la Compra</Text>
      
      {/* --- FORMULARIO DE AÑADIR (CON CANTIDAD Y SUGERENCIAS) --- */}
      <View style={{ position: 'relative', zIndex: 10 }}>
        <View style={styles.inputContainer}>
          {/* Input Nombre */}
          <View style={styles.nameInputWrapper}>
            <TextInput 
              style={[styles.manualInput, { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
              placeholder="Ej. Leche"
              value={newItemName}
              onChangeText={(text) => {
                setNewItemName(text);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            {/* CAJA DE SUGERENCIAS */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.map((s, idx) => (
                  <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(s)}>
                    <Text style={styles.suggestionText}>{s.name} <Text style={{ color: '#888', fontSize: 13 }}>({s.unit})</Text></Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Input Cantidad */}
          <TextInput 
            style={[styles.manualInput, styles.amountInput]}
            placeholder="1"
            value={newItemAmount}
            onChangeText={setNewItemAmount}
            keyboardType="numeric"
          />
          
          <TouchableOpacity style={styles.addButton} onPress={handleAddManual}>
            <FontAwesome name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- LISTA DE INGREDIENTES --- */}
      {shoppingList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Tu lista está vacía.</Text>
          <Text style={styles.emptySubText}>Añade algo arriba o asigna recetas en tu Menú Semanal.</Text>
        </View>
      ) : (
        <FlatList
          data={shoppingList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff', padding: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#000', marginTop: 10 },
  listContainer: { paddingBottom: 40 },
  
  // Formulario manual
  inputContainer: { flexDirection: 'row', marginBottom: 20, zIndex: 10 },
  nameInputWrapper: { flex: 2, position: 'relative', zIndex: 10 },
  manualInput: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', fontSize: 16, height: 48 },
  amountInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  addButton: { backgroundColor: '#2f95dc', width: 50, marginLeft: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center', height: 48 },
  
  // Sugerencias
  suggestionsBox: { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 5, zIndex: 20, maxHeight: 150 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionText: { fontSize: 15, color: '#333' },

  // Elementos de la lista
  itemRow: { backgroundColor: '#fff', padding: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  itemRowChecked: { backgroundColor: '#f9f9f9', borderColor: '#eee' },
  mainInfo: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemName: { flex: 1, fontSize: 16, marginLeft: 10, fontWeight: '500', color: '#333' },
  itemAmount: { fontWeight: 'bold', color: '#333' },
  itemTextChecked: { color: '#aaa', textDecorationLine: 'line-through' },
  
  // Etiquetas multicolor
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: 32 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 6, marginBottom: 6, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: 'bold' },
  
  // Vacío
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 16, color: '#888', textAlign: 'center' }
});