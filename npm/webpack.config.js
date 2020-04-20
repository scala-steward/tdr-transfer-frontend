const path = require("path")
const webpack = require("webpack")

module.exports = {
  entry: "./src/index.ts",
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  plugins: [
    new webpack.DefinePlugin({
      API_URL: JSON.stringify(
        `${process.env.API_URL || "http://localhost:8080"}/graphql`
      ),
      TDR_IDENTITY_PROVIDER_NAME: JSON.stringify(
        process.env.TDR_IDENTITY_PROVIDER_NAME ||
          "auth.tdr-integration.nationalarchives.gov.uk/auth/realms/tdr"
      ),
      TDR_IDENTITY_POOL_ID: JSON.stringify(process.env.TDR_IDENTITY_POOL_ID),
      REGION: JSON.stringify(process.env.REGION | "eu-west-2"),
      STAGE: JSON.stringify(process.env.STAGE | "intg"),
      //Default batch of 250 taken from prototype
      METADATA_UPLOAD_BATCH_SIZE: JSON.stringify(
        `${process.env.METADATA_UPLOAD_BATCH_SIZE || 2}`
      )
    })
  ],
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "../public/javascripts")
  }
}

function DtsBundlePlugin() {}
DtsBundlePlugin.prototype.apply = function(compiler) {
  compiler.plugin("done", function() {
    var dts = require("dts-bundle")

    dts.bundle({
      name: "tdr",
      main: "src/index.d.ts",
      out: "../dist/index.d.ts",
      removeSource: true,
      outputAsModuleFolder: true // to use npm in-package typings
    })
  })
}
