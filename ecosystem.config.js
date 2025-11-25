// =====================================================
// PM2 CONFIG - Process Manager
// =====================================================

module.exports = {
  apps: [
    {
      name: "whatsapp-engine",
      script: "./dist/whatsapp-server.js",
      instances: 1, // WhatsApp precisa de instância única por sessão
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        WHATSAPP_PORT: 3001,
      },
      env_development: {
        NODE_ENV: "development",
      },
      error_file: "./logs/whatsapp-error.log",
      out_file: "./logs/whatsapp-out.log",
      log_file: "./logs/whatsapp-combined.log",
      time: true,
      // Restart automático em caso de crash
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
      // Wait for script to be ready before considering it started
      wait_ready: false,
      // Kill timeout
      kill_timeout: 5000,
    },
    {
      name: "message-queue",
      script: "./dist/queue-worker.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        WHATSAPP_SERVER_URL: "http://localhost:3001",
        QUEUE_BATCH_SIZE: 10,
        QUEUE_INTERVAL_MS: 5000,
        QUEUE_MAX_RETRIES: 3,
        QUEUE_STATS_PORT: 3002,
      },
      env_development: {
        NODE_ENV: "development",
      },
      error_file: "./logs/queue-error.log",
      out_file: "./logs/queue-out.log",
      log_file: "./logs/queue-combined.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      // Wait for whatsapp-engine to be ready
      wait_ready: false,
      kill_timeout: 5000,
    },
  ],
}
