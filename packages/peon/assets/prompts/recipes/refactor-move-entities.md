<!-- Based on https://claude.ai/chat/799fd47a-1119-4e22-bb68-0347ef9325c2 -->
<!-- TODO: Generalize for all files using templates. -->

## Instructions

Refactor `index.ts` into multiple files and folders:

* Create a list of all top-level entities in `index.ts`. Annotate each entity with tags that best describe the entity.
* Create a JSON structure to represent the file tree, where each entity is in its own file, unless it is very small. For each file, list:
  * `tags`
  * `imports`
  * `contains` - The entities that were moved into this file.
  * `exports`
* TODO.
* In the modified version, index.ts should not have those exports anymore. It might also not need all those imports.
