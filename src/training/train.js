#!/usr/bin/env node

/**
 * AI训练和评估命令行工具
 * 
 * 使用方法:
 *   node src/training/train.js evaluate --ai adaptive --games 100
 *   node src/training/train.js compare --ai1 adaptive --ai2 random --games 50
 *   node src/training/train.js benchmark --all
 */

import Evaluator from './Evaluator.js'
import GameSimulator from './GameSimulator.js'
import { EvolutionaryOptimizer } from './EvolutionaryOptimizer.js'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  try {
    switch (command) {
      case 'evaluate':
        await handleEvaluate(args.slice(1))
        break
      case 'compare':
        await handleCompare(args.slice(1))
        break
      case 'benchmark':
        await handleBenchmark(args.slice(1))
        break
      case 'evolve':
        await handleEvolve(args.slice(1))
        break
      case 'help':
      case '--help':
      case '-h':
        printHelp()
        break
      default:
        console.error(`未知命令: ${command}`)
        printHelp()
        process.exit(1)
    }
  } catch (error) {
    console.error('错误:', error.message)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

/**
 * 评估单个AI
 */
async function handleEvaluate(args) {
  const options = parseArgs(args)
  
  // 必需参数检查
  if (!options.ai && !options.aiType) {
    throw new Error('错误: 必须提供 --ai 或 --aiType 参数')
  }
  if (!options.games && !options.testGames) {
    throw new Error('错误: 必须提供 --games 或 --testGames 参数')
  }
  if (!options.validation) {
    throw new Error('错误: 必须提供 --validation 参数')
  }
  if (!options.against) {
    throw new Error('错误: 必须提供 --against 参数')
  }
  if (!options.mapSizes) {
    throw new Error('错误: 必须提供 --mapSizes 参数')
  }
  if (!options.players) {
    throw new Error('错误: 必须提供 --players 参数')
  }
  if (!options.maxTurns) {
    throw new Error('错误: 必须提供 --maxTurns 参数')
  }
  if (!options.maxTime) {
    throw new Error('错误: 必须提供 --maxTime 参数（单位：毫秒）')
  }
  
  const aiType = options.ai || options.aiType
  const games = parseInt(options.games || options.testGames)
  const validationGames = parseInt(options.validation)
  const maxTurns = parseInt(options.maxTurns)
  const maxTime = parseInt(options.maxTime)
  const logLevel = options.verbose ? 'verbose' : (options.quiet ? 'silent' : 'normal')

  const evaluator = new Evaluator({
    testGames: games,
    validationGames,
    maxTurns,
    maxTime,
    logLevel
  })

  const results = await evaluator.evaluate(aiType, {
    against: options.against.split(','),
    mapSizes: parseMapSizes(options.mapSizes),
    playerCounts: options.players.split(',').map(Number)
  })

  // 保存结果到文件
  if (options.output) {
    const fs = await import('fs/promises')
    await fs.writeFile(
      options.output,
      JSON.stringify(results, null, 2),
      'utf-8'
    )
    console.log(`\n结果已保存到: ${options.output}`)
  }

  return results
}

/**
 * 对比多个AI（支持任意数量的玩家）
 */
async function handleCompare(args) {
  const options = parseArgs(args)
  
  // 必需参数检查
  if (!options.ai1) {
    throw new Error('错误: 必须提供 --ai1 参数（至少需要2个玩家）')
  }
  if (!options.games) {
    throw new Error('错误: 必须提供 --games 参数')
  }
  if (!options.width) {
    throw new Error('错误: 必须提供 --width 参数')
  }
  if (!options.height) {
    throw new Error('错误: 必须提供 --height 参数')
  }
  if (!options.maxTurns) {
    throw new Error('错误: 必须提供 --maxTurns 参数')
  }
  if (!options.maxTime) {
    throw new Error('错误: 必须提供 --maxTime 参数（单位：毫秒）')
  }
  
  // 收集所有 --aiN 参数（N = 1, 2, 3, 4, ...）
  const aiTypes = []
  const aiDisplayNames = []
  const aiParams = []
  let playerCount = 0
  
  for (let i = 1; i <= 10; i++) { // 最多支持10个玩家
    const aiKey = `ai${i}`
    if (options[aiKey]) {
      aiTypes[i - 1] = options[aiKey]
      aiDisplayNames[i - 1] = options[aiKey]
      aiParams[i - 1] = null
      playerCount = i
    }
  }
  
  if (playerCount < 2) {
    throw new Error('错误: 至少需要提供 --ai1 和 --ai2 参数')
  }
  
  const games = parseInt(options.games)
  const width = parseInt(options.width)
  const height = parseInt(options.height)
  const maxTurns = parseInt(options.maxTurns)
  const maxTime = parseInt(options.maxTime)

  // 加载优化后的参数（如果指定了参数文件）
  if (options.paramsFile) {
    const fs = await import('fs/promises')
    try {
      const paramsData = JSON.parse(await fs.readFile(options.paramsFile, 'utf-8'))
      const evolvedParams = paramsData.bestParams
      
      for (let i = 0; i < playerCount; i++) {
        if (aiTypes[i] === 'minimax') {
          aiParams[i] = evolvedParams
          aiDisplayNames[i] = 'minimax (evolved)'
        }
      }
      
      console.log(`\n已加载优化参数文件: ${options.paramsFile}`)
      for (let i = 0; i < playerCount; i++) {
        if (aiParams[i]) {
          console.log(`  AI${i + 1} (${aiDisplayNames[i]}) 使用优化参数`)
        }
      }
    } catch (error) {
      throw new Error(`无法加载参数文件 ${options.paramsFile}: ${error.message}`)
    }
  }

  // 显示对战信息
  const aiNamesStr = aiDisplayNames.map((name, idx) => `AI${idx + 1}(${name})`).join(' vs ')
  console.log(`\n对比测试: ${aiNamesStr}`)
  console.log(`玩家数量: ${playerCount}`)
  console.log(`游戏场数: ${games}`)
  console.log(`地图尺寸: ${width}x${height}`)
  console.log(`最大回合数: ${maxTurns}, 超时时间: ${maxTime}ms`)

  const simulator = new GameSimulator({
    maxTurns,
    maxTime,
    logLevel: 'silent'
  })

  // 导入 createAI 函数
  const { createAI } = await import('../game/ai/index.js')

  // 初始化统计结果（支持多个玩家）
  const results = {}
  for (let i = 1; i <= playerCount; i++) {
    results[i] = { wins: 0, total: 0, scores: [] }
  }
  results.draws = 0
  results.timeouts = 0

  for (let i = 0; i < games; i++) {
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r进度: ${i + 1}/${games}`)
    }

    // 为每个玩家创建 AI 配置
    const aiConfigs = {}
    
    for (let playerId = 1; playerId <= playerCount; playerId++) {
      const aiType = aiTypes[playerId - 1]
      const aiParam = aiParams[playerId - 1]
      
      // RL 专用参数：支持通过命令行指定 Q 表路径
      const qtableKey = `qtableP${playerId}`
      const aiOptions = {}
      
      if (options[qtableKey] && (aiType === 'strategy_rl' || aiType === 'qlearning_rl')) {
        aiOptions.qTablePath = options[qtableKey]
      }
      
      let aiInstance = null
      
      // 如果指定了 minimax 优化参数
      if (aiParam) {
        aiInstance = createAI(aiType, playerId, {
          evaluationParams: aiParam,
          maxDepth: aiParam.maxDepth,
          maxBranches: aiParam.maxBranches,
          ...aiOptions
        })
      }
      
      // 配置 AI
      aiConfigs[playerId] = aiInstance
        ? { type: 'ai', aiInstance: aiInstance }
        : { type: 'ai', aiType: aiType, options: aiOptions }
    }

    const gameConfig = {
      width,
      height,
      players: playerCount,
      aiConfigs
    }

    const result = await simulator.runGame(gameConfig)
    const stats = result.stats
    const winner = stats.winner

    if (stats.timeout) {
      results.timeouts++
    } else if (winner !== null && winner >= 1 && winner <= playerCount) {
      results[winner].wins++
      results[winner].scores.push(stats.finalMetrics[winner]?.score || 0)
    } else {
      results.draws++
    }

    // 更新所有玩家的总场数
    for (let playerId = 1; playerId <= playerCount; playerId++) {
      results[playerId].total++
    }
  }

  // 输出统计结果
  console.log('\n' + '='.repeat(60))
  console.log('对比结果:')
  console.log('='.repeat(60))
  
  for (let playerId = 1; playerId <= playerCount; playerId++) {
    const displayName = aiDisplayNames[playerId - 1]
    const playerResults = results[playerId]
    const winRate = playerResults.total > 0 
      ? (playerResults.wins / playerResults.total * 100).toFixed(1) 
      : '0.0'
    
    console.log(`\n玩家 ${playerId} (${displayName}):`)
    console.log(`  胜场: ${playerResults.wins}/${playerResults.total}`)
    console.log(`  胜率: ${winRate}%`)
    if (playerResults.scores.length > 0) {
      const avgScore = playerResults.scores.reduce((a, b) => a + b, 0) / playerResults.scores.length
      console.log(`  平均分数: ${avgScore.toFixed(2)}`)
    }
  }
  
  console.log(`\n平局: ${results.draws}`)
  console.log(`超时: ${results.timeouts}`)
  console.log('='.repeat(60))
}

/**
 * 基准测试所有AI
 */
async function handleBenchmark(args) {
  const options = parseArgs(args)
  
  // 必需参数检查
  if (!options.all && !options.ais) {
    throw new Error('错误: 必须提供 --all 或 --ais 参数')
  }
  if (!options.games) {
    throw new Error('错误: 必须提供 --games 参数')
  }
  if (!options.validation) {
    throw new Error('错误: 必须提供 --validation 参数')
  }
  if (!options.against) {
    throw new Error('错误: 必须提供 --against 参数')
  }
  if (!options.mapSizes) {
    throw new Error('错误: 必须提供 --mapSizes 参数')
  }
  if (!options.players) {
    throw new Error('错误: 必须提供 --players 参数')
  }
  if (!options.maxTurns) {
    throw new Error('错误: 必须提供 --maxTurns 参数')
  }
  if (!options.maxTime) {
    throw new Error('错误: 必须提供 --maxTime 参数（单位：毫秒）')
  }
  
  const aiTypes = options.all ? ['random', 'adaptive'] : options.ais.split(',')
  const games = parseInt(options.games)
  const validationGames = parseInt(options.validation)
  const maxTurns = parseInt(options.maxTurns)
  const maxTime = parseInt(options.maxTime)

  console.log('\n基准测试所有AI')
  console.log(`AI列表: ${aiTypes.join(', ')}`)
  console.log(`测试游戏数: ${games}, 验证游戏数: ${validationGames}`)
  console.log(`最大回合数: ${maxTurns}, 超时时间: ${maxTime}ms`)
  console.log('='.repeat(60))

  const results = {}

  for (const aiType of aiTypes) {
    console.log(`\n测试 ${aiType}...`)
    const evaluator = new Evaluator({
      testGames: games,
      validationGames,
      maxTurns,
      maxTime,
      logLevel: 'minimal'
    })

    const result = await evaluator.evaluate(aiType, {
      against: options.against.split(','),
      mapSizes: parseMapSizes(options.mapSizes),
      playerCounts: options.players.split(',').map(Number)
    })

    results[aiType] = result.overall.overallScore
  }

  console.log('\n' + '='.repeat(60))
  console.log('基准测试结果:')
  console.log('='.repeat(60))
  const sorted = Object.entries(results).sort((a, b) => b[1] - a[1])
  for (const [aiType, score] of sorted) {
    console.log(`${aiType}: ${score.toFixed(2)}`)
  }
  console.log('='.repeat(60))
}

/**
 * 进化算法优化
 */
async function handleEvolve(args) {
  const options = parseArgs(args)
  
  // 必需参数检查
  if (!options.populationSize) {
    throw new Error('错误: 必须提供 --populationSize 参数')
  }
  if (!options.generations) {
    throw new Error('错误: 必须提供 --generations 参数')
  }
  if (!options.gamesPerEvaluation) {
    throw new Error('错误: 必须提供 --gamesPerEvaluation 参数')
  }
  if (!options.maxTurns) {
    throw new Error('错误: 必须提供 --maxTurns 参数')
  }
  if (!options.maxTime) {
    throw new Error('错误: 必须提供 --maxTime 参数（单位：毫秒）')
  }
  
  const populationSize = parseInt(options.populationSize)
  const generations = parseInt(options.generations)
  const gamesPerEvaluation = parseInt(options.gamesPerEvaluation)
  const maxTurns = parseInt(options.maxTurns)
  const maxTime = parseInt(options.maxTime)
  const mutationRate = parseFloat(options.mutationRate || '0.1')
  const crossoverRate = parseFloat(options.crossoverRate || '0.7')
  const eliteCount = parseInt(options.eliteCount || '2')
  const opponentAI = options.opponentAI || 'adaptive'
  
  const optimizer = new EvolutionaryOptimizer({
    populationSize,
    generations,
    gamesPerEvaluation,
    mutationRate,
    crossoverRate,
    eliteCount,
    maxTurns,
    maxTime,
    opponentAI
  })
  
  const result = await optimizer.optimize()
  
  console.log('\n' + '='.repeat(60))
  console.log('进化算法优化完成！')
  console.log('='.repeat(60))
  console.log(`最佳适应度: ${result.bestFitness.toFixed(4)}`)
  console.log('最佳参数:')
  console.log(JSON.stringify(optimizer.formatParams(result.bestParams), null, 2))
  
  // 保存结果
  if (options.output) {
    const fs = await import('fs/promises')
    await fs.writeFile(
      options.output,
      JSON.stringify({
        bestParams: result.bestParams,
        bestFitness: result.bestFitness,
        history: result.history,
        config: {
          populationSize,
          generations,
          gamesPerEvaluation,
          mutationRate,
          crossoverRate,
          eliteCount,
          opponentAI
        }
      }, null, 2),
      'utf-8'
    )
    console.log(`\n结果已保存到: ${options.output}`)
  }
  
  return result
}

/**
 * 解析命令行参数
 * 支持两种格式：
 * 1. 键值对格式：--key value
 * 2. 位置参数格式（向后兼容，用于PowerShell反引号问题）：ai1 ai2 games width height maxTurns maxTime
 */
function parseArgs(args) {
  const options = {}
  
  // 检测是否为位置参数格式（第一个参数不是以--开头，且参数数量>=7）
  // 位置参数格式仅用于compare命令：ai1 ai2 games width height maxTurns maxTime
  if (args.length >= 7 && args[0] && !args[0].startsWith('--') && !isNaN(args[2])) {
    // 位置参数格式
    options.ai1 = args[0]
    options.ai2 = args[1]
    options.games = args[2]
    options.width = args[3]
    options.height = args[4]
    options.maxTurns = args[5]
    options.maxTime = args[6]
    return options
  }
  
  // 键值对格式解析
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--?/, '')
    const value = args[i + 1]
    if (key && value && !value.startsWith('--')) {
      options[key] = value
    } else if (key && (key === 'verbose' || key === 'quiet' || key === 'all')) {
      options[key] = true
      i-- // 回退，因为这是标志参数，不占用下一个位置
    }
  }
  
  return options
}

/**
 * 解析地图尺寸字符串
 */
function parseMapSizes(str) {
  return str.split(',').map(s => {
    const [w, h] = s.split('x').map(Number)
    return [w, h]
  })
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
AI训练和评估工具

使用方法:
  node src/training/train.js <command> [options]

命令:
  evaluate    评估单个AI
  compare     对比两个AI
  benchmark   基准测试所有AI
  help        显示帮助信息

评估命令选项（所有参数都是必需的）:
  --ai <type>            要评估的AI类型
  --games <number>       每个基础场景的游戏数量
  --validation <number>  每个对抗性场景的游戏数量
  --against <types>      对手AI类型，逗号分隔（如: random,adaptive）
  --mapSizes <sizes>     地图尺寸，格式: 20x20,30x30
  --players <counts>     玩家数量，逗号分隔（如: 2,3,4）
  --maxTurns <number>    最大回合数
  --maxTime <number>     超时时间（毫秒）
  --output <file>        保存结果到JSON文件（可选）
  --verbose              详细输出（可选）
  --quiet                静默模式（可选）

对比命令选项（所有参数都是必需的）:
  --ai1 <type>     第一个AI类型（玩家1，必需）
  --ai2 <type>     第二个AI类型（玩家2，必需）
  --ai3 <type>     第三个AI类型（玩家3，可选）
  --ai4 <type>     第四个AI类型（玩家4，可选）
  ...              支持最多10个玩家（--ai1 到 --ai10）
  --games <num>    对战游戏数量
  --width <num>    地图宽度
  --height <num>   地图高度
  --maxTurns <num> 最大回合数
  --maxTime <num>  超时时间（毫秒）
  --qtableP1 <path> Q表文件路径（可选，用于玩家1的strategy_rl或qlearning_rl）
  --qtableP2 <path> Q表文件路径（可选，用于玩家2的strategy_rl或qlearning_rl）
  ...              支持 --qtableP1 到 --qtableP10
  --paramsFile <file> 优化参数JSON文件（可选，用于minimax AI）

基准测试选项（所有参数都是必需的）:
  --all           测试所有AI（random,adaptive）
  --ais <list>    指定AI列表，逗号分隔（如: random,adaptive）
  --games <num>   每个AI的测试游戏数量
  --validation <num> 每个AI的验证游戏数量
  --against <types> 对手AI类型，逗号分隔
  --mapSizes <sizes> 地图尺寸，格式: 20x20,30x30
  --players <counts> 玩家数量，逗号分隔
  --maxTurns <num> 最大回合数
  --maxTime <num> 超时时间（毫秒）

示例:
  # 评估命令
  node src/training/train.js evaluate \\
    --ai adaptive \\
    --games 100 \\
    --validation 50 \\
    --against random \\
    --mapSizes 20x20,30x30 \\
    --players 2,3 \\
    --maxTurns 500 \\
    --maxTime 30000

  # 对比命令（1v1）
  node src/training/train.js compare \\
    --ai1 adaptive \\
    --ai2 random \\
    --games 50 \\
    --width 25 \\
    --height 25 \\
    --maxTurns 500 \\
    --maxTime 30000

  # 多玩家对比（1v3）
  node src/training/train.js compare \\
    --ai1 strategy_rl \\
    --ai2 adaptive \\
    --ai3 adaptive \\
    --ai4 adaptive \\
    --games 200 \\
    --width 15 \\
    --height 15 \\
    --maxTurns 5000 \\
    --maxTime 30000 \\
    --qtableP1 qtable-1.json

  # 使用优化参数对比Minimax vs Adaptive
  node src/training/train.js compare \\
    --ai1 minimax \\
    --ai2 adaptive \\
    --games 50 \\
    --width 25 \\
    --height 25 \\
    --maxTurns 500 \\
    --maxTime 30000 \\
    --paramsFile evolved_params.json

  # 基准测试命令
  node src/training/train.js benchmark \\
    --all \\
    --games 50 \\
    --validation 25 \\
    --against random \\
    --mapSizes 20x20,30x30 \\
    --players 2,3 \\
    --maxTurns 500 \\
    --maxTime 30000

  # 进化算法优化Minimax参数
  node src/training/train.js evolve \\
    --populationSize 20 \\
    --generations 10 \\
    --gamesPerEvaluation 10 \\
    --mutationRate 0.1 \\
    --crossoverRate 0.7 \\
    --eliteCount 2 \\
    --opponentAI adaptive \\
    --maxTurns 500 \\
    --maxTime 30000 \\
    --output evolved_params.json
`)
}

main()

