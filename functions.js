import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from './firebase-config.js';

export async function getConfiguracoes() {
  const docSnap = await getDoc(doc(db, "configuracoes", "global"));
  return docSnap.exists() ? docSnap.data() : {};
}

export async function salvarConfiguracoes(novaConfig) {
  try {
    await setDoc(doc(db, "configuracoes", "global"), novaConfig, { merge: true });
    return { sucesso: true, mensagem: 'Configurações atualizadas!' };
  } catch (err) {
    return { sucesso: false, mensagem: err.message };
  }
}

export async function listarServicos(somenteAtivos = true) {
  let q = collection(db, "servicos");
  if (somenteAtivos) q = query(q, where("Ativo", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ ID: d.id, ...d.data() }));
}

export async function salvarServico(servico) {
  try {
    if (servico.ID) {
      await updateDoc(doc(db, "servicos", servico.ID), servico);
      return { sucesso: true, mensagem: "Serviço atualizado!" };
    } else {
      const docRef = doc(collection(db, "servicos"));
      await setDoc(docRef, { ...servico, ID: docRef.id });
      return { sucesso: true, mensagem: "Serviço cadastrado!", id: docRef.id };
    }
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function excluirServico(id) {
  try {
    await deleteDoc(doc(db, "servicos", id));
    return { sucesso: true, mensagem: "Serviço excluído!" };
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function obterHorariosDisponiveis(dataStr, servicoId) {
  try {
    const config = await getConfiguracoes();
    const servicos = await listarServicos(false);
    const servico = servicos.find(s => s.ID === servicoId);
    
    const data = new Date(dataStr + 'T12:00:00');
    const dias = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
    const diaSemana = dias[data.getDay()];
    
    if (config[diaSemana + '_Fechado'] === 'true') return { sucesso: true, horarios: [] };
    
    const abertura = config[diaSemana + '_Abertura'] || '09:00';
    const fechamento = config[diaSemana + '_Fechamento'] || '19:00';
    const duracao = servico ? parseInt(servico.TempoAtendimento) : 30;
    
    let horarios = gerarSlotsHorario(abertura, fechamento, duracao);
    
    const q = query(collection(db, "agendamentos"), where("Data", "==", dataStr), where("Status", "in", ["Agendado", "Confirmado", "Concluído"]));
    const snapshot = await getDocs(q);
    const ocupados = snapshot.docs.map(d => d.data().Horario);
    
    return { sucesso: true, horarios: horarios.filter(h => !ocupados.includes(h)) };
  } catch (err) { return { sucesso: false, mensagem: err.message, horarios: [] }; }
}

function gerarSlotsHorario(abertura, fechamento, duracao) {
  const [hA, mA] = abertura.split(':').map(Number);
  const [hF, mF] = fechamento.split(':').map(Number);
  let atual = new Date(2000, 0, 1, hA, mA);
  const fim = new Date(2000, 0, 1, hF, mF);
  const slots = [];
  while (atual.getTime() + duracao * 60000 <= fim.getTime()) {
    slots.push(atual.getHours().toString().padStart(2, '0') + ':' + atual.getMinutes().toString().padStart(2, '0'));
    atual.setMinutes(atual.getMinutes() + duracao);
  }
  return slots;
}

export async function criarAgendamento(dados) {
  try {
    const docRef = doc(collection(db, "agendamentos"));
    await setDoc(docRef, { ...dados, ID: docRef.id, DataCadastro: new Date().toISOString(), Status: "Agendado" });
    return { sucesso: true, mensagem: "Agendamento realizado!", id: docRef.id, resumo: dados };
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function listarAgendamentos(filtros = {}) {
  let q = query(collection(db, "agendamentos"));
  const snapshot = await getDocs(q);
  let dados = snapshot.docs.map(d => ({ ID: d.id, ...d.data() }));
  
  if (filtros.dataInicio) dados = dados.filter(a => a.Data >= filtros.dataInicio);
  if (filtros.dataFim) dados = dados.filter(a => a.Data <= filtros.dataFim);
  if (filtros.status) dados = dados.filter(a => a.Status === filtros.status);
  if (filtros.busca) {
    const termo = filtros.busca.toLowerCase();
    dados = dados.filter(a => String(a.Cliente).toLowerCase().includes(termo) || String(a.Servico).toLowerCase().includes(termo));
  }
  
  return dados.sort((a, b) => (a.Data + a.Horario).localeCompare(b.Data + b.Horario));
}

export async function atualizarStatusAgendamento(id, novoStatus, formaPagamento = null) {
  try {
    await updateDoc(doc(db, "agendamentos", id), { Status: novoStatus, FormaPagamento: formaPagamento });
    if (novoStatus === 'Concluído') {
      const agendDoc = await getDoc(doc(db, "agendamentos", id));
      const agend = agendDoc.data();
      await setDoc(doc(collection(db, "financeiro")), {
        Data: agend.Data, Cliente: agend.Cliente, Servico: agend.Servico,
        Valor: agend.Valor, FormaPagamento: formaPagamento || 'Dinheiro', StatusPagamento: 'Pago'
      });
    }
    return { sucesso: true, mensagem: "Status atualizado!" };
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function excluirAgendamento(id) {
  try { await deleteDoc(doc(db, "agendamentos", id)); return { sucesso: true, mensagem: "Excluído!" }; } 
  catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function reagendarAgendamentoCliente(id, novaData, novoHorario) {
  try {
    await updateDoc(doc(db, "agendamentos", id), { Data: novaData, Horario: novoHorario });
    return { sucesso: true, mensagem: "Agendamento atualizado!" };
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function consultarAgendamentosCliente(telefone) {
  try {
    const telLimpo = String(telefone).replace(/\D/g, '');
    const snapshot = await getDocs(query(collection(db, "agendamentos"), where("TelefoneLimpo", "==", telLimpo)));
    let agendamentos = snapshot.docs.map(d => ({ ID: d.id, ...d.data() }));
    if (agendamentos.length === 0) {
      const todos = await listarAgendamentos();
      agendamentos = todos.filter(a => String(a.Telefone).replace(/\D/g, '') === telLimpo);
    }
    return { sucesso: true, agendamentos: agendamentos.sort((a,b) => b.Data.localeCompare(a.Data)) };
  } catch (err) { return { sucesso: false, mensagem: err.message, agendamentos: [] }; }
}

export async function listarClientes() {
  const snapshot = await getDocs(collection(db, "clientes"));
  return snapshot.docs.map(d => ({ ID: d.id, ...d.data() }));
}

export async function salvarCliente(cliente) {
  try {
    if (cliente.ID) {
      await updateDoc(doc(db, "clientes", cliente.ID), cliente);
      return { sucesso: true, mensagem: "Cliente atualizado!" };
    } else {
      const docRef = doc(collection(db, "clientes"));
      await setDoc(docRef, { ...cliente, ID: docRef.id, DataCadastro: new Date().toISOString() });
      return { sucesso: true, mensagem: "Cliente cadastrado!", id: docRef.id };
    }
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function listarFinanceiro(filtros = {}) {
  const snapshot = await getDocs(collection(db, "financeiro"));
  let dados = snapshot.docs.map(d => ({ ID: d.id, ...d.data() }));
  if (filtros.dataInicio) dados = dados.filter(f => f.Data >= filtros.dataInicio);
  if (filtros.dataFim) dados = dados.filter(f => f.Data <= filtros.dataFim);
  return dados.sort((a, b) => b.Data.localeCompare(a.Data));
}

export async function registrarLancamentoManual(lancamento) {
  try {
    if (lancamento.ID) {
      await updateDoc(doc(db, "financeiro", lancamento.ID), lancamento);
      return { sucesso: true, mensagem: "Lançamento atualizado!" };
    } else {
      const docRef = doc(collection(db, "financeiro"));
      await setDoc(docRef, { ...lancamento, ID: docRef.id });
      return { sucesso: true, mensagem: "Lançamento registrado!" };
    }
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function excluirLancamento(id) {
  try { await deleteDoc(doc(db, "financeiro", id)); return { sucesso: true, mensagem: "Excluído!" }; } 
  catch (err) { return { sucesso: false, mensagem: err.message }; }
}

export async function obterDashboard() {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const inicioMes = hoje.substring(0, 7) + '-01';
    
    const agendamentos = await listarAgendamentos();
    const financeiro = await listarFinanceiro();
    const clientes = await listarClientes();
    
    const agendamentosHoje = agendamentos.filter(a => a.Data === hoje).length;
    const receitaMensal = financeiro.filter(f => f.Data >= inicioMes).reduce((soma, f) => soma + (parseFloat(f.Valor) || 0), 0);
    
    const serieDias = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dataStr = d.toISOString().split('T')[0];
      serieDias.push({ data: dataStr, total: agendamentos.filter(a => a.Data === dataStr).length });
    }

    return {
      sucesso: true,
      contadores: {
        agendamentosHoje, agendamentosSemana: 0, agendamentosMes: agendamentos.filter(a => a.Data >= inicioMes).length,
        totalClientes: clientes.length, receitaDiaria: financeiro.filter(f => f.Data === hoje).reduce((s, f) => s + (parseFloat(f.Valor)||0), 0),
        receitaMensal, walkInsHoje: 0, walkInsMes: 0
      },
      rankingServicos: [], rankingClientes: [], proximosAtendimentos: agendamentos.filter(a => a.Data === hoje && (a.Status === 'Agendado' || a.Status === 'Confirmado')).slice(0, 5),
      serieDias, serieMeses: []
    };
  } catch (err) { return { sucesso: false, mensagem: err.message }; }
}
