/**
 * RL训练器
 * 支持self-play、fixed-opponent、mixed模式
 */
import GameSimulator from './GameSimulator.js'
import StrategyRLAI from '../game/ai/StrategyRLAI.js'
import QLearningAI from '../game/ai/QLearningAI.js'
import { createAI } from '../game/ai/index.js'
import fs from 'fs/promises'

export default class RLTrainer {
  constructor(config = {}) {
    this.config = {
      episodes: config.episodes || 1000,
      players: config.players || 2,
      width: config.width || 20,
      height: config.height || 20,
      maxTurns: config.maxTurns || 500,
      maxTime: config.maxTime || 30000,
      mode: config.mode || 'self-play', // 'self-play', 'against-fixed', 'mixed'
      opponent: config.opponent || 'random',
      saveInterval: config.saveInterval || 100,
      logInterval: config.logInterval || 10,
      savePath: config.savePath || './qtable.json',
      agent: config.agent || 'strategy', // 'strategy' or 'qlearning'
      ...config
    }

    this.simulator = new GameSimulator({
      maxTurns: this.config.maxTurns,
      maxTime: this.config.maxTime,
      logLevel: 'silent'
    })

    this.stats = {
      wins: 0,
      losses: 0,
      draws: 0,
      timeouts: 0,
      winTurns: [],
      lossTurns: [],
      totalReward: 0
    }
  }

  /**
   * 创建RL agent
   */
  createAgent(qTable = null) {
    const options = {
      qTable: qTable || {},
      trainingMode: true
    }

    if (this.config.agent === 'strategy') {
      const ai = new StrategyRLAI(1, options)
      console.log(`[DEBUG] 创建了 StrategyRLAI，agent配置: ${this.config.agent}`)
      return ai
    } else {
      const ai = new QLearningAI(1, options)
      console.log(`[DEBUG] 创建了 QLearningAI，agent配置: ${this.config.agent}`)
      return ai
    }
  }

  /**
   * 创建对手AI
   */
  createOpponent(playerId, episode) {
    if (this.config.mode === 'self-play') {
      // Self-play: 使用当前Q表的副本（但设置为非训练模式）
      const qTable = this.rlAI ? this.rlAI.saveQTable() : {}
      const options = {
        qTable: JSON.parse(JSON.stringify(qTable)),
        trainingMode: false,
        epsilon: 0 // 不探索
      }
      return this.config.agent === 'strategy'
        ? new StrategyRLAI(playerId, options)
        : new QLearningAI(playerId, options)
    } else if (this.config.mode === 'against-fixed') {
      // Fixed opponent
      return createAI(this.config.opponent, playerId)
    } else {
      // Mixed: 随机选择
      if (Math.random() < 0.5) {
        const qTable = this.rlAI ? this.rlAI.saveQTable() : {}
        const options = {
          qTable: JSON.parse(JSON.stringify(qTable)),
          trainingMode: false,
          epsilon: 0
        }
        return this.config.agent === 'strategy'
          ? new StrategyRLAI(playerId, options)
          : new QLearningAI(playerId, options)
      } else {
        return createAI(this.config.opponent, playerId)
      }
    }
  }

