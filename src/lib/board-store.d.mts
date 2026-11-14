import type { BoardRow } from './board.ts';
export function assertLocalPath(root: string,path: string): void;
export function boardPaths(root: string): {jsonl:string;md:string};
export function readBoardRows(root: string,maxLineBytes?:number): BoardRow[];
export function withBoardLock<T>(root:string,action:()=>Promise<T>|T, options?:{timeoutMs?:number}):Promise<T>;
export function appendBoardRow(root:string,row:BoardRow,maxLineBytes?:number):void;
export function writeBoardView(root:string,content:string):void;
