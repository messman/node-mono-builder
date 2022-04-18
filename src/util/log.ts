import chalk = require('chalk');

// Note - we require this during build time, so if the version of this package is changed without building then this value will not be updated.
const packageJson = require('../../package.json');

export function logVersion(): void {
	const version = packageJson['version'];
	console.log(`node-mono-builder v${version}`);
}

export function logLine(lines?: number) {
	const size = lines || 1;
	for (let i = 0; i < size; i++) {
		console.log();
	}
}

const prefix = `[nmb] `;
export function logInfo(message: string): void {
	console.log(chalk.cyan(`${prefix}`), message);
}