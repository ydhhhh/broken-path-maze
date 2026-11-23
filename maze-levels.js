(function (root) {
  "use strict";

  const CONFIGS = [
    { name:"石径初醒", objective:"让灵魂先穿墙侦察，再完成第一次破壁。", lesson:"灵魂负责看清边界，身体返回后再敲开木墙。", hint:"先按教学让灵魂查看墙后区域，再拾取锤子并敲开它右上方的木墙。", cols:6, rows:4, seed:6, pathGates:3, startItem:"H", mandatoryItems:["H"], rewardSeal:true, tutorial:"first" },
    { name:"岔路留锤", objective:"学习用手电筒保留一条关键方向的墙体信息。", lesson:"定向光带能减轻后续路线的记忆压力。", hint:"先收下入口锤，再选择手电筒照向关键墙。", cols:7, rows:5, seed:38964, pathGates:5, startItem:"H", mandatoryItems:["B"], fixedMandatoryItems:[[13,5]], rewardSeal:true, tutorial:"torch" },
    { name:"回声长廊", objective:"在更长的走廊中连续找出关键破口。", lesson:"用新点亮的区域校准下一段记忆。", hint:"先收下入口锤；之后一次只记下一道关键墙。", cols:8, rows:6, seed:8096, pathGates:7, startItem:"H", mandatoryItems:["H"], fixedMandatoryItems:[[4,11]], rewardSeal:true },
    { name:"纵横迷城", objective:"识别进入内部的石墙，避免无效锤击。", lesson:"黑墙相同，碰撞结果却不同。", hint:"先收下入口锤，再回想石块与木纹的相对位置。", cols:10, rows:7, seed:28219, pathGates:9, startItem:"H", mandatoryItems:["B"], fixedMandatoryItems:[[7,13]], rewardSeal:true },
    { name:"灵魂越界", objective:"离开身体穿墙侦察，再带着答案返回。", lesson:"灵魂改变视野，不改变真实道路。", hint:"让灵魂穿过边界墙，观察另一片连通区域。", cols:10, rows:8, seed:1124, pathGates:10, startItem:"G", mandatoryItems:["B"], fixedMandatoryItems:[[6,15]], rewardSeal:true, bonusItems:["T"] },
    { name:"一束常亮", objective:"让手电光带首次揭示至少一面此前未知材质的墙，再完成第一次长路线复盘。", lesson:"只有照出此前未知墙材的光带，才算一次有效手电使用。", hint:"把光带留给尚未看清材质的边界；照向全是已知墙材的方向不会计入印记。", cols:11, rows:8, seed:4157, pathGates:11, startItem:"G" },
    { name:"黑墙回廊", objective:"让灵魂进入身体原视野外的新连通区，再按侦察结果跨过四道关键断点。", lesson:"只有进入身体原视野外的新连通区，灵魂卡才会消耗并计为有效。", hint:"让灵魂真正穿过边界进入新连通区；离体后立即返回不算使用。", cols:11, rows:9, seed:7260, pathGates:12, startItem:"G" },
    { name:"错位石阵", objective:"用转角和道具位置建立坐标，辨认错位结构中的正确破口。", lesson:"可靠的地标比记住整张图更能抵抗相似结构。", hint:"每进入新区，先确认最近的转角和星星方位。", cols:12, rows:9, seed:2472, pathGates:13, startItem:"G" },
    { name:"双重回望", objective:"把长路线分成前后两段：手电照出未知墙材，灵魂进入身体原视野外的新连通区。", lesson:"两种信息道具都必须带来新信息，才能把艰难记忆拆成可靠的局部判断。", hint:"把手电留给未知边界，再让灵魂真正越界侦察后半段密集转角。", cols:12, rows:10, seed:14732, pathGates:14, startItem:"H", bonusItems:["G","T"] },
    { name:"沉默棋盘", objective:"规划五次必要破壁，并在闪光校准后让灵魂进入身体原视野外的新连通区。", lesson:"闪光负责全局校准；灵魂只有真正越界带回新信息，才算完成协作。", hint:"先用闪光确认全局，再让灵魂进入身体原视野之外的新连通区，最后执行五次破壁。", cols:13, rows:10, seed:15613, pathGates:15, startItem:"H", mandatoryItems:["G"] },
    { name:"折返星路", objective:"沿星光反方向完成折返，再从远端重新接近终点。", lesson:"终点方位只是参照，不是每一步的导航答案。", hint:"若一面墙只让你更靠近星星，却没有扩展主路，先侦察。", cols:14, rows:10, seed:9045, pathGates:16, startItem:"H", bonusItems:["G"] },
    { name:"三段迷界", objective:"把十八片区域拆成三段记忆任务，逐段重建局部坐标。", lesson:"长迷宫的稳定解法是不断压缩问题，而不是一次记住全部。", hint:"每次破墙后停一下：确认来路、下一道边界和星星方位。", cols:14, rows:11, seed:12559, pathGates:17, startItem:"H" },
    { name:"幽影纵横", objective:"进入终局第一幕，让灵魂进入身体原视野外的新连通区后再执行密集转折路线。", lesson:"身体位置是返回锚点；只有越过原视野边界带回新信息，灵魂卡才会消耗并计为有效。", hint:"让灵魂进入下一片身体原本看不到的连通区，确认关键边界后立即返回执行。", cols:15, rows:11, seed:3961, pathGates:18, startItem:"H", mandatoryItems:["G","G"], bonusItems:["T"] },
    { name:"无光长城", objective:"进入终局第二幕，跨越六道必要边界并守住最后的锤击储备。", lesson:"越接近终点，错误破壁越会放大此前的资源压力。", hint:"先排除石墙与无效支路，再连续执行已经确认的六次破壁。", cols:16, rows:11, seed:7667, pathGates:19, startItem:"H", bonusItems:["G"] },
    { name:"终焉星宫", objective:"完成最长标准路线，综合运用记忆、照明、侦察与资源规划。", lesson:"看清、分段、判断、破壁——整条星路由你重新连接。", hint:"把终局拆成最后三段；每抵达新区，就重新确认下一处唯一目标。", cols:16, rows:12, seed:15226, pathGates:20, startItem:"H", bonusItems:["H","G"] },
    {
      name:"余烬初醒", objective:"在余烬星路使用两枚记忆钉，重新校准长途破壁节奏。",
      lesson:"记忆钉不会替你判断墙体，但能把漫长路线拆成可靠的返回锚点。", hint:"先用灵魂看清入口与中段墙材并放下两枚记忆钉，再沿最少六次锤击的主路前进。",
      cols:16,rows:12,seed:5252,pathGates:23,startItem:"H",chapter:"ember",memoryPins:2,
      optimalToolCost:6,hammerUses:6,bombUses:0,crackedWalls:[],shardPositions:[],harden:[],
      rescueInventory:{hammer:10,bomb:3,flash:0,spirit:3,torch:1,teleport:2},
      witness:{routeSteps:94,optimalToolCost:6,hammerUses:6,bombUses:0,woodBreaks:6,crackedBreaks:0,
        pins:[[2,21],[22,8]],actions:[
        {type:"hammer",from:[3,21],wall:[2,21]}, {type:"hammer",from:[21,8],wall:[22,8]},
        {type:"hammer",from:[23,6],wall:[24,6]}, {type:"hammer",from:[24,6],wall:[25,6]},
        {type:"hammer",from:[27,7],wall:[28,7]}, {type:"hammer",from:[29,5],wall:[29,4]},
      ]},
    },
    {
      name:"裂火门扉", objective:"第一次用炸弹击穿裂石，并分辨爆破与锤击的资源边界。",
      lesson:"裂石拒绝锤击，却会被邻近地面的爆破震碎。", hint:"保留炸弹直到终点前的孤立裂石，沿途只敲五面关键木墙。",
      cols:16,rows:12,seed:19849,pathGates:24,startItem:"B",mandatoryItems:["H"],chapter:"ember",memoryPins:2,
      optimalToolCost:8,hammerUses:5,bombUses:1,crackedWalls:[[30,1]],shardPositions:[],harden:[[31,2],[28,3]],
      rescueInventory:{hammer:9,bomb:3,flash:0,spirit:3,torch:1,teleport:2},
      witness:{routeSteps:102,optimalToolCost:8,hammerUses:5,bombUses:1,woodBreaks:5,crackedBreaks:1,
        pins:[[7,20],[30,1]],actions:[
        {type:"hammer",from:[7,21],wall:[7,20]}, {type:"hammer",from:[7,20],wall:[8,20]},
        {type:"hammer",from:[8,20],wall:[9,20]}, {type:"hammer",from:[15,23],wall:[16,23]},
        {type:"hammer",from:[21,23],wall:[22,23]}, {type:"bomb",from:[29,1],center:[29,1],targets:[[30,1]]},
      ]},
    },
    {
      name:"双屑回声", objective:"收集两枚星屑后再触碰星星，完成第一次多终端路线规划。",
      lesson:"终点不再是唯一目标；先决定星屑顺序，才能避免昂贵折返。", hint:"两枚星屑分处主干两侧，先取近端，再沿七道木墙连向星星。",
      cols:16,rows:12,seed:27339,pathGates:24,startItem:"H",chapter:"ember",memoryPins:2,
      fixedStartItem:[1,22],
      optimalToolCost:7,hammerUses:7,bombUses:0,crackedWalls:[],shardPositions:[[13,9],[9,17]],harden:[],
      rescueInventory:{hammer:9,bomb:3,flash:0,spirit:3,torch:1,teleport:2},
      witness:{routeSteps:118,optimalToolCost:7,hammerUses:7,bombUses:0,woodBreaks:7,crackedBreaks:0,
        pins:[[1,20],[2,18]],actions:[
        {type:"hammer",from:[1,21],wall:[1,20]}, {type:"hammer",from:[2,19],wall:[2,18]},
        {type:"hammer",from:[3,17],wall:[4,17]}, {type:"hammer",from:[7,17],wall:[7,16]},
        {type:"hammer",from:[7,16],wall:[8,16]}, {type:"hammer",from:[9,13],wall:[10,13]},
        {type:"hammer",from:[11,9],wall:[12,9]},
      ]},
    },
    {
      name:"双裂巡星", objective:"找出同时覆盖两道裂纹门的唯一爆心，在双星屑巡回中守住炸弹储备。",
      lesson:"炸弹的范围不是装饰；真正的谜题是用一个爆心解决两道必经门。", hint:"拾取入口炸弹后先别移动：比较脚下与左侧地面的 3×3 覆盖范围。",
      cols:16,rows:12,seed:21161,pathGates:24,startItem:"B",mandatoryItems:["H"],fixedMandatoryItems:[[5,17]],chapter:"ember",memoryPins:2,
      extraFloor:[[4,21],[5,22]],harden:[[6,22],[4,20],[4,23],[30,1]],extraWood:[[4,21],[31,2]],
      crackedWalls:[[3,22],[4,21]],shardPositions:[[3,23],[21,23]],
      optimalToolCost:8,hammerUses:5,bombUses:1,
      rescueInventory:{hammer:7,bomb:3,flash:0,spirit:3,torch:1,teleport:2},
      witness:{routeSteps:140,optimalToolCost:8,hammerUses:5,bombUses:1,woodBreaks:5,crackedBreaks:2,
        pins:[[4,21],[3,22]],actions:[
        {type:"bomb",from:[3,21],center:[3,21],targets:[[4,21],[3,22]]},
        {type:"hammer",from:[5,17],wall:[4,17]},
        {type:"hammer",from:[19,21],wall:[19,22]}, {type:"hammer",from:[21,23],wall:[22,23]},
        {type:"hammer",from:[31,7],wall:[31,6]}, {type:"hammer",from:[31,3],wall:[31,2]},
      ]},
    },
    {
      name:"余烬星环", objective:"完成三枚星屑的终局巡回，并以两次精确爆破封印余烬星路。",
      lesson:"终局难度来自目标顺序、长距离折返与资源收束，而不是盲目增加墙数。", hint:"先取西侧星屑，再深入东南远端；两道裂石都应单独爆破。",
      cols:16,rows:12,seed:18344,pathGates:25,startItem:"H",mandatoryItems:["H"],chapter:"ember",memoryPins:2,
      optimalToolCost:13,hammerUses:7,bombUses:2,crackedWalls:[[5,22],[31,6]],
      shardPositions:[[23,19],[5,13],[11,17]],harden:[
        [26,1],[26,3],[27,4],[29,4],[30,5],[12,6],[13,6],[29,6],[14,7],[28,7],[30,8],
        [16,9],[20,9],[22,9],[7,10],[17,10],[18,10],[19,10],[23,10],[31,10],[24,11],
        [30,11],[27,14],[31,14],[2,15],[4,15],[4,17],[2,18],
      ],
      extraWood:[[12,17],[23,20],[29,11]],
      rescueInventory:{hammer:7,bomb:3,flash:0,spirit:3,torch:1,teleport:2},
      witness:{routeSteps:224,optimalToolCost:13,hammerUses:7,bombUses:2,woodBreaks:7,crackedBreaks:2,
        pins:[[5,22],[31,6]],actions:[
        {type:"bomb",from:[5,23],center:[5,23],targets:[[5,22]]},
        {type:"hammer",from:[3,21],wall:[3,20]}, {type:"hammer",from:[3,19],wall:[4,19]},
        {type:"hammer",from:[23,21],wall:[23,20]}, {type:"hammer",from:[13,17],wall:[12,17]},
        {type:"hammer",from:[29,15],wall:[29,14]}, {type:"hammer",from:[29,12],wall:[29,11]},
        {type:"hammer",from:[31,9],wall:[31,8]},
        {type:"bomb",from:[31,7],center:[31,7],targets:[[31,6]]},
      ]},
    },
  ];

  const CHALLENGES = [
    null,
    null,
    null,
    null,
    null,
    {
      type:"oneTorch", name:"一束足矣",
      description:"恰好完成 1 次有效手电照明（光带首次揭示至少一面此前未知墙材），不使用闪光、灵魂或瞬移。",
      requirements:{ stars:{exact:3}, usage:{torch:{exact:1},flash:{exact:0},spirit:{exact:0},teleport:{exact:0}} },
    },
    {
      type:"spiritSolo", name:"幽灵独行",
      description:"恰好完成 1 次有效灵魂侦察（进入身体原视野外的新连通区），不使用闪光、手电或瞬移，并且零误敲。",
      requirements:{ stars:{exact:3}, usage:{spirit:{exact:1},flash:{exact:0},torch:{exact:0},teleport:{exact:0}}, mistakes:{max:0} },
    },
    {
      type:"oneFlash", name:"一闪定阵",
      description:"恰好使用 1 次闪光，不使用手电、灵魂或瞬移。",
      requirements:{ stars:{exact:3}, usage:{flash:{exact:1},torch:{exact:0},spirit:{exact:0},teleport:{exact:0}} },
    },
    {
      type:"dualVision", name:"双重回望",
      description:"恰好完成 1 次有效灵魂侦察与 1 次有效手电照明，两者都须带来此前未知信息；不使用闪光或瞬移。",
      requirements:{ stars:{exact:3}, usage:{spirit:{exact:1},torch:{exact:1},flash:{exact:0},teleport:{exact:0}} },
    },
    {
      type:"flashSpirit", name:"明魂合谋",
      description:"恰好使用 1 次闪光，并完成 1 次进入身体原视野外新连通区的有效灵魂侦察；不使用手电或瞬移。",
      requirements:{ stars:{exact:3}, usage:{flash:{exact:1},spirit:{exact:1},torch:{exact:0},teleport:{exact:0}} },
    },
    {
      type:"memory", name:"无光折返",
      description:"不使用闪光、手电、灵魂或瞬移完成本关。",
      requirements:{ stars:{exact:3}, usage:{flash:{exact:0},torch:{exact:0},spirit:{exact:0},teleport:{exact:0}} },
    },
    {
      type:"swiftRoute", name:"九十步界",
      description:"在 90 步内抵达星星。",
      requirements:{ stars:{exact:3}, steps:{max:90} },
    },
    {
      type:"spiritReserve", name:"幽影留种",
      description:"恰好完成 1 次进入身体原视野外新连通区的有效灵魂侦察、零误敲，并在终点保留至少 1 张灵魂卡。",
      requirements:{ stars:{exact:3}, usage:{spirit:{exact:1}}, mistakes:{max:0}, inventory:{spirit:{min:1}} },
    },
    {
      type:"sealedStride", name:"百步守契",
      description:"在 100 步内完成本关，并在终点保留至少 2 张瞬移卡。",
      requirements:{ stars:{exact:3}, steps:{max:100}, inventory:{teleport:{min:2}} },
    },
    {
      type:"masterReserve", name:"十锤终焉",
      description:"在 110 步内零误敲，不使用炸弹、闪光、灵魂、手电或瞬移，并保留至少 10 次锤击。",
      requirements:{
        stars:{exact:3}, steps:{max:110}, mistakes:{max:0},
        usage:{bomb:{exact:0},flash:{exact:0},spirit:{exact:0},torch:{exact:0},teleport:{exact:0}},
        inventory:{hammer:{min:10}},
      },
    },
    {
      type:"emberPins",name:"余烬刻痕",description:"不使用闪光，恰好使用 2 枚记忆钉并以三星完成本关。",
      requirements:{stars:{exact:3},pins:{exact:2},usage:{flash:{exact:0}}},
    },
    {
      type:"singleCrack",name:"孤裂定爆",description:"恰好使用 1 枚炸弹和 2 枚记忆钉、不用瞬移，并且零误敲。",
      requirements:{stars:{exact:3},usage:{bomb:{exact:1},teleport:{exact:0}},pins:{exact:2},mistakes:{max:0}},
    },
    {
      type:"shardOrder",name:"双屑无误",description:"在 126 步内收齐 2 枚星屑后再触星，全程不提前碰星。",
      requirements:{stars:{exact:3},shards:{exact:2},steps:{max:126},prematureStarTouches:{max:0}},
    },
    {
      type:"twinCrack",name:"一爆双裂",description:"零误敲且不提前触星；收齐 2 枚星屑，用 1 枚炸弹同时击破 2 面裂纹墙，并让 2 枚记忆钉都随爆破解决。",
      requirements:{
        stars:{exact:3},shards:{exact:2},usage:{bomb:{exact:1}},
        maxBlastYield:{min:2},maxBlastPinnedYield:{exact:2},
        mistakes:{max:0},prematureStarTouches:{max:0},
      },
    },
    {
      type:"emberMaster",name:"余烬守藏",description:"零误敲且不提前触星，收齐 3 枚星屑；恰好使用 2 枚炸弹和 2 枚记忆钉、不用瞬移，并保留至少 10 锤和 1 炸弹。",
      requirements:{
        stars:{exact:3},shards:{exact:3},pins:{exact:2},prematureStarTouches:{max:0},mistakes:{max:0},
        usage:{bomb:{exact:2},teleport:{exact:0}},
        inventory:{hammer:{min:10},bomb:{min:1}},
      },
    },
  ];

  function seededRandom(seed) {
    let value=seed>>>0;
    return function(){
      value+=0x6D2B79F5;
      let t=value;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function shuffle(values,random) {
    const copy=values.slice();
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
    return copy;
  }

  function carvePerfectMaze(cols,rows,seed) {
    const width=cols*2+1,height=rows*2+1;
    const grid=Array.from({length:height},()=>Array(width).fill("#"));
    const visited=Array.from({length:rows},()=>Array(cols).fill(false));
    const random=seededRandom(seed);
    const stack=[[0,rows-1]];
    visited[rows-1][0]=true;
    grid[height-2][1]=".";
    while(stack.length){
      const [cx,cy]=stack[stack.length-1];
      const choices=shuffle([[1,0],[-1,0],[0,1],[0,-1]],random).filter(([dx,dy])=>{
        const nx=cx+dx,ny=cy+dy;
        return nx>=0&&nx<cols&&ny>=0&&ny<rows&&!visited[ny][nx];
      });
      if(!choices.length){stack.pop();continue;}
      const [dx,dy]=choices[0],nx=cx+dx,ny=cy+dy;
      grid[cy*2+1+dy][cx*2+1+dx]=".";
      grid[ny*2+1][nx*2+1]=".";
      visited[ny][nx]=true;
      stack.push([nx,ny]);
    }
    return grid;
  }

  function findPath(grid,start,goal,woodIsOpen=false) {
    const height=grid.length,width=grid[0].length;
    const queue=[start],parent=new Map([[start.join(","),null]]);
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];
      if(x===goal[0]&&y===goal[1])break;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,id=`${nx},${ny}`;
        if(nx<0||nx>=width||ny<0||ny>=height||parent.has(id))continue;
        if(grid[ny][nx]!=="."&&!(woodIsOpen&&(grid[ny][nx]==="W"||grid[ny][nx]==="R")))continue;
        parent.set(id,[x,y]);queue.push([nx,ny]);
      }
    }
    const goalId=goal.join(",");
    if(!parent.has(goalId))return [];
    const path=[];let current=goal;
    while(current){path.push(current);current=parent.get(current.join(","));}
    return path.reverse();
  }

  function addSolutionGates(grid,path,count) {
    const used=new Set(),gates=[];
    for(let i=1;i<=count;i++){
      const target=Math.round((path.length-1)*i/(count+1));
      let chosen=null;
      for(let radius=0;radius<path.length&&!chosen;radius++){
        for(const index of [target-radius,target+radius]){
          if(index<2||index>path.length-3)continue;
          const [x,y]=path[index],id=`${x},${y}`;
          if((x%2===0||y%2===0)&&!used.has(id)&&grid[y][x]==="."){chosen=[x,y];used.add(id);break;}
        }
      }
      if(chosen){grid[chosen[1]][chosen[0]]="W";gates.push(chosen);}
    }
    return gates;
  }

  function convertInteriorStones(grid,seed,probability=.3) {
    const random=seededRandom(seed^0x7F4A7C15);
    for(let y=1;y<grid.length-1;y++){
      for(let x=1;x<grid[0].length-1;x++){
        if(grid[y][x]==="#"&&random()<probability)grid[y][x]="W";
      }
    }
  }

  function addCoverageWood(grid,solutionPath,seed) {
    const random=seededRandom(seed^0xA53C9E17);
    const pathSet=new Set(solutionPath.map(([x,y])=>`${x},${y}`));
    const height=grid.length,width=grid[0].length;
    function choose(candidates){
      const offPath=candidates.filter(([x,y])=>!pathSet.has(`${x},${y}`));
      const pool=offPath.length?offPath:candidates;
      return pool[Math.floor(random()*pool.length)];
    }
    for(let y=1;y<height-1;y++){
      if(grid[y].includes("W"))continue;
      let candidates=[];
      for(let x=1;x<width-1;x++)if(grid[y][x]==="#")candidates.push([x,y]);
      if(!candidates.length)for(let x=1;x<width-1;x++)if(grid[y][x]===".")candidates.push([x,y]);
      const selected=choose(candidates);if(selected)grid[selected[1]][selected[0]]="W";
    }
    for(let x=1;x<width-1;x++){
      let covered=false;
      for(let y=1;y<height-1;y++)if(grid[y][x]==="W")covered=true;
      if(covered)continue;
      let candidates=[];
      for(let y=1;y<height-1;y++)if(grid[y][x]==="#")candidates.push([x,y]);
      if(!candidates.length)for(let y=1;y<height-1;y++)if(grid[y][x]===".")candidates.push([x,y]);
      const selected=choose(candidates);if(selected)grid[selected[1]][selected[0]]="W";
    }
  }

  function floodOpen(grid,start) {
    const result=[],seen=new Set([start.join(",")]),queue=[start];
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];result.push([x,y]);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,id=`${nx},${ny}`;
        if(grid[ny]?.[nx]==="."&&!seen.has(id)){seen.add(id);queue.push([nx,ny]);}
      }
    }
    return result;
  }

  function minimumWoodBreaks(grid,start,star) {
    const height=grid.length,width=grid[0].length,total=width*height;
    const distance=Array(total).fill(Infinity),deque=[start];
    distance[start[1]*width+start[0]]=0;
    while(deque.length){
      const [x,y]=deque.shift(),base=distance[y*width+x];
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;
        if(nx<0||nx>=width||ny<0||ny>=height||grid[ny][nx]==="#")continue;
        const cost=grid[ny][nx]==="W"?1:grid[ny][nx]==="R"?3:0,next=base+cost,index=ny*width+nx;
        if(next>=distance[index])continue;
        distance[index]=next;
        if(cost)deque.push([nx,ny]);else deque.unshift([nx,ny]);
      }
    }
    return distance[star[1]*width+star[0]];
  }

  function minimumWoodRoute(grid,start,goal) {
    const height=grid.length,width=grid[0].length;
    const distances=Array.from({length:height},()=>Array.from({length:width},()=>[Infinity,Infinity]));
    const parents=new Map(),queue=[[0,0,start[0],start[1]]];
    distances[start[1]][start[0]]=[0,0];
    while(queue.length){
      queue.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      const [breaks,steps,x,y]=queue.shift();
      const known=distances[y][x];
      if(breaks!==known[0]||steps!==known[1])continue;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,tile=grid[ny]?.[nx];
        if(tile==null||tile==="#")continue;
        const next=[breaks+(tile==="W"?1:tile==="R"?3:0),steps+1],previous=distances[ny][nx];
        if(next[0]>previous[0]||(next[0]===previous[0]&&next[1]>=previous[1]))continue;
        distances[ny][nx]=next;parents.set(`${nx},${ny}`,[x,y]);queue.push([next[0],next[1],nx,ny]);
      }
    }
    const path=[];let current=goal;
    while(current){path.push(current);current=parents.get(current.join(","));}
    return path.reverse();
  }

  function placeRegionalItems(grid,start,solutionPath,solutionGates,rewardPath,config) {
    const gateIds=new Set(solutionGates.map(([x,y])=>`${x},${y}`));
    const firstGateIndex=solutionPath.findIndex(([x,y])=>gateIds.has(`${x},${y}`));
    const open=floodOpen(grid,start),openSet=new Set(open.map(([x,y])=>`${x},${y}`));
    let startItem=firstGateIndex>0?solutionPath[firstGateIndex-1]:null;
    if(!startItem||!openSet.has(startItem.join(","))||startItem.join(",")===start.join(",")){
      startItem=open.find(([x,y])=>`${x},${y}`!==start.join(","));
    }
    if(!startItem)throw new Error("No valid starting item position");
    grid[startItem[1]][startItem[0]]=config.startItem||"H";

    const ordered=solutionGates.slice().sort((a,b)=>solutionPath.findIndex(p=>p[0]===a[0]&&p[1]===a[1])-solutionPath.findIndex(p=>p[0]===b[0]&&p[1]===b[1]));
    const firstRewardBarrier=rewardPath.findIndex(([x,y])=>grid[y][x]==="W");
    const guaranteedRewardSpots=rewardPath.slice(firstRewardBarrier+1,-1).filter(([x,y])=>grid[y][x]===".");
    function takeGuaranteedRewardSpot(){
      const spot=guaranteedRewardSpots.find(([x,y])=>grid[y][x]===".");
      if(!spot)throw new Error("No pre-goal spot on an optimal route for guaranteed reward");
      return spot;
    }
    const mandatoryPlacements=[];
    (config.mandatoryItems||[]).forEach((item)=>{
      const spot=takeGuaranteedRewardSpot();
      grid[spot[1]][spot[0]]=item;
      mandatoryPlacements.push({type:item,position:spot});
    });
    const bonuses=config.bonusItems||[];
    bonuses.forEach((item,index)=>{
      if(item==="H"){
        const spot=takeGuaranteedRewardSpot();
        grid[spot[1]][spot[0]]=item;
        return;
      }
      const gate=ordered[Math.min(ordered.length-1,Math.floor((index+1)*ordered.length/(bonuses.length+1)))];
      if(!gate)return;
      const gateIndex=solutionPath.findIndex(([x,y])=>x===gate[0]&&y===gate[1]);
      let spot=null;
      for(let i=gateIndex+1;i<solutionPath.length-1;i++){
        const [x,y]=solutionPath[i];
        if(grid[y][x]==="."){spot=[x,y];break;}
      }
      if(spot)grid[spot[1]][spot[0]]=item;
    });
    return {startItem,orderedGates:ordered,mandatoryPlacements};
  }

  function validate(grid,start,star) {
    const height=grid.length,width=grid[0].length,noWoodRows=[],noWoodCols=[];
    for(let y=1;y<height-1;y++)if(!grid[y].includes("W"))noWoodRows.push(y);
    for(let x=1;x<width-1;x++){
      let found=false;for(let y=1;y<height-1;y++)if(grid[y][x]==="W")found=true;
      if(!found)noWoodCols.push(x);
    }
    const probe=grid.map(row=>row.map(cell=>"HBGTSK".includes(cell)||cell==="P"?".":cell));
    const path=findPath(probe,start,star,true);
    const startingCells=new Set(floodOpen(probe,start).map(([x,y])=>`${x},${y}`));
    let startingItems=0;
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if("HBGT".includes(grid[y][x])&&startingCells.has(`${x},${y}`))startingItems++;
    if(!path.length||noWoodRows.length||noWoodCols.length||startingItems!==1)throw new Error(`Invalid maze: path=${path.length}, rows=${noWoodRows}, cols=${noWoodCols}, startItems=${startingItems}`);
    return minimumWoodBreaks(probe,start,star);
  }

  function buildLevel(config) {
    const grid=carvePerfectMaze(config.cols,config.rows,config.seed);
    const start=[1,grid.length-2],star=[grid[0].length-2,1];
    const basePath=findPath(grid,start,star);
    addCoverageWood(grid,basePath,config.seed);
    convertInteriorStones(grid,config.seed,.3);
    const solutionGates=addSolutionGates(grid,basePath,config.pathGates);
    const rewardPath=minimumWoodRoute(grid,start,star);
    const placements=placeRegionalItems(grid,start,basePath,solutionGates,rewardPath,config);
    if(config.fixedStartItem){
      const [fromX,fromY]=placements.startItem;
      const [toX,toY]=config.fixedStartItem;
      if(grid[fromY]?.[fromX]!==config.startItem)throw new Error(`Fixed start item source drift at ${fromX},${fromY}`);
      if(grid[toY]?.[toX]!==".")throw new Error(`Fixed start item target must be empty at ${toX},${toY}`);
      grid[toY][toX]=grid[fromY][fromX];
      grid[fromY][fromX]=".";
      placements.startItem=[toX,toY];
    }
    (config.fixedMandatoryItems||[]).forEach((target,index)=>{
      const placement=placements.mandatoryPlacements[index];
      if(!placement)throw new Error(`Missing mandatory item ${index} for fixed placement`);
      const [fromX,fromY]=placement.position;
      const [toX,toY]=target;
      if(grid[fromY]?.[fromX]!==placement.type)throw new Error(`Fixed mandatory item source drift at ${fromX},${fromY}`);
      if(grid[toY]?.[toX]!==".")throw new Error(`Fixed mandatory item target must be empty at ${toX},${toY}`);
      grid[toY][toX]=grid[fromY][fromX];
      grid[fromY][fromX]=".";
      placement.position=[toX,toY];
    });
    if(config.chapter==="ember"){
      (config.extraFloor||[]).forEach(([x,y])=>{
        if(x<=0||x>=grid[0].length-1||y<=0||y>=grid.length-1){
          throw new Error(`Invalid extra floor boundary at ${x},${y}`);
        }
        if((x===start[0]&&y===start[1])||(x===star[0]&&y===star[1])){
          throw new Error(`Extra floor overlaps endpoint at ${x},${y}`);
        }
        const tile=grid[y][x];
        const overlapsShard=(config.shardPositions||[]).some(([shardX,shardY])=>shardX===x&&shardY===y);
        if("HBGTSK".includes(tile)||overlapsShard)throw new Error(`Extra floor overlaps content at ${x},${y}`);
        if(tile!=="#"&&tile!=="W")throw new Error(`Extra floor must replace stone or wood at ${x},${y}: ${tile}`);
        grid[y][x]=".";
      });
      (config.harden||[]).forEach(([x,y])=>{
        if(x<=0||x>=grid[0].length-1||y<=0||y>=grid.length-1)throw new Error(`Invalid hardened boundary at ${x},${y}`);
        if("HBGTS".includes(grid[y][x]))throw new Error(`Hardened cell overlaps content at ${x},${y}`);
        grid[y][x]="#";
      });
      (config.extraWood||[]).forEach(([x,y])=>{
        if(grid[y]?.[x]!==".")throw new Error(`Extra wood must occupy empty floor at ${x},${y}: ${grid[y]?.[x]}`);
        grid[y][x]="W";
      });
      (config.crackedWalls||[]).forEach(([x,y])=>{
        if(grid[y]?.[x]!=="W")throw new Error(`Cracked wall must replace wood at ${x},${y}: ${grid[y]?.[x]}`);
        grid[y][x]="R";
      });
      (config.shardPositions||[]).forEach(([x,y])=>{
        if(grid[y]?.[x]!==".")throw new Error(`Shard must occupy empty floor at ${x},${y}: ${grid[y]?.[x]}`);
        grid[y][x]="K";
      });
    }
    let tutorial=null;
    if(config.tutorial==="first"){
      const [hx,hy]=placements.startItem;
      const wood=rewardPath.find(([x,y],index)=>index>0&&grid[y][x]==="W");
      const woodIndex=rewardPath.findIndex(([x,y])=>wood&&x===wood[0]&&y===wood[1]);
      const destination=rewardPath.slice(woodIndex+1).find(([x,y])=>grid[y][x]!=="W");
      if(!wood||wood[0]!==hx+1||wood[1]!==hy-1||!destination){
        throw new Error("First tutorial must place its key wood wall above-right of the hammer");
      }
      tutorial={hammer:placements.startItem,wood,destination};
    }else if(config.tutorial==="spirit"){
      const wallIndex=basePath.findIndex(([x,y],index)=>index>0&&grid[y][x]==="W");
      tutorial={item:placements.startItem,wall:basePath[wallIndex],destination:basePath[wallIndex+1]};
    }else if(config.tutorial==="torch"){
      const wall=basePath.find(([x,y],index)=>index>0&&grid[y][x]==="W");
      tutorial={item:placements.startItem,target:wall};
    }
    grid[start[1]][start[0]]="P";grid[star[1]][star[0]]="S";
    const validatedMinimum=validate(grid,start,star);
    const finalMinimum=config.chapter==="ember"
      ?config.witness.woodBreaks+config.witness.crackedBreaks
      :validatedMinimum;
    const routeTarget=config.chapter==="ember"
      ?config.optimalToolCost
      :finalMinimum;
    return {
      name:config.name,
      objective:`${config.objective}${config.rewardSeal&&placements.mandatoryPlacements.length?" · 先拾取必经补给，才能解除北极星封印。":""} · 三星目标：路径成本不超过 ${routeTarget}，侦察与照明不扣星。`,
      lesson:config.lesson,hint:config.hint,map:grid.map(row=>row.join("")),start,
      recommended:routeTarget,expert:routeTarget,optimalBreaks:finalMinimum,
      optimalToolCost:routeTarget,chapter:config.chapter||null,memoryPins:config.memoryPins||0,
      witness:config.witness?JSON.parse(JSON.stringify(config.witness)):null,
      rescueInventory:config.rescueInventory?{...config.rescueInventory}:null,
      tutorial,mandatoryRewards:placements.mandatoryPlacements,rewardSeal:Boolean(config.rewardSeal),
      maze:{algorithm:"recursive-backtracker",seed:config.seed,logicalSize:[config.cols,config.rows]},
    };
  }

  function createMazeLevels(){
    const levels=CONFIGS.map(buildLevel);
    let hammerReserve=0,bombReserve=0,previousDifficulty=0;
    levels.forEach((level,index)=>{
      const hammerPickups=[...level.map.join("")].filter(cell=>cell==="H").length;
      const bombPickups=[...level.map.join("")].filter(cell=>cell==="B").length;
      const hammerCost=level.chapter==="ember"
        ?CONFIGS[index].hammerUses
        :level.optimalBreaks;
      const bombCost=level.chapter==="ember"?CONFIGS[index].bombUses:0;
      hammerReserve+=hammerPickups*5-hammerCost;
      bombReserve+=bombPickups-bombCost;
      if(index<15&&level.optimalBreaks<previousDifficulty)throw new Error(`Difficulty dropped at level ${index+1}`);
      if(hammerReserve<0)throw new Error(`Hammer reserve exhausted at level ${index+1}`);
      if(bombReserve<0)throw new Error(`Bomb reserve exhausted at level ${index+1}`);
      if(index<15)previousDifficulty=level.optimalBreaks;
      level.balance={
        optimalHammerCost:hammerCost,hammerPickups,optimalHammerReserve:hammerReserve,
        optimalBombCost:bombCost,bombPickups,optimalBombReserve:bombReserve,
      };
      level.challenge=CHALLENGES[index];
    });
    if(levels.length!==20||hammerReserve!==11||bombReserve!==1){
      throw new Error(`Invalid campaign balance: levels=${levels.length}, hammers=${hammerReserve}, bombs=${bombReserve}`);
    }
    return levels;
  }
  const publicApi=Object.freeze({createMazeLevels,buildMazeLevel:buildLevel});
  root.MazeLevelApi=publicApi;
  root.createMazeLevels=createMazeLevels;
  if(typeof module!=="undefined"&&module.exports)module.exports={
    ...publicApi,
    mazeTestInternals:{seededRandom,carvePerfectMaze,findPath,addCoverageWood,convertInteriorStones,addSolutionGates},
  };
})(typeof globalThis!=="undefined"?globalThis:this);
