export const MOCK_RECIPES = [
  {
    id: '1',
    name: 'Espaguetis a la carbonara',
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=400&q=80',
    baseDiners: 2,
    ingredients: [
      { name: 'Espaguetis', amount: 200, unit: 'g' },
      { name: 'Guanciale', amount: 100, unit: 'g' },
      { name: 'Yemas de huevo', amount: 3, unit: 'ud' },
    ],
    instructions: ['Hervir la pasta en agua con mucha sal.', 'Dorar el guanciale en una sartén sin aceite extra.', 'Mezclar las yemas con el queso pecorino y un poco de agua de cocción.', 'Unir todo fuera del fuego para que el huevo no se cuaje.']
  },
  {
    id: '2',
    name: 'Lentejas estofadas',
    imageUrl: 'https://images.unsplash.com/photo-1538220856186-0be0e085984d?auto=format&fit=crop&w=400&q=80',
    baseDiners: 4,
    ingredients: [
      { name: 'Lentejas pardinas', amount: 400, unit: 'g' },
      { name: 'Zanahoria', amount: 2, unit: 'ud' },
      { name: 'Chorizo', amount: 1, unit: 'ud' },
    ],
    instructions: ['Picar finamente las verduras.', 'Hacer un sofrito a fuego lento.', 'Añadir las lentejas, el chorizo entero y cubrir con agua fría.', 'Cocer a fuego medio durante 40-45 minutos.']
  },
];