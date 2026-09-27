import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('audits require full counts, explanations and authorized users; completed records are immutable', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated,anon;
 alter default privileges in schema public grant all on tables to authenticated;
 alter default privileges in schema public grant all on sequences to authenticated;`);
 for (const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 const uid='11111111-1111-4111-8111-111111111111';
 await db.query("insert into auth.users(id) values ($1)",[uid]);
 await db.query("update public.profiles set role='admin' where id=$1",[uid]);
 await db.exec("insert into public.materials(code,name) values ('AUDIT-TEST','Test material'); update public.inventory_audit_schedule set starts_on='2026-01-02'");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.exec('set role authenticated');
 const id=(await db.query("select public.start_inventory_audit('2026-01-02') id")).rows[0].id;
 assert.equal((await db.query("select public.start_inventory_audit('2026-01-02') id")).rows[0].id,id);
 const audit=(await db.query('select * from public.inventory_audits')).rows[0];
 const counts=audit.items.map(i=>({key:i.key,physical:0,reason:''}));
 await assert.rejects(db.query('select public.complete_inventory_audit($1,$2)',[id,JSON.stringify([])]),/todos/);
 counts[0].physical=1;
 await assert.rejects(db.query('select public.complete_inventory_audit($1,$2)',[id,JSON.stringify(counts)]),/Explique/);
 counts[0].reason='Material encontrado durante el conteo';
 await db.query('select public.complete_inventory_audit($1,$2)',[id,JSON.stringify(counts)]);
 const saved=(await db.query('select * from public.inventory_audits')).rows[0];
 assert.equal(saved.completed_by,uid); assert.equal(saved.items[0].difference,1);
 await assert.rejects(db.query('select public.complete_inventory_audit($1,$2)',[id,JSON.stringify(counts)]),/no está abierta/);
 await assert.rejects(db.query('delete from public.inventory_audits'),/permission denied/);
 await db.exec("reset role; update public.profiles set role='operario'; set role authenticated");
 await assert.rejects(db.query("select public.start_inventory_audit('2026-01-09')"),/No autorizado/);
 assert.equal((await db.query('select * from public.inventory_audits')).rows.length,0);
 } finally { await db.close(); }
});
