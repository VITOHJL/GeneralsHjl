/**
 * 策略RL AI
 * 使用Q-learning选择高层策略（ATTACK, DEFEND, GROW, ALL_IN）
 * 底层策略执行由StrategyExecutors提供
 */
import AIBase from './AIBase.js'
import RandomAI from './RandomAI.js'
import {
  buildContext,
  planAttack,
  planDefense,
  planGrowth,
  planAllInAttack
} from './StrategyExecutors.js'

const STRATEGIES = {
  ATTACK: 'ATTACK',
  DEFEND: 'DEFEND',
  GROW: 'GROW',
  ALL_IN: 'ALL_IN'
}

export default class StrategyRLAI extends AIBase {
  constructor(playerId, options = {}) {
    super(playerId)
    this.qTable = options.qTable || {}
    this.trainingMode = options.trainingMode !== false
    this.epsilon = options.epsilon !== undefined ? options.epsilon : 0.1
    this.epsilonDecay = options.epsilonDecay !== undefined ? options.epsilonDecay : 0.9995
    this.epsilonMin = options.epsilonMin !== undefined ? options.epsilonMin : 0.05
    this.learningRate = options.learningRate !== undefined ? options.learningRate : 0.1
    this.discountFactor = options.discountFactor !== undefined ? options.discountFactor : 0.95
    this.randomHelper = new RandomAI(playerId)
    
    // 用于存储当前回合的状态和动作（用于Q-learning更新）
    this.lastState = null
    this.lastAction = null
  }

  /**
   * 获取决策
   */
  getDecision(gameState) {
    if (!gameState || !gameState.map) {
      return this.randomHelper.getDecision(gameState)
    }

    try {
      const ctx = buildContext(gameState, this.playerId)
      const stateKey = this.encodeState(gameState, ctx)

    // 选择策略
    const strategy = this.selectStrategy(stateKey)

    // 执行策略
    const decision = this.executeStrategy(strategy, ctx)

    // 保存状态和动作（用于Q-learning更新）
    if (this.trainingMode) {
      this.lastState = stateKey
      this.lastAction = strategy
    }

    // 如果策略执行失败，回退到随机
    return decision || this.randomHelper.getDecision(gameState)
    } catch (error) {
      console.error('StrategyRLAI.getDecision error:', error.message)
      return this.randomHelper.getDecision(gameState)
    }
  }

  /**
   * 选择策略（ε-贪婪）
   */
  selectStrategy(stateKey) {
    if (this.trainingMode && Math.random() < this.epsilon) {
      // 探索：随机选择
      const strategies = Object.values(STRATEGIES)
      return strategies[Math.floor(Math.random() * strategies.length)]
    }

    // 利用：选择Q值最高的策略
    return this.getBestStrategy(stateKey)
  }

  /**
   * 获取最佳策略
   */
  getBestStrategy(stateKey) {
    const strategies = Object.values(STRATEGIES)
    let bestStrategy = strategies[0]
    let bestQ = this.getQValue(stateKey, bestStrategy)

    for (const strategy of strategies) {
      const q = this.getQValue(stateKey, strategy)
      if (q > bestQ) {
        bestQ = q
        bestStrategy = strategy
      }
    }

    return bestStrategy
  }

  /**
   * 执行策略
   */
  executeStrategy(strategy, ctx) {
    switch (strategy) {
      case STRATEGIES.ATTACK:
        return planAttack(ctx)
      case STRATEGIES.DEFEND:
        return planDefense(ctx)
      case STRATEGIES.GROW:
        return planGrowth(ctx)
      case STRATEGIES.ALL_IN:
        return planAllInAttack(ctx)
      default:
        return null
    }
  }

  /**
   * 编码游戏状态为离散状态键
   * 动态离散化，根据地图大小调整
   */
  encodeState(gameState, ctx) {
    if (!gameState || !gameState.map) {
      // 返回默认状态键
      return '0_0_10_0_0'
    }

    const { map, turn } = gameState
    const { myTerritory, enemyTerritory, myTotalUnits, enemyTotalUnits, nearestEnemyCapital, minDistToCapital } = ctx

    if (!map.width || !map.height) {
      return '0_0_10_0_0'
    }

    // 根据地图大小动态调整离散化粒度
    const mapSize = map.width * map.height
    const territoryBinSize = Math.max(5, Math.floor(mapSize / 20))
    const unitsBinSize = Math.max(50, Math.floor(mapSize / 2))

    // 离散化特征
    const territoryRatio = myTerritory / (myTerritory + enemyTerritory + 1)
    const territoryBin = Math.floor(territoryRatio * 20) // 0-19

    const unitsRatio = myTotalUnits / (myTotalUnits + enemyTotalUnits + 1)
    const unitsBin = Math.floor(unitsRatio * 20) // 0-19

    const distanceBin = nearestEnemyCapital
      ? Math.min(Math.floor(minDistToCapital / 10), 9) // 0-9
      : 10

    const strongholdsBin = Math.min(ctx.myStrongholds.length, 3) // 0-3

    const turnBin = Math.min(Math.floor(turn / 100), 9) // 0-9

    return `${territoryBin}_${unitsBin}_${distanceBin}_${strongholdsBin}_${turnBin}`
  }

  /**
   * 获取Q值
   */
  getQValue(state, action) {
    const key = `${state}_${action}`
    return this.qTable[key] || 0
  }

  /**
   * 设置Q值
   */
  setQValue(state, action, value) {
    const key = `${state}_${action}`
    this.qTable[key] = value
  }

  /**
   * 更新Q值（Q-learning更新规则）
   */
  updateQValue(state, action, reward, nextState) {
    const currentQ = this.getQValue(state, action)
    const nextMaxQ = nextState
      ? Math.max(...Object.values(STRATEGIES).map(s => this.getQValue(nextState, s)))
      : 0

    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * nextMaxQ - currentQ)
    this.setQValue(state, action, newQ)
  }

  /**
   * 计算最终奖励
   */
  calculateFinalReward(gameState, isWinner) {
    if (isWinner) {
      // 胜利奖励：越早胜利奖励越高
      const turn = gameState?.turn || 0
      const earlyWinBonus = Math.max(0, 1000 - turn * 2)
      return 100 + earlyWinBonus
    } else {
      // 失败惩罚：根据最终领土比例调整
      try {
        if (!gameState || !gameState.map) {
          return -50
        }
        const ctx = buildContext(gameState, this.playerId)
        const territoryRatio = ctx.myTerritory / (ctx.myTerritory + ctx.enemyTerritory + 1)
        return -50 - (1 - territoryRatio) * 50
      } catch (error) {
        console.error('calculateFinalReward error:', error.message)
        return -50
      }
    }
  }

  /**
   * 更新Q表（在游戏结束时调用）
   */
  updateQValues(finalReward) {
    if (!this.trainingMode || !this.lastState || !this.lastAction) return

    // 更新最后一个动作的Q值
    this.updateQValue(this.lastState, this.lastAction, finalReward, null)

    // 衰减epsilon
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
   */
  saveQTable() {
    return JSON.parse(JSON.stringify(this.qTable))
  }

  /**
   * 加载Q表
   */
  loadQTable(qTable) {
    this.qTable = qTable || {}
  }
}


