import { 
  getConfiguracoes, 
  salvarConfiguracoes, 
  listarServicos, 
  salvarServico, 
  excluirServico, 
  listarAgendamentos, 
  atualizarStatusAgendamento, 
  excluirAgendamento, 
  listarClientes, 
  salvarCliente, 
  listarFinanceiro, 
  registrarLancamentoManual, 
  excluirLancamento, 
  obterDashboard,
  reagendarAgendamentoCliente,
  consultarAgendamentosCliente
} from './functions.js';

/* ==========================================================================
SISTEMA DE AGENDAMENTO - BARBEARIA
Scripts do painel administrativo - Versão Firebase
========================================================================== */
const EstadoAdmin = {
  dashboard: null,
  agendamentos: [],
  servicos: [],
  clientes: [],
  financeiro: [],
  configuracoes: {},
  filtroPeriodoAgenda: 'mes',
  graficosCarregados: false
};

// ============================================================================
// OVERLAY GLOBAL "AGUARDE..."
// ============================================================================
let chamadasAtivasAdmin = 0;

function mostrarLoadingGlobalAdmin() {
  chamadasAtivasAdmin++;
  const overlay = document.getElementById('overlay-loading-global');
  if (overlay) overlay.classList.remove('hidden');
}

function ocultarLoadingGlobalAdmin() {
  chamadasAtivasAdmin = Math.max(0, chamadasAtivasAdmin - 1);
  if (chamadasAtivasAdmin === 0) {
    const overlay = document.getElementById('overlay-loading-global');
    if (overlay) overlay.classList.add('hidden');
  }
}

// Inicialização
window.addEventListener('load', function () {
  carregarDashboard();
  carregarServicosAdmin();
  carregarClientesAdmin();
  carregarConfiguracoesAdmin();
});

// ============================================================================
// MODAL DE CONFIRMAÇÃO GENÉRICO
// ============================================================================
let acaoConfirmacaoPendente = null;

function abrirConfirmacao(titulo, mensagem, callback, textoBotao) {
  document.getElementById('confirmacao-titulo').textContent = titulo || 'Confirmar ação';
  document.getElementById('confirmacao-mensagem').textContent = mensagem || 'Esta ação não pode ser desfeita.';
  document.getElementById('btn-confirmar-acao').textContent = textoBotao || 'Excluir';
  acaoConfirmacaoPendente = callback;
  document.getElementById('modal-confirmacao').classList.remove('hidden');
  travarScrollBody();
}

function cancelarConfirmacao() {
  acaoConfirmacaoPendente = null;
  document.getElementById('modal-confirmacao').classList.add('hidden');
  liberarScrollBody();
}

function confirmarAcaoPendente() {
  const callback = acaoConfirmacaoPendente;
  document.getElementById('modal-confirmacao').classList.add('hidden');
  liberarScrollBody();
  acaoConfirmacaoPendente = null;
  if (callback) callback();
}

// ============================================================================
// MENU MOBILE
// ============================================================================
function abrirMenuMobile() {
  document.getElementById('admin-sidebar').classList.add('aberta');
  document.getElementById('admin-overlay-mobile').classList.add('aberto');
  travarScrollBody();
}

function fecharMenuMobile() {
  document.getElementById('admin-sidebar').classList.remove('aberta');
  document.getElementById('admin-overlay-mobile').classList.remove('aberto');
  liberarScrollBody();
}

