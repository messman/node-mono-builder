import { Schema } from './schema';
import { checkIsValid, Graph, createGraph, ProjectContext } from './graph';
import * as childProcess from 'child_process';
import * as chalk from 'chalk';
import { getCommandInput, validateCommand, logCommand, ParsedCommand, logParsedCommand, parseCommand, CommandAction } from './command';
import { beginExitError, endExitError } from './error';

export interface ExecuteInput {
	options: {
		/**
		 * The current directory. Used as the base before relative paths are
		 * resolved.
		 */
		currentDirectory: string;
	},
	schema: Schema;
}

/** Creates the builder object. */
export function createBuilder(input: ExecuteInput): Builder {
	const currentDirectory = input.options.currentDirectory || __dirname;
	const graph = createGraph(input.schema, currentDirectory);

	return {
		command: command.bind(null, graph),
		list: list.bind(null, new Set(graph.projects.values())),
		process: process.bind(null, graph),
	};
}

type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R ? (...args: P) => R : never;
export interface Builder {
	command: OmitFirstArg<typeof command>;
	list: OmitFirstArg<typeof list>;
	process: OmitFirstArg<typeof process>;
}

function command(graph: Graph, commandText: string[]): void {
	const command = getCommandInput(graph, commandText);
	logCommand(command);
	validateCommand(graph, command);

	const parsedCommand = parseCommand(command);
	process(graph, parsedCommand);
}

function printSet(projects: Set<ProjectContext>, prefix: string | undefined): void {
	const usePrefix = prefix ? (prefix + ' ') : '';
	projects.forEach((project) => {
		console.log(`  ${usePrefix}${project.name}`);
	});
}

function list(set: Set<ProjectContext>): void {
	console.log('Projects:');
	set.forEach((project) => {
		console.log(`  ${project.name}`);
		project.dependencies.forEach((dependency) => {
			console.log(`    - ${dependency.name}`);
		});
	});
}

function process(graph: Graph, command: ParsedCommand): void {
	logParsedCommand(command);
	const { isExplicit, projects, action } = command;

	let orderedProjectSet: Set<ProjectContext> = null!;
	if (isExplicit) {
		orderedProjectSet = graph.searchMultiple(projects);
	}
	else {
		const { includeProject, includeAbove, includeBelow } = command;
		const project = projects[0];
		checkIsValid(graph, project);
		orderedProjectSet = graph.search(project, includeProject, includeAbove, includeBelow);
		console.log(`Found ${orderedProjectSet.size} project(s)`);
	}

	if (orderedProjectSet.size === 0) {
		console.log('No projects - nothing to do');
		return;
	}

	if (command.action === CommandAction.list) {
		list(orderedProjectSet);
		return;
	}

	console.log('Dependency order:');
	printSet(orderedProjectSet, undefined);

	if (command.flags.dryRun) {
		return;
	}

	const { production, installFirst } = command.flags;
	const stats: ProcessingStats = {
		currentProject: null!,
		projectIndex: -1
	};
	let startTime = Date.now();

	try {
		switch (action) {
			case CommandAction.build:
				doForSet(orderedProjectSet, stats, true, false, installFirst, production);
				break;
			case CommandAction.push:
				doForSet(orderedProjectSet, stats, false, true, installFirst, false);
				break;
			case CommandAction.do:
				doForSet(orderedProjectSet, stats, true, true, installFirst, production);
				break;
			case CommandAction.list:
			default:
		}
	}
	catch (e) {
		console.log('');
		beginExitError();
		console.error(`Project ${chalk.yellow(stats.projectIndex + 1)} of ${chalk.yellow(orderedProjectSet.size)} failed at ${chalk.yellow(getTimeElapsed(startTime))}`);
		const completed: Set<ProjectContext> = new Set();
		const notRun: Set<ProjectContext> = new Set();
		let hasReachedProject = false;
		orderedProjectSet.forEach((project) => {
			if (stats.currentProject === project) {
				hasReachedProject = true;
			}
			else if (!hasReachedProject) {
				completed.add(project);
			}
			else {
				notRun.add(project);
			}
		});
		if (completed.size) {
			printSet(completed, undefined);
		}
		console.log(chalk.red('>'), chalk.yellow(stats.currentProject.name), chalk.red('<'));
		if (notRun.size) {
			printSet(notRun, undefined);
		}
		endExitError();

	}

	const line = '++++++++++++++++++++++++++++++++++++';
	console.log();
	console.log(chalk.green(line));
	console.log(`Processed ${orderedProjectSet.size} project(s) in ${getTimeElapsed(startTime)}:`);
	printSet(orderedProjectSet, undefined);
	console.log(chalk.green(line));
	console.log();
}

