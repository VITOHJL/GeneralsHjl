/**
 * 游戏模拟器
 * 用于无头模式运行游戏，收集统计数据
 */
import MapGenerator from '../game/MapGenerator.js'
import GameEngine from '../game/GameEngine.js'
import { createAI } from '../game/ai/index.js'

class GameSimulator {
  constructor(config = {}) {
    this.config = {
      maxTurns: config.maxTurns || 500,
      maxTime: config.maxTime || 30000, // 30秒
      logLevel: config.logLevel || 'silent' // 'silent' | 'normal' | 'verbose'
    }
  }

  /**
   * 运行一场游戏
   * @param {Object} gameConfig - 游戏配置
   * @param {number} gameConfig.width - 地图宽度
   * @param {number} gameConfig.height - 地图高度
   * @param {number} gameConfig.players - 玩家数量
   * @param {Object} gameConfig.aiConfigs - AI配置 { playerId: { type: 'ai', aiType: 'random' } 或 { type: 'ai', aiInstance: ai } }
   * @returns {Promise<Object>} 游戏结果 { stats: { winner, timeout, gameOver, turns, duration, finalMetrics } }
   */
  async runGame(gameConfig) {
    const { width, height, players, aiConfigs } = gameConfig
    const startTime = Date.now()
    
    // 生成地图
    const map = MapGenerator.generateRandomMap(width, height, players)
    
    // 创建AI实例
    const ais = {}
    for (let playerId = 1; playerId <= players; playerId++) {
      const config = aiConfigs[playerId]
      if (config && config.type === 'ai') {
        if (config.aiInstance) {
          // 使用提供的AI实例
          ais[playerId] = config.aiInstance
        } else if (config.aiType) {
          // 创建新的AI实例
          ais[playerId] = createAI(config.aiType, playerId, config.options || {})
        }
      }
    }
    
    // 创建游戏引擎
    const engine = new GameEngine(map, players, { ais })
    
    // 游戏统计
    const stats = {
      winner: null,
      timeout: false,
      gameOver: false,
      turns: 0,
      duration: 0,
      finalMetrics: {},
      // 标记：是否是因为达到 maxTurns 后用人口规则强行判定出的胜负
      resolvedByMaxTurns: false
    }
    
    let turn = 0
    
    // 游戏主循环
    while (!engine.gameOver && turn < this.config.maxTurns) {
      // 检查超时
      if (Date.now() - startTime > this.config.maxTime) {
        stats.timeout = true
        stats.gameOver = false
        break
      }
      
      // 获取当前玩家
      const currentPlayer = engine.currentPlayer
      const gameState = engine.getState()
      
      // 如果是AI玩家，获取AI决策
      if (engine.isAIPlayer(currentPlayer)) {
        const decision = engine.getAIDecision()
        if (decision) {
          engine.makeMove(
            decision.fromX,
            decision.fromY,
            decision.toX,
            decision.toY,
            decision.moveType || 'half'
          )
        }
      }
      
      // 切换到下一回合
      engine.nextTurn()
      
      // 更新回合计数（每轮所有玩家都操作完才算一回合）
      if (engine.currentPlayer === 1 && engine.turn > turn) {
        turn = engine.turn
      }

      // 检查游戏是否结束
      if (engine.gameOver) {
        stats.winner = engine.winner
        stats.gameOver = true
        break
      }
    }
    
    // 记录最终统计
    stats.turns = turn
    stats.duration = Date.now() - startTime
    
    // 如果游戏没有正常结束（没有超时），尝试根据人口决定胜负
    if (!stats.gameOver && !stats.timeout) {
      const finalState = engine.getState()
      const { map: finalMap, playerCount } = finalState

      // 计算每个玩家的总人口
      const totalUnits = {}
      for (let id = 1; id <= playerCount; id++) {
        totalUnits[id] = 0
      }
      for (let y = 0; y < finalMap.height; y++) {
        for (let x = 0; x < finalMap.width; x++) {
          const tile = finalMap.tiles[y][x]
        if (tile.owner > 0) {
            totalUnits[tile.owner] = (totalUnits[tile.owner] || 0) + (tile.units || 0)
      }
    }
  }

      // 找到最大人口
      let bestUnits = -1
      for (let id = 1; id <= playerCount; id++) {
        const u = totalUnits[id] || 0
        if (u > bestUnits) {
          bestUnits = u
        }
      }

      // 收集所有并列第一的玩家
      const candidates = []
      for (let id = 1; id <= playerCount; id++) {
        const u = totalUnits[id] || 0
        if (u === bestUnits) {
          candidates.push(id)
        }
      }

      // 即使人口相同，也随机选一方胜利
      if (candidates.length > 0) {
        const winnerIndex = Math.floor(Math.random() * candidates.length)
        const winnerId = candidates[winnerIndex]
        stats.winner = winnerId
        stats.gameOver = true
        // 标记：这是通过 maxTurns + 人口规则强行决出的胜负
        stats.resolvedByMaxTurns = true
      }
    }

    // 计算最终指标（用于评估）
    const finalState = engine.getState()
    const { map: finalMap, playerCount } = finalState
    stats.finalMetrics = {}
    
    for (let id = 1; id <= playerCount; id++) {
      let territories = 0
      let units = 0
      let strongholds = 0
      let capital = false

      for (let y = 0; y < finalMap.height; y++) {
        for (let x = 0; x < finalMap.width; x++) {
          const tile = finalMap.tiles[y][x]
          if (tile.owner === id) {
            territories++
            units += tile.units || 0
            if (tile.type === 2) strongholds++
            if (tile.type === 3) capital = true
          }
        }
      }

      // 简单的评分：领土 + 单位/10 + 要塞*5 + 首都*10
      const score = territories + units / 10 + strongholds * 5 + (capital ? 10 : 0)

      stats.finalMetrics[id] = {
        territories,
        units,
        strongholds,
        capital,
        score
      }
    }
    
    return {
      stats,
      finalState // 返回最终的游戏状态，供RL训练使用
    }
  }
}

export default GameSimulator
