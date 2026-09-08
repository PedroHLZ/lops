import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { today, summarize } from '../caixa/core.mjs';
import * as store from '../caixa/storage.mjs';

test('ciclo completo: persistência, duplo clique, preços históricos, cancelamento e backup', async () => {
  await store.openDatabase();
  const service = await store.saveService({name:'Corte', price_cents:3500,active:true});
  const input = {kind:'income',date:today(),payment:'pix',items:[{service_id:service.id,name:service.name,price_cents:service.price_cents,quantity:1}],discount_cents:500,notes:'Teste'};
  const id = crypto.randomUUID();
  await Promise.all([store.saveEntry(input,id),store.saveEntry(input,id)]);
  let data = await store.snapshot();
  assert.equal(data.entries.length,1,'ID da operação impede duplicação');
  assert.equal(data.entries[0].amount_cents,3000);
  await store.saveService({name:'Corte atualizado',price_cents:4000,active:true},service.id);
  data = await store.snapshot();
  assert.equal(data.entries[0].items[0].price_cents,3500,'Preço anterior preservado');
  assert.equal(data.entries[0].items[0].name,'Corte');
  const backup = store.createBackup(data);
  const result = await store.restoreBackup(backup);
  assert.equal(result.entries,0,'Restaurar não duplica');
  await store.cancelEntry(id,'Valor registrado incorretamente');
  await assert.rejects(()=>store.cancelEntry(id,'Novo motivo'));
  await store.restoreBackup(backup);
  data = await store.snapshot();
  assert.ok(data.entries[0].canceled_at,'Backup antigo não desfaz cancelamento');
  assert.equal(summarize(data.entries).income,0);
  await store.archiveService(service.id,false);
  assert.equal((await store.snapshot()).services[0].active,false);
  assert.equal((await store.snapshot()).entries.length,1);
  const before = (await store.snapshot()).entries.length;
  const invalid = structuredClone(backup); invalid.entries[0].amount_cents = 1;
  assert.throws(()=>store.restoreBackup(invalid));
  assert.equal((await store.snapshot()).entries.length,before,'Backup inválido não altera dados');
  const imported = structuredClone(backup); imported.entries[0].id = crypto.randomUUID();
  assert.equal((await store.restoreBackup(imported)).entries,1);
  const final = await store.openDatabase();
  assert.equal(final.entries.length,2,'Reabrir o banco preserva registros');
});

test('backups externos precisam de versão, identificadores e totais válidos', () => {
  assert.throws(()=>store.validateBackup({}));
  assert.throws(()=>store.validateBackup({format:'lops-caixa',version:2,services:[],entries:[]}));
  assert.throws(()=>store.validateBackup({format:'lops-caixa',version:1,services:[{id:'inválido'}],entries:[]}));
  assert.deepEqual(store.validateBackup({format:'lops-caixa',version:1,services:[],entries:[]}),{services:[],entries:[]});
});
