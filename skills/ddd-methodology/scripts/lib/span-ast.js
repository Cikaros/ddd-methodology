/**
 * 目标：签名级符合性校验各语言判据共享的 AST 遍历与取值工具，作为被两个语言规则模块依赖的基础能力独立成文件。
 * 范围：具名节点摊平、字段与类型取值、同节点身份判定、去重收集器。
 * 不包含：各语言对「什么算对外接口」的判据（见 span-langs.js 与 span-langs-convention.js）、解析器供给（见 span-parser.js）。
 */

// 深度优先收集全部具名节点：各语言判据都要按节点类型与可见性修饰筛选，先摊平再判
function allNodes(node, out = []) {
  out.push(node);
  for (const child of node.namedChildren) allNodes(child, out);
  return out;
}

const field = (node, name) => (node && node.childForFieldName ? node.childForFieldName(name) : null);
const text = (node) => (node ? node.text : "");
const kids = (node, type) => (node ? node.namedChildren.filter((child) => child.type === type) : []);
// 同一语法节点的两次取用会得到不同的包装对象，身份须按 id 判而非引用
const sameNode = (a, b) => !!a && !!b && a.id === b.id;

// 去重收集器：同一符号在 AST 中可能被两条判据同时命中，按名与文本去重
function makeCollector() {
  const out = [];
  const seen = new Set();
  const push = (name, params, returns) => {
    if (!name) return;
    const key = `${name}\u0000${params}\u0000${returns}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, params, returns });
  };
  return { out, push };
}

module.exports = { allNodes, field, text, kids, sameNode, makeCollector };
