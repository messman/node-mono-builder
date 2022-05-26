import { exitError } from './util/error';

export interface Context<T = any> {
	name: string;
	/** Dependencies. */
	dependencies: Set<T>;
	/** Consumers. */
	consumers: Set<T>;
}

export function orderMultiple<T extends Context>(projects: Map<string, T>, ids: string[]): Set<T> {
	/*
		The major complicating factor is that we
		need to return these projects in dependency order.
		That means we need to get the full dependency tree
		for each project and merge those trees together to get
		the right order (since projects may be disconnected).

		An optimization: the trees are flattened into a dependency order
		set when returned. All the projects in that set that match the
		projects we are looking for are thus already in order.
	*/
	// This set will also take care of duplicates.
	const requestingProjects = new Set<T>();
	ids.forEach((id) => {
		const requestingProject = projects.get(id);
		if (!requestingProject) {
			exitError(`Project '${id}' is not defined`);
		}
		requestingProjects.add(requestingProject);
	});
	if (requestingProjects.size === 0) {
		console.log('No projects provided');
		return new Set();
	}

	// Sets of results that we will merge later.
	// Essentially each result set is a clue to the larger picture.
	// They are each a different slice of the graph.
	let resultSets: Set<Set<T>> = new Set();
	// Projects that we still need to find in a result set.
	let missingProjects = new Set<T>(requestingProjects);

	let loopIndex = 0;
	while (missingProjects.size) {
		// Get a project we don't have info on yet.
		const requestedProject = missingProjects.values().next().value as T | undefined;
		if (!requestedProject) {
			exitError('No remaining missing projects - logic bug');
		}
		// Get its entire dependency order.
		const resultProjects = order(projects, requestedProject.name, true, true, true);
		// Only focus on the projects that we care about for this run.
		//console.log(requestedProject.name, resultProjects);
		const filteredResultProjects = intersect(resultProjects, requestingProjects);
		if (filteredResultProjects.size === requestingProjects.size) {
			// Optimization - if what is returned includes everything we are looking for, get out!
			resultSets = new Set();
			resultSets.add(filteredResultProjects);
			break;
		}
		// Add the result set.
		resultSets.add(filteredResultProjects);
		// Figure out how many projects we still have left to find.
		for (let resultProject of filteredResultProjects) {
			missingProjects.delete(resultProject);
		}

		loopIndex++;
		checkLoop(loopIndex);
	}

	//console.log(resultSets);

	/*
		Our result Sets have the right order. We just need to merge them.
		Example:
			based on project 2: { 2, 4, 6, 7 }
			based on project 3: { 3, 6, 7 }
			based on project 5: { 1, 5, 6, 7 }
			based on project 9: { 9, 10 }
		Our algorithm:
		- Find any result sets that share a project. (in the example above: 7 is shared by all 3).
			- If there aren't any, your remaining sets are your final results.
		- Get the result set for that shared project, and put it in place of the multiple result sets from before.
			- Note, sometimes that result set will be a subset! In which case, use it as a hint on how to merge the sets.
		- Repeat.
	 */
	let [multiSetIntersection, multiSetIntersected] = findAnyIntersection(resultSets);

	loopIndex = 0;
	while (multiSetIntersected !== false) {

		const mergedSet = smartMergeIntersectingSets(multiSetIntersection, multiSetIntersected);
		// console.log({
		// 	intersection: loggableSet(multiSetIntersection),
		// 	intersecting: loggableSetOfSets(multiSetIntersected),
		// 	merged: loggableSet(mergedSet)
		// });
		// Remove these intersecting sets and put in our new larger set
		for (let set of multiSetIntersected) {
			resultSets.delete(set);
		}
		resultSets.add(mergedSet);

		// Check for any remaining intersections
		[multiSetIntersection, multiSetIntersected] = findAnyIntersection(resultSets);

		loopIndex++;
		checkLoop(loopIndex);
	}
	// We are left with a union.
	return multiSetIntersection;
}

