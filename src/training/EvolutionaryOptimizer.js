/**
 * 进化算法优化器
 * 用于自动优化MinimaxAI的评估函数参数
 */
import GameSimulator from './GameSimulator.js'
import MinimaxAI from '../game/ai/MinimaxAI.js'
import { createAI } from '../game/ai/index.js'

/**
 * 评估函数参数定义
 * 这些参数会被进化算法优化
 */
export class EvaluationParams {
  constructor(params = {}) {
    // 基础优势权重
    this.baseWeight = params.baseWeight ?? 0.30
    this.territoryWeight = params.territoryWeight ?? 20
    this.armyWeight = params.armyWeight ?? 15
    this.importantWeight = params.importantWeight ?? 50
    
    // 进攻潜力权重
    this.attackWeight = params.attackWeight ?? 0.35
    this.attackBaseMultiplier = params.attackBaseMultiplier ?? 5
    this.attackCapitalBonus = params.attackCapitalBonus ?? 200
    this.attackFastBonus = params.attackFastBonus ?? 100
    this.attackLargeArmyBonus = params.attackLargeArmyBonus ?? 80
    
    // 防御需求权重
    this.defenseWeight = params.defenseWeight ?? 0.20
    this.defenseCapitalBonus = params.defenseCapitalBonus ?? 200
    this.defenseStrongholdBonus = params.defenseStrongholdBonus ?? 80
    this.defenseSupportBonus = params.defenseSupportBonus ?? 300
    
    // 发育潜力权重
    this.growthWeight = params.growthWeight ?? 0.15
    this.growthStrongholdBonus = params.growthStrongholdBonus ?? 300
    this.growthTerritoryBonus = params.growthTerritoryBonus ?? 10
    
    // 大兵力地块阈值和权重
    this.largeArmyThresholdMultiplier = params.largeArmyThresholdMultiplier ?? 1.5
    this.largeArmyMinUnits = params.largeArmyMinUnits ?? 30
    this.largeArmyBonus = params.largeArmyBonus ?? 2
    
    // 搜索参数
    this.maxDepth = params.maxDepth ?? 2
    this.maxBranches = params.maxBranches ?? 10
  }
  
  /**
   * 克隆参数
   */
  clone() {
    return new EvaluationParams({
      baseWeight: this.baseWeight,
      territoryWeight: this.territoryWeight,
      armyWeight: this.armyWeight,
      importantWeight: this.importantWeight,
      attackWeight: this.attackWeight,
      attackBaseMultiplier: this.attackBaseMultiplier,
      attackCapitalBonus: this.attackCapitalBonus,
      attackFastBonus: this.attackFastBonus,
      attackLargeArmyBonus: this.attackLargeArmyBonus,
      defenseWeight: this.defenseWeight,
      defenseCapitalBonus: this.defenseCapitalBonus,
      defenseStrongholdBonus: this.defenseStrongholdBonus,
      defenseSupportBonus: this.defenseSupportBonus,
      growthWeight: this.growthWeight,
      growthStrongholdBonus: this.growthStrongholdBonus,
      growthTerritoryBonus: this.growthTerritoryBonus,
      largeArmyThresholdMultiplier: this.largeArmyThresholdMultiplier,
      largeArmyMinUnits: this.largeArmyMinUnits,
      largeArmyBonus: this.largeArmyBonus,
      maxDepth: this.maxDepth,
      maxBranches: this.maxBranches
    })
  }
  
  /**
   * 转换为数组（用于交叉和变异）
   */
  toArray() {
    return [
      this.baseWeight, this.territoryWeight, this.armyWeight, this.importantWeight,
      this.attackWeight, this.attackBaseMultiplier, this.attackCapitalBonus,
      this.attackFastBonus, this.attackLargeArmyBonus,
      this.defenseWeight, this.defenseCapitalBonus, this.defenseStrongholdBonus,
      this.defenseSupportBonus,
      this.growthWeight, this.growthStrongholdBonus, this.growthTerritoryBonus,
      this.largeArmyThresholdMultiplier, this.largeArmyMinUnits, this.largeArmyBonus,
      this.maxDepth, this.maxBranches
    ]
  }
  
  /**
   * 从数组创建参数
   */
  static fromArray(arr) {
    return new EvaluationParams({
      baseWeight: arr[0],
      territoryWeight: arr[1],
      armyWeight: arr[2],
      importantWeight: arr[3],
      attackWeight: arr[4],
      attackBaseMultiplier: arr[5],
      attackCapitalBonus: arr[6],
      attackFastBonus: arr[7],
      attackLargeArmyBonus: arr[8],
      defenseWeight: arr[9],
      defenseCapitalBonus: arr[10],
      defenseStrongholdBonus: arr[11],
      defenseSupportBonus: arr[12],
      growthWeight: arr[13],
      growthStrongholdBonus: arr[14],
      growthTerritoryBonus: arr[15],
      largeArmyThresholdMultiplier: arr[16],
      largeArmyMinUnits: arr[17],
      largeArmyBonus: arr[18],
      maxDepth: Math.round(arr[19]),
      maxBranches: Math.round(arr[20])
    })
  }
}

