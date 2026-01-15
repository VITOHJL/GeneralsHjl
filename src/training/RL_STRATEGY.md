## RL 策略版 AI 设计与演化记录

> 目标：在保留一套 **强力、可解释的底层策略** 的前提下，用 Q-Learning 学习“**何时进攻 / 何时发育 / 何时防守 / 何时梭哈**”的高层决策，从而在多人局中稳定压制 `random` / `adaptive` 等对手。

---

## 1. 整体架构

- **高层：策略选择（StrategyRLAI）**
  - 文件：`src/game/ai/StrategyRLAI.js`
  - 职责：根据编码后的局面状态，通过 Q-Learning 从以下 4 种策略中选一个：
    - `GROW`：发育扩张 / 抢中立 / 后勤补给
    - `ATTACK`：常规进攻，优先吃高价值目标（首都/要塞）
    - `DEFEND`：防守、增援、反偷家
    - `ALL_IN`：判断优势明显时的一波流强攻
  - 实现要点：
    - `encodeState(gameState)`：把复杂局面压缩成紧凑的离散状态 key，用于索引 Q 表。
    - `selectStrategy(stateKey)`：ε-greedy 选择动作（策略）。
    - `executeStrategy(strategy, context)`：调用底层的策略执行器（见下一节）。
    - `updateQValues(reward)`：标准 Q-Learning 更新，只在 **非 maxTurns+人口判胜** 的对局中更新。

- **中层：策略执行器（StrategyExecutors）**
  - 文件：`src/game/ai/StrategyExecutors.js`
  - 职责：给定一个高层策略 + 当前局面，输出一个**具体合法移动** `{ fromX, fromY, toX, toY, moveType }`。
  - 核心函数：
    - `buildContext(gameState, playerId)`：从原始 `gameState` 提取：
      - 我的格子 / 敌人格子 / 中立格子
      - 首都、要塞、玩家总数 `playerCount`
      - 边界/前线信息等
    - `planAttack(context)`
    - `planDefense(context)`
    - `planGrowth(context)`
    - `planAllInAttack(context)`
    - `planSupplyToFrontline(context)`
    - `bfsNextStep(map, from, to)`：BFS 找“下一步最佳移动”，避开山地。
    - `isValidMove(context, action)` + `returnIfValid(context, action)`：兜底验证移动合法性，避免无效动作。

- **底层：游戏模拟与训练框架**
  - `src/training/GameSimulator.js`：无头模拟器，负责跑完整局游戏并给出统计。
  - `src/training/RLTrainer.js`：训练总控，负责循环 episode、调用模拟器、更新 RL agent、打印统计、读写 Q 表。
  - `src/training/train_rl.js`：命令行入口，解析参数并启动 RLTrainer。

---

## 2. 状态编码与奖励设计

### 2.1 状态编码（State Encoding）

- 目标：把复杂局面压缩成**有限维、可泛化**的状态 key，避免 Q 表爆炸。
- 典型特征（示意）：
  - 我的领土比例、总人口比例
  - 我与主要敌人的首都距离 / 前线压力
  - 是否存在明显优势（适合 ALL_IN）或危险（适合 DEFEND）
- 结果：Q 表大小保持在几百～几千量级，便于快速学习与加载。

### 2.2 奖励函数（Reward Function）

实现：`StrategyRLAI.calculateFinalReward(finalGameState, isWin)`

- **胜利奖励**：
  - 基础胜利奖励（如 +100）
  - **早赢加成**：根据胜利回合数，越快结束奖励越大，引导 AI 尽量“干脆利落吃首都”，而不是拖到 maxTurns。
- **失败惩罚**：
  - 基础失败惩罚（如 -50）
  - 结合最终领土比例，若被碾压则加大惩罚。
- **平局 / 模糊局**：
  - 根据领土比例给 -10 ~ +10 之间的小奖励，鼓励占优势的一方。
- **关键约束：maxTurns+人口判胜不参与 Q-learning**
  - 在 `GameSimulator` 中，当：
    - `turn >= maxTurns` 且
    - 没有正常 `gameOver` 且
    - 未超时
  - 就根据 **总人口** 判定胜负，并设置 `stats.resolvedByMaxTurns = true`。
  - 在 `RLTrainer` 中：

    ```js
    const isResolvedByMaxTurns = !!stats.resolvedByMaxTurns
    ...
    if (this.rlAI.updateQValues && !isResolvedByMaxTurns) {
      this.rlAI.updateQValues(reward)
      this.stats.totalReward += reward
    }
    ```

  - 效果：**这类“磨满回合靠人口判胜”的对局只计入胜率统计，不更新 Q 表**，避免 AI 学出“躺平刷人口”的风格。

---

## 3. 策略执行器的关键改进

### 3.1 BFS 找路（避山）

- 函数：`bfsNextStep(map, from, to)`
- 作用：
  - 对于不相邻的进攻 / 增援 / 补给行动，通过 BFS 找到 **第一步合适的移动方向**。
  - 显式跳过山地（`tile.type === 1`），减少“撞山”。
  - 被 `planAttack`、`planDefense`、`planSupplyToFrontline`、`planAllInAttack` 等多个策略复用。

