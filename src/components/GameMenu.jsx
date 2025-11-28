import { useState } from 'react'
import { AI_TYPES, getAIName } from '../game/ai/index'

function GameMenu({ onStartGame }) {
  const [playerConfig, setPlayerConfig] = useState({
    1: { type: 'human' },
    2: { type: 'ai', aiType: AI_TYPES.RANDOM }
  })
  const [mapSize, setMapSize] = useState('medium') // small, medium, large

  const handlePlayerTypeChange = (playerId, type) => {
    const newConfig = { ...playerConfig }
    if (type === 'human') {
      newConfig[playerId] = { type: 'human' }
    } else {
      newConfig[playerId] = { type: 'ai', aiType: newConfig[playerId]?.aiType || AI_TYPES.RANDOM }
    }
    setPlayerConfig(newConfig)
  }

  const handleAITypeChange = (playerId, aiType) => {
    const newConfig = { ...playerConfig }
    if (newConfig[playerId] && newConfig[playerId].type === 'ai') {
      newConfig[playerId] = { ...newConfig[playerId], aiType }
    }
    setPlayerConfig(newConfig)
  }

  const handleAddPlayer = () => {
    const playerIds = Object.keys(playerConfig).map(Number).sort((a, b) => a - b)
    const nextPlayerId = playerIds.length > 0 ? Math.max(...playerIds) + 1 : 1
    const newConfig = { ...playerConfig }
    newConfig[nextPlayerId] = { type: 'human' }
    setPlayerConfig(newConfig)
  }

  const handleRemovePlayer = (playerId) => {
    if (Object.keys(playerConfig).length <= 2) return // 至少保留2个玩家
    const newConfig = { ...playerConfig }
    delete newConfig[playerId]
    setPlayerConfig(newConfig)
  }

  const handleStart = () => {
    const playerCount = Object.keys(playerConfig).length
    // 地图尺寸配置
    const sizeMap = {
      small: { width: 15, height: 15 },
      medium: { width: 25, height: 25 },
      large: { width: 35, height: 35 }
    }
    const { width, height } = sizeMap[mapSize]
    
    onStartGame({
      width,
      height,
      players: playerCount,
      playerConfig
    })
  }

  const playerIds = Object.keys(playerConfig).map(Number).sort((a, b) => a - b)

  return (
    <div className="flex flex-col h-full p-4">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        {/* 固定标题区域 */}
        <div className="text-center mb-4 flex-shrink-0">
          <h1 className="text-5xl font-bold mb-2">Generals.io</h1>
          <p className="text-lg text-gray-400">本地单机策略游戏</p>
        </div>

        {/* 地图尺寸选择 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold mb-3">地图尺寸</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMapSize('small')}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                mapSize === 'small'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              小 (15×15)
            </button>
            <button
              onClick={() => setMapSize('medium')}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                mapSize === 'medium'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              中 (25×25)
            </button>
            <button
              onClick={() => setMapSize('large')}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                mapSize === 'large'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              大 (35×35)
            </button>
          </div>
        </div>

        {/* 可滚动的玩家配置区域 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-lg font-semibold">玩家配置</h2>
            <button
              onClick={handleAddPlayer}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors"
              title="添加玩家"
            >
              + 添加玩家
            </button>
          </div>
          
          <div className="overflow-y-auto flex-1 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {playerIds.map(playerId => {
                const config = playerConfig[playerId]
                return (
                  <div key={playerId} className="border border-gray-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">玩家 {playerId}</span>
                      {playerIds.length > 2 && (
                        <button
                          onClick={() => handleRemovePlayer(playerId)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                          title="移除玩家"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    {/* 类型选择 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePlayerTypeChange(playerId, 'human')}
                        className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors ${
                          config.type === 'human'
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        人类
                      </button>
                      <button
                        onClick={() => handlePlayerTypeChange(playerId, 'ai')}
                        className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors ${
                          config.type === 'ai'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        AI
                      </button>
                    </div>

                    {/* AI配置 */}
                    {config.type === 'ai' && (
                      <div className="space-y-1.5 pl-2 border-l-2 border-gray-700">
                        <div className="text-xs text-gray-300">AI类型</div>
                        <select
                          value={config.aiType || AI_TYPES.RANDOM}
                          onChange={(e) => handleAITypeChange(playerId, e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 rounded text-xs"
                        >
                          <option value={AI_TYPES.RANDOM}>{getAIName(AI_TYPES.RANDOM)}</option>
                          <option value={AI_TYPES.ADAPTIVE}>{getAIName(AI_TYPES.ADAPTIVE)}</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 固定底部区域 */}
        <div className="flex-shrink-0 space-y-2">
          {/* 开始按钮 */}
          <div className="text-center">
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-semibold transition-colors"
            >
              开始游戏
            </button>
          </div>

          {/* 操作说明 - 更紧凑 */}
          <div className="text-xs text-gray-500 text-center">
            <p>操作说明：点击+点击：移动50%兵力 | 点击+拖拽：只保留1个，其余全部移动</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameMenu
