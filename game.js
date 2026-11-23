"use strict";

const LEVELS = createMazeLevels();
const DAILY_API = typeof DailyMazeData !== "undefined" ? DailyMazeData : null;
const SEEDED_API = typeof SeededMazeData !== "undefined" ? SeededMazeData : null;

const TILE = { STONE: "#", WOOD: "W", CRACKED: "R", FLOOR: ".", HAMMER: "H", BOMB: "B", SPIRIT: "G", TORCH: "T", SHARD: "K", STAR: "S", PLAYER: "P" };

const FIRST_LEVEL_SPIRIT_ROUTE = [
  [2,7], [3,7], [3,5], [6,5], [9,5], [11,5], [11,3],
];
const MAP_ZOOM_LEVELS = [.55, .7, .85, 1, 1.25, 1.55, 1.9, 2.25];
const DEFAULT_MAP_ZOOM = MAP_ZOOM_LEVELS.indexOf(1);
const SPIRIT_LIGHT_FADE_MS = 210;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameStage = document.getElementById("gameStage");
const hammerSlot = document.getElementById("hammerSlot");
const hammerCount = document.getElementById("hammerCount");
const bombSlot = document.getElementById("bombSlot");
const bombCount = document.getElementById("bombCount");
const flashSlot = document.getElementById("flashSlot");
const flashCount = document.getElementById("flashCount");
const spiritSlot = document.getElementById("spiritSlot");
const spiritCount = document.getElementById("spiritCount");
const torchSlot = document.getElementById("torchSlot");
const torchCount = document.getElementById("torchCount");
const teleportSlot = document.getElementById("teleportSlot");
const teleportCount = document.getElementById("teleportCount");
const spiritReturnButton = document.getElementById("spiritReturnButton");
const spiritStatusText = document.getElementById("spiritStatusText");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const itemHelp = document.getElementById("itemHelp");
const previewPanel = document.getElementById("previewPanel");
const previewCountdown = document.getElementById("previewCountdown");
const memoryPinStatus = document.getElementById("memoryPinStatus");
const tutorialBubble = document.getElementById("tutorialBubble");
const tutorialText = document.getElementById("tutorialText");
const tutorialStep = document.getElementById("tutorialStep");
const completeModal = document.getElementById("completeModal");
const introModal = document.getElementById("introModal");
const onboardingRevealModal = document.getElementById("onboardingRevealModal");
const onboardingRevealButton = document.getElementById("onboardingRevealButton");
const settingsModal = document.getElementById("settingsModal");
const seededModal = document.getElementById("seededModal");
const semanticMapModal = document.getElementById("semanticMapModal");
const semanticMapScroll = document.getElementById("semanticMapScroll");
const semanticMapGrid = document.getElementById("semanticMapGrid");
const semanticMapPosition = document.getElementById("semanticMapPosition");
const appElement = document.getElementById("app");

const SAVE_KEY = "broken-path-save-v7";
const LEGACY_SAVE_KEYS = ["broken-path-save-v6", "broken-path-save-v5", "broken-path-save-v3"];
const RUN_SNAPSHOT_KEY = "maze-run-v1";
const DAILY_SAVE_KEY = "broken-path-daily-v2";
const LEGACY_DAILY_SAVE_KEY = "broken-path-daily-v1";
const DAILY_RUN_SNAPSHOT_KEY = "maze-daily-run-v1";
const DAILY_RUN_SNAPSHOT_PREFIX = `${DAILY_RUN_SNAPSHOT_KEY}:`;
const DAILY_RUN_SNAPSHOT_INDEX_KEY = `${DAILY_RUN_SNAPSHOT_KEY}:index`;
const DAILY_RUN_SNAPSHOT_LIMIT = 7;
const DAILY_CALENDAR_REFRESH_INTERVAL_MS = 60000;
const DAILY_SAVE_SCHEMA = 2;
const LEGACY_DAILY_SAVE_SCHEMA = 1;
const DAILY_CONTRACT_REVISION = 2;
const DAILY_RUN_SNAPSHOT_SCHEMA = 2;
const DAILY_PREVIEW_DURATION = 5;
const SEEDED_PREVIEW_DURATION = 5;
const ENTRY_SNAPSHOT_IDENTITY_KEY = "maze-entry-v7-identity";
const RUN_SNAPSHOT_SCHEMA = 5;
const LEGACY_RUN_SNAPSHOT_SCHEMA = 4;
const SAVE_VERSION = 7;
const CHALLENGE_REVISION = 3;
const EFFECTIVE_TOOL_BADGE_INDICES = [5,6,8,9,12];
const DEFAULT_CAMPAIGN_ID = "campaign-0";
const INVENTORY_KEYS = ["hammer", "bomb", "flash", "spirit", "torch", "teleport"];
const VALID_PREVIEW_DURATIONS = new Set([0, 2, 3, 5]);
const launchRoute = parseLaunchRoute(window.location);
const requestedDailyDate = launchRoute.kind === "daily" ? launchRoute.date : null;
let requestedSeededChallenge = launchRoute.kind === "seeded" ? launchRoute.seeded : null;

let lastSaveWriteSucceeded = true;
let storageWarningPending = false;
let storageWarningShown = false;
let save = loadSave({writeBack:!requestedDailyDate&&!requestedSeededChallenge});
let lastDailyWriteSucceeded = true;
let dailySave = loadDailySave({writeBack:!requestedSeededChallenge});
let state = null;
let raf = 0;
let lastTime = performance.now();
let toastTimer = 0;
let audioContext = null;
let pausedAt = 0;
let pausedClockState = null;
let lastRenderedAt = 0;
let lastRenderedLayout = null;
let lastCanvasCssWidth = 0;
let lastCanvasCssHeight = 0;
let lastCanvasPixelRatio = 1;
let modalReturnFocus = null;
let modalFocusEpoch = 0;
let deferredInstallPrompt = null;
let installPromptInFlight = false;
let installPromptAttempt = 0;
let waitingServiceWorker = null;
let reloadingForUpdate = false;
let updateReloadAccepted = false;
let updateReadyForReload = false;
let deferredUpdateBannerMessage = "";
let shareInFlight = false;
const serviceWorkerControlledAtLoad = Boolean(window.navigator?.serviceWorker?.controller);
let pointerGesture = null;
let semanticMapSnapshotTime = 0;
let announcedTutorialState = null;
let announcedTutorialText = null;
let runSnapshotTimer = 0;
let queuedRunSnapshot = null;
let pendingRunSnapshot = null;
let dailyRunSnapshotTimer = 0;
let queuedDailyRunSnapshot = null;
let pendingDailyRunSnapshot = null;
let renderedDailyCalendarDate = null;
let dailyCalendarRefreshTimer = 0;
let selectedSeedPreset = "M";
let seededModalReturn = "intro";
const pauseReasons = new Set();
const compactViewportQuery = window.matchMedia?.("(max-width: 720px), (pointer: coarse)");
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const runEntries = {};
const activeMotions = new Set();
const activeGameTimers = new Set();

function boundedInteger(value, minimum = 0, maximum = 999) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function parseSeededMazeParam(value) {
  if (!SEEDED_API || typeof value !== "string") return null;
  const match=value.match(/^v([1-9][0-9]*)-([SMD])-([2-9A-HJ-NP-Z]{6})$/);
  if(!match||Number(match[1])!==SEEDED_API.SEEDED_ALGORITHM_VERSION)return null;
  const preset=SEEDED_API.normalizeSeedPreset(match[2]);
  const code=SEEDED_API.normalizeSeedCode(match[3]);
  if(!preset||!code)return null;
  return {
    algorithmVersion:Number(match[1]),preset,code,
    canonical:`v${match[1]}-${preset}-${code}`,
  };
}

function parseLaunchRoute(locationValue = window.location) {
  let search=String(locationValue?.search||"");
  if(!search&&typeof locationValue?.href==="string"){
    try{search=new URL(locationValue.href,"https://local.invalid/").search;}catch(_){}
  }
  let params;
  try{params=new URLSearchParams(search);}catch(_){return {kind:"campaign",invalid:true};}
  const dailyValues=params.getAll("daily"),mazeValues=params.getAll("maze");
  const hasDaily=dailyValues.length>0,hasMaze=mazeValues.length>0;
  if((hasDaily&&hasMaze)||dailyValues.length>1||mazeValues.length>1)return {kind:"campaign",invalid:true};
  if(hasMaze){
    const seeded=parseSeededMazeParam(mazeValues[0]);
    const onlyMaze=[...params.keys()].every((name)=>name==="maze");
    return seeded&&onlyMaze?{kind:"seeded",seeded,invalid:false}:{kind:"campaign",invalid:true};
  }
  if(hasDaily){
    const date=DAILY_API?.parseDailyDate(dailyValues[0])?dailyValues[0]:null;
    return date?{kind:"daily",date,invalid:false}:{kind:"campaign",invalid:true};
  }
  return {kind:"campaign",invalid:false};
}

function baseShareUrl() {
  const currentUrl = window.location?.href || "";
  const canonicalElement = /^https?:/i.test(currentUrl) ? document.querySelector?.('link[rel="canonical"]') : null;
  const canonicalUrl = canonicalElement?.href || canonicalElement?.getAttribute?.("href") || "";
  if (/^https?:\/\//i.test(canonicalUrl)) return canonicalUrl;
  try {
    const local = new URL(currentUrl);
    local.search = "";
    local.hash = "";
    return local.href;
  } catch (_) { return currentUrl; }
}

function navigationBaseUrl(){
  const current=window.location?.href||"";
  try{const url=new URL(current);url.search="";url.hash="";return url.href;}catch(_){return current;}
}

function dailyUrlForDate(dateValue, baseUrl = baseShareUrl()) {
  if (!DAILY_API?.parseDailyDate(dateValue)) return baseUrl;
  try {
    const url = new URL(baseUrl, window.location?.href || undefined);
    url.search = "";
    url.hash = "";
    url.searchParams.set("daily", dateValue);
    return url.href;
  } catch (_) { return baseUrl; }
}

function seededUrlForChallenge(seededValue, baseUrl = baseShareUrl()) {
  const preset=SEEDED_API?.normalizeSeedPreset(seededValue?.preset);
  const code=SEEDED_API?.normalizeSeedCode(seededValue?.code);
  const version=Number(seededValue?.algorithmVersion??SEEDED_API?.SEEDED_ALGORITHM_VERSION);
  if(!preset||!code||version!==SEEDED_API?.SEEDED_ALGORITHM_VERSION)return baseUrl;
  try{
    const url=new URL(baseUrl,window.location?.href||undefined);
    url.search="";url.hash="";
    url.searchParams.set("maze",`v${version}-${preset}-${code}`);
    return url.href;
  }catch(_){return baseUrl;}
}

function replaceBrowserUrl(url) {
  try{
    if(typeof window.history?.replaceState==="function"){
      window.history.replaceState(null,"",url);
      return true;
    }
  }catch(_){}
  return false;
}

function navigateToUrl(url) {
  if (typeof window.location?.assign === "function") window.location.assign(url);
  else if (window.location) window.location.href = url;
}

function formatDailyDate(dateValue){
  const parsed=DAILY_API?.parseDailyDate(dateValue);
  return parsed?`${parsed.month}月${parsed.day}日`:dateValue;
}

function dailyIsToday(dateValue, today=DAILY_API?.todayInShanghai?.()){
  return Boolean(dateValue&&today&&dateValue===today);
}

function dailyWeekdayLabel(dateValue){
  const parsed=DAILY_API?.parseDailyDate(dateValue);
  if(!parsed)return "";
  const probe=new Date(Date.UTC(2000,parsed.month-1,parsed.day));
  probe.setUTCFullYear(parsed.year);
  const weekday=probe.getUTCDay();
  return `周${["日","一","二","三","四","五","六"][weekday]}`;
}

function recentDailyStats(today=DAILY_API?.todayInShanghai?.()){
  const dates=DAILY_API?.recentDailyDates?.(today,7)||[];
  let completed=0,perfect=0;
  dates.forEach((date)=>{
    const score=dailySave?.entries?.[date];
    if(score){completed++;if(score.contractPerfect)perfect++;}
  });
  return {dates,completed,perfect};
}

function dailyRunSnapshotStorageKey(dateValue){
  return DAILY_API?.parseDailyDate(dateValue)?`${DAILY_RUN_SNAPSHOT_PREFIX}${dateValue}`:null;
}

function emptyInventory() { return { hammer: 0, bomb: 0, flash: 0, spirit: 0, torch: 0, teleport: 0 }; }

function isWallTile(tile) { return tile === TILE.STONE || tile === TILE.WOOD || tile === TILE.CRACKED; }
function isBreakableWall(tile) { return tile === TILE.WOOD || tile === TILE.CRACKED; }

function cloneInventory(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(INVENTORY_KEYS.map((keyName) => [keyName, boundedInteger(source[keyName])]));
}

function isCompleteInventoryRecord(value){
  return Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&INVENTORY_KEYS.every((keyName)=>
    Object.prototype.hasOwnProperty.call(value,keyName)&&typeof value[keyName]==="number"&&Number.isFinite(value[keyName])&&value[keyName]>=0));
}

function defaultSave(generation = 0, campaignId = DEFAULT_CAMPAIGN_ID) {
  return {
    version: SAVE_VERSION,
    challengeRevision: CHALLENGE_REVISION,
    generation: boundedInteger(generation, 0, Number.MAX_SAFE_INTEGER),
    campaignId,
    unlocked: 0,
    completed: [],
    stars: {},
    badges: {},
    entries: {},
    lastLevel: 0,
    previewDuration: 5,
    afterimage: false,
    sound: true,
    teleportGiftGranted: true,
    torchGiftGranted: true,
    fiveSecondPreviewDefault: true,
    spiritLevelGiftGranted: true,
  };
}

function migrateSave(rawValue) {
  const raw = rawValue && typeof rawValue === "object" ? { ...rawValue } : {};
  const previousChallengeRevision=boundedInteger(raw.challengeRevision,0,Number.MAX_SAFE_INTEGER);
  const sourceEntries=raw.entries&&typeof raw.entries==="object"&&!Array.isArray(raw.entries)?raw.entries:{};
  const entries=Object.fromEntries(Object.entries(sourceEntries).map(([index,inventory])=>[
    index,inventory&&typeof inventory==="object"
      ? Array.isArray(inventory)?[...inventory]:{...inventory}
      : inventory,
  ]));
  if(previousChallengeRevision<2&&Array.isArray(raw.completed)&&raw.completed.map(Number).includes(17)
    &&Object.prototype.hasOwnProperty.call(entries,18)&&entries[18]&&typeof entries[18]==="object"&&!Array.isArray(entries[18])){
    entries[18].bomb=Math.max(0,boundedInteger(entries[18].bomb)-1);
  }
  if (previousChallengeRevision < 2) {
    raw.badges = {};
  } else if(previousChallengeRevision < CHALLENGE_REVISION){
    const badges=raw.badges&&typeof raw.badges==="object"&&!Array.isArray(raw.badges)?{...raw.badges}:{};
    EFFECTIVE_TOOL_BADGE_INDICES.forEach((index)=>{delete badges[index];});
    raw.badges=badges;
  }
  if (previousChallengeRevision < CHALLENGE_REVISION) {
    raw.challengeRevision = CHALLENGE_REVISION;
  }
  if (!raw.teleportGiftGranted) {
    Object.values(entries).forEach((inventory) => {
      if (inventory && typeof inventory === "object" && inventory.teleport == null) inventory.teleport = 2;
    });
    raw.teleportGiftGranted = true;
  }
  if (!raw.torchGiftGranted) {
    Object.values(entries).forEach((inventory) => {
      if (inventory && typeof inventory === "object") inventory.torch = boundedInteger(inventory.torch) + 3;
    });
    raw.torchGiftGranted = true;
  }
  if (!raw.fiveSecondPreviewDefault) {
    raw.previewDuration = 5;
    raw.fiveSecondPreviewDefault = true;
  }
  if (!raw.spiritLevelGiftGranted) {
    Object.values(entries).forEach((inventory) => {
      if (inventory && typeof inventory === "object") inventory.spirit = boundedInteger(inventory.spirit) + 1;
    });
    raw.spiritLevelGiftGranted = true;
  }
  raw.entries = entries;
  raw.version = SAVE_VERSION;
  return raw;
}

function sanitizeSave(rawValue) {
  const raw = rawValue && typeof rawValue === "object" ? rawValue : {};
  const clean = defaultSave();
  clean.challengeRevision = CHALLENGE_REVISION;
  clean.generation = boundedInteger(raw.generation, 0, Number.MAX_SAFE_INTEGER);
  const campaignId=String(raw.campaignId||DEFAULT_CAMPAIGN_ID);
  clean.campaignId=/^[A-Za-z0-9_-]{1,80}$/.test(campaignId)?campaignId:DEFAULT_CAMPAIGN_ID;
  const rawCompleted = (Array.isArray(raw.completed) ? raw.completed : []).map(Number)
    .filter((index)=>Number.isInteger(index)&&index>=0&&index<LEVELS.length);
  const rawEntryIndices = raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries)
    ? Object.keys(raw.entries).map(Number).filter((index)=>Number.isInteger(index)&&index>=1&&index<LEVELS.length) : [];
  const inferredUnlocked = Math.max(0, ...rawCompleted.map((index) => Math.min(LEVELS.length - 1,index+1)), ...rawEntryIndices);
  clean.unlocked = Math.max(boundedInteger(raw.unlocked, 0, LEVELS.length - 1), inferredUnlocked);
  clean.completed = [...new Set(rawCompleted)]
    .filter((index) => index <= clean.unlocked)
    .sort((a, b) => a - b);
  clean.stars = {};
  if (raw.stars && typeof raw.stars === "object" && !Array.isArray(raw.stars)) {
    Object.entries(raw.stars).forEach(([index, stars]) => {
      const levelIndex = boundedInteger(index, 0, LEVELS.length - 1);
      if (String(levelIndex) === String(index) || Number(index) === levelIndex) clean.stars[levelIndex] = boundedInteger(stars, 0, 3);
    });
  }
  clean.badges = {};
  if (raw.badges && typeof raw.badges === "object" && !Array.isArray(raw.badges)) {
    Object.entries(raw.badges).forEach(([index, earned]) => {
      const levelIndex = Number(index);
      if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) return;
      if (earned === true && LEVELS[levelIndex]?.challenge) clean.badges[levelIndex] = true;
    });
  }
  clean.entries = {};
  if (raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries)) {
    Object.entries(raw.entries).forEach(([index, inventory]) => {
      const levelIndex = Number(index);
      if (!Number.isInteger(levelIndex) || levelIndex < 1 || levelIndex >= LEVELS.length) return;
      if (levelIndex >= 1 && levelIndex <= clean.unlocked) clean.entries[levelIndex] = cloneInventory(inventory);
    });
  }
  clean.lastLevel = boundedInteger(raw.lastLevel ?? clean.unlocked, 0, clean.unlocked);
  clean.previewDuration = VALID_PREVIEW_DURATIONS.has(Number(raw.previewDuration)) ? Number(raw.previewDuration) : 5;
  clean.afterimage = raw.afterimage === true;
  clean.sound = raw.sound !== false;
  clean.teleportGiftGranted = raw.teleportGiftGranted === true;
  clean.torchGiftGranted = raw.torchGiftGranted === true;
  clean.fiveSecondPreviewDefault = raw.fiveSecondPreviewDefault === true;
  clean.spiritLevelGiftGranted = raw.spiritLevelGiftGranted === true;
  return clean;
}

function parseStoredSave(serialized) {
  if (!serialized) return null;
  try {
    const parsed=JSON.parse(serialized);
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return null;
    return sanitizeSave(migrateSave(parsed));
  }
  catch (_) { return null; }
}

function readSaveAtKey(storageKey) {
  let serialized = null;
  try { serialized = localStorage.getItem(storageKey); }
  catch (_) { return null; }
  return parseStoredSave(serialized);
}

function readStoredSave() {
  return readSaveAtKey(SAVE_KEY);
}

function readLegacyStoredSave() {
  for (const storageKey of LEGACY_SAVE_KEYS) {
    const parsed = readSaveAtKey(storageKey);
    if (parsed) return parsed;
  }
  return null;
}

function writeStoredSave(snapshot){
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot));
    lastSaveWriteSucceeded=true;
    storageWarningPending=false;
    storageWarningShown=false;
    return true;
  }catch(_){
    lastSaveWriteSucceeded=false;
    storageWarningPending=true;
    return false;
  }
}

function warnStorageUnavailable(){
  if(!storageWarningPending||storageWarningShown||!state)return;
  storageWarningPending=false;
  storageWarningShown=true;
  showToast("本机暂时无法保存主线进度 · 请在设置中复制主线存档码",true);
}

function mergeSaveSnapshots(localValue, storedValue, { fields = [], entryIndices = [] } = {}) {
  const local = sanitizeSave(localValue);
  const stored = sanitizeSave(storedValue);
  if (local.generation !== stored.generation) return local.generation > stored.generation ? local : stored;
  if (local.campaignId !== stored.campaignId) return stored;
  const merged = { ...stored };
  fields.forEach((field) => {
    if (["previewDuration", "afterimage", "sound", "lastLevel"].includes(field)) merged[field] = local[field];
  });
  merged.unlocked = Math.max(local.unlocked, stored.unlocked);
  merged.completed = [...new Set([...stored.completed, ...local.completed])];
  merged.stars = { ...stored.stars };
  Object.entries(local.stars).forEach(([index, value]) => {
    merged.stars[index] = Math.max(boundedInteger(merged.stars[index], 0, 3), boundedInteger(value, 0, 3));
  });
  merged.badges = { ...stored.badges };
  Object.entries(local.badges).forEach(([index, earned]) => { if (earned) merged.badges[index] = true; });
  const preferredEntries = new Set(entryIndices.map(Number));
  merged.entries = { ...stored.entries };
  Object.entries(local.entries).forEach(([index, inventory]) => {
    if (!(index in merged.entries) || preferredEntries.has(Number(index))) merged.entries[index] = cloneInventory(inventory);
  });
  merged.teleportGiftGranted = local.teleportGiftGranted || stored.teleportGiftGranted;
  merged.torchGiftGranted = local.torchGiftGranted || stored.torchGiftGranted;
  merged.fiveSecondPreviewDefault = local.fiveSecondPreviewDefault || stored.fiveSecondPreviewDefault;
  merged.spiritLevelGiftGranted = local.spiritLevelGiftGranted || stored.spiritLevelGiftGranted;
  return sanitizeSave(merged);
}

function loadSave({writeBack=true}={}) {
  const clean = readStoredSave() || readLegacyStoredSave();
  if (!clean) return defaultSave();
  if(writeBack)writeStoredSave(clean);
  return clean;
}

function dailyScoreRecord(value,{legacy=false}={}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stars = Number.isInteger(value.stars) && value.stars >= 1 && value.stars <= 3 ? value.stars : null;
  const routeCost = Number.isInteger(value.routeCost) && value.routeCost >= 0 && value.routeCost <= 999 ? value.routeCost : null;
  const mistakes = Number.isInteger(value.mistakes) && value.mistakes >= 0 && value.mistakes <= 999 ? value.mistakes : null;
  const steps = Number.isInteger(value.steps) && value.steps >= 0 && value.steps <= 1000000 ? value.steps : null;
  const contractPerfect=legacy ? false : typeof value.contractPerfect==="boolean" ? value.contractPerfect : null;
  if (stars === null || routeCost === null || mistakes === null || steps === null || contractPerfect === null || typeof value.perfect !== "boolean") return null;
  return { stars,routeCost,mistakes,steps,perfect:value.perfect,contractPerfect };
}

function dailyStarsForCost(routeCost, optimalCost) {
  return routeCost <= optimalCost ? 3 : routeCost <= optimalCost + 1 ? 2 : 1;
}

function compareDailyScores(left, right) {
  if (!left) return 1;
  if (!right) return -1;
  return right.stars-left.stars || left.routeCost-right.routeCost || left.mistakes-right.mistakes
    || left.steps-right.steps || Number(right.perfect)-Number(left.perfect);
}

function betterDailyScore(left, right) {
  if (!left) return right ? { ...right } : null;
  if (!right) return { ...left };
  const best=compareDailyScores(left,right) <= 0 ? left : right;
  return { ...best,contractPerfect:Boolean(left.contractPerfect||right.contractPerfect) };
}

function hasDailySaveRoot(value,{legacy=false}={}) {
  const expectedSchema=legacy?LEGACY_DAILY_SAVE_SCHEMA:DAILY_SAVE_SCHEMA;
  return Boolean(DAILY_API&&value&&typeof value==="object"&&!Array.isArray(value)
    &&value.schema===expectedSchema&&value.bankVersion===DAILY_API.DAILY_BANK_VERSION
    &&(legacy||value.contractRevision==null
      ||(Number.isInteger(value.contractRevision)&&value.contractRevision>=0&&value.contractRevision<=DAILY_CONTRACT_REVISION))
    &&value.entries&&typeof value.entries==="object"&&!Array.isArray(value.entries));
}

function sanitizeDailySave(value,{legacy=false}={}) {
  const clean = {
    schema:DAILY_SAVE_SCHEMA,
    bankVersion:DAILY_API?.DAILY_BANK_VERSION || 0,
    contractRevision:DAILY_CONTRACT_REVISION,
    entries:{},
  };
  if (!hasDailySaveRoot(value,{legacy})) return clean;
  const obsoleteContract=legacy||value.contractRevision!==DAILY_CONTRACT_REVISION;
  const valid = [];
  for (const [date,record] of Object.entries(value.entries)) {
    if (!DAILY_API.parseDailyDate(date)) continue;
    const score = dailyScoreRecord(record,{legacy:obsoleteContract});
    if (!score) continue;
    const level=DAILY_API.getDailyChallenge(date);
    const successfulBreaks=score.routeCost-score.mistakes;
    const expectedStars=dailyStarsForCost(score.routeCost,level.daily.optimalCost);
    const expectedPerfect=expectedStars===3&&score.mistakes===0&&score.routeCost===level.daily.optimalCost;
    const star=findChar(level.map,TILE.STAR);
    const minimumSteps=successfulBreaks===level.daily.optimalCost
      ? level.daily.optimalSteps
      : Math.abs(level.start[0]-star[0])+Math.abs(level.start[1]-star[1]);
    if(score.routeCost>level.daily.hammerBudget||score.mistakes>score.routeCost
      ||successfulBreaks<level.daily.optimalCost||score.steps<minimumSteps
      ||score.stars!==expectedStars||score.perfect!==expectedPerfect
      ||(score.contractPerfect&&!score.perfect))continue;
    valid.push([date,score]);
  }
  valid.sort((left,right)=>right[0].localeCompare(left[0])).slice(0,90)
    .forEach(([date,score])=>{clean.entries[date]=score;});
  return clean;
}

function readDailySaveAtKey(storageKey,{legacy=false}={}) {
  if (!DAILY_API) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if(raw===null)return null;
    const parsed=JSON.parse(raw);
    return hasDailySaveRoot(parsed,{legacy})?sanitizeDailySave(parsed,{legacy}):null;
  } catch (_) { return null; }
}

function readDailySave() {
  return readDailySaveAtKey(DAILY_SAVE_KEY)||sanitizeDailySave(null);
}

function writeDailySave(value) {
  const clean = sanitizeDailySave(value);
  try { localStorage.setItem(DAILY_SAVE_KEY,JSON.stringify(clean));lastDailyWriteSucceeded=true; }
  catch (_) { lastDailyWriteSucceeded=false; }
  return clean;
}

function loadDailySave({writeBack=true}={}) {
  const current=readDailySaveAtKey(DAILY_SAVE_KEY);
  const clean=current||readDailySaveAtKey(LEGACY_DAILY_SAVE_KEY,{legacy:true})||sanitizeDailySave(null);
  if (DAILY_API&&writeBack) writeDailySave(clean);
  return clean;
}

function mergeDailySaves(left, right) {
  const merged=sanitizeDailySave(left);
  const other=sanitizeDailySave(right);
  for (const [date,score] of Object.entries(other.entries)) merged.entries[date]=betterDailyScore(merged.entries[date],score);
  return sanitizeDailySave(merged);
}

function persistDailyScore(date, score) {
  if (!DAILY_API?.parseDailyDate(date)) return null;
  const candidate=dailyScoreRecord(score);
  if (!candidate) return null;
  const verified=sanitizeDailySave({
    schema:DAILY_SAVE_SCHEMA,
    bankVersion:DAILY_API.DAILY_BANK_VERSION,
    contractRevision:DAILY_CONTRACT_REVISION,
    entries:{[date]:candidate},
  }).entries[date];
  if(!verified)return null;
  const stored=readDailySave();
  dailySave=mergeDailySaves(dailySave,stored);
  const previous=dailySave.entries[date] ? { ...dailySave.entries[date] } : null;
  dailySave.entries[date]=betterDailyScore(previous,verified);
  dailySave=writeDailySave(dailySave);
  return {
    previous,best:{...dailySave.entries[date]},
    improved:!previous||compareDailyScores(verified,previous)<0,
    contractEarned:Boolean(verified.contractPerfect&&!previous?.contractPerfect),
  };
}

function nextSaveGeneration() {
  const stored = readStoredSave();
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(save?.generation || 0, stored?.generation || 0) + 1);
}

function createCampaignId(){
  try{if(typeof window.crypto?.randomUUID==="function")return `campaign-${window.crypto.randomUUID()}`;}catch(_){}
  return `campaign-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
}

function persist(options = {}) {
  const local = sanitizeSave(save);
  const stored = options.replace ? null : readStoredSave();
  const adoptedNewCampaign=Boolean(stored&&(stored.generation>local.generation||
    (stored.generation===local.generation&&stored.campaignId!==local.campaignId)));
  if(adoptedNewCampaign){
    clearEntrySnapshots();
    const adopted={...stored};
    (options.fields||[]).forEach((field)=>{
      if(["previewDuration","afterimage","sound"].includes(field))adopted[field]=local[field];
    });
    save=sanitizeSave(adopted);
    if(state&&!stateMatchesCurrentSave())state.saveConflict=true;
  }else save = stored ? mergeSaveSnapshots(local, stored, options) : local;
  const wrote=writeStoredSave(save);
  if(wrote&&state?.mode==="campaign"&&state.volatileContinuation&&!state.complete&&stateMatchesCurrentSave()){
    state.volatileContinuation=false;
    clearRunSnapshot();
    scheduleRunSnapshot();
  }
  if(adoptedNewCampaign&&state){
    syncSettings();
    renderTrack();
    syncIntroProgressControls();
    showToast("另一标签页已更换存档 · 已同步当前进度",true);
  }
  warnStorageUnavailable();
  return wrote;
}

function isCompactViewport() {
  return compactViewportQuery?.matches || window.innerWidth <= 720;
}

function prefersReducedMotion() {
  return Boolean(reducedMotionQuery?.matches);
}

function pauseStartForCurrentState(now=performance.now()) {
  if (!pauseReasons.size && pausedClockState === null) return now;
  if (!state || state === pausedClockState) return pausedAt;
  const stateStartedAt=Number(state.startedAt);
  return Number.isFinite(stateStartedAt) ? Math.max(pausedAt,stateStartedAt) : now;
}

function shiftGameClock(delta,pauseStartedAt=pausedAt) {
  if (!state || delta <= 0) return;
  if (state.phase === "preview" && Number.isFinite(state.previewEnds)) state.previewEnds += delta;
  if (state.flashEnds > pauseStartedAt) state.flashEnds += delta;
  else if (state.flashEnds > 0) state.flashEnds = 0;
  if (state.phase === "fading" && state.fadeStarted > 0) state.fadeStarted += delta;
  if (state.spiritLightTransition) state.spiritLightTransition.startedAt += delta;
  state.lastProgress += delta;
  state.pulses.forEach((pulse) => { pulse.created += delta; });
}

function startGameMotion(step) {
  let frameId=0,startedAt=performance.now(),cancelled=false;
  let motionPausedAt=pauseReasons.size?performance.now():null;
  const motion={
    pause(){
      if(frameId){cancelAnimationFrame(frameId);frameId=0;}
      if(motionPausedAt===null)motionPausedAt=performance.now();
    },
    resume(delta=0){
      if(cancelled)return;
      if(pauseReasons.size){
        if(motionPausedAt===null)motionPausedAt=performance.now();
        return;
      }
      if(motionPausedAt!==null){
        startedAt+=Math.max(0,performance.now()-motionPausedAt);
        motionPausedAt=null;
      }else startedAt+=delta;
      if(!frameId&&!pauseReasons.size)frameId=requestAnimationFrame(frame);
    },
    cancel(){cancelled=true;motion.pause();activeMotions.delete(motion);},
  };
  function frame(now){
    frameId=0;
    if(cancelled)return;
    if(pauseReasons.size)return;
    let shouldContinue=false;
    try { shouldContinue=step(now,startedAt); }
    catch (error) { motion.cancel(); throw error; }
    if(shouldContinue)motion.resume();
    else motion.cancel();
  }
  activeMotions.add(motion);
  motion.resume();
  return motion;
}

function scheduleGameTimeout(callback,delay) {
  let timeoutId=0,remaining=Math.max(0,delay),startedAt=0,cancelled=false;
  const timer={
    pause(){
      if(!timeoutId)return;
      (window.clearTimeout||clearTimeout)(timeoutId);
      timeoutId=0;
      remaining=Math.max(0,remaining-(performance.now()-startedAt));
    },
    resume(){
      if(cancelled||timeoutId||pauseReasons.size)return;
      startedAt=performance.now();
      timeoutId=window.setTimeout(()=>{
        timeoutId=0;
        if(cancelled)return;
        activeGameTimers.delete(timer);
        callback();
      },remaining);
    },
    cancel(){cancelled=true;timer.pause();activeGameTimers.delete(timer);},
  };
  activeGameTimers.add(timer);
  timer.resume();
  return timer;
}

function cancelActiveGameWork() {
  [...activeMotions].forEach((motion)=>motion.cancel());
  [...activeGameTimers].forEach((timer)=>timer.cancel());
}

function setGamePaused(reason, shouldPause) {
  if (shouldPause) {
    if (pauseReasons.has(reason)) return;
    pauseReasons.add(reason);
    if (pauseReasons.size === 1) {
      pausedAt = performance.now();
      pausedClockState = state;
      cancelAnimationFrame(raf);
      raf = 0;
      activeMotions.forEach((motion)=>motion.pause());
      activeGameTimers.forEach((timer)=>timer.pause());
      audioContext?.suspend?.().catch?.(() => {});
    }
    return;
  }
  if (!pauseReasons.delete(reason) || pauseReasons.size > 0) return;
  const now = performance.now();
  const pauseStartedAt=pauseStartForCurrentState(now);
  const pausedDuration=Math.max(0,now-pauseStartedAt);
  pausedClockState=null;
  pausedAt=0;
  shiftGameClock(pausedDuration,pauseStartedAt);
  activeMotions.forEach((motion)=>motion.resume(pausedDuration));
  activeGameTimers.forEach((timer)=>timer.resume());
  lastTime = now;
  lastRenderedAt = 0;
  audioContext?.resume?.().catch?.(() => {});
  if (!raf) raf = requestAnimationFrame(draw);
}

function confirmWithGamePause(message) {
  if (typeof window.confirm !== "function") return true;
  setGamePaused("native-dialog", true);
  try { return window.confirm(message); }
  finally { setGamePaused("native-dialog", false); }
}

function promptWithGamePause(message, defaultValue) {
  if (typeof window.prompt !== "function") return null;
  setGamePaused("native-dialog", true);
  try { return window.prompt(message, defaultValue); }
  finally { setGamePaused("native-dialog", false); }
}

function setGameBackgroundInert(shouldBeInert) {
  if (!appElement) return;
  if ("inert" in appElement) {
    appElement.inert = shouldBeInert;
    appElement.removeAttribute?.("aria-hidden");
  } else if (shouldBeInert) appElement.setAttribute?.("aria-hidden", "true");
  else appElement.removeAttribute?.("aria-hidden");
}

function focusableElements(backdrop) {
  if (!backdrop?.querySelectorAll) return [];
  return [...backdrop.querySelectorAll("button:not(:disabled), input:not(:disabled), summary, [href], [tabindex]:not([tabindex='-1'])")]
    .filter((element) => !element.disabled && element.getAttribute?.("tabindex") !== "-1"
      && !element.classList?.contains("hidden") && element.getAttribute?.("aria-hidden") !== "true");
}

function modalTabSequence(backdrop) {
  const controls=focusableElements(backdrop);
  controls.forEach((element)=>{
    if (["BUTTON","INPUT","SUMMARY"].includes(element.tagName)
      && element.getAttribute?.("tabindex")===null) element.setAttribute?.("tabindex","0");
  });
  return controls;
}

function focusModalElement(backdrop, target) {
  if (backdrop === semanticMapModal && target?.classList?.contains("semantic-map-cell")) focusSemanticMapTarget(target);
  else target?.focus?.();
}

function scheduleModalFocus(backdrop, attempt) {
  const epoch = ++modalFocusEpoch;
  const guardedAttempt = () => {
    if (epoch === modalFocusEpoch) attempt();
  };
  guardedAttempt();
  window.setTimeout(guardedAttempt, 0);
  requestAnimationFrame(guardedAttempt);
  window.setTimeout(guardedAttempt, 50);
  backdrop.addEventListener?.("transitionend", guardedAttempt, { once:true });
  window.setTimeout(() => {
    // Some reduced-motion WebKit builds omit transitionend. Remove the
    // one-shot listener after the fallback so repeated modal use cannot
    // retain stale focus closures indefinitely.
    backdrop.removeEventListener?.("transitionend", guardedAttempt);
    guardedAttempt();
  }, 400);
}

function openModal(backdrop, focusTarget = null, pauseReason = "", returnFocusFallback = null) {
  if (!backdrop) return;
  clearCanvasPointerGesture();
  const active = document.activeElement;
  modalReturnFocus = active?.focus && active !== document.body && active !== document.documentElement
    ? active
    : returnFocusFallback;
  backdrop.classList.add("visible");
  backdrop.removeAttribute?.("aria-hidden");
  backdrop.dataset.pauseReason = pauseReason;
  setGameBackgroundInert(true);
  if (pauseReason) setGamePaused(pauseReason, true);
  const tabSequence=modalTabSequence(backdrop);
  const target = typeof focusTarget === "string" ? backdrop.querySelector?.(focusTarget) : focusTarget;
  const resolvedTarget = target || tabSequence[0];
  // In mobile WebKit the newly visible backdrop can still inherit its old
  // `visibility:hidden` value during the first rendering frame. Retry after
  // the style pass and once more on a short fallback delay; non-text controls
  // do not require retained user activation.
  scheduleModalFocus(backdrop, () => {
    if (backdrop.classList.contains("visible") && !backdrop.contains?.(document.activeElement)) {
      focusModalElement(backdrop,resolvedTarget);
    }
  });
}

function closeModal(backdrop, { restoreFocus = true } = {}) {
  if (!backdrop) return;
  const pauseReason = backdrop.dataset?.pauseReason || "";
  backdrop.classList.remove("visible");
  backdrop.setAttribute?.("aria-hidden", "true");
  if (pauseReason) setGamePaused(pauseReason, false);
  if (backdrop.dataset) backdrop.dataset.pauseReason = "";
  if (!document.querySelector?.(".modal-backdrop.visible")) setGameBackgroundInert(false);
  const returnTarget = modalReturnFocus;
  modalReturnFocus = null;
  const closedFocus = document.activeElement;
  if (backdrop.contains?.(closedFocus)) closedFocus?.blur?.();
  if (!restoreFocus) {
    modalFocusEpoch++;
    return;
  }
  scheduleModalFocus(backdrop, () => {
    if (backdrop.classList.contains("visible") || document.querySelector?.(".modal-backdrop.visible")) return;
    const active = document.activeElement;
    const focusIsUnclaimed = !active || active === document.body || active === document.documentElement
      || active === closedFocus || backdrop.contains?.(active);
    if (focusIsUnclaimed) returnTarget?.focus?.();
  });
}

function trapModalFocus(event, backdrop) {
  if (event.key !== "Tab") return;
  const focusable = modalTabSequence(backdrop);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  const activeIndex=focusable.indexOf(active);
  const nextIndex=activeIndex<0
    ? event.shiftKey ? focusable.length-1 : 0
    : (activeIndex+(event.shiftKey?-1:1)+focusable.length)%focusable.length;
  // WebKit can omit native buttons from its default Tab sequence unless the
  // browser's full-keyboard-access preference is enabled. Advance every step
  // ourselves so the modal order stays identical across browser settings.
  event.preventDefault();
  focusModalElement(backdrop,focusable[nextIndex]);
}

function grantSpiritForLevelEntry(inventory) {
  const granted=cloneInventory(inventory);
  granted.spirit++;
  return granted;
}

function firstLevelInventory() { return { ...emptyInventory(), flash: 3, spirit: 1, torch: 3, teleport: 2 }; }
const OPTIMAL_ENTRY_HAMMERS = [0,7,10,18,20,17,14,10,6,7,7,7,7,7,6];
const STANDARD_ENTRY_TORCHES = [3,3,2,2,2,3,3,3,3,4,4,4,4,5,5];
function fallbackEntryInventory(index) {
  const rescue = typeof LEVELS === "undefined" ? null : LEVELS[index]?.rescueInventory;
  if (rescue && typeof isCompleteInventoryRecord === "function" && typeof cloneInventory === "function" && isCompleteInventoryRecord(rescue)) return cloneInventory(rescue);
  return { ...emptyInventory(), hammer:OPTIMAL_ENTRY_HAMMERS[index]||0, flash:index===0?3:2, spirit:1, torch:STANDARD_ENTRY_TORCHES[index]??2, teleport:2 };
}

function normalizeMap(rows) {
  return rows.map((row) => row.split("").map((char) => {
    if (char === TILE.PLAYER) return TILE.FLOOR;
    if (char === TILE.HAMMER || char === TILE.BOMB || char === TILE.SPIRIT || char === TILE.TORCH || char === TILE.SHARD || char === TILE.STAR) return TILE.FLOOR;
    return char;
  }));
}

function findChar(rows, char) {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf(char);
    if (x >= 0) return [x, y];
  }
  return null;
}

function allChars(rows, char) {
  const result = [];
  rows.forEach((row, y) => [...row].forEach((value, x) => value === char && result.push([x, y])));
  return result;
}

function levelRunItems(level) {
  const mandatory=new Set((level.rewardSeal?level.mandatoryRewards||[]:[]).map((reward)=>reward.position.join(",")));
  return [
    ...allChars(level.map, TILE.HAMMER).map(([x, y]) => ({ x, y, type: "hammer", picked: false, amount: 5 })),
    ...allChars(level.map, TILE.BOMB).map(([x, y]) => ({ x, y, type: "bomb", picked: false, amount: 1 })),
    ...allChars(level.map, TILE.SPIRIT).map(([x, y]) => ({ x, y, type: "spirit", picked: false, amount: 1 })),
    ...allChars(level.map, TILE.TORCH).map(([x, y]) => ({ x, y, type: "torch", picked: false, amount: 1 })),
  ].map((item)=>({...item,mandatory:mandatory.has(`${item.x},${item.y}`)}));
}

function runItemKey(item) { return `${item.type}:${item.x},${item.y}`; }

function levelRunFingerprint(level) {
  const mechanics=JSON.stringify({
    recommended:level.recommended??null,
    challenge:level.challenge??null,
    tutorial:level.tutorial??null,
    rewardSeal:Boolean(level.rewardSeal),
  });
  const source = `${level.name}\n${level.start.join(",")}\n${boundedInteger(level.memoryPins,0,8)}\n${mechanics}\n${level.map.join("\n")}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isPlainRunRecord(value) {
  return Boolean(value&&typeof value==="object"&&!Array.isArray(value));
}

function strictRunInteger(value, maximum = 1000000) {
  return Number.isInteger(value)&&value>=0&&value<=maximum ? value : null;
}

function strictRunInventory(value) {
  if(!isPlainRunRecord(value))return null;
  const keys=Object.keys(value);
  if(keys.length!==INVENTORY_KEYS.length||!keys.every((keyName)=>INVENTORY_KEYS.includes(keyName)))return null;
  const inventory={};
  for(const keyName of INVENTORY_KEYS){
    const amount=strictRunInteger(value[keyName],999);
    if(amount===null)return null;
    inventory[keyName]=amount;
  }
  return inventory;
}

function readRunCellKeys(value,width,height,predicate=()=>true,maximum=width*height) {
  if(!Array.isArray(value)||value.length>maximum)return null;
  const result=[],seen=new Set();
  for(const rawKey of value){
    if(typeof rawKey!=="string"||!/^\d+,\d+$/.test(rawKey)||seen.has(rawKey))return null;
    const [x,y]=rawKey.split(",").map(Number);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height||!predicate(x,y))return null;
    seen.add(rawKey);result.push(rawKey);
  }
  return result;
}

