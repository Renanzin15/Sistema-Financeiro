const API = "";
let CAIXINHAS = [];
let TODAS_CAIXINHAS = [];
let CONTAS = [];
let RECORRENTES = [];      // assinaturas carregadas (pra oferecer vincular à fatura)
let BANCOS = [];
let bancoSelecionado = null;
let graficoPizza = null;
let TOKEN = null;
// Supabase Auth — chaves PÚBLICAS (podem ficar no front-end)
const SUPABASE_URL = "https://jrchngwumnyqohrtrzrr.supabase.co";
const SUPABASE_KEY = "sb_publishable_wj2N907DWBA6mg4xylkehw_UiOXSaY6";
let HIST = [];              // F3: lançamentos carregados do histórico
let filtroHist = "tudo";   // F3: filtro ativo (tudo/entradas/saidas/caixinhas)
let buscaHist = "";        // F3: termo de busca por descrição

// E: ícones SVG embutidos (sem depender de internet). stroke=currentColor herda a cor do contexto.
const ICONES = {
  saldo: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  alerta: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  apagar: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  entrada: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  saida: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  transferencia: '<polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 21 3 17 7 13"/><line x1="3" y1="17" x2="15" y2="17"/>',
  caixinha: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  dividas: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  historico: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  analise: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  meta: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  menos: '<line x1="5" y1="12" x2="19" y2="12"/>',
  categoria: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  gatilho: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  importar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  licenca: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  previsao: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'
};
function ico(nome, size) {
  size = size || 16;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] || ""}</svg>`;
}

function reais(n) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function paraCentavos(valor) { return Math.round(parseFloat(valor) * 100); }
function aviso(texto, tipo) {
  const el = document.getElementById("aviso");
  el.textContent = texto;
  el.className = "aviso " + tipo;
  setTimeout(() => { el.className = "aviso"; }, 3000);
}

// modal de confirmação — substitui o confirm() nativo. Devolve uma Promise<boolean>.
function confirmar(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const fundo = document.getElementById("modal-confirmar");
    document.getElementById("mc-titulo").textContent = opts.titulo || "Confirmar";
    document.getElementById("mc-texto").textContent = opts.texto || "";
    document.getElementById("mc-ico").innerHTML = ico(opts.icone || "alerta", 22);
    const btnOk = document.getElementById("mc-ok");
    const btnCancel = document.getElementById("mc-cancelar");
    btnOk.textContent = opts.rotulo || "Confirmar";
    fundo.classList.add("aberto");
    btnOk.focus();
    const fechar = (valor) => {
      fundo.classList.remove("aberto");
      btnOk.onclick = btnCancel.onclick = fundo.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(valor);
    };
    const onKey = (e) => { if (e.key === "Escape") fechar(false); else if (e.key === "Enter") fechar(true); };
    btnOk.onclick = () => fechar(true);
    btnCancel.onclick = () => fechar(false);
    fundo.onclick = (e) => { if (e.target === fundo) fechar(false); };  // clicar fora cancela
    document.addEventListener("keydown", onKey);
  });
}

// modal de formulário — substitui os prompt() nativos. Recebe {titulo, campos:[{id,label,valor,tipo,placeholder}], rotulo}
// e devolve uma Promise: um objeto {id: valor} no Salvar, ou null no Cancelar.
function abrirFormModal(opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const fundo = document.getElementById("modal-form");
    document.getElementById("mf-titulo").textContent = opts.titulo || "Editar";
    const corpo = document.getElementById("mf-corpo");
    corpo.innerHTML = (opts.campos || []).map(c => {
      const campo = c.tipo === "select"
        ? `<select id="mf-campo-${c.id}">${(c.opcoes || []).map(o => `<option value="${o.valor}" ${String(o.valor) === String(c.valor) ? "selected" : ""}>${o.texto}</option>`).join("")}</select>`
        : `<input id="mf-campo-${c.id}" type="${c.tipo || "text"}" ${c.tipo === "number" ? 'step="0.01"' : ""}
               value="${(c.valor ?? "").toString().replace(/"/g, "&quot;")}" placeholder="${c.placeholder || ""}">`;
      return `<div class="campo"><label>${c.label || ""}</label>${campo}</div>`;
    }).join("");
    const btnOk = document.getElementById("mf-ok");
    const btnCancel = document.getElementById("mf-cancelar");
    btnOk.textContent = opts.rotulo || "Salvar";
    fundo.classList.add("aberto");
    const primeiro = corpo.querySelector("input"); if (primeiro) { primeiro.focus(); primeiro.select && primeiro.select(); }
    const coletar = () => {
      const r = {};
      (opts.campos || []).forEach(c => { r[c.id] = document.getElementById("mf-campo-" + c.id).value; });
      return r;
    };
    const fechar = (valor) => {
      fundo.classList.remove("aberto");
      btnOk.onclick = btnCancel.onclick = fundo.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(valor);
    };
    const onKey = (e) => {
      if (e.key === "Escape") fechar(null);
      else if (e.key === "Enter" && (e.target.tagName || "") === "INPUT") fechar(coletar());
    };
    btnOk.onclick = () => fechar(coletar());
    btnCancel.onclick = () => fechar(null);
    fundo.onclick = (e) => { if (e.target === fundo) fechar(null); };
    document.addEventListener("keydown", onKey);
  });
}
async function pedir(rota, opcoes) {
  opcoes = opcoes || {};
  opcoes.headers = opcoes.headers || {};
  if (TOKEN) opcoes.headers["Authorization"] = "Bearer " + TOKEN;
  const resp = await fetch(API + rota, opcoes);
  if (resp.status === 401) {
    // token inválido/expirado -> volta pro login
    if (typeof sair === "function") sair();
    throw new Error("Sessão expirada. Entre de novo.");
  }
  const dado = await resp.json();
  if (!resp.ok) throw new Error(dado.detail || "Algo deu errado");
  return dado;
}

// ---- login (Supabase Auth) ----
async function iniciar() {
  // reaproveita um token salvo (sessão anterior); se ainda for válido, entra direto
  const salvo = localStorage.getItem("sb_token");
  if (salvo) {
    TOKEN = salvo;
    try {
      await pedir("/saldo-livre");   // valida o token com o back
      document.getElementById("tela-login").style.display = "none";
      carregarTudo();
      return;
    } catch (e) { TOKEN = null; localStorage.removeItem("sb_token"); }
  }
  document.getElementById("tela-login").style.display = "flex";
  const el = document.getElementById("login-email"); if (el) el.focus();
}

async function enviarLogin() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  const erro = document.getElementById("login-erro");
  const botao = document.getElementById("login-botao");
  erro.textContent = "";
  if (!email || !senha) { erro.textContent = "Preencha e-mail e senha."; return; }
  botao.textContent = "Entrando..."; botao.disabled = true;
  try {
    // login direto no Supabase Auth (GoTrue). Devolve o access_token (JWT).
    const resp = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email, password: senha })
    });
    const dado = await resp.json();
    if (!resp.ok || !dado.access_token) {
      erro.textContent = "E-mail ou senha incorretos.";
      return;
    }
    TOKEN = dado.access_token;
    localStorage.setItem("sb_token", TOKEN);
    document.getElementById("tela-login").style.display = "none";
    document.getElementById("login-senha").value = "";
    carregarTudo();
  } catch (e) {
    erro.textContent = "Erro ao conectar. Tente de novo.";
  } finally {
    botao.textContent = "Entrar"; botao.disabled = false;
  }
}

function sair() {
  TOKEN = null;
  localStorage.removeItem("sb_token");
  document.getElementById("tela-login").style.display = "flex";
  document.getElementById("login-senha").value = "";
  const el = document.getElementById("login-email"); if (el) el.focus();
}

async function carregarTudo() {
  await carregarBancos();
  // lança as entradas recorrentes cujo dia já chegou ANTES de calcular saldos/histórico
  try { await pedir("/entradas-recorrentes/gerar", { method: "POST" }); } catch (e) {}
  // carregarRecorrentes roda dentro de carregarContas (precisa de CONTAS já carregado p/ o vínculo de fatura)
  await Promise.all([carregarSaldoLivre(), carregarCaixinhas(), carregarContas(), carregarHistorico(), carregarAnalise(), carregarCategorias(), carregarStreak(), carregarRegras(), carregarEntradasRecorrentes()]);
  atualizarPainelBancos();
  verificarWrapped();   // E6: mostra a retrospectiva do mês passado (1x por sessão)
  // esconde o leitor de conta por foto se o servidor não tiver OCR (ex.: Render sem Tesseract)
  fetch("/ocr-status").then(r => r.json()).then(s => {
    const p = document.getElementById("painel-ocr");
    if (p) p.style.display = s.disponivel ? "" : "none";
    // mesmo tratamento pro anexo dentro do formulário de cadastrar conta
    const cb = document.getElementById("ct-ocr-bloco");
    if (cb) cb.style.display = s.disponivel ? "" : "none";
  }).catch(() => {});
}

async function carregarBancos() {
  BANCOS = await pedir("/bancos");
  // se nenhum banco selecionado ainda, começa em "todos"
  if (bancoSelecionado === null && BANCOS.length > 0) {
    bancoSelecionado = "todos";
  }
  // seletor do topo
  const sel = document.getElementById("seletor-banco");
  if (BANCOS.length === 0) {
    sel.innerHTML = '<option value="">Nenhum banco</option>';
  } else {
    const optTodos = `<option value="todos" ${bancoSelecionado === "todos" ? "selected" : ""}>Todos</option>`;
    sel.innerHTML = optTodos + BANCOS.map(b => `<option value="${b.id}" ${b.id === bancoSelecionado ? "selected" : ""}>${b.nome}</option>`).join("");
  }
  // menu do criar caixinha
  const cBanco = document.getElementById("c-banco");
  cBanco.innerHTML = BANCOS.map(b => `<option value="${b.id}">${b.nome}</option>`).join("");
  // lista de bancos (gerenciar)
  const lista = document.getElementById("lista-bancos");
  if (BANCOS.length === 0) {
    lista.innerHTML = '<div class="vazio" style="padding:8px 0">Nenhum banco. Crie o primeiro acima.</div>';
  } else {
    lista.innerHTML = BANCOS.map(b => `
      <div class="item"><div class="nome">${b.nome}</div>
      <button class="perigo ib" title="Apagar" onclick="apagarBanco(${b.id})">${ico('apagar')}</button></div>`).join("");
  }
}

function trocarBanco() {
  const v = document.getElementById("seletor-banco").value;
  bancoSelecionado = (v === "todos") ? "todos" : parseInt(v);
  carregarCaixinhas();
  atualizarPainelBancos();
}

