// @ts-check 
const build = require('../dist/index');

/** @type {build.Schema} */
const schema = {
	pathRoot: '../../structure',
	projects: {
		'db-bind': {
			path: './db/bind',
		},
		'db-test': {
			path: './db/test',
		},
		'assets': {
			path: './assets',
		},
		'bridge-iso': {
			path: './bridge/iso',
		},
		'server-web': {
			path: './server/web',
		},
		'client-web': {
			path: './client/web',
			developmentBuild: 'npm run dev',
		}
	}
};

/** @type {string} */
// @ts-ignore
const workingDirectory = process.cwd();
const builder = build.createBuilder({
	options: {
		currentDirectory: workingDirectory
	},
	schema: schema
});

/** @type {string[]} */
// @ts-ignore
const args = process.argv;

/** @type {(args: string[]) => void} */
function run() {
	// [0]node [1]/usr/src/root/utility/build/do [2]...
	const commands = args.slice(1);
	commands[0] = commands[0].substring(commands[0].lastIndexOf('/') + 1);
	builder.command(commands);
}

module.exports = {
	run
};