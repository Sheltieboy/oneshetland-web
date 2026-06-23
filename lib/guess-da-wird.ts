/**
 * guess-da-wird.ts (web) — daily Shetland dialect word game logic.
 * Ported from the app; AsyncStorage → localStorage, supabase → publicClient.
 */

import { publicClient } from "@/lib/supabase/public";

export type LetterState = "anchored" | "drifting" | "away" | "empty";
export interface LetterResult { letter: string; state: LetterState }
export interface GuessRow { word: string; letters: LetterResult[] }
export type ClueLevel = 0 | 1 | 2 | 3 | 4 | 5;
export interface GdwClue { level: ClueLevel; label: string; content: string }

export interface DailyWird {
  id: number; word: string; meaning: string; full_meaning: string | null;
  part_of_speech: string | null; example_sentence: string | null;
  usage_level: string | null; category: string | null; era: string | null;
  tone: string | null; pronunciation: string | null;
  wirdil_hint_1: string | null; wirdil_hint_2: string | null; wirdil_hint_3: string | null;
  date_key: string; difficulty: number;
}
export interface DailyStats {
  played: number; won: number; currentStreak: number; bestStreak: number;
  lastDate: string | null; distribution: number[]; cluesUsed: number; fastestSolve: number | null;
}
export interface SavedDailyState { dateKey: string; guesses: string[]; won: boolean; lost: boolean; cluesShown: ClueLevel }

export const MIN_LEN = 3;
export const MAX_LEN = 8;
export const BASE_TRIES = 7;
export const LONG_TRIES = 8;

const CATEGORY_THEME: Record<string, string> = {
  emotion: "feelings and emotions", nature: "the natural world", sea: "the sea and fishing",
  object: "everyday objects", action: "actions and doing", animals: "animals and creatures",
  quality: "qualities and descriptions", people: "people and community", clothing: "clothing and textiles",
  food: "food and drink", body: "the body", home: "home and hearth", place: "places and landscape",
  work: "work and trades", weather: "weather and the elements", time: "time",
};

export function deriveDifficulty(w: { usage_level: string | null; era: string | null; word: string; short_meaning: string | null; example_sentence: string | null; wirdil_hint_1: string | null }): number {
  let score = 0;
  const ul = (w.usage_level ?? "").toLowerCase();
  if (ul === "common") score += 0; else if (ul === "known") score += 1; else score += 3;
  const era = (w.era ?? "").toLowerCase();
  if (era === "archaic") score += 2; else if (era === "older") score += 1;
  const len = w.word.length;
  if (len <= 4) score += 0; else if (len <= 6) score += 1; else score += 2;
  if (!w.short_meaning && !w.example_sentence) score += 1;
  if (!w.wirdil_hint_1) score += 1;
  if (score <= 1) return 1;
  if (score <= 4) return 2;
  return 3;
}

export function todayKey(): string { return new Date().toISOString().split("T")[0]; }
function dateToSeed(dateKey: string): number { const [y, m, d] = dateKey.split("-").map(Number); return y * 10000 + m * 100 + d; }
function seededIndex(seed: number, max: number): number { const a = 1664525, c = 1013904223, m = 2 ** 32; return Math.abs((a * seed + c) % m) % max; }

export interface WirdCandidate {
  id: number; word: string; short_meaning: string | null; spik_meaning: string | null;
  example_sentence: string | null; part_of_speech: string | null; category: string | null;
  usage_level: string | null; era: string | null; tone: string | null; pronunciation: string | null;
  wirdil_hint_1: string | null; wirdil_hint_2: string | null; wirdil_hint_3: string | null; difficulty: number;
}

let poolCache: WirdCandidate[] | null = null;
let guessPoolCache: Set<string> | null = null;

type Row = Record<string, string | null> & { id: number; word: string };

function buildPool(rows: Row[]): WirdCandidate[] {
  return rows.map((r) => {
    const word = (r.word ?? "").trim().toLowerCase();
    return {
      id: r.id, word,
      short_meaning: r.short_meaning ?? null, spik_meaning: r.spik_meaning ?? null,
      example_sentence: r.example_sentence ?? null, part_of_speech: r.part_of_speech ?? null,
      category: r.category ?? null, usage_level: r.usage_level ?? null, era: r.era ?? null,
      tone: r.tone ?? null, pronunciation: r.pronunciation ?? null,
      wirdil_hint_1: r.wirdil_hint_1 ?? null, wirdil_hint_2: r.wirdil_hint_2 ?? null, wirdil_hint_3: r.wirdil_hint_3 ?? null,
      difficulty: deriveDifficulty({ usage_level: r.usage_level ?? null, era: r.era ?? null, word, short_meaning: r.short_meaning ?? null, example_sentence: r.example_sentence ?? null, wirdil_hint_1: r.wirdil_hint_1 ?? null }),
    } as WirdCandidate;
  }).filter((w) => w.word.length >= MIN_LEN && w.word.length <= MAX_LEN && /^[a-z'-]+$/.test(w.word));
}

export async function loadWirdPool(): Promise<WirdCandidate[]> {
  if (poolCache && poolCache.length) return poolCache;
  const sb = publicClient();
  const cols = "id, word, short_meaning, spik_meaning, part_of_speech, example_sentence, category, usage_level, era, tone, pronunciation, wirdil_hint_1, wirdil_hint_2, wirdil_hint_3";
  const { data, error } = await sb.from("spik_dictionary").select(cols + ", word_status")
    .in("word_status", ["approved", "published"])
    .not("tone", "in", '("harsh","insult")')
    .or("short_meaning.not.is.null,spik_meaning.not.is.null").limit(6000);
  if (error || !data || data.length === 0) {
    const { data: fb } = await sb.from("spik_dictionary").select(cols)
      .or("short_meaning.not.is.null,spik_meaning.not.is.null").limit(6000);
    poolCache = buildPool((fb ?? []) as unknown as Row[]);
    return poolCache;
  }
  poolCache = buildPool(data as unknown as Row[]);
  return poolCache;
}

export async function loadGuessPool(): Promise<Set<string>> {
  if (guessPoolCache) return guessPoolCache;
  const sb = publicClient();
  const { data } = await sb.from("spik_dictionary").select("word").not("word", "is", null).limit(20000);
  const set = new Set<string>();
  for (const row of (data ?? []) as { word: string | null }[]) {
    const w = (row.word ?? "").trim().toLowerCase();
    if (w.length < MIN_LEN || w.length > MAX_LEN) continue;
    if (!/^[a-z'-]+$/.test(w)) continue;
    set.add(w);
  }
  const target = await loadWirdPool();
  for (const w of target) set.add(w.word);
  guessPoolCache = set;
  return guessPoolCache;
}

export async function getDailyWird(dateKey: string): Promise<DailyWird> {
  const pool = await loadWirdPool();
  const seed = dateToSeed(dateKey);
  const usagePref = new Set(["common", "known"]);
  const eraAvoid = new Set(["archaic"]);
  const tier0 = pool.filter((w) => w.word.length >= 4 && w.word.length <= 5 && usagePref.has(w.usage_level ?? "") && !eraAvoid.has(w.era ?? "") && w.difficulty <= 2);
  const tier1 = pool.filter((w) => w.word.length >= 4 && w.word.length <= 6 && usagePref.has(w.usage_level ?? "") && !eraAvoid.has(w.era ?? "") && w.difficulty <= 2);
  const tier2 = pool.filter((w) => w.word.length >= 4 && w.word.length <= 6);
  const candidates = tier0.length >= 30 ? tier0 : tier1.length >= 30 ? tier1 : tier2.length >= 30 ? tier2 : pool;
  if (!candidates.length) throw new Error("No Shetland words found in the dictionary.");
  const picked = candidates[seededIndex(seed, candidates.length)];
  return {
    id: picked.id, word: picked.word,
    meaning: (picked.short_meaning ?? picked.spik_meaning ?? "").trim(),
    full_meaning: picked.spik_meaning?.trim() ?? null,
    part_of_speech: picked.part_of_speech, example_sentence: picked.example_sentence,
    usage_level: picked.usage_level, category: picked.category, era: picked.era, tone: picked.tone,
    pronunciation: picked.pronunciation,
    wirdil_hint_1: picked.wirdil_hint_1, wirdil_hint_2: picked.wirdil_hint_2, wirdil_hint_3: picked.wirdil_hint_3,
    date_key: dateKey, difficulty: picked.difficulty,
  };
}

export function maxTries(word: string): number { return word.length >= 7 ? LONG_TRIES : BASE_TRIES; }

export function checkGuess(guess: string, answer: string): LetterResult[] {
  const g = guess.toLowerCase().split(""); const a = answer.toLowerCase().split("");
  const result: LetterResult[] = g.map((letter) => ({ letter, state: "away" as LetterState }));
  const pool: (string | null)[] = [...a];
  for (let i = 0; i < g.length; i++) if (g[i] === a[i]) { result[i].state = "anchored"; pool[i] = null; }
  for (let i = 0; i < g.length; i++) {
    if (result[i].state === "anchored") continue;
    const j = pool.indexOf(g[i]);
    if (j !== -1) { result[i].state = "drifting"; pool[j] = null; }
  }
  return result;
}

const STATE_PRIORITY: Record<LetterState, number> = { anchored: 3, drifting: 2, away: 1, empty: 0 };
export function buildKeyMap(rows: GuessRow[]): Record<string, LetterState> {
  const map: Record<string, LetterState> = {};
  for (const row of rows) for (const r of row.letters) {
    const cur = map[r.letter];
    if (!cur || STATE_PRIORITY[r.state] > STATE_PRIORITY[cur]) map[r.letter] = r.state;
  }
  return map;
}

function softenMeaning(meaning: string): string {
  const words = meaning.trim().split(/\s+/);
  if (words.length <= 3) return `It relates to: ${meaning.toLowerCase()}.`;
  return words.slice(0, Math.ceil(words.length * 0.55)).join(" ") + "…";
}
function countVowels(word: string): number { return (word.match(/[aeiou]/gi) ?? []).length; }
function ordinal(n: number): string { const s = ["th", "st", "nd", "rd"]; const v = n % 100; return s[(v - 20) % 10] ?? s[v] ?? s[0]; }

export function buildClues(wird: DailyWird): GdwClue[] {
  const clues: GdwClue[] = [];
  clues.push({ level: 1, label: "What kind of wird is it?", content: wird.part_of_speech ? `This wird is a ${wird.part_of_speech}.` : `This wird has ${wird.word.length} letters.` });
  clues.push({ level: 2, label: "Need a peerie clue?", content: wird.wirdil_hint_1 ?? softenMeaning(wird.meaning) });
  let hint3: string;
  if (wird.wirdil_hint_2) hint3 = wird.wirdil_hint_2;
  else if (wird.category) {
    const theme = CATEGORY_THEME[wird.category] ?? wird.category;
    hint3 = `This wird relates to ${theme}.`;
    if (wird.usage_level) hint3 += ` It's ${wird.usage_level === "common" ? "a common" : wird.usage_level === "known" ? "a well-known" : "a less common"} Shetland word.`;
  } else hint3 = `The wird has ${countVowels(wird.word)} vowels and ${wird.word.length - countVowels(wird.word)} consonants.`;
  clues.push({ level: 3, label: "Give me a theme clue", content: hint3 });
  let hint4: string;
  if (wird.wirdil_hint_3) hint4 = wird.wirdil_hint_3;
  else { hint4 = `The wird starts with "${wird.word[0].toUpperCase()}".`; if (wird.pronunciation) hint4 += ` It's pronounced: ${wird.pronunciation}.`; }
  clues.push({ level: 4, label: "Reveal the first letter", content: hint4 });
  let hint5: string;
  if (wird.example_sentence) hint5 = `"${wird.example_sentence}"`;
  else { const mid = Math.floor(wird.word.length / 2); hint5 = `The ${mid + 1}${ordinal(mid + 1)} letter is "${wird.word[mid].toUpperCase()}".`; }
  clues.push({ level: 5, label: "Show me an example", content: hint5 });
  return clues;
}

export async function isValidGuess(guess: string, wordLen: number): Promise<boolean> {
  const g = guess.toLowerCase().trim();
  if (g.length !== wordLen) return false;
  return (await loadGuessPool()).has(g);
}

export function calcScore(triesUsed: number, maxT: number, cluesUsed: number, won: boolean, difficulty: number): number {
  if (!won) return 0;
  const diffBonus = difficulty === 3 ? 100 : difficulty === 2 ? 50 : 0;
  return Math.max(50, 1000 - (triesUsed - 1) * 100 + (maxT - triesUsed) * 50 - cluesUsed * 20 + diffBonus);
}

export function buildShareText(dateKey: string, guesses: GuessRow[], won: boolean, cluesUsed: number, currentStreak: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = `${d} ${months[m - 1]} ${y}`;
  const result = won ? `Solved in ${guesses.length} tr${guesses.length === 1 ? "y" : "ies"}` : "Kept its secret today";
  const rows = guesses.map((g) => g.letters.map((l) => l.state === "anchored" ? "⚓" : l.state === "drifting" ? "〰️" : "·").join("")).join("\n");
  return [`Guess da Wird — ${date}`, result, cluesUsed > 0 ? `Clues used: ${cluesUsed}` : "", currentStreak > 1 ? `🔥 Streak: ${currentStreak}` : "", "", rows, "", "Play on OneShetland"].filter((l) => l !== "").join("\n");
}

/* ── localStorage stats + state ──────────────────────────────────────────── */

const STATS_KEY = (uid: string) => `gdw_stats_v2_${uid}`;
const STATE_KEY = (uid: string) => `gdw_state_v2_${uid}`;
const DEFAULT_STATS: DailyStats = { played: 0, won: 0, currentStreak: 0, bestStreak: 0, lastDate: null, distribution: new Array(8).fill(0), cluesUsed: 0, fastestSolve: null };

export function loadStats(userId: string): DailyStats {
  if (typeof window === "undefined") return { ...DEFAULT_STATS };
  try { const raw = localStorage.getItem(STATS_KEY(userId)); return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : { ...DEFAULT_STATS }; }
  catch { return { ...DEFAULT_STATS }; }
}
export function saveStats(userId: string, stats: DailyStats): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STATS_KEY(userId), JSON.stringify(stats)); } catch { /* */ }
}
export function recordResult(userId: string, dateKey: string, guessCount: number, won: boolean, cluesUsed: number, solveSeconds?: number): DailyStats {
  const stats = loadStats(userId);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const isContinuation = stats.lastDate === yesterday || stats.lastDate === dateKey;
  const alreadyCounted = stats.lastDate === dateKey;
  let newStreak = stats.currentStreak;
  if (!alreadyCounted) newStreak = won ? (isContinuation ? stats.currentStreak + 1 : 1) : 0;
  const dist = [...stats.distribution];
  if (won && guessCount >= 1 && guessCount <= 8 && !alreadyCounted) dist[guessCount - 1] = (dist[guessCount - 1] ?? 0) + 1;
  const newFastest = won && solveSeconds ? (stats.fastestSolve === null ? solveSeconds : Math.min(stats.fastestSolve, solveSeconds)) : stats.fastestSolve;
  const updated: DailyStats = {
    played: alreadyCounted ? stats.played : stats.played + 1,
    won: alreadyCounted ? stats.won : stats.won + (won ? 1 : 0),
    currentStreak: newStreak, bestStreak: Math.max(stats.bestStreak, newStreak),
    lastDate: dateKey, distribution: dist,
    cluesUsed: stats.cluesUsed + (alreadyCounted ? 0 : cluesUsed), fastestSolve: newFastest,
  };
  saveStats(userId, updated);
  return updated;
}
export function loadDailyState(userId: string): SavedDailyState | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(STATE_KEY(userId)); if (!raw) return null; const s: SavedDailyState = JSON.parse(raw); return s.dateKey !== todayKey() ? null : s; }
  catch { return null; }
}
export function saveDailyState(userId: string, state: SavedDailyState): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STATE_KEY(userId), JSON.stringify(state)); } catch { /* */ }
}
