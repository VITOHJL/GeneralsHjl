import { create } from 'zustand'
import MapGenerator from '../game/MapGenerator'
import GameEngine from '../game/GameEngine'
import { createAI, loadQTableAsync, AI_TYPES } from '../game/ai/index'

// Q 表文件映射
const QTABLE_MAP = {
  [AI_TYPES.STRATEGY_RL]: '/qtable-strategy.json',
  [AI_TYPES.QLEARNING_RL]: '/qtable-qlearning.json'
}

export const useGameStore = create((set, get) => ({
  gameState: null,
  gameEngine: null,
  playerConfig: null, // 玩家配置：{ 1: { type: 'human' }, 2: { type: 'ai', aiType: 'random' } }

  initGame: async (config) => {
    const { width, height, players, playerConfig } = config
    // playerConfig: { 1: { type: 'human' }, 2: { type: 'ai', aiType: 'random' } }
    
    // 生成地图
    const map = MapGenerator.generateRandomMap(width, height, players)
    
    // 创建AI实例（异步加载 Q 表）
    const ais = {}
    for (let playerId = 1; playerId <= players; playerId++) {
      const config = playerConfig[playerId]
      if (config && config.type === 'ai' && config.aiType) {
        // 如果是 RL AI，异步加载 Q 表
        if (config.aiType === AI_TYPES.STRATEGY_RL || config.aiType === AI_TYPES.QLEARNING_RL) {
          const qTableUrl = QTABLE_MAP[config.aiType]
          if (qTableUrl) {
            const qTable = await loadQTableAsync(qTableUrl)
            if (qTable) {
              console.log(`[GameStore] 已加载 Q 表: ${config.aiType} (${Object.keys(qTable).length} 个条目)`)
              ais[playerId] = createAI(config.aiType, playerId, { qTable })
            } else {
              console.warn(`[GameStore] 无法加载 Q 表: ${qTableUrl}，使用空 Q 表`)
              ais[playerId] = createAI(config.aiType, playerId, { qTable: {} })
            }
          } else {
            ais[playerId] = createAI(config.aiType, playerId, { qTable: {} })
          }
        } else {
          ais[playerId] = createAI(config.aiType, playerId)
        }
      }
    }
    
    // 创建游戏引擎
    const engine = new GameEngine(map, players, { ais })
    
    set({
      gameState: engine.getState(),
      gameEngine: engine,
      playerConfig
    })
  },

  // 切换玩家类型（人/AI）
  setPlayerType: async (playerId, type, aiType = null) => {
    const { gameEngine, playerConfig } = get()
    if (!gameEngine) return

    // 更新配置
    const newConfig = { ...playerConfig }
    if (type === 'human') {
      newConfig[playerId] = { type: 'human' }
      // 移除AI
      gameEngine.removeAI(playerId)
    } else if (type === 'ai' && aiType) {
      newConfig[playerId] = { type: 'ai', aiType }
      // 添加或更新AI（如果是 RL AI，异步加载 Q 表）
      if (aiType === AI_TYPES.STRATEGY_RL || aiType === AI_TYPES.QLEARNING_RL) {
        const qTableUrl = QTABLE_MAP[aiType]
        if (qTableUrl) {
          const qTable = await loadQTableAsync(qTableUrl)
          if (qTable) {
            console.log(`[GameStore] 已加载 Q 表: ${aiType} (${Object.keys(qTable).length} 个条目)`)
            const ai = createAI(aiType, playerId, { qTable })
            gameEngine.setAI(playerId, ai)
          } else {
            console.warn(`[GameStore] 无法加载 Q 表: ${qTableUrl}，使用空 Q 表`)
            const ai = createAI(aiType, playerId, { qTable: {} })
            gameEngine.setAI(playerId, ai)
          }
        } else {
          const ai = createAI(aiType, playerId, { qTable: {} })
          gameEngine.setAI(playerId, ai)
        }
      } else {
        const ai = createAI(aiType, playerId)
        gameEngine.setAI(playerId, ai)
      }
    }

    set({ 
      playerConfig: newConfig,
      gameState: gameEngine.getState()
    })
  },

  makeMove: (fromX, fromY, toX, toY, moveType) => {
    const { gameEngine } = get()
    if (!gameEngine) return false

    const success = gameEngine.makeMove(fromX, fromY, toX, toY, moveType)
    if (success) {
      set({ gameState: gameEngine.getState() })
    }
    return success
  },

  nextTurn: () => {
    const { gameEngine } = get()
    if (!gameEngine) return

    gameEngine.nextTurn()
    set({ gameState: gameEngine.getState() })
  },

  resetGame: () => {
    set({
      gameState: null,
      gameEngine: null,
      playerConfig: null
    })
  }
}))