function readRunBlastEvents(value,{width,height,baseMap,currentMap,openedWalls,usage,mistakes}) {
  if(!Array.isArray(value)||value.length!==usage.bomb)return null;
  const openedSet=new Set(openedWalls),blastWalls=new Set(),resolvedPins=new Set(),ownerByWall=new Map();
  const blastEvents=[];
  for(let eventIndex=0;eventIndex<value.length;eventIndex++){
    const rawEvent=value[eventIndex];
    if(!isPlainRunRecord(rawEvent))return null;
    const eventKeys=Object.keys(rawEvent);
    if(eventKeys.length!==3||!eventKeys.every((keyName)=>["center","walls","pinned"].includes(keyName)))return null;
    const center=rawEvent.center;
    if(!isPlainRunRecord(center)||Object.keys(center).length!==2
      ||!Number.isInteger(center.x)||!Number.isInteger(center.y)
      ||center.x<0||center.y<0||center.x>=width||center.y>=height
      ||currentMap[center.y][center.x]!==TILE.FLOOR)return null;
    const walls=readRunCellKeys(rawEvent.walls,width,height,(x,y)=>isBreakableWall(baseMap[y][x]),8);
    if(!walls)return null;
    const wallSet=new Set(walls);
    const pinned=readRunCellKeys(rawEvent.pinned,width,height,(x,y)=>wallSet.has(key(x,y)),walls.length);
    if(!pinned)return null;
    for(const cellKey of walls){
      const [wallX,wallY]=cellKey.split(",").map(Number);
      if(!openedSet.has(cellKey)||blastWalls.has(cellKey)
        ||(wallX===center.x&&wallY===center.y)
        ||Math.abs(wallX-center.x)>1||Math.abs(wallY-center.y)>1)return null;
      blastWalls.add(cellKey);ownerByWall.set(cellKey,eventIndex);
    }
    for(const cellKey of pinned){
      if(resolvedPins.has(cellKey))return null;
      resolvedPins.add(cellKey);
    }
    blastEvents.push({center:{x:center.x,y:center.y},walls,pinned});
  }
  const successfulHammerUses=usage.hammer-mistakes;
  if(successfulHammerUses<0)return null;
  const hammeredWalls=openedWalls.filter((cellKey)=>!blastWalls.has(cellKey));
  if(hammeredWalls.length!==successfulHammerUses||hammeredWalls.some((cellKey)=>{
    const [x,y]=cellKey.split(",").map(Number);return baseMap[y][x]!==TILE.WOOD;
  }))return null;
  const hammeredSet=new Set(hammeredWalls);
  for(let eventIndex=0;eventIndex<blastEvents.length;eventIndex++){
    const {center}=blastEvents[eventIndex],centerKey=key(center.x,center.y),centerBase=baseMap[center.y][center.x];
    if(isBreakableWall(centerBase)){
      const owner=ownerByWall.get(centerKey);
      const openedBeforeBlast=owner===undefined?hammeredSet.has(centerKey):owner<eventIndex;
      if(!openedBeforeBlast)return null;
    }
    for(let y=Math.max(0,center.y-1);y<=Math.min(height-1,center.y+1);y++){
      for(let x=Math.max(0,center.x-1);x<=Math.min(width-1,center.x+1);x++){
        if(!isBreakableWall(baseMap[y][x]))continue;
        const nearbyKey=key(x,y),owner=ownerByWall.get(nearbyKey);
        if(!openedSet.has(nearbyKey)||(owner!==undefined&&owner>eventIndex))return null;
      }
    }
  }
  return {
    blastEvents,
    resolvedPins,
    maxBlastYield:blastEvents.reduce((maximum,event)=>Math.max(maximum,event.walls.length),0),
    maxBlastPinnedYield:blastEvents.reduce((maximum,event)=>Math.max(maximum,event.pinned.length),0),
  };
}

function validRunTutorialPhase(levelIndex,phase) {
  const allowed = levelIndex===0
    ? ["spiritUse","spiritExplore","spiritReveal","spiritReturn","move","selectWood","breakWood","goal"]
    : levelIndex===1 ? ["torchSelect","torchAim","torchDone"]
    : [];
  return phase===null||allowed.includes(phase);
}

function stableRunTutorialPhase(phase) {
  return {breakWood:"selectWood",torchAim:"torchSelect"}[phase]||phase;
}

function serializeRunSnapshot() {
  if(!state||state.mode!=="campaign"||state.complete||state.locked||introModal.classList.contains("visible")||!stateMatchesCurrentSave())return null;
  if(state.spiritMode&&state.soul&&!isFloor(state.soul.x,state.soul.y))return null;
  const level=state.level,width=level.map[0].length,height=level.map.length;
  if(state.map.length!==height||state.map.some((row)=>row.length!==width))return null;
  const baseMap=normalizeMap(level.map);
  const openedWalls=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const base=baseMap[y][x],current=state.map[y][x];
    if(current===base)continue;
    if((base===TILE.WOOD||base===TILE.CRACKED)&&current===TILE.FLOOR)openedWalls.push(key(x,y));
    else return null;
  }
  const now=pauseReasons.size?pauseStartForCurrentState():performance.now();
  const phase=state.phase==="preview"?"preview":"explore";
  const previewRemainingMs=phase==="preview"&&state.previewDuration!==0
    ? Math.max(0,Math.ceil(state.previewEnds-now)) : phase==="preview"?null:0;
  const soul=state.spiritMode&&state.soul
    ? {x:state.soul.x,y:state.soul.y,facing:state.soul.facing<0?-1:1} : null;
  return {
    schema:RUN_SNAPSHOT_SCHEMA,
    saveVersion:SAVE_VERSION,
    challengeRevision:CHALLENGE_REVISION,
    generation:save.generation,
    campaignId:save.campaignId,
    levelIndex:state.levelIndex,
    levelFingerprint:levelRunFingerprint(level),
    practice:state.practice===true,
    entryInventory:cloneInventory(state.entryInventory),
    phase,
    previewDuration:state.previewDuration,
    previewRemainingMs,
    flashRemainingMs:Math.max(0,Math.min(25000,Math.ceil(state.flashEnds-now))),
    openedWalls,
    pickedItems:state.items.filter((item)=>item.picked).map(runItemKey),
    collectedShards:state.shards.filter((shard)=>shard.collected).map((shard)=>key(shard.x,shard.y)),
    player:{x:state.player.x,y:state.player.y,facing:state.player.facing<0?-1:1},
    usage:cloneInventory(state.usage),
    mistakes:boundedInteger(state.mistakes,0,1000000),
    steps:boundedInteger(state.steps,0,1000000),
    newlyRevealed:boundedInteger(state.newlyRevealed,0,1000000),
    prematureStarTouches:boundedInteger(state.prematureStarTouches,0,1000000),
    blastEvents:(Array.isArray(state.blastEvents)?state.blastEvents:[]).map((event)=>({
      center:{x:event?.center?.x,y:event?.center?.y},
      walls:Array.isArray(event?.walls)?[...event.walls]:[],
      pinned:Array.isArray(event?.pinned)?[...event.pinned]:[],
    })),
    maxBlastYield:boundedInteger(state.maxBlastYield,0,8),
    maxBlastPinnedYield:boundedInteger(state.maxBlastPinnedYield,0,8),
    memoryPins:[...state.memoryPins],
    memoryPinsUsed:boundedInteger(state.memoryPinsUsed,0,8),
    permanentLight:[...state.permanentLight],
    tutorialPhase:stableRunTutorialPhase(state.tutorialPhase),
    tutorialSpiritStep:state.tutorialSpiritStep,
    spiritMode:state.spiritMode===true,
    spiritScoutedCurrent:state.spiritScoutedCurrent===true,
    soul,
  };
}

function sanitizeRunSnapshot(rawValue) {
  if(!isPlainRunRecord(rawValue)||![RUN_SNAPSHOT_SCHEMA,LEGACY_RUN_SNAPSHOT_SCHEMA].includes(rawValue.schema)
    ||rawValue.saveVersion!==SAVE_VERSION||rawValue.challengeRevision!==CHALLENGE_REVISION)return null;
  const levelIndex=strictRunInteger(rawValue.levelIndex,LEVELS.length-1);
  if(levelIndex===null||levelIndex>save.unlocked||rawValue.generation!==save.generation||rawValue.campaignId!==save.campaignId)return null;
  const level=LEVELS[levelIndex];
  if(rawValue.levelFingerprint!==levelRunFingerprint(level)||typeof rawValue.practice!=="boolean"
    ||(rawValue.practice&&!save.completed.includes(levelIndex)))return null;
  const entryInventory=strictRunInventory(rawValue.entryInventory);
  const expectedEntry=cloneInventory(getEntryInventory(levelIndex));
  if(!entryInventory||INVENTORY_KEYS.some((keyName)=>entryInventory[keyName]!==expectedEntry[keyName]))return null;
  const usage=strictRunInventory(rawValue.usage);
  if(!usage)return null;
  const width=level.map[0].length,height=level.map.length,baseMap=normalizeMap(level.map);
  const openedWalls=readRunCellKeys(rawValue.openedWalls,width,height,(x,y)=>
    baseMap[y][x]===TILE.WOOD||baseMap[y][x]===TILE.CRACKED);
  if(!openedWalls)return null;
  const openedSet=new Set(openedWalls);
  const items=levelRunItems(level),itemByKey=new Map(items.map((item)=>[runItemKey(item),item]));
  if(!Array.isArray(rawValue.pickedItems)||rawValue.pickedItems.length>items.length)return null;
  const pickedItems=[],pickedSet=new Set();
  for(const itemKey of rawValue.pickedItems){
    if(typeof itemKey!=="string"||pickedSet.has(itemKey)||!itemByKey.has(itemKey))return null;
    pickedSet.add(itemKey);pickedItems.push(itemKey);
  }
  const shardKeys=new Set(allChars(level.map,TILE.SHARD).map(([x,y])=>key(x,y)));
  const collectedShards=readRunCellKeys(rawValue.collectedShards,width,height,(x,y)=>shardKeys.has(key(x,y)),shardKeys.size);
  if(!collectedShards)return null;
  const player=rawValue.player;
  if(!isPlainRunRecord(player)||!Number.isInteger(player.x)||!Number.isInteger(player.y)||![-1,1].includes(player.facing)
    ||player.x<0||player.y<0||player.x>=width||player.y>=height)return null;
  const currentMap=baseMap.map((row)=>[...row]);
  openedWalls.forEach((cellKey)=>{const [x,y]=cellKey.split(",").map(Number);currentMap[y][x]=TILE.FLOOR;});
  if(currentMap[player.y][player.x]!==TILE.FLOOR)return null;
  const playerCell=key(player.x,player.y);
  const playerItem=items.find((item)=>item.x===player.x&&item.y===player.y);
  if((playerItem&&!pickedSet.has(runItemKey(playerItem)))||(shardKeys.has(playerCell)&&!collectedShards.includes(playerCell)))return null;
  const phase=rawValue.phase;
  if(phase!=="explore"||rawValue.previewDuration!==0||rawValue.previewRemainingMs!==0)return null;
  const previewRemainingMs=0;
  const flashRemainingMs=strictRunInteger(rawValue.flashRemainingMs,25000);
  const mistakes=strictRunInteger(rawValue.mistakes);
  const steps=strictRunInteger(rawValue.steps);
  const newlyRevealed=strictRunInteger(rawValue.newlyRevealed);
  const prematureStarTouches=strictRunInteger(rawValue.prematureStarTouches);
  const reportedMaxBlastYield=strictRunInteger(rawValue.maxBlastYield,8);
  const reportedMaxBlastPinnedYield=strictRunInteger(rawValue.maxBlastPinnedYield,8);
  if([flashRemainingMs,mistakes,steps,newlyRevealed,prematureStarTouches,reportedMaxBlastYield,reportedMaxBlastPinnedYield]
    .some((value)=>value===null)||mistakes>usage.hammer||(usage.flash===0&&flashRemainingMs>0))return null;
  const blastAudit=readRunBlastEvents(rawValue.blastEvents,{width,height,baseMap,currentMap,openedWalls,usage,mistakes});
  if(!blastAudit||reportedMaxBlastYield!==blastAudit.maxBlastYield
    ||reportedMaxBlastPinnedYield!==blastAudit.maxBlastPinnedYield)return null;
  const {blastEvents,resolvedPins,maxBlastYield,maxBlastPinnedYield}=blastAudit;
  const inventory={...entryInventory};
  pickedItems.forEach((itemKey)=>{const item=itemByKey.get(itemKey);inventory[item.type]+=item.amount;});
  for(const keyName of INVENTORY_KEYS){inventory[keyName]-=usage[keyName];if(inventory[keyName]<0||inventory[keyName]>999)return null;}
  const memoryPinLimit=boundedInteger(level.memoryPins,0,8);
  const memoryPins=readRunCellKeys(rawValue.memoryPins,width,height,(x,y)=>{
    const cellKey=key(x,y);return isWallTile(baseMap[y][x])&&!openedSet.has(cellKey);
  },memoryPinLimit);
  const memoryPinsUsed=strictRunInteger(rawValue.memoryPinsUsed,memoryPinLimit);
  if(!memoryPins||memoryPinsUsed===null||memoryPinsUsed<memoryPins.length
    ||resolvedPins.size+memoryPins.length>memoryPinsUsed
    ||maxBlastPinnedYield>maxBlastYield||maxBlastPinnedYield>memoryPinsUsed||maxBlastPinnedYield>memoryPinLimit)return null;
  const permanentLight=readRunCellKeys(rawValue.permanentLight,width,height,()=>true,Math.min(width*height,usage.torch*37));
  if(!permanentLight)return null;
  if(!validRunTutorialPhase(levelIndex,rawValue.tutorialPhase))return null;
  if(typeof rawValue.spiritMode!=="boolean")return null;
  const spiritMode=rawValue.spiritMode;
  const spiritScoutedCurrent=Object.prototype.hasOwnProperty.call(rawValue,"spiritScoutedCurrent")
    ?rawValue.spiritScoutedCurrent:false;
  if(typeof spiritScoutedCurrent!=="boolean"||(spiritScoutedCurrent&&(!spiritMode||usage.spirit<1)))return null;
  let soul=null;
  if(spiritMode){
    soul=rawValue.soul;
    if(phase!=="explore"||usage.spirit<1||!isPlainRunRecord(soul)||!Number.isInteger(soul.x)||!Number.isInteger(soul.y)
      ||![-1,1].includes(soul.facing)||soul.x<=0||soul.y<=0||soul.x>=width-1||soul.y>=height-1
      ||currentMap[soul.y][soul.x]!==TILE.FLOOR)return null;
    soul={x:soul.x,y:soul.y,facing:soul.facing};
  }else if(rawValue.soul!==null)return null;
  const star=findChar(level.map,TILE.STAR);
  if(player.x===star[0]&&player.y===star[1]&&collectedShards.length===shardKeys.size)return null;
  let tutorialPhase=rawValue.tutorialPhase;
  const tutorialSpiritStep=strictRunInteger(rawValue.tutorialSpiritStep??0,FIRST_LEVEL_SPIRIT_ROUTE.length);
  if(tutorialSpiritStep===null)return null;
  const soulAtStar=Boolean(soul&&soul.x===star[0]&&soul.y===star[1]);
  if(tutorialPhase==="spiritReveal"&&!soulAtStar)return null;
  // Earlier versions prompted a return after seeing a nearby room.
  if(rawValue.tutorialSpiritStep===undefined&&tutorialPhase==="spiritReturn"&&spiritMode){
    tutorialPhase=soulAtStar?"spiritReveal":"spiritExplore";
  }
  // An untouched opening from the old rules can start again with automatic scouting.
  if(rawValue.schema===LEGACY_RUN_SNAPSHOT_SCHEMA&&!spiritMode&&!steps&&!pickedItems.length
    &&!collectedShards.length&&!memoryPinsUsed&&!prematureStarTouches
    &&player.x===level.start[0]&&player.y===level.start[1]
    &&INVENTORY_KEYS.every((name)=>usage[name]===0))return null;
  return {
    schema:rawValue.schema,saveVersion:SAVE_VERSION,challengeRevision:CHALLENGE_REVISION,
    generation:save.generation,campaignId:save.campaignId,
    levelIndex,levelFingerprint:rawValue.levelFingerprint,practice:rawValue.practice,entryInventory,phase,
    previewDuration:rawValue.previewDuration,previewRemainingMs,flashRemainingMs,openedWalls,pickedItems,collectedShards,
    player:{x:player.x,y:player.y,facing:player.facing},usage,mistakes,steps,newlyRevealed,prematureStarTouches,
    blastEvents,maxBlastYield,maxBlastPinnedYield,
    memoryPins,memoryPinsUsed,permanentLight,tutorialPhase,tutorialSpiritStep,
    spiritMode,spiritScoutedCurrent,soul,
    inventory,currentMap,breaks:openedWalls.length,picked:pickedItems.reduce((sum,itemKey)=>sum+itemByKey.get(itemKey).amount,0)+collectedShards.length,
    toolCost:usage.hammer+usage.bomb*3+usage.flash*3+usage.spirit*2+usage.torch+usage.teleport*5,
    routeCost:usage.hammer+usage.bomb*3+usage.teleport*5,
    infoUses:usage.flash+usage.spirit+usage.torch,
  };
}

function removeRunSnapshotStorage(){try{sessionStorage.removeItem(RUN_SNAPSHOT_KEY);}catch(_){}}

function clearRunSnapshot(){
  if(runSnapshotTimer){(window.clearTimeout||clearTimeout)(runSnapshotTimer);runSnapshotTimer=0;}
  queuedRunSnapshot=null;
  pendingRunSnapshot=null;
  removeRunSnapshotStorage();
}

function readRunSnapshot(){
  let serialized=null;
  try{serialized=sessionStorage.getItem(RUN_SNAPSHOT_KEY);}catch(_){return null;}
  if(serialized===null)return null;
  let parsed=null;
  try{parsed=JSON.parse(serialized);}catch(_){}
  const clean=sanitizeRunSnapshot(parsed);
  if(!clean)removeRunSnapshotStorage();
  return clean;
}

function flushRunSnapshot({queuedOnly=false}={}){
  if(runSnapshotTimer){(window.clearTimeout||clearTimeout)(runSnapshotTimer);runSnapshotTimer=0;}
  if(state&&state.mode!=="campaign")return false;
  if(state?.volatileContinuation)return false;
  if(state?.complete){
    if(state.completionPersistFailed&&stateMatchesCurrentSave())return false;
    clearRunSnapshot();return false;
  }
  if(state&&!stateMatchesCurrentSave()){clearRunSnapshot();return false;}
  const snapshot=(!queuedOnly&&state&&!state.locked?serializeRunSnapshot():null)||queuedRunSnapshot;
  queuedRunSnapshot=null;
  if(!snapshot)return false;
  try{sessionStorage.setItem(RUN_SNAPSHOT_KEY,JSON.stringify(snapshot));return true;}
  catch(_){return false;}
}

function scheduleRunSnapshot(){
  if(state?.mode==="daily"){scheduleDailyRunSnapshot();return;}
  if(state?.mode!=="campaign")return;
  if(!state||state.complete||state.locked||state.volatileContinuation||!stateMatchesCurrentSave())return;
  const snapshot=serializeRunSnapshot();
  if(!snapshot)return;
  queuedRunSnapshot=snapshot;
  if(runSnapshotTimer)(window.clearTimeout||clearTimeout)(runSnapshotTimer);
  runSnapshotTimer=window.setTimeout(()=>{runSnapshotTimer=0;flushRunSnapshot();},240);
}

function sanitizeDailyRunSnapshotIndex(value){
  if(!Array.isArray(value))return [];
  const dates=[];
  for(const date of value){
    if(!DAILY_API?.parseDailyDate(date)||dates.includes(date))continue;
    dates.push(date);
    if(dates.length===DAILY_RUN_SNAPSHOT_LIMIT)break;
  }
  return dates;
}

function readDailyRunSnapshotIndex(){
  let serialized=null;
  try{serialized=sessionStorage.getItem(DAILY_RUN_SNAPSHOT_INDEX_KEY);}catch(_){return [];}
  if(serialized===null)return [];
  try{
    const parsed=JSON.parse(serialized),clean=sanitizeDailyRunSnapshotIndex(parsed);
    if(!Array.isArray(parsed)||clean.length!==parsed.length)throw new Error("Invalid daily run index");
    return clean;
  }catch(_){
    try{sessionStorage.removeItem(DAILY_RUN_SNAPSHOT_INDEX_KEY);}catch(__){}
    return [];
  }
}

function writeDailyRunSnapshotIndex(value){
  const clean=sanitizeDailyRunSnapshotIndex(value);
  try{sessionStorage.setItem(DAILY_RUN_SNAPSHOT_INDEX_KEY,JSON.stringify(clean));return true;}catch(_){return false;}
}

function touchDailyRunSnapshotDate(dateValue){
  if(!DAILY_API?.parseDailyDate(dateValue))return false;
  const previous=readDailyRunSnapshotIndex();
  const next=[dateValue,...previous.filter((date)=>date!==dateValue)].slice(0,DAILY_RUN_SNAPSHOT_LIMIT);
  if(!writeDailyRunSnapshotIndex(next))return false;
  const retained=new Set(next);
  previous.filter((date)=>!retained.has(date)).forEach((date)=>{
    try{sessionStorage.removeItem(dailyRunSnapshotStorageKey(date));}catch(_){}
  });
  return true;
}

function removeDailyRunSnapshotStorage(dateValue=state?.daily?.date||requestedDailyDate,{legacy=true}={}){
  const storageKey=dailyRunSnapshotStorageKey(dateValue);
  if(storageKey)try{sessionStorage.removeItem(storageKey);}catch(_){}
  if(DAILY_API?.parseDailyDate(dateValue)){
    writeDailyRunSnapshotIndex(readDailyRunSnapshotIndex().filter((date)=>date!==dateValue));
  }
  if(!legacy)return;
  try{
    const serialized=sessionStorage.getItem(DAILY_RUN_SNAPSHOT_KEY);
    if(serialized!==null){
      let parsed=null;try{parsed=JSON.parse(serialized);}catch(_){}
      if(!parsed||parsed.date===dateValue)sessionStorage.removeItem(DAILY_RUN_SNAPSHOT_KEY);
    }
  }catch(_){}
}

function clearDailyRunSnapshot(dateValue=state?.daily?.date||requestedDailyDate){
  if(dailyRunSnapshotTimer){(window.clearTimeout||clearTimeout)(dailyRunSnapshotTimer);dailyRunSnapshotTimer=0;}
  queuedDailyRunSnapshot=null;
  if(!pendingDailyRunSnapshot||pendingDailyRunSnapshot.date===dateValue)pendingDailyRunSnapshot=null;
  removeDailyRunSnapshotStorage(dateValue);
}

const DAILY_RUN_SNAPSHOT_FIELDS=new Set([
  "schema","bankVersion","date","hash","phase","previewRemainingMs","flashRemainingMs","openedWalls",
  "player","inventory","usage","mistakes","steps","newlyRevealed","permanentLight","spiritMode","spiritScoutedCurrent","soul",
]);

function dailyMapInBounds(map,x,y){return y>=0&&y<map.length&&x>=0&&x<map[0].length;}

function dailyFloorDistances(map,start){
  const distances=new Map();
  if(!dailyMapInBounds(map,start[0],start[1])||map[start[1]][start[0]]!==TILE.FLOOR)return distances;
  const queue=[[start[0],start[1]]];
  distances.set(key(start[0],start[1]),0);
  for(let cursor=0;cursor<queue.length;cursor++){
    const [x,y]=queue[cursor],distance=distances.get(key(x,y));
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,cellKey=key(nx,ny);
      if(!dailyMapInBounds(map,nx,ny)||map[ny][nx]!==TILE.FLOOR||distances.has(cellKey))continue;
      distances.set(cellKey,distance+1);queue.push([nx,ny]);
    }
  }
  return distances;
}

function dailyVisibleCellsForMap(map,start){
  const visible=new Set(),floors=dailyFloorDistances(map,start);
  for(const cellKey of floors.keys()){
    const [x,y]=cellKey.split(",").map(Number);visible.add(cellKey);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;if(dailyMapInBounds(map,nx,ny))visible.add(key(nx,ny));
    }
  }
  return visible;
}

function auditDailyOpenedWalls(baseMap,start,openedWalls){
  const currentMap=baseMap.map((row)=>[...row]),remaining=new Set(openedWalls);
  while(remaining.size){
    const reachable=dailyFloorDistances(currentMap,start);let progressed=false;
    for(const cellKey of [...remaining]){
      const [x,y]=cellKey.split(",").map(Number);
      const canStrike=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>reachable.has(key(x+dx,y+dy)));
      if(!canStrike)continue;
      currentMap[y][x]=TILE.FLOOR;remaining.delete(cellKey);progressed=true;
    }
    if(!progressed)return null;
  }
  return currentMap;
}

function sameCellSet(left,right){
  if(left.size!==right.size)return false;
  for(const cellKey of left)if(!right.has(cellKey))return false;
  return true;
}

function validDailyTorchLight(currentMap,openedWalls,reachable,permanentLight){
  const expected=new Set(permanentLight),openedSet=new Set(openedWalls);
  if(!expected.size)return false;
  for(const originKey of reachable.keys()){
    const [originX,originY]=originKey.split(",").map(Number);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const sideX=-dy,sideY=dx,cells=new Set([originKey]);let ended=false;
      for(let distance=1;distance<=12;distance++){
        const cx=originX+dx*distance,cy=originY+dy*distance;
        if(!dailyMapInBounds(currentMap,cx,cy)){ended=true;break;}
        for(let offset=-1;offset<=1;offset++){
          const x=cx+sideX*offset,y=cy+sideY*offset;
          if(dailyMapInBounds(currentMap,x,y))cells.add(key(x,y));
        }
        const centerKey=key(cx,cy);
        if(openedSet.has(centerKey)&&sameCellSet(cells,expected))return true;
        if(isWallTile(currentMap[cy][cx])){
          ended=true;if(sameCellSet(cells,expected))return true;break;
        }
      }
      if(!ended&&sameCellSet(cells,expected))return true;
      if(ended&&sameCellSet(cells,expected))return true;
    }
  }
  return false;
}

function serializeDailyRunSnapshot(){
  if(!state||state.mode!=="daily"||state.complete||state.locked||introModal.classList.contains("visible"))return null;
  if(state.spiritMode&&state.soul&&!isFloor(state.soul.x,state.soul.y))return null;
  const level=state.level,width=level.map[0].length,height=level.map.length,baseMap=normalizeMap(level.map);
  if(state.map.length!==height||state.map.some((row)=>row.length!==width))return null;
  const openedWalls=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const base=baseMap[y][x],current=state.map[y][x];
    if(current===base)continue;
    if(base===TILE.WOOD&&current===TILE.FLOOR)openedWalls.push(key(x,y));
    else return null;
  }
  const now=pauseReasons.size?pauseStartForCurrentState():performance.now();
  const phase=state.phase==="preview"?"preview":"explore";
  const previewRemainingMs=phase==="preview"
    ? Math.max(0,Math.min(DAILY_PREVIEW_DURATION*1000,Math.ceil(state.previewEnds-now))) : 0;
  const soul=state.spiritMode&&state.soul
    ? {x:state.soul.x,y:state.soul.y,facing:state.soul.facing<0?-1:1}:null;
  return {
    schema:DAILY_RUN_SNAPSHOT_SCHEMA,bankVersion:state.daily.bankVersion,date:state.daily.date,hash:state.daily.hash,
    phase,previewRemainingMs,
    flashRemainingMs:Math.max(0,Math.min(25000,Math.ceil(state.flashEnds-now))),
    openedWalls,player:{x:state.player.x,y:state.player.y,facing:state.player.facing<0?-1:1},
    inventory:cloneInventory(state.inventory),usage:cloneInventory(state.usage),
    mistakes:boundedInteger(state.mistakes,0,1000000),steps:boundedInteger(state.steps,0,1000000),
    newlyRevealed:boundedInteger(state.newlyRevealed,0,1000000),permanentLight:[...state.permanentLight],
    spiritMode:state.spiritMode===true,spiritScoutedCurrent:state.spiritScoutedCurrent===true,soul,
  };
}

function sanitizeDailyRunSnapshot(rawValue, expectedDate=requestedDailyDate){
  if(!DAILY_API||!isPlainRunRecord(rawValue)||rawValue.schema!==DAILY_RUN_SNAPSHOT_SCHEMA
    ||rawValue.bankVersion!==DAILY_API.DAILY_BANK_VERSION||rawValue.date!==expectedDate
    ||!DAILY_API.parseDailyDate(rawValue.date)
    ||Object.keys(rawValue).some((field)=>!DAILY_RUN_SNAPSHOT_FIELDS.has(field)))return null;
  const level=DAILY_API.getDailyChallenge(rawValue.date);
  if(rawValue.hash!==level.daily.hash)return null;
  const width=level.map[0].length,height=level.map.length,baseMap=normalizeMap(level.map);
  const entryInventory=cloneInventory(level.inventory),inventory=strictRunInventory(rawValue.inventory),usage=strictRunInventory(rawValue.usage);
  if(!inventory||!usage)return null;
  const allowedTool=level.daily.contract.tool;
  if(usage.bomb!==0||usage.teleport!==0||INVENTORY_KEYS.some((name)=>!["hammer",allowedTool].includes(name)&&usage[name]!==0))return null;
  const openedWalls=readRunCellKeys(rawValue.openedWalls,width,height,(x,y)=>baseMap[y][x]===TILE.WOOD);
  if(!openedWalls)return null;
  const mistakes=strictRunInteger(rawValue.mistakes),steps=strictRunInteger(rawValue.steps),newlyRevealed=strictRunInteger(rawValue.newlyRevealed);
  if([mistakes,steps,newlyRevealed].some((value)=>value===null)||mistakes>usage.hammer
    ||openedWalls.length!==usage.hammer-mistakes)return null;
  for(const name of INVENTORY_KEYS){if(inventory[name]!==entryInventory[name]-usage[name]||inventory[name]<0)return null;}
  const currentMap=auditDailyOpenedWalls(baseMap,level.start,openedWalls);
  if(!currentMap)return null;
  const reachable=dailyFloorDistances(currentMap,level.start);
  const player=rawValue.player;
  if(!isPlainRunRecord(player)||!Number.isInteger(player.x)||!Number.isInteger(player.y)||![-1,1].includes(player.facing)
    ||player.x<0||player.y<0||player.x>=width||player.y>=height||!reachable.has(key(player.x,player.y))
    ||steps<reachable.get(key(player.x,player.y)))return null;
  const initialVisible=dailyVisibleCellsForMap(baseMap,level.start),currentVisible=dailyVisibleCellsForMap(currentMap,level.start);
  let expectedNewlyRevealed=0;
  currentVisible.forEach((cellKey)=>{if(!initialVisible.has(cellKey))expectedNewlyRevealed++;});
  if(newlyRevealed!==expectedNewlyRevealed)return null;
  const phase=rawValue.phase;
  if(!["preview","explore"].includes(phase))return null;
  let previewRemainingMs=rawValue.previewRemainingMs;
  if(phase==="preview"){
    previewRemainingMs=strictRunInteger(previewRemainingMs,DAILY_PREVIEW_DURATION*1000);
    if(previewRemainingMs===null)return null;
  }else if(previewRemainingMs!==0)return null;
  const flashRemainingMs=strictRunInteger(rawValue.flashRemainingMs,25000);
  if(flashRemainingMs===null||(usage.flash===0&&flashRemainingMs>0))return null;
  const permanentLight=readRunCellKeys(rawValue.permanentLight,width,height,()=>true,Math.min(width*height,usage.torch*37));
  if(!permanentLight||(usage.torch===0&&permanentLight.length)
    ||(usage.torch===1&&!validDailyTorchLight(currentMap,openedWalls,reachable,permanentLight))
    ||typeof rawValue.spiritMode!=="boolean")return null;
  const spiritMode=rawValue.spiritMode;
  const spiritScoutedCurrent=Object.prototype.hasOwnProperty.call(rawValue,"spiritScoutedCurrent")
    ?rawValue.spiritScoutedCurrent:false;
  if(typeof spiritScoutedCurrent!=="boolean"||(spiritScoutedCurrent&&(!spiritMode||usage.spirit<1)))return null;
  let soul=null;
  if(spiritMode){
    soul=rawValue.soul;
    if(phase!=="explore"||usage.spirit!==1||!isPlainRunRecord(soul)||!Number.isInteger(soul.x)||!Number.isInteger(soul.y)
      ||![-1,1].includes(soul.facing)||soul.x<=0||soul.y<=0||soul.x>=width-1||soul.y>=height-1
      ||currentMap[soul.y][soul.x]!==TILE.FLOOR)return null;
    soul={x:soul.x,y:soul.y,facing:soul.facing};
  }else if(rawValue.soul!==null)return null;
  if(phase==="preview"&&(openedWalls.length||steps||mistakes||INVENTORY_KEYS.some((name)=>usage[name]>0)
    ||player.x!==level.start[0]||player.y!==level.start[1]||newlyRevealed
    ||permanentLight.length||flashRemainingMs||spiritMode))return null;
  const star=findChar(level.map,TILE.STAR);
  if(player.x===star[0]&&player.y===star[1])return null;
  return {
    schema:DAILY_RUN_SNAPSHOT_SCHEMA,bankVersion:DAILY_API.DAILY_BANK_VERSION,date:rawValue.date,hash:rawValue.hash,
    phase,previewRemainingMs,flashRemainingMs,openedWalls,
    player:{x:player.x,y:player.y,facing:player.facing},inventory,usage,mistakes,steps,newlyRevealed,
    permanentLight,spiritMode,spiritScoutedCurrent,soul,
  };
}

