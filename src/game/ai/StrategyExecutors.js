/**
 * 策略执行器
 * 包含规则基础的底层策略执行逻辑
 */
import RandomAI from './RandomAI.js'

const DIRECTIONS = [
  { dx: 0, dy: -1 }, // 上
  { dx: 0, dy: 1 },  // 下
  { dx: -1, dy: 0 }, // 左
  { dx: 1, dy: 0 }   // 右
]

function isValidMove(context, action) {
  if (!action) return false
  const { map, myId } = context
  if (!map || !map.tiles) return false
  const { fromX, fromY, toX, toY } = action
  if ([fromX, fromY, toX, toY].some(v => typeof v !== 'number')) return false
  if (fromX < 0 || fromX >= map.width || fromY < 0 || fromY >= map.height) return false
  if (toX < 0 || toX >= map.width || toY < 0 || toY >= map.height) return false
  const fromTile = map.tiles[fromY]?.[fromX]
  if (!fromTile) return false
  if (fromTile.owner !== myId) return false
  if ((fromTile.units || 0) < 2) return false
  // 必须相邻
  const manhattan = Math.abs(fromX - toX) + Math.abs(fromY - toY)
  if (manhattan !== 1) return false
  // 不能走山
  const toTile = map.tiles[toY]?.[toX]
  if (!toTile) return false
  if (toTile.type === 1) return false
  return true
}

function returnIfValid(context, action) {
  return isValidMove(context, action) ? action : null
}

/**
 * 构建游戏上下文
 */
export function buildContext(gameState, playerId) {
  if (!gameState || !gameState.map) {
    throw new Error('buildContext: gameState or gameState.map is undefined')
  }

  const { map, playerTiles = {}, currentPlayer, playerCount, turn } = gameState
  const myId = playerId || currentPlayer

  // 收集己方和敌方信息
  const myTiles = []
  const enemyTiles = []
  const neutralTiles = []
  let myCapital = null
  const myStrongholds = []
  const enemyCapitals = []
  const enemyStrongholds = []

  let myTotalUnits = 0
  let enemyTotalUnits = 0
  let myTerritory = 0
  let enemyTerritory = 0

  if (!map.height || !map.width || !map.tiles) {
    throw new Error(`buildContext: map is invalid. map=${JSON.stringify(map)}`)
  }

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y][x]
      if (tile.owner === myId) {
        myTiles.push({ x, y, tile })
        myTotalUnits += tile.units || 0
        myTerritory++
        if (tile.type === 3) {
          myCapital = { x, y, tile }
        } else if (tile.type === 2) {
          myStrongholds.push({ x, y, tile })
        }
      } else if (tile.owner > 0 && tile.owner <= playerCount) {
        enemyTiles.push({ x, y, tile })
        enemyTotalUnits += tile.units || 0
        enemyTerritory++
        if (tile.type === 3) {
          enemyCapitals.push({ x, y, tile, owner: tile.owner })
        } else if (tile.type === 2) {
          enemyStrongholds.push({ x, y, tile, owner: tile.owner })
        }
      } else if (tile.owner === 0 && tile.type !== 1) {
        neutralTiles.push({ x, y, tile })
      }
    }
  }

  // 计算曼哈顿距离
  const manhattanDist = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2)

  // 找到最近的敌方首都
  let nearestEnemyCapital = null
  let minDistToCapital = Infinity
  if (myCapital) {
    for (const cap of enemyCapitals) {
      const dist = manhattanDist(myCapital.x, myCapital.y, cap.x, cap.y)
      if (dist < minDistToCapital) {
        minDistToCapital = dist
        nearestEnemyCapital = cap
      }
    }
  }

  return {
    map,
    myId,
    myTiles,
    enemyTiles,
    neutralTiles,
    myCapital,
    myStrongholds,
    enemyCapitals,
    enemyStrongholds,
    nearestEnemyCapital,
    minDistToCapital,
    myTotalUnits,
    enemyTotalUnits,
    myTerritory,
    enemyTerritory,
    turn,
    playerCount
  }
}

/**
 * BFS查找路径（避开山区）
 */
