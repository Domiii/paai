<!-- Based on https://claude.ai/chat/799fd47a-1119-4e22-bb68-0347ef9325c2 -->
<!-- TODO: Generalize for all files using templates. -->

## Instructions

Refactor `index.ts` into multiple files and folders:

1. We want to move all top-level entities out of `index.ts` into their own
2. Create a JSON structure to represent the new file tree, where each entity is in its own file, unless it is very small. For each new file (including the updated `index.ts`), make sure:
   * `tags` - Relevant tags.
   * `imports` - Which entities it needs.
   * `contains` - The entities that were moved into this file.
   * `exports`
3. Start moving all top-level entities from `index.ts` into their respective new file and folder:
   1. Use the tags to create the folder structure.
   2. index.ts should not have the moved top-level entities anymore.
   3. All files should have all the imports that they need.
4. Add unit tests for all new files, if they don't require a model API (or anything else that requires secrets) to run.
5. Make sure, the unit tests pass.
