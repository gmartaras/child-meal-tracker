import type { Food, LabelSource, Measure } from '../domain/types'

const checkedOn = '2026-11-15'
const version = 'uk-branded-2026-11-15.1'

/** Per 100 g or 100 ml: kJ, kcal, fat, saturates, carbohydrate, sugars, fibre, protein, salt. */
type Macro = number | `<${number}` | null
type LabelMacros = [Macro, Macro, Macro, Macro, Macro, Macro, Macro, Macro, Macro]
type LabelOptions = Pick<Partial<LabelSource>, 'publisher' | 'preparation'> & { unit?: 'g' | 'ml' }
const keys = ['kj', 'energy', 'fat', 'satfat', 'carb', 'sugars', 'fibre', 'protein', 'salt']

function label(
  id: string, brand: string, product: string, group: string, url: string, macros: LabelMacros,
  portions: Measure[], extra: Record<string, Macro> = {}, options: LabelOptions = {},
): Food {
  const {publisher = 'manufacturer', preparation, unit = 'g'} = options
  const declared = Object.fromEntries(keys.map((key, i) => [key, macros[i]]))
  const values: Food['values'] = {}
  const bounds: Record<string, string> = {}
  for (const [key, value] of Object.entries({...declared, ...extra})) {
    if (typeof value === 'number') values[key] = value
    if (typeof value === 'string') bounds[key] = value
  }
  return {
    id: `b:${id}`, name: `${brand} ${product}`, brand, kind: 'food', group, per: 100, unit, values,
    labelMeasures: portions,
    labelSource: {
      url, publisher, checkedOn, version,
      ...(preparation ? {preparation} : {}),
      ...(Object.keys(bounds).length ? {bounds} : {}),
    },
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
const tesco = 'https://www.tesco.com/shop/en-GB/products/'
const warburtons = 'https://www.warburtons.co.uk/products/'
const alpro = 'https://www.alpro.com/en-gb/products/drinks/'
const retailer = {publisher: 'retailer'} as const
const ovenBaked = {preparation: 'oven baked'} as const
const drink = {unit: 'ml'} as const
const alproVitamins = {calcium:120, vitd:0.75, riboflavin:0.21}
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
    'https://www.aldi.co.uk/product/harvest-morn-wheat-bisks-36-pack-000000000000337432', [1514,358,2,0.6,68,4.4,10,12,0.28], [], {}, retailer),
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
    'https://www.waitrose.com/ecom/products/kiddylicious-veggie-straws/417429-583226-583227', [2142,512,26,2,61,0.5,3.1,6.2,0.60], portion(12,'one 12 g bag'), {}, retailer),
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

  label('warburtons-medium-white-400g', 'Warburtons', 'Medium White Bread (400 g loaf)', 'A',
    warburtons+'breakfast/bread/medium-white-400g/', [1025,244,2,0.5,45.4,2.9,2.1,9.1,0.95], portion(23.7,'one slice')),
  label('warburtons-original-toastie-400g', 'Warburtons', 'Original Toastie White Bread (400 g loaf)', 'A',
    warburtons+'bread/white/toastie-white-400g-2/', [1025,244,2,0.5,45.4,2.9,2.1,9.1,0.95], portion(28.8,'one slice')),
  label('warburtons-wholemeal-medium-400g', 'Warburtons', 'Medium Wholemeal Bread (400 g loaf)', 'A',
    warburtons+'lunch/bread/wholemeal-medium-400g/', [974,231,2.8,0.5,37.8,2.4,6.4,10.6,0.95], portion(23.8,'one slice')),
  label('warburtons-original-crumpets', 'Warburtons', 'Original Crumpets', 'A',
    warburtons+'crumpets/6-crumpets/', [739,176,0.8,0.2,35.3,2,2,6,1.48], portion(55,'one crumpet')),
  label('pom-bear-original', 'Pom-Bear', 'Original Potato Snacks (15 g bag)', 'S',
    tesco+'278416209', [2209,528,28,2.7,64,1.2,2.4,3.2,1.7], portion(15,'one bag'), {}, retailer),
  label('tesco-mini-breadsticks', 'Tesco', 'Mini Breadsticks', 'A',
    tesco+'272651665', [1769,419,8.9,2.4,72.3,3,3.2,11,1.2], portion(20,'one pack'), {}, retailer),
  label('soreen-malt-lunchbox-loaf', 'Soreen', 'Malt Lunchbox Loaves', 'A',
    tesco+'308477321', [1245,294,1.4,0.3,60,17,4.6,8.4,0.55], portion(30,'one mini loaf'), {}, retailer),
  label('walkers-quavers-cheese', 'Walkers', 'Quavers Cheese (20 g bag)', 'S',
    tesco+'268171357', [2245,536,30.8,2.7,62.1,2.7,1.2,2.5,2.14], portion(20,'one bag'), {}, retailer),
  label('heinz-baked-beans', 'Heinz', 'Original Baked Beans (Beanz)', 'D',
    tesco+'302317878', [329,78,0.2,'<0.1',12.5,4.7,3.7,4.7,0.6], portion(207.5,'half can (415 g tin)'), {}, retailer),
  label('heinz-no-added-sugar-baked-beans', 'Heinz', 'No Added Sugar Baked Beans (Beanz)', 'D',
    tesco+'321332871', [277,66,0.2,0.09,9.5,1.9,3.6,4.6,0.4], portion(207.5,'half can (415 g tin)'), {}, retailer),
  label('heinz-spaghetti-hoops', 'Heinz', 'Spaghetti Hoops in Tomato Sauce', 'A',
    'https://www.waitrose.com/ecom/products/heinz-spaghetti-hoops-in-tomato-sauce/019125-9247-9248',
    [218,52,0.2,0.1,10.4,3.9,0.6,1.6,0.4], portion(205,'one 205 g can'), {vitd:0.37, iron:1}, retailer),
  label('tesco-spaghetti-hoops', 'Tesco', 'Everyday Value Spaghetti Hoops', 'A',
    tesco+'274965814', [211,50,0.3,0.1,10,4,0.7,1.4,0.3], portion(205,'half can (410 g tin)'), {}, retailer),
  label('cheestrings-original', 'Strings & Things', 'Cheestrings Original', 'B',
    tesco+'273197498', [1264,304,22.5,14,2.5,1,null,23,1.8], portion(20,'one cheese string'),
    {calcium:780, vitd:3.75, b6:1.05, b12:1.88}, retailer),
  label('petits-filous-strawberry-raspberry', 'Petits Filous', 'Strawberry & Raspberry Fromage Frais Small Pots', 'B',
    'https://www.petitsfilous.co.uk/products/petits-filous-strawberry-and-raspberry-fromage-frais/',
    [361,86,2.4,1.6,9.9,9.4,null,5.3,0.12], [], {calcium:150, vitd:2.9}),
  label('birdseye-cod-fish-fingers', 'Birds Eye', 'Breaded Cod Fish Fingers (as sold)', 'J',
    'https://groceries.morrisons.com/products/birds-eye-18-breaded-cod-fish-fingers-504g/113796560',
    [866,207,9,0.7,19,0.9,0.8,12,0.51], portion(28,'one finger (pack average)'), {}, retailer),
  label('birdseye-breaded-chicken-nuggets', 'Birds Eye', 'Wholegrain Breaded Chicken Nuggets (as sold)', 'M',
    tesco+'302861797', [1196,286,14,1.7,25,'<0.5',1.9,14,0.91], [], {}, retailer),
  label('mccain-potato-smiles-oven', 'McCain', 'Potato Smiles (oven baked)', 'D',
    'https://www.mccain.co.uk/potato-smiles/', [972,232,11,1.2,30,0.5,2.4,2.6,0.38], portion(51,'three pieces'), {}, ovenBaked),
  label('mccain-home-chips-straight-cut-oven', 'McCain', 'Straight Cut Home Chips (oven baked)', 'D',
    'https://www.mccain.co.uk/home-chips-straight-cut/', [846,202,7.2,0.9,30,0.5,2.7,3.2,0.27], portion(110,'label serving'), {}, ovenBaked),
  label('tesco-mini-margherita-pizza-pops', 'Tesco', 'Mini Margherita Pizza Pops (as sold)', 'A',
    tesco+'317536394', [1316,316,21.1,7.8,20,3.6,1.4,10.8,1.66], portion(18,'one pizza pop'), {}, retailer),
  label('alpro-oat-original-uht', 'Alpro', 'Original Oat Drink (long life)', 'BC', alpro+'oat-original',
    [188,45,1.5,0.2,6.3,3.2,1.4,0.8,0.08], [], {...alproVitamins, iodine:22.5}, drink),
  label('alpro-oat-no-sugars-uht', 'Alpro', 'Oat Drink No Sugars (long life)', 'BC', alpro+'oat-no-sugars',
    [183,44,1.8,0.2,5.5,0,1.3,0.7,0.09], [], {...alproVitamins, iodine:22.5, b12:0.38}, drink),
  label('alpro-soya-original-uht', 'Alpro', 'Original Soya Drink (long life)', 'BC', alpro+'soya-original',
    [175,42,1.9,0.3,2.7,2.5,0.6,3.3,0.09], [], {...alproVitamins, b12:0.38}, drink),
  label('alpro-soya-no-sugars-uht', 'Alpro', 'Soya Drink No Sugars (long life)', 'BC', alpro+'soya-no-sugars',
    [138,33,1.9,0.3,0,0,0.6,3.3,0.09], [], {...alproVitamins, b12:0.38}, drink),
  label('meridian-smooth-peanut-butter', 'Meridian', 'Smooth Peanut Butter (100% nuts)', 'G',
    tesco+'284847836', [2514,606,47,6.3,16,5.3,8.1,26,0.02], portion(15), {}, retailer),
  label('tesco-smooth-peanut-butter', 'Tesco', 'Smooth Peanut Butter', 'G',
    tesco+'264769626', [2610,630,50.7,8.8,13.1,6.8,6.5,27,0.4], portion(15,'one tablespoon'), {}, retailer),
  label('tesco-houmous', 'Tesco', 'Houmous', 'D',
    tesco+'320553052', [1254,303,25.4,2.4,11,0.6,3.3,6,0.7], portion(50,'quarter pot (200 g tub)'), {}, retailer),
  label('dole-tropical-fruit-in-juice', 'Dole', 'Tropical Fruit in Juice Pots', 'F',
    'https://www.dolesunshine.com/uk/en/products/tropical-fruit-in-juice/',
    [225,54,0,0,12,12,1.1,0,0], portion(113,'one pot including juice')),
  label('dole-fruit-salad-in-juice', 'Dole', 'Fruit Salad in Juice Pots', 'F',
    'https://www.dolesunshine.com/uk/en/products/fruit-salad-in-juice/',
    [235,56,0,0,13,13,0.8,0,0], portion(113,'one pot including juice')),
]