export function bfsNextStep(map, from, target, maxNodes = 1000) {
  const queue = [{ x: from.x, y: from.y, path: [] }]
  const visited = new Set([`${from.x},${from.y}`])
  let nodes = 0

  while (queue.length > 0 && nodes < maxNodes) {
    nodes++
    const current = queue.shift()

    if (current.x === target.x && current.y === target.y) {
      return current.path[0] || null
    }

    for (const { dx, dy } of DIRECTIONS) {
      const nx = current.x + dx
      const ny = current.y + dy

      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue

      const key = `${nx},${ny}`
      if (visited.has(key)) continue

      const tile = map.tiles[ny][nx]
      if (tile.type === 1) continue // 跳过山区

      visited.add(key)
      queue.push({
        x: nx,
        y: ny,
        path: current.path.length === 0 ? [{ x: nx, y: ny }] : [...current.path, { x: nx, y: ny }]
      })
    }
  }

  return null
}

/**
 * 计算威胁紧迫性（1/2/3回合）
 */
function calculateThreatUrgency(enemy, target, map) {
  const dist = Math.abs(enemy.x - target.x) + Math.abs(enemy.y - target.y)
  if (dist <= 1) return 3 // 1回合内到达
  if (dist <= 3) return 2 // 2-3回合到达
  if (dist <= 5) return 1 // 4-5回合到达
  return 0 // 不紧急
}

/**
 * 计算“潜在偷袭”风险：敌方距离我方首都/要塞近，且其兵力具备威胁
 * 1vN 时同回合多方向偷家更常见，所以这里偏保守。
 */
function calculateBackstabRisk(enemy, importantTargets) {
  let bestDist = Infinity
  let bestTarget = null
  for (const t of importantTargets) {
    const d = Math.abs(enemy.x - t.x) + Math.abs(enemy.y - t.y)
    if (d < bestDist) {
      bestDist = d
      bestTarget = t
    }
  }
  const units = enemy.tile?.units || 0
  // 距离越近、兵越多风险越大
  let risk = 0
  if (bestDist <= 2) risk += 3
  else if (bestDist <= 4) risk += 2
  else if (bestDist <= 6) risk += 1
  if (units >= 30) risk += 2
  else if (units >= 15) risk += 1
  return { risk, target: bestTarget, dist: bestDist }
}

/**
 * 计算边界突破威胁：敌方靠近我方边界（我方格子周围 1-2 格）
 * 目的是防止“绕后偷家”之前就提前封口/拦截。
 */
function findBorderIncursions(context) {
  const { myTiles, enemyTiles } = context
  const mySet = new Set(myTiles.map(t => `${t.x},${t.y}`))
  const incursions = []

  for (const enemy of enemyTiles) {
    const eu = enemy.tile?.units || 0
    if (eu < 2) continue

    // 找到离敌人最近的我方格（粗判 1-3 格内）
    let bestMy = null
    let bestDist = Infinity
    for (const myTile of myTiles) {
      const d = Math.abs(myTile.x - enemy.x) + Math.abs(myTile.y - enemy.y)
      if (d < bestDist) {
        bestDist = d
        bestMy = myTile
      }
      if (bestDist === 1) break
    }

    if (!bestMy) continue

    // 如果敌人已经接近我方边界，则记为入侵
    if (bestDist <= 2) {
      incursions.push({
        enemy,
        near: bestMy,
        dist: bestDist,
        // 敌人越强，威胁越高；距离越近越高
        priority: (eu * 2) + (bestDist === 1 ? 80 : 40)
      })
    }
  }

  incursions.sort((a, b) => b.priority - a.priority)
  return incursions
}

/**
 * 多源协同攻击
 * 识别高价值目标，当目标防御较高时，寻找多个源协同攻击
 */
function findCoordinatedAttack(context, target) {
  const { myTiles, map } = context
  const { x: tx, y: ty, tile: ttile } = target

  // 只对高价值目标（首都/要塞）且防御较高时使用协同攻击
  if (ttile.type !== 3 && ttile.type !== 2) return null
  if (ttile.units < 15) return null // 防御不够高，单源即可

  const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
  if (movableTiles.length < 2) return null

  // 找到距离目标3格内的所有己方单位
  const nearbySources = []
  for (const myTile of movableTiles) {
    const dist = Math.abs(myTile.x - tx) + Math.abs(myTile.y - ty)
    if (dist <= 3 && dist > 0) {
      nearbySources.push({ ...myTile, dist })
    }
  }

  if (nearbySources.length < 2) return null

  // 按距离排序，选择最近的3个源
  nearbySources.sort((a, b) => a.dist - b.dist)
  const sources = nearbySources.slice(0, 3)

  // 计算总攻击力
  const totalAttack = sources.reduce((sum, s) => sum + (s.tile.units - 1), 0)
  if (totalAttack < ttile.units * 1.2) return null // 确保有足够攻击力

  // 选择最近的源作为主攻
  const mainSource = sources[0]
  if (mainSource.dist === 1) {
    return {
      fromX: mainSource.x,
      fromY: mainSource.y,
      toX: tx,
      toY: ty,
      moveType: 'max'
    }
  }

  // 需要移动，找第一步
  const nextStep = bfsNextStep(map, mainSource, target)
  if (nextStep) {
    return {
      fromX: mainSource.x,
      fromY: mainSource.y,
      toX: nextStep.x,
      toY: nextStep.y,
      moveType: 'max'
    }
  }

  return null
}