export function order<T extends Context>(projects: Map<string, T>, id: string, including: boolean, above: boolean, below: boolean): Set<T> {
	const centerProject = projects.get(id);
	if (!centerProject) {
		exitError(`Project '${id}' does not exist`);
	}

	// Track map of project context to max distance from center project.
	// positive numbers are consumers; negative numbers are dependencies.
	const commandMap = new Map<T, number>();
	commandMap.set(centerProject, 0);

	/*
		Work from the project 'up' through consumers, marking
		consumers in the map.
		Use a number variable to indicate the 'degree'/'level'.
		If a consumer is found twice, use the later/higher level.
	*/
	if (above) {
		depthSearchTreeUp(0, centerProject, commandMap);
	}

	if (below) {
		depthSearchTreeDown(0, centerProject, commandMap);
	}

	if (!including) {
		commandMap.delete(centerProject);
	}

	const resultSet = new Set<T>();
	if (commandMap.size === 0) {
		return resultSet;
	}

	const invertedCommandMap = new Map<number, T[]>();
	commandMap.forEach((level, project) => {
		const projectsAtLevel = invertedCommandMap.get(level);
		if (projectsAtLevel) {
			projectsAtLevel.push(project);
		}
		else {
			invertedCommandMap.set(level, [project]);
		}
	});
	const keys = Array.from(invertedCommandMap.keys()).sort(function (a, b) { return a - b; });
	keys.forEach((key) => {
		const projectsAtLevel = invertedCommandMap.get(key)!;
		projectsAtLevel.forEach((project) => {
			resultSet.add(project);
		});
	});
	return resultSet;
}

const LOOP_SAFETY = 20;
function checkLoop(loopIndex: number) {
	if (loopIndex > LOOP_SAFETY) {
		exitError('Looped too many times without the right results');
	}
}

/** Intersects, maintaining the order of the first set. */
function intersect<T>(setA: Set<T>, setB: Set<T>): Set<T> {
	const intersection = new Set<T>();
	setA.forEach((item) => {
		if (setB.has(item)) {
			intersection.add(item);
		}
	});
	return intersection;
}

// function union<T>(setA: Set<T>, setB: Set<T>): Set<T> {
// 	const union = new Set<T>();
// 	setA.forEach((item) => {
// 		union.add(item);
// 	});
// 	setB.forEach((item) => {
// 		union.add(item);
// 	});
// 	return union;
// }

// function loggableSet<T extends Context>(set: Set<T>): string[] {
// 	const projects: string[] = [];
// 	set.forEach((project) => {
// 		projects.push(project.name);
// 	});
// 	return projects;
// }

// function loggableSetOfSets<T extends Context>(setOfSets: Set<Set<T>>): string[][] {
// 	const sets: string[][] = [];
// 	setOfSets.forEach((set) => {
// 		sets.push(loggableSet(set));
// 	});
// 	return sets;
// }

type SetUntilIterator<T> = (makeSetUntil: T | null) => Set<T>;

function makeSetUntilIterator<T>(set: Set<T>): SetUntilIterator<T> {
	const iterator = set.entries();
	return function (makeSetUntil: T | null) {
		let newSet = new Set<T>();
		// 'Done' isn't true on the last element.
		let nextItem = iterator.next();
		while (!nextItem.done) {
			const [item] = nextItem.value as [T, T];
			if (item === makeSetUntil) {
				break;
			}
			else {
				newSet.add(item);
			}
			nextItem = iterator.next();
		}
		return newSet;
	};
}

