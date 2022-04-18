import * as yargs from 'yargs';
import { CommandInputContext, CommandModifier, list, runCommand, RunCommandInput, } from './commands';
import { logLine } from './util/log';
import { beginExitError, endExitError, exitError } from './util/error';

export function parse(args: string[], inputContext: CommandInputContext): void {

	logLine();
	const flagsAndPositionals = yargs.parse(args) as { [key: string]: any; };

	const positionals = flagsAndPositionals._ as (string[]);
	const command = positionals.shift() as string | null | undefined;

	// Handle help
	if (command === 'help' || flagsAndPositionals['help']) {
		logHelp(`Invalid command`);
	}

	// Handle list
	if (command === 'list') {
		list(inputContext);
		return;
	}

	// Handle invalid command
	const isRunCommand = command === 'run';
	const isPushpullCommand = command === 'pushpull';
	if (!isPushpullCommand && !isRunCommand) {
		logHelp(`Invalid command: ${command || '[none]'}`);
		return;
	}

	// Grab run script
	let scriptName: string | null = null;
	if (isRunCommand) {
		scriptName = positionals.shift() || null;
		if (!scriptName) {
			logHelp(`Run command needs a script name after`);
		}
	}

	// Grab modifier, if any
	let modifier: CommandModifier | null = null;
	switch (positionals[0]) {
		case CommandModifier.to:
		case CommandModifier.from:
		case CommandModifier.above:
		case CommandModifier.below:
		case CommandModifier.all:
			modifier = positionals.shift() as CommandModifier;
			break;
		default:
			modifier = null;
	}

	const passedIds = positionals;
	if (passedIds.length === 0 && modifier !== CommandModifier.all) {
		exitError('No project(s) provided');
	}
	if (modifier !== null && passedIds.length > 1) {
		exitError(`A modifier can only be used with a single project`);
	}

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

	const runCommandInput: RunCommandInput = {
		scriptName: scriptName,
		projects: passedIds,
		includeProject: include,
		includeAbove: above,
		includeBelow: below,
		isExplicit: modifier === null,
		flags: {
			dryRun: !!flagsAndPositionals['dryRun'],
			install: !!flagsAndPositionals['install'],
			pushpull: !!flagsAndPositionals['pushpull'] || isPushpullCommand,
		}
	};

	logCommand(runCommandInput);
	runCommand(runCommandInput, inputContext);
}

function logCommand(input: RunCommandInput): void {
	const { isExplicit, projects, scriptName, flags, includeProject, includeAbove, includeBelow } = input;
	if (isExplicit) {
		console.log(`For ${projects.length} project(s) only, in dependency order:`);
	}
	else if (!projects.length) {
		console.log('For all projects:');
	}
	else {
		const aboveAndBelow = [includeAbove ? 'above' : '', includeBelow ? 'below' : '']
			.filter((val) => { return !!val; })
			.join(' and ');

		const project = projects[0];
		let message: string = null!;
		if (!includeProject) {
			message = `For projects ${aboveAndBelow} ${project}:`;
		}
		else {
			message = `For ${project} and projects ${aboveAndBelow}:`;
		}
		console.log(message);
	}
	if (flags.install) {
		console.log(`- Run 'npm install'`);
	}
	if (scriptName) {
		console.log(`- Run script '${scriptName}'`);
	}
	if (flags.pushpull) {
		console.log(`- Publish package and install it in consumers`);
	}
	if (flags.dryRun) {
		logLine();
		console.log('DRY RUN: Not actually going to doing any of that.');
	}
	logLine();
}

function logHelp(issue: string | null): void {
	beginExitError();
	if (issue) {
		console.log(`Error: ${issue}`);
		logLine();
	}
	console.log(`HELP: see README. Top-level commands are 'help', 'list', 'pushpull', and 'run'.`);
	console.log(`Example: 'run build all --pushpull --install'`);
	endExitError();
}