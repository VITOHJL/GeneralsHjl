const io = require('socket.io-client');

// 服务器地址 - 根据官方文档使用 botws.generals.io
const SERVER_URL = 'http://botws.generals.io';

// 机器人配置
const USER_ID = 'my_bot_' + Date.now();
const USERNAME = 'GeneralsHjl';

// 游戏状态
let playerIndex = null;
let generals = [];
let cities = [];
let map = [];

// 地形常量
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

console.log('=== Generals.io Bot ===');
console.log('机器人ID:', USER_ID);
console.log('机器人名称:', USERNAME);
console.log('正在连接到服务器:', SERVER_URL);

// 创建socket连接
const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// 连接成功
socket.on('connect', function() {
  console.log('✓ 成功连接到服务器！');
  
  // 设置用户名
  console.log('设置用户名...');
  socket.emit('set_username', USER_ID, USERNAME);
  
  // 加入自定义游戏
  const gameId = 'hjl_game_' + Date.now();
  console.log('加入游戏:', gameId);
  socket.emit('join_private', gameId, USER_ID);
  socket.emit('set_force_start', gameId, true);
  
  console.log('\n游戏链接: http://bot.generals.io/games/' + encodeURIComponent(gameId));
  console.log('等待游戏开始...\n');
});

// 连接错误
socket.on('connect_error', function(error) {
  console.error('连接失败:', error.message || error);
  console.error('请检查网络连接或服务器状态');
});

// 断开连接
socket.on('disconnect', function(reason) {
  console.error('断开连接:', reason);
});

// 游戏开始
socket.on('game_start', function(data) {
  console.log('=== 游戏开始！ ===');
  playerIndex = data.playerIndex;
  console.log('你的玩家索引:', playerIndex);
  console.log('回放链接: http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id));
  console.log('');
});

// 游戏更新
socket.on('game_update', function(data) {
  // 更新地图数据
  cities = patch(cities, data.cities_diff);
  map = patch(map, data.map_diff);
  generals = data.generals;
  
  // 解析地图
  if (map.length < 2) return;
  
  const width = map[0];
  const height = map[1];
  const size = width * height;
  
  if (map.length < 2 + size * 2) return;
  
  const armies = map.slice(2, 2 + size);
  const terrain = map.slice(2 + size, 2 + size * 2);
  
  // 执行策略
  makeMove(width, height, armies, terrain);
});

// 游戏结束
socket.on('game_won', function() {
  console.log('\n🎉 游戏胜利！');
  socket.emit('leave_game');
});

socket.on('game_lost', function() {
  console.log('\n💀 游戏失败！');
  socket.emit('leave_game');
});

// 补丁函数：合并地图差异
function patch(old, diff) {
  if (!diff || diff.length === 0) return old || [];
  if (!old || old.length === 0) return diff;
  
  const out = [];
  let i = 0;
  let oldIndex = 0;
  
  while (i < diff.length) {
    // 匹配的元素数量
    const matchCount = diff[i] || 0;
    if (matchCount > 0 && oldIndex < old.length) {
      const end = Math.min(oldIndex + matchCount, old.length);
      for (let j = oldIndex; j < end; j++) {
        out.push(old[j]);
      }
      oldIndex += matchCount;
    }
    i++;
    
    // 不匹配的元素数量
    if (i < diff.length) {
      const mismatchCount = diff[i] || 0;
      if (mismatchCount > 0) {
        for (let j = 0; j < mismatchCount && i + 1 + j < diff.length; j++) {
          out.push(diff[i + 1 + j]);
        }
        i += mismatchCount + 1;
      } else {
        i++;
      }
    }
  }
  
  return out;
}

// 策略：随机移动（简单策略，先跑通）
function makeMove(width, height, armies, terrain) {
  const myTiles = [];
  
  // 找到所有我拥有的地块（军队数 > 1）
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === playerIndex && armies[i] > 1) {
      myTiles.push(i);
    }
  }
  
  if (myTiles.length === 0) return;
  
  // 随机选择一个地块
  const startIndex = myTiles[Math.floor(Math.random() * myTiles.length)];
  const row = Math.floor(startIndex / width);
  const col = startIndex % width;
  
  // 随机选择一个方向
  const directions = [];
  if (col > 0) directions.push(startIndex - 1); // 左
  if (col < width - 1) directions.push(startIndex + 1); // 右
  if (row > 0) directions.push(startIndex - width); // 上
  if (row < height - 1) directions.push(startIndex + width); // 下
  
  if (directions.length === 0) return;
  
  const endIndex = directions[Math.floor(Math.random() * directions.length)];
  
  // 不攻击城市
  if (cities.indexOf(endIndex) >= 0) return;
  
  // 发送攻击命令
  socket.emit('attack', startIndex, endIndex);
}

// 错误处理
process.on('uncaughtException', function(error) {
  console.error('未捕获的错误:', error);
});

process.on('unhandledRejection', function(reason, promise) {
  console.error('未处理的Promise拒绝:', reason);
});

console.log('机器人已启动，等待连接...\n');

