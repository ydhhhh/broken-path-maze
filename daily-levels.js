(function (root) {
  "use strict";

  const BANK_VERSION = 1;
  const PERIOD_DAYS = 96;
  const DAY_MS = 86400000;
  const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const TRANSFORMS = ["original", "mirrorX", "mirrorY", "rotate180"];
  const BASE_ORDER = [0, 5, 2, 7, 4, 1, 6, 3];
  const EPOCH_ORDINAL = dateOrdinal(2026, 1, 1);

  const CONTRACTS = [
    {
      id:"flash", name:"一闪契约", tool:"flash",
      description:"仅有 1 枚闪光弹：选中后点击迷宫任意位置，可暂时看清全图墙材质。",
    },
    {
      id:"torch", name:"一束契约", tool:"torch",
      description:"仅有 1 个手电筒：光带首次揭示至少一面此前未知墙材才会消耗，并计为契约使用。",
    },
    {
      id:"spirit", name:"幽行契约", tool:"spirit",
      description:"仅有 1 张灵魂出窍卡：进入身体原视野外的新连通区才会消耗；立即返回会返还卡片。",
    },
  ];

  const BASE_LEVELS = [
    {
      id:"daily-01", name:"折影回廊", seed:1082, optimalCost:4, optimalSteps:48, hammerBudget:5,
      hashes:[
        "c5265565abf1787703cfd212fb3887b82c8e2b7caeedc37747a3943b65e1e55c",
        "c13e5c95f3723e6773a60b450dd4571d0019817f14f6e2154f3265f686675df8",
        "7206728e9da31bac0158a5e45e0bf9fbce2fd92c0372b254c68f75490d5ab02d",
        "9a3b55266262e31346d8037387b022f7eb92499b4f5ff02f2189f994308d3409",
      ],
      map:[
        "#################",
        "#.W...W.....#..S#",
        "#.WW#.#W#.WW#.#W#",
        "#...W...W.#.W...#",
        "#.#.#WW#W#W.#.#W#",
        "#.#.#.#.....#.W.#",
        "#WWW#.WW#W#W#.#.#",
        "#...#.#.....W.W.#",
        "#.W#W.W##WW.W##.#",
        "#.#...W...#.W...#",
        "#.#.#.#.#.#WWW#.#",
        "#P#.#...W.......#",
        "#################",
      ],
    },
    {
      id:"daily-02", name:"暗潮折径", seed:27176, optimalCost:5, optimalSteps:70, hammerBudget:6,
      hashes:[
        "9ecbcd1aff5d414fc0f7385e9204c928cc7a2b1178c9e4b27c2bce9eae011221",
        "8e31cfe16886ec0e285775f2e618a339bf6ccebdf6cff5a6bd64abccd4cc4315",
        "e1e9028cd69bca84a2ce54f1bc597ec07ff7ddd8c019e0de8e764ad29d241fe5",
        "7b83e5d8eaf5856cffc8ef93066dbd600633b7979026f4b4ea4d0d9fa6870c0a",
      ],
      map:[
        "###################",
        "#.W...........#..S#",
        "#.#.WW#W#.#.W#W.WW#",
        "#.#.....#.W.W...#.#",
        "#.W#W#W.W.#.#.WWW.#",
        "#...W...#.#.#.#.#.#",
        "#W#.W.#W#.#W#.W.WW#",
        "#...#.#.W.....#.W.#",
        "#.#WW.#.#W#W##W.#.#",
        "#...............W.#",
        "########W##WWW#.#W#",
        "#.W.#.W.#.......W.#",
        "#.W.#.W.W#WWWW##W.#",
        "#P#.W.W.W...W...W.#",
        "###################",
      ],
    },
    {
      id:"daily-03", name:"碎月环廊", seed:16189, optimalCost:5, optimalSteps:58, hammerBudget:6,
      hashes:[
        "3071cbb4749143054bce051732602e3096a807ab6780dbcab9b6caf364bcf8fb",
        "e83c167ce61d38368c1f2aa87c75eea964a27c1f441751731cf1b3c8921c28d3",
        "51438f5141ef3bed3d86a73fc7d385014c84527de0be8ba6caabad278d299570",
        "8177220ab58f2068a35efd286737a20bd3217fef7ccb1747e26cdbdcec0fccc9",
      ],
      map:[
        "#####################",
        "#.........W...W....S#",
        "#.###.#W#W#.#.#W#W#.#",
        "#.#...#.....#.W.#...#",
        "#.#WW.W.###W#WW.#.WW#",
        "#...W.#...#...#.#.#.#",
        "#W#.#WW.##WW#WW.#.#.#",
        "#...#...W...W...W...#",
        "#.W##.#W#W###.##WW#.#",
        "#.......#.W.......#.#",
        "#########.WW##WW#.W.#",
        "#.W.#...#.#.......W.#",
        "#.#.#.#WWW#.##W#W#W.#",
        "#PW.W.#...#.........#",
        "#####################",
      ],
    },
    {
      id:"daily-04", name:"逆光石庭", seed:23894, optimalCost:6, optimalSteps:60, hammerBudget:7,
      hashes:[
        "92d9278273fdb122d11b87cfcac06d875197772556652d7eae920c7b0b6e5003",
        "c4aac745072bad2c164d52a4e62427eac64cee4361b7b3f9e05e16c8d4757ce7",
        "e5deabe465324bd611777cb285f539907064468794e764d25a85be1898f76943",
        "e6d54da8f3a3d917d1a6cdae9b4891229cdb720a192efec3f0debaaedca6f6e0",
      ],
      map:[
        "#####################",
        "#...W.......W.#....S#",
        "#.#.#.#W#W#.W.W###W.#",
        "#.#.......W.W.W.....#",
        "#.###W#W###.#WWWWWW.#",
        "#...#...W.#.#.W.....#",
        "###.W.##W.WW#.W.W##W#",
        "#...#.W.#...#.W...#.#",
        "#.WW###.##W##.###.#.#",
        "#.....W...#.......#.#",
        "#WW.#####W#.W#W###W.#",
        "#.#.#...W.#...#.....#",
        "#.#.#.WW#.#WW.W.#W#.#",
        "#...#.W.W.#...#.W...#",
        "####WWW.#W#.#####.#.#",
        "#P....W...#.......#.#",
        "#####################",
      ],
    },
    {
      id:"daily-05", name:"雾桥回声", seed:1131, optimalCost:4, optimalSteps:76, hammerBudget:5,
      hashes:[
        "2e5eb942f02fbd4d3f0b6667b62576485e9218d208511cfd2048bf38b12b91f4",
        "73eb593fb07633075872175ffaa54a9af3af60b8e315b77ceb3137145929d448",
        "c8c6c948540ffbb27c714d0ae618ff0a9dfaf6d616fe7c8f265ae4bc442d990e",
        "03564005963a82166ae3efe1e966949cb0d0bf84d535aea69975a6879ca9070b",
      ],
      map:[
        "#######################",
        "#...........W.......#S#",
        "#.#WW##.WWWW#.#W#WWWW.#",
        "#.#.....W.......W.#...#",
        "#.#.##W#W.WW#####.#W#.#",
        "#.W.....#...#...W.W.W.#",
        "#.####W.#W#.W.#W#W#.#.#",
        "#.....#...#.W.W...W...#",
        "##WW#WW#W.#.#W#WW.#.WW#",
        "#...W.#...#.#...W.#.#.#",
        "#WWWW.#.WWW.#W#W#.#.#.#",
        "#.#...#.....W...W...#.#",
        "#.#W#W####W#WWWW#.#W#.#",
        "#...#...W...#.W.#...#.#",
        "#WWWWW#W#W#.#.W.#WW.W.#",
        "#P..#.......W.W.......#",
        "#######################",
      ],
    },
    {
      id:"daily-06", name:"暗星曲廊", seed:1019, optimalCost:4, optimalSteps:80, hammerBudget:5,
      hashes:[
        "666a2ab3dc28ef5a24fd647aecdc578a8672d73b50c2dd7b0c92dffa908d65bf",
        "814b4c5d8fe23e8f199bbe88d0198bfa5c4f51231e2e80daadb8ddcf5d3d2a17",
        "a74051366b92bfd38c7f74da6bc5a65692215ca7f7f24eb1e4b72b1521d14b87",
        "ed5a1667a6b19aed496e3ad3b25fcc10d6e7c37fd7fe58b6a3772406815358fd",
      ],
      map:[
        "#######################",
        "#.....W...W..........S#",
        "#W#.#WW##.WW##W####.#W#",
        "#.W.W...W.#.W.....#...#",
        "#.#WW.#W#W#.WWW##W#W#W#",
        "#.W.........#...#.....#",
        "#.#W#####WW##.#.W#WW#.#",
        "#.#.W...W.#...#.W.....#",
        "#WW.###.#.W.W.#W#.###W#",
        "#.....#.W...W...#...W.#",
        "#####.#WW.#WWWW.###.W.#",
        "#...#.W.#.W...#.W...#.#",
        "#W#.#WW.#.#.#.#.#.W#W.#",
        "#.#.W...#.#.#...W...#.#",
        "#.#W#W#WW.#.WWWW#W#.#.#",
        "#.#.#...W.W.....#...#.#",
        "#.#.#W#.#.WWW##.#.WWW.#",
        "#PW...W.#.....#.......#",
        "#######################",
      ],
    },
    {
      id:"daily-07", name:"余灯长径", seed:266, optimalCost:4, optimalSteps:78, hammerBudget:5,
      hashes:[
        "0dc1e9f63b2795d88d0968b896088b97711c0ceaa7b29ae95a81c5dddd1a2f68",
        "110751b124e3ec03aa090c40c464d48a1b6e2fa5b5d9c1628ab91ac3ff341430",
        "44ca820457268bb047a1a232a2bdcab1d15d466dad4db90cc831a876e0389961",
        "8632bc203e1d7abd5b0f538d0b4b07b51770f328c289595cbdeb72cfdac1d52c",
      ],
      map:[
        "#########################",
        "#.....W.#.W.W..........S#",
        "#.W##W#.#.W.#.#W#WWW#.#W#",
        "#.W...#...#.#.......W...#",
        "#.#W#.W#WWW.#####WW.###.#",
        "#.W.W...W.....W.#...#.W.#",
        "#.#.##WWWW##WW#.W.W#W.W.#",
        "#.#...W...W.....#...#.#.#",
        "#.###.###.WW##W####.#.###",
        "#.......#.W.W...#...#...#",
        "####WW##W.W.#.W.#W#W###W#",
        "#.....W.#.W.#.#.W.......#",
        "#.##WW#.#W#.#WW#W####W#.#",
        "#.W.....#.W...#.....#...#",
        "#W#WW.#WW.WWW##.#W##W.###",
        "#...#.W...#.W.......#...#",
        "#W#.#WWW#.#.#.WW#WW.W##.#",
        "#P..#.....W.......#.....#",
        "#########################",
      ],
    },
    {
      id:"daily-08", name:"夜纹迷城", seed:447, optimalCost:4, optimalSteps:80, hammerBudget:5,
      hashes:[
        "8f02130683b091d6dcab77bd02d6fe6cc77a7f270f1ac05e25acc491fe6858a6",
        "5e36cdfebf3af87853356bbc4ca47d682fb2df8b0ea04574fdc8bc5348368c42",
        "64639e6f54457cd44bd1e69c28535757b61f02f3e3707c007850818129e82dac",
        "a4f776ef325d1193eef86656d8393052a90bb99e9a2328cb21d880876395061b",
      ],
      map:[
        "#########################",
        "#.....W...W...W.W.W....S#",
        "#W##WWW#W#####W.W.W##WW##",
        "#...W.#.......#.W.W.....#",
        "#.W#W.W.###W###.W####W#W#",
        "#...W.#.#.....#.W...W...#",
        "##WW#W#.W.#W#.##WW#W##W.#",
        "#.W...#...W.#.....#...W.#",
        "#.WWWW#.#W#.#WW.W##.#.W.#",
        "#...W.#...W...W.W...#...#",
        "#.#WW.###.#.W.#.#.#####W#",
        "#.#.#...#...#.W.W.#.....#",
        "#W#.W.#WW##WW.#.#.#.#W#.#",
        "#.W.#.....W...W...#.W...#",
        "#.WWW.WW#.#.W##WWWW.WWW.#",
        "#.W.#...W...#.....W...#.#",
        "#W#.#WW.###WWW#.W.##W.#.#",
        "#P..#...........#.....W.#",
        "#########################",
      ],
    },
  ];

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function dateOrdinal(year, month, day) {
    const date = new Date(Date.UTC(2000, month - 1, day));
    date.setUTCFullYear(year);
    return Math.floor(date.getTime() / DAY_MS);
  }

  function parseDailyDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const probe = new Date(Date.UTC(2000, month - 1, day));
    probe.setUTCFullYear(year);
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    return { value, year, month, day, ordinal:Math.floor(probe.getTime() / DAY_MS) };
  }

  function todayInShanghai(now = Date.now()) {
    const timestamp = now instanceof Date ? now.getTime() : Number(now);
    if (!Number.isFinite(timestamp)) throw new TypeError("Invalid time");
    return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  }

  function dateValueFromOrdinal(ordinal) {
    if (!Number.isInteger(ordinal)) throw new TypeError("Daily ordinal must be an integer");
    const probe = new Date(ordinal * DAY_MS);
    const year = probe.getUTCFullYear();
    if (year < 1 || year > 9999) throw new RangeError("Daily date is outside the supported calendar");
    return `${String(year).padStart(4,"0")}-${String(probe.getUTCMonth()+1).padStart(2,"0")}-${String(probe.getUTCDate()).padStart(2,"0")}`;
  }

  function recentDailyDates(endDate = todayInShanghai(), count = 7) {
    const parsed = parseDailyDate(endDate);
    if (!parsed) throw new RangeError("Daily window end must be a real YYYY-MM-DD calendar date");
    if (!Number.isInteger(count) || count < 1 || count > 31) throw new RangeError("Daily window count must be an integer from 1 to 31");
    const dates = [];
    for (let offset = count - 1; offset >= 0; offset--) dates.push(dateValueFromOrdinal(parsed.ordinal - offset));
    return dates;
  }

  function transformMap(map, transformIndex) {
    const rows = map.slice();
    if (transformIndex === 0) return rows;
    if (transformIndex === 1) return rows.map((row) => [...row].reverse().join(""));
    if (transformIndex === 2) return rows.reverse();
    if (transformIndex === 3) return rows.reverse().map((row) => [...row].reverse().join(""));
    throw new RangeError("Invalid daily transform");
  }

  function findTile(map, tile) {
    for (let y = 0; y < map.length; y++) {
      const x = map[y].indexOf(tile);
      if (x >= 0) return [x, y];
    }
    throw new Error(`Daily map is missing ${tile}`);
  }

  function dailySchedule(dateValue) {
    const parsed = parseDailyDate(dateValue);
    if (!parsed) throw new RangeError("Daily date must be a real YYYY-MM-DD calendar date");
    const cycle = mod(parsed.ordinal - EPOCH_ORDINAL, PERIOD_DAYS);
    const baseIndex = BASE_ORDER[cycle % BASE_ORDER.length];
    const transformIndex = Math.floor(cycle / BASE_ORDER.length) % TRANSFORMS.length;
    const contractIndex = cycle % CONTRACTS.length;
    return {
      date:parsed.value, cycle, baseIndex, baseId:BASE_LEVELS[baseIndex].id,
      transformIndex, transform:TRANSFORMS[transformIndex], contractIndex, contractId:CONTRACTS[contractIndex].id,
    };
  }

  function getDailyChallenge(dateValue = todayInShanghai()) {
    const schedule = dailySchedule(dateValue);
    const base = BASE_LEVELS[schedule.baseIndex];
    const contract = CONTRACTS[schedule.contractIndex];
    const map = transformMap(base.map, schedule.transformIndex);
    const inventory = {hammer:base.hammerBudget,bomb:0,flash:0,spirit:0,torch:0,teleport:0};
    inventory[contract.tool] = 1;
    const start = findTile(map, "P");
    const daily = {
      bankVersion:BANK_VERSION, date:schedule.date, cycle:schedule.cycle,
      baseIndex:schedule.baseIndex, baseId:base.id, seed:base.seed,
      transformIndex:schedule.transformIndex, transform:schedule.transform,
      contractIndex:schedule.contractIndex,
      contract:{id:contract.id,name:contract.name,tool:contract.tool,description:contract.description},
      hash:base.hashes[schedule.transformIndex],
      optimalCost:base.optimalCost, optimalSteps:base.optimalSteps, hammerBudget:base.hammerBudget,
    };
    return {
      name:base.name,
      objective:`有效使用 1 次${{flash:"闪光弹",torch:"手电筒",spirit:"灵魂出窍卡"}[contract.tool]}，完成「${contract.name}」并抵达星星；尽量只敲开 ${base.optimalCost} 面木墙。`,
      lesson:"每日题不使用计时排名；契约完美还要求有效使用 1 次当天道具。",
      hint:contract.description,
      chapter:"daily",
      map,
      start,
      tutorial:null,
      challenge:null,
      mandatoryRewards:[],
      memoryPins:0,
      optimalBreaks:base.optimalCost,
      optimalToolCost:base.optimalCost,
      recommended:base.optimalCost,
      witness:{routeSteps:base.optimalSteps,optimalToolCost:base.optimalCost,hammerUses:base.optimalCost,bombUses:0},
      balance:{
        optimalHammerCost:base.optimalCost,hammerPickups:0,optimalHammerReserve:1,
        optimalBombCost:0,bombPickups:0,optimalBombReserve:0,
      },
      maze:{seed:base.seed,width:map[0].length,height:map.length},
      rescueInventory:{...inventory},
      inventory,
      daily,
    };
  }

  const api = {
    DAILY_BANK_VERSION:BANK_VERSION,
    DAILY_PERIOD_DAYS:PERIOD_DAYS,
    DAILY_TRANSFORMS:[...TRANSFORMS],
    DAILY_CONTRACTS:CONTRACTS.map((contract)=>({...contract})),
    parseDailyDate,
    todayInShanghai,
    recentDailyDates,
    dailySchedule,
    getDailyChallenge,
  };

  root.DailyMazeData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