function getTimeElapsed(startTime: number): string {
	return `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
}

function doForSet(orderedProjectSet: Set<ProjectContext>, stats: ProcessingStats, isBuild: boolean, isShip: boolean, isInstall: boolean, production: boolean): void {
	const additionalConsumers = new Set<ProjectContext>();

	orderedProjectSet.forEach((project) => {
		updateStats(stats, project);

		if (isShip) {
			// Will not run 'npm update' on the first project.
			// This is more for updating dependencies of projects that were shipped earlier in the loop.
			updateDependencies(project, orderedProjectSet, isInstall);

			// Change version ahead of time so it is used in the build, if any.
			prePublish(project);
		}

		if (isBuild) {
			build(project, production);
		}

		if (isShip) {
			// Add consumers to the set as long as we won't already get to them.
			project.consumers.forEach((consumer) => {
				if (!orderedProjectSet.has(consumer)) {
					additionalConsumers.add(consumer);
				}
			});
			publish(project);
		}
	});

	additionalConsumers.forEach((consumer) => {
		updateDependencies(consumer, orderedProjectSet, false);
	});
}

function build(project: ProjectContext, production: boolean): void {
	const buildCommandScript = !production ? (project.developmentBuildScript || 'npm run build') : (project.productionBuildScript || 'npm run build-production');

	// https://nodejs.org/api/child_process.html#child_process_child_process_execsync_command_options
	childProcess.execSync(buildCommandScript, {
		cwd: project.absoluteLocation,
		stdio: 'inherit',
	});
}

function shouldPublish(project: ProjectContext): boolean {
	// projects with no consumers are not published.
	return project.consumers.size >= 1;
}

function prePublish(project: ProjectContext): void {
	if (!shouldPublish(project)) {
		return;
	}
	/*
		Version the package so it always is the most recent, using time in seconds in utc
		https://docs.npmjs.com/cli/v7/commands/npm-version
	*/
	logInfo(`Versioning '${project.name}' before build and publish...`);
	// https://nodejs.org/api/child_process.html#child_process_child_process_execsync_command_options
	childProcess.execSync(`npm --no-git-tag-version version ${project.package.normalVersion}-$(date -u +%s)`, {
		cwd: project.absoluteLocation,
		stdio: 'inherit',
	});
}

function publish(project: ProjectContext): void {
	if (!shouldPublish(project)) {
		return;
	}
	const publish = 'npm publish';
	const backToVersion = `npm --no-git-tag-version version ${project.package.normalVersion} --allow-same-version=true`;

	logInfo(`Publishing '${project.name}' and returning to version ${project.package.normalVersion}...`);
	childProcess.execSync(`${publish} && ${backToVersion}`, {
		cwd: project.absoluteLocation,
		stdio: 'inherit',
	});
}

/** Runs 'npm update' on dependencies of the passed project that are in the passed set.  */
function updateDependencies(project: ProjectContext, inSet: Set<ProjectContext>, install: boolean): void {
	if (install) {
		/*
			Run npm install in case this is new from git.
		*/
		logInfo(`Running 'npm install' in ${project.name}`);
		childProcess.execSync(`npm install --fund=false`, {
			cwd: project.absoluteLocation,
			stdio: 'inherit',
		});
	}
	else {
		/*
			https://docs.npmjs.com/cli/v7/commands/npm-update
			Update only the dependencies that are a part of our build - no others.
		*/
		const dependenciesToUpdate = Array.from(project.dependencies.values())
			.filter((dependency) => {
				return inSet.has(dependency);
			})
			.map((dependency) => {
				return dependency.package.name;
			});

		if (dependenciesToUpdate.length) {
			logInfo(`Running 'npm update' in ${project.name} for ${dependenciesToUpdate.join(', ')}`);
			childProcess.execSync(`npm update ${dependenciesToUpdate.join(' ')} --fund=false --audit=false`, {
				cwd: project.absoluteLocation,
				stdio: 'inherit',
			});
		}
	}
}

interface ProcessingStats {
	currentProject: ProjectContext;
	projectIndex: number;
}

function updateStats(processingStats: ProcessingStats, project: ProjectContext): void {
	processingStats.currentProject = project;
	processingStats.projectIndex++;
}

function logInfo(message: string): void {
	console.log(chalk.cyan('>>>'), message);
}