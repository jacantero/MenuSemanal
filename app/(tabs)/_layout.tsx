// Layout of the navigation bar, common to all screens

//1. Imports
import { Tabs } from 'expo-router'; //Tabs for the navigation bar
import { FontAwesome } from '@expo/vector-icons'; //FontAwesome for Icons

//2. Layout definition
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2f95dc' }}> //Main container of all tabs
      <Tabs.Screen
        name="index" // IMPORTANT: It must match the name of the Screen file (index.tsx)
        options={{
          title: 'Menú',
          tabBarIcon: ({ color }) => <FontAwesome name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recetas',
          tabBarIcon: ({ color }) => <FontAwesome name="book" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="buy_list"
        options={{
          title: 'Compra',
          tabBarIcon: ({ color }) => <FontAwesome name="shopping-cart" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}