// ============================================================================
// NAVEGAÇÃO ENTRE SEÇÕES
// ============================================================================
function trocarSecaoAdmin(secao) {
  document.querySelectorAll('.admin-secao').forEach(function (el) {
    el.classList.toggle('ativa', el.id === 'secao-' + secao);
  });
  document.querySelectorAll('.admin-nav-item[data-secao]').forEach(function (el) {
    el.classList.toggle('ativo', el.getAttribute('data-secao') === secao);
  });
  
  if (secao === 'dashboard') carregarDashboard();
  if (secao === 'agenda') carregarAgendaAdmin();
  if (secao === 'servicos') carregarServicosAdmin();
  if (secao === 'clientes') carregarClientesAdmin();
  if (secao === 'financeiro') carregarFinanceiroAdmin();
  if (secao === 'configuracoes') carregarConfiguracoesAdmin();
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================
function exibirToast(mensagem, tipo) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast ' + (tipo || '');
  const icones = { sucesso: 'fa-circle-check', erro: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const icone = icones[tipo] || icones.info;
  
  toast.innerHTML = '<i class="fa-solid ' + icone + '"></i><span>' + escaparHtml(mensagem) + '</span>';
  container.appendChild(toast);
  
  setTimeout(function () {
    toast.classList.add('saindo');
    setTimeout(function () { toast.remove(); }, 260);
  }, 3800);
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : texto;
  return div.innerHTML;
}

function formatarMoeda(valor) {
  return parseFloat(valor || 0).toFixed(2).replace('.', ',');
}

function formatarDataBr(dataStr) {
  if (!dataStr) return '--';
  const partes = String(dataStr).substring(0, 10).split('-');
  if (partes.length < 3) return dataStr;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

function classeBadgeStatus(status) {
  const mapa = {
    'Agendado': 'badge-agendado',
    'Confirmado': 'badge-confirmado',
    'Concluído': 'badge-concluido',
    'Cancelado': 'badge-cancelado',
    'Não Compareceu': 'badge-naocompareceu'
  };
  return mapa[status] || 'badge-agendado';
}

function formatarDataISOLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return ano + '-' + mes + '-' + dia;
}

// ============================================================================
// MODAL DE DETALHES DO KPI
// ============================================================================
function abrirModalKpi(tipo) {
  const titulos = {
    'hoje': 'Agendamentos de Hoje',
    'semana': 'Agendamentos desta Semana',
    'mes': 'Agendamentos deste Mês',
    'clientes': 'Clientes Cadastrados',
    'receita-hoje': 'Receita de Hoje',
    'receita-mes': 'Receita do Mês',
    'walkin-hoje': 'Clientes Diretos — Hoje',
    'walkin-mes': 'Clientes Diretos — Mês'
  };
  
  document.getElementById('modal-kpi-titulo').textContent = titulos[tipo] || 'Detalhes';
  document.getElementById('modal-kpi-total').style.display = 'none';
  document.getElementById('modal-kpi-conteudo').innerHTML = 
    '<div class="text-center" style="padding:30px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  document.getElementById('modal-kpi').classList.remove('hidden');
  travarScrollBody();
  
  const hoje = formatarDataISOLocal(new Date());
  const inicioSemana = obterInicioSemanaLocal();
  const fimSemana = obterFimSemanaLocal();
  const inicioMes = hoje.substring(0, 7) + '-01';
  const fimMes = formatarDataISOLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  
  if (tipo === 'clientes') {
    renderizarModalKpiClientes();
    return;
  }
  
  if (tipo === 'walkin-hoje' || tipo === 'walkin-mes') {
    const dataInicio = tipo === 'walkin-hoje' ? hoje : inicioMes;
    const dataFim = tipo === 'walkin-hoje' ? hoje : fimMes;
    listarFinanceiro({ dataInicio: dataInicio, dataFim: dataFim })
      .then(function (lista) {
        renderizarModalKpiFinanceiro(lista || []);
      })
      .catch(function (erro) {
        exibirToast('Erro: ' + erro.message, 'erro');
        fecharModalKpi();
      });
    return;
  }
  
  const filtros = {
    'hoje':         { dataInicio: hoje,       dataFim: hoje       },
    'semana':       { dataInicio: inicioSemana, dataFim: fimSemana },
    'mes':          { dataInicio: inicioMes,   dataFim: fimMes     },
    'receita-hoje': { dataInicio: hoje,        dataFim: hoje,       financeiro: true },
    'receita-mes':  { dataInicio: inicioMes,   dataFim: fimMes,     financeiro: true }
  };
  
  const f = filtros[tipo];
  if (f.financeiro) {
    listarFinanceiro({ dataInicio: f.dataInicio, dataFim: f.dataFim })
      .then(function (lista) {
        renderizarModalKpiFinanceiro(lista || []);
      })
      .catch(function (erro) {
        exibirToast('Erro: ' + erro.message, 'erro');
        fecharModalKpi();
      });
  } else {
    listarAgendamentos({ dataInicio: f.dataInicio, dataFim: f.dataFim })
      .then(function (lista) {
        renderizarModalKpiAgendamentos(lista || []);
      })
      .catch(function (erro) {
        exibirToast('Erro: ' + erro.message, 'erro');
        fecharModalKpi();
      });
  }
}

function fecharModalKpi() {
  document.getElementById('modal-kpi').classList.add('hidden');
  liberarScrollBody();
}

function obterInicioSemanaLocal() {
  const hoje = new Date();
  const dia = hoje.getDay();
  const diff = hoje.getDate() - dia + (dia === 0 ? -6 : 1);
  return formatarDataISOLocal(new Date(hoje.getFullYear(), hoje.getMonth(), diff));
}

function obterFimSemanaLocal() {
  const hoje = new Date();
  const dia = hoje.getDay();
  const diff = hoje.getDate() - dia + (dia === 0 ? 0 : 7);
  return formatarDataISOLocal(new Date(hoje.getFullYear(), hoje.getMonth(), diff));
}

function renderizarModalKpiAgendamentos(lista) {
  const container = document.getElementById('modal-kpi-conteudo');
  if (lista.length === 0) {
    container.innerHTML = '<div class="estado-vazio">Nenhum agendamento neste período.</div>';
    return;
  }
  
  container.innerHTML = lista.map(function (a) {
    return '' +
      '<div class="resumo-linha">' +
        '<span class="resumo-label">' +
          escaparHtml(a.Cliente) + '<br>' +
          '<span style="font-size:12px;">' + escaparHtml(a.Servico) + ' · ' + formatarDataBr(a.Data) + ' ' + (a.Horario || '') + '</span>' +
        '</span>' +
        '<span class="resumo-valor">' +
          '<span class="badge ' + classeBadgeStatus(a.Status) + '">' + a.Status + '</span>' +
        '</span>' +
      '</div>';
  }).join('');
}

function renderizarModalKpiFinanceiro(lista) {
  const container = document.getElementById('modal-kpi-conteudo');
  const totalEl = document.getElementById('modal-kpi-total');
  
  if (lista.length === 0) {
    container.innerHTML = '<div class="estado-vazio">Nenhum lançamento neste período.</div>';
    totalEl.style.display = 'none';
    return;
  }
  
  const total = lista.reduce(function (soma, f) { return soma + (parseFloat(f.Valor) || 0); }, 0);
  totalEl.textContent = 'Total: R$ ' + formatarMoeda(total);
  totalEl.style.display = 'block';
  
  container.innerHTML = lista.map(function (f) {
    return '' +
      '<div class="resumo-linha">' +
        '<span class="resumo-label">' +
          escaparHtml(f.Cliente) + '<br>' +
          '<span style="font-size:12px;">' + escaparHtml(f.Servico) + ' · ' + escaparHtml(f.FormaPagamento) + '</span>' +
        '</span>' +
        '<span class="resumo-valor texto-dourado">R$ ' + formatarMoeda(f.Valor) + '</span>' +
      '</div>';
  }).join('');
}

function renderizarModalKpiClientes() {
  const container = document.getElementById('modal-kpi-conteudo');
  const totalEl = document.getElementById('modal-kpi-total');
  const lista = EstadoAdmin.clientes || [];
  
  if (lista.length === 0) {
    container.innerHTML = '<div class="estado-vazio">Nenhum cliente cadastrado.</div>';
    return;
  }
  
  totalEl.textContent = lista.length + ' cliente(s) cadastrado(s)';
  totalEl.style.display = 'block';
  
  container.innerHTML = lista.map(function (c) {
    return '' +
      '<div class="resumo-linha">' +
        '<span class="resumo-label">' +
          escaparHtml(c.Nome) + '<br>' +
          '<span style="font-size:12px;">' + escaparHtml(c.Telefone) + '</span>' +
        '</span>' +
        '<span class="resumo-valor" style="font-size:12px;">' +
          (c.UltimoAtendimento ? formatarDataBr(c.UltimoAtendimento) : '—') +
        '</span>' +
      '</div>';
  }).join('');
}

// ============================================================================
// CONTROLE DE SCROLL
// ============================================================================
let contadorModaisAbertosAdmin = 0;

function travarScrollBody() {
  contadorModaisAbertosAdmin++;
  document.body.classList.add('modal-aberto');
}

function liberarScrollBody() {
  contadorModaisAbertosAdmin = Math.max(0, contadorModaisAbertosAdmin - 1);
  if (contadorModaisAbertosAdmin === 0) {
    document.body.classList.remove('modal-aberto');
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================
async function carregarDashboard() {
  mostrarLoadingGlobalAdmin();
  try {
    const resultado = await obterDashboard();
    ocultarLoadingGlobalAdmin();
    
    if (!resultado.sucesso) {
      exibirToast(resultado.mensagem || 'Erro ao carregar dashboard.', 'erro');
      return;
    }
    
    EstadoAdmin.dashboard = resultado;
    renderizarDashboard(resultado);
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro ao carregar dashboard: ' + erro.message, 'erro');
  }
}

function renderizarDashboard(d) {
  document.getElementById('kpi-agendamentos-hoje').textContent = d.contadores.agendamentosHoje;
  document.getElementById('kpi-agendamentos-semana').textContent = d.contadores.agendamentosSemana;
  document.getElementById('kpi-agendamentos-mes').textContent = d.contadores.agendamentosMes;
  document.getElementById('kpi-total-clientes').textContent = d.contadores.totalClientes;
  document.getElementById('kpi-receita-dia').textContent = 'R$ ' + formatarMoeda(d.contadores.receitaDiaria);
  document.getElementById('kpi-receita-mes').textContent = 'R$ ' + formatarMoeda(d.contadores.receitaMensal);
  
  const kpiWalkinHoje = document.getElementById('kpi-walkin-hoje');
  const kpiWalkinMes = document.getElementById('kpi-walkin-mes');
  if (kpiWalkinHoje) kpiWalkinHoje.textContent = d.contadores.walkInsHoje || 0;
  if (kpiWalkinMes) kpiWalkinMes.textContent = d.contadores.walkInsMes || 0;
  
  renderizarRankingServicos(d.rankingServicos);
  renderizarRankingClientes(d.rankingClientes);
  renderizarProximosAtendimentos(d.proximosAtendimentos);
  desenharGraficoAgendamentosDias(d.serieDias);
  desenharGraficoReceitaMeses(d.serieMeses);
}

function renderizarRankingServicos(ranking) {
  const container = document.getElementById('ranking-servicos-lista');
  if (!ranking || ranking.length === 0) {
    container.innerHTML = '<div class="texto-suave" style="font-size:13px;">Sem dados suficientes ainda.</div>';
    return;
  }
  
  container.innerHTML = ranking.map(function (r, i) {
    return '<div class="resumo-linha"><span class="resumo-label">' + (i + 1) + 'º ' + escaparHtml(r.servico) + '</span><span class="resumo-valor">' + r.total + '</span></div>';
  }).join('');
}

function renderizarRankingClientes(ranking) {
  const container = document.getElementById('ranking-clientes-lista');
  if (!ranking || ranking.length === 0) {
    container.innerHTML = '<div class="texto-suave" style="font-size:13px;">Sem dados suficientes ainda.</div>';
    return;
  }
  
  container.innerHTML = ranking.map(function (r, i) {
    return '<div class="resumo-linha"><span class="resumo-label">' + (i + 1) + 'º ' + escaparHtml(r.cliente) + '</span><span class="resumo-valor">' + r.total + 'x</span></div>';
  }).join('');
}

function renderizarProximosAtendimentos(lista) {
  const container = document.getElementById('proximos-atendimentos-lista');
  if (!lista || lista.length === 0) {
    container.innerHTML = '<div class="texto-suave" style="font-size:13px;">Nenhum atendimento futuro agendado.</div>';
    return;
  }
  
  container.innerHTML = lista.map(function (a) {
    return '' +
      '<div class="resumo-linha">' +
        '<span class="resumo-label">' + escaparHtml(a.Cliente) + ' — ' + escaparHtml(a.Servico) + '</span>' +
        '<span class="resumo-valor">' + formatarDataBr(a.Data) + ' ' + a.Horario + '</span>' +
      '</div>';
  }).join('');
}

let graficoAgendamentosInstancia = null;
let graficoReceitaInstancia = null;

const pluginValoresAcimaDosPontos = {
  id: 'valoresAcimaDosPontos',
  afterDatasetsDraw: function (chart) {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    const larguraArea = chart.chartArea.right;
    
    ctx.save();
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#F5F7FA';
    
    meta.data.forEach(function (point, index) {
      const texto = dataset.labelsValores ? dataset.labelsValores[index] : String(dataset.data[index]);
      const larguraTexto = ctx.measureText(texto).width;
      let alinhamento = 'center';
      let posX = point.x;
      
      if (point.x + larguraTexto / 2 > larguraArea) {
        alinhamento = 'right';
        posX = larguraArea;
      } else if (point.x - larguraTexto / 2 < chart.chartArea.left) {
        alinhamento = 'left';
        posX = chart.chartArea.left;
      }
      
      ctx.textAlign = alinhamento;
      ctx.fillText(texto, posX, point.y - 12);
    });
    
    ctx.restore();
  }
};

function desenharGraficoAgendamentosDias(serie) {
  const labels = serie.map(function (s) {
    const partes = s.data.split('-');
    return partes[2] + '/' + partes[1];
  });
  
  const valores = serie.map(function (s) { return s.total; });
  
  if (graficoAgendamentosInstancia) {
    graficoAgendamentosInstancia.destroy();
  }
  
  const ctx = document.getElementById('grafico-agendamentos-dias').getContext('2d');
  const gradiente = ctx.createLinearGradient(0, 0, 0, 220);
  gradiente.addColorStop(0, 'rgba(30,95,255,0.35)');
  gradiente.addColorStop(1, 'rgba(30,95,255,0)');
  
  graficoAgendamentosInstancia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        labelsValores: valores.map(String),
        borderColor: '#1E5FFF',
        backgroundColor: gradiente,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#1E5FFF',
        pointBorderColor: '#F5F7FA',
        pointBorderWidth: 1.5,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 8 } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          ticks: { color: '#8B96A3', font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#8B96A3', font: { size: 10 }, precision: 0 },
          grid: { color: 'rgba(30,95,255,0.08)' }
        }
      }
    },
    plugins: [pluginValoresAcimaDosPontos]
  });
}

