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
	 * A dictionary of scripts to run in each selected project. These scripts
	 * can be overridden at the project schema level or may point to `package.json`
	 * scripts that can have different definitions.
	 * 
	 * Example: 
	 * ```
	 * 'build': 'npm run build'
	 * ```
	*/
	scripts?: { [scriptName: string]: string; };
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
	 * Overrides from the `run` property that are specific to this project.
	 */
	scripts?: { [scriptName: string]: string; };
}