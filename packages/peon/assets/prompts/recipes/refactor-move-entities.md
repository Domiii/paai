<!-- Based on https://claude.ai/chat/799fd47a-1119-4e22-bb68-0347ef9325c2 -->
<!-- TODO: Generalize for all files using templates. -->

## Instructions

Refactor this file (`index.ts`) into multiple files and folders:

1. We want to move all top-level entities out of `index.ts` into their own
2. Create a JSON structure to represent the new file tree, where each entity is in its own file, unless it is very small. For each new file (including the updated `index.ts`), make sure:
   * `tags` - Relevant categorical tags. These should be used to determine the folder structure for the new files.
   * `imports` - Which entities it needs.
   * `contains` - The entities that were moved into this file.
   * `exports`
3. Use the tags to suggest a new folder structure.
   * Don't add index.ts into the new folders.
5. Start moving all top-level entities from `index.ts` into their respective new file and folder. Make sure that:
   * `index.ts` should not have the moved top-level entities anymore.
   * All files should have all the imports that they need.
6. Add unit tests for all new files, if they don't require a model API (or anything else that requires secrets) to run.
7. Make sure, the unit tests pass.
