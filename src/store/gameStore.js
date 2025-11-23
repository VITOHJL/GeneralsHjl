import { create } from 'zustand'
import MapGenerator from '../game/MapGenerator'
import GameEngine from '../game/GameEngine'
import { createAI, AI_TYPES } from '../game/ai/index'

export const useGameStore = create((set, get) => ({
  gameState: null,
  gameEngine: null,
  playerConfig: null, // 玩家配置：{ 1: { type: 'human' }, 2: { type: 'ai', aiType: 'random', difficulty: 'easy' } }

  initGame: (config) => {
    const { width, height, players, playerConfig } = config
    // playerConfig: { 1: { type: 'human' }, 2: { type: 'ai', aiType: 'random', difficulty: 'easy' } }
    
    // 生成地图
    const map = MapGenerator.generateRandomMap(width, height, players)
    
    // 创建AI实例
    const ais = {}
    for (let playerId = 1; playerId <= players; playerId++) {
      const config = playerConfig[playerId]
      if (config && config.type === 'ai' && config.aiType) {
        ais[playerId] = createAI(config.aiType, playerId, config.difficulty || 'easy')
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
  setPlayerType: (playerId, type, aiType = null, difficulty = 'easy') => {
    const { gameEngine, playerConfig } = get()
    if (!gameEngine) return

    // 更新配置
    const newConfig = { ...playerConfig }
    if (type === 'human') {
      newConfig[playerId] = { type: 'human' }
      // 移除AI
      gameEngine.removeAI(playerId)
    } else if (type === 'ai' && aiType) {
      newConfig[playerId] = { type: 'ai', aiType, difficulty }
      // 添加或更新AI
      const ai = createAI(aiType, playerId, difficulty)
      gameEngine.setAI(playerId, ai)
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