function desenharGraficoReceitaMeses(serie) {
  const nomesMeses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels = serie.map(function (s) {
    const partes = s.mes.split('-');
    return nomesMeses[parseInt(partes[1], 10) - 1];
  });
  
  const valores = serie.map(function (s) { return s.receita; });
  
  if (graficoReceitaInstancia) {
    graficoReceitaInstancia.destroy();
  }
  
  const ctx = document.getElementById('grafico-receita-meses').getContext('2d');
  const gradiente = ctx.createLinearGradient(0, 0, 0, 220);
  gradiente.addColorStop(0, 'rgba(30,95,255,0.35)');
  gradiente.addColorStop(1, 'rgba(30,95,255,0)');
  
  graficoReceitaInstancia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        labelsValores: valores.map(function (v) { return 'R$ ' + formatarMoeda(v); }),
        borderColor: '#1E5FFF',
        backgroundColor: gradiente,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#1E5FFF',
        pointBorderColor: '#F5F7FA',
        pointBorderWidth: 1.5,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 8 } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          ticks: { color: '#8B96A3', font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#8B96A3',
            font: { size: 10 },
            callback: function (valor) { return 'R$ ' + valor; }
          },
          grid: { color: 'rgba(30,95,255,0.08)' }
        }
      }
    },
    plugins: [pluginValoresAcimaDosPontos]
  });
}

// ============================================================================
// AGENDA
// ============================================================================
async function carregarAgendaAdmin() {
  await filtrarAgendaPeriodo(EstadoAdmin.filtroPeriodoAgenda);
}

async function filtrarAgendaPeriodo(periodo) {
  EstadoAdmin.filtroPeriodoAgenda = periodo;
  
  document.querySelectorAll('[data-filtro-periodo]').forEach(function (btn) {
    const ativo = btn.getAttribute('data-filtro-periodo') === periodo;
    btn.classList.toggle('btn-primario', ativo);
    btn.classList.toggle('btn-secundario', !ativo);
  });
  
  const hoje = new Date();
  let dataInicio, dataFim;
  
  if (periodo === 'dia') {
    dataInicio = dataFim = formatarDataISOLocal(hoje);
  } else if (periodo === 'semana') {
    const diaSemana = hoje.getDay();
    const diffInicio = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const inicio = new Date(hoje);
    inicio.setDate(diffInicio);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    dataInicio = formatarDataISOLocal(inicio);
    dataFim = formatarDataISOLocal(fim);
  } else {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    dataInicio = formatarDataISOLocal(inicio);
    dataFim = formatarDataISOLocal(fim);
  }
  
  const tbody = document.getElementById('tabela-agendamentos-body');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:30px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>';
  
  mostrarLoadingGlobalAdmin();
  try {
    const lista = await listarAgendamentos({ dataInicio: dataInicio, dataFim: dataFim });
    ocultarLoadingGlobalAdmin();
    EstadoAdmin.agendamentos = lista || [];
    renderizarTabelaAgendamentos();
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro ao carregar agenda: ' + erro.message, 'erro');
  }
}

function renderizarTabelaAgendamentos() {
  const busca = (document.getElementById('busca-agenda').value || '').toLowerCase();
  const statusFiltro = document.getElementById('filtro-status-agenda').value;
  
  let lista = EstadoAdmin.agendamentos;
  
  if (busca) {
    lista = lista.filter(function (a) {
      return String(a.Cliente).toLowerCase().indexOf(busca) > -1 ||
        String(a.Telefone).toLowerCase().indexOf(busca) > -1 ||
        String(a.Servico).toLowerCase().indexOf(busca) > -1;
    });
  }
  
  if (statusFiltro) {
    lista = lista.filter(function (a) { return a.Status === statusFiltro; });
  }
  
  const tbody = document.getElementById('tabela-agendamentos-body');
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:30px;">Nenhum agendamento encontrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = lista.map(function (a) {
    return '' +
      '<tr>' +
        '<td>' + escaparHtml(a.Cliente) + '<br><span class="texto-suave" style="font-size:11px;">' + escaparHtml(a.Telefone) + '</span></td>' +
        '<td>' + escaparHtml(a.Servico) + '</td>' +
        '<td>' + formatarDataBr(a.Data) + '</td>' +
        '<td>' + a.Horario + '</td>' +
        '<td>R$ ' + formatarMoeda(a.Valor) + '</td>' +
        '<td><span class="badge ' + classeBadgeStatus(a.Status) + '">' + a.Status + '</span></td>' +
        '<td>' +
          '<div class="acoes-tabela">' +
            '<button class="btn-icone" style="width:32px;height:32px;" onclick="abrirModalStatus(\'' + a.ID + '\', \'' + a.Status + '\')" title="Atualizar status">' +
              '<i class="fa-solid fa-pen" style="font-size:12px;"></i>' +
            '</button>' +
            '<button class="btn-icone" style="width:32px;height:32px;" onclick="excluirAgendamentoAdmin(\'' + a.ID + '\')" title="Excluir">' +
              '<i class="fa-solid fa-trash" style="font-size:12px;color:var(--cor-navalha);"></i>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }).join('');
}

function abrirModalStatus(id, statusAtual) {
  document.getElementById('status-agendamento-id').value = id;
  document.getElementById('form-novo-status').value = statusAtual;
  alternarCampoPagamentoStatus();
  document.getElementById('modal-status-agendamento').classList.remove('hidden');
  travarScrollBody();
}

function fecharModalStatus() {
  document.getElementById('modal-status-agendamento').classList.add('hidden');
  liberarScrollBody();
}

document.addEventListener('DOMContentLoaded', function () {
  const select = document.getElementById('form-novo-status');
  if (select) select.addEventListener('change', alternarCampoPagamentoStatus);
});

function alternarCampoPagamentoStatus() {
  const status = document.getElementById('form-novo-status').value;
  document.getElementById('campo-forma-pagamento-status').style.display = status === 'Concluído' ? 'block' : 'none';
}

async function confirmarAtualizacaoStatus() {
  const id = document.getElementById('status-agendamento-id').value;
  const novoStatus = document.getElementById('form-novo-status').value;
  const formaPagamento = document.getElementById('form-pagamento-status').value;
  
  const btn = document.getElementById('btn-confirmar-status');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';
  }
  
  try {
    const resultado = await atualizarStatusAgendamento(id, novoStatus, formaPagamento);
    
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Atualizar'; }
    
    if (!resultado.sucesso) {
      exibirToast(resultado.mensagem || 'Erro ao atualizar status.', 'erro');
      return;
    }
    
    exibirToast(resultado.mensagem, 'sucesso');
    fecharModalStatus();
    carregarAgendaAdmin();
    carregarDashboard();
    
    if (document.getElementById('secao-financeiro').classList.contains('ativa')) {
      carregarFinanceiroAdmin();
    }
  } catch (erro) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Atualizar'; }
    exibirToast('Erro: ' + erro.message, 'erro');
  }
}

function excluirAgendamentoAdmin(id) {
  abrirConfirmacao('Excluir agendamento', 'Esta ação não pode ser desfeita.', async function () {
    mostrarLoadingGlobalAdmin();
    try {
      const resultado = await excluirAgendamento(id);
      ocultarLoadingGlobalAdmin();
      
      if (!resultado.sucesso) {
        exibirToast(resultado.mensagem || 'Erro ao excluir.', 'erro');
        return;
      }
      
      exibirToast(resultado.mensagem, 'sucesso');
      carregarAgendaAdmin();
      carregarDashboard();
    } catch (erro) {
      ocultarLoadingGlobalAdmin();
      exibirToast('Erro: ' + erro.message, 'erro');
    }
  });
}

