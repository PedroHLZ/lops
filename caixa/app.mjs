import { PAYMENTS, money, parseMoney, today, validDate, filterEntries, summarize, csv, quickEntry } from './core.mjs';
import * as storage from './storage.mjs';

const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const formatDate = date => date.split('-').reverse().join('/');
const currentMonth = () => today().slice(0, 7) + '-01';
const state = { data: { entries: [], services: [], meta: {} }, start: today(), end: today(), view: 'overview', cart: [], kind: 'income', entryId: null, serviceId: null, detailId: null, historyLimit: 50, history: [], busy: false, ready: false, openQuickId: null, quickOperationId: null, lastQuickId: null, lastQuickService: null, quickCooldown: 0 };
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('lops-caixa-updates') : null;

function el(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text !== '') node.textContent = text;
  if (className) node.className = className;
  return node;
}
function empty(parent, title, description) {
  const box = el('div', '', 'empty');
  box.append(el('strong', title), el('p', description));
  parent.append(box);
}
function feedback(message, error = false) {
  $('#app-status').textContent = message;
  $('#app-status').classList.toggle('error', error);
}
function errorMessage(error) {
  if (error.name === 'QuotaExceededError') return 'O armazenamento está cheio. O lançamento não foi salvo. Faça um backup e libere espaço no aparelho.';
  if (error.name === 'InvalidStateError') return 'O armazenamento foi fechado. Reabra a página para continuar.';
  return error.message || 'Não foi possível concluir. Tente novamente.';
}
async function reload() {
  state.data = await storage.snapshot();
  render();
}
async function changed(message) {
  await reload();
  channel?.postMessage('changed');
  feedback(message);
}
function setView(name) {
  if (!['overview', 'history', 'services', 'settings'].includes(name)) return;
  if (!state.busy) setQuickOpen(null);
  state.view = name;
  all('[id^="view-"]').forEach(section => { section.hidden = section.id !== 'view-' + name; });
  all('.app-nav [data-view]').forEach(button => {
    if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#page-title').textContent = { overview: 'Seu caixa, sem complicação.', history: 'Cada movimento, registrado.', services: 'Seus serviços. Seus preços.', settings: 'Cuide dos seus registros.' }[name];
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'history') renderHistory();
}
function entryRow(entry) {
  const button = el('button', '', 'entry-row' + (entry.canceled_at ? ' canceled' : ''));
  button.type = 'button';
  const symbol = el('span', entry.kind === 'income' ? '↙' : '↗', 'entry-symbol ' + entry.kind);
  symbol.setAttribute('aria-hidden', 'true');
  const info = el('span', '', 'entry-info');
  info.append(el('strong', entry.description), el('small', `${formatDate(entry.date)} · ${PAYMENTS[entry.payment]}${entry.canceled_at ? ' · Cancelado' : ''}`));
  button.append(symbol, info, el('span', (entry.kind === 'expense' ? '− ' : '') + money(entry.amount_cents), 'entry-value ' + entry.kind));
  button.addEventListener('click', () => openDetail(entry.id));
  return button;
}
function renderOverview() {
  const entries = filterEntries(state.data.entries, { start: state.start, end: state.end });
  const summary = summarize(entries);
  $('#period-label').textContent = state.start === state.end ? formatDate(state.start) : `${formatDate(state.start)} a ${formatDate(state.end)}`;
  for (const [id, value] of Object.entries({ income: summary.income, expense: summary.expense, net: summary.net, average: summary.average, discount: summary.discounts })) $('#metric-' + id).textContent = money(value);
  $('#metric-count').textContent = summary.count;
  const payments = $('#payments'); payments.replaceChildren();
  for (const [key, label] of Object.entries(PAYMENTS)) {
    const row = el('div', '', 'payment-row');
    const name = el('div', '', 'payment-label');
    name.append(el('span', label), el('strong', money(summary.payments[key].income)));
    const track = el('div', '', 'payment-track'); const fill = el('span');
    fill.style.width = (summary.income ? summary.payments[key].income / summary.income * 100 : 0) + '%';
    track.setAttribute('aria-hidden', 'true'); track.append(fill); row.append(name, track); payments.append(row);
  }
  const ranking = $('#ranking'); ranking.replaceChildren();
  if (!summary.services.length) empty(ranking, 'Ainda sem serviços no período', 'Os atendimentos registrados aparecerão aqui.');
  for (const service of summary.services.slice(0, 6)) {
    const row = el('div', '', 'ranking-row'); const label = el('div');
    label.append(el('span', service.name), el('small', money(service.gross)));
    row.append(label, el('strong', String(service.quantity))); ranking.append(row);
  }
  const recent = $('#recent-entries'); recent.replaceChildren();
  if (!entries.length) empty(recent, 'Seu caixa começa aqui', 'Registre um atendimento ou uma despesa para acompanhar o movimento.');
  entries.slice(0, 5).forEach(entry => recent.append(entryRow(entry)));
}
function historyFilter() {
  return { start: $('#history-start').value, end: $('#history-end').value, kind: $('#history-kind').value, query: $('#history-query').value, includeCanceled: $('#history-canceled').checked };
}
function renderHistory() {
  state.history = filterEntries(state.data.entries, historyFilter());
  const list = $('#history-entries'); list.replaceChildren();
  if (!state.history.length) empty(list, 'Nenhum lançamento encontrado', 'Ajuste as datas ou registre o primeiro atendimento.');
  state.history.slice(0, state.historyLimit).forEach(entry => list.append(entryRow(entry)));
  const summary = summarize(state.history);
  $('#history-summary').textContent = `${state.history.length} lançamento(s) · Entradas ${money(summary.income)} · Despesas ${money(summary.expense)}`;
  $('#history-more').hidden = state.history.length <= state.historyLimit;
  $('#export-csv').disabled = !state.history.length;
}
function renderServices() {
  const activeList = $('#service-list'); const archivedList = $('#archived-services');
  activeList.replaceChildren(); archivedList.replaceChildren();
  const services = [...state.data.services].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (!services.some(service => service.active)) empty(activeList, 'Cadastre seu primeiro serviço', 'Defina os preços da barbearia para começar a registrar atendimentos.');
  if (!services.some(service => !service.active)) empty(archivedList, 'Nenhum serviço arquivado', 'Arquivar mantém os atendimentos antigos no histórico.');
  for (const service of services) {
    const card = el('article', '', 'catalog-card');
    card.append(el('h2', service.name), el('strong', money(service.price_cents)));
    const actions = el('div', '', 'catalog-actions');
    if (service.active) {
      const edit = el('button', 'Editar', 'text-button'); edit.type = 'button'; edit.addEventListener('click', () => openService(service)); actions.append(edit);
    }
    const archive = el('button', service.active ? 'Arquivar' : 'Reativar', 'text-button archive-button'); archive.type = 'button';
    archive.addEventListener('click', async () => {
      const approved = await confirmAction(service.active ? 'Arquivar serviço?' : 'Reativar serviço?', service.active ? `${service.name} sairá da seleção de novos atendimentos. Os registros anteriores serão mantidos.` : `${service.name} voltará a aparecer nos novos atendimentos.`);
      if (!approved) return;
      archive.disabled = true;
      try { await storage.archiveService(service.id, !service.active); await changed('Cadastro atualizado.'); }
      catch (error) { feedback(errorMessage(error), true); archive.disabled = false; }
    });
    actions.append(archive); card.append(actions); (service.active ? activeList : archivedList).append(card);
  }
}
function renderSettings() {
  $('#settings-storage').textContent = 'Os registros ficam neste navegador e neste endereço do site. Não são enviados a um servidor e não aparecem automaticamente em outro celular. Quem usar este navegador pode abrir o caixa.';
  $('#import-label').hidden = false;
  $('#backup-info').textContent = state.data.meta.lastBackup ? `Último backup gerado: ${new Date(state.data.meta.lastBackup).toLocaleString('pt-BR')}. Confira se o arquivo foi salvo em Downloads ou em um lugar seguro.` : 'Nenhum backup gerado neste aparelho. Baixe um backup ao finalizar o dia e guarde o arquivo fora do navegador.';
  $('#storage-notice').textContent = 'Salvo só neste navegador · Faça backup antes de trocar de celular ou limpar os dados do site.';
  $('#storage-notice').classList.add('warning');
}
function render() { renderQuick(); renderOverview(); renderHistory(); renderServices(); renderSettings(); }
function renderQuick() {
  $('#quick-date').textContent = 'Registros de hoje · ' + formatDate(today());
  const grid = $('#quick-services'); grid.replaceChildren();
  const services = state.data.services.filter(service => service.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (!services.some(service => service.id === state.openQuickId)) state.openQuickId = null;
  if (!services.length) {
    const box = el('div', '', 'quick-empty');
    box.append(el('h3', 'Sua tabela de preços vira este painel'), el('p', 'Cadastre os serviços e valores. Os botões aparecem aqui automaticamente.'));
    const add = el('button', 'Cadastrar tabela de preços', 'button'); add.type = 'button';
    add.addEventListener('click', () => { setView('services'); openService(); });
    box.append(add); grid.append(box);
  }
  for (const service of services) {
    const wrapper = el('div', '', 'quick-service-item'); wrapper.dataset.serviceId = service.id;
    const button = el('button', '', 'quick-service'); button.type = 'button';
    button.id = 'quick-service-' + service.id;
    button.disabled = state.busy || (service.id === state.lastQuickService && Date.now() < state.quickCooldown);
    button.setAttribute('aria-label', `${service.name}, ${money(service.price_cents)}. Escolher pagamento`);
    button.setAttribute('aria-expanded', String(state.openQuickId === service.id));
    button.setAttribute('aria-controls', 'quick-payment-' + service.id);
    const name = el('span', service.name, 'quick-service-name');
    const value = el('strong', money(service.price_cents));
    const action = el('span', 'Escolher pagamento', 'quick-service-action');
    const arrow = el('span', '⌄', 'quick-service-chevron'); arrow.setAttribute('aria-hidden', 'true'); action.append(arrow);
    button.append(name, value, action);
    button.addEventListener('click', () => {
      if (!state.busy) setQuickOpen(state.openQuickId === service.id ? null : service.id);
    });
    const drawer = el('div', '', 'quick-payment-drawer'); drawer.id = 'quick-payment-' + service.id;
    drawer.setAttribute('role', 'group'); drawer.setAttribute('aria-label', 'Pagamento de ' + service.name);
    const clip = el('div', '', 'quick-payment-clip'); const panel = el('div', '', 'quick-payment-panel');
    panel.append(el('p', 'Como recebeu?', 'quick-payment-title'));
    const choices = el('div', '', 'quick-payment-buttons');
    const labels = { pix: 'Pix', cash: 'Dinheiro', debit: 'Débito', credit: 'Crédito' };
    for (const [payment, label] of Object.entries(labels)) {
      const choice = el('button', label, 'quick-payment-button'); choice.type = 'button'; choice.disabled = state.busy;
      choice.setAttribute('aria-label', `Registrar ${service.name}, ${money(service.price_cents)}, em ${PAYMENTS[payment]}`);
      choice.addEventListener('click', () => registerQuick(service, payment));
      choices.append(choice);
    }
    const close = el('button', 'Fechar', 'quick-payment-close'); close.type = 'button'; close.disabled = state.busy;
    close.addEventListener('click', () => setQuickOpen(null, true));
    panel.append(choices, close); clip.append(panel); drawer.append(clip); wrapper.append(button, drawer); grid.append(wrapper);
  }
  updateQuickDrawers();
  const last = state.data.entries.find(entry => entry.id === state.lastQuickId);
  $('#undo-quick').hidden = !last || !!last.canceled_at;
}
function updateQuickDrawers() {
  all('.quick-service-item').forEach(wrapper => {
    const open = wrapper.dataset.serviceId === state.openQuickId;
    wrapper.classList.toggle('is-open', open);
    wrapper.querySelector('.quick-service').setAttribute('aria-expanded', String(open));
    const drawer = wrapper.querySelector('.quick-payment-drawer');
    drawer.inert = !open;
    drawer.setAttribute('aria-hidden', String(!open));
  });
}
function setQuickOpen(id, returnFocus = false) {
  if (state.busy) return;
  const previous = state.openQuickId;
  state.openQuickId = id;
  state.quickOperationId = id ? crypto.randomUUID() : null;
  updateQuickDrawers();
  if (returnFocus && previous) document.getElementById('quick-service-' + previous)?.focus();
}
async function registerQuick(service, payment) {
  if (state.busy || (service.id === state.lastQuickService && Date.now() < state.quickCooldown)) return;
  if (state.openQuickId !== service.id || !Object.hasOwn(PAYMENTS, payment)) return;
  state.busy = true;
  all('.quick-service, .quick-payment-button, .quick-payment-close').forEach(button => { button.disabled = true; });
  $('#quick-status').textContent = 'Registrando ' + service.name + '…';
  $('#quick-status').classList.remove('error');
  try {
    const record = await storage.saveEntry(quickEntry(service, payment), state.quickOperationId);
    state.lastQuickId = record.id;
    state.openQuickId = null;
    state.quickOperationId = null;
    state.lastQuickService = service.id;
    state.quickCooldown = Date.now() + 700;
    setTimeout(renderQuick, 750);
    await reload();
    channel?.postMessage('changed');
    $('#quick-status').textContent = `✓ ${service.name} registrado · ${money(record.amount_cents)} em ${PAYMENTS[record.payment]}.`;
  } catch (error) {
    $('#quick-status').textContent = errorMessage(error);
    $('#quick-status').classList.add('error');
  } finally {
    state.busy = false; renderQuick();
    if (!state.openQuickId) document.getElementById('quick-service-' + service.id)?.focus();
  }
}
function validateRange(start, end) {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Escolha um período válido: a data inicial deve ser anterior ou igual à final.');
}
function setPeriod(period) {
  all('[data-period]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.period === period)));
  $('#overview-dates').hidden = period !== 'custom';
  if (period === 'custom') return;
  state.start = period === 'today' ? today() : currentMonth(); state.end = today(); renderOverview();
}

function openService(service = null) {
  state.serviceId = service?.id || null;
  $('#service-form').reset(); $('#service-error').textContent = '';
  $('#service-title').textContent = service ? 'Editar serviço' : 'Novo serviço';
  if (service) { $('#service-name').value = service.name; $('#service-price').value = (service.price_cents / 100).toFixed(2).replace('.', ','); }
  $('#service-dialog').showModal();
}
function openEntry(kind) {
  state.kind = kind; state.entryId = crypto.randomUUID(); state.cart = [];
  $('#entry-form').reset(); $('#entry-error').textContent = '';
  $('#entry-title').textContent = kind === 'income' ? 'Registrar atendimento' : 'Registrar despesa';
  $('#entry-date').value = today(); $('#entry-date').max = today(); $('#entry-date').min = '2000-01-01';
  $('#income-fields').hidden = kind !== 'income'; $('#expense-fields').hidden = kind !== 'expense';
  $('#expense-description').required = kind === 'expense'; $('#expense-amount').required = kind === 'expense';
  const select = $('#item-service'); select.replaceChildren(new Option('Selecione um serviço', ''));
  const active = state.data.services.filter(service => service.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const service of active) select.add(new Option(`${service.name} · ${money(service.price_cents)}`, service.id));
  $('#no-services').hidden = active.length > 0; $('#add-item').disabled = !active.length;
  renderCart(); $('#entry-dialog').showModal();
}
function renderTotal() {
  const gross = state.cart.reduce((sum, item) => sum + item.quantity * item.price_cents, 0);
  try {
    const discount = parseMoney($('#entry-discount').value || '0');
    $('#cart-total').textContent = discount <= gross ? money(gross - discount) : 'Desconto inválido';
  } catch { $('#cart-total').textContent = 'Revise o desconto'; }
}
function renderCart() {
  const cart = $('#cart'); cart.replaceChildren();
  state.cart.forEach((item, index) => {
    const row = el('div', '', 'cart-row'); const description = el('div');
    description.append(el('strong', item.name), el('small', money(item.price_cents) + ' cada'));
    const quantityBox = el('div'); const label = el('label', 'Qtd.'); label.htmlFor = 'quantity-' + index;
    const quantity = el('input'); quantity.id = label.htmlFor; quantity.type = 'number'; quantity.min = '1'; quantity.max = '100'; quantity.step = '1'; quantity.required = true; quantity.value = item.quantity;
    quantity.addEventListener('input', () => { item.quantity = Number(quantity.value); renderTotal(); });
    quantityBox.append(label, quantity);
    const remove = el('button', '×'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remover ' + item.name);
    remove.addEventListener('click', () => { state.cart.splice(index, 1); renderCart(); });
    row.append(description, quantityBox, remove); cart.append(row);
  });
  renderTotal();
}
function detailLine(parent, label, value) {
  const row = el('div'); row.append(el('dt', label), el('dd', value)); parent.append(row);
}
function openDetail(id) {
  const entry = state.data.entries.find(item => item.id === id);
  if (!entry) return;
  state.detailId = id;
  const content = $('#entry-detail'); content.replaceChildren();
  content.append(el('p', money(entry.amount_cents), 'detail-amount'));
  const list = el('dl', '', 'detail-list');
  detailLine(list, 'Tipo', entry.kind === 'income' ? 'Atendimento' : 'Despesa');
  detailLine(list, 'Data', formatDate(entry.date)); detailLine(list, 'Pagamento', PAYMENTS[entry.payment]);
  detailLine(list, 'Descrição', entry.description);
  if (entry.kind === 'income') {
    for (const item of entry.items) detailLine(list, `${item.quantity}× ${item.name}`, money(item.quantity * item.price_cents));
    detailLine(list, 'Desconto', money(entry.discount_cents));
  } else detailLine(list, 'Categoria', entry.category);
  detailLine(list, 'Registrado em', new Date(entry.created_at).toLocaleString('pt-BR'));
  if (entry.canceled_at) { detailLine(list, 'Cancelado em', new Date(entry.canceled_at).toLocaleString('pt-BR')); detailLine(list, 'Motivo', entry.cancel_reason); }
  content.append(list);
  if (entry.notes) content.append(el('p', entry.notes, 'detail-notes'));
  $('#cancel-form').hidden = !!entry.canceled_at; $('#cancel-form').reset(); $('#cancel-error').textContent = '';
  $('#detail-dialog').showModal();
}
function confirmAction(title, description) {
  return new Promise(resolve => {
    const dialog = $('#confirm-dialog');
    $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
    dialog.returnValue = 'no';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    dialog.showModal(); $('#confirm-no').focus();
  });
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = el('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

all('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.addEventListener('click', event => {
  if (state.openQuickId && !state.busy && !event.target.closest('.quick-service-item')) setQuickOpen(null);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.openQuickId && !state.busy) { event.preventDefault(); setQuickOpen(null, true); }
});
$('#undo-quick').addEventListener('click', async () => {
  if (state.busy || !state.lastQuickId) return;
  state.busy = true; $('#undo-quick').disabled = true; renderQuick();
  try {
    await storage.cancelEntry(state.lastQuickId, 'Desfeito após registro rápido.');
    state.lastQuickId = null;
    await changed('Último registro rápido desfeito. O cancelamento ficou no histórico.');
    $('#quick-status').textContent = 'Registro desfeito. O valor foi retirado dos totais.';
  } catch (error) { feedback(errorMessage(error), true); }
  finally { state.busy = false; $('#undo-quick').disabled = false; renderQuick(); }
});
all('[data-period]').forEach(button => button.addEventListener('click', () => setPeriod(button.dataset.period)));
all('[data-close]').forEach(button => button.addEventListener('click', () => { if (!state.busy) button.closest('dialog').close(); }));
all('dialog').forEach(dialog => dialog.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); }));
$('#confirm-no').addEventListener('click', () => $('#confirm-dialog').close('no'));
$('#confirm-yes').addEventListener('click', () => $('#confirm-dialog').close('yes'));
$('#overview-start').value = today(); $('#overview-end').value = today();
$('#history-start').value = currentMonth(); $('#history-end').value = today();
$('#overview-dates').addEventListener('submit', event => {
  event.preventDefault();
  try { validateRange($('#overview-start').value, $('#overview-end').value); state.start = $('#overview-start').value; state.end = $('#overview-end').value; renderOverview(); feedback('Período atualizado.'); }
  catch (error) { feedback(errorMessage(error), true); }
});
$('#history-filter').addEventListener('submit', event => {
  event.preventDefault();
  try { const filter = historyFilter(); validateRange(filter.start, filter.end); state.historyLimit = 50; renderHistory(); feedback('Histórico atualizado.'); }
  catch (error) { feedback(errorMessage(error), true); }
});
$('#history-more').addEventListener('click', () => { state.historyLimit += 50; renderHistory(); });
$('#new-service').addEventListener('click', () => openService());
$('#new-income').addEventListener('click', () => {
  if (!state.data.services.some(service => service.active)) { setView('services'); feedback('Cadastre os serviços e preços para registrar seu primeiro atendimento.'); openService(); return; }
  openEntry('income');
});
$('#new-expense').addEventListener('click', () => openEntry('expense'));
$('#add-item').addEventListener('click', () => {
  const service = state.data.services.find(item => item.id === $('#item-service').value && item.active);
  if (!service) { $('#entry-error').textContent = 'Selecione um serviço para adicionar.'; return; }
  const existing = state.cart.find(item => item.service_id === service.id);
  if (existing) {
    if (existing.quantity >= 100) { $('#entry-error').textContent = 'Quantidade máxima: 100.'; return; }
    existing.quantity++;
  } else {
    if (state.cart.length >= 30) { $('#entry-error').textContent = 'Limite de 30 serviços por atendimento.'; return; }
    state.cart.push({ service_id: service.id, name: service.name, price_cents: service.price_cents, quantity: 1 });
  }
  $('#entry-error').textContent = ''; renderCart();
});
$('#entry-discount').addEventListener('input', renderTotal);
$('#service-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  const button = event.submitter; state.busy = true; button.disabled = true;
  try {
    await storage.saveService({ name: $('#service-name').value, price_cents: parseMoney($('#service-price').value), active: true }, state.serviceId);
    $('#service-dialog').close(); await changed('Serviço salvo. Você já pode registrar atendimentos.');
  } catch (error) { $('#service-error').textContent = errorMessage(error); }
  finally { state.busy = false; button.disabled = false; }
});
$('#entry-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  const button = $('#save-entry'); state.busy = true; button.disabled = true; button.textContent = 'Salvando…';
  try {
    const input = { kind: state.kind, date: $('#entry-date').value, payment: $('#entry-payment').value, notes: $('#entry-notes').value };
    if (state.kind === 'income') { input.items = state.cart; input.discount_cents = parseMoney($('#entry-discount').value || '0'); }
    else { input.description = $('#expense-description').value; input.category = $('#expense-category').value; input.amount_cents = parseMoney($('#expense-amount').value); }
    await storage.saveEntry(input, state.entryId);
    $('#entry-dialog').close(); await changed('Lançamento salvo neste aparelho.');
  } catch (error) { $('#entry-error').textContent = errorMessage(error); }
  finally { state.busy = false; button.disabled = false; button.textContent = 'Confirmar lançamento'; }
});
$('#cancel-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  const reason = $('#cancel-reason').value.trim();
  if (reason.length < 3) { $('#cancel-error').textContent = 'Descreva o motivo com pelo menos 3 caracteres.'; return; }
  const approved = await confirmAction('Cancelar lançamento?', 'O valor deixará de compor os totais. O registro e o motivo serão mantidos no histórico.');
  if (!approved) return;
  state.busy = true; event.submitter.disabled = true;
  try { await storage.cancelEntry(state.detailId, reason); $('#detail-dialog').close(); await changed('Lançamento cancelado e preservado no histórico.'); }
  catch (error) { $('#cancel-error').textContent = errorMessage(error); }
  finally { state.busy = false; event.submitter.disabled = false; }
});
$('#refresh').addEventListener('click', async () => {
  try { await reload(); feedback('Registros atualizados.'); } catch (error) { feedback(errorMessage(error), true); }
});
$('#export-csv').addEventListener('click', () => { download(csv(state.history), `lops-movimento-${today()}.csv`, 'text/csv;charset=utf-8'); feedback('Exportação do período preparada. Confira o arquivo em Downloads.'); });
$('#export-backup').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try {
    const data = await storage.snapshot();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    download(JSON.stringify(storage.createBackup(data), null, 2), `lops-backup-${stamp}.json`, 'application/json');
    await storage.setMeta('lastBackup', new Date().toISOString()); await changed('Backup preparado. Confirme se o arquivo foi salvo e guarde uma cópia fora do navegador.');
  } catch (error) { feedback(errorMessage(error), true); }
  finally { $('#export-backup').disabled = false; }
});
$('#import-backup').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > storage.BACKUP_LIMIT) throw new Error('Escolha um backup de até 20 MB.');
    let backup;
    try { backup = JSON.parse(await file.text()); } catch { throw new Error('Não foi possível ler o arquivo. Escolha um backup JSON do caixa.'); }
    const valid = storage.validateBackup(backup);
    const approved = await confirmAction('Restaurar este backup?', `O arquivo contém ${valid.services.length} serviço(s) e ${valid.entries.length} lançamento(s). Serão adicionados apenas registros ausentes. Os registros que já existem neste aparelho serão preservados, sem duplicação.`);
    if (!approved) return;
    const result = await storage.restoreBackup(backup);
    await changed(`Backup restaurado: ${result.services} serviço(s) e ${result.entries} lançamento(s) adicionados. ${result.skipped} registro(s) já existentes preservados.`);
  } catch (error) { feedback(errorMessage(error), true); }
  finally { event.target.value = ''; }
});
function activateApp() {
  state.ready = true; $('#gate').hidden = true; $('#application').hidden = false; render();
}
$('#activate').addEventListener('click', async () => {
  $('#activate').disabled = true;
  try {
    await storage.setMeta('initialized', true);
    // Browser may decline this request; manual backups remain necessary.
    navigator.storage?.persist?.().catch(() => {});
    activateApp();
  } catch (error) { $('#gate-status').textContent = errorMessage(error); $('#activate').disabled = false; }
});
async function initialize() {
  try {
    state.data = await storage.openDatabase();
    if (state.data.meta.initialized) activateApp();
    else {
      $('#gate-description').textContent = 'Este caixa salva os serviços e despesas somente neste navegador, sem login ou sincronização. Use um aparelho de confiança e faça backups manuais para não perder os registros.';
      $('#activate').hidden = false;
    }
  } catch (error) { $('#gate-description').textContent = 'Não foi possível abrir os registros.'; $('#gate-status').textContent = errorMessage(error); }
}
channel?.addEventListener('message', () => { if (state.ready && !state.busy && !document.querySelector('dialog[open]')) reload().catch(error => feedback(errorMessage(error), true)); });
window.addEventListener('focus', () => { if (state.ready && !state.busy && !document.querySelector('dialog[open]')) reload().catch(error => feedback(errorMessage(error), true)); });
initialize();
