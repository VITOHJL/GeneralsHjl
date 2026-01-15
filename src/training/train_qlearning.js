#!/usr/bin/env node

/**
 * QLearningAI 专用训练脚本
 * 完全独立，不依赖 RLTrainer.js
 * 
 * 使用方法:
 *   node src/training/train_qlearning.js --episodes 1000 --opponent random
 *   node src/training/train_qlearning.js --episodes 3000 --opponent adaptive --loadPath ./qtable-qlearning.json
 */

import GameSimulator from './GameSimulator.js'
import QLearningAI from '../game/ai/QLearningAI.js'
import { createAI } from '../game/ai/index.js'
import fs from 'fs/promises'

const args = process.argv.slice(2)

function parseArgs(args) {
  const options = {}
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--?/, '')
    const value = args[i + 1]
    if (key && value && !value.startsWith('--')) {
      if (['episodes', 'players', 'width', 'height', 'maxTurns', 'maxTime', 'saveInterval', 'logInterval'].includes(key)) {
        options[key] = parseInt(value)
      } else {
        options[key] = value
      }
    }
  }
  
  return options
}

async function loadQTable(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const qTable = JSON.parse(data)
    
    // 清理：只保留 QLearningAI 格式的 key（2段状态_random）
    const cleanedQTable = {}
    for (const [key, value] of Object.entries(qTable)) {
      if (/^\d+_\d+_random$/.test(key)) {
        cleanedQTable[key] = value
      }
    }
    
    console.log(`[INFO] 从 ${filePath} 加载 Q 表: ${Object.keys(cleanedQTable).length} 个有效条目`)
    return cleanedQTable
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`[INFO] Q 表文件不存在，从头开始训练`)
      return {}
    }
    throw error
  }
}

async function saveQTable(filePath, qTable) {
  // 清理：只保存 QLearningAI 格式的 key
  const cleanedQTable = {}
  for (const [key, value] of Object.entries(qTable)) {
    if (/^\d+_\d+_random$/.test(key)) {
      cleanedQTable[key] = value
    }
  }
  
  await fs.writeFile(filePath, JSON.stringify(cleanedQTable, null, 2), 'utf-8')
  console.log(`[INFO] Q 表已保存到 ${filePath}: ${Object.keys(cleanedQTable).length} 个条目`)
}

