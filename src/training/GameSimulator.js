/**
 * 游戏模拟器
 * 用于无头模式运行游戏，收集数据用于训练和评估
 */
import MapGenerator from '../game/MapGenerator.js'
import GameEngine from '../game/GameEngine.js'
import { createAI } from '../game/ai/index.js'

export class GameSimulator {
  constructor(config = {}) {
    // 必需参数检查
    if (config.maxTurns === undefined) {
      throw new Error('GameSimulator: maxTurns 参数是必需的')
    }
    if (config.maxTime === undefined) {
      throw new Error('GameSimulator: maxTime 参数是必需的')
    }
    
    this.config = {
      maxTurns: config.maxTurns,
      maxTime: config.maxTime,
      logLevel: config.logLevel || 'silent', // 'silent', 'minimal', 'verbose'
      ...config
    }
  }

  /**
   * 运行一场游戏
   * @param {Object} gameConfig - 游戏配置 { width, height, players, aiConfigs }
   * @returns {Object} 游戏结果和统计数据
   */
  async runGame(gameConfig) {
    const { width, height, players, aiConfigs } = gameConfig
    
    // 生成地图
    const map = MapGenerator.generateRandomMap(width, height, players)
    
    // 创建AI实例
    const ais = {}
    for (let playerId = 1; playerId <= players; playerId++) {
      const config = aiConfigs[playerId]
      if (config && config.type === 'ai' && config.aiType) {
        ais[playerId] = createAI(config.aiType, playerId)
      }
    }
    
    // 创建游戏引擎
    const engine = new GameEngine(map, players, { ais })
    
    const stats = {
      turns: 0,
      moves: {},
      territories: {},
      units: {},
      events: [],
      startTime: Date.now(),
      endTime: null,
      winner: null,
      gameOver: false,
      timeout: false
    }
    
    // 初始化统计
    for (let i = 1; i <= players; i++) {
      stats.moves[i] = 0
      stats.territories[i] = 0
      stats.units[i] = 0
    }
    
    // 运行游戏循环
    const startTime = Date.now()
    let lastState = null
    
    while (!engine.gameOver && engine.turn <= this.config.maxTurns) {
      // 检查超时
      if (Date.now() - startTime > this.config.maxTime) {
        stats.timeout = true
        stats.gameOver = false
        break
      }
      
      // 记录回合开始状态
      const state = engine.getState()
      stats.turns = state.turn
      
      // 如果是AI回合，执行AI决策
      if (state.isAIPlayer) {
        const aiDecision = engine.getAIDecision()
        if (aiDecision) {
          const success = engine.makeMove(
            aiDecision.fromX,
            aiDecision.fromY,
            aiDecision.toX,
            aiDecision.toY,
            aiDecision.moveType
          )
          
          if (success) {
            stats.moves[state.currentPlayer]++
          }
        }
      }
      
      // 切换到下一回合
      engine.nextTurn()
      
      // 更新统计数据
      this.updateStats(engine, stats)
      
      // 检查游戏结束
      if (engine.gameOver) {
        stats.winner = engine.winner
        stats.gameOver = true
        break
      }
      
      lastState = engine.getState()
    }
    
    stats.endTime = Date.now()
    stats.duration = stats.endTime - stats.startTime
    
    // 最终统计
    this.finalizeStats(engine, stats)
    
    return {
      gameConfig,
      stats,
      finalState: engine.getState()
    }
  }

  /**
   * 更新统计数据
   */
  updateStats(engine, stats) {
    const state = engine.getState()
    const { map } = state
    
    // 统计每个玩家的领土和单位
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.owner > 0) {
          stats.territories[tile.owner] = (stats.territories[tile.owner] || 0) + 1
          stats.units[tile.owner] = (stats.units[tile.owner] || 0) + tile.units
        }
      }
    }
  }

  /**
   * 完成统计
   */
  finalizeStats(engine, stats) {
    const state = engine.getState()
    const { map } = state
    
    // 最终领土和单位统计
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.owner > 0) {
          stats.territories[tile.owner] = (stats.territories[tile.owner] || 0) + 1
          stats.units[tile.owner] = (stats.units[tile.owner] || 0) + tile.units
        }
      }
    }
    
    // 计算最终指标
    stats.finalMetrics = this.calculateMetrics(engine, stats)
  }

  /**
   * 计算评估指标
   */
  calculateMetrics(engine, stats) {
    const state = engine.getState()
    const { map, playerCount } = state
    
    const metrics = {}
    
    for (let playerId = 1; playerId <= playerCount; playerId++) {
      const territories = stats.territories[playerId] || 0
      const units = stats.units[playerId] || 0
      const moves = stats.moves[playerId] || 0
      const isWinner = stats.winner === playerId
      const isAlive = territories > 0
      
      // 基础指标
      const totalTiles = map.width * map.height
      const territoryRatio = territories / totalTiles
      const unitRatio = units / (totalTiles * 10) // 假设平均每格10单位
      
      // 效率指标
      const movesPerTurn = stats.turns > 0 ? moves / stats.turns : 0
      const unitsPerMove = moves > 0 ? units / moves : 0
      
      // 生存指标
      const survivalTurns = isAlive ? stats.turns : 0
      
      metrics[playerId] = {
        // 基础指标
        territories,
        units,
        moves,
        territoryRatio,
        unitRatio,
        
        // 效率指标
        movesPerTurn,
        unitsPerMove,
        
        // 胜负指标
        isWinner,
        isAlive,
        survivalTurns,
        
        // 综合评分（用于排序）
        score: this.calculateScore({
          isWinner,
          isAlive,
          territoryRatio,
          unitRatio,
          movesPerTurn,
          survivalTurns,
          turns: stats.turns
        })
      }
    }
    
    return metrics
  }

  /**
   * 计算综合评分
   */
  calculateScore(metrics) {
    let score = 0
    
    // 胜负权重最高
    if (metrics.isWinner) {
      score += 1000
    }
    
    // 存活权重
    if (metrics.isAlive) {
      score += 100 * metrics.survivalTurns / 100 // 存活回合数
    }
    
    // 领土权重
    score += 50 * metrics.territoryRatio
    
    // 单位权重
    score += 30 * metrics.unitRatio
    
    // 效率权重（较低）
    score += 10 * Math.min(metrics.movesPerTurn, 1)
    
    return score
  }
}

export default GameSimulator

