/**
 * Interface do simulador: estado, telas e eventos.
 */
import { describeDistributors, homeEnergyPrice } from '../core/energy.js';
import { brDate, brl, number } from '../core/format.js';
import { breakEven, simulate } from '../core/simulator.js';
import {
  ASSUMPTIONS,
  DEFAULT_INPUT,
  ENERGY_TAX_FACTOR,
  HOME_TARIFF_FALLBACK,
  LIMITS,
} from '../data/assumptions.js';
import { ARTWORK, CARS, RENT_PLAN } from '../data/cars.js';
import { ENERGY_TARIFFS } from '../data/energy-tariffs.js';
import { FUEL_ESTIMATE, FUEL_SNAPSHOT } from '../data/fuel.js';
import { STATES } from '../data/states.js';
import { STATUS } from '../data/status.js';
import { createCache } from '../services/cache.js';
import { fetchFuelPrices, normalizeFuel } from '../services/fuel.js';
import {
  formatCep,
  locateByDevice,
  LocationError,
  lookupCep,
  normalizeCep,
} from '../services/location.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const cache = createCache();

/** Protege textos vindos de APIs externas antes de inseri-los no HTML. */
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ----------------------------------------------------------------------
// Estado da aplicação
// ----------------------------------------------------------------------

const state = {
  screen: 'routine',
  selectedScenario: null,
  input: { ...DEFAULT_INPUT },
  a: { ...ASSUMPTIONS },
  // Tarifa de energia informada pelo cliente; null usa a tarifa do estado.
  homeTariff: null,
  rent: Object.fromEntries(
    Object.values(CARS).map((c) => [c.id, { electric: c.rent, gas: c.gas.rent }]),
  ),
  // Região escolhida por CEP ou localização: 'idle' | 'loading' | 'ready' | 'error'.
  region: { status: 'idle', cep: '', city: null, message: null },
  result: null,
  checks: [false, false, false],
  fuel: { data: normalizeFuel(FUEL_SNAPSHOT), status: 'saved', loading: false, lastError: null },
};
try {
  // Usa a última resposta da API guardada neste navegador, se for mais nova que a embutida.
  const data = normalizeFuel(cache.get('fuel'));
  if (data.collectedAt > state.fuel.data.collectedAt) state.fuel.data = data;
} catch {}

// ----------------------------------------------------------------------
// Formatação e acesso aos dados
// ----------------------------------------------------------------------

const collectionDate = () => brDate(state.fuel.data.collectedAt);
function gasInfo(uf = state.input.uf) {
  const api = state.fuel.data.prices[uf];
  if (Number.isFinite(api) && api > 0) return { price: api, estimated: false };
  const estimate = FUEL_ESTIMATE.prices[uf];
  if (Number.isFinite(estimate) && estimate > 0) return { price: estimate, estimated: true };
  throw new Error('Não há preço para esse estado. Escolha outro.');
}
function gasoline(uf = state.input.uf) {
  return gasInfo(uf).price;
}
function rentInfo(id = state.input.car) {
  const car = CARS[id],
    rent = state.rent[id];
  return {
    electric: rent.electric,
    gas: rent.gas,
    electricEstimated: rent.electric === car.rent,
    gasEstimated: rent.gas === car.gas.rent,
  };
}
/** Preço da energia em casa: o informado pelo cliente ou a tarifa ANEEL do estado. */
function energyInfo(uf = state.input.uf) {
  if (state.homeTariff !== null) return { price: state.homeTariff, origin: 'custom' };
  const official = homeEnergyPrice(uf, ENERGY_TARIFFS, ENERGY_TAX_FACTOR);
  if (official) return { ...official, origin: 'aneel' };
  return { price: HOME_TARIFF_FALLBACK, origin: 'example' };
}
function compute() {
  const rent = state.rent[state.input.car];
  return simulate(state.input, CARS[state.input.car], {
    ...state.a,
    homeTariff: energyInfo().price,
    gasPrice: gasoline(),
    electricRent: rent.electric,
    gasRent: rent.gas,
  });
}

// ----------------------------------------------------------------------
// Componentes reutilizáveis
// ----------------------------------------------------------------------