### 3.2 进攻策略（planAttack）

核心思路：

- **高价值目标优先**：
  - 首都（`type === 3`）> 要塞（`type === 2`）> 普通高人口格子。
- **多源协同攻击（findCoordinatedAttack）**：
  - 当目标防御较高时，寻找多达 3 个附近己方格子，累积足够兵力后再发起攻击。
  - 避免单点送死。
- **安全阈值**：
  - 避免从首都/要塞上把兵抽得太空：

    ```js
    const criticalMin = playerCount && playerCount >= 3 ? 5 : 2
    if ((mtile.type === 3 || mtile.type === 2) && mtile.units <= criticalMin) continue
    ```

  - 多人局（`playerCount >= 3`）更保守，降低被“绕后偷家”的概率。
- **非相邻进攻也能向前推进**：
  - 对于优质目标，即使不相邻，也会利用 BFS 计算下一步推进方向，而不是只打相邻格子。

### 3.3 防御策略（planDefense）

主要目标：解决 1vN 时“**进攻很猛，但被其他家偷首都/要塞**”的问题。

- **重要目标集合**：
  - `importantTargets = [myCapital, ...myStrongholds]`
  - 首都优先级最高，其次是要塞。

- **潜在偷袭风险评估：calculateBackstabRisk**
  - 对每个敌方单位，计算其距离最近的重要目标的距离 + 敌方兵力，得到一个风险评分。
  - 当 `risk >= 4` 时：
    - 优先尝试 `findProactiveDefense`，直接杀掉威胁源；
    - 否则从后方抽取高兵力格子，使用 BFS 往首都/要塞方向增援。

- **边界突破检测：findBorderIncursions**
  - 当敌军靠近我方边界（离我方最近格 1~2 格）时，认定为“入侵点”：
    - 优先找能直接打掉入侵者的己方格；
    - 否则先往入侵点靠拢，形成封口。

- **常规防守：威胁列表 + 紧迫度**
  - 已有逻辑保留：
    - 在首都/要塞 5 格范围内找敌人，按“目标类型 + 紧迫度（1 回合 / 2-3 回合 / 4-5 回合）”排序；
    - 对紧迫度高且兵力不大者，优先主动出击（`findProactiveDefense`）；
    - 否则按最近原则寻找增援来源，利用 BFS 贴近防守目标。

### 3.4 发育与补给（planGrowth / planSupplyToFrontline）

- **优先占中立要塞**：
  - 从可移动的己方格子中选择距离最近的中立要塞，若相邻则直接占领。
- **扩张边界**：
  - 遍历己方格子，寻找邻接中立格的“边界格”，随机选择一处扩张（偏向半兵移动）。
- **向前线补给：planSupplyToFrontline**
  - 识别：
    - 前线格子：邻接敌方的己方格。
    - 后方富余格：人口较多、离前线较远的己方格。
  - 使用 BFS 把后方兵力向前线输送：

    ```js
    const nextStep = bfsNextStep(map, bestSource, target)
    return returnIfValid(context, {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: nextStep.x,
      toY: nextStep.y,
      moveType: 'half'
    })
    ```

  - 让前线始终有“后勤供血”，利于持续压制。

### 3.5 ALL-IN 策略（planAllInAttack）

适用场景：在某些局面下，我方明显领先，且已接近敌方首都，可以通过一波大兵力团灭。

- 基本逻辑：
  - 找到最近的敌方首都 `nearestEnemyCapital`。
  - 从己方格子中选一个高兵力源头（多人局对首都/要塞的抽兵更谨慎）：

    ```js
    const criticalMin = playerCount && playerCount >= 3 ? 8 : 2
    if ((myTile.tile.type === 3 || myTile.tile.type === 2) && myTile.tile.units <= criticalMin) continue
    ```

  - 若相邻，则直接 `moveType: 'max'` 一波冲上去；
  - 否则用 BFS 逼近敌方首都，一步步形成“超级死亡球”。

---

## 4. maxTurns 与人口判胜的处理

### 4.1 GameSimulator 中的逻辑

文件：`src/training/GameSimulator.js`

- 游戏主循环：
  - 正常按回合推进，直到：
    - 某一方被吃掉首都 => 正常 `gameOver`；
    - 超过 `maxTime` => `timeout`；
    - 回合数达到 `maxTurns` => 进入人口判胜逻辑。

- 当回合达到 `maxTurns` 且未结束、未超时：
  - 统计每个玩家的 **总人口**；
  - 找出人口最多的一方，若多人并列则在并列者中随机；
  - 设置：

    ```js
    stats.winner = winnerId
    stats.gameOver = true
    stats.resolvedByMaxTurns = true
    ```

### 4.2 RLTrainer 中的处理

文件：`src/training/RLTrainer.js`

- 每局训练结束后：

  ```js
  const isResolvedByMaxTurns = !!stats.resolvedByMaxTurns
  ...
  if (this.rlAI.updateQValues && !isResolvedByMaxTurns) {
    this.rlAI.updateQValues(reward)
    this.stats.totalReward += reward
  }
  ```

- 含义：
  - **真正学进 Q 表的，只是“首都被吃掉 / 超时 / 其他正常结束”的对局**；
  - “打满 maxTurns 通过人口判胜的对局”只用于：
    - 统计胜率、胜负局回合数；
    - 不参与 Q 更新，也不累计奖励。

- 结果现象：
  - 若用 `1v1 vs random` + 大 `maxTurns` 训练：
    - 胜率可以是 100%，每局都是 `maxTurns`；  
    - 但 **Q 表大小可能仍然是 0**，因为所有局都是 `resolvedByMaxTurns = true`，没有发生过有效学习；
    - 这并不是 Bug，而是设计使然：避免 AI 学出“刷人口磨满回合”的风格。

---

## 5. 典型训练结果与解读

> 以下数据是若干次代表性训练的统计结果，用于理解当前策略 + RL 在不同场景下的大致表现。

### 5.1 1v1 vs random（maxTurns 模式，不参与学习）

- 配置（示例）：
  - `--players 2 --mode against-fixed --opponent random --maxTurns 500`
- 观察结果（代表性输出）：
  - 胜率：100%
  - 胜利回合：全部为 `maxTurns`（例如 500/500/500）
  - 平均奖励：0
  - Q 表大小：0
  - 解读：
    - 靠底层策略 + 人口优势，**轻松碾压 random**；
    - 但由于全部靠 `maxTurns+人口判胜`，这些局都不参与 Q-learning，故 Q 表保持为 0。

### 5.2 1v3 vs adaptive（防御增强前）

- 代表性数据（用户历史统计）：
  - Episodes: 1000
  - 胜率：约 **49.1%**
  - 胜负回合：失败局平均回合较长，且常见“自己前线打得很猛，但后方被偷首都”的情况。
  - 解读：
    - 进攻与发育策略已经较强，但 **防御/反偷家意识不足**，在多人局中容易被第三方捡漏。

### 5.3 1v3 vs adaptive（加入防御增强 + 多人局驻军阈值后）

在 10x10 地图、`maxTurns=500` 环境下，多轮 300 局小样本测试结果（代表之一）：

- Episodes: 300
- 胜率：**56.0%**
- 胜利：168，失败：132，平局：0，超时：0
- 胜利回合：平均 117.8，最短 40，最长 447
- 失败回合：平均 184.2，最短 40，最长 500
- Q 表大小：≈180
- 解读：
  - 相比最初约 49% 的水平，胜率明显提升；
  - 失败平均回合缩短，说明 **更多是“正面打不过而输”，而不是“后方被偷家猝死”**；
  - Q 表规模保持在百级别，说明高层策略选择已经学到一定模式，但没有出现“状态爆炸”。

---

## 6. 使用与调参建议

### 6.1 命令行训练示例

- **1v1 vs random（主要用来检验底层策略强度，不一定用于训练）**：

```bash
node src/training/train_rl.js --agent strategy --episodes 1000 \
  --players 2 --width 10 --height 10 --maxTurns 500 --maxTime 30000 \
  --mode against-fixed --opponent random \
  --saveInterval 200 --logInterval 20 \
  --savePath ./qtable-1v1-random-strategy.json
```

- **1v3 vs adaptive（目前主要关注场景）**：

```bash
node src/training/train_rl.js --agent strategy --episodes 1000 \
  --players 4 --width 10 --height 10 --maxTurns 500 --maxTime 30000 \
  --mode against-fixed --opponent adaptive \
  --saveInterval 200 --logInterval 20 \
  --savePath ./qtable-1v3-adaptive-strategy.json
```

> 注意：`--players` 是“总玩家数 = 你 + 对手”，1v1 写 2，1v3 写 4。

### 6.2 建议的后续优化方向

- **更细的状态特征**：
  - 加入“当前回合所选策略的历史频率”“最近 N 回合的攻守平衡”等，帮助 RL 识别“该歇一歇还是继续冲”。
- **策略层偏置（特别是多人局）**：
  - 在 `playerCount >= 3` 且存在高风险偷袭时，给 `DEFEND` 人为加一个 Q 偏置，进一步强化“先守住家”的优先级。
- **对手多样化**：
  - 使用 `mixed` 模式（自博弈 + fixed 对手），或者混合 random/adaptive，让学到的策略更泛化。

---

## 7. 总结

- 当前版本的 RL 策略 AI 采用“**强底层 + 轻量 Q-learning 决策层**”的思路：
  - 底层用一套 BFS、协同进攻、前线补给、反偷家等规则保证**下限**和可解释性；
  - Q-learning 只负责在 `ATTACK / DEFEND / GROW / ALL_IN` 之间做出更聪明的选择，提升**上限**。
- 对 `random` / `adaptive` 的实战测试表明：
  - 在 1v1 中几乎可以完全碾压 random/adaptive（即便不学习）；
  - 在 1v3 vs adaptive 场景下，通过策略增强与 RL 结合，胜率已从约 29% 稳定提升到约 56%，且失败更加“正常”（正面战力不足）而非被偷家。
- 后续可以在此文档基础上持续记录新实验与新想法，作为 RL 策略版的设计笔记与 changelog。

