/**
 * AI类型索引
 * 方便扩展和管理不同的AI
 */
import RandomAI from './RandomAI.js'
import ExpansionAI from './ExpansionAI.js'
import AggressiveAI from './AggressiveAI.js'
import BalancedAI from './BalancedAI.js'

export const AI_TYPES = {
  RANDOM: 'random',
  EXPANSION: 'expansion',
  AGGRESSIVE: 'aggressive',
  BALANCED: 'balanced'
}

export const AI_CLASSES = {
  [AI_TYPES.RANDOM]: RandomAI,
  [AI_TYPES.EXPANSION]: ExpansionAI,
  [AI_TYPES.AGGRESSIVE]: AggressiveAI,
  [AI_TYPES.BALANCED]: BalancedAI
}

/**
 * 获取AI的显示名称
 */
export function getAIName(aiType) {
  const names = {
    [AI_TYPES.RANDOM]: '随机AI',
    [AI_TYPES.EXPANSION]: '扩张AI',
    [AI_TYPES.AGGRESSIVE]: '攻击AI',
    [AI_TYPES.BALANCED]: '平衡AI'
  }
  return names[aiType] || aiType
}

/**
 * 创建AI实例
 */
export function createAI(aiType, playerId, difficulty = 'easy') {
  const AIClass = AI_CLASSES[aiType]
  if (!AIClass) {
    console.warn(`Unknown AI type: ${aiType}, using RandomAI`)
    return new RandomAI(playerId, difficulty)
  }
  return new AIClass(playerId, difficulty)
}