function migrateLegacyDailyRunSnapshot(){
  let legacySerialized=null;
  try{legacySerialized=sessionStorage.getItem(DAILY_RUN_SNAPSHOT_KEY);}catch(_){return null;}
  if(legacySerialized===null)return null;
  let legacyRaw=null;try{legacyRaw=JSON.parse(legacySerialized);}catch(_){}
  const legacyDate=legacyRaw?.date;
  const legacyClean=DAILY_API?.parseDailyDate(legacyDate)?sanitizeDailyRunSnapshot(legacyRaw,legacyDate):null;
  if(!legacyClean){try{sessionStorage.removeItem(DAILY_RUN_SNAPSHOT_KEY);}catch(_){}return null;}
  const legacyKey=dailyRunSnapshotStorageKey(legacyDate);
  try{
    let existingRaw=null;
    try{existingRaw=JSON.parse(sessionStorage.getItem(legacyKey));}catch(_){}
    if(!sanitizeDailyRunSnapshot(existingRaw,legacyDate))sessionStorage.setItem(legacyKey,JSON.stringify(legacyClean));
    touchDailyRunSnapshotDate(legacyDate);
    sessionStorage.removeItem(DAILY_RUN_SNAPSHOT_KEY);
  }catch(_){}
  return legacyClean;
}

function readDailyRunSnapshot(date=requestedDailyDate){
  if(!DAILY_API?.parseDailyDate(date))return null;
  const legacyClean=migrateLegacyDailyRunSnapshot();
  const storageKey=dailyRunSnapshotStorageKey(date);
  let serialized=null;
  try{serialized=sessionStorage.getItem(storageKey);}catch(_){return legacyClean?.date===date?legacyClean:null;}
  if(serialized!==null){
    let raw=null;try{raw=JSON.parse(serialized);}catch(_){}
    const clean=sanitizeDailyRunSnapshot(raw,date);
    if(clean){touchDailyRunSnapshotDate(date);return clean;}
    removeDailyRunSnapshotStorage(date,{legacy:false});
  }
  return legacyClean?.date===date?legacyClean:null;
}

function flushDailyRunSnapshot({queuedOnly=false}={}){
  if(dailyRunSnapshotTimer){(window.clearTimeout||clearTimeout)(dailyRunSnapshotTimer);dailyRunSnapshotTimer=0;}
  if(state?.mode==="daily"&&state.volatileContinuation)return false;
  if(state?.mode==="daily"&&state.complete){
    if(state.completionPersistFailed)return false;
    clearDailyRunSnapshot();return false;
  }
  const snapshot=(!queuedOnly&&state?.mode==="daily"&&!state.locked?serializeDailyRunSnapshot():null)||queuedDailyRunSnapshot;
  queuedDailyRunSnapshot=null;
  if(!snapshot)return false;
  const clean=sanitizeDailyRunSnapshot(snapshot,snapshot.date);
  if(!clean)return false;
  const storageKey=dailyRunSnapshotStorageKey(clean.date);
  if(!storageKey)return false;
  try{
    sessionStorage.setItem(storageKey,JSON.stringify(clean));
    touchDailyRunSnapshotDate(clean.date);
    return true;
  }catch(_){return false;}
}

function scheduleDailyRunSnapshot(){
  if(!state||state.mode!=="daily"||state.complete||state.locked||state.volatileContinuation)return;
  const snapshot=serializeDailyRunSnapshot();
  if(!snapshot)return;
  queuedDailyRunSnapshot=snapshot;
  if(dailyRunSnapshotTimer)(window.clearTimeout||clearTimeout)(dailyRunSnapshotTimer);
  dailyRunSnapshotTimer=window.setTimeout(()=>{dailyRunSnapshotTimer=0;flushDailyRunSnapshot();},240);
}

function flushActiveRunSnapshot(){
  if(state?.mode==="daily")return flushDailyRunSnapshot();
  if(state?.mode==="campaign")return flushRunSnapshot();
  return false;
}

function createRunState(level,index,inventory = emptyInventory(),{mode="campaign",daily=null,seeded=null}={}) {
  const duration = mode==="campaign" ? 0
    : mode==="seeded" ? SEEDED_PREVIEW_DURATION : DAILY_PREVIEW_DURATION;
  const startsInDark=mode==="campaign";
  const activeInventory = cloneInventory(inventory);
  const entryInventory = cloneInventory(inventory);
  const runState={
    mode,
    daily,
    seeded,
    levelIndex: index,
    level,
    map: normalizeMap(level.map),
    items: levelRunItems(level),
    shards: allChars(level.map, TILE.SHARD).map(([x,y]) => ({ x,y,collected:false })),
    shardsCollected: 0,
    prematureStarTouches: 0,
    blastEvents: [],
    maxBlastYield: 0,
    maxBlastPinnedYield: 0,
    memoryPins: new Set(),
    memoryPinsUsed: 0,
    memoryPinLimit: boundedInteger(level.memoryPins,0,8),
    star: findChar(level.map, TILE.STAR),
    player: { x: level.start[0], y: level.start[1], drawX: level.start[0], drawY: level.start[1], facing: 1 },
    inventory: activeInventory,
    entryInventory,
    usage: emptyInventory(),
    selected: null,
    target: null,
    autoRoute: null,
    moveDestination: null,
    cameraPan: { x:0, y:0 },
    cameraZoom: DEFAULT_MAP_ZOOM,
    spiritCameraAnchor: null,
    previewLens: null,
    phase: startsInDark ? "explore" : "preview",
    previewEnds: startsInDark ? 0 : performance.now() + duration * 1000,
    previewDuration: duration,
    visible: new Set(),
    permanentLight: new Set(),
    flashEnds: 0,
    flashOverview: true,
    spiritMode: false,
    spiritScoutedCurrent: false,
    soul: null,
    spiritVisible: new Set(),
    spiritLightTransition: null,
    spiritOriginVisible: new Set(),
    fade: startsInDark ? 1 : 0,
    fadeStarted: 0,
    breaks: 0,
    toolCost: 0,
    routeCost: 0,
    infoUses: 0,
    mistakes: 0,
    threeStarWarningShown: false,
    steps: 0,
    newlyRevealed: 0,
    picked: 0,
    particles: [],
    pulses: [],
    locked: false,
    startedAt: performance.now(),
    lastProgress: performance.now(),
    complete: false,
    completionPersistFailed: false,
    completionCheckpointAvailable: false,
    volatileContinuation: false,
    resultStars: null,
  };
  if(mode==="campaign")Object.assign(runState,{
    saveGeneration:save.generation,
    saveCampaignId:save.campaignId,
    saveConflict:false,
    tutorialPhase:index===0?"spiritUse":index===1?"torchSelect":null,
    tutorialSpiritStep:0,
    practice:false,
  });
  else if(mode==="daily")Object.assign(runState,{dailyRoutePerfect:false,dailyPerfect:false});
  return runState;
}

function createLevel(index, inventory = emptyInventory()) {
  return createRunState(LEVELS[index],index,inventory);
}

function createDailyState(dateValue) {
  if(!DAILY_API)throw new Error("Daily maze data is unavailable");
  const level=DAILY_API.getDailyChallenge(dateValue);
  return createRunState(level,0,level.inventory,{mode:"daily",daily:{...level.daily,contract:{...level.daily.contract}}});
}

function createSeededState(codeValue,presetValue) {
  if(!SEEDED_API)throw new Error("Seeded maze data is unavailable");
  const level=SEEDED_API.createSeededLevel(codeValue,presetValue);
  const seeded={
    ...level.seeded,
    optimal:{...level.seeded.optimal},
    target:{...level.seeded.target},
    canonical:`v${level.seeded.algorithmVersion}-${level.seeded.preset}-${level.seeded.code}`,
  };
  return createRunState(level,0,level.inventory,{mode:"seeded",seeded});
}

function continuationLoadPolicy(mode,{preserveRunSnapshot=false,volatileContinuation=null}={}){
  const sameCampaign=mode!=="campaign"||stateMatchesCurrentSave();
  const inherited=volatileContinuation===null
    ? Boolean(state?.mode===mode&&state.volatileContinuation&&sameCampaign)
    : Boolean(volatileContinuation);
  return {volatileContinuation:inherited,preserveRunSnapshot:Boolean(preserveRunSnapshot||inherited)};
}

function loadLevel(index, inventoryOverride = null, {
  preserveRunSnapshot = false, volatileContinuation = null, restoringRun = false, guideFirstLevel = false,
} = {}) {
  let policy=continuationLoadPolicy("campaign",{preserveRunSnapshot,volatileContinuation});
  document.body?.classList?.remove("daily-mode","seeded-mode");
  if(!policy.preserveRunSnapshot)clearRunSnapshot();
  if(adoptNewerStoredSave()){
    inventoryOverride=null;
    policy={preserveRunSnapshot:false,volatileContinuation:false};
  }
  const requestedIndex=boundedInteger(index,0,LEVELS.length-1);
  if(requestedIndex>save.unlocked){
    index=boundedInteger(save.lastLevel,0,save.unlocked);
    inventoryOverride=null;
    showToast("该关尚未解锁 · 已回到当前进度",true);
  }else index=requestedIndex;
  ensureEntrySnapshotIdentity();
  cancelActiveGameWork();
  clearCanvasPointerGesture();
  closeModal(completeModal, { restoreFocus: false });
  const inventory = cloneInventory(inventoryOverride === null ? getEntryInventory(index) : inventoryOverride);
  if(!restoringRun&&inventory.spirit===0)inventory.spirit=1;
  if(index>0&&!policy.volatileContinuation)pinEntryInventory(index,inventory);
  state = createLevel(index, inventory);
  state.volatileContinuation=policy.volatileContinuation;
  updateCameraResetButton();
  state.practice = save.completed.includes(index);
  if(state.practice&&!(index===0&&guideFirstLevel))state.tutorialPhase=null;
  updateLevelUI();
  resizeCanvas();
  state.visible=computeVisible();
  previewPanel.classList.add("hidden");
  tutorialBubble.classList.add("hidden");
  [hammerSlot,flashSlot,spiritSlot,torchSlot,teleportSlot].forEach((slot)=>slot.classList.remove("tutorial-focus"));
  spiritReturnButton.classList.remove("tutorial-focus");
  updateMemoryPinStatus();
  updateInventory();
  renderTrack();
  document.getElementById("levelLabel").textContent = `${String(index + 1).padStart(2, "0")} / ${LEVELS.length}`;
  save.lastLevel = index;
  persist({ fields:["lastLevel"] });
  if(!restoringRun)startSpiritMode({atEntry:true});
  updateCanvasDescription();
  canvas.focus();
}

function loadDailyChallenge(dateValue,{preserveRunSnapshot=false,volatileContinuation=null}={}){
  if(!DAILY_API?.parseDailyDate(dateValue))return false;
  const policy=continuationLoadPolicy("daily",{preserveRunSnapshot,volatileContinuation});
  document.body?.classList?.remove("seeded-mode");
  document.body?.classList?.add("daily-mode");
  if(!policy.preserveRunSnapshot)clearDailyRunSnapshot();
  cancelActiveGameWork();
  clearCanvasPointerGesture();
  closeModal(completeModal,{restoreFocus:false});
  state=createDailyState(dateValue);
  state.volatileContinuation=policy.volatileContinuation;
  let recoveredVolatileContinuation=false;
  if(state.volatileContinuation){
    dailySave=mergeDailySaves(dailySave,readDailySave());
    dailySave=writeDailySave(dailySave);
    if(lastDailyWriteSucceeded){
      state.volatileContinuation=false;
      clearDailyRunSnapshot(dateValue);
      recoveredVolatileContinuation=true;
    }
  }
  updateCameraResetButton();
  updateLevelUI();
  resizeCanvas();
  showPreview();
  updateInventory();
  renderTrack();
  tutorialBubble.classList.add("hidden");
  [hammerSlot,flashSlot,spiritSlot,torchSlot,teleportSlot].forEach((slot)=>slot.classList.remove("tutorial-focus"));
  spiritReturnButton.classList.remove("tutorial-focus");
  document.getElementById("levelLabel").textContent="每日挑战";
  if(recoveredVolatileContinuation)scheduleDailyRunSnapshot();
  updateCanvasDescription();
  canvas.focus();
  return true;
}

function loadSeededChallenge(codeValue,presetValue,{updateUrl=true}={}){
  let nextState;
  try{nextState=createSeededState(codeValue,presetValue);}catch(_){return false;}
  if(updateUrl)replaceBrowserUrl(seededUrlForChallenge(nextState.seeded,navigationBaseUrl()));
  document.body?.classList?.remove("daily-mode");
  document.body?.classList?.add("seeded-mode");
  cancelActiveGameWork();
  clearCanvasPointerGesture();
  closeModal(completeModal,{restoreFocus:false});
  state=nextState;
  updateCameraResetButton();
  updateLevelUI();
  resizeCanvas();
  showPreview();
  updateInventory();
  renderTrack();
  tutorialBubble.classList.add("hidden");
  [hammerSlot,flashSlot,spiritSlot,torchSlot,teleportSlot].forEach((slot)=>slot.classList.remove("tutorial-focus"));
  spiritReturnButton.classList.remove("tutorial-focus");
  updateCanvasDescription();
  canvas.focus();
  return true;
}

function getEntryInventory(index) {
  if (index === 0) return firstLevelInventory();
  ensureEntrySnapshotIdentity();
  const storageKey=`maze-entry-v7-${index}`;
  let serialized=null;
  try{serialized=sessionStorage.getItem(storageKey);}catch(_){}
  if(serialized!==null){
    let parsed=null;
    try{parsed=JSON.parse(serialized);}catch(_){}
    if(isCompleteInventoryRecord(parsed))return cloneInventory(parsed);
    try{sessionStorage.removeItem(storageKey);}catch(_){}
  }
  const running=runEntries[index];
  if(isCompleteInventoryRecord(running))return cloneInventory(running);
  const saved=save.entries?.[index];
  if(isCompleteInventoryRecord(saved))return cloneInventory(saved);
  return cloneInventory(fallbackEntryInventory(index));
}

function ensureEntrySnapshotIdentity(){
  let identity=null;
  try{
    const serialized=sessionStorage.getItem(ENTRY_SNAPSHOT_IDENTITY_KEY);
    if(serialized!==null)identity=JSON.parse(serialized);
  }catch(_){}
  if(identity&&identity.generation===save.generation&&identity.campaignId===save.campaignId)return true;
  for(let index=1;index<LEVELS.length;index++){
    try{sessionStorage.removeItem(`maze-entry-v7-${index}`);}catch(_){}
    try{sessionStorage.removeItem(`maze-entry-v6-${index}`);}catch(_){}
  }
  try{sessionStorage.setItem(ENTRY_SNAPSHOT_IDENTITY_KEY,JSON.stringify({generation:save.generation,campaignId:save.campaignId}));}catch(_){}
  return false;
}

function pinEntryInventory(index,inventory){
  if(index<=0||index>=LEVELS.length)return false;
  ensureEntrySnapshotIdentity();
  try{sessionStorage.setItem(`maze-entry-v7-${index}`,JSON.stringify(cloneInventory(inventory)));return true;}
  catch(_){return false;}
}

function setNextEntry(index, inventory) {
  adoptNewerStoredSave();
  const entryIndex=boundedInteger(index,1,LEVELS.length-1);
  if(entryIndex!==Number(index)||entryIndex>save.unlocked||!stateMatchesCurrentSave())return false;
  runEntries[index] = cloneInventory(inventory);
  save.entries ||= {};
  save.entries[index] = cloneInventory(inventory);
  persist({ entryIndices:[index] });
  pinEntryInventory(index,inventory);
  return true;
}

function restoreRunSnapshot(snapshot) {
  const clean=sanitizeRunSnapshot(snapshot);
  if(!clean){clearRunSnapshot();return false;}
  loadLevel(clean.levelIndex,clean.entryInventory,{preserveRunSnapshot:true,volatileContinuation:false,restoringRun:true});
  if(clean.generation!==save.generation||clean.campaignId!==save.campaignId
    ||!stateMatchesCurrentSave()||state.levelIndex!==clean.levelIndex){clearRunSnapshot();return false;}
  const now=performance.now();
  state.map=clean.currentMap.map((row)=>[...row]);
  const pickedItems=new Set(clean.pickedItems);
  state.items.forEach((item)=>{item.picked=pickedItems.has(runItemKey(item));});
  const collectedShards=new Set(clean.collectedShards);
  state.shards.forEach((shard)=>{shard.collected=collectedShards.has(key(shard.x,shard.y));});
  state.shardsCollected=clean.collectedShards.length;
  state.player={x:clean.player.x,y:clean.player.y,drawX:clean.player.x,drawY:clean.player.y,facing:clean.player.facing};
  state.inventory={...clean.inventory};
  state.entryInventory={...clean.entryInventory};
  state.usage={...clean.usage};
  state.memoryPins=new Set(clean.memoryPins);
  state.memoryPinsUsed=clean.memoryPinsUsed;
  state.permanentLight=new Set(clean.permanentLight);
  state.phase=clean.phase;
  state.previewDuration=clean.previewDuration;
  state.previewEnds=clean.phase==="preview"
    ? clean.previewDuration===0?Infinity:now+clean.previewRemainingMs : 0;
  state.flashEnds=clean.flashRemainingMs>0?now+clean.flashRemainingMs:0;
  state.spiritMode=clean.spiritMode;
  state.spiritScoutedCurrent=clean.spiritScoutedCurrent;
  state.soul=clean.soul?{...clean.soul,drawX:clean.soul.x,drawY:clean.soul.y}:null;
  state.spiritCameraAnchor=clean.soul?{x:clean.soul.x,y:clean.soul.y}:null;
  state.visible=computeVisible();
  state.spiritOriginVisible=new Set(state.visible);
  state.spiritVisible=new Set();
  if(state.spiritMode&&state.soul){
    state.spiritVisible=isFloor(state.soul.x,state.soul.y)
      ? computeVisibleFrom(state.soul.x,state.soul.y) : new Set([key(state.soul.x,state.soul.y)]);
  }
  state.fade=1;
  state.fadeStarted=0;
  state.breaks=clean.breaks;
  state.toolCost=clean.toolCost;
  state.routeCost=clean.routeCost;
  state.infoUses=clean.infoUses;
  state.mistakes=clean.mistakes;
  state.steps=clean.steps;
  state.newlyRevealed=clean.newlyRevealed;
  state.picked=clean.picked;
  state.prematureStarTouches=clean.prematureStarTouches;
  state.blastEvents=clean.blastEvents.map((event)=>({
    center:{...event.center},walls:[...event.walls],pinned:[...event.pinned],
  }));
  state.maxBlastYield=clean.maxBlastYield;
  state.maxBlastPinnedYield=clean.maxBlastPinnedYield;
  state.practice=clean.practice;
  state.tutorialPhase=clean.tutorialPhase;
  state.tutorialSpiritStep=clean.tutorialSpiritStep;
  state.complete=false;
  state.locked=false;
  state.selected=null;
  state.target=null;
  state.autoRoute=null;
  state.moveDestination=null;
  state.threeStarWarningShown=currentRunScore(state).stars<3;
  state.cameraPan={x:0,y:0};
  state.previewLens=null;
  state.particles=[];
  state.pulses=[];
  state.startedAt=now;
  state.lastProgress=now;
  if(state.phase==="preview")showPreview();
  else{
    previewPanel.classList.add("hidden");
    updateMemoryPinStatus();
    showTutorialForState();
  }
  updateCameraResetButton();
  updateInventory();
  updateCanvasDescription();
  if(state.tutorialPhase==="spiritReveal")openOnboardingReveal();
  else canvas.focus();
  return true;
}

function restoreDailyRunSnapshot(snapshot){
  const clean=sanitizeDailyRunSnapshot(snapshot,requestedDailyDate);
  if(!clean){clearDailyRunSnapshot();return false;}
  loadDailyChallenge(clean.date,{preserveRunSnapshot:true,volatileContinuation:false});
  if(state.mode!=="daily"||state.daily.date!==clean.date||state.daily.hash!==clean.hash){clearDailyRunSnapshot();return false;}
  const now=performance.now(),baseMap=normalizeMap(state.level.map);
  clean.openedWalls.forEach((cellKey)=>{const [x,y]=cellKey.split(",").map(Number);baseMap[y][x]=TILE.FLOOR;});
  state.map=baseMap;
  state.player={x:clean.player.x,y:clean.player.y,drawX:clean.player.x,drawY:clean.player.y,facing:clean.player.facing};
  state.inventory={...clean.inventory};
  state.entryInventory=cloneInventory(state.level.inventory);
  state.usage={...clean.usage};
  state.permanentLight=new Set(clean.permanentLight);
  state.phase=clean.phase;
  state.previewDuration=DAILY_PREVIEW_DURATION;
  state.previewEnds=clean.phase==="preview"?now+clean.previewRemainingMs:0;
  state.flashEnds=clean.flashRemainingMs>0?now+clean.flashRemainingMs:0;
  state.spiritMode=clean.spiritMode;
  state.spiritScoutedCurrent=clean.spiritScoutedCurrent;
  state.soul=clean.soul?{...clean.soul,drawX:clean.soul.x,drawY:clean.soul.y}:null;
  state.spiritCameraAnchor=clean.soul?{x:clean.soul.x,y:clean.soul.y}:null;
  state.visible=computeVisible();
  state.spiritOriginVisible=new Set(state.visible);
  state.spiritVisible=new Set();
  if(state.spiritMode&&state.soul)state.spiritVisible=computeVisibleFrom(state.soul.x,state.soul.y);
  state.fade=1;state.fadeStarted=0;state.breaks=clean.openedWalls.length;
  state.toolCost=clean.usage.hammer+clean.usage.flash*3+clean.usage.spirit*2+clean.usage.torch;
  state.routeCost=clean.usage.hammer;state.infoUses=clean.usage.flash+clean.usage.spirit+clean.usage.torch;state.mistakes=clean.mistakes;
  state.steps=clean.steps;state.newlyRevealed=clean.newlyRevealed;state.picked=0;
  state.complete=false;state.locked=false;state.selected=null;state.target=null;
  state.autoRoute=null;state.moveDestination=null;state.threeStarWarningShown=currentRunScore(state).stars<3;
  state.cameraPan={x:0,y:0};state.previewLens=null;state.particles=[];state.pulses=[];
  state.startedAt=now;state.lastProgress=now;
  if(state.phase==="preview")showPreview();
  else{previewPanel.classList.add("hidden");updateMemoryPinStatus();showTutorialForState();}
  updateCameraResetButton();updateInventory();updateCanvasDescription();canvas.focus();
  return true;
}

function currentRunScore(run=state) {
  if(!run)return {stars:3,target:0,twoStarLimit:0};
  const target=run.mode==="daily"
    ? Number(run.daily?.optimalCost ?? run.level?.recommended ?? 0)
    : Number.isFinite(Number(run.level?.recommended))
      ? Number(run.level.recommended)
      : Number(run.level?.optimalBreaks || 0)+(run.levelIndex===0?1:0);
  const twoStarLimit=target+(run.mode==="daily"?1:2);
  const stars=run.routeCost<=target?3:run.routeCost<=twoStarLimit?2:1;
  return {stars,target,twoStarLimit};
}

function updateLiveScore() {
  if(!state)return currentRunScore(state);
  const score=currentRunScore(state);
  const el=document.getElementById("mobileScore");
  if(el){
    const text=`计星 ${"★".repeat(score.stars)}${"☆".repeat(3-score.stars)} · 成本 ${state.routeCost} / ${score.target} · 误敲 ${state.mistakes}`;
    const label=`当前预计 ${score.stars} 星，路径成本 ${state.routeCost}，三星目标 ${score.target}，误敲 ${state.mistakes}`;
    if(el.textContent!==text)el.textContent=text;
    el.classList.toggle("score-warning",score.stars<3);
    if(el.getAttribute?.("aria-label")!==label)el.setAttribute?.("aria-label",label);
  }
  return score;
}

function noteRunScoreChange() {
  const score=updateLiveScore();
  const firstLoss=score.stars<3&&!state.threeStarWarningShown;
  if(score.stars<3)state.threeStarWarningShown=true;
  return firstLoss;
}

function seededPresetName(presetValue){
  return SEEDED_API?.SEEDED_PRESETS?.[presetValue]?.name||presetValue||"种子星图";
}

function dailyToolName(tool){
  return {flash:"闪光弹",torch:"手电筒",spirit:"灵魂出窍卡"}[tool]||"契约道具";
}

function runDisplayTitle(run=state){
  if(!run)return "游戏地图";
  if(run.mode==="daily")return `${dailyIsToday(run.daily.date)?"今日迷局":"星历回顾"} ${run.daily.date}《${run.level.name}》`;
  if(run.mode==="seeded")return `无尽迷局 ${seededPresetName(run.seeded.preset)} 挑战码 ${run.seeded.code}《${run.level.name}》`;
  return `第 ${run.levelIndex+1} 关《${run.level.name}》`;
}

function updateLevelUI() {
  document.getElementById("levelTitle").textContent = state.level.name;
  document.getElementById("levelObjective").textContent = state.level.objective;
  if(state.mode==="daily"){
    const today=dailyIsToday(state.daily.date);
    document.getElementById("levelLabel").textContent=today?"每日挑战":"星历回顾";
    document.getElementById("objectiveEyebrow").textContent=today
      ? `今日契约 · ${state.daily.contract.name}`
      : `${formatDailyDate(state.daily.date)} · 本日契约 · ${state.daily.contract.name}`;
    document.getElementById("chapterLabel").textContent=today
      ? `今日迷局 · ${formatDailyDate(state.daily.date)}`
      : `星历回顾 · ${formatDailyDate(state.daily.date)}`;
    const challenge=document.getElementById("levelChallenge");
    challenge.textContent=`单一道具 · ${dailyToolName(state.daily.contract.tool)} · 「${state.daily.contract.name}」`;
    challenge.classList.remove("hidden");
    updateLiveScore();
    return;
  }
  if(state.mode==="seeded"){
    const difficulty=seededPresetName(state.seeded.preset);
    document.getElementById("levelLabel").textContent=`${state.seeded.preset} · ${difficulty}`;
    document.getElementById("objectiveEyebrow").textContent=`挑战码 · ${state.seeded.canonical}`;
    document.getElementById("chapterLabel").textContent="无尽迷局 · 种子星图";
    const challenge=document.getElementById("levelChallenge");
    challenge.textContent=(state.usage.flash||0)>0
      ? `独立计星 · 三星成本 ${state.seeded.optimal.cost} · 无闪记忆星标本局已失（基础三星不受影响）`
      : `独立计星 · 三星成本 ${state.seeded.optimal.cost} · 无闪可获记忆星标`;
    challenge.classList.remove("hidden");
    updateLiveScore();
    return;
  }
  document.getElementById("objectiveEyebrow").textContent = `本关课题 · ${String(state.levelIndex + 1).padStart(2,"0")} / ${LEVELS.length}`;
  document.getElementById("chapterLabel").textContent = state.level.chapter === "ember" ? "余烬星路 · 后篇" : "失光迷宫 · 前篇";
  const challenge = document.getElementById("levelChallenge");
  challenge.textContent = state.level.challenge ? `三星印记 · ${state.level.challenge.name}` : "";
  challenge.classList.toggle("hidden", !state.level.challenge);
  updateLiveScore();
}

function refreshPreviewCountdown(now=performance.now()) {
  const unlimited=state.previewDuration===0||!Number.isFinite(state.previewEnds);
  const seconds=unlimited?null:Math.max(1,Math.ceil((state.previewEnds-now)/1000));
  const text=unlimited?"∞":String(seconds);
  if(previewCountdown.textContent!==text)previewCountdown.textContent=text;
  const label=unlimited?"亮屏预览不限时":`亮屏剩余 ${seconds} 秒`;
  if(previewCountdown.getAttribute?.("aria-label")!==label)previewCountdown.setAttribute?.("aria-label",label);
}

function showPreview() {
  deferVisibleUpdateBanner();
  previewPanel.classList.remove("hidden");
  const previewGesture=document.getElementById("previewGesture");
  const emphasizeGesture=isCompactViewport()&&(state.mode==="daily"||state.mode==="seeded"
    ||state.map[0].length>=25||state.map.length>=19);
  previewPanel.classList.toggle("gesture-emphasis",emphasizeGesture);
  if(previewGesture)previewGesture.textContent=emphasizeGesture?"放大看材质 · 按住地图拖动":"按住拖动放大";
  const emberLegend=document.getElementById("emberPreviewLegend");
  const hasCracked=state.level.map.some((row)=>row.includes(TILE.CRACKED));
  const shardCount=allChars(state.level.map,TILE.SHARD).length;
  const legendParts=[];
  if(hasCracked)legendParts.push("琥珀色裂纹石墙：锤击耗锤且不碎 · 炸弹可破");
  if(shardCount)legendParts.push(`${shardCount} 枚星屑封锁北极星 · 先集齐再触星`);
  if(emberLegend){
    emberLegend.textContent=legendParts.join(" · ");
    emberLegend.classList.toggle("hidden",legendParts.length===0);
  }
  refreshPreviewCountdown();
  document.getElementById("skipPreview").textContent = state.previewDuration === 0 ? "开始探索" : isCompactViewport() ? "提前探索" : "空格跳过";
  updateMemoryPinStatus();
}

function updateMemoryPinStatus() {
  if (!memoryPinStatus || !state) return;
  const enabled = state.mode==="campaign"&&state.memoryPinLimit > 0 && state.phase === "explore"&&!state.complete;
  memoryPinStatus.classList.toggle("hidden", !enabled);
  if (enabled) memoryPinStatus.textContent = `记忆钉 ${state.memoryPins.size} / ${state.memoryPinLimit} · 侦察时点已看清材质的墙，可在黑暗中保留标记`;
}

function toggleMemoryPin(x,y) {
  if (!state || state.phase !== "explore" || state.memoryPinLimit <= 0 || !inBounds(x,y)) return false;
  const tile = state.map[y][x];
  if (!isWallTile(tile)) {
    showToast("记忆钉只能钉在墙上",true);
    playTone("blocked");
    return false;
  }
  const wallKey=key(x,y);
  if(!state.memoryPins.has(wallKey)&&!isWallMaterialRevealed(x,y)){
    showToast("先用灵魂、闪光或手电看清墙体材质，再放记忆钉",true);
    playTone("blocked");
    return false;
  }
  if (state.memoryPins.has(wallKey)) {
    state.memoryPins.delete(wallKey);
    showToast(`已取下记忆钉 · 还可放 ${state.memoryPinLimit-state.memoryPins.size} 枚`);
  } else {
    if (state.memoryPins.size >= state.memoryPinLimit) {
      showToast(`本关只有 ${state.memoryPinLimit} 枚记忆钉 · 可先取下一枚`,true);
      playTone("blocked");
      return false;
    }
    state.memoryPins.add(wallKey);
    state.memoryPinsUsed=Math.max(state.memoryPinsUsed,state.memoryPins.size);
    showToast(`已钉住这面${tile===TILE.WOOD?"木墙":tile===TILE.CRACKED?"裂纹石墙":"石墙"} · 离开侦察视野后仍可辨认 · ${state.memoryPins.size}/${state.memoryPinLimit}`);
    playTone("pickup");
  }
  state.lastProgress=performance.now();
  updateMemoryPinStatus();
  updateCanvasDescription();
  refreshSemanticMapCell(x,y);
  scheduleRunSnapshot();
  return true;
}

function endPreview() {
  if (!state || state.phase !== "preview") return;
  const activeState = state;
  const restoreCanvasFocus=previewPanel.contains?.(document.activeElement);
  const missedFirstPinLesson=activeState.mode==="campaign"&&activeState.levelIndex===15&&!activeState.practice
    &&activeState.memoryPins.size<activeState.memoryPinLimit;
  const firstFinaleRun=activeState.mode==="campaign"&&activeState.levelIndex===19&&!activeState.practice;
  clearCanvasPointerGesture();
  state.phase = "fading";
  state.fadeStarted = performance.now();
  state.visible = computeVisible();
  previewPanel.classList.add("hidden");
  if(restoreCanvasFocus)canvas.focus();
  updateMemoryPinStatus();
  updateCanvasDescription();
  document.getElementById("gameStatus").textContent="亮屏结束，黑暗探索开始";
  playTone("fade");
  scheduleGameTimeout(() => {
    if (state === activeState && activeState.phase === "fading") {
      activeState.phase = "explore";
      activeState.fade = 1;
      showTutorialForState();
      if(missedFirstPinLesson){
        showToast(`已放 ${activeState.memoryPins.size} / ${activeState.memoryPinLimit} 枚记忆钉 · 变暗后不能补放，本关仍可继续（印记需要 ${activeState.memoryPinLimit} 枚）`,true);
      }else if(firstFinaleRun){
        showToast("终局路线较长 · 稳定进度会自动保存，可稍后继续");
      }
    }
  }, 850);
  scheduleRunSnapshot();
}

function key(x, y) { return `${x},${y}`; }
function inBounds(x, y) { return y >= 0 && y < state.map.length && x >= 0 && x < state.map[0].length; }
function isFloor(x, y) { return inBounds(x, y) && state.map[y][x] === TILE.FLOOR; }

function computeVisibleFrom(startX, startY) {
  const floors = new Set();
  const visible = new Set();
  const queue = [[startX, startY]];
  floors.add(key(startX, startY));
  for (let cursor=0;cursor<queue.length;cursor++) {
    const [x, y] = queue[cursor];
    visible.add(key(x, y));
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      if (isFloor(nx, ny)) {
        if (!floors.has(key(nx, ny))) {
          floors.add(key(nx, ny));
          queue.push([nx, ny]);
        }
      } else {
        visible.add(key(nx, ny));
      }
    }
  }
  return visible;
}

function computeVisible() {
  return computeVisibleFrom(state.player.x, state.player.y);
}

function canSoulEnter(x, y) {
  return inBounds(x, y) && x > 0 && y > 0 && x < state.map[0].length - 1 && y < state.map.length - 1;
}

function spiritLightAt(cellKey, now) {
  const target = state.spiritVisible.has(cellKey) ? 1 : 0;
  const transition = state.spiritLightTransition;
  const origin = transition?.from.get(cellKey);
  if (origin === undefined) return target;
  const elapsed = Math.max(0, Math.min(1, (now - transition.startedAt) / SPIRIT_LIGHT_FADE_MS));
  const eased = elapsed * elapsed * (3 - 2 * elapsed);
  return origin + (target - origin) * eased;
}

function setSpiritVisibility(next) {
  const previous = state.spiritVisible;
  if (previous.size === next.size && [...previous].every(cellKey => next.has(cellKey))) return;
  const now = performance.now();
  const inTransition = state.spiritLightTransition?.from.keys() || [];
  const changed = new Set([...previous, ...next, ...inTransition]);
  const from = new Map();
  for (const cellKey of changed) {
    const opacity = spiritLightAt(cellKey, now);
    if (opacity !== (next.has(cellKey) ? 1 : 0)) from.set(cellKey, opacity);
  }
  state.spiritVisible = next;
  state.spiritLightTransition = from.size ? {from, startedAt:now} : null;
}

function updateSpiritVisible() {
  if (!state.spiritMode || !state.soul) return;
  const { x, y } = state.soul;
  if (isFloor(x, y)) {
    setSpiritVisibility(computeVisibleFrom(x, y));
    if(!state.spiritScoutedCurrent){
      const reachedNewRegion=[...state.spiritVisible].some((cellKey)=>{
        if(state.spiritOriginVisible.has(cellKey))return false;
        const [cellX,cellY]=cellKey.split(",").map(Number);
        return state.map[cellY]?.[cellX]===TILE.FLOOR;
      });
      if(reachedNewRegion){
        const guidedSpiritTutorial=state.mode==="campaign"&&state.tutorialPhase==="spiritExplore";
        state.spiritScoutedCurrent=true;
        updateInventory();
        if(guidedSpiritTutorial)dismissTransientToast();
        else showToast("有效侦察 · 已进入身体原视野外的新区域");
      }
    }
  } else if (!state.spiritVisible.has(key(x, y))) {
    setSpiritVisibility(new Set([...state.spiritVisible, key(x, y)]));
  }
  if(state.tutorialPhase!=="spiritExplore")return;
  if(x===state.star[0]&&y===state.star[1]){
    state.tutorialSpiritStep=FIRST_LEVEL_SPIRIT_ROUTE.length;
    state.tutorialPhase="spiritReveal";
    showTutorialForState();
    openOnboardingReveal();
    return;
  }
  const reached=FIRST_LEVEL_SPIRIT_ROUTE.findIndex(([targetX,targetY],index)=>
    index>=state.tutorialSpiritStep&&x===targetX&&y===targetY);
  if(reached>=0){
    state.tutorialSpiritStep=reached+1;
    showTutorialForState();
  }
}

function openOnboardingReveal(){
  if(!onboardingRevealModal||!onboardingRevealButton){
    dismissOnboardingReveal();
    return;
  }
  openModal(onboardingRevealModal,onboardingRevealButton,"onboarding-reveal",canvas);
}

function dismissOnboardingReveal(){
  if(state?.tutorialPhase!=="spiritReveal")return;
  closeModal(onboardingRevealModal,{restoreFocus:false});
  state.tutorialPhase="spiritReturn";
  showTutorialForState();
  spiritReturnButton.focus();
  scheduleRunSnapshot();
}

