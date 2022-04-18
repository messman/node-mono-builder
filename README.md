# node-mono-builder
A tool for managing local development of NodeJS monorepos.

**Note:** This project is primarily intended for the creator's use only and thus will likely not accept feature requests. Feel free to fork the project to suit it to your needs.

`npm install --save-dev @messman/node-mono-builder`

View on [npm](https://www.npmjs.com/package/@messman/node-mono-builder) or on [GitHub](https://github.com/messman/node-mono-builder).

## What?

This package exposes a library to:
- Run commands from the `package.json scripts` of local projects in dependency order
- Publish local projects to an internal repository like [Verdaccio](https://github.com/verdaccio/verdaccio) running on your machine or in Docker and pull in those published projects to consuming local projects with a single command (instead of using symlinks)

## Why?

Short answer: Monorepos are hard.

By 'monorepo', we mean we have a bunch of different packages in one big git repository. We treat each of these packages independently, for these benefits:
- Track down build errors more easily.
- Separate areas of the code that are related.
- Make some parts of the code 'private'.
- Use packages of code for different purposes in different situations.

Monorepos are hard to work with in Javascript/Typescript, because there is no built-in solution for local multi-package development. It can be tedious to ensure everything is working correctly.

Solutions that exist (npm7 workspaces, yarn workspaces, Lerna, Rush) all try to solve monorepo problems with the complexity of symbolic links (symlinking). These solutions all come with their own downsides. Also, these other tools usually get bloated and weighed down by features that attempt to satisfy the multiple workflows of NodeJS local monorepo development.

For full control, we have our own build management system. We can tweak it how we like to work for us.

Still, this project is not entirely necessary. It could be achieved with the help of other tools. This project exists in part as a learning opportunity for its creator.

## Sample Use Case

Picture the following setup:

```txt
monorepo/
	projects/
		projA/
			...
		projB/
			...
		projC/
			...
	tools/
		package.json (references this package)
		node-mono-builder.config.js
```

And let's say you know that `projB` has `projA` as a dependency and `projC` has both `projB` and `projA` as dependencies.

In `node-mono-builder.config.js`, you can declare the relationships of the projects in the monorepo:

```txt
(pseudocode)

pathRoot: '../',
projects: {
	'proj-a': {
		path: './projects/projA',
		build: 'npm run build'
	},
	'proj-b': {
		path: './projects/projB',
		build: 'npm run build'
	},
	'proj-c': {
		path: './projects/projC',
		build: 'npm run build'
	},
}

```

Then, in `monorepo/tools`, you can run a command like:

```
node-mono-builder build proj-c proj-b
```

The tool will analyze the monorepo by inspecting `package.json` of each listed project and create a dependency tree map. It will then build the projects in the right order regardless of the order they are listed in the input.

Different commands are available:
- Build one or more (or all) projects
- Publish / pull in one or more (or all) projects

## Other Pieces

This tool relies on the availability of `npm` and a tool like `verdaccio` to supply your private registry. See those projects for instructions on setting those up. This tool does not do anything special - just publishes, updates, and installs.

This tool does not actually build projects - it simply provides a top-level management interface for calling commands that will build them. Thus, in each of your projects, you may need to install dependencies like `webpack` or `TypeScript`. This tool does not cause `npm` to install packages in weird common shared locations - thus, you can easily switch between using the tool and manually using the commands defined in each project's `package.json`.

## API

Once you have installed the package in a directory and set up the config, you can call `parse` to parse text input from a command line.

Parsing works as follows:
- `help`: shows the help.
- `list`: lists projects with their dependencies. Useful for learning about the dependencies.
- `pushpull [projects]`: publishes a project to the registry, then pulls it into consuming projects. Also installs other packages.
	- Optional flag: `install` to also `npm install` on each affected project.
	- Optional flag: `dry-run` to list out the project names without actually affecting the projects.
- `run [script] [projects]`: runs a script (such as build) on projects. (Note, you'll need to `pushpull` built projects before you can use them other places.)
	- Optional flag: `pushpull` to also pushpull each affected project.
	- Optional flag: `install` to also `npm install` on each affected project.
	- Optional flag: `dry-run` to list out the project names without actually affecting the projects.

When referring to projects, you have options:
- You can pass a single project name, like `proj-a`.
- You can pass multiple project names separated by spaces, like `proj-a proj-b`.
- You can pass a modifier before a single project name, like `from proj-a` or `below proj-b`.
	- Modifiers include `from`, `to`, `above`, and `below`.
- You can pass `all` for all projects instead of a project name.

If listing multiple projects, they can be listed in any order. The system will automatically figure out dependency order by inspecting `package.json` dependencies.

Examples:
```sh

# In dependency order: build every project, publish it to the registry (if applicable), then run `npm update` in the consumer package to make it available there.
run build all --pushpull

# List every project and its dependencies.
list

# Build/push projA and then projB.
run build bridge-client bridge-iso --pushpull
```

## Behind The Scenes

To 'push' a package in this context of the build system means:
- Increment the version using `npm version`.
	- We actually tag the date onto the version so it's always higher. Something like `npm --no-git-tag-version version 1.0.0-$(date +%s)`
- Publish the package to a private registry (like `verdaccio`).
- Run `npm update [package]` in all **consumer** locations to download that latest package version there.

This is to essentially recreate the build systems of other environments like .NET's DLLs. It also is meant to replace the 'instantly ready' feeling of using symlinks with `npm link`, `npm install file:`, Lerna, etc.

## Why Not ____?

Symlinks. We don't use `npm link`, `npm install file:`, Lerna, Yarn, pnpm, or Rush because they all try to use symlinks to get around the problem.

Furthermore, we don't use tarballs (`npm pack`) for development instead of a private registry (`verdaccio`) because:
- `npm install` will wipe all installed tarballs, and possibly crash the VS Code TypeScript helper until it is restarted. An equivalent to `npm link` must be re-run to pull the tarballs back into the consumer without building.
- There is no identifier in the consumer `package.json` about what its dependencies are.
- No easy built-in F12 go-to-definition support (which means accidentally F12-ing will open the node_modules folder). This is a small thing, because it can be solved with `sourceRoot`.
- Peer dependencies must be manually tracked by the developer (or bundled with `bundleDependencies`), because otherwise `A` that depends on `B` that depends on `react` will fail because `react` is not explicitly installed on `A`. `peerDependencies` are not tracked, because the unpacking of the tarball is not an install by design.

## Symlinks

Symlink concerns have dominated the early development of this product. It seems a given that monorepos should use symlinking to reduce headaches with private registries... but in our experience, symlinks have only made for more trouble and hours of troubleshooting than should be necessary.

This section will not go into deep detail about the benefits of symlinking, but here are a few:
- F12 "go-to-definition" just works with no special setup.
- When a package is built, it is available in all symlinked locations immediately, and VSCode picks up on that within seconds. This means that as long as build commands are used, development is as seamless as if there were only one package.

That's about where the positives end. The rest of this section is about convincing you not to recommend using symlinks every again.

### Docker
(Note: if you keep the entire git directory in Docker, this problem doesn't apply.)

Docker has multiple problems with symlinking. Symlinks are not naturally copied over into containers from the host machine; they must be added through tricky use of bind mounts.

This means we had to specify the relationship of every symlink in the `docker-compose.yaml` as something like:
```yml
	volumes:
	# Root
	- ../:/usr/src/root:delegated
	# proj B
	- ../projects/projA:/usr/src/root/projects/projB/node_modules/projA:delegated
	# proj E
	- ../projects/projC:/usr/src/root/projects/projE/node_modules/projC:delegated
	- ../projects/projD:/usr/src/root/projects/projE/node_modules/projD:delegated
	# ...
```
Additionally, deleting any `node_modules` folder would break the mount, necessitating a rebuild of the container.

### npm

Symlinking in `npm` can happen in two ways:
- `npm link`, which symlinks to the `node_modules` but does not update the `package.json`
- `npm install file:`, which adds the package to `package.json` but still symlinks

It's been determined from our use of the two strategies that `npm install file:` is superior, since `npm link` symlinks are cleared on any `npm install` or deletion of `node_modules`.

Still, `npm` fails when it comes to dealing with `package-lock.json` with symlinks. Although the package is symlinked, the `package-lock.json` of the dependent local package A is not kept in sync with the `package-lock.json` of the dependent local package B. Thus, if `npm install` is run on package B's directory, package A's `node_modules` is updated because of it. So, every time a dependency is added to package A, every consuming package must run `npm update [package A]` to pull in that dependency. That can get tedious, and is already similar to just publishing the package every time *without* symlinks.

### Webpack and node_modules

Webpack is not made for symlinks. It has some support for them, but overall it expects to know exactly where all your code is. When symlinking was used, we needed to add code like the below to attempt to pull in the right versions of packages when there were version mismatches. Granted, we can still have this problem without symlinking - but it's more difficult with symlinking because synchronizing the packages required more steps.

```js
const webpackOptions = {
	// ...
	resolve: {
		// ...

		// See https://webpack.js.org/configuration/resolve/#resolve
		/*
			Discussion on symlinks:
			https://github.com/webpack/webpack/issues/554
			https://github.com/webpack/webpack/issues/985
			(MIT) https://github.com/niieani/webpack-dependency-suite/blob/master/plugins/root-most-resolve-plugin.ts
			https://github.com/npm/npm/issues/14325#issuecomment-285566020
			https://stackoverflow.com/a/57231875

			The gist: Only one copy of a package will be used,
			unless the package versions are different.
		*/
		symlinks: false,
		modules: [path.resolve('node_modules')]
	}
}
```

### OLD Idea 1: npm link

This plan involved using `npm link` to symlink a dependency into a consumer. For example:

```sh
# In the dependency, 'projA':
npm link

# In the consumer:
npm link projA
```

This creates a symlink. And note - this is through npm's global install space, not directly from one directory to the other.

Pros:
- Can list all dependencies in one spot.
- Symlinks allow for F12 go-to-definition.
- No transformations required to implement production build.

Cons:
- `npm install` will wipe all symlinks, and possibly crash the VS Code TypeScript helper until it is restarted. `npm link` must be re-run.
- There is no identifier in the consumer `package.json` about what its dependencies are.
- Symlinks will cause duplicate packages to be loaded unless changes are made to webpack configuration to always load packages from the top node_modules. (See #REF_SYMLINK_WEBPACK)
- Symlinks will fail in Docker unless a bind mount is created for each symlink to the host machine.

References:
- [npm link](https://docs.npmjs.com/cli/v6/commands/npm-link)
- [npm install](https://docs.npmjs.com/cli/v6/commands/npm-install)

### OLD Idea 2: npm pack and manual unpack

This plan involves using `npm pack` to create a tarball (similar to production), but manually unpacking that tarball in order to avoid a costly `npm install` on every change.

Pros:
- No symlinks!
- Can list all dependencies in one spot.
- No transformations required to implement production build.
- Close to production build pattern already.

Cons:
- `npm install` will wipe all installed tarballs, and possibly crash the VS Code TypeScript helper until it is restarted. An equivalent to `npm link` must be re-run to pull the tarballs back into the consumer without building.
- There is no identifier in the consumer `package.json` about what its dependencies are.
- No F12 go-to-definition support (which means accidentally F12-ing will open the node_modules folder).
- Peer dependencies must be manually tracked by the developer (or bundled with `bundleDependencies`), because otherwise `A` that depends on `B` that depends on `react` will fail because `react` is not explicitly installed on `A`. `peerDependencies` are not tracked, because the unpacking of the tarball is not an install by design.

References:
- [npm install](https://docs.npmjs.com/cli/v6/commands/npm-install)

### OLD Idea 3: npm install relative paths

This plan involves using relative paths in the `package.json` for a consumer to point to all local dependencies. For example:

```json
"dependencies": {
	"projA": "file:../projA",
}
```
(Note: the `file:` prefix is technically not required.)

In older versions of npm, this would copy the dependency into the consumer. Eventually, this became a symlink.

Pros:
- Can declare dependencies in the package.json, instead of somewhere else.
- Symlinks allow for F12 go-to-definition.
- Dependencies are not deleted from consumer when `npm install` is run, so `npm link` is not needed.
- PeerDependencies are checked.

Cons:
- Symlinks will cause duplicate packages to be loaded unless changes are made to webpack configuration to always load packages from the top node_modules. (See #REF_SYMLINK_WEBPACK)
- Symlinks will fail in Docker unless a bind mount is created for each symlink to the host machine.
- Will not work for a production build unless package.json files are transformed to exclude the relative paths. (Or, possibly, `npm uninstall` can be run to remove them before the production `npm install`.)
- If local package B depends on local package A, and the developer updates dependencies for package A, then the developer will also need to run `npm install [path-to-A]` on package B to update the `package-lock.json` of package B to reflect the new dependencies of package A. `npm update` does not cover this. (See the 'dependency updates' section of the general README.)

References:
- [npm install](https://docs.npmjs.com/cli/v6/commands/npm-install)

### History

Initially, the `npm link` pattern was used for this project. There were initial pains around webpack involving the double-dependency issue, particularly involving how `instanceof` wouldn't work in `zapatos` because there were two separate instances loaded. When Docker was added for development, `npm link` seemed like too tough to continue with, because a bind mount needed to be created for each dependency.

The build system was reconfigured to use the `npm pack` pattern, which initially seemed promising because the manual unpack was pretty fast. However, this quickly became a new pain because F12 go-to-definition no longer worked (since the unpacked tarball did not contain the source code, or if it did, the developer could not make changes that would be saved in the right source control file). 

Then, `npm install [folder]` pattern was attempted. this required two changes:
- bind mounts will be automatically created with a new build command. (Can be done eventually.)
- A new tool was needed to be created to transform package.json files in production (OR investigation can be done as to whether `npm uninstall` can be called on these local dependencies first to remove them from the package.json before the regular `npm install`).

## Troubleshooting

### Local packages don't exist in Verdaccio

If you've just cleared the Verdaccio repository, are using the Docker containers for the first time, or just pulled in someone else's git changes, the local packages in the projects' `package-lock.json` will have prerelease numbers (like `1.0.0-12387124241`) that don't map to any known package in Verdaccio. You'll need to push up your own local packages in the right order. You can do that with `make all` if you want to build, or `pushpull all` if you aren't ready to build yet. 

## References

- https://docs.docker.com/compose/extends/#multiple-compose-files
- https://docs.docker.com/compose/extends/#adding-and-overriding-configuration
- https://carnage.github.io/2019/07/local-development