async function criarBanco() {
  const nome = document.getElementById("b-nome").value;
  if (!nome) return aviso("Dê um nome ao banco.", "erro");
  try {
    await pedir("/bancos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome }) });
    document.getElementById("b-nome").value = "";
    aviso("Banco adicionado.", "ok");
    carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarBanco(id) {
  try {
    await pedir("/bancos/" + id, { method: "DELETE" });
    if (bancoSelecionado === id) bancoSelecionado = null;
    aviso("Banco apagado.", "ok");
    carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function carregarSaldoLivre() {
  const s = await pedir("/saldo-livre");
  document.getElementById("ct-saldo-livre").textContent = reais(s.saldo_livre_reais);
  // "Guardado em caixinhas" (ct-alocado) é preenchido por carregarCaixinhas (soma dos saldos ATUAIS)
  // "Entradas do mês" (ct-entradas) é preenchido por carregarAnalise (só o mês atual, não o total)
  document.getElementById("ct-estado-livre").textContent =
    s.tudo_distribuido ? "Tudo distribuído ✓" : "Ainda há dinheiro sem destino";
}

async function carregarCaixinhas() {
  const todas = await pedir("/caixinhas");
  TODAS_CAIXINHAS = todas;
  // "Guardado em caixinhas" = soma dos saldos ATUAIS (cai quando você gasta de uma caixinha)
  const guardado = todas.reduce((acc, c) => acc + (c.saldo_reais || 0), 0);
  document.getElementById("ct-alocado").textContent = reais(guardado);
  const modoTodos = (bancoSelecionado === "todos");
  CAIXINHAS = modoTodos ? todas : todas.filter(c => c.banco_id === bancoSelecionado);
  // mapa de id do banco -> nome, pra etiqueta
  const nomeBanco = {};
  BANCOS.forEach(b => { nomeBanco[b.id] = b.nome; });
  const lista = document.getElementById("lista-caixinhas");
  const noDash = document.getElementById("d-caixinhas");
  if (CAIXINHAS.length === 0) {
    const msg = modoTodos ? "Nenhuma caixinha ainda." : "Nenhuma caixinha neste banco.";
    lista.innerHTML = `<div class="vazio">${msg}</div>`;
    noDash.innerHTML = `<div class="vazio">${msg}</div>`;
  } else {
    const etiqueta = c => modoTodos ? ` <span style="font-size:11px;color:var(--texto2)">· ${nomeBanco[c.banco_id] || "?"}</span>` : "";
    lista.innerHTML = CAIXINHAS.map(c => {
      let metaHtml = "";
      if (c.meta_reais && c.meta_reais > 0) {
        const pct = Math.min(Math.round(c.saldo_reais / c.meta_reais * 100), 100);
        const cheia = c.saldo_reais >= c.meta_reais;
        // E8: com data-limite, calcula quanto guardar por mês para atingir a tempo
        let prazoHtml = "";
        if (c.meta_prazo && !cheia) {
          const falta = c.meta_reais - c.saldo_reais;
          const agora = new Date();
          const [py, pm] = c.meta_prazo.split("-").map(Number);
          const meses = (py - agora.getFullYear()) * 12 + (pm - (agora.getMonth() + 1));
          const nomeMes = new Date(py, pm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
          if (meses < 0) {
            prazoHtml = `<div class="sub" style="color:var(--vermelho);margin-top:4px">⏰ Prazo (${nomeMes}) já passou — ainda faltam ${reais(falta)}.</div>`;
          } else {
            const mesesRest = Math.max(1, meses);
            const mensal = falta / mesesRest;
            prazoHtml = `<div class="sub" style="color:var(--amarelo);margin-top:4px">⏰ ${mesesRest} ${mesesRest === 1 ? "mês" : "meses"} até ${nomeMes} · guarde <b>${reais(mensal)}/mês</b> pra atingir.</div>`;
          }
        }
        metaHtml = `<div style="margin-top:8px">
          <div class="barra-meta${cheia ? " cheia" : ""}"><div style="width:${pct}%"></div></div>
          <div class="sub" style="margin-top:4px">Meta: ${reais(c.saldo_reais)} de ${reais(c.meta_reais)} — ${pct}%${cheia ? " ✓ atingida!" : ""}</div>
          ${prazoHtml}
        </div>`;
      }
      return `<div class="item" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <div class="nome">${c.nome}${etiqueta(c)}</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="valor roxo">${reais(c.saldo_reais)}</span>
            <button class="perigo ib" title="Guardar dinheiro" style="color:var(--verde)" onclick="guardarNaCaixinha(${c.id})">${ico('mais')}</button>
            <button class="perigo ib" title="Gastar / tirar" style="color:var(--vermelho)" onclick="gastarDaCaixinha(${c.id})">${ico('menos')}</button>
            <button class="perigo ib" title="Definir meta" onclick="definirMeta(${c.id})">${ico('meta')}</button>
            <button class="perigo ib" title="Apagar" onclick="apagarCaixinha(${c.id})">${ico('apagar')}</button>
          </div>
        </div>
        ${metaHtml}
      </div>`;
    }).join("");
    noDash.innerHTML = CAIXINHAS.map(c => `
      <div class="item"><div class="nome">${c.nome}${etiqueta(c)}</div><span class="valor roxo">${reais(c.saldo_reais)}</span></div>`).join("");
  }
  const opcoes = CAIXINHAS.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
  ["a-caixinha", "t-origem", "t-destino", "g-caixinha", "rd-caixinha", "rg-caixinha"].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opcoes; });
  desenharPizza();
  carregarTermometro();
}

// E1: Termômetro/Runway — no ritmo de gasto do mês, quando cada caixinha zera
async function carregarTermometro() {
  const el = document.getElementById("lista-termometro");
  if (!el) return;
  const lanc = await pedir("/lancamentos");
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const diasDecorridos = agora.getDate();  // quantos dias do mês já passaram
  const gastoMes = {};
  lanc.forEach(l => {
    if (!l.data || !l.data.startsWith(mesAtual)) return;
    const transf = (l.descricao || "").startsWith("transferência");
    if (l.tipo === "pagamento" && !transf && l.caixinha_id)
      gastoMes[l.caixinha_id] = (gastoMes[l.caixinha_id] || 0) + l.valor_reais;
  });
  const linhas = CAIXINHAS
    .filter(c => c.saldo_reais > 0 && (gastoMes[c.id] || 0) > 0)
    .map(c => {
      const gasto = gastoMes[c.id];
      const porDia = gasto / diasDecorridos;
      const diasRestantes = Math.floor(c.saldo_reais / porDia);
      return { c, porDia, diasRestantes };
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
  if (linhas.length === 0) {
    el.innerHTML = '<div class="vazio">Registre gastos nas caixinhas este mês para ver a projeção.</div>';
    return;
  }
  el.innerHTML = linhas.map(({ c, porDia, diasRestantes }) => {
    const dataZero = new Date(agora); dataZero.setDate(dataZero.getDate() + diasRestantes);
    const cor = diasRestantes <= 7 ? "var(--vermelho)" : (diasRestantes <= 15 ? "var(--amarelo)" : "var(--verde)");
    const dataStr = dataZero.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
    return `<div class="item" style="flex-direction:column;align-items:stretch;gap:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="nome">${c.nome}</div>
        <span class="valor" style="color:${cor}">~${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}</span>
      </div>
      <div class="sub">Gasta ~${reais(porDia)}/dia · no ritmo atual zera em <b style="color:${cor}">${dataStr}</b></div>
    </div>`;
  }).join("");
}

// E5: Streaks — meses seguidos poupando (entrou mais do que saiu)
async function carregarStreak() {
  const el = document.getElementById("streak-dash");
  if (!el) return;
  const lanc = await pedir("/lancamentos");
  const meses = {};
  lanc.forEach(l => {
    if (!l.data) return;
    const m = l.data.slice(0, 7);
    const transf = (l.descricao || "").startsWith("transferência");
    meses[m] = meses[m] || { entrou: 0, saiu: 0 };
    if (l.tipo === "entrada") meses[m].entrou += l.valor_reais;
    else if (l.tipo === "saida_livre") meses[m].saiu += l.valor_reais;
    else if (l.tipo === "pagamento" && !transf) meses[m].saiu += l.valor_reais;
  });
  const ord = Object.keys(meses).sort().reverse();
  let streak = 0;
  for (const m of ord) {
    if (meses[m].entrou > meses[m].saiu) streak++;
    else break;
  }
  if (streak <= 0) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="painel" style="display:flex;align-items:center;gap:14px;border-left:3px solid var(--verde);margin-bottom:24px">
    <span style="font-size:28px">🔥</span>
    <div><div style="font-weight:600">${streak} ${streak === 1 ? "mês" : "meses"} seguidos poupando</div>
    <div class="sub">Você gastou menos do que ganhou ${streak === 1 ? "neste mês" : "nesses meses"}. Continue assim!</div></div>
  </div>`;
}

function atualizarPainelBancos() {
  const painel = document.getElementById("painel-bancos");
  if (bancoSelecionado !== "todos") { painel.style.display = "none"; return; }
  const somaPorBanco = {};
  let total = 0;
  TODAS_CAIXINHAS.forEach(c => {
    somaPorBanco[c.banco_id] = (somaPorBanco[c.banco_id] || 0) + c.saldo_reais;
    total += c.saldo_reais;
  });
  const cores = ["#8b5cf6","#34d399","#f87171","#fbbf24","#60a5fa","#f472b6","#a78bfa","#2dd4bf"];
  const lista = document.getElementById("lista-por-banco");
  if (BANCOS.length === 0 || total === 0) {
    lista.innerHTML = '<div class="vazio">Guarde dinheiro nas caixinhas para ver a divisão por banco.</div>';
    painel.style.display = "block";
    return;
  }
  lista.innerHTML = BANCOS.map((b, i) => {
    const valor = somaPorBanco[b.id] || 0;
    const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
    const cor = cores[i % cores.length];
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:14px;color:var(--texto)">${b.nome}</span>
        <span style="font-size:14px;font-weight:600;color:${cor}">${reais(valor)}</span>
      </div>
      <div style="height:7px;background:var(--fundo);border-radius:4px"><div style="width:${pct}%;height:100%;background:${cor};border-radius:4px"></div></div>
      <div style="font-size:11px;color:var(--texto2);margin-top:4px">${pct}% do total</div>
    </div>`;
  }).join("");
  painel.style.display = "block";
}

function desenharPizza() {
  const comSaldo = CAIXINHAS.filter(c => c.saldo_reais > 0);
  const canvas = document.getElementById("grafico-pizza");
  const vazio = document.getElementById("pizza-vazio");
  if (comSaldo.length === 0) {
    canvas.style.display = "none"; vazio.style.display = "block";
    if (graficoPizza) { graficoPizza.destroy(); graficoPizza = null; }
    return;
  }
  canvas.style.display = "block"; vazio.style.display = "none";
  const cores = ["#7c5cff","#a78bfa","#3ddc97","#fb7185","#fbbf24","#60a5fa","#f472b6","#2dd4bf"];
  const dados = {
    labels: comSaldo.map(c => c.nome),
    datasets: [{ data: comSaldo.map(c => c.saldo_reais), backgroundColor: cores, borderColor: "#141024", borderWidth: 3, hoverOffset: 6 }]
  };
  if (graficoPizza) {
    graficoPizza.data = dados; graficoPizza.update();
  } else {
    graficoPizza = new Chart(canvas, {
      type: "doughnut", data: dados,
      options: { cutout: "68%", plugins: { legend: { labels: { color: "#a8a2c8", padding: 14, font: { family: "Inter, sans-serif", size: 13 }, usePointStyle: true, pointStyle: "circle" }, position: "bottom" } } }
    });
  }
}

// calcula o status de uma conta a partir da data de vencimento
function statusConta(c) {
  if (c.paga) return { texto: "Pago", cor: "var(--verde)", fundo: "var(--verde-fundo)" };
  if (!c.vencimento) return { texto: "A vencer", cor: "var(--amarelo)", fundo: "rgba(251,191,36,0.14)" };
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(c.vencimento + "T00:00:00");
  const diasMs = venc - hoje;
  const dias = Math.round(diasMs / (1000*60*60*24));
  if (dias < 0) return { texto: "Vencido", cor: "var(--vermelho)", fundo: "var(--vermelho-fundo)" };
  if (dias === 0) return { texto: "Vence hoje", cor: "var(--vermelho)", fundo: "var(--vermelho-fundo)" };
  // M4: contagem regressiva quando falta 7 dias ou menos pro vencimento
  if (dias <= 7) return { texto: `Faltam ${dias} dia${dias>1?"s":""}`, cor: "var(--amarelo)", fundo: "rgba(251,191,36,0.14)" };
  return { texto: "A vencer", cor: "var(--amarelo)", fundo: "rgba(251,191,36,0.14)" };
}

async function carregarContas() {
  const contas = await pedir("/contas");
  CONTAS = contas;
  renderCalendario();   // calendário de vencimentos (Visão geral) usa CONTAS
  const lista = document.getElementById("lista-contas");
  let falta = 0;
  // soma o que ainda FALTA pagar (restante desconta pagamentos parciais já feitos)
  contas.forEach(c => { if (!c.paga) falta += (c.restante_reais != null ? c.restante_reais : c.valor_reais); });
  document.getElementById("ct-contas").textContent = reais(falta);
  if (contas.length === 0) { lista.innerHTML = '<div class="vazio">Nenhuma conta cadastrada.</div>'; await carregarRecorrentes(); await carregarLicencas(); return; }

  // ordena: não pagas primeiro, e dentro delas as que vencem antes
  contas.sort((a, b) => {
    if (a.paga !== b.paga) return a.paga - b.paga;
    return (a.vencimento || "9999").localeCompare(b.vencimento || "9999");
  });

  // cabeçalho da "tabela"
  let html = `<div class="tabela-cabecalho">
    <span>Descrição</span><span>Vencimento</span><span>Valor</span><span>Status</span><span></span>
  </div>`;

  html += contas.map(c => {
    const st = statusConta(c);
    const tag = `<span class="status-tag" style="color:${st.cor};background:${st.fundo}">${st.texto}</span>`;
    const ehFatura = c.tipo_conta === "fatura";
    // célula do nome: fatura tem seta de expandir + etiqueta e conta de gastos
    const nomeCell = ehFatura
      ? `<div class="nome" style="cursor:pointer" onclick="toggleFatura(${c.id})"><span id="seta-${c.id}">▸</span> ${c.nome} <span class="tag">fatura</span></div><div class="sub">${c.qtd_itens} gasto${c.qtd_itens !== 1 ? "s" : ""}</div>`
      : `<div class="nome">${c.nome}</div><div class="sub">${c.tipo}</div>`;
    const painelFatura = ehFatura ? `<div class="fatura-painel" id="fatura-${c.id}" style="display:none"></div>` : "";

    if (c.paga) {
      return `<div class="linha-conta paga">
        <div>${nomeCell}</div>
        <div class="col-venc">${c.vencimento || "—"}</div>
        <div class="valor">${reais(c.valor_reais)}</div>
        <div>${tag}</div>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="perigo" title="Some da tela, fica no histórico" onclick="arquivarConta(${c.id})">Arquivar</button>
          <button class="perigo" onclick="desfazerPagamento(${c.id})">Desfazer</button>
        </div>
      </div>${painelFatura}`;
    }
    const menu = CAIXINHAS.map(cx => `<option value="${cx.id}">${cx.nome}</option>`).join("");
    // botão "atrelar à fatura": só para contas avulsas (não-fatura) e se houver alguma fatura não paga
    const temFaturaDisp = contas.some(x => x.tipo_conta === "fatura" && !x.paga);
    const btnAtrelar = (!ehFatura && temFaturaDisp)
      ? `<button class="perigo ib" title="Atrelar à fatura" onclick="atrelarFatura(${c.id})">${ico('dividas')}</button>`
      : "";
    // pagamento parcial: se já pagou parte, mostra "pago X · faltam Y" embaixo do valor
    const parcial = (c.pago_reais > 0)
      ? `<div class="sub" style="color:var(--amarelo)">pago ${reais(c.pago_reais)} · faltam ${reais(c.restante_reais)}</div>`
      : "";
    // desfazer aparece quando há algum pagamento parcial a reverter
    const btnDesfazerParcial = (c.pago_reais > 0)
      ? `<button class="perigo" title="Desfazer os pagamentos já feitos nesta conta" onclick="desfazerPagamento(${c.id})">Desfazer</button>`
      : "";
    return `<div class="linha-conta">
      <div>${nomeCell}</div>
      <div class="col-venc">${c.vencimento || "—"}</div>
      <div class="valor menos">${reais(c.valor_reais)}${parcial}</div>
      <div>${tag}</div>
      <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">
        <input type="number" step="0.01" min="0" placeholder="tudo" title="Deixe vazio p/ pagar tudo, ou digite um valor p/ pagar parte" id="pagar-valor-${c.id}" style="font-family:inherit;font-size:12px;padding:6px;border:1px solid var(--borda);border-radius:8px;background:var(--fundo);color:var(--texto);width:74px">
        <select style="font-family:inherit;font-size:12px;padding:6px;border:1px solid var(--borda);border-radius:8px;background:var(--fundo);color:var(--texto);max-width:110px" id="pagar-${c.id}">${menu}</select>
        <button class="acao pequeno" onclick="pagarConta(${c.id})">Pagar</button>
        ${btnAtrelar}
        ${btnDesfazerParcial}
        <button class="perigo ib" title="Editar" onclick="editarConta(${c.id})">${ico('editar')}</button>
        <button class="perigo ib" title="Apagar" onclick="apagarConta(${c.id})">${ico('apagar')}</button>
      </div>
    </div>${painelFatura}`;
  }).join("");
  lista.innerHTML = html;
  // E2: as assinaturas dependem de CONTAS (faturas) já estar carregado
  await carregarRecorrentes();
  await carregarLicencas();   // licenças também usam as faturas de CONTAS
}

// ---- mini-calendário de vencimentos (Visão geral) ----
// Widget só de front: desenha o mês, marca cada dia que tem conta vencendo com um
// pontinho (cor = status mais urgente) e, ao clicar num dia, lista as contas com opção
// de pagar ali mesmo (reaproveita POST /contas/{id}/pagar). Nenhuma rota nova.
let calRef = null;       // Date apontando pro 1º dia do mês exibido
let calDiaSel = null;    // dia selecionado (AAAA-MM-DD) ou null

// cor do pontinho do dia = status mais urgente entre as contas do dia
// (dá prioridade às não pagas; se todas pagas, mostra a cor de "Pago").
function corDoDia(lista) {
  const naoPagas = lista.filter(c => !c.paga);
  const base = naoPagas.length ? naoPagas : lista;
  let melhor = null, peso = -1;
  base.forEach(c => {
    const t = statusConta(c).texto;
    const p = t.startsWith("Vencido") ? 4 : t.startsWith("Vence hoje") ? 3
            : t.startsWith("Faltam") ? 2 : t === "Pago" ? 0 : 1;
    if (p > peso) { peso = p; melhor = statusConta(c); }
  });
  return melhor ? melhor.cor : "var(--texto2)";
}

// ---- popover de hover do calendário (bonito, no lugar do title nativo) ----
let calTip = null;
function calTipEl() {
  if (!calTip) { calTip = document.createElement("div"); calTip.className = "cal-tip"; document.body.appendChild(calTip); }
  return calTip;
}
function calTipMostrar(cell) {
  const ds = cell.dataset.dia;
  const lista = CONTAS.filter(c => c.vencimento === ds);
  if (!lista.length) return;
  const el = calTipEl();
  const dataFmt = new Date(ds + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  el.innerHTML = `<div class="tt-dia">${dataFmt}</div>` + lista.map(c => {
    const st = statusConta(c);
    return `<div class="tt-row">
      <span class="tt-dot" style="background:${st.cor}"></span>
      <div class="tt-mid"><div class="tt-nm">${c.nome}</div><div class="tt-st" style="color:${st.cor}">${st.texto}</div></div>
      <div class="tt-val">${reais(c.valor_reais)}</div>
    </div>`;
  }).join("");
  // posiciona acima do dia (centralizado); se não couber em cima, vai pra baixo
  el.classList.add("on");
  const r = cell.getBoundingClientRect();
  const tw = el.offsetWidth, th = el.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = r.top - th - 10;
  el.classList.toggle("abaixo", top < 8);
  if (top < 8) top = r.bottom + 10;
  el.style.left = left + "px";
  el.style.top = top + "px";
}
function calTipEsconder() { if (calTip) calTip.classList.remove("on"); }

function renderCalendario() {
  const wrap = document.getElementById("cal-widget");
  if (!wrap) return;
  if (!calRef) calRef = new Date();
  const ano = calRef.getFullYear(), mes = calRef.getMonth();   // mes: 0-11
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const offset = new Date(ano, mes, 1).getDay();               // 0=Dom ... 6=Sáb
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const mesStr = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const nomeMesRaw = calRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const nomeMes = nomeMesRaw.charAt(0).toUpperCase() + nomeMesRaw.slice(1);  // "Agosto de 2026" (só a 1ª maiúscula)

  // agrupa as contas do mês exibido por dia de vencimento
  const porDia = {};
  CONTAS.forEach(c => {
    if (c.vencimento && c.vencimento.slice(0, 7) === mesStr) {
      (porDia[c.vencimento] = porDia[c.vencimento] || []).push(c);
    }
  });

  const cabs = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  let html = `<div class="cal-topo">
    <button class="cal-nav" onclick="calMudarMes(-1)" title="Mês anterior">‹</button>
    <span class="cal-mes">${nomeMes}</span>
    <button class="cal-nav" onclick="calMudarMes(1)" title="Próximo mês">›</button>
  </div><div class="cal-grade">`;
  html += cabs.map(d => `<div class="cal-cab">${d}</div>`).join("");
  for (let i = 0; i < offset; i++) html += `<div class="cal-dia vazia"></div>`;
  for (let d = 1; d <= diasNoMes; d++) {
    const ds = `${mesStr}-${String(d).padStart(2, "0")}`;
    const lista = porDia[ds] || [];
    const ehHoje = (ano === hoje.getFullYear() && mes === hoje.getMonth() && d === hoje.getDate());
    const cls = ["cal-dia"];
    if (ehHoje) cls.push("hoje");
    if (lista.length) cls.push("tem");
    if (calDiaSel === ds) cls.push("sel");
    let ponto = "", diaAttr = "", onclick = "";
    if (lista.length) {
      ponto = `<span class="cal-ponto" style="background:${corDoDia(lista)}"></span>`;
      diaAttr = ` data-dia="${ds}"`;   // usado pelo popover de hover (calTip)
      onclick = ` onclick="calAbrirDia('${ds}')"`;
    }
    html += `<div class="${cls.join(" ")}"${onclick}${diaAttr}>${d}${ponto}</div>`;
  }
  html += `</div><div id="cal-detalhe"></div>`;
  wrap.innerHTML = html;
  // popover estilizado ao passar o mouse num dia com conta (substitui o title nativo)
  wrap.querySelectorAll(".cal-dia.tem").forEach(cell => {
    cell.addEventListener("mouseenter", () => calTipMostrar(cell));
    cell.addEventListener("mouseleave", calTipEsconder);
  });
  renderCalDetalhe();
}

function calMudarMes(delta) {
  if (!calRef) calRef = new Date();
  calRef = new Date(calRef.getFullYear(), calRef.getMonth() + delta, 1);
  calDiaSel = null;
  renderCalendario();
}

// clicar num dia abre/fecha o detalhe daquele dia
function calAbrirDia(ds) {
  calDiaSel = (calDiaSel === ds) ? null : ds;
  renderCalendario();
}

// lista as contas do dia selecionado, com opção de pagar direto
function renderCalDetalhe() {
  const el = document.getElementById("cal-detalhe");
  if (!el) return;
  if (!calDiaSel) { el.innerHTML = ""; return; }
  const lista = CONTAS.filter(c => c.vencimento === calDiaSel);
  const dataFmt = new Date(calDiaSel + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  if (!lista.length) {
    el.innerHTML = `<div class="cal-detalhe"><div class="vazio">Nada vence em ${dataFmt}.</div></div>`;
    return;
  }
  const menu = CAIXINHAS.map(cx => `<option value="${cx.id}">${cx.nome}</option>`).join("");
  let html = `<div class="cal-detalhe"><div class="grupo-dia" style="margin-top:0">${dataFmt}</div>`;
  html += lista.map(c => {
    const st = statusConta(c);
    const tag = `<span class="status-tag" style="color:${st.cor};background:${st.fundo}">${st.texto}</span>`;
    const info = `<div><div class="nome">${c.nome}</div><div class="sub">${reais(c.valor_reais)}${c.tipo_conta === "fatura" ? " · fatura" : ""}</div></div>`;
    if (c.paga) {
      return `<div class="cal-item">${info}<div style="display:flex;align-items:center;gap:8px">${tag}</div></div>`;
    }
    const acao = CAIXINHAS.length
      ? `<select id="cal-pagar-${c.id}" style="font-family:inherit;font-size:12px;padding:6px;border:1px solid var(--borda);border-radius:8px;background:var(--fundo);color:var(--texto);max-width:120px">${menu}</select>
         <button class="acao pequeno" onclick="pagarContaCal(${c.id})">Pagar</button>`
      : `<span class="sub">Crie uma caixinha para pagar</span>`;
    return `<div class="cal-item">${info}<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${tag}${acao}</div></div>`;
  }).join("");
  html += `</div>`;
  el.innerHTML = html;
}

// paga a conta a partir do calendário (mesmo endpoint da tela de Dívidas)
async function pagarContaCal(id) {
  const sel = document.getElementById("cal-pagar-" + id);
  if (!sel || !sel.value) return aviso("Crie uma caixinha para pagar.", "erro");
  try {
    await pedir(`/contas/${id}/pagar`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caixinha_id: parseInt(sel.value) }) });
    aviso("Conta paga.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// D: mostra/esconde o painel de itens de uma fatura
async function toggleFatura(id) {
  const painel = document.getElementById("fatura-" + id);
  const seta = document.getElementById("seta-" + id);
  if (!painel) return;
  if (painel.style.display === "none") {
    await renderFaturaPainel(id);
    painel.style.display = "block";
    if (seta) seta.textContent = "▾";
  } else {
    painel.style.display = "none";
    if (seta) seta.textContent = "▸";
  }
}

// D: desenha os itens da fatura + total + (se não paga) formulário de novo gasto
async function renderFaturaPainel(id) {
  const painel = document.getElementById("fatura-" + id);
  if (!painel) return;
  const conta = CONTAS.find(c => c.id === id);
  const itens = await pedir(`/contas/${id}/itens`);
  let html = "";
  if (itens.length === 0) {
    html += '<div class="sub" style="padding:6px 0">Nenhum gasto lançado nesta fatura ainda.</div>';
  } else {
    html += itens.map(it => `
      <div class="item" style="padding:8px 0">
        <div><div class="nome" style="font-size:13px">${it.descricao}</div><div class="sub">${it.data || "sem data"}</div></div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="valor menos" style="font-size:14px">${reais(it.valor_reais)}</span>
          ${conta && !conta.paga ? `<button class="perigo ib" title="Apagar" onclick="apagarItemFatura(${id}, ${it.id})">${ico('apagar')}</button>` : ""}
        </div>
      </div>`).join("");
  }
  html += `<div style="display:flex;justify-content:space-between;padding:10px 0 4px;border-top:1px solid var(--borda);margin-top:6px;font-weight:600">
    <span>Total da fatura</span><span class="valor menos">${reais(conta ? conta.valor_reais : 0)}</span></div>`;
  if (conta && !conta.paga) {
    html += `<div class="campo-duplo" style="margin-top:12px">
      <div class="campo"><label>Novo gasto</label><input id="fit-desc-${id}" placeholder="Ex.: Mercado"></div>
      <div class="campo"><label>Valor (R$)</label><input id="fit-valor-${id}" type="number" step="0.01" placeholder="80,00"></div>
    </div>
    <button class="acao pequeno" onclick="adicionarItemFatura(${id})">Adicionar gasto</button>`;
  }
  painel.innerHTML = html;
}

// D: recarrega tudo mas mantém a fatura 'id' aberta e atualizada
async function recarregarMantendoFatura(id) {
  await carregarTudo();
  const painel = document.getElementById("fatura-" + id);
  if (painel) {
    await renderFaturaPainel(id);
    painel.style.display = "block";
    const seta = document.getElementById("seta-" + id);
    if (seta) seta.textContent = "▾";
  }
}

async function adicionarItemFatura(id) {
  const desc = document.getElementById("fit-desc-" + id).value || "gasto";
  const valor = document.getElementById("fit-valor-" + id).value;
  if (!valor) return aviso("Informe o valor do gasto.", "erro");
  try {
    await pedir(`/contas/${id}/itens`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: desc, valor_centavos: paraCentavos(valor) }) });
    aviso("Gasto adicionado à fatura.", "ok");
    await recarregarMantendoFatura(id);
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarItemFatura(id, itemId) {
  try {
    await pedir(`/contas/${id}/itens/${itemId}`, { method: "DELETE" });
    aviso("Item removido.", "ok");
    await recarregarMantendoFatura(id);
  } catch (e) { aviso(e.message, "erro"); }
}

// D: mostra/esconde o campo de valor conforme o tipo de conta escolhido no cadastro
function ajustarTipoConta() {
  const tc = document.getElementById("ct-tipoconta").value;
  document.getElementById("campo-valor-conta").style.display = (tc === "fatura") ? "none" : "block";
}

// F2: define ícone, cor e rótulo de cada movimento a partir do tipo
function visualLanc(l) {
  const ehTransf = (l.descricao || "").startsWith("transferência");
  if (ehTransf)
    return { icone: "transferencia", cor: "var(--roxo-claro)", fundo: "var(--roxo-fundo)", classe: "roxo", sinal: "", rot: "Transferência" };
  if (l.tipo === "entrada")
    return { icone: "entrada", cor: "var(--verde)", fundo: "var(--verde-fundo)", classe: "mais", sinal: "+ ", rot: "Entrada" };
  if (l.tipo === "alocacao")
    return { icone: "caixinha", cor: "var(--roxo-claro)", fundo: "var(--roxo-fundo)", classe: "roxo", sinal: "", rot: "Guardado em caixinha" };
  if (l.tipo === "rendimento")
    return { icone: "analise", cor: "var(--verde)", fundo: "var(--verde-fundo)", classe: "mais", sinal: "+ ", rot: "Rendimento (caixinha)" };
  if (l.tipo === "pagamento") {
    const d = l.descricao || "";
    const ehConta = d.startsWith("Pagamento: ") || d === "pagamento de conta";
    const rot = ehConta ? "Pagamento de conta" : "Gasto de caixinha";
    return { icone: "saida", cor: "var(--vermelho)", fundo: "var(--vermelho-fundo)", classe: "menos", sinal: "− ", rot };
  }
  if (l.tipo === "saida_livre")
    return { icone: "saida", cor: "var(--vermelho)", fundo: "var(--vermelho-fundo)", classe: "menos", sinal: "− ", rot: "Saída (dinheiro livre)" };
  return { icone: "caixinha", cor: "var(--texto2)", fundo: "var(--painel2)", classe: "roxo", sinal: "", rot: l.tipo };
}

// F2: transforma a data AAAA-MM-DD no rótulo do grupo ("Hoje", "Ontem" ou a data por extenso)
function rotuloDia(dataStr) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const d = new Date(dataStr + "T00:00:00");
  const dif = Math.round((hoje - d) / (1000*60*60*24));
  if (dif === 0) return "Hoje";
  if (dif === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

// histórico: rótulo do mês a partir de "AAAA-MM" (ex.: "JULHO 2026")
function rotuloMes(mesStr) {
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [ano, mes] = mesStr.split("-");
  return (nomes[parseInt(mes) - 1] + " " + ano).toUpperCase();
}

// F2: monta a linha de um movimento no histórico (com ícone circular colorido)
function linhaHistorico(l) {
  const v = visualLanc(l);
  // pagamento de conta guarda "Pagamento: <nome>"; no título mostramos só o nome
  // (o subtítulo já diz "Pagamento de conta"), evitando redundância.
  const titulo = (l.descricao || "").startsWith("Pagamento: ") ? l.descricao.slice("Pagamento: ".length) : (l.descricao || "");
  return `<div class="item">
    <div style="display:flex;align-items:center;gap:12px;min-width:0">
      <span class="ico-circ" style="color:${v.cor};background:${v.fundo}">${ico(v.icone, 18)}</span>
      <div style="min-width:0"><div class="nome">${titulo}</div><div class="sub">${v.rot}</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="valor ${v.classe}">${v.sinal}${reais(l.valor_reais)}</span>
      <button class="perigo ib" title="Apagar" onclick="apagarLancamento(${l.id})">${ico('apagar')}</button>
    </div></div>`;
}

// F3: em qual filtro cada movimento se encaixa (transferência conta como caixinhas)
function categoriaLanc(l) {
  if ((l.descricao || "").startsWith("transferência")) return "caixinhas";
  if (l.tipo === "entrada") return "entradas";
  if (l.tipo === "alocacao" || l.tipo === "rendimento") return "caixinhas";
  if (l.tipo === "pagamento" || l.tipo === "saida_livre") return "saidas";
  return "outros";
}

async function carregarHistorico() {
  HIST = await pedir("/lancamentos");
  renderHistorico();
}

// F3: aplica filtro + busca e agrupa por dia (F2)
function renderHistorico() {
  const lista = document.getElementById("lista-historico");
  if (HIST.length === 0) { lista.innerHTML = '<div class="vazio">Nenhum movimento ainda.</div>'; return; }

  const termo = buscaHist.trim().toLowerCase();
  const filtrados = HIST.filter(l => {
    const okFiltro = (filtroHist === "tudo") || (categoriaLanc(l) === filtroHist);
    const okBusca = !termo || (l.descricao || "").toLowerCase().includes(termo);
    return okFiltro && okBusca;
  });
  if (filtrados.length === 0) {
    lista.innerHTML = '<div class="vazio">Nenhum movimento encontrado com esse filtro/busca.</div>';
    return;
  }

  // separa sem-data e agrupa o resto por MÊS (AAAA-MM) e, dentro, por dia
  const comData = filtrados.filter(l => l.data);
  const semData = filtrados.filter(l => !l.data);

  const meses = {};
  comData.forEach(l => { const m = l.data.slice(0, 7); (meses[m] = meses[m] || []).push(l); });
  const mesesOrd = Object.keys(meses).sort().reverse();

  let html = "";
  mesesOrd.forEach(mes => {
    const doMes = meses[mes];
    // resumo do mês: entrou (entradas) e saiu (pagamentos não-transferência + saídas livres)
    let entrou = 0, saiu = 0;
    doMes.forEach(l => {
      const transf = (l.descricao || "").startsWith("transferência");
      if (l.tipo === "entrada") entrou += l.valor_reais;
      else if (l.tipo === "saida_livre") saiu += l.valor_reais;
      else if (l.tipo === "pagamento" && !transf) saiu += l.valor_reais;
    });
    html += `<div class="grupo-mes"><span>${rotuloMes(mes)}</span><span class="resumo-mes"><span class="mais">+ ${reais(entrou)}</span><span class="menos">− ${reais(saiu)}</span></span></div>`;
    // dias do mês, do mais recente ao mais antigo; dentro do dia, mais novo primeiro
    const dias = {};
    doMes.forEach(l => { (dias[l.data] = dias[l.data] || []).push(l); });
    Object.keys(dias).sort().reverse().forEach(dia => {
      html += `<div class="grupo-dia">${rotuloDia(dia)}</div>`;
      html += dias[dia].slice().reverse().map(linhaHistorico).join("");
    });
  });
  if (semData.length) {
    html += `<div class="grupo-mes"><span>Registros antigos (sem data)</span></div>`;
    html += semData.slice().reverse().map(linhaHistorico).join("");
  }
  lista.innerHTML = html;
}

// F4: totais e insights do mês atual (usa a data dos lançamentos, da F1)
async function carregarAnalise() {
  const lanc = await pedir("/lancamentos");
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const doMes = lanc.filter(l => l.data && l.data.startsWith(mesAtual));
  popularMesesWrapped(lanc);   // E6: alimenta o seletor de retrospectivas

  let entrou = 0, saiu = 0, gastoLivre = 0;
  const gastoPorCaixinha = {};
  doMes.forEach(l => {
    const transf = (l.descricao || "").startsWith("transferência");
    if (l.tipo === "entrada") entrou += l.valor_reais;
    else if (l.tipo === "saida_livre") { saiu += l.valor_reais; gastoLivre += l.valor_reais; }
    else if (l.tipo === "pagamento" && !transf) {
      saiu += l.valor_reais;
      gastoPorCaixinha[l.caixinha_id] = (gastoPorCaixinha[l.caixinha_id] || 0) + l.valor_reais;
    }
  });
  const sobrou = entrou - saiu;

  document.getElementById("an-entrou").textContent = reais(entrou);
  document.getElementById("ct-entradas").textContent = reais(entrou);   // card do topo = entradas SÓ do mês atual
  document.getElementById("an-saiu").textContent = reais(saiu);
  document.getElementById("an-sobrou").textContent = reais(sobrou);
  document.getElementById("analise-mes").textContent =
    "Referente a " + agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // resumo/insight
  const insight = document.getElementById("an-insight");
  if (entrou === 0 && saiu === 0) {
    insight.innerHTML = '<div class="vazio">Sem movimentos com data neste mês ainda.</div>';
  } else if (entrou === 0) {
    insight.innerHTML = `<div class="sub">Nenhuma entrada registrada neste mês. Você gastou ${reais(saiu)}.</div>`;
  } else {
    const pctGasto = Math.round(saiu / entrou * 100);
    const pctSobrou = 100 - pctGasto;
    const cor = pctGasto > 100 ? "var(--vermelho)" : (pctGasto > 80 ? "var(--amarelo)" : "var(--verde)");
    insight.innerHTML = `
      <div style="margin-bottom:10px">Você gastou <b style="color:${cor}">${pctGasto}%</b> do que entrou este mês${pctGasto > 100 ? " — gastou mais do que ganhou!" : "."}</div>
      <div style="height:10px;background:var(--fundo);border-radius:5px;overflow:hidden"><div style="width:${Math.min(pctGasto, 100)}%;height:100%;background:${cor}"></div></div>
      <div class="sub" style="margin-top:8px">${pctSobrou >= 0 ? `Sobrou ${pctSobrou}% (${reais(sobrou)}).` : `Faltou ${reais(-sobrou)}.`}</div>`;
  }

  // principais gastos do mês (por descrição) — os que mais pesaram
  const gastoPorDesc = {};
  doMes.forEach(l => {
    const transf = (l.descricao || "").startsWith("transferência");
    if (l.tipo === "saida_livre" || (l.tipo === "pagamento" && !transf)) {
      const d = l.descricao || "(sem descrição)";
      gastoPorDesc[d] = (gastoPorDesc[d] || 0) + l.valor_reais;
    }
  });
  const topGastos = Object.entries(gastoPorDesc)
    .map(([nome, v]) => ({ nome, valor: v }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  const elP = document.getElementById("an-principais");
  if (topGastos.length === 0) {
    elP.innerHTML = "";
  } else {
    elP.innerHTML = `<div style="font-size:12px;color:var(--texto2);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;border-top:1px solid var(--borda);padding-top:14px;margin-bottom:4px">Principais gastos do mês</div>`
      + topGastos.map(g => `<div class="item"><div class="nome">${g.nome}</div><span class="valor menos">${reais(g.valor)}</span></div>`).join("");
  }

  // para onde foi o dinheiro (gastos por caixinha + saídas livres)
  const nomeCx = {};
  TODAS_CAIXINHAS.forEach(c => { nomeCx[c.id] = c.nome; });
  const linhas = Object.entries(gastoPorCaixinha).map(([id, v]) => ({ nome: nomeCx[id] || ("Caixinha " + id), valor: v }));
  if (gastoLivre > 0) linhas.push({ nome: "Saídas do saldo livre", valor: gastoLivre });
  linhas.sort((a, b) => b.valor - a.valor);

  const el = document.getElementById("an-gastos");
  if (linhas.length === 0) { el.innerHTML = '<div class="vazio">Nenhum gasto neste mês.</div>'; return; }
  const totalGasto = linhas.reduce((s, l) => s + l.valor, 0);
  const cores = ["#8b5cf6","#34d399","#f87171","#fbbf24","#60a5fa","#f472b6","#a78bfa","#2dd4bf"];
  el.innerHTML = linhas.map((l, i) => {
    const pct = totalGasto > 0 ? Math.round(l.valor / totalGasto * 100) : 0;
    const cor = cores[i % cores.length];
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:14px">${l.nome}</span><span style="font-size:14px;font-weight:600;color:${cor}">${reais(l.valor)}</span></div>
      <div style="height:7px;background:var(--fundo);border-radius:4px"><div style="width:${pct}%;height:100%;background:${cor};border-radius:4px"></div></div>
      <div class="sub" style="margin-top:4px">${pct}% dos gastos</div>
    </div>`;
  }).join("");
}

// ===== E6: Retrospectiva mensal ("Wrapped") =====
let wrappedChecado = false;      // só verifica 1x por sessão
let wrappedMesModal = null;      // mês a marcar como visto ao fechar (null = reabertura manual)

function mesAnteriorStr() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// preenche o seletor de meses da Análise com os meses que têm lançamentos
function popularMesesWrapped(lanc) {
  const sel = document.getElementById("wrapped-mes");
  if (!sel) return;
  const meses = [...new Set(lanc.filter(l => l.data).map(l => l.data.slice(0, 7)))].sort().reverse();
  const atual = sel.value;
  sel.innerHTML = meses.length
    ? meses.map(m => `<option value="${m}">${rotuloMes(m)}</option>`).join("")
    : '<option value="">— sem meses —</option>';
  if (atual && meses.includes(atual)) sel.value = atual;
}

// calcula o resumo de um mês a partir dos lançamentos
async function calcularWrapped(mesStr) {
  const lanc = await pedir("/lancamentos");
  const doMes = lanc.filter(l => l.data && l.data.startsWith(mesStr));
  let entrou = 0, saiu = 0, guardado = 0; const porDesc = {};
  doMes.forEach(l => {
    const transf = (l.descricao || "").startsWith("transferência");
    if (l.tipo === "entrada") entrou += l.valor_reais;
    else if (l.tipo === "alocacao" && !transf) guardado += l.valor_reais;
    else if (l.tipo === "saida_livre" || (l.tipo === "pagamento" && !transf)) {
      saiu += l.valor_reais;
      const d = l.descricao || "(sem descrição)";
      porDesc[d] = (porDesc[d] || 0) + l.valor_reais;
    }
  });
  const maior = Object.entries(porDesc).sort((a, b) => b[1] - a[1])[0];
  return {
    temDados: doMes.length > 0 && (entrou > 0 || saiu > 0),
    entrou, saiu, sobrou: entrou - saiu, guardado,
    maiorNome: maior ? maior[0] : null, maiorValor: maior ? maior[1] : 0
  };
}

function abrirWrappedComDados(mesStr, d, marcarVisto) {
  wrappedMesModal = marcarVisto ? mesStr : null;
  const sobrouCor = d.sobrou >= 0 ? "var(--verde)" : "var(--vermelho)";
  document.getElementById("wrapped-conteudo").innerHTML = `
    <div style="text-align:center;font-size:34px">🎉</div>
    <div style="text-align:center;font-size:12px;color:var(--texto2);text-transform:uppercase;letter-spacing:0.08em;margin:6px 0 2px">Sua retrospectiva</div>
    <div style="text-align:center;font-size:20px;font-weight:700;color:var(--roxo-claro);margin-bottom:18px">${rotuloMes(mesStr)}</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between"><span>Entrou</span><b class="valor mais">${reais(d.entrou)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Saiu</span><b class="valor menos">${reais(d.saiu)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Guardado em caixinhas</span><b class="valor roxo">${reais(d.guardado)}</b></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--borda);padding-top:12px"><span>${d.sobrou >= 0 ? "Você guardou (sobra)" : "Você ficou no vermelho"}</span><b class="valor" style="color:${sobrouCor}">${reais(Math.abs(d.sobrou))}</b></div>
      ${d.maiorNome ? `<div style="display:flex;justify-content:space-between"><span>Maior gasto</span><b>${d.maiorNome} · ${reais(d.maiorValor)}</b></div>` : ""}
    </div>`;
  document.getElementById("wrapped-overlay").style.display = "flex";
}

async function fecharWrapped() {
  document.getElementById("wrapped-overlay").style.display = "none";
  if (wrappedMesModal) {
    try { await pedir("/wrapped-visto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mes: wrappedMesModal }) }); } catch (e) {}
    wrappedMesModal = null;
  }
}

// abre automaticamente a retrospectiva do mês passado, uma vez, quando entra num mês novo
async function verificarWrapped() {
  if (wrappedChecado) return;
  wrappedChecado = true;
  const prev = mesAnteriorStr();
  let status;
  try { status = await pedir("/wrapped-status"); } catch (e) { return; }
  if (status.visto_ate && status.visto_ate >= prev) return;
  const d = await calcularWrapped(prev);
  if (!d.temDados) {
    // nada no mês passado: marca como visto pra não ficar checando
    try { await pedir("/wrapped-visto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mes: prev }) }); } catch (e) {}
    return;
  }
  abrirWrappedComDados(prev, d, true);
}

// botão manual na Análise: reabre a retrospectiva do mês escolhido
async function abrirRetrospectiva() {
  const mes = document.getElementById("wrapped-mes").value;
  if (!mes) return aviso("Sem meses para mostrar ainda.", "erro");
  const d = await calcularWrapped(mes);
  if (!d.temDados) return aviso("Sem dados nesse mês.", "erro");
  abrirWrappedComDados(mes, d, false);
}

// Categorias: preenche os dropdowns de conta/assinatura e a lista de gerenciamento
async function carregarCategorias() {
  const cats = await pedir("/categorias");
  const opcoes = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join("");
  document.getElementById("ct-tipo").innerHTML = opcoes || '<option value="">— crie uma categoria —</option>';
  document.getElementById("r-tipo").innerHTML = opcoes || '<option value="">— crie uma categoria —</option>';
  const lista = document.getElementById("lista-categorias");
  if (cats.length === 0) { lista.innerHTML = '<div class="vazio">Nenhuma categoria. Crie a primeira ao lado.</div>'; return; }
  lista.innerHTML = cats.map(c => `
    <div class="item"><div class="nome">${c.nome}</div>
    <button class="perigo ib" title="Apagar" onclick="apagarCategoria(${c.id})">${ico('apagar')}</button></div>`).join("");
}

async function criarCategoria() {
  const nome = document.getElementById("cat-nome").value.trim();
  if (!nome) return aviso("Dê um nome à categoria.", "erro");
  try {
    await pedir("/categorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome }) });
    document.getElementById("cat-nome").value = "";
    aviso("Categoria adicionada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarCategoria(id) {
  try {
    await pedir("/categorias/" + id, { method: "DELETE" });
    aviso("Categoria apagada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// E4: regras de salário — troca o rótulo do campo valor conforme o modo
function ajustarModoRegra() {
  const modo = document.getElementById("rg-modo").value;
  document.getElementById("rg-valor-label").textContent = modo === "fixo" ? "Valor (R$)" : "Porcentagem (%)";
  document.getElementById("rg-valor").placeholder = modo === "fixo" ? "300,00" : "10";
}

async function carregarRegras() {
  const regras = await pedir("/regras");
  const nomeCx = {};
  TODAS_CAIXINHAS.forEach(c => { nomeCx[c.id] = c.nome; });
  const lista = document.getElementById("lista-regras");
  if (!lista) return;
  if (regras.length === 0) { lista.innerHTML = '<div class="vazio">Nenhuma regra ainda. Crie a primeira ao lado.</div>'; return; }
  lista.innerHTML = regras.map(r => {
    const quanto = r.modo === "fixo" ? reais(r.valor / 100) : (r.valor + "%");
    const cx = nomeCx[r.caixinha_id] || ("caixinha " + r.caixinha_id);
    return `<div class="item">
      <div><div class="nome">${r.gatilho}</div><div class="sub">guarda <b>${quanto}</b> na ${cx}</div></div>
      <button class="perigo ib" title="Apagar" onclick="apagarRegra(${r.id})">${ico('apagar')}</button>
    </div>`;
  }).join("");
}

async function criarRegra() {
  const gatilho = document.getElementById("rg-gatilho").value.trim();
  const modo = document.getElementById("rg-modo").value;
  const valorStr = document.getElementById("rg-valor").value;
  const cxId = document.getElementById("rg-caixinha").value;
  if (!gatilho) return aviso("Informe o gatilho (nome da entrada).", "erro");
  if (!valorStr) return aviso("Informe o valor.", "erro");
  if (!cxId) return aviso("Crie uma caixinha primeiro.", "erro");
  const valor = modo === "fixo" ? paraCentavos(valorStr) : Math.round(parseFloat(valorStr.replace(",", ".")));
  if (isNaN(valor) || valor <= 0) return aviso("Valor inválido.", "erro");
  try {
    await pedir("/regras", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gatilho, modo, valor, caixinha_id: parseInt(cxId) }) });
    document.getElementById("rg-gatilho").value = ""; document.getElementById("rg-valor").value = "";
    aviso("Regra criada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarRegra(id) {
  try { await pedir("/regras/" + id, { method: "DELETE" }); aviso("Regra apagada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

// ---- entradas automáticas (renda recorrente: ex. salário todo dia 5) ----
async function carregarEntradasRecorrentes() {
  const lista = document.getElementById("lista-entradas-rec");
  if (!lista) return;
  let itens = [];
  try { itens = await pedir("/entradas-recorrentes"); } catch (e) { return; }
  if (itens.length === 0) { lista.innerHTML = '<div class="vazio">Nenhuma renda automática ainda.</div>'; return; }
  lista.innerHTML = itens.map(i => `
    <div class="item">
      <div><div class="nome">${i.nome}</div><div class="sub">${reais(i.valor_reais)} · todo dia ${i.dia}</div></div>
      <button class="perigo ib" title="Apagar" onclick="apagarEntradaRecorrente(${i.id})">${ico('apagar')}</button>
    </div>`).join("");
}

async function criarEntradaRecorrente() {
  const nome = document.getElementById("er-nome").value.trim();
  const valorStr = document.getElementById("er-valor").value;
  const dia = parseInt(document.getElementById("er-dia").value);
  if (!nome) return aviso("Dê um nome à renda (ex.: Salário).", "erro");
  if (!valorStr) return aviso("Informe o valor.", "erro");
  const valor_centavos = paraCentavos(valorStr);
  if (isNaN(valor_centavos) || valor_centavos <= 0) return aviso("Valor inválido.", "erro");
  if (isNaN(dia) || dia < 1 || dia > 31) return aviso("Dia inválido (1 a 31).", "erro");
  try {
    await pedir("/entradas-recorrentes", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, valor_centavos, dia }) });
    document.getElementById("er-nome").value = ""; document.getElementById("er-valor").value = ""; document.getElementById("er-dia").value = "";
    aviso("Renda automática criada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarEntradaRecorrente(id) {
  try { await pedir("/entradas-recorrentes/" + id, { method: "DELETE" }); aviso("Renda automática apagada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

async function carregarRecorrentes() {
  const recs = await pedir("/recorrentes");
  RECORRENTES = recs;
  // E2: faturas de cartão disponíveis (das contas já carregadas)
  const faturas = (CONTAS || []).filter(c => c.tipo_conta === "fatura");
  const nomeFatura = {}; faturas.forEach(f => { nomeFatura[f.id] = f.nome; });
  // preenche o select do formulário "nova assinatura"
  const rf = document.getElementById("r-fatura");
  if (rf) {
    const atual = rf.value;
    rf.innerHTML = `<option value="">Conta avulsa (aparece nas dívidas)</option>` +
      faturas.map(f => `<option value="${f.id}">Fatura: ${f.nome}</option>`).join("");
    rf.value = atual;
  }
  const lista = document.getElementById("lista-recorrentes");
  if (recs.length === 0) { lista.innerHTML = '<div class="vazio" style="padding:8px 0">Nenhuma assinatura.</div>'; return; }
  lista.innerHTML = recs.map(r => {
    const destino = r.conta_fatura_id
      ? `na fatura <b>${nomeFatura[r.conta_fatura_id] || "?"}</b>`
      : "conta avulsa";
    const selOpts = `<option value="">Avulsa</option>` +
      faturas.map(f => `<option value="${f.id}" ${r.conta_fatura_id === f.id ? "selected" : ""}>${f.nome}</option>`).join("");
    return `<div class="item">
      <div><div class="nome">${r.nome}</div><div class="sub">todo dia ${r.dia_vencimento} · ${destino}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="valor menos">${reais(r.valor_reais)}</span>
        <select title="Cobrar em" onchange="vincularFatura(${r.id}, this.value)" style="font-family:inherit;font-size:12px;padding:5px;border:1px solid var(--borda);border-radius:8px;background:var(--fundo);color:var(--texto);max-width:120px">${selOpts}</select>
        <button class="perigo ib" title="Apagar" onclick="apagarRecorrente(${r.id})">${ico('apagar')}</button>
      </div></div>`;
  }).join("");
}

// E2: muda (ou remove) o vínculo de uma assinatura com uma fatura de cartão
async function vincularFatura(id, val) {
  const conta_fatura_id = val ? parseInt(val) : null;
  try {
    await pedir(`/recorrentes/${id}/fatura`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conta_fatura_id }) });
    aviso(conta_fatura_id ? "Assinatura vinculada à fatura." : "Assinatura virou avulsa.", "ok");
    carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function registrarEntrada() {
  const desc = document.getElementById("e-desc").value || "Entrada";
  const valor = document.getElementById("e-valor").value;
  const data = document.getElementById("e-data").value || null;
  if (!valor) return aviso("Informe o valor.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "entrada", valor_centavos: paraCentavos(valor), descricao: desc, caixinha_id: null, data }) });
    document.getElementById("e-desc").value = ""; document.getElementById("e-valor").value = ""; document.getElementById("e-data").value = "";
    aviso("Entrada registrada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function criarCaixinha() {
  const nome = document.getElementById("c-nome").value;
  const bancoId = document.getElementById("c-banco").value;
  const metaStr = document.getElementById("c-meta").value;
  if (!nome) return aviso("Dê um nome à caixinha.", "erro");
  if (!bancoId) return aviso("Crie um banco primeiro e escolha um.", "erro");
  const meta_centavos = metaStr ? paraCentavos(metaStr) : 0;
  try {
    await pedir("/caixinhas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, banco_id: parseInt(bancoId), meta_centavos }) });
    document.getElementById("c-nome").value = ""; document.getElementById("c-meta").value = "";
    aviso("Caixinha criada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// meta de uma caixinha: define, altera ou remove (valor em branco)
async function definirMeta(id) {
  const c = TODAS_CAIXINHAS.find(x => x.id === id);
  const atual = (c && c.meta_reais) ? c.meta_reais.toFixed(2) : "";
  const atualPrazo = (c && c.meta_prazo) ? c.meta_prazo : "";
  const r = await abrirFormModal({
    titulo: "Meta da caixinha",
    campos: [
      { id: "meta", label: "Meta (R$) — em branco remove", valor: atual, tipo: "number", placeholder: "1000,00" },
      { id: "prazo", label: "Data-limite (opcional)", valor: atualPrazo, tipo: "date" }
    ],
    rotulo: "Salvar"
  });
  if (!r) return;
  let meta_centavos = 0;
  if ((r.meta || "").trim() !== "") {
    const v = parseFloat(r.meta.replace(",", "."));
    if (isNaN(v) || v < 0) return aviso("Valor inválido.", "erro");
    meta_centavos = Math.round(v * 100);
  }
  // E8: data-limite opcional (ex.: IPVA em janeiro) — só vale se tiver meta
  let meta_prazo = null;
  if (meta_centavos > 0 && (r.prazo || "").trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.prazo.trim())) return aviso("Data inválida. Use AAAA-MM-DD.", "erro");
    meta_prazo = r.prazo.trim();
  }
  try {
    await pedir(`/caixinhas/${id}/meta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meta_centavos, meta_prazo }) });
    aviso("Meta atualizada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// atalhos direto na linha da caixinha: guardar (+) e gastar/tirar (−)
async function guardarNaCaixinha(id) {
  const c = TODAS_CAIXINHAS.find(x => x.id === id);
  const r = await abrirFormModal({
    titulo: `Guardar em ${c ? c.nome : "caixinha"}`,
    campos: [
      { id: "valor", label: "Valor (R$)", tipo: "number", placeholder: "300,00" },
      { id: "data", label: "Data (opcional)", tipo: "date" }
    ],
    rotulo: "Guardar"
  });
  if (!r) return;
  const v = parseFloat((r.valor || "").replace(",", "."));
  if (isNaN(v) || v <= 0) return aviso("Informe um valor maior que zero.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "alocacao", valor_centavos: Math.round(v * 100), descricao: "guardado", caixinha_id: id, data: (r.data || "").trim() || null }) });
    aviso("Dinheiro guardado.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function gastarDaCaixinha(id) {
  const c = TODAS_CAIXINHAS.find(x => x.id === id);
  const r = await abrirFormModal({
    titulo: `Gastar de ${c ? c.nome : "caixinha"}`,
    campos: [
      { id: "desc", label: "Descrição", tipo: "text", placeholder: "Cinema" },
      { id: "valor", label: "Valor (R$)", tipo: "number", placeholder: "40,00" },
      { id: "data", label: "Data (opcional)", tipo: "date" }
    ],
    rotulo: "Registrar gasto"
  });
  if (!r) return;
  const v = parseFloat((r.valor || "").replace(",", "."));
  if (isNaN(v) || v <= 0) return aviso("Informe um valor maior que zero.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "pagamento", valor_centavos: Math.round(v * 100), descricao: (r.desc || "").trim() || "gasto", caixinha_id: id, data: (r.data || "").trim() || null }) });
    aviso("Gasto registrado.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function alocar() {
  const id = document.getElementById("a-caixinha").value;
  const valor = document.getElementById("a-valor").value;
  const data = document.getElementById("a-data").value || null;
  if (!id) return aviso("Crie uma caixinha primeiro.", "erro");
  if (!valor) return aviso("Informe o valor.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "alocacao", valor_centavos: paraCentavos(valor), descricao: "guardado", caixinha_id: parseInt(id), data }) });
    document.getElementById("a-valor").value = ""; document.getElementById("a-data").value = "";
    aviso("Dinheiro guardado.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// M2: rendimento entra direto na caixinha (tipo 'rendimento'); não mexe no saldo livre
async function registrarRendimento() {
  const id = document.getElementById("rd-caixinha").value;
  const valor = document.getElementById("rd-valor").value;
  const data = document.getElementById("rd-data").value || null;
  if (!id) return aviso("Crie uma caixinha primeiro.", "erro");
  if (!valor) return aviso("Informe o valor do rendimento.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "rendimento", valor_centavos: paraCentavos(valor), descricao: "rendimento", caixinha_id: parseInt(id), data }) });
    document.getElementById("rd-valor").value = ""; document.getElementById("rd-data").value = "";
    aviso("Rendimento registrado.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function transferir() {
  const origem = document.getElementById("t-origem").value;
  const destino = document.getElementById("t-destino").value;
  const valor = document.getElementById("t-valor").value;
  if (!valor) return aviso("Informe o valor.", "erro");
  try {
    await pedir("/transferir", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem_id: parseInt(origem), destino_id: parseInt(destino), valor_centavos: paraCentavos(valor) }) });
    document.getElementById("t-valor").value = ""; aviso("Transferência feita.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function gastarCaixinha() {
  const id = document.getElementById("g-caixinha").value;
  const desc = document.getElementById("g-desc").value || "gasto";
  const valor = document.getElementById("g-valor").value;
  const data = document.getElementById("g-data").value || null;
  if (!id) return aviso("Crie uma caixinha primeiro.", "erro");
  if (!valor) return aviso("Informe o valor.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "pagamento", valor_centavos: paraCentavos(valor), descricao: desc, caixinha_id: parseInt(id), data }) });
    document.getElementById("g-desc").value = ""; document.getElementById("g-valor").value = ""; document.getElementById("g-data").value = "";
    aviso("Gasto registrado.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function tirarSaldoLivre() {
  const desc = document.getElementById("s-desc").value || "saída";
  const valor = document.getElementById("s-valor").value;
  const data = document.getElementById("s-data").value || null;
  if (!valor) return aviso("Informe o valor.", "erro");
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "saida_livre", valor_centavos: paraCentavos(valor), descricao: desc, caixinha_id: null, data }) });
    document.getElementById("s-desc").value = ""; document.getElementById("s-valor").value = ""; document.getElementById("s-data").value = "";
    aviso("Saída registrada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// ===== Anexar comprovante no cadastro da conta: lê (OCR) e PREENCHE os campos =====
function ctAnexoSelecionado(ev) {
  const f = ev.target.files[0];
  if (f) ctLerAnexo(f);
  ev.target.value = "";   // permite re-anexar o mesmo arquivo
}

function ctLerAnexo(file) {
  const tipo = ((file.name || "").toLowerCase().endsWith(".pdf") || file.type === "application/pdf") ? "pdf" : "imagem";
  const status = document.getElementById("ct-anexo-status");
  status.style.color = "var(--texto2)";
  status.textContent = "Lendo o comprovante (pode levar alguns segundos)...";
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const resp = await pedir("/importar/conta-imagem", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: reader.result, tipo_arquivo: tipo }) });
      // preenche os campos do formulário de cadastro (nome/valor/vencimento)
      const feitos = [];
      if (resp.nome) { document.getElementById("ct-nome").value = resp.nome; feitos.push("nome"); }
      if (resp.valor_centavos) { document.getElementById("ct-valor").value = (resp.valor_centavos / 100).toFixed(2); feitos.push("valor"); }
      if (resp.vencimento && resp.vencimento !== "?") { document.getElementById("ct-venc").value = resp.vencimento; feitos.push("vencimento"); }
      if (feitos.length) {
        status.style.color = "var(--verde)";
        status.innerHTML = `✓ Li o comprovante e preenchi <b>${feitos.join(", ")}</b>. Confira antes de cadastrar.`;
      } else {
        status.style.color = "var(--amarelo)";
        status.textContent = "Li o comprovante, mas não achei valor/vencimento com clareza. Preencha à mão.";
      }
    } catch (e) {
      status.style.color = "var(--vermelho)";
      status.textContent = e.message;
    }
  };
  reader.onerror = () => { status.style.color = "var(--vermelho)"; status.textContent = "Não consegui ler o arquivo."; };
  reader.readAsDataURL(file);   // "data:...;base64,XXXX" — o back-end decodifica
}

async function criarConta() {
  const nome = document.getElementById("ct-nome").value;
  const tipoConta = document.getElementById("ct-tipoconta").value;
  const valor = document.getElementById("ct-valor").value;
  const venc = document.getElementById("ct-venc").value;
  const tipo = document.getElementById("ct-tipo").value;
  if (!nome) return aviso("Preencha o nome.", "erro");
  if (tipoConta === "simples" && !valor) return aviso("Preencha o valor.", "erro");
  try {
    await pedir("/contas", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, valor_centavos: tipoConta === "fatura" ? 0 : paraCentavos(valor), vencimento: venc, tipo, tipo_conta: tipoConta }) });
    document.getElementById("ct-nome").value = ""; document.getElementById("ct-valor").value = ""; document.getElementById("ct-venc").value = "";
    const st = document.getElementById("ct-anexo-status"); if (st) st.textContent = "";
    aviso(tipoConta === "fatura" ? "Fatura criada. Abra-a para adicionar gastos." : "Conta cadastrada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function criarRecorrente() {
  const nome = document.getElementById("r-nome").value;
  const valor = document.getElementById("r-valor").value;
  const dia = document.getElementById("r-dia").value;
  const tipo = document.getElementById("r-tipo").value;
  const faturaVal = document.getElementById("r-fatura").value;
  if (!nome || !valor || !dia) return aviso("Preencha nome, valor e dia.", "erro");
  const conta_fatura_id = faturaVal ? parseInt(faturaVal) : null;
  try {
    await pedir("/recorrentes", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, valor_centavos: paraCentavos(valor), dia_vencimento: parseInt(dia), tipo, conta_fatura_id }) });
    document.getElementById("r-nome").value = ""; document.getElementById("r-valor").value = ""; document.getElementById("r-dia").value = ""; document.getElementById("r-fatura").value = "";
    aviso("Assinatura cadastrada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// ===== Licenças (assinaturas com periodicidade) =====
const PERIODO_LABEL = { mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };

async function carregarLicencas() {
  const lics = await pedir("/licencas");
  const faturas = (CONTAS || []).filter(c => c.tipo_conta === "fatura");
  const nomeFatura = {}; faturas.forEach(f => { nomeFatura[f.id] = f.nome; });
  // popula o select "cobrar em" do formulário (faturas de cartão disponíveis)
  const lf = document.getElementById("lc-fatura");
  if (lf) {
    const atual = lf.value;
    lf.innerHTML = `<option value="">Conta avulsa (aparece nas dívidas)</option>` +
      faturas.map(f => `<option value="${f.id}">Fatura: ${f.nome}</option>`).join("");
    lf.value = atual;
  }
  const lista = document.getElementById("lista-licencas");
  if (!lista) return;
  if (lics.length === 0) { lista.innerHTML = '<div class="vazio">Nenhuma licença cadastrada.</div>'; return; }
  lista.innerHTML = lics.map(l => {
    const destino = l.conta_fatura_id ? `fatura <b>${nomeFatura[l.conta_fatura_id] || "?"}</b>` : "conta avulsa";
    const forn = l.fornecedor ? `${l.fornecedor} · ` : "";
    return `<div class="item">
      <div><div class="nome">${l.nome}</div>
        <div class="sub">${forn}${PERIODO_LABEL[l.periodicidade] || l.periodicidade} · próx. ${l.proximo_vencimento || "—"} · ${destino}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="valor menos">${reais(l.valor_reais)}</span>
        <button class="perigo ib" title="Apagar" onclick="apagarLicenca(${l.id})">${ico('apagar')}</button>
      </div></div>`;
  }).join("");
}

async function criarLicenca() {
  const nome = document.getElementById("lc-nome").value.trim();
  const fornecedor = document.getElementById("lc-fornecedor").value.trim();
  const valor = document.getElementById("lc-valor").value;
  const periodicidade = document.getElementById("lc-periodo").value;
  const venc = document.getElementById("lc-venc").value;
  const tipo = document.getElementById("lc-tipo").value;
  const faturaVal = document.getElementById("lc-fatura").value;
  if (!nome) return aviso("Preencha o nome da licença.", "erro");
  if (!valor || parseFloat(valor) <= 0) return aviso("Preencha o valor.", "erro");
  if (!venc) return aviso("Preencha o vencimento.", "erro");
  const conta_fatura_id = faturaVal ? parseInt(faturaVal) : null;
  try {
    await pedir("/licencas", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, fornecedor: fornecedor || null, valor_centavos: paraCentavos(valor),
        periodicidade, proximo_vencimento: venc, tipo, conta_fatura_id }) });
    document.getElementById("lc-nome").value = ""; document.getElementById("lc-fornecedor").value = "";
    document.getElementById("lc-valor").value = ""; document.getElementById("lc-venc").value = "";
    aviso("Licença cadastrada — 1ª cobrança na agenda se for deste mês.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarLicenca(id) {
  try { await pedir("/licencas/" + id, { method: "DELETE" }); aviso("Licença apagada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

// ===== Previsão financeira =====
let graficoPrevisao = null;
let prevPeriodo = "30";
const PREV_ORIGEM = { conta: "Conta", assinatura: "Assinatura", licenca: "Licença", renda: "Renda" };

// calcula a data-fim (AAAA-MM-DD) de cada período a partir de hoje
function prevAteDate(periodo) {
  const h = new Date(); h.setHours(0,0,0,0);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if (periodo === "mes") return iso(new Date(h.getFullYear(), h.getMonth()+1, 0));      // último dia do mês atual
  if (periodo === "proximo") return iso(new Date(h.getFullYear(), h.getMonth()+2, 0));  // último dia do mês que vem
  const d = new Date(h); d.setDate(d.getDate() + parseInt(periodo)); return iso(d);     // +N dias
}

function fmtDataBR(iso) { const [a,m,d] = iso.split("-"); return `${d}/${m}`; }

async function carregarPrevisao() {
  const ate = prevAteDate(prevPeriodo);
  let p;
  try { p = await pedir("/previsao?ate=" + ate); }
  catch (e) { aviso(e.message, "erro"); return; }

  // cards
  const cards = document.getElementById("prev-cards");
  const projCor = p.saldo_projetado_centavos < 0 ? "var(--vermelho)" : "var(--verde)";
  cards.innerHTML = `
    ${cardPrev("Saldo atual", reais(p.saldo_atual_centavos/100), "var(--texto)")}
    ${cardPrev("Entradas previstas", "+ " + reais(p.entradas_centavos/100), "var(--verde)")}
    ${cardPrev("Saídas previstas", "− " + reais(p.saidas_centavos/100), "var(--vermelho)")}
    ${cardPrev("Saldo projetado", reais(p.saldo_projetado_centavos/100), projCor)}`;

  // alerta de saldo negativo
  const alerta = document.getElementById("prev-alerta");
  if (p.saldo_negativo) {
    alerta.innerHTML = `<div style="background:var(--vermelho-fundo);border:1px solid var(--vermelho);color:var(--vermelho);
      border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:14px">
      ⚠️ Seu saldo fica <b>negativo em ${fmtDataBR(p.saldo_negativo.data)}</b> (chega a ${reais(p.saldo_negativo.valor_centavos/100)}).</div>`;
  } else {
    alerta.innerHTML = `<div style="background:var(--verde-fundo);border:1px solid var(--verde);color:var(--verde);
      border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:14px">
      ✓ O saldo se mantém positivo em todo o período.</div>`;
  }

  // gráfico de linha do saldo ao longo do tempo
  desenharGraficoPrevisao(p.serie);

  // lista de eventos
  const el = document.getElementById("prev-eventos");
  if (!p.eventos.length) {
    el.innerHTML = '<div class="vazio">Nenhum evento previsto neste período.</div>';
    return;
  }
  el.innerHTML = p.eventos.map(e => {
    const ent = e.tipo === "entrada";
    return `<div class="item">
      <div><div class="nome">${e.descricao}</div>
        <div class="sub">${fmtDataBR(e.data)} · ${PREV_ORIGEM[e.origem] || e.origem}</div></div>
      <span class="valor ${ent ? "mais" : "menos"}">${ent ? "+ " : "− "}${reais(e.valor_centavos/100)}</span>
    </div>`;
  }).join("");
}

function cardPrev(rotulo, valor, cor) {
  return `<div style="background:var(--fundo);border:1px solid var(--borda);border-radius:12px;padding:14px 16px">
    <div class="sub" style="font-size:12px;margin-bottom:4px">${rotulo}</div>
    <div style="font-size:20px;font-weight:700;color:${cor}">${valor}</div></div>`;
}

function desenharGraficoPrevisao(serie) {
  const canvas = document.getElementById("grafico-previsao");
  const vazio = document.getElementById("prev-grafico-vazio");
  if (!serie || serie.length < 2) {
    canvas.style.display = "none"; if (vazio) vazio.style.display = "block";
    if (graficoPrevisao) { graficoPrevisao.destroy(); graficoPrevisao = null; }
    return;
  }
  canvas.style.display = "block"; if (vazio) vazio.style.display = "none";
  const labels = serie.map(s => fmtDataBR(s.data));
  const valores = serie.map(s => s.saldo_centavos / 100);
  const temNeg = valores.some(v => v < 0);
  const dados = {
    labels,
    datasets: [{
      data: valores, borderColor: temNeg ? "#fb7185" : "#7c5cff",
      backgroundColor: "rgba(124,92,255,0.12)", fill: true, tension: 0.25,
      pointRadius: 3, pointBackgroundColor: temNeg ? "#fb7185" : "#7c5cff", borderWidth: 2
    }]
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false },
      tooltip: { callbacks: { label: c => "Saldo: " + reais(c.parsed.y) } } },
    scales: {
      x: { ticks: { color: "#a8a2c8", font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: "rgba(168,162,200,0.08)" } },
      y: { ticks: { color: "#a8a2c8", font: { size: 11 }, callback: v => "R$ " + v }, grid: { color: "rgba(168,162,200,0.08)" } }
    }
  };
  if (graficoPrevisao) { graficoPrevisao.data = dados; graficoPrevisao.options = opts; graficoPrevisao.update(); }
  else { graficoPrevisao = new Chart(canvas, { type: "line", data: dados, options: opts }); }
}

async function pagarConta(id) {
  const caixinhaId = document.getElementById("pagar-" + id).value;
  if (!caixinhaId) return aviso("Crie uma caixinha para pagar.", "erro");
  const campoValor = document.getElementById("pagar-valor-" + id);
  const valorTxt = campoValor ? campoValor.value.trim() : "";
  try {
    if (valorTxt) {
      // pagamento PARCIAL: paga só o valor digitado (a conta continua com o restante)
      const centavos = paraCentavos(valorTxt);
      if (!centavos || centavos <= 0) return aviso("Digite um valor válido para pagar.", "erro");
      const r = await pedir(`/contas/${id}/pagar-parcial`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caixinha_id: parseInt(caixinhaId), valor_centavos: centavos }) });
      aviso(r.quitada ? "Conta quitada!" : `Pago. Ainda faltam ${reais(r.restante_reais)}.`, "ok");
    } else {
      // sem valor digitado: paga tudo que falta (comportamento de sempre)
      await pedir(`/contas/${id}/pagar`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caixinha_id: parseInt(caixinhaId) }) });
      aviso("Conta paga.", "ok");
    }
    carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// atrela uma conta avulsa já criada a uma fatura de cartão (vira item da fatura)
async function atrelarFatura(id) {
  const faturas = (CONTAS || []).filter(c => c.tipo_conta === "fatura" && !c.paga);
  if (faturas.length === 0) return aviso("Crie uma fatura (não paga) primeiro.", "erro");
  const c = (CONTAS || []).find(x => x.id === id);
  const r = await abrirFormModal({
    titulo: `Atrelar "${c ? c.nome : "conta"}" a uma fatura`,
    campos: [{ id: "fatura", label: "Fatura de cartão", tipo: "select", opcoes: faturas.map(f => ({ valor: f.id, texto: f.nome })) }],
    rotulo: "Atrelar"
  });
  if (!r) return;
  const faturaId = parseInt(r.fatura);
  try {
    await pedir(`/contas/${id}/mover-fatura`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conta_fatura_id: faturaId }) });
  } catch (e) { return aviso(e.message, "erro"); }
  aviso("Conta atrelada à fatura.", "ok");
  // se essa conta veio de uma ASSINATURA avulsa de mesmo nome, oferece vincular pra cair na fatura todo mês
  const rec = (RECORRENTES || []).find(x => x.nome === (c && c.nome) && !x.conta_fatura_id);
  if (rec) {
    const todoMes = await confirmar({
      titulo: "Vincular a assinatura também?",
      texto: `"${rec.nome}" é uma assinatura que se repete todo mês. Quer que ela caia direto nesta fatura nos próximos meses também (em vez de virar conta avulsa)?`,
      rotulo: "Sim, todo mês", icone: "dividas"
    });
    if (todoMes) {
      try {
        await pedir(`/recorrentes/${rec.id}/fatura`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conta_fatura_id: faturaId }) });
        aviso("Assinatura vinculada à fatura.", "ok");
      } catch (e) { aviso(e.message, "erro"); }
    }
  }
  carregarTudo();
}