function startSpiritMode({atEntry=false}={}) {
  state.inventory.spirit--;
  state.usage.spirit++;
  state.toolCost += 2;
  state.infoUses++;
  state.selected = null;
  state.target = null;
  state.spiritMode = true;
  state.spiritScoutedCurrent = false;
  state.soul = { x:state.player.x, y:state.player.y, drawX:state.player.x, drawY:state.player.y, facing:state.player.facing };
  state.spiritOriginVisible = new Set(state.visible);
  state.spiritVisible = computeVisibleFrom(state.soul.x, state.soul.y);
  state.spiritLightTransition = null;
  resetCamera();
  state.lastProgress = performance.now();
  if (state.tutorialPhase === "spiritUse") {
    state.tutorialPhase = "spiritExplore";
    state.tutorialSpiritStep = 0;
  }
  updateInventory();
  showTutorialForState();
  pulseAt(state.soul.x, state.soul.y, "#a7f1ee", 1.6);
  playTone("spirit");
  if(state.mode==="campaign"&&state.tutorialPhase==="spiritExplore")dismissTransientToast();
  else showToast("灵魂已离体 · 可自由穿墙，无时间限制");
  if(!atEntry)scheduleRunSnapshot();
}

function returnSpirit() {
  if (!state?.spiritMode || state.tutorialPhase==="spiritReveal") return;
  const retryTutorial = state.mode==="campaign" && state.tutorialPhase === "spiritExplore";
  const scouted=state.spiritScoutedCurrent===true;
  const refund=retryTutorial||!scouted;
  state.spiritMode = false;
  state.spiritScoutedCurrent = false;
  state.soul = null;
  state.spiritCameraAnchor = null;
  state.spiritLightTransition = null;
  state.spiritVisible.clear();
  state.spiritOriginVisible.clear();
  state.locked = false;
  state.visible = computeVisible();
  resetCamera();
  state.lastProgress = performance.now();
  if (refund) {
    state.inventory.spirit++;
    state.usage.spirit = Math.max(0, state.usage.spirit - 1);
    state.toolCost = Math.max(0, state.toolCost - 2);
    state.infoUses = Math.max(0, state.infoUses - 1);
    if(retryTutorial)state.tutorialPhase = "spiritUse";
  }
  if(state.tutorialPhase==="spiritReturn")state.tutorialPhase=state.levelIndex===0?"move":"spiritDone";
  updateInventory();
  showTutorialForState();
  playTone("spirit");
  showToast(retryTutorial
    ? "侦察尚未完成 · 灵魂卡已返还，请重新尝试"
    :!scouted?"尚未进入新区域 · 灵魂卡已返还"
    :"有效侦察完成 · 灵魂返回身体，恢复原视野", refund);
  scheduleRunSnapshot();
}

function selectHammer() {
  selectItem("hammer");
}

function selectBomb() {
  selectItem("bomb");
}

function selectFlash() {
  selectItem("flash");
}

function selectTorch() {
  selectItem("torch");
}

function selectTeleport() {
  selectItem("teleport");
}

function requiredTutorialTool() {
  const phase = state?.tutorialPhase;
  if (["selectWood", "breakWood"].includes(phase)) return "hammer";
  if (["torchSelect", "torchAim"].includes(phase)) return "torch";
  if (["spiritUse", "spiritExplore", "spiritReveal", "spiritReturn"].includes(phase)) return "spirit";
  if (phase === "move") return "movement";
  return null;
}

function currentTutorialTarget() {
  if(!state)return null;
  if(state.tutorialPhase==="spiritExplore")return FIRST_LEVEL_SPIRIT_ROUTE[state.tutorialSpiritStep]||state.star;
  const keyName=state.tutorialPhase==="move"?"hammer"
    :state.tutorialPhase==="breakWood"?"wood"
    :state.tutorialPhase==="torchAim"?"target":null;
  const target=keyName?state.level.tutorial?.[keyName]:null;
  return Array.isArray(target)&&target.length>=2?target:null;
}

function tutorialAllowsTool(type) {
  const required = requiredTutorialTool();
  return !required || required === type;
}

function useSpiritCard() {
  if (!state || state.phase !== "explore" || state.locked) return;
  if (!tutorialAllowsTool("spirit")) {
    showToast("请先完成当前教学步骤", true);
    return;
  }
  if (state.spiritMode) {
    showToast("灵魂已经离开身体；使用返回键结束侦察");
    return;
  }
  if (state.inventory.spirit <= 0) {
    showToast("背包里还没有灵魂出窍卡", true);
    pulsePickupHint();
    return;
  }
  startSpiritMode();
}

function selectItem(type) {
  if (!state || state.phase !== "explore" || state.locked) return;
  if (!tutorialAllowsTool(type)) {
    showToast("请先完成当前教学步骤", true);
    return;
  }
  if (state.spiritMode) {
    showToast("灵魂状态不能使用道具", true);
    return;
  }
  if (state.inventory[type] <= 0) {
    if (type === "hammer") {
      const pickup=reachablePickup("hammer");
      showToast(pickup
        ? "锤击次数已用完 · 先拾取发光锤子补充 5 次"
        : "锤击次数已用完 · 右上角设置可使用卡关救援",true);
      if(pickup)pulseAt(pickup.x,pickup.y,"#efbd62",1.2);
      else pulsePickupHint();
      return;
    }
    if (type === "bomb") {
      const pickup=reachablePickup("bomb");
      const uncollected=state.items.find((candidate)=>!candidate.picked&&candidate.type==="bomb");
      const crackedRemains=state.map.some((row)=>row.includes(TILE.CRACKED));
      showToast(pickup
        ? "炸弹已用完 · 先拾取当前区域的发光炸弹"
        : uncollected
          ? "炸弹已用完 · 地图中还有一份炸弹补给"
          : crackedRemains&&state.mode==="campaign"
            ? "炸弹已用完 · 裂纹石墙只能炸开 · 右上角设置可用卡关救援"
            : "背包里还没有炸弹",true);
      if(pickup)pulseAt(pickup.x,pickup.y,"#efbd62",1.2);
      else pulsePickupHint();
      return;
    }
    const missing = { bomb:"背包里还没有炸弹", flash:"闪光弹次数已经用完", torch:"手电筒次数已经用完", teleport:"10格瞬移卡已经用完" };
    showToast(missing[type] || "这种物资已经用完", true);
    pulsePickupHint();
    return;
  }
  if (state.selected === type) {
    state.selected = null;
    state.target = null;
  } else {
    state.selected = type;
    state.target = bestTarget(type);
    if(isCompactViewport()&&state.flashEnds>performance.now())state.flashOverview=false;
  }
  state.lastProgress = performance.now();
  updateInventory();
  if (type === "hammer" && ["selectWood","breakWood"].includes(state.tutorialPhase)) {
    state.tutorialPhase = state.selected ? "breakWood" : "selectWood";
    const target=currentTutorialTarget();
    if(target)state.target={x:target[0],y:target[1]};
    showTutorialForState();
  } else if (type === "torch" && state.tutorialPhase === "torchSelect") {
    state.tutorialPhase = "torchAim";
    const target = state.level.tutorial?.target;
    if (target) state.target = { x:target[0], y:target[1] };
    showTutorialForState();
  }
}

function cancelSelection() {
  if (!state) return;
  cancelAutoRoute();
  state.selected = null;
  state.target = null;
  if(state.tutorialPhase==="breakWood"){
    state.tutorialPhase="selectWood";
    showTutorialForState();
  }else updateInventory();
}

function bestTarget(type) {
  if (type === "bomb" || type === "flash") return { x: state.player.x, y: state.player.y };
  if (type === "torch" || type === "teleport") return { x: state.player.x, y: state.player.y };
  const choices = [[1,0],[0,1],[-1,0],[0,-1]]
    .map(([dx,dy]) => ({ x: state.player.x + dx, y: state.player.y + dy }))
    .filter(({x,y}) => inBounds(x,y));
  const walls = choices.filter(({x,y}) => isWallTile(state.map[y][x]));
  const knownWood = walls.find(({x,y}) => state.map[y][x] === TILE.WOOD && isWallMaterialRevealed(x,y));
  return knownWood || walls[0] || choices[0] || null;
}

function aimSelected(dx, dy) {
  if (!state?.selected) return;
  const ranged = state.selected === "teleport" || state.selected === "torch";
  const origin = ranged && state.target ? state.target : state.player;
  const x = origin.x + dx, y = origin.y + dy;
  if (state.selected === "teleport" && Math.abs(x - state.player.x) + Math.abs(y - state.player.y) > 10) {
    showToast("已到达 10 格瞬移范围边界", true);
    return;
  }
  if (inBounds(x,y)) {
    state.target = { x, y };
    state.lastProgress = performance.now();
    updateCanvasDescription();
  }
}

function remainingShards() {
  return state?.shards?.filter((shard)=>!shard.collected) || [];
}

function remainingMandatoryRewards() {
  return state?.items?.filter((item)=>item.mandatory&&!item.picked) || [];
}

function nearestUncollectedShard(origin = state?.player) {
  if (!origin) return null;
  return remainingShards().sort((left,right)=>
    (Math.abs(left.x-origin.x)+Math.abs(left.y-origin.y))-(Math.abs(right.x-origin.x)+Math.abs(right.y-origin.y)))[0] || null;
}

function goalGuidanceTarget(origin = state?.player) {
  const shard=nearestUncollectedShard(origin);
  if(shard)return { x:shard.x,y:shard.y,label:"最近星屑",symbol:"✧" };
  const reward=remainingMandatoryRewards().sort((left,right)=>
    (Math.abs(left.x-origin.x)+Math.abs(left.y-origin.y))-(Math.abs(right.x-origin.x)+Math.abs(right.y-origin.y)))[0];
  return reward ? {x:reward.x,y:reward.y,label:"必经补给",symbol:"◆"}
    : { x:state.star[0],y:state.star[1],label:"星星",symbol:"✦" };
}

function updateCanvasDescription(now=performance.now()) {
  if (!state) return;
  const inventory = state.inventory;
  const focus = state.spiritMode && state.soul ? state.soul : state.player;
  const mode = state.spiritMode ? `灵魂位于第 ${state.soul.y + 1} 行第 ${state.soul.x + 1} 列，身体留在第 ${state.player.y + 1} 行第 ${state.player.x + 1} 列，${state.spiritScoutedCurrent?"已完成有效侦察":"尚未进入身体原视野外的新连通区"}`
    : `角色位于第 ${state.player.y + 1} 行第 ${state.player.x + 1} 列`;
  const guidance=goalGuidanceTarget(focus);
  const horizontal = guidance.x === focus.x ? "" : guidance.x > focus.x ? "右" : "左";
  const vertical = guidance.y === focus.y ? "" : guidance.y > focus.y ? "下" : "上";
  const goalDirection = `${vertical}${horizontal}` || "脚下";
  const goalDistance = Math.abs(guidance.x - focus.x) + Math.abs(guidance.y - focus.y);
  const selectedNames = { hammer:"砸墙锤", bomb:"炸弹", flash:"闪光弹", torch:"手电筒", teleport:"10格瞬移卡" };
  const selection = state.selected
    ? `已选择${selectedNames[state.selected]}${state.target ? `，瞄准第 ${state.target.y + 1} 行第 ${state.target.x + 1} 列` : ""}`
    : "当前未选择道具";
  const routeHelp=state.autoRoute&&state.moveDestination
    ? `正在自动前往第 ${state.moveDestination.y + 1} 行第 ${state.moveDestination.x + 1} 列；按 Escape 可在下一格停下。`
    : "";
  const previewControl = document.getElementById("skipPreview").textContent || "结束预览";
  const previewHelp = state.phase === "preview" ? `当前为亮屏预览；触屏按住并拖动地图可局部放大，使用“${previewControl}”可结束预览。` : "";
  const memoryPinHelp=state.memoryPinLimit>0&&state.phase==="explore"
    ?`本关有 ${state.memoryPinLimit} 枚记忆钉；用灵魂、闪光或手电看清墙材后，可激活墙格放置。`
    :"";
  const itemNames = { hammer:"锤子", bomb:"炸弹", spirit:"灵魂卡", torch:"手电筒" };
  function describeCell(x,y) {
    if (!inBounds(x,y)) return "边界";
    if (isShown(x,y,now) < .5) return "黑暗";
    if (x === state.star[0] && y === state.star[1]) {
      if(remainingShards().length)return "尚未解锁的星星，还需收集星屑";
      if(remainingMandatoryRewards().length)return "尚未解锁的星星，还需拾取必经补给";
      return "星星";
    }
    const shard=state.shards.find((candidate)=>!candidate.collected&&candidate.x===x&&candidate.y===y);
    if(shard)return "星屑";
    const item = state.items.find((candidate)=>!candidate.picked&&candidate.x===x&&candidate.y===y);
    if (item) return `有${itemNames[item.type]}的地面`;
    const tile = state.map[y][x];
    if (tile === TILE.FLOOR) return "地面";
    if (!isWallMaterialRevealed(x,y,now)) return "黑墙";
    const pinned=state.memoryPins.has(key(x,y))?"，带记忆钉":"";
    return `${tile === TILE.WOOD ? "木墙" : tile === TILE.CRACKED ? "裂纹石墙，只能炸开" : "石墙"}${pinned}`;
  }
  const neighbors = [[0,-1,"上"],[1,0,"右"],[0,1,"下"],[-1,0,"左"]]
    .map(([dx,dy,label])=>`${label}${describeCell(focus.x+dx,focus.y+dy)}`).join("，");
  const shardProgress=state.shards.length?`已收集星屑 ${state.shardsCollected}/${state.shards.length}。`:"";
  const runTitle=runDisplayTitle();
  const tutorialTarget=currentTutorialTarget();
  const tutorialHelp=tutorialTarget
    ? `教学目标在第 ${tutorialTarget[1]+1} 行第 ${tutorialTarget[0]+1} 列。按 Enter 操作。`
    : "";
  const cameraHelp=isCompactViewport()
    ? state.phase==="preview"?"当前显示全图预览。"
      : state.flashEnds>now&&!state.selected&&!state.spiritMode&&!tutorialTarget
        ? state.flashOverview!==false
          ? "闪光全图为观察态；轻点地图只会先切到大格局部，不会移动，右上角也可切换。"
          : "闪光期间镜头处于大格局部操作；右上角可切回全图观察。"
      : state.spiritMode?"镜头已放大灵魂所在的光亮区域，可拖动查看。"
      : "镜头已放大角色当前的光亮区域，可拖动查看。"
    : "";
  canvas.setAttribute?.("aria-label", `${runTitle}。${previewHelp}${memoryPinHelp}${cameraHelp}${mode}。${tutorialHelp}${routeHelp}${guidance.label}在${goalDirection}方向，距离 ${goalDistance} 格。${shardProgress}四周：${neighbors}。${selection}。锤 ${inventory.hammer}，炸弹 ${inventory.bomb}，闪光 ${inventory.flash}，灵魂 ${inventory.spirit}，手电 ${inventory.torch}，瞬移 ${inventory.teleport}。按 M 打开文本地图检查器。`);
}

function semanticCellInfo(x,y,now=semanticMapSnapshotTime){
  const coordinate=`第 ${y+1} 行，第 ${x+1} 列`;
  const tutorialTarget=currentTutorialTarget();
  const isTutorialTarget=tutorialTarget?.[0]===x&&tutorialTarget?.[1]===y;
  if(isShown(x,y,now)<.5)return {
    label:`${coordinate}：${isTutorialTarget?"教学目标，":""}未照亮`,
    symbol:isTutorialTarget?"◎":"？",className:"unknown",
  };
  const features=isTutorialTarget?["教学目标"]:[];
  const isPlayer=state.player.x===x&&state.player.y===y;
  const isSoul=Boolean(state.spiritMode&&state.soul?.x===x&&state.soul?.y===y);
  const isStar=state.star[0]===x&&state.star[1]===y;
  const shard=state.shards.find((candidate)=>!candidate.collected&&candidate.x===x&&candidate.y===y);
  const item=state.items.find((candidate)=>!candidate.picked&&candidate.x===x&&candidate.y===y);
  if(isPlayer)features.push(state.spiritMode?"身体":"角色");
  if(isSoul)features.push("灵魂");
  if(isStar)features.push(remainingShards().length?`北极星尚未解锁，还差 ${remainingShards().length} 枚星屑`
    :remainingMandatoryRewards().length?`北极星尚未解锁，还差 ${remainingMandatoryRewards().length} 份必经补给`:"北极星");
  if(shard)features.push("未收集星屑");
  if(state.memoryPins.has(key(x,y)))features.push("已放置记忆钉，暗中保留材质");
  const itemLabels={hammer:"砸墙锤",bomb:"炸弹",spirit:"灵魂出窍卡",torch:"手电筒"};
  if(item)features.push(itemLabels[item.type]||"道具");
  const tile=state.map[y][x];
  let terrain="通路",symbol="·",className="floor";
  if(tile!==TILE.FLOOR){
    if(!isWallMaterialRevealed(x,y,now)){
      terrain="黑墙，当前无法辨认材质";symbol="墙";className="black-wall";
    }else if(tile===TILE.WOOD){
      terrain="木墙，可以敲开";symbol="木";className="wood";
    }else if(tile===TILE.CRACKED){
      terrain="裂纹石墙，锤子无效，只能用炸弹炸开";symbol="裂";className="cracked";
    }else{
      terrain="石墙，无法破坏";symbol="石";className="stone";
    }
  }
  if(isPlayer){symbol="人";className="player";}
  else if(isSoul){symbol="魂";className="soul";}
  else if(isStar){symbol="★";className="star";}
  else if(shard){symbol="✧";className="shard";}
  else if(item){symbol={hammer:"锤",bomb:"炸",spirit:"魂",torch:"灯"}[item.type]||"物";className="item";}
  if(state.memoryPins.has(key(x,y)))className+=` pinned`;
  return { label:`${coordinate}：${features.length?`${features.join("，")}，`:""}${terrain}`,symbol,className };
}

function buildSemanticMap(){
  semanticMapSnapshotTime=performance.now();
  semanticMapGrid.innerHTML="";
  const width=state.map[0].length,height=state.map.length;
  const mapTitle=runDisplayTitle();
  semanticMapGrid.setAttribute("aria-label",`${mapTitle}文本地图，共 ${height} 行 ${width} 列`);
  semanticMapGrid.setAttribute("aria-rowcount",String(height));
  semanticMapGrid.setAttribute("aria-colcount",String(width));
  const focus=state.spiritMode&&state.soul?state.soul:state.player;
  const fragment=document.createDocumentFragment();
  for(let y=0;y<height;y++){
    const row=document.createElement("div");
    row.className="semantic-map-row";
    row.setAttribute("role","row");
    row.setAttribute("aria-rowindex",String(y+1));
    row.style.gridTemplateColumns=`repeat(${width},44px)`;
    for(let x=0;x<width;x++){
      const info=semanticCellInfo(x,y);
      const cell=document.createElement("button");
      cell.type="button";
      cell.className=`semantic-map-cell ${info.className}`;
      cell.dataset.x=String(x);
      cell.dataset.y=String(y);
      cell.setAttribute("role","gridcell");
      cell.setAttribute("aria-colindex",String(x+1));
      cell.setAttribute("aria-label",info.label);
      cell.setAttribute("tabindex",x===focus.x&&y===focus.y?"0":"-1");
      cell.textContent=info.symbol;
      row.appendChild(cell);
    }
    fragment.appendChild(row);
  }
  semanticMapGrid.appendChild(fragment);
  const initial=semanticMapGrid.querySelector('[tabindex="0"]');
  semanticMapPosition.textContent=initial?.getAttribute("aria-label")||"";
  return initial;
}

function refreshSemanticMapCell(x,y){
  const cell=semanticMapGrid.querySelector?.(`[data-x="${x}"][data-y="${y}"]`);
  if(!cell)return;
  const info=semanticCellInfo(x,y,performance.now());
  cell.className=`semantic-map-cell ${info.className}`;
  cell.setAttribute("aria-label",info.label);
  cell.textContent=info.symbol;
  if(document.activeElement===cell)semanticMapPosition.textContent=info.label;
}

function focusSemanticMapCell(x,y){
  const width=state.map[0].length,height=state.map.length;
  const nextX=Math.max(0,Math.min(width-1,x));
  const nextY=Math.max(0,Math.min(height-1,y));
  const next=semanticMapGrid.querySelector(`[data-x="${nextX}"][data-y="${nextY}"]`);
  if(!next)return;
  semanticMapGrid.querySelector('[tabindex="0"]')?.setAttribute("tabindex","-1");
  next.setAttribute("tabindex","0");
  semanticMapPosition.textContent=next.getAttribute("aria-label")||"";
  focusSemanticMapTarget(next);
}

function focusSemanticMapTarget(cell){
  if(!cell)return;
  const card=cell.closest?.(".semantic-map-card");
  const cardLeft=card?.scrollLeft||0;
  try{cell.focus({preventScroll:true});}catch(_){cell.focus();}
  if(document.activeElement!==cell)cell.focus();
  const viewport=semanticMapScroll.getBoundingClientRect?.();
  const bounds=cell.getBoundingClientRect?.();
  if(!viewport||!bounds)return;
  const margin=8;
  if(bounds.left<viewport.left+margin)semanticMapScroll.scrollLeft+=bounds.left-(viewport.left+margin);
  else if(bounds.right>viewport.right-margin)semanticMapScroll.scrollLeft+=bounds.right-(viewport.right-margin);
  if(bounds.top<viewport.top+margin)semanticMapScroll.scrollTop+=bounds.top-(viewport.top+margin);
  else if(bounds.bottom>viewport.bottom-margin)semanticMapScroll.scrollTop+=bounds.bottom-(viewport.bottom-margin);
  if(card){
    card.scrollLeft=cardLeft;
    const cardBounds=card.getBoundingClientRect();
    const focusedBounds=cell.getBoundingClientRect();
    if(focusedBounds.top<cardBounds.top+margin)card.scrollTop+=focusedBounds.top-(cardBounds.top+margin);
    else if(focusedBounds.bottom>cardBounds.bottom-margin)card.scrollTop+=focusedBounds.bottom-(cardBounds.bottom-margin);
  }
}

function openSemanticMap(){
  if(!state)return;
  const initial=buildSemanticMap();
  openModal(semanticMapModal,initial,"semantic-map",document.getElementById("semanticMapButton"));
}

function closeSemanticMap({restoreFocus=true}={}){
  closeModal(semanticMapModal,{restoreFocus});
  semanticMapGrid.innerHTML="";
  semanticMapPosition.textContent="";
}

function updateInventory() {
  if (!state) return;
  updateLiveScore();
  hammerCount.textContent = state.inventory.hammer > 0 ? String(state.inventory.hammer) : "—";
  bombCount.textContent = state.inventory.bomb > 0 ? String(state.inventory.bomb) : "—";
  flashCount.textContent = state.inventory.flash > 0 ? String(state.inventory.flash) : "—";
  spiritCount.textContent = state.inventory.spirit > 0 ? String(state.inventory.spirit) : "—";
  torchCount.textContent = state.inventory.torch > 0 ? String(state.inventory.torch) : "—";
  teleportCount.textContent = state.inventory.teleport > 0 ? String(state.inventory.teleport) : "—";
  hammerSlot.classList.toggle("empty", state.inventory.hammer <= 0);
  bombSlot.classList.toggle("empty", state.inventory.bomb <= 0);
  flashSlot.classList.toggle("empty", state.inventory.flash <= 0);
  spiritSlot.classList.toggle("empty", state.inventory.spirit <= 0);
  torchSlot.classList.toggle("empty", state.inventory.torch <= 0);
  teleportSlot.classList.toggle("empty", state.inventory.teleport <= 0);
  hammerSlot.classList.toggle("selected", state.selected === "hammer");
  bombSlot.classList.toggle("selected", state.selected === "bomb");
  flashSlot.classList.toggle("selected", state.selected === "flash");
  torchSlot.classList.toggle("selected", state.selected === "torch");
  teleportSlot.classList.toggle("selected", state.selected === "teleport");
  const tutorialTool = requiredTutorialTool();
  [[hammerSlot,"hammer","砸墙锤",1],[bombSlot,"bomb","炸弹",2],[flashSlot,"flash","闪光弹",3],[spiritSlot,"spirit","灵魂出窍卡",4],[torchSlot,"torch","手电筒",5],[teleportSlot,"teleport","10格瞬移卡",6]]
    .forEach(([slot,type,label,shortcut]) => {
      const locked = Boolean(tutorialTool && tutorialTool !== type);
      slot.classList.toggle("locked", locked);
      slot.setAttribute?.("aria-disabled", String(locked));
      const selected = state.selected === type;
      if (type === "spirit") slot.removeAttribute?.("aria-pressed");
      else slot.setAttribute?.("aria-pressed", String(selected));
      if(selected)slot.setAttribute?.("aria-describedby","itemHelp");
      else slot.removeAttribute?.("aria-describedby");
      slot.setAttribute?.("aria-label", `${label}，剩余 ${state.inventory[type]}，快捷键 ${shortcut}${selected ? "，已选择" : ""}${locked ? "，当前教学步骤不可用" : ""}`);
    });
  document.getElementById("spiritStatus").classList.toggle("hidden", !state.spiritMode);
  spiritStatusText.textContent=state.spiritScoutedCurrent?"有效侦察完成":"穿入身体视野外的新区域";
  canvas.classList.toggle("targeting", Boolean(state.selected));
  const cancelButton=document.getElementById("cancelButton");
  cancelButton.disabled = !state.selected && !state.autoRoute;
  cancelButton.innerHTML=state.autoRoute?'停止移动 <kbd>Esc</kbd>':'取消选择 <kbd>Esc</kbd>';
  document.getElementById("capacityUsed").textContent = INVENTORY_KEYS.reduce((sum,keyName)=>sum+state.inventory[keyName],0);
  if (state.selected === "hammer") {
    itemHelp.innerHTML = "<strong>砸墙锤 · 已选择</strong><span>每次实际锤击计 1 点路径成本；木墙可破，石墙与裂纹石墙耗锤但不碎</span>";
  } else if (state.selected === "bomb") {
    const bombHelp=state.mode==="campaign"&&state.levelIndex===18
      ? "计 3 点路径成本；确认 3×3 橙框同时覆盖两道裂纹石墙再放置"
      : "计 3 点路径成本；点脚下或相邻亮地，3×3 橙框可炸木墙和裂纹石墙";
    itemHelp.innerHTML = `<strong>炸弹 · 3×3 范围</strong><span>${bombHelp}</span>`;
  } else if (state.selected === "flash") {
    itemHelp.innerHTML = "<strong>闪光弹 · 已选择</strong><span>点击迷宫任意位置，恢复全图真实材质 25 秒</span>";
  } else if (state.selected === "torch") {
    itemHelp.innerHTML = "<strong>手电筒 · 已选择</strong><span>点击一个方向；照出至少一面未知墙材才消耗</span>";
  } else if (state.selected === "teleport") {
    itemHelp.innerHTML = "<strong>10格瞬移卡 · 已选择</strong><span>成功计 5 点路径成本；可先拖动画面，再点 10 格内的地面，墙体无法落脚</span>";
  } else if (state.spiritMode) {
    itemHelp.innerHTML = `<strong>灵魂侦察中${state.spiritScoutedCurrent?" · 已有效":""}</strong><span>${state.spiritScoutedCurrent?"已进入新区域；可返回身体":"穿入身体原视野外的新连通区才消耗"}</span>`;
  } else if (remainingShards().length) {
    const badgeHelp=state.level.challenge ? `；印记：${state.level.challenge.description}` : "";
    itemHelp.innerHTML = `<strong>星屑 ${state.shardsCollected} / ${state.shards.length}</strong><span>先收集剩余星屑，才能解除北极星封印${badgeHelp}</span>`;
  } else if (remainingMandatoryRewards().length) {
    const reward=remainingMandatoryRewards()[0];
    const rewardName=reward.type==="hammer"?"砸墙锤":reward.type==="bomb"?"炸弹":"补给";
    itemHelp.innerHTML = `<strong>必经补给 · ${rewardName}</strong><span>先拾取地图中的发光补给，才能解除北极星封印</span>`;
  } else if (state.level.challenge) {
    itemHelp.innerHTML = `<strong>三星印记 · ${state.level.challenge.name}</strong><span>${state.level.challenge.description}</span>`;
  } else {
    itemHelp.innerHTML = "<strong>移动</strong><span>点击光亮地面自动前往；手机可拖动画面查看周围</span>";
  }
  updateCameraResetButton();
  updateCanvasDescription();
}

function autoMoveDuration(stepIndex) {
  return stepIndex<=2?100:70;
}

function clearAutoRoute(route=state?.autoRoute) {
  if(!state||!route||state.autoRoute!==route)return false;
  state.autoRoute=null;
  state.moveDestination=null;
  updateInventory();
  return true;
}

function cancelAutoRoute(pendingActivation=null) {
  const route=state?.autoRoute;
  if(!route)return false;
  route.cancelled=true;
  route.pendingActivation=pendingActivation;
  state.moveDestination=pendingActivation?{x:pendingActivation.x,y:pendingActivation.y}:null;
  updateCanvasDescription();
  return true;
}

function animateMoveTo(nx, ny, onComplete = null, duration = 120) {
  if (!state || state.phase !== "explore" || state.locked) return false;
  if (!inBounds(nx, ny) || !isFloor(nx, ny)) {
    if (inBounds(nx, ny)) shakeCell(nx, ny);
    playTone("blocked");
    return false;
  }
  resetCamera();
  const activeState = state;
  const fromX = state.player.x, fromY = state.player.y;
  const dx = nx - fromX;
  state.player.x = nx;
  state.player.y = ny;
  state.player.facing = dx === 0 ? state.player.facing : Math.sign(dx);
  state.steps++;
  state.locked = true;
  state.lastProgress = performance.now();
  startGameMotion((now,start)=>{
    if (state !== activeState) return false;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    activeState.player.drawX = fromX + (nx - fromX) * eased;
    activeState.player.drawY = fromY + (ny - fromY) * eased;
    if (t >= 1) {
      activeState.player.drawX = nx;
      activeState.player.drawY = ny;
      activeState.locked = false;
      onArrive();
      updateCanvasDescription();
      if (state === activeState && onComplete) onComplete();
      if(state===activeState&&!activeState.locked)scheduleRunSnapshot();
    }
    return t < 1;
  });
  playTone("step");
  return true;
}

function tryMove(dx, dy) {
  if (!state || state.phase !== "explore" || state.locked) return;
  if (state.spiritMode) {
    animateSoulTo(state.soul.x + dx, state.soul.y + dy);
    return;
  }
  if (state.selected) return;
  const nx = state.player.x + dx, ny = state.player.y + dy;
  animateMoveTo(nx, ny);
}

function animateSoulTo(nx, ny, onComplete = null) {
  if (state?.tutorialPhase==="spiritReveal"||state?.tutorialPhase==="spiritReturn")return false;
  if (!state?.spiritMode || state.locked || !canSoulEnter(nx, ny)) {
    if (state?.spiritMode) playTone("blocked");
    return false;
  }
  const activeState = state;
  const soul = state.soul;
  const fromX = soul.x, fromY = soul.y;
  soul.x = nx;
  soul.y = ny;
  soul.facing = nx === fromX ? soul.facing : Math.sign(nx - fromX);
  state.locked = true;
  state.lastProgress = performance.now();
  startGameMotion((now,start)=>{
    if (state !== activeState || !activeState.spiritMode || activeState.soul !== soul) return false;
    const t = Math.min(1, (now - start) / 95);
    const eased = 1 - Math.pow(1 - t, 3);
    soul.drawX = fromX + (nx - fromX) * eased;
    soul.drawY = fromY + (ny - fromY) * eased;
    if (t >= 1) {
      soul.drawX = nx;
      soul.drawY = ny;
      activeState.locked = false;
      updateSpiritVisible();
      updateCameraResetButton();
      updateCanvasDescription();
      if (state === activeState && activeState.spiritMode && activeState.tutorialPhase!=="spiritReveal" && onComplete) onComplete();
      if(state===activeState&&!activeState.locked)scheduleRunSnapshot();
    }
    return t < 1;
  });
  playTone("spiritStep");
  return true;
}

function moveSoulTo(targetX, targetY) {
  if (!canSoulEnter(targetX, targetY)) {
    showToast("灵魂不能离开迷宫边界", true);
    return;
  }
  const path = [];
  let x = state.soul.x, y = state.soul.y;
  while (x !== targetX) { x += Math.sign(targetX - x); path.push([x,y]); }
  while (y !== targetY) { y += Math.sign(targetY - y); path.push([x,y]); }
  let index = 0;
  function advance() {
    if (!state.spiritMode || index >= path.length) return;
    const [nx,ny] = path[index++];
    animateSoulTo(nx,ny,advance);
  }
  advance();
}

function findVisiblePath(goalX, goalY) {
  if (!isFloor(goalX, goalY) || !state.visible.has(key(goalX, goalY))) return [];
  const startKey = key(state.player.x, state.player.y);
  const goalKey = key(goalX, goalY);
  const queue = [[state.player.x, state.player.y]];
  const parent = new Map([[startKey, null]]);
  for (let i = 0; i < queue.length && !parent.has(goalKey); i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, id = key(nx, ny);
      if (parent.has(id) || !isFloor(nx, ny) || !state.visible.has(id)) continue;
      parent.set(id, key(x, y));
      queue.push([nx, ny]);
    }
  }
  if (!parent.has(goalKey)) return [];
  const path = [];
  for (let current = goalKey; current; current = parent.get(current)) {
    path.push(current.split(",").map(Number));
  }
  return path.reverse();
}

function followPath(path, onComplete = null, {destination=null}={}) {
  if (!path.length) return false;
  const activeState = state;
  if(path.length===1){
    if(onComplete)onComplete();
    return true;
  }
  if(activeState.autoRoute)clearAutoRoute(activeState.autoRoute);
  const route={activeState,cancelled:false,pendingActivation:null,onComplete};
  activeState.autoRoute=route;
  const endpoint=destination||{x:path[path.length-1][0],y:path[path.length-1][1]};
  activeState.moveDestination={x:endpoint.x,y:endpoint.y};
  let index = 1;
  function advance() {
    if(state!==activeState||activeState.autoRoute!==route)return;
    if(activeState.phase!=="explore"||activeState.complete){clearAutoRoute(route);return;}
    if(route.cancelled){
      const pending=route.pendingActivation;
      clearAutoRoute(route);
      if(pending)activateCanvasCell(pending.x,pending.y);
      else showToast("自动移动已在当前格停止");
      if(state===activeState&&!activeState.locked)scheduleRunSnapshot();
      return;
    }
    if (index >= path.length) {
      clearAutoRoute(route);
      if(onComplete)onComplete();
      return;
    }
    const stepIndex=index;
    const [nx, ny] = path[index++];
    if(!animateMoveTo(nx,ny,advance,autoMoveDuration(stepIndex)))clearAutoRoute(route);
  }
  route.advance=advance;
  updateInventory();
  advance();
  return true;
}

function moveToVisibleCell(x, y) {
  if (x === state.player.x && y === state.player.y) return;
  const path = findVisiblePath(x, y);
  if (!path.length) {
    showToast("只能自动前往连通的光亮地面", true);
    playTone("blocked");
    return;
  }
  followPath(path,null,{destination:{x,y}});
}

function moveAndUseHammer(x, y) {
  if (!state.visible.has(key(x, y))) {
    showToast("只能尝试敲击光亮区域边缘的墙", true);
    playTone("blocked");
    return;
  }
  const tile = state.map[y]?.[x];
  if (!isWallTile(tile)) {
    useHammer(x, y);
    return;
  }
  const paths = [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx, dy]) => findVisiblePath(x + dx, y + dy))
    .filter((path) => path.length)
    .sort((a, b) => a.length - b.length);
  if (!paths.length) {
    showToast("墙边没有可到达的光亮格子", true);
    playTone("blocked");
    return;
  }
  state.target = { x, y };
  followPath(paths[0], () => {
    if(state?.selected==="hammer"&&state.target?.x===x&&state.target?.y===y)useHammer(x,y);
  },{destination:{x,y}});
}

function onArrive() {
  const pickup = state.items.find((item) => !item.picked && item.x === state.player.x && item.y === state.player.y);
  if (pickup) {
    pickup.picked = true;
    state.inventory[pickup.type] += pickup.amount;
    state.picked += pickup.amount;
    state.lastProgress = performance.now();
    pulseAt(pickup.x, pickup.y, "#f0bd5e", 0.9);
    playTone("pickup");
    const pickupNames = { hammer:"砸墙锤 · 锤击次数", bomb:"炸弹 · 数量", spirit:"灵魂出窍卡 · 数量", torch:"手电筒 · 照明次数" };
    showToast(pickup.mandatory
      ? `必经补给已取得 · ${pickupNames[pickup.type]} +${pickup.amount} · 北极星封印解除`
      : `拾取${pickupNames[pickup.type]} +${pickup.amount}`);
    updateInventory();
    if (state.tutorialPhase === "move" && pickup.type === "hammer") {
      state.tutorialPhase = "selectWood";
      showTutorialForState();
    }
  }
  const shard=state.shards.find((candidate)=>!candidate.collected&&candidate.x===state.player.x&&candidate.y===state.player.y);
  if(shard){
    shard.collected=true;
    state.shardsCollected++;
    state.picked++;
    state.lastProgress=performance.now();
    pulseAt(shard.x,shard.y,"#ffdf7a",1.15,"shard");
    playTone("pickup");
    const left=remainingShards().length;
    showToast(left?`收集星屑 ${state.shardsCollected}/${state.shards.length} · 还差 ${left} 枚`:`星屑已集齐 · 北极星解除封印`);
    refreshSemanticMapCell(shard.x,shard.y);
    refreshSemanticMapCell(state.star[0],state.star[1]);
    updateInventory();
  }
  if (state.player.x === state.star[0] && state.player.y === state.star[1]) {
    const left=remainingShards().length;
    if(left){
      state.prematureStarTouches++;
      const next=remainingShards().filter((candidate)=>isShown(candidate.x,candidate.y)>=.5).sort((leftShard,rightShard)=>
        (Math.abs(leftShard.x-state.player.x)+Math.abs(leftShard.y-state.player.y))
        -(Math.abs(rightShard.x-state.player.x)+Math.abs(rightShard.y-state.player.y)))[0];
      if(next)pulseAt(next.x,next.y,"#ffe08b",1.3,"shard");
      showToast(`北极星尚未解锁 · 还差 ${left} 枚星屑`,true);
      playTone("blocked");
      updateCanvasDescription();
    }else{
      const rewards=remainingMandatoryRewards();
      if(rewards.length){
        const nearest=rewards.sort((leftReward,rightReward)=>(Math.abs(leftReward.x-state.player.x)+Math.abs(leftReward.y-state.player.y))
          -(Math.abs(rightReward.x-state.player.x)+Math.abs(rightReward.y-state.player.y)))[0];
        if(nearest&&isShown(nearest.x,nearest.y)>=.5)pulseAt(nearest.x,nearest.y,"#ffe08b",1.3,"pickup");
        showToast("北极星仍被封印 · 先拾取必经补给",true);
        playTone("blocked");
        updateInventory();
        updateCanvasDescription();
      }else finishLevel();
    }
  }
}

