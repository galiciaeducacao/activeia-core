/**
 * ============================================================================
 * ACTIVE IA — CORE v1.0.0 (esqueleto)
 * ============================================================================
 *
 * Núcleo JavaScript compartilhado da fábrica Active IA da Galícia Educação.
 *
 * Hospedado em: https://galiciaeducacao.github.io/activeia-core/v1/core.js
 *
 * Este arquivo é **esqueleto evolutivo**:
 *   - Blocos marcados [CONSOLIDADO] vêm da v1 (Folículo) e estão completos
 *   - Blocos marcados [NOVO V2] são assinaturas + comentários explicando lógica
 *     esperada. Amadurecem durante a construção do primeiro simulador real.
 *
 * Para usar em um simulador:
 *   1. Importar no HTML: <script src="https://.../v1/core.js"></script>
 *   2. Definir SIMULATOR_CONFIG (ver HANDOFF_ACTIVE_IA_v2.md, Seção 4.2)
 *   3. Chamar ActiveIA.init(SIMULATOR_CONFIG) no final do <body>
 *
 * ============================================================================
 */

(function(global) {
  'use strict';

  // ==========================================================================
  // SEÇÃO 1 — CONSTANTES GLOBAIS DO CORE
  // ==========================================================================

  const CORE_VERSION = '1.0.0';
  const API_URL = 'https://shy-night-916aactive-ai-proxy.galiciaeducacao.workers.dev/';
  const MODEL = 'claude-sonnet-4-6';
  const MAX_TOKENS = 1500;

  // Distribuição de pontos por nível (referência; pode ser overridden no SIMULATOR_CONFIG)
  const POINTS_PER_TURN = { junior: 25, pleno: 17, senior: 11 };

  // Tolerância de articulação por nível (regras de encerramento antecipado)
  const ARTICULATION_TOLERANCE = {
    junior: { encerramento_antecipado: false },
    pleno:  { encerramento_antecipado: true, gatilho: 'duas_genericas_consecutivas' },
    senior: { encerramento_antecipado: true, gatilho: 'duas_genericas_ou_parciais_consecutivas' }
  };

  // ==========================================================================
  // SEÇÃO 2 — PERSISTENT STORAGE (IndexedDB + localStorage + cookie)  [CONSOLIDADO]
  //
  // Triplo fallback: IndexedDB principal, localStorage e cookie secundários.
  // IndexedDB é a única opção confiável em iframe cross-origin (Safari/iOS).
  // ==========================================================================

  const _memCache = {};
  let _db = null;
  const DB_NAME = 'activeia_db';

  function _openDB() {
    return new Promise((resolve) => {
      if (_db) return resolve(_db);
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => { e.target.result.createObjectStore('kv'); };
        req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  async function _idbGet(key) {
    const db = await _openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  async function _idbSet(key, value) {
    const db = await _openDB();
    if (!db) return;
    try {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
    } catch (e) {}
  }

  async function _idbRemove(key) {
    const db = await _openDB();
    if (!db) return;
    try {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
    } catch (e) {}
  }

  function storageGet(key) {
    if (_memCache[key] !== undefined) return _memCache[key];
    try { const v = localStorage.getItem(key); if (v !== null) return v; } catch (e) {}
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)'));
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    return null;
  }

  function storageSet(key, value) {
    _memCache[key] = value;
    _idbSet(key, value);
    try { localStorage.setItem(key, value); } catch (e) {}
    if (value.length < 200) {
      try {
        const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value) + '; expires=' + exp + '; path=/; SameSite=None; Secure';
        document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value) + '; expires=' + exp + '; path=/; SameSite=Lax';
      } catch (e) {}
    }
  }

  function storageRemove(key) {
    delete _memCache[key];
    _idbRemove(key);
    try { localStorage.removeItem(key); } catch (e) {}
    try { document.cookie = encodeURIComponent(key) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) {}
  }

  async function preloadCache(keys) {
    for (const key of keys) {
      const val = await _idbGet(key);
      if (val !== null) _memCache[key] = val;
    }
    for (const key of keys) {
      if (_memCache[key] === undefined) {
        try { const v = localStorage.getItem(key); if (v !== null) _memCache[key] = v; } catch (e) {}
      }
      if (_memCache[key] === undefined) {
        try {
          const m = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)'));
          if (m) _memCache[key] = decodeURIComponent(m[1]);
        } catch (e) {}
      }
    }
  }

  // ==========================================================================
  // SEÇÃO 3 — PARSER JSON ROBUSTO (5 estratégias)  [CONSOLIDADO]
  // ==========================================================================

  function parseJSON(text) {
    if (!text) return null;

    // Estratégia 1: direto
    try { return JSON.parse(text); } catch (e) {}

    // Estratégia 2: extrair de markdown ```json
    const md = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (md) { try { return JSON.parse(md[1].trim()); } catch (e) {} }

    // Estratégia 3: regex { ... }
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) { try { return JSON.parse(brace[0]); } catch (e) {} }

    // Estratégia 4: limpar (vírgulas trailing, aspas simples, chars de controle)
    if (brace) {
      let c = brace[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"')
        .replace(/[\x00-\x1F\x7F]/g, ' ');
      try { return JSON.parse(c); } catch (e) {}
    }

    // Estratégia 5: extração key-by-key via regex
    try {
      const obj = {};
      const re = /"(\w+)"\s*:\s*("(?:[^"\\]|\\.)*"|\[[\s\S]*?\]|\{[\s\S]*?\}|-?\d+\.?\d*|true|false|null)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        try { obj[m[1]] = JSON.parse(m[2]); }
        catch (e) { obj[m[1]] = m[2].replace(/^"|"$/g, ''); }
      }
      if (Object.keys(obj).length > 0) return obj;
    } catch (e) {}

    console.warn('[ActiveIA] JSON parse failed. Texto recebido:', text.substring(0, 300));
    return null;
  }

  // ==========================================================================
  // SEÇÃO 4 — CHAMADA À API COM PROMPT CACHING  [NOVO V2 — base consolidada da v1]
  //
  // Diferença chave em relação à v1:
  //   - system passa a ser array de blocos com cache_control no primeiro bloco
  //   - Worker precisa ter header 'anthropic-beta: prompt-caching-2024-07-31'
  //   - Parte fixa do system (regras + conteúdo de referência) é cacheada
  //   - Parte dinâmica do system (estado do caso, turno atual) NÃO é cacheada
  // ==========================================================================

  async function callAPI({ systemFixed, systemDynamic, messages }) {
    // systemFixed: string com a parte que não muda (regras, conteúdo de referência,
    //              Regra de Proporcionalidade, formato de resposta)
    // systemDynamic: string com a parte que muda a cada turno (estado do caso,
    //                indicadores atuais, turno/fase atual)
    // messages: array padrão de mensagens

    const systemArray = [
      {
        type: 'text',
        text: systemFixed,
        cache_control: { type: 'ephemeral' }   // <-- bloco cacheado
      },
      {
        type: 'text',
        text: systemDynamic                     // <-- bloco dinâmico, sem cache
      }
    ];

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemArray,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`API ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Log de cache hit (útil para QA)
    if (data.usage && data.usage.cache_read_input_tokens > 0) {
      console.log(`[ActiveIA] Cache hit: ${data.usage.cache_read_input_tokens} tokens lidos do cache`);
    }

    const textBlock = data.content.find(c => c.type === 'text');
    if (!textBlock) throw new Error('Resposta vazia da API');

    return parseJSON(textBlock.text);
  }

  // ==========================================================================
  // SEÇÃO 5 — MOTOR DE ARQUÉTIPOS  [NOVO V2]
  //
  // Lógica esperada:
  //   - Lê SIMULATOR_CONFIG.archetypes (array de 5-8 sementes conceituais)
  //   - Lê do storage a lista de IDs já jogados pelo aluno
  //   - Sorteia entre não-jogados (probabilidade uniforme)
  //   - Se todos foram jogados, sorteia entre todos novamente E avisa aluno
  //   - Retorna o arquétipo sorteado para injeção no system prompt
  //   - Ao final da sessão (mesmo incompleta), adiciona ID ao histórico
  // ==========================================================================

  function selectArchetype(config) {
    // TODO [primeiro simulador v2]: implementar com base nas decisões reais que
    // emergirem. Esqueleto da lógica abaixo.
    /*
    const playedKey = `${config.id}_played_archetypes`;
    const played = JSON.parse(storageGet(playedKey) || '[]');
    const available = config.archetypes.filter(a => !played.includes(a.id));

    let selected, isRevisit = false;
    if (available.length > 0) {
      selected = available[Math.floor(Math.random() * available.length)];
    } else {
      selected = config.archetypes[Math.floor(Math.random() * config.archetypes.length)];
      isRevisit = true;
    }

    return { archetype: selected, isRevisit };
    */
    throw new Error('selectArchetype: a implementar com primeiro simulador v2');
  }

  function recordArchetypePlayed(simulatorId, archetypeId) {
    // TODO: gravar no storage que esse arquétipo foi jogado
    /*
    const playedKey = `${simulatorId}_played_archetypes`;
    const played = JSON.parse(storageGet(playedKey) || '[]');
    if (!played.includes(archetypeId)) {
      played.push(archetypeId);
      storageSet(playedKey, JSON.stringify(played));
    }
    */
    throw new Error('recordArchetypePlayed: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 6 — MOTOR DE RAMIFICAÇÃO NARRATIVA  [NOVO V2]
  //
  // Lógica esperada:
  //   - A partir do turno 2, IA retorna campo case_state no JSON
  //   - case_state contém: dominant_hypothesis, key_decisions_taken,
  //     key_signals_identified, key_signals_missed, branch_position
  //   - Esse estado é injetado no systemDynamic do turno seguinte
  //   - Instrução à IA: manter coerência com case_state
  //   - Intensidade da ramificação varia por nível (ver HANDOFF Seção 6.2)
  // ==========================================================================

  function buildBranchingContext(caseState, level) {
    // TODO: produz o texto que vai no systemDynamic com o estado do caso
    /*
    if (!caseState) return '';

    const intensityByLevel = {
      junior: 'Ramificação leve. Mantenha coerência mas o desfecho geral é o mesmo.',
      pleno:  'Ramificação moderada. Desfechos efetivamente distintos conforme raciocínio.',
      senior: 'Ramificação densa. Rota errada pode ser irrecuperável com aprendizado embutido.'
    };

    return `
ESTADO DO CASO ATUAL (manter coerência rígida):
- Hipótese dominante do aluno: ${caseState.dominant_hypothesis}
- Decisões já tomadas: ${caseState.key_decisions_taken.join(', ')}
- Sinais identificados: ${caseState.key_signals_identified.join(', ')}
- Sinais não investigados: ${caseState.key_signals_missed.join(', ')}
- Posição no banco de ramificações: ${caseState.branch_position}

REGRA DE COERÊNCIA: Evolua o caso na direção compatível com a hipótese dominante.
Não introduza informações que contradigam sinais já identificados sem justificativa
profissional explícita.

INTENSIDADE DA RAMIFICAÇÃO (nível ${level}): ${intensityByLevel[level]}
    `;
    */
    throw new Error('buildBranchingContext: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 7 — MOTOR DE AVALIAÇÃO POR ARTICULAÇÃO  [NOVO V2]
  //
  // Lógica esperada:
  //   - A IA classifica internamente cada resposta como:
  //     "generica" / "parcial" / "articulada"
  //   - Essa classificação vem no JSON da resposta (campo articulation_class)
  //   - O core lê a classificação para alimentar o motor de encerramento antecipado
  //   - A Regra de Proporcionalidade está no systemFixed (não é lógica JS, é prompt)
  // ==========================================================================

  function getArticulationRulesPromptBlock() {
    // Retorna o bloco completo de texto sobre Regra de Proporcionalidade
    // que vai no systemFixed de TODO simulador. Esse bloco é fixo, cacheado,
    // e injetado em todos os turnos.
    /*
    return `
REGRA DE PROPORCIONALIDADE — REGRA MAIS IMPORTANTE DESTE SIMULADOR:

[três partes obrigatórias detalhadas — ver HANDOFF Seção 7 do v1 do Folículo
para conteúdo completo; adaptar exemplos ao domínio específico]

PARTE 1 — PROTOCOLO DE TRADUÇÃO LITERAL
[...]

PARTE 2 — FORMATO OBRIGATÓRIO DO FEEDBACK
[...]

PARTE 3 — PEDAGOGIA DA ESPECIFICIDADE
[...]

CLASSIFICAÇÃO INTERNA (incluir no JSON de resposta):
- articulation_class: "generica" | "parcial" | "articulada"
- Use essa classificação consistentemente com a movimentação dos indicadores
    `;
    */
    throw new Error('getArticulationRulesPromptBlock: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 8 — MOTOR DE ENCERRAMENTO ANTECIPADO  [NOVO V2]
  //
  // Regras (do HANDOFF Seção 8):
  //   - Júnior: nunca encerra antecipadamente por articulação
  //   - Pleno: dois turnos consecutivos "generica" → encerra
  //   - Sênior: dois turnos consecutivos "generica" OU "parcial" → encerra
  //   - Hard fail global (média < 25% do máximo a partir do turno 3) sempre vale
  // ==========================================================================

  function checkEarlyTermination(level, articulationHistory, currentTurn, indicators, config) {
    // articulationHistory: array de strings ["generica", "parcial", "articulada", ...]
    // currentTurn: número do turno atual
    // indicators: objeto com valores atuais dos indicadores
    // config: SIMULATOR_CONFIG

    // TODO: implementar com primeiro simulador v2
    /*
    // Regra 1: encerramento por articulação
    const tolerance = ARTICULATION_TOLERANCE[level];
    if (tolerance.encerramento_antecipado && articulationHistory.length >= 2) {
      const last2 = articulationHistory.slice(-2);
      if (tolerance.gatilho === 'duas_genericas_consecutivas') {
        if (last2.every(c => c === 'generica')) {
          return { terminate: true, reason: 'articulation_pleno', recommendation: 'voltar_junior' };
        }
      }
      if (tolerance.gatilho === 'duas_genericas_ou_parciais_consecutivas') {
        if (last2.every(c => c === 'generica' || c === 'parcial')) {
          return { terminate: true, reason: 'articulation_senior', recommendation: 'voltar_pleno' };
        }
      }
    }

    // Regra 2: hard fail global (a partir do turno 3)
    if (currentTurn >= 3) {
      const maxAccumulable = calculateMaxAccumulable(level, currentTurn, config);
      const currentTotal = Object.values(indicators).reduce((a, b) => a + b, 0);
      if (currentTotal < maxAccumulable * 0.25) {
        return { terminate: true, reason: 'hard_fail', recommendation: 'revisao_completa' };
      }
    }

    return { terminate: false };
    */
    throw new Error('checkEarlyTermination: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 9 — MOTOR DE DIAGNÓSTICO FINAL EM TRÊS CAMADAS  [NOVO V2]
  //
  // Ao final da sessão, faz chamada extra à IA pedindo:
  //   Camada 1: classificação de cada conceito (dominado / parcial / frágil / não demonstrado)
  //   Camada 2: pontos fortes/frágeis com referência específica ao turno
  //   Camada 3: recomendação de próximo passo
  // ==========================================================================

  async function generateFinalDiagnosis(state, config) {
    // state: estado completo da sessão (turnos, respostas, indicadores, histórico)
    // config: SIMULATOR_CONFIG

    // TODO: implementar com primeiro simulador v2
    /*
    const conceptsToEvaluate = config.concepts;
    const history = state.history;

    const prompt = `
[Analise a sessão completa do aluno abaixo e produza diagnóstico estruturado]

HISTÓRICO DE TURNOS:
${formatHistoryForAnalysis(history)}

CONCEITOS DO MÓDULO A AVALIAR:
${JSON.stringify(conceptsToEvaluate)}

PRODUZA JSON COM:
{
  "concept_map": {
    "<concept_id>": "dominado" | "parcial" | "fragil" | "nao_demonstrado",
    ...
  },
  "concept_map_justifications": {
    "<concept_id>": "Texto explicando por que essa classificação, com referência a turno específico"
  },
  "strengths": [
    { "turn": N, "description": "O aluno articulou X de forma Y" }
  ],
  "weaknesses": [
    { "turn": N, "description": "No turno N, faltou articular X. Reveja: Tema Y do módulo." }
  ],
  "next_step_recommendation": {
    "action": "subir_nivel" | "repetir_nivel" | "voltar_nivel" | "revisar_modulo",
    "rationale": "Mensagem clara ao aluno explicando a recomendação"
  }
}
    `;

    const diagnosis = await callAPI({
      systemFixed: config.reference_content + getArticulationRulesPromptBlock(),
      systemDynamic: 'Análise final de sessão completa.',
      messages: [{ role: 'user', content: prompt }]
    });

    return diagnosis;
    */
    throw new Error('generateFinalDiagnosis: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 10 — RESUMO CUMULATIVO DE HISTORY  [NOVO V2]
  //
  // A partir do turno 3, resume os turnos anteriores em um bloco compacto
  // que vai no systemDynamic. O messages array fica só com os 2 turnos
  // mais recentes (último completo + atual). Reduz tamanho do history e
  // protege contra timeout em sessões longas (Sênior com 9 turnos).
  // ==========================================================================

  function summarizeEarlyHistory(history, currentTurn) {
    // TODO: implementar com primeiro simulador v2
    /*
    if (currentTurn < 3) return { summary: null, recentMessages: history };

    const earlyTurns = history.slice(0, -4);   // tudo menos os 2 últimos turnos (4 mensagens)
    const recentMessages = history.slice(-4);

    // Resume em formato estruturado:
    // - Decisões-chave tomadas em cada turno antigo
    // - Indicadores ao final daquele turno
    // - Sinais identificados / não identificados acumulados
    const summary = produceCompactSummary(earlyTurns);

    return { summary, recentMessages };
    */
    throw new Error('summarizeEarlyHistory: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 11 — GERADOR DE PDF / HTML EXPORTÁVEL  [NOVO V2]
  //
  // PDF gerado client-side via biblioteca leve (jsPDF ou similar — a definir
  // durante construção do primeiro simulador). HTML gerado por composição
  // de template + dados da sessão.
  // ==========================================================================

  function exportSessionHTML(state, diagnosis, config) {
    // TODO: produzir HTML standalone com dashboard de três camadas formatado
    // para impressão (CSS print-friendly, A4)
    throw new Error('exportSessionHTML: a implementar com primeiro simulador v2');
  }

  function exportSessionPDF(state, diagnosis, config) {
    // TODO: usar jsPDF ou similar para gerar PDF a partir do mesmo dashboard
    throw new Error('exportSessionPDF: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 12 — GERADOR DE CARD LINKEDIN 1080×1080  [NOVO V2]
  //
  // Canvas API client-side. Layout fixo no branding Galícia.
  // Aguarda document.fonts.ready antes de gerar (senão fontes saem erradas).
  // Retorna PNG via canvas.toBlob → URL.createObjectURL.
  // ==========================================================================

  async function generateLinkedInCard(state, diagnosis, config) {
    // TODO: implementar com Canvas API
    /*
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // Layout fixo:
    // - Fundo #FAF7F2
    // - Logo Galícia + "Active IA" no topo (60px do topo)
    // - Nome do aluno (centralizado, Playfair Display)
    // - Nome simulador + módulo (Gotham/Montserrat)
    // - Badge de nível
    // - Data
    // - Lista de 3-5 competências demonstradas (derivadas de diagnosis.strengths)
    // - Métrica de destaque (ex: "8 de 10 conceitos do módulo dominados")
    // - Rodapé sutil

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    */
    throw new Error('generateLinkedInCard: a implementar com primeiro simulador v2');
  }

  function shareToLinkedIn(blob, suggestedText) {
    // Abre LinkedIn share com texto sugerido
    // (LinkedIn não suporta anexar imagem via URL; aluno baixa imagem e anexa manualmente)
    /*
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'active-ia-conquista.png';
    a.click();

    setTimeout(() => {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(suggestedText)}`, '_blank');
    }, 500);
    */
    throw new Error('shareToLinkedIn: a implementar com primeiro simulador v2');
  }

  // ==========================================================================
  // SEÇÃO 13 — THEME TOGGLE (claro/escuro)  [CONSOLIDADO]
  // ==========================================================================

  function initTheme(simulatorId) {
    const themeKey = `${simulatorId}_theme`;
    const saved = storageGet(themeKey);
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Expor função global de toggle
    global.ActiveIA_toggleTheme = function() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      storageSet(themeKey, isDark ? 'light' : 'dark');
    };
  }

  // ==========================================================================
  // SEÇÃO 14 — LOADING / ERROR OVERLAYS  [CONSOLIDADO]
  //
  // Funções utilitárias. Esperam IDs específicos no DOM do simulador:
  //   - #loadingOverlay com .loading-text dentro
  //   - #errorBox com #errorMsg dentro
  // O template HTML do simulador já vem com esses IDs.
  // ==========================================================================

  function showLoading(text) {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');
    if (textEl) textEl.textContent = text || 'Processando...';
    if (overlay) overlay.classList.add('active');
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function showError(msg) {
    const box = document.getElementById('errorBox');
    const textEl = document.getElementById('errorMsg');
    if (textEl) textEl.textContent = msg;
    if (box) box.classList.add('active');
  }

  function hideError() {
    const box = document.getElementById('errorBox');
    if (box) box.classList.remove('active');
  }

  // ==========================================================================
  // SEÇÃO 15 — DAILY BLOCK  [CONSOLIDADO]
  // ==========================================================================

  function isDailyBlocked(simulatorId) {
    const dailyKey = `${simulatorId}_daily`;
    const today = new Date().toISOString().split('T')[0];
    return storageGet(dailyKey) === today;
  }

  function markDayComplete(simulatorId) {
    const dailyKey = `${simulatorId}_daily`;
    storageSet(dailyKey, new Date().toISOString().split('T')[0]);
  }

  function getDailyTimer() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = tomorrow - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}min`;
  }

  // ==========================================================================
  // SEÇÃO 16 — SESSION PERSISTENCE  [CONSOLIDADO]
  // ==========================================================================

  function saveSession(simulatorId, state) {
    const key = `${simulatorId}_session`;
    storageSet(key, JSON.stringify({
      ...state,
      savedAt: new Date().toISOString(),
      coreVersion: CORE_VERSION
    }));
  }

  function loadSession(simulatorId) {
    const key = `${simulatorId}_session`;
    const data = storageGet(key);
    if (!data) return null;
    try {
      const saved = JSON.parse(data);
      if (saved.gameOver) return null;
      if (saved.turn > 0 && saved.level) return saved;
    } catch (e) {}
    return null;
  }

  function clearSession(simulatorId) {
    storageRemove(`${simulatorId}_session`);
  }

  // ==========================================================================
  // SEÇÃO 17 — INIT — PONTO DE ENTRADA PÚBLICO  [NOVO V2]
  //
  // Função chamada pelo simulador específico. Orquestra:
  //   - Preload de cache
  //   - Aplicação de tema
  //   - Check de daily block
  //   - Restauração de sessão se aplicável
  //   - Configuração de event listeners no DOM do simulador
  //   - Estado inicial
  // ==========================================================================

  async function init(config) {
    if (!config || !config.id) {
      throw new Error('[ActiveIA] init: SIMULATOR_CONFIG inválido — campo "id" obrigatório');
    }

    console.log(`[ActiveIA] Core v${CORE_VERSION} inicializando simulador "${config.id}"`);

    // Pré-carrega cache do storage
    await preloadCache([
      `${config.id}_session`,
      `${config.id}_theme`,
      `${config.id}_daily`,
      `${config.id}_played_archetypes`
    ]);

    // Aplica tema
    initTheme(config.id);

    // Check daily block
    if (isDailyBlocked(config.id)) {
      // TODO: renderizar tela de daily block (depende de DOM do simulador)
      console.log('[ActiveIA] Daily block ativo');
      return;
    }

    // Restaura sessão se houver
    const savedSession = loadSession(config.id);
    if (savedSession) {
      console.log('[ActiveIA] Sessão anterior detectada, restaurando');
      // TODO: restaurar estado do simulador a partir de savedSession
      return;
    }

    // Boot normal — TODO: renderizar tutorial 1
    console.log('[ActiveIA] Boot fresh, tutorial inicial');
  }

  // ==========================================================================
  // EXPORT DO OBJETO PÚBLICO ActiveIA
  // ==========================================================================

  global.ActiveIA = {
    version: CORE_VERSION,
    init: init,

    // Funções utilitárias expostas (para debug e extensão)
    storage: { get: storageGet, set: storageSet, remove: storageRemove },
    parseJSON: parseJSON,
    callAPI: callAPI,

    // Motores (a serem implementados durante construção do primeiro simulador v2)
    archetype: { select: selectArchetype, recordPlayed: recordArchetypePlayed },
    branching: { buildContext: buildBranchingContext },
    articulation: { rulesPromptBlock: getArticulationRulesPromptBlock },
    termination: { check: checkEarlyTermination },
    diagnosis: { generate: generateFinalDiagnosis },
    history: { summarize: summarizeEarlyHistory },
    export: { html: exportSessionHTML, pdf: exportSessionPDF, linkedinCard: generateLinkedInCard, shareLinkedIn: shareToLinkedIn },

    // UI helpers
    ui: { showLoading, hideLoading, showError, hideError },

    // Daily block
    daily: { isBlocked: isDailyBlocked, markComplete: markDayComplete, getTimer: getDailyTimer },

    // Session
    session: { save: saveSession, load: loadSession, clear: clearSession }
  };

  console.log(`[ActiveIA] Core v${CORE_VERSION} carregado e pronto`);

})(typeof window !== 'undefined' ? window : globalThis);
