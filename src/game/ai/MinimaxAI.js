import AIBase from './AIBase.js'
import RandomAI from './RandomAI.js'

/**
 * Minimax AI with Alpha-Beta Pruning
 * 使用Minimax算法和Alpha-Beta剪枝进行决策
 */
class MinimaxAI extends AIBase {
  constructor(playerId, options = {}) {
    super(playerId)
    this.maxDepth = options.maxDepth || 2 // 搜索深度（默认2层）
    this.maxBranches = options.maxBranches || 10 // 每层最大分支数（默认10个）
    this.randomHelper = new RandomAI(playerId) // 回退方案
    
    // 评估函数参数（可以被进化算法优化）
    this.evalParams = options.evaluationParams || null
  }

  /**
   * 获取决策
   */
  getDecision(gameState) {
    if (!gameState) return null

    // 如果搜索深度为0，回退到随机AI
    if (this.maxDepth === 0) {
      return this.randomHelper.getDecision(gameState)
    }

    try {
      // 使用Minimax算法找到最佳移动
      const bestMove = this.minimax(gameState, this.maxDepth, -Infinity, Infinity, true)
      
      if (bestMove && bestMove.move) {
        return bestMove.move
      }
    } catch (error) {
      console.warn(`MinimaxAI error: ${error.message}, falling back to RandomAI`)
    }

    // 如果Minimax失败，回退到随机AI
    return this.randomHelper.getDecision(gameState)
  }

  /**
   * Minimax算法（带Alpha-Beta剪枝）
   * @param {Object} gameState - 游戏状态
   * @param {number} depth - 当前深度
   * @param {number} alpha - Alpha值（最大值下界）
   * @param {number} beta - Beta值（最小值上界）
   * @param {boolean} maximizing - 是否最大化（true=己方，false=对手）
   * @returns {Object} { score, move }
   */
  minimax(gameState, depth, alpha, beta, maximizing) {
    // 终止条件
    if (depth === 0 || gameState.gameOver) {
      const score = this.evaluate(gameState)
      return { score, move: null }
    }

    const currentPlayer = maximizing ? this.playerId : this.getNextEnemyPlayer(gameState)
    const moves = this.getAllPossibleMoves(gameState, currentPlayer)

    // 限制分支数，只考虑最有希望的移动
    const limitedMoves = this.limitMoves(moves, gameState, currentPlayer, this.maxBranches)

    if (limitedMoves.length === 0) {
      // 没有可移动的，评估当前状态
      const score = this.evaluate(gameState)
      return { score, move: null }
    }

    if (maximizing) {
      // 最大化层（己方）
      let maxScore = -Infinity
      let bestMove = null

      for (const move of limitedMoves) {
        // 模拟移动
        const newState = this.simulateMove(gameState, move, currentPlayer)
        
        // 递归搜索（切换到对手视角）
        const result = this.minimax(newState, depth - 1, alpha, beta, false)
        const score = result.score

        if (score > maxScore) {
          maxScore = score
          bestMove = move
        }

        // Alpha-Beta剪枝
        alpha = Math.max(alpha, score)
        if (beta <= alpha) {
          break // 剪枝
        }
      }

      return { score: maxScore, move: bestMove }
    } else {
      // 最小化层（对手）
      let minScore = Infinity
      let bestMove = null

      for (const move of limitedMoves) {
        // 模拟移动
        const newState = this.simulateMove(gameState, move, currentPlayer)
        
        // 递归搜索（切换回己方视角）
        const result = this.minimax(newState, depth - 1, alpha, beta, true)
        const score = result.score

        if (score < minScore) {
          minScore = score
          bestMove = move
        }

        // Alpha-Beta剪枝
        beta = Math.min(beta, score)
        if (beta <= alpha) {
          break // 剪枝
        }
      }

      return { score: minScore, move: bestMove }
    }
  }

