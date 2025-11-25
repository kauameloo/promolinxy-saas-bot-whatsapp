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
      },
      error_file: "./logs/queue-error.log",
      out_file: "./logs/queue-out.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
}
