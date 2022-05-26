import { Schema } from './schema';
import * as path from 'path';
import { exitError } from './util/error';
import { runtimeRequire } from './util/dynamic-require';
import { order, orderMultiple } from './order';

export interface Graph {
	isValid: (id: string) => boolean;
	searchMultiple: (ids: string[]) => Set<ProjectContext>;
	search: (id: string, including: boolean, above: boolean, below: boolean) => Set<ProjectContext>;
	projects: Map<string, ProjectContext>;
	currentDirectory: string;
}

export interface ProjectContext {
	/** Name provided by the configuration. */
	name: string;
	/** Absolute location of the project directory. */
	absoluteLocation: string;
	/** Information from the package.json. */
	package: {
		/** Name of the package. */
		name: string;
		/** Normalized version of the package, meaning, no pre-release (1.0.0 instead of 1.0.0-alpha). */
		normalVersion: string;
		/** Names of dev or regular package dependencies, including those we don't care about. */
		allDependencies: Set<string>;
		/** A dictionary of commands used to build the project, like 'npm run build' */
		scripts: { [command: string]: string; };
	};
	/** A dictionary of commands used to build the project, like 'npm run build' */
	scripts: { [command: string]: string; };
	/** Dependencies. */
	dependencies: Set<ProjectContext>;
	/** Consumers. */
	consumers: Set<ProjectContext>;
}

export function checkIsValid(graph: Graph, id: string): void {
	if (!graph.isValid(id) || (id.indexOf(' ') !== -1)) {
		exitError('identifier was not found or is invalid');
	}
}

function isValid(projects: Map<string, ProjectContext>, id: string): boolean {
	return !!projects.get(id);
}

export function createGraph(schema: Schema, currentDirectory: string): Graph {
	const projects = parseGraph(schema, currentDirectory);

	return {
		currentDirectory,
		projects,
		isValid: (id) => {
			return isValid(projects, id);
		},
		searchMultiple: (ids) => {
			return orderMultiple(projects, ids);
		},
		search: (id, including, above, below) => {
			return order(projects, id, including, above, below);
		}
	};
}

/**
 * Runs through each project to get its package.json and full name.
 * Then, using the config's dependency lists, it builds a dependency graph
 * that connects each project directly to its dependencies and consumers.
 */
function parseGraph(schema: Schema, currentDirectory: string): Map<string, ProjectContext> {
	const pathRoot = schema.pathRoot || '';
	const buildRoot = path.resolve(currentDirectory, pathRoot);
	//console.log(`Build root: '${buildRoot}'`);

	if (!schema.projects) {
		exitError('No projects defined');
	}

	/** '@messman/ts-webpack-builder' -> 'tswb' */
	const mapPackageNameToProjectName = new Map<string, string>();
	/** 'tswb' -> {project} */
	const mapProjectNameToProject = new Map<string, ProjectContext>();

	Object.keys(schema.projects).forEach((projectName) => {
		// Ensure project name is acceptable
		if (!projectNameRegex.test(projectName)) {
			exitError(`Project name '${projectName}' is invalid`);
		}

		const project = schema.projects![projectName];

		const absoluteProjectDirectory = path.resolve(buildRoot, project.path || '');
		const packageJsonPath = path.resolve(absoluteProjectDirectory, './package.json');
		let packageJson: any = null!;
		try {
			packageJson = runtimeRequire(packageJsonPath);
		}
		catch (e) {
			console.error(e);
			exitError(`Could not reach package.json at '${packageJsonPath}'`);
		}
		const packageName = packageJson['name'];
		if (!packageName) {
			exitError(`No project name defined in package.json for '${projectName}'`);
		}
		let packageVersion = packageJson['version'] as string;
		if (!packageVersion) {
			exitError(`No project version defined in package.json for '${projectName}'`);
		}
		else {
			// Strip off any prerelease identifier (-alpha, etc).
			packageVersion = packageVersion.split('-')[0];
		}

		mapPackageNameToProjectName.set(packageName, projectName);

		const allPackageDependencies = new Set<string>();
		addObjectKeysToSet(packageJson['dependencies'], allPackageDependencies);
		addObjectKeysToSet(packageJson['devDependencies'], allPackageDependencies);

		mapProjectNameToProject.set(projectName, {
			name: projectName,
			package: {
				name: packageName,
				normalVersion: packageVersion,
				allDependencies: allPackageDependencies,
				scripts: packageJson['scripts'] || {}
			},
			scripts: project.scripts || {},
			absoluteLocation: path.resolve(buildRoot, project.path || ''),
			dependencies: new Set(),
			consumers: new Set()
		});
	});

	// Go through again and set dependencies
	mapProjectNameToProject.forEach((project, _projectName, map) => {
		/*
			For each project,
			for each package dependency,
			check if that dependency is a project and, if so, make the connection.
		*/
		const packageDependencies = project.package.allDependencies;

		// We must sort to ensure consistent order.
		Array.from(packageDependencies).sort().forEach((dependencyName) => {
			const matchedProjectName = mapPackageNameToProjectName.get(dependencyName);
			if (matchedProjectName) {
				const matchedProject = map.get(matchedProjectName)!;
				// Double-link
				project.dependencies.add(matchedProject);
				matchedProject.consumers.add(project);
			}
		});
	});

	return mapProjectNameToProject;
};

function addObjectKeysToSet(object: {} | undefined, set: Set<string>): void {
	if (!object) {
		return;
	}
	Object.keys(object).forEach((key) => {
		set.add(key);
	});
}

const projectNameRegex = /^[a-zA-Z0-9\-_]+$/;