async function apagarLancamento(id) {
  try { await pedir("/lancamentos/" + id, { method: "DELETE" }); aviso("Lançamento apagado.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

async function desfazerPagamento(id) {
  try { await pedir(`/contas/${id}/desfazer-pagamento`, { method: "POST" }); aviso("Pagamento desfeito.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

async function apagarConta(id) {
  if (!(await confirmar({ titulo: "Apagar esta dívida?", texto: "Essa ação não pode ser desfeita. A conta sai da sua lista permanentemente.", rotulo: "Apagar", icone: "apagar" }))) return;
  try { await pedir("/contas/" + id, { method: "DELETE" }); aviso("Dívida apagada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

// M1: arquivar/desarquivar contas pagas (some da tela mas fica no banco)
async function arquivarConta(id) {
  try { await pedir(`/contas/${id}/arquivar`, { method: "POST" }); aviso("Conta arquivada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}
async function arquivarAntigas() {
  if (!(await confirmar({ titulo: "Arquivar contas antigas?", texto: "Todas as contas pagas de meses anteriores somem da lista, mas continuam no histórico e na Análise.", rotulo: "Arquivar", icone: "alerta" }))) return;
  try {
    const r = await pedir("/contas/arquivar-antigas", { method: "POST" });
    aviso(`${r.quantidade} conta(s) arquivada(s).`, "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}
async function desarquivarConta(id) {
  try {
    await pedir(`/contas/${id}/desarquivar`, { method: "POST" });
    aviso("Conta desarquivada.", "ok");
    await carregarTudo();
    await mostrarArquivadas(true);
  } catch (e) { aviso(e.message, "erro"); }
}
let arquivadasVisiveis = false;
async function toggleArquivadas() {
  arquivadasVisiveis = !arquivadasVisiveis;
  const b = document.getElementById("btn-arq");
  if (b) b.textContent = arquivadasVisiveis ? "Ocultar arquivadas" : "Ver arquivadas";
  await mostrarArquivadas(arquivadasVisiveis);
}
async function mostrarArquivadas(mostrar) {
  const wrap = document.getElementById("arquivadas-wrap");
  if (!wrap) return;
  if (!mostrar) { wrap.style.display = "none"; return; }
  const arqs = await pedir("/contas/arquivadas");
  const lista = document.getElementById("lista-arquivadas");
  if (arqs.length === 0) {
    lista.innerHTML = '<div class="vazio">Nenhuma conta arquivada.</div>';
  } else {
    lista.innerHTML = arqs.map(c => `<div class="linha-conta paga">
      <div><div class="nome">${c.nome}</div><div class="sub">${c.tipo}</div></div>
      <div class="col-venc">${c.vencimento || "—"}</div>
      <div class="valor">${reais(c.valor_reais)}</div>
      <div><span class="status-tag" style="color:var(--texto2);background:var(--painel2)">Arquivada</span></div>
      <div style="text-align:right"><button class="perigo" onclick="desarquivarConta(${c.id})">Desarquivar</button></div>
    </div>`).join("");
  }
  wrap.style.display = "block";
}

async function editarConta(id) {
  const c = CONTAS.find(x => x.id === id);
  if (!c) return;
  const ehFatura = c.tipo_conta === "fatura";
  const campos = [{ id: "nome", label: "Nome da dívida", valor: c.nome }];
  // fatura não tem valor editável (o total vem da soma dos itens)
  if (!ehFatura) campos.push({ id: "valor", label: "Valor (R$)", valor: c.valor_reais.toFixed(2), tipo: "number", placeholder: "0,00" });
  campos.push({ id: "vencimento", label: "Vencimento", valor: c.vencimento || "", tipo: "date" });
  campos.push({ id: "tipo", label: "Categoria", valor: c.tipo || "outro", placeholder: "fixa, cartão, outro" });
  const r = await abrirFormModal({ titulo: "Editar dívida", campos, rotulo: "Salvar" });
  if (!r) return;
  let valorCentavos = 0;
  if (!ehFatura) {
    const valor = parseFloat((r.valor || "").replace(",", "."));
    if (isNaN(valor)) return aviso("Valor inválido.", "erro");
    valorCentavos = Math.round(valor * 100);
  }
  try {
    await pedir("/contas/" + id, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: r.nome, valor_centavos: valorCentavos, vencimento: r.vencimento, tipo: r.tipo })
    });
    aviso("Dívida editada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

async function apagarCaixinha(id) {
  try { await pedir("/caixinhas/" + id, { method: "DELETE" }); aviso("Caixinha apagada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

async function apagarRecorrente(id) {
  try { await pedir("/recorrentes/" + id, { method: "DELETE" }); aviso("Assinatura apagada.", "ok"); carregarTudo(); }
  catch (e) { aviso(e.message, "erro"); }
}

// ===== E3: Importar extrato (OFX/CSV) =====
let importLinhas = [];

function arquivoSelecionado(ev) {
  const f = ev.target.files[0];
  if (f) lerArquivoImport(f);
  ev.target.value = "";   // permite re-selecionar o mesmo arquivo
}

let importMes = null;   // mês escolhido no filtro de importação ("AAAA-MM", "sem-data" ou "todos")
let importSaldoConta = null;   // saldo da conta no extrato OFX (oferecido como "Saldo inicial")
function mesDaLinha(l) { return (l.data && l.data !== "?") ? l.data.slice(0, 7) : "sem-data"; }
function aplicarFiltroMesImport() { importLinhas.forEach(l => l.incluir = (importMes === "todos" || mesDaLinha(l) === importMes)); }

function lerArquivoImport(file) {
  const nome = (file.name || "").toLowerCase();
  const tipo = nome.endsWith(".ofx") ? "ofx" : "csv";
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const resp = await pedir("/importar/analisar", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: reader.result, tipo_arquivo: tipo }) });
      importLinhas = resp.linhas.map(l => ({ ...l, incluir: true }));
      importSaldoConta = (resp.saldo_conta_reais != null) ? resp.saldo_conta_reais : null;
      // por padrão, importa só o MÊS ATUAL (evita puxar o ano inteiro de uma vez)
      const agora = new Date();
      const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
      const mesesReais = [...new Set(importLinhas.map(mesDaLinha))].filter(m => m !== "sem-data").sort();
      importMes = mesesReais.includes(mesAtual) ? mesAtual : (mesesReais[mesesReais.length - 1] || "todos");
      aplicarFiltroMesImport();
      renderImportPreview();
    } catch (e) { aviso(e.message, "erro"); }
  };
  reader.onerror = () => aviso("Não consegui ler o arquivo.", "erro");
  reader.readAsText(file, "utf-8");
}

// registra o saldo da conta (do extrato) como uma entrada "Saldo inicial" — tira o saldo livre do negativo
async function adicionarSaldoInicial() {
  if (importSaldoConta == null) return;
  try {
    await pedir("/lancamentos", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "entrada", valor_centavos: Math.round(importSaldoConta * 100), descricao: "Saldo inicial" }) });
    aviso("Saldo inicial adicionado.", "ok");
    importSaldoConta = null;
    carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

function renderImportPreview() {
  const el = document.getElementById("imp-preview");
  if (!importLinhas.length) {
    el.innerHTML = '<div class="vazio">Nenhum lançamento reconhecido. Tente um arquivo <b>.ofx</b> ou um <b>.csv</b> com colunas de data, descrição e valor.</div>';
    return;
  }
  // seletor de mês (evita importar o extrato do ano inteiro de uma vez)
  const mesesReais = [...new Set(importLinhas.map(mesDaLinha))].filter(m => m !== "sem-data").sort().reverse();
  let opcoes = mesesReais.map(m => {
    const [y, mm] = m.split("-");
    const lbl = new Date(+y, +mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const n = importLinhas.filter(l => mesDaLinha(l) === m).length;
    return `<option value="${m}" ${importMes === m ? "selected" : ""}>${lbl} (${n})</option>`;
  });
  if (importLinhas.some(l => mesDaLinha(l) === "sem-data")) {
    const n = importLinhas.filter(l => mesDaLinha(l) === "sem-data").length;
    opcoes.push(`<option value="sem-data" ${importMes === "sem-data" ? "selected" : ""}>sem data — usa hoje (${n})</option>`);
  }
  opcoes.push(`<option value="todos" ${importMes === "todos" ? "selected" : ""}>Todos os meses (${importLinhas.length})</option>`);

  const visiveis = importLinhas.map((l, i) => ({ l, i })).filter(({ l }) => importMes === "todos" || mesDaLinha(l) === importMes);

  let html = "";
  if (importSaldoConta != null) {
    html += `<div class="painel" style="margin:14px 0 4px;padding:14px 16px">
      <div class="sub" style="margin-bottom:8px">Saldo da conta no extrato: <b style="color:var(--texto)">${reais(importSaldoConta)}</b>. Como o app é orçamento base-zero, importar só os gastos deixa o saldo livre negativo — adicione o saldo da conta como ponto de partida.</div>
      <button class="acao pequeno" onclick="adicionarSaldoInicial()">Adicionar "Saldo inicial" de ${reais(importSaldoConta)}</button>
    </div>`;
  }
  html += `<div class="barra-hist" style="margin:18px 0 6px">
    <div class="sub">Importar o mês:</div>
    <select class="busca-hist" style="min-width:190px" onchange="importMes=this.value;aplicarFiltroMesImport();renderImportPreview()">${opcoes.join("")}</select>
  </div>`;
  html += `<div class="sub" style="margin:0 0 10px">${visiveis.length} lançamento(s) neste filtro. Revise, escolha a caixinha e importe:</div>`;
  html += visiveis.map(({ l, i }) => {
    const opts = `<option value="">${l.tipo === 'entrada' ? '(saldo livre)' : '(saída livre)'}</option>` +
      TODAS_CAIXINHAS.map(c => `<option value="${c.id}" ${l.caixinha_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join("");
    return `<div class="item" style="gap:10px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:8px;flex:1;min-width:120px;cursor:pointer">
        <input type="checkbox" ${l.incluir ? "checked" : ""} onchange="importLinhas[${i}].incluir=this.checked">
        <span style="min-width:0"><span class="nome">${l.descricao}</span><span class="sub" style="display:block">${l.data === '?' ? 'sem data (usa hoje)' : l.data} · ${l.tipo === 'entrada' ? 'entrada' : 'gasto'}</span></span>
      </label>
      <span class="valor ${l.tipo === 'entrada' ? 'mais' : 'menos'}">${l.tipo === 'entrada' ? '+ ' : '− '}${reais(l.valor_centavos / 100)}</span>
      <select onchange="importLinhas[${i}].caixinha_id=this.value?parseInt(this.value):null" style="font-family:inherit;font-size:12px;padding:5px;border:1px solid var(--borda);border-radius:8px;background:var(--fundo);color:var(--texto);max-width:140px">${opts}</select>
    </div>`;
  }).join("");
  html += `<button class="acao" style="margin-top:16px" onclick="confirmarImport()">Importar selecionados</button>`;
  el.innerHTML = html;
}

async function confirmarImport() {
  const sel = importLinhas.filter(l => l.incluir);
  if (!sel.length) return aviso("Marque ao menos um lançamento.", "erro");
  try {
    const r = await pedir("/importar/confirmar", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linhas: sel.map(l => ({ descricao: l.descricao, valor_centavos: l.valor_centavos, data: l.data, tipo: l.tipo, caixinha_id: l.caixinha_id || null })) }) });
    aviso(`${r.quantidade} lançamento(s) importados.`, "ok");
    importLinhas = [];
    document.getElementById("imp-preview").innerHTML = "";
    carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// ===== Leitor de conta por foto/PDF (OCR local, sem nuvem/IA) =====
let ocrPrevia = null;

function ocrArquivoSelecionado(ev) {
  const f = ev.target.files[0];
  if (f) lerArquivoOcr(f);
  ev.target.value = "";   // permite re-selecionar o mesmo arquivo
}

function lerArquivoOcr(file) {
  const nome = (file.name || "").toLowerCase();
  const tipo = (nome.endsWith(".pdf") || file.type === "application/pdf") ? "pdf" : "imagem";
  const el = document.getElementById("ocr-preview");
  el.innerHTML = '<div class="sub" style="margin-top:14px">Lendo o arquivo (OCR pode levar alguns segundos)...</div>';
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const resp = await pedir("/importar/conta-imagem", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: reader.result, tipo_arquivo: tipo }) });
      ocrPrevia = resp;
      renderOcrPreview();
    } catch (e) { el.innerHTML = ""; aviso(e.message, "erro"); }
  };
  reader.onerror = () => { el.innerHTML = ""; aviso("Não consegui ler o arquivo.", "erro"); };
  reader.readAsDataURL(file);   // dá um "data:...;base64,XXXX" — o back-end decodifica
}

function renderOcrPreview() {
  const el = document.getElementById("ocr-preview");
  if (!ocrPrevia) { el.innerHTML = ""; return; }
  const valorInicial = ocrPrevia.valor_centavos ? (ocrPrevia.valor_centavos / 100).toFixed(2) : "";
  const vencInicial = ocrPrevia.vencimento && ocrPrevia.vencimento !== "?" ? ocrPrevia.vencimento : "";
  el.innerHTML = `
    <div class="sub" style="margin:18px 0 10px">Prévia — <b>confira e corrija</b> antes de cadastrar (foto real pode errar):</div>
    <div class="campo-duplo">
      <div class="campo"><label>Nome</label><input id="ocr-nome" value="${(ocrPrevia.nome || "").replace(/"/g, "&quot;")}"></div>
      <div class="campo"><label>Valor (R$)</label><input id="ocr-valor" type="number" step="0.01" value="${valorInicial}" placeholder="0,00"></div>
    </div>
    <div class="campo-duplo">
      <div class="campo"><label>Vencimento</label><input id="ocr-venc" type="date" value="${vencInicial}"></div>
      <div class="campo"><label>Categoria</label>
        <select id="ocr-tipo"><option value="fixa">Conta fixa</option><option value="cartao">Cartão</option><option value="outro">Outros</option></select>
      </div>
    </div>
    <button class="acao" onclick="confirmarOcrConta()">Cadastrar como conta</button>
    <details style="margin-top:12px"><summary class="sub" style="cursor:pointer">Ver texto lido (bruto)</summary>
      <div class="sub" style="white-space:pre-wrap;margin-top:8px;max-height:220px;overflow:auto;font-size:11px">${(ocrPrevia.texto_bruto || "").replace(/</g, "&lt;")}</div>
    </details>`;
}

async function confirmarOcrConta() {
  const nome = document.getElementById("ocr-nome").value.trim();
  const valor = document.getElementById("ocr-valor").value;
  const venc = document.getElementById("ocr-venc").value;
  const tipo = document.getElementById("ocr-tipo").value;
  if (!nome) return aviso("Preencha o nome.", "erro");
  if (!valor || parseFloat(valor) <= 0) return aviso("Preencha o valor.", "erro");
  if (!venc) return aviso("Preencha o vencimento.", "erro");
  try {
    await pedir("/contas", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, valor_centavos: paraCentavos(valor), vencimento: venc, tipo, tipo_conta: "simples" }) });
    ocrPrevia = null;
    document.getElementById("ocr-preview").innerHTML = "";
    aviso("Conta cadastrada.", "ok"); carregarTudo();
  } catch (e) { aviso(e.message, "erro"); }
}

// troca de telas pelo menu lateral
const titulos = { dashboard: "Visão geral", caixinhas: "Caixinhas", contas: "Dívidas", historico: "Histórico", analise: "Análise", previsao: "Previsão", categorias: "Categorias", regras: "Regras", licencas: "Licenças", importar: "Importar" };
document.querySelectorAll(".item-menu").forEach(item => {
  item.addEventListener("click", () => {
    const tela = item.dataset.tela;
    if (!tela) return; // botões sem aba (ex.: Sair) não trocam de tela
    document.querySelectorAll(".item-menu").forEach(a => a.classList.remove("ativa"));
    document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
    item.classList.add("ativa");
    document.getElementById(tela).classList.add("ativa");
    document.getElementById("titulo-tela").textContent = titulos[tela];
    if (tela === "previsao") carregarPrevisao();   // previsão carrega ao abrir (dado fresco do servidor)
  });
});

// chips de período da Previsão
document.querySelectorAll(".filtros-prev .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filtros-prev .chip").forEach(c => c.classList.remove("ativa"));
    chip.classList.add("ativa");
    prevPeriodo = chip.dataset.prev;
    carregarPrevisao();
  });
});

// atalho: navega para uma tela reaproveitando o clique do menu lateral
function irPara(tela) {
  const item = document.querySelector('.item-menu[data-tela="' + tela + '"]');
  if (item) { item.click(); window.scrollTo({ top: 0, behavior: "smooth" }); }
}

// recolher/mostrar o menu lateral (salva a escolha)
function toggleMenu() {
  const oculto = document.body.classList.toggle("menu-oculto");
  localStorage.setItem("sb_menu_oculto", oculto ? "1" : "0");
}
// restaura o estado salvo do menu ao abrir
if (localStorage.getItem("sb_menu_oculto") === "1") document.body.classList.add("menu-oculto");

// F3: filtros e busca do histórico
document.querySelectorAll(".filtros-hist .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filtros-hist .chip").forEach(c => c.classList.remove("ativa"));
    chip.classList.add("ativa");
    filtroHist = chip.dataset.filtro;
    renderHistorico();
  });
});
document.getElementById("busca-hist").addEventListener("input", e => {
  buscaHist = e.target.value;
  renderHistorico();
});

// E: popula os ícones fixos (menu lateral) marcados com data-ico
document.querySelectorAll("[data-ico]").forEach(el => {
  const size = el.dataset.icoSize ? parseInt(el.dataset.icoSize) : 16;
  el.innerHTML = ico(el.dataset.ico, size);
});

// E9: atalhos de teclado — E abre Entrada, G abre Gasto, Esc tira o foco do campo
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
  // não faz nada se o login está aberto
  const login = document.getElementById("tela-login");
  if (login && login.style.display !== "none") return;
  // não dispara atalho enquanto o usuário digita num campo
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "e" || e.key === "E") {
    e.preventDefault();
    document.querySelector('.item-menu[data-tela="dashboard"]').click();
    const el = document.getElementById("e-desc"); if (el) el.focus();
  } else if (e.key === "g" || e.key === "G") {
    e.preventDefault();
    document.querySelector('.item-menu[data-tela="caixinhas"]').click();
    const el = document.getElementById("g-desc"); if (el) el.focus();
  } else if (e.key === "m" || e.key === "M") {
    e.preventDefault();
    toggleMenu();
  }
});
// E9: Enter salva no campo de valor de cada formulário
function enterSalva(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); fn(); } });
}
["e-desc", "e-valor"].forEach(id => enterSalva(id, registrarEntrada));
enterSalva("g-valor", gastarCaixinha);
enterSalva("a-valor", alocar);
enterSalva("rd-valor", registrarRendimento);
enterSalva("s-valor", tirarSaldoLivre);

// E3: arrastar-e-soltar o arquivo de extrato na área tracejada
(function () {
  const drop = document.getElementById("imp-drop");
  if (!drop) return;
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.style.borderColor = "var(--roxo)"; drop.style.color = "var(--roxo-claro)"; });
  drop.addEventListener("dragleave", () => { drop.style.borderColor = "var(--borda)"; drop.style.color = "var(--texto2)"; });
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.style.borderColor = "var(--borda)"; drop.style.color = "var(--texto2)";
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) lerArquivoImport(f);
  });
})();

// arrastar-e-soltar a foto/PDF da conta na área tracejada do leitor por OCR
(function () {
  const drop = document.getElementById("ocr-drop");
  if (!drop) return;
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.style.borderColor = "var(--roxo)"; drop.style.color = "var(--roxo-claro)"; });
  drop.addEventListener("dragleave", () => { drop.style.borderColor = "var(--borda)"; drop.style.color = "var(--texto2)"; });
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.style.borderColor = "var(--borda)"; drop.style.color = "var(--texto2)";
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) lerArquivoOcr(f);
  });
})();

// arrastar-e-soltar o comprovante na área do formulário de cadastrar conta (auto-preenche)
(function () {
  const drop = document.getElementById("ct-anexo-drop");
  if (!drop) return;
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.style.borderColor = "var(--roxo)"; drop.style.color = "var(--roxo-claro)"; });
  drop.addEventListener("dragleave", () => { drop.style.borderColor = "var(--borda)"; drop.style.color = "var(--texto2)"; });
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.style.borderColor = "var(--borda)"; drop.style.color = "var(--texto2)";
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) ctLerAnexo(f);
  });
})();

// ===== date picker custom (nossa cara) =====
// mantém o <input type="date"> por baixo (valor continua AAAA-MM-DD), mas troca o
// calendário BRANCO nativo por um popup no tema do app. Usa delegação, então cobre
// inclusive os inputs de data criados dinamicamente (ex.: modais).
const DP = { pop: null, input: null, view: null };
function dpISO(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; }
function dpFechar() { if (DP.pop) DP.pop.style.display = "none"; DP.input = null; }
function dpEscolher(iso) {
  if (DP.input) {
    DP.input.value = iso;
    DP.input.dispatchEvent(new Event("input", { bubbles: true }));
    DP.input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  dpFechar();
}
function dpRender() {
  const pop = DP.pop, v = DP.view;
  const ano = v.getFullYear(), mes = v.getMonth();
  const nomesMes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dow = ["D", "S", "T", "Q", "Q", "S", "S"];
  const inicio = new Date(ano, mes, 1).getDay();       // 0 = domingo
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const antMes = new Date(ano, mes, 0).getDate();
  const hojeISO = dpISO(new Date());
  const selISO = DP.input ? DP.input.value : "";
  let cells = "";
  for (let i = inicio - 1; i >= 0; i--) cells += `<div class="dp-dia fora">${antMes - i}</div>`;
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cls = ["dp-dia"];
    if (iso === hojeISO) cls.push("hoje");
    if (iso === selISO) cls.push("sel");
    cells += `<div class="${cls.join(" ")}" data-iso="${iso}">${d}</div>`;
  }
  const resto = (7 - ((inicio + diasNoMes) % 7)) % 7;
  for (let d = 1; d <= resto; d++) cells += `<div class="dp-dia fora">${d}</div>`;
  pop.innerHTML = `
    <div class="dp-topo">
      <div class="dp-mes">${nomesMes[mes].charAt(0).toUpperCase() + nomesMes[mes].slice(1)} de ${ano}</div>
      <div class="dp-nav"><button type="button" data-nav="-1">‹</button><button type="button" data-nav="1">›</button></div>
    </div>
    <div class="dp-grade">${dow.map(d => `<div class="dp-dow">${d}</div>`).join("")}${cells}</div>
    <div class="dp-rodape"><button type="button" class="dp-acao" data-acao="limpar">Limpar</button><button type="button" class="dp-acao" data-acao="hoje">Hoje</button></div>`;
  pop.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => { DP.view = new Date(ano, mes + parseInt(b.dataset.nav), 1); dpRender(); });
  pop.querySelectorAll("[data-iso]").forEach(el => el.onclick = () => dpEscolher(el.dataset.iso));
  pop.querySelector('[data-acao="hoje"]').onclick = () => dpEscolher(hojeISO);
  pop.querySelector('[data-acao="limpar"]').onclick = () => dpEscolher("");
}
function dpAbrir(input) {
  DP.input = input;
  const iso = input.value;
  const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00") : new Date();
  DP.view = new Date(base.getFullYear(), base.getMonth(), 1);
  dpRender();
  const pop = DP.pop;
  pop.style.display = "block";
  const r = input.getBoundingClientRect();
  const larg = pop.offsetWidth, alt = pop.offsetHeight;
  // abre embaixo; se não couber, abre em cima
  let top = window.scrollY + r.bottom + 6;
  if (r.bottom + 6 + alt > window.innerHeight && r.top - 6 - alt > 0) top = window.scrollY + r.top - 6 - alt;
  let left = window.scrollX + r.left;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - larg - 8;
  if (left > maxLeft) left = maxLeft;
  pop.style.top = top + "px";
  pop.style.left = Math.max(8, left) + "px";
}
function dpInit() {
  const pop = document.createElement("div");
  pop.className = "dp-pop"; pop.id = "dp-pop"; pop.style.display = "none";
  document.body.appendChild(pop);
  DP.pop = pop;
  pop.addEventListener("mousedown", e => e.stopPropagation());   // clicar dentro não fecha
  // abre nosso picker e impede o nativo (captura, antes do foco nativo)
  document.addEventListener("mousedown", e => {
    const inp = e.target.closest ? e.target.closest('input[type="date"]') : null;
    if (inp) { e.preventDefault(); e.stopPropagation(); dpAbrir(inp); }
  }, true);
  // fecha ao clicar fora / Esc / rolar / redimensionar
  document.addEventListener("mousedown", () => dpFechar());
  document.addEventListener("keydown", e => { if (e.key === "Escape") dpFechar(); });
  window.addEventListener("resize", () => dpFechar());
  window.addEventListener("scroll", () => dpFechar(), true);
}
dpInit();

// data de hoje
const hoje = new Date();
document.getElementById("data-hoje").textContent = hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

iniciar().catch(() => {
  document.getElementById("login-erro").textContent = "Erro ao conectar. O servidor está rodando?";
});
