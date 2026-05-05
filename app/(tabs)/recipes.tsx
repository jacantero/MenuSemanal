import {useState} from 'react'; // 1. Importamos useState para la memoria
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput} from 'react-native';
import {router} from 'expo-router'; //Importamos el enrutador
import {MOCK_RECIPES} from '../mockData'; //Importamos nuestros datos
// 1. NUESTROS DATOS FALSOS (Mock Data)
// Aquí preparamos toda la información que luego vendrá de tu base de datos.
// Fíjate que ya he incluido los ingredientes y las porciones base para tu futura calculadora.

export default function RecipesScreen() {

  //Filtrado de recetas
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecipes = MOCK_RECIPES.filter(recipe => 
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. EL MOLDE DE LA TARJETA
  // Esta función le dice a la lista cómo dibujar CADA UNA de las recetas.
  // Usamos TouchableOpacity para que haga un efecto de "botón pulsado" cuando el usuario lo toque.
  const renderRecipeCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: item.id } })} // Va a la carpeta recipes y genera el archivo según el id
    >
      {/* Contenedor del texto (Ocupa el espacio izquierdo) */}
      <View style={styles.textContainer}>
        <Text style={styles.recipeTitle}>{item.name}</Text>
      </View>
      
      {/* Imagen (Ocupa el espacio derecho) */}
      <Image 
        source={{ uri: item.imageUrl }} 
        style={styles.recipeImage} 
      />
    </TouchableOpacity>
  );

  // 3. LA VISTA PRINCIPAL
  return (
    <View style={styles.container}>
      {/* Buscador con fuse para mejorar la búsqueda*/}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar receta..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* FlatList es el motor mágico de React Native para hacer listas rápidas */}
      <FlatList
        data={filteredRecipes} // De dónde saca los datos
        keyExtractor={(item) => item.id} // Cómo identifica cada elemento para no confundirse
        renderItem={renderRecipeCard} // Qué molde usa para dibujarlos
        contentContainerStyle={styles.listContainer} // Estilos del contenedor de la lista
        ListEmptyComponent={
          <Text style={styles.emptyText}>No se han encontrado recetas.</Text>
        }
      />
    </View>
  );
}

// 4. LOS ESTILOS (Diseño basado en tu Figma)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e6f7ff', // Tu fondo azul clarito
  },
  searchBar: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2, // Sombra para Android
  },
  searchInput: {
    fontSize: 16,
    height: 40,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic'
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    flexDirection: 'row', // Clave: Pone el texto a la izquierda y la foto a la derecha
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden', // Evita que la foto se salga de las esquinas redondeadas
    borderWidth: 1,
    borderColor: '#000', // El borde negro de tu diseño
  },
  textContainer: {
    flex: 1, // Hace que el texto ocupe todo el espacio sobrante a la izquierda
    padding: 16,
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  recipeImage: {
    width: 120, // Ancho fijo para la imagen
    height: 100, // Alto fijo
    borderLeftWidth: 1,
    borderColor: '#000', // Borde negro separador entre texto y foto
  },
});