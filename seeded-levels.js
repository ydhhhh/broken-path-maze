(function (root, factory) {
  "use strict";

  const commonJs = typeof module !== "undefined" && module.exports;
  const initialMazeApi = commonJs
    ? require("./maze-levels.js")
    : (root.MazeLevelApi || null);
  const api = factory(initialMazeApi);
  root.SeededMazeData = api;
  if (commonJs) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (initialMazeApi) {
  "use strict";

  const ALGORITHM_VERSION = 1;
  const MAX_ATTEMPTS = 128;
  const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;
  const PRESET_PATTERN = /^[SMD]$/;
  const PRESETS = Object.freeze({
    S:Object.freeze({id:"S",name:"短途",cols:8,rows:6,pathGates:7,minCost:3,maxCost:4,minSteps:24}),
    M:Object.freeze({id:"M",name:"迷城",cols:12,rows:9,pathGates:13,minCost:4,maxCost:5,minSteps:42}),
    D:Object.freeze({id:"D",name:"深渊",cols:16,rows:12,pathGates:20,minCost:5,maxCost:6,minSteps:62}),
  });
  const DIRECTIONS = Object.freeze([[1,0],[-1,0],[0,1],[0,-1]].map((entry)=>Object.freeze(entry)));
  const FORBIDDEN_TILES = /[BGTRK]/;
  const ALLOWED_TILES = /^[.#WHPS]+$/;

  let buildMazeLevel = null;

  function configureMazeApi(mazeApi) {
    if (!mazeApi || typeof mazeApi.buildMazeLevel !== "function") {
      throw new TypeError("Maze API must expose buildMazeLevel(config)");
    }
    buildMazeLevel = mazeApi.buildMazeLevel;
    return true;
  }

  if (initialMazeApi) configureMazeApi(initialMazeApi);

  function normalizeSeedCode(value) {
    if (typeof value !== "string") return null;
    const normalized = value.toUpperCase();
    return CODE_PATTERN.test(normalized) ? normalized : null;
  }

  function normalizeSeedPreset(value) {
    if (typeof value !== "string") return null;
    const normalized = value.toUpperCase();
    return PRESET_PATTERN.test(normalized) ? normalized : null;
  }

  function requireSeedCode(value) {
    const code = normalizeSeedCode(value);
    if (!code) throw new RangeError(`Seed code must contain exactly 6 characters from ${CODE_ALPHABET}`);
    return code;
  }

  function requireSeedPreset(value) {
    const preset = normalizeSeedPreset(value);
    if (!preset) throw new RangeError("Seed preset must be exactly S, M, or D");
    return preset;
  }

  function fnv1a32(text, offset = 0x811C9DC5) {
    let hash = offset >>> 0;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function attemptSeed(code, preset, attempt) {
    return fnv1a32(`broken-path/seeded/v${ALGORITHM_VERSION}/${preset}/${code}/${attempt}`);
  }

  function stableMapHash(map) {
    const text = map.join("\n");
    const left = fnv1a32(`map/v${ALGORITHM_VERSION}/${text}`, 0x811C9DC5);
    const right = fnv1a32(`shape/${map[0].length}x${map.length}/${text}`, 0x9E3779B9);
    return left.toString(16).padStart(8,"0") + right.toString(16).padStart(8,"0");
  }

  function countTile(map, tile) {
    let count = 0;
    for (const row of map) for (const value of row) if (value === tile) count++;
    return count;
  }

  function findTile(map, target) {
    let found = null;
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] !== target) continue;
        if (found) throw new Error(`Generated map contains multiple ${target} tiles`);
        found = [x,y];
      }
    }
    if (!found) throw new Error(`Generated map is missing ${target}`);
    return found;
  }

  class MinHeap {
    constructor() { this.values = []; }
    push(value) {
      const values = this.values;
      values.push(value);
      let index = values.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (compareQueueEntries(values[parent],value) <= 0) break;
        values[index] = values[parent];
        index = parent;
      }
      values[index] = value;
    }
    pop() {
      const values = this.values;
      if (!values.length) return null;
      const first = values[0];
      const last = values.pop();
      if (!values.length) return first;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= values.length) break;
        const right = left + 1;
        const child = right < values.length && compareQueueEntries(values[right],values[left]) < 0 ? right : left;
        if (compareQueueEntries(values[child],last) >= 0) break;
        values[index] = values[child];
        index = child;
      }
      values[index] = last;
      return first;
    }
    get size() { return this.values.length; }
  }

  function compareQueueEntries(left, right) {
    return left[0] - right[0] || left[1] - right[1];
  }

  function solveMap(map) {
    const start = findTile(map,"P");
    const goal = findTile(map,"S");
    const height = map.length;
    const width = map[0].length;
    const distances = Array.from({length:height},()=>Array.from({length:width},()=>[Infinity,Infinity]));
    const queue = new MinHeap();
    distances[start[1]][start[0]] = [0,0];
    queue.push([0,0,start[0],start[1]]);
    while (queue.size) {
      const [cost,steps,x,y] = queue.pop();
      const known = distances[y][x];
      if (cost !== known[0] || steps !== known[1]) continue;
      if (x === goal[0] && y === goal[1]) return {cost,steps};
      for (const [dx,dy] of DIRECTIONS) {
        const nx = x + dx, ny = y + dy, tile = map[ny]?.[nx];
        if (tile == null || tile === "#") continue;
        const nextCost = cost + (tile === "W" ? 1 : 0);
        const nextSteps = steps + 1;
        const previous = distances[ny][nx];
        if (nextCost > previous[0] || (nextCost === previous[0] && nextSteps >= previous[1])) continue;
        distances[ny][nx] = [nextCost,nextSteps];
        queue.push([nextCost,nextSteps,nx,ny]);
      }
    }
    throw new Error("Generated map is not solvable");
  }

  function countStartingItems(map, start) {
    const queue = [start];
    const seen = new Set([start.join(",")]);
    let count = 0;
    for (let index = 0; index < queue.length; index++) {
      const [x,y] = queue[index];
      if ("HBGT".includes(map[y][x])) count++;
      for (const [dx,dy] of DIRECTIONS) {
        const nx=x+dx, ny=y+dy, tile=map[ny]?.[nx], id=`${nx},${ny}`;
        if (tile == null || tile === "#" || tile === "W" || seen.has(id)) continue;
        seen.add(id);
        queue.push([nx,ny]);
      }
    }
    return count;
  }

  function inspectCandidate(level, preset) {
    const map = level?.map;
    if (!Array.isArray(map) || map.length < 3 || !map.every((row)=>typeof row === "string")) {
      throw new Error("Generated level must contain a string map");
    }
    const width = map[0].length;
    if (width < 3 || !map.every((row)=>row.length === width && ALLOWED_TILES.test(row))) {
      throw new Error("Generated map is ragged or contains an unsupported tile");
    }
    if (width !== preset.cols*2+1 || map.length !== preset.rows*2+1) {
      throw new Error("Generated map dimensions do not match the selected preset");
    }
    if (FORBIDDEN_TILES.test(map.join(""))) throw new Error("Generated map contains a forbidden seeded-mode tile");
    if ([...map[0],...map[map.length-1]].some((tile)=>tile !== "#")
      || map.some((row)=>row[0] !== "#" || row[row.length-1] !== "#")) {
      throw new Error("Generated map boundary must be solid stone");
    }
    for (let y=1; y<map.length-1; y++) if (!map[y].includes("W")) throw new Error(`Generated map row ${y} has no wood`);
    for (let x=1; x<width-1; x++) {
      let hasWood=false;
      for (let y=1; y<map.length-1; y++) if (map[y][x] === "W") { hasWood=true; break; }
      if (!hasWood) throw new Error(`Generated map column ${x} has no wood`);
    }
    if (countTile(map,"H") !== 1) throw new Error("Generated map must contain exactly one hammer pickup");
    const start = findTile(map,"P");
    findTile(map,"S");
    if (!Array.isArray(level.start) || level.start[0] !== start[0] || level.start[1] !== start[1]) {
      throw new Error("Generated level start does not match its player tile");
    }
    if (countStartingItems(map,start) !== 1) throw new Error("Generated start region must contain exactly one item");
    const optimal = solveMap(map);
    if (optimal.cost < 3) throw new Error("Generated map cannot express the exact hammer budget with one five-use pickup");
    if (level.optimalBreaks !== optimal.cost || level.optimalToolCost !== optimal.cost) {
      throw new Error("Generated level optimum disagrees with the independent seeded solver");
    }
    return {
      level,
      optimal,
      qualifies:optimal.cost >= preset.minCost && optimal.cost <= preset.maxCost && optimal.steps >= preset.minSteps,
    };
  }

  function rangeDistance(value, minimum, maximum) {
    return value < minimum ? minimum-value : value > maximum ? value-maximum : 0;
  }

  function candidateRank(candidate, preset) {
    const cost = candidate.optimal.cost, steps = candidate.optimal.steps;
    return [
      rangeDistance(cost,preset.minCost,preset.maxCost),
      Math.max(0,preset.minSteps-steps),
      Math.abs(cost-(preset.minCost+preset.maxCost)/2),
      -steps,
      candidate.attempt,
    ];
  }

  function compareRanks(left, right) {
    for (let index=0; index<left.length; index++) if (left[index] !== right[index]) return left[index]-right[index];
    return 0;
  }

  function buildConfig(code, preset, attempt) {
    return {
      name:`种子星图 · ${preset.name} · ${code}`,
      objective:"记住墙体材质，在有限锤击内抵达北极星。",
      lesson:"相同难度与挑战码会生成完全相同的迷宫。",
      hint:"初始区域只有一份锤子补给，拾取后增加 5 次锤击；闪光弹可留给最难确认的路段。",
      cols:preset.cols,
      rows:preset.rows,
      seed:attemptSeed(code,preset.id,attempt),
      pathGates:preset.pathGates,
      startItem:"H",
    };
  }

  function finalizeCandidate(candidate, code, preset, attemptsTried, fallback) {
    const level = candidate.level;
    const optimal = Object.freeze({cost:candidate.optimal.cost,steps:candidate.optimal.steps});
    const totalHammerBudget = optimal.cost + 2;
    const inventory = {
      hammer:totalHammerBudget-5,
      bomb:0,
      flash:1,
      spirit:0,
      torch:0,
      teleport:0,
    };
    const mapHash = stableMapHash(level.map);
    const seeded = {
      algorithmVersion:ALGORITHM_VERSION,
      preset:preset.id,
      code,
      attempt:candidate.attempt,
      attemptsTried,
      fallback,
      mapHash,
      optimal:{...optimal},
      target:{minCost:preset.minCost,maxCost:preset.maxCost,minSteps:preset.minSteps},
      totalHammerBudget,
    };
    return {
      ...level,
      chapter:"seeded",
      challenge:null,
      tutorial:null,
      mandatoryRewards:[],
      memoryPins:0,
      inventory:{...inventory},
      rescueInventory:{...inventory},
      witness:{routeSteps:optimal.steps,optimalToolCost:optimal.cost,hammerUses:optimal.cost,bombUses:0},
      balance:{
        optimalHammerCost:optimal.cost,
        hammerPickups:1,
        optimalHammerReserve:2,
        optimalBombCost:0,
        bombPickups:0,
        optimalBombReserve:0,
      },
      mapHash,
      attempt:candidate.attempt,
      preset:preset.id,
      code,
      optimal:{...optimal},
      seeded,
    };
  }

  function createSeededLevel(codeValue, presetValue) {
    if (!buildMazeLevel) {
      throw new Error("SeededMazeData is not configured; call configureMazeApi() with the maze-levels.js API first");
    }
    const code = requireSeedCode(codeValue);
    const presetId = requireSeedPreset(presetValue);
    const preset = PRESETS[presetId];
    let closest = null, closestRank = null, lastError = null;
    for (let attempt=0; attempt<MAX_ATTEMPTS; attempt++) {
      let candidate;
      try {
        candidate = inspectCandidate(buildMazeLevel(buildConfig(code,preset,attempt)),preset);
      } catch (error) {
        lastError = error;
        continue;
      }
      candidate.attempt = attempt;
      if (candidate.qualifies) return finalizeCandidate(candidate,code,preset,attempt+1,false);
      const rank = candidateRank(candidate,preset);
      if (!closest || compareRanks(rank,closestRank) < 0) {
        closest = candidate;
        closestRank = rank;
      }
    }
    if (!closest) {
      const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
      throw new Error(`Unable to generate any valid seeded maze in ${MAX_ATTEMPTS} attempts${detail}`);
    }
    return finalizeCandidate(closest,code,preset,MAX_ATTEMPTS,true);
  }

  const api = Object.freeze({
    SEEDED_ALGORITHM_VERSION:ALGORITHM_VERSION,
    SEEDED_MAX_ATTEMPTS:MAX_ATTEMPTS,
    SEEDED_CODE_ALPHABET:CODE_ALPHABET,
    SEEDED_PRESETS:PRESETS,
    normalizeSeedCode,
    normalizeSeedPreset,
    configureMazeApi,
    createSeededLevel,
  });
  return api;
});
