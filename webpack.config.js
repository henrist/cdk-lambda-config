// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")

module.exports = {
  mode: "production",
  target: "node",
  node: {
    __dirname: false,
  },
  entry: {
    "handler/index": "./src/handler.ts",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  externals: [/^@aws-sdk/, "original-fs"],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs",
  },
}
