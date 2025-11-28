import { useGameStore } from '../store/gameStore'
import { AI_TYPES, getAIName } from '../game/ai/index'

function PauseMenu({ onResume, onMenu }) {
  const { gameState, playerConfig, setPlayerType, gameEngine } = useGameStore()

  if (!gameState || !playerConfig) return null

  const handlePlayerTypeChange = (playerId, type, aiType = null) => {
    setPlayerType(playerId, type, aiType)
  }

  const handleAddPlayer = () => {
    // 注意：游戏中不能添加玩家，这个功能只在菜单中可用
    // 这里只是展示，实际需要在菜单中添加
  }

  const handleRemovePlayer = (playerId) => {
    // 游戏中不能移除玩家，至少保留2个
    if (Object.keys(playerConfig).length <= 2) return
    // 可以切换为AI，但不能完全移除
  }

  const playerIds = Object.keys(playerConfig).map(Number).sort((a, b) => a - b)

  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">游戏已暂停</h2>
        
        {/* 玩家配置 - 紧凑布局 */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-3">玩家配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playerIds.map(playerId => {
              const config = playerConfig[playerId]
              const isCurrentPlayer = gameState.currentPlayer === playerId
              
              return (
                <div 
                  key={playerId} 
                  className={`border rounded-lg p-3 space-y-2 ${
                    isCurrentPlayer ? 'border-yellow-400 bg-yellow-400 bg-opacity-10' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      玩家 {playerId}
                      {isCurrentPlayer && <span className="ml-2 text-yellow-400 text-xs">(当前)</span>}
                    </span>
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
                      onClick={() => handlePlayerTypeChange(playerId, 'ai', AI_TYPES.RANDOM)}
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
                        onChange={(e) => handlePlayerTypeChange(playerId, 'ai', e.target.value)}
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

        {/* 操作按钮 */}
        <div className="space-y-2">
          <button
            onClick={onResume}
            className="w-full px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
          >
            继续游戏
          </button>
          {/* <button
            onClick={onMenu}
            className="w-full px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold"
          >
            返回菜单
          </button> */}
        </div>
      </div>
    </div>
  )
}

export default PauseMenu
