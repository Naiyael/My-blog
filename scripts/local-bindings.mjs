import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import path from 'node:path';
export function createLocalDB(filename=':memory:'){
  const sqlite=new DatabaseSync(filename);
  const prepare=sql=>{let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args),success:true};},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};};
  return {prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},exec:sql=>sqlite.exec(sql),close:()=>sqlite.close()};
}
export function localBucket(directory){fs.mkdirSync(directory,{recursive:true});return {
  async put(key,bytes,options){const file=path.join(directory,key);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);fs.writeFileSync(file+'.meta',JSON.stringify(options?.httpMetadata??{}));},
  async get(key){const file=path.join(directory,key);if(!fs.existsSync(file))return null;const bytes=fs.readFileSync(file);return {body:new Blob([bytes]).stream(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};},
  async delete(key){for(const suffix of ['','.meta']){const file=path.join(directory,key+suffix);if(fs.existsSync(file))fs.unlinkSync(file);}},
};}
