import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { deleteRecipe, assignRecipeToMenu, MOCK_RECIPES, INGREDIENTS_DB, getCanonicalName, normalizeToBase } from '../tempData';
import { FontAwesome } from '@expo/vector-icons';
import { encode } from 'base-64'; // Necesario para compartir

export const getEmojiForIngredient = (rawName) => {
  const canonical = getCanonicalName(rawName);
  const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonical);
  if (dbKey) return INGREDIENTS_DB[dbKey].emoji;
  return '🛒';
};

export default function RecipeDetailScreen() {
  const { id, day, meal, plannedDiners } = useLocalSearchParams();
  
  const recipe = MOCK_RECIPES.find((r) => String(r.id) === String(id));

  const [diners, setDiners] = useState(plannedDiners ? parseInt(plannedDiners, 10) : (recipe?.baseDiners || 1));
  
  // --- NUEVO ESTADO PARA EL MODAL DE DETALLE ---
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  // --- CÁLCULO EN TIEMPO REAL: COSTE TOTAL vs MACROS POR RACIÓN + DETALLE POR INGREDIENTE ---
  const recipeStats = useMemo(() => {
    if (!recipe) return { cost: 0, kcals: 0, protein: 0, carbs: 0, fats: 0, details: [] };

    let totalCost = 0;
    let perPerson = { kcals: 0, protein: 0, carbs: 0, fats: 0 };
    let detailedItems = [];

    recipe.ingredients.forEach(ing => {
      // 1. Cantidad para TODA la olla (depende de 'diners' para el coste)
      const totalAmount = (ing.amount / recipe.baseDiners) * diners;
      
      // 2. Cantidad para 1 SOLA PERSONA (para los macros)
      const amountPerPerson = ing.amount / recipe.baseDiners;
      
      const normalizedTotal = normalizeToBase(totalAmount, ing.unit);
      const normalizedPerPerson = normalizeToBase(amountPerPerson, ing.unit);
      
      const amountIn100gPerPerson = normalizedPerPerson.amount / 100;

      const canonicalName = getCanonicalName(ing.name);
      const dbKey = Object.keys(INGREDIENTS_DB).find(k => INGREDIENTS_DB[k].name === canonicalName);
      const dbItem = dbKey ? INGREDIENTS_DB[dbKey] : null;

      let itemCost = 0;
      let itemKcals = 0;
      let itemP = 0;
      let itemC = 0;
      let itemF = 0;

      if (dbItem) {
        // --- CÁLCULO DE MACROS (POR COMENSAL) ---
        if (dbItem.macros) {
          itemKcals = (dbItem.macros.kcals || 0) * amountIn100gPerPerson;
          itemP = (dbItem.macros.protein || 0) * amountIn100gPerPerson;
          itemC = (dbItem.macros.carbs?.total || 0) * amountIn100gPerPerson;
          itemF = (dbItem.macros.fats?.total || 0) * amountIn100gPerPerson;

          perPerson.kcals += itemKcals;
          perPerson.protein += itemP;
          perPerson.carbs += itemC;
          perPerson.fats += itemF;
        }

        // --- CÁLCULO DE COSTE (TOTAL DE LA OLLA) ---
        if (dbItem.purchasePrice && dbItem.purchaseUnit) {
          // Eliminamos el símbolo '^' inicial y añadimos soporte para comas ([\d.,]+)
          const match = dbItem.purchaseUnit.match(/([\d.,]+)\s*(g|kg|ml|l|ud|docena|pack|bote|lata|paquete|manojo|sarta|cajita|pastilla|barra|bolsa|bandeja|tarro|brik)/i);
          let pkgAmt = 1;
          
          if (match) {
            pkgAmt = parseFloat(match[1].replace(',', '.')) || 1;
            const pUnit = match[2].toLowerCase();
            if (pUnit === 'kg' || pUnit === 'l') pkgAmt *= 1000;
            if (pUnit === 'docena') pkgAmt = 12;
          }
          
          itemCost = (normalizedTotal.amount / pkgAmt) * dbItem.purchasePrice;
          console.log(normalizedTotal.amount, pkgAmt, dbItem.purchasePrice) 
          totalCost += itemCost;
        }
      }

      detailedItems.push({
        name: canonicalName,
        cost: itemCost,
        kcals: itemKcals,
        protein: itemP,
        carbs: itemC,
        fats: itemF
      });
    });

    // Ordenar detalles: de mayor a menor coste para ver rápido qué encarece el plato
    detailedItems.sort((a, b) => b.cost - a.cost);

    return {
      cost: totalCost,
      kcals: Math.round(perPerson.kcals),
      protein: Math.round(perPerson.protein * 10) / 10,
      carbs: Math.round(perPerson.carbs * 10) / 10,
      fats: Math.round(perPerson.fats * 10) / 10,
      details: detailedItems
    };
  }, [recipe, diners]);

  const handleExportRecipe = async () => {
    const jsonString = JSON.stringify(recipe);
    const encodedData = encode(jsonString);
    await Share.share({
      message: `¡Mira esta receta en mi app! Cópiala y pégala para importarla:\n\nAPP-RECIPE:${encodedData}`,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      "¿Borrar receta?",
      "Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta receta de tu libro personal?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Borrar", 
          style: "destructive", 
          onPress: () => {
            deleteRecipe(recipe.id);
            router.replace('/'); 
          } 
        }
      ]
    );
  };

  const handleEdit = () => {
    router.push({
      pathname: '/newRecipe', 
      params: { editId: recipe.id }
    });
  };

  const handleDinersChange = (newAmount) => {
    const validAmount = Math.max(1, newAmount);
    setDiners(validAmount);
    
    if (day && meal && recipe) {
      assignRecipeToMenu(day, meal, recipe.id, validAmount);
    }
  };

  const handleUnassign = () => {
    if (day && meal) {
      assignRecipeToMenu(day, meal, null);
      router.back();
    }
  };

  if (!recipe) return <Text style={{ padding: 20 }}>Receta no encontrada</Text>;

  const calculateAmount = (baseAmount) => {
    return ((baseAmount / recipe.baseDiners) * diners).toFixed(1).replace('.0', '');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Stack.Screen 
          options={{ 
            title: 'Detalle',
            headerRight: undefined
          }} 
        />
        
        <Stack.Screen options={{ title: recipe.name }} />

        <Image source={{ uri: recipe.imageUrl }} style={styles.image} />
        
        {/*Titulo y botón de exportación*/}
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{recipe.name}</Text>
            <TouchableOpacity style={styles.smallShareBtn} onPress={handleExportRecipe}>
              <FontAwesome name="share-alt" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {day && meal && (
            <View style={styles.contextContainer}>
              <Text style={styles.contextText}>
                📅 Planificado para el {day}
              </Text>
              <TouchableOpacity style={styles.unassignButton} onPress={handleUnassign}>
                <FontAwesome name="calendar-times-o" size={16} color="#ff5252" style={{ marginRight: 6 }} />
                <Text style={styles.unassignButtonText}>Quitar del menú</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* --- TARJETA DE ESTADÍSTICAS (AHORA ES UN BOTÓN) --- */}
          <TouchableOpacity 
            style={styles.statsCard} 
            activeOpacity={0.8}
            onPress={() => setIsDetailsModalVisible(true)}
          >
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Coste Total</Text>
              <Text style={[styles.statValue, { color: '#059669' }]}>{recipeStats.cost.toFixed(2)}€</Text>
              <Text style={styles.statSubText}>{(recipeStats.cost / diners).toFixed(2)}€ / ración</Text>
            </View>
            
            <View style={styles.statsDivider} />
            
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Kcal / ración</Text>
              <Text style={[styles.statValue, { color: '#ea580c' }]}>{recipeStats.kcals}</Text>
              <Text style={styles.statSubText}>Olla: {recipeStats.kcals * diners} kcal</Text>
            </View>

            <View style={styles.statsDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Macros / ración</Text>
              <Text style={styles.macroText}><Text style={{fontWeight: 'bold', color: '#3b82f6'}}>P:</Text> {recipeStats.protein}g</Text>
              <Text style={styles.macroText}><Text style={{fontWeight: 'bold', color: '#eab308'}}>C:</Text> {recipeStats.carbs}g</Text>
              <Text style={styles.macroText}><Text style={{fontWeight: 'bold', color: '#ef4444'}}>G:</Text> {recipeStats.fats}g</Text>
            </View>

            {/* Iconito indicador de que se puede pulsar */}
            <View style={{ position: 'absolute', top: 6, right: 8 }}>
              <FontAwesome name="info-circle" size={14} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          <View style={styles.calculatorContainer}>
            <Text style={styles.sectionTitle}>Comensales:</Text>
            <View style={styles.counter}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => handleDinersChange(diners - 1)}
              >
                <Text style={styles.buttonText}>-</Text>
              </TouchableOpacity>
              
              <Text style={styles.dinersNumber}>{diners}</Text>
              
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => handleDinersChange(diners + 1)}
              >
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Ingredientes:</Text>
          <View style={styles.ingredientsBox}>
            {recipe.ingredients.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>• {ing.name}</Text>
                <Text style={styles.ingredientAmount}>
                  {calculateAmount(ing.amount)} {ing.unit}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Preparación:</Text>
          {recipe.instructions.map((step, index) => (
            <Text key={index} style={styles.stepText}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* ========================================================
          🧾 MODAL: DESGLOSE NUTRICIONAL Y ECONÓMICO POR INGREDIENTE
          ======================================================== */}
      <Modal visible={isDetailsModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeaderCloseRow}>
              <Text style={styles.modalAdvancedTitle}>🔍 Análisis de la Receta</Text>
              <TouchableOpacity onPress={() => setIsDetailsModalVisible(false)} style={{ padding: 4 }}>
                <FontAwesome name="times" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Coste para <Text style={{fontWeight: 'bold'}}>{diners} comensales</Text> • Nutrientes por <Text style={{fontWeight: 'bold'}}>1 ración</Text>
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
              {recipeStats.details.map((item, idx) => (
                <View key={idx} style={styles.detailRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.detailName} numberOfLines={1}>
                      {getEmojiForIngredient(item.name)} {item.name}
                    </Text>
                    <Text style={styles.detailMacros}>
                      {Math.round(item.kcals)} kcal | P:{Math.round(item.protein)} C:{Math.round(item.carbs)} G:{Math.round(item.fats)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.detailCost}>
                      {item.cost > 0 ? `${item.cost.toFixed(2)} €` : '--'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseFullBtn} onPress={() => setIsDetailsModalVisible(false)}>
              <Text style={styles.modalCloseFullBtnText}>Cerrar Desglose</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7ff' },
  image: { width: '100%', height: 250 },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#1e293b' }, 
  
  contextContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  contextText: { fontSize: 16, color: '#2f95dc', fontWeight: 'bold' },
  unassignButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ffcdd2' },
  unassignButtonText: { color: '#ff5252', fontWeight: 'bold', fontSize: 14 },
  
  // --- ESTILOS DE LA TARJETA DE ESTADÍSTICAS ---
  statsCard: { position: 'relative', flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsDivider: { width: 1, height: '80%', backgroundColor: '#e2e8f0', marginHorizontal: 5 },
  statLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  statSubText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  macroText: { fontSize: 11, color: '#475569', fontWeight: '500', marginBottom: 1 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 5, marginBottom: 10, color: '#334155' },
  calculatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 20 },
  counter: { flexDirection: 'row', alignItems: 'center' },
  button: { backgroundColor: '#2f95dc', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 28 },
  dinersNumber: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 20, color: '#1e293b' },
  
  ingredientsBox: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 20 },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ingredientName: { fontSize: 15, color: '#334155', flex: 1 },
  ingredientAmount: { fontSize: 15, fontWeight: 'bold', color: '#0284c7' },
  
  stepText: { fontSize: 15, marginBottom: 12, lineHeight: 24, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', color: '#334155' },

  // --- ESTILOS DEL MODAL DE DESGLOSE ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 },
  modalHeaderCloseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  modalAdvancedTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  modalSubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 10, marginBottom: 5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc', alignItems: 'center' },
  detailName: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 4 },
  detailMacros: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  detailCost: { fontSize: 16, fontWeight: '800', color: '#059669' },
  modalCloseFullBtn: { backgroundColor: '#2f95dc', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  modalCloseFullBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Nuevo contenedor para el título y el botón
  titleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 15 
  },
  // Botón pequeñito
  smallShareBtn: { 
    backgroundColor: '#2f95dc', 
    padding: 10, 
    borderRadius: 20, 
    marginLeft: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
});