/**
 * 进攻策略（增强版）
 */
export function planAttack(context) {
  const { myTiles, enemyTiles, myCapital, myStrongholds, map, playerCount } = context

  if (enemyTiles.length === 0) return null

  // 找到可移动的己方格子
  const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)

  if (movableTiles.length === 0) return null

  // 优先尝试多源协同攻击高价值目标
  const highValueTargets = enemyTiles.filter(({ tile }) => 
    (tile.type === 3 || tile.type === 2) && tile.units >= 15
  )

  for (const target of highValueTargets) {
    const coordinated = findCoordinatedAttack(context, target)
    if (coordinated) return coordinated
  }

  // 评分所有可能的攻击目标
  const attackCandidates = []
  const advanceCandidates = []

  for (const enemy of enemyTiles) {
    const { x: ex, y: ey, tile: etile } = enemy

    // 找到最近的己方源格子
    let bestSource = null
    let bestScore = -Infinity
    let bestDist = Infinity

    for (const myTile of movableTiles) {
      const { x: mx, y: my, tile: mtile } = myTile

      // 避免清空首都或要塞
      // 多人局更保守：防止后方被偷家
      const criticalMin = playerCount && playerCount >= 3 ? 5 : 2
      if ((mtile.type === 3 || mtile.type === 2) && mtile.units <= criticalMin) continue

      const dist = Math.abs(mx - ex) + Math.abs(my - ey)

      // 评分：优先选择距离近、己方单位多、敌方单位少的目标
      let score = 0
      if (etile.type === 3) {
        score = 1000 - dist * 10 // 首都优先级最高
      } else if (etile.type === 2) {
        score = 500 - dist * 5 // 要塞次之
      } else {
        score = 100 - dist * 2
      }

      // 己方单位越多越好
      score += mtile.units * 2
      // 敌方单位越少越好
      score -= etile.units * 3
      // 远距离目标额外折扣，避免被“远处高分”骗走
      score -= dist * 2

      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        bestScore = score
        bestSource = myTile
        bestDist = dist
      }
    }

    if (bestSource && bestDist === 1) {
      // 相邻，可以直接攻击
      const moveUnits = Math.min(bestSource.tile.units - 1, bestSource.tile.units - 1)
      if (moveUnits >= 1) {
        attackCandidates.push({
          from: bestSource,
          to: enemy,
          score: bestScore,
          moveType: 'max'
        })
      }
    } else if (bestSource && bestDist > 1) {
      // 不相邻：用 BFS 朝目标推进第一步（避山）
      const nextStep = bfsNextStep(map, bestSource, enemy)
      if (nextStep) {
        // 避免把兵从关键点搬空（这里再兜底一次）
        const criticalMin = playerCount && playerCount >= 3 ? 5 : 2
        if ((bestSource.tile.type === 3 || bestSource.tile.type === 2) && bestSource.tile.units <= criticalMin) {
          continue
        }
        advanceCandidates.push({
          from: bestSource,
          to: { x: nextStep.x, y: nextStep.y },
          score: bestScore,
          moveType: 'max'
        })
      }
    }
  }

  if (attackCandidates.length === 0 && advanceCandidates.length === 0) return null

  // 选择得分最高的动作：优先真实攻击，其次推进
  const pool = attackCandidates.length > 0 ? attackCandidates : advanceCandidates
  pool.sort((a, b) => b.score - a.score)
  const best = pool[0]

  return returnIfValid(context, {
    fromX: best.from.x,
    fromY: best.from.y,
    toX: best.to.x,
    toY: best.to.y,
    moveType: best.moveType
  })
}

/**
 * 主动消除威胁源
 * 当威胁源兵力较少时，主动攻击威胁源
 */
function findProactiveDefense(context, threat) {
  const { myTiles, map } = context
  const { enemy } = threat

  // 只对兵力较少的威胁源进行主动攻击
  if (enemy.tile.units >= 20) return null

  const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
  if (movableTiles.length === 0) return null

  // 找到能攻击威胁源的己方单位
  let bestSource = null
  let bestDist = Infinity

  for (const myTile of movableTiles) {
    // 避免清空重要位置
    if ((myTile.tile.type === 3 || myTile.tile.type === 2) && myTile.tile.units <= 2) continue

    const dist = Math.abs(myTile.x - enemy.x) + Math.abs(myTile.y - enemy.y)
    
    // 确保有足够攻击力
    if (myTile.tile.units - 1 < enemy.tile.units * 0.8) continue

    if (dist < bestDist) {
      bestDist = dist
      bestSource = myTile
    }
  }

  if (!bestSource) return null

  // 如果相邻，直接攻击
  if (bestDist === 1) {
    return {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: enemy.x,
      toY: enemy.y,
      moveType: 'max'
    }
  }

  // 需要移动，找第一步
  const nextStep = bfsNextStep(map, bestSource, enemy)
  if (nextStep) {
    return {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: nextStep.x,
      toY: nextStep.y,
      moveType: 'max'
    }
  }

  return null
}

/**
 * 防御策略（增强版）
 */