function radio(name, values, current) {
  return `<div class="seg">${values.map(([v, label, glyph]) => `<input type="radio" id="${name}-${v}" name="${name}" value="${v}" ${v === current ? 'checked' : ''}><label for="${name}-${v}">${icon(glyph)}<span>${label}</span></label>`).join('')}</div>`;
}
function fuelNote(uf = state.input.uf) {
  const g = gasInfo(uf);
  return `<div class="fuel-inline"><span class="fuel-glyph">${icon('gas-pump')}</span><div><strong>Gasolina em ${uf.toUpperCase()} · ${brl(g.price, 2)}/L${g.estimated ? ' · estimado' : ''}</strong><small>${g.estimated ? `${state.fuel.loading ? 'Consultando a API…' : 'Sem dado na API'} · média ANP de ${FUEL_ESTIMATE.period}` : `${state.fuel.loading ? 'Consultando a API…' : state.fuel.status === 'live' ? 'Consulta API' : state.fuel.status === 'unavailable' ? 'Consulta indisponível · dado salvo' : 'Dado salvo'} · coleta ${collectionDate()}`}</small></div></div>`;
}
function energyNote(uf = state.input.uf) {
  const e = energyInfo(uf);
  const detail =
    e.origin === 'custom'
      ? 'Valor informado por você'
      : e.origin === 'aneel'
        ? `ANEEL · ${describeDistributors(e.distributors)} · com impostos estimados`
        : 'Valor de exemplo';
  return `<div class="fuel-inline"><span class="fuel-glyph">${icon('lightning')}</span><div><strong>Energia em casa${e.origin === 'custom' ? '' : ' em ' + uf.toUpperCase()} · ${brl(e.price, 2)}/kWh</strong><small>${detail}</small></div></div>`;
}
function regionPlace() {
  const uf = state.input.uf;
  return state.region.city ? `${escapeHtml(state.region.city)} · ${uf.toUpperCase()}` : STATES[uf];
}
function regionMessage() {
  if (state.region.message) return state.region.message;
  if (state.region.status === 'ready')
    return `Preços de gasolina e energia de ${STATES[state.input.uf]} aplicados.`;
  return 'Informe o CEP ou use sua localização para aplicar os preços do seu estado.';
}
function stateOptions(current) {
  return Object.entries(STATES)
    .map(
      ([uf, name]) =>
        `<option value="${uf}" ${uf === current ? 'selected' : ''}>${name}${gasInfo(uf).estimated ? ' · estimado' : ''}</option>`,
    )
    .join('');
}

// ----------------------------------------------------------------------
// Sincronização e renderização
// ----------------------------------------------------------------------

