import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { inspect } from "util";

function getAllExpressionNodes(code: string): Parser.SyntaxNode[] {
  const parser = new Parser();
  const language = TypeScript.typescript;
  parser.setLanguage(language);

  const tree = parser.parse(code);
  const expressions: Parser.SyntaxNode[] = [];

  // https://tree-sitter.github.io/tree-sitter/playground
  // https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
  // Grammar definitions:
  //    https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L354
  //    https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js#L3
  const q = `(declaration (_) @decl)`;
  const query = new Parser.Query(parser.getLanguage(), q);

  for (const match of query.matches(tree.rootNode)) {
    expressions.push(match.captures[0].node);
  }

  return expressions;
}

// Your test input
const code = `class A {
private _isFrameBoundary(nodeId: string): boolean {
  const node = this._replayClient.getNode(nodeId);
  return node.nodeName.toLowerCase() === 'iframe';
}
}`;

const expressionNodes = getAllExpressionNodes(code);

// Pretty print the results
console.log(`Found ${expressionNodes.length} Expression Nodes:`);
expressionNodes.forEach((node, i) => {
  console.group(
    `${(i + "").padStart(3, "0")} ${node.text}`
  );
  console.log(inspect(node));
  console.groupEnd();
});
