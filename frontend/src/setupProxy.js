const { createProxyMiddleware } = require('http-proxy-middleware');

console.log("✅ setupProxy.js loaded");

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 
        (process.env.NODE_ENV === 'production' ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567'),
      changeOrigin: true,
      pathRewrite: {
        '^/api': '',
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('[setupProxy] Proxying request to:', `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
      },
    })
  );
};
