/**
 * restricted.ts — a first screen of imported text against the Selling Policy
 * (/selling-policy). It is a screen, not a ruling:
 *
 *   block  unmistakable terms for goods the policy never allows (weapons,
 *          explosives and fireworks, tobacco and vapes, drugs, adult products).
 *          The row is held back with an error.
 *   warn   words that are usually fine and sometimes not (alcohol is not yet
 *          allowed, but "wine glass" is; "knife" may be a butter knife). The row
 *          imports as a draft carrying a warning, and publishing asks the
 *          merchant to confirm it follows the policy.
 *
 * Matching is whole-word and runs on title, description and category, so
 * "ginger" is not "gin" and "crumble" is not "rum". Merchants remain
 * responsible for what they list; this exists so a bulk upload cannot put a
 * catalogue of restricted goods in front of customers by accident.
 */

export type PolicyLevel = 'block' | 'warn';
export interface PolicyHit { level: PolicyLevel; term: string; reason: string }

interface Rule { level: PolicyLevel; reason: string; terms: string[] }

const RULES: Rule[] = [
  { level: 'block', reason: 'firearms, ammunition and explosives are not allowed', terms: [
    'firearm', 'firearms', 'rifle', 'shotgun', 'handgun', 'pistol', 'revolver', 'airgun', 'air rifle', 'ammunition', 'ammo', 'gunpowder', 'explosive', 'explosives', 'detonator', 'taser'] },
  { level: 'block', reason: 'fireworks are not allowed', terms: ['firework', 'fireworks', 'sparkler', 'sparklers'] },
  { level: 'block', reason: 'tobacco, vapes and nicotine products are not allowed', terms: [
    'tobacco', 'cigarette', 'cigarettes', 'cigar', 'cigars', 'vape', 'vapes', 'vaping', 'e liquid', 'e-liquid', 'eliquid', 'e cigarette', 'nicotine', 'snus', 'rolling tobacco', 'hookah', 'shisha'] },
  { level: 'block', reason: 'illegal drugs and things sold for taking them are not allowed', terms: [
    'cocaine', 'heroin', 'mdma', 'ecstasy', 'lsd', 'ketamine', 'amphetamine', 'methamphetamine', 'cannabis', 'marijuana', 'magic mushrooms', 'psilocybin', 'legal highs', 'bong', 'bongs', 'rolling papers for cannabis'] },
  { level: 'block', reason: 'adult and sexual products are not allowed', terms: [
    'sex toy', 'sex toys', 'vibrator', 'dildo', 'lingerie for adults', 'adult toy', 'erotic', 'fetish', 'bondage'] },
  { level: 'block', reason: 'counterfeit goods are not allowed', terms: ['counterfeit', 'fake designer', 'replica designer', 'knock off designer', 'knockoff designer'] },
  { level: 'warn', reason: 'alcohol is not currently allowed to be sold through OneShetland', terms: [
    'alcohol', 'alcoholic', 'beer', 'ale', 'lager', 'stout', 'cider', 'wine', 'whisky', 'whiskey', 'gin', 'vodka', 'rum', 'brandy', 'liqueur', 'prosecco', 'champagne', 'spirits', 'spirit', 'cocktail', 'mead', 'schnapps', 'sherry', 'port wine', 'tequila'] },
  { level: 'warn', reason: 'knives and bladed items are age-restricted and not currently allowed', terms: [
    'knife', 'knives', 'dagger', 'machete', 'sword', 'swords', 'blade', 'blades', 'cleaver', 'axe', 'hatchet', 'sgian dubh', 'sgian-dubh'] },
  { level: 'warn', reason: 'protected wildlife and animal parts need to be lawful to sell', terms: ['ivory', 'whalebone', 'taxidermy', 'tortoiseshell', 'rhino horn', 'bird egg', 'bird eggs'] },
  { level: 'warn', reason: 'CBD and similar products need review against the policy', terms: ['cbd', 'hemp oil', 'kratom'] },
  { level: 'warn', reason: 'possible copy or fake of a branded item', terms: ['replica', 'fake', 'knock off', 'knockoff', 'copy of'] },
  { level: 'warn', reason: 'medicines need the right licence and are not checked by OneShetland', terms: ['medicine', 'medicines', 'prescription', 'antibiotic', 'antibiotics', 'painkiller', 'painkillers', 'pharmacy only'] },
];

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const COMPILED = RULES.map((r) => ({
  ...r,
  re: new RegExp(`(?<![a-z0-9])(?:${r.terms.map(escape).join('|')})(?![a-z0-9])`, 'i'),
}));

/** Phrases that look like a hit but are ordinary goods. Checked first and removed from the text. */
const SAFE_PHRASES = [
  /\bwine\s+(glass|glasses|rack|racks|cooler|bottle holder|stopper|stoppers|bag|bags|charm|charms)\b/gi,
  /\b(gin|whisky|whiskey|beer|rum|wine)\s+(glass|glasses|tumbler|tumblers|jar|jars|candle|candles|soap|flavou?red)\b/gi,
  /\b(butter|cheese|palette|craft|pen|paper|letter|bread|pocket|spreading)\s+knife\b/gi,
  /\bknife\s+(rest|block|stand|holder|sharpener)\b/gi,
  /\b(wind|razor)\s*blade\b/gi,
  /\bspirit\s+of\s+shetland\b/gi,
  /\bport\s+(side|hole|of|arthur|ellen)\b/gi,
  /\b(ginger|gingerbread)\b/gi,
  /\bcopy\s+of\s+(the\s+)?(book|map|print|chart)\b/gi,
  /\bfake\s+(fur|leather|flowers?|plants?)\b/gi,
  /\bblade\s+of\s+grass\b/gi,
  /\b(axe|hatchet)\s+(head\s+)?(handle|cover|sheath)\b/gi,
];

export function screenText(...parts: (string | null | undefined)[]): PolicyHit[] {
  let text = parts.filter(Boolean).join(' \n ').toLowerCase();
  if (!text.trim()) return [];
  for (const safe of SAFE_PHRASES) text = text.replace(safe, ' ');
  const hits: PolicyHit[] = [];
  const seen = new Set<string>();
  for (const r of COMPILED) {
    const m = r.re.exec(text);
    if (!m) continue;
    const key = `${r.level}:${r.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ level: r.level, term: m[0].trim(), reason: r.reason });
  }
  return hits;
}

export const SELLING_POLICY_PATH = '/selling-policy';