function syncForm() {
  const form = $('routineForm');
  if (!form) return;
  const data = new FormData(form);
  state.input.kmDay = Number(data.get('kmDay'));
  state.input.charging = data.get('charging');
}
function syncScenarios() {
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    const active = button.dataset.scenario === state.selectedScenario;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function render() {
  const isRoutine = state.screen === 'routine';
  syncScenarios();
  $('stepRoutine').classList.toggle('active', isRoutine);
  $('stepResult').classList.toggle('active', !isRoutine);
  $('stepResult').disabled = !state.result;
  $('stepRoutine').setAttribute('aria-current', isRoutine ? 'step' : 'false');
  $('stepResult').setAttribute('aria-current', isRoutine ? 'false' : 'step');
  const opened = [...document.querySelectorAll('#screen details[open]')].map((el) => el.id);
  $('screen').innerHTML = isRoutine ? routine() : resultScreen();
  opened.forEach((id) => {
    if ($(id)) $(id).open = true;
  });
  $('dock').innerHTML = isRoutine
    ? `<button class="primary" data-action="simulate">Ver meu cenário ${icon('arrow-right')}</button>`
    : `<button class="icon-button" data-action="edit" aria-label="Editar rotina">${icon('sliders-horizontal')}</button><button class="primary" data-action="next">Antes de assinar ${icon('arrow-right')}</button>`;
}

// ----------------------------------------------------------------------
// Tela: sua rotina
// ----------------------------------------------------------------------

function routine() {
  const i = state.input;
  return `<div class="intro"><div class="eyebrow">Simulador de rotina</div><h1>Um elétrico funciona<br>para você?</h1><p>Compare sua rotina e o custo de assinatura + combustível.</p></div><form id="routineForm"><section class="card vehicle-card"><div class="section-label"><span class="label-icon">${icon('car-profile')} Escolha o elétrico</span></div><div class="cars">${Object.values(
    CARS,
  )
    .map(
      (c) =>
        `<button type="button" class="car" data-car="${c.id}" aria-pressed="${i.car === c.id}"><span class="check">${icon('check-circle')}</span><img src="${c.image}" alt="${c.full}"><strong>${c.name}</strong><small>Comparar com ${c.gas.name}</small></button>`,
    )
    .join(
      '',
    )}</div></section><section class="card routine-card"><div class="question"><div class="range-head"><label class="label-icon" for="kmDay">${icon('path')} Km por dia</label><output id="kmOutput" for="kmDay">${i.kmDay} <small>km</small></output></div><input type="range" id="kmDay" name="kmDay" min="${LIMITS.kmDay.min}" max="${LIMITS.kmDay.max}" step="${LIMITS.kmDay.step}" value="${i.kmDay}"><div class="range-labels"><span>${LIMITS.kmDay.min} km</span><span>${LIMITS.kmDay.max} km</span></div><p class="hint" id="monthPreview">${number(i.kmDay * i.daysMonth)} km/mês · ${i.daysMonth} dias</p></div><fieldset class="question"><legend class="label-icon">${icon('lightning')} Onde você pode recarregar?</legend>${radio(
    'charging',
    [
      ['yes', 'Casa / trabalho', 'house-line'],
      ['no', 'Só na rua', 'charging-station'],
    ],
    i.charging,
  )}<p id="chargingHint" class="hint">${chargingHint()}</p></fieldset></section>${regionCard()}<button type="button" class="subtle-link label-icon" data-action="assumptions">${icon('sliders-horizontal')} Ajustar preços e assinatura</button><p class="note">${icon('info')}<span>Estimativa. As mensalidades são valores estimados; troque pela sua cotação.</span></p><div id="formError" class="error" role="alert" hidden></div></form>`;
}
function regionCard() {
  const busy = state.region.status === 'loading' ? 'disabled' : '';
  return `<section class="card region-card"><div class="section-label"><span class="label-icon">${icon('map-pin')} Sua região</span><span id="regionPlace">${regionPlace()}</span></div><div class="region-controls"><input type="text" id="cep" name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="Digite seu CEP" aria-label="CEP" aria-describedby="regionStatus" value="${formatCep(state.region.cep)}"><button type="button" class="icon-button" data-action="lookup-cep" aria-label="Buscar CEP" ${busy}>${icon('magnifying-glass')}</button><button type="button" class="icon-button" data-action="locate" aria-label="Usar minha localização" ${busy}>${icon('crosshair')}</button></div><p class="hint${state.region.status === 'error' ? ' error-text' : ''}" id="regionStatus" role="status">${regionMessage()}</p><div class="region-prices"><div data-fuel-note>${fuelNote()}</div><div data-energy-note>${energyNote()}</div></div></section>`;
}
function chargingHint() {
  return state.input.charging === 'yes'
    ? 'Confirme se há um carregador disponível.'
    : 'Você vai depender de pontos públicos.';
}
function row(label, value) {
  return `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`;
}
function group(id, title, subtitle, glyph, body) {
  return `<details class="group" id="group-${id}"><summary><span class="group-icon">${icon(glyph)}</span><span class="summary-text"><strong>${title}</strong><small>${subtitle}</small></span>${icon('caret-down', 'chevron')}</summary><div class="group-body">${body}</div></details>`;
}

// ----------------------------------------------------------------------
// Tela: seu cenário
// ----------------------------------------------------------------------

function resultScreen() {
  const r = state.result,
    i = state.input,
    c = CARS[i.car],
    s = STATUS[r.status];
  const fraction = (i.kmDay * state.a.safety) / r.usableRange,
    filled = Math.min(10, Math.ceil(fraction * 10)),
    max = Math.max(r.fuelTotal, r.electricTotal);
  const cheaper = r.savings >= 0,
    g = gasInfo(),
    rent = rentInfo(),
    energy = energyInfo();
  const homeFromAneel = i.charging === 'yes' && energy.origin === 'aneel';
  const autonomy =
    row('Sua rotina', `${number(i.kmDay)} km/dia`) +
    row('Estimativa entre recargas', `${number(r.usableRange)} km`) +
    row('Onde recarregar', i.charging === 'yes' ? 'Casa / trabalho' : 'Pontos públicos') +
    `<div class="explain">${i.charging === 'yes' ? 'Confirme o acesso ao carregador e avalie a instalação, se necessário.' : 'Confira o conector, a disponibilidade e uma alternativa de recarga.'}</div>`;
  const method =
    row(
      'Assinatura do ' + c.gas.name + (rent.gasEstimated ? ' (estimada)' : ''),
      brl(r.gasRent) + '/mês',
    ) +
    row(
      'Assinatura do ' + c.name + (rent.electricEstimated ? ' (estimada)' : ''),
      brl(r.electricRent) + '/mês',
    ) +
    row(
      'Gasolina em ' + i.uf.toUpperCase() + (g.estimated ? ' (estimada)' : ''),
      brl(g.price, 2) + '/L',
    ) +
    row(
      g.estimated ? 'Referência do preço' : 'Preço coletado',
      g.estimated ? 'Média ANP · ' + FUEL_ESTIMATE.period : collectionDate(),
    ) +
    row('Consumo do ' + c.gas.name, number(c.gas.urban, 1) + ' km/L na cidade') +
    row(
      'Energia em ' + (i.charging === 'yes' ? 'casa/trabalho' : 'ponto público'),
      brl(r.tariff, 2) + '/kWh',
    ) +
    (homeFromAneel
      ? row('Referência da energia', `ANEEL · ${describeDistributors(energy.distributors)}`)
      : '') +
    row(
      'Só energia × gasolina',
      (r.energySavings >= 0 ? 'Economia de ' : 'Custo adicional de ') +
        brl(Math.abs(r.energySavings)) +
        '/mês',
    ) +
    `<div class="explain">Mensalidades: ${rent.gasEstimated || rent.electricEstimated ? `valores estimados para um plano de ${RENT_PLAN}. Troque pela sua cotação.` : 'valores informados por você.'}<br><br>Consumo a gasolina: Inmetro. O elétrico usa uma estimativa conservadora, calculada a partir da bateria e da autonomia.<br><br>${homeFromAneel ? `Energia em casa: tarifa residencial de ${i.uf.toUpperCase()} homologada pela ANEEL, mais ${Math.round((ENERGY_TAX_FACTOR - 1) * 100)}% de impostos estimados.<br><br>` : ''}Consideramos 80% da autonomia nominal, bateria entre 20% e 80%, perdas de recarga de 10% e margem de 30% no trajeto diário.</div><p class="hint">Hatches automáticos de porte e proposta próximos. Não comparamos equipamentos ou preço de compra.</p><button class="subtle-link label-icon" data-action="assumptions">${icon('sliders-horizontal')} Ajustar preços e assinatura</button>`;
  return `<div class="intro result-intro"><div class="eyebrow">${c.full}</div><h1>Seu cenário</h1><p>${number(i.kmDay)} km por dia · ${number(r.monthlyKm)} km por mês</p></div><div class="result-car-switch" role="group" aria-label="Escolha o comparativo">${Object.values(
    CARS,
  )
    .map(
      (car) =>
        `<button type="button" data-car="${car.id}" aria-pressed="${i.car === car.id}"><strong>${car.name}</strong><small>× ${car.gas.name}</small></button>`,
    )
    .join(
      '',
    )}</div><section class="hero ${r.status}"><div class="hero-head"><div><span class="badge">${icon(r.status === 'not-fit' ? 'warning-circle' : 'check-circle')}${s.badge}</span><h2>${s.title}</h2></div>${r.status === 'not-fit' ? `<span class="status-warning">${icon('warning-circle')}</span>` : `<img class="art3d battery-art" src="${ARTWORK.battery}" alt="" aria-hidden="true">`}</div><p>${statusDetail(r, c)}</p><div class="ticks" aria-hidden="true">${Array.from({ length: 10 }, (_, j) => `<span class="${j < filled ? 'filled' : ''}"></span>`).join('')}</div><div class="meter-label"><span>Seu dia · ${number(i.kmDay)} km</span><strong>Entre recargas · ${number(r.usableRange)} km</strong></div></section><section class="card comparison-card"><div class="comparison-title"><div><span class="eyebrow">Assinatura + combustível</span><h2>Custo total por mês</h2></div><img class="art3d money-art" src="${ARTWORK.money}" alt="" aria-hidden="true"></div><div class="cost-comparison"><div class="cost-side"><span class="mini-icon">${icon('gas-pump')} Gasolina</span><img class="compare-car-photo" src="${c.gas.image}" alt="Foto ilustrativa do ${c.gas.full}"><h3>${c.gas.name}</h3><small>${c.gas.version}</small><strong>${brl(r.fuelTotal)}</strong><small>Assinatura ${brl(r.gasRent)}${rent.gasEstimated ? ' (est.)' : ''}</small><small>Gasolina ${brl(r.fuelCost)}</small><div class="bar"><span style="width:${(r.fuelTotal / max) * 100}%"></span></div></div><div class="cost-side electric"><span class="mini-icon">${icon('lightning')} Elétrico</span><img class="compare-car-photo" src="${c.image}" alt="Foto do ${c.full}"><h3>${c.name}</h3><small>${c.version}</small><strong>${brl(r.electricTotal)}</strong><small>Assinatura ${brl(r.electricRent)}${rent.electricEstimated ? ' (est.)' : ''}</small><small>Energia ${brl(r.electricCost)}</small><div class="bar"><span style="width:${(r.electricTotal / max) * 100}%"></span></div></div></div><div class="saving ${cheaper ? '' : 'negative'}"><span class="saving-caption">${icon('wallet')}<span>${cheaper ? 'Economia estimada' : 'Custo adicional estimado'}<small>assinatura + energia ou combustível</small></span></span><span><strong>${brl(Math.abs(r.savings))}</strong><small>/mês</small></span></div>${breakEvenNote(r)}<div class="comparison-source" data-fuel-note>${fuelNote()}</div></section>${group('charging', 'Autonomia e recarga', `${number(r.usableRange)} km estimados entre recargas`, 'battery-charging', autonomy)}${group('method', 'Como calculamos', 'Assinatura, preços e premissas', 'gauge', method)}<p class="note">${icon('info')}<span>Estimativa. Confirme a mensalidade na cotação. Não inclui instalação ou taxas extras.</span></p>`;
}
/** Texto de apoio do resultado; quando a rotina não cabe, mostra os números que explicam por quê. */
function statusDetail(r, car) {
  if (r.status !== 'not-fit') return STATUS[r.status].detail;
  return `Você roda ${number(state.input.kmDay)} km por dia e o ${car.name} cobre com folga até ${number(Math.floor(r.maxKmDay))} km. Seria preciso recarregar durante o dia.`;
}
/** Explica a partir de quantos km por dia o elétrico compensa, com os valores atuais. */
function breakEvenText(r) {
  const point = breakEven(r, state.input.daysMonth);
  if (point.kind === 'always')
    return {
      title: 'O elétrico custa menos em qualquer quilometragem',
      detail: 'Com estes valores, ele sai mais barato rodando pouco ou muito.',
    };
  if (point.kind === 'never')
    return {
      title: 'O elétrico não sai mais barato em nenhuma quilometragem',
      detail: 'Com estes valores, nem a mensalidade nem o custo por km são menores.',
    };
  if (point.kind === 'below')
    return {
      title: `O elétrico compensa até ${number(Math.floor(point.kmDay))} km por dia`,
      detail: 'Com esta tarifa de recarga, cada km custa mais do que com gasolina.',
    };
  const km = Math.ceil(point.kmDay);
  if (km > r.maxKmDay)
    return {
      title: 'Nesta comparação, o elétrico não compensa',
      detail:
        km > 1000
          ? 'A economia por km é pequena demais para pagar a diferença de mensalidade.'
          : `Ele só sairia mais barato acima de ${number(km)} km por dia, mais do que a autonomia cobre com folga (${number(Math.floor(r.maxKmDay))} km).`,
    };
  return {
    title: `O elétrico compensa a partir de ${number(km)} km por dia`,
    detail: 'Acima disso, a economia de energia supera a diferença de mensalidade.',
  };
}
function breakEvenNote(r) {
  const { title, detail } = breakEvenText(r);
  return `<div class="break-even">${icon('scales')}<span><strong>${title}</strong>${detail}</span></div>`;
}

// ----------------------------------------------------------------------
// Janelas (modais)
// ----------------------------------------------------------------------

function openModal(title, body) {
  $('modalTitle').textContent = title;
  $('modalContent').innerHTML = body;
  $('modal').showModal();
}
function homeTariffHint(energy) {
  if (energy.origin === 'custom') return 'Valor informado por você.';
  if (energy.origin === 'aneel')
    return `Tarifa residencial do estado (ANEEL · ${describeDistributors(energy.distributors)}) com impostos estimados. Use a da sua conta de luz.`;
  return 'Valor de exemplo. Use a tarifa da sua conta de luz.';
}
/** Ao trocar o estado no formulário, acompanha a tarifa de energia enquanto o cliente não digitar a sua. */
function syncHomeTariffField() {
  const field = $('a-homeTariff');
  if (!field || state.homeTariff !== null || field.value !== field.defaultValue) return;
  const energy = energyInfo($('pref-state').value);
  field.value = field.defaultValue = String(energy.price);
  $('homeTariffHint').textContent = homeTariffHint(energy);
}
function assumptions() {
  const c = CARS[state.input.car],
    rent = rentInfo(),
    energy = energyInfo(),
    { rent: rentLimit, tariff: tariffLimit, daysMonth: daysLimit } = LIMITS,
    rentHint = (estimated) =>
      estimated ? `Valor estimado (${RENT_PLAN}). Use a sua cotação.` : 'Valor informado por você.';
  openModal(
    'Preços e assinatura',
    `<form id="assumptionForm"><div class="field full"><label class="label-icon" for="pref-state">${icon('map-pin')} Estado dos preços de gasolina e energia</label><div class="state-controls"><select id="pref-state" name="uf">${stateOptions(state.input.uf)}</select><button type="button" class="icon-button" data-action="refresh" aria-label="Atualizar preços" ${state.fuel.loading ? 'disabled' : ''}>${icon('arrows-clockwise')}</button></div></div><div class="modal-fuel-note" data-fuel-note>${fuelNote()}</div><p class="hint">Média do estado, não o preço de um posto. Sem dado na API, usamos a média ANP como estimativa.</p><div class="field-grid"><div class="field full"><label class="label-icon" for="a-electricRent">${icon('lightning')} Assinatura do ${c.name} (R$/mês)</label><input type="number" id="a-electricRent" name="electricRent" min="${rentLimit.min}" max="${rentLimit.max}" step="0.01" value="${rent.electric}" required><p class="hint">${rentHint(rent.electricEstimated)}</p></div><div class="field full"><label class="label-icon" for="a-gasRent">${icon('gas-pump')} Assinatura do ${c.gas.name} (R$/mês)</label><input type="number" id="a-gasRent" name="gasRent" min="${rentLimit.min}" max="${rentLimit.max}" step="0.01" value="${rent.gas}" required><p class="hint">${rentHint(rent.gasEstimated)}</p></div><div class="field full"><label class="label-icon" for="a-homeTariff">${icon('house-line')} Energia em casa/trabalho (R$/kWh)</label><input type="number" id="a-homeTariff" name="homeTariff" min="${tariffLimit.min}" max="${tariffLimit.max}" step="0.01" value="${energy.price}" required><p class="hint" id="homeTariffHint">${homeTariffHint(energy)}</p></div><div class="field full"><label class="label-icon" for="a-publicTariff">${icon('charging-station')} Energia na rua (R$/kWh)</label><input type="number" id="a-publicTariff" name="publicTariff" min="${tariffLimit.min}" max="${tariffLimit.max}" step="0.01" value="${state.a.publicTariff}" required><p class="hint">Use a tarifa do ponto de recarga.</p></div><div class="field full"><label class="label-icon" for="a-daysMonth">${icon('calendar-dots')} Dias de uso por mês</label><input type="number" id="a-daysMonth" name="daysMonth" min="${daysLimit.min}" max="${daysLimit.max}" step="1" value="${state.input.daysMonth}" required></div></div><p class="hint">A energia na rua começa com um valor de exemplo. A API não fornece etanol nesta consulta.</p><button type="submit" class="primary">Aplicar ajustes ${icon('check-circle')}</button></form>`,
  );
}

// ----------------------------------------------------------------------
// Preços e região
// ----------------------------------------------------------------------

function updateFuelViews() {
  document.querySelectorAll('[data-fuel-note]').forEach((el) => {
    const uf =
      el.closest('#modalContent') && $('pref-state') ? $('pref-state').value : state.input.uf;
    el.innerHTML = fuelNote(uf);
  });
  document.querySelectorAll('[data-energy-note]').forEach((el) => {
    el.innerHTML = energyNote();
  });
  const button = document.querySelector('[data-action="refresh"]');
  if (button) button.disabled = state.fuel.loading;
  const select = $('pref-state');
  if (select) {
    const selected = select.value;
    select.innerHTML = stateOptions(selected);
  }
}
async function refreshFuel() {
  if (state.fuel.loading) return;
  state.fuel.loading = true;
  state.fuel.lastError = null;
  updateFuelViews();
  try {
    const { payload, data } = await fetchFuelPrices();
    if (data.collectedAt >= state.fuel.data.collectedAt) {
      state.fuel.data = data;
      cache.set('fuel', payload);
    }
    state.fuel.status = 'live';
  } catch (error) {
    state.fuel.status = 'unavailable';
    state.fuel.lastError = String(error.message || error);
  } finally {
    state.fuel.loading = false;
    if (state.result) {
      state.result = compute();
      render();
    }
    updateFuelViews();
  }
  return state.fuel;
}
function updateRegionView() {
  if (!$('regionStatus')) return;
  const { status, cep } = state.region;
  $('regionPlace').innerHTML = regionPlace();
  $('regionStatus').textContent = regionMessage();
  $('regionStatus').classList.toggle('error-text', status === 'error');
  if (status === 'ready') $('cep').value = formatCep(cep);
  document
    .querySelectorAll('.region-controls button')
    .forEach((button) => (button.disabled = status === 'loading'));
}
/** Aplica à simulação o estado encontrado por CEP ou pela localização do aparelho. */
async function applyRegion(find) {
  if (state.region.status === 'loading') return;
  syncForm();
  state.region = { ...state.region, status: 'loading', message: 'Consultando…' };
  updateRegionView();
  try {
    const found = await find();
    state.input.uf = found.uf;
    state.region = { status: 'ready', cep: found.cep ?? '', city: found.city, message: null };
    // Os preços mudaram: o resultado anterior deixa de valer.
    state.result = null;
    state.selectedScenario = null;
    syncScenarios();
    $('stepResult').disabled = true;
  } catch (error) {
    const message =
      error instanceof LocationError ? error.message : LocationError.MESSAGES.unavailable;
    state.region = { ...state.region, status: 'error', message };
  }
  updateRegionView();
  updateFuelViews();
}
const applyCep = () => applyRegion(() => lookupCep(state.region.cep, { cache }));
const applyDeviceLocation = () => applyRegion(() => locateByDevice());

// ----------------------------------------------------------------------
// Checklist, resumo e sobre
// ----------------------------------------------------------------------

function next() {
  openModal(
    'Antes de assinar',
    `<div class="section-label"><span>O que confirmar</span><span id="checkCount"></span></div><div class="progress" id="checkProgress"></div><ul class="checklist">${[
      [
        'Onde recarregar',
        state.input.charging === 'yes'
          ? 'Confirme o acesso ou a instalação do carregador.'
          : 'Confira pontos públicos e uma alternativa.',
        'charging-station',
      ],
      ['Condições do plano', 'Confira a mensalidade e a franquia de km.', 'car-profile'],
      ['Primeiros usos', 'Peça orientação sobre recarga e suporte.', 'lightning'],
    ]
      .map(
        ([title, detail, glyph], j) =>
          `<li><label><input type="checkbox" data-check="${j}" ${state.checks[j] ? 'checked' : ''}><span class="list-icon">${icon(glyph)}</span><span><strong>${title}</strong><small>${detail}</small></span></label></li>`,
      )
      .join(
        '',
      )}</ul><button class="primary" data-action="summary">Ver resumo ${icon('arrow-right')}</button>`,
  );
  updateChecks();
}
function updateChecks() {
  if (!$('checkCount')) return;
  $('checkCount').textContent = state.checks.filter(Boolean).length + ' de 3';
  $('checkProgress').innerHTML = state.checks
    .map((v) => `<span class="${v ? 'done' : ''}"></span>`)
    .join('');
}
function summary() {
  const r = state.result,
    c = CARS[state.input.car],
    i = state.input,
    g = gasInfo(),
    rent = rentInfo(),
    energy = energyInfo(),
    point = breakEvenText(r);
  const energySource =
    i.charging === 'no'
      ? 'ponto público, valor de exemplo'
      : energy.origin === 'aneel'
        ? `tarifa ANEEL de ${i.uf.toUpperCase()} com impostos estimados`
        : energy.origin === 'custom'
          ? 'valor informado'
          : 'valor de exemplo';
  const value = `SIMULAÇÃO DE ROTINA\n${c.full} × ${c.gas.full}\nRotina: ${i.kmDay} km/dia, ${i.daysMonth} dias/mês\nResultado: ${STATUS[r.status].badge}\nRecarga: ${i.charging === 'yes' ? 'Casa / trabalho' : 'Pontos públicos'}\n\n${c.name}: ${brl(r.electricTotal, 2)}/mês\n  Assinatura${rent.electricEstimated ? ' (estimada)' : ''}: ${brl(r.electricRent, 2)}\n  Energia: ${brl(r.electricCost, 2)}\n${c.gas.name}: ${brl(r.fuelTotal, 2)}/mês\n  Assinatura${rent.gasEstimated ? ' (estimada)' : ''}: ${brl(r.gasRent, 2)}\n  Gasolina: ${brl(r.fuelCost, 2)}\n${r.savings >= 0 ? 'Economia com o elétrico' : 'Custo adicional do elétrico'}: ${brl(Math.abs(r.savings), 2)}/mês\n${point.title}. ${point.detail}\n\nEnergia: ${brl(r.tariff, 2)}/kWh (${energySource})\nGasolina em ${i.uf.toUpperCase()}: ${brl(g.price, 2)}/L, ${g.estimated ? 'estimativa pela média ANP de ' + FUEL_ESTIMATE.period : 'coleta ' + collectionDate()}\nEstimativa de assinatura, energia e combustível. Confirme a mensalidade na cotação. Não inclui instalação ou taxas extras. Autonomia não garantida.`;
  $('modalTitle').textContent = 'Seu resumo';
  $('modalContent').innerHTML =
    `<textarea id="copyText" readonly aria-label="Resumo da simulação"></textarea><button class="primary" data-action="copy">Copiar resumo ${icon('copy')}</button>`;
  $('copyText').value = value;
}
function about() {
  openModal(
    'Sobre a simulação',
    `<p>Compare a rotina e o custo mensal (assinatura + energia ou combustível) de um elétrico e de um carro a gasolina.</p><p>A gasolina vem da Combustível API. O app mostra a data da coleta e usa o último dado salvo se a consulta falhar. Se a API não traz o estado, usamos a média ANP de ${FUEL_ESTIMATE.period} como estimativa.</p><p>As mensalidades são valores estimados (${RENT_PLAN}), sem fonte oficial. Troque pela sua cotação em "Ajustar preços e assinatura".</p><p>A energia em casa usa a tarifa residencial do estado homologada pela ANEEL (dados de ${brDate(ENERGY_TARIFFS.updatedAt)}), mais ${Math.round((ENERGY_TAX_FACTOR - 1) * 100)}% de impostos estimados. Não inclui bandeira tarifária, instalação, estacionamento ou taxas extras de recarga.</p><p>O CEP é consultado na BrasilAPI (ou no ViaCEP) e a localização, arredondada para cerca de 1 km, no OpenStreetMap. Servem só para identificar o estado e não são enviados a mais ninguém.</p><div class="sources"><a href="${FUEL_ESTIMATE.source}" target="_blank" rel="noopener">ANP · Levantamento de preços</a><br><a href="https://combustivelapi.com.br/" target="_blank" rel="noopener">Combustível API</a><br><a href="${ENERGY_TARIFFS.source}" target="_blank" rel="noopener">ANEEL · Tarifas das distribuidoras</a><br><a href="https://brasilapi.com.br/" target="_blank" rel="noopener">BrasilAPI</a> · <a href="https://viacep.com.br/" target="_blank" rel="noopener">ViaCEP</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a><br><a href="https://www.gov.br/inmetro/pt-br/assuntos/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular" target="_blank" rel="noopener">Inmetro · PBE Veicular 2026</a><br><a href="https://phosphoricons.com/" target="_blank" rel="noopener">Ícones: Phosphor Duotone</a> · <a href="https://old.3dicons.co/" target="_blank" rel="noopener">3dicons</a><br><small>Ilustrações BYD. Protótipo não oficial.</small></div>`,
  );
}

// ----------------------------------------------------------------------
// Ações
// ----------------------------------------------------------------------

function toast(text) {
  const el = $('toast'),
    host = $('modal').open ? $('modal') : document.body;
  if (el.parentNode !== host) host.append(el);
  el.textContent = text;
  el.hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (el.hidden = true), 2800);
}
function run() {
  syncForm();
  try {
    state.result = compute();
    state.screen = 'result';
    render();
    document.querySelector('.app').scrollTo(0, 0);
  } catch (error) {
    $('formError').hidden = false;
    $('formError').textContent = error.message;
  }
}
function edit() {
  state.screen = 'routine';
  render();
  document.querySelector('.app').scrollTo(0, 0);
}

