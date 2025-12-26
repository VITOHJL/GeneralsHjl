# AI训练和评估系统

## 概述

这是一个完整的AI训练和评估框架，用于测试和优化Generals.io游戏的AI性能。系统设计时考虑了**避免过拟合**的问题，类似于量化交易中的回测vs实盘问题。

## 核心设计理念

### 1. 多维度评估（避免单一指标过拟合）

不只看胜率，而是从多个维度评估：
- **胜负指标**：胜率、存活率
- **效率指标**：每回合移动数、单位利用率
- **稳定性指标**：标准差、变异系数、分位数
- **场景覆盖**：不同地图尺寸、玩家数量、对手类型

### 2. 数据集分离（训练/验证/测试）

- **训练集（基础场景）**：标准地图、标准对手
- **验证集（对抗性测试）**：类似"实盘"，测试真实对抗能力
- **测试集（边界情况）**：极端场景，测试鲁棒性

### 3. 对抗性测试（类似实盘）

设计特殊场景模拟真实对抗：
- 被围攻场景（多对一）
- 资源劣势场景（地图更小）
- 长期对抗场景（大地图持久战）

### 4. 稳定性评估（避免偶然性）

不仅看平均值，还看：
- **标准差**：表现是否稳定
- **变异系数**：相对稳定性
- **分位数（P25/P75/P95）**：极端情况表现

## 使用方法

### 快速开始

**⚠️ 注意：所有参数都是必需的，必须完整提供**

#### Bash / Linux / macOS

```bash
# 评估adaptive AI（完整参数示例）
npm run train:evaluate -- \
  --ai adaptive \
  --games 50 \
  --validation 50 \
  --against random \
  --mapSizes 10x10,15x15 \
  --players 2,3，4，5，6 \
  --maxTurns 1500 \
  --maxTime 30000

# 对比两个AI（完整参数示例）
npm run train:compare -- \
  --ai1 adaptive \
  --ai2 random \
  --games 50 \
  --width 25 \
  --height 25 \
  --maxTurns 500 \
  --maxTime 30000

# 基准测试所有AI（完整参数示例）
npm run train:benchmark -- \
  --all \
  --games 50 \
  --validation 25 \
  --against random \
  --mapSizes 20x20,30x30 \
  --players 2,3 \
  --maxTurns 500 \
  --maxTime 30000
```

#### PowerShell / Windows

**方法1：使用反引号作为行继续符**

```powershell
# 评估adaptive AI（完整参数示例）
npm run train:evaluate -- `
  --ai adaptive `
  --games 100 `
  --validation 50 `
  --against random `
  --mapSizes 20x20,30x30 `
  --players 2,3 `
  --maxTurns 500 `
  --maxTime 30000

# 对比两个AI（完整参数示例）
npm run train:compare -- `
  --ai1 adaptive `
  --ai2 minimax `
  --games 25 `
  --width 25 `
  --height 25 `
  --maxTurns 5000 `
  --maxTime 30000

# 基准测试所有AI（完整参数示例）
npm run train:benchmark -- `
  --all `
  --games 50 `
  --validation 25 `
  --against random `
  --mapSizes 20x20,30x30 `
  --players 2,3 `
  --maxTurns 500 `
  --maxTime 30000
```

**方法2：使用单行命令（推荐）**

```powershell
# 评估adaptive AI
npm run train:evaluate -- --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000

# 对比两个AI
npm run train:compare -- --ai1 adaptive --ai2 random --games 50 --width 25 --height 25 --maxTurns 500 --maxTime 30000

# 基准测试所有AI
npm run train:benchmark -- --all --games 50 --validation 25 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000
```

**方法3：直接使用 node 命令（避免 npm 参数解析问题）**

```powershell
# 评估adaptive AI
node src/training/train.js evaluate --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000

# 对比两个AI
node src/training/train.js compare --ai1 adaptive --ai2 random --games 50 --width 25 --height 25 --maxTurns 500 --maxTime 30000

