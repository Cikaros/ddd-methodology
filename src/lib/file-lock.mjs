/** Single cross-process lock primitive for JSONL, workflow and telemetry writers.
 * Reclaims only old locks owned by a provably dead PID; never follows symlinks.
 */
import {openSync,readFileSync,writeFileSync,closeSync,unlinkSync,existsSync,lstatSync,statSync,fstatSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
function alive(pid){if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(e){return e?.code==='EPERM';}}
export async function withFileLock(lock,action,{timeoutMs=3000,staleMs=60_000}={}){
  if(typeof lock!=='string'||!lock.endsWith('.lock'))throw Error('锁路径无效');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<25||timeoutMs>60_000)throw Error('锁等待预算非法');
  let fd;
  const attempts=Math.max(1,Math.ceil(timeoutMs/25));
  for(let i=0;i<attempts;i++){
    try{fd=openSync(lock,'wx',0o600);break;}
    catch(error){
      if(error?.code!=='EEXIST')throw error;
      try{
        const stat=lstatSync(lock);
        if(stat.isSymbolicLink())throw new Error('锁文件不能是符号链接');
        const pid=Number(readFileSync(lock,'utf8'));
        if(Date.now()-stat.mtimeMs>staleMs&&!alive(pid)){
          if(lstatSync(lock).ino===stat.ino)unlinkSync(lock);
          continue;
        }
      }catch(error){if(error?.message==='锁文件不能是符号链接')throw error;}
      await sleep(25);
    }
  }
  if(fd===undefined)throw Error('跨进程写锁超时');
  try{writeFileSync(fd,String(process.pid));return await action();}
  finally{
    const inode=fstatSync(fd).ino;
    closeSync(fd);
    try{if(existsSync(lock)&&lstatSync(lock).ino===inode)unlinkSync(lock);}catch{/* best effort */}
  }
}
