// =====================================================
// PM2 CONFIG - Process Manager for TypeBot Bridge
// =====================================================

module.exports = {
  apps: [
    {
      name: "typebot-bridge-server",
      script: "./dist/typebot-bridge-server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        TYPEBOT_BRIDGE_PORT: 3010,
      },
      env_development: {
        NODE_ENV: "development",
      },
      error_file: "./logs/typebot-bridge-error.log",
      out_file: "./logs/typebot-bridge-out.log",
      log_file: "./logs/typebot-bridge-combined.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
      wait_ready: false,
      kill_timeout: 5000,
    },
    {
      name: "typebot-bridge-worker",
      script: "./dist/typebot-bridge-worker.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
        TYPEBOT_WORKER_INTERVAL_MS: 5000,
      },
      env_development: {
        NODE_ENV: "development",
      },
      error_file: "./logs/typebot-worker-error.log",
      out_file: "./logs/typebot-worker-out.log",
      log_file: "./logs/typebot-worker-combined.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      wait_ready: false,
      kill_timeout: 5000,
    },
  ],
}
