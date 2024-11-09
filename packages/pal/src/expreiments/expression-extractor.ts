import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

// function getAllExpressionNodes(code: string): Parser.SyntaxNode[] {
//   const parser = new Parser();
//   parser.setLanguage(TypeScript.typescript);

//   const tree = parser.parse(code);
//   const expressions: Parser.SyntaxNode[] = [];

//   function traverse(node: Parser.SyntaxNode) {
//     console.log("traverse node:", node.constructor.name);
//     if (node.type.includes("expression")) {
//       expressions.push(node);
//     }

//     for (let child of node.children) {
//       traverse(child);
//     }
//   }

//   traverse(tree.rootNode);
//   return expressions;
// }

function getAllExpressionNodes(code: string): Parser.SyntaxNode[] {
  const parser = new Parser();
  const language = TypeScript.typescript;
  parser.setLanguage(language);

  const tree = parser.parse(code);
  const expressions: Parser.SyntaxNode[] = [];

  // https://tree-sitter.github.io/tree-sitter/playground
  const q = `(call_expression
  function: (_) @the-function
  arguments: (_) @args)`;
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
console.log("Found Expression Nodes:");
expressionNodes.forEach((node, index) => {
  console.log(`\nExpression #${index + 1}:`);
  console.log({
    type: node.type,
    text: node.text,
    startPosition: {
      row: node.startPosition.row,
      column: node.startPosition.column,
    },
    endPosition: {
      row: node.endPosition.row,
      column: node.endPosition.column,
    },
    parent: node.parent?.type || "none",
  });
});
