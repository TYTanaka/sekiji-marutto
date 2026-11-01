import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相対パスで出力し、配信サブパス（GitHub Pages 等）に依存しない。
  // ハッシュルーティングのため、相対解決でも全画面が正しく開ける。
  base: './',
})