  /**
   * 评估游戏状态（启发式函数）
   * 整合AdaptiveAI的核心策略评估逻辑
   * 返回对己方有利的分数（正数越大越好）
   */
  evaluate(gameState) {
    const { map, playerTiles, currentPlayer, gameOver, winner, turn } = gameState
    const myId = this.playerId

    // 游戏结束：如果己方获胜，返回极大值；如果失败，返回极小值
    if (gameOver) {
      if (winner === myId) {
        return 1000000 // 己方获胜
      } else if (winner && winner !== myId) {
        return -1000000 // 对手获胜
      }
      return 0 // 平局
    }

    // 构建上下文（类似AdaptiveAI）
    const context = this.buildContext(gameState, myId)
    
    // 1. 基础优势分数（当前状态，权重：30%）
    const baseScore = this.calculateBaseAdvantage(context)
    
    // 2. 进攻潜力分数（未来2-3回合能攻下的目标，权重：35%）
    // 特别强调：如果能一路攻到对方首都，给予极高分数
    const attackScore = this.calculateAttackPotential(context, gameState)
    
    // 3. 防御需求分数（未来2-3回合需要防守的威胁，权重：20%）
    const defenseScore = this.calculateDefenseNeed(context)
    
    // 4. 发育潜力分数（未来2-3回合能扩张的领土，权重：15%）
    const growthScore = this.calculateGrowthPotential(context)

    // 归一化分数，使其在合理范围内（-1000 到 +1000）
    // 这样可以避免分数过大导致的问题
    const totalScore = 
      baseScore * 0.30 +
      attackScore * 0.35 +  // 进攻权重最高，因为能攻下首都就赢了
      defenseScore * 0.20 +
      growthScore * 0.15

    // 限制分数范围，避免极端值
    return Math.max(-10000, Math.min(10000, totalScore))
  }

  /**
   * 构建上下文（类似AdaptiveAI的buildContext）
   */
  buildContext(gameState, myId) {
    const { map, playerTiles, turn } = gameState
    const ownTiles = (playerTiles[myId] || []).map(entry => ({ ...entry }))
    const enemyTiles = []
    const ownImportant = []
    const enemyImportant = []
    let ownUnits = 0
    let enemyUnits = 0
    let ownCapital = null

    // 收集己方信息
    for (const { x, y, tile } of ownTiles) {
      ownUnits += tile.units || 0
      if (tile.type === 3) { // 首都
        ownImportant.push({ x, y, tile })
        ownCapital = { x, y }
      } else if (tile.type === 2) { // 要塞
        ownImportant.push({ x, y, tile })
      }
    }

    // 收集敌方信息（只考虑威胁最大的对手）
    const threatEnemyId = this.getMostThreateningEnemy(map, playerTiles, myId)
    if (threatEnemyId) {
      const enemyTilesList = playerTiles[threatEnemyId] || []
      for (const { x, y, tile } of enemyTilesList) {
        enemyTiles.push({ x, y, tile })
        enemyUnits += tile.units || 0
        if (tile.type === 3 || tile.type === 2) {
          enemyImportant.push({ x, y, tile })
        }
      }
    }

    return {
      map,
      playerId: myId,
      ownTiles,
      enemyTiles,
      ownImportant,
      enemyImportant,
      ownUnits,
      enemyUnits,
      ownCapital,
      turn
    }
  }

  /**
   * 获取威胁最大的对手（威胁排序）
   */
  getMostThreateningEnemy(map, playerTiles, myId) {
    const enemies = []
    const myCapital = this.findCapital(map, myId)
    
    for (let id = 1; id <= (map.playerCount || 8); id++) {
      if (id !== myId && playerTiles[id] && playerTiles[id].length > 0) {
        const tiles = playerTiles[id]
        let totalUnits = 0
        let capital = null
        
        for (const { tile } of tiles) {
          totalUnits += tile.units || 0
          if (tile.type === 3) {
            capital = tiles.find(t => t.tile.type === 3)
          }
        }
        
        // 计算威胁分数：距离 × 兵力 × 领土大小
        let threatScore = totalUnits * tiles.length
        if (myCapital && capital) {
          const distance = Math.abs(capital.x - myCapital.x) + Math.abs(capital.y - myCapital.y)
          threatScore = threatScore / (distance + 1) // 距离越近威胁越大
        }
        
        enemies.push({ id, threatScore, totalUnits, tiles })
      }
    }
    
    if (enemies.length === 0) return null
    
    // 返回威胁最大的对手
    enemies.sort((a, b) => b.threatScore - a.threatScore)
    return enemies[0].id
  }

  /**
   * 计算基础优势分数（当前状态）
   * 特别重视大兵力地块的利用
   */
  calculateBaseAdvantage(context) {
    const { ownTiles, enemyTiles, ownUnits, enemyUnits } = context
    
    // 使用评估参数（如果提供）
    const params = this.evalParams || {
      territoryWeight: 20,
      armyWeight: 15,
      importantWeight: 50
    }
    
    // 领土优势
    const territoryAdvantage = (ownTiles.length - enemyTiles.length) * params.territoryWeight
    
    // 军队优势
    const armyAdvantage = (ownUnits - enemyUnits) * params.armyWeight
    
    // 重要目标控制
    const ownImportantCount = context.ownImportant.length
    const enemyImportantCount = context.enemyImportant.length
    const importantAdvantage = (ownImportantCount * params.importantWeight - enemyImportantCount * params.importantWeight)
    
    // 大兵力地块优势（发育后期特别重要）
    const largeArmyAdvantage = this.calculateLargeArmyAdvantage(context)
    
    return territoryAdvantage + armyAdvantage + importantAdvantage + largeArmyAdvantage
  }

  /**
   * 计算大兵力地块的优势
   * 识别并评估那些囤积了大量兵力的关键地块
   */
  calculateLargeArmyAdvantage(context) {
    const { ownTiles, map } = context
    
    // 使用评估参数（如果提供）
    const params = this.evalParams || {
      largeArmyThresholdMultiplier: 1.5,
      largeArmyMinUnits: 30,
      largeArmyBonus: 2
    }
    
    // 识别大兵力地块（兵力超过平均值的倍数，或者超过最小值）
    const avgUnits = ownTiles.reduce((sum, t) => sum + t.tile.units, 0) / Math.max(ownTiles.length, 1)
    const largeArmyThreshold = Math.max(avgUnits * params.largeArmyThresholdMultiplier, params.largeArmyMinUnits)
    
    const largeArmyTiles = ownTiles.filter(t => t.tile.units >= largeArmyThreshold)
    
    if (largeArmyTiles.length === 0) return 0
    
    let score = 0
    
    // 评估每个大兵力地块的"利用价值"
    for (const tile of largeArmyTiles) {
      const units = tile.tile.units
      
      // 基础分数：大兵力地块本身就有价值
      const params = this.evalParams || { largeArmyBonus: 2 }
      score += units * params.largeArmyBonus
      
      // 如果大兵力地块在重要位置（首都、要塞），额外加分
      if (tile.tile.type === 3) { // 首都
        score += units * 3
      } else if (tile.tile.type === 2) { // 要塞
        score += units * 2
      }
      
      // 评估大兵力地块的"移动潜力"
      // 检查周围是否有可攻击的目标或可占领的资源
      const movePotential = this.evaluateLargeArmyMovePotential(tile, context)
      score += movePotential
    }
    
    return score
  }

  /**
   * 评估大兵力地块的移动潜力
   * 检查这个地块能否用于进攻、防守或占领资源
   */
  evaluateLargeArmyMovePotential(tile, context) {
    const { map, enemyImportant, enemyTiles } = context
    const { x, y, tile: tileData } = tile
    const units = tileData.units
    
    let potential = 0
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ]
    
    // 检查四个方向
    for (const { dx, dy } of directions) {
      const nx = x + dx
      const ny = y + dy
      
      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue
      
      const targetTile = map.tiles[ny][nx]
      if (targetTile.type === 1) continue // 山区
      
      // 1. 进攻潜力：能攻击敌方重要目标
      if (targetTile.owner > 0 && targetTile.owner !== context.playerId) {
        const isImportant = targetTile.type === 3 || targetTile.type === 2
        const canCapture = units - 1 > targetTile.units
        
        if (canCapture) {
          if (targetTile.type === 3) { // 能攻下首都
            potential += 50 // 降低分数，因为这只是"潜力"
          } else if (targetTile.type === 2) { // 能攻下要塞
            potential += 20 // 降低分数
          } else if (isImportant) {
            potential += 10
          } else {
            potential += 5
          }
        }
      }
      
      // 2. 占领资源潜力：能占领中立要塞
      if (targetTile.owner === 0 && targetTile.type === 2) {
        const captureCost = targetTile.captureCost || 20
        if (units - 1 >= captureCost) {
          potential += 15 // 能占领中立要塞（降低）
        }
      }
      
      // 3. 防守潜力：能支援己方重要目标
      if (targetTile.owner === context.playerId) {
        const isImportant = targetTile.type === 3 || targetTile.type === 2
        if (isImportant) {
          // 检查这个重要目标是否被威胁
          const threat = this.findThreatNear(context, { x: nx, y: ny, tile: targetTile })
          if (threat) {
            potential += 10 // 能支援被威胁的重要目标（降低）
          }
        }
      }
      
      // 4. 扩张潜力：能占领中立领土
      if (targetTile.owner === 0 && targetTile.type === 0) {
        potential += 2 // 降低扩张分数
      }
    }
    