// ============================================================================
// SERVIÇOS
// ============================================================================
async function carregarServicosAdmin() {
  mostrarLoadingGlobalAdmin();
  try {
    const lista = await listarServicos(false);
    ocultarLoadingGlobalAdmin();
    EstadoAdmin.servicos = lista || [];
    renderizarTabelaServicos();
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro ao carregar serviços: ' + erro.message, 'erro');
  }
}

function renderizarTabelaServicos() {
  const tbody = document.getElementById('tabela-servicos-body');
  if (EstadoAdmin.servicos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:30px;">Nenhum serviço cadastrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = EstadoAdmin.servicos.map(function (s) {
    const ativo = s.Ativo === true || s.Ativo === 'TRUE';
    return '' +
      '<tr>' +
        '<td>' + escaparHtml(s.Servico) + '</td>' +
        '<td>R$ ' + formatarMoeda(s.Valor) + '</td>' +
        '<td>' + s.TempoAtendimento + ' min</td>' +
        '<td><span class="badge ' + (ativo ? 'badge-concluido' : 'badge-cancelado') + '">' + (ativo ? 'Ativo' : 'Inativo') + '</span></td>' +
        '<td>' +
          '<div class="acoes-tabela">' +
            '<button class="btn-icone" style="width:32px;height:32px;" onclick="editarServicoAdmin(\'' + s.ID + '\')" title="Editar">' +
              '<i class="fa-solid fa-pen" style="font-size:12px;"></i>' +
            '</button>' +
            '<button class="btn-icone" style="width:32px;height:32px;" onclick="excluirServicoAdmin(\'' + s.ID + '\')" title="Excluir">' +
              '<i class="fa-solid fa-trash" style="font-size:12px;color:var(--cor-navalha);"></i>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }).join('');
}

function abrirModalServico() {
  document.getElementById('titulo-modal-servico').textContent = 'Novo Serviço';
  document.getElementById('servico-id-edicao').value = '';
  document.getElementById('form-servico-nome').value = '';
  document.getElementById('form-servico-descricao').value = '';
  document.getElementById('form-servico-valor').value = '';
  document.getElementById('form-servico-tempo').value = '';
  document.getElementById('form-servico-ativo').checked = true;
  document.getElementById('modal-servico').classList.remove('hidden');
  travarScrollBody();
}

function editarServicoAdmin(id) {
  const servico = EstadoAdmin.servicos.find(function (s) { return s.ID === id; });
  if (!servico) return;
  
  document.getElementById('titulo-modal-servico').textContent = 'Editar Serviço';
  document.getElementById('servico-id-edicao').value = servico.ID;
  document.getElementById('form-servico-nome').value = servico.Servico;
  document.getElementById('form-servico-descricao').value = servico.Descricao || '';
  document.getElementById('form-servico-valor').value = servico.Valor;
  document.getElementById('form-servico-tempo').value = servico.TempoAtendimento;
  document.getElementById('form-servico-ativo').checked = servico.Ativo === true || servico.Ativo === 'TRUE';
  document.getElementById('modal-servico').classList.remove('hidden');
  travarScrollBody();
}

function fecharModalServico() {
  document.getElementById('modal-servico').classList.add('hidden');
  liberarScrollBody();
}

async function salvarServicoAdmin() {
  const nome = document.getElementById('form-servico-nome').value.trim();
  const valor = document.getElementById('form-servico-valor').value;
  const tempo = document.getElementById('form-servico-tempo').value;
  
  if (!nome) { exibirToast('Informe o nome do serviço.', 'erro'); return; }
  if (!valor || parseFloat(valor) < 0) { exibirToast('Informe um valor válido.', 'erro'); return; }
  if (!tempo || parseInt(tempo, 10) <= 0) { exibirToast('Informe o tempo de atendimento.', 'erro'); return; }
  
  const dados = {
    ID: document.getElementById('servico-id-edicao').value || null,
    Servico: nome,
    Descricao: document.getElementById('form-servico-descricao').value.trim(),
    Valor: valor,
    TempoAtendimento: tempo,
    Ativo: document.getElementById('form-servico-ativo').checked
  };
  
  try {
    const resultado = await salvarServico(dados);
    
    if (!resultado.sucesso) {
      exibirToast(resultado.mensagem || 'Erro ao salvar serviço.', 'erro');
      return;
    }
    
    exibirToast(resultado.mensagem, 'sucesso');
    fecharModalServico();
    carregarServicosAdmin();
  } catch (erro) {
    exibirToast('Erro: ' + erro.message, 'erro');
  }
}

function excluirServicoAdmin(id) {
  abrirConfirmacao('Excluir serviço', 'Esta ação não pode ser desfeita.', async function () {
    mostrarLoadingGlobalAdmin();
    try {
      const resultado = await excluirServico(id);
      ocultarLoadingGlobalAdmin();
      
      if (!resultado.sucesso) {
        exibirToast(resultado.mensagem || 'Erro ao excluir.', 'erro');
        return;
      }
      
      exibirToast(resultado.mensagem, 'sucesso');
      carregarServicosAdmin();
    } catch (erro) {
      ocultarLoadingGlobalAdmin();
      exibirToast('Erro: ' + erro.message, 'erro');
    }
  });
}

// ============================================================================
// CLIENTES
// ============================================================================
async function carregarClientesAdmin() {
  mostrarLoadingGlobalAdmin();
  try {
    const lista = await listarClientes();
    ocultarLoadingGlobalAdmin();
    EstadoAdmin.clientes = lista || [];
    renderizarTabelaClientes();
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro ao carregar clientes: ' + erro.message, 'erro');
  }
}

function renderizarTabelaClientes() {
  const buscaEl = document.getElementById('busca-clientes');
  const busca = buscaEl ? buscaEl.value.toLowerCase() : '';
  
  let lista = EstadoAdmin.clientes;
  if (busca) {
    lista = lista.filter(function (c) {
      return String(c.Nome).toLowerCase().indexOf(busca) > -1 || String(c.Telefone).toLowerCase().indexOf(busca) > -1;
    });
  }
  
  const tbody = document.getElementById('tabela-clientes-body');
  if (!tbody) return;
  
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:30px;">Nenhum cliente encontrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = lista.map(function (c) {
    return '' +
      '<tr>' +
        '<td>' + escaparHtml(c.Nome) + '</td>' +
        '<td>' + escaparHtml(c.Telefone) + '</td>' +
        '<td>' + formatarDataBr(c.DataCadastro) + '</td>' +
        '<td>' + (c.UltimoAtendimento ? formatarDataBr(c.UltimoAtendimento) : '—') + '</td>' +
      '</tr>';
  }).join('');
}

