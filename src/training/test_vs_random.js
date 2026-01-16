#!/usr/bin/env node

/**
 * 测试各个AI与RANDOM进行1v1对战
 * 在15x15地图上，每个AI打500局，记录胜率
 * 
 * 使用方法:
 *   node src/training/test_vs_random.js
 *   node src/training/test_vs_random.js --games 500 --map-size 15
 */

import GameSimulator from './GameSimulator.js'
import { createAI, AI_TYPES } from '../game/ai/index.js'
import { readFileSync } from 'fs'
import { join } from 'path'

// 默认配置
const DEFAULT_CONFIG = {
  games: 100,
  mapSize: 10,
  maxTurns: 500,
  maxTime: 60000
}

// 要测试的AI列表（不包括RANDOM）
const AI_LIST = [
  { type: AI_TYPES.ADAPTIVE, name: 'ADAPTIVE', qTablePath: null },
  { type: AI_TYPES.MINIMAX, name: 'MINIMAX', qTablePath: null },
  { type: AI_TYPES.STRATEGY_RL, name: 'STRATEGY_RL', qTablePath: './qtable-1v1-seq3.json' },
  { type: AI_TYPES.QLEARNING_RL, name: 'QLEARNING_RL', qTablePath: './qtable-qlearning-clean.json' }
]

/**
 * 加载Q-table文件（Node.js环境）
 */
