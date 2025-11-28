// 地图生成器
class MapGenerator {
  static TILE_TYPES = {
    BLANK: 0,      // 空地
    MOUNTAIN: 1,   // 山区
    STRONGHOLD: 2, // 要塞
    CAPITAL: 3     // 首都
  }

  /**
   * 生成随机地图
   * @param {number} width - 地图宽度
   * @param {number} height - 地图高度
   * @param {number} playerCount - 玩家数量
   * @returns {Object} 地图数据
   */
  static generateRandomMap(width, height, playerCount) {
    const map = {
      width,
      height,
      tiles: [],
      capitals: [] // [{x, y, playerId}]
    }

    // 初始化所有格子为空地
    for (let y = 0; y < height; y++) {
      map.tiles[y] = []
      for (let x = 0; x < width; x++) {
        map.tiles[y][x] = {
          type: this.TILE_TYPES.BLANK,
          owner: 0, // 0 = 中立
          units: 0 // 中立格子单位数为0是正常的
        }
      }
    }

    // 1. 随机放置山区（约20%）
    const mountainCount = Math.floor(width * height * 0.2)
    for (let i = 0; i < mountainCount; i++) {
      const x = Math.floor(Math.random() * width)
      const y = Math.floor(Math.random() * height)
      map.tiles[y][x].type = this.TILE_TYPES.MOUNTAIN
    }

    // 2. 确保空地连通（简化版：移除部分山区）
    this.ensureConnectivity(map)

    // 3. 在山区中随机选择部分变为要塞（约30%的山区），并设定占领人口成本
    const strongholdCount = Math.floor(mountainCount * 0.3)
    let placed = 0
    for (let y = 0; y < height && placed < strongholdCount; y++) {
      for (let x = 0; x < width && placed < strongholdCount; x++) {
        if (map.tiles[y][x].type === this.TILE_TYPES.MOUNTAIN && Math.random() < 0.3) {
          map.tiles[y][x].type = this.TILE_TYPES.STRONGHOLD
          // 占领该要塞需要额外消耗的兵力（20~30）
          map.tiles[y][x].captureCost = 20 + Math.floor(Math.random() * 11)
          placed++
        }
      }
    }

    // 4. 分配玩家首都（不相邻）
    this.placeCapitals(map, playerCount)

    return map
  }

  /**
   * 确保地图连通性（简化版）
   */
  static ensureConnectivity(map) {
    // 简化版：如果空地太少，移除部分山区
    let blankCount = 0
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x].type === this.TILE_TYPES.BLANK) {
          blankCount++
        }
      }
    }

    // 如果空地少于16个，移除部分山区
    if (blankCount < 16) {
      let removed = 0
      for (let y = 0; y < map.height && removed < 16 - blankCount; y++) {
        for (let x = 0; x < map.width && removed < 16 - blankCount; x++) {
          if (map.tiles[y][x].type === this.TILE_TYPES.MOUNTAIN) {
            map.tiles[y][x].type = this.TILE_TYPES.BLANK
            removed++
          }
        }
      }
    }
  }

  /**
   * 放置玩家首都
   */
  static placeCapitals(map, playerCount) {
    const candidates = []
    
    // 找到所有空地候选位置
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x].type === this.TILE_TYPES.BLANK) {
          candidates.push({ x, y })
        }
      }
    }

    // 随机打乱
    candidates.sort(() => Math.random() - 0.5)

    // 放置首都，确保不相邻
    const placed = []
    for (let playerId = 1; playerId <= playerCount; playerId++) {
      for (let i = 0; i < candidates.length; i++) {
        const { x, y } = candidates[i]
        
        // 检查是否与已放置的首都相邻
        let tooClose = false
        for (const cap of placed) {
          const dx = Math.abs(x - cap.x)
          const dy = Math.abs(y - cap.y)
          if (dx <= 1 && dy <= 1) {
            tooClose = true
            break
          }
        }

        if (!tooClose) {
          map.tiles[y][x].type = this.TILE_TYPES.CAPITAL
          map.tiles[y][x].owner = playerId
          map.tiles[y][x].units = 2 // 初始给2个单位，这样玩家可以立即移动
          map.capitals.push({ x, y, playerId })
          placed.push({ x, y })
          candidates.splice(i, 1)
          break
        }
      }
    }
  }
}

export default MapGenerator

