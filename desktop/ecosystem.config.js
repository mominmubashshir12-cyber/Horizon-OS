module.exports = {
  apps: [
    {
      name: 'horizon-desktop',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      }
    }
  ]
};