// ============================================================================
// FINANCEIRO
// ============================================================================
function carregarFinanceiroAdmin() {
  filtrarFinanceiroPeriodo('hoje');
  carregarTotalMesFinanceiro();
  setTimeout(carregarPendentesPagamento, 400);
}

async function carregarTotalMesFinanceiro() {
  const hoje = new Date();
  const inicioMes = formatarDataISOLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const fimMes = formatarDataISOLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  
  try {
    const lista = await listarFinanceiro({ dataInicio: inicioMes, dataFim: fimMes });
    const total = (lista || []).reduce(function (soma, f) {
      return soma + (parseFloat(f.Valor) || 0);
    }, 0);
    const el = document.getElementById('fin-total-mes');
    if (el) el.textContent = 'R$ ' + formatarMoeda(total);
  } catch (erro) {
    // Silencioso
  }
}

async function filtrarFinanceiroPeriodo(tipo) {
  const hoje = new Date();
  const hojeStr = formatarDataISOLocal(hoje);
  let dataInicio, dataFim, label;
  
  document.querySelectorAll('[onclick^="filtrarFinanceiroPeriodo"]').forEach(function (btn) {
    btn.classList.remove('btn-primario');
    btn.classList.add('btn-secundario');
  });
  
  if (tipo === 'mes-atual') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    dataInicio = formatarDataISOLocal(inicio);
    dataFim = formatarDataISOLocal(fim);
    label = 'Mês atual (' + (hoje.getMonth() + 1) + '/' + hoje.getFullYear() + ')';
    const btn = document.querySelector('[onclick="filtrarFinanceiroPeriodo(\'mes-atual\')"]');
    if (btn) { btn.classList.add('btn-primario'); btn.classList.remove('btn-secundario'); }
  } else if (tipo === 'mes-anterior') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    dataInicio = formatarDataISOLocal(inicio);
    dataFim = formatarDataISOLocal(fim);
    label = 'Mês anterior (' + (inicio.getMonth() + 1) + '/' + inicio.getFullYear() + ')';
    const btn = document.querySelector('[onclick="filtrarFinanceiroPeriodo(\'mes-anterior\')"]');
    if (btn) { btn.classList.add('btn-primario'); btn.classList.remove('btn-secundario'); }
  } else if (tipo === 'hoje') {
    dataInicio = dataFim = hojeStr;
    label = 'Hoje (' + formatarDataBr(hojeStr) + ')';
    const btn = document.querySelector('[onclick="filtrarFinanceiroPeriodo(\'hoje\')"]');
    if (btn) { btn.classList.add('btn-primario'); btn.classList.remove('btn-secundario'); }
  } else if (tipo === 'tudo') {
    dataInicio = null;
    dataFim = null;
    label = 'Todos os lançamentos';
    const btn = document.querySelector('[onclick="filtrarFinanceiroPeriodo(\'tudo\')"]');
    if (btn) { btn.classList.add('btn-primario'); btn.classList.remove('btn-secundario'); }
  } else if (tipo === 'personalizado') {
    dataInicio = document.getElementById('fin-data-inicio').value;
    dataFim = document.getElementById('fin-data-fim').value;
    if (!dataInicio || !dataFim) {
      exibirToast('Informe as duas datas para o período personalizado.', 'erro');
      return;
    }
    if (dataInicio > dataFim) {
      exibirToast('A data inicial não pode ser maior que a data final.', 'erro');
      return;
    }
    label = formatarDataBr(dataInicio) + ' a ' + formatarDataBr(dataFim);
  }
  
  const tbody = document.getElementById('tabela-financeiro-body');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:30px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>';
  
  const labelEl = document.getElementById('fin-periodo-label');
  if (labelEl) labelEl.textContent = label;
  
  mostrarLoadingGlobalAdmin();
  try {
    const lista = await listarFinanceiro({ dataInicio: dataInicio, dataFim: dataFim });
    ocultarLoadingGlobalAdmin();
    
    EstadoAdmin.financeiro = lista || [];
    renderizarTabelaFinanceiro();
    
    const total = (lista || []).reduce(function (soma, f) {
      return soma + (parseFloat(f.Valor) || 0);
    }, 0);
    const totalEl = document.getElementById('fin-total-periodo');
    if (totalEl) totalEl.textContent = 'R$ ' + formatarMoeda(total);
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro ao carregar financeiro: ' + erro.message, 'erro');
  }
}

async function carregarPendentesPagamento() {
  const container = document.getElementById('pendentes-pagamento-lista');
  if (!container) return;
  
  container.innerHTML = '<div class="text-center" style="padding:14px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  
  const hoje = new Date();
  const inicioMes = formatarDataISOLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const fimMes = formatarDataISOLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  
  try {
    const lista = await listarAgendamentos({ dataInicio: inicioMes, dataFim: fimMes });
    renderizarPendentesPagamento(lista || []);
  } catch (erro) {
    exibirToast('Erro ao carregar pendentes: ' + erro.message, 'erro');
    if (container) container.innerHTML = '<div class="texto-suave" style="font-size:13px;">Erro ao carregar.</div>';
  }
}

function renderizarPendentesPagamento(todos) {
  const container = document.getElementById('pendentes-pagamento-lista');
  const pendentes = todos
    .filter(function (a) { return a.Status === 'Agendado' || a.Status === 'Confirmado'; })
    .sort(function (a, b) { return String(a.Data + a.Horario).localeCompare(String(b.Data + b.Horario)); });
  
  if (pendentes.length === 0) {
    container.innerHTML = '<div class="texto-suave" style="font-size:13px;">Nenhum agendamento pendente de pagamento.</div>';
    return;
  }
  
  container.innerHTML = pendentes.map(function (a) {
    return '' +
      '<div class="resumo-linha" style="cursor:pointer;" onclick="abrirModalStatus(\'' + a.ID + '\', \'' + a.Status + '\')">' +
        '<span class="resumo-label">' + escaparHtml(a.Cliente) + ' — ' + escaparHtml(a.Servico) + '<br>' +
          '<span class="texto-suave" style="font-size:11px;">' + formatarDataBr(a.Data) + ' às ' + a.Horario + '</span></span>' +
        '<span class="resumo-valor">R$ ' + formatarMoeda(a.Valor) + '</span>' +
      '</div>';
  }).join('');
}

