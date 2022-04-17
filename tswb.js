// @ts-check
//const webpack = require('webpack'); // Needs install if used
/**
 * @typedef { import('@messman/ts-webpack-builder').LibraryBuildOptions } LibraryBuildOptions
 */
/**
 * @type Partial<LibraryBuildOptions>
 */
const options = {
	webpackConfigTransform: (_webpackConfig, _buildOptions) => {
		// Left here in case we want to extend later.
		return _webpackConfig;
	}
};

module.exports = options;