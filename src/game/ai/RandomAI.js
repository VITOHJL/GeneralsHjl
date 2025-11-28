import AIBase from './AIBase.js'

/**
 * 随机AI
 * 随机选择一个己方格子，随机选择一个相邻目标，随机选择移动类型
 */
class RandomAI extends AIBase {
  constructor(playerId) {
    super(playerId)
  }

  /**
   * 获取随机决策
   */
  getDecision(gameState) {
    const { map, currentPlayer, playerTiles } = gameState
    
    // 获取所有己方可移动的格子（单位数>=2）
    // 使用玩家格子索引优化性能
    const ownTiles = this.getOwnMovableTiles(map, currentPlayer, playerTiles)
    
    if (ownTiles.length === 0) {
      // 没有可移动的格子，跳过回合
      return null
    }

    // 随机选择一个源格子
    const fromTile = ownTiles[Math.floor(Math.random() * ownTiles.length)]
    
    // 获取该格子的所有相邻可移动目标
    const adjacentTargets = this.getAdjacentTargets(map, fromTile.x, fromTile.y, currentPlayer)
    
    if (adjacentTargets.length === 0) {
      // 没有可移动的目标，跳过回合
      return null
    }

    // 随机选择一个目标
    const toTile = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)]
    
    // 随机选择移动类型（50%概率选择half，50%选择max）
    const moveType = Math.random() < 0.5 ? 'half' : 'max'

    return {
      fromX: fromTile.x,
      fromY: fromTile.y,
      toX: toTile.x,
      toY: toTile.y,
      moveType
    }
  }

  /**
   * 获取所有己方可移动的格子
   * 优化：使用玩家格子索引，避免遍历整个地图
   */
  getOwnMovableTiles(map, playerId, playerTiles = null) {
    // 如果提供了玩家格子索引，使用索引（O(玩家格子数)）
    if (playerTiles && playerTiles[playerId]) {
      return playerTiles[playerId].filter(({ tile }) => {
        return tile.units >= 2 && tile.type !== 1 // 单位数>=2，不是山区
      })
    }
    
    // 降级方案：如果没有索引，遍历整个地图（O(width×height)）
    const tiles = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.owner === playerId && tile.units >= 2 && tile.type !== 1) {
          // 己方格子，单位数>=2，不是山区
          tiles.push({ x, y, tile })
        }
      }
    }
    return tiles
  }

  /**
   * 获取相邻的可移动目标
   */
  getAdjacentTargets(map, fromX, fromY, playerId) {
    const targets = []
    const directions = [
      { dx: 0, dy: -1 }, // 上
      { dx: 0, dy: 1 },  // 下
      { dx: -1, dy: 0 }, // 左
      { dx: 1, dy: 0 }   // 右
    ]

    for (const { dx, dy } of directions) {
      const toX = fromX + dx
      const toY = fromY + dy

      // 检查边界
      if (toX < 0 || toX >= map.width || toY < 0 || toY >= map.height) {
        continue
      }

      const toTile = map.tiles[toY][toX]

      // 不能移动到山区
      if (toTile.type === 1) {
        continue
      }

      // 可以移动到：空地、敌方格子、己方格子
      targets.push({ x: toX, y: toY, tile: toTile })
    }

    return targets
  }
}

export default RandomAI

