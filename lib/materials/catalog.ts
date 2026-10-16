/** Presentation aliases preserve database identities, stock and movement history. */
export type CatalogMaterial = { code: string; name: string; category?: string; material_type?: string };

const NAMES: Record<string, string> = {
  'PEAD-01': 'POLIETILENO DE ALTA',
  'CARB-01': 'CARBONATO',
  'LINEAL-01': 'POLIETILENO LINEAL',
  'TIN-A20470': 'NEGRO INTENSO',
  'TIN-A20125': 'ROJO 485C',
  'TIN-A20213': 'AMARILLO MEDIO',
  'TIN-A20210': 'AMARILLO PROCESS',
  'TIN-A20621': 'NARANJA',
  'TIN-A20342': 'AZUL REFLEX',
  'TIN-A20240': 'AZUL PROCESS',
  'TIN-A20201': 'BLANCO',
  'TIN-A20236': 'MAGENTA',
  'PIG-BLANCO': 'BLANCO',
  'PIG-BEIGE': 'BEIGE',
  'PIG-AMARILLO': 'AMARILLO',
  'PIG-AZUL': 'AZUL',
  'PIG-NARANJA': 'NARANJA',
  'PIG-NEGRO': 'NEGRO',
  'PIG-ROJO': 'ROJO',
  'PIG-VERDE-CLA': 'VERDE CLARO',
  'PIG-VERDE-OSC': 'VERDE OSCURO',
};
const ORDER: Record<string, string[]> = {
  principal: ['PEAD-01', 'CARB-01', 'LINEAL-01', 'BIO-01', 'PEBD-01', 'REC-BEIGE', 'REC-BLANCO'],
  pigmento: ['BLANCO', 'BEIGE', 'AMARILLO', 'AZUL', 'NARANJA', 'NEGRO', 'ROJO', 'VERDE CLARO', 'VERDE OSCURO'],
  tinta: ['NEGRO INTENSO', 'ROJO 485C', 'AMARILLO MEDIO', 'AMARILLO PROCESS', 'NARANJA', 'AZUL REFLEX', 'AZUL PROCESS', 'BLANCO', 'MAGENTA'],
};
export const MATERIAL_TYPES = ['RESINA', 'ADITIVO', 'PIGMENTOS', 'TINTAS'] as const;
export function materialName(material: CatalogMaterial): string {
  return NAMES[material.code] ?? ((material.category === 'pigmento' || material.code.startsWith('PIG-'))
    ? material.name.replace(/\bpigmentos?\b/gi, '').trim()
    : material.name).toLocaleUpperCase('es-CO');
}
export function materialType(material: CatalogMaterial): string {
  if (material.category === 'pigmento') return 'PIGMENTOS';
  if (material.category === 'tinta') return 'TINTAS';
  return ({ resina: 'RESINA', aditivo: 'ADITIVO', masterbatch: 'MASTERBATCH', otro: 'OTRO' } as Record<string, string>)[material.material_type ?? ''] ?? 'SIN CLASIFICAR';
}
// Code-based ordering is presentation-only; it does not assign a database category.
const CODES_WITHOUT_CATEGORY = [
  ...ORDER.principal,
  'PIG-BLANCO', 'PIG-BEIGE', 'PIG-AMARILLO', 'PIG-AZUL', 'PIG-NARANJA',
  'PIG-NEGRO', 'PIG-ROJO', 'PIG-VERDE-CLA', 'PIG-VERDE-OSC',
  'TIN-A20470', 'TIN-A20125', 'TIN-A20213', 'TIN-A20210', 'TIN-A20621',
  'TIN-A20342', 'TIN-A20240', 'TIN-A20201', 'TIN-A20236',
];
export function compareMaterials(a: CatalogMaterial, b: CatalogMaterial): number {
  if (!a.category || !b.category) {
    const rank = (material: CatalogMaterial) => {
      const index = CODES_WITHOUT_CATEGORY.indexOf(material.code);
      return index < 0 ? CODES_WITHOUT_CATEGORY.length : index;
    };
    return rank(a) - rank(b) || materialName(a).localeCompare(materialName(b), 'es-CO');
  }
  const categories = ['principal', 'pigmento', 'tinta', 'solvente'];
  const category = categories.indexOf(a.category) - categories.indexOf(b.category);
  if (category) return category;
  const order = ORDER[a.category] ?? [];
  const rank = (m: CatalogMaterial) => {
    const index = order.indexOf(m.category === 'principal' ? m.code : materialName(m));
    return index < 0 ? order.length : index;
  };
  return rank(a) - rank(b) || materialName(a).localeCompare(materialName(b), 'es-CO');
}
export function matchesMaterial(material: CatalogMaterial, search: string, type?: string | null): boolean {
  const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  return (!type || materialType(material) === type) && normalize(`${materialName(material)} ${material.name} ${material.code}`).includes(normalize(search.trim()));
}
