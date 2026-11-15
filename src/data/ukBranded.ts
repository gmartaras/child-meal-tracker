import type { Food, LabelSource, Measure } from '../domain/types'

const checkedOn = '2026-11-15'
const version = 'uk-branded-2026-11-15.1'

/** Per 100 g as sold: kJ, kcal, fat, saturates, carbohydrate, sugars, fibre, protein, salt. */
type Macro = number | `<${number}` | null
type LabelMacros = [Macro, Macro, Macro, Macro, Macro, Macro, Macro, Macro, Macro]
const keys = ['kj', 'energy', 'fat', 'satfat', 'carb', 'sugars', 'fibre', 'protein', 'salt']

function label(
  id: string, brand: string, product: string, group: string, url: string, macros: LabelMacros,
  portions: Measure[], extra: Record<string, Macro> = {}, publisher: LabelSource['publisher'] = 'manufacturer',
): Food {
  const declared = Object.fromEntries(keys.map((key, i) => [key, macros[i]]))
  const values: Food['values'] = {}
  const bounds: Record<string, string> = {}
  for (const [key, value] of Object.entries({...declared, ...extra})) {
    if (typeof value === 'number') values[key] = value
    if (typeof value === 'string') bounds[key] = value
  }
  return {
    id: `b:${id}`, name: `${brand} ${product}`, brand, kind: 'food', group, per: 100, unit: 'g', values,
    labelMeasures: portions,
    labelSource: {url, publisher, checkedOn, version, ...(Object.keys(bounds).length ? {bounds} : {})},
  }
}

const portion = (amount: number, name = 'label serving'): Measure[] => [{label: name, amount}]
const biscuits = (two: number): Measure[] => [{label: 'one biscuit', amount: two / 2}, {label: 'two biscuits', amount: two}]
const weet = 'https://weetabix.co.uk/our-products/'
const kell = 'https://www.kelloggs.co.uk/en_GB/products/'
const nestle = 'https://www.nestle-cereals.com/uk/brands/'
const nairns = 'https://nairns.com/our-range/our-oatcakes/'
const organix = 'https://www.organix.com/our-foods/'
const ella = 'https://www.ellaskitchen.co.uk/shop/'
const weetVitamins = {thiamin: 0.94, riboflavin: 1.2, niacin: 14, folic_acid: 170}
const kellVitamins = {vitd: 8.4, thiamin: 0.91, riboflavin: 1.2, niacin: 13, b6: 1.2, folic_acid: 166, b12: 2.1, iron: 8}