  /**
   * 运行训练游戏
   */
  async runTrainingGame(episode) {
    // 创建RL agent（如果还没有创建）
    if (!this.rlAI) {
      this.rlAI = this.createAgent()
    }

    // 创建对手
    const aiConfigs = {
      1: { type: 'ai', aiInstance: this.rlAI }
    }

    for (let id = 2; id <= this.config.players; id++) {
      aiConfigs[id] = {
        type: 'ai',
        aiInstance: this.createOpponent(id, episode)
      }
    }

    const gameConfig = {
      width: this.config.width,
      height: this.config.height,
      players: this.config.players,
      aiConfigs
    }

    // 运行游戏
    const result = await this.simulator.runGame(gameConfig)
    const stats = result.stats
    const winner = stats.winner

    // 计算奖励并更新Q值
    const isWinner = winner === 1
    const isResolvedByMaxTurns = !!stats.resolvedByMaxTurns
    let reward = 0

    // 获取最终游戏状态（如果有）
    const finalGameState = result.finalState || null

    if (stats.timeout) {
      // 超时：小惩罚
      reward = -10
    } else if (isWinner) {
      reward = this.rlAI.calculateFinalReward && finalGameState ? 
        this.rlAI.calculateFinalReward(finalGameState, true) : 100
      this.stats.wins++
      this.stats.winTurns.push(stats.turns)
    } else if (winner !== null) {
      reward = this.rlAI.calculateFinalReward && finalGameState ?
        this.rlAI.calculateFinalReward(finalGameState, false) : -50
      this.stats.losses++
      this.stats.lossTurns.push(stats.turns)
    } else {
      // 平局：根据领土比例给奖励
      const finalState = result.stats.finalMetrics
      const myTerritory = finalState[1]?.territories || 0
      const totalTerritory = Object.values(finalState).reduce((sum, m) => sum + (m?.territories || 0), 0)
      const territoryRatio = totalTerritory > 0 ? myTerritory / totalTerritory : 0.5
      reward = (territoryRatio - 0.5) * 20 // -10 到 +10
      this.stats.draws++
    }

    if (stats.timeout) {
      this.stats.timeouts++
    }

    // 更新Q值：
    //  - 正常结束（包括超时）的局参与学习
    //  - 通过 maxTurns + 人口规则强行判定胜负的局，仅统计胜负，不参与 Q-learning 更新
    if (this.rlAI.updateQValues && !isResolvedByMaxTurns) {
      this.rlAI.updateQValues(reward)
      this.stats.totalReward += reward
    }

    return { result, reward }
  }

  /**
   * 训练
   */
  async train() {
    console.log(`\n开始RL训练`)
    console.log(`模式: ${this.config.mode}`)
    console.log(`Agent: ${this.config.agent}`)
    console.log(`Episodes: ${this.config.episodes}`)
    console.log(`玩家数: ${this.config.players}`)
    console.log(`地图: ${this.config.width}x${this.config.height}`)
    console.log(`最大回合: ${this.config.maxTurns}, 超时: ${this.config.maxTime}ms`)
    console.log('='.repeat(60))

    // 尝试加载已有Q表
    try {
      const data = await fs.readFile(this.config.savePath, 'utf-8')
      const qTable = JSON.parse(data)
      
      // 检查Q表格式是否匹配当前agent类型
      const qTableKeys = Object.keys(qTable)
      let isFormatMatch = false
      
      if (qTableKeys.length > 0) {
        // 检查第一个key的格式
        const firstKey = qTableKeys[0]
        
        if (this.config.agent === 'strategy') {
          // StrategyRLAI格式：5段状态 + 策略名（如 "10_9_1_0_0_ATTACK"）
          isFormatMatch = /^\d+_\d+_\d+_\d+_\d+_(ATTACK|DEFEND|GROW|ALL_IN)$/.test(firstKey)
        } else {
          // QLearningAI格式：2段状态 + "random"（如 "10_9_random"）
          isFormatMatch = /^\d+_\d+_random$/.test(firstKey)
        }
      }
      
      if (isFormatMatch || qTableKeys.length === 0) {
        this.rlAI = this.createAgent(qTable)
        console.log(`已加载Q表: ${qTableKeys.length} 个条目\n`)
      } else {
        console.log(`⚠️  警告: Q表格式不匹配当前agent类型 (${this.config.agent})`)
        console.log(`   检测到的格式: ${qTableKeys.length > 0 ? qTableKeys[0] : '空表'}`)
        console.log(`   期望的格式: ${this.config.agent === 'strategy' ? '5段状态_策略名' : '2段状态_random'}`)
        console.log(`   将从头开始训练（忽略旧Q表）\n`)
        this.rlAI = this.createAgent({}) // 使用空Q表
      }
    } catch (error) {
      console.log('未找到已有Q表，从头开始训练\n')
    }

    const startTime = Date.now()

    for (let episode = 0; episode < this.config.episodes; episode++) {
      await this.runTrainingGame(episode)

      // 定期保存和打印统计
      if ((episode + 1) % this.config.saveInterval === 0) {
        await this.saveQTable()
      }

      if ((episode + 1) % this.config.logInterval === 0) {
        this.printStats(episode + 1)
      }
    }

    // 最终保存
    await this.saveQTable()

    // 打印最终统计
    const duration = Date.now() - startTime
    console.log('\n' + '='.repeat(60))
    console.log('训练完成！')
    console.log(`总耗时: ${(duration / 1000).toFixed(1)}秒`)
    this.printStats(this.config.episodes, true)
  }

  /**
   * 打印统计
   */
  printStats(episodes, final = false) {
    const total = this.stats.wins + this.stats.losses + this.stats.draws + this.stats.timeouts
    const winRate = total > 0 ? (this.stats.wins / total * 100).toFixed(1) : 0

    const avgWinTurns = this.stats.winTurns.length > 0
      ? (this.stats.winTurns.reduce((a, b) => a + b, 0) / this.stats.winTurns.length).toFixed(1)
      : 0
    const minWinTurns = this.stats.winTurns.length > 0 ? Math.min(...this.stats.winTurns) : 0
    const maxWinTurns = this.stats.winTurns.length > 0 ? Math.max(...this.stats.winTurns) : 0

    const avgLossTurns = this.stats.lossTurns.length > 0
      ? (this.stats.lossTurns.reduce((a, b) => a + b, 0) / this.stats.lossTurns.length).toFixed(1)
      : 0
    const minLossTurns = this.stats.lossTurns.length > 0 ? Math.min(...this.stats.lossTurns) : 0
    const maxLossTurns = this.stats.lossTurns.length > 0 ? Math.max(...this.stats.lossTurns) : 0

    const avgReward = episodes > 0 ? (this.stats.totalReward / episodes).toFixed(2) : 0

    const qStats = this.rlAI ? this.rlAI.getQTableStats() : { size: 0, maxQ: 0, minQ: 0, avgQ: 0 }
    const epsilon = this.rlAI ? (typeof this.rlAI.epsilon === 'number' ? this.rlAI.epsilon.toFixed(3) : '0.000') : '0.000'

    // 确保 qStats 的值都是数字
    const safeMaxQ = typeof qStats.maxQ === 'number' && !isNaN(qStats.maxQ) ? qStats.maxQ : 0
    const safeMinQ = typeof qStats.minQ === 'number' && !isNaN(qStats.minQ) ? qStats.minQ : 0
    const safeAvgQ = typeof qStats.avgQ === 'number' && !isNaN(qStats.avgQ) ? qStats.avgQ : 0

    console.log(`\nEpisodes: ${episodes}`)
    console.log(`胜率: ${winRate}%`)
    console.log(`胜利: ${this.stats.wins}, 失败: ${this.stats.losses}, 平局: ${this.stats.draws}, 超时: ${this.stats.timeouts}`)
    
    if (this.stats.winTurns.length > 0) {
      console.log(`胜利回合: 平均 ${avgWinTurns}, 最短 ${minWinTurns}, 最长 ${maxWinTurns}`)
    }
    if (this.stats.lossTurns.length > 0) {
      console.log(`失败回合: 平均 ${avgLossTurns}, 最短 ${minLossTurns}, 最长 ${maxLossTurns}`)
    }
    
    console.log(`平均奖励: ${avgReward}`)
    console.log(`Q表大小: ${qStats.size || 0}`)
    console.log(`Q值范围: [${safeMinQ.toFixed(2)}, ${safeMaxQ.toFixed(2)}], 平均: ${safeAvgQ.toFixed(2)}`)
    console.log(`最终ε: ${epsilon}`)

    if (this.stats.draws / total > 0.3 && total > 100) {
      console.log(`⚠️  警告: 平局率过高 (${(this.stats.draws / total * 100).toFixed(1)}%)`)
    }
  }

  /**
   * 保存Q表
   */
  async saveQTable() {
    if (!this.rlAI) return

    const qTable = this.rlAI.saveQTable()
    await fs.writeFile(this.config.savePath, JSON.stringify(qTable, null, 2), 'utf-8')
    
    if (this.config.logInterval > 0) {
      console.log(`\n训练结果已保存`)
    }
  }

  /**
   * 导出Q表
   */
  exportQTable() {
    if (!this.rlAI) return null
    return this.rlAI.saveQTable()
  }
}

