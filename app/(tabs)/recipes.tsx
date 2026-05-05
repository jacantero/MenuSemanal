import {useState, useCallback} from 'react'; // 1. Importamos useState para la memoria
import Fuse from 'fuse.js'; // Para mejorar la barra de búsqueda
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput} from 'react-native';
import {router, useFocusEffect} from 'expo-router'; //Importamos el enrutador
import {MOCK_RECIPES} from '../mockData'; //Importamos nuestros datos
import { FontAwesome } from '@expo/vector-icons';
// 1. NUESTROS DATOS FALSOS (Mock Data)
// Aquí preparamos toda la información que luego vendrá de tu base de datos.
// Fíjate que ya he incluido los ingredientes y las porciones base para tu futura calculadora.

export default function RecipesScreen() {

  //Filtrado de recetas
  const [searchQuery, setSearchQuery] = useState('');

  const [recipes, setRecipes] = useState(MOCK_RECIPES);

  useFocusEffect(
    useCallback(() => {
      setRecipes([...MOCK_RECIPES]); // Recarga la lista al entrar en la pantalla
    }, [])
  );

 const fuse = new Fuse(recipes, {
    keys: ['name'], // Le decimos que busque dentro del título de la receta
    threshold: 0.4, // El nivel de "perdón" (0 es exacto, 1 perdona todo). 0.4 es el estándar.
  });

  // 2. Filtramos la lista
  // Si hay algo escrito en el buscador, usa Fuse. Si está vacío, muestra la lista normal.
  const filteredRecipes = searchQuery 
    ? fuse.search(searchQuery).map(result => result.item) // Fuse devuelve un formato especial, lo adaptamos
    : recipes;
  //

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
        //Si no existe la receta, damos la opción de añadirla
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hemos encontrado "{searchQuery}"</Text>
            <TouchableOpacity 
              style={styles.createButton} 
              onPress={() => router.push('/recipe/new_recipe')}
            >
              <Text style={styles.createButtonText}>+ Añadir nueva receta</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 80,
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
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  createButton: { backgroundColor: '#2f95dc', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 15 },
  createButtonText: { color: '#fff', fontWeight: 'bold' }});