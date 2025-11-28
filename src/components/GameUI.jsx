import { useMemo } from 'react'
import { getPlayerColor } from '../utils/colors'
import { useGameStore } from '../store/gameStore'

function GameUI({ onPause, onMenu, isPaused = false, fastMode = false, onToggleFastMode, cameraControls = null }) {
  const { gameState, nextTurn } = useGameStore()

  const leaderboard = useMemo(() => {
    const map = gameState?.map
    if (!map || !map.tiles) return []

    const statsByPlayer = {}
    const totalPlayers = gameState?.playerCount || 0

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        const owner = tile.owner
        if (owner > 0) {
          if (!statsByPlayer[owner]) {
            statsByPlayer[owner] = { id: owner, units: 0, land: 0 }
          }
          statsByPlayer[owner].units += tile.units
          statsByPlayer[owner].land += 1
        }
      }
    }

    const result = []
    for (let id = 1; id <= totalPlayers; id++) {
      const s = statsByPlayer[id] || { id, units: 0, land: 0 }
      const isAlive = s.land > 0
      result.push({ ...s, isAlive })
    }

    result.sort((a, b) => {
      if (a.isAlive && !b.isAlive) return -1
      if (!a.isAlive && b.isAlive) return 1
      return b.units - a.units
    })

    return result
  }, [gameState])

  if (!gameState) return null

  return (
    <aside className="w-80 max-w-full h-full bg-gray-900/80 border-l border-gray-800 flex flex-col gap-4 p-4 flex-shrink-0 relative z-10 pointer-events-auto">
      <div className="bg-gray-800 bg-opacity-70 rounded-lg p-4 space-y-2">
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
          <span
            className="font-semibold"
            style={{ color: getPlayerColor(gameState.currentPlayer) }}
          >
            玩家 {gameState.currentPlayer}
          </span>
        </div>
        {gameState.gameOver && (
          <div className="text-sm text-yellow-400 font-bold">
            {gameState.winner ? `玩家 ${gameState.winner} 获胜！` : '游戏结束'}
          </div>
        )}
      </div>

      <div className="bg-gray-800 bg-opacity-70 rounded-lg p-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onPause}
            className="flex-1 min-w-[90px] px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            onClick={onToggleFastMode}
            className={`flex-1 min-w-[90px] px-3 py-2 rounded-lg transition-colors ${
              fastMode ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {fastMode ? '极速' : '普通'}
          </button>
          <button
            onClick={onMenu}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            退出当前局
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={cameraControls?.zoomIn}
            disabled={!cameraControls}
            className="flex-1 min-w-[90px] px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            放大
          </button>
          <button
            onClick={cameraControls?.zoomOut}
            disabled={!cameraControls}
            className="flex-1 min-w-[90px] px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            缩小
          </button>
          <button
            onClick={cameraControls?.resetView}
            disabled={!cameraControls}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            归位
          </button>
        </div>
        {!gameState.gameOver && (
          <button
            onClick={nextTurn}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold"
          >
            结束回合
          </button>
        )}
      </div>

      <div className="bg-gray-800 bg-opacity-70 rounded-lg p-4 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between mb-2 text-gray-300 text-sm">
          <span>玩家</span>
          <span>人口 / 土地</span>
        </div>
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {leaderboard.map((p) => (
            <div
              key={p.id}
              className={`flex justify-between items-center px-3 py-2 rounded ${
                p.isAlive ? '' : 'opacity-40'
              } ${gameState.currentPlayer === p.id ? 'bg-blue-900 bg-opacity-60' : 'bg-gray-900/40'}`}
            >
              <span
                className="font-semibold"
                style={{ color: getPlayerColor(p.id) }}
              >
                P{p.id}
              </span>
              <span className="text-xs text-gray-200">
                {p.units} / {p.land}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

export default GameUI

