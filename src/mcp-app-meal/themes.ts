/**
 * Cuisine and weather visual themes for meal UI cards.
 */

export interface CuisineTheme {
  emoji: string;
  gradient: string;
}

export function getCuisineTheme(cuisine: string): CuisineTheme {
  const c = cuisine.toLowerCase();
  if (c.includes('italian') || c.includes('pizza') || c.includes('pasta'))
    return { emoji: '🍝', gradient: 'linear-gradient(135deg, #c62828 0%, #e57373 100%)' };
  if (c.includes('japanese') || c.includes('sushi') || c.includes('ramen'))
    return { emoji: '🍣', gradient: 'linear-gradient(135deg, #283593 0%, #7986cb 100%)' };
  if (c.includes('mexican') || c.includes('taco') || c.includes('burrito'))
    return { emoji: '🌮', gradient: 'linear-gradient(135deg, #e65100 0%, #ffb74d 100%)' };
  if (c.includes('thai'))
    return { emoji: '🍜', gradient: 'linear-gradient(135deg, #1b5e20 0%, #66bb6a 100%)' };
  if (c.includes('chinese') || c.includes('dim sum'))
    return { emoji: '🥟', gradient: 'linear-gradient(135deg, #b71c1c 0%, #ef9a9a 100%)' };
  if (c.includes('indian') || c.includes('curry'))
    return { emoji: '🍛', gradient: 'linear-gradient(135deg, #bf360c 0%, #ff8a65 100%)' };
  if (c.includes('french'))
    return { emoji: '🥐', gradient: 'linear-gradient(135deg, #0d47a1 0%, #64b5f6 100%)' };
  if (c.includes('burger') || c.includes('american'))
    return { emoji: '🍔', gradient: 'linear-gradient(135deg, #4e342e 0%, #a1887f 100%)' };
  if (c.includes('greek'))
    return { emoji: '🫒', gradient: 'linear-gradient(135deg, #004d40 0%, #4db6ac 100%)' };
  if (c.includes('korean'))
    return { emoji: '🥩', gradient: 'linear-gradient(135deg, #880e4f 0%, #f48fb1 100%)' };
  if (c.includes('vietnamese') || c.includes('pho'))
    return { emoji: '🍲', gradient: 'linear-gradient(135deg, #33691e 0%, #aed581 100%)' };
  if (c.includes('spanish') || c.includes('tapas'))
    return { emoji: '🥘', gradient: 'linear-gradient(135deg, #f57f17 0%, #fff176 100%)' };
  return { emoji: '🍽️', gradient: 'linear-gradient(135deg, #01579b 0%, #4fc3f7 100%)' };
}

export function getWeatherTheme(conditions: string): { emoji: string; gradient: string } {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))
    return { emoji: '⛈️', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' };
  if (c.includes('snow') || c.includes('sleet'))
    return { emoji: '❄️', gradient: 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)' };
  if (c.includes('rain'))
    return { emoji: '🌧️', gradient: 'linear-gradient(135deg, #373B44 0%, #4286f4 100%)' };
  if (c.includes('drizzle'))
    return { emoji: '🌦️', gradient: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' };
  if (c.includes('fog') || c.includes('mist') || c.includes('haze'))
    return { emoji: '🌫️', gradient: 'linear-gradient(135deg, #8e9eab 0%, #c8d6df 100%)' };
  if (c.includes('cloud') || c.includes('overcast'))
    return { emoji: '☁️', gradient: 'linear-gradient(135deg, #616161 0%, #9bc5c3 100%)' };
  return { emoji: '☀️', gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' };
}
