/**
 * AI评估器
 * 多维度评估AI性能，避免过拟合
 */
import GameSimulator from './GameSimulator.js'

export class Evaluator {
  constructor(config = {}) {
    // 必需参数检查
    if (config.testGames === undefined) {
      throw new Error('Evaluator: testGames 参数是必需的')
    }
    if (config.validationGames === undefined) {
      throw new Error('Evaluator: validationGames 参数是必需的')
    }
    if (config.maxTurns === undefined) {
      throw new Error('Evaluator: maxTurns 参数是必需的')
    }
    if (config.maxTime === undefined) {
      throw new Error('Evaluator: maxTime 参数是必需的')
    }
    
    this.config = {
      testGames: config.testGames,
      validationGames: config.validationGames,
      scenarios: config.scenarios || [],
      logLevel: config.logLevel || 'normal',
      maxTurns: config.maxTurns,
      maxTime: config.maxTime,
      ...config
    }
    this.simulator = new GameSimulator({
      maxTurns: config.maxTurns,
      maxTime: config.maxTime,
      logLevel: 'silent'
    })
  }

  /**
   * 评估AI性能
   * @param {string} aiType - AI类型
   * @param {Object} options - 评估选项
   * @returns {Object} 评估结果
   */
  async evaluate(aiType, options = {}) {
    // 必需参数检查
    if (!options.against) {
      throw new Error('evaluate: against 参数是必需的')
    }
    if (!options.mapSizes) {
      throw new Error('evaluate: mapSizes 参数是必需的')
    }
    if (!options.playerCounts) {
      throw new Error('evaluate: playerCounts 参数是必需的')
    }
    
    const {
      against, // 对手AI类型列表
      mapSizes, // 地图尺寸
      playerCounts, // 玩家数量
      scenarios = this.config.scenarios || []
    } = options

    console.log(`\n开始评估 AI: ${aiType}`)
    console.log(`对手: ${against.join(', ')}`)
    console.log(`地图尺寸: ${mapSizes.map(s => `${s[0]}x${s[1]}`).join(', ')}`)
    console.log(`玩家数量: ${playerCounts.join(', ')}`)

    const results = {
      aiType,
      timestamp: new Date().toISOString(),
      scenarios: {},
      overall: {},
      detailed: []
    }

    // 1. 基础场景测试（训练集）
    const basicResults = await this.runBasicScenarios(aiType, against, mapSizes, playerCounts)
    results.scenarios.basic = basicResults

    // 2. 对抗性测试（验证集）
    const adversarialResults = await this.runAdversarialTests(aiType, against)
    results.scenarios.adversarial = adversarialResults

    // 3. 边界情况测试（测试集）
    const edgeCaseResults = await this.runEdgeCaseTests(aiType)
    results.scenarios.edgeCases = edgeCaseResults

    // 4. 自定义场景测试
    if (scenarios.length > 0) {
      const customResults = await this.runCustomScenarios(aiType, scenarios)
      results.scenarios.custom = customResults
    }

    // 5. 计算综合评分
    results.overall = this.calculateOverallScore(results.scenarios)

    // 6. 生成报告
    this.generateReport(results)

    return results
  }

  /**
   * 基础场景测试
   */
  async runBasicScenarios(aiType, against, mapSizes, playerCounts) {
    const results = []
    const totalGames = mapSizes.length * playerCounts.length * against.length * this.config.testGames

    let gameCount = 0
    for (const [width, height] of mapSizes) {
      for (const playerCount of playerCounts) {
        for (const opponentType of against) {
          const batchResults = []
          
          for (let i = 0; i < this.config.testGames; i++) {
            gameCount++
            if (this.config.logLevel === 'verbose' && gameCount % 10 === 0) {
              process.stdout.write(`\r进度: ${gameCount}/${totalGames} (${Math.round(gameCount/totalGames*100)}%)`)
            }

            const gameConfig = {
              width,
              height,
              players: playerCount,
              aiConfigs: {
                1: { type: 'ai', aiType },
                ...Object.fromEntries(
                  Array.from({ length: playerCount - 1 }, (_, i) => [
                    i + 2,
                    { type: 'ai', aiType: opponentType }
                  ])
                )
              }
            }

            const result = await this.simulator.runGame(gameConfig)
            batchResults.push(result)
          }

          // 聚合批次结果
          const aggregated = this.aggregateResults(batchResults, aiType)
          results.push({
            scenario: `地图${width}x${height}_${playerCount}玩家_对手${opponentType}`,
            ...aggregated
          })
        }
      }
    }

    if (this.config.logLevel === 'verbose') {
      console.log('\n基础场景测试完成')
    }

    return results
  }

  /**
   * 对抗性测试（类似实盘测试）
   */
  async runAdversarialTests(aiType, against) {
    const results = []
    
    // 测试1: 多对一（被围攻）
    const surroundedResults = []
    for (let i = 0; i < this.config.validationGames; i++) {
      const gameConfig = {
        width: 25,
        height: 25,
        players: 3,
        aiConfigs: {
          1: { type: 'ai', aiType },
          2: { type: 'ai', aiType: against[0] },
          3: { type: 'ai', aiType: against[0] }
        }
      }
      const result = await this.simulator.runGame(gameConfig)
      surroundedResults.push(result)
    }
    results.push({
      scenario: '被围攻场景',
      ...this.aggregateResults(surroundedResults, aiType)
    })

    // 测试2: 资源劣势（地图更小）
    const resourceDisadvantageResults = []
    for (let i = 0; i < this.config.validationGames; i++) {
      const gameConfig = {
        width: 15,
        height: 15,
        players: 2,
        aiConfigs: {
          1: { type: 'ai', aiType },
          2: { type: 'ai', aiType: against[0] }
        }
      }
      const result = await this.simulator.runGame(gameConfig)
      resourceDisadvantageResults.push(result)
    }
    results.push({
      scenario: '资源劣势场景',
      ...this.aggregateResults(resourceDisadvantageResults, aiType)
    })

    // 测试3: 长期对抗（大地图）
    const longGameResults = []
    for (let i = 0; i < this.config.validationGames; i++) {
      const gameConfig = {
        width: 50,
        height: 50,
        players: 2,
        aiConfigs: {
          1: { type: 'ai', aiType },
          2: { type: 'ai', aiType: against[0] }
        }
      }
      const result = await this.simulator.runGame(gameConfig)
      longGameResults.push(result)
    }
    results.push({
      scenario: '长期对抗场景',
      ...this.aggregateResults(longGameResults, aiType)
    })

    return results
  }

  /**
   * 边界情况测试
   */
  async runEdgeCaseTests(aiType) {
    const results = []

    // 测试1: 极小地图
    const smallMapResults = []
    for (let i = 0; i < 20; i++) {
      const gameConfig = {
        width: 10,
        height: 10,
        players: 2,
        aiConfigs: {
          1: { type: 'ai', aiType },
          2: { type: 'ai', aiType: 'random' }
        }
      }
      const result = await this.simulator.runGame(gameConfig)
      smallMapResults.push(result)
    }
    results.push({
      scenario: '极小地图',
      ...this.aggregateResults(smallMapResults, aiType)
    })

    // 测试2: 多人混战
    const multiPlayerResults = []
    for (let i = 0; i < 20; i++) {
      const gameConfig = {
        width: 30,
        height: 30,
        players: 4,
        aiConfigs: {
          1: { type: 'ai', aiType },
          2: { type: 'ai', aiType: 'random' },
          3: { type: 'ai', aiType: 'random' },
          4: { type: 'ai', aiType: 'random' }
        }
      }
      const result = await this.simulator.runGame(gameConfig)
      multiPlayerResults.push(result)
    }
    results.push({
      scenario: '多人混战',
      ...this.aggregateResults(multiPlayerResults, aiType)
    })

    return results
  }

  /**
   * 自定义场景测试
   */
  async runCustomScenarios(aiType, scenarios) {
    const results = []
    
    for (const scenario of scenarios) {
      const scenarioResults = []
      const games = scenario.games || 20
      
      for (let i = 0; i < games; i++) {
        const gameConfig = {
          ...scenario.gameConfig,
          aiConfigs: {
            1: { type: 'ai', aiType },
            ...scenario.opponents
          }
        }
        const result = await this.simulator.runGame(gameConfig)
        scenarioResults.push(result)
      }
      
      results.push({
        scenario: scenario.name || '自定义场景',
        ...this.aggregateResults(scenarioResults, aiType)
      })
    }
    
    return results
  }

  /**
   * 聚合结果
   */
  aggregateResults(results, targetAI) {
    const targetPlayerId = 1 // 假设目标AI总是玩家1
    
    const wins = results.filter(r => r.stats.winner === targetPlayerId).length
    const total = results.length
    const winRate = wins / total
    
    const avgTurns = results.reduce((sum, r) => sum + r.stats.turns, 0) / total
    const avgDuration = results.reduce((sum, r) => sum + r.stats.duration, 0) / total
    
    const avgTerritories = results.reduce((sum, r) => {
      return sum + (r.stats.finalMetrics[targetPlayerId]?.territories || 0)
    }, 0) / total
    
    const avgUnits = results.reduce((sum, r) => {
      return sum + (r.stats.finalMetrics[targetPlayerId]?.units || 0)
    }, 0) / total
    
    const avgScore = results.reduce((sum, r) => {
      return sum + (r.stats.finalMetrics[targetPlayerId]?.score || 0)
    }, 0) / total
    
    // 计算标准差（评估稳定性）
    const scores = results.map(r => r.stats.finalMetrics[targetPlayerId]?.score || 0)
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / total
    const stdDev = Math.sqrt(variance)
    
    // 计算分位数（评估极端情况）
    const sortedScores = [...scores].sort((a, b) => a - b)
    const p25 = sortedScores[Math.floor(total * 0.25)]
    const p75 = sortedScores[Math.floor(total * 0.75)]
    const p95 = sortedScores[Math.floor(total * 0.95)]
    
    return {
      totalGames: total,
      wins,
      winRate,
      avgTurns,
      avgDuration,
      avgTerritories,
      avgUnits,
      avgScore,
      stdDev,
      p25,
      p75,
      p95,
      stability: stdDev / (avgScore + 1), // 变异系数
      results: results.map(r => ({
        winner: r.stats.winner,
        turns: r.stats.turns,
        score: r.stats.finalMetrics[targetPlayerId]?.score || 0
      }))
    }
  }

  /**
   * 计算综合评分
   */
  calculateOverallScore(scenarios) {
    // 权重设计：基础场景40%，对抗性30%，边界情况20%，自定义10%
    const weights = {
      basic: 0.4,
      adversarial: 0.3,
      edgeCases: 0.2,
      custom: 0.1
    }

    let totalScore = 0
    let totalWeight = 0
    const categoryScores = {}

    for (const [category, weight] of Object.entries(weights)) {
      if (scenarios[category] && scenarios[category].length > 0) {
        const categoryAvg = scenarios[category].reduce((sum, s) => {
          return sum + (s.avgScore || 0)
        }, 0) / scenarios[category].length
        
        const categoryWinRate = scenarios[category].reduce((sum, s) => {
          return sum + (s.winRate || 0)
        }, 0) / scenarios[category].length

        // 综合评分 = 胜率 * 100 + 平均分数
        const categoryScore = categoryWinRate * 100 + categoryAvg * 0.1
        
        categoryScores[category] = categoryScore
        totalScore += categoryScore * weight
        totalWeight += weight
      }
    }

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0

    return {
      overallScore,
      categoryScores,
      weights
    }
  }

  /**
   * 生成评估报告
   */
  generateReport(results) {
    console.log('\n' + '='.repeat(60))
    console.log(`AI评估报告: ${results.aiType}`)
    console.log('='.repeat(60))
    
    console.log(`\n综合评分: ${results.overall.overallScore.toFixed(2)}`)
    console.log('\n分类评分:')
    for (const [category, score] of Object.entries(results.overall.categoryScores)) {
      console.log(`  ${category}: ${score.toFixed(2)}`)
    }

    console.log('\n详细场景:')
    for (const [category, scenarios] of Object.entries(results.scenarios)) {
      if (scenarios && scenarios.length > 0) {
        console.log(`\n${category}:`)
        for (const scenario of scenarios) {
          console.log(`  ${scenario.scenario}:`)
          console.log(`    胜率: ${(scenario.winRate * 100).toFixed(1)}% (${scenario.wins}/${scenario.totalGames})`)
          console.log(`    平均分数: ${scenario.avgScore.toFixed(2)}`)
          console.log(`    稳定性: ${(scenario.stability * 100).toFixed(2)}% (变异系数)`)
          console.log(`    平均回合: ${scenario.avgTurns.toFixed(1)}`)
        }
      }
    }
    
    console.log('\n' + '='.repeat(60))
  }
}

export default Evaluator

