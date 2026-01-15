#!/usr/bin/env node

/**
 * RL训练命令行工具
 * 
 * 使用方法:
 *   node src/training/train_rl.js --agent strategy --episodes 1000 --mode self-play
 *   node src/training/train_rl.js --agent strategy --episodes 3000 --players 4 --mode against-fixed --opponent adaptive
 */

import RLTrainer from './RLTrainer.js'

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

async function main() {
  const options = parseArgs(args)

  // 默认值
  const config = {
    agent: options.agent || 'strategy',
    episodes: options.episodes || 1000,
    players: options.players || 2,
    width: options.width || 20,
    height: options.height || 20,
    maxTurns: options.maxTurns || 500,
    maxTime: options.maxTime || 30000,
    mode: options.mode || 'self-play',
    opponent: options.opponent || 'random',
    saveInterval: options.saveInterval || 100,
    logInterval: options.logInterval || 10,
    savePath: options.savePath || './qtable.json'
  }

  // 调试信息
  console.log(`[DEBUG] 解析后的 options.agent: "${options.agent}"`)
  console.log(`[DEBUG] 最终使用的 config.agent: "${config.agent}"`)

  const trainer = new RLTrainer(config)
  await trainer.train()
}

main().catch(error => {
  console.error('错误:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})


