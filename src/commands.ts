import { Schema } from './schema';
import { checkIsValid, createGraph, ProjectContext } from './graph';
import * as childProcess from 'child_process';
import * as chalk from 'chalk';
import { beginExitError, endExitError, exitError } from './util/error';
import { enumKeys } from './util/shared';
import { logInfo } from './util/log';

export interface RunCommandInput {
	projects: string[];
	scriptName: string | null;
	isExplicit: boolean;
	includeProject: boolean;
	includeAbove: boolean;
	includeBelow: boolean;
	flags: {
		install: boolean;
		dryRun: boolean;
		pushpull: boolean;
	};
}

export enum CommandModifier {
	to = 'to',
	from = 'from',
	above = 'above',
	below = 'below',
	all = 'all',
}
export const commandModifierKeys = enumKeys(CommandModifier);

export interface CommandInputContext {
	options: {
		/**
		 * The current directory. Used as the base before relative paths are
		 * resolved.
		 */
		currentDirectory: string;
	},
	schema: Schema;
}

function printSet(projects: Set<ProjectContext>, prefix: string | undefined): void {
	const usePrefix = prefix ? (prefix + ' ') : '';
	projects.forEach((project) => {
		console.log(`  ${usePrefix}${project.name}`);
	});
}

export function list(context: CommandInputContext): void {
	const graph = createGraph(context.schema, context.options.currentDirectory);
	const set = new Set(graph.projects.values());

	console.log('Projects:');
	set.forEach((project) => {
		console.log(`  ${project.name}`);
		project.dependencies.forEach((dependency) => {
			console.log(`    - ${dependency.name}`);
		});
	});
}

