// PM2 Ecosystem Configuration for Horizontal Scaling
// Run with: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'presentation-api',
      script: 'dist/main.js',
      cwd: './backend-nest',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      
      // Advanced features
      increment_var: 'INSTANCE_ID',
      instance_var: 'INSTANCE_ID',
    },
    {
      name: 'presentation-worker',
      script: 'dist/worker.js',
      cwd: './backend-nest',
      instances: 2, // 2 workers for background jobs
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      
      // Logging
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      merge_logs: true,
    },
    {
      name: 'presentation-scheduler',
      script: 'dist/scheduler.js',
      cwd: './backend-nest',
      instances: 1, // Only one scheduler instance
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      cron_restart: '0 0 * * *', // Restart daily at midnight
      
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      
      // Logging
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com', 'server2.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:org/presentation_generator.git',
      path: '/var/www/presentation',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
    staging: {
      user: 'deploy',
      host: 'staging.example.com',
      ref: 'origin/develop',
      repo: 'git@github.com:org/presentation_generator.git',
      path: '/var/www/presentation-staging',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