async function main() {
  const options = parseArgs(args)

  // 默认值
  const config = {
    episodes: options.episodes || 1000,
    players: options.players || 2,
    width: options.width || 10,
    height: options.height || 10,
    maxTurns: options.maxTurns || 500,
    maxTime: options.maxTime || 30000,
    opponent: options.opponent || 'random',
    saveInterval: options.saveInterval || 200,
    logInterval: options.logInterval || 20,
    savePath: options.savePath || './qtable-qlearning.json',
    loadPath: options.loadPath || null
  }

  console.log('='.repeat(60))
  console.log('QLearningAI 训练开始')
  console.log('='.repeat(60))
  console.log(`配置: ${JSON.stringify(config, null, 2)}`)
  console.log('')

  // 加载 Q 表（如果指定了 loadPath）
  let qTable = {}
  if (config.loadPath) {
    qTable = await loadQTable(config.loadPath)
  }

  // 创建 QLearningAI（确保是全新的实例）
  const qLearningAI = new QLearningAI(1, {
    qTable: qTable,
    trainingMode: true,
    epsilon: 0.1,
    epsilonDecay: 0.9995,
    epsilonMin: 0.05,
    learningRate: 0.1,
    discountFactor: 0.95
  })

  console.log(`[INFO] 创建了 QLearningAI 实例`)
  console.log(`[INFO] AI 类型: ${qLearningAI.constructor.name}`)
  console.log(`[INFO] 初始 Q 表大小: ${Object.keys(qLearningAI.qTable).length}`)
  console.log('')

  // 创建模拟器
  const simulator = new GameSimulator({
    maxTurns: config.maxTurns,
    maxTime: config.maxTime,
    logLevel: 'silent'
  })

  // 统计
  const stats = {
    wins: 0,
    losses: 0,
    draws: 0,
    timeouts: 0,
    winTurns: [],
    lossTurns: [],
    totalReward: 0
  }

  // 训练循环
  const startTime = Date.now()
  
  for (let episode = 1; episode <= config.episodes; episode++) {
    // 创建对手 AI
    const opponentAI = createAI(config.opponent, 2)

    // 运行游戏
    const result = await simulator.runGame({
      width: config.width,
      height: config.height,
      players: config.players,
      aiConfigs: {
        1: { type: 'ai', aiInstance: qLearningAI },
        2: { type: 'ai', aiInstance: opponentAI }
      }
    })

    // 更新统计
    const isWinner = result.stats.winner === 1
    const isResolvedByMaxTurns = result.stats.resolvedByMaxTurns

    if (result.stats.timeout) {
      stats.timeouts++
    } else if (result.stats.winner === null) {
      stats.draws++
    } else if (isWinner) {
      stats.wins++
      stats.winTurns.push(result.stats.turns)
    } else {
      stats.losses++
      stats.lossTurns.push(result.stats.turns)
    }

    // 更新 Q 值（只有在非 maxTurns 判定的情况下）
    if (!isResolvedByMaxTurns) {
      const finalReward = qLearningAI.calculateFinalReward(result.stats, isWinner)
      qLearningAI.updateQValues(finalReward)
      stats.totalReward += finalReward
    }

    // 定期保存
    if (episode % config.saveInterval === 0) {
      await saveQTable(config.savePath, qLearningAI.saveQTable())
    }

    // 定期输出进度
    if (episode % config.logInterval === 0) {
      const winRate = stats.wins / episode * 100
      const avgReward = stats.totalReward / episode
      const qStats = qLearningAI.getQTableStats()
      
      console.log(
        `Episodes: ${episode} | ` +
        `胜率: ${winRate.toFixed(1)}% | ` +
        `胜利: ${stats.wins}, 失败: ${stats.losses}, 平局: ${stats.draws}, 超时: ${stats.timeouts} | ` +
        `平均奖励: ${avgReward.toFixed(2)} | ` +
        `Q表大小: ${qStats.size} | ` +
        `Q值范围: [${qStats.minQ.toFixed(2)}, ${qStats.maxQ.toFixed(2)}], 平均: ${qStats.avgQ.toFixed(2)} | ` +
        `ε: ${qLearningAI.epsilon.toFixed(3)}`
      )
    }
  }

  // 最终保存
  await saveQTable(config.savePath, qLearningAI.saveQTable())

  // 输出最终统计
  const duration = Date.now() - startTime
  const winRate = stats.wins / config.episodes * 100
  const avgReward = stats.totalReward / config.episodes
  const qStats = qLearningAI.getQTableStats()

  console.log('')
  console.log('='.repeat(60))
  console.log('训练完成')
  console.log('='.repeat(60))
  console.log(`Episodes: ${config.episodes}`)
  console.log(`胜率: ${winRate.toFixed(1)}%`)
  console.log(`胜利: ${stats.wins}, 失败: ${stats.losses}, 平局: ${stats.draws}, 超时: ${stats.timeouts}`)
  
  if (stats.winTurns.length > 0) {
    const avgWinTurns = stats.winTurns.reduce((a, b) => a + b, 0) / stats.winTurns.length
    const minWinTurns = Math.min(...stats.winTurns)
    const maxWinTurns = Math.max(...stats.winTurns)
    console.log(`胜利回合: 平均 ${avgWinTurns.toFixed(1)}, 最短 ${minWinTurns}, 最长 ${maxWinTurns}`)
  }
  
  if (stats.lossTurns.length > 0) {
    const avgLossTurns = stats.lossTurns.reduce((a, b) => a + b, 0) / stats.lossTurns.length
    const minLossTurns = Math.min(...stats.lossTurns)
    const maxLossTurns = Math.max(...stats.lossTurns)
    console.log(`失败回合: 平均 ${avgLossTurns.toFixed(1)}, 最短 ${minLossTurns}, 最长 ${maxLossTurns}`)
  }
  
  console.log(`平均奖励: ${avgReward.toFixed(2)}`)
  console.log(`Q表大小: ${qStats.size}`)
  console.log(`Q值范围: [${qStats.minQ.toFixed(2)}, ${qStats.maxQ.toFixed(2)}], 平均: ${qStats.avgQ.toFixed(2)}`)
  console.log(`最终ε: ${qLearningAI.epsilon.toFixed(3)}`)
  console.log(`耗时: ${(duration / 1000).toFixed(1)}秒`)
  console.log(`Q表已保存到: ${config.savePath}`)
  console.log('='.repeat(60))
}

main().catch(error => {
  console.error('错误:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})
