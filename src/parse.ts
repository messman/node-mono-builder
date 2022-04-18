import * as yargs from 'yargs';
import { CommandInputContext, commandModifierKeys } from './commands';

export function parse(commandString: string, _inputContext: CommandInputContext): void {

	// https://github.com/yargs/yargs/blob/master/docs/api.md#api-reference
	// https://github.com/yargs/yargs/blob/main/docs/advanced.md#commands
	const argv = yargs.parse();
	yargs.command('list', 'List all projects')
		.command('pushpull <modifier> <project>', 'Publish and install projects.', (y) => {
			y
				.positional('modifier', {
					description: 'Modifiers about which projects to include',
					choices: commandModifierKeys,
				})
				.positional('project', {
					description: 'The project to process (and base modifiers around, if any)',
				})
				.option('install', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Also runs npm install for the projects.`
				})
				.option('dry-run', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Performs a dry-run that doesn't actually process anything.`
				});
		})
		.command('pushpull <projects..>', 'Publish and install projects.', (y) => {
			y
				.positional('projects', {
					description: 'The projects to explicitly process. No other projects are processed.',
				})
				.option('install', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Also runs npm install for the projects.`
				})
				.option('dry-run', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Performs a dry-run that doesn't actually process anything.`
				});
		})
		.command('run <command> <modifier> <project>', 'Process a project or multiple projects based on types and modifiers.', (y) => {
			y
				.positional('command', {
					description: 'The script to run as described in the config schema.',
				})
				.positional('modifier', {
					description: 'Modifiers about which projects to include',
					choices: commandModifierKeys,
				})
				.positional('project', {
					description: 'The project to process (and base modifiers around, if any)',
				})
				.option('install', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Also runs npm install for the projects.`
				})
				.option('pushpull', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Also publishes the project and ensures all consuming projects install it.`
				})
				.option('dry-run', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Performs a dry-run that doesn't actually process anything.`
				});
		})
		.command('run <command> <projects..>', 'Process a project or multiple projects based on types and modifiers.', (y) => {
			y
				.positional('command', {
					description: 'The script to run as described in the config schema.',
				})
				.positional('projects', {
					description: 'The projects to explicitly process. No other projects are processed.',
				})
				.option('install', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Also runs npm install for the projects.`
				})
				.option('pushpull', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Also publishes the project and ensures all consuming projects install it.`
				})
				.option('dry-run', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Performs a dry-run that doesn't actually process anything.`
				});
		})
		.example([
			['run build all --pushpull', `Run the 'build' command for all projects, and also publish/install them`],
			['run build all --pushpull --install', `The above, but also install all dependencies`],
			['run build from proj-a --pushpull', `The above, but only for proj-a and projects that depend on it`],
		])
		.help()
		.parse(commandString);

	console.log(commandString);
	console.log(argv);
	let projects = argv._.map((project) => {
		return project.toString();
	});
	console.log(projects);

	// let action = projects[0] as CommandAction;
	// projects.splice(0, 1);
	// let modifier: CommandModifier | null = null;

	// switch (projects[0]) {
	// 	case CommandModifier.to:
	// 	case CommandModifier.from:
	// 	case CommandModifier.above:
	// 	case CommandModifier.below:
	// 	case CommandModifier.all:
	// 		modifier = projects[0];
	// 		projects.splice(0, 1);
	// 		break;
	// 	default:
	// 		modifier = null;
	// }

	// if (modifier === CommandModifier.all && projects.length === 0) {
	// 	modifier = null;
	// 	graph.projects.forEach((project) => {
	// 		projects.push(project.name);
	// 	});
	// }
	// if (action === CommandAction.list && modifier === null) {
	// 	graph.projects.forEach((project) => {
	// 		projects.push(project.name);
	// 	});
	// }

	// let installFirst = false;
	// if (action === CommandAction.doInit) {
	// 	action = CommandAction.do;
	// 	installFirst = true;
	// }

	// return {
	// 	originalCommandText: commandText.join(' '),
	// 	ids: projects,
	// 	action: action,
	// 	modifier: modifier,
	// 	flags: {
	// 		installFirst,
	// 		dryRun: argv['dry-run'],
	// 		production: argv['production']
	// 	},
	// };
}

