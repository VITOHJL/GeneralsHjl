#!/usr/bin/env node

/**
 * AI锦标赛脚本
 * 让所有5种AI（RANDOM, ADAPTIVE, MINIMAX, Q-LEARNING, STRATEGYRL）同台竞技
 * 在不同地图尺寸上各比拼1000局，记录各自的输赢场次
 */

import GameSimulator from './GameSimulator.js'
import { createAI } from '../game/ai/index.js'
import { AI_TYPES } from '../game/ai/index.js'
import { readFileSync } from 'fs'
import { join } from 'path'

// AI配置
const AI_CONFIGS = [
  { type: AI_TYPES.RANDOM, name: 'RANDOM', qtablePath: null },
  { type: AI_TYPES.ADAPTIVE, name: 'ADAPTIVE', qtablePath: null },
  { type: AI_TYPES.MINIMAX, name: 'MINIMAX', qtablePath: null },
  { type: AI_TYPES.QLEARNING_RL, name: 'Q-LEARNING', qtablePath: './qtable-qlearning-clean.json' },

  { type: AI_TYPES.STRATEGY_RL, name: 'STRATEGYRL', qtablePath: './qtable-1v1-seq3.json' } // 或使用 './qtable-1v3-seq4.json' 用于多人场景
]

// 地图尺寸配置
const MAP_SIZES = [
  { width: 15, height: 15, name: '15x15' },
  { width: 20, height: 20, name: '20x20' },
  { width: 25, height: 25, name: '25x25' }
]

// 游戏配置
const GAMES_PER_MAP = 300
const MAX_TURNS = 5000
const MAX_TIME = 60000 // 60秒

/**
 * 加载Q-table文件
 */