function useHammer(x, y) {
  if (!state || state.phase !== "explore" || state.selected !== "hammer" || state.locked) return;
  const expectedWood = state.level.tutorial?.wood;
  if (state.tutorialPhase === "breakWood" && (expectedWood?.[0] !== x || expectedWood?.[1] !== y)) {
    showToast("请敲击教学标出的关键木墙 · 本次不消耗", true);
    playTone("blocked");
    return;
  }
  const distance = Math.abs(x - state.player.x) + Math.abs(y - state.player.y);
  if (distance !== 1) {
    showToast("砸墙锤只能敲击相邻一格", true);
    shakeCell(x, y);
    playTone("blocked");
    return;
  }
  const tile = state.map[y]?.[x];
  if(tile===TILE.WOOD&&state.mode==="campaign"&&state.levelIndex>=1&&state.levelIndex<=3){
    const pickup=reachablePickup("hammer");
    if(pickup&&!pickup.departureWarned){
      pickup.departureWarned=true;
      state.selected=null;
      state.target=null;
      updateInventory();
      pulseAt(pickup.x,pickup.y,"#efbd62",1.35,"pickup");
      showToast("本区域还有发光锤子 · 先拾取可补充 5 次，避免后续缺锤",true);
      playTone("blocked");
      return;
    }
  }
  if (tile === TILE.STONE || tile === TILE.CRACKED) {
    const cracked=tile===TILE.CRACKED;
    const revealed=isWallMaterialRevealed(x,y);
    state.inventory.hammer--;
    state.usage.hammer++;
    state.toolCost++;
    state.routeCost++;
    state.mistakes++;
    const lostThreeStars=noteRunScoreChange();
    state.selected = null;
    state.target = null;
    state.lastProgress = performance.now();
    updateInventory();
    const failureMessage=revealed
      ? cracked ? "裂纹石墙锤不开 · 需要炸弹 · 锤击次数 -1" : "石墙不可破坏 · 锤击次数 -1"
      : "墙体没有碎裂 · 锤击次数 -1";
    showToast(`${failureMessage}${lostThreeStars?" · 三星已失":""}`,true);
    shakeCell(x, y);
    pulseAt(x, y, cracked&&revealed?"#d59a4d":"#9da9ad", 0.5, "lock");
    playTone("stone");
    scheduleRunSnapshot();
    return;
  }
  if (tile !== TILE.WOOD) {
    showToast("这里没有可破坏的木墙", true);
    playTone("blocked");
    return;
  }
  state.locked = true;
  const activeState = state;
  state.selected = null;
  state.target = null;
  updateInventory();
  scheduleGameTimeout(() => {
    if (state !== activeState || activeState.phase !== "explore") return;
    const oldVisible = new Set(activeState.visible);
    activeState.map[y][x] = TILE.FLOOR;
    activeState.memoryPins.delete(key(x,y));
    activeState.inventory.hammer--;
    activeState.usage.hammer++;
    activeState.breaks++;
    activeState.toolCost++;
    activeState.routeCost++;
    const lostThreeStars=noteRunScoreChange();
    activeState.visible = computeVisible();
    let gained = 0;
    activeState.visible.forEach((cell) => { if (!oldVisible.has(cell)) gained++; });
    activeState.newlyRevealed += gained;
    addWoodParticles(x, y);
    pulseAt(x, y, "#ffd879", 1.4);
    activeState.lastProgress = performance.now();
    activeState.locked = false;
    updateInventory();
    playTone("break");
    if (gained > 0) {
      scheduleGameTimeout(() => playTone("reveal"), 120);
      showToast(`道路接通 · 新点亮 ${gained} 格${lostThreeStars?" · 三星已失":""}`);
    } else {
      showToast(`木墙碎裂，但这里没有接通新区域${lostThreeStars?" · 三星已失":""}`);
    }
    const tutorialWood = state.level.tutorial?.wood;
    if (state.tutorialPhase === "breakWood" && tutorialWood?.[0] === x && tutorialWood?.[1] === y) {
      state.tutorialPhase = "goal";
      showTutorialForState();
    }
    scheduleRunSnapshot();
  }, 120);
}

function useBomb(x, y) {
  if (!state || state.phase !== "explore" || state.selected !== "bomb" || state.locked) return;
  const distance=Math.abs(x-state.player.x)+Math.abs(y-state.player.y);
  if(distance>1||!isFloor(x,y)||!state.visible.has(key(x,y))){
    showToast("炸弹只能放在脚下或相邻的可见地面",true);
    playTone("blocked");
    return;
  }
  const targets=[];
  for(let ty=y-1;ty<=y+1;ty++)for(let tx=x-1;tx<=x+1;tx++){
    if(inBounds(tx,ty)&&isBreakableWall(state.map[ty][tx]))targets.push([tx,ty]);
  }
  const activeState=state;
  state.locked=true;state.selected=null;state.target=null;updateInventory();
  scheduleGameTimeout(()=>{
    if(state!==activeState||activeState.phase!=="explore")return;
    const oldVisible=new Set(activeState.visible);
    const wallKeys=targets.map(([tx,ty])=>key(tx,ty));
    const pinnedWalls=wallKeys.filter((cellKey)=>activeState.memoryPins.has(cellKey));
    const pinnedYield=pinnedWalls.length;
    activeState.blastEvents.push({center:{x,y},walls:wallKeys,pinned:pinnedWalls});
    activeState.maxBlastYield=Math.max(activeState.maxBlastYield,targets.length);
    activeState.maxBlastPinnedYield=Math.max(activeState.maxBlastPinnedYield,pinnedYield);
    targets.forEach(([tx,ty])=>{activeState.map[ty][tx]=TILE.FLOOR;activeState.memoryPins.delete(key(tx,ty));addWoodParticles(tx,ty);pulseAt(tx,ty,"#ff9b55",1.25);});
    activeState.inventory.bomb--;activeState.breaks+=targets.length;activeState.toolCost+=3;activeState.routeCost+=3;
    activeState.usage.bomb++;
    const lostThreeStars=noteRunScoreChange();
    activeState.visible=computeVisible();
    let gained=0;activeState.visible.forEach(cell=>{if(!oldVisible.has(cell))gained++;});
    activeState.newlyRevealed+=gained;activeState.lastProgress=performance.now();activeState.locked=false;updateInventory();
    pulseAt(x,y,"#ffb05d",1.7,"blast");
    playTone("blast");if(gained>0)scheduleGameTimeout(()=>playTone("reveal"),120);
    showToast(targets.length
      ? `爆破 ${targets.length} 面墙体 · 新点亮 ${gained} 格${lostThreeStars?" · 三星已失":""}`
      : `爆炸震响，但没有炸开墙体 · 炸弹已消耗${lostThreeStars?" · 三星已失":""}`,
      !targets.length);
    scheduleRunSnapshot();
  },150);
}

function useFlash(x, y) {
  if (!state || state.phase !== "explore" || state.selected !== "flash" || state.locked) return;
  state.inventory.flash--;
  state.usage.flash++;
  state.toolCost += 3;
  state.infoUses++;
  state.selected = null;
  state.target = null;
  state.lastProgress = performance.now();
  state.flashOverview = true;
  startFlashReveal(25000);
  updateInventory();
  if(state.mode==="seeded"){
    updateLevelUI();
    renderTrack();
  }
  pulseAt(state.player.x, state.player.y, "#fff1b5", 2.5);
  playTone("flash");
  showToast(state.mode==="seeded"
    ? "闪光 25 秒 · 无闪记忆星标本局已失（基础三星不受影响）· 右上角可切局部"
    : "闪光全图观察 · 25 秒内可看清墙体 · 轻点地图先切到大格局部");
  scheduleRunSnapshot();
}

function getTorchCells(targetX, targetY) {
  const rawX = targetX - state.player.x, rawY = targetY - state.player.y;
  if (rawX === 0 && rawY === 0) return [];
  const dx = Math.abs(rawX) >= Math.abs(rawY) ? Math.sign(rawX) : 0;
  const dy = dx === 0 ? Math.sign(rawY) : 0;
  const sideX = -dy, sideY = dx;
  const cells = [[state.player.x, state.player.y]];
  for (let distance = 1; distance <= 12; distance++) {
    const cx = state.player.x + dx * distance, cy = state.player.y + dy * distance;
    if (!inBounds(cx, cy)) break;
    for (let offset = -1; offset <= 1; offset++) {
      const x = cx + sideX * offset, y = cy + sideY * offset;
      if (inBounds(x,y)) cells.push([x,y]);
    }
    if (isWallTile(state.map[cy][cx])) break;
  }
  return cells;
}

function useTorch(x, y) {
  if (!state || state.phase !== "explore" || state.selected !== "torch" || state.locked) return;
  const tutorialTarget = state.level.tutorial?.target;
  if (state.tutorialPhase === "torchAim" && tutorialTarget) {
    const intendedX = tutorialTarget[0] - state.player.x;
    const intendedY = tutorialTarget[1] - state.player.y;
    const selectedX = x - state.player.x;
    const selectedY = y - state.player.y;
    const intendedDirection = Math.abs(intendedX) >= Math.abs(intendedY) ? [Math.sign(intendedX),0] : [0,Math.sign(intendedY)];
    const selectedDirection = Math.abs(selectedX) >= Math.abs(selectedY) ? [Math.sign(selectedX),0] : [0,Math.sign(selectedY)];
    if (selectedDirection[0] !== intendedDirection[0] || selectedDirection[1] !== intendedDirection[1]) {
      showToast("请朝教学标出的方向照射 · 本次不消耗", true);
      playTone("blocked");
      return;
    }
  }
  const cells = getTorchCells(x,y);
  if (!cells.length) {
    showToast("请选择一个照射方向", true);
    playTone("blocked");
    return;
  }
  const uniqueCells=new Map(cells.map(([cellX,cellY])=>[key(cellX,cellY),[cellX,cellY]]));
  const newlyRevealedWalls=[...uniqueCells.values()].filter(([cellX,cellY])=>
    isWallTile(state.map[cellY]?.[cellX])&&!isWallMaterialRevealed(cellX,cellY));
  if(!newlyRevealedWalls.length){
    showToast("这个方向没有新的墙体材质 · 手电未消耗", true);
    playTone("blocked");
    return;
  }
  addFlashlightReveal(cells);
  state.inventory.torch--;
  state.usage.torch++;
  state.toolCost++;
  state.infoUses++;
  state.selected = null;
  state.target = null;
  state.lastProgress = performance.now();
  updateInventory();
  playTone("torch");
  showToast(`手电光带已固定 · 新揭示 ${newlyRevealedWalls.length} 面墙，永久照亮 ${uniqueCells.size} 格`);
  if (state.tutorialPhase === "torchAim") {
    state.tutorialPhase = "torchDone";
    showTutorialForState();
  }
  scheduleRunSnapshot();
}

function useTeleport(x, y) {
  if (!state || state.phase !== "explore" || state.selected !== "teleport" || state.locked || state.spiritMode) return;
  const distance = Math.abs(x - state.player.x) + Math.abs(y - state.player.y);
  if (distance < 1 || distance > 10) {
    showToast("10格瞬移卡只能到达曼哈顿距离 1—10 格", true);
    if (inBounds(x,y)) shakeCell(x,y);
    playTone("blocked");
    return;
  }
  const tile = state.map[y]?.[x];
  if (isWallTile(tile)) {
    showToast("目的地是墙，无法瞬移", true);
    shakeCell(x,y);
    pulseAt(x,y,"#93a0a5",.55,"lock");
    playTone("blocked");
    return;
  }
  if (!inBounds(x,y) || !isFloor(x,y)) {
    showToast("这里不能作为瞬移目的地", true);
    playTone("blocked");
    return;
  }
  const fromX=state.player.x,fromY=state.player.y;
  resetCamera();
  state.inventory.teleport--;
  state.usage.teleport++;
  state.toolCost+=5;
  state.routeCost+=5;
  const lostThreeStars=noteRunScoreChange();
  state.selected=null;
  state.target=null;
  state.player.x=x;
  state.player.y=y;
  state.player.drawX=x;
  state.player.drawY=y;
  if(x!==fromX)state.player.facing=Math.sign(x-fromX);
  state.steps++;
  state.lastProgress=performance.now();
  state.visible=computeVisible();
  pulseAt(fromX,fromY,"#78dce5",1.25);
  pulseAt(x,y,"#d7ffff",1.6);
  updateInventory();
  playTone("teleport");
  showToast(`瞬移完成 · 跨越 ${distance} 格${lostThreeStars?" · 三星已失":""}`);
  onArrive();
  scheduleRunSnapshot();
}

function useSelected(x,y) {
  if(state?.selected==="hammer")useHammer(x,y);
  else if(state?.selected==="bomb")useBomb(x,y);
  else if(state?.selected==="flash")useFlash(x,y);
  else if(state?.selected==="torch")useTorch(x,y);
  else if(state?.selected==="teleport")useTeleport(x,y);
}

function matchesRequirement(value, requirement = {}) {
  if (requirement.exact != null && value !== requirement.exact) return false;
  if (requirement.min != null && value < requirement.min) return false;
  if (requirement.max != null && value > requirement.max) return false;
  return true;
}

function challengeRequirementText(value, requirement = {}) {
  if (requirement.exact != null) return `${value} / ${requirement.exact}`;
  if (requirement.min != null && value < requirement.min) return `${value} / 至少 ${requirement.min}`;
  if (requirement.max != null && value > requirement.max) return `${value} / 最多 ${requirement.max}`;
  return String(value);
}

function challengeFailures(stars) {
  const requirements = state.level.challenge?.requirements;
  if (!requirements) return [];
  const failures = [];
  const check = (label,value,requirement) => {
    if (requirement && !matchesRequirement(value,requirement)) {
      failures.push(`${label} ${challengeRequirementText(value,requirement)}`);
    }
  };
  check("星级",stars,requirements.stars);
  check("步数",state.steps,requirements.steps);
  check("误敲",state.mistakes,requirements.mistakes);
  check("路径成本",state.routeCost,requirements.routeCost);
  check("星屑",state.shardsCollected,requirements.shards);
  check("记忆钉",Math.max(state.memoryPinsUsed||0,state.memoryPins.size),requirements.pins);
  check("单次爆破破墙",state.maxBlastYield||0,requirements.maxBlastYield);
  check("同次爆破解决记忆钉",state.maxBlastPinnedYield||0,requirements.maxBlastPinnedYield);
  check("提前触星",state.prematureStarTouches,requirements.prematureStarTouches);
  const toolNames={hammer:"锤击",bomb:"炸弹",flash:"闪光",spirit:"灵魂",torch:"手电",teleport:"瞬移"};
  for (const [type, requirement] of Object.entries(requirements.usage || {})) {
    check(`${toolNames[type]||type}使用`,state.usage[type] ?? 0,requirement);
  }
  const inventoryNames={hammer:"剩余锤击",bomb:"剩余炸弹",flash:"剩余闪光",spirit:"剩余灵魂卡",torch:"剩余手电",teleport:"剩余瞬移卡"};
  for (const [type, requirement] of Object.entries(requirements.inventory || {})) {
    check(inventoryNames[type]||`剩余${type}`,state.inventory[type] ?? 0,requirement);
  }
  return failures;
}

function challengeAchieved(stars) {
  return Boolean(state.level.challenge?.requirements)&&challengeFailures(stars).length===0;
}

function adoptNewerStoredSave(){
  const latest=readStoredSave();
  const shouldAdopt=Boolean(latest&&(latest.generation>save.generation||
    (latest.generation===save.generation&&latest.campaignId!==save.campaignId)));
  if(!shouldAdopt)return false;
  clearEntrySnapshots();
  save=latest;
  syncSettings();
  renderTrack();
  syncIntroProgressControls();
  return true;
}

function stateMatchesCurrentSave(){
  return Boolean(state&&(state.mode!=="campaign"||(state.saveGeneration===save.generation&&state.saveCampaignId===save.campaignId)));
}

function completionRecoveryMessage(){
  return state?.completionCheckpointAvailable
    ? "已保留最近一次安全断点，刷新后可回到可恢复位置"
    : "浏览器禁止保存，且无法建立安全断点；请勿关闭页面";
}

function completionRetryMessage(){
  return state?.completionCheckpointAvailable
    ? "结算仍无法保存 · 已保留安全断点，请稍后重试"
    : "结算仍无法保存 · 浏览器禁止保存，请勿关闭页面";
}

function confirmUnsavedCompletionExit(action){
  const recovery=state?.completionCheckpointAvailable
    ? "最近一次安全断点仍会保留；刷新后可回到可恢复位置。"
    : "当前没有可恢复断点；关闭或刷新页面会丢失本次结果。";
  return confirmWithGamePause(`本机仍无法保存这次结算。${recovery}\n\n确定本次不保存，仍${action}吗？`);
}

function retryCompletionPersistence(){
  if(!state?.complete||!state.completionPersistFailed)return true;
  if(state.mode==="daily"){
    dailySave=mergeDailySaves(dailySave,readDailySave());
    dailySave=writeDailySave(dailySave);
    if(!lastDailyWriteSucceeded)return false;
    state.completionPersistFailed=false;
    state.completionCheckpointAvailable=false;
    state.volatileContinuation=false;
    clearDailyRunSnapshot();
    return true;
  }
  if(state.mode!=="campaign"||state.saveConflict||!stateMatchesCurrentSave())return false;
  const nextIndex=!state.practice&&state.levelIndex<LEVELS.length-1?state.levelIndex+1:null;
  const wrote=persist({entryIndices:nextIndex===null?[]:[nextIndex]});
  if(!wrote||state.saveConflict||!stateMatchesCurrentSave())return false;
  state.completionPersistFailed=false;
  state.completionCheckpointAvailable=false;
  state.volatileContinuation=false;
  clearRunSnapshot();
  return true;
}

function finishLevel() {
  if (state.complete) return;
  if (remainingShards().length) {
    showToast(`先收集剩余 ${remainingShards().length} 枚星屑`,true);
    return;
  }
  if(remainingMandatoryRewards().length){
    showToast("先拾取本关必经补给，再前往北极星",true);
    return;
  }
  if(state.autoRoute)clearAutoRoute(state.autoRoute);
  state.moveDestination=null;
  const runScore=currentRunScore(state);
  if(state.mode==="seeded"){
    state.complete=true;state.phase="complete";state.locked=true;
    const stars=runScore.stars;
    state.seededMemoryPerfect=stars===3&&state.mistakes===0
      &&state.routeCost===state.seeded.optimal.cost&&(state.usage.flash||0)===0;
    pulseAt(state.star[0],state.star[1],"#ffe395",2.4,"star");
    playTone("complete");
    const activeState=state;
    scheduleGameTimeout(()=>{if(state===activeState)showResults(stars);},700);
    return;
  }
  if(state.mode==="daily"){
    state.completionCheckpointAvailable=flushDailyRunSnapshot({queuedOnly:true})
      ||Boolean(readDailyRunSnapshot(state.daily.date));
    state.complete=true;state.phase="complete";state.locked=true;
    const target=state.daily.optimalCost;
    const stars=runScore.stars;
    const contractUses=state.usage[state.daily.contract.tool]||0;
    state.dailyRoutePerfect=stars===3&&state.mistakes===0&&state.routeCost===target;
    state.dailyPerfect=state.dailyRoutePerfect&&contractUses===1;
    state.challengeSuccess=state.dailyPerfect;
    state.challengeEarnedBefore=Boolean(dailySave.entries[state.daily.date]?.contractPerfect);
    state.dailyResult=persistDailyScore(state.daily.date,{
      stars,routeCost:state.routeCost,mistakes:state.mistakes,steps:state.steps,
      perfect:state.dailyRoutePerfect,contractPerfect:state.dailyPerfect,
    });
    state.completionPersistFailed=!(state.dailyResult&&lastDailyWriteSucceeded);
    if(!state.completionPersistFailed){
      state.volatileContinuation=false;
      clearDailyRunSnapshot();
    }
    pulseAt(state.star[0],state.star[1],"#ffe395",2.4,"star");
    playTone("complete");
    const activeState=state;
    scheduleGameTimeout(()=>{if(state===activeState)showResults(stars);},700);
    return;
  }
  state.completionCheckpointAvailable=flushRunSnapshot({queuedOnly:true})||Boolean(readRunSnapshot());
  state.complete = true;
  state.phase = "complete";
  state.locked = true;
  adoptNewerStoredSave();
  state.saveConflict=!stateMatchesCurrentSave();
  const stars=runScore.stars;
  state.challengeEarnedBefore = Boolean(save.badges?.[state.levelIndex]);
  state.challengeSuccess = !state.saveConflict && challengeAchieved(stars);
  if(!state.saveConflict){
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length - 1, state.levelIndex + 1));
    if (!save.completed.includes(state.levelIndex)) save.completed.push(state.levelIndex);
    save.stars[state.levelIndex] = Math.max(save.stars[state.levelIndex] || 0, stars);
    if (state.challengeSuccess) save.badges[state.levelIndex] = true;
    let completionPersisted=persist();
    if (!state.practice && state.levelIndex < LEVELS.length - 1) {
      const entryAccepted=setNextEntry(state.levelIndex + 1, grantSpiritForLevelEntry(state.inventory));
      completionPersisted=entryAccepted&&lastSaveWriteSucceeded;
    }
    if(state.saveConflict||!stateMatchesCurrentSave()){
      state.saveConflict=true;
      state.challengeSuccess=false;
      clearRunSnapshot();
    }else{
      state.completionPersistFailed=!completionPersisted;
      if(!state.completionPersistFailed){
        state.volatileContinuation=false;
        clearRunSnapshot();
      }
    }
  }else{
    clearRunSnapshot();
  }
  pulseAt(state.star[0], state.star[1], "#ffe395", 2.4, "star");
  playTone("complete");
  const activeState = state;
  scheduleGameTimeout(() => { if (state === activeState) showResults(stars); }, 700);
}

function showResults(stars) {
  state.resultStars=boundedInteger(stars,1,3);
  const resultShareStatus=document.getElementById("resultShareStatus");
  if(resultShareStatus)resultShareStatus.textContent="";
  const resultMainButton=document.getElementById("resultMainButton");
  const replayButton=document.getElementById("replayButton");
  resultMainButton?.classList.toggle("hidden",state.mode!=="seeded");
  if(replayButton)replayButton.textContent=state.mode==="seeded"?"同码再试":"再试一次";
  if(state.mode==="seeded"){
    const difficulty=seededPresetName(state.seeded.preset);
    document.getElementById("resultKicker").textContent="种子星图完成";
    document.getElementById("resultTitle").textContent=`${difficulty} · ${state.seeded.code}`;
    const seededStars=document.getElementById("resultStars");
    seededStars.setAttribute?.("aria-label",`种子星图获得 ${stars} 颗星，满分 3 星`);
    seededStars.innerHTML=[0,1,2].map((index)=>`<span aria-hidden="true" class="${index<stars?"":"off"}">★</span>`).join("");
    const memoryPerfect=Boolean(state.seededMemoryPerfect);
    const memoryFailures=[];
    if(stars!==3)memoryFailures.push("需三星");
    if(state.mistakes!==0)memoryFailures.push("需零误敲");
    if(state.routeCost!==state.seeded.optimal.cost)memoryFailures.push("需精确成本");
    if((state.usage.flash||0)!==0)memoryFailures.push("需零闪光");
    const memoryRunSummary=`本局 ${stars}/3 星 · 成本 ${state.routeCost}/${state.seeded.optimal.cost} · 误敲 ${state.mistakes} · 闪光 ${state.usage.flash||0}`;
    const challengePanel=document.getElementById("challengeResult");
    challengePanel.classList.remove("hidden");
    challengePanel.classList.toggle("earned",memoryPerfect);
    document.getElementById("challengeResultLabel").textContent="本局记忆星标";
    document.getElementById("challengeResultName").textContent=memoryPerfect
      ? "✓ 无闪记忆 · 本局点亮"
      : "○ 无闪记忆 · 本局未点亮";
    document.getElementById("challengeResultDetail").textContent=memoryPerfect
      ? `${memoryRunSummary}。星标仅为本局荣誉，不长期保存。`
      : `${memoryRunSummary}。未满足：${memoryFailures.join("、")}。星标仅为本局荣誉，不长期保存；闪光不影响基础星级。`;
    document.getElementById("statBreaks").textContent=state.toolCost;
    document.getElementById("statRouteCost").textContent=state.routeCost;
    document.getElementById("statSteps").textContent=state.steps;
    document.getElementById("statReveal").textContent=state.newlyRevealed;
    document.getElementById("statHammer").textContent=`${state.inventory.hammer} / 0 / ${state.inventory.flash}`;
    document.getElementById("statUtility").textContent="0 / 0 / 0";
    document.getElementById("resultNote").textContent=`挑战码 ${state.seeded.canonical} · 最优路径成本 ${state.seeded.optimal.cost}。${memoryPerfect?"无闪记忆已在本局点亮。":"无闪记忆本局未点亮，可同码再试。"}星标不长期保存，本局独立计星，不改动主线与每日成绩。`;
    document.getElementById("resultShareButton").innerHTML='分享挑战成绩 <span aria-hidden="true">↗</span>';
    document.getElementById("nextButton").innerHTML='换一张 <span>↻</span>';
    const resultBody=completeModal.querySelector?.(".result-scroll-body");
    if(resultBody)resultBody.scrollTop=0;
    openModal(completeModal,"#resultTitle","result");
    renderTrack();
    return;
  }
  if(state.mode==="daily"){
    const today=dailyIsToday(state.daily.date),dayWord=today?"今日":"本日";
    document.getElementById("resultKicker").textContent=today?"今日迷局完成":"星历回顾完成";
    document.getElementById("resultTitle").textContent=`${state.level.name} · ${formatDailyDate(state.daily.date)}`;
    const dailyStars=document.getElementById("resultStars");
    dailyStars.setAttribute?.("aria-label",`${today?"今日迷局":"星历回顾"}获得 ${stars} 颗星，满分 3 星`);
    dailyStars.innerHTML=[0,1,2].map((index)=>`<span aria-hidden="true" class="${index<stars?"":"off"}">★</span>`).join("");
    const challengePanel=document.getElementById("challengeResult");
    challengePanel.classList.remove("hidden");
    challengePanel.classList.toggle("earned",state.dailyPerfect);
    const challengeLabel=document.getElementById("challengeResultLabel");
    if(challengeLabel)challengeLabel.textContent=`${dayWord}契约`;
    const contractUses=state.usage[state.daily.contract.tool]||0;
    const contractToolName=dailyToolName(state.daily.contract.tool);
    document.getElementById("challengeResultName").textContent=state.dailyPerfect
      ? `✓ ${dayWord}契约完美`
      : state.dailyRoutePerfect
      ? `○ 路线完美 · 契约未完成`
      : contractUses===1
      ? `○ 契约已使用 · 路线尚未完美`
      : `○ ${dayWord}契约 · 尚未完成`;
    document.getElementById("challengeResultDetail").textContent=state.dailyPerfect
      ? `已有效使用 1 次${contractToolName}，完成「${state.daily.contract.name}」，零误敲，并以最优路径成本 ${state.daily.optimalCost} 抵达星星。`
      : `需要三星、零误敲、路径成本恰好为 ${state.daily.optimalCost}，并有效使用 1 次${contractToolName}以完成「${state.daily.contract.name}」（本次 ${contractUses} 次）。`;
    document.getElementById("statBreaks").textContent=state.toolCost;
    document.getElementById("statRouteCost").textContent=state.routeCost;
    document.getElementById("statSteps").textContent=state.steps;
    document.getElementById("statReveal").textContent=state.newlyRevealed;
    document.getElementById("statHammer").textContent=`${state.inventory.hammer} / 0 / ${state.inventory.flash}`;
    document.getElementById("statUtility").textContent=`${state.inventory.spirit} / ${state.inventory.torch} / 0`;
    const best=state.dailyResult?.best||dailySave.entries[state.daily.date];
    const bestText=best?`${dayWord}最佳：${"★".repeat(best.stars)} · 成本 ${best.routeCost} · 误敲 ${best.mistakes} · ${best.steps} 步。`:"";
    const contractRecordText=best?.contractPerfect&&!state.dailyResult?.contractEarned
      ? `${dayWord}契约完美已点亮。`:"";
    const calendar=recentDailyStats();
    const calendarText=` 七日星历：已点亮 ${calendar.completed} / 7 · 契约完美 ${calendar.perfect} / 7。`;
    const resultLead=state.dailyResult?.contractEarned
      ? `首次达成${dayWord}契约完美。${state.dailyResult?.improved?`同时刷新${dayWord}最佳。`:""}`
      : state.dailyResult?.improved?`已刷新${dayWord}最佳。`:"成绩已记录。";
    document.getElementById("resultNote").textContent=!state.completionPersistFailed
      ? `${resultLead}${bestText}${contractRecordText}${calendarText}`
      : `本机无法保存${dayWord}成绩；${completionRecoveryMessage()}。本次仍可分享。${bestText}${calendarText}`;
    const shareButton=document.getElementById("resultShareButton");
    if(shareButton)shareButton.innerHTML=`分享${dayWord}成绩 <span aria-hidden="true">↗</span>`;
    document.getElementById("nextButton").innerHTML=state.completionPersistFailed
      ? '重试保存后返回主线 <span>↻</span>'
      : '返回主线 <span>↩</span>';
    const resultBody=completeModal.querySelector?.(".result-scroll-body");
    if(resultBody)resultBody.scrollTop=0;
    openModal(completeModal,"#resultTitle","result");
    renderTrack();
    return;
  }
  const challengeLabel=document.getElementById("challengeResultLabel");
  if(challengeLabel)challengeLabel.textContent="三星印记";
  const resultShareButton=document.getElementById("resultShareButton");
  if(resultShareButton)resultShareButton.innerHTML='分享本关成绩 <span aria-hidden="true">↗</span>';
  const campaignFinal=state.levelIndex===LEVELS.length-1;
  const firstChapterFinal=LEVELS.length>15&&state.levelIndex===14;
  document.getElementById("resultKicker").textContent = campaignFinal ? "全篇完成" : firstChapterFinal ? "前篇完成" : "关卡完成";
  document.getElementById("resultTitle").textContent = state.level.name;
  const resultStars = document.getElementById("resultStars");
  resultStars.setAttribute?.("aria-label", `本关获得 ${stars} 颗星，满分 3 星`);
  resultStars.innerHTML = [0,1,2].map((i) => `<span aria-hidden="true" class="${i < stars ? "" : "off"}">★</span>`).join("");
  const challengePanel = document.getElementById("challengeResult");
  const challenge = state.level.challenge;
  challengePanel.classList.toggle("hidden", !challenge);
  if (challenge) {
    const completionUnsaved=state.completionPersistFailed&&!state.saveConflict;
    const earned = state.challengeEarnedBefore || (state.challengeSuccess&&!completionUnsaved);
    challengePanel.classList.toggle("earned", earned);
    document.getElementById("challengeResultName").textContent = state.saveConflict||completionUnsaved
      ? `○ ${challenge.name} · 本次未保存`
      : state.challengeSuccess
      ? `✓ ${challenge.name}${state.challengeEarnedBefore ? " · 再次达成" : " · 新印记"}`
      : state.challengeEarnedBefore ? `✓ ${challenge.name} · 已取得` : `○ ${challenge.name} · 尚未达成`;
    const failureDetail = !state.challengeSuccess&&!state.saveConflict
      ? ` 未达成：${challengeFailures(stars).join("；")}。`
      : "";
    const conflictDetail = state.saveConflict ? " 另一标签页已更换存档，本次旧关卡结果未写入。"
      : completionUnsaved ? ` 本机暂时无法写入结算，${completionRecoveryMessage()}。` : "";
    document.getElementById("challengeResultDetail").textContent = `${challenge.description}${failureDetail}${conflictDetail}${!state.challengeSuccess && state.challengeEarnedBefore ? " 本次未达成，但印记会永久保留。" : ""}`;
  }
  document.getElementById("statBreaks").textContent = state.toolCost;
  document.getElementById("statRouteCost").textContent = state.routeCost;
  document.getElementById("statSteps").textContent = state.steps;
  document.getElementById("statReveal").textContent = state.newlyRevealed;
  document.getElementById("statHammer").textContent = `${state.inventory.hammer} / ${state.inventory.bomb} / ${state.inventory.flash}`;
  document.getElementById("statUtility").textContent = `${state.inventory.spirit} / ${state.inventory.torch} / ${state.inventory.teleport}`;
  const campaignStars=Object.values(save.stars).reduce((sum,value)=>sum+boundedInteger(value,0,3),0);
  const campaignBadges=Object.values(save.badges||{}).filter(Boolean).length;
  document.getElementById("resultNote").textContent = state.saveConflict
    ? "另一标签页已重置或导入存档，本次旧关卡结果未保存；请回到当前进度后重试。"
    : state.completionPersistFailed
    ? `本机暂时无法保存本关结算；${completionRecoveryMessage()}。`
    : campaignFinal
    ? `${LEVELS.length} 段星路全部亮起。本次剩余 ${state.inventory.hammer} 次锤击、${state.inventory.bomb} 枚炸弹（标准目标 11 锤 / 1 炸弹）；总计 ${campaignStars} / ${LEVELS.length*3} 星、${campaignBadges} / ${LEVELS.filter(level=>level.challenge).length} 枚印记。`
    : firstChapterFinal
    ? `失光迷宫十五段星路已经亮起，余烬深处出现了新的裂纹、星屑与记忆钉。带着剩余 ${state.inventory.hammer} 次锤击继续前进。`
    : state.practice ? `练习回放不会覆盖主线物资。${stars===3?state.level.lesson:"再观察一次，或许能减少无效消耗。"}`
    : stars === 3 ? state.level.lesson : "已经抵达星星。再观察一次，或许能减少无效消耗。";
  const nextButton = document.getElementById("nextButton");
  nextButton.innerHTML = state.saveConflict ? "回到当前进度 <span>→</span>"
    : state.completionPersistFailed ? "重试保存后继续 <span>↻</span>"
    : campaignFinal ? "回到第一关 <span>↺</span>" : firstChapterFinal ? "进入余烬星路 <span>→</span>" : "下一关 <span>→</span>";
  const resultBody=completeModal.querySelector?.(".result-scroll-body");
  if(resultBody)resultBody.scrollTop=0;
  openModal(completeModal, "#resultTitle", "result");
  renderTrack();
}

function restartLevel() {
  if (!state) return;
  let continueUnsaved=false;
  if(state.mode==="campaign"){
    adoptNewerStoredSave();
    if(state.saveConflict||!stateMatchesCurrentSave()){
      const current=boundedInteger(save.lastLevel,0,save.unlocked);
      showToast("已回到当前存档进度");
      loadLevel(current,getEntryInventory(current),{volatileContinuation:false});
      return;
    }
  }
  if(state.complete&&state.completionPersistFailed&&!retryCompletionPersistence()){
    if(!confirmUnsavedCompletionExit(state.mode==="daily"?"重玩本日迷局":"重玩本关")){
      showToast(completionRetryMessage(),true);
      return;
    }
    continueUnsaved=true;
  }
  if(state.mode==="seeded"){
    const {code,preset}=state.seeded;
    loadSeededChallenge(code,preset,{updateUrl:true});
    showToast("已按同一挑战码恢复入口状态");
    return;
  }
  if(state.mode==="daily"){
    const date=state.daily.date;
    const carryVolatile=continueUnsaved||Boolean(!state.complete&&state.volatileContinuation);
    showToast(dailyIsToday(date)?"已恢复今日迷局入口状态":"已恢复本日回顾题入口状态");
    loadDailyChallenge(date,{preserveRunSnapshot:carryVolatile,volatileContinuation:carryVolatile});
    return;
  }
  const index = state.levelIndex;
  const entry = state.entryInventory;
  const carryVolatile=continueUnsaved||Boolean(!state.complete&&state.volatileContinuation);
  const guideFirstLevel=index===0&&Boolean(state.tutorialPhase);
  showToast("已恢复本关入口状态");
  loadLevel(index,entry,{preserveRunSnapshot:carryVolatile,volatileContinuation:carryVolatile,guideFirstLevel});
}

function showTutorialForState() {
  if (!state || state.mode!=="campaign" || ![0,1].includes(state.levelIndex) || state.phase !== "explore"
    || (state.spiritMode && state.tutorialPhase==="torchSelect")) {
    tutorialBubble.classList.add("hidden");
    hammerSlot.classList.remove("tutorial-focus");
    flashSlot.classList.remove("tutorial-focus");
    spiritSlot.classList.remove("tutorial-focus");
    torchSlot.classList.remove("tutorial-focus");
    spiritReturnButton.classList.remove("tutorial-focus");
    if (state) updateInventory();
    revealDeferredUpdateBanner();
    return;
  }
  const spiritStep=state.tutorialSpiritStep;
  const atSpawn=state.soul?.x===state.level.start[0]&&state.soul?.y===state.level.start[1];
  const spiritHint=spiritStep===0&&atSpawn
    ? "灵魂可以穿墙。点你右边亮起的石墙，向右移动一格。"
    : spiritStep===1 ? "你正在石墙里。点下一格金框，穿过石墙。"
    : spiritStep===FIRST_LEVEL_SPIRIT_ROUTE.length ? "星门就在前方。点金色星标，飞到那里。看不到星标时，可以拖动迷宫。"
    : "跟着金框往右上方探路，找到下一层入口。记住途中的木墙位置，回到身体后能用锤子敲开。看不到金框时，可以拖动迷宫。";
  const text = {
    spiritUse: ["01", "身体已回到起点。点击背包里的「灵魂出窍」，继续找星门。"],
    spiritExplore: ["01", spiritHint],
    spiritReturn: ["02", "星门已经找到。点「返回身体」，回到起点。"],
    move: ["03", "现在是身体状态。点上方发光的锤子，走过去拾取。"],
    selectWood: ["04", "你已拾取锤子，可敲击 5 次。点背包里的「砸墙锤」。"],
    breakWood: ["05", "点金框标出的木墙。你会自动走近，再敲开它。"],
    goal: ["06", "木墙开了。捡起路上的锤子，继续走向刚才的星门。"],
    torchSelect: ["01", "第二关开始教学手电筒。点击背包中的手电筒图标。"],
    torchAim: ["02", "点击标出的墙体方向，消耗 1 个手电筒并留下永久光带。"],
    torchDone: ["03", "光带中的墙会一直显示真实材质。沿照亮信息继续前进。"],
  }[state.tutorialPhase];
  if (!text) {
    tutorialBubble.classList.add("hidden");
    updateInventory();
    revealDeferredUpdateBanner();
    return;
  }
  tutorialStep.textContent = text[0];
  tutorialText.textContent = text[1];
  tutorialBubble.classList.remove("hidden");
  deferVisibleUpdateBanner();
  document.getElementById("directionIndicator")?.classList.add("hidden");
  if(announcedTutorialState!==state||announcedTutorialText!==text[1]){
    announcedTutorialState=state;
    announcedTutorialText=text[1];
    document.getElementById("gameStatus").textContent=`教学第 ${text[0]} 步：${text[1]}`;
  }
  hammerSlot.classList.toggle("tutorial-focus", state.tutorialPhase === "selectWood");
  flashSlot.classList.remove("tutorial-focus");
  spiritSlot.classList.toggle("tutorial-focus", state.tutorialPhase === "spiritUse");
  torchSlot.classList.toggle("tutorial-focus", state.tutorialPhase === "torchSelect");
  spiritReturnButton.classList.toggle("tutorial-focus", state.tutorialPhase === "spiritReturn");
  const tutorialTarget=currentTutorialTarget();
  if (tutorialTarget && state.tutorialPhase !== "spiritExplore") {
    pulseAt(tutorialTarget[0], tutorialTarget[1], "#ffe08b", 1.35);
  }
  updateInventory();
}

