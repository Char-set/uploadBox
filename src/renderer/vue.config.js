module.exports = {
    productionSourceMap: false,
    // publicPath:process.env.NODE_ENV === 'production' ? '/h5':'',
    devServer: {
        proxy: {
            '/api':{
                // target: 'https://mpogwi-test.1o2o.com/api/document',
                target: 'http://127.0.0.1:7001',
                changeOrigin: true,
                pathRewrite:{
                    '/api':''
                }
            },
        }
    }
}