function loadQTableSync(filePath) {
  try {
    const fullPath = join(process.cwd(), filePath)
    const content = readFileSync(fullPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.warn(`警告: 无法加载Q-table文件 ${filePath}: ${error.message}`)
    return null
  }
}

/**
 * 运行单场游戏
 */
async function runSingleGame(simulator, aiType, aiName, qTable, gameNumber) {
  // 创建AI实例（使用预加载的qTable）
  const testAI = createAI(aiType, 1, qTable ? { qTable } : {})
  const randomAI = createAI(AI_TYPES.RANDOM, 2, {})
  
  // 游戏配置
  const gameConfig = {
    width: DEFAULT_CONFIG.mapSize,
    height: DEFAULT_CONFIG.mapSize,
    players: 2,
    aiConfigs: {
      1: { type: 'ai', aiInstance: testAI },
      2: { type: 'ai', aiInstance: randomAI }
    }
  }
  
  // 运行游戏
  const result = await simulator.runGame(gameConfig)
  
  // 判断胜负
  let win = false
  let loss = false
  let draw = false
  let timeout = false
  
  if (result.stats.timeout) {
    timeout = true
    // 超时情况下，根据最终人口判断
    if (result.stats.finalMetrics && result.stats.finalMetrics[1] && result.stats.finalMetrics[2]) {
      const player1Pop = result.stats.finalMetrics[1].population || 0
      const player2Pop = result.stats.finalMetrics[2].population || 0
      if (player1Pop > player2Pop) {
        win = true
      } else if (player1Pop < player2Pop) {
        loss = true
      } else {
        draw = true
      }
    }
  } else if (result.stats.winner === 1) {
    win = true
  } else if (result.stats.winner === 2) {
    loss = true
  } else if (result.stats.winner === null) {
    draw = true
  }
  
  return {
    win,
    loss,
    draw,
    timeout,
    turns: result.stats.turns,
    duration: result.stats.duration
  }
}

/**
 * 测试单个AI
 */
async function testAI(simulator, aiConfig) {
  const { type, name, qTable } = aiConfig
  console.log(`\n测试 ${name} vs RANDOM...`)
  
  const stats = {
    wins: 0,
    losses: 0,
    draws: 0,
    timeouts: 0,
    total: 0,
    totalTurns: 0,
    totalDuration: 0
  }
  
  const startTime = Date.now()
  
  // 运行指定数量的游戏
  for (let i = 0; i < DEFAULT_CONFIG.games; i++) {
    const result = await runSingleGame(simulator, type, name, qTable, i + 1)
    
    if (result.win) stats.wins++
    if (result.loss) stats.losses++
    if (result.draw) stats.draws++
    if (result.timeout) stats.timeouts++
    stats.total++
    stats.totalTurns += result.turns
    stats.totalDuration += result.duration
    
    // 每50局显示一次进度
    if ((i + 1) % 50 === 0) {
      const winRate = (stats.wins / stats.total * 100).toFixed(2)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`  进度: ${i + 1}/${DEFAULT_CONFIG.games} | 胜率: ${winRate}% | 已用时: ${elapsed}秒`)
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  stats.winRate = (stats.wins / stats.total * 100)
  stats.avgTurns = stats.totalTurns / stats.total
  stats.avgDuration = stats.totalDuration / stats.total
  
  console.log(`  ${name} 测试完成！用时: ${elapsed}秒`)
  
  return stats
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2)
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--?/, '')
    const value = args[i + 1]
    if (key && value && !value.startsWith('--')) {
      if (['games', 'map-size', 'max-turns', 'max-time'].includes(key)) {
        options[key.replace('-', '')] = parseInt(value)
      }
    }
  }
  
  // 更新配置
  if (options.games) DEFAULT_CONFIG.games = options.games
  if (options.mapsize) DEFAULT_CONFIG.mapSize = options.mapsize
  if (options.maxturns) DEFAULT_CONFIG.maxTurns = options.maxturns
  if (options.maxtime) DEFAULT_CONFIG.maxTime = options.maxtime
  
  console.log('='.repeat(80))
  console.log('AI vs RANDOM 1v1 测试')
  console.log('='.repeat(80))
  console.log(`地图尺寸: ${DEFAULT_CONFIG.mapSize}x${DEFAULT_CONFIG.mapSize}`)
  console.log(`每AI游戏数: ${DEFAULT_CONFIG.games}`)
  console.log(`最大回合: ${DEFAULT_CONFIG.maxTurns}`)
  console.log(`最大时间: ${DEFAULT_CONFIG.maxTime}ms`)
  console.log('='.repeat(80))
  
  // 预先加载所有Q-table（避免在循环中重复加载）
  console.log('正在加载Q-table文件...')
  const aiConfigsWithQTable = []
  for (const aiConfig of AI_LIST) {
    let qTable = null
    if (aiConfig.qTablePath) {
      qTable = loadQTableSync(aiConfig.qTablePath)
      if (qTable) {
        const keyCount = Object.keys(qTable).length
        console.log(`  ✓ ${aiConfig.name}: 已加载 ${keyCount} 个Q值`)
      } else {
        console.warn(`  ✗ ${aiConfig.name}: 无法加载Q-table`)
      }
    }
    aiConfigsWithQTable.push({
      ...aiConfig,
      qTable
    })
  }
  console.log('Q-table加载完成\n')
  
  // 创建模拟器
  const simulator = new GameSimulator({
    maxTurns: DEFAULT_CONFIG.maxTurns,
    maxTime: DEFAULT_CONFIG.maxTime,
    logLevel: 'silent'
  })
  
  // 测试所有AI
  const results = {}
  const overallStartTime = Date.now()
  
  for (const aiConfig of aiConfigsWithQTable) {
    const stats = await testAI(simulator, aiConfig)
    results[aiConfig.name] = stats
  }
  
  const overallElapsed = ((Date.now() - overallStartTime) / 1000).toFixed(1)
  
  // 输出结果
  console.log('\n' + '='.repeat(80))
  console.log('测试结果汇总')
  console.log('='.repeat(80))
  console.log(`${'AI名称'.padEnd(15)} ${'胜场'.padEnd(8)} ${'负场'.padEnd(8)} ${'平局'.padEnd(8)} ${'超时'.padEnd(8)} ${'总场次'.padEnd(8)} ${'胜率'.padEnd(10)} ${'平均回合'.padEnd(12)} ${'平均时长(ms)'.padEnd(15)}`)
  console.log('-'.repeat(100))
  
  // 按胜率排序
  const sortedResults = Object.entries(results).sort((a, b) => b[1].winRate - a[1].winRate)
  
  for (const [name, stats] of sortedResults) {
    console.log(
      `${name.padEnd(15)} ` +
      `${stats.wins.toString().padEnd(8)} ` +
      `${stats.losses.toString().padEnd(8)} ` +
      `${stats.draws.toString().padEnd(8)} ` +
      `${stats.timeouts.toString().padEnd(8)} ` +
      `${stats.total.toString().padEnd(8)} ` +
      `${stats.winRate.toFixed(2)}%`.padEnd(10) +
      `${stats.avgTurns.toFixed(1)}`.padEnd(12) +
      `${stats.avgDuration.toFixed(0)}`
    )
  }
  
  console.log('='.repeat(80))
  console.log(`总用时: ${overallElapsed}秒`)
  console.log('='.repeat(80))
  
  // 保存结果到JSON文件
  const outputData = {
    timestamp: new Date().toISOString(),
    config: {
      mapSize: `${DEFAULT_CONFIG.mapSize}x${DEFAULT_CONFIG.mapSize}`,
      games: DEFAULT_CONFIG.games,
      maxTurns: DEFAULT_CONFIG.maxTurns,
      maxTime: DEFAULT_CONFIG.maxTime
    },
    results: results,
    summary: {
      totalGames: DEFAULT_CONFIG.games * AI_LIST.length,
      totalTime: overallElapsed
    }
  }
  
  const fs = await import('fs/promises')
  const outputPath = './test_vs_random_results.json'
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8')
  console.log(`\n结果已保存到: ${outputPath}`)
}

// 运行主函数
main().catch(error => {
  console.error('错误:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})
