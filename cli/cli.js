#!/usr/bin/env node
// @ts-check

const nmb = require('../dist/index');
const { parse } = nmb;

// /** @type {nmb.Schema} */
// const schema = {

// };

/** @type {string[]} */
// @ts-ignore
const args = process.argv;

// [0]node [1]cli.js [2]run ...
const commands = args.slice(2);

parse(commands.join(' '), {
	options: {
		currentDirectory: process.cwd()
	},
	schema: {
		pathRoot: '../../structure',
		scripts: {
			'build': 'npm run build'
		},
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
				scripts: {
					'build': 'npm run dev',
				}
			}
		}
	}
});