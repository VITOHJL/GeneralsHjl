function GameMenuModal({ onClose, onExit }) {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-30">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6 text-center">退出游戏</h2>
        
        <p className="text-gray-400 mb-6 text-center">确定要退出本局游戏吗？</p>
        
        <div className="space-y-3">
          <button
            onClick={onExit}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-semibold text-lg"
          >
            退出本局
          </button>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold text-lg"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameMenuModal

