const KEY = 'nicolasBirthdayBuildSaveV1';
const defaultRun = () => ({ bugs: 0, coffees: 0, deaths: 0, chapters: 0 });
const defaults = () => ({
  unlockedLevel: 1, currentLevel: 1, completed: false,
  deaths: 0, bugsFixed: 0, coffees: 0, achievements: [], run: defaultRun(),
  settings: { sfx: 0.75, music: 0.45, reducedFx: false, muted: false }
});
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const level = value => [1, 2, 3, 4].includes(Number(value)) ? Number(value) : 1;
const volume = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
let memory = defaults();
let storageUnavailable = false;
function normalize(raw) {
  if (!raw || typeof raw !== 'object') raw = {};
  const s = raw.settings || {}, r = raw.run || {};
  return {
    unlockedLevel: level(raw.unlockedLevel), currentLevel: level(raw.currentLevel ?? raw.unlockedLevel),
    completed: !!raw.completed, deaths: count(raw.deaths), bugsFixed: count(raw.bugsFixed), coffees: count(raw.coffees),
    achievements: Array.isArray(raw.achievements) ? [...new Set(raw.achievements.filter(x => typeof x === 'string'))] : [],
    run: { bugs: count(r.bugs), coffees: count(r.coffees), deaths: count(r.deaths), chapters: Math.min(4, count(r.chapters)) },
    settings: { sfx: volume(s.sfx ?? 0.75, 0.75), music: volume(s.music ?? 0.45, 0.45), reducedFx: !!s.reducedFx, muted: !!s.muted }
  };
}
function persist(state) {
  memory = normalize(state);
  try { localStorage.setItem(KEY, JSON.stringify(memory)); storageUnavailable = false; }
  catch { storageUnavailable = true; }
  return structuredClone(memory);
}
export const SaveSystem = {
  load() {
    if (storageUnavailable) return structuredClone(memory);
    try { memory = normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch { storageUnavailable = true; }
    return structuredClone(memory);
  },
  save(patch = {}) {
    const state = this.load();
    return persist({ ...state, ...patch, settings: { ...state.settings, ...patch.settings } });
  },
  beginRun() { return this.save({ currentLevel: 1, completed: false, run: defaultRun() }); },
  reset() { return persist(defaults()); },
  unlockAchievement(id) {
    const state = this.load();
    if (state.achievements.includes(id)) return false;
    this.save({ achievements: [...state.achievements, id] });
    return true;
  }
};