function renderizarTabelaFinanceiro() {
  const tbody = document.getElementById('tabela-financeiro-body');
  if (EstadoAdmin.financeiro.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:30px;">Nenhum lançamento encontrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = EstadoAdmin.financeiro.map(function (f) {
    return '' +
      '<tr>' +
        '<td>' + formatarDataBr(f.Data) + '</td>' +
        '<td>' + escaparHtml(f.Cliente) + '</td>' +
        '<td>' + escaparHtml(f.Servico) + '</td>' +
        '<td>R$ ' + formatarMoeda(f.Valor) + '</td>' +
        '<td>' + escaparHtml(f.FormaPagamento) + '</td>' +
        '<td><span class="badge badge-concluido">' + escaparHtml(f.StatusPagamento || 'Pago') + '</span></td>' +
        '<td>' +
          '<div class="acoes-tabela">' +
            '<button class="btn-icone" style="width:32px;height:32px;" onclick="editarLancamentoAdmin(\'' + f.ID + '\')" title="Editar">' +
              '<i class="fa-solid fa-pen" style="font-size:12px;"></i>' +
            '</button>' +
            '<button class="btn-icone" style="width:32px;height:32px;" onclick="excluirLancamentoAdmin(\'' + f.ID + '\')" title="Excluir">' +
              '<i class="fa-solid fa-trash" style="font-size:12px;color:var(--cor-navalha);"></i>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }).join('');
}

function abrirModalLancamento() {
  document.getElementById('form-lanc-data').value = formatarDataISOLocal(new Date());
  document.getElementById('form-lanc-cliente').value = '';
  document.getElementById('form-lanc-valor').value = '';
  if (document.getElementById('form-lanc-descricao')) {
    document.getElementById('form-lanc-descricao').value = '';
  }
  
  const selectServico = document.getElementById('form-lanc-servico');
  selectServico.innerHTML = '<option value="">Selecione um serviço...</option>';
  (EstadoAdmin.servicos || []).forEach(function (s) {
    if (s.Ativo === true || s.Ativo === 'TRUE') {
      const opt = document.createElement('option');
      opt.value = s.Servico;
      opt.setAttribute('data-valor', s.Valor);
      opt.textContent = s.Servico + ' — R$ ' + formatarMoeda(s.Valor);
      selectServico.appendChild(opt);
    }
  });
  
  document.getElementById('modal-lancamento').classList.remove('hidden');
  travarScrollBody();
}

function fecharModalLancamento() {
  const modal = document.getElementById('modal-lancamento');
  modal.classList.add('hidden');
  modal.removeAttribute('data-edicao-id');
  const titulo = modal.querySelector('.modal-header h2');
  if (titulo) titulo.textContent = 'Novo Lançamento';
  liberarScrollBody();
}

function editarLancamentoAdmin(id) {
  const lancamento = EstadoAdmin.financeiro.find(function (f) { return f.ID === id; });
  if (!lancamento) return;
  
  document.getElementById('form-lanc-data').value = String(lancamento.Data).substring(0, 10);
  document.getElementById('form-lanc-cliente').value = lancamento.Cliente || '';
  document.getElementById('form-lanc-valor').value = lancamento.Valor || '';
  if (document.getElementById('form-lanc-descricao')) {
    document.getElementById('form-lanc-descricao').value = '';
  }
  
  const selectServico = document.getElementById('form-lanc-servico');
  selectServico.innerHTML = '<option value="">Selecione um serviço...</option>';
  (EstadoAdmin.servicos || []).forEach(function (s) {
    if (s.Ativo === true || s.Ativo === 'TRUE') {
      const opt = document.createElement('option');
      opt.value = s.Servico;
      opt.setAttribute('data-valor', s.Valor);
      opt.textContent = s.Servico + ' — R$ ' + formatarMoeda(s.Valor);
      if (s.Servico === lancamento.Servico) opt.selected = true;
      selectServico.appendChild(opt);
    }
  });
  
  if (!selectServico.value) {
    const opt = document.createElement('option');
    opt.value = lancamento.Servico;
    opt.textContent = lancamento.Servico;
    opt.selected = true;
    selectServico.appendChild(opt);
  }
  
  const selectPag = document.getElementById('form-lanc-pagamento');
  if (selectPag) selectPag.value = lancamento.FormaPagamento || 'Pix';
  
  document.getElementById('modal-lancamento').setAttribute('data-edicao-id', id);
  document.querySelector('#modal-lancamento .modal-header h2').textContent = 'Editar Lançamento';
  document.getElementById('modal-lancamento').classList.remove('hidden');
  travarScrollBody();
}

function excluirLancamentoAdmin(id) {
  const lancamento = EstadoAdmin.financeiro.find(function (f) { return f.ID === id; });
  const nomeCliente = lancamento ? escaparHtml(lancamento.Cliente) : '';
  const mensagem = nomeCliente
    ? 'Excluir lançamento de ' + nomeCliente + '? Esta ação não pode ser desfeita.'
    : 'Esta ação não pode ser desfeita.';
  
  abrirConfirmacao('Excluir Lançamento', mensagem, async function () {
    mostrarLoadingGlobalAdmin();
    try {
      const resultado = await excluirLancamento(id);
      ocultarLoadingGlobalAdmin();
      
      if (!resultado.sucesso) {
        exibirToast(resultado.mensagem || 'Erro ao excluir.', 'erro');
        return;
      }
      
      exibirToast(resultado.mensagem, 'sucesso');
      carregarFinanceiroAdmin();
      carregarDashboard();
    } catch (erro) {
      ocultarLoadingGlobalAdmin();
      exibirToast('Erro: ' + erro.message, 'erro');
    }
  });
}

function preencherValorServico() {
  const select = document.getElementById('form-lanc-servico');
  const opcaoSelecionada = select.options[select.selectedIndex];
  const valor = opcaoSelecionada ? opcaoSelecionada.getAttribute('data-valor') : '';
  if (valor) {
    document.getElementById('form-lanc-valor').value = parseFloat(valor).toFixed(2);
  }
}

async function salvarLancamentoAdmin() {
  const selectServico = document.getElementById('form-lanc-servico');
  const nomeServico = selectServico.value;
  const descricao = document.getElementById('form-lanc-descricao')
    ? document.getElementById('form-lanc-descricao').value.trim()
    : '';
  const nomeCompleto = nomeServico + (descricao ? ' (' + descricao + ')' : '');
  
  const dados = {
    Data: document.getElementById('form-lanc-data').value,
    Cliente: document.getElementById('form-lanc-cliente').value.trim(),
    Servico: nomeCompleto,
    Valor: document.getElementById('form-lanc-valor').value,
    FormaPagamento: document.getElementById('form-lanc-pagamento').value,
    StatusPagamento: 'Pago'
  };
  
  if (!dados.Data || !dados.Cliente || !nomeServico || !dados.Valor) {
    exibirToast('Preencha todos os campos obrigatórios.', 'erro');
    return;
  }
  
  const idEdicao = document.getElementById('modal-lancamento').getAttribute('data-edicao-id');
  if (idEdicao) dados.ID = idEdicao;
  
  const btn = document.getElementById('btn-salvar-lancamento');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';
  }
  
  try {
    const resultado = await registrarLancamentoManual(dados);
    
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar'; }
    
    if (!resultado.sucesso) {
      exibirToast(resultado.mensagem || 'Erro ao salvar lançamento.', 'erro');
      return;
    }
    
    exibirToast(resultado.mensagem, 'sucesso');
    fecharModalLancamento();
    carregarFinanceiroAdmin();
    carregarDashboard();
  } catch (erro) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar'; }
    exibirToast('Erro: ' + erro.message, 'erro');
  }
}

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================
async function carregarConfiguracoesAdmin() {
  mostrarLoadingGlobalAdmin();
  try {
    const config = await getConfiguracoes();
    ocultarLoadingGlobalAdmin();
    EstadoAdmin.configuracoes = config || {};
    preencherFormConfiguracoes(config);
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro ao carregar configurações: ' + erro.message, 'erro');
  }
}

