/** Explicit, non-shell project verification with source fingerprint binding.
 * Never invoked implicitly from prompt/context hooks. Custom commands only from
 * package.json scripts; non-Node adapters use fixed executable/argument lists.
 */
import { existsSync,readFileSync,readdirSync,lstatSync } from 'node:fs';
import { resolve,join,relative,basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ignored=new Set(['node_modules','.git','.ddd','dist','build','coverage','.next','.opencode','vendor','target','.venv','venv','__pycache__','.pytest_cache','.mypy_cache','.gradle']);
const roots=['package.json','package-lock.json','tsconfig.json','go.mod','go.sum','Cargo.toml','Cargo.lock','pom.xml','build.gradle','build.gradle.kts','gradlew','gradlew.bat','pyproject.toml','pytest.ini','requirements.txt','src','tests','test','app','lib','internal','cmd'];
export function fingerprint(root){
  const base=resolve(root),hash=createHash('sha256');let count=0,total=0;
  function walk(path){
    const stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error(`源码包含符号链接：${relative(base,path)}`);
    if(stat.isDirectory()){for(const entry of readdirSync(path).sort())if(!ignored.has(entry))walk(join(path,entry));}
    else if(stat.isFile()){
      if(stat.size>32*1024*1024)throw new Error(`源码文件过大，无法完整指纹：${relative(base,path)}`);
      if(++count>20_000 || (total+=stat.size)>256*1024*1024)throw new Error('源码规模超过校验上限，请使用外部 CI 生成有签名的可复验报告');
      hash.update(relative(base,path).replaceAll('\\','/')).update('\0').update(readFileSync(path));
    }
  }
  for(const item of roots){const path=join(base,item);if(existsSync(path))walk(path);}
  return {sha256:hash.digest('hex'),files:count};
}
/** Return a truthful "unverified" when no recognized tests exist. */
export function detectChecks(root){
  const has=name=>existsSync(join(root,name));
  if(has('package.json')){
    let pkg;try{pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));}catch(error){throw Error(`package.json 解析失败：${error.message}`);}
    const scripts=pkg.scripts??{};
    const names=['typecheck','lint','test'].filter(name=>typeof scripts[name]==='string'&&scripts[name].trim());
    return names.includes('test')?{kind:'npm',checks:names.map(name=>({name,command:'npm',args:['run',name]}))}:{kind:'npm',reason:'没有 npm test 脚本'};
  }
  if(has('go.mod'))return {kind:'go',checks:[{name:'go-test',command:'go',args:['test','./...']}]};
  if(has('Cargo.toml'))return {kind:'rust',checks:[{name:'cargo-test',command:'cargo',args:['test','--locked']}]};
  if(has('pom.xml'))return {kind:'maven',checks:[{name:'maven-test',command:has('mvnw')?'./mvnw':'mvn',args:['test','--batch-mode']}]};
  if(has('build.gradle')||has('build.gradle.kts'))return {kind:'gradle',checks:[{name:'gradle-test',command:has('gradlew')?(process.platform==='win32'?'gradlew.bat':'./gradlew'):'gradle',args:['test','--no-daemon']}]};
  if(has('pyproject.toml')||has('pytest.ini')||has('tests')){
    return {kind:'python',checks:[{name:'pytest',command:process.env.DDD_PYTHON||'python',args:['-m','pytest','-q']}]};
  }
  return {kind:'unknown',reason:'未识别可执行测试框架；使用外部 CI 验证后提供测试命令'};
}
export function verifyExecutable(root,{timeoutMs=180_000}={}){
  const base=resolve(root);
  let plan;
  try{plan=detectChecks(base);}catch(error){return {status:'failed',kind:'invalid',checks:[],reason:error.message,fingerprint:null};}
  if(!plan.checks?.length)return {status:'unverified',kind:plan.kind,checks:[],reason:plan.reason,fingerprint:null};
  let before;try{before=fingerprint(base);}catch(error){return {status:'failed',kind:plan.kind,checks:[],reason:error.message,fingerprint:null};}
  const checks=[];
  for(const item of plan.checks){
    const res=spawnSync(item.command,item.args,{cwd:base,encoding:'utf8',timeout:timeoutMs,maxBuffer:2*1024*1024,env:{...process.env,CI:'true'}});
    checks.push({name:item.name,passed:res.status===0&&!res.error,exitCode:res.status,signal:res.signal??null,
      output:String(res.stderr||'').slice(-500), ...(res.error?{error:String(res.error.message).slice(0,500)}:{})});
    if(!checks.at(-1).passed)break;
  }
  let after;try{after=fingerprint(base);}catch(error){return {status:'failed',kind:plan.kind,checks,reason:error.message,fingerprint:null};}
  if(before.sha256!==after.sha256)return {status:'failed',kind:plan.kind,checks,reason:'测试执行期间修改了源码/锁文件，证据已失效',fingerprint:after};
  const success=checks.length===plan.checks.length&&checks.every(item=>item.passed);
  return {status:success?'passed':'failed',kind:plan.kind,checks,reason:success?'':'编译、检查或测试未通过',fingerprint:after};
}
