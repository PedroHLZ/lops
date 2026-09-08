export const PAYMENTS = { pix: 'Pix', cash: 'Dinheiro', debit: 'Cartão de débito', credit: 'Cartão de crédito' };
export const CATEGORIES = ['Produtos e materiais', 'Aluguel', 'Água, luz e internet', 'Manutenção', 'Pagamento de profissionais', 'Outros'];
export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export function parseMoney(value) {
  const input = String(value).trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(input)) throw new Error('Informe um valor como 35,00, sem separador de milhar.');
  const [whole, decimals = ''] = input.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 999999999) throw new Error('Valor acima do limite permitido.');
  return cents;
}
export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
function text(value, max, label) {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new Error(`${label}: preencha até ${max} caracteres.`);
  return result;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} inválido.`);
  return value;
}
export function validateService(input) {
  return { name: text(input.name, 80, 'Nome do serviço'), price_cents: integer(input.price_cents, 1, 999999999, 'Preço'), active: input.active !== false };
}
export function quickEntry(service, payment) {
  if (!service?.active || !service.id) throw new Error('Este serviço não está disponível. Atualize a tabela.');
  return validateEntry({ kind: 'income', date: today(), payment, items: [{ service_id: service.id, name: service.name, quantity: 1, price_cents: service.price_cents }], discount_cents: 0, notes: '' });
}
export function validateEntry(input) {
  if (!validDate(input.date)) throw new Error('Informe uma data válida.');
  if (input.date > today()) throw new Error('Registre apenas serviços ou despesas já realizados.');
  if (!Object.hasOwn(PAYMENTS, input.payment)) throw new Error('Escolha uma forma de pagamento.');
  if (!['income', 'expense'].includes(input.kind)) throw new Error('Tipo de lançamento inválido.');
  const notes = String(input.notes ?? '').trim();
  if (notes.length > 500) throw new Error('A observação deve ter até 500 caracteres.');
  const base = { kind: input.kind, date: input.date, payment: input.payment, notes };
  if (input.kind === 'expense') {
    if (!CATEGORIES.includes(input.category)) throw new Error('Escolha uma categoria.');
    return { ...base, description: text(input.description, 120, 'Descrição'), category: input.category, items: [], discount_cents: 0, amount_cents: integer(input.amount_cents, 1, 999999999, 'Valor') };
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) throw new Error('Adicione de 1 a 30 serviços.');
  const items = input.items.map(item => ({ service_id: String(item.service_id ?? ''), name: text(item.name, 80, 'Serviço'), quantity: integer(item.quantity, 1, 100, 'Quantidade'), price_cents: integer(item.price_cents, 1, 999999999, 'Preço') }));
  const gross = items.reduce((sum, item) => sum + item.quantity * item.price_cents, 0);
  integer(gross, 1, 999999999, 'Total');
  const discount = integer(input.discount_cents ?? 0, 0, gross - 1, 'Desconto');
  return { ...base, description: items.map(item => `${item.quantity}× ${item.name}`).join(' · '), category: 'Serviços', items, discount_cents: discount, amount_cents: gross - discount };
}
export function filterEntries(entries, { start, end, kind = '', query = '', includeCanceled = false } = {}) {
  const term = query.trim().toLocaleLowerCase('pt-BR');
  return entries.filter(entry => (!start || entry.date >= start) && (!end || entry.date <= end) && (!kind || entry.kind === kind) && (includeCanceled || !entry.canceled_at) && (!term || `${entry.description} ${entry.notes}`.toLocaleLowerCase('pt-BR').includes(term))).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}
export function summarize(entries) {
  const result = { income: 0, expense: 0, net: 0, count: 0, average: 0, discounts: 0, payments: Object.fromEntries(Object.keys(PAYMENTS).map(key => [key, { income: 0, expense: 0 }])), services: [] };
  const services = new Map();
  for (const entry of entries) {
    if (entry.canceled_at) continue;
    result[entry.kind] += entry.amount_cents;
    result.payments[entry.payment][entry.kind] += entry.amount_cents;
    if (entry.kind !== 'income') continue;
    result.count++;
    result.discounts += entry.discount_cents;
    for (const item of entry.items) {
      const key = item.service_id || item.name;
      const service = services.get(key) || { name: item.name, quantity: 0, gross: 0 };
      service.quantity += item.quantity;
      service.gross += item.quantity * item.price_cents;
      services.set(key, service);
    }
  }
  result.net = result.income - result.expense;
  result.average = result.count ? Math.round(result.income / result.count) : 0;
  result.services = [...services.values()].sort((a, b) => b.quantity - a.quantity);
  return result;
}
export function csv(entries) {
  const escape = value => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, match => "'" + match).replaceAll('"', '""') + '"';
  const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Pagamento', 'Valor (R$)', 'Desconto (R$)', 'Situação', 'Motivo do cancelamento', 'Observação'], ...entries.map(entry => [entry.date, entry.kind === 'income' ? 'Entrada' : 'Despesa', entry.description, entry.category, PAYMENTS[entry.payment], (entry.amount_cents / 100).toFixed(2).replace('.', ','), (entry.discount_cents / 100).toFixed(2).replace('.', ','), entry.canceled_at ? 'Cancelado' : 'Confirmado', entry.cancel_reason || '', entry.notes])];
  return '\uFEFF' + rows.map(row => row.map(escape).join(';')).join('\r\n');
}
