<!-- Based on https://claude.ai/chat/799fd47a-1119-4e22-bb68-0347ef9325c2 -->
<!-- TODO: Generalize for all files using templates. -->

## Instructions

* Let `FILE0="index.ts"`
* Refactor FILE0 into multiple files and folders.
* Each entity should be placed in its own file, unless it is very small.

## TODO

1. Create an `entities` list artifact of all entities `e` to be moved from FILE0 to a new file `file_e`, but in reverse order of appearance in FILE0 (from bottom of FILE0 to top of FILE0).
2. Create a `file_tree` table artifact to contain one row per new file. Its columns are:
  * `name` - File name.
  * `tags` - Relevant categorical tags. These should be used to determine the folder structure for the new files. These means that tags can (implicitely) be sub-tags of other tags.
  * `imports` - Which entities it needs to import.
  * `exports` - Which entities it exports.
  * `contains` - The entities that were moved into this file.
  * `path` - Relative path: The path's folders MUST BE based on `tags`; file based on `name`.
3. TODO: CHECK_WITH_USER.
4. [mechanical,loop] Foreach `e` in `entities`:
   * Place `e` in `file_e` (based of `path` in `file_tree`):
     * Import all of `e`'s external dependencies, if they are not already in `file_e`.
     * Place `e` in `file_e`.
       * If `e` is to stay in FILE0, move it to the very top of FILE0 instead.
     * If `e` is already in `file_e`, skip this step.
       * TODO: Provide tools to cheaply check this:
         * -> file skeleton and static analysis tools!
   * Remove `e` from the end of FILE0.
