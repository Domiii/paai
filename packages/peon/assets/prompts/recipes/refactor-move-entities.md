<!-- Based on https://claude.ai/chat/799fd47a-1119-4e22-bb68-0347ef9325c2 -->
<!-- TODO: Generalize for all files using templates. -->

## Instructions

* Let `THE_FILE="index.ts"`
* Refactor THE_FILE into multiple files and folders in multiple steps:

1. Create a `file_tree` artifact to represent, where each entity is in its own file, unless it is very small. For each new file (including the updated THE_FILE), make sure:
   * `name` - File name.
   * `tags` - Relevant categorical tags. These should be used to determine the folder structure for the new files. These means that tags can (implicitely) be sub-tags of other tags.
   * `imports` - Which entities it needs to import.
   * `exports` - Which entities it exports.
   * `contains` - The entities that were moved into this file.
   * `path` - Relative path; folders based on `tags`, file based on `name`.
2. TODO: CHECK_WITH_USER.
3. Use the tags to create the new folder structure, containing one empty file for each row in `file_tree`, located in `path`.
4. [mechanical,step-by-step] For each top-level entity in THE_FILE (go through it in reverse, start at the bottom, so line numbers don't change over time):
   * Move it into its respective new file.
     * If its to stay in THE_FILE, move it to the very top of THE_FILE instead.
   * Import all external dependencies.
   * Remove it from the end of THE_FILE.
   * Ultimately, THE_FILE is empty or almost empty.