function reachablePickup(type=null) {
  return state.items.find((candidate) => !candidate.picked&&(!type||candidate.type===type)
    && state.visible.has(key(candidate.x,candidate.y))
    && findVisiblePath(candidate.x,candidate.y).length);
}

function pulsePickupHint() {
  const reachable=state.items.filter((candidate) => !candidate.picked
    && state.visible.has(key(candidate.x,candidate.y))
    && findVisiblePath(candidate.x,candidate.y).length);
  const item=reachable.find((candidate)=>candidate.mandatory)||reachable[0];
  if (item) pulseAt(item.x, item.y, "#efbd62", 1.2);
}

function pulseGuidanceHint(){
  const origin=state.spiritMode&&state.soul?state.soul:state.player;
  const shard=remainingShards().filter((candidate)=>isShown(candidate.x,candidate.y)>=.5).sort((left,right)=>
    (Math.abs(left.x-origin.x)+Math.abs(left.y-origin.y))-(Math.abs(right.x-origin.x)+Math.abs(right.y-origin.y)))[0];
  if(shard)pulseAt(shard.x,shard.y,"#ffe08b",1.35,"shard");
  else pulsePickupHint();
}

function dismissTransientToast() {
  const toast=document.getElementById("toast");
  toast.classList.remove("show","error");
  clearTimeout(toastTimer);
  toastTimer=0;
}

function showToast(message, error = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  document.getElementById("gameStatus").textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function pulseAt(x, y, color, power = 1, type = "pulse") {
  state.pulses.push({ x, y, color, power, type, created: performance.now() });
}

function pulseLifetime(pulse) {
  return pulse?.type==="star"?1900:pulse?.type==="blast"?1100:900;
}

function shakeCell(x, y) {
  if (!inBounds(x, y)) return;
  state.pulses.push({ x, y, color: "#c48962", power: .5, type: "shake", created: performance.now() });
}

function addWoodParticles(x, y) {
  const count = reducedMotionQuery?.matches ? 0 : isCompactViewport() ? 9 : 15;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / Math.max(1,count)) + Math.random() * .4;
    const speed = .5 + Math.random() * 1.4;
    state.particles.push({ x: x + .5, y: y + .5, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, size: .05 + Math.random() * .07 });
  }
}

function playTone(type) {
  if (!save.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume?.().catch?.(() => {});
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    const tones = {
      step: [160, .025, .018], blocked: [90, .055, .035], pickup: [520, .16, .06], stone: [115, .12, .05],
      break: [145, .16, .085], blast: [72, .32, .11], reveal: [420, .42, .055], flash: [760, .32, .05], torch: [540, .28, .035], teleport: [470, .3, .045], spirit: [610, .38, .04], spiritStep: [330, .045, .016], fade: [220, .35, .025], complete: [660, .65, .07],
    };
    const [freq, duration, volume] = tones[type] || tones.step;
    const osc = audioContext.createOscillator();
    osc.type = type === "blast" ? "sawtooth" : type === "break" || type === "stone" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(freq, now);
    if (type === "complete") osc.frequency.exponentialRampToValueAtTime(990, now + duration);
    if (type === "reveal") osc.frequency.exponentialRampToValueAtTime(630, now + duration);
    if (type === "flash") osc.frequency.exponentialRampToValueAtTime(1040, now + duration);
    if (type === "teleport") osc.frequency.exponentialRampToValueAtTime(940, now + duration);
    if (type === "spirit") osc.frequency.exponentialRampToValueAtTime(410, now + duration);
    if (type === "blast") osc.frequency.exponentialRampToValueAtTime(52, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration);
  } catch (_) {}
}

function flashCameraToggleAvailable(now=performance.now()) {
  return Boolean(state&&isCompactViewport()&&state.phase==="explore"&&state.flashEnds>now
    &&!state.spiritMode&&!state.selected&&!currentTutorialTarget());
}

function updateCameraResetButton(now=performance.now()) {
  const button=document.getElementById("cameraResetButton");
  const flashToggle=flashCameraToggleAvailable(now);
  const zoomEnabled=Boolean(state?.phase==="explore"&&!state.complete&&!(flashToggle&&state.flashOverview!==false));
  if(zoomInButton)zoomInButton.disabled=!zoomEnabled||state.cameraZoom===MAP_ZOOM_LEVELS.length-1;
  if(zoomOutButton)zoomOutButton.disabled=!zoomEnabled||state.cameraZoom===0;
  button.classList.toggle("mode-toggle",flashToggle);
  if(flashToggle){
    const showingOverview=state.flashOverview!==false;
    button.classList.remove("hidden");
    button.textContent=showingOverview?"局":"全";
    const label=showingOverview?"切到大格局部操作":"切到闪光全图观察";
    button.setAttribute("aria-label",label);
    button.title=label;
    return;
  }
  const isPanned = Boolean(state && (Math.abs(state.cameraPan.x) > 1 || Math.abs(state.cameraPan.y) > 1));
  let soulOffscreen = false;
  if(state?.spiritMode&&state.soul){
    const layout=getLayout(now);
    const x=layout.ox+(state.soul.drawX+.5)*layout.cell;
    const y=layout.oy+(state.soul.drawY+.5)*layout.cell;
    soulOffscreen=x<0||y<0||x>canvas.width||y>canvas.height;
  }
  button.classList.toggle("hidden", !isPanned&&!soulOffscreen);
  button.textContent="◎";
  button.setAttribute("aria-label",state?.spiritMode?"回到灵魂所在光亮区域":"回到当前光亮区域");
  button.title=state?.spiritMode?"回到灵魂所在光亮区域":"回到当前光亮区域";
}

function setFlashCameraOverview(showOverview,{announce=true}={}) {
  if(!flashCameraToggleAvailable())return false;
  const next=Boolean(showOverview);
  if((state.flashOverview!==false)===next)return false;
  state.flashOverview=next;
  state.cameraPan.x=0;
  state.cameraPan.y=0;
  updateCameraResetButton();
  updateCanvasDescription();
  if(announce)showToast(next
    ? "闪光全图观察 · 轻点地图或右上角“局”可放大操作"
    : "已切到大格局部操作 · 请再点目标格");
  return true;
}

function handleCameraControl() {
  if(flashCameraToggleAvailable()){
    setFlashCameraOverview(state.flashOverview===false);
    return;
  }
  resetCamera();
}

function resetCamera() {
  if (!state) return;
  state.cameraPan.x = 0;
  state.cameraPan.y = 0;
  if(state.spiritMode&&state.soul){
    state.spiritCameraAnchor={x:state.soul.drawX,y:state.soul.drawY};
  }
  updateCameraResetButton();
}

function adjustMapZoom(direction) {
  const now=performance.now();
  if(state?.phase!=="explore"||state.complete||
    (flashCameraToggleAvailable(now)&&state.flashOverview!==false))return false;
  const index=Math.max(0,Math.min(MAP_ZOOM_LEVELS.length-1,state.cameraZoom+direction));
  if(index===state.cameraZoom)return false;
  clearCanvasPointerGesture();
  const before=getLayout(now);
  const focus=state.spiritMode?state.soul:state.player;
  const focusX=before.ox+(focus.drawX+.5)*before.cell;
  const focusY=before.oy+(focus.drawY+.5)*before.cell;
  const focusVisible=focusX>=0&&focusX<=canvas.width&&focusY>=0&&focusY<=canvas.height;
  const screenX=focusVisible?focusX:canvas.width/2;
  const screenY=focusVisible?focusY:canvas.height/2;
  const worldX=(screenX-before.ox)/before.cell;
  const worldY=(screenY-before.oy)/before.cell;
  state.cameraZoom=index;
  const after=getLayout(now);
  state.cameraPan.x=(after.effectivePanX||0)+screenX-worldX*after.cell-after.ox;
  state.cameraPan.y=(after.effectivePanY||0)+screenY-worldY*after.cell-after.oy;
  clampCameraPanToViewport();
  state.lastProgress=now;
  updateCameraResetButton(now);
  render(now);
  return true;
}

function cameraRegionBounds(cells,focus,width=state.map[0].length,height=state.map.length) {
  const fallbackX=Math.max(0,Math.min(width-1,Math.floor(Number(focus?.x)||0)));
  const fallbackY=Math.max(0,Math.min(height-1,Math.floor(Number(focus?.y)||0)));
  let minX=fallbackX,maxX=fallbackX,minY=fallbackY,maxY=fallbackY,found=false;
  if(cells&&typeof cells[Symbol.iterator]==="function")for(const cellKey of cells){
    if(typeof cellKey!=="string")continue;
    const separator=cellKey.indexOf(",");
    if(separator<1)continue;
    const x=Number(cellKey.slice(0,separator)),y=Number(cellKey.slice(separator+1));
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)continue;
    if(!found){minX=maxX=x;minY=maxY=y;found=true;}
    else{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  }
  minX=Math.max(0,minX-1);maxX=Math.min(width-1,maxX+1);
  minY=Math.max(0,minY-1);maxY=Math.min(height-1,maxY+1);
  return {minX,maxX,minY,maxY,width:maxX-minX+1,height:maxY-minY+1};
}

function getLayout(now=performance.now()) {
  const width = state.map[0].length;
  const height = state.map.length;
  const padding = Math.min(canvas.width, canvas.height) * .09;
  const availableW = canvas.width - padding * 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const compact = isCompactViewport();
  const previewMagnified = compact && state.phase === "preview" && state.previewLens;
  let previewSafeTop=padding;
  if(compact&&state.phase==="preview"&&!previewMagnified&&!previewPanel.classList.contains("hidden")){
    const canvasRect=canvas.getBoundingClientRect?.();
    const panelRect=previewPanel.getBoundingClientRect?.();
    const canvasWidth=Number(canvasRect?.width),canvasTop=Number(canvasRect?.top),panelBottom=Number(panelRect?.bottom);
    if(Number.isFinite(canvasWidth)&&canvasWidth>0&&Number.isFinite(canvasTop)&&Number.isFinite(panelBottom)){
      const scale=canvas.width/canvasWidth;
      previewSafeTop=Math.max(padding,(panelBottom-canvasTop+6)*scale);
    }
  }
  const availableH = Math.max(1,canvas.height-previewSafeTop-padding);
  const fittedCell = Math.min(availableW / width, availableH / Math.max(height, 2.6));
  const overview={
    cell:fittedCell,
    ox:(canvas.width-fittedCell*width)/2,
    oy:previewSafeTop+(availableH-fittedCell*height)/2,
    mode:"overview",
  };
  const zoom=state.phase==="explore"?MAP_ZOOM_LEVELS[state.cameraZoom]:1;
  if((!compact&&zoom===1)||(state.phase==="preview"&&!previewMagnified))return overview;
  const tutorialTarget=currentTutorialTarget();
  const flashOverview=compact&&state.phase==="explore"&&state.flashEnds>now&&state.flashOverview!==false
    &&!state.selected&&!state.spiritMode&&!tutorialTarget;
  if(flashOverview)return {...overview,mode:"flash-overview"};

  const focus=state.player;
  let cell,worldCenterX,worldCenterY,mode,panWeight=1;
  if(previewMagnified){
    cell=Math.max(fittedCell,44*dpr);
    worldCenterX=state.previewLens.x+.5;
    worldCenterY=state.previewLens.y+.5;
    mode="preview-lens";
  }else if(state.spiritMode&&state.soul){
    // Moving the soul, changing its light, and advancing the tutorial share this fixed frame.
    const anchor=state.spiritCameraAnchor || state.player;
    cell=(compact?48*dpr:fittedCell)*zoom;
    worldCenterX=anchor.x+.5;
    worldCenterY=anchor.y+.5;
    mode="spirit-local";
  }else if(!compact){
    cell=fittedCell*zoom;
    worldCenterX=focus.drawX+.5;
    worldCenterY=focus.drawY+.5;
    mode="zoomed";
  }else{
    const focusX=tutorialTarget?.[0]??focus.drawX??focus.x;
    const focusY=tutorialTarget?.[1]??focus.drawY??focus.y;
    const bounds=cameraRegionBounds(state.visible,{x:focusX,y:focusY},width,height);
    const localPadding=12*dpr;
    const regionFit=Math.min(
      Math.max(1,canvas.width-localPadding*2)/bounds.width,
      Math.max(1,canvas.height-localPadding*2)/bounds.height,
    );
    const focusedCell=Math.max(44*dpr,Math.min(52*dpr,regionFit))*zoom;
    const progress=state.phase==="fading"
      ? Math.max(0,Math.min(1,state.fade)) : 1;
    const eased=progress*progress*(3-2*progress);
    cell=fittedCell+(focusedCell-fittedCell)*eased;
    const regionFits=!tutorialTarget&&focusedCell*bounds.width<=canvas.width-localPadding*2+1
      &&focusedCell*bounds.height<=canvas.height-localPadding*2+1;
    const localCenterX=regionFits?(bounds.minX+bounds.maxX+1)/2:focusX+.5;
    const localCenterY=regionFits?(bounds.minY+bounds.maxY+1)/2:focusY+.5;
    worldCenterX=state.phase==="fading"?width/2+(localCenterX-width/2)*eased:localCenterX;
    worldCenterY=state.phase==="fading"?height/2+(localCenterY-height/2)*eased:localCenterY;
    panWeight=state.phase==="fading"?eased:1;
    mode=state.phase==="fading"?"fading-local":"local";
  }
  const edge = 10 * dpr;
  const boardWidth = cell * width;
  const boardHeight = cell * height;
  const centerX = canvas.width / 2 - worldCenterX * cell;
  const centerY = canvas.height / 2 - worldCenterY * cell;
  const minX = canvas.width - boardWidth - edge;
  const minY = canvas.height - boardHeight - edge;
  const pan = previewMagnified ? state.previewLens : state.cameraPan;
  const baseX = boardWidth <= canvas.width - edge * 2 ? (canvas.width - boardWidth) / 2 : Math.max(minX,Math.min(edge,centerX));
  const baseY = boardHeight <= canvas.height - edge * 2 ? (canvas.height - boardHeight) / 2 : Math.max(minY,Math.min(edge,centerY));
  const desiredX = baseX + (pan.panX ?? pan.x ?? 0)*panWeight;
  const desiredY = baseY + (pan.panY ?? pan.y ?? 0)*panWeight;
  const ox=boardWidth <= canvas.width-edge*2?baseX:Math.max(minX,Math.min(edge,desiredX));
  const oy=boardHeight <= canvas.height-edge*2?baseY:Math.max(minY,Math.min(edge,desiredY));
  return {
    cell,
    ox,
    oy,
    mode,
    effectivePanX:previewMagnified||panWeight<=0?0:(ox-baseX)/panWeight,
    effectivePanY:previewMagnified||panWeight<=0?0:(oy-baseY)/panWeight,
  };
}

function clampCameraPanToViewport(){
  if(!state||["preview","fading"].includes(state.phase))return false;
  const layout=getLayout();
  const nextX=Number.isFinite(layout.effectivePanX)?layout.effectivePanX:0;
  const nextY=Number.isFinite(layout.effectivePanY)?layout.effectivePanY:0;
  const changed=Math.abs(state.cameraPan.x-nextX)>.01||Math.abs(state.cameraPan.y-nextY)>.01;
  state.cameraPan.x=nextX;
  state.cameraPan.y=nextY;
  return changed;
}

function resizeCanvas() {
  const rect = gameStage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const previousCssWidth=lastCanvasCssWidth;
  const previousCssHeight=lastCanvasCssHeight;
  const previousDpr=lastCanvasPixelRatio;
  const majorWidthChange=previousCssWidth>0&&Math.abs(rect.width-previousCssWidth)>Math.max(96,previousCssWidth*.28);
  const canvasGeometryChanged=previousCssWidth>0&&(
    Math.abs(rect.width-previousCssWidth)>.5
    ||Math.abs(rect.height-previousCssHeight)>.5
    ||Math.abs(dpr-previousDpr)>.01
  );
  // Mobile browser chrome and split-screen resizing can change the canvas
  // between pointerdown and pointerup. Cancelling that one gesture prevents
  // the release coordinate from being interpreted against a different map.
  if(canvasGeometryChanged&&pointerGesture)clearCanvasPointerGesture();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  lastCanvasCssWidth=rect.width;
  lastCanvasCssHeight=rect.height;
  lastCanvasPixelRatio=dpr;
  lastRenderedLayout=null;
  if(state){
    if(majorWidthChange)resetCamera();
    else if(previousCssWidth>0&&previousDpr>0){
      state.cameraPan.x*=dpr/previousDpr;
      state.cameraPan.y*=dpr/previousDpr;
      clampCameraPanToViewport();
    }
    updateCameraResetButton();
  }
}

function updateViewportHeight() {
  const height=Number(window.visualViewport?.height||window.innerHeight);
  if(!Number.isFinite(height)||height<=0)return;
  document.documentElement?.style?.setProperty?.("--app-height",`${Math.round(height)}px`);
}

function syncLargeTextMode() {
  let tutorialFontSize=0;
  try{tutorialFontSize=parseFloat(window.getComputedStyle?.(tutorialStep)?.fontSize||"");}catch(_){}
  let supportsTextAdjust=false;
  try{supportsTextAdjust=Boolean(window.CSS?.supports?.("text-size-adjust","200%")||window.CSS?.supports?.("-webkit-text-size-adjust","200%"));}catch(_){}
  const enabled=supportsTextAdjust&&Number.isFinite(tutorialFontSize)&&tutorialFontSize>=15;
  document.documentElement?.classList?.toggle?.("large-text",enabled);
  return enabled;
}

function handleViewportResize() {
  updateViewportHeight();
  syncLargeTextMode();
  resizeCanvas();
}

function draw(now) {
  if (!state) return;
  const activeVisual = state.phase !== "explore" || state.locked || state.selected || state.spiritMode
    || state.flashEnds > now || state.particles.length > 0 || state.pulses.length > 0;
  const targetFps = reducedMotionQuery?.matches ? 20
    : isCompactViewport() ? (activeVisual ? 30 : 20)
    : activeVisual ? 60 : 30;
  const minimumFrameTime = 1000 / targetFps;
  if (lastRenderedAt && now - lastRenderedAt < minimumFrameTime - 1.5) {
    raf = requestAnimationFrame(draw);
    return;
  }
  lastRenderedAt = now;
  const dt = Math.min(.04, (now - lastTime) / 1000);
  lastTime = now;
  if (state.phase === "preview" && Number.isFinite(state.previewEnds)) {
    const remain = state.previewEnds - now;
    refreshPreviewCountdown(now);
    if (remain <= 0) endPreview();
  }
  if (state.phase === "fading") state.fade = Math.min(1, (now - state.fadeStarted) / 800);
  if (state.phase === "explore" && now - state.lastProgress > 20000) {
    state.lastProgress = now;
    showToast(state.level.hint);
    if (remainingShards().length||!state.items.every((i) => i.picked)) pulseGuidanceHint();
  }
  updateIlluminationStatus(now);
  updateParticles(dt);
  render(now);
  raf = requestAnimationFrame(draw);
}

function updateIlluminationStatus(now) {
  const panel = document.getElementById("illuminationStatus");
  const remaining = state.flashEnds - now;
  const wasVisible=!panel.classList.contains("hidden");
  if (remaining > 0) {
    const seconds=Math.ceil(remaining/1000);
    const label = `闪光照明 · ${seconds} 秒`;
    const text = document.getElementById("illuminationText");
    if (text.textContent !== label) text.textContent = label;
    const accessibleLabel=`闪光照明剩余 ${seconds} 秒`;
    if(panel.getAttribute?.("aria-label")!==accessibleLabel)panel.setAttribute?.("aria-label",accessibleLabel);
    panel.classList.remove("hidden");
  } else {
    panel.classList.add("hidden");
  }
  const isVisible=remaining>0;
  if(wasVisible!==isVisible){
    updateCameraResetButton(now);
    updateCanvasDescription(now);
    if(wasVisible&&!isVisible)document.getElementById("gameStatus").textContent="闪光结束，墙体重新变暗";
  }
}

function updateParticles(dt) {
  state.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 2.4 * dt; p.life -= dt * 1.8; });
  state.particles = state.particles.filter((p) => p.life > 0);
  state.pulses = state.pulses.filter((p) => performance.now() - p.created < pulseLifetime(p));
}

function render(now) {
  const transition=state.spiritLightTransition;
  if(transition&&now-transition.startedAt>=SPIRIT_LIGHT_FADE_MS)state.spiritLightTransition=null;
  const layout=getLayout(now);
  lastRenderedLayout=layout;
  const { cell, ox, oy } = layout;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop(now, cell);
  const startX = Math.max(0, Math.floor(-ox / cell) - 1);
  const endX = Math.min(state.map[0].length, Math.ceil((canvas.width - ox) / cell) + 1);
  const startY = Math.max(0, Math.floor(-oy / cell) - 1);
  const endY = Math.min(state.map.length, Math.ceil((canvas.height - oy) / cell) + 1);
  const torchPreview = state.selected === "torch" && state.target
    ? new Set(getTorchCells(state.target.x,state.target.y).map(([x,y])=>key(x,y))) : null;
  const tutorialTarget=currentTutorialTarget();
  const shakePulses=new Map(state.pulses.filter((pulse)=>pulse.type==="shake").map((pulse)=>[key(pulse.x,pulse.y),pulse]));
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) drawTile(x, y, cell, ox, oy, now, torchPreview, tutorialTarget, shakePulses);
  }
  drawItems(cell, ox, oy, now);
  drawShards(cell,ox,oy,now);
  drawStar(cell, ox, oy, now);
  drawPlayer(cell, ox, oy, now);
  if (state.spiritMode) drawSoul(cell, ox, oy, now);
  drawEffects(cell, ox, oy, now);
  updateStarIndicator(cell, ox, oy);
}

function isShown(x, y, now = performance.now()) {
  if (state.memoryPins.has(key(x,y))) return 1;
  if (state.spiritMode) return state.spiritVisible.has(key(x,y)) ? 1 : 0;
  if (state.phase === "preview" || state.flashEnds > now) return 1;
  if (state.permanentLight.has(key(x, y))) return 1;
  if (state.phase === "fading") {
    if (state.visible.has(key(x, y))) return 1;
    return 1 - state.fade;
  }
  return state.visible.has(key(x, y)) ? 1 : 0;
}

function renderCellVisibility(x, y, now) {
  const cellKey=key(x, y);
  if (!state.spiritMode || state.memoryPins.has(cellKey)) return isShown(x, y, now);
  return spiritLightAt(cellKey, now);
}

function isWallMaterialRevealed(x, y, now = performance.now()) {
  if (state.memoryPins.has(key(x,y))) return true;
  if (state.spiritMode) return state.spiritVisible.has(key(x,y));
  return state.phase === "preview"
    || state.flashEnds > now
    || state.permanentLight.has(key(x, y));
}

// 后续照明道具统一写入这三种状态；所有状态都会恢复墙体原本材质。
function addFlashlightReveal(cells) {
  cells.forEach(([x, y]) => state.permanentLight.add(key(x, y)));
}

function startFlashReveal(duration = 25000) {
  state.flashEnds = performance.now() + duration;
}

function drawBackdrop(now, cell) {
  const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, cell, canvas.width/2, canvas.height/2, canvas.width*.56);
  g.addColorStop(0, "#141c23");
  g.addColorStop(1, "#080d12");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalAlpha = .025;
  ctx.fillStyle = "#bdd2cc";
  const speckCount = reducedMotionQuery?.matches ? 0 : isCompactViewport() ? 14 : 35;
  for (let i = 0; i < speckCount; i++) {
    const x = (i * 173 + now * .002) % canvas.width;
    const y = (i * 97) % canvas.height;
    ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTile(x, y, cell, ox, oy, now, torchPreview, tutorialTarget, shakePulses) {
  const shown = renderCellVisibility(x, y, now);
  const px = ox + x * cell, py = oy + y * cell;
  const tile = state.map[y][x];
  const materialRevealed = state.spiritMode ? shown > 0 : isWallMaterialRevealed(x, y, now);
  const pulse = shakePulses.get(key(x,y));
  const shake = pulse && !prefersReducedMotion() ? Math.sin((now - pulse.created) * .08) * cell * .035 : 0;

  ctx.save();
  ctx.translate(shake, 0);
  if (shown > 0.01) {
    ctx.globalAlpha = shown;
    if (tile === TILE.FLOOR) drawFloor(px, py, cell, x, y);
    else if (materialRevealed) {
      if (tile === TILE.WOOD) drawWood(px, py, cell, x, y, now);
      else if(tile===TILE.CRACKED)drawCrackedStone(px,py,cell,x,y);
      else drawStone(px, py, cell, x, y);
    } else if (state.phase === "fading") {
      if (tile === TILE.WOOD) drawWood(px, py, cell, x, y, now);
      else if(tile===TILE.CRACKED)drawCrackedStone(px,py,cell,x,y);
      else drawStone(px, py, cell, x, y);
      ctx.save();
      ctx.globalAlpha *= state.fade;
      drawConcealedWall(px, py, cell);
      ctx.restore();
    } else {
      drawConcealedWall(px, py, cell);
    }
  }
  if (shown < .999) {
    const ghost = save.afterimage ? .14 : .035;
    ctx.globalAlpha = Math.max(1 - shown, 0) * ghost;
    ctx.strokeStyle = "#d3d8d1";
    ctx.lineWidth = Math.max(1, cell * .015);
    ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
    if (save.afterimage && tile !== TILE.FLOOR) {
      ctx.fillStyle = "#39434a";
      ctx.fillRect(px + cell*.12, py + cell*.12, cell*.76, cell*.76);
    }
  }
  if (state.selected === "hammer" && shown > .5) {
    const dist = Math.abs(x - state.player.x) + Math.abs(y - state.player.y);
    if (dist === 1 && materialRevealed && tile === TILE.WOOD) {
      const glow = prefersReducedMotion() ? .78 : .65 + Math.sin(now / 170) * .2;
      ctx.globalAlpha = glow;
      ctx.strokeStyle = "#ffd56b";
      ctx.lineWidth = Math.max(2, cell*.055);
      ctx.strokeRect(px + cell*.05, py + cell*.05, cell*.9, cell*.9);
    }
    if (dist === 1 && materialRevealed && (tile === TILE.STONE || tile===TILE.CRACKED)) drawLock(px + cell*.5, py + cell*.5, cell*.2, .55);
    if (dist === 1 && !materialRevealed && isWallTile(tile)) {
      ctx.globalAlpha = .72;
      ctx.strokeStyle = "#87928f";
      ctx.lineWidth = Math.max(2, cell*.04);
      ctx.strokeRect(px + cell*.08, py + cell*.08, cell*.84, cell*.84);
    }
    if (dist === 1 && state.target?.x === x && state.target?.y === y) {
      ctx.globalAlpha = .92;
      ctx.strokeStyle = materialRevealed && tile === TILE.WOOD ? "#fff0b3" : "#aeb8b9";
      ctx.lineWidth = Math.max(2, cell*.04);
      const inset = cell*.14;
      ctx.strokeRect(px+inset,py+inset,cell-inset*2,cell-inset*2);
    }
  }
  if(state.selected==="bomb"&&state.target&&shown>.5&&Math.abs(x-state.target.x)<=1&&Math.abs(y-state.target.y)<=1){
    const concealedWall=!materialRevealed&&isWallTile(tile);
    ctx.globalAlpha=concealedWall?.22:tile===TILE.STONE?.2:.34;
    ctx.fillStyle=concealedWall?"#657075":tile===TILE.WOOD?"#f47f3f":tile===TILE.CRACKED?"#d78b42":"#7b8588";
    ctx.fillRect(px+cell*.06,py+cell*.06,cell*.88,cell*.88);
    ctx.globalAlpha=.85;ctx.strokeStyle="#ffb05d";ctx.lineWidth=Math.max(1.5,cell*.035);
    ctx.strokeRect(px+cell*.07,py+cell*.07,cell*.86,cell*.86);
  }
  if(state.selected==="torch"&&state.target){
    if(torchPreview.has(key(x,y))){
      ctx.globalAlpha=.22;
      ctx.fillStyle="#ffe5a0";
      ctx.fillRect(px+cell*.04,py+cell*.04,cell*.92,cell*.92);
    }
  }
  if(tutorialTarget?.[0]===x&&tutorialTarget?.[1]===y&&(shown>.5||state.tutorialPhase==="spiritExplore")){
    ctx.globalAlpha=state.spiritMode||prefersReducedMotion() ? .86 : .72+Math.sin(now/170)*.18;
    ctx.strokeStyle="#ffe08b";
    ctx.lineWidth=Math.max(2,cell*.055);
    ctx.strokeRect(px+cell*.04,py+cell*.04,cell*.92,cell*.92);
  }
  if(state.memoryPins.has(key(x,y)))drawMemoryPin(px,py,cell);
  ctx.restore();
}

function drawFloor(px, py, cell, x, y) {
  ctx.fillStyle = "#eee4d1";
  ctx.fillRect(px, py, cell, cell);
  ctx.globalAlpha *= .055;
  ctx.fillStyle = "#7d6e59";
  ctx.fillRect(px + cell*.18, py + cell*.26, cell*.04, cell*.035);
  ctx.fillRect(px + cell*.67, py + cell*.72, cell*.05, cell*.025);
  ctx.globalAlpha /= .055;
}

function drawConcealedWall(px, py, cell) {
  ctx.fillStyle = "#11171d";
  roundRect(px + cell*.035, py + cell*.035, cell*.93, cell*.93, cell*.075, true);
  ctx.strokeStyle = "rgba(137,151,154,.18)";
  ctx.lineWidth = Math.max(1, cell*.02);
  ctx.strokeRect(px + cell*.09, py + cell*.09, cell*.82, cell*.82);
  ctx.strokeStyle = "rgba(0,0,0,.42)";
  ctx.beginPath();
  ctx.moveTo(px+cell*.12,py+cell*.52);
  ctx.lineTo(px+cell*.88,py+cell*.52);
  ctx.stroke();
}

function drawWood(px, py, cell, x, y, now) {
  ctx.fillStyle = "#8b6447";
  roundRect(px + cell*.055, py + cell*.055, cell*.89, cell*.89, cell*.07, true);
  const horizontal = (x + y) % 2 === 0;
  ctx.strokeStyle = "rgba(47,27,18,.45)";
  ctx.lineWidth = Math.max(1, cell*.035);
  for (let i=1;i<4;i++) {
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(px+cell*.1, py+cell*(i/4)); ctx.lineTo(px+cell*.9, py+cell*(i/4+.03)); }
    else { ctx.moveTo(px+cell*(i/4), py+cell*.1); ctx.lineTo(px+cell*(i/4+.02), py+cell*.9); }
    ctx.stroke();
  }
  ctx.strokeStyle = "#d1a171";
  ctx.lineWidth = Math.max(1.5, cell*.035);
  ctx.beginPath();
  ctx.moveTo(px+cell*.48, py+cell*.12);
  ctx.lineTo(px+cell*.39, py+cell*.38);
  ctx.lineTo(px+cell*.56, py+cell*.53);
  ctx.lineTo(px+cell*.43, py+cell*.84);
  ctx.stroke();
}

function drawStone(px, py, cell, x, y) {
  ctx.fillStyle = "#46515b";
  roundRect(px + cell*.035, py + cell*.035, cell*.93, cell*.93, cell*.075, true);
  ctx.strokeStyle = "rgba(195,205,205,.17)";
  ctx.lineWidth = Math.max(1, cell*.02);
  ctx.strokeRect(px+cell*.09, py+cell*.09, cell*.82, cell*.82);
  ctx.strokeStyle = "rgba(20,27,32,.45)";
  ctx.beginPath();
  ctx.moveTo(px+cell*.1, py+cell*.5); ctx.lineTo(px+cell*.9, py+cell*.5);
  ctx.moveTo(px+cell*.34, py+cell*.1); ctx.lineTo(px+cell*.34, py+cell*.5);
  ctx.moveTo(px+cell*.67, py+cell*.5); ctx.lineTo(px+cell*.67, py+cell*.9);
  ctx.stroke();
}

function drawCrackedStone(px,py,cell,x,y){
  drawStone(px,py,cell,x,y);
  ctx.save();
  ctx.strokeStyle="#e3a54f";
  ctx.shadowColor="rgba(233,166,72,.55)";
  ctx.shadowBlur=cell*.12;
  ctx.lineWidth=Math.max(1.5,cell*.04);
  ctx.beginPath();
  ctx.moveTo(px+cell*.52,py+cell*.1);
  ctx.lineTo(px+cell*.43,py+cell*.34);
  ctx.lineTo(px+cell*.59,py+cell*.49);
  ctx.lineTo(px+cell*.38,py+cell*.72);
  ctx.lineTo(px+cell*.48,py+cell*.9);
  ctx.moveTo(px+cell*.59,py+cell*.49);
  ctx.lineTo(px+cell*.76,py+cell*.6);
  ctx.stroke();
  ctx.restore();
}

