// 游戏引擎
class GameEngine {
  constructor(map, playerCount, aiConfig = {}) {
    this.map = map
    this.playerCount = playerCount
    this.currentPlayer = 1
    this.turn = 1
    this.round = 1 // 每25回合为一轮
    this.winner = null
    this.gameOver = false
    
    // AI配置：{ playerId: AI实例 }
    // 例如：{ 2: new RandomAI(2), 3: new StrategyAI(3) }
    this.ais = aiConfig.ais || {}
    
    // 玩家格子索引：{ playerId: [{x, y, tile}, ...] }
    // 用于快速获取玩家拥有的格子，避免遍历整个地图
    this.playerTiles = {}
    this.initPlayerTiles()
  }

  /**
   * 初始化玩家格子索引
   */
  initPlayerTiles() {
    // 为每个玩家初始化空数组
    for (let playerId = 1; playerId <= this.playerCount; playerId++) {
      this.playerTiles[playerId] = []
    }
    
    // 遍历地图，建立索引
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x]
        if (tile.owner > 0 && tile.owner <= this.playerCount) {
          this.playerTiles[tile.owner].push({ x, y, tile })
        }
      }
    }
  }

  /**
   * 更新格子所有权（从旧主人移除，添加到新主人）
   */
  updateTileOwnership(x, y, oldOwner, newOwner) {
    const tile = this.map.tiles[y][x]
    
    // 从旧主人的索引中移除
    if (oldOwner > 0 && oldOwner <= this.playerCount) {
      const oldTiles = this.playerTiles[oldOwner]
      const index = oldTiles.findIndex(t => t.x === x && t.y === y)
      if (index !== -1) {
        oldTiles.splice(index, 1)
      }
    }
    
    // 添加到新主人的索引中
    if (newOwner > 0 && newOwner <= this.playerCount) {
      this.playerTiles[newOwner].push({ x, y, tile })
    }
  }

  /**
   * 获取当前游戏状态
   */
  getState() {
    return {
      map: this.map,
      currentPlayer: this.currentPlayer,
      turn: this.turn,
      round: this.round,
      winner: this.winner,
      gameOver: this.gameOver,
      isAIPlayer: this.isAIPlayer(this.currentPlayer),
      playerTiles: this.playerTiles // 提供给AI使用
    }
  }

  /**
   * 判断当前玩家是否是AI
   */
  isAIPlayer(playerId) {
    return !!this.ais[playerId]
  }

  /**
   * 获取AI的决策（如果是AI玩家）
   */
  getAIDecision() {
    const ai = this.ais[this.currentPlayer]
    if (!ai) return null
    
    const gameState = this.getState()
    return ai.getDecision(gameState)
  }

  /**
   * 设置AI（添加或更新）
   */
  setAI(playerId, ai) {
    this.ais[playerId] = ai
  }

  /**
   * 移除AI（切换为人类玩家）
   */
  removeAI(playerId) {
    delete this.ais[playerId]
  }

  /**
   * 执行移动
   * @param {number} fromX - 源X坐标
   * @param {number} fromY - 源Y坐标
   * @param {number} toX - 目标X坐标
   * @param {number} toY - 目标Y坐标
   * @param {string} moveType - 'half' (50%) 或 'max' (只留1个)
   * @returns {boolean} 是否成功
   */
  makeMove(fromX, fromY, toX, toY, moveType) {
    if (this.gameOver) return false

    const fromTile = this.map.tiles[fromY]?.[fromX]
    const toTile = this.map.tiles[toY]?.[toX]

    // 验证移动
    if (!this.isValidMove(fromX, fromY, toX, toY)) {
      console.log('❌ 移动验证失败:', { fromX, fromY, toX, toY })
      return false
    }

    // 计算移动的单位数
    let moveUnits
    if (moveType === 'half') {
      // 移动50%（向下取整），至少留下1个
      moveUnits = Math.floor(fromTile.units / 2)
    } else { // 'max'
      // 只保留1个，其余全部移动
      moveUnits = fromTile.units - 1
    }

    // 确保移动的单位数至少为1
    if (moveUnits < 1) return false

    // 执行移动：源格子减去移动的单位数
    fromTile.units -= moveUnits
    
    // 确保源格子至少保留1个单位（移动后不应该为0）
    if (fromTile.units < 1) {
      fromTile.units = 1
    }

    // 处理目标格子
    const oldToOwner = toTile.owner
    if (toTile.owner === 0) {
      // 空地：占领不需要花费，只需要至少派1个单位过去
      // 所有移动的单位都留在目标格子
      if (moveUnits < 1) {
        // 回滚源格子的变化
        fromTile.units += moveUnits
        return false
      }
      toTile.owner = this.currentPlayer
      toTile.units = moveUnits // 所有移动的单位都留在目标格子
      // 更新索引：从空地(0)变为己方
      this.updateTileOwnership(toX, toY, 0, this.currentPlayer)
    } else if (toTile.owner === this.currentPlayer) {
      // 己方格子：直接合并，所有移动的单位都加到目标格子
      // 例如：移动7个单位到己方格子，目标格子+7
      toTile.units += moveUnits
      // 所有权没变，不需要更新索引
    } else {
      // 敌方格子：战斗
      // 例如：移动7个单位攻击敌方5个单位，剩余2个占领
      const result = moveUnits - toTile.units
      const wasCapital = toTile.type === 3 // 是否是首都
      const wasStronghold = toTile.type === 2 // 是否是要塞
      const isSpecialTile = wasCapital || wasStronghold // 是否是要塞或首都
      const capitalOwner = wasCapital ? oldToOwner : null
      
      console.log(`[战斗] 攻击方: ${moveUnits}, 防守方: ${toTile.units}, result: ${result}, toTile.type: ${toTile.type}, 是首都: ${wasCapital}, 是要塞: ${wasStronghold}, 目标坐标: (${toX}, ${toY})`)
      
      // 特殊规则：占领要塞和首都必须多至少2个兵（result >= 2）
      // 普通空地：多0个或更多就能占领（result >= 0）
      if (isSpecialTile && result < 1) {
        // 要塞/首都：result < 2 时攻击失败（result === 0 或 result === 1）
        const tileName = wasCapital ? '首都' : '要塞'
        console.log(`[特殊规则触发] 攻击${tileName}失败: 需要至少多2个单位才能占领${tileName}，实际result=${result}`)
        // 攻击失败：对方保持原样，继续每回合涨兵
        // 攻击方的单位全部损失（已经在 fromTile.units -= moveUnits 中处理了）
        // 防守方单位数减少攻击方的单位数
        const oldUnits = toTile.units
        toTile.units = oldUnits - moveUnits
        // 如果防守方单位数 <= 0，则变成0（但所有权不变）
        if (toTile.units <= 0) {
          toTile.units = 0
        }
        console.log(`[特殊规则] 防守方单位数: ${oldUnits} -> ${toTile.units}, 所有权不变: ${toTile.owner}`)
        // 不改变所有权，不触发接管，游戏继续
        // 注意：这里不return，继续执行后续的日志和检查
      } else if (result >= 0) {
        // 占领：剩余单位留在目标格子
        // 普通空地：result >= 0 就能占领
        // 要塞/首都：result >= 2 才能占领（上面的 if 已经过滤了 result < 2 的情况）
        toTile.owner = this.currentPlayer
        toTile.units = result // 占领后单位数为result
        
        // 如果占领的是首都，需要特殊处理
        if (wasCapital && capitalOwner) {
          console.log(`[占领首都] 首都被占领，变成要塞，触发接管`)
          // 首都被占领后变成要塞
          toTile.type = 2 // STRONGHOLD
          // 接管该玩家的所有格子
          this.takeoverPlayerTiles(capitalOwner, this.currentPlayer)
        }
        
        // 更新索引：从敌方变为己方
        this.updateTileOwnership(toX, toY, oldToOwner, this.currentPlayer)
      } else {
        // 攻击失败：敌方剩余单位（result < 0）
        toTile.units = -result
        // 所有权没变，不需要更新索引
      }
    }
    
    console.log(`移动: 源(${fromX},${fromY}) ${fromTile.units + moveUnits} -> ${fromTile.units}, 目标(${toX},${toY}) ${toTile.units}, 移动了${moveUnits}个单位`)

    // 检查胜利条件
    this.checkWinCondition()

    return true
  }

  /**
   * 验证移动是否合法
   */
  isValidMove(fromX, fromY, toX, toY) {
    const fromTile = this.map.tiles[fromY]?.[fromX]
    const toTile = this.map.tiles[toY]?.[toX]

    if (!fromTile || !toTile) {
      console.log('验证失败: 格子不存在', { fromTile: !!fromTile, toTile: !!toTile })
      return false
    }
    if (fromTile.owner !== this.currentPlayer) {
      console.log('验证失败: 不是己方格子', { owner: fromTile.owner, currentPlayer: this.currentPlayer })
      return false
    }
    if (fromTile.units < 2) {
      console.log('验证失败: 单位数不足', { units: fromTile.units })
      return false
    }
    if (toTile.type === 1) {
      console.log('验证失败: 不能移动到山区')
      return false
    }

    // 检查是否相邻（曼哈顿距离为1）
    const dx = Math.abs(toX - fromX)
    const dy = Math.abs(toY - fromY)
    if (dx + dy !== 1) {
      console.log('验证失败: 不相邻', { dx, dy, distance: dx + dy })
      return false
    }

    console.log('✓ 移动验证通过')
    return true
  }

  /**
   * 接管玩家的所有格子（当首都被占领时）
   * @param {number} defeatedPlayerId - 被击败的玩家ID
   * @param {number} conquerorId - 占领者玩家ID
   */
  takeoverPlayerTiles(defeatedPlayerId, conquerorId) {
    // 先收集所有需要接管的格子（创建副本，避免遍历时数组被修改）
    const tilesToTakeover = [...(this.playerTiles[defeatedPlayerId] || [])]
    
    for (const { x, y } of tilesToTakeover) {
      const tile = this.map.tiles[y][x]
      // 再次检查所有权（因为可能已经被接管了）
      if (tile.owner === defeatedPlayerId) {
        // 接管格子：单位数除以2向下取整加1
        tile.owner = conquerorId
        tile.units = Math.floor(tile.units / 2) + 1
        
        // 如果这是首都，变成要塞
        if (tile.type === 3) {
          tile.type = 2 // STRONGHOLD
        }
        
        // 更新索引
        this.updateTileOwnership(x, y, defeatedPlayerId, conquerorId)
      }
    }
  }

  /**
   * 检查胜利条件
   */
  checkWinCondition() {
    // 检查是否有玩家失去了首都
    for (const capital of this.map.capitals) {
      const tile = this.map.tiles[capital.y][capital.x]
      if (tile.owner !== capital.playerId && tile.owner !== 0) {
        // 首都被占领，检查是否只剩一个玩家
        const remainingPlayers = this.getRemainingPlayers()
        if (remainingPlayers.length === 1) {
          // 只剩一个玩家，该玩家获胜
          this.winner = remainingPlayers[0]
          this.gameOver = true
          return
        }
        // 如果还有多个玩家，游戏继续（但被击败的玩家已经失去所有格子）
      }
    }
  }

  /**
   * 获取仍然存活的玩家列表（拥有首都的玩家）
   */
  getRemainingPlayers() {
    const alivePlayers = []
    for (const capital of this.map.capitals) {
      const tile = this.map.tiles[capital.y][capital.x]
      if (tile.owner === capital.playerId) {
        alivePlayers.push(capital.playerId)
      }
    }
    return alivePlayers
  }

  /**
   * 下一回合
   */
  nextTurn() {
    if (this.gameOver) return

    // 切换到下一个玩家
    this.currentPlayer++
    if (this.currentPlayer > this.playerCount) {
      // 所有玩家都操作完了，进入下一轮并结算
      this.currentPlayer = 1
      this.turn++
      
      // 每25回合为一轮
      if ((this.turn - 1) % 25 === 0 && this.turn > 1) {
        this.round++
      }
      
      // 每轮开始时增长普通格子的军队
      if ((this.turn - 1) % 25 === 0) {
        this.growUnitsPerRound()
      }
      
      // 每回合增长要塞和首都的军队（所有玩家都操作完后才增长）
      this.growUnitsPerTurn()
    }
    // 如果还没轮到最后一个玩家，只切换玩家，不增长单位
  }

  /**
   * 每回合增长（要塞和首都）
   */
  growUnitsPerTurn() {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x]
        
        if (tile.owner === 0) continue // 中立格子不增长

        // 要塞和首都每回合+1
        if (tile.type === 2 || tile.type === 3) { // 要塞或首都
          tile.units++
        }
      }
    }
  }

  /**
   * 每轮增长（普通格子）
   */
  growUnitsPerRound() {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tiles[y][x]
        
        if (tile.owner === 0) continue // 中立格子不增长

        // 每轮（25回合）普通格子+1
        if (tile.type === 0) { // 空地
          tile.units++
        }
      }
    }
  }
}

export default GameEngine