const DIAS_SEMANA_ADMIN = [
  { chave: 'Domingo', label: 'Domingo' },
  { chave: 'Segunda', label: 'Segunda-feira' },
  { chave: 'Terca', label: 'Terça-feira' },
  { chave: 'Quarta', label: 'Quarta-feira' },
  { chave: 'Quinta', label: 'Quinta-feira' },
  { chave: 'Sexta', label: 'Sexta-feira' },
  { chave: 'Sabado', label: 'Sábado' }
];

function preencherFormConfiguracoes(c) {
  const campos = ['NomeBarbearia', 'Logo', 'Endereco', 'WhatsApp', 'Instagram', 'Facebook', 'TempoPadraoAtendimento'];
  campos.forEach(function (campo) {
    const el = document.getElementById('cfg-' + campo);
    if (el && c[campo] !== undefined && c[campo] !== null) {
      el.value = String(c[campo]);
    }
  });
  renderizarGradeHorarios(c);
}

function renderizarGradeHorarios(c) {
  const container = document.getElementById('grade-horarios-semana');
  if (!container) return;
  
  container.innerHTML = DIAS_SEMANA_ADMIN.map(function (d) {
    const fechado = c[d.chave + '_Fechado'] === 'true' || c[d.chave + '_Fechado'] === true;
    const abertura = c[d.chave + '_Abertura'] || '09:00';
    const fechamento = c[d.chave + '_Fechamento'] || '19:00';
    const intervalo = c[d.chave + '_Intervalo'] || '30';
    
    return '' +
      '<div class="card" style="margin-bottom:10px;" id="dia-card-' + d.chave + '">' +
        '<div class="flex justify-between items-center mb-8">' +
          '<strong style="font-size:13.5px;">' + d.label + '</strong>' +
          '<label class="flex items-center gap-8" style="text-transform:none;font-size:12.5px;font-weight:600;">' +
            '<input type="checkbox" id="dia-fechado-' + d.chave + '" style="width:auto;" ' + (fechado ? 'checked' : '') + ' onchange="alternarDiaFechado(\'' + d.chave + '\')"> Fechado' +
          '</label>' +
        '</div>' +
        '<div class="flex gap-8" id="dia-campos-' + d.chave + '" style="' + (fechado ? 'display:none;' : '') + '">' +
          '<div class="campo" style="flex:1;margin-bottom:0;">' +
            '<label style="font-size:10.5px;">Abertura</label>' +
            '<input type="time" id="dia-abertura-' + d.chave + '" value="' + abertura + '">' +
          '</div>' +
          '<div class="campo" style="flex:1;margin-bottom:0;">' +
            '<label style="font-size:10.5px;">Fechamento</label>' +
            '<input type="time" id="dia-fechamento-' + d.chave + '" value="' + fechamento + '">' +
          '</div>' +
          '<div class="campo" style="flex:1;margin-bottom:0;">' +
            '<label style="font-size:10.5px;">Intervalo (min)</label>' +
            '<input type="number" id="dia-intervalo-' + d.chave + '" min="5" step="5" value="' + intervalo + '">' +
          '</div>' +
        '</div>' +
      '</div>';
  }).join('');
}

function alternarDiaFechado(chaveDia) {
  const fechado = document.getElementById('dia-fechado-' + chaveDia).checked;
  document.getElementById('dia-campos-' + chaveDia).style.display = fechado ? 'none' : 'flex';
}

async function salvarConfiguracoesAdmin() {
  const campos = ['NomeBarbearia', 'Logo', 'Endereco', 'WhatsApp', 'Instagram', 'Facebook', 'TempoPadraoAtendimento'];
  const dados = {};
  
  campos.forEach(function (campo) {
    const el = document.getElementById('cfg-' + campo);
    if (el) dados[campo] = el.value;
  });
  
  DIAS_SEMANA_ADMIN.forEach(function (d) {
    const fechado = document.getElementById('dia-fechado-' + d.chave).checked;
    dados[d.chave + '_Fechado'] = fechado ? 'true' : 'false';
    dados[d.chave + '_Abertura'] = document.getElementById('dia-abertura-' + d.chave).value || '09:00';
    dados[d.chave + '_Fechamento'] = document.getElementById('dia-fechamento-' + d.chave).value || '19:00';
    dados[d.chave + '_Intervalo'] = document.getElementById('dia-intervalo-' + d.chave).value || '30';
  });
  
  if (!dados.NomeBarbearia) {
    exibirToast('O nome da barbearia é obrigatório.', 'erro');
    return;
  }
  
  mostrarLoadingGlobalAdmin();
  try {
    const resultado = await salvarConfiguracoes(dados);
    ocultarLoadingGlobalAdmin();
    
    if (!resultado.sucesso) {
      exibirToast(resultado.mensagem || 'Erro ao salvar configurações.', 'erro');
      return;
    }
    
    exibirToast(resultado.mensagem, 'sucesso');
  } catch (erro) {
    ocultarLoadingGlobalAdmin();
    exibirToast('Erro: ' + erro.message, 'erro');
  }
}
