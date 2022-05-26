// @ts-check 
const nmb = require('../dist/index');

/** @type {{ [key: string]: string[] }} */
const dependencies = {
	'assets': [],
	'client': ['iso', 'server'],
	'iso': [],
	'server': ['iso'],
	'server-http': ['iso', 'server']
};
const names = Object.keys(dependencies);

const orderKeys = names; //['assets', 'iso', 'server'];

/** @type {Map<string, nmb.Context<nmb.Context>>} */
const map = new Map();

names.forEach((key) => {
	map.set(key, {
		name: key,
		consumers: new Set(),
		dependencies: new Set()
	});
});
names.forEach((key) => {
	const currentContext = map.get(key);
	const dependenciesArray = dependencies[key];
	dependenciesArray.forEach((dependency) => {
		const dependencyContext = map.get(dependency);
		currentContext.dependencies.add(dependencyContext);
		dependencyContext.consumers.add(currentContext);
	});
});

const resultSet = nmb.orderMultiple(map, orderKeys);

Array.from(resultSet).forEach((context) => {
	console.log(`- ${context.name}`);
});