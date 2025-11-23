import { useState } from 'react'
import GameCanvas from './components/GameCanvas'
import GameMenu from './components/GameMenu'
import GameUI from './components/GameUI'

function App() {
  const [gameState, setGameState] = useState('menu') // menu, playing, paused, ended

  return (
    <div className="w-full h-full bg-gray-900 text-white">
      {gameState === 'menu' && (
        <GameMenu onStartGame={() => setGameState('playing')} />
      )}
      {gameState === 'playing' && (
        <div className="relative w-full h-full">
          <GameCanvas />
          <GameUI 
            onPause={() => setGameState('paused')}
            onMenu={() => setGameState('menu')}
          />
        </div>
      )}
    </div>
  )
}

export default App