export function planDefense(context) {
  const { myTiles, enemyTiles, myCapital, myStrongholds, map } = context

  if (!myCapital) return null

  // 1) 重要目标（首都优先、要塞其次）
  const importantTargets = [myCapital, ...myStrongholds].filter(Boolean)

  // 2) 1vN: 优先处理“潜在偷袭”风险（提前封口/拦截/增援）
  //    如果存在高风险敌方单位，优先做“拦截”而不是等它贴脸。
  let highestRisk = { risk: 0, enemy: null, target: null, dist: Infinity }
  for (const enemy of enemyTiles) {
    const { risk, target, dist } = calculateBackstabRisk(enemy, importantTargets)
    if (risk > highestRisk.risk) {
      highestRisk = { risk, enemy, target, dist }
    }
  }

  // 若风险高，先把兵往首都/要塞方向集中（增援）或直接拦截
  if (highestRisk.enemy && highestRisk.risk >= 4) {
    const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
    if (movableTiles.length > 0) {
      // 先尝试：如果能打掉威胁源（特别是距离<=2且敌军不大），直接干掉
      const quickThreat = {
        enemy: highestRisk.enemy,
        target: highestRisk.target || myCapital,
        urgency: highestRisk.dist <= 2 ? 3 : (highestRisk.dist <= 4 ? 2 : 1)
      }
      const proactive = findProactiveDefense(context, quickThreat)
      if (proactive) return proactive

      // 否则：把最大兵力的后方单位往目标增援（BFS，避山）
      let bestSource = null
      let bestUnits = 0
      for (const t of movableTiles) {
        // 不从首都/要塞抽空
        if ((t.tile.type === 3 || t.tile.type === 2) && t.tile.units <= 5) continue
        if ((t.tile.units || 0) > bestUnits) {
          bestUnits = t.tile.units || 0
          bestSource = t
        }
      }
      if (bestSource) {
        const targetPos = highestRisk.target || myCapital
        const d = Math.abs(bestSource.x - targetPos.x) + Math.abs(bestSource.y - targetPos.y)
        if (d === 1) {
          return returnIfValid(context, {
            fromX: bestSource.x,
            fromY: bestSource.y,
            toX: targetPos.x,
            toY: targetPos.y,
            moveType: 'half'
          })
        }
        const step = bfsNextStep(map, bestSource, targetPos)
        if (step) {
          return returnIfValid(context, {
            fromX: bestSource.x,
            fromY: bestSource.y,
            toX: step.x,
            toY: step.y,
            moveType: 'half'
          })
        }
      }
    }
  }

  // 3) 边界突破：如果敌人已接近我方边界，优先“封口/拦截”
  const incursions = findBorderIncursions(context)
  if (incursions.length > 0) {
    const top = incursions[0]
    const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
    if (movableTiles.length > 0) {
      // 找到能尽快贴近入侵点的我方单位
      let bestSource = null
      let bestDist = Infinity
      for (const myTile of movableTiles) {
        if ((myTile.tile.type === 3 || myTile.tile.type === 2) && myTile.tile.units <= 2) continue
        const d = Math.abs(myTile.x - top.near.x) + Math.abs(myTile.y - top.near.y)
        if (d < bestDist) {
          bestDist = d
          bestSource = myTile
        }
      }
      if (bestSource) {
        // 如果能直接打入侵者且兵力足够，优先清掉
        const distToEnemy = Math.abs(bestSource.x - top.enemy.x) + Math.abs(bestSource.y - top.enemy.y)
        if (distToEnemy === 1 && (bestSource.tile.units - 1) >= (top.enemy.tile.units || 0)) {
          return returnIfValid(context, {
            fromX: bestSource.x,
            fromY: bestSource.y,
            toX: top.enemy.x,
            toY: top.enemy.y,
            moveType: 'max'
          })
        }
        // 否则先往“边界点 near”靠拢封口
        if (bestDist === 1) {
          return returnIfValid(context, {
            fromX: bestSource.x,
            fromY: bestSource.y,
            toX: top.near.x,
            toY: top.near.y,
            moveType: 'half'
          })
        }
        const step = bfsNextStep(map, bestSource, top.near)
        if (step) {
          return returnIfValid(context, {
            fromX: bestSource.x,
            fromY: bestSource.y,
            toX: step.x,
            toY: step.y,
            moveType: 'half'
          })
        }
      }
    }
  }

  // 检测威胁（敌方单位在己方重要目标附近）
  const threats = []

  for (const target of importantTargets) {
    for (const enemy of enemyTiles) {
      const dist = Math.abs(enemy.x - target.x) + Math.abs(enemy.y - target.y)
      if (dist <= 5 && enemy.tile.units >= 2) {
        const urgency = calculateThreatUrgency(enemy, target, map)
        threats.push({
          target,
          enemy,
          dist,
          urgency,
          priority: (target.tile.type === 3 ? 1000 : 500) + urgency * 100 // 首都优先级更高，紧迫性越高优先级越高
        })
      }
    }
  }

  if (threats.length === 0) return null

  // 按优先级排序（紧迫性高的优先）
  threats.sort((a, b) => b.priority - a.priority)
  const topThreat = threats[0]

  // 优先尝试主动消除威胁源（如果威胁源兵力较少）
  if (topThreat.urgency >= 2) {
    const proactive = findProactiveDefense(context, topThreat)
    if (proactive) return proactive
  }

  // 被动防守：找到最近的己方单位来支援
  const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
  if (movableTiles.length === 0) return null

  let bestSource = null
  let bestDist = Infinity

  for (const myTile of movableTiles) {
    // 避免清空支援点
    if (myTile.tile.units <= 2) continue

    const dist = Math.abs(myTile.x - topThreat.target.x) + Math.abs(myTile.y - topThreat.target.y)
    if (dist < bestDist) {
      bestDist = dist
      bestSource = myTile
    }
  }

  if (!bestSource) return null

  // 移动到目标位置（如果相邻）或朝向目标的第一步
  const targetPos = topThreat.target
  if (bestDist === 1) {
    return returnIfValid(context, {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: targetPos.x,
      toY: targetPos.y,
      moveType: 'half'
    })
  }

  // 需要多步，找第一步
  const nextStep = bfsNextStep(map, bestSource, targetPos)
  if (nextStep) {
    return returnIfValid(context, {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: nextStep.x,
      toY: nextStep.y,
      moveType: 'half'
    })
  }

  return null
}

/**
 * 发育策略
 */
export function planGrowth(context) {
  const { myTiles, neutralTiles, myStrongholds, enemyTiles, map } = context

  // 优先占领中立要塞
  const neutralStrongholds = neutralTiles.filter(({ tile }) => tile.type === 2)
  if (neutralStrongholds.length > 0) {
    const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
    if (movableTiles.length > 0) {
      let bestSource = null
      let bestTarget = null
      let bestDist = Infinity

      for (const stronghold of neutralStrongholds) {
        for (const myTile of movableTiles) {
          const dist = Math.abs(myTile.x - stronghold.x) + Math.abs(myTile.y - stronghold.y)
          if (dist < bestDist) {
            bestDist = dist
            bestSource = myTile
            bestTarget = stronghold
          }
        }
      }

      if (bestSource && bestTarget && bestDist === 1) {
        return {
          fromX: bestSource.x,
          fromY: bestSource.y,
          toX: bestTarget.x,
          toY: bestTarget.y,
          moveType: 'max'
        }
      }
    }
  }

  // 扩张边界
  const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
  if (movableTiles.length === 0) return null

  // 找到边界上的己方格子
  const borderTiles = []
  for (const myTile of movableTiles) {
    for (const { dx, dy } of DIRECTIONS) {
      const nx = myTile.x + dx
      const ny = myTile.y + dy

      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue

      const neighbor = map.tiles[ny][nx]
      if (neighbor.owner === 0 && neighbor.type !== 1) {
        borderTiles.push({ myTile, target: { x: nx, y: ny } })
        break
      }
    }
  }

  if (borderTiles.length > 0) {
    const random = borderTiles[Math.floor(Math.random() * borderTiles.length)]
    return {
      fromX: random.myTile.x,
      fromY: random.myTile.y,
      toX: random.target.x,
      toY: random.target.y,
      moveType: 'half'
    }
  }

  // 向前线补给
  return planSupplyToFrontline(context)
}

