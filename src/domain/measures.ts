/**
 * Household measures.
 *
 * STARTER LIST — typical UK portion weights for foods commonly eaten by infants and toddlers.
 * They are approximations to speed up data entry and should be reviewed by the practitioner;
 * any measure can be overridden per food from the entry screen ("Add a measure…").
 */
import { BREAST_MILK_ID } from './foods'
import type { BreastMilkSettings, Food, Measure } from './types'

type Rule = { test: RegExp; group?: RegExp; not?: RegExp; measures: [string, number][] }

// amounts are grams unless the rule is flagged ml:true below
const RULES: Rule[] = [
  // --- bread & cereals
  { test: /^bread\b/, not: /pitta|naan|chapat|roll|crumb|sauce|pudding|garlic|fried/, measures: [['medium slice', 36], ['thin / small slice', 27], ['thick slice', 44], ['toddler finger / soldier', 9]] },
  { test: /pitta/, measures: [['mini pitta', 30], ['standard pitta', 60]] },
  { test: /^rolls?\b|bread rolls/, measures: [['small roll', 45], ['large roll / bap', 60]] },
  { test: /chapat/, measures: [['small chapati', 40], ['medium chapati', 55]] },
  { test: /tortilla|wrap/, group: /^AF/, measures: [['mini wrap', 30], ['standard wrap', 60]] },
  { test: /crumpet/, measures: [['crumpet', 40]] },
  { test: /bagel/, measures: [['bagel', 85], ['half bagel', 42]] },
  { test: /croissant/, measures: [['croissant', 50], ['mini croissant', 25]] },
  { test: /pancake|scotch pancake/, measures: [['scotch pancake', 30], ['thin pancake / crepe', 50]] },
  { test: /weetabix|wheat biscuit/, measures: [['biscuit', 19]] },
  { test: /shredded wheat/, measures: [['large biscuit', 22], ['bitesize, tbsp', 8]] },
  { test: /porridge|ready brek|instant hot oat/, not: /oats?,? *(raw|rolled)|oatmeal/, measures: [['tbsp (made up)', 30], ['small bowl', 110], ['medium bowl', 160]] },
  { test: /porridge oats|oatmeal|oats/, group: /^A[AI]/, measures: [['tbsp (dry)', 8], ['40 g serving', 40]] },
  { test: /cornflakes|rice krispies|puffed rice|bran flakes|cheerios|multigrain|hoops|flakes|muesli|granola|breakfast cereal/, group: /^AI/, measures: [['tbsp', 6], ['small bowl (toddler)', 15], ['medium bowl', 30]] },
  { test: /^rice\b.*(boiled|cooked|steamed|fried)|^rice, .*easy cook.*boiled/, measures: [['tbsp', 30], ['toddler portion', 60], ['medium portion', 150]] },
  { test: /^(pasta|spaghetti|macaroni|noodles|fusilli|penne|couscous)\b.*(boiled|cooked)/, measures: [['tbsp', 30], ['toddler portion', 60], ['medium portion', 150]] },
  { test: /rusk/, measures: [['rusk', 17]] },
  { test: /rice cake/, measures: [['rice cake', 8], ['mini / baby rice cake', 2]] },
  { test: /breadstick|grissini/, measures: [['breadstick', 5]] },
  { test: /oatcake/, measures: [['oatcake', 10]] },
  { test: /cream cracker/, measures: [['cracker', 7]] },
  { test: /cracker|crispbread/, group: /^AM/, measures: [['cracker', 7]] },
  { test: /digestive/, measures: [['biscuit', 15]] },
  { test: /rich tea|marie|malted milk/, measures: [['biscuit', 8]] },
  { test: /biscuit|cookie|shortbread|gingernut/, group: /^AM/, measures: [['biscuit', 12]] },
  { test: /malt loaf/, measures: [['slice', 35], ['mini loaf / lunchbox bar', 30]] },
  { test: /flapjack/, measures: [['small piece', 30]] },
  { test: /cake|muffin|sponge/, group: /^A[NP]/, measures: [['small slice / fairy cake', 30], ['average slice', 60]] },
  { test: /pizza/, measures: [['small slice', 50], ['average slice', 100]] },
  { test: /yorkshire pudding/, measures: [['small pudding', 20]] },

  // --- dairy & eggs
  { test: /^milk\b|^milk,|alternative to milk|oat drink|almond drink/, group: /^BA|^BC/, not: /dried|condensed|evaporated|powder/, measures: [['beaker / small cup (150 ml)', 155], ['cup (200 ml)', 206], ['fl oz (28 ml)', 29], ['on cereal (100 ml)', 103], ['tbsp (15 ml)', 15.5]] },
  { test: /fromage frais/, measures: [['small pot (47 g)', 47], ['pot (85 g)', 85], ['tbsp', 20]] },
  { test: /yogurt|yoghurt/, measures: [['small pot (47 g)', 47], ['pot (85 g)', 85], ['standard pot (125 g)', 125], ['tbsp', 20]] },
  { test: /cheese spread|spreadable/, measures: [['triangle', 17.5], ['thin spread', 10], ['tsp', 7]] },
  { test: /cottage/, measures: [['tbsp', 40]] },
  { test: /^cheese\b/, not: /cake|sauce|pudding|pie|straw/, measures: [['matchbox piece', 30], ['small cube', 10], ['grated, tbsp', 10], ['slice', 20], ['mini portion (e.g. Babybel)', 20], ['cheese string', 20]] },
  { test: /^cream\b|creme fraiche/, measures: [['tsp', 5], ['tbsp', 15]] },
  { test: /custard/, measures: [['tbsp', 20], ['small pot', 120]] },
  { test: /rice pudding|pudding, rice/, measures: [['tbsp', 30], ['small pot', 125]] },
  { test: /ice cream/, measures: [['small scoop', 40], ['scoop', 60]] },
  { test: /^eggs?, chicken.*(boiled|poached|raw|fried)/, measures: [['medium egg', 50], ['large egg', 60], ['half egg', 25]] },
  { test: /scrambled|omelette/, measures: [['1 egg portion', 60], ['2 egg portion', 120], ['tbsp', 25]] },
  { test: /^butter\b|spread|margarine/, group: /^O/, measures: [['thin spread on slice', 5], ['medium spread on slice', 7], ['tsp', 5]] },
  { test: /oil/, group: /^OC/, measures: [['tsp', 4.6], ['tbsp', 13.8]] },

  // --- meat, fish, alternatives
  { test: /fish finger/, measures: [['fish finger', 28]] },
  { test: /nugget/, measures: [['nugget', 16]] },
  { test: /chipolata/, measures: [['chipolata', 25]] },
  { test: /sausage/, not: /roll|casserole|toad/, measures: [['sausage', 40], ['chipolata', 25], ['cocktail sausage', 10]] },
  { test: /sausage roll/, measures: [['mini', 15], ['standard', 60]] },
  { test: /^ham\b/, measures: [['thin slice', 12], ['slice', 23]] },
  { test: /bacon/, measures: [['rasher', 25]] },
  { test: /burger/, measures: [['small / quarter-pounder half', 45], ['standard burger', 78]] },
  { test: /meatball/, measures: [['meatball', 22]] },
  { test: /^(chicken|turkey|beef|lamb|pork)\b.*(roast|grill|casserole|stew|boiled|stir|mince|fried|baked)/, measures: [['tbsp (diced / minced)', 25], ['toddler portion', 30], ['small slice', 20], ['medium portion', 90]] },
  { test: /^(cod|haddock|salmon|pollock|plaice|coley|fish)\b/, not: /finger|cake|pie|roe|paste/, measures: [['tbsp (flaked)', 25], ['toddler portion', 40], ['small fillet', 100]] },
  { test: /fishcake|fish cake/, measures: [['fishcake', 50], ['mini fishcake', 25]] },
  { test: /tuna|sardine|mackerel|pilchard/, measures: [['tbsp', 30], ['half small can', 40], ['sardine', 25]] },
  { test: /baked beans/, measures: [['tbsp', 40], ['toddler portion', 80], ['small can (200 g)', 200]] },
  { test: /lentil|chickpea|kidney bean|butter bean|dahl|dal\b/, measures: [['tbsp', 35], ['toddler portion', 60]] },
  { test: /houmous|hummus/, measures: [['tsp', 10], ['tbsp', 30]] },
  { test: /peanut butter|nut butter|almond butter/, measures: [['tsp', 8], ['thin spread on slice', 10], ['thick spread on slice', 20]] },
  { test: /tofu|quorn/, measures: [['tbsp', 25], ['toddler portion', 40]] },

  // --- vegetables & potatoes
  { test: /^potato(es)?\b.*mash|mashed potato/, measures: [['tbsp', 45], ['scoop', 60]] },
  { test: /chips|french fries/, measures: [['chip', 7], ['toddler portion', 50], ['medium portion', 165]] },
  { test: /potato waffle/, measures: [['waffle', 45]] },
  { test: /potato.*(wedge|croquette|smiles|shapes)/, measures: [['piece', 15]] },
  { test: /^potatoes?\b.*(boiled|baked|roast|new)/, measures: [['egg-sized potato', 50], ['small roast potato', 40], ['small baked potato', 100]] },
  { test: /sweet potato/, measures: [['tbsp (mashed)', 40], ['small', 100]] },
  { test: /^peas\b|petits pois|sweetcorn|mixed vegetables/, measures: [['tbsp', 30], ['toddler portion', 40]] },
  { test: /^carrots?\b/, measures: [['tbsp', 40], ['stick', 10], ['small carrot', 60]] },
  { test: /broccoli|cauliflower/, measures: [['small floret', 10], ['floret / spear', 40], ['tbsp', 30]] },
  { test: /cucumber/, measures: [['slice', 6], ['stick', 15]] },
  { test: /^tomatoes?, cherry|cherry tomato/, measures: [['cherry tomato', 15]] },
  { test: /^tomatoes?\b/, not: /cherry|puree|ketchup|sauce|soup|juice|canned/, measures: [['slice', 17], ['small tomato', 65], ['cherry tomato', 15]] },
  { test: /^peppers?\b/, measures: [['stick / slice', 10], ['tbsp (diced)', 20]] },
  { test: /spinach|cabbage|kale|spring greens|green beans|courgette|swede|parsnip|butternut|squash|leek|mushroom|onion|aubergine/, group: /^D/, measures: [['tbsp', 30], ['toddler portion', 40]] },
  { test: /avocado/, measures: [['half small', 50], ['half medium', 75], ['tbsp (mashed)', 30], ['slice', 15]] },

  // --- fruit
  { test: /^bananas?\b/, not: /chips|dried/, measures: [['small banana', 80], ['medium banana', 100], ['half medium banana', 50], ['slice', 6]] },
  { test: /^apples?\b/, not: /juice|pie|sauce|crumble|dried/, measures: [['small apple', 75], ['medium apple', 112], ['slice / wedge', 15]] },
  { test: /^pears?\b/, not: /juice|canned|dried/, measures: [['small pear', 100], ['medium pear', 150], ['slice', 15]] },
  { test: /satsuma|clementine|mandarin|tangerine|easy peeler/, not: /canned|juice/, measures: [['fruit', 60], ['segment', 7]] },
  { test: /^oranges?\b/, not: /juice|squash|drink/, measures: [['small orange', 120], ['medium orange', 160], ['segment', 12]] },
  { test: /^grapes?\b/, measures: [['grape', 5], ['small handful (10)', 50]] },
  { test: /strawberr/, not: /jam|yogurt|milk/, measures: [['strawberry', 12], ['tbsp (chopped)', 20]] },
  { test: /blueberr/, measures: [['blueberry', 1.5], ['small handful', 40], ['tbsp', 15]] },
  { test: /raspberr|blackberr/, not: /jam/, measures: [['berry', 4], ['small handful', 40]] },
  { test: /^kiwi/, measures: [['kiwi', 60]] },
  { test: /^plums?\b/, measures: [['plum', 55]] },
  { test: /^peach|^nectarine/, not: /canned/, measures: [['fruit', 110], ['slice', 15]] },
  { test: /^mango/, not: /juice|chutney/, measures: [['slice', 40], ['tbsp (cubed)', 25]] },
  { test: /melon|watermelon/, measures: [['small slice', 100], ['tbsp (cubed)', 25]] },
  { test: /pineapple/, not: /juice/, measures: [['ring / slice', 40], ['tbsp (chunks)', 25]] },
  { test: /raisins|sultanas|currants/, measures: [['mini box (14 g)', 14], ['tbsp', 30], ['tsp', 10]] },
  { test: /apricots?.*dried|dates|prunes|figs.*dried/, measures: [['piece', 8]] },
  { test: /canned|stewed|puree/, group: /^FA/, measures: [['tbsp', 30], ['small pot (100 g)', 100]] },
  { test: /juice/, group: /^FC|^PE/, measures: [['small glass (150 ml)', 156], ['beaker (100 ml)', 104]] },
  { test: /squash|cordial|fruit drink/, group: /^PC/, measures: [['beaker made up (150 ml)', 153], ['cup made up (200 ml)', 204]] },

  // --- snacks & extras
  { test: /crisps|puffs|corn snacks/, measures: [['small bag (15 g)', 15], ['standard bag (25 g)', 25], ['crisp', 1.5]] },
  { test: /chocolate/, group: /^SEA/, measures: [['small square', 5], ['buttons, treat bag', 14], ['fun-size bar', 18]] },
  { test: /sweets|jelly|gums|pastilles|boiled sweets/, group: /^SEC/, measures: [['sweet', 5]] },
  { test: /^jam\b|marmalade|honey|syrup|chocolate spread|marmite|yeast extract/, measures: [['tsp', 8], ['thin spread on slice', 8], ['heaped tsp', 15]] },
  { test: /^sugar\b/, measures: [['tsp', 4], ['heaped tsp', 6]] },
  { test: /ketchup|mayonnaise|salad cream|brown sauce|gravy|sauce/, group: /^W/, measures: [['tsp', 5], ['tbsp', 15], ['sachet / squirt', 10]] },
  { test: /soup/, group: /^WA/, measures: [['small bowl (150 ml)', 153], ['bowl (220 ml)', 224]] },
  { test: /nuts|almonds|cashew|walnut|peanuts|seeds/, group: /^GA/, measures: [['tsp (ground / chopped)', 5], ['tbsp', 15], ['small handful', 25]] },
]

