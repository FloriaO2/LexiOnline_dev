const { createProxyMiddleware } = require('http-proxy-middleware');

console.log("✅ setupProxy.js loaded");

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:2567/api',
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
