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


// Get ids:
//   https://chatgpt.com/c/67307fc5-0550-8000-83f3-8e7f22eee941

for (const queryName of allQueryNames) {
  queryNodes(code, queryName);
}
