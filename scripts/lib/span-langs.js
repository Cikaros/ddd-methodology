/**
 * 目标：把规范「对外接口的语言约定」节的显式导出标记白名单落成 AST 提取规则，并装配六语言的提取分派。
 * 范围：TypeScript、JavaScript、Java、Rust 的判据（依据为语言语义），加 Python、Go（见 span-langs-convention.js）的装配与分派。
 * 不包含：AST 共享工具（见 span-ast.js）、驱动与规范化（见 span-extract.js）、解析器供给（见 span-parser.js）、比对（见 span-compare.js）。
 * 判据：严格取规范「对外接口的语言约定」节的白名单，不额外放宽。
 */

const { allNodes, field, text, kids, sameNode, makeCollector } = require("./span-ast.js");
const { collectPy, collectGo } = require("./span-langs-convention.js");

// ---- TypeScript：带 export 语句的声明，以及带 accessibility_modifier 的 public 成员 ----
function addTsDecl(node, push) {
  switch (node.type) {
    case "function_declaration":
    case "generator_function_declaration": {
      const name = field(node, "name");
      push(name ? name.text : "default", text(field(node, "parameters")), text(field(node, "return_type")));
      break;
    }
    case "class_declaration":
    case "abstract_class_declaration": {
      const name = field(node, "name");
      push(name ? name.text : "default", "", "");
      break;
    }
    case "method_definition": {
      push(text(field(node, "name")), text(field(node, "parameters")), text(field(node, "return_type")));
      break;
    }
    case "public_field_definition": {
      push(text(field(node, "name")), "", "");
      break;
    }
    case "lexical_declaration":
    case "variable_declaration": {
      for (const declarator of kids(node, "variable_declarator")) {
        const value = field(declarator, "value");
        const isFunction = value && (value.type === "arrow_function" || value.type === "function_expression" || value.type === "function");
        push(text(field(declarator, "name")), isFunction ? text(field(value, "parameters")) : "", isFunction ? text(field(value, "return_type")) : "");
      }
      break;
    }
    case "interface_declaration":
    case "type_alias_declaration":
    case "enum_declaration":
    case "module":
    case "internal_module": {
      push(text(field(node, "name")), "", "");
      break;
    }
  }
}

function collectTs(root) {
  const { out, push } = makeCollector();
  for (const node of allNodes(root)) {
    if (node.type === "export_specifier") { push(text(field(node, "name")), "", ""); continue; }
    const isExportedDecl = node.parent && node.parent.type === "export_statement" && sameNode(field(node.parent, "declaration"), node);
    const access = node.type === "method_definition" || node.type === "public_field_definition" ? kids(node, "accessibility_modifier")[0] : null;
    if (!isExportedDecl && !(access && access.text === "public")) continue;
    addTsDecl(node, push);
  }
  return out;
}

// ---- JavaScript：export 语句，以及 module.exports 与 exports.x 两种表达式形态 ----
function memberPath(node) {
  if (node.type === "identifier" || node.type === "property_identifier") return [node.text];
  if (node.type === "member_expression") {
    const object = memberPath(field(node, "object"));
    const property = field(node, "property");
    return object && property ? [...object, property.text] : null;
  }
  return null;
}

function objectKeys(object) {
  const keys = [];
  for (const child of object.namedChildren) {
    if (child.type === "shorthand_property_identifier") keys.push(child.text);
    else if (child.type === "pair") keys.push(text(field(child, "key")));
    else if (child.type === "method_definition") keys.push(text(field(child, "name")));
  }
  return keys;
}

function addJsDecl(node, push) {
  switch (node.type) {
    case "function_declaration":
    case "generator_function_declaration": {
      const name = field(node, "name");
      push(name ? name.text : "default", text(field(node, "parameters")), "");
      break;
    }
    case "class_declaration": {
      const name = field(node, "name");
      push(name ? name.text : "default", "", "");
      break;
    }
    case "lexical_declaration":
    case "variable_declaration": {
      for (const declarator of kids(node, "variable_declarator")) {
        const value = field(declarator, "value");
        const isFunction = value && (value.type === "arrow_function" || value.type === "function_expression" || value.type === "function");
        push(text(field(declarator, "name")), isFunction ? text(field(value, "parameters")) : "", "");
      }
      break;
    }
  }
}

function collectJs(root) {
  const { out, push } = makeCollector();
  for (const node of allNodes(root)) {
    if (node.type === "export_specifier") { push(text(field(node, "name")), "", ""); continue; }
    if (node.parent && node.parent.type === "export_statement" && sameNode(field(node.parent, "declaration"), node)) { addJsDecl(node, push); continue; }
    if (node.type !== "assignment_expression") continue;
    const left = field(node, "left");
    const right = field(node, "right");
    if (!left || left.type !== "member_expression") continue;
    const chain = memberPath(left);
    if (!chain || (chain[0] !== "module" && chain[0] !== "exports")) continue;
    if (chain.length === 2 && chain[0] === "module" && chain[1] === "exports") {
      if (right && right.type === "object") for (const key of objectKeys(right)) push(key, "", "");
      else if (right && (right.type === "function_expression" || right.type === "arrow_function")) push(text(field(right, "name")) || "default", text(field(right, "parameters")), "");
      else push("default", "", "");
    } else {
      push(chain[chain.length - 1], "", "");
    }
  }
  return out;
}

// ---- Java：带 public 修饰的声明 ----
function isPublic(node) {
  const modifiers = kids(node, "modifiers")[0];
  return !!modifiers && /\bpublic\b/.test(modifiers.text);
}

function collectJava(root) {
  const { out, push } = makeCollector();
  for (const node of allNodes(root)) {
    if (!isPublic(node)) continue;
    switch (node.type) {
      case "class_declaration":
      case "interface_declaration":
      case "enum_declaration":
      case "record_declaration":
      case "annotation_type_declaration": {
        push(text(field(node, "name")), "", "");
        break;
      }
      case "method_declaration": {
        push(text(field(node, "name")), text(field(node, "parameters")), text(field(node, "type")));
        break;
      }
      case "constructor_declaration": {
        push(text(field(node, "name")), text(field(node, "parameters")), "");
        break;
      }
      case "field_declaration": {
        for (const declarator of kids(node, "variable_declarator")) push(text(field(declarator, "name")), "", "");
        break;
      }
    }
  }
  return out;
}

// ---- Rust：带 pub 的项，含 pub(crate) 等受限形式 ----
function collectRust(root) {
  const { out, push } = makeCollector();
  for (const node of allNodes(root)) {
    if (!kids(node, "visibility_modifier")[0]) continue;
    if (node.type === "function_item") {
      push(text(field(node, "name")), text(field(node, "parameters")), text(field(node, "return_type")));
    } else if (["struct_item", "enum_item", "union_item", "trait_item", "type_item", "const_item", "static_item"].includes(node.type)) {
      push(text(field(node, "name")), "", "");
    }
  }
  return out;
}

// 单一分派：代码文件与 DESIGN 签名片段共用同一套语言判据
const COLLECTORS = { typescript: collectTs, javascript: collectJs, python: collectPy, java: collectJava, go: collectGo, rust: collectRust };

function collectSymbols(language, root) {
  const collector = COLLECTORS[language];
  return collector ? collector(root) : [];
}

module.exports = { collectSymbols };
