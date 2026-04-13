// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShoppingItem {
  item:     string;
  category: string; // protein | carbs | fats | vegetables | dairy | other
  amount:   string; // e.g. "500g", "6 units", "1 bag"
}

export interface WeekOverview {
  trainingDays: number;
  focus:        string;
}

export interface StrategyTemplate {
  name:           string;
  weekOverview:   WeekOverview;
  ingredientPool: string[];
  shoppingItems:  ShoppingItem[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // ── 1. Standard Training Week ──────────────────────────────────────────────
  {
    name: "Standard Training Week",
    weekOverview: {
      trainingDays: 4,
      focus: "Balanced carb cycling — higher carbs on training days, modest deficit on rest days.",
    },
    ingredientPool: [
      "rolled oats", "white rice", "sweet potato", "banana", "sourdough bread",
      "chicken breast", "salmon fillet", "eggs", "Greek yogurt",
      "broccoli", "spinach", "cherry tomatoes", "cucumber",
      "olive oil", "avocado", "almonds",
      "whole milk", "cheddar cheese",
    ],
    shoppingItems: [
      { item: "Rolled oats",       category: "carbs",      amount: "1 kg" },
      { item: "White rice",        category: "carbs",      amount: "1 kg" },
      { item: "Sweet potato",      category: "carbs",      amount: "1 kg" },
      { item: "Bananas",           category: "carbs",      amount: "7 units" },
      { item: "Sourdough bread",   category: "carbs",      amount: "1 loaf" },
      { item: "Chicken breast",    category: "protein",    amount: "1.2 kg" },
      { item: "Salmon fillets",    category: "protein",    amount: "600 g" },
      { item: "Eggs",              category: "protein",    amount: "12 units" },
      { item: "Greek yogurt",      category: "dairy",      amount: "1 kg" },
      { item: "Whole milk",        category: "dairy",      amount: "2 L" },
      { item: "Cheddar cheese",    category: "dairy",      amount: "200 g" },
      { item: "Broccoli",          category: "vegetables", amount: "500 g" },
      { item: "Spinach",           category: "vegetables", amount: "200 g" },
      { item: "Cherry tomatoes",   category: "vegetables", amount: "400 g" },
      { item: "Cucumber",          category: "vegetables", amount: "2 units" },
      { item: "Olive oil",         category: "fats",       amount: "500 ml" },
      { item: "Avocado",           category: "fats",       amount: "4 units" },
      { item: "Almonds",           category: "fats",       amount: "200 g" },
    ],
  },

  // ── 2. High Volume Week ────────────────────────────────────────────────────
  {
    name: "High Volume Week",
    weekOverview: {
      trainingDays: 6,
      focus: "Carb-forward — maximise glycogen storage and fast recovery across back-to-back training days.",
    },
    ingredientPool: [
      "white rice", "pasta", "white bread", "rice cakes", "potatoes",
      "dates", "banana", "orange juice", "honey",
      "chicken breast", "tuna (tinned)", "eggs", "Greek yogurt",
      "broccoli", "peas", "carrot",
      "olive oil", "peanut butter",
      "whole milk",
    ],
    shoppingItems: [
      { item: "White rice",         category: "carbs",      amount: "2 kg" },
      { item: "Pasta",              category: "carbs",      amount: "1 kg" },
      { item: "White bread",        category: "carbs",      amount: "1 loaf" },
      { item: "Rice cakes",         category: "carbs",      amount: "2 packs" },
      { item: "Potatoes",           category: "carbs",      amount: "1.5 kg" },
      { item: "Dates",              category: "carbs",      amount: "400 g" },
      { item: "Bananas",            category: "carbs",      amount: "10 units" },
      { item: "Orange juice",       category: "carbs",      amount: "1.5 L" },
      { item: "Honey",              category: "carbs",      amount: "340 g" },
      { item: "Chicken breast",     category: "protein",    amount: "1.5 kg" },
      { item: "Tuna (tinned)",      category: "protein",    amount: "6 cans" },
      { item: "Eggs",               category: "protein",    amount: "12 units" },
      { item: "Greek yogurt",       category: "dairy",      amount: "1 kg" },
      { item: "Whole milk",         category: "dairy",      amount: "2 L" },
      { item: "Broccoli",           category: "vegetables", amount: "400 g" },
      { item: "Peas (frozen)",      category: "vegetables", amount: "500 g" },
      { item: "Carrot",             category: "vegetables", amount: "4 units" },
      { item: "Olive oil",          category: "fats",       amount: "500 ml" },
      { item: "Peanut butter",      category: "fats",       amount: "340 g" },
    ],
  },

  // ── 3. Recovery / Easy Week ────────────────────────────────────────────────
  {
    name: "Recovery / Easy Week",
    weekOverview: {
      trainingDays: 2,
      focus: "Calorie deficit with high protein — preserve muscle, reduce inflammation, reset gut.",
    },
    ingredientPool: [
      "eggs", "chicken breast", "tuna (tinned)", "salmon fillet", "cottage cheese",
      "lean beef mince", "Greek yogurt",
      "sweet potato", "rolled oats", "brown rice",
      "spinach", "kale", "courgette", "bell pepper", "broccoli",
      "olive oil", "almonds", "walnuts",
      "whole milk",
    ],
    shoppingItems: [
      { item: "Eggs",               category: "protein",    amount: "12 units" },
      { item: "Chicken breast",     category: "protein",    amount: "1 kg" },
      { item: "Tuna (tinned)",      category: "protein",    amount: "4 cans" },
      { item: "Salmon fillets",     category: "protein",    amount: "500 g" },
      { item: "Cottage cheese",     category: "protein",    amount: "500 g" },
      { item: "Lean beef mince",    category: "protein",    amount: "500 g" },
      { item: "Greek yogurt",       category: "dairy",      amount: "500 g" },
      { item: "Whole milk",         category: "dairy",      amount: "1 L" },
      { item: "Sweet potato",       category: "carbs",      amount: "500 g" },
      { item: "Rolled oats",        category: "carbs",      amount: "500 g" },
      { item: "Brown rice",         category: "carbs",      amount: "500 g" },
      { item: "Spinach",            category: "vegetables", amount: "300 g" },
      { item: "Kale",               category: "vegetables", amount: "200 g" },
      { item: "Courgette",          category: "vegetables", amount: "3 units" },
      { item: "Bell pepper",        category: "vegetables", amount: "4 units" },
      { item: "Broccoli",           category: "vegetables", amount: "500 g" },
      { item: "Olive oil",          category: "fats",       amount: "500 ml" },
      { item: "Almonds",            category: "fats",       amount: "150 g" },
      { item: "Walnuts",            category: "fats",       amount: "150 g" },
    ],
  },

  // ── 4. Budget Friendly ─────────────────────────────────────────────────────
  {
    name: "Budget Friendly",
    weekOverview: {
      trainingDays: 4,
      focus: "Performance nutrition on a budget — eggs, tinned fish, oats, frozen veg, and legumes as staples.",
    },
    ingredientPool: [
      "rolled oats", "white rice", "white bread", "potato",
      "eggs", "tuna (tinned)", "sardines (tinned)", "chicken thighs",
      "red lentils", "chickpeas (tinned)", "baked beans",
      "banana", "apple",
      "frozen peas", "frozen spinach", "frozen broccoli", "carrot", "onion",
      "sunflower oil", "peanut butter",
      "semi-skimmed milk",
    ],
    shoppingItems: [
      { item: "Rolled oats",          category: "carbs",      amount: "1 kg" },
      { item: "White rice",           category: "carbs",      amount: "1 kg" },
      { item: "White bread",          category: "carbs",      amount: "1 loaf" },
      { item: "Potatoes",             category: "carbs",      amount: "1.5 kg" },
      { item: "Bananas",              category: "carbs",      amount: "7 units" },
      { item: "Apples",               category: "carbs",      amount: "6 units" },
      { item: "Eggs",                 category: "protein",    amount: "18 units" },
      { item: "Tuna (tinned)",        category: "protein",    amount: "6 cans" },
      { item: "Sardines (tinned)",    category: "protein",    amount: "4 cans" },
      { item: "Chicken thighs",       category: "protein",    amount: "1 kg" },
      { item: "Red lentils",          category: "protein",    amount: "500 g" },
      { item: "Chickpeas (tinned)",   category: "protein",    amount: "2 cans" },
      { item: "Baked beans (tinned)", category: "protein",    amount: "2 cans" },
      { item: "Semi-skimmed milk",    category: "dairy",      amount: "2 L" },
      { item: "Frozen peas",          category: "vegetables", amount: "500 g" },
      { item: "Frozen spinach",       category: "vegetables", amount: "500 g" },
      { item: "Frozen broccoli",      category: "vegetables", amount: "500 g" },
      { item: "Carrot",               category: "vegetables", amount: "6 units" },
      { item: "Onion",                category: "vegetables", amount: "6 units" },
      { item: "Sunflower oil",        category: "fats",       amount: "500 ml" },
      { item: "Peanut butter",        category: "fats",       amount: "340 g" },
    ],
  },
];
