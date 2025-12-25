# 训练命令详解

本文档详细解释 `train.js` 中三个主要命令的运行方式和参数设置。

## 目录

1. [evaluate - 评估单个AI](#evaluate---评估单个ai)
2. [compare - 对比两个AI](#compare---对比两个ai)
3. [benchmark - 基准测试所有AI](#benchmark---基准测试所有ai)

---

## evaluate - 评估单个AI

### 功能概述

对单个AI进行**多维度、多层次**的全面评估，包括基础场景、对抗性测试、边界情况等，避免过拟合问题。

### 命令格式

```bash
node src/training/train.js evaluate [选项]
```

### 参数说明

**⚠️ 重要：所有参数都是必需的（除了标记为"可选"的参数）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--ai` 或 `--aiType` | string | ✅ | 要评估的AI类型 |
| `--games` 或 `--testGames` | number | ✅ | 每个基础场景的游戏数量 |
| `--validation` | number | ✅ | 每个对抗性场景的游戏数量 |
| `--against` | string | ✅ | 对手AI类型，多个用逗号分隔（如：`random,adaptive`） |
| `--mapSizes` | string | ✅ | 地图尺寸，格式：`宽度x高度,宽度x高度`（如：`20x20,30x30`） |
| `--players` | string | ✅ | 玩家数量，多个用逗号分隔（如：`2,3,4`） |
| `--maxTurns` | number | ✅ | 最大回合数（超过则游戏结束，判为平局） |
| `--maxTime` | number | ✅ | 超时时间（毫秒，超过则游戏结束，判为平局） |
| `--output` | string | ❌ 可选 | 保存结果到JSON文件 |
| `--verbose` | flag | ❌ 可选 | 详细输出（显示进度） |
| `--quiet` | flag | ❌ 可选 | 静默模式（最少输出） |

### 运行流程

#### 1. 初始化评估器

```javascript
const evaluator = new Evaluator({
  testGames: games,           // 基础场景游戏数（必需）
  validationGames: validationGames, // 对抗性场景游戏数（必需）
  maxTurns: maxTurns,         // 最大回合数（必需）
  maxTime: maxTime,           // 超时时间（毫秒，必需）
  logLevel: 'normal'          // 日志级别：'silent' | 'normal' | 'verbose'（可选）
})
```

#### 2. 执行评估（5个阶段）

##### 阶段1：基础场景测试（训练集）

**目的**：测试AI在标准配置下的表现

**测试组合**：
- 地图尺寸 × 玩家数量 × 对手类型 × 游戏数量
- 例如：`[[20,20], [30,30]] × [2, 3] × ['random'] × 100 = 600场游戏`

**运行逻辑**：
```javascript
for (地图尺寸 in mapSizes) {
  for (玩家数量 in playerCounts) {
    for (对手类型 in against) {
      for (i = 0; i < testGames; i++) {
        // 创建游戏配置
        gameConfig = {
          width, height,
          players: playerCount,
          aiConfigs: {
            1: { type: 'ai', aiType: 目标AI },
            2-N: { type: 'ai', aiType: 对手AI }
          }
        }
        // 运行游戏并收集结果
        result = simulator.runGame(gameConfig)
      }
    }
  }
}
```

**输出**：每个组合的统计结果
- 胜率、平均分数、稳定性指标等

##### 阶段2：对抗性测试（验证集）

**目的**：测试AI在"不友好"场景下的表现（类似实盘测试）

**包含3个子场景**：

1. **被围攻场景**
   - 配置：25x25地图，3个玩家
   - 目标AI：玩家1
   - 对手：2个相同类型的对手AI（玩家2和3）
   - 游戏数：`validationGames`（从 `--validation` 参数获取）
   - **目的**：测试多对一情况下的生存能力

2. **资源劣势场景**
   - 配置：15x15地图，2个玩家
   - 目标AI：玩家1
   - 对手：1个对手AI（玩家2）
   - 游戏数：`validationGames`（从 `--validation` 参数获取）
   - **目的**：测试在资源受限情况下的表现

3. **长期对抗场景**
   - 配置：50x50地图，2个玩家
   - 目标AI：玩家1
   - 对手：1个对手AI（玩家2）
   - 游戏数：`validationGames`（从 `--validation` 参数获取）
   - **目的**：测试长期消耗战的能力

##### 阶段3：边界情况测试（测试集）

**目的**：测试AI的鲁棒性

**包含2个子场景**：

1. **极小地图**
   - 配置：10x10地图，2个玩家
   - 游戏数：20场
   - **目的**：测试在极端小地图下的表现

2. **多人混战**
   - 配置：30x30地图，4个玩家
   - 目标AI：玩家1
   - 对手：3个随机AI
   - 游戏数：20场
   - **目的**：测试多人混战中的表现

##### 阶段4：自定义场景测试（可选）

**目的**：测试特定场景

**触发条件**：如果提供了 `scenarios` 参数

**格式**：
```javascript
scenarios = [
  {
    name: '场景名称',
    games: 20,
    gameConfig: { width: 25, height: 25, players: 2 },
    opponents: { 2: { type: 'ai', aiType: 'random' } }
  }
]
```

##### 阶段5：计算综合评分

**权重分配**：
- 基础场景：40%
- 对抗性测试：30%
- 边界情况：20%
- 自定义场景：10%

**计算公式**：
```javascript
场景得分 = 胜率 × 100 + 平均分数 × 0.1
综合评分 = Σ(场景得分 × 权重)
```

#### 3. 生成报告

输出包含：
- 综合评分
- 各分类评分
- 详细场景结果（胜率、平均分数、稳定性等）

### 示例

**Bash / Linux / macOS:**

```bash
# 基础评估（所有参数都是必需的）
node src/training/train.js evaluate \
  --ai adaptive \
  --games 100 \
  --validation 50 \
  --against random \
  --mapSizes 20x20,30x30 \
  --players 2,3 \
  --maxTurns 500 \
  --maxTime 30000

# 详细评估，保存结果
node src/training/train.js evaluate \
  --ai adaptive \
  --games 200 \
  --validation 100 \
  --against random,adaptive \
  --mapSizes 20x20,30x30,40x40 \
  --players 2,3,4 \
  --maxTurns 500 \
  --maxTime 30000 \
  --output results.json \
  --verbose
```

**PowerShell / Windows（推荐使用单行命令）:**

```powershell
# 基础评估（所有参数都是必需的）
node src/training/train.js evaluate --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000

# 详细评估，保存结果
node src/training/train.js evaluate --ai adaptive --games 200 --validation 100 --against random,adaptive --mapSizes 20x20,30x30,40x40 --players 2,3,4 --maxTurns 500 --maxTime 30000 --output results.json --verbose
```

**PowerShell 多行格式（使用反引号）:**

```powershell
# 基础评估（所有参数都是必需的）
node src/training/train.js evaluate `
  --ai adaptive `
  --games 100 `
  --validation 50 `
  --against random `
  --mapSizes 20x20,30x30 `
  --players 2,3 `
  --maxTurns 500 `
  --maxTime 30000
```

### 输出示例

```
开始评估 AI: adaptive
对手: random
地图尺寸: 20x20, 30x30
玩家数量: 2, 3

基础场景测试完成
对抗性测试完成
边界情况测试完成

============================================================
AI评估报告: adaptive
============================================================

综合评分: 72.35

分类评分:
  basic: 75.20
  adversarial: 68.50
  edgeCases: 71.00

详细场景:
basic:
  地图20x20_2玩家_对手random:
    胜率: 65.0% (65/100)
    平均分数: 125.30
    稳定性: 15.20% (变异系数)
    平均回合: 45.3
...
```

---

## compare - 对比两个AI

### 功能概述

直接对比两个AI的对战表现，简单快速，适合快速验证AI改进效果。

### 命令格式

```bash
node src/training/train.js compare [选项]
```

### 参数说明

**⚠️ 重要：所有参数都是必需的**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--ai1` | string | ✅ | 第一个AI类型（玩家1） |
| `--ai2` | string | ✅ | 第二个AI类型（玩家2） |
| `--games` | number | ✅ | 对战游戏数量 |
| `--width` | number | ✅ | 地图宽度 |
| `--height` | number | ✅ | 地图高度 |
| `--maxTurns` | number | ✅ | 最大回合数 |
| `--maxTime` | number | ✅ | 超时时间（毫秒） |

### 运行流程

#### 1. 初始化模拟器

```javascript
const simulator = new GameSimulator({
  maxTurns: maxTurns,    // 最大回合数（必需）
  maxTime: maxTime,     // 超时时间（毫秒，必需）
  logLevel: 'silent'    // 静默模式（可选）
})
```

#### 2. 运行对战循环

**配置**：
- 地图尺寸：`width x height`（从命令行参数获取）
- 玩家数量：2
- 目标AI：玩家1（`ai1`）
- 对手AI：玩家2（`ai2`）

**运行逻辑**：
```javascript
for (i = 0; i < games; i++) {
  // 创建游戏配置
  gameConfig = {
    width: 25,
    height: 25,
    players: 2,
    aiConfigs: {
      1: { type: 'ai', aiType: ai1 },
      2: { type: 'ai', aiType: ai2 }
    }
  }
  
  // 运行游戏
  result = simulator.runGame(gameConfig)
  
  // 统计结果
  if (result.stats.winner === 1) {
    ai1胜场++
  } else if (result.stats.winner === 2) {
    ai2胜场++
  } else {
    平局++
  }
}
```

#### 3. 输出对比结果

**统计指标**：
- 胜场数：`wins / total`
- 胜率：`(wins / total) * 100%`
- 平均分数：所有获胜场次的平均分数

**平局判定**：
- `winner === null` 或 `winner === undefined`
- 可能原因：
  - 达到最大回合数（500回合）但未分出胜负
  - 游戏超时（30秒）但未分出胜负

### 示例

**Bash / Linux / macOS:**

```bash
# 基础对比（所有参数都是必需的）
node src/training/train.js compare \
  --ai1 adaptive \
  --ai2 random \
  --games 50 \
  --width 25 \
  --height 25 \
  --maxTurns 500 \
  --maxTime 30000

# 大量对战
node src/training/train.js compare \
  --ai1 adaptive \
  --ai2 random \
  --games 200 \
  --width 30 \
  --height 30 \
  --maxTurns 1000 \
  --maxTime 60000
```

**PowerShell / Windows（推荐使用单行命令）:**

```powershell
# 基础对比（所有参数都是必需的）
node src/training/train.js compare --ai1 adaptive --ai2 random --games 50 --width 25 --height 25 --maxTurns 500 --maxTime 30000

# 大量对战
node src/training/train.js compare --ai1 adaptive --ai2 random --games 200 --width 30 --height 30 --maxTurns 1000 --maxTime 60000
```

### 输出示例

```
对比测试: adaptive vs random
游戏场数: 50
进度: 50/50

============================================================
对比结果:
============================================================
adaptive:
  胜场: 35/50
  胜率: 70.0%
  平均分数: 125.30

random:
  胜场: 12/50
  胜率: 24.0%
  平均分数: 95.20

平局: 3
============================================================
```

---

## benchmark - 基准测试所有AI

### 功能概述

快速测试所有AI的整体性能，用于对比不同AI的综合实力。

### 命令格式

```bash
node src/training/train.js benchmark [选项]
```

### 参数说明

**⚠️ 重要：所有参数都是必需的（除了 `--all` 和 `--ais` 二选一）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--all` | flag | ✅ 二选一 | 测试所有AI（random, adaptive） |
| `--ais` | string | ✅ 二选一 | 指定AI列表，逗号分隔（如：`random,adaptive`） |
| `--games` | number | ✅ | 每个AI的测试游戏数量 |
| `--validation` | number | ✅ | 每个AI的验证游戏数量 |
| `--against` | string | ✅ | 对手AI类型，逗号分隔 |
| `--mapSizes` | string | ✅ | 地图尺寸，格式：`20x20,30x30` |
| `--players` | string | ✅ | 玩家数量，逗号分隔 |
| `--maxTurns` | number | ✅ | 最大回合数 |
| `--maxTime` | number | ✅ | 超时时间（毫秒） |

**注意**：
- `--all` 和 `--ais` 必须提供其中一个
- `--all` 和 `--ais` 不能同时使用

### 运行流程

#### 1. 确定要测试的AI列表

```javascript
if (options.all) {
  aiTypes = ['random', 'adaptive']
} else if (options.ais) {
  aiTypes = options.ais.split(',')
} else {
  throw new Error('必须提供 --all 或 --ais 参数')
}
```

#### 2. 对每个AI执行评估

**配置**（全部从命令行参数获取）：
- 对手：从 `--against` 参数获取
- 地图尺寸：从 `--mapSizes` 参数获取
- 玩家数量：从 `--players` 参数获取
- 测试游戏数：从 `--games` 参数获取
- 验证游戏数：从 `--validation` 参数获取
- 最大回合数：从 `--maxTurns` 参数获取
- 超时时间：从 `--maxTime` 参数获取
- 日志级别：`'minimal'`（固定）

**运行逻辑**：
```javascript
for (aiType in aiTypes) {
  evaluator = new Evaluator({
    testGames: games,
    validationGames: Math.floor(games / 2),
    logLevel: 'minimal'
  })
  
  result = await evaluator.evaluate(aiType, {
    against: ['random'],
    mapSizes: [[20, 20], [30, 30]],
    playerCounts: [2, 3]
  })
  
  results[aiType] = result.overall.overallScore
}
```

#### 3. 输出排序结果

按综合评分从高到低排序。

### 示例

**Bash / Linux / macOS:**

```bash
# 测试所有AI（所有参数都是必需的）
node src/training/train.js benchmark \
  --all \
  --games 50 \
  --validation 25 \
  --against random \
  --mapSizes 20x20,30x30 \
  --players 2,3 \
  --maxTurns 500 \
  --maxTime 30000

# 测试指定AI
node src/training/train.js benchmark \
  --ais random,adaptive \
  --games 100 \
  --validation 50 \
  --against random \
  --mapSizes 20x20,30x30 \
  --players 2,3 \
  --maxTurns 500 \
  --maxTime 30000
```

**PowerShell / Windows（推荐使用单行命令）:**

```powershell
# 测试所有AI（所有参数都是必需的）
node src/training/train.js benchmark --all --games 50 --validation 25 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000

# 测试指定AI
node src/training/train.js benchmark --ais random,adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000
```

### 输出示例

```
基准测试所有AI
============================================================

测试 random...
测试 adaptive...

============================================================
基准测试结果:
============================================================
adaptive: 72.35
random: 45.20
============================================================
```

---

## 参数解析机制

### parseArgs 函数

```javascript
function parseArgs(args) {
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--?/, '')  // 移除 -- 或 -
    const value = args[i + 1]
    
    if (key && value) {
      options[key] = value
    } else if (key && (key === 'verbose' || key === 'quiet' || key === 'all')) {
      // 标志参数（不需要值）
      options[key] = true
    }
  }
  return options
}
```

**支持的格式**：
- `--key value`（双破折号）
- `-key value`（单破折号）
- `--flag`（标志参数，如 `--verbose`）

### parseMapSizes 函数

```javascript
function parseMapSizes(str) {
  return str.split(',').map(s => {
    const [w, h] = s.split('x').map(Number)
    return [w, h]
  })
}
```

**示例**：
- `'20x20,30x30'` → `[[20, 20], [30, 30]]`
- `'25x25'` → `[[25, 25]]`

---

## GameSimulator 配置

所有命令都使用 `GameSimulator` 来运行游戏，其配置参数：

**⚠️ 重要：所有参数都是必需的（除了 `logLevel`）**

| 参数 | 必需 | 说明 |
|------|------|------|
| `maxTurns` | ✅ | 最大回合数（超过则游戏结束，判为平局） |
| `maxTime` | ✅ | 最大时间（毫秒，超过则超时，判为平局） |
| `logLevel` | ❌ 可选 | 日志级别：'silent' | 'minimal' | 'verbose'（默认：'silent'） |

**注意**：
- `maxTurns` 和 `maxTime` 必须通过命令行参数提供
- 建议值：
  - `maxTurns`: 500-1000（根据地图大小调整）
  - `maxTime`: 30000-60000（30-60秒）

---

## 性能考虑

### 游戏数量建议

- **快速测试**：10-20场
- **基础评估**：50-100场
- **详细评估**：200-500场
- **发布前验证**：1000+场

### 时间估算

假设每场游戏平均30秒：
- 50场：约25分钟
- 100场：约50分钟
- 200场：约100分钟（1.7小时）

### 优化建议

1. **使用 `--quiet` 模式**：减少输出，提高速度
2. **减少游戏数量**：快速迭代时使用较少场次
3. **并行运行**：可以同时运行多个评估（如果系统支持）

---

## 常见问题

### Q: evaluate 和 compare 的区别？

**A**: 
- `evaluate`：全面评估，多维度测试，适合深入了解AI性能
- `compare`：简单对比，快速验证，适合A/B测试

### Q: 为什么 evaluate 需要这么长时间？

**A**: 
- `evaluate` 运行多个场景，总游戏数 = 基础场景数 + 对抗性场景数 + 边界场景数
- 例如：`2地图 × 2玩家数 × 1对手 × 100游戏 = 400场`（仅基础场景）

### Q: 平局是什么情况？

**A**: 
- 达到最大回合数（500或1000）但未分出胜负
- 游戏超时（30秒或60秒）但未分出胜负
- 这种情况会被记录为平局

### Q: 如何调整评估参数？

**A**: 
- 所有参数都是必需的，必须通过命令行提供
- 或通过命令行参数覆盖（如 `--games`）

