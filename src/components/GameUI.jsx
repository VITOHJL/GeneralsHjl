import { useGameStore } from '../store/gameStore'

function GameUI({ onPause, onMenu, isPaused = false }) {
  const { gameState, nextTurn } = useGameStore()

  if (!gameState) return null

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
      <div className="bg-gray-800 bg-opacity-80 rounded-lg p-4 space-y-2 pointer-events-auto">
        <div className="text-sm">
          <span className="text-gray-400">回合: </span>
          <span className="font-semibold">{gameState.turn}</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-400">轮: </span>
          <span className="font-semibold">{gameState.round}</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-400">当前玩家: </span>
          <span className="font-semibold text-blue-400">玩家 {gameState.currentPlayer}</span>
        </div>
        {gameState.gameOver && (
          <div className="text-sm text-yellow-400 font-bold">
            {gameState.winner ? `玩家 ${gameState.winner} 获胜！` : '游戏结束'}
          </div>
        )}
      </div>
      
      <div className="space-x-2 pointer-events-auto">
        {!gameState.gameOver && (
          <button
            onClick={nextTurn}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
          >
            结束回合
          </button>
        )}
        <button
          onClick={onPause}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          {isPaused ? '继续' : '暂停'}
        </button>
        <button
          onClick={onMenu}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          退出
        </button>
      </div>
    </div>
  )
}

export default GameUI

