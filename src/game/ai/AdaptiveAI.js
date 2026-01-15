import AIBase from './AIBase.js'
import RandomAI from './RandomAI.js'

const STRATEGY_WEIGHTS = {
  attack: 1.25,
  defense: 1.1,
  growth: 0.95
}

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 }
]

class AdaptiveAI extends AIBase {
  constructor(playerId) {
    super(playerId)
    this.randomHelper = new RandomAI(playerId)
  }

  getDecision(gameState) {
    if (!gameState) return null

    const context = this.buildContext(gameState)
    const candidates = [
      this.evaluateAttackStrategy(context),
      this.evaluateDefenseStrategy(context),
      this.evaluateGrowthStrategy(context)
    ].filter(Boolean)

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score)
      const best = candidates.find((item) => item.score > 0 && item.action)
      if (best) {
        return best.action
      }
    }

    return this.randomHelper.getDecision(gameState)
  }

  buildContext(gameState) {
    const { map, playerTiles = {}, currentPlayer, playerCount, turn } = gameState
    const ownTiles = (playerTiles[currentPlayer] || []).map((entry) => ({
      ...entry
    }))
    const enemyTiles = []
    const ownImportant = []
    const enemyImportant = []
    let ownUnits = 0
    let enemyUnits = 0

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.owner === currentPlayer) {
          ownUnits += tile.units
          if (tile.type === 3 || (tile.type === 2 && tile.owner === currentPlayer)) {
            ownImportant.push({ x, y, tile })
          }
        } else if (tile.owner > 0) {
          enemyUnits += tile.units
          enemyTiles.push({ x, y, tile })
          if (tile.type === 3 || tile.type === 2) {
            enemyImportant.push({ x, y, tile })
          }
        } else if (tile.type === 2 && tile.owner === 0) {
          // 中立要塞：在成长策略中需要
          enemyImportant.push({ x, y, tile })
        }
      }
    }

    const capitals = map.capitals || []
    const ownCapital = capitals.find((c) => c.playerId === currentPlayer) || null
    const enemyCapitals = capitals.filter((c) => c.playerId !== currentPlayer)

    return {
      map,
      playerId: currentPlayer,
      playerCount,
      turn,
      ownTiles,
      enemyTiles,
      ownUnits,
      enemyUnits,
      ownImportant,
      enemyImportant,
      ownCapital,
      enemyCapitals
    }
  }

  evaluateAttackStrategy(context) {
    if (!context.ownTiles.length || !context.enemyImportant.length) return null

    let best = null
    for (const from of context.ownTiles) {
      if (from.tile.units < 2) continue
      const target = this.findClosestTarget(from, context.enemyImportant)
      if (!target) continue

      const nextStep = this.getStepTowards(from, target, context.map)
      if (!nextStep) continue

      const toTile = context.map.tiles[nextStep.y][nextStep.x]
      if (toTile.type === 1) continue

      const distance = Math.abs(target.x - from.x) + Math.abs(target.y - from.y)
      const estimatedDefense = (toTile.owner === context.playerId ? 0 : toTile.units + 1)
      let baseScore = from.tile.units - estimatedDefense - distance * 0.5

      // 保守型：己方总兵力明显领先时才进攻
      if (context.ownUnits > context.enemyUnits + estimatedDefense) {
        baseScore += 15
      }

      // 激进型：对比关键据点（首都）兵力
      const opposingCapital = this.findCapitalForOwner(context, target.tile.owner)
      if (opposingCapital && context.ownCapital) {
        const ownCapitalTile = context.map.tiles[context.ownCapital.y][context.ownCapital.x]
        const opposingCapitalTile = context.map.tiles[opposingCapital.y][opposingCapital.x]
        if (ownCapitalTile.units >= opposingCapitalTile.units) {
          baseScore += 8
        }
      }

      // 反击型：如果己方重要目标被威胁，则优先打击该威胁来源
      if (this.isImportantUnderThreat(context, target)) {
        baseScore += 12
      }
  
      // 孤注一掷：50回合后己方落后明显则提高进攻倾向
      if (context.turn > 50 && context.ownUnits < context.enemyUnits * 0.8) {
        baseScore += 18
      }

      const moveType = from.tile.units - 1 > estimatedDefense ? 'max' : 'half'
      const score = baseScore * STRATEGY_WEIGHTS.attack
      const action = {
        fromX: from.x,
        fromY: from.y,
        toX: nextStep.x,
        toY: nextStep.y,
        moveType
      }

      if (!best || score > best.score) {
        best = { score, action }
      }
    }

    return best
  }

  evaluateDefenseStrategy(context) {
    if (!context.ownImportant.length) return null

    let best = null
    for (const target of context.ownImportant) {
      const threat = this.findThreatNear(context, target)
      if (!threat) continue

      const support = this.findNearestSupportTile(context, target)
      if (!support) continue

      const step = this.getStepTowards(support, threat, context.map)
      if (!step) continue

      const importanceBonus = target.tile.type === 3 ? 20 : 8
      const threatLevel = threat.tile.units
      const baseScore = (importanceBonus + threatLevel) * STRATEGY_WEIGHTS.defense
      const moveType = support.tile.units > threat.tile.units + 1 ? 'max' : 'half'

      const action = {
        fromX: support.x,
        fromY: support.y,
        toX: step.x,
        toY: step.y,
        moveType
      }

      if (!best || baseScore > best.score) {
        best = { score: baseScore, action }
      }
    }

    return best
  }

  evaluateGrowthStrategy(context) {
    if (!context.ownTiles.length) return null

    const modeRoll = Math.random()
    let action = null
    let baseScore = 0

    if (modeRoll < 0.35) {
      // 最近要塞
      const target = this.findClosestNeutralStronghold(context)
      if (target) {
        action = this.planMoveTowardTarget(context, target)
        baseScore = 18
      }
    } else if (modeRoll < 0.65) {
      // 向边界扩张
      action = this.expandTowardsNeutralBorder(context)
      baseScore = 14
    } else if (modeRoll < 0.85) {
      // 进攻型发育：针对重要地点定向扩张
      const target = this.findClosestTarget(
        this.pickStrongTile(context),
        context.enemyImportant
      )
      if (target) {
        action = this.planMoveTowardTarget(context, target, 'half')
        baseScore = 16
      }
    } else {
      // 模仿型：沿敌军主要推进方向扩张
      action = this.mirrorEnemyExpansion(context)
      baseScore = 12
    }

    if (!action) return null

    return {
      score: baseScore * STRATEGY_WEIGHTS.growth,
      action
    }
  }

  planMoveTowardTarget(context, target, preferredMoveType = 'max') {
    if (!target) return null
    const seed = this.pickStrongTile(context)
    if (!seed) return null

    const step = this.getStepTowards(seed, target, context.map)
    if (!step) return null

    const moveType = preferredMoveType === 'half' ? 'half' : (seed.tile.units > 4 ? 'max' : 'half')

    return {
      fromX: seed.x,
      fromY: seed.y,
      toX: step.x,
      toY: step.y,
      moveType
    }
  }

  expandTowardsNeutralBorder(context) {
    for (const from of context.ownTiles) {
      for (const dir of DIRECTIONS) {
        const nx = from.x + dir.dx
        const ny = from.y + dir.dy
        if (!this.isInside(nx, ny, context.map)) continue
        const tile = context.map.tiles[ny][nx]
        if (tile.owner === 0 && tile.type !== 1) {
          return {
            fromX: from.x,
            fromY: from.y,
            toX: nx,
            toY: ny,
            moveType: 'half'
          }
        }
      }
    }
    return null
  }

  findClosestNeutralStronghold(context) {
    const strongholds = []
    for (let y = 0; y < context.map.height; y++) {
      for (let x = 0; x < context.map.width; x++) {
        const tile = context.map.tiles[y][x]
        if (tile.type === 2 && tile.owner === 0) {
          strongholds.push({ x, y, tile })
        }
      }
    }
    if (!strongholds.length) return null

    const seed = this.pickStrongTile(context)
    if (!seed) return null

    return this.findClosestTarget(seed, strongholds)
  }

  mirrorEnemyExpansion(context) {
    if (!context.enemyTiles.length || !context.ownTiles.length) return null
    const enemyFront = context.enemyTiles.reduce((acc, tile) => {
      return tile.tile.units > acc.tile.units ? tile : acc
    }, context.enemyTiles[0])

    const seed = this.pickStrongTile(context)
    if (!seed) return null

    const dx = Math.sign(enemyFront.x - seed.x)
    const dy = Math.sign(enemyFront.y - seed.y)
    const target = {
      x: this.clamp(seed.x + dx * 2, 0, context.map.width - 1),
      y: this.clamp(seed.y + dy * 2, 0, context.map.height - 1)
    }

    return this.planMoveTowardTarget(context, target, 'half')
  }

  pickStrongTile(context) {
    const sorted = context.ownTiles
      .filter((tile) => tile.tile.units >= 3)
      .sort((a, b) => b.tile.units - a.tile.units)
    return sorted[0] || context.ownTiles[0] || null
  }

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

  getStepTowards(from, target, map) {
    if (!from || !target) return null
    const dx = target.x - from.x
    const dy = target.y - from.y
    const step = {
      x: from.x + (dx !== 0 ? Math.sign(dx) : 0),
      y: from.y + (dx === 0 ? Math.sign(dy) : 0)
    }

    if (!this.isInside(step.x, step.y, map)) return null
    if (map.tiles[step.y][step.x].type === 1) {
      // 尝试垂直/水平绕行
      for (const dir of DIRECTIONS) {
        const nx = from.x + dir.dx
        const ny = from.y + dir.dy
        if (this.isInside(nx, ny, map) && map.tiles[ny][nx].type !== 1) {
          return { x: nx, y: ny }
        }
      }
      return null
    }

    return step
  }

  findThreatNear(context, target) {
    if (!target) return null
    let threatening = null
    for (const dir of DIRECTIONS) {
      const nx = target.x + dir.dx
      const ny = target.y + dir.dy
      if (!this.isInside(nx, ny, context.map)) continue
      const tile = context.map.tiles[ny][nx]
      if (tile.owner > 0 && tile.owner !== context.playerId) {
        if (!threatening || tile.units > threatening.tile.units) {
          threatening = { x: nx, y: ny, tile }
        }
      }
    }
    return threatening
  }

  findNearestSupportTile(context, target) {
    let best = null
    let bestDist = Infinity
    for (const tile of context.ownTiles) {
      if (tile.tile.units < 2) continue
      const dist = Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y)
      if (dist < bestDist) {
        bestDist = dist
        best = tile
      }
    }
    return best
  }

  isImportantUnderThreat(context, target) {
    if (!target) return false
    for (const dir of DIRECTIONS) {
      const nx = target.x + dir.dx
      const ny = target.y + dir.dy
      if (!this.isInside(nx, ny, context.map)) continue
      const tile = context.map.tiles[ny][nx]
      if (tile.owner > 0 && tile.owner !== context.playerId) {
        return true
      }
    }
    return false
  }

  findCapitalForOwner(context, ownerId) {
    if (!ownerId) return null
    return context.enemyCapitals.find((cap) => cap.playerId === ownerId) || null
  }

  isInside(x, y, map) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }
}

export default AdaptiveAI
















