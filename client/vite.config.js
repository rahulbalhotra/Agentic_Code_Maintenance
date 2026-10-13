import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const clientPort = parseInt(env.VITE_CLIENT_PORT || env.CLIENT_PORT || '5173', 10)
  const serverPort = parseInt(env.VITE_SERVER_PORT || env.SERVER_PORT || '4000', 10)
  const agentPort = parseInt(env.VITE_AGENT_PORT || env.AGENT_PORT || '8000', 10)

  return {
    plugins: [react()],
    server: {
      port: clientPort,
      proxy: {
        // Express Jira API Server (Port 4000)
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true
        },
        // Python Agent Backend (Port 8000)
        '/agent-api': {
          target: `http://localhost:${agentPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/agent-api/, '/api')
        }
      }
    }
  }
})