/** Curated facts from the linked UK label tables. No values carried over from generic CoFID equivalents. */
export const UK_BRANDED_FOODS: readonly Food[] = [
  label('weetabix-original', 'Weetabix', 'Original', 'A', weet+'original-classic/weetabix/',
    [1531,362,2,0.6,69,4.2,10,12,0.28], biscuits(37.5), {...weetVitamins, iron:12}),
  label('weetabix-banana', 'Weetabix', 'Banana', 'A', weet+'weetabix/weetabix-banana/',
    [1527,361,1.9,0.4,70,13,10,11,0.20], biscuits(44), {...weetVitamins, iron:12}),
  label('weetabix-chocolate', 'Weetabix', 'Chocolate', 'A', weet+'weetabix/weetabix-chocolate/',
    [1547,366,3.8,1.6,68,17,10,10,0.18], biscuits(45), {...weetVitamins, iron:12}),
  label('weetabix-minis-chocolate-chip', 'Weetabix', 'Crispy Minis Chocolate Chip', 'A', weet+'minis/weetabix-minis-chocolate/',
    [1629,386,5.1,2.3,70,17,10,10,0.16], portion(40), {...weetVitamins, iron:12, vitd:4.3}),
  label('weetabix-minis-fruit-nut', 'Weetabix', 'Crispy Minis Fruit & Nut', 'A', weet+'minis/weetabix-minis-fruit-nut/',
    [1581,374,3.9,0.7,69,18,9.6,11,0.17], portion(40), {...weetVitamins, iron:12, vitd:4.3}),
  label('weetabix-protein-crunch-chocolate', 'Weetabix', 'Protein Crunch Chocolate', 'A', weet+'weetabix-protein/weetabix-protein-crunch-chocolate/',
    [1588,375,2.8,0.7,64,22,7.1,20,0.28], portion(30), {vitd:4.5, thiamin:0.99, riboflavin:1.3, niacin:14, b6:1.3, folic_acid:180, b12:2.3, iron:13}),
  label('oatibix-original', 'Oatibix', 'Original Biscuits', 'A', weet+'oatibix/weetabix-oatibix-classic/',
    [1641,390,8,1.3,63,4.8,8.8,12,0.23], biscuits(50), weetVitamins),
  label('kelloggs-rice-krispies', "Kellogg's", 'Rice Krispies Original', 'A', kell+'rice-krispies.html',
    [1649,389,1.2,0.4,86,7.9,2.9,7,1], portion(30), kellVitamins),
  label('kelloggs-corn-flakes', "Kellogg's", 'Corn Flakes', 'A', kell+'kellogg-s-corn-flakes.html',
    [1604,378,0.9,0.2,84,8,3,7,1.1], portion(30)),
  label('kelloggs-coco-pops', "Kellogg's", 'Coco Pops', 'A', kell+'coco-pops.html/1000',
    [1636,386,1.9,0.9,84,17,3.8,6.3,0.65], portion(30), kellVitamins),
  label('kelloggs-frosties', "Kellogg's", 'Frosties', 'A', kell+'frosties.html',
    [1594,375,0.6,0.1,87,37,2,4.5,0.83], portion(35), kellVitamins),
  label('kelloggs-special-k-original', "Kellogg's", 'Special K Original', 'A', kell+'special-k-original.html',
    [1660,392,1.3,0.3,84,15,6,8,0.84], portion(30), {vitd:8.4, thiamin:1.8, riboflavin:2.3, niacin:16, b6:1.4, folic_acid:334, b12:2.5, iron:14}),
  label('kelloggs-coco-pops-loops', "Kellogg's", 'Coco Pops Loops', 'A', kell+'coco-pops-loops.html',
    [1617,383,3.4,1.6,74,21,8.2,10,0.14], portion(30), {...kellVitamins, vitd:8.3}),
  label('kelloggs-rice-krispies-bar', "Kellogg's", 'Rice Krispies Snack Bar', 'S', kell+'rice-krispies-cereal-and-milk-bar.html',
    [1759,417,11,8.5,73,29,3,5.1,0.55], portion(20,'one bar'), {vitd:5, calcium:800}),
  label('kelloggs-coco-pops-bar', "Kellogg's", 'Coco Pops Snack Bar', 'S', kell+'coco-pops-cereal-milk-bar.html',
    [1729,411,11,8,70,26,4.4,5.7,0.46], portion(20,'one bar'), {vitd:5, calcium:800}),
  label('nestle-shredded-wheat-original', 'Nestlé', 'Shredded Wheat Original', 'A', nestle+'shredded-wheat/original',
    [1506,357,2.2,0.5,64.9,0.7,14,12.3,0.05], biscuits(45)),
  label('nestle-shredded-wheat-bitesize', 'Nestlé', 'Shredded Wheat Bitesize', 'A', nestle+'shredded-wheat/bitesize',
    [1535,363,2.3,0.5,66.1,0.7,14.2,12.5,0.05], portion(40)),
  label('nestle-shreddies-original', 'Nestlé', 'Shreddies Original', 'A', nestle+'shreddies/original',
    [null,364,1.8,0.3,70.4,12.5,12,10.8,0.72], portion(40), {riboflavin:0.91, niacin:11, b6:1, folic_acid:112, panto:4, iron:7.7}),
  label('nestle-nesquik-original', 'Nestlé', 'Nesquik Original Cereal', 'A', nestle+'nesquik-cereal/original',
    [1586,375,2.9,0.7,74.3,22,8.6,8.6,0.2], portion(30), {vitd:2.6, thiamin:1.1, riboflavin:1.5, niacin:16, b6:1.5, folic_acid:201, panto:6.5, calcium:501, iron:11}),
  label('nestle-cheerios-multigrain', 'Nestlé', 'Multigrain Cheerios', 'A', nestle+'cheerios/multigrain',
    [1605,380,4.8,0.9,69.8,17.7,9.2,9.9,0.8], portion(30), {vitd:3.1, vitc:40, riboflavin:0.84, niacin:12, b6:0.95, folic_acid:177, panto:3.4, calcium:537, iron:11}),
  label('aldi-harvest-morn-wheat-bisks', 'Aldi Harvest Morn', 'Wheat Bisks', 'A',
    'https://www.aldi.co.uk/product/harvest-morn-wheat-bisks-36-pack-000000000000337432', [1514,358,2,0.6,68,4.4,10,12,0.28], [], {}, 'retailer'),
  label('nairns-rough-oatcakes', "Nairn's", 'Rough Oatcakes', 'A', nairns+'rough-oatcakes',
    [1865,445,17.5,6.1,55.8,0.7,10.4,11,1.46], []),
  label('nairns-fine-milled-oatcakes', "Nairn's", 'Fine Milled Oatcakes', 'A', nairns+'fine-milled-oatcakes',
    [1952,466,20.4,8.1,55,0.7,9,11.2,1.61], []),
  label('nairns-cheese-oatcakes', "Nairn's", 'Cheese Oatcakes', 'A', nairns+'cheese-oatcakes',
    [1975,473,26.6,12,44.7,0.6,7.2,13.6,2.8], []),
  label('nairns-gluten-free-original-oatcakes', "Nairn's", 'Gluten Free Original Oatcakes', 'A', nairns+'gluten-free-original-oatcakes',
    [1987,475,22.8,9.1,52.1,0.8,8.4,11.2,1.62], []),
  label('organix-melty-carrot-puffs', 'Organix', 'Melty Carrot Puffs', 'S', organix+'baby/melty-carrot-puffs',
    [1770,420,11,1.3,70,5.9,6,7.5,0.12], [], {sodium:50, thiamin:0.6}),
  label('organix-melty-sweetcorn-rings', 'Organix', 'Melty Sweetcorn Rings', 'S', organix+'baby/melty-sweetcorn-rings',
    [1894,450,14,1.7,70,4,4,8.7,'<0.01'], [], {sodium:'<10', thiamin:0.6}),
  label('organix-carrot-cake-oaty-bar', 'Organix', 'Carrot Cake Soft Oaty Bar', 'S', organix+'toddler/carrot-cake-soft-oaty-bars',
    [1720,411,15,1.8,55,22,12,7.9,0.1], portion(23,'one bar'), {sodium:40}),
  label('kiddylicious-veggie-straws-original', 'Kiddylicious', 'Veggie Straws Original', 'S',
    'https://www.waitrose.com/ecom/products/kiddylicious-veggie-straws/417429-583226-583227', [2142,512,26,2,61,0.5,3.1,6.2,0.60], portion(12,'one 12 g bag'), {}, 'retailer'),
  label('babybel-mini-original', 'Babybel', 'Mini Original', 'B', 'https://babybel.co.uk/product/mini-babybel-original/',
    [1225,295,23,15.5,'<0.01','<0.01',null,22,1.7], portion(20,'one mini cheese'), {calcium:680}),
  label('yoplait-frubes-variety', 'Yoplait', 'Frubes Yoghurt Tubes Variety', 'B', 'https://yoplait.co.uk/product/frubes-variety/',
    [385,91,2.7,1.8,12,10.8,null,3.7,0.15], portion(37,'one tube'), {calcium:162, vitd:3.4}),
  label('ellas-kitchen-banana-apple-puree', "Ella's Kitchen", 'Bananas & Apples Purée', 'F', ella+'bananas-apples-puree',
    [264,62,'<0.5','<0.1',13.6,13.1,1.5,0.5,0.04], portion(120,'one pouch')),
  label('ellas-kitchen-strawberry-apple-puree', "Ella's Kitchen", 'Strawberries & Apples Purée', 'F', ella+'strawberries-apples-puree',
    [192,45,'<0.5','<0.1',10.2,9.8,1.2,'<0.5',0.03], portion(120,'one pouch')),
  label('ellas-kitchen-banana-puree', "Ella's Kitchen", 'Banana Purée', 'F', ella+'bananas-baby-puree',
    [381,90,'<0.5',0.1,20.2,19.5,1.7,1,0.09], portion(70,'one pouch')),
]