// ----------------------------------------------------------------------
// Eventos
// ----------------------------------------------------------------------

document.addEventListener('input', (event) => {
  if (event.target.id === 'cep') {
    // Aplica a máscara e consulta sozinho quando o CEP fica completo.
    event.target.value = formatCep(event.target.value);
    state.region.cep = event.target.value.replace(/\D/g, '');
    if (normalizeCep(state.region.cep)) applyCep();
    return;
  }
  if (event.target.closest('#routineForm')) {
    syncForm();
    state.result = null;
    if (state.selectedScenario) {
      state.selectedScenario = null;
      syncScenarios();
    }
    $('stepResult').disabled = true;
    $('kmOutput').innerHTML = state.input.kmDay + ' <small>km</small>';
    $('monthPreview').textContent =
      number(state.input.kmDay * state.input.daysMonth) +
      ' km/mês · ' +
      state.input.daysMonth +
      ' dias';
    $('chargingHint').textContent = chargingHint();
  }
});
document.addEventListener('change', (event) => {
  if (event.target.matches('[data-check]')) {
    state.checks[Number(event.target.dataset.check)] = event.target.checked;
    updateChecks();
  }
  if (event.target.id === 'pref-state') {
    updateFuelViews();
    syncHomeTariffField();
  }
});
document.addEventListener('keydown', (event) => {
  // Enter no CEP consulta a região, em vez de enviar o formulário da rotina.
  if (event.key === 'Enter' && event.target.id === 'cep') {
    event.preventDefault();
    applyCep();
  }
});
document.addEventListener('submit', (event) => {
  if (event.target.id === 'routineForm') {
    event.preventDefault();
    run();
  }
  if (event.target.id === 'assumptionForm') {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    const data = new FormData(event.target);
    const uf = data.get('uf');
    try {
      gasoline(uf);
    } catch (error) {
      toast(error.message);
      return;
    }
    // Trocar o estado à mão desfaz a região encontrada por CEP ou localização.
    if (uf !== state.input.uf)
      state.region = { status: 'idle', cep: '', city: null, message: null };
    state.input.uf = uf;
    state.input.daysMonth = Number(data.get('daysMonth'));
    // Só vira tarifa do cliente se ele alterou o valor sugerido para o estado.
    const tariffField = event.target.elements.homeTariff;
    if (tariffField.value !== tariffField.defaultValue)
      state.homeTariff = Number(tariffField.value);
    state.a.publicTariff = Number(data.get('publicTariff'));
    const rent = state.rent[state.input.car];
    rent.electric = Number(data.get('electricRent'));
    rent.gas = Number(data.get('gasRent'));
    if (state.result) state.result = compute();
    $('modal').close();
    render();
    toast('Ajustes aplicados.');
  }
});
document.addEventListener('click', async (event) => {
  const car = event.target.closest('[data-car]');
  if (car) {
    syncForm();
    state.input.car = car.dataset.car;
    state.result = state.screen === 'result' ? compute() : null;
    render();
    document
      .querySelector(`#screen [data-car="${state.input.car}"]`)
      ?.focus({ preventScroll: true });
    return;
  }
  const preset = event.target.closest('[data-scenario]');
  if (preset) {
    const key = preset.dataset.scenario;
    state.selectedScenario = key;
    state.input = {
      ...state.input,
      kmDay: key === 'limit' ? 220 : 40,
      charging: key === 'public' ? 'no' : 'yes',
    };
    try {
      state.result = compute();
      state.screen = 'result';
      render();
      document.querySelector('.app').scrollTo(0, 0);
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'simulate') run();
  if (action === 'edit') edit();
  if (action === 'result' && state.result) {
    state.screen = 'result';
    render();
    document.querySelector('.app').scrollTo(0, 0);
  }
  if (action === 'assumptions') {
    syncForm();
    assumptions();
  }
  if (action === 'about') about();
  if (action === 'close') $('modal').close();
  if (action === 'next') next();
  if (action === 'summary') summary();
  if (action === 'refresh') await refreshFuel();
  if (action === 'lookup-cep') applyCep();
  if (action === 'locate') applyDeviceLocation();
  if (action === 'copy') {
    const text = $('copyText');
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(text.value);
      else {
        text.focus();
        text.select();
        if (!document.execCommand('copy')) throw new Error('copy');
      }
      toast('Resumo copiado.');
    } catch {
      text.focus();
      text.select();
      toast('Selecione o texto e copie.');
    }
  }
});
$('modal').addEventListener('click', (event) => {
  if (event.target === $('modal')) {
    const rect = $('modal').getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      $('modal').close();
  }
});
$('modal').addEventListener('close', () => {
  if ($('modal').contains($('toast'))) document.body.append($('toast'));
});
render();
refreshFuel();
