module.exports = {
  apps: [
    {
      name: 'horizon-backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      restart_delay: 3000,
      max_memory_restart: '500M'
    }
  ]
};
