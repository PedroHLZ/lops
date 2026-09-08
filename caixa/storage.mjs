import { validateEntry, validateService } from './core.mjs';

const DATABASE = 'lops-caixa-local-v1';
const STORES = ['services', 'entries', 'meta'];
export const BACKUP_LIMIT = 20 * 1024 * 1024;
let database;
const requestValue = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
function transact(stores, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    let result;
    let error;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(error || transaction.error || new Error('Não foi possível salvar.'));
    transaction.onabort = () => reject(error || transaction.error || new Error('Operação interrompida. Nenhum registro foi alterado.'));
    Promise.resolve(operation(transaction)).then(value => { result = value; }).catch(cause => {
      error = cause;
      try { transaction.abort(); } catch { reject(cause); }
    });
  });
}
export async function openDatabase() {
  if (!globalThis.indexedDB) throw new Error('Este navegador não oferece armazenamento para o caixa. Abra em um navegador atualizado.');
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      for (const store of STORES) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    request.onerror = () => reject(new Error('O navegador bloqueou o armazenamento. Saia do modo privado e tente novamente.'));
    request.onblocked = () => reject(new Error('Feche as outras abas do caixa e abra novamente.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
  return snapshot();
}
export function snapshot() {
  return transact(STORES, 'readonly', async transaction => {
    const [services, entries, meta] = await Promise.all(STORES.map(name => requestValue(transaction.objectStore(name).getAll())));
    return { services, entries, meta: Object.fromEntries(meta.map(item => [item.id, item.value])) };
  });
}
export function setMeta(id, value) {
  return transact(['meta'], 'readwrite', transaction => transaction.objectStore('meta').put({ id, value }));
}
export function saveService(input, id = null) {
  const valid = validateService(input);
  return transact(['services'], 'readwrite', async transaction => {
    const store = transaction.objectStore('services');
    const previous = id ? await requestValue(store.get(id)) : null;
    if (id && !previous) throw new Error('Serviço não encontrado. Atualize o caixa.');
    const record = { ...valid, id: id || crypto.randomUUID(), created_at: previous?.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
    store.put(record);
    return record;
  });
}
export function archiveService(id, active) {
  return transact(['services'], 'readwrite', async transaction => {
    const store = transaction.objectStore('services');
    const record = await requestValue(store.get(id));
    if (!record) throw new Error('Serviço não encontrado.');
    store.put({ ...record, active, updated_at: new Date().toISOString() });
  });
}
export function saveEntry(input, id) {
  const valid = validateEntry(input);
  return transact(['entries'], 'readwrite', async transaction => {
    const store = transaction.objectStore('entries');
    // A repeated save with the same operation ID never creates a second payment.
    const previous = await requestValue(store.get(id));
    if (previous) return previous;
    const record = { ...valid, id, created_at: new Date().toISOString(), canceled_at: null, cancel_reason: '' };
    store.add(record);
    return record;
  });
}
export function cancelEntry(id, reason) {
  const clean = String(reason).trim();
  if (clean.length < 3 || clean.length > 200) throw new Error('Informe um motivo com 3 a 200 caracteres.');
  return transact(['entries'], 'readwrite', async transaction => {
    const store = transaction.objectStore('entries');
    const record = await requestValue(store.get(id));
    if (!record) throw new Error('Lançamento não encontrado.');
    if (record.canceled_at) throw new Error('Este lançamento já foi cancelado. Atualize o histórico.');
    store.put({ ...record, canceled_at: new Date().toISOString(), cancel_reason: clean });
  });
}
const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
export function validateBackup(raw) {
  if (!raw || raw.format !== 'lops-caixa' || raw.version !== 1 || !Array.isArray(raw.services) || !Array.isArray(raw.entries)) throw new Error('Este arquivo não é um backup válido do caixa Lop’s.');
  if (raw.services.length > 5000 || raw.entries.length > 50000) throw new Error('O backup ultrapassa o limite de registros.');
  const serviceIds = new Set();
  const entryIds = new Set();
  const services = raw.services.map(service => {
    if (!service || !validId(service.id) || serviceIds.has(service.id) || !validTimestamp(service.created_at) || !validTimestamp(service.updated_at) || typeof service.active !== 'boolean') throw new Error('O backup contém um serviço inválido.');
    serviceIds.add(service.id);
    return { ...validateService(service), id: service.id, created_at: service.created_at, updated_at: service.updated_at };
  });
  const entries = raw.entries.map(entry => {
    if (!entry || !validId(entry.id) || entryIds.has(entry.id) || !validTimestamp(entry.created_at)) throw new Error('O backup contém um lançamento inválido.');
    entryIds.add(entry.id);
    const valid = validateEntry(entry);
    if (valid.amount_cents !== entry.amount_cents) throw new Error('O backup contém um total inconsistente.');
    if (valid.kind === 'income' && valid.items.some(item => !validId(item.service_id))) throw new Error('Referência de serviço inválida no backup.');
    if (entry.canceled_at !== null && (!validTimestamp(entry.canceled_at) || typeof entry.cancel_reason !== 'string' || entry.cancel_reason.trim().length < 3 || entry.cancel_reason.length > 200)) throw new Error('Cancelamento inválido no backup.');
    return { ...valid, id: entry.id, created_at: entry.created_at, canceled_at: entry.canceled_at, cancel_reason: entry.canceled_at ? entry.cancel_reason.trim() : '' };
  });
  return { services, entries };
}
export function restoreBackup(raw) {
  const valid = validateBackup(raw);
  return transact(STORES, 'readwrite', async transaction => {
    const services = transaction.objectStore('services');
    const entries = transaction.objectStore('entries');
    const [serviceKeys, entryKeys] = await Promise.all([requestValue(services.getAllKeys()), requestValue(entries.getAllKeys())]);
    const knownServices = new Set(serviceKeys);
    const knownEntries = new Set(entryKeys);
    const counts = { services: 0, entries: 0, skipped: 0 };
    for (const service of valid.services) {
      if (knownServices.has(service.id)) { counts.skipped++; continue; }
      services.add(service); counts.services++;
    }
    for (const entry of valid.entries) {
      // Preserve the current device's cancellations and changes; never overwrite history.
      if (knownEntries.has(entry.id)) { counts.skipped++; continue; }
      entries.add(entry); counts.entries++;
    }
    transaction.objectStore('meta').put({ id: 'initialized', value: true });
    return counts;
  });
}
export function createBackup(data) {
  return { format: 'lops-caixa', version: 1, exported_at: new Date().toISOString(), services: data.services, entries: data.entries };
}
