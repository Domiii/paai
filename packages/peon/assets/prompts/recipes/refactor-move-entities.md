<!-- Based on https://claude.ai/chat/799fd47a-1119-4e22-bb68-0347ef9325c2 -->
<!-- TODO: Generalize for all files using templates. -->

## Instructions

* Let `FILE0="index.ts"`
* Refactor FILE0 into multiple files and folders.
* Each entity should be placed in its own file, unless it is very small.

## TODO

1. [artifact] Create an `entities` TABLE artifact of all entities `e` to be moved from FILE0 to a new file `file_e`. The rows should be in descending order of `line_no`, so when moving the first entity, it won't affect the other entities. Columns:
   * `entity` - Name of the entity to be moved.
   * `line_no` - First line number of entity in FILE0.
2. [artifact] Create a `file_tree` TABLE artifact to contain one row per new file. Columns:
  * `name` - File name.
  * `tags` - Relevant categorical tags. These should be used to determine the folder structure for the new files. Tags are allowed to be hierarchical. Tags should be ordered from "most important" to "least important" to clearly communicate which tags to prefer when determining the folder structure.
  * `contains` - List of `entities` that were moved into this file.
  * `exports` - List of `entities` it should export.
  * `imports` - List of `entities` it needs to import. Its file-external dependencies.
  * `path` - Relative path: The path's folders MUST BE based on `tags`; file based on `name`.
3. TODO: CHECK_WITH_USER.
4. [mechanical,loop] Foreach `e` in `entities`:
   * Place `e` in `file_e` (based of `path` in `file_tree`):
     * Import all of `e`'s external dependencies, if they are not already in `file_e`.
       * TODO: *file skeleton and static analysis tools*!
     * Place `e` in `file_e`.
       * If `e` is to stay in FILE0, move it to the very top of FILE0 instead.
     * If `e` is already in `file_e`, skip this step.
       * TODO: Need *file skeleton and static analysis tools* to do this cheaply.
   * Remove `e` from the end of FILE0.