export function runCommand(input: RunCommandInput, context: CommandInputContext): void {
	const graph = createGraph(context.schema, context.options.currentDirectory);
	const { isExplicit, projects, flags, scriptName } = input;

	let selectedProjects: Set<ProjectContext> = null!;
	if (isExplicit) {
		selectedProjects = graph.searchMultiple(projects);
	}
	else if (!projects.length) {
		selectedProjects = new Set(graph.projects.values());
	}
	else {
		const { includeProject, includeAbove, includeBelow } = input;
		const project = projects[0];
		checkIsValid(graph, project);
		selectedProjects = graph.search(project, includeProject, includeAbove, includeBelow);
		console.log(`Found ${selectedProjects.size} project(s)`);
	}

	if (selectedProjects.size === 0) {
		console.log('No projects - nothing to do');
		return;
	}

	console.log('Dependency order:');
	printSet(selectedProjects, undefined);

	const stats: ProcessingStats = {
		currentProject: null!,
		projectIndex: -1
	};
	let startTime = Date.now();

	try {
		const additionalConsumers = new Set<ProjectContext>();

		selectedProjects.forEach((project) => {
			updateStats(stats, project);

			if (flags.pushpull) {
				// Will not run 'npm update' on the first project.
				// This is more for updating dependencies of projects that were shipped earlier in the loop.
				updateDependencies(flags.dryRun, project, selectedProjects, flags.install);

				// Change version ahead of time so it is used in the build, if any.
				prePublish(flags.dryRun, project);
			}

			if (scriptName) {
				runScriptName(flags.dryRun, project, scriptName, context.schema);
			}

			if (flags.pushpull) {
				// Add consumers to the set as long as we won't already get to them.
				project.consumers.forEach((consumer) => {
					if (!selectedProjects.has(consumer)) {
						additionalConsumers.add(consumer);
					}
				});
				publish(flags.dryRun, project);
			}
		});

		additionalConsumers.forEach((consumer) => {
			updateDependencies(flags.dryRun, consumer, selectedProjects, false);
		});
	}
	catch (e) {
		console.log('');
		beginExitError();
		console.error(`Project ${chalk.yellow(stats.projectIndex + 1)} of ${chalk.yellow(selectedProjects.size)} failed at ${chalk.yellow(getTimeElapsed(startTime))}`);
		const completed: Set<ProjectContext> = new Set();
		const notRun: Set<ProjectContext> = new Set();
		let hasReachedProject = false;
		selectedProjects.forEach((project) => {
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
	console.log(`Processed ${selectedProjects.size} project(s) in ${getTimeElapsed(startTime)}:`);
	printSet(selectedProjects, undefined);
	console.log(chalk.green(line));
	console.log();
}

function shouldPublish(project: ProjectContext): boolean {
	// projects with no consumers are not published.
	return project.consumers.size >= 1;
}

function prePublish(isDryRun: boolean, project: ProjectContext): void {
	if (!shouldPublish(project)) {
		return;
	}

	logInfo(`Versioning '${project.name}' before build and publish...`);
	/*
		Version the package so it always is the most recent, using time in seconds in utc
		https://docs.npmjs.com/cli/v7/commands/npm-version
	*/
	executeForProject(isDryRun, project, `npm --no-git-tag-version version ${project.package.normalVersion}-$(date -u +%s)`);
}

function publish(isDryRun: boolean, project: ProjectContext): void {
	if (!shouldPublish(project)) {
		return;
	}
	const publish = 'npm publish';
	const backToVersion = `npm --no-git-tag-version version ${project.package.normalVersion} --allow-same-version=true`;

	logInfo(`Publishing '${project.name}' and returning to version ${project.package.normalVersion}...`);
	executeForProject(isDryRun, project, `${publish} && ${backToVersion}`);
}

/** Runs 'npm update' o r'npm install' on dependencies of the passed project that are in the passed set.  */
function updateDependencies(isDryRun: boolean, project: ProjectContext, inSet: Set<ProjectContext>, install: boolean): void {
	/*
		Missing dependencies (local or otherwise) are added here regardless, UNLESS "install" is not set AND the project has no local dependencies.
	*/
	if (install) {
		/*
			Run npm install in case this is new from git.
		*/
		logInfo(`Running 'npm install' in ${project.name}`);
		executeForProject(isDryRun, project, `npm install --fund=false`);
	}
	else {
		/*
			https://docs.npmjs.com/cli/v7/commands/npm-update
			Update only the dependencies that are a part of our build - no others.

			However, any missing packages are also installed - so it works like `npm install` in that way.
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
			executeForProject(isDryRun, project, `npm update ${dependenciesToUpdate.join(' ')} --fund=false --audit=false`);
		}
	}
}

function runScriptName(isDryRun: boolean, project: ProjectContext, scriptName: string, schema: Schema): void {
	let scriptText: string | null = null;
	let source: string = null!;
	const projectScriptText = project.scripts[scriptName] || null;
	const schemaScriptText = (schema.scripts || {})[scriptName] || null;
	const packageScriptText = project.package.scripts[scriptName] || null;

	if (projectScriptText) {
		scriptText = projectScriptText;
		source = 'schema for project';
	}
	else if (schemaScriptText) {
		scriptText = schemaScriptText;
		source = 'schema';
	}
	else if (packageScriptText) {
		scriptText = `npm run ${scriptName}`;
		source = 'package.json';
	}

	if (!scriptText) {
		exitError(`Script name '${scriptName}' not defined in schema or project package.json`);
	}
	logInfo(`Running script '${scriptName}' as defined in ${source}`);
	executeForProject(isDryRun, project, scriptText);
}

function executeForProject(isDryRun: boolean, project: ProjectContext, text: string): void {
	if (isDryRun) {
		logInfo(`dry-run of '${text}'`);
		return;
	}

	childProcess.execSync(text, {
		cwd: project.absoluteLocation,
		stdio: 'inherit',
	});
}

function getTimeElapsed(startTime: number): string {
	return `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
}

interface ProcessingStats {
	currentProject: ProjectContext;
	projectIndex: number;
}

function updateStats(processingStats: ProcessingStats, project: ProjectContext): void {
	processingStats.currentProject = project;
	processingStats.projectIndex++;
}