function drawMemoryPin(px,py,cell){
  ctx.save();
  ctx.globalAlpha=.98;
  ctx.shadowColor="rgba(255,220,112,.8)";
  ctx.shadowBlur=cell*.18;
  ctx.fillStyle="#ffe083";
  ctx.beginPath();
  ctx.arc(px+cell*.77,py+cell*.22,cell*.11,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle="#fff3bd";
  ctx.lineWidth=Math.max(1.2,cell*.025);
  ctx.beginPath();
  ctx.moveTo(px+cell*.72,py+cell*.28);
  ctx.lineTo(px+cell*.57,py+cell*.48);
  ctx.stroke();
  ctx.restore();
}

function drawItems(cell, ox, oy, now) {
  for (const item of state.items) {
    const opacity=state.spiritMode?renderCellVisibility(item.x,item.y,now):1;
    if (item.picked || (state.spiritMode?opacity<.01:isShown(item.x,item.y,now)<.25)) continue;
    const cx = ox + (item.x+.5)*cell, cy = oy+(item.y+.5)*cell;
    if (cx < -cell || cy < -cell || cx > canvas.width + cell || cy > canvas.height + cell) continue;
    const bob = prefersReducedMotion() ? 0 : Math.sin(now/260 + item.x)*cell*.04;
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(cx,cy+bob);
    if(item.mandatory){
      ctx.save();ctx.strokeStyle="rgba(255,224,131,.9)";ctx.lineWidth=Math.max(1.5,cell*.035);ctx.setLineDash?.([cell*.12,cell*.08]);
      ctx.beginPath();ctx.arc(0,0,cell*.38,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    ctx.shadowColor="rgba(241,190,91,.85)";ctx.shadowBlur=cell*.28;
    if(item.type==="hammer"){
      ctx.rotate(-.55);ctx.fillStyle="#d3dde0";
      roundRect(-cell*.26,-cell*.22,cell*.43,cell*.18,cell*.04,true);
      ctx.fillStyle="#aa7043";roundRect(cell*.02,-cell*.08,cell*.11,cell*.42,cell*.035,true);
    }else if(item.type==="bomb"){
      ctx.fillStyle="#4d5960";ctx.beginPath();ctx.arc(0,cell*.04,cell*.23,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#d3ae66";ctx.lineWidth=Math.max(1.5,cell*.045);ctx.beginPath();ctx.moveTo(cell*.12,-cell*.14);ctx.quadraticCurveTo(cell*.2,-cell*.34,cell*.31,-cell*.26);ctx.stroke();
      ctx.fillStyle="#ffba54";ctx.beginPath();ctx.arc(cell*.32,-cell*.28,cell*.055,0,Math.PI*2);ctx.fill();
    }else if(item.type==="spirit"){
      ctx.fillStyle="#a9e5e4";ctx.beginPath();ctx.arc(0,-cell*.04,cell*.22,Math.PI,0);ctx.lineTo(cell*.22,cell*.22);ctx.lineTo(cell*.08,cell*.13);ctx.lineTo(-cell*.05,cell*.22);ctx.lineTo(-cell*.18,cell*.12);ctx.closePath();ctx.fill();
      ctx.fillStyle="#284750";ctx.beginPath();ctx.arc(-cell*.075,-cell*.055,cell*.035,0,Math.PI*2);ctx.arc(cell*.075,-cell*.055,cell*.035,0,Math.PI*2);ctx.fill();
    }else{
      ctx.rotate(-.45);ctx.fillStyle="#91a9ab";roundRect(-cell*.08,-cell*.22,cell*.16,cell*.42,cell*.035,true);
      ctx.fillStyle="#dce8df";roundRect(-cell*.18,-cell*.28,cell*.36,cell*.14,cell*.04,true);
      ctx.fillStyle="rgba(255,226,137,.42)";ctx.beginPath();ctx.moveTo(-cell*.18,-cell*.28);ctx.lineTo(-cell*.34,-cell*.44);ctx.lineTo(cell*.34,-cell*.44);ctx.lineTo(cell*.18,-cell*.28);ctx.fill();
    }
    ctx.restore();
  }
}

function drawShards(cell,ox,oy,now){
  for(const shard of state.shards){
    const opacity=state.spiritMode?renderCellVisibility(shard.x,shard.y,now):1;
    if(shard.collected||(state.spiritMode?opacity<.01:isShown(shard.x,shard.y,now)<.25))continue;
    const cx=ox+(shard.x+.5)*cell,cy=oy+(shard.y+.5)*cell;
    if(cx < -cell || cy < -cell || cx > canvas.width + cell || cy > canvas.height + cell)continue;
    const pulse=prefersReducedMotion()?1:.92+Math.sin(now/220+shard.x)*.08;
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(cx,cy);ctx.scale(pulse,pulse);ctx.rotate(Math.PI/4);
    ctx.shadowColor="#ffdd72";ctx.shadowBlur=cell*.36;
    ctx.fillStyle="#ffe28a";roundRect(-cell*.12,-cell*.12,cell*.24,cell*.24,cell*.035,true);
    ctx.strokeStyle="#fff4c2";ctx.lineWidth=Math.max(1,cell*.025);ctx.strokeRect(-cell*.085,-cell*.085,cell*.17,cell*.17);
    ctx.restore();
  }
}

function drawStar(cell, ox, oy, now) {
  const [x,y] = state.star;
  const cx = ox + (x+.5)*cell, cy = oy + (y+.5)*cell;
  const scale = cell * (.24 + (prefersReducedMotion() ? 0 : Math.sin(now/380)*.025));
  const locked=remainingShards().length>0||remainingMandatoryRewards().length>0;
  ctx.save();ctx.globalAlpha=locked ? .42 : 1; ctx.translate(cx,cy); ctx.rotate(prefersReducedMotion() ? 0 : now/6000);
  ctx.shadowColor = "#e9ad3f"; ctx.shadowBlur = cell*.42;
  drawStarShape(0,0,5,scale,scale*.46);
  ctx.fillStyle = "#ffd86d"; ctx.fill();
  ctx.restore();
  if(locked)drawLock(cx,cy,cell*.26,.9);
  const darkness=state.spiritMode?1-renderCellVisibility(x,y,now):Number(isShown(x,y,now)<.25);
  if (darkness > .01) {
    ctx.save(); ctx.globalAlpha=.23*darkness; ctx.strokeStyle="#f2c35c"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,cell*.34,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
}

function drawPlayer(cell, ox, oy, now) {
  const cx = ox + (state.player.drawX+.5)*cell, cy = oy + (state.player.drawY+.5)*cell;
  const bob = state.locked && !prefersReducedMotion() ? Math.sin(now/35)*cell*.025 : 0;
  ctx.save(); ctx.globalAlpha=state.spiritMode ? .38 : 1; ctx.translate(cx,cy+bob);
  ctx.fillStyle="rgba(47,42,34,.2)"; ctx.beginPath(); ctx.ellipse(0,cell*.28,cell*.25,cell*.09,0,0,Math.PI*2); ctx.fill();
  ctx.shadowColor="rgba(255,221,150,.35)";ctx.shadowBlur=cell*.28;
  ctx.fillStyle="#2f7580"; ctx.beginPath(); ctx.moveTo(-cell*.2,cell*.25);ctx.quadraticCurveTo(0,-cell*.2,cell*.2,cell*.25);ctx.closePath();ctx.fill();
  ctx.fillStyle="#edc695";ctx.beginPath();ctx.arc(0,-cell*.14,cell*.13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#26343c";ctx.beginPath();ctx.arc(-cell*.02,-cell*.2,cell*.13,Math.PI,0);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle="#d88949";ctx.lineWidth=cell*.07;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(cell*.04*state.player.facing,0);ctx.lineTo(cell*.25*state.player.facing,cell*.16);ctx.stroke();
  ctx.restore();
}

function drawSoul(cell, ox, oy, now) {
  const soul=state.soul;
  const cx=ox+(soul.drawX+.5)*cell,cy=oy+(soul.drawY+.5)*cell;
  const bob=prefersReducedMotion()?0:Math.sin(now/180)*cell*.055;
  ctx.save();ctx.translate(cx,cy+bob);ctx.globalAlpha=.82;
  ctx.shadowColor="#80e0df";ctx.shadowBlur=cell*.38;
  ctx.fillStyle="#b9f1ed";ctx.beginPath();ctx.arc(0,-cell*.06,cell*.19,Math.PI,0);ctx.lineTo(cell*.19,cell*.2);ctx.lineTo(cell*.06,cell*.12);ctx.lineTo(-cell*.05,cell*.21);ctx.lineTo(-cell*.17,cell*.11);ctx.closePath();ctx.fill();
  ctx.fillStyle="#355861";ctx.beginPath();ctx.arc(-cell*.065,-cell*.06,cell*.03,0,Math.PI*2);ctx.arc(cell*.065,-cell*.06,cell*.03,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawEffects(cell, ox, oy, now) {
  for (const p of state.particles) {
    ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle="#b78150";
    ctx.fillRect(ox+(p.x-p.size/2)*cell,oy+(p.y-p.size/2)*cell,p.size*cell,p.size*cell);
  }
  ctx.globalAlpha=1;
  for (const p of state.pulses) {
    const age=(now-p.created)/pulseLifetime(p);
    if (p.type==="shake") continue;
    const cx=ox+(p.x+.5)*cell,cy=oy+(p.y+.5)*cell;
    const reduced=prefersReducedMotion();
    const effectAlpha=reduced ? (age<1 ? .68 : 0) : Math.max(0,1-age);
    ctx.save();ctx.globalAlpha=effectAlpha;ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(1,cell*.04*(reduced?1:1-age));
    if(p.type==="blast"){
      const first=reduced ? .44 : .18+age*p.power;
      const secondAge=Math.max(0,Math.min(1,(age-.16)/.84));
      ctx.beginPath();ctx.arc(cx,cy,cell*first,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=effectAlpha*(reduced ? .7 : Math.max(0,1-secondAge)*.78);
      ctx.beginPath();ctx.arc(cx,cy,cell*(reduced ? .68 : .28+secondAge*p.power*.82),0,Math.PI*2);ctx.stroke();
    }else{
      ctx.beginPath();ctx.arc(cx,cy,cell*(reduced ? .42 : .2+age*p.power),0,Math.PI*2);ctx.stroke();
    }
    if(p.type==="lock") drawLock(cx,cy,cell*.23,effectAlpha);
    ctx.restore();
  }
  if(state.moveDestination&&inBounds(state.moveDestination.x,state.moveDestination.y)){
    const cx=ox+(state.moveDestination.x+.5)*cell,cy=oy+(state.moveDestination.y+.5)*cell;
    const breathe=prefersReducedMotion()?0:Math.sin(now/150)*cell*.025;
    ctx.save();ctx.strokeStyle="#ffe08b";ctx.fillStyle="#ffe08b";ctx.globalAlpha=.82;
    ctx.lineWidth=Math.max(2,cell*.045);
    ctx.beginPath();ctx.arc(cx,cy,cell*.25+breathe,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=.34;ctx.beginPath();ctx.arc(cx,cy,cell*.37+breathe,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(cx,cy,Math.max(2,cell*.045),0,Math.PI*2);ctx.fill();ctx.restore();
  }
  const targetDuplicatesDestination=state.target&&state.moveDestination
    &&state.target.x===state.moveDestination.x&&state.target.y===state.moveDestination.y;
  if (state.selected && state.target && !targetDuplicatesDestination && inBounds(state.target.x, state.target.y)) {
    const cx = ox + (state.target.x + .5) * cell;
    const cy = oy + (state.target.y + .5) * cell;
    const colors = { hammer:"#ffda7a", bomb:"#ff9b68", flash:"#fff4bd", torch:"#bce9d7", teleport:"#91edf2" };
    ctx.save();
    ctx.strokeStyle = colors[state.selected] || "#ffda7a";
    ctx.lineWidth = Math.max(2, cell * .07);
    ctx.setLineDash?.([Math.max(3,cell*.14),Math.max(2,cell*.09)]);
    ctx.strokeRect(cx - cell * .39, cy - cell * .39, cell * .78, cell * .78);
    ctx.setLineDash?.([]);
    if (state.selected === "teleport") {
      const distance = Math.abs(state.target.x-state.player.x)+Math.abs(state.target.y-state.player.y);
      ctx.fillStyle = "rgba(7,18,22,.86)";
      ctx.beginPath();ctx.arc(cx,cy,cell*.22,0,Math.PI*2);ctx.fill();
      ctx.fillStyle = "#dfffff";
      ctx.font = `700 ${Math.max(9,cell*.23)}px system-ui`;
      ctx.textAlign = "center";ctx.textBaseline = "middle";
      ctx.fillText(String(distance),cx,cy);
    }
    ctx.restore();
  }
}

function drawLock(cx,cy,size,alpha=1) {
  ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle="#d9dfdc";ctx.fillStyle="rgba(26,33,39,.72)";ctx.lineWidth=Math.max(1,size*.16);
  ctx.beginPath();ctx.arc(cx,cy-size*.28,size*.35,Math.PI,0);ctx.stroke();
  roundRect(cx-size*.52,cy-size*.18,size*1.04,size*.82,size*.12,true);ctx.restore();
}

function drawStarShape(cx,cy,spikes,outer,inner) {
  let rot=Math.PI/2*3, step=Math.PI/spikes;
  ctx.beginPath();ctx.moveTo(cx,cy-outer);
  for(let i=0;i<spikes;i++){ctx.lineTo(cx+Math.cos(rot)*outer,cy+Math.sin(rot)*outer);rot+=step;ctx.lineTo(cx+Math.cos(rot)*inner,cy+Math.sin(rot)*inner);rot+=step;}
  ctx.lineTo(cx,cy-outer);ctx.closePath();
}

function roundRect(x,y,w,h,r,fill=false) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x,y,w,h,r);
  } else {
    const radius=Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2));
    ctx.moveTo(x+radius,y);
    ctx.lineTo(x+w-radius,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
    ctx.lineTo(x+w,y+h-radius);
    ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
    ctx.lineTo(x+radius,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
    ctx.lineTo(x,y+radius);
    ctx.quadraticCurveTo(x,y,x+radius,y);
    ctx.closePath();
  }
  if(fill)ctx.fill(); else ctx.stroke();
}

function updateStarIndicator(cell,ox,oy) {
  const el=document.getElementById("directionIndicator");
  if(!tutorialBubble.classList.contains("hidden")){el.classList.add("hidden");return;}
  const focus=state.spiritMode&&state.soul?state.soul:state.player;
  const guidance=goalGuidanceTarget(focus);
  const sx=ox+(guidance.x+.5)*cell,sy=oy+(guidance.y+.5)*cell;
  const margin=30*Math.min(window.devicePixelRatio||1,2);
  const outside=sx<margin||sx>canvas.width-margin||sy<margin||sy>canvas.height-margin;
  if(!outside){el.classList.add("hidden");return;}
  el.classList.remove("hidden");
  const rect=gameStage.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  const cameraButton=document.getElementById("cameraResetButton");
  const cameraVisible=!cameraButton.classList.contains("hidden");
  const rightClearance=cameraVisible?176:70;
  el.style.left=`${Math.max(18,Math.min(rect.width-rightClearance,sx/dpr))}px`;
  el.style.top=`${Math.max(18,Math.min(rect.height-50,sy/dpr))}px`;
  const symbol=el.querySelector?.("span");
  if(symbol)symbol.textContent=guidance.symbol;
  document.getElementById("directionText").textContent=`${guidance.label}在前方`;
}

function canvasPoint(event) {
  const rect=canvas.getBoundingClientRect();
  const dpr=canvas.width/rect.width;
  const mx=(event.clientX-rect.left)*dpr,my=(event.clientY-rect.top)*dpr;
  const {cell,ox,oy}=lastRenderedLayout||getLayout();
  return { x:Math.floor((mx-ox)/cell), y:Math.floor((my-oy)/cell), gridX:(mx-ox)/cell, gridY:(my-oy)/cell };
}

function resolveTouchTarget(point) {
  const exact = [point.x, point.y];
  if (!isCompactViewport()) return exact;
  const tutorialTarget=currentTutorialTarget();
  if (tutorialTarget && Math.abs(tutorialTarget[0] - point.gridX) <= 1.15 && Math.abs(tutorialTarget[1] - point.gridY) <= 1.15) return tutorialTarget;
  if (state.spiritMode || state.selected === "flash" || state.selected === "torch" || state.selected === "teleport") return exact;
  const valid = (x,y) => {
    if (!inBounds(x,y)) return false;
    if (state.selected === "hammer") return state.visible.has(key(x,y)) && isWallTile(state.map[y][x]);
    if (state.selected === "bomb") return isFloor(x,y) && state.visible.has(key(x,y)) && Math.abs(x-state.player.x)+Math.abs(y-state.player.y)<=1;
    if (!state.selected&&state.memoryPinLimit>0&&isWallTile(state.map[y][x])&&isWallMaterialRevealed(x,y)) return true;
    return isFloor(x,y) && state.visible.has(key(x,y));
  };
  if (valid(...exact)) return exact;
  const candidates=[];
  for(let y=point.y-1;y<=point.y+1;y++)for(let x=point.x-1;x<=point.x+1;x++){
    if(!valid(x,y))continue;
    candidates.push({x,y,distance:Math.hypot(x+.5-point.gridX,y+.5-point.gridY)});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates.length?[candidates[0].x,candidates[0].y]:exact;
}

function activateCanvasCell(x,y) {
  if(!state||state.phase!=="explore"||state.locked||!inBounds(x,y))return;
  if(!state.selected&&state.memoryPinLimit>0&&isWallTile(state.map[y][x])&&isWallMaterialRevealed(x,y)){
    toggleMemoryPin(x,y);
    return;
  }
  if(state.spiritMode){moveSoulTo(x,y);return;}
  if(state.selected){
    if(state.selected==="hammer") moveAndUseHammer(x,y);
    else useSelected(x,y);
    return;
  }
  if(isFloor(x,y)&&state.visible.has(key(x,y))) moveToVisibleCell(x,y);
  else showToast("请选择一个光亮地面",true);
}

function handleCanvasActivation(event) {
  if (!state) return;
  if (event.pointerType === "touch") event.preventDefault();
  if(state.phase==="preview"&&state.memoryPinLimit>0){
    const [pinX,pinY]=resolvePreviewPinTarget(canvasPoint(event));
    toggleMemoryPin(pinX,pinY);
    return;
  }
  if(state.phase!=="explore")return;
  if(flashCameraToggleAvailable()&&state.flashOverview!==false){
    setFlashCameraOverview(false);
    return;
  }
  const currentLayout=getLayout();
  if(lastRenderedLayout&&lastRenderedLayout.mode!==currentLayout.mode){
    showToast("镜头已切换 · 请再点目标格");
    return;
  }
  const [x,y]=resolveTouchTarget(canvasPoint(event));
  if(!inBounds(x,y))return;
  if(state.locked){
    if(state.autoRoute)cancelAutoRoute({x,y});
    return;
  }
  activateCanvasCell(x,y);
}

function resolvePreviewPinTarget(point){
  const exact=[point.x,point.y];
  if(!isCompactViewport()||isWallTile(state.map[point.y]?.[point.x]))return exact;
  const candidates=[];
  for(let y=point.y-1;y<=point.y+1;y++)for(let x=point.x-1;x<=point.x+1;x++){
    if(!isWallTile(state.map[y]?.[x]))continue;
    candidates.push({x,y,distance:Math.hypot(x+.5-point.gridX,y+.5-point.gridY)});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates.length?[candidates[0].x,candidates[0].y]:exact;
}

function activatePreviewLens(gesture){
  if(!gesture||pointerGesture!==gesture||state?.phase!=="preview"||gesture.previewLens)return;
  const point=gesture.startPoint;
  state.previewLens={
    x:Math.max(0,Math.min(state.map[0].length-1,point.gridX)),
    y:Math.max(0,Math.min(state.map.length-1,point.gridY)),
    panX:0,
    panY:0,
  };
  gesture.previewLens=true;
  previewPanel.classList.add("lens-active");
}

function startCanvasPointer(event) {
  if (event.isPrimary === false) return;
  if (event.button != null && event.button !== 0) return;
  const point=state?.phase==="preview"?canvasPoint(event):null;
  pointerGesture = {
    id:event.pointerId,
    startX:event.clientX,
    startY:event.clientY,
    panX:state?.cameraPan.x || 0,
    panY:state?.cameraPan.y || 0,
    lastX:event.clientX,
    lastY:event.clientY,
    pointerType:event.pointerType||"mouse",
    dragging:false,
    previewLens:false,
    pinCandidate:Boolean(state?.phase==="preview"&&state.memoryPinLimit>0),
    startPoint:point,
    holdTimer:0,
  };
  if(pointerGesture.pinCandidate){
    const gesture=pointerGesture;
    gesture.holdTimer=window.setTimeout(()=>activatePreviewLens(gesture),200);
  }else if(state?.phase==="preview"&&isCompactViewport()){
    activatePreviewLens(pointerGesture);
    event.preventDefault();
  }
  try{canvas.setPointerCapture?.(event.pointerId);}catch(_){}
}

function clearCanvasPointerGesture(){
  const gesture=pointerGesture;
  pointerGesture=null;
  if(gesture?.holdTimer)clearTimeout(gesture.holdTimer);
  if(state)state.previewLens=null;
  previewPanel.classList.remove("lens-active");
  if(gesture?.id!=null){
    try{canvas.releasePointerCapture?.(gesture.id);}catch(_){}
  }
  return gesture;
}

function moveCanvasPointer(event) {
  if (!pointerGesture || pointerGesture.id !== event.pointerId || !state) return;
  const dx=event.clientX-pointerGesture.startX,dy=event.clientY-pointerGesture.startY;
  const dragThreshold=pointerGesture.pointerType==="touch"?10:7;
  if(pointerGesture.pinCandidate&&!pointerGesture.previewLens&&Math.hypot(dx,dy)>=dragThreshold){
    if(pointerGesture.holdTimer)clearTimeout(pointerGesture.holdTimer);
    pointerGesture.dragging=true;
    activatePreviewLens(pointerGesture);
  }
  if(pointerGesture.previewLens&&state.phase==="preview"&&state.previewLens){
    event.preventDefault();
    const rect=canvas.getBoundingClientRect();
    const scale=canvas.width/Math.max(1,rect.width);
    state.previewLens.panX=dx*scale;
    state.previewLens.panY=dy*scale;
    if(Math.hypot(dx,dy)>=dragThreshold)pointerGesture.dragging=true;
    return;
  }
  if (!pointerGesture.dragging && Math.hypot(dx,dy) < dragThreshold) return;
  pointerGesture.dragging=true;
  if ((!isCompactViewport()&&state.cameraZoom===DEFAULT_MAP_ZOOM)||state.phase!=="explore") return;
  event.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const scale=canvas.width/Math.max(1,rect.width);
  const stepX=event.clientX-pointerGesture.lastX,stepY=event.clientY-pointerGesture.lastY;
  pointerGesture.lastX=event.clientX;
  pointerGesture.lastY=event.clientY;
  state.cameraPan.x+=stepX*scale;
  state.cameraPan.y+=stepY*scale;
  clampCameraPanToViewport();
  state.lastProgress=performance.now();
  updateCameraResetButton();
}

function finishCanvasPointer(event, cancelled=false) {
  if (!pointerGesture || pointerGesture.id !== event.pointerId) return;
  const shouldPin=!cancelled&&pointerGesture.pinCandidate&&!pointerGesture.dragging&&!pointerGesture.previewLens;
  const pinPoint=pointerGesture.startPoint;
  const gesture=clearCanvasPointerGesture();
  if(shouldPin&&pinPoint){const [x,y]=resolvePreviewPinTarget(pinPoint);toggleMemoryPin(x,y);return;}
  if (!cancelled && !gesture.dragging && !gesture.previewLens) handleCanvasActivation(event);
}

if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", startCanvasPointer);
  canvas.addEventListener("pointermove", moveCanvasPointer);
  canvas.addEventListener("pointerup", (event)=>finishCanvasPointer(event));
  canvas.addEventListener("pointercancel", (event)=>finishCanvasPointer(event,true));
  canvas.addEventListener("lostpointercapture", (event)=>finishCanvasPointer(event,true));
} else canvas.addEventListener("click", handleCanvasActivation);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function openSettings() {
  syncSettings();
  openModal(settingsModal, "#closeSettings", "settings", document.getElementById("settingsButton"));
}

function closeSettings() {
  closeModal(settingsModal);
}

function seedPresetButtons(){
  return ["S","M","D"].map((preset)=>document.getElementById(`seedPreset${preset}`)).filter(Boolean);
}

function setSeedPreset(presetValue){
  const preset=SEEDED_API?.normalizeSeedPreset(presetValue);
  if(!preset)return false;
  selectedSeedPreset=preset;
  seedPresetButtons().forEach((button)=>{
    const active=button.dataset.seedPreset===preset;
    button.classList.toggle("active",active);
    button.setAttribute?.("aria-pressed",String(active));
  });
  return true;
}

function randomSeedCode(){
  const alphabet=SEEDED_API?.SEEDED_CODE_ALPHABET||"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code="";
  try{
    const bytes=new Uint32Array(6);
    window.crypto?.getRandomValues?.(bytes);
    if(bytes.some((value)=>value!==0)){
      for(const value of bytes)code+=alphabet[value%alphabet.length];
    }
  }catch(_){}
  while(code.length<6)code+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return code.slice(0,6);
}

function setSeedCode(value){
  const input=document.getElementById("seedCodeInput");
  if(!input)return;
  input.value=String(value||"").toUpperCase();
  input.removeAttribute?.("aria-invalid");
  document.getElementById("seedCodeStatus").textContent="";
}

function openSeededModal({returnTo="intro",preset="M",code=""}={}){
  seededModalReturn=returnTo;
  setSeedPreset(preset);
  setSeedCode(code||randomSeedCode());
  if(returnTo==="result")closeModal(completeModal,{restoreFocus:false});
  else closeModal(introModal,{restoreFocus:false});
  openModal(seededModal,"#seededTitle","seeded",document.getElementById("seededButton"));
}

function closeSeededModal(){
  closeModal(seededModal,{restoreFocus:false});
  if(seededModalReturn==="result"&&state?.mode==="seeded"&&state.complete){
    openModal(completeModal,"#resultTitle","result");
  }else openModal(introModal,"#seededButton","intro");
}

function startSeededFromModal(){
  const input=document.getElementById("seedCodeInput");
  const code=SEEDED_API?.normalizeSeedCode(input?.value);
  if(!code){
    input?.setAttribute?.("aria-invalid","true");
    document.getElementById("seedCodeStatus").textContent="请输入严格 6 位挑战码，只能使用 2–9 与不含 I、O 的字母。";
    input?.focus?.();
    return false;
  }
  document.getElementById("seedCodeStatus").textContent="正在生成同码星图…";
  // End the old modal pause before creating the new run. Otherwise the time
  // spent entering a code is added to the fresh five-second preview when the
  // modal closes, which can turn a long-open dialog into a long-open map.
  closeModal(seededModal,{restoreFocus:false});
  const loaded=loadSeededChallenge(code,selectedSeedPreset,{updateUrl:true});
  if(!loaded){
    input?.setAttribute?.("aria-invalid","true");
    document.getElementById("seedCodeStatus").textContent="这张星图暂时无法生成，请更换挑战码重试。";
    openModal(seededModal,input,"seeded",document.getElementById("seededButton"));
    return false;
  }
  playTone("reveal");
  return true;
}

function showCurrentHint() {
  if (!state) return;
  closeSettings();
  state.lastProgress = performance.now();
  showToast(`本关提示 · ${state.level.hint}`);
  pulseGuidanceHint();
}

function clearEntrySnapshots() {
  clearRunSnapshot();
  Object.keys(runEntries).forEach((keyName) => delete runEntries[keyName]);
  try{sessionStorage.removeItem?.(ENTRY_SNAPSHOT_IDENTITY_KEY);}catch(_){}
  for (let index = 1; index < LEVELS.length; index++) {
    try { sessionStorage.removeItem?.(`maze-entry-v7-${index}`); } catch (_) {}
    try { sessionStorage.removeItem?.(`maze-entry-v6-${index}`); } catch (_) {}
  }
}

function encodeUtf8(value) {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(value);
  const encoded = encodeURIComponent(value);
  const bytes = [];
  for (let index = 0; index < encoded.length; index++) {
    if (encoded[index] === "%") {
      bytes.push(parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(encoded.charCodeAt(index));
  }
  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
  return decodeURIComponent([...bytes].map((byte) => `%${byte.toString(16).padStart(2,"0")}`).join(""));
}

function encodeSaveCode() {
  const bytes = encodeUtf8(JSON.stringify(sanitizeSave(save)));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeSaveCode(code) {
  const trimmed = String(code || "").trim();
  if (trimmed.length < 8 || trimmed.length > 100000 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new Error("Invalid save code");
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const parsed=JSON.parse(decodeUtf8(bytes));
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Invalid save payload");
  return sanitizeSave(migrateSave(parsed));
}

async function copyText(value) {
  if (window.navigator?.clipboard?.writeText) {
    try {
      await window.navigator.clipboard.writeText(value);
      return true;
    } catch (_) {}
  }
  promptWithGamePause("请复制下面的内容", value);
  return false;
}

function buildShareData({ result=false, url="" }={}) {
  const unsavedNotice=result&&state?.complete&&(state.completionPersistFailed||state.saveConflict)
    ? "（本次结算尚未保存）" : "";
  if(state?.mode==="seeded"){
    const stars="★".repeat(boundedInteger(state.resultStars,1,3));
    const difficulty=seededPresetName(state.seeded.preset);
    if(result&&state.complete)return {
      title:"破壁迷途 · 种子星图",
      text:`我在《破壁迷途》无尽迷局「${difficulty}」挑战码 ${state.seeded.canonical} 获得 ${stars}：路径成本 ${state.routeCost}｜误敲 ${state.mistakes}｜${state.steps} 步｜${state.seededMemoryPerfect?"无闪记忆 ✦":`闪光 ${state.usage.flash||0} 次`}。用同码来挑战这张地图。`,
      url,
    };
    return {
      title:"破壁迷途 · 种子星图",
      text:`无尽迷局「${difficulty}」· 挑战码 ${state.seeded.canonical}。相同难度与挑战码会生成同一张地图。`,
      url,
    };
  }
  if(state?.mode==="daily"){
    const stars="★".repeat(boundedInteger(state.resultStars,1,3));
    const today=dailyIsToday(state.daily.date);
    const modeLabel=today?"今日迷局":"星历回顾";
    const perfectLabel=today?"今日契约完美":"本日契约完美";
    const question=today?"今天你能走得更省吗？":"你在这一天能走得更省吗？";
    if(result&&state.complete)return {
      title:`破壁迷途 · ${modeLabel}`,
      text:`${modeLabel} · ${state.daily.date}「${state.level.name}」${stars}｜路径成本 ${state.routeCost}｜误敲 ${state.mistakes}｜${state.steps} 步${state.dailyPerfect?`，并达成「${perfectLabel}」`:state.dailyRoutePerfect?"，路线完美但契约未完成":""}${unsavedNotice}。${question}`,
      url,
    };
    return {
      title:`破壁迷途 · ${modeLabel}`,
      text:`${modeLabel} · ${state.daily.date}「${state.level.name}」· ${state.daily.contract.name}。${question}`,
      url,
    };
  }
  const countText=LEVELS.length===20?"二十":LEVELS.length===15?"十五":String(LEVELS.length);
  const generic={title:"破壁迷途",text:`让灵魂先穿墙侦察，在黑暗中点亮${countText}段星路。`,url};
  if(!result||!state?.complete)return generic;
  const campaignFinal=state.levelIndex===LEVELS.length-1&&!state.saveConflict;
  if(campaignFinal){
    const campaignStars=Object.values(save.stars).reduce((sum,value)=>sum+boundedInteger(value,0,3),0);
    const campaignBadges=Object.values(save.badges||{}).filter(Boolean).length;
    const challengeCount=LEVELS.filter((level)=>level.challenge).length;
    return {
      title:"破壁迷途",
      text:`我点亮了《破壁迷途》${LEVELS.length} / ${LEVELS.length} 段星路：${campaignStars} / ${LEVELS.length*3} 星、${campaignBadges} / ${challengeCount} 枚印记，终局保留 ${state.inventory.hammer} 锤 / ${state.inventory.bomb} 炸${unsavedNotice}。来试试你的路线。`,
      url,
    };
  }
  const stars="★".repeat(boundedInteger(state.resultStars,1,3));
  const challenge=state.challengeSuccess&&!state.saveConflict?state.level.challenge:null;
  const badgeText=challenge?`，并取得印记「${challenge.name}」`:"";
  return {
    title:"破壁迷途",
    text:`我在《破壁迷途》第 ${state.levelIndex+1} 关「${state.level.name}」拿到 ${stars}：路径成本 ${state.routeCost}｜误敲 ${state.mistakes}｜${state.steps} 步${badgeText}${unsavedNotice}。你能走得更省吗？`,
    url,
  };
}

async function shareGame({ result=false }={}) {
  if(shareInFlight)return false;
  shareInFlight=true;
  const shareButtons=[document.getElementById("shareButton"),document.getElementById("resultShareButton")].filter(Boolean);
  shareButtons.forEach((button)=>{button.disabled=true;button.setAttribute?.("aria-busy","true");});
  const resultShareStatus=document.getElementById("resultShareStatus");
  if(result&&resultShareStatus)resultShareStatus.textContent="";
  setGamePaused("share", true);
  try {
    const currentUrl = window.location?.href || "";
    const baseUrl=baseShareUrl();
    const url=state?.mode==="daily"?dailyUrlForDate(state.daily.date,baseUrl)
      :state?.mode==="seeded"?seededUrlForChallenge(state.seeded,baseUrl):baseUrl;
    const data=buildShareData({result,url});
    if (currentUrl.startsWith("file:")) {
      if(result&&resultShareStatus)resultShareStatus.textContent="本地文件不能直接分享 · 请打开正式网址";
      else showToast("本地文件不能直接分享 · 请打开正式网址", true);
      return;
    }
    if (window.navigator?.share) {
      try {
        await window.navigator.share(data);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const copyValue=result?`${data.text}\n${data.url}`:data.url;
    const copied = await copyText(copyValue);
    if(result&&resultShareStatus)resultShareStatus.textContent=copied
      ?"成绩与链接已复制 · 粘贴到微信即可分享"
      :"请长按复制成绩与链接 · 粘贴到微信即可分享";
    else showToast(copied ? "游戏链接已复制 · 微信可点右上角 … 转发" : "请长按复制链接 · 微信也可点右上角 … 转发");
  } catch (error) {
    if(result&&resultShareStatus)resultShareStatus.textContent="暂时无法分享，请复制浏览器地址";
    else showToast("暂时无法分享，请复制浏览器地址", true);
  } finally {
    setGamePaused("share", false);
    shareInFlight=false;
    shareButtons.forEach((button)=>{button.disabled=false;button.removeAttribute?.("aria-busy");});
  }
}

function canShowUpdateBannerNow() {
  if (introModal?.classList?.contains("visible")) return true;
  const tutorialCueActive=state?.mode==="campaign"&&[0,1].includes(state.levelIndex)
    &&state.phase==="explore"&&Boolean(state.tutorialPhase);
  return Boolean(state&&state.phase!=="preview"&&state.phase!=="fading"
    &&!tutorialCueActive);
}

function renderUpdateBanner(message) {
  const banner=document.getElementById("updateBanner");
  const text=document.getElementById("updateBannerText");
  text.textContent="";
  banner.classList.remove("hidden");
  void banner.offsetHeight;
  text.textContent=message;
}

function showUpdateBanner(message) {
  if (!canShowUpdateBannerNow()) {
    deferredUpdateBannerMessage=message;
    document.getElementById("updateBanner").classList.add("hidden");
    return;
  }
  deferredUpdateBannerMessage="";
  renderUpdateBanner(message);
}

function deferVisibleUpdateBanner() {
  const banner=document.getElementById("updateBanner");
  if (banner.classList.contains("hidden")) return;
  deferredUpdateBannerMessage=document.getElementById("updateBannerText").textContent
    ||deferredUpdateBannerMessage||"新版本已经准备好";
  banner.classList.add("hidden");
}

function revealDeferredUpdateBanner() {
  if (!deferredUpdateBannerMessage||!canShowUpdateBannerNow()) return;
  const message=deferredUpdateBannerMessage;
  deferredUpdateBannerMessage="";
  renderUpdateBanner(message);
}

function announceServiceWorkerUpdate(worker) {
  if (!worker) return;
  waitingServiceWorker = worker;
  updateReadyForReload = worker.state === "activated";
  showUpdateBanner(updateReadyForReload ? "新版本已接管 · 刷新即可使用" : "新版本已经准备好");
}

function syncInstallButton(){
  const button=document.getElementById("installButton");
  button.disabled=installPromptInFlight;
  if(installPromptInFlight)button.setAttribute("aria-busy","true");
  else button.removeAttribute("aria-busy");
  button.classList.toggle("hidden",!deferredInstallPrompt);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  if(installPromptInFlight)return;
  deferredInstallPrompt = event;
  syncInstallButton();
});

window.addEventListener("appinstalled", () => {
  installPromptAttempt++;
  installPromptInFlight = false;
  deferredInstallPrompt = null;
  syncInstallButton();
  showToast("破壁迷途已安装 · 离线也能继续游玩");
});

semanticMapGrid.addEventListener("focusin",(event)=>{
  if(!event.target?.classList?.contains("semantic-map-cell"))return;
  const previous=semanticMapGrid.querySelector('[tabindex="0"]');
  if(previous!==event.target)previous?.setAttribute("tabindex","-1");
  event.target.setAttribute("tabindex","0");
  semanticMapPosition.textContent=event.target.getAttribute("aria-label")||"";
});

semanticMapGrid.addEventListener("click",(event)=>{
  const cell=event.target;
  if(!cell?.classList?.contains("semantic-map-cell")||!state)return;
  const x=Number(cell.dataset.x),y=Number(cell.dataset.y);
  if(state.phase==="preview")return;
  if(state.phase!=="explore")return;
  if(!state.selected&&state.memoryPinLimit>0&&isWallTile(state.map[y]?.[x])){
    if(toggleMemoryPin(x,y)){
      semanticMapSnapshotTime=performance.now();
      refreshSemanticMapCell(x,y);
    }
    return;
  }
  closeSemanticMap({restoreFocus:false});
  canvas.focus();
  document.getElementById("gameStatus").textContent=`已从文本地图选择第 ${y+1} 行第 ${x+1} 列`;
  if(state.locked){
    if(state.autoRoute)cancelAutoRoute({x,y});
    return;
  }
  activateCanvasCell(x,y);
});

semanticMapGrid.addEventListener("keydown",(event)=>{
  const cell=event.target;
  if(!cell?.classList?.contains("semantic-map-cell"))return;
  let x=Number(cell.dataset.x),y=Number(cell.dataset.y);
  const width=state.map[0].length,height=state.map.length;
  if(event.key==="ArrowLeft")x--;
  else if(event.key==="ArrowRight")x++;
  else if(event.key==="ArrowUp")y--;
  else if(event.key==="ArrowDown")y++;
  else if(event.key==="Home"){x=0;if(event.ctrlKey)y=0;}
  else if(event.key==="End"){x=width-1;if(event.ctrlKey)y=height-1;}
  else if(event.key==="PageUp")y-=5;
  else if(event.key==="PageDown")y+=5;
  else return;
  event.preventDefault();
  focusSemanticMapCell(x,y);
});

document.addEventListener("keydown", (event) => {
  const visibleModal = document.querySelector(".modal-backdrop.visible");
  if (visibleModal) {
    trapModalFocus(event, visibleModal);
    if(event.key==="Escape"&&settingsModal.classList.contains("visible")) closeSettings();
    if(event.key==="Escape"&&semanticMapModal.classList.contains("visible")) closeSemanticMap();
    if(event.key==="Escape"&&seededModal.classList.contains("visible")) closeSeededModal();
    return;
  }
  if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "m") {
    event.preventDefault();
    openSemanticMap();
    return;
  }
  const nativeControl = ["BUTTON","INPUT","SELECT","TEXTAREA","SUMMARY","A"].includes(event.target?.tagName);
  if (nativeControl && (event.code === "Space" || event.key === "Enter")) return;
  if (state?.phase === "preview" && (event.code === "Space" || event.key === "Enter")) { event.preventDefault(); endPreview(); return; }
  if (event.key === "1") { selectHammer(); return; }
  if (event.key === "2") { selectBomb(); return; }
  if (event.key === "3") { selectFlash(); return; }
  if (event.key === "4") { useSpiritCard(); return; }
  if (event.key === "5") { selectTorch(); return; }
  if (event.key === "6") { selectTeleport(); return; }
  if (event.key === "Escape") { if(state?.spiritMode)returnSpirit();else cancelSelection(); return; }
  if (event.key.toLowerCase() === "r") { restartLevel(); return; }
  const moves = { ArrowUp:[0,-1],w:[0,-1],W:[0,-1],ArrowDown:[0,1],s:[0,1],S:[0,1],ArrowLeft:[-1,0],a:[-1,0],A:[-1,0],ArrowRight:[1,0],d:[1,0],D:[1,0] };
  if (state?.selected && moves[event.key]) { event.preventDefault(); aimSelected(...moves[event.key]); return; }
  if (state?.selected && (event.code === "Space" || event.key === "Enter")) {
    event.preventDefault();
    if(state.target){
      if(state.selected==="hammer"&&state.tutorialPhase==="breakWood")moveAndUseHammer(state.target.x,state.target.y);
      else useSelected(state.target.x,state.target.y);
    }
    return;
  }
  if((event.key==="Enter"||event.code==="Space")&&["spiritExplore","move"].includes(state?.tutorialPhase)){
    const target=currentTutorialTarget();
    if(target){event.preventDefault();activateCanvasCell(...target);}
    return;
  }
  if (moves[event.key]) { event.preventDefault(); tryMove(...moves[event.key]); }
});

hammerSlot.addEventListener("click", selectHammer);
bombSlot.addEventListener("click", selectBomb);
flashSlot.addEventListener("click", selectFlash);
spiritSlot.addEventListener("click", useSpiritCard);
torchSlot.addEventListener("click", selectTorch);
teleportSlot.addEventListener("click", selectTeleport);
spiritReturnButton.addEventListener("click", returnSpirit);
onboardingRevealButton?.addEventListener("click", dismissOnboardingReveal);
document.getElementById("cancelButton").addEventListener("click", cancelSelection);
document.getElementById("restartButton").addEventListener("click", restartLevel);
document.getElementById("cameraResetButton").addEventListener("click", handleCameraControl);
zoomInButton?.addEventListener("click", () => adjustMapZoom(1));
zoomOutButton?.addEventListener("click", () => adjustMapZoom(-1));
document.getElementById("semanticMapButton").addEventListener("click", openSemanticMap);
document.getElementById("previewSemanticMapButton").addEventListener("click", openSemanticMap);
document.getElementById("closeSemanticMap").addEventListener("click", closeSemanticMap);
document.getElementById("skipPreview").addEventListener("click", endPreview);
document.getElementById("startButton").addEventListener("click", () => {
  if(requestedSeededChallenge){
    closeModal(introModal,{restoreFocus:false});
    if(!loadSeededChallenge(requestedSeededChallenge.code,requestedSeededChallenge.preset,{updateUrl:true})){
      openModal(introModal,"#startButton","intro");
      showToast("挑战码无法生成迷宫 · 已安全返回",true);
      return;
    }
    playTone("reveal");
    return;
  }
  if(requestedDailyDate){
    const modeLabel=dailyIsToday(requestedDailyDate)?"今日迷局":"本日回顾";
    if(pendingDailyRunSnapshot&&!confirmWithGamePause(`重新开始会放弃${modeLabel}的中途断点，确定继续吗？`))return;
    clearDailyRunSnapshot();
    closeModal(introModal,{restoreFocus:false});
    loadDailyChallenge(requestedDailyDate);
    playTone("reveal");
    return;
  }
  if(pendingRunSnapshot&&!confirmWithGamePause("从第一关回顾会放弃当前关卡的中途断点，确定继续吗？"))return;
  clearRunSnapshot();
  closeModal(introModal, { restoreFocus: false });
  loadLevel(0,firstLevelInventory(),{guideFirstLevel:true});
});
document.getElementById("continueButton").addEventListener("click", () => {
  closeModal(introModal, { restoreFocus: false });
  if(requestedDailyDate){
    const snapshot=pendingDailyRunSnapshot;
    pendingDailyRunSnapshot=null;
    if(snapshot&&restoreDailyRunSnapshot(snapshot)){
      showToast(dailyIsToday(snapshot.date)?"已恢复今日迷局最近的稳定断点":"已恢复本日回顾题最近的稳定断点");playTone("reveal");return;
    }
    loadDailyChallenge(requestedDailyDate);playTone("reveal");return;
  }
  const snapshot=pendingRunSnapshot;
  pendingRunSnapshot=null;
  if(snapshot&&restoreRunSnapshot(snapshot)){
    showToast("已恢复本关最近的稳定断点");
    playTone("reveal");
    return;
  }
  const index = boundedInteger(save.lastLevel,0,save.unlocked);
  loadLevel(index,getEntryInventory(index));
});
document.getElementById("replayButton").addEventListener("click", restartLevel);
document.getElementById("nextButton").addEventListener("click", () => {
  let continueUnsaved=false;
  if(state?.mode==="campaign"){
    adoptNewerStoredSave();
    if(state.saveConflict||!stateMatchesCurrentSave()){
      const current=boundedInteger(save.lastLevel,0,save.unlocked);
      loadLevel(current,getEntryInventory(current),{volatileContinuation:false});
      return;
    }
  }
  if(state?.complete&&state.completionPersistFailed&&!retryCompletionPersistence()){
    const action=state.mode==="daily"?"返回主线"
      :state.levelIndex===LEVELS.length-1?"回到第一关":"继续下一关";
    if(!confirmUnsavedCompletionExit(action)){
      showToast(completionRetryMessage(),true);
      return;
    }
    continueUnsaved=true;
  }
  if(state?.mode==="seeded"){
    openSeededModal({returnTo:"result",preset:state.seeded.preset,code:randomSeedCode()});
    return;
  }
  if(state?.mode==="daily"){
    if(!continueUnsaved)clearDailyRunSnapshot();
    navigateToUrl(navigationBaseUrl());
    return;
  }
  const next=state.levelIndex===LEVELS.length-1?0:state.levelIndex+1;
  const inventory=next===0?firstLevelInventory():getEntryInventory(next);
  loadLevel(next,inventory,{preserveRunSnapshot:continueUnsaved,volatileContinuation:continueUnsaved});
});
document.getElementById("shareButton").addEventListener("click", () => shareGame());
document.getElementById("resultShareButton").addEventListener("click", () => shareGame({result:true}));
document.getElementById("resultMainButton")?.addEventListener("click",()=>navigateToUrl(navigationBaseUrl()));
document.getElementById("mainTutorialButton")?.addEventListener("click",()=>navigateToUrl(navigationBaseUrl()));
document.getElementById("dailyButton")?.addEventListener("click",()=>{
  flushRunSnapshot();
  navigateToUrl(dailyUrlForDate(DAILY_API.todayInShanghai(),navigationBaseUrl()));
});
document.getElementById("seededButton")?.addEventListener("click",()=>openSeededModal({returnTo:"intro",preset:"M",code:randomSeedCode()}));
seedPresetButtons().forEach((button)=>button.addEventListener("click",()=>setSeedPreset(button.dataset.seedPreset)));
document.getElementById("seedCodeInput")?.addEventListener("input",(event)=>{
  event.target.value=String(event.target.value||"").toUpperCase();
  event.target.removeAttribute?.("aria-invalid");
  document.getElementById("seedCodeStatus").textContent="";
});
document.getElementById("seedCodeInput")?.addEventListener("keydown",(event)=>{
  if(event.key!=="Enter")return;
  event.preventDefault();startSeededFromModal();
});
document.getElementById("randomSeedButton")?.addEventListener("click",()=>setSeedCode(randomSeedCode()));
document.getElementById("startSeededButton")?.addEventListener("click",startSeededFromModal);
document.getElementById("closeSeeded")?.addEventListener("click",closeSeededModal);
document.getElementById("settingsButton").addEventListener("click", openSettings);
document.getElementById("closeSettings").addEventListener("click", closeSettings);
document.getElementById("installButton").addEventListener("click", async () => {
  if (!deferredInstallPrompt||installPromptInFlight) return;
  const prompt=deferredInstallPrompt;
  const attempt=++installPromptAttempt;
  installPromptInFlight=true;
  syncInstallButton();
  try {
    await Promise.resolve(prompt.prompt());
    await prompt.userChoice;
  } catch (_) {}
  finally {
    if(attempt!==installPromptAttempt)return;
    if(deferredInstallPrompt===prompt)deferredInstallPrompt=null;
    installPromptInFlight=false;
    syncInstallButton();
  }
});
function updateReloadWarning(){
  if(state?.mode==="seeded")return "刷新后挑战码会保留，但本局进度不会保存，将从头开始。确定更新吗？";
  if(!state)return "刷新后会重新打开游戏，确定更新吗？";
  const saveConflict=state.mode==="campaign"&&state.saveConflict;
  if(saveConflict)return "存档已在另一标签页更新；刷新后会回到当前存档进度。确定更新吗？";
  const unsavedCompletion=Boolean(state.complete&&state.completionPersistFailed&&!saveConflict);
  const volatile=Boolean(state.volatileContinuation);
  const progressAtRisk=!state.complete&&(state.mode==="daily"
    ?hasDailyRunProgressToLose(state)
    :state.mode==="campaign"?hasLevelProgressToLose():false);
  let checkpointWritten=false;
  if(!state.complete&&!volatile&&(state.mode==="campaign"||state.mode==="daily"))checkpointWritten=flushActiveRunSnapshot();
  const checkpointAvailable=checkpointWritten||(state.mode==="daily"
    ?Boolean(readDailyRunSnapshot(state.daily.date))
    :state.mode==="campaign"?Boolean(readRunSnapshot()):false);
  if((unsavedCompletion||volatile||progressAtRisk)&&!checkpointAvailable){
    return "当前进度和断点都未保存；刷新会丢失本次操作。仍要更新吗？";
  }
  if(unsavedCompletion||volatile||progressAtRisk){
    return "当前操作尚未写入长期进度；刷新后会回到最近可恢复位置。确定更新吗？";
  }
  return state.complete
    ?"当前结算已经保存；刷新后可继续，确定更新吗？"
    :"刷新后会从当前关卡入口继续，确定更新吗？";
}
document.getElementById("applyUpdateButton").addEventListener("click", () => {
  if (!waitingServiceWorker) return;
  const warning=updateReloadWarning();
  if (!confirmWithGamePause(warning)) return;
  if(updateReadyForReload||waitingServiceWorker.state==="activated"){
    flushActiveRunSnapshot();
    reloadingForUpdate=true;
    window.location.reload?.();
    return;
  }
  updateReloadAccepted=true;
  waitingServiceWorker.postMessage({ type:"SKIP_WAITING" });
});
document.getElementById("dismissUpdateButton").addEventListener("click", () => {
  document.getElementById("updateBanner").classList.add("hidden");
  showToast("已暂缓更新 · 关闭全部游戏页面后可能自动更新");
});
settingsModal.addEventListener("click", (event) => { if(event.target.id==="settingsModal") closeSettings(); });
seededModal.addEventListener("click",(event)=>{if(event.target.id==="seededModal")closeSeededModal();});
semanticMapModal.addEventListener("click",(event)=>{if(event.target.id==="semanticMapModal")closeSemanticMap();});
document.getElementById("previewOptions").addEventListener("click", (e) => {
  if(!e.target.matches("button")) return;
  if(state?.mode==="daily"||state?.mode==="seeded"){
    showToast(state.mode==="seeded"
      ?"种子星图固定亮图 5 秒 · 不会改动主线设置"
      :"每日迷局固定亮图 5 秒 · 不会改动主线设置");
    syncSettings();
    return;
  }
  save.previewDuration=Number(e.target.dataset.duration);persist({ fields:["previewDuration"] });syncSettings();
});
document.getElementById("afterimageToggle").addEventListener("change", (e) => {
  save.afterimage=e.target.checked;if(state?.mode==="campaign")persist({ fields:["afterimage"] });
});
document.getElementById("soundToggle").addEventListener("change", (e) => {
  save.sound=e.target.checked;if(state?.mode==="campaign")persist({ fields:["sound"] });
});
document.getElementById("hintButton").addEventListener("click", showCurrentHint);
document.getElementById("exportSaveButton").addEventListener("click", async () => {
  try {
    const stored=readStoredSave();
    if(stored)reconcileExternalSave(JSON.stringify(stored));
    const copied=await copyText(encodeSaveCode());
    showToast(copied?"主线存档码已复制":"请在弹窗中长按复制主线存档码");
  } catch (_) { showToast("无法复制主线存档码", true); }
});
document.getElementById("importSaveButton").addEventListener("click", () => {
  if(state?.mode==="daily"||state?.mode==="seeded"){closeSettings();showToast("请先返回主线再导入存档",true);return;}
  const code=promptWithGamePause("粘贴主线存档码");
  if(!code)return;
  try{
    const imported=decodeSaveCode(code);
    const summarize=(snapshot)=>{
      const completed=new Set(snapshot.completed||[]).size;
      const stars=Object.values(snapshot.stars||{}).reduce((sum,value)=>sum+boundedInteger(value,0,3),0);
      return `已通关 ${completed}/${LEVELS.length}，${stars}/${LEVELS.length*3} 星`;
    };
    const current=readStoredSave()||save;
    if(!confirmWithGamePause(`导入会覆盖当前主线进度并清除本关断点。\n\n当前：${summarize(current)}\n导入：${summarize(imported)}\n\n建议先复制当前主线存档码备份。确定继续吗？`)){
      showToast("已取消导入 · 当前进度未改变");
      return;
    }
    imported.generation=nextSaveGeneration();
    imported.campaignId=createCampaignId();
    save=imported;
    clearEntrySnapshots();
    persist({ replace:true });
    syncSettings();
    renderTrack();
    closeSettings();
    loadLevel(save.lastLevel,getEntryInventory(save.lastLevel),{volatileContinuation:false});
    showToast(lastSaveWriteSucceeded?"主线存档已导入":"主线存档已载入，但本机无法保存；请立即复制主线存档码",!lastSaveWriteSucceeded);
  }catch(_){showToast("主线存档码无效",true);}
});
document.getElementById("rescueButton").addEventListener("click", () => {
  if (!state) return;
  if(state.mode==="seeded"){
    if(!confirmWithGamePause("救援会按同一挑战码与独立背包无损重开，确定继续吗？"))return;
    const {code,preset}=state.seeded;
    closeSettings();loadSeededChallenge(code,preset,{updateUrl:true});
    showToast("同码补给已恢复 · 从入口重新开始");return;
  }
  if(state.mode==="daily"){
    if(!confirmWithGamePause("救援会用本日固定背包无损重开，确定继续吗？"))return;
    const date=state.daily.date;closeSettings();loadDailyChallenge(date);
    showToast("本日固定补给已恢复 · 从入口重新开始");return;
  }
  adoptNewerStoredSave();
  if(state.saveConflict||!stateMatchesCurrentSave()){
    const current=boundedInteger(save.lastLevel,0,save.unlocked);
    closeSettings();
    loadLevel(current,getEntryInventory(current));
    showToast("存档已在另一标签页更换 · 已回到当前进度");
    return;
  }
  if (!confirmWithGamePause("救援会重开本关，并改用经过验证、足以通关的保底背包。确定继续吗？")) return;
  const levelIndex = state.levelIndex;
  const rescueInventory = levelIndex === 0 ? firstLevelInventory() : fallbackEntryInventory(levelIndex);
  const protectingVolatileCheckpoint=Boolean(state.volatileContinuation);
  if (levelIndex > 0&&!protectingVolatileCheckpoint) setNextEntry(levelIndex, rescueInventory);
  closeSettings();
  loadLevel(levelIndex, rescueInventory);
  if(levelIndex>0&&protectingVolatileCheckpoint&&!state.volatileContinuation)setNextEntry(levelIndex,rescueInventory);
  showToast("保底补给已送达 · 本关从入口重新开始");
});
document.getElementById("resetProgress").addEventListener("click", () => {
  if(state?.mode==="daily"||state?.mode==="seeded"){
    closeSettings();
    showToast(state.mode==="seeded"?"种子星图不会改动主线进度 · 请先返回主线":"每日迷局不会改动主线进度 · 请先返回主线",true);
    return;
  }
  if(!confirmWithGamePause(`确定重置全部 ${LEVELS.length} 关进度吗？当前存档将被覆盖。`))return;
  save=defaultSave(nextSaveGeneration(),createCampaignId());
  clearEntrySnapshots();
  persist({ replace:true });syncSettings();renderTrack();closeSettings();loadLevel(0,firstLevelInventory(),{volatileContinuation:false});
  showToast(lastSaveWriteSucceeded?`${LEVELS.length} 关进度已重置`:"进度已在本页重置，但本机无法保存；刷新后可能恢复",!lastSaveWriteSucceeded);
});

function syncSettings(){
  const dailyMode=state?.mode==="daily";
  const seededMode=state?.mode==="seeded";
  const fixedPreview=dailyMode||seededMode;
  const rescueButton=document.getElementById("rescueButton");
  if(rescueButton)rescueButton.textContent=seededMode
    ? "同码无损重开 · 恢复独立背包"
    : dailyMode?"无损重开 · 恢复本日固定背包":"卡关救援 · 使用本关保底物资";
  document.querySelectorAll("#previewOptions button").forEach((b)=>{
    const active=Number(b.dataset.duration)===Number(fixedPreview?5:save.previewDuration);
    b.classList.toggle("active",active);
    b.setAttribute?.("aria-pressed",String(active));
    b.disabled=fixedPreview;
    b.setAttribute?.("aria-disabled",String(fixedPreview));
  });
  document.getElementById("afterimageToggle").checked=save.afterimage;
  document.getElementById("soundToggle").checked=save.sound;
  if(state?.mode==="daily"){
    const best=dailySave.entries[state.daily.date];
    const modeLabel=dailyIsToday(state.daily.date)?"今日迷局":"星历回顾";
    document.getElementById("dailyPreviewNote").textContent=`${modeLabel}固定亮图 5 秒，不会改变主线设置`;
    document.getElementById("progressSummary").innerHTML=`${modeLabel} <strong>${state.daily.date}</strong> · ${dailyToolName(state.daily.contract.tool)} · ${state.daily.contract.name}${best?` · 最佳 <strong>${"★".repeat(best.stars)} / 成本 ${best.routeCost}</strong>${best.contractPerfect?" · 契约完美":""}`:" · 尚未完成"}`;
    return;
  }
  if(seededMode){
    const score=currentRunScore(state);
    document.getElementById("dailyPreviewNote").textContent="种子星图固定亮图 5 秒，不会改变主线设置";
    document.getElementById("progressSummary").innerHTML=`种子星图 <strong>${state.seeded.canonical}</strong> · ${seededPresetName(state.seeded.preset)} · 当前 <strong>${"★".repeat(score.stars)} / 成本 ${state.routeCost}</strong>`;
    return;
  }
  document.getElementById("dailyPreviewNote").textContent="今日迷局固定亮图 5 秒，不会改变主线设置";
  const totalStars=Object.values(save.stars).reduce((sum,value)=>sum+boundedInteger(value,0,3),0);
  const badgeCount=Object.values(save.badges||{}).filter(Boolean).length;
  document.getElementById("progressSummary").innerHTML=`已点亮 <strong>${save.completed.length} / ${LEVELS.length}</strong> 关 · 星星 <strong>${totalStars} / ${LEVELS.length*3}</strong> · 印记 <strong>${badgeCount} / ${LEVELS.filter(level=>level.challenge).length}</strong>`;
}

function dailyCalendarMarkup(){
  const today=DAILY_API?.todayInShanghai?.()||"";
  renderedDailyCalendarDate=today;
  const {dates,completed,perfect}=recentDailyStats(today);
  const selectedDate=state?.mode==="daily"?state.daily.date:null;
  const buttons=dates.map((date)=>{
    const parsed=DAILY_API.parseDailyDate(date),score=dailySave.entries[date];
    const isToday=date===today,isSelected=date===selectedDate;
    const classes=["daily-calendar-day",isToday?"today":"",isSelected?"selected":"",score?"completed":"",score?.contractPerfect?"perfect":""].filter(Boolean).join(" ");
    const status=score?`${score.stars} 星${score.perfect?"，路线完美":""}${score.contractPerfect?`，${isToday?"今日":"本日"}契约完美`:""}`:"未完成";
    const label=`${parsed.month} 月 ${parsed.day} 日，${dailyWeekdayLabel(date)}，${status}${isToday?"，今天":""}`;
    return `<button type="button" class="${classes}" data-daily-date="${date}" ${isSelected?'aria-current="date" ':""}aria-label="${label}"><span class="daily-day-weekday">${dailyWeekdayLabel(date)}</span><strong class="daily-day-date">${parsed.month}/${parsed.day}</strong><small class="daily-day-stars" aria-hidden="true">${score?"★".repeat(score.stars):"—"}</small></button>`;
  }).join("");
  return `<section class="daily-calendar-card" aria-label="七日星历"><div class="daily-calendar-header"><div><strong>七日星历</strong><small>固定同题 · 可补玩</small></div><span class="daily-calendar-summary">已点亮 ${completed} / 7 · 契约完美 ${perfect} / 7</span></div><div class="daily-calendar-days" role="group" aria-label="最近七日迷局">${buttons}</div></section>`;
}

function bindDailyCalendar(track){
  track.querySelectorAll?.(".daily-calendar-day").forEach((button)=>button.addEventListener("click",()=>{
    const date=button.dataset.dailyDate;
    if(!DAILY_API?.parseDailyDate(date)||(state?.mode==="daily"&&state.daily.date===date))return;
    const activeMode=state?.mode;
    const progressAtRisk=activeMode==="daily"?hasDailyRunProgressToLose(state):hasLevelProgressToLose();
    const snapshotSaved=activeMode==="seeded"?false:flushActiveRunSnapshot();
    if(progressAtRisk&&!snapshotSaved){
      const runLabel=activeMode==="daily"?"每日迷局":activeMode==="seeded"?"种子星图":"主线关卡";
      const warning=activeMode==="seeded"
        ?"种子星图不保存中途断点。切换日期会丢失当前进度；选择“取消”可留在本题，仍要切换吗？"
        :`当前${runLabel}的断点未能保存。切换日期会丢失本次进度；选择“取消”可留在本题，仍要切换吗？`;
      const confirmed=confirmWithGamePause(warning);
      if(!confirmed){showToast("已留在当前迷局");return;}
    }
    navigateToUrl(dailyUrlForDate(date,navigationBaseUrl()));
  }));
  const days=track.querySelector?.(".daily-calendar-days");
  const anchor=track.querySelector?.(".daily-calendar-day.selected, .daily-calendar-day.today");
  if(days&&anchor){
    const right=Number(anchor.offsetLeft)+Number(anchor.offsetWidth),width=Number(days.clientWidth);
    if(Number.isFinite(right)&&Number.isFinite(width))days.scrollLeft=Math.max(0,right-width);
  }
}

function refreshDailyCalendarForDateChange(){
  const today=DAILY_API?.todayInShanghai?.()||"";
  if(!today||today===renderedDailyCalendarDate)return false;
  if(state){updateLevelUI();syncSettings();updateCanvasDescription();}
  renderTrack();
  syncIntroProgressControls();
  return true;
}

function startDailyCalendarRefresh(){
  if(dailyCalendarRefreshTimer||document.hidden||typeof window.setInterval!=="function")return false;
  dailyCalendarRefreshTimer=window.setInterval(()=>{
    if(!document.hidden)refreshDailyCalendarForDateChange();
  },DAILY_CALENDAR_REFRESH_INTERVAL_MS);
  return true;
}

function stopDailyCalendarRefresh(){
  if(!dailyCalendarRefreshTimer)return false;
  window.clearInterval?.(dailyCalendarRefreshTimer);
  dailyCalendarRefreshTimer=0;
  return true;
}

function renderTrack(){
  const track=document.getElementById("levelTrack");
  const calendar=dailyCalendarMarkup();
  if(state?.mode==="daily"){
    const best=dailySave.entries[state.daily.date];
    const modeLabel=dailyIsToday(state.daily.date)?"今日迷局":"星历回顾";
    track.innerHTML=`${calendar}<div class="chapter-track-group daily-track daily-track-card" role="group" aria-label="${modeLabel} ${state.daily.date}"><span class="chapter-track-title">${modeLabel} · ${formatDailyDate(state.daily.date)}</span><div class="chapter-track-nodes daily-track-meta"><span>${state.daily.contract.name} · 三星 ≤ ${state.daily.optimalCost}${best?` · 最佳 ${"★".repeat(best.stars)} / ${best.steps} 步`:""}</span></div></div>`;
    bindDailyCalendar(track);
    return;
  }
  if(state?.mode==="seeded"){
    const difficulty=seededPresetName(state.seeded.preset);
    const score=currentRunScore(state);
    const memoryLost=(state.usage.flash||0)>0;
    const memoryStatus=memoryLost?"记忆已失":"记忆可得";
    const memoryLabel=memoryLost?"无闪记忆星标本局已失，基础三星不受影响":"无闪记忆星标仍可获得";
    track.innerHTML=`${calendar}<div class="chapter-track-group daily-track daily-track-card seeded-track" role="group" aria-label="种子星图 ${state.seeded.canonical}，${memoryLabel}"><span class="chapter-track-title">种子星图 · ${difficulty}</span><div class="chapter-track-nodes daily-track-meta"><span>挑战码 ${state.seeded.canonical} · 当前 ${"★".repeat(score.stars)} · 三星成本 ${state.seeded.optimal.cost} · 闪光 ${state.usage.flash||0} · ${memoryStatus}</span></div></div>`;
    bindDailyCalendar(track);
    return;
  }
  const current=state?.levelIndex??0;
  const buttonMarkup=(level,i)=>{
    const stars=boundedInteger(save.stars?.[i],0,3);
    const badge=Boolean(save.badges?.[i]);
    const label=`第${i+1}关 ${level.name}${stars?`，${stars}星`:""}${badge?`，已取得印记 ${level.challenge?.name||""}`:""}`;
    return `<button type="button" class="level-node ${i===current?"active":""} ${save.completed.includes(i)?"done":""} ${badge?"badge-earned":""}" data-index="${i}" ${i>save.unlocked?"disabled":""} ${i===current?'aria-current="step"':""} aria-label="${label}"><span>${save.completed.includes(i)?"✦":i+1}</span><small aria-hidden="true">${stars?"★".repeat(stars):""}</small></button>`;
  };
  const groups=[
    {name:"失光迷宫",start:0,end:Math.min(15,LEVELS.length)},
    ...(LEVELS.length>15?[{name:"余烬星路",start:15,end:LEVELS.length}]:[]),
  ];
  track.innerHTML=calendar+groups.map((group)=>`<div class="chapter-track-group" role="group" aria-label="${group.name}"><span class="chapter-track-title" aria-hidden="true">${group.name}</span><div class="chapter-track-nodes">${LEVELS.slice(group.start,group.end).map((level,offset)=>buttonMarkup(level,group.start+offset)).join("")}</div></div>`).join("");
  bindDailyCalendar(track);
  track.querySelectorAll("button[data-index]:not(:disabled)").forEach((button)=>button.addEventListener("click",()=>{
    if(state&&state.levelIndex===Number(button.dataset.index))return;
    if(hasLevelProgressToLose()&&!confirmWithGamePause("切换关卡会放弃本关尚未完成的操作，并恢复本关入口物资。确定切换吗？"))return;
    const i=Number(button.dataset.index);loadLevel(i,getEntryInventory(i));
  }));
}

function hasLevelProgressToLose(){
  if(!state||state.complete)return false;
  const spiritAtEntry=state.mode==="campaign"&&state.spiritMode&&!state.spiritScoutedCurrent
    &&state.usage.spirit===1&&state.soul.x===state.level.start[0]&&state.soul.y===state.level.start[1];
  return state.steps>0||state.toolCost>(spiritAtEntry?2:0)||state.picked>0
    ||state.shardsCollected>0||state.memoryPins.size>0;
}

function hasDailyRunProgressToLose(run=state){
  return Boolean(run?.mode==="daily"&&!run.complete&&(
    run.steps>0||run.toolCost>0||run.picked>0||run.newlyRevealed>0||run.infoUses>0||run.spiritMode
    ||run.permanentLight?.size>0||INVENTORY_KEYS.some((name)=>boundedInteger(run.usage?.[name])>0)
  ));
}

function syncIntroProgressControls(){
  const introEyebrow=document.getElementById("introEyebrow");
  const introDescription=document.getElementById("introDescription");
  const dailyButton=document.getElementById("dailyButton");
  const seededButton=document.getElementById("seededButton");
  const mainTutorialButton=document.getElementById("mainTutorialButton");
  document.getElementById("campaignStory")?.classList.toggle("hidden",Boolean(requestedSeededChallenge||requestedDailyDate));
  if(requestedSeededChallenge){
    const seededState=state?.mode==="seeded"?state:createSeededState(requestedSeededChallenge.code,requestedSeededChallenge.preset);
    const difficulty=seededPresetName(seededState.seeded.preset);
    const openingHammer=seededState.entryInventory.hammer;
    if(introEyebrow)introEyebrow.textContent=`无尽迷局 · ${difficulty} · ${seededState.seeded.canonical}`;
    document.getElementById("introTitle").innerHTML="这张迷宫只认挑战码。<br />同码的人会走进同一张图。";
    if(introDescription)introDescription.textContent=`完整地图固定亮起 5 秒；变暗后石墙与木墙同为黑墙，误敲石墙也消耗 1 次。独立背包开局 ${openingHammer} 次锤击；拾取入口锤子后共 ${seededState.seeded.totalHammerBudget} 次，另有 1 次闪光弹；无闪三星会额外点亮记忆星标。`;
    dailyButton?.classList.add("hidden");
    seededButton?.classList.add("hidden");
    document.getElementById("continueButton").classList.add("hidden");
    mainTutorialButton?.classList.remove("hidden");
    document.getElementById("startButton").innerHTML='开始这张种子星图 <span>→</span>';
    return;
  }
  if(requestedDailyDate){
    const daily=DAILY_API.getDailyChallenge(requestedDailyDate);
    const today=dailyIsToday(requestedDailyDate),modeLabel=today?"今日迷局":"星历回顾";
    if(introEyebrow)introEyebrow.textContent=`${modeLabel} · ${formatDailyDate(requestedDailyDate)} · ${daily.daily.contract.name}`;
    document.getElementById("introTitle").innerHTML=today
      ? `今天只有这一题。<br />所有人面对同一座迷宫。`
      : `回望这一天的迷局。<br />所有人面对同一座迷宫。`;
    const toolName=dailyToolName(daily.daily.contract.tool);
    if(introDescription)introDescription.textContent=`完整地图亮起 5 秒；变暗后石墙与木墙同为黑墙，误敲石墙也消耗 1 次。背包只有 ${daily.inventory.hammer} 次锤击和 1 件${toolName}；有效使用它可完成「${daily.daily.contract.name}」，成绩不计时间。`;
    if(dailyButton)dailyButton.classList.add("hidden");
    seededButton?.classList.add("hidden");
    mainTutorialButton?.classList.remove("hidden");
    const continueControl=document.getElementById("continueButton");
    continueControl.classList.toggle("hidden",!pendingDailyRunSnapshot);
    continueControl.textContent=`继续${today?"今日迷局":"本日回顾"} · 中途断点`;
    document.getElementById("startButton").innerHTML=pendingDailyRunSnapshot
      ? `重新开始${today?"今日迷局":"本日回顾"} <span>↺</span>`
      : `开始${today?"今日迷局":"本日回顾"} <span>→</span>`;
    return;
  }
  if(introEyebrow)introEyebrow.textContent="破壁迷途";
  document.getElementById("introTitle").textContent="坠入二十层迷宫";
  if(introDescription)introDescription.textContent="每进入一层，你都以灵魂状态开始。";
  if(dailyButton){dailyButton.classList.remove("hidden");dailyButton.textContent=`今日迷局 · ${formatDailyDate(DAILY_API?.todayInShanghai?.()||"")} · 七日可补玩`;}
  if(seededButton)seededButton.classList.remove("hidden");
  mainTutorialButton?.classList.add("hidden");
  const hasProgress=save.unlocked!==0||save.completed.length!==0||Boolean(pendingRunSnapshot);
  const continueControl=document.getElementById("continueButton");
  continueControl.classList.toggle("hidden",!hasProgress);
  continueControl.textContent=pendingRunSnapshot
    ? `继续第 ${pendingRunSnapshot.levelIndex+1} 关 · 中途断点`
    : `继续第 ${save.lastLevel+1} 关`;
  document.getElementById("startButton").textContent=hasProgress?"重看第一层教学":"进入第一层";
}

function markBootReady(){
  const card=document.getElementById("introCard");
  card.classList.remove("boot-pending");
  card.removeAttribute("aria-busy");
  document.getElementById("bootStatus").classList.add("hidden");
  document.getElementById("continueButton").disabled=false;
  document.getElementById("startButton").disabled=false;
  const dailyButton=document.getElementById("dailyButton");
  if(dailyButton)dailyButton.disabled=false;
  const seededButton=document.getElementById("seededButton");
  if(seededButton)seededButton.disabled=false;
  const mainTutorialButton=document.getElementById("mainTutorialButton");
  if(mainTutorialButton)mainTutorialButton.disabled=false;
  if(introModal.classList.contains("visible")){
    const selector=requestedSeededChallenge?"#startButton":requestedDailyDate?(pendingDailyRunSnapshot?"#continueButton":"#startButton")
      :(save.unlocked!==0||save.completed.length!==0||pendingRunSnapshot)?"#continueButton":"#startButton";
    focusModalElement(introModal,introModal.querySelector(selector));
  }
}

function showIntroLaunchNotice(message){
  const status=document.getElementById("bootStatus");
  status.textContent=message;
  status.setAttribute("aria-live","assertive");
  status.classList.remove("hidden");
}

function reconcileExternalSave(serialized){
  let incoming=parseStoredSave(serialized);
  const storedNow=readStoredSave();
  if(incoming&&storedNow&&(storedNow.generation>incoming.generation||
    (storedNow.generation===incoming.generation&&storedNow.campaignId!==incoming.campaignId)))incoming=storedNow;
  if(!incoming||incoming.generation<save.generation)return;
  if(state?.mode==="seeded"){
    save=incoming;
    syncSettings();
    return;
  }
  const saveIdentityChanged=incoming.generation>save.generation||incoming.campaignId!==save.campaignId;
  if(saveIdentityChanged)clearEntrySnapshots();
  const reconciled=saveIdentityChanged
    ? incoming
    : mergeSaveSnapshots(incoming,save,{
      fields:["previewDuration","afterimage","sound","lastLevel"],
      entryIndices:Object.keys(incoming.entries),
    });
  const shouldConverge=!saveIdentityChanged&&JSON.stringify(reconciled)!==JSON.stringify(incoming);
  save=reconciled;
  if(shouldConverge)writeStoredSave(save);
  syncSettings();
  renderTrack();
  syncIntroProgressControls();
  if(saveIdentityChanged&&state&&!stateMatchesCurrentSave()){
    state.saveConflict=true;
    if(state.complete){
      document.getElementById("resultNote").textContent="另一标签页已重置或导入存档，本次旧关卡结果未保存；请回到当前进度后重试。";
      document.getElementById("nextButton").innerHTML='回到当前进度 <span>→</span>';
    }
    showToast("另一标签页已更换存档 · 当前旧关卡结果不会保存",true);
  }
  warnStorageUnavailable();
}

function reconcileExternalDailySave(serialized){
  let incoming;
  try{incoming=sanitizeDailySave(JSON.parse(serialized));}catch(_){return;}
  const merged=mergeDailySaves(dailySave,incoming);
  const changed=JSON.stringify(merged)!==JSON.stringify(dailySave);
  const needsConvergence=JSON.stringify(merged)!==JSON.stringify(incoming);
  dailySave=merged;
  if(state?.mode==="seeded"){
    if(changed)renderTrack();
    return;
  }
  if(needsConvergence)writeDailySave(dailySave);
  if(changed){if(state?.mode==="daily")syncSettings();renderTrack();}
}

window.addEventListener("resize", handleViewportResize);
window.visualViewport?.addEventListener?.("resize",handleViewportResize);
window.addEventListener("storage",(event)=>{
  if(!event.newValue)return;
  if(event.key===SAVE_KEY)reconcileExternalSave(event.newValue);
  else if(event.key===DAILY_SAVE_KEY)reconcileExternalDailySave(event.newValue);
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){stopDailyCalendarRefresh();clearCanvasPointerGesture();flushActiveRunSnapshot();}
  else{refreshDailyCalendarForDateChange();startDailyCalendarRefresh();}
  setGamePaused("visibility",document.hidden);
});
window.addEventListener("pagehide",()=>{stopDailyCalendarRefresh();clearCanvasPointerGesture();flushActiveRunSnapshot();setGamePaused("pagehide",true);});
window.addEventListener("pageshow",()=>{
  setGamePaused("pagehide",false);
  setGamePaused("visibility",document.hidden);
  refreshDailyCalendarForDateChange();
  startDailyCalendarRefresh();
});
document.addEventListener("pointerdown",()=>{
  if(!save.sound)return;
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    audioContext.resume?.().catch?.(()=>{});
  }catch(_){}
},{once:true});
syncSettings();
renderTrack();
updateViewportHeight();
syncLargeTextMode();
resizeCanvas();
if(launchRoute.invalid)replaceBrowserUrl(navigationBaseUrl());
let seededLaunchFailed=false;
if(requestedSeededChallenge){
  try{state=createSeededState(requestedSeededChallenge.code,requestedSeededChallenge.preset);}
  catch(_){
    requestedSeededChallenge=null;
    seededLaunchFailed=true;
    replaceBrowserUrl(navigationBaseUrl());
  }
}
if(!state)state=requestedDailyDate?createDailyState(requestedDailyDate):createLevel(0,firstLevelInventory());
document.body?.classList?.toggle("daily-mode",Boolean(requestedDailyDate));
document.body?.classList?.toggle("seeded-mode",Boolean(requestedSeededChallenge));
if(requestedSeededChallenge)replaceBrowserUrl(seededUrlForChallenge(requestedSeededChallenge,navigationBaseUrl()));
else if(requestedDailyDate)replaceBrowserUrl(dailyUrlForDate(requestedDailyDate,navigationBaseUrl()));
else if(window.location?.search||window.location?.hash)replaceBrowserUrl(navigationBaseUrl());
updateLevelUI();
updateInventory();
if(requestedDailyDate||requestedSeededChallenge){syncSettings();renderTrack();}
if(requestedDailyDate)pendingDailyRunSnapshot=readDailyRunSnapshot(requestedDailyDate);
else if(!requestedSeededChallenge)pendingRunSnapshot=readRunSnapshot();
syncIntroProgressControls();
completeModal.setAttribute?.("aria-hidden","true");
settingsModal.setAttribute?.("aria-hidden","true");
seededModal.setAttribute?.("aria-hidden","true");
semanticMapModal.setAttribute?.("aria-hidden","true");
openModal(introModal, requestedSeededChallenge?"#startButton":requestedDailyDate
  ? pendingDailyRunSnapshot?"#continueButton":"#startButton"
  : (save.unlocked!==0||save.completed.length!==0||pendingRunSnapshot)?"#continueButton":"#startButton", "intro");
markBootReady();
if(seededLaunchFailed){
  showIntroLaunchNotice("这张种子星图暂时无法生成，已安全回到主线。请更换挑战码后重试。");
  showToast("这张种子星图暂时无法生成 · 已安全回到主线",true);
}else if(launchRoute.invalid){
  showIntroLaunchNotice("挑战链接无效或参数互相冲突，已安全回到主线。请从游戏内重新进入挑战。");
  showToast("挑战链接无效或冲突 · 已安全回到主线",true);
}
startDailyCalendarRefresh();
cancelAnimationFrame(raf);
raf=pauseReasons.size ? 0 : requestAnimationFrame(draw);

if("serviceWorker" in (window.navigator||{})&&["http:","https:"].includes(window.location?.protocol)){
  window.navigator.serviceWorker.addEventListener?.("controllerchange",()=>{
    if(reloadingForUpdate)return;
    if(!updateReloadAccepted){
      if(serviceWorkerControlledAtLoad){
        updateReadyForReload=true;
        waitingServiceWorker=window.navigator.serviceWorker.controller||waitingServiceWorker;
        showUpdateBanner("新版本已接管 · 刷新即可使用");
      }
      return;
    }
    flushActiveRunSnapshot();
    reloadingForUpdate=true;
    window.location.reload?.();
  });
  window.addEventListener("load",()=>window.navigator.serviceWorker.register("./sw.js").then((registration)=>{
    if(registration.waiting)announceServiceWorkerUpdate(registration.waiting);
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      worker?.addEventListener("statechange",()=>{
        if(worker.state==="installed"&&window.navigator.serviceWorker.controller)announceServiceWorkerUpdate(worker);
      });
    });
  }).catch(()=>{}));
}

window.addEventListener("offline",()=>showToast("网络已断开 · 已缓存内容仍可游玩"));
window.addEventListener("online",()=>showToast("网络已恢复"));
