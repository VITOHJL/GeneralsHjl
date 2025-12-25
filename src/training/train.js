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
 * 对比两个AI
 */
async function handleCompare(args) {
  const options = parseArgs(args)
  
  // 必需参数检查
  if (!options.ai1) {
    throw new Error('错误: 必须提供 --ai1 参数')
  }
  if (!options.ai2) {
    throw new Error('错误: 必须提供 --ai2 参数')
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
  
  const ai1 = options.ai1
  const ai2 = options.ai2
  const games = parseInt(options.games)
  const width = parseInt(options.width)
  const height = parseInt(options.height)
  const maxTurns = parseInt(options.maxTurns)
  const maxTime = parseInt(options.maxTime)

  console.log(`\n对比测试: ${ai1} vs ${ai2}`)
  console.log(`游戏场数: ${games}`)
  console.log(`地图尺寸: ${width}x${height}`)
  console.log(`最大回合数: ${maxTurns}, 超时时间: ${maxTime}ms`)

  const simulator = new GameSimulator({
    maxTurns,
    maxTime,
    logLevel: 'silent'
  })

  const results = {
    ai1: { wins: 0, total: 0, scores: [] },
    ai2: { wins: 0, total: 0, scores: [] },
    draws: 0
  }

  for (let i = 0; i < games; i++) {
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r进度: ${i + 1}/${games}`)
    }

    const gameConfig = {
      width,
      height,
      players: 2,
      aiConfigs: {
        1: { type: 'ai', aiType: ai1 },
        2: { type: 'ai', aiType: ai2 }
      }
    }

    const result = await simulator.runGame(gameConfig)
    const winner = result.stats.winner

    if (winner === 1) {
      results.ai1.wins++
      results.ai1.scores.push(result.stats.finalMetrics[1]?.score || 0)
    } else if (winner === 2) {
      results.ai2.wins++
      results.ai2.scores.push(result.stats.finalMetrics[2]?.score || 0)
    } else {
      results.draws++
    }

    results.ai1.total++
    results.ai2.total++
  }

  console.log('\n' + '='.repeat(60))
  console.log('对比结果:')
  console.log('='.repeat(60))
  console.log(`${ai1}:`)
  console.log(`  胜场: ${results.ai1.wins}/${results.ai1.total}`)
  console.log(`  胜率: ${(results.ai1.wins / results.ai1.total * 100).toFixed(1)}%`)
  if (results.ai1.scores.length > 0) {
    const avgScore = results.ai1.scores.reduce((a, b) => a + b, 0) / results.ai1.scores.length
    console.log(`  平均分数: ${avgScore.toFixed(2)}`)
  }
  console.log(`\n${ai2}:`)
  console.log(`  胜场: ${results.ai2.wins}/${results.ai2.total}`)
  console.log(`  胜率: ${(results.ai2.wins / results.ai2.total * 100).toFixed(1)}%`)
  if (results.ai2.scores.length > 0) {
    const avgScore = results.ai2.scores.reduce((a, b) => a + b, 0) / results.ai2.scores.length
    console.log(`  平均分数: ${avgScore.toFixed(2)}`)
  }
  console.log(`\n平局: ${results.draws}`)
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
 * 解析命令行参数
 */
function parseArgs(args) {
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--?/, '')
    const value = args[i + 1]
    if (key && value) {
      options[key] = value
    } else if (key && (key === 'verbose' || key === 'quiet' || key === 'all')) {
      options[key] = true
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
  --ai1 <type>     第一个AI类型（玩家1）
  --ai2 <type>     第二个AI类型（玩家2）
  --games <num>    对战游戏数量
  --width <num>    地图宽度
  --height <num>   地图高度
  --maxTurns <num> 最大回合数
  --maxTime <num>  超时时间（毫秒）

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

  # 对比命令
  node src/training/train.js compare \\
    --ai1 adaptive \\
    --ai2 random \\
    --games 50 \\
    --width 25 \\
    --height 25 \\
    --maxTurns 500 \\
    --maxTime 30000

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
`)
}

main()

