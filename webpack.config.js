const HtmlWebPackPlugin = require('html-webpack-plugin');

module.exports = {
    // mode: 'production',
    // mode: 'development',
    // output: {
    //     filename: "[name].bundle.js",
    //     path: path.resolve(__dirname, "dist")
    // },
    devServer: {
        contentBase: './dist',
    },
    plugins: [
        new HtmlWebPackPlugin({
            minify: false,
            filename: 'game.html',
            cache: false,
            template: './src/index.html'
        })
    ],
    module: {
        rules: [
            {
                test: /\.html$/i,
                use: ['html-loader']
            },
            {
                test: /\.(scss|css)$/i,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ],
            },
            // {
            //     test: /\.(svg|png|jpg|gif)$/,
            //     use: {
            //         loader: "file-loader",
            //         options: {
            //             name: "[name].[ext]",
            //             outputPath: "imgs"
            //         }
            //     }
            // }
        ],
    },
};