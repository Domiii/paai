<!-- First Requirements Draft on a Webpack + TS monorepo example project (not the actual prompt at all) -->

# SummarizeProject Tool Specification

## Purpose
To provide a comprehensive summary of a monorepo project's structure and configuration, focusing on webpack and related build processes. This summary enables AI models to make informed decisions when modifying webpack and other build-related files across the entire repository.

## Input
- Root directory path of the monorepo project

## Output
A structured JSON object containing the following information:
1. Project Structure
   - Overall monorepo layout
   - Package locations and their purposes
   - Shared resource locations
2. Webpack Configurations
   - List of all webpack config files (main and package-specific)
   - Content of each webpack config file
   - Custom plugins and loaders used
3. TypeScript Configurations
   - List of all tsconfig.json files
   - Content of each tsconfig.json
   - TypeScript version
4. Dependencies
   - Root `package.json` content
   - Package-specific `package.json` contents
   - Dependency tree and versions
5. Build Scripts
   - All npm scripts related to building/bundling
   - Content of any custom build scripts
6. Environment Information
   - Node.js versions
   - npm/Yarn versions
   - Any .env files or environment-specific or build-related configs
   - TODO: Gotta be careful with secrets.
7. Testing Setup
   - Jest configurations
   - Any webpack-specific test setups
8. Babel Configuration
   - All .babelrc or babel.config.js files
   - Babel plugins and presets used
9.  Asset Management
    - Configurations for handling various asset types
10. Monorepo Management
    - Tool in use (Lerna, Yarn Workspaces, etc.)
    - Its configuration and integration with webpack
11. Known Issues
    - List of reported build-related issues or constraints

## Implementation Details

1. File System Traversal:
   - Recursively traverse the project directory
   - Identify and categorize relevant files (webpack configs, `package.json`, tsconfig.json, etc.)
2. Config Parsing:
   - Parse JavaScript/JSON configuration files
   - Extract relevant information from each config type
3. Dependency Analysis:
   - Analyze `package.json` files to build a dependency graph
   - Determine versions and relationships between packages
4. Script Analysis:
   - Parse and categorize npm scripts
   - Identify build-related scripts and their purposes
5. Environment Detection:
   - Detect Node.js and package manager versions
   - Identify environment-specific configurations
TODO: more implementation steps to produce the complete output above.


## Generalization TODO

Generalization:

* Output:
  * Contents of root project (e.g. `package.json` or `pyproject.toml`) file.
  * Paths of all `package.json` files.
  * Maybe (where relevant): Paths of all build-related files
    * NOTE: We should find at least some of the root files in the project files.
    * E.g. relevant:
      * `webpack.*` and `babel*` files
      * `{t,j}sconfig.*` files
      * `jest.*` config files
      * `eslint*` files
  * 