/**
 * 向前线补给
 */
export function planSupplyToFrontline(context) {
  const { myTiles, enemyTiles, map } = context

  if (enemyTiles.length === 0) return null

  // 找到前线（靠近敌方的己方格子）
  const frontlines = []
  for (const myTile of myTiles) {
    if (myTile.tile.units < 5) continue // 只考虑单位数较少的

    for (const enemy of enemyTiles) {
      const dist = Math.abs(myTile.x - enemy.x) + Math.abs(myTile.y - enemy.y)
      if (dist <= 3) {
        frontlines.push({ tile: myTile, dist })
        break
      }
    }
  }

  if (frontlines.length === 0) return null

  // 找到后方有较多单位的格子
  const supplyTiles = myTiles.filter(({ tile }) => tile.units >= 10)
  if (supplyTiles.length === 0) return null

  // 选择最近的前线目标
  frontlines.sort((a, b) => a.dist - b.dist)
  const target = frontlines[0].tile

  // 找到最近的补给源
  let bestSource = null
  let bestDist = Infinity

  for (const supply of supplyTiles) {
    const dist = Math.abs(supply.x - target.x) + Math.abs(supply.y - target.y)
    if (dist < bestDist && dist > 0) {
      bestDist = dist
      bestSource = supply
    }
  }

  if (!bestSource) return null

  // 相邻直接补给；不相邻则用 BFS 走第一步（多步运输）
  if (bestDist > 1) {
    const nextStep = bfsNextStep(map, bestSource, target)
    if (!nextStep) return null
    return returnIfValid(context, {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: nextStep.x,
      toY: nextStep.y,
      moveType: 'half'
    })
  }

  return returnIfValid(context, {
    fromX: bestSource.x,
    fromY: bestSource.y,
    toX: target.x,
    toY: target.y,
    moveType: 'half'
  })
}

/**
 * 全力进攻策略
 */
export function planAllInAttack(context) {
  const { myTiles, enemyTiles, nearestEnemyCapital, map, playerCount } = context

  if (!nearestEnemyCapital || enemyTiles.length === 0) return null

  const movableTiles = myTiles.filter(({ tile }) => tile.units >= 2)
  if (movableTiles.length === 0) return null

  // 找到最强的己方单位
  let bestSource = null
  let maxUnits = 0

  for (const myTile of movableTiles) {
    // 多人局避免用首都/要塞作为“全力一波”的出兵点（太容易被偷）
    const criticalMin = playerCount && playerCount >= 3 ? 8 : 2
    if ((myTile.tile.type === 3 || myTile.tile.type === 2) && (myTile.tile.units || 0) <= criticalMin) {
      continue
    }
    if (myTile.tile.units > maxUnits) {
      maxUnits = myTile.tile.units
      bestSource = myTile
    }
  }

  if (!bestSource) return null

  // 朝向最近的敌方首都移动
  const target = nearestEnemyCapital
  const dist = Math.abs(bestSource.x - target.x) + Math.abs(bestSource.y - target.y)

  if (dist === 1) {
    // 直接攻击
    return returnIfValid(context, {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: target.x,
      toY: target.y,
      moveType: 'max'
    })
  }

  // 找第一步
  const nextStep = bfsNextStep(map, bestSource, target)
  if (nextStep) {
    return returnIfValid(context, {
      fromX: bestSource.x,
      fromY: bestSource.y,
      toX: nextStep.x,
      toY: nextStep.y,
      moveType: 'max'
    })
  }

  return null
}

