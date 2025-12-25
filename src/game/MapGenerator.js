// 地图生成器
class MapGenerator {
  static TILE_TYPES = {
    BLANK: 0,      // 空地
    MOUNTAIN: 1,   // 山区
    STRONGHOLD: 2, // 要塞
    CAPITAL: 3     // 首都
  }

  /**
   * 生成随机地图（公平版本）
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

    // 1. 先用Voronoi图确认首都位置（最小距离WIDTH*0.4）
    const capitals = this.placeCapitalsWithVoronoi(map, playerCount, width)
    
    // 2. 根据首都位置划分区域（Voronoi图）
    const regions = this.divideIntoRegions(map, capitals)
    
    // 3. 在各个玩家的领域内分配适宜数量的要塞
    this.distributeStrongholdsInRegions(map, regions, width, height, playerCount)
    
    // 4. 在各个玩家的领域内分配适宜数量的山区（注意连通性）
    this.distributeMountainsInRegions(map, regions, width, height, playerCount)
    
    // 5. 最后确保地图连通性
    this.ensureConnectivity(map)

    return map
  }

  /**
   * 使用Voronoi图确认首都位置
   * 确保：
   * 1. 首都之间最小距离 >= WIDTH * 0.4（曼哈顿距离）
   * 2. 使用Voronoi图划分区域后，各玩家初始地盘大小差异 < 20%
   */
  static placeCapitalsWithVoronoi(map, playerCount, width) {
    const maxIterations = 50 // 最大迭代次数
    const targetBalanceThreshold = 0.20 // 20%的差异阈值
    
    // 收集所有空地候选位置
    const candidates = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x].type === this.TILE_TYPES.BLANK) {
          candidates.push({ x, y })
        }
      }
    }

    if (candidates.length < playerCount) {
      throw new Error('没有足够的空地放置首都')
    }

    // Fisher-Yates洗牌算法（真正的随机）
    this.shuffleArray(candidates)

    // 尝试多次，直到找到满足平衡条件的位置
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // 清空之前放置的首都
      for (const cap of map.capitals) {
        map.tiles[cap.y][cap.x].type = this.TILE_TYPES.BLANK
        map.tiles[cap.y][cap.x].owner = 0
        map.tiles[cap.y][cap.x].units = 0
      }
      map.capitals = []
      const capitals = []

      // 放置第一个首都（随机选择）
      const firstCapital = candidates[iteration % candidates.length]
      map.tiles[firstCapital.y][firstCapital.x].type = this.TILE_TYPES.CAPITAL
      map.tiles[firstCapital.y][firstCapital.x].owner = 1
      map.tiles[firstCapital.y][firstCapital.x].units = 2
      capitals.push({ x: firstCapital.x, y: firstCapital.y, playerId: 1 })
      map.capitals.push({ x: firstCapital.x, y: firstCapital.y, playerId: 1 })

      // 放置剩余首都（最小距离WIDTH*0.4，曼哈顿距离）
      const minDistance = Math.floor(width * 0.4) // 最小距离：WIDTH * 0.4
      let allPlaced = true

      for (let playerId = 2; playerId <= playerCount; playerId++) {
        let placed = false
        
        // 尝试找到合适的位置
        for (const candidate of candidates) {
          if (map.tiles[candidate.y][candidate.x].type === this.TILE_TYPES.CAPITAL) {
            continue
          }

          // 检查是否与已放置的首都太近（曼哈顿距离）
          let tooClose = false
          for (const cap of capitals) {
            const dx = Math.abs(candidate.x - cap.x)
            const dy = Math.abs(candidate.y - cap.y)
            const manhattanDist = dx + dy
            if (manhattanDist < minDistance) {
              tooClose = true
              break
            }
          }

          if (!tooClose) {
            map.tiles[candidate.y][candidate.x].type = this.TILE_TYPES.CAPITAL
            map.tiles[candidate.y][candidate.x].owner = playerId
            map.tiles[candidate.y][candidate.x].units = 2
            capitals.push({ x: candidate.x, y: candidate.y, playerId })
            map.capitals.push({ x: candidate.x, y: candidate.y, playerId })
            placed = true
            break
          }
        }

        if (!placed) {
          allPlaced = false
          break
        }
      }

      // 如果所有首都都放置成功，检查区域平衡
      if (allPlaced && capitals.length === playerCount) {
        // 划分区域（Voronoi图）
        const regions = this.divideIntoRegions(map, capitals)
        
        // 计算每个区域的面积（只计算空地，不包括山区和要塞）
        const regionSizes = {}
        for (const playerId in regions) {
          // 只计算该区域内的空地数量
          regionSizes[playerId] = regions[playerId].filter(pos => {
            const tile = map.tiles[pos.y][pos.x]
            return tile.type === this.TILE_TYPES.BLANK || tile.type === this.TILE_TYPES.CAPITAL
          }).length
        }

        // 检查平衡性
        const sizes = Object.values(regionSizes)
        if (sizes.length === 0) continue

        const minSize = Math.min(...sizes)
        const maxSize = Math.max(...sizes)
        const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length
        
        // 计算差异百分比
        const sizeDifference = (maxSize - minSize) / avgSize

        // 如果差异小于阈值，接受这个配置
        if (sizeDifference <= targetBalanceThreshold) {
          return capitals
        }
      }
    }

    // 如果迭代多次仍找不到平衡配置，使用最后一次尝试的结果
    // 至少确保所有首都都已放置
    if (map.capitals.length < playerCount) {
      console.warn('警告：无法找到完全平衡的首都位置，使用最后一次尝试的结果')
      // 确保所有玩家都有首都
      for (let playerId = 1; playerId <= playerCount; playerId++) {
        const hasCapital = map.capitals.some(cap => cap.playerId === playerId)
        if (!hasCapital) {
          // 找一个空位置放置
          for (const candidate of candidates) {
            if (map.tiles[candidate.y][candidate.x].type !== this.TILE_TYPES.CAPITAL) {
              map.tiles[candidate.y][candidate.x].type = this.TILE_TYPES.CAPITAL
              map.tiles[candidate.y][candidate.x].owner = playerId
              map.tiles[candidate.y][candidate.x].units = 2
              map.capitals.push({ x: candidate.x, y: candidate.y, playerId })
              break
            }
          }
        }
      }
    }

    return map.capitals.map(cap => ({ x: cap.x, y: cap.y, playerId: cap.playerId }))
  }

  /**
   * 将地图划分为区域（基于Voronoi图）
   * 每个区域对应一个首都
   */
  static divideIntoRegions(map, capitals) {
    const regions = {}
    
    // 初始化区域
    for (const cap of capitals) {
      regions[cap.playerId] = []
    }

    // 为每个格子分配最近的首都区域
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        // 跳过已经是首都的格子
        if (map.tiles[y][x].type === this.TILE_TYPES.CAPITAL) {
          continue
        }

        // 找到最近的首都
        let minDist = Infinity
        let nearestCapital = null

        for (const cap of capitals) {
          const dx = x - cap.x
          const dy = y - cap.y
          const dist = dx * dx + dy * dy // 使用平方距离避免开方

          if (dist < minDist) {
            minDist = dist
            nearestCapital = cap
          }
        }

        if (nearestCapital) {
          regions[nearestCapital.playerId].push({ x, y })
        }
      }
    }

    return regions
  }

  /**
   * 在各个玩家的领域内分配适宜数量的要塞
   * 要塞数量：每个区域随机范围 [minStrongholds, maxStrongholds]
   */
  static distributeStrongholdsInRegions(map, regions, width, height, playerCount) {
    // 每个区域的要塞数量范围（可调整）
    const minStrongholdsPerRegion = Math.max(1, Math.floor((width * height) / (playerCount * 30)))
    const maxStrongholdsPerRegion = Math.max(2, Math.floor((width * height) / (playerCount * 20)))
    
    for (const playerId in regions) {
      const region = regions[playerId]
      
      // 随机决定该区域的要塞数量
      const strongholdCount = minStrongholdsPerRegion + 
        Math.floor(Math.random() * (maxStrongholdsPerRegion - minStrongholdsPerRegion + 1))
      
      // 从该区域的空地中随机选择位置
      const regionBlanks = region.filter(pos => 
        map.tiles[pos.y][pos.x].type === this.TILE_TYPES.BLANK
      )
      
      this.shuffleArray(regionBlanks)
      
      // 放置要塞
      for (let i = 0; i < Math.min(strongholdCount, regionBlanks.length); i++) {
        const pos = regionBlanks[i]
        map.tiles[pos.y][pos.x].type = this.TILE_TYPES.STRONGHOLD
        // 占领该要塞需要额外消耗的兵力（20~30）
        map.tiles[pos.y][pos.x].captureCost = 20 + Math.floor(Math.random() * 11)
      }
    }
  }

  /**
   * 在各个玩家的领域内分配适宜数量的山区（注意连通性）
   * 山区数量：每个区域随机范围 [minMountains, maxMountains]
   * 确保放置山区后，区域仍然连通
   */
  static distributeMountainsInRegions(map, regions, width, height, playerCount) {
    // 每个区域的山区数量范围（可调整）
    const minMountainsPerRegion = Math.max(1, Math.floor((width * height) / (playerCount * 8)))
    const maxMountainsPerRegion = Math.max(2, Math.floor((width * height) / (playerCount * 6)))
    
    for (const playerId in regions) {
      const region = regions[playerId]
      
      // 随机决定该区域的山区数量
      const mountainCount = minMountainsPerRegion + 
        Math.floor(Math.random() * (maxMountainsPerRegion - minMountainsPerRegion + 1))
      
      // 从该区域的空地中随机选择位置
      const regionBlanks = region.filter(pos => 
        map.tiles[pos.y][pos.x].type === this.TILE_TYPES.BLANK
      )
      
      if (regionBlanks.length === 0) continue
      
      this.shuffleArray(regionBlanks)
      
      // 放置山区，但要确保连通性（放宽条件：允许80%连通即可）
      let placedCount = 0
      let attempts = 0
      const maxAttempts = regionBlanks.length * 3 // 增加尝试次数
      
      for (const pos of regionBlanks) {
        if (placedCount >= mountainCount) break
        if (attempts >= maxAttempts) break
        attempts++
        
        // 跳过与首都直接相邻的位置（避免开局就被困）
        let tooCloseToCapital = false
        for (const cap of map.capitals) {
          if (cap.playerId === parseInt(playerId)) {
            const dx = Math.abs(pos.x - cap.x)
            const dy = Math.abs(pos.y - cap.y)
            if (dx <= 1 && dy <= 1) {
              tooCloseToCapital = true
              break
            }
          }
        }
        if (tooCloseToCapital) continue
        
        // 临时放置山区，检查连通性（已放宽到80%）
        map.tiles[pos.y][pos.x].type = this.TILE_TYPES.MOUNTAIN
        
        // 检查该区域是否仍然连通（允许20%不连通）
        if (this.isRegionConnected(map, region, parseInt(playerId))) {
          placedCount++
        } else {
          // 如果不连通，撤销这个山区
          map.tiles[pos.y][pos.x].type = this.TILE_TYPES.BLANK
        }
      }
      
      // 如果连通性检查仍然太严格，进一步放宽：至少放置目标数量的70%
      if (placedCount < mountainCount * 0.7 && regionBlanks.length > placedCount) {
        const remainingBlanks = regionBlanks.filter(pos => 
          map.tiles[pos.y][pos.x].type === this.TILE_TYPES.BLANK
        )
        
        // 只放置不会直接相邻首都的山区
        const safeBlanks = remainingBlanks.filter(pos => {
          for (const cap of map.capitals) {
            if (cap.playerId === parseInt(playerId)) {
              const dx = Math.abs(pos.x - cap.x)
              const dy = Math.abs(pos.y - cap.y)
              if (dx <= 1 && dy <= 1) {
                return false
              }
            }
          }
          return true
        })
        
        // 补充放置到目标数量的70%
        const targetPlaced = Math.floor(mountainCount * 0.7)
        const needMore = targetPlaced - placedCount
        
        this.shuffleArray(safeBlanks)
        for (let i = 0; i < Math.min(needMore, safeBlanks.length); i++) {
          const pos = safeBlanks[i]
          map.tiles[pos.y][pos.x].type = this.TILE_TYPES.MOUNTAIN
          placedCount++
        }
      }
    }
  }

  /**
   * 检查区域是否连通（BFS，放宽条件）
   * 允许最多20%的格子不连通，只要主要部分连通即可
   */
  static isRegionConnected(map, region, playerId) {
    // 找到该区域内的所有空地（包括首都）
    const blankTiles = region.filter(pos => {
      const tile = map.tiles[pos.y][pos.x]
      return tile.type === this.TILE_TYPES.BLANK || 
             tile.type === this.TILE_TYPES.CAPITAL ||
             (tile.type === this.TILE_TYPES.STRONGHOLD && tile.owner === 0)
    })
    
    if (blankTiles.length === 0) return true
    if (blankTiles.length === 1) return true
    
    // 使用BFS检查连通性
    const visited = new Set()
    const queue = [blankTiles[0]]
    visited.add(`${blankTiles[0].x},${blankTiles[0].y}`)
    
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ]
    
    while (queue.length > 0) {
      const { x, y } = queue.shift()
      
      for (const dir of directions) {
        const nx = x + dir.dx
        const ny = y + dir.dy
        const key = `${nx},${ny}`
        
        if (!visited.has(key)) {
          // 检查是否在区域内且是空地
          const inRegion = region.some(pos => pos.x === nx && pos.y === ny)
          if (inRegion) {
            const tile = map.tiles[ny][nx]
            if (tile.type === this.TILE_TYPES.BLANK || 
                tile.type === this.TILE_TYPES.CAPITAL ||
                (tile.type === this.TILE_TYPES.STRONGHOLD && tile.owner === 0)) {
              visited.add(key)
              queue.push({ x: nx, y: ny })
            }
          }
        }
      }
    }
    
    // 放宽条件：允许最多20%的格子不连通
    // 只要主要部分（80%以上）连通即可
    const connectivityRatio = visited.size / blankTiles.length
    return connectivityRatio >= 0.80
  }

  /**
   * Fisher-Yates洗牌算法（真正的随机）
   */
  static shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]
    }
  }

  /**
   * 确保地图连通性
   * 使用BFS检查连通性，如果发现不连通，移除部分山区
   */
  static ensureConnectivity(map) {
    // 找到所有空地（包括首都）
    const blankTiles = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x].type !== this.TILE_TYPES.MOUNTAIN && 
            map.tiles[y][x].type !== this.TILE_TYPES.STRONGHOLD) {
          blankTiles.push({ x, y })
        }
      }
    }

    if (blankTiles.length === 0) {
      // 如果没有空地，移除一些山区
      this.removeSomeMountains(map, Math.floor(map.width * map.height * 0.1))
      return
    }

    // 使用BFS检查连通性
    const visited = new Set()
    const queue = [blankTiles[0]]
    visited.add(`${blankTiles[0].x},${blankTiles[0].y}`)

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ]

    while (queue.length > 0) {
      const { x, y } = queue.shift()

      for (const dir of directions) {
        const nx = x + dir.dx
        const ny = y + dir.dy

        if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
          const key = `${nx},${ny}`
          if (!visited.has(key)) {
            const tile = map.tiles[ny][nx]
            if (tile.type !== this.TILE_TYPES.MOUNTAIN && 
                tile.type !== this.TILE_TYPES.STRONGHOLD) {
              visited.add(key)
              queue.push({ x: nx, y: ny })
            }
          }
        }
      }
    }

    // 如果访问的格子数少于总空地数，说明不连通
    if (visited.size < blankTiles.length) {
      // 移除一些山区以增加连通性
      const disconnectedCount = blankTiles.length - visited.size
      this.removeSomeMountains(map, Math.ceil(disconnectedCount * 0.5))
    }
  }

  /**
   * 移除部分山区以增加连通性
   */
  static removeSomeMountains(map, count) {
    const mountains = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x].type === this.TILE_TYPES.MOUNTAIN) {
          mountains.push({ x, y })
        }
      }
    }

    this.shuffleArray(mountains)
    for (let i = 0; i < Math.min(count, mountains.length); i++) {
      const { x, y } = mountains[i]
      map.tiles[y][x].type = this.TILE_TYPES.BLANK
    }
  }
}

export default MapGenerator
