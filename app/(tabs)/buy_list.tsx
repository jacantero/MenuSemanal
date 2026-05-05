//Tab for Shopping list
import { View, Text, StyleSheet } from 'react-native';

export default function MenuScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Lista de la compra</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e6f7ff' },
  text: { fontSize: 20, fontWeight: 'bold' },
});