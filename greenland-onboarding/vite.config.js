import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/greenland-onboarding/', // 確保這裡跟你 GitHub 的倉庫名一模一樣
})