    return potential
  }

  /**
   * 计算进攻潜力分数（未来2-3回合能攻下的目标）
   * 特别强调：如果能一路攻到对方首都，给予极高分数
   * 重点评估大兵力地块的进攻价值
   */
  calculateAttackPotential(context, gameState) {
    const { ownTiles, enemyImportant, ownUnits, enemyUnits, ownCapital, turn } = context
    if (!enemyImportant.length || !ownTiles.length) return 0

    // 使用评估参数（如果提供）
    const params = this.evalParams || {
      largeArmyThresholdMultiplier: 1.5,
      largeArmyMinUnits: 30,
      attackBaseMultiplier: 5,
      attackCapitalBonus: 200,
      attackFastBonus: 100,
      attackLargeArmyBonus: 80
    }
    
    // 识别大兵力地块（优先考虑这些地块）
    const avgUnits = ownTiles.reduce((sum, t) => sum + t.tile.units, 0) / Math.max(ownTiles.length, 1)
    const largeArmyThreshold = Math.max(avgUnits * params.largeArmyThresholdMultiplier, params.largeArmyMinUnits)
    const largeArmyTiles = ownTiles.filter(t => t.tile.units >= largeArmyThreshold)
    
    // 优先使用大兵力地块进行评估
    const attackerCandidates = largeArmyTiles.length > 0 ? largeArmyTiles : ownTiles

    let maxAttackScore = 0
    let canReachCapital = false

    // 对每个敌方重要目标评估进攻潜力
    for (const target of enemyImportant) {
      // 找到最近的大兵力地块（优先）或强格子
      const attacker = this.findClosestStrongTile(attackerCandidates, target)
      if (!attacker) continue

      const distance = Math.abs(target.x - attacker.x) + Math.abs(target.y - attacker.y)
      const estimatedDefense = target.tile.owner === context.playerId ? 0 : target.tile.units + 1
      
      // 计算需要多少回合能到达
      const turnsToReach = Math.ceil(distance / 1) // 每回合移动1格
      
      // 计算在到达时能积累多少兵力
      const growthPerTurn = this.estimateGrowthRate(context)
      const unitsAtArrival = attacker.tile.units + (growthPerTurn * turnsToReach)
      
      // 评估能否攻下
      const canCapture = unitsAtArrival > estimatedDefense + (turnsToReach * growthPerTurn * 0.5)
      
      let attackScore = 0
      
      if (canCapture) {
        // 使用评估参数（如果提供）
        const params = this.evalParams || {
          attackBaseMultiplier: 5,
          attackCapitalBonus: 200,
          attackFastBonus: 100,
          attackLargeArmyBonus: 80
        }
        
        // 基础进攻分数（大兵力地块有加成）
        const isLargeArmy = attacker.tile.units >= largeArmyThreshold
        const baseMultiplier = isLargeArmy ? params.attackBaseMultiplier * 1.6 : params.attackBaseMultiplier
        attackScore = (unitsAtArrival - estimatedDefense) * baseMultiplier - distance * 2
        
        // 如果是首都，给予高分数（但要保守，因为对手会防守）
        if (target.tile.type === 3) {
          attackScore += params.attackCapitalBonus
          canReachCapital = true
          
          // 如果能快速攻下（2-3回合内），额外奖励
          if (turnsToReach <= 3) {
            attackScore += params.attackFastBonus
          }
          
          // 如果使用大兵力地块能快速攻下，额外奖励
          if (isLargeArmy && turnsToReach <= 3) {
            attackScore += params.attackLargeArmyBonus
          }
          
          // 如果兵力优势明显，额外奖励（更可能成功）
          if (unitsAtArrival > estimatedDefense * 2) {
            attackScore += 50 // 兵力优势明显
          }
        } else if (target.tile.type === 2) {
          // 要塞也有较高分数
          attackScore += 50 // 降低要塞分数
          if (isLargeArmy) {
            attackScore += 20 // 大兵力地块攻要塞额外奖励（降低）
          }
        }
        
        // 保守型：己方总兵力明显领先时额外加分
        if (ownUnits > enemyUnits + estimatedDefense) {
          attackScore += 100
        }
        
        // 激进型：对比首都兵力
        const opposingCapital = enemyImportant.find(t => t.tile.type === 3)
        if (opposingCapital && ownCapital) {
          const ownCapitalTile = context.map.tiles[ownCapital.y][ownCapital.x]
          if (ownCapitalTile && ownCapitalTile.units >= opposingCapital.tile.units) {
            attackScore += 50
          }
        }
        
        // 孤注一掷：50回合后落后时提高进攻倾向
        if (turn > 50 && ownUnits < enemyUnits * 0.8) {
          attackScore += 200
        }
      }
      
      maxAttackScore = Math.max(maxAttackScore, attackScore)
    }

    // 如果能攻下首都，给予额外奖励
    if (canReachCapital) {
      maxAttackScore *= 1.5
    }

    return maxAttackScore
  }

  /**
   * 计算防御需求分数（未来2-3回合需要防守的威胁）
   * 重点评估大兵力地块的防守价值
   */
  calculateDefenseNeed(context) {
    const { ownImportant, enemyTiles, ownTiles } = context
    if (!ownImportant.length || !enemyTiles.length) return 0

    // 使用评估参数（如果提供）
    const params = this.evalParams || {
      largeArmyThresholdMultiplier: 1.5,
      largeArmyMinUnits: 30,
      defenseCapitalBonus: 200,
      defenseStrongholdBonus: 80,
      defenseSupportBonus: 300
    }

    // 识别大兵力地块
    const avgUnits = ownTiles.reduce((sum, t) => sum + t.tile.units, 0) / Math.max(ownTiles.length, 1)
    const largeArmyThreshold = Math.max(avgUnits * params.largeArmyThresholdMultiplier, params.largeArmyMinUnits)
    const largeArmyTiles = ownTiles.filter(t => t.tile.units >= largeArmyThreshold)

    let totalDefenseScore = 0

    // 对每个己方重要目标检查威胁
    for (const target of ownImportant) {
      const threat = this.findThreatNear(context, target)
      if (!threat) continue

      const threatLevel = threat.tile.units
      const importanceBonus = target.tile.type === 3 ? params.defenseCapitalBonus : params.defenseStrongholdBonus
      
      // 威胁越大、目标越重要，防御分数越高
      let defenseScore = (importanceBonus + threatLevel * 10)
      
      // 检查是否有大兵力地块能快速支援
      const nearestLargeArmy = this.findClosestStrongTile(largeArmyTiles, target)
      if (nearestLargeArmy) {
        const distance = Math.abs(target.x - nearestLargeArmy.x) + Math.abs(target.y - nearestLargeArmy.y)
        if (distance <= 3 && nearestLargeArmy.tile.units >= threatLevel) {
          // 大兵力地块能快速支援，额外加分
          defenseScore += params.defenseSupportBonus
        }
      }
      
      totalDefenseScore += defenseScore
    }

    return totalDefenseScore
  }

  /**
   * 计算发育潜力分数（未来2-3回合能扩张的领土）
   */
  calculateGrowthPotential(context) {
    const { ownTiles, map } = context
    if (!ownTiles.length) return 0

    // 使用评估参数（如果提供）
    const params = this.evalParams || {
      growthStrongholdBonus: 300,
      growthTerritoryBonus: 10
    }

    let growthScore = 0

    // 1. 可占领的中立要塞
    const neutralStrongholds = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.type === 2 && tile.owner === 0) {
          neutralStrongholds.push({ x, y, tile })
        }
      }
    }
    
    if (neutralStrongholds.length > 0) {
      const closestStronghold = this.findClosestTarget(
        this.pickStrongTile(ownTiles),
        neutralStrongholds
      )
      if (closestStronghold) {
        const distance = Math.abs(closestStronghold.x - ownTiles[0].x) + 
                        Math.abs(closestStronghold.y - ownTiles[0].y)
        growthScore += params.growthStrongholdBonus / (distance + 1) // 距离越近分数越高
      }
    }

    // 2. 可扩张的中立领土
    let expandableTiles = 0
    for (const { x, y } of ownTiles) {
      const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
      ]
      for (const { dx, dy } of directions) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
          const tile = map.tiles[ny][nx]
          if (tile.owner === 0 && tile.type === 0) {
            expandableTiles++
          }
        }
      }
    }
    growthScore += expandableTiles * params.growthTerritoryBonus

    return growthScore
  }

  /**
   * 估算军队增长率
   */
  estimateGrowthRate(context) {
    const { ownTiles } = context
    let growthRate = 0
    
    for (const { tile } of ownTiles) {
      if (tile.type === 3) { // 首都
        growthRate += 1
      } else if (tile.type === 2) { // 要塞
        growthRate += 1
      } else {
        growthRate += 0.04 // 普通格子每25回合+1
      }
    }
    
    return growthRate
  }

  /**
   * 找到最近的强格子（用于进攻）
   */
  findClosestStrongTile(ownTiles, target) {
    if (!ownTiles.length || !target) return null
    
    const strongTiles = ownTiles
      .filter(t => t.tile.units >= 3)
      .sort((a, b) => b.tile.units - a.tile.units)
    
    if (strongTiles.length === 0) return ownTiles[0] || null
    
    let best = null
    let bestDist = Infinity
    
    for (const tile of strongTiles.slice(0, 5)) { // 只考虑前5个最强的
      const dist = Math.abs(target.x - tile.x) + Math.abs(target.y - tile.y)
      if (dist < bestDist) {
        bestDist = dist
        best = tile
      }
    }
    
    return best || strongTiles[0]
  }

  /**
   * 找到附近的威胁（类似AdaptiveAI）
   */
  findThreatNear(context, target) {
    const { enemyTiles, map } = context
    if (!enemyTiles.length) return null

    let closestThreat = null
    let minDistance = Infinity

    for (const enemy of enemyTiles) {
      const distance = Math.abs(enemy.x - target.x) + Math.abs(enemy.y - target.y)
      // 威胁在3格以内
      if (distance <= 3 && distance < minDistance) {
        minDistance = distance
        closestThreat = enemy
      }
    }

    return closestThreat
  }

  /**
   * 找到最近的目标（类似AdaptiveAI）
   */
  findClosestTarget(from, targets) {
    if (!from || !targets?.length) return null
    let best = null
    let bestDist = Infinity
    
    for (const target of targets) {
      const dist = Math.abs(target.x - from.x) + Math.abs(target.y - from.y)
      if (dist < bestDist) {
        bestDist = dist
        best = target
      }
    }
    return best
  }

  /**
   * 选择强格子（类似AdaptiveAI）
   */
  pickStrongTile(ownTiles) {
    if (!ownTiles.length) return null
    const sorted = ownTiles
      .filter(t => t.tile.units >= 3)
      .sort((a, b) => b.tile.units - a.tile.units)
    return sorted[0] || ownTiles[0]
  }

  /**
   * 获取玩家统计信息
   */
  getPlayerStats(map, playerTiles, playerId) {
    const tiles = playerTiles[playerId] || []
    let totalUnits = 0
    let capitalCount = 0
    let strongholdCount = 0
    let growthRate = 0

    for (const { tile } of tiles) {
      totalUnits += tile.units || 0
      
      if (tile.type === 3) { // 首都
        capitalCount++
        growthRate += 1 // 每回合+1
      } else if (tile.type === 2) { // 要塞
        strongholdCount++
        growthRate += 1 // 每回合+1
      } else {
        growthRate += 0.04 // 普通格子每25回合+1，平均每回合+0.04
      }
    }

    return {
      territoryCount: tiles.length,
      totalUnits,
      capitalCount,
      strongholdCount,
      growthRate
    }
  }

  /**
   * 获取对手统计信息（平均值）
   */
  getEnemyStats(map, playerTiles, myId) {
    const enemyIds = []
    for (let id = 1; id <= (map.playerCount || 8); id++) {
      if (id !== myId && playerTiles[id] && playerTiles[id].length > 0) {
        enemyIds.push(id)
      }
    }

    if (enemyIds.length === 0) {
      return {
        enemyIds: [],
        avgTerritoryCount: 0,
        avgTotalUnits: 0,
        avgCapitalCount: 0,
        avgStrongholdCount: 0,
        avgGrowthRate: 0
      }
    }

    let totalTerritory = 0
    let totalUnits = 0
    let totalCapital = 0
    let totalStronghold = 0
    let totalGrowthRate = 0

    for (const enemyId of enemyIds) {
      const stats = this.getPlayerStats(map, playerTiles, enemyId)
      totalTerritory += stats.territoryCount
      totalUnits += stats.totalUnits
      totalCapital += stats.capitalCount
      totalStronghold += stats.strongholdCount
      totalGrowthRate += stats.growthRate
    }

    return {
      enemyIds,
      avgTerritoryCount: totalTerritory / enemyIds.length,
      avgTotalUnits: totalUnits / enemyIds.length,
      avgCapitalCount: totalCapital / enemyIds.length,
      avgStrongholdCount: totalStronghold / enemyIds.length,
      avgGrowthRate: totalGrowthRate / enemyIds.length
    }
  }

  /**
   * 计算位置优势分数
   */
  calculatePositionScore(map, myId, enemyIds) {
    if (enemyIds.length === 0) return 0

    // 找到己方首都
    const myCapital = this.findCapital(map, myId)
    if (!myCapital) return 0

    // 计算到所有敌方首都的平均距离（距离越近分数越高）
    let totalDistance = 0
    let count = 0

    for (const enemyId of enemyIds) {
      const enemyCapital = this.findCapital(map, enemyId)
      if (enemyCapital) {
        const distance = Math.abs(enemyCapital.x - myCapital.x) + Math.abs(enemyCapital.y - myCapital.y)
        totalDistance += distance
        count++
      }
    }

    if (count === 0) return 0

    const avgDistance = totalDistance / count
    // 距离越近分数越高（使用倒数，最大距离设为map.width+map.height）
    const maxDistance = map.width + map.height
    return (maxDistance - avgDistance) * 10
  }

  /**
   * 找到玩家的首都
   */
  findCapital(map, playerId) {
    for (const capital of (map.capitals || [])) {
      if (capital.playerId === playerId) {
        return { x: capital.x, y: capital.y }
      }
    }
    return null
  }

  /**
   * 获取所有可能的移动
   */
  getAllPossibleMoves(gameState, playerId) {
    const { map, playerTiles } = gameState
    const moves = []
    const ownTiles = playerTiles[playerId] || []

    for (const { x, y, tile } of ownTiles) {
      if (tile.units < 2) continue

      // 检查四个方向
      const directions = [
        { dx: 0, dy: -1 }, // 上
        { dx: 0, dy: 1 },  // 下
        { dx: -1, dy: 0 }, // 左
        { dx: 1, dy: 0 }   // 右
      ]

      for (const { dx, dy } of directions) {
        const toX = x + dx
        const toY = y + dy

        // 检查边界
        if (toX < 0 || toX >= map.width || toY < 0 || toY >= map.height) {
          continue
        }

        const toTile = map.tiles[toY][toX]

        // 不能移动到山区
        if (toTile.type === 1) {
          continue
        }

        // 生成两种移动类型
        moves.push({
          fromX: x,
          fromY: y,
          toX,
          toY,
          moveType: 'half' // 50%兵力
        })

        moves.push({
          fromX: x,
          fromY: y,
          toX,
          toY,
          moveType: 'max' // 只留1个
        })
      }
    }

    return moves
  }

  /**
   * 限制移动数量（只保留最有希望的移动）
   * 优先考虑大兵力地块的移动
   */
  limitMoves(moves, gameState, playerId, maxBranches) {
    if (moves.length <= maxBranches) {
      return moves
    }

    // 识别大兵力地块
    const { map, playerTiles } = gameState
    const ownTiles = playerTiles[playerId] || []
    const avgUnits = ownTiles.reduce((sum, t) => sum + t.tile.units, 0) / Math.max(ownTiles.length, 1)
    // 使用评估参数（如果提供）
    const params = this.evalParams || {
      largeArmyThresholdMultiplier: 1.5,
      largeArmyMinUnits: 30
    }
    const largeArmyThreshold = Math.max(avgUnits * params.largeArmyThresholdMultiplier, params.largeArmyMinUnits)

    // 对移动进行评分排序
    const scoredMoves = moves.map(move => {
      const fromTile = map.tiles[move.fromY][move.fromX]
      const isLargeArmy = fromTile.units >= largeArmyThreshold
      
      // 大兵力地块的移动有额外加分
      let score = this.scoreMove(move, gameState, playerId)
      if (isLargeArmy) {
        score *= 1.5 // 大兵力地块移动优先
      }
      
      return { move, score }
    })

    // 按分数降序排序
    scoredMoves.sort((a, b) => b.score - a.score)

    // 返回前maxBranches个
    return scoredMoves.slice(0, maxBranches).map(item => item.move)
  }

  /**
   * 评估单个移动的分数（用于排序）
   */
  scoreMove(move, gameState, playerId) {
    const { map } = gameState
    const fromTile = map.tiles[move.fromY][move.fromX]
    const toTile = map.tiles[move.toY][move.toX]

    let score = 0

    // 计算移动的兵力
    const moveUnits = move.moveType === 'half' 
      ? Math.floor(fromTile.units / 2)
      : fromTile.units - 1

    // 1. 攻击敌方重要目标（首都、要塞）得分高
    if (toTile.owner !== playerId && toTile.owner > 0) {
      if (toTile.type === 3) { // 首都
        score += 1000
      } else if (toTile.type === 2) { // 要塞
        score += 500
      } else {
        score += 100
      }

      // 如果能击败对手，额外加分
      if (moveUnits > toTile.units) {
        score += (moveUnits - toTile.units) * 10
      }
    }

    // 2. 占领中立要塞得分高
    if (toTile.owner === 0 && toTile.type === 2) {
      score += 300
    }

    // 3. 扩张领土得分
    if (toTile.owner === 0 && toTile.type === 0) {
      score += 50
    }

    // 4. 移动兵力越多，分数越高
    score += moveUnits * 5

    return score
  }

  /**
   * 模拟移动（深度复制游戏状态并执行移动）
   */
  simulateMove(gameState, move, playerId) {
    // 深度复制游戏状态
    const newState = this.deepCloneState(gameState)

    // 执行移动
    this.applyMove(newState, move, playerId)

    return newState
  }

  /**
   * 深度复制游戏状态
   */
  deepCloneState(gameState) {
    const { map, currentPlayer, turn, round, winner, gameOver, playerTiles, playerCount } = gameState

    // 深度复制地图
    const newMap = {
      width: map.width,
      height: map.height,
      tiles: map.tiles.map(row => 
        row.map(tile => ({
          ...tile,
          units: tile.units,
          owner: tile.owner,
          type: tile.type,
          captureCost: tile.captureCost
        }))
      ),
      capitals: map.capitals ? map.capitals.map(c => ({ ...c })) : [],
      playerCount: map.playerCount || playerCount
    }

    // 深度复制玩家格子索引
    const newPlayerTiles = {}
    for (const [pid, tiles] of Object.entries(playerTiles)) {
      newPlayerTiles[pid] = tiles.map(({ x, y, tile }) => ({
        x,
        y,
        tile: newMap.tiles[y][x]
      }))
    }

    return {
      map: newMap,
      currentPlayer,
      turn,
      round,
      winner,
      gameOver,
      playerTiles: newPlayerTiles,
      playerCount
    }
  }

  /**
   * 应用移动到游戏状态
   */
  applyMove(gameState, move, playerId) {
    const { map, playerTiles } = gameState
    const fromTile = map.tiles[move.fromY][move.fromX]
    const toTile = map.tiles[move.toY][move.toX]

    // 计算移动的兵力
    const moveUnits = move.moveType === 'half'
      ? Math.floor(fromTile.units / 2)
      : fromTile.units - 1

    // 更新源格子
    fromTile.units -= moveUnits

    // 处理目标格子
    if (toTile.owner === playerId) {
      // 己方格子：合并
      toTile.units += moveUnits
    } else if (toTile.owner === 0) {
      // 中立格子
      if (toTile.type === 2 && typeof toTile.captureCost === 'number' && toTile.captureCost > 0) {
        // 中立要塞：需要解锁
        const usedForUnlock = Math.min(moveUnits, toTile.captureCost)
        const remainingAfterUnlock = moveUnits - usedForUnlock
        toTile.captureCost -= usedForUnlock

        if (toTile.captureCost <= 0) {
          toTile.owner = playerId
          toTile.units = remainingAfterUnlock
          this.updateTileOwnership(gameState, move.toX, move.toY, 0, playerId)
        }
      } else {
        // 普通中立格子：直接占领
        toTile.owner = playerId
        toTile.units = moveUnits
        this.updateTileOwnership(gameState, move.toX, move.toY, 0, playerId)
      }
    } else {
      // 敌方格子：战斗
      const result = moveUnits - toTile.units
      const wasCapital = toTile.type === 3

      if (result >= 1) {
        // 占领成功
        const oldOwner = toTile.owner
        toTile.owner = playerId
        toTile.units = result

        if (wasCapital) {
          // 首都被占领：简化处理（不处理迁都等复杂逻辑）
          toTile.type = 2 // 变为要塞
        }

        this.updateTileOwnership(gameState, move.toX, move.toY, oldOwner, playerId)
      } else {
        // 攻击失败
        toTile.units = Math.max(0, toTile.units - moveUnits)
      }
    }

    // 检查胜利条件（简化版）
    this.checkWinCondition(gameState, playerId)
  }

  /**
   * 更新格子所有权（在模拟状态中）
   */
  updateTileOwnership(gameState, x, y, oldOwner, newOwner) {
    const { playerTiles } = gameState
    const tile = gameState.map.tiles[y][x]

    // 从旧主人的索引中移除
    if (oldOwner > 0 && playerTiles[oldOwner]) {
      const index = playerTiles[oldOwner].findIndex(t => t.x === x && t.y === y)
      if (index !== -1) {
        playerTiles[oldOwner].splice(index, 1)
      }
    }

    // 添加到新主人的索引中
    if (newOwner > 0) {
      if (!playerTiles[newOwner]) {
        playerTiles[newOwner] = []
      }
      playerTiles[newOwner].push({ x, y, tile })
    }
  }

  /**
   * 检查胜利条件（简化版）
   */
  checkWinCondition(gameState, playerId) {
    const { map, playerTiles } = gameState

    // 检查是否有其他玩家存活
    let aliveCount = 0
    let winner = null

    for (let id = 1; id <= gameState.playerCount; id++) {
      if (playerTiles[id] && playerTiles[id].length > 0) {
        aliveCount++
        winner = id
      }
    }

    if (aliveCount === 1) {
      gameState.gameOver = true
      gameState.winner = winner
    }
  }

  /**
   * 获取下一个对手玩家ID（使用威胁排序）
   */
  getNextEnemyPlayer(gameState) {
    // 返回威胁最大的对手
    const threatEnemyId = this.getMostThreateningEnemy(
      gameState.map,
      gameState.playerTiles,
      this.playerId
    )
    return threatEnemyId || ((this.playerId % gameState.playerCount) + 1)
  }
}

export default MinimaxAI

