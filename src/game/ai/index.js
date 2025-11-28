/**
 * AI类型索引
 * 方便扩展和管理不同的AI
 */
import RandomAI from './RandomAI.js'
import AdaptiveAI from './AdaptiveAI.js'

export const AI_TYPES = {
  RANDOM: 'random',
  ADAPTIVE: 'adaptive'
}

export const AI_CLASSES = {
  [AI_TYPES.RANDOM]: RandomAI,
  [AI_TYPES.ADAPTIVE]: AdaptiveAI
}

/**
 * 获取AI的显示名称
 */
export function getAIName(aiType) {
  const names = {
    [AI_TYPES.RANDOM]: '随机AI',
    [AI_TYPES.ADAPTIVE]: '自适应AI'
  }
  return names[aiType] || aiType
}

/**
 * 创建AI实例
 */
export function createAI(aiType, playerId) {
  const AIClass = AI_CLASSES[aiType]
  if (!AIClass) {
    console.warn(`Unknown AI type: ${aiType}, using RandomAI`)
    return new RandomAI(playerId)
  }
  return new AIClass(playerId)
}