// function validateCommand(graph: Graph, command: InputCommand): void {
// 	const { action, modifier, flags, ids } = command;

// 	if (flags.production && action !== CommandAction.build && action !== CommandAction.do) {
// 		exitError(`'production' flag only applies to build actions`);
// 	}

// 	if (ids.length === 0) {
// 		exitError('No project(s) provided');
// 	}

// 	const invalidProjectNames: string[] = [];
// 	ids.forEach((id) => {
// 		if (!graph.isValid(id)) {
// 			invalidProjectNames.push(id);
// 		}
// 	});
// 	if (invalidProjectNames.length) {
// 		exitError(`Project(s) do not exist: ` + invalidProjectNames.join(', '));
// 	}
// 	if (modifier !== null && ids.length > 1) {
// 		exitError(`A modifier can only be used with a single project`);
// 	}
// }

// function logCommand(command: InputCommand): void {
// 	const { originalCommandText, ids, action, modifier, flags } = command;

// 	if (originalCommandText) {
// 		console.log('Input:', originalCommandText);
// 	}
// 	console.log('Command:', action);
// 	console.log('Modifier:', modifier || '[none]');
// 	console.log('Project(s):', ids);
// 	const flagsArray = [
// 		flags.dryRun ? 'dry-run' : '',
// 		flags.production ? 'production' : '',
// 	].filter(x => !!x);
// 	console.log(`Flags:`, flagsArray);
// 	console.log('');
// }

// function parseCommand(command: InputCommand): ParsedCommand {
// 	const { ids, action, modifier, flags } = command;

// 	let include = false;
// 	let above = false;
// 	let below = false;
// 	switch (modifier) {
// 		case CommandModifier.to:
// 			include = true;
// 			below = true;
// 			break;
// 		case CommandModifier.from:
// 			include = true;
// 			above = true;
// 			break;
// 		case CommandModifier.above:
// 			above = true;
// 			break;
// 		case CommandModifier.below:
// 			below = true;
// 			break;
// 		case CommandModifier.all:
// 			include = true;
// 			above = true;
// 			below = true;
// 			break;
// 		default:
// 	}

// 	return {
// 		isExplicit: modifier === null,
// 		action,
// 		projects: ids,
// 		flags: flags,
// 		includeProject: include,
// 		includeAbove: above,
// 		includeBelow: below
// 	};
// }

// function logParsedCommand(parsedCommand: ParsedCommand): void {
// 	const { isExplicit, projects, action, flags, includeProject, includeAbove, includeBelow } = parsedCommand;
// 	if (isExplicit) {
// 		console.log(`Processing ${projects.length} project(s) only, in dependency order`);
// 	}
// 	else {
// 		const aboveAndBelow = [includeAbove ? 'above' : '', includeBelow ? 'below' : '']
// 			.filter((val) => { return !!val; })
// 			.join(' and ');

// 		const project = projects[0];
// 		let message: string = null!;
// 		if (!includeProject) {
// 			message = `For projects ${aboveAndBelow} ${project}`;
// 		}
// 		else {
// 			message = `For ${project} and projects ${aboveAndBelow}`;
// 		}
// 		console.log(message);
// 	}
// 	let actionDescription = '';
// 	switch (action) {
// 		case CommandAction.list:
// 			actionDescription = 'List projects';
// 			break;
// 		case CommandAction.build:
// 			actionDescription = 'Build project(s) using npm scripts defined in the project package.json';
// 			break;
// 		case CommandAction.do:
// 			actionDescription = 'Build and publish project(s), then pull down into consumers';
// 			break;
// 		case CommandAction.push:
// 			actionDescription = 'Publish project(s) to registry and pull into consumers';
// 			break;
// 		default:
// 	}
// 	console.log(actionDescription);
// 	if (flags.dryRun) {
// 		console.log('DRY RUN: Not actually doing anything.');
// 	}
// 	if (flags.production) {
// 		console.log('PRODUCTION: Using production build commands.');
// 	}
// 	console.log('');
// }