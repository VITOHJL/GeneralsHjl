// 游戏引擎
class GameEngine {
  constructor(map, playerCount) {
    this.map = map
    this.playerCount = playerCount
    this.currentPlayer = 1
    this.turn = 1
    this.round = 1 // 每25回合为一轮
    this.winner = null
    this.gameOver = false
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
      gameOver: this.gameOver
    }
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
    } else if (toTile.owner === this.currentPlayer) {
      // 己方格子：直接合并，所有移动的单位都加到目标格子
      // 例如：移动7个单位到己方格子，目标格子+7
      toTile.units += moveUnits
    } else {
      // 敌方格子：战斗
      // 例如：移动7个单位攻击敌方5个单位，剩余2个占领
      const result = moveUnits - toTile.units
      if (result > 0) {
        // 占领：剩余单位留在目标格子
        toTile.owner = this.currentPlayer
        toTile.units = result
      } else if (result === 0) {
        // 同归于尽：变成中立空地
        toTile.owner = 0
        toTile.units = 0
        toTile.type = 0 // 确保是空地类型
      } else {
        // 攻击失败：敌方剩余单位
        toTile.units = -result
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
   * 检查胜利条件
   */
  checkWinCondition() {
    // 检查是否有玩家失去了首都
    for (const capital of this.map.capitals) {
      const tile = this.map.tiles[capital.y][capital.x]
      if (tile.owner !== capital.playerId && tile.owner !== 0) {
        // 首都被占领
        this.winner = tile.owner
        this.gameOver = true
        return
      }
    }
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

