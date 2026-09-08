import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../caixa/core.mjs';

// A minimal DOM exercises the actual button handlers without opening a browser.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.dataset = {};
    this.className = ''; this.value = ''; this.style = {}; this.disabled = false;
    this.classList = {
      toggle: (name, force) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        const enabled = force ?? !names.has(name);
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(' '); return enabled;
      },
      add: name => this.classList.toggle(name, true),
      remove: name => this.classList.toggle(name, false)
    };
  }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tag === selector;
  }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    return this.children.flatMap(child => [...(selectors.some(value => child.matches(value)) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  focus() { this.focused = true; }
  click() { if (!this.disabled) return this.events.click?.[0]({ target: this, currentTarget: this }); }
}

test('painel abre sem lançar; pagamento salva uma vez; fechar e erro não criam entradas', async () => {
  const html = readFileSync(new URL('../caixa/index.html', import.meta.url), 'utf8');
  const root = new Element('document');
  for (const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"/g)) {
    const node = new Element(match[1]); node.id = match[2]; root.append(node);
  }
  const document = {
    querySelector: selector => root.querySelector(selector),
    querySelectorAll: selector => root.querySelectorAll(selector),
    createElement: tag => new Element(tag),
    getElementById: id => root.querySelector('#' + id),
    addEventListener: (...args) => root.addEventListener(...args)
  };
  const services = [
    { id: crypto.randomUUID(), name: 'Corte simples', price_cents: 2000, active: true },
    { id: crypto.randomUUID(), name: 'Barba', price_cents: 1500, active: true }
  ];
  const data = { services, entries: [], meta: {} };
  let saves = 0; let fail = false;
  const operationIds = [];
  const storage = {
    openDatabase: async () => data, snapshot: async () => data,
    saveEntry: async (entry, id) => {
      saves++; operationIds.push(id);
      if (fail) throw new Error('Falha de gravação');
      const record = { ...entry, id, created_at: new Date().toISOString(), canceled_at: null };
      data.entries.push(record); return record;
    }
  };
  const context = vm.createContext({ ...core, document, storage, crypto, Date, console, window: { addEventListener() {}, scrollTo() {} }, navigator: {}, setTimeout() {}, __data: data });
  const source = readFileSync(new URL('../caixa/app.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext('state.data = __data; renderQuick();', context);
  const card = id => document.getElementById('quick-service-' + id);
  const drawer = id => document.getElementById('quick-payment-' + id);
  card(services[0].id).click();
  assert.equal(saves, 0);
  assert.equal(card(services[0].id).attributes['aria-expanded'], 'true');
  assert.equal(drawer(services[0].id).inert, false);
  assert.deepEqual(drawer(services[0].id).querySelectorAll('.quick-payment-button').map(button => button.textContent), ['Pix', 'Dinheiro', 'Débito', 'Crédito']);
  card(services[1].id).click();
  assert.equal(card(services[0].id).attributes['aria-expanded'], 'false');
  assert.equal(drawer(services[0].id).inert, true);
  root.events.keydown[0]({ key: 'Escape', preventDefault() {} });
  assert.equal(card(services[1].id).attributes['aria-expanded'], 'false');
  assert.equal(saves, 0);
  card(services[0].id).click();
  const cash = drawer(services[0].id).querySelectorAll('.quick-payment-button')[1];
  const saving = cash.click();
  cash.events.click[0](); // Duplicate event during a pending write is ignored.
  await saving;
  assert.equal(saves, 1);
  assert.equal(data.entries[0].amount_cents, 2000);
  assert.equal(data.entries[0].payment, 'cash');
  assert.equal(card(services[0].id).attributes['aria-expanded'], 'false');
  card(services[1].id).click();
  fail = true;
  await drawer(services[1].id).querySelectorAll('.quick-payment-button')[0].click();
  assert.equal(data.entries.length, 1);
  assert.equal(card(services[1].id).attributes['aria-expanded'], 'true');
  fail = false;
  await drawer(services[1].id).querySelectorAll('.quick-payment-button')[0].click();
  assert.equal(data.entries.length, 2);
  assert.equal(operationIds[1], operationIds[2], 'Retry keeps the same operation identifier');
});
