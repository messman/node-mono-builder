/*
	This is a build tool that uses webpack to build other projects.
	But, it's also a project that is itself built with webpack.
	And webpack will follow `require` when it sees it. So we need to use a special function
	that will be ignored by webpack for dynamically requiring things like JSON configs.

	More information: https://github.com/webpack/webpack/issues/4175
*/

declare function __webpack_require__(entityPath: string): {};
declare function __non_webpack_require__(entityPath: string): {};
const requireFunc = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;

export function runtimeRequire(entityPath: string): {} {
	return requireFunc(entityPath);
}
