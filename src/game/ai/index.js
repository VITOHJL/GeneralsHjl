/**
 * AI类型索引
 * 方便扩展和管理不同的AI
 */
import RandomAI from './RandomAI.js'
import AdaptiveAI from './AdaptiveAI.js'
import MinimaxAI from './MinimaxAI.js'
import StrategyRLAI from './StrategyRLAI.js'
import QLearningAI from './QLearningAI.js'

// fs 模块缓存（仅在 Node.js 环境可用）
// 在浏览器环境，fs 将保持为 null
let fsCache = null

/**
 * 获取 fs 模块（仅在 Node.js 环境可用）
 * 使用动态导入避免 top-level await
 */
function getFs() {
  if (fsCache !== null) {
    return fsCache
  }
  
  // 尝试动态导入 fs（仅在 Node.js 环境可用）
  try {
    // 使用 require 而不是 import，避免 top-level await
    // 注意：这需要在运行时环境中可用
    if (typeof require !== 'undefined') {
      fsCache = require('fs')
      return fsCache
    }
  } catch (e) {
    // 浏览器环境或加载失败，fs 保持为 null
  }
  
  fsCache = false // 标记为已尝试但不可用
  return null
}

export const AI_TYPES = {
  RANDOM: 'random',
  ADAPTIVE: 'adaptive',
  MINIMAX: 'minimax',
  STRATEGY_RL: 'strategy_rl',
  QLEARNING_RL: 'qlearning_rl'
}

export const AI_CLASSES = {
  [AI_TYPES.RANDOM]: RandomAI,
  [AI_TYPES.ADAPTIVE]: AdaptiveAI,
  [AI_TYPES.MINIMAX]: MinimaxAI,
  [AI_TYPES.STRATEGY_RL]: StrategyRLAI,
  [AI_TYPES.QLEARNING_RL]: QLearningAI
}

/**
 * 获取AI的显示名称
 */
export function getAIName(aiType) {
  const names = {
    [AI_TYPES.RANDOM]: '随机AI',
    [AI_TYPES.ADAPTIVE]: '自适应AI',
    [AI_TYPES.MINIMAX]: 'Minimax AI',
    [AI_TYPES.STRATEGY_RL]: '策略RL AI',
    [AI_TYPES.QLEARNING_RL]: 'Q-Learning AI'
  }
  return names[aiType] || aiType
}

/**
 * 加载 Q 表文件（同步，仅 Node.js 环境）
 * 注意：此函数仅在 Node.js 环境可用
 */
function loadQTableSync(filePath) {
  const fs = getFs()
  if (!fs || typeof fs.readFileSync !== 'function') {
    // fs 不可用（浏览器环境）
    console.warn(`无法加载 Q 表文件 ${filePath}: fs 模块不可用`)
    return null
  }
  
  try {
    const qTableData = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(qTableData)
  } catch (error) {
    console.warn(`无法读取 Q 表文件 ${filePath}:`, error.message)
    return null
  }
}

/**
 * 异步加载 Q 表文件（浏览器环境）
 * @param {string} url - Q 表文件的 URL 路径（相对于 public 目录）
 * @returns {Promise<Object|null>} Q 表对象或 null
 */
export async function loadQTableAsync(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`无法加载 Q 表文件 ${url}: HTTP ${response.status}`)
      return null
    }
    const qTable = await response.json()
    return qTable
  } catch (error) {
    console.warn(`无法读取 Q 表文件 ${url}:`, error.message)
    return null
  }
}

/**
 * 创建AI实例
 * @param {string} aiType - AI 类型
 * @param {number} playerId - 玩家 ID
 * @param {Object|string} options - 选项对象或难度字符串（旧格式）
 * @returns {Object} AI 实例
 */
export function createAI(aiType, playerId, options = {}) {
  // 如果options是字符串（旧格式），转换为对象
  const opts = typeof options === 'string' ? { difficulty: options } : options
  
  // 如果是 RL AI 且指定了 Q 表文件路径，尝试加载（仅 Node.js 环境）
  if ((aiType === AI_TYPES.STRATEGY_RL || aiType === AI_TYPES.QLEARNING_RL) && opts.qTablePath) {
    const loadedQTable = loadQTableSync(opts.qTablePath)
    if (loadedQTable) {
      opts.qTable = loadedQTable
      // 关闭训练模式，使用学到的策略
      opts.trainingMode = false
      opts.epsilon = 0
    } else {
      // 如果加载失败，使用空 Q 表或已有的 qTable
      opts.qTable = opts.qTable || {}
    }
  }
  
  // 如果已经提供了 qTable（浏览器环境通过异步加载传入），设置训练模式
  if ((aiType === AI_TYPES.STRATEGY_RL || aiType === AI_TYPES.QLEARNING_RL) && opts.qTable) {
    opts.trainingMode = false
    opts.epsilon = 0
  }
  
  const AIClass = AI_CLASSES[aiType]
  if (!AIClass) {
    console.warn(`Unknown AI type: ${aiType}, using RandomAI`)
    return new RandomAI(playerId, opts.difficulty || 'easy')
  }
  
  // 如果AI类支持options参数，传递options；否则传递difficulty
  if (AIClass.prototype.constructor.length > 2) {
    return new AIClass(playerId, opts)
  } else {
    return new AIClass(playerId, opts.difficulty || 'easy')
  }
}

