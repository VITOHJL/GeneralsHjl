import { create } from 'zustand'
import MapGenerator from '../game/MapGenerator'
import GameEngine from '../game/GameEngine'

export const useGameStore = create((set, get) => ({
  gameState: null,
  gameEngine: null,

  initGame: (config) => {
    const { width, height, players } = config
    
    // 生成地图
    const map = MapGenerator.generateRandomMap(width, height, players)
    
    // 创建游戏引擎
    const engine = new GameEngine(map, players)
    
    set({
      gameState: engine.getState(),
      gameEngine: engine
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
  }
}))

