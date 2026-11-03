/**
 * 目标：把规范「对外接口的语言约定」节中依据为约定（而非语言语义）的两种语言——Python 与 Go——的判据落成 AST 提取规则。
 * 范围：Python 的 `__all__` 与 `_` 前缀约定、Go 的首字母大写约定，产出符号名、形参文本与返回标注文本。
 * 不包含：显式导出标记语言（见 span-langs.js）、共享工具（见 span-ast.js）、驱动与规范化（见 span-extract.js）。
 * 依据性质：二者约定不成立时不得猜测，由上层报「无法判定」。
 */

const { field, text, kids, makeCollector } = require("./span-ast.js");

// ---- Python：优先模块级 __all__，无则取不以 _ 前缀开头的顶层定义 ----
function stripPyString(literal) {
  return String(literal).replace(/^[A-Za-z]*("""|'''|"|')|("""|'''|"|')$/g, "");
}

function collectPy(root) {
  const { out, push } = makeCollector();
  const defs = new Map();
  let declared = null;
  for (const node of root.namedChildren) {
    if (node.type === "function_definition" || node.type === "class_definition") {
      const name = field(node, "name");
      if (name) defs.set(name.text, node);
    }
    if (node.type !== "expression_statement") continue;
    const assignment = kids(node, "assignment")[0];
    if (!assignment) continue;
    const left = field(assignment, "left");
    const right = field(assignment, "right");
    if (left && left.type === "identifier" && left.text === "__all__" && right && right.type === "list") {
      declared = right.namedChildren.filter((child) => child.type === "string").map((child) => stripPyString(child.text));
    }
  }
  if (declared) {
    for (const name of declared) {
      const node = defs.get(name);
      push(name, node ? text(field(node, "parameters")) : "", node ? text(field(node, "return_type")) : "");
    }
    return out;
  }
  for (const [name, node] of defs) {
    if (name.startsWith("_")) continue;
    push(name, text(field(node, "parameters")), text(field(node, "return_type")));
  }
  return out;
}

// ---- Go：包内首字母大写的标识符 ----
const isGoExported = (name) => /^[A-Z]/.test(name);

function collectGo(root) {
  const { out, push } = makeCollector();
  for (const node of root.namedChildren) {
    if (node.type === "function_declaration" || node.type === "method_declaration") {
      const name = field(node, "name");
      if (name && isGoExported(name.text)) push(name.text, text(field(node, "parameters")), text(field(node, "result")));
    } else if (node.type === "type_declaration") {
      for (const spec of kids(node, "type_spec")) {
        const name = field(spec, "name");
        if (name && isGoExported(name.text)) push(name.text, "", "");
      }
    } else if (node.type === "var_declaration" || node.type === "const_declaration") {
      for (const spec of node.namedChildren) {
        const name = field(spec, "name");
        if (name && isGoExported(name.text)) push(name.text, "", "");
      }
    }
  }
  return out;
}

module.exports = { collectPy, collectGo };
