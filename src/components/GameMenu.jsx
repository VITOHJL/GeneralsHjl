function GameMenu({ onStartGame }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold mb-4">Generals.io</h1>
        <p className="text-xl text-gray-400 mb-8">本地单机策略游戏</p>
        
        <div className="space-y-4">
          <button
            onClick={onStartGame}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-semibold transition-colors"
          >
            开始游戏
          </button>
          
          <div className="text-sm text-gray-500 space-y-2 mt-8">
            <p>操作说明：</p>
            <p>• 点击+点击：移动50%兵力</p>
            <p>• 点击+拖拽：只保留1个，其余全部移动</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameMenu

