import { getConfiguracoes, listarServicos, obterHorariosDisponiveis, criarAgendamento, consultarAgendamentosCliente, reagendarAgendamentoCliente } from './functions.js';

const Estado = { config: {}, servicos: [], etapaAtual: 1, selecao: { nome: '', telefone: '', servicoId: null, servico: null, data: null, horario: null }, mesCalendarioExibido: new Date() };
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function mostrarLoadingGlobalCliente() { document.getElementById('overlay-loading-global').classList.remove('hidden'); }
function ocultarLoadingGlobalCliente() { document.getElementById('overlay-loading-global').classList.add('hidden'); }

document.addEventListener('DOMContentLoaded', async function () {
  aplicarTemaSalvo();
  await carregarDadosIniciais();
  configurarListenersGlobais();
});

async function carregarDadosIniciais() {
  mostrarLoadingGlobalCliente();
  try {
    Estado.config = await getConfiguracoes();
    preencherInfoBarbearia();
    await carregarServicos();
  } catch (erro) {
    exibirToast('Erro ao carregar configurações: ' + erro.message, 'erro');
  } finally {
    ocultarLoadingGlobalCliente();
  }
}

async function carregarServicos() {
  try {
    Estado.servicos = (await listarServicos(true)).filter(s => s.Ativo === true || s.Ativo === 'TRUE');
    renderizarListaServicosHome();
  } catch (erro) {
    exibirToast('Erro ao carregar serviços: ' + erro.message, 'erro');
  }
}

function preencherInfoBarbearia() {
  const c = Estado.config;
  document.title = c.NomeBarbearia || 'Barbearia';
  setTextoSeExistir('nome-barbearia-topo', c.NomeBarbearia);
  setTextoSeExistir('endereco-barbearia', c.Endereco);
  
  const linkWhats = document.getElementById('link-whatsapp');
  if (linkWhats && c.WhatsApp) linkWhats.href = 'https://wa.me/' + String(c.WhatsApp).replace(/\D/g, '');
  
  const linkInsta = document.getElementById('link-instagram');
  if (linkInsta) {
    if (c.Instagram) {
      linkInsta.href = c.Instagram.indexOf('http') === 0 ? c.Instagram : 'https://instagram.com/' + c.Instagram;
      linkInsta.classList.remove('hidden');
    } else { linkInsta.classList.add('hidden'); }
  }

  const logoImg = document.getElementById('topo-logo-img');
  const logoFallback = document.getElementById('topo-logo-fallback');
  if (logoImg && logoFallback) {
    if (c.Logo) { logoImg.src = c.Logo; logoImg.classList.remove('hidden'); logoFallback.classList.add('hidden'); } 
    else { logoImg.classList.add('hidden'); logoFallback.classList.remove('hidden'); }
  }
}

function setTextoSeExistir(id, texto) { const el = document.getElementById(id); if (el && texto) el.textContent = texto; }

function configurarListenersGlobais() {
  const toggleTema = document.getElementById('toggle-tema');
  if (toggleTema) toggleTema.addEventListener('click', alternarTema);
  document.querySelectorAll('[data-uppercase]').forEach(input => {
    input.addEventListener('input', function () {
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(pos, pos);
    });
  });
}

function aplicarTemaSalvo() {
  const tema = window.__temaAtual || 'escuro';
  document.documentElement.setAttribute('data-tema', tema);
  atualizarIconeTema(tema);
}
function alternarTema() {
  const atual = document.documentElement.getAttribute('data-tema') || 'escuro';
  const novo = atual === 'escuro' ? 'claro' : 'escuro';
  document.documentElement.setAttribute('data-tema', novo);
  window.__temaAtual = novo;
  atualizarIconeTema(novo);
}
function atualizarIconeTema(tema) {
  const icone = document.getElementById('icone-tema');
  if (icone) icone.className = tema === 'escuro' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

function exibirToast(mensagem, tipo) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + (tipo || '');
  const icones = { sucesso: 'fa-circle-check', erro: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = '<i class="fa-solid ' + (icones[tipo] || icones.info) + '"></i><span>' + escaparHtml(mensagem) + '</span>';
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('saindo'); setTimeout(() => toast.remove(), 260); }, 3800);
}
function escaparHtml(texto) { const div = document.createElement('div'); div.textContent = texto; return div.innerHTML; }

let contadorModaisAbertos = 0;
function travarScrollBody() { contadorModaisAbertos++; document.body.classList.add('modal-aberto'); }
function liberarScrollBody() { contadorModaisAbertos = Math.max(0, contadorModaisAbertos - 1); if (contadorModaisAbertos === 0) document.body.classList.remove('modal-aberto'); }

function renderizarListaServicosHome() {
  const container = document.getElementById('lista-servicos-home');
  if (!container) return;
  if (Estado.servicos.length === 0) {
    container.innerHTML = '<div class="estado-vazio"><p>Nenhum serviço disponível.</p></div>';
    return;
  }
  container.innerHTML = Estado.servicos.map(s => 
    `<div class="card-servico" data-servico-id="${s.ID}" onclick="selecionarServicoWizard('${s.ID}')">
      <div class="card-servico-info"><h3>${escaparHtml(s.Servico)}</h3>${s.Descricao ? `<div class="card-servico-desc">${escaparHtml(s.Descricao)}</div>` : ''}</div>
      <div class="card-servico-meta"><div class="card-servico-valor">R$ ${formatarMoeda(s.Valor)}</div><div class="card-servico-tempo"><i class="fa-regular fa-clock"></i> ${s.TempoAtendimento} min</div></div>
    </div>`
  ).join('');
}
function formatarMoeda(valor) { return parseFloat(valor || 0).toFixed(2).replace('.', ','); }

function abrirWizardAgendamento() {
  Estado.etapaAtual = 1;
  Estado.selecao = { nome: '', telefone: '', servicoId: null, servico: null, data: null, horario: null };
  Estado.mesCalendarioExibido = new Date();
  document.getElementById('modal-wizard').classList.remove('hidden');
  travarScrollBody();
  renderizarEtapaServicosWizard();
  irParaEtapa(1);
}
function fecharWizardAgendamento() {
  document.getElementById('modal-wizard').classList.add('hidden');
  liberarScrollBody();
}

const ETAPAS_WIZARD = [1, 2, 4, 5];
function irParaEtapa(numero) {
  Estado.etapaAtual = numero;
  const indiceAtual = ETAPAS_WIZARD.indexOf(numero);
  ETAPAS_WIZARD.forEach(i => {
    const painel = document.getElementById('wizard-etapa-' + i);
    if (painel) painel.classList.toggle('hidden', i !== numero);
    const ponto = document.getElementById('ponto-etapa-' + i);
    if (ponto) {
      ponto.classList.remove('ativa', 'concluida');
      if (ETAPAS_WIZARD.indexOf(i) < indiceAtual) ponto.classList.add('concluida');
      if (ETAPAS_WIZARD.indexOf(i) === indiceAtual) ponto.classList.add('ativa');
    }
  });
  if (numero === 4) carregarCalendarioWizard();
}

function avancarEtapa1() {
  const nome = document.getElementById('wizard-nome').value.trim();
  const telefone = document.getElementById('wizard-telefone').value.trim();
  if (!nome || nome.length < 3) { exibirToast('Informe seu nome completo.', 'erro'); return; }
  if (!telefone || telefone.replace(/\D/g, '').length < 10) { exibirToast('Informe um telefone válido com DDD.', 'erro'); return; }
  Estado.selecao.nome = nome;
  Estado.selecao.telefone = telefone;
  irParaEtapa(2);
}

function renderizarEtapaServicosWizard() {
  const container = document.getElementById('wizard-lista-servicos');
  if (!container) return;
  container.innerHTML = Estado.servicos.map(s => 
    `<div class="card-servico" data-servico-id="${s.ID}" onclick="selecionarServicoWizard('${s.ID}')">
      <div class="card-servico-info"><h3>${escaparHtml(s.Servico)}</h3></div>
      <div class="card-servico-meta"><div class="card-servico-valor">R$ ${formatarMoeda(s.Valor)}</div><div class="card-servico-tempo">${s.TempoAtendimento} min</div></div>
    </div>`
  ).join('');
}

function selecionarServicoWizard(servicoId) {
  const servico = Estado.servicos.find(s => s.ID === servicoId);
  if (!servico) return;
  Estado.selecao.servicoId = servicoId;
  Estado.selecao.servico = servico;
  document.querySelectorAll('#wizard-lista-servicos .card-servico').forEach(card => {
    card.classList.toggle('selecionado', card.getAttribute('data-servico-id') === servicoId);
  });
  setTimeout(() => irParaEtapa(4), 180);
}

function carregarCalendarioWizard() { renderizarCalendario(Estado.mesCalendarioExibido); }
function mudarMesCalendario(direcao) {
  const m = Estado.mesCalendarioExibido;
  Estado.mesCalendarioExibido = new Date(m.getFullYear(), m.getMonth() + direcao, 1);
  renderizarCalendario(Estado.mesCalendarioExibido);
}

function renderizarCalendario(dataReferencia) {
  const tituloMes = document.getElementById('calendario-titulo-mes');
  const grid = document.getElementById('calendario-grid-dias');
  if (!tituloMes || !grid) return;
  const ano = dataReferencia.getFullYear(), mes = dataReferencia.getMonth();
  tituloMes.textContent = MESES_PT[mes] + ' ' + ano;
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let html = '';
  for (let i = 0; i < primeiroDiaSemana; i++) html += '<div class="calendario-dia vazio"></div>';
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataDia = new Date(ano, mes, dia); dataDia.setHours(0, 0, 0, 0);
    const dataStr = formatarDataISOLocal(dataDia);
    const ehPassado = dataDia < hoje, ehHoje = dataDia.getTime() === hoje.getTime(), selecionado = Estado.selecao.data === dataStr;
    let classes = 'calendario-dia';
    if (ehPassado) classes += ' passado'; else classes += ' disponivel';
    if (ehHoje) classes += ' hoje'; if (selecionado) classes += ' selecionado';
    const onclick = ehPassado ? '' : ` onclick="selecionarDiaCalendario('${dataStr}')"`;
    html += `<div class="${classes}"${onclick}>${dia}</div>`;
  }
  grid.innerHTML = html;
}

function formatarDataISOLocal(data) {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
}

async function selecionarDiaCalendario(dataStr) {
  Estado.selecao.data = dataStr;
  Estado.selecao.horario = null;
  renderizarCalendario(Estado.mesCalendarioExibido);
  document.getElementById('horarios-titulo-data').textContent = formatarDataBr(dataStr);
  await carregarHorariosDisponiveis(dataStr);
}

function formatarDataBr(dataStr) {
  const partes = String(dataStr).substring(0, 10).split('-');
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

async function carregarHorariosDisponiveis(dataStr) {
  const container = document.getElementById('horarios-grid-container');
  container.innerHTML = '<div class="text-center" style="padding:20px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  try {
    const resultado = await obterHorariosDisponiveis(dataStr, Estado.selecao.servicoId);
    if (!resultado.sucesso) {
      container.innerHTML = '<div class="estado-vazio">Erro ao carregar horários.</div>';
      return;
    }
    renderizarHorarios(resultado.horarios);
  } catch (erro) {
    container.innerHTML = '<div class="estado-vazio">Erro ao carregar horários.</div>';
  }
}

function renderizarHorarios(horarios) {
  const container = document.getElementById('horarios-grid-container');
  if (!horarios || horarios.length === 0) {
    container.innerHTML = '<div class="estado-vazio"><p>Nenhum horário disponível nesta data.</p></div>';
    return;
  }
  container.innerHTML = '<div class="horarios-grid">' + horarios.map(h => 
    `<div class="horario-slot ${Estado.selecao.horario === h ? 'selecionado' : ''}" onclick="selecionarHorario('${h}')">${h}</div>`
  ).join('') + '</div>';
}

function selecionarHorario(horario) {
  Estado.selecao.horario = horario;
  document.querySelectorAll('.horario-slot').forEach(slot => {
    slot.classList.toggle('selecionado', slot.textContent.trim() === horario);
  });
}

function avancarParaResumo() {
  if (!Estado.selecao.data) { exibirToast('Selecione uma data.', 'erro'); return; }
  if (!Estado.selecao.horario) { exibirToast('Selecione um horário.', 'erro'); return; }
  renderizarResumoAgendamento();
  irParaEtapa(5);
}

function renderizarResumoAgendamento() {
  const s = Estado.selecao;
  document.getElementById('resumo-agendamento-container').innerHTML = 
    `<div class="resumo-linha"><span class="resumo-label">Cliente</span><span class="resumo-valor">${escaparHtml(s.nome)}</span></div>
     <div class="resumo-linha"><span class="resumo-label">Telefone</span><span class="resumo-valor">${escaparHtml(s.telefone)}</span></div>
     <div class="resumo-linha"><span class="resumo-label">Serviço</span><span class="resumo-valor">${escaparHtml(s.servico.Servico)}</span></div>
     <div class="resumo-linha"><span class="resumo-label">Data</span><span class="resumo-valor">${formatarDataBr(s.data)}</span></div>
     <div class="resumo-linha"><span class="resumo-label">Horário</span><span class="resumo-valor">${s.horario}</span></div>
     <div class="resumo-linha"><span class="resumo-label">Valor</span><span class="resumo-valor texto-dourado">R$ ${formatarMoeda(s.servico.Valor)}</span></div>`;
}

async function confirmarAgendamentoFinal() {
  const btn = document.getElementById('btn-confirmar-agendamento');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  const s = Estado.selecao;
  try {
    const dados = { ...s, TelefoneLimpo: s.telefone.replace(/\D/g, '') };
    const resultado = await criarAgendamento(dados);
    if (!resultado.sucesso) { exibirToast(resultado.mensagem || 'Erro ao confirmar.', 'erro'); return; }
    exibirToast('Agendamento realizado com sucesso!', 'sucesso');
    fecharWizardAgendamento();
    document.getElementById('confirmacao-final-texto').innerHTML = `Seu horário com <strong>${escaparHtml(resultado.resumo.servico || s.servico.Servico)}</strong> foi confirmado para<br><strong>${formatarDataBr(resultado.resumo.data || s.data)}</strong> às <strong>${resultado.resumo.horario || s.horario}</strong>.`;
    document.getElementById('modal-confirmacao-final').classList.remove('hidden');
    travarScrollBody();
  } catch (erro) {
    exibirToast('Erro ao confirmar: ' + erro.message, 'erro');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Confirmar Agendamento';
  }
}

function fecharConfirmacaoFinal() {
  document.getElementById('modal-confirmacao-final').classList.add('hidden');
  liberarScrollBody();
}

function abrirConsultaAgendamento() {
  document.getElementById('modal-consulta').classList.remove('hidden');
  travarScrollBody();
  document.getElementById('consulta-resultado').innerHTML = '';
}
function fecharConsultaAgendamento() {
  document.getElementById('modal-consulta').classList.add('hidden');
  liberarScrollBody();
}

async function buscarMeusAgendamentos() {
  const telefone = document.getElementById('consulta-telefone').value.trim();
  const container = document.getElementById('consulta-resultado');
  if (!telefone) { exibirToast('Informe o telefone usado no agendamento.', 'erro'); return; }
  container.innerHTML = '<div class="text-center" style="padding:20px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  try {
    const resultado = await consultarAgendamentosCliente(telefone);
    if (!resultado.sucesso || !resultado.agendamentos || resultado.agendamentos.length === 0) {
      container.innerHTML = '<div class="estado-vazio"><p>Nenhum agendamento encontrado.</p></div>';
      return;
    }
    container.innerHTML = resultado.agendamentos.map(a => {
      const podeEditar = a.Status === 'Agendado' || a.Status === 'Confirmado';
      const botaoEditar = podeEditar ? `<button class="btn btn-secundario mt-12" style="padding:9px 12px;font-size:13px;" onclick="abrirModalStatusCliente('${a.ID}', '${a.Status}', '${a.Data}', '${a.Horario}', '${escaparHtml(a.Servico)}')"><i class="fa-solid fa-pen"></i> Editar</button>` : '';
      return `<div class="card" style="margin-top:10px;">
        <div class="flex justify-between items-center"><h3 style="font-size:15px;font-weight:600;">${escaparHtml(a.Servico)}</h3><span class="badge badge-${a.Status.toLowerCase().replace('ã','a').replace('õ','o')}">${a.Status}</span></div>
        <div class="texto-suave mt-8" style="font-size:13px;">${formatarDataBr(a.Data)} às ${a.Horario}</div>${botaoEditar}
      </div>`;
    }).join('');
  } catch (erro) {
    container.innerHTML = '<div class="estado-vazio">Erro ao buscar.</div>';
  }
}

const EstadoEdicaoCliente = { id: null, servicoId: null, data: null, horario: null, mesExibido: new Date() };

function abrirModalStatusCliente(id, statusAtual, dataAtual, horarioAtual, nomeServico) {
  EstadoEdicaoCliente.id = id;
  EstadoEdicaoCliente.data = dataAtual;
  EstadoEdicaoCliente.horario = horarioAtual;
  EstadoEdicaoCliente.mesExibido = new Date(dataAtual + 'T00:00:00');
  const servico = Estado.servicos.find(s => s.Servico === nomeServico);
  EstadoEdicaoCliente.servicoId = servico ? servico.ID : null;
  document.getElementById('status-cliente-id').value = id;
  document.getElementById('form-status-cliente').value = statusAtual === 'Confirmado' ? 'Agendado' : statusAtual;
  renderizarCalendarioCliente(EstadoEdicaoCliente.mesExibido);
  document.getElementById('horarios-cliente-titulo-data').textContent = formatarDataBr(dataAtual);
  carregarHorariosClienteEdicao(dataAtual);
  document.getElementById('modal-status-cliente').classList.remove('hidden');
  travarScrollBody();
}
function fecharModalStatusCliente() {
  document.getElementById('modal-status-cliente').classList.add('hidden');
  liberarScrollBody();
}
function mudarMesCalendarioCliente(direcao) {
  const m = EstadoEdicaoCliente.mesExibido;
  EstadoEdicaoCliente.mesExibido = new Date(m.getFullYear(), m.getMonth() + direcao, 1);
  renderizarCalendarioCliente(EstadoEdicaoCliente.mesExibido);
}
function renderizarCalendarioCliente(dataReferencia) {
  const tituloMes = document.getElementById('calendario-cliente-titulo-mes');
  const grid = document.getElementById('calendario-cliente-grid-dias');
  if (!tituloMes || !grid) return;
  const ano = dataReferencia.getFullYear(), mes = dataReferencia.getMonth();
  tituloMes.textContent = MESES_PT[mes] + ' ' + ano;
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let html = '';
  for (let i = 0; i < primeiroDiaSemana; i++) html += '<div class="calendario-dia vazio"></div>';
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataDia = new Date(ano, mes, dia); dataDia.setHours(0, 0, 0, 0);
    const dataStr = formatarDataISOLocal(dataDia);
    const ehPassado = dataDia < hoje, ehHoje = dataDia.getTime() === hoje.getTime(), selecionado = EstadoEdicaoCliente.data === dataStr;
    let classes = 'calendario-dia';
    if (ehPassado) classes += ' passado'; else classes += ' disponivel';
    if (ehHoje) classes += ' hoje'; if (selecionado) classes += ' selecionado';
    const onclick = ehPassado ? '' : ` onclick="selecionarDiaCalendarioCliente('${dataStr}')"`;
    html += `<div class="${classes}"${onclick}>${dia}</div>`;
  }
  grid.innerHTML = html;
}
async function selecionarDiaCalendarioCliente(dataStr) {
  EstadoEdicaoCliente.data = dataStr;
  EstadoEdicaoCliente.horario = null;
  renderizarCalendarioCliente(EstadoEdicaoCliente.mesExibido);
  document.getElementById('horarios-cliente-titulo-data').textContent = formatarDataBr(dataStr);
  await carregarHorariosClienteEdicao(dataStr);
}
async function carregarHorariosClienteEdicao(dataStr) {
  const container = document.getElementById('horarios-cliente-grid-container');
  container.innerHTML = '<div class="text-center" style="padding:20px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  try {
    const resultado = await obterHorariosDisponiveis(dataStr, EstadoEdicaoCliente.servicoId);
    let horarios = resultado.sucesso ? resultado.horarios.slice() : [];
    if (dataStr === EstadoEdicaoCliente.data.split('T')[0] && EstadoEdicaoCliente.horario && !horarios.includes(EstadoEdicaoCliente.horario)) {
      horarios.push(EstadoEdicaoCliente.horario);
      horarios.sort();
    }
    renderizarHorariosCliente(horarios);
  } catch (erro) {
    container.innerHTML = '<div class="estado-vazio">Erro ao carregar horários.</div>';
  }
}
function renderizarHorariosCliente(horarios) {
  const container = document.getElementById('horarios-cliente-grid-container');
  if (!horarios || horarios.length === 0) {
    container.innerHTML = '<div class="estado-vazio"><p>Nenhum horário disponível.</p></div>';
    return;
  }
  container.innerHTML = '<div class="horarios-grid">' + horarios.map(h => 
    `<div class="horario-slot ${EstadoEdicaoCliente.horario === h ? 'selecionado' : ''}" onclick="selecionarHorarioCliente('${h}')">${h}</div>`
  ).join('') + '</div>';
}
function selecionarHorarioCliente(horario) {
  EstadoEdicaoCliente.horario = horario;
  document.querySelectorAll('#horarios-cliente-grid-container .horario-slot').forEach(slot => {
    slot.classList.toggle('selecionado', slot.textContent.trim() === horario);
  });
}
async function confirmarStatusCliente() {
  const id = document.getElementById('status-cliente-id').value;
  const novoStatus = document.getElementById('form-status-cliente').value;
  if (!EstadoEdicaoCliente.data || !EstadoEdicaoCliente.horario) { exibirToast('Selecione data e horário.', 'erro'); return; }
  try {
    await reagendarAgendamentoCliente(id, EstadoEdicaoCliente.data, EstadoEdicaoCliente.horario);
    exibirToast('Agendamento atualizado com sucesso!', 'sucesso');
    fecharModalStatusCliente();
    buscarMeusAgendamentos();
  } catch (erro) {
    exibirToast('Erro: ' + erro.message, 'erro');
  }
}
