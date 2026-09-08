import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMoney, validDate, validateEntry, validateService, summarize, filterEntries, csv, today, quickEntry } from '../caixa/core.mjs';

const serviceId = '9a804ca7-32ca-4358-ae1a-22b54bcbe705';
const income = () => validateEntry({ kind: 'income', date: today(), payment: 'pix', items: [{ service_id: serviceId, name: 'Corte', price_cents: 3500, quantity: 2 }, { service_id: serviceId + 'b', name: 'Barba', price_cents: 2000, quantity: 1 }], discount_cents: 500 });
const expense = () => validateEntry({ kind: 'expense', date: today(), payment: 'cash', description: 'Lâminas', category: 'Produtos e materiais', amount_cents: 1500 });

test('valores monetários preservam centavos e rejeitam formatos ambíguos', () => {
  assert.equal(parseMoney('0,10'), 10);
  assert.equal(parseMoney('35.5'), 3550);
  assert.equal(parseMoney(' 200 '), 20000);
  for (const bad of ['-1', '1.234,56', '1e3', 'NaN', '', '1,234', 'Infinity']) assert.throws(() => parseMoney(bad));
  assert.equal(validateService({name:' Corte ',price_cents:35}).name, 'Corte');
  assert.throws(() => validateService({name:'Corte',price_cents:0}));
});
test('confirmar o pagamento gera um recebimento de hoje com o preço da tabela', () => {
  const entry = quickEntry({id:serviceId,name:'Corte simples',price_cents:2000,active:true},'cash');
  assert.equal(entry.amount_cents,2000);
  assert.equal(entry.items[0].quantity,1);
  assert.equal(entry.items[0].name,'Corte simples');
  assert.equal(entry.date,today());
  assert.equal(entry.payment,'cash');
  assert.equal(entry.discount_cents,0);
  assert.throws(()=>quickEntry({id:serviceId,name:'Corte simples',price_cents:2000,active:false},'cash'));
  assert.throws(()=>quickEntry({id:serviceId,name:'Corte simples',price_cents:2000,active:true},''));
});
test('datas inválidas e lançamentos futuros são rejeitados', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2025-02-29'), false);
  assert.equal(validDate('2026-13-01'), false);
  assert.throws(() => validateEntry({...expense(), date:'2100-01-01'}));
});
test('atendimento soma itens e desconto sem aceitar total adulterado', () => {
  const entry = income();
  assert.equal(entry.amount_cents, 8500);
  assert.equal(validateEntry({...entry, amount_cents:1}).amount_cents,8500);
  assert.throws(() => validateEntry({...entry,discount_cents:9000}));
  assert.throws(() => validateEntry({...entry,items:[]}));
  assert.throws(() => validateEntry({...entry,payment:'outro'}));
  assert.throws(() => validateEntry({...entry,items:[{...entry.items[0],quantity:1.5}]}));
});
test('resumo exclui cancelamentos e separa recebimentos das despesas', () => {
  const summary = summarize([income(), expense(), {...income(), canceled_at:new Date().toISOString()}]);
  assert.equal(summary.income, 8500); assert.equal(summary.expense, 1500); assert.equal(summary.net,7000);
  assert.equal(summary.count,1); assert.equal(summary.average,8500); assert.equal(summary.discounts,500);
  assert.equal(summary.payments.pix.income,8500); assert.equal(summary.payments.cash.expense,1500);
  assert.equal(summary.services[0].quantity,2); assert.equal(summary.services[0].gross,7000);
  assert.equal(summarize([]).average,0);
});
test('histórico respeita período, busca, tipo e cancelados', () => {
  const rows = [{...income(),date:'2025-01-01',created_at:'2025-01-01T10:00:00Z'}, {...expense(),date:'2025-02-01',created_at:'2025-02-01T10:00:00Z'}, {...income(),date:'2025-02-02',created_at:'2025-02-02T10:00:00Z',canceled_at:'2025-02-02T11:00:00Z'}];
  assert.equal(filterEntries(rows,{start:'2025-02-01',end:'2025-02-28'}).length,1);
  assert.equal(filterEntries(rows,{query:'LÂMINAS'})[0].kind,'expense');
  assert.equal(filterEntries(rows,{kind:'income',includeCanceled:true}).length,2);
});
test('exportação escapa aspas, separadores e fórmulas de planilha', () => {
  const output = csv([{...expense(),description:'=1+1',notes:'texto; "com aspas"\nlinha'}]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.ok(output.includes('"\'=1+1"'));
  assert.ok(output.includes('"texto; ""com aspas""\nlinha"'));
});
test('controles e referências do caixa correspondem ao HTML', () => {
  const html = readFileSync(new URL('../caixa/index.html',import.meta.url),'utf8');
  const app = readFileSync(new URL('../caixa/app.mjs',import.meta.url),'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  for (const match of app.matchAll(/\$\('#([a-z-]+)'\)/g)) assert.ok(ids.includes(match[1]),'Controle ausente: '+match[1]);
  for (const match of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(match[1]));
});
