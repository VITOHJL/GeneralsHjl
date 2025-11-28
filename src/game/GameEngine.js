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
      playerTiles: this.playerTiles, // 提供给AI使用
      playerCount: this.playerCount
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
      // 中立格子
      if (toTile.type === 2 && typeof toTile.captureCost === 'number') {
        // 中立要塞（营地）：先用一部分人口解锁，解锁消耗的人口全部牺牲，剩余人口作为占领单位
        const oldCost = toTile.captureCost
        const usedForUnlock = Math.min(moveUnits, oldCost)
        const remainingAfterUnlock = moveUnits - usedForUnlock
        toTile.captureCost = oldCost - usedForUnlock

        console.log(
          `[解锁要塞] 投入 ${moveUnits} 人口，其中 ${usedForUnlock} 用于解锁，` +
          `解锁进度: ${oldCost} -> ${toTile.captureCost}，剩余可驻扎人口: ${remainingAfterUnlock}`
        )

        if (toTile.captureCost <= 0) {
          // 本次完成解锁：要塞归当前玩家，剩余人口驻扎在要塞上
          toTile.owner = this.currentPlayer
          toTile.units = remainingAfterUnlock
          this.updateTileOwnership(toX, toY, 0, this.currentPlayer)
          console.log(
            `[解锁要塞完成] 要塞已归玩家 ${this.currentPlayer}，` +
            `解锁消耗 ${oldCost}，剩余 ${remainingAfterUnlock} 个单位驻扎`
          )
        } else {
          // 未解锁完：本次投入的全部人口视为牺牲，不留下单位
          console.log(
            `[解锁要塞未完成] 仍需 ${toTile.captureCost} 人口解锁，本次所有 ${moveUnits} 人口已牺牲`
          )
        }
      } else {
        // 普通空地：占领不需要额外花费，所有移动的单位都留在目标格子
        if (moveUnits < 1) {
          // 回滚源格子的变化
          fromTile.units += moveUnits
          return false
        }
        toTile.owner = this.currentPlayer
        toTile.units = moveUnits
        // 更新索引：从空地(0)变为己方
        this.updateTileOwnership(toX, toY, 0, this.currentPlayer)
      }
    } else if (toTile.owner === this.currentPlayer) {
      // 己方格子：直接合并，所有移动的单位都加到目标格子
      // 例如：移动7个单位到己方格子，目标格子+7
      toTile.units += moveUnits
      // 所有权没变，不需要更新索引
    } else {
      // 敌方格子：战斗
      const result = moveUnits - toTile.units
      const wasCapital = toTile.type === 3 // 是否是首都
      const capitalOwner = wasCapital ? oldToOwner : null
      
      console.log(
        `[战斗] 攻击方: ${moveUnits}, 防守方: ${toTile.units}, result: ${result}, ` +
        `toTile.type: ${toTile.type}, 是首都: ${wasCapital}, 目标坐标: (${toX}, ${toY})`
      )
      
      if (wasCapital) {
        // 攻击首都：仍然遵循 result>=1 占领规则
        if (result >= 1) {
          // 占领成功
          toTile.owner = this.currentPlayer
          toTile.units = result
          
          if (capitalOwner) {
            // 处理首都被占领：接管对方并迁都
            this.onCapitalCaptured(capitalOwner, toX, toY)
          }
          
          this.updateTileOwnership(toX, toY, oldToOwner, this.currentPlayer)
        } else {
          // 攻击失败：防守方剩余单位（可能为0），但所有权不变
          const oldUnits = toTile.units
          toTile.units = Math.max(0, oldUnits - moveUnits)
          console.log(`[攻击首都失败] 目标仍归玩家${oldToOwner}，单位: ${oldUnits} -> ${toTile.units}`)
        }
      } else {
        // 普通格子/已被占领的要塞：result>=1 占领，否则失败
        if (result >= 1) {
          toTile.owner = this.currentPlayer
          toTile.units = result
          this.updateTileOwnership(toX, toY, oldToOwner, this.currentPlayer)
        } else {
          const oldUnits = toTile.units
          toTile.units = Math.max(0, oldUnits - moveUnits)
          console.log(`[攻击失败] 目标仍归玩家${oldToOwner}，单位: ${oldUnits} -> ${toTile.units}`)
        }
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
        // 接管格子：单位数除以2(向上取整)
        tile.owner = conquerorId
        if (tile.units%2===0){
          tile.units = Math.floor(tile.units / 2) 
        }
        else{
          tile.units = Math.floor(tile.units / 2) + 1
        }
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
   * 处理首都被占领：接管对方并将当前玩家的首都迁移到新位置
   * @param {number} defeatedPlayerId - 被击败玩家ID（原首都所属）
   * @param {number} newCapitalX - 新首都X坐标（被占领的首都位置）
   * @param {number} newCapitalY - 新首都Y坐标
   */
  onCapitalCaptured(defeatedPlayerId, newCapitalX, newCapitalY) {
    const map = this.map

    // 1. 接管被击败玩家的所有格子
    this.takeoverPlayerTiles(defeatedPlayerId, this.currentPlayer)

    // 2. 将当前玩家原来的首都变为要塞（营地），并更新 capitals 中的坐标
    let myCapitalRecord = null

    for (const capital of map.capitals) {
      if (capital.playerId === this.currentPlayer) {
        myCapitalRecord = capital
        break
      }
    }

    if (myCapitalRecord) {
      const oldCapTile = map.tiles[myCapitalRecord.y][myCapitalRecord.x]
      // 原首都变为要塞（营地）
      oldCapTile.type = 2

      // 3. 更新当前玩家首都记录到新位置
      myCapitalRecord.x = newCapitalX
      myCapitalRecord.y = newCapitalY
    }

    // 4. 确保新位置是当前玩家的首都
    const newCapTile = map.tiles[newCapitalY][newCapitalX]
    newCapTile.type = 3
    newCapTile.owner = this.currentPlayer
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

