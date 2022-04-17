/**
 * The set of options that acts as a layout of
 * the project structure.
 */
export interface Schema {
	/**
	 * Relative path that is prepended to all paths inside the
	 * project configurations.
	*/
	pathRoot?: string;
	/**
	 * Projects. The key is an alias or shorthand for the project name,
	 * and is how it is referred in the commands.
	 */
	projects?: {
		[projectName: string]: ProjectSchema;
	};
}

export interface ProjectSchema {
	/** The relative path from the path root to this project's directory. */
	path?: string;
	/**
	 * A custom command to be executed as the build step.
	 * If not specified, the default is 'npm run build'.
	 */
	developmentBuild?: string;
	/**
	 * A custom command to be executed as the build step.
	 * If not specified, the default is 'npm run build-production'.
	 */
	productionBuild?: string;
}