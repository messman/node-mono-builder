import * as chalk from 'chalk';
const line = '====================================';
export function exitError(message: string): never {
	beginExitError();
	console.error(message);
	endExitError();
}

export function beginExitError(): void {
	console.error(chalk.red(line));
}

export function endExitError(): never {
	console.error(chalk.red(line));
	process.exit(1);
}