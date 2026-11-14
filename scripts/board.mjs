/** Board CLI: all mutations happen inside one lock, backed by strict history replay. */
import { readFileSync,existsSync } from 'node:fs';
import { join,resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { project,projectAll,admit,canTransition,summarize,validateBoardHistory } from '../src/lib/board.ts';
import { readBoardRows,withBoardLock,appendBoardRow,writeBoardView,boardPaths } from '../src/lib/board-store.mjs';
const pkg=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(readFileSync(join(pkg,'assets/board.json'),'utf8'));
const [sub,...argv]=process.argv.slice(2);
function argsOf(argv){const result={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--'))throw Error(`未知参数：${argv[i]}`);const k=argv[i].slice(2);result[k]=(argv[i+1]&&!argv[i+1].startsWith('--'))?argv[++i]:true;}return result;}
function required(a,key){if(typeof a[key]!=='string'||!a[key].trim())throw Error(`缺少 --${key}`);return a[key].trim();}
function cell(s){return String(s??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');}
function render(rows){const items=project(rows),sum=summarize(projectAll(rows));return ['<!-- 派生视图，由 scripts/board.mjs replay 生成；禁手改 -->','# 看板（BOARD.md）','',`待办 ${sum.pending} / 进行 ${sum.inProgress} / 阻塞 ${sum.blocked}`,'','| 位次 | taskId | 优先级 | 状态 | 标题 | 验收 |','|---|---|---|---|---|---|',...items.map((x,i)=>`| ${i+1} | ${x.taskId} | ${x.priority} | ${x.status} | ${cell(x.title)} | ${cell(x.acceptance)} |`),''].join('\n');}
function nextSeq(rows){return (rows.at(-1)?.seq??0)+1;}
function rowBase(kind,taskId,seq){return {kind,taskId,seq,ts:new Date().toISOString()};}
function nextRow(sub,a,rows){const live=projectAll(rows),visible=project(rows),seq=nextSeq(rows);let row;
  if(sub==='add'){
    const taskId=typeof a.task==='string'?a.task:`BRD-${String(seq).padStart(4,'0')}`;
    if(live.some(x=>x.taskId===taskId))throw Error(`任务已存在：${taskId}`);
    row={...rowBase('task',taskId,seq),title:required(a,'title'),acceptance:required(a,'acceptance'),reqId:typeof a.req==='string'?a.req:null,priority:typeof a.priority==='string'?a.priority:cfg.defaultPriority,status:'pending',dependsOn:typeof a.depends==='string'?a.depends.split(',').map(x=>x.trim()).filter(Boolean):[],reason:typeof a.reason==='string'?a.reason:undefined};
    const verdict=admit(row,live,cfg);if(!verdict.ok)throw Error(`准入拒绝：${verdict.reason}`);
  }else{
    const taskId=required(a,'task'),cur=live.find(x=>x.taskId===taskId);
    if(!cur)throw Error(`任务不存在或已归档：${taskId}`);
    if(sub==='move'){
      const to=required(a,'to');if(!cfg.statusDomain.includes(to)||!canTransition(cur.status,to))throw Error(`非法转移：${cur.status} → ${to}`);
      row={...rowBase('move',taskId,seq),from:cur.status,to,reason:typeof a.reason==='string'?a.reason:undefined};
    }else if(sub==='evidence')row={...rowBase('evidence',taskId,seq),evidence:required(a,'evidence')};
    else if(sub==='archive'){
      if(cur.status!=='done'&&cur.status!=='dropped')throw Error('仅 done/dropped 可归档');
      row=rowBase('archive',taskId,seq);
    }else if(sub==='rehome')row={...rowBase('task',taskId,seq),reqId:required(a,'req'),title:cur.title,acceptance:cur.acceptance,priority:cur.priority,status:cur.status,dependsOn:cur.dependsOn,reason:'rehome'};
    else throw Error(`未知子命令 ${sub}`);
  }
  validateBoardHistory([...rows,row]);return row;
}
async function main(){if(!sub)throw Error('缺少子命令');const a=argsOf(argv);const root=resolve(typeof a.root==='string'?a.root:process.cwd());const {md}=boardPaths(root);
  if(sub==='reconcile'||sub==='replay'){
    const rows=readBoardRows(root,cfg.maxLineBytes);
    if(sub==='reconcile'){
      const all=projectAll(rows),count=all.filter(x=>x.reqId===null).length;
      console.log(`reconcile OK：${all.length} 活跃项，${count} 项 reqId:null（收尾前须 rehome/drop）。`);return;
    }
    const expected=render(rows);
    if(a.check){if(!existsSync(md)||readFileSync(md,'utf8').replace(/\r\n/g,'\n').trim()!==expected.trim())throw Error('派生视图与重放不一致（不会自动覆盖）；先运行 replay');console.log('replay --check OK');}
    else{await withBoardLock(root,()=>writeBoardView(root,render(readBoardRows(root,cfg.maxLineBytes))));console.log('replay 已写出 BOARD.md');}return;
  }
  if(!['add','move','evidence','archive','rehome'].includes(sub))throw Error(`未知子命令 ${sub}`);
  await withBoardLock(root,()=>{
    const rows=readBoardRows(root,cfg.maxLineBytes);
    const row=nextRow(sub,a,rows);
    appendBoardRow(root,row,cfg.maxLineBytes);
    writeBoardView(root,render([...rows,row]));
    console.log(`已执行 ${sub} ${row.taskId}`);
  });
}
main().catch(e=>{console.error(`失败：${e.message}`);process.exitCode=1;});