function unique(list: Measure[]): Measure[] {
  const seen = new Set<string>()
  return list.filter((m) => (seen.has(m.label) ? false : (seen.add(m.label), true)))
}

export function breastFeedVolume(ageMonths: number, bm: BreastMilkSettings): number {
  return ageMonths < bm.olderFromMonths ? bm.perFeedYounger : bm.perFeedOlder
}

/**
 * Measures offered for a food, in order: base unit, ml for liquids, the practitioner's own measures,
 * then the starter list. Amounts are in the food's base unit.
 */
export function measuresFor(
  food: Food,
  ctx: { userMeasures?: Measure[]; customMeasures?: Measure[]; ageMonths?: number; bm?: BreastMilkSettings } = {},
): Measure[] {
  const out: Measure[] = []
  if (food.id === BREAST_MILK_ID && ctx.bm) {
    const bm = ctx.bm
    const age = ctx.ageMonths ?? NaN
    const feed = breastFeedVolume(age, bm)
    if (bm.estimatesApproved && Number.isFinite(age)) out.push({ label: `breastfeed (est. ${feed} ml)`, amount: feed * bm.density, estimate: true })
    if (bm.estimatesApproved && Number.isFinite(age)) out.push({ label: `full day, exclusively breastfed (est. ${bm.exclusiveDay} ml)`, amount: bm.exclusiveDay * bm.density, estimate: true })
    if (bm.estimatesApproved && Number.isFinite(age)) out.push({ label: `full day, main milk with solids (est. ${bm.mainMilkDay} ml)`, amount: bm.mainMilkDay * bm.density, estimate: true })
    out.push({ label: 'ml (measured / expressed)', amount: bm.density })
    out.push({ label: 'fl oz (28 ml)', amount: 28.4 * bm.density })
    out.push(...(ctx.userMeasures ?? []))
    out.push({ label: 'g', amount: 1 })
    return unique(out)
  }
  if (food.kind === 'supplement') {
    out.push({ label: food.unit, amount: 1 })
    out.push(...(ctx.customMeasures ?? []), ...(ctx.userMeasures ?? []))
    return unique(out)
  }
  out.push({ label: food.unit, amount: 1 })
  if (food.unit === 'ml') {
    if (food.kind === 'formula') {
      out.push({ label: 'fl oz (30 ml)', amount: 30 }, { label: 'bottle (210 ml / 7 oz)', amount: 210 }, { label: 'beaker (150 ml)', amount: 150 })
    } else {
      out.push({ label: 'beaker (150 ml)', amount: 150 }, { label: 'cup (200 ml)', amount: 200 })
    }
  }
  out.push(...(ctx.customMeasures ?? []), ...(ctx.userMeasures ?? []))
  out.push(...(food.labelMeasures ?? []))
  if (food.unit === 'g' && food.id.startsWith('c:')) {
    const lower = food.name.toLowerCase()
    for (const r of RULES) {
      if (r.group && !r.group.test(food.group)) continue
      if (!r.test.test(lower)) continue
      if (r.not && r.not.test(lower)) continue
      for (const [label, amount] of r.measures) out.push({ label, amount })
    }
    if (food.density) out.push({ label: 'ml', amount: food.density })
  }
  const halves = out.filter(m => m.amount > 1 && m.label !== food.unit && !/^half|^½/i.test(m.label) && !m.estimate)
    .map(m => ({...m, label: `½ ${m.label}`, amount: m.amount / 2}))
  return unique([...out, ...halves])
}
