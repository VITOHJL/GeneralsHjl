import AIBase from './AIBase.js'

/**
 * 平衡型AI
 * 平衡扩张和攻击，优先占领空地，偶尔攻击敌方
 */
class BalancedAI extends AIBase {
  constructor(playerId, difficulty = 'easy') {
    super(playerId, difficulty)
  }

  getDecision(gameState) {
    const { map, currentPlayer, playerTiles } = gameState
    
    const ownTiles = this.getOwnMovableTiles(map, currentPlayer, playerTiles)
    if (ownTiles.length === 0) return null

    // 优先选择单位数多的格子作为源
    ownTiles.sort((a, b) => b.tile.units - a.tile.units)
    
    // 70%概率优先扩张，30%概率攻击
    const shouldAttack = Math.random() < 0.3
    
    if (shouldAttack) {
      // 尝试攻击敌方
      for (const fromTile of ownTiles) {
        const adjacentTargets = this.getAdjacentTargets(map, fromTile.x, fromTile.y, currentPlayer)
        const enemyTiles = adjacentTargets.filter(t => 
          t.tile.owner !== 0 && t.tile.owner !== currentPlayer
        )
        if (enemyTiles.length > 0) {
          // 选择敌方单位数少的格子攻击
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
    }
    
    // 优先占领空地
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
    
    // 如果没有空地，合并己方单位或随机移动
    const fromTile = ownTiles[Math.floor(Math.random() * ownTiles.length)]
    const adjacentTargets = this.getAdjacentTargets(map, fromTile.x, fromTile.y, currentPlayer)
    if (adjacentTargets.length === 0) return null
    
    const toTile = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)]
    return {
      fromX: fromTile.x,
      fromY: fromTile.y,
      toX: toTile.x,
      toY: toTile.y,
      moveType: Math.random() < 0.5 ? 'half' : 'max'
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

export default BalancedAI

