import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 监听所有地址，包括局域网
    port: 1732,
    open: true
  }
})

