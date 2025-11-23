import { useState } from 'react'
import GameCanvas from './components/GameCanvas'
import GameMenu from './components/GameMenu'
import GameUI from './components/GameUI'
import GameMenuModal from './components/GameMenuModal'
import PauseMenu from './components/PauseMenu'
import { useGameStore } from './store/gameStore'

function App() {
  const [gameState, setGameState] = useState('menu') // menu, playing, paused, ended, menuModal
  const [gameConfig, setGameConfig] = useState(null)

  const handleExitGame = () => {
    // 退出游戏，清除游戏状态并返回主菜单
    useGameStore.getState().resetGame()
    setGameConfig(null)
    setGameState('menu')
  }

  return (
    <div className="w-full h-full bg-gray-900 text-white">
      {gameState === 'menu' && (
        <GameMenu onStartGame={(config) => {
          setGameConfig(config)
          setGameState('playing')
        }} />
      )}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'menuModal') && (
        <div className="relative w-full h-full">
          <GameCanvas isPaused={gameState === 'paused' || gameState === 'menuModal'} gameConfig={gameConfig} />
          <GameUI 
            onPause={() => setGameState(gameState === 'playing' ? 'paused' : 'playing')}
            onMenu={() => setGameState(gameState === 'menuModal' ? 'playing' : 'menuModal')}
            isPaused={gameState === 'paused'}
          />
          {gameState === 'paused' && (
            <PauseMenu 
              onResume={() => setGameState('playing')}
              onMenu={() => setGameState('menu')}
            />
          )}
          {gameState === 'menuModal' && (
            <GameMenuModal
              onClose={() => setGameState('playing')}
              onExit={handleExitGame}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App