# 基准测试所有AI
node src/training/train.js benchmark --all --games 50 --validation 25 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000
```

### 详细文档

**📖 完整命令说明请查看：[COMMANDS.md](./COMMANDS.md)**

该文档详细解释了：
- `evaluate`、`compare`、`benchmark` 三个命令的运行流程
- 所有参数的详细说明（**所有参数都是必需的**）
- 每个命令的内部工作机制
- 参数解析机制
- 性能考虑和优化建议

### 基础评估

**⚠️ 注意：所有参数都是必需的（除了标记为"可选"的参数）**

**Bash / Linux / macOS:**

```bash
# 评估adaptive AI（完整参数示例）
npm run train:evaluate -- --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000

# 详细输出
npm run train:evaluate -- --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000 --verbose

# 保存结果到文件
npm run train:evaluate -- --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000 --output results.json
```

**PowerShell / Windows:**

```powershell
# 评估adaptive AI（完整参数示例）
node src/training/train.js evaluate --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000

# 详细输出
node src/training/train.js evaluate --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000 --verbose

# 保存结果到文件
node src/training/train.js evaluate --ai adaptive --games 100 --validation 50 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000 --output results.json
```

### 对比测试

**⚠️ 注意：所有参数都是必需的**

**Bash / Linux / macOS:**

```bash
# 对比两个AI
npm run train:compare -- --ai1 adaptive --ai2 random --games 50 --width 25 --height 25 --maxTurns 500 --maxTime 30000
```

**PowerShell / Windows:**

```powershell
# 对比两个AI
node src/training/train.js compare --ai1 adaptive --ai2 random --games 50 --width 25 --height 25 --maxTurns 500 --maxTime 30000
```

### 基准测试

**⚠️ 注意：所有参数都是必需的（除了 `--all` 和 `--ais` 二选一）**

**Bash / Linux / macOS:**

```bash
# 测试所有AI
npm run train:benchmark -- --all --games 50 --validation 25 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000
```

**PowerShell / Windows:**

```powershell
# 测试所有AI
node src/training/train.js benchmark --all --games 50 --validation 25 --against random --mapSizes 20x20,30x30 --players 2,3 --maxTurns 500 --maxTime 30000
```

### 参数说明

**evaluate 命令必需参数**：
- `--ai`: AI类型
- `--games`: 每个基础场景的游戏数量
- `--validation`: 每个对抗性场景的游戏数量
- `--against`: 对手AI类型（逗号分隔）
- `--mapSizes`: 地图尺寸（格式：`20x20,30x30`）
- `--players`: 玩家数量（逗号分隔）
- `--maxTurns`: 最大回合数
- `--maxTime`: 超时时间（毫秒）

**compare 命令必需参数**：
- `--ai1`: 第一个AI类型
- `--ai2`: 第二个AI类型
- `--games`: 对战游戏数量
- `--width`: 地图宽度
- `--height`: 地图高度
- `--maxTurns`: 最大回合数
- `--maxTime`: 超时时间（毫秒）

**benchmark 命令必需参数**：
- `--all` 或 `--ais`: AI列表（二选一）
- `--games`: 每个AI的测试游戏数量
- `--validation`: 每个AI的验证游戏数量
- `--against`: 对手AI类型（逗号分隔）
- `--mapSizes`: 地图尺寸（格式：`20x20,30x30`）
- `--players`: 玩家数量（逗号分隔）
- `--maxTurns`: 最大回合数
- `--maxTime`: 超时时间（毫秒）

详细说明请查看 [COMMANDS.md](./COMMANDS.md)

## 评估指标说明

### 基础指标

- **胜率（Win Rate）**：获胜场次 / 总场次
- **存活率（Survival Rate）**：游戏结束时仍存活的概率
- **平均回合数（Avg Turns）**：游戏平均持续回合数

### 效率指标

- **每回合移动数（Moves Per Turn）**：平均每回合执行的有效移动
- **单位利用率（Units Per Move）**：每次移动的平均单位数
- **领土扩张率（Territory Ratio）**：最终领土 / 总地图面积

### 稳定性指标

- **标准差（Std Dev）**：分数分布的标准差
- **变异系数（Coefficient of Variation）**：标准差 / 平均值
- **分位数（P25/P75/P95）**：25%/75%/95%分位数的分数

### 综合评分

综合评分 = 胜率权重 × 100 + 平均分数权重 × 0.1

权重分配：
- 基础场景：40%
- 对抗性测试：30%
- 边界情况：20%
- 自定义场景：10%

## 评估流程

```
1. 基础场景测试（训练集）
   ├── 不同地图尺寸
   ├── 不同玩家数量
   └── 不同对手类型

2. 对抗性测试（验证集）
   ├── 被围攻场景
   ├── 资源劣势场景
   └── 长期对抗场景

3. 边界情况测试（测试集）
   ├── 极小地图
   ├── 多人混战
   └── 极端配置

4. 综合评分计算
   └── 加权平均各场景得分
```

## 避免过拟合的策略

### 1. 多样化测试场景

不只在"舒适区"测试，而是覆盖：
- 不同地图尺寸（小/中/大）
- 不同玩家数量（2/3/4+）
- 不同对手类型（随机/自适应/其他）

### 2. 对抗性测试

设计"不友好"的场景：
- 被多个对手围攻
- 资源劣势
- 长期消耗战

### 3. 稳定性要求

不仅要求平均表现好，还要求：
- 标准差小（表现稳定）
- 变异系数低（相对稳定）
- 分位数合理（极端情况不崩）

### 4. 交叉验证

- 在不同配置下测试
- 与不同对手测试
- 在不同地图上测试

## 结果解读

### 好的AI应该：

1. **高胜率**：在基础场景中胜率 > 60%
2. **稳定性好**：变异系数 < 0.3
3. **对抗性强**：在对抗性测试中表现不差
4. **鲁棒性好**：在边界情况下不会崩溃

### 警告信号（可能过拟合）：

1. **基础场景很好，对抗性测试很差**：可能过拟合了标准场景
2. **变异系数很高**：表现不稳定，可能依赖运气
3. **分位数差距大**：极端情况下表现差异大
4. **只在特定配置下好**：可能过拟合了特定配置

## 示例输出

```
AI评估报告: adaptive
============================================================

综合评分: 72.35

分类评分:
  basic: 75.20
  adversarial: 68.50
  edgeCases: 71.00
  custom: 70.00

详细场景:

basic:
  地图20x20_2玩家_对手random:
    胜率: 65.0% (65/100)
    平均分数: 125.30
    稳定性: 15.20% (变异系数)
    平均回合: 45.3

adversarial:
  被围攻场景:
    胜率: 35.0% (35/100)
    平均分数: 95.20
    稳定性: 18.50% (变异系数)
    平均回合: 38.5
```

## 扩展

### 添加自定义场景

在 `Evaluator.js` 中添加：

```javascript
const customScenarios = [
  {
    name: '特殊场景',
    games: 20,
    gameConfig: {
      width: 25,
      height: 25,
      players: 2
    },
    opponents: {
      2: { type: 'ai', aiType: 'random' }
    }
  }
]

await evaluator.evaluate('adaptive', {
  scenarios: customScenarios
})
```

### 添加新指标

在 `GameSimulator.calculateMetrics()` 中添加新指标计算。

## 注意事项

1. **样本量**：建议至少100场游戏才能有统计意义
2. **随机性**：每次运行结果可能略有不同，这是正常的
3. **时间成本**：大量游戏需要较长时间，建议使用 `--games` 参数控制
4. **资源消耗**：大地图、多玩家会消耗更多内存和时间

## 未来改进

- [ ] 添加可视化报告（图表）
- [ ] 支持并行测试（多进程）
- [ ] 添加A/B测试功能
- [ ] 支持参数调优（自动搜索最优参数）
- [ ] 添加回放功能（保存关键对局）

