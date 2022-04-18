// Note - we require this during build time, so if the version of this package is changed without building then this value will not be updated.
const packageJson = require('../../package.json');

const prefix = `[nmb] `;

export function logVersion(): void {
	const version = packageJson['version'];
	log(`node-mono-builder v${version}`);
}

export function logLine(lines?: number) {
	const size = lines || 1;
	for (let i = 0; i < size; i++) {
		console.log();
	}
}

export function log(message?: any, ...optionalParams: any[]): void {
	console.log(`${prefix}${message}`, ...optionalParams);
}