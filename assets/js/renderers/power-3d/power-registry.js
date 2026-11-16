export const KEY_TO_POWER3D = {
  sword: 'iron_sword', feather: 'feather', tnt: 'tnt', totem: 'totem', grass: 'ender_pearl',
  potion_odd: 'potion_red', potion_even: 'potion_blue',
  diamond_sword: 'diamond_sword', netherite_sword: 'netherite_sword', wooden_shield: 'wooden_shield',
  golden_apple: 'golden_apple', fire_charge: 'fire_charge', ice_crystal: 'ice_crystal',
  blaze_core: 'blaze_core', trident: 'trident', dragon_crystal: 'dragon_crystal', nether_star: 'nether_star'
};

export function power3dKey(gameKey) {
  const registry = typeof window !== 'undefined' && window.UT && window.UT.ItemRegistry;
  const manifest = registry && registry.shared().getItem('powerup.' + gameKey);
  const key = manifest && manifest.visual && manifest.visual.modelKey;
  return typeof key === 'string' && key ? key : KEY_TO_POWER3D[gameKey] || null;
}
