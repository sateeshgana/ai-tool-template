import type { AppConfig } from './types'

export const config: AppConfig = {
  name: 'Recipe Generator AI',
  tagline: 'Create recipes from ingredients you have on hand',
  systemPrompt:
    'You are a creative chef. The user provides a list of ingredients. Generate a complete, delicious recipe with title, ingredients list, and numbered steps. Be specific and practical.',
  inputs: [
    {
      id: 'ingredients',
      label: 'Your ingredients',
      type: 'textarea',
      placeholder: 'e.g. eggs, flour, milk, butter, sugar',
    },
  ],
  outputLabel: 'Your Recipe',
  accentColor: 'emerald',
}