function loadQTable(filePath) {
  if (!filePath) return null
  
  try {
    const fullPath = join(process.cwd(), filePath)
    const data = readFileSync(fullPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.warn(`警告: 无法加载Q-table文件 ${filePath}: ${error.message}`)
    return null
  }
}

/**
 * 运行锦标赛
 */
async function runTournament() {
  console.log('='.repeat(80))
  console.log('AI锦标赛')
  console.log('='.repeat(80))
  console.log(`参赛AI: ${AI_CONFIGS.map(c => c.name).join(', ')}`)
  console.log(`地图尺寸: ${MAP_SIZES.map(m => m.name).join(', ')}`)
  console.log(`每个地图尺寸游戏数: ${GAMES_PER_MAP}`)
  console.log(`总游戏数: ${MAP_SIZES.length * GAMES_PER_MAP}`)
  console.log(`最大回合数: ${MAX_TURNS}, 超时时间: ${MAX_TIME}ms`)
  console.log('='.repeat(80))
  console.log()

  // 初始化统计结果
  // 结构: results[mapSize][aiName] = { wins: 0, losses: 0, draws: 0, timeouts: 0, thinkTimes: [] }
  const results = {}
  for (const mapSize of MAP_SIZES) {
    results[mapSize.name] = {}
    for (const aiConfig of AI_CONFIGS) {
      results[mapSize.name][aiConfig.name] = {
        wins: 0,
        losses: 0,
        draws: 0,
        timeouts: 0,
        total: 0,
        thinkTimes: [] // 存储每次决策的耗时（毫秒）
      }
    }
  }

  // 创建游戏模拟器
  const simulator = new GameSimulator({
    maxTurns: MAX_TURNS,
    maxTime: MAX_TIME,
    logLevel: 'silent'
  })

  // 为每个地图尺寸运行游戏
  for (const mapSize of MAP_SIZES) {
    console.log(`\n开始 ${mapSize.name} 地图的比赛...`)
    console.log('='.repeat(80))
    
    const startTime = Date.now()
    
    // 预加载Q-tables（如果存在）
    const qTables = {}
    for (const aiConfig of AI_CONFIGS) {
      if (aiConfig.qtablePath) {
        const qTable = loadQTable(aiConfig.qtablePath)
        if (qTable) {
          qTables[aiConfig.name] = qTable
          console.log(`已加载 ${aiConfig.name} 的Q-table: ${aiConfig.qtablePath}`)
        }
      }
    }
    
    // 运行GAMES_PER_MAP局游戏
    for (let gameNum = 0; gameNum < GAMES_PER_MAP; gameNum++) {
      // 显示进度
      if ((gameNum + 1) % 50 === 0 || gameNum === 0) {
        const progress = ((gameNum + 1) / GAMES_PER_MAP * 100).toFixed(1)
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        process.stdout.write(`\r进度: ${gameNum + 1}/${GAMES_PER_MAP} (${progress}%) | 已用时间: ${elapsed}s`)
      }

      // 创建AI配置
      const aiConfigs = {}
      for (let playerId = 1; playerId <= AI_CONFIGS.length; playerId++) {
        const aiConfig = AI_CONFIGS[playerId - 1]
        const options = {}
        
        // 如果该AI有Q-table，加载它
        if (qTables[aiConfig.name]) {
          options.qTable = qTables[aiConfig.name]
          options.trainingMode = false
          options.epsilon = 0
        }
        
        // 创建AI实例
        const aiInstance = createAI(aiConfig.type, playerId, options)
        aiConfigs[playerId] = {
          type: 'ai',
          aiInstance: aiInstance
        }
      }

      // 运行游戏
      const gameConfig = {
        width: mapSize.width,
        height: mapSize.height,
        players: AI_CONFIGS.length,
        aiConfigs
      }

      const result = await simulator.runGame(gameConfig)
      const stats = result.stats
      const winner = stats.winner

      // 收集思考时间数据
      if (stats.thinkTimes) {
        for (let playerId = 1; playerId <= AI_CONFIGS.length; playerId++) {
          const aiConfig = AI_CONFIGS[playerId - 1]
          const thinkTimes = stats.thinkTimes[playerId] || []
          if (thinkTimes.length > 0) {
            results[mapSize.name][aiConfig.name].thinkTimes.push(...thinkTimes)
          }
        }
      }

      // 更新统计
      if (stats.timeout) {
        // 超时：所有AI都记录为超时
        for (const aiConfig of AI_CONFIGS) {
          results[mapSize.name][aiConfig.name].timeouts++
          results[mapSize.name][aiConfig.name].total++
        }
      } else if (winner !== null && winner >= 1 && winner <= AI_CONFIGS.length) {
        // 有获胜者
        const winnerConfig = AI_CONFIGS[winner - 1]
        results[mapSize.name][winnerConfig.name].wins++
        results[mapSize.name][winnerConfig.name].total++
        
        // 其他AI记录为失败
        for (let i = 0; i < AI_CONFIGS.length; i++) {
          if (i !== winner - 1) {
            results[mapSize.name][AI_CONFIGS[i].name].losses++
            results[mapSize.name][AI_CONFIGS[i].name].total++
          }
        }
      } else {
        // 平局
        for (const aiConfig of AI_CONFIGS) {
          results[mapSize.name][aiConfig.name].draws++
          results[mapSize.name][aiConfig.name].total++
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n${mapSize.name} 地图比赛完成！用时: ${elapsed}秒`)
  }

  // 输出最终统计结果
  console.log('\n' + '='.repeat(80))
  console.log('锦标赛最终结果')
  console.log('='.repeat(80))
  
  // 按地图尺寸输出
  for (const mapSize of MAP_SIZES) {
    console.log(`\n${mapSize.name} 地图:`)
    console.log('-'.repeat(80))
    
    // 按胜率排序
    const aiStats = Object.entries(results[mapSize.name])
      .map(([name, stats]) => {
        const thinkTimes = stats.thinkTimes || []
        let avgThinkTime = 0
        let minThinkTime = 0
        let maxThinkTime = 0
        
        if (thinkTimes.length > 0) {
          // 使用循环计算，避免展开运算符导致栈溢出
          let sum = 0
          minThinkTime = thinkTimes[0]
          maxThinkTime = thinkTimes[0]
          
          for (let i = 0; i < thinkTimes.length; i++) {
            const time = thinkTimes[i]
            sum += time
            if (time < minThinkTime) minThinkTime = time
            if (time > maxThinkTime) maxThinkTime = time
          }
          
          avgThinkTime = sum / thinkTimes.length
        }
        
        return {
          name,
          ...stats,
          winRate: stats.total > 0 ? (stats.wins / stats.total * 100) : 0,
          avgThinkTime,
          minThinkTime,
          maxThinkTime,
          thinkCount: thinkTimes.length
        }
      })
      .sort((a, b) => b.winRate - a.winRate)
    
    console.log(`${'AI名称'.padEnd(15)} ${'胜场'.padEnd(8)} ${'负场'.padEnd(8)} ${'平局'.padEnd(8)} ${'超时'.padEnd(8)} ${'总场次'.padEnd(8)} ${'胜率'.padEnd(10)} ${'平均思考(ms)'.padEnd(15)} ${'最小(ms)'.padEnd(10)} ${'最大(ms)'.padEnd(10)}`)
    console.log('-'.repeat(120))
    
    for (const stat of aiStats) {
      console.log(
        `${stat.name.padEnd(15)} ` +
        `${stat.wins.toString().padEnd(8)} ` +
        `${stat.losses.toString().padEnd(8)} ` +
        `${stat.draws.toString().padEnd(8)} ` +
        `${stat.timeouts.toString().padEnd(8)} ` +
        `${stat.total.toString().padEnd(8)} ` +
        `${stat.winRate.toFixed(2)}%`.padEnd(10) +
        `${stat.thinkCount > 0 ? stat.avgThinkTime.toFixed(2) : 'N/A'}`.padEnd(15) +
        `${stat.thinkCount > 0 ? stat.minThinkTime.toFixed(2) : 'N/A'}`.padEnd(10) +
        `${stat.thinkCount > 0 ? stat.maxThinkTime.toFixed(2) : 'N/A'}`
      )
    }
  }
  
  // 汇总统计（所有地图）
  console.log('\n' + '='.repeat(80))
  console.log('汇总统计（所有地图）:')
  console.log('='.repeat(80))
  
  const overallStats = {}
  for (const aiConfig of AI_CONFIGS) {
    overallStats[aiConfig.name] = {
      wins: 0,
      losses: 0,
      draws: 0,
      timeouts: 0,
      total: 0,
      thinkTimes: []
    }
    
    for (const mapSize of MAP_SIZES) {
      const stats = results[mapSize.name][aiConfig.name]
      overallStats[aiConfig.name].wins += stats.wins
      overallStats[aiConfig.name].losses += stats.losses
      overallStats[aiConfig.name].draws += stats.draws
      overallStats[aiConfig.name].timeouts += stats.timeouts
      overallStats[aiConfig.name].total += stats.total
      overallStats[aiConfig.name].thinkTimes.push(...(stats.thinkTimes || []))
    }
  }
  
  const overallSorted = Object.entries(overallStats)
    .map(([name, stats]) => {
      const thinkTimes = stats.thinkTimes || []
      let avgThinkTime = 0
      let minThinkTime = 0
      let maxThinkTime = 0
      
      if (thinkTimes.length > 0) {
        // 使用循环计算，避免展开运算符导致栈溢出
        let sum = 0
        minThinkTime = thinkTimes[0]
        maxThinkTime = thinkTimes[0]
        
        for (let i = 0; i < thinkTimes.length; i++) {
          const time = thinkTimes[i]
          sum += time
          if (time < minThinkTime) minThinkTime = time
          if (time > maxThinkTime) maxThinkTime = time
        }
        
        avgThinkTime = sum / thinkTimes.length
      }
      
      return {
        name,
        ...stats,
        winRate: stats.total > 0 ? (stats.wins / stats.total * 100) : 0,
        avgThinkTime,
        minThinkTime,
        maxThinkTime,
        thinkCount: thinkTimes.length
      }
    })
    .sort((a, b) => b.winRate - a.winRate)
  
  console.log(`${'AI名称'.padEnd(15)} ${'胜场'.padEnd(8)} ${'负场'.padEnd(8)} ${'平局'.padEnd(8)} ${'超时'.padEnd(8)} ${'总场次'.padEnd(8)} ${'胜率'.padEnd(10)} ${'平均思考(ms)'.padEnd(15)} ${'最小(ms)'.padEnd(10)} ${'最大(ms)'.padEnd(10)}`)
  console.log('-'.repeat(120))
  
  for (const stat of overallSorted) {
    console.log(
      `${stat.name.padEnd(15)} ` +
      `${stat.wins.toString().padEnd(8)} ` +
      `${stat.losses.toString().padEnd(8)} ` +
      `${stat.draws.toString().padEnd(8)} ` +
      `${stat.timeouts.toString().padEnd(8)} ` +
      `${stat.total.toString().padEnd(8)} ` +
      `${stat.winRate.toFixed(2)}%`.padEnd(10) +
      `${stat.thinkCount > 0 ? stat.avgThinkTime.toFixed(2) : 'N/A'}`.padEnd(15) +
      `${stat.thinkCount > 0 ? stat.minThinkTime.toFixed(2) : 'N/A'}`.padEnd(10) +
      `${stat.thinkCount > 0 ? stat.maxThinkTime.toFixed(2) : 'N/A'}`
    )
  }
  
  console.log('='.repeat(80))
  
  // 保存结果到JSON文件
  const fs = await import('fs/promises')
  const outputPath = './tournament_results.json'
  // 准备输出数据（包含思考时间统计）
  // 使用安全的循环计算，避免栈溢出
  function calculateThinkTimeStats(thinkTimes) {
    if (!thinkTimes || thinkTimes.length === 0) {
      return { average: 0, min: 0, max: 0, count: 0 }
    }
    
    let sum = 0
    let min = thinkTimes[0]
    let max = thinkTimes[0]
    
    for (let i = 0; i < thinkTimes.length; i++) {
      const time = thinkTimes[i]
      sum += time
      if (time < min) min = time
      if (time > max) max = time
    }
    
    return {
      average: sum / thinkTimes.length,
      min: min,
      max: max,
      count: thinkTimes.length
    }
  }
  
  const outputResults = {}
  for (const mapSize of MAP_SIZES) {
    outputResults[mapSize.name] = {}
    for (const aiConfig of AI_CONFIGS) {
      const stats = results[mapSize.name][aiConfig.name]
      const thinkTimes = stats.thinkTimes || []
      const thinkTimeStats = calculateThinkTimeStats(thinkTimes)
      
      outputResults[mapSize.name][aiConfig.name] = {
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        timeouts: stats.timeouts,
        total: stats.total,
        winRate: stats.total > 0 ? (stats.wins / stats.total * 100) : 0,
        thinkTime: thinkTimeStats
      }
    }
  }
  
  const outputOverall = {}
  for (const aiConfig of AI_CONFIGS) {
    const stats = overallStats[aiConfig.name]
    const thinkTimes = stats.thinkTimes || []
    const thinkTimeStats = calculateThinkTimeStats(thinkTimes)
    
    outputOverall[aiConfig.name] = {
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      timeouts: stats.timeouts,
      total: stats.total,
      winRate: stats.total > 0 ? (stats.wins / stats.total * 100) : 0,
      thinkTime: thinkTimeStats
    }
  }
  
  const outputData = {
    timestamp: new Date().toISOString(),
    config: {
      aiConfigs: AI_CONFIGS.map(c => ({ name: c.name, type: c.type })),
      mapSizes: MAP_SIZES,
      gamesPerMap: GAMES_PER_MAP,
      maxTurns: MAX_TURNS,
      maxTime: MAX_TIME
    },
    results: outputResults,
    overall: outputOverall
  }
  
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8')
  console.log(`\n结果已保存到: ${outputPath}`)
}

// 运行锦标赛
runTournament().catch(error => {
  console.error('错误:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})
