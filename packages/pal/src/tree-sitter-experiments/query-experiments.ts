import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

// https://tree-sitter.github.io/tree-sitter/playground
// https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
// Grammar definitions:
//    https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L354
//    https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js#L3
const queries: Record<string, string> = {
  expressions: `(expression) @expression`,
  declarationNames: `(_
  name: (identifier) @name
  (#has-ancestor? @name declaration))`,
};
const allQueryNames = Object.keys(queries);

function queryNodes(code: string, queryName: string): Parser.SyntaxNode[] {
  const parser = new Parser();
  const language = TypeScript.typescript;
  parser.setLanguage(language);

  const tree = parser.parse(code);
  const results: Parser.SyntaxNode[] = [];

  const query = queries[queryName];
  const q = new Parser.Query(parser.getLanguage(), query);

  for (const match of q.matches(tree.rootNode)) {
    results.push(match.captures[0].node);
  }

  // Pretty print the results
  console.group(`\n\nFound ${results.length} ${queryName} results:`);
  results.forEach((node, i) => {
    console.log(
      `${(i + "").padStart(3, "0")} ${node.text.replaceAll("\n", "\\n")}`,
      JSON.stringify({
        type: node.type,
        startPosition: {
          row: node.startPosition.row,
          column: node.startPosition.column,
        },
        parent: node.parent?.type || "none",
      })
    );
  });
  console.groupEnd();

  return results;
}

// Your test input
const code = `class A {
private _isFrameBoundary(nodeId: string): boolean {
  const node = this._replayClient.getNode(nodeId);
  return node.nodeName.toLowerCase() === 'iframe';
}
}`;


// Build symbol table and scope trees:
//   https://chatgpt.com/c/67307fc5-0550-8000-83f3-8e7f22eee941

// Note:
// How Language Servers Use Tree-sitter
// Language servers (like those used in VSCode) utilize Tree-sitter for parsing but implement additional layers for semantic analysis:

// Parsing: Tree-sitter provides fast and incremental parsing to generate syntax trees.

// Semantic Analysis: Language servers build upon these trees to perform symbol resolution, type inference, and other analyses.

// Features Implementation: Using semantic information, they provide features like "Go to Definition," "Find References," and code completion.

// Example:

// Tree-sitter in Language Servers: The nvim-treesitter project integrates Tree-sitter into Neovim, providing syntax highlighting and code navigation features.

// Symbol Resolution: Language servers often have dedicated components that handle symbol tables, scopes, and type information.



for (const queryName of allQueryNames) {
  queryNodes(code, queryName);
}