type MultiSetIntersection<T> = [Set<T>, Set<Set<T>> | false];
/**
 * Searches for an intersection between *any* of the sets.
 * As soon as one is found, all sets are found that contain that item.
 * Then, a set is made of *all* the intersecting elements in those sets.
 * The set of intersections is returned, along with all sets matched.
 * 
 * If no intersections are found, a union set is returned.
*/
function findAnyIntersection<T>(sets: Set<Set<T>>): MultiSetIntersection<T> {
	const unionSet = new Set<T>();
	let intersectedProject: T | null = null;
	for (let set of sets) {
		for (let project of set) {
			if (unionSet.has(project)) {
				// We found an intersection item.
				intersectedProject = project;
				break;
			}
			unionSet.add(project);
		}
		if (intersectedProject) {
			break;
		}
	}
	if (!intersectedProject) {
		// No set has anything in common. We are all done.
		return [unionSet, false];
	}
	// Track the intersection of intersecting sets.
	let scratchIntersectionOfIntersecting: Set<T> = null!;
	// Get all sets with this intersect item.
	const intersectingSets = new Set<Set<T>>();
	for (let set of sets) {
		if (set.has(intersectedProject)) {
			if (!scratchIntersectionOfIntersecting) {
				scratchIntersectionOfIntersecting = new Set(set);
			}
			intersectingSets.add(set);
		}
	}
	// Discard items from the intersection until it's just the intersection.
	const realIntersectionOfIntersecting = new Set(scratchIntersectionOfIntersecting);
	for (let set of intersectingSets) {
		scratchIntersectionOfIntersecting.forEach((item) => {
			if (!set.has(item)) {
				realIntersectionOfIntersecting.delete(item);
			}
		});
	}

	return [realIntersectionOfIntersecting, intersectingSets];
}

function smartMergeIntersectingSets<T>(intersection: Set<T>, intersectingSets: Set<Set<T>>): Set<T> {
	let sizeOfIntersections = 0;
	intersectingSets.forEach((set) => {
		sizeOfIntersections += set.size;
	});
	if (intersection.size === sizeOfIntersections) {
		// Great! This is all we needed.
		return intersection;
	}

	/*
		Yucky case - we have to do a smart k-way merge.
		This happens when the intersecting project of the sets is neither
		consumed nor dependant on every other project in the set.
		Example:
			intersecting set A: { 3, 7, 9, 10, 14 }
			intersecting set B: { 2, 7, 8, 10, 12 }
			intersection: 7 & 10.
		So now, build up a merged object from this.
	*/
	const merged = new Set<T>();
	let isFinished = false;
	const intersectionIterator = intersection.entries();
	const intersectingIterators = new Set<SetUntilIterator<T>>();
	for (let set of intersectingSets) {
		intersectingIterators.add(makeSetUntilIterator(set));
	}

	while (!isFinished) {
		const nextIntersection = intersectionIterator.next();
		if (nextIntersection.done) {
			isFinished = true;
			// Continue, to finish up
		}
		let nextIntersectionValue: T | null = null;
		if (nextIntersection.value) {
			nextIntersectionValue = nextIntersection.value[0];
		}

		for (let iterator of intersectingIterators) {
			const toAdd = iterator(nextIntersectionValue);
			for (let item of toAdd) {
				merged.add(item);
			}
		}

		if (nextIntersectionValue) {
			merged.add(nextIntersectionValue);
		}
	}
	return merged;
}


function depthSearchTreeUp<T extends Context>(level: number, project: T, map: Map<T, number>): void {
	const existingLevel = map.get(project);
	if (existingLevel === undefined || existingLevel === 0) {
		map.set(project, level);
	}
	else if (existingLevel < 0) {
		exitError(`Project ${project.name} is both a consumer and dependency`);
	}
	else if (existingLevel >= level) {
		// Do nothing, and don't follow.
		return;
	}
	else {
		// Project is closer along a different path. 
		map.set(project, level);
	}

	project.consumers.forEach((consumer) => {
		depthSearchTreeUp(level + 1, consumer, map);
	});
}

function depthSearchTreeDown<T extends Context>(level: number, project: T, map: Map<T, number>): void {
	const existingLevel = map.get(project);
	if (existingLevel === undefined || existingLevel === 0) {
		map.set(project, level);
	}
	else if (existingLevel > 0) {
		exitError(`Project ${project.name} is both a consumer and dependency`);
	}
	else if (existingLevel <= level) {
		// Do nothing, and don't follow.
		return;
	}
	else {
		// Project is closer along a different path. 
		map.set(project, level);
	}

	project.dependencies.forEach((dependency) => {
		depthSearchTreeDown(level - 1, dependency, map);
	});
}