/**
 * 进化算法优化器
 */
export class EvolutionaryOptimizer {
  constructor(config = {}) {
    this.populationSize = config.populationSize || 20 // 种群大小
    this.generations = config.generations || 10 // 进化代数
    this.gamesPerEvaluation = config.gamesPerEvaluation || 10 // 每个个体评估的游戏数
    this.mutationRate = config.mutationRate || 0.1 // 变异率
    this.crossoverRate = config.crossoverRate || 0.7 // 交叉率
    this.eliteCount = config.eliteCount || 2 // 精英个体数量
    this.simulator = new GameSimulator({
      maxTurns: config.maxTurns || 500,
      maxTime: config.maxTime || 30000,
      logLevel: 'silent'
    })
    this.opponentAI = config.opponentAI || 'adaptive' // 对手AI类型
  }
  
  /**
   * 运行进化算法
   */
  async optimize() {
    console.log('开始进化算法优化...')
    console.log(`种群大小: ${this.populationSize}, 进化代数: ${this.generations}`)
    console.log(`每代评估游戏数: ${this.gamesPerEvaluation}`)
    
    // 1. 初始化种群
    let population = this.initializePopulation()
    
    for (let generation = 0; generation < this.generations; generation++) {
      console.log(`\n=== 第 ${generation + 1}/${this.generations} 代 ===`)
      
      // 2. 评估每个个体
      const evaluated = await this.evaluatePopulation(population, generation)
      
      // 3. 排序（按适应度降序）
      evaluated.sort((a, b) => b.fitness - a.fitness)
      
      // 4. 输出当前代最佳个体
      const best = evaluated[0]
      console.log(`最佳适应度: ${best.fitness.toFixed(2)}`)
      console.log(`胜率: ${(best.wins / best.total * 100).toFixed(1)}%`)
      console.log(`参数:`, this.formatParams(best.params))
      
      // 5. 选择、交叉、变异生成下一代
      if (generation < this.generations - 1) {
        population = this.evolve(evaluated)
      } else {
        // 最后一代，返回最佳个体
        return {
          bestParams: best.params,
          bestFitness: best.fitness,
          history: evaluated.map(e => ({
            fitness: e.fitness,
            wins: e.wins,
            total: e.total
          }))
        }
      }
    }
  }
  
  /**
   * 初始化种群
   */
  initializePopulation() {
    const population = []
    
    // 第一个个体使用默认参数
    population.push(new EvaluationParams())
    
    // 其他个体随机生成
    for (let i = 1; i < this.populationSize; i++) {
      population.push(this.randomParams())
    }
    
    return population
  }
  
  /**
   * 生成随机参数
   */
  randomParams() {
    return new EvaluationParams({
      baseWeight: 0.2 + Math.random() * 0.2, // 0.2-0.4
      territoryWeight: 10 + Math.random() * 30, // 10-40
      armyWeight: 5 + Math.random() * 20, // 5-25
      importantWeight: 30 + Math.random() * 40, // 30-70
      attackWeight: 0.25 + Math.random() * 0.2, // 0.25-0.45
      attackBaseMultiplier: 3 + Math.random() * 5, // 3-8
      attackCapitalBonus: 100 + Math.random() * 200, // 100-300
      attackFastBonus: 50 + Math.random() * 100, // 50-150
      attackLargeArmyBonus: 40 + Math.random() * 80, // 40-120
      defenseWeight: 0.15 + Math.random() * 0.15, // 0.15-0.30
      defenseCapitalBonus: 100 + Math.random() * 200, // 100-300
      defenseStrongholdBonus: 40 + Math.random() * 80, // 40-120
      defenseSupportBonus: 150 + Math.random() * 200, // 150-350
      growthWeight: 0.1 + Math.random() * 0.15, // 0.1-0.25
      growthStrongholdBonus: 150 + Math.random() * 200, // 150-350
      growthTerritoryBonus: 5 + Math.random() * 15, // 5-20
      largeArmyThresholdMultiplier: 1.2 + Math.random() * 0.6, // 1.2-1.8
      largeArmyMinUnits: 20 + Math.random() * 20, // 20-40
      largeArmyBonus: 1.5 + Math.random() * 1.0, // 1.5-2.5
      maxDepth: 1 + Math.floor(Math.random() * 3), // 1-3
      maxBranches: 5 + Math.floor(Math.random() * 10) // 5-15
    })
  }
  
  /**
   * 评估种群
   */
  async evaluatePopulation(population, generation) {
    const evaluated = []
    
    for (let i = 0; i < population.length; i++) {
      const params = population[i]
      process.stdout.write(`\r评估个体 ${i + 1}/${population.length}...`)
      
      const fitness = await this.evaluateIndividual(params)
      evaluated.push({
        params,
        fitness,
        wins: fitness > 0 ? Math.round(fitness * this.gamesPerEvaluation) : 0,
        total: this.gamesPerEvaluation
      })
    }
    
    process.stdout.write('\n')
    return evaluated
  }
  
  /**
   * 评估单个个体
   */
  async evaluateIndividual(params) {
    let wins = 0
    let total = 0
    
    // 创建使用这些参数的MinimaxAI
    const createMinimaxAI = (playerId) => {
      // 这里需要修改MinimaxAI以接受参数
      // 暂时使用默认参数，后续需要修改MinimaxAI支持参数注入
      return new MinimaxAI(playerId, {
        maxDepth: params.maxDepth,
        maxBranches: params.maxBranches,
        evaluationParams: params // 传递评估参数
      })
    }
    
    // 进行多场对战
    for (let i = 0; i < this.gamesPerEvaluation; i++) {
      const gameConfig = {
        width: 25,
        height: 25,
        players: 2,
        aiConfigs: {
          1: { type: 'ai', aiInstance: createMinimaxAI(1) },
          2: { type: 'ai', aiType: this.opponentAI }
        }
      }
      
      const result = await this.simulator.runGame(gameConfig)
      const winner = result.stats.winner
      
      if (winner === 1) {
        wins++
      }
      total++
    }
    
    // 适应度 = 胜率
    return wins / total
  }
  
  /**
   * 进化：选择、交叉、变异
   */
  evolve(evaluated) {
    const newPopulation = []
    
    // 1. 精英保留（保留最好的几个个体）
    for (let i = 0; i < this.eliteCount; i++) {
      newPopulation.push(evaluated[i].params.clone())
    }
    
    // 2. 生成新个体
    while (newPopulation.length < this.populationSize) {
      // 选择父代（轮盘赌选择）
      const parent1 = this.selectParent(evaluated)
      const parent2 = this.selectParent(evaluated)
      
      // 交叉
      let child
      if (Math.random() < this.crossoverRate) {
        child = this.crossover(parent1, parent2)
      } else {
        child = parent1.clone()
      }
      
      // 变异
      if (Math.random() < this.mutationRate) {
        child = this.mutate(child)
      }
      
      newPopulation.push(child)
    }
    
    return newPopulation
  }
  
  /**
   * 轮盘赌选择父代
   */
  selectParent(evaluated) {
    // 计算总适应度
    const totalFitness = evaluated.reduce((sum, e) => sum + e.fitness, 0)
    
    // 如果总适应度为0，随机选择
    if (totalFitness === 0) {
      return evaluated[Math.floor(Math.random() * evaluated.length)].params
    }
    
    // 轮盘赌选择
    let random = Math.random() * totalFitness
    for (const individual of evaluated) {
      random -= individual.fitness
      if (random <= 0) {
        return individual.params
      }
    }
    
    return evaluated[evaluated.length - 1].params
  }
  
  /**
   * 交叉操作（单点交叉）
   */
  crossover(parent1, parent2) {
    const arr1 = parent1.toArray()
    const arr2 = parent2.toArray()
    const childArr = []
    
    const crossoverPoint = Math.floor(Math.random() * arr1.length)
    
    for (let i = 0; i < arr1.length; i++) {
      if (i < crossoverPoint) {
        childArr[i] = arr1[i]
      } else {
        childArr[i] = arr2[i]
      }
    }
    
    return EvaluationParams.fromArray(childArr)
  }
  
  /**
   * 变异操作（高斯变异）
   */
  mutate(params) {
    const arr = params.toArray()
    const mutatedArr = []
    
    for (let i = 0; i < arr.length; i++) {
      if (Math.random() < 0.3) { // 30%的概率变异每个参数
        // 高斯变异
        const mutationStrength = arr[i] * 0.1 // 变异强度为原值的10%
        const noise = (Math.random() - 0.5) * 2 * mutationStrength
        mutatedArr[i] = Math.max(0, arr[i] + noise) // 确保非负
      } else {
        mutatedArr[i] = arr[i]
      }
    }
    
    // 特殊处理：确保权重和为1
    const weights = [mutatedArr[0], mutatedArr[4], mutatedArr[9], mutatedArr[13]]
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum > 0) {
      mutatedArr[0] = weights[0] / sum * 0.3
      mutatedArr[4] = weights[1] / sum * 0.35
      mutatedArr[9] = weights[2] / sum * 0.20
      mutatedArr[13] = weights[3] / sum * 0.15
    }
    
    return EvaluationParams.fromArray(mutatedArr)
  }
  
  /**
   * 格式化参数输出
   */
  formatParams(params) {
    return {
      baseWeight: params.baseWeight.toFixed(2),
      attackWeight: params.attackWeight.toFixed(2),
      defenseWeight: params.defenseWeight.toFixed(2),
      growthWeight: params.growthWeight.toFixed(2),
      attackCapitalBonus: params.attackCapitalBonus.toFixed(0),
      maxDepth: params.maxDepth,
      maxBranches: params.maxBranches
    }
  }
}















