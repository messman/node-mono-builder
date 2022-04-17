import { Graph } from './graph';
import * as yargs from 'yargs';
import { exitError } from './error';

export interface InputCommand {
	originalCommandText: string;
	action: CommandAction;
	modifier: CommandModifier | null;
	ids: string[];
	flags: {
		installFirst: boolean;
		dryRun: boolean;
		production: boolean;
	};
}

export interface ParsedCommand {
	projects: string[];
	action: CommandAction;
	isExplicit: boolean;
	includeProject: boolean;
	includeAbove: boolean;
	includeBelow: boolean;
	flags: {
		installFirst: boolean;
		dryRun: boolean;
		production: boolean;
	};
}

/** 
 * Gets the keys of an enum as a string array.
 * Useful for looping to validate values or set values.
*/
function enumKeys<T>(enumObject: T): (keyof T)[] {
	// Note: there are two isNaNs in this world. 
	return Object.keys(enumObject).filter(k => isNaN(Number(k))) as (keyof T)[];
}

export enum CommandAction {
	list = 'list',
	build = 'build',
	push = 'push',
	do = 'do',
	doInit = 'do-init'
}
const actionValues = enumKeys(CommandAction).map(key => CommandAction[key]);

enum CommandModifier {
	to = 'to',
	from = 'from',
	above = 'above',
	below = 'below',
	all = 'all',
}
const modifierKeys = enumKeys(CommandModifier);

export function getCommandInput(graph: Graph, commandText: string[]): InputCommand {

	// https://github.com/yargs/yargs/blob/master/docs/api.md#api-reference
	const argv = yargs
		.usage('Usage: node $0 ...')
		.command('list', 'List all projects')
		.command('<action> [modifier] <project>', 'Process a project or multiple projects based on types and modifiers.', (y) => {
			return y
				.positional('action', {
					description: 'The type of processing to run',
					choices: actionValues
				})
				.positional('modifier', {
					description: 'Modifiers about which projects to include',
					choices: modifierKeys,
				})
				.positional('project', {
					description: 'The project to process (and base modifiers around, if any)',
				})
				.option('production', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Uses the production build commands.`
				})
				.option('dry-run', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Performs a dry-run that doesn't actually process anything.`
				});
		})
		.command('<action> <projects..>', 'Process multiple projects by listing them in any order.', (y) => {
			return y
				.positional('action', {
					description: 'The type of processing to run',
					choices: actionValues
				})
				.positional('projects', {
					description: 'The projects to explicitly process. No other projects are processed.',
				})
				.option('production', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Uses the production build commands.`
				})
				.option('dry-run', {
					type: 'boolean',
					default: false,
					nargs: 0,
					description: `Performs a dry-run that doesn't actually process anything.`
				});
		})
		.example([
			['list from foo', 'List all projects from foo on'],
			['build all', 'Build all projects'],
			['do below bar', 'Build and push all projects up to and excluding bar'],
		])
		.parse(commandText);

	console.log(argv);
	let projects = argv._.map((project) => {
		return project.toString();
	});

	let action = projects[0] as CommandAction;
	projects.splice(0, 1);
	let modifier: CommandModifier | null = null;

	switch (projects[0]) {
		case CommandModifier.to:
		case CommandModifier.from:
		case CommandModifier.above:
		case CommandModifier.below:
		case CommandModifier.all:
			modifier = projects[0];
			projects.splice(0, 1);
			break;
		default:
			modifier = null;
	}

	if (modifier === CommandModifier.all && projects.length === 0) {
		modifier = null;
		graph.projects.forEach((project) => {
			projects.push(project.name);
		});
	}
	if (action === CommandAction.list && modifier === null) {
		graph.projects.forEach((project) => {
			projects.push(project.name);
		});
	}

	let installFirst = false;
	if (action === CommandAction.doInit) {
		action = CommandAction.do;
		installFirst = true;
	}

	return {
		originalCommandText: commandText.join(' '),
		ids: projects,
		action: action,
		modifier: modifier,
		flags: {
			installFirst,
			dryRun: argv['dry-run'],
			production: argv['production']
		},
	};
}

export function validateCommand(graph: Graph, command: InputCommand): void {
	const { action, modifier, flags, ids } = command;

	if (flags.production && action !== CommandAction.build && action !== CommandAction.do) {
		exitError(`'production' flag only applies to build actions`);
	}

	if (ids.length === 0) {
		exitError('No project(s) provided');
	}

	const invalidProjectNames: string[] = [];
	ids.forEach((id) => {
		if (!graph.isValid(id)) {
			invalidProjectNames.push(id);
		}
	});
	if (invalidProjectNames.length) {
		exitError(`Project(s) do not exist: ` + invalidProjectNames.join(', '));
	}
	if (modifier !== null && ids.length > 1) {
		exitError(`A modifier can only be used with a single project`);
	}
}

export function logCommand(command: InputCommand): void {
	const { originalCommandText, ids, action, modifier, flags } = command;

	if (originalCommandText) {
		console.log('Input:', originalCommandText);
	}
	console.log('Command:', action);
	console.log('Modifier:', modifier || '[none]');
	console.log('Project(s):', ids);
	const flagsArray = [
		flags.dryRun ? 'dry-run' : '',
		flags.production ? 'production' : '',
	].filter(x => !!x);
	console.log(`Flags:`, flagsArray);
	console.log('');
}

export function parseCommand(command: InputCommand): ParsedCommand {
	const { ids, action, modifier, flags } = command;

	let include = false;
	let above = false;
	let below = false;
	switch (modifier) {
		case CommandModifier.to:
			include = true;
			below = true;
			break;
		case CommandModifier.from:
			include = true;
			above = true;
			break;
		case CommandModifier.above:
			above = true;
			break;
		case CommandModifier.below:
			below = true;
			break;
		case CommandModifier.all:
			include = true;
			above = true;
			below = true;
			break;
		default:
	}

	return {
		isExplicit: modifier === null,
		action,
		projects: ids,
		flags: flags,
		includeProject: include,
		includeAbove: above,
		includeBelow: below
	};
}

export function logParsedCommand(parsedCommand: ParsedCommand): void {
	const { isExplicit, projects, action, flags, includeProject, includeAbove, includeBelow } = parsedCommand;
	if (isExplicit) {
		console.log(`Processing ${projects.length} project(s) only, in dependency order`);
	}
	else {
		const aboveAndBelow = [includeAbove ? 'above' : '', includeBelow ? 'below' : '']
			.filter((val) => { return !!val; })
			.join(' and ');

		const project = projects[0];
		let message: string = null!;
		if (!includeProject) {
			message = `For projects ${aboveAndBelow} ${project}`;
		}
		else {
			message = `For ${project} and projects ${aboveAndBelow}`;
		}
		console.log(message);
	}
	let actionDescription = '';
	switch (action) {
		case CommandAction.list:
			actionDescription = 'List projects';
			break;
		case CommandAction.build:
			actionDescription = 'Build project(s) using npm scripts defined in the project package.json';
			break;
		case CommandAction.do:
			actionDescription = 'Build and publish project(s), then pull down into consumers';
			break;
		case CommandAction.push:
			actionDescription = 'Publish project(s) to registry and pull into consumers';
			break;
		default:
	}
	console.log(actionDescription);
	if (flags.dryRun) {
		console.log('DRY RUN: Not actually doing anything.');
	}
	if (flags.production) {
		console.log('PRODUCTION: Using production build commands.');
	}
	console.log('');
}