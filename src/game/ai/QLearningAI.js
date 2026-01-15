/**
 * Q-Learning AI（基础版本）
 * 直接学习动作级别的Q值
 */
import AIBase from './AIBase.js'
import RandomAI from './RandomAI.js'

export default class QLearningAI extends AIBase {
  constructor(playerId, options = {}) {
    super(playerId)
    
    // 清理 Q 表：只保留 QLearningAI 格式的 key（2段状态_random）
    const rawQTable = options.qTable || {}
    this.qTable = {}
    for (const [key, value] of Object.entries(rawQTable)) {
      if (/^\d+_\d+_random$/.test(key)) {
        this.qTable[key] = value
      }
    }
    
    this.trainingMode = options.trainingMode !== false
    this.epsilon = options.epsilon !== undefined ? options.epsilon : 0.1
    this.epsilonDecay = options.epsilonDecay !== undefined ? options.epsilonDecay : 0.9995
    this.epsilonMin = options.epsilonMin !== undefined ? options.epsilonMin : 0.05
    this.learningRate = options.learningRate !== undefined ? options.learningRate : 0.1
    this.discountFactor = options.discountFactor !== undefined ? options.discountFactor : 0.95
    this.randomHelper = new RandomAI(playerId)
    
    this.lastState = null
    this.lastAction = null
  }

  /**
   * 获取决策
   */
  getDecision(gameState) {
    if (!gameState) return null

    const stateKey = this.encodeState(gameState)
    const action = this.selectAction(stateKey)

    if (this.trainingMode) {
      this.lastState = stateKey
      this.lastAction = action
    }

    return this.executeAction(action, gameState) || this.randomHelper.getDecision(gameState)
  }

  /**
   * 选择动作（ε-贪婪）
   */
  selectAction(stateKey) {
    if (this.trainingMode && Math.random() < this.epsilon) {
      return 'random'
    }
    return this.getBestAction(stateKey)
  }

  /**
   * 获取最佳动作
   */
  getBestAction(stateKey) {
    // 简化：返回随机（实际应该学习具体动作）
    return 'random'
  }

  /**
   * 执行动作
   */
  executeAction(action, gameState) {
    return this.randomHelper.getDecision(gameState)
  }

  /**
   * 编码状态
   */
  encodeState(gameState) {
    const { map, currentPlayer, playerTiles = {} } = gameState
    const myId = currentPlayer

    let myTerritory = 0
    let myUnits = 0

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        if (tile.owner === myId) {
          myTerritory++
          myUnits += tile.units || 0
        }
      }
    }

    const territoryBin = Math.floor((myTerritory / (map.width * map.height)) * 20)
    const unitsBin = Math.floor((myUnits / 1000) * 20)

    return `${territoryBin}_${unitsBin}`
  }

  /**
   * 计算最终奖励
   */
  calculateFinalReward(gameState, isWinner) {
    if (isWinner) {
      return 100
    } else {
      return -50
    }
  }

  /**
   * 更新Q值
   */
  updateQValues(finalReward) {
    if (!this.trainingMode || !this.lastState || !this.lastAction) return

    const key = `${this.lastState}_${this.lastAction}`
    
    // 调试：检查生成的key格式
    if (key.includes('_ATTACK') || key.includes('_DEFEND') || key.includes('_GROW') || key.includes('_ALL_IN')) {
      console.error(`[QLearningAI ERROR] 生成的key格式错误: "${key}", lastState: "${this.lastState}", lastAction: "${this.lastAction}"`)
    }
    
    const currentQ = this.qTable[key] || 0
    const newQ = currentQ + this.learningRate * (finalReward - currentQ)
    this.qTable[key] = newQ

    if (this.epsilon > this.epsilonMin) {
      this.epsilon *= this.epsilonDecay
      if (this.epsilon < this.epsilonMin) {
        this.epsilon = this.epsilonMin
      }
    }
  }

  /**
   * 获取Q表统计
   */
  getQTableStats() {
    const entries = Object.values(this.qTable).filter(q => typeof q === 'number' && !isNaN(q))
    
    if (entries.length === 0) {
      return {
        size: 0,
        maxQ: 0,
        minQ: 0,
        avgQ: 0
      }
    }

    let maxQ = entries[0]
    let minQ = entries[0]
    let sumQ = 0

    for (const q of entries) {
      const numQ = Number(q)
      if (isNaN(numQ)) continue
      if (numQ > maxQ) maxQ = numQ
      if (numQ < minQ) minQ = numQ
      sumQ += numQ
    }

    return {
      size: entries.length,
      maxQ: Number(maxQ) || 0,
      minQ: Number(minQ) || 0,
      avgQ: entries.length > 0 ? sumQ / entries.length : 0
    }
  }

  /**
   * 保存Q表
   * 只保存 QLearningAI 格式的 key（2段状态_random）
   */
  saveQTable() {
    const cleanedQTable = {}
    for (const [key, value] of Object.entries(this.qTable)) {
      // 只保存 QLearningAI 格式的 key（2段状态_random）
      if (/^\d+_\d+_random$/.test(key)) {
        cleanedQTable[key] = value
      }
    }
    return cleanedQTable
  }

  /**
   * 加载Q表
   */
  loadQTable(qTable) {
    this.qTable = qTable || {}
  }
}


