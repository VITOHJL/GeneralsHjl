import AIBase from './AIBase.js'

/**
 * 攻击型AI
 * 优先攻击敌方，优先攻击敌方首都
 */
class AggressiveAI extends AIBase {
  constructor(playerId, difficulty = 'easy') {
    super(playerId, difficulty)
  }

  getDecision(gameState) {
    const { map, currentPlayer, playerTiles } = gameState
    
    const ownTiles = this.getOwnMovableTiles(map, currentPlayer, playerTiles)
    if (ownTiles.length === 0) return null

    // 优先选择单位数多的格子作为源
    ownTiles.sort((a, b) => b.tile.units - a.tile.units)
    
    // 尝试每个源格子，优先找敌方目标
    for (const fromTile of ownTiles) {
      const adjacentTargets = this.getAdjacentTargets(map, fromTile.x, fromTile.y, currentPlayer)
      
      // 优先攻击敌方首都
      const enemyCapitals = adjacentTargets.filter(t => 
        t.tile.owner !== 0 && 
        t.tile.owner !== currentPlayer && 
        t.tile.type === 3 // 首都
      )
      if (enemyCapitals.length > 0) {
        const toTile = enemyCapitals[0]
        // 确保有足够兵力攻击
        if (fromTile.tile.units > toTile.tile.units) {
          return {
            fromX: fromTile.x,
            fromY: fromTile.y,
            toX: toTile.x,
            toY: toTile.y,
            moveType: 'max' // 攻击时尽量多移动
          }
        }
      }
      
      // 其次攻击敌方普通格子
      const enemyTiles = adjacentTargets.filter(t => 
        t.tile.owner !== 0 && t.tile.owner !== currentPlayer
      )
      if (enemyTiles.length > 0) {
        // 选择敌方单位数少的格子攻击（更容易占领）
        enemyTiles.sort((a, b) => a.tile.units - b.tile.units)
        const toTile = enemyTiles[0]
        // 确保有足够兵力攻击
        if (fromTile.tile.units > toTile.tile.units) {
          return {
            fromX: fromTile.x,
            fromY: fromTile.y,
            toX: toTile.x,
            toY: toTile.y,
            moveType: 'max'
          }
        }
      }
    }
    
    // 如果没有可攻击的目标，优先扩张（占领空地）
    for (const fromTile of ownTiles) {
      const adjacentTargets = this.getAdjacentTargets(map, fromTile.x, fromTile.y, currentPlayer)
      const blankTiles = adjacentTargets.filter(t => t.tile.owner === 0)
      if (blankTiles.length > 0) {
        const toTile = blankTiles[Math.floor(Math.random() * blankTiles.length)]
        return {
          fromX: fromTile.x,
          fromY: fromTile.y,
          toX: toTile.x,
          toY: toTile.y,
          moveType: 'max'
        }
      }
    }
    
    // 最后随机移动
    const fromTile = ownTiles[Math.floor(Math.random() * ownTiles.length)]
    const adjacentTargets = this.getAdjacentTargets(map, fromTile.x, fromTile.y, currentPlayer)
    if (adjacentTargets.length === 0) return null
    
    const toTile = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)]
    return {
      fromX: fromTile.x,
      fromY: fromTile.y,
      toX: toTile.x,
      toY: toTile.y,
      moveType: 'max'
    }
  }

  getOwnMovableTiles(map, playerId, playerTiles = null) {
    if (playerTiles && playerTiles[playerId]) {
      return playerTiles[playerId].filter(({ tile }) => {
        return tile.units >= 2 && tile.type !== 1
      })
    }
    const tiles = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.owner === playerId && tile.units >= 2 && tile.type !== 1) {
          tiles.push({ x, y, tile })
        }
      }
    }
    return tiles
  }

  getAdjacentTargets(map, fromX, fromY, playerId) {
    const targets = []
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ]

    for (const { dx, dy } of directions) {
      const toX = fromX + dx
      const toY = fromY + dy
      if (toX < 0 || toX >= map.width || toY < 0 || toY >= map.height) continue
      const toTile = map.tiles[toY][toX]
      if (toTile.type === 1) continue
      targets.push({ x: toX, y: toY, tile: toTile })
    }
    return targets
  }
}

export default AggressiveAI

