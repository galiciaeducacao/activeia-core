/**
 * ============================================================================
 * ACTIVE IA — CORE v1.2.6
 * ============================================================================
 *
 * Núcleo JavaScript compartilhado da fábrica Active IA da Galícia Educação.
 *
 * Hospedagem-alvo: https://galiciaeducacao.github.io/activeia-core/v1/core.js
 *
 * MUDANÇAS DA v1.2.5 PARA v1.2.6 (FEAT + correções de produto):
 *   - REDESIGN do card LinkedIn (Caminho A): voltou ao FUNDO CLARO com estética
 *     editorial, zero serif (Montserrat exclusivamente). Removido grid de 3
 *     métricas-headline e substituído por LISTA EM PROSA das competências
 *     demonstradas (puxadas de diagnosis.strengths). Sem pill de nível
 *     Júnior/Pleno/Sênior (desincentivava quem está em Júnior a postar).
 *     Bordão "Conhecer para decidir. Decidir para fazer diferença." em caixa
 *     de destaque visual. Selo "MAI-2026" simplificado no canto.
 *   - SELO PÚBLICO SIMPLIFICADO: getPublicSessionId() agora retorna apenas
 *     "MAI-2026" (sem hash). O hash anterior virava ruído sem agregar valor.
 *   - PROMPT LINKEDIN reescrito: estrutura obrigatória de 3 frases (desafio
 *     em linguagem acessível → como conduziu sucintamente → frase fixa da IA
 *     preservada). Proibido repetir contexto institucional do módulo/curso
 *     (já está na frase de abertura). Proibido jargão técnico denso (ABCD2,
 *     NASCET, etc.) — é peça de publicidade, não de avaliação.
 *   - NOVO: ActiveIA.export.fullReport(state, diagnosis, config) — gera HTML
 *     completo com: cabeçalho institucional, indicadores finais, mapa
 *     conceitual, pontos fortes/frágeis, recomendação, EVOLUÇÃO DOS
 *     INDICADORES TURNO A TURNO (tabela com mini-barras) e TRANSCRIPT
 *     COMPLETO (resposta do estudante + narrativa + feedback de cada turno).
 *     HTML auto-imprimível: botão interno "Salvar como PDF" chama
 *     window.print(), navegador converte nativamente.
 *
 * MUDANÇAS DA v1.2.4 PARA v1.2.5 (PATCH crítico de produto):
 *   - Stack do provedor de IA NUNCA exposto ao estudante. Badge fala
 *     "IA conectada". Modal de erro generaliza "serviços externos".
 *   - Indicadores de RISCO (initial > 0) com semântica própria — não sobem
 *     com respostas genéricas. PARTE 4 adicionada à Regra de Proporcionalidade.
 *
 * MUDANÇAS DA v1.2.3 PARA v1.2.4 (FEAT + editorial):
 *   - NOVO: ActiveIA.connection — módulo de status em tempo real.
 *   - NOVO: ActiveIA.errors — 5 kinds de erro com mensagens próprias.
 *   - NOVO: ActiveIA.ui.showErrorFromException + mountConnectionBadge.
 *   - NOVO: ActiveIA.session.publicId — selo "MAI-2026 · K7M9Z".
 *   - REDESIGN: generateLinkedInCard reescrito (Mockup 13).
 *   - TIPOGRAFIA: banido Playfair/Georgia/JetBrains Mono. Só Gotham/Montserrat.
 *
 * MUDANÇAS DA v1.2.2 PARA v1.2.3 (PATCH editorial):
 *   - VOCABULÁRIO: substituído "aluno/alunos/aluna" por "estudante" em TODOS
 *     os textos expostos ao usuário.
 *   - ESTRUTURA LinkedIn: nova abertura editorial firmada
 *     "Active IA do módulo em [disciplina] da Galícia Educação".
 *   - PROMPT LinkedIn: instrução explícita à IA para nunca usar "aluno".
 *
 * MUDANÇAS DA v1.2.1 PARA v1.2.2 (PATCH editorial):
 *   - CORREÇÃO: linkedinCaption agora fala em "módulo X do curso Y da Galícia",
 *     não mais "pós-graduação em Y".
 *   - CORREÇÃO: generateLinkedInCard renderiza disciplina sem identificador
 *     interno "— Módulo NN" no badge ao lado do nível.
 *
 * MUDANÇAS DA v1.2.0 PARA v1.2.1 (PATCH):
 *   - CORREÇÃO: checkEarlyTermination blinda Júnior incondicionalmente.
 *
 * MUDANÇAS DA v1.1.0 PARA v1.2.0:
 *   - NOVO: ActiveIA.export.linkedinCaption + shareLinkedInModal.
 *
 * MUDANÇAS DA v1.0.0 PARA v1.1.0:
 *   - NOVO: ActiveIA.modal + ActiveIA.consultant.
 *
 * Uso pelo simulador específico:
 *   <script src="https://.../v1/core.js"></script>
 *   <script>ActiveIA.init(SIMULATOR_CONFIG);</script>
 *
 * ============================================================================
 */

(function(global) {
  'use strict';

  // ==========================================================================
  // SEÇÃO 1 — CONSTANTES GLOBAIS
  // ==========================================================================

  const CORE_VERSION = '1.2.6';
  const API_URL = 'https://shy-night-916aactive-ai-proxy.galiciaeducacao.workers.dev';
  const MODEL = 'claude-sonnet-4-6';
  const MAX_TOKENS = 1800;
  const DB_NAME = 'activeia_db';

  const ARTICULATION_TOLERANCE = {
    junior: { earlyEnd: false },
    pleno:  { earlyEnd: true, trigger: 'two_generic_consecutive' },
    senior: { earlyEnd: true, trigger: 'two_weak_consecutive' }
  };

  // ==========================================================================
  // SEÇÃO 2 — PERSISTENT STORAGE (IndexedDB + localStorage + cookie)
  // ==========================================================================

  const _memCache = {};
  let _db = null;

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
  // SEÇÃO 3 — PARSER JSON ROBUSTO (5 estratégias)
  // ==========================================================================

  function parseJSON(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) {}
    const md = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (md) { try { return JSON.parse(md[1].trim()); } catch (e) {} }
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) { try { return JSON.parse(brace[0]); } catch (e) {} }
    if (brace) {
      let c = brace[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"')
        .replace(/[\x00-\x1F\x7F]/g, ' ');
      try { return JSON.parse(c); } catch (e) {}
    }
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
    console.warn('[ActiveIA] JSON parse failed. Raw:', text.substring(0, 400));
    return null;
  }

  // ==========================================================================
  // SEÇÃO 4 — CHAMADA À API COM PROMPT CACHING
  //
  // A v1.2.4 introduz classificação estruturada de erros. callAPI nunca lança
  // Error genérico — sempre lança um objeto com .kind, .message, .userMessage
  // e .recoverable, consumível por ActiveIA.errors.classify() e renderizado
  // pela UI em mensagens específicas que distinguem rede do estudante, IA
  // externa indisponível, JSON corrompido e técnico.
  // ==========================================================================

  async function callAPI({ systemFixed, systemDynamic, messages, maxTokens }) {
    const systemArray = [
      { type: 'text', text: systemFixed, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: systemDynamic || '' }
    ];

    // Verificação rápida de offline antes de tentar fetch
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      _connection.lastError = 'offline';
      _connection.lastApiOk = null;
      _notifyConnectionChange();
      throw _buildError('offline');
    }

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens || MAX_TOKENS,
          system: systemArray,
          messages: messages
        })
      });
    } catch (networkError) {
      // fetch rejeitou — sem rede, DNS, CORS, ou Worker totalmente fora
      _connection.lastError = 'network';
      _connection.lastApiOk = null;
      _notifyConnectionChange();
      throw _buildError('network', networkError.message);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      // 429/500/502/503/504 → IA externa indisponível
      // 401/403 → técnico (Worker mal configurado)
      // 400/422 → técnico (payload inválido)
      let kind;
      if ([429, 500, 502, 503, 504, 529].includes(response.status)) {
        kind = 'ai_unavailable';
      } else if ([401, 403].includes(response.status)) {
        kind = 'technical';
      } else {
        kind = 'technical';
      }
      _connection.lastError = kind;
      _connection.lastApiOk = null;
      _notifyConnectionChange();
      throw _buildError(kind, `${response.status} ${response.statusText} — ${errBody.substring(0, 200)}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      _connection.lastError = 'bad_response';
      _connection.lastApiOk = null;
      _notifyConnectionChange();
      throw _buildError('bad_response', 'Resposta HTTP não era JSON válido');
    }

    if (data.usage && data.usage.cache_read_input_tokens > 0) {
      console.log(`[ActiveIA] Cache hit: ${data.usage.cache_read_input_tokens} tokens lidos`);
    }

    const textBlock = data.content && data.content.find(c => c.type === 'text');
    if (!textBlock) {
      _connection.lastError = 'bad_response';
      _connection.lastApiOk = null;
      _notifyConnectionChange();
      throw _buildError('bad_response', 'Resposta da IA veio sem bloco de texto');
    }

    // Sucesso — limpa estado de erro
    _connection.lastError = null;
    _connection.lastApiOk = Date.now();
    _connection.lastApiLatencyMs = null; // pode ser preenchido se quisermos cronometrar
    _notifyConnectionChange();

    const parsed = parseJSON(textBlock.text);
    return { parsed, rawText: textBlock.text, usage: data.usage };
  }

  // ==========================================================================
  // SEÇÃO 4B — CONEXÃO E ERROS (v1.2.4)
  //
  // O simulador é um ambiente online em tempo real. O estudante precisa
  // perceber isso. E quando algo falhar, ele precisa saber:
  //   (a) se é problema do ambiente dele (sem rede)
  //   (b) se é o provedor de IA externo (raro, mas acontece)
  //   (c) se é técnico (raro — recarregar)
  // A Galícia opera dentro de uma cadeia de dependências externas; isso é
  // explicitado de forma educada nas mensagens.
  // ==========================================================================

  const _connection = {
    lastApiOk: null,        // timestamp da última chamada bem-sucedida
    lastError: null,        // 'offline' | 'network' | 'ai_unavailable' | 'bad_response' | 'technical' | null
    listeners: []           // funções para notificar mudanças de estado
  };

  function _notifyConnectionChange() {
    _connection.listeners.forEach(fn => {
      try { fn(getConnectionStatus()); } catch (e) { console.error('[ActiveIA] connection listener error', e); }
    });
  }

  function getConnectionStatus() {
    const isOnline = (typeof navigator !== 'undefined') ? navigator.onLine !== false : true;
    let state;
    if (!isOnline) state = 'offline';
    else if (_connection.lastError) state = 'error';
    else if (_connection.lastApiOk) state = 'ok';
    else state = 'idle'; // ainda não fez nenhuma chamada
    return {
      state,
      isOnline,
      lastApiOk: _connection.lastApiOk,
      lastError: _connection.lastError
    };
  }

  function onConnectionChange(fn) {
    _connection.listeners.push(fn);
    return () => {
      const idx = _connection.listeners.indexOf(fn);
      if (idx >= 0) _connection.listeners.splice(idx, 1);
    };
  }

  // Listeners globais de online/offline do navegador
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { _notifyConnectionChange(); });
    window.addEventListener('offline', () => { _notifyConnectionChange(); });
  }

  // Cada kind de erro tem mensagem específica para o estudante e flag de recuperabilidade
  const ERROR_MESSAGES = {
    offline: {
      title: 'Você está sem conexão',
      message: 'Verifique sua internet e tente novamente. O Active IA precisa de conexão ativa porque a IA avalia suas decisões em tempo real.',
      explainer: 'Sua sessão fica salva localmente — quando a conexão voltar, ela retoma exatamente de onde parou.',
      recoverable: true,
      cta: 'Tentar novamente'
    },
    network: {
      title: 'Falha de conexão',
      message: 'Não foi possível alcançar o serviço de IA. Pode ser sua rede, um bloqueio de firewall, ou instabilidade temporária.',
      explainer: 'Sua sessão fica salva localmente. Tente novamente em alguns segundos — o jogo retoma de onde parou.',
      recoverable: true,
      cta: 'Tentar novamente'
    },
    ai_unavailable: {
      title: 'Serviço de IA temporariamente indisponível',
      message: 'A inteligência artificial que avalia suas decisões está fora do ar neste momento. Isso é raro, mas acontece.',
      explainer: 'O Active IA depende de serviços de inteligência artificial em tempo real para avaliar suas respostas. Quedas momentâneas desses serviços externos estão fora do controle direto da Galícia Educação. Sua sessão fica salva — tente novamente em alguns minutos.',
      recoverable: true,
      cta: 'Tentar novamente'
    },
    bad_response: {
      title: 'Resposta inesperada da IA',
      message: 'A IA respondeu, mas em formato que não conseguimos interpretar. Pode ser flutuação momentânea do modelo.',
      explainer: 'Sua sessão fica salva. Tentar novamente costuma resolver — o modelo gera uma resposta nova.',
      recoverable: true,
      cta: 'Tentar novamente'
    },
    technical: {
      title: 'Problema técnico momentâneo',
      message: 'Houve um erro técnico ao processar sua solicitação.',
      explainer: 'Se persistir após tentar novamente, recarregue a página — sua sessão fica salva localmente.',
      recoverable: true,
      cta: 'Tentar novamente'
    }
  };

  function _buildError(kind, technicalDetail) {
    const spec = ERROR_MESSAGES[kind] || ERROR_MESSAGES.technical;
    const err = new Error(`[${kind}] ${spec.title} — ${technicalDetail || ''}`);
    err.kind = kind;
    err.userTitle = spec.title;
    err.userMessage = spec.message;
    err.userExplainer = spec.explainer;
    err.recoverable = spec.recoverable;
    err.cta = spec.cta;
    err.technicalDetail = technicalDetail || '';
    return err;
  }

  function classifyError(error) {
    // Se já é um erro classificado, retorna ele
    if (error && error.kind && ERROR_MESSAGES[error.kind]) {
      return {
        kind: error.kind,
        title: error.userTitle,
        message: error.userMessage,
        explainer: error.userExplainer,
        recoverable: error.recoverable,
        cta: error.cta,
        technicalDetail: error.technicalDetail
      };
    }
    // Erro desconhecido — classifica como técnico
    const spec = ERROR_MESSAGES.technical;
    return {
      kind: 'technical',
      title: spec.title,
      message: spec.message,
      explainer: spec.explainer,
      recoverable: spec.recoverable,
      cta: spec.cta,
      technicalDetail: error && error.message ? error.message : 'Erro desconhecido'
    };
  }

  // ==========================================================================
  // SEÇÃO 5 — MOTOR DE ARQUÉTIPOS
  // ==========================================================================

  function selectArchetype(config) {
    const playedKey = `${config.id}_played_archetypes`;
    let played = [];
    try { played = JSON.parse(storageGet(playedKey) || '[]'); } catch (e) { played = []; }

    const available = config.archetypes.filter(a => !played.includes(a.id));

    let selected, isRevisit = false;
    if (available.length > 0) {
      selected = available[Math.floor(Math.random() * available.length)];
    } else {
      selected = config.archetypes[Math.floor(Math.random() * config.archetypes.length)];
      isRevisit = true;
    }

    return { archetype: selected, isRevisit, playedCount: played.length, totalCount: config.archetypes.length };
  }

  function recordArchetypePlayed(simulatorId, archetypeId) {
    const playedKey = `${simulatorId}_played_archetypes`;
    let played = [];
    try { played = JSON.parse(storageGet(playedKey) || '[]'); } catch (e) { played = []; }
    if (!played.includes(archetypeId)) {
      played.push(archetypeId);
      storageSet(playedKey, JSON.stringify(played));
    }
  }

  // ==========================================================================
  // SEÇÃO 6 — MOTOR DE RAMIFICAÇÃO NARRATIVA
  // ==========================================================================

  function buildBranchingContext(caseState, level) {
    if (!caseState) return '';

    const intensityByLevel = {
      junior: 'RAMIFICAÇÃO LEVE. Mantenha coerência. Desfecho geral é o mesmo, com pequenas variações conforme caminho do estudante.',
      pleno:  'RAMIFICAÇÃO MODERADA. Desfechos efetivamente distintos conforme raciocínio. Caminho mais raso leva a desfecho funcionalmente pior.',
      senior: 'RAMIFICAÇÃO DENSA. Rota errada pode ser irrecuperável, com aprendizado embutido no encerramento. Coerência rígida com estado.'
    };

    const decisions = (caseState.key_decisions_taken || []).join(' · ') || '—';
    const identified = (caseState.key_signals_identified || []).join(' · ') || '—';
    const missed = (caseState.key_signals_missed || []).join(' · ') || '—';

    return `
ESTADO DO CASO ATUAL (mantenha coerência rígida com os campos abaixo):
- Hipótese dominante construída pelo estudante: ${caseState.dominant_hypothesis || 'ainda em formação'}
- Decisões-chave já tomadas: ${decisions}
- Sinais identificados pelo estudante: ${identified}
- Sinais relevantes ainda NÃO investigados: ${missed}
- Posição no banco de ramificações: ${caseState.branch_position || 'inicial'}

REGRA DE COERÊNCIA: evolua o caso na direção compatível com a hipótese dominante e a posição de ramificação registrada. Não introduza informações que contradigam sinais já identificados sem justificativa profissional explícita.

INTENSIDADE DA RAMIFICAÇÃO (nível ${level}): ${intensityByLevel[level] || intensityByLevel.pleno}
`;
  }

  // ==========================================================================
  // SEÇÃO 7 — MOTOR DE AVALIAÇÃO POR ARTICULAÇÃO
  // (Regra de Proporcionalidade — Lição #15)
  // ==========================================================================

  function getArticulationRulesPromptBlock() {
    return `
═══════════════════════════════════════════════════════════════
REGRA DE PROPORCIONALIDADE — REGRA MAIS IMPORTANTE DESTE SIMULADOR
(precedência absoluta sobre qualquer outra orientação)
═══════════════════════════════════════════════════════════════

PARTE 1 — PROTOCOLO DE TRADUÇÃO LITERAL DA RESPOSTA DO ESTUDANTE

Antes de produzir qualquer narrativa, classifique INTERNAMENTE a resposta do estudante em uma destas três categorias:

(a) GENÉRICA — apenas nomeia categoria, instrumento ou intenção, sem especificar eixos, hipóteses, justificativa teórica ou método. Exemplos: "vou fazer anamnese", "peço exames", "vou negociar com o cliente", "fundamento na teoria", "encaminho para especialista".

(b) PARCIAL — nomeia 1 ou 2 eixos concretos COM especificidade, mas deixa outros eixos relevantes para o domínio em aberto.

(c) BEM ARTICULADA — lista eixos concretos cobrindo o quê (eixo/instrumento específico), o por quê (justificativa teórica ou clínica) e o como (método, ordem, critério).

ESSA CLASSIFICAÇÃO TEM CONSEQUÊNCIAS RÍGIDAS:

| Classificação    | Narrativa                                  | Indicadores no turno          |
|------------------|--------------------------------------------|-------------------------------|
| Genérica         | Revela APENAS o mínimo absoluto da cena.   | 10-20% do máximo do turno     |
| Parcial          | Revela APENAS os eixos explicitados.       | 40-60% do máximo do turno     |
| Bem articulada   | Revela tudo que foi explicitamente pedido. | 70-100% do máximo do turno    |

EXEMPLO CRÍTICO: se o estudante escreveu apenas "vou pedir exames", a IA NÃO entrega nenhum resultado de exame. A IA pergunta de volta, na voz do colega/residente/interlocutor da cena: "Quais exames, em que ordem, com que objetivo?". Indicadores recebem entre 10 e 20% do máximo do turno. O feedback abre nomeando literalmente "vou pedir exames" e caracterizando como genérico.

PARTE 2 — FORMATO OBRIGATÓRIO DO FEEDBACK PEDAGÓGICO

O parágrafo "📝 Feedback:" ao final da narrativa SEMPRE:
1. Começa nomeando literalmente o que o estudante escreveu (entre aspas, ou parafrase fiel).
2. Caracteriza a especificidade da resposta como genérica, parcial ou bem articulada.
3. Lista o que foi de fato coberto pelo estudante (mesmo que pouco).
4. Lista o que ficou de fora e deveria ter aparecido.
5. Orienta o próximo turno.

EXEMPLOS DE FRASES PROIBIDAS:
- "Você conduziu a avaliação de forma estruturada e completa..." (quando o estudante só escreveu "vou avaliar")
- "Excelente articulação clínica..." (sem ter de fato havido articulação)
- Qualquer elogio que não corresponda ao que está LITERALMENTE no texto do estudante.

PARTE 3 — PEDAGOGIA DA ESPECIFICIDADE

A IA NUNCA completa pelo estudante. Se o estudante omitiu eixo importante, esse eixo permanece omitido até o estudante EXPLICITAMENTE mobilizá-lo. A IA não infere boa intenção e não preenche lacunas. O estudante articula ou não articula. O simulador é diagnóstico, não compensatório.

PARTE 4 — INDICADORES DE RISCO TÊM SEMÂNTICA DIFERENTE

Alguns indicadores do simulador são INDICADORES DE RISCO, não de desempenho. São identificáveis porque começam com valor INICIAL DIFERENTE DE ZERO (geralmente 50). Exemplos comuns: "Segurança do Paciente", "Segurança do Cliente", "Risco Reputacional", "Risco Operacional", "Risco Legal", "Integridade da Decisão".

REGRA DOS INDICADORES DE RISCO (precedência sobre a tabela acima):

| Situação do turno                                              | O que acontece com o indicador de risco                            |
|----------------------------------------------------------------|--------------------------------------------------------------------|
| Resposta GENÉRICA que não decide nada perigoso                 | Permanece IGUAL ao valor anterior. Não sobe, não desce.            |
| Resposta GENÉRICA que ignora um sinal de alarme já apresentado | DESCE entre 5 e 15 pontos. A omissão tem custo.                    |
| Resposta PARCIAL que articula uma decisão segura               | Sobe entre 3 e 8 pontos. Pequeno reforço.                          |
| Resposta PARCIAL que toma uma decisão arriscada                | DESCE entre 10 e 25 pontos.                                        |
| Resposta BEM ARTICULADA com decisão claramente segura          | Sobe entre 5 e 15 pontos.                                          |
| Decisão que excede escopo profissional / coloca alguém em risco| DESCE entre 25 e 50 pontos (penalização forte).                    |
| Encaminhamento correto / escalada para emergência / contraindicação reconhecida | Sobe entre 10 e 20 pontos.                          |

Indicadores de risco NUNCA seguem a faixa 10-20% / 40-60% / 70-100% da Parte 1. Eles seguem a tabela acima.

REGRA-CHAVE: um indicador de risco JAMAIS sobe simplesmente porque o estudante "se esforçou em escrever algo". Ele sobe quando uma decisão ATIVAMENTE PROTETIVA é tomada — encaminhar, escalar, contraindicar, comunicar risco ao paciente/cliente, recusar conduta inadequada. Ele desce quando uma decisão arriscada é tomada, quando um sinal de alarme é ignorado, ou quando o escopo profissional é violado. Em ausência de qualquer um desses, fica parado.

EXEMPLO CRÍTICO: se o estudante escreveu "vou pedir exames" em fase de investigação, e há um sinal de alarme já apresentado na cena que ele não menciona, Segurança do Paciente DESCE (a omissão tem custo). Se a cena ainda não apresentou nenhum risco específico, Segurança permanece IGUAL. Em nenhum caso Segurança sobe quando o estudante apenas nomeia o instrumento sem decidir.

CLASSIFICAÇÃO INTERNA (incluir no JSON de resposta):
"articulation_class": "generica" | "parcial" | "articulada"
═══════════════════════════════════════════════════════════════
`;
  }

  // ==========================================================================
  // SEÇÃO 8 — MOTOR DE ENCERRAMENTO ANTECIPADO
  // ==========================================================================

  function checkEarlyTermination(level, articulationHistory, currentTurn, indicators, config) {
    const tolerance = ARTICULATION_TOLERANCE[level];
    const turnsConfig = config.levels[level];

    // ========================================================================
    // BLINDAGEM JÚNIOR (regra dura do HANDOFF — não reabrir)
    // ========================================================================
    // Júnior NUNCA encerra antecipadamente. A simulação só termina quando
    // chega ao último turno definido em LEVEL_CONFIG. Esta regra existe
    // porque o Júnior é o nível de entrada, e encerrar antecipadamente
    // frustra alunos iniciantes que ainda estão calibrando articulação.
    // Hard fail global, encerramento por articulação genérica, qualquer
    // game_over vindo da IA — TUDO É IGNORADO no Júnior.
    if (level === 'junior') {
      return { terminate: false };
    }

    // Regra 1 — encerramento por articulação (Pleno/Sênior)
    if (tolerance.earlyEnd && articulationHistory.length >= 2) {
      const last2 = articulationHistory.slice(-2);
      if (tolerance.trigger === 'two_generic_consecutive') {
        if (last2.every(c => c === 'generica')) {
          return {
            terminate: true,
            reason: 'articulation_pleno',
            recommendation: 'voltar_junior',
            message: 'Dois turnos consecutivos com articulação genérica no nível Pleno. O simulador recomenda revisitar o nível Júnior antes de retornar.'
          };
        }
      }
      if (tolerance.trigger === 'two_weak_consecutive') {
        if (last2.every(c => c === 'generica' || c === 'parcial')) {
          return {
            terminate: true,
            reason: 'articulation_senior',
            recommendation: 'voltar_pleno',
            message: 'Dois turnos consecutivos com articulação insuficiente para o nível Sênior. O simulador recomenda amadurecer no Pleno antes de retornar.'
          };
        }
      }
    }

    // Regra 2 — hard fail global (a partir do turno 3, APENAS Pleno/Sênior)
    if (currentTurn >= 3) {
      const totalIndicators = Object.values(indicators).reduce((a, b) => a + b, 0);
      const proportion = currentTurn / turnsConfig.turns;
      const maxIfPerfect = config.indicators.reduce((acc, ind) => acc + ind.max, 0) * proportion;
      if (totalIndicators < maxIfPerfect * 0.25) {
        return {
          terminate: true,
          reason: 'hard_fail',
          recommendation: 'revisao_completa',
          message: 'Desempenho insuficiente em múltiplos indicadores. O simulador recomenda revisão do material do módulo antes de uma nova tentativa.'
        };
      }
    }

    return { terminate: false };
  }

  // ==========================================================================
  // SEÇÃO 9 — MOTOR DE DIAGNÓSTICO FINAL EM TRÊS CAMADAS
  // ==========================================================================

  async function generateFinalDiagnosis(state, config) {
    const conceptsList = config.concepts.map(c => `- ${c.id}: ${c.name} (${c.module_ref})`).join('\n');

    const historySummary = state.turnLog.map((t, i) => {
      return `TURNO ${i + 1} (fase ${t.phase || '?'}, articulação ${t.articulation_class || '?'})
Resposta do estudante: "${(t.userResponse || '').substring(0, 500)}"
Sinais identificados: ${(t.case_state?.key_signals_identified || []).join(', ') || '—'}
Decisões: ${(t.case_state?.key_decisions_taken || []).join(', ') || '—'}`;
    }).join('\n\n');

    const finalIndicators = state.indicators;
    const articulationProfile = state.articulationHistory.join(' → ');

    const userMsg = `Analise a sessão completa do estudante abaixo e produza diagnóstico final estruturado.

ARQUÉTIPO JOGADO: ${state.archetypeId}
NÍVEL: ${state.level}
TURNOS COMPLETADOS: ${state.turnLog.length} de ${config.levels[state.level].turns}
ENCERRAMENTO: ${state.earlyTermination ? state.earlyTermination.reason : 'completou'}

INDICADORES FINAIS:
${config.indicators.map(i => `- ${i.name}: ${finalIndicators[i.id] || 0} / ${i.max}`).join('\n')}

PERFIL DE ARTICULAÇÃO TURNO A TURNO: ${articulationProfile}

HISTÓRICO DOS TURNOS:
${historySummary}

CONCEITOS DO MÓDULO A AVALIAR (todos devem aparecer no concept_map):
${conceptsList}

PRODUZA JSON RIGOROSAMENTE NO FORMATO ABAIXO. Sem texto antes ou depois. Apenas o JSON.

{
  "concept_map": {
    "<concept_id>": "dominado" | "parcial" | "fragil" | "nao_demonstrado"
  },
  "concept_justifications": {
    "<concept_id>": "Frase explicando por que essa classificação, com referência ao turno (ex.: 'No turno 3 articulou ASPECTS corretamente'). Para 'nao_demonstrado', explique que o caso não dava oportunidade clara."
  },
  "strengths": [
    { "turn": N, "description": "Frase específica e concreta sobre o que o estudante fez bem, citando literalmente o que articulou." }
  ],
  "weaknesses": [
    { "turn": N, "description": "Frase específica sobre o que faltou nesse turno. Termine com 'Reveja: <referência específica ao módulo>.'" }
  ],
  "next_step_recommendation": {
    "action": "subir_nivel" | "repetir_nivel" | "voltar_nivel" | "revisar_modulo",
    "rationale": "Mensagem clara e direta ao estudante explicando a recomendação, em 2-3 frases."
  },
  "headline_metric": "Frase curta para o card LinkedIn, ex.: '12 de 15 conceitos do módulo dominados'"
}`;

    const result = await callAPI({
      systemFixed: config.reference_content + '\n\n' + getArticulationRulesPromptBlock(),
      systemDynamic: 'Modo: análise final de sessão completa para produzir diagnóstico estruturado.',
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 3000
    });

    return result.parsed;
  }

  // ==========================================================================
  // SEÇÃO 10 — RESUMO CUMULATIVO DE HISTORY
  // ==========================================================================

  function summarizeEarlyHistory(turnLog, currentTurn) {
    if (currentTurn < 3 || turnLog.length < 2) {
      return { summary: null, recentTurns: turnLog };
    }

    const earlyTurns = turnLog.slice(0, -2);
    const recentTurns = turnLog.slice(-2);

    if (earlyTurns.length === 0) {
      return { summary: null, recentTurns: turnLog };
    }

    const lines = earlyTurns.map((t, i) => {
      const decisions = (t.case_state?.key_decisions_taken || []).slice(-2).join(' · ') || '—';
      const signals = (t.case_state?.key_signals_identified || []).slice(-2).join(' · ') || '—';
      return `T${i + 1} [${t.phase}, ${t.articulation_class}]: decisões=${decisions} · sinais=${signals}`;
    });

    return {
      summary: `RESUMO DOS TURNOS ANTERIORES (compacto):\n${lines.join('\n')}`,
      recentTurns
    };
  }

  // ==========================================================================
  // SEÇÃO 11 — EXPORT HTML / PDF (via print)
  // ==========================================================================

  function buildDashboardHTML(state, diagnosis, config) {
    const conceptRows = config.concepts.map(c => {
      const cls = (diagnosis.concept_map && diagnosis.concept_map[c.id]) || 'nao_demonstrado';
      const just = (diagnosis.concept_justifications && diagnosis.concept_justifications[c.id]) || '';
      const labels = {
        dominado: { label: 'Dominado', color: '#1D9E75' },
        parcial: { label: 'Parcial', color: '#BA7517' },
        fragil: { label: 'Frágil', color: '#A32D2D' },
        nao_demonstrado: { label: 'Não demonstrado', color: '#94a3b8' }
      };
      const meta = labels[cls] || labels.nao_demonstrado;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;">${c.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:11px;font-family:'Montserrat',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:0.5px;color:#475569;">${c.module_ref}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:11px;"><span style="background:${meta.color}22;color:${meta.color};padding:3px 10px;border-radius:6px;font-weight:600;">${meta.label}</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#475569;">${just}</td>
      </tr>`;
    }).join('');

    const strengths = (diagnosis.strengths || []).map(s =>
      `<li style="margin-bottom:10px;font-size:13px;line-height:1.6;"><strong style="color:#0F6E56;font-family:'Montserrat',sans-serif;font-weight:600;letter-spacing:1.2px;font-size:11px;">TURNO ${s.turn}</strong><br>${s.description}</li>`
    ).join('');

    const weaknesses = (diagnosis.weaknesses || []).map(w =>
      `<li style="margin-bottom:10px;font-size:13px;line-height:1.6;"><strong style="color:#A32D2D;font-family:'Montserrat',sans-serif;font-weight:600;letter-spacing:1.2px;font-size:11px;">TURNO ${w.turn}</strong><br>${w.description}</li>`
    ).join('');

    const indicatorsHTML = config.indicators.map(ind => {
      const v = state.indicators[ind.id] || 0;
      const pct = Math.round((v / ind.max) * 100);
      return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;">
          <span style="color:#475569;">${ind.name}</span>
          <span style="font-family:'Montserrat',sans-serif;font-variant-numeric:tabular-nums;font-weight:600;color:#0a1628;">${v} / ${ind.max}</span>
        </div>
        <div style="height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#0074C7;border-radius:3px;"></div>
        </div>
      </div>`;
    }).join('');

    const recAction = (diagnosis.next_step_recommendation && diagnosis.next_step_recommendation.action) || 'repetir_nivel';
    const recRationale = (diagnosis.next_step_recommendation && diagnosis.next_step_recommendation.rationale) || '';
    const recLabels = {
      subir_nivel: { label: 'Avançar para o próximo nível', color: '#0F6E56' },
      repetir_nivel: { label: 'Repetir este nível em um novo caso', color: '#185FA5' },
      voltar_nivel: { label: 'Voltar ao nível anterior', color: '#BA7517' },
      revisar_modulo: { label: 'Revisar o material do módulo', color: '#A32D2D' }
    };
    const recMeta = recLabels[recAction] || recLabels.repetir_nivel;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Diagnóstico — ${config.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&display=swap" rel="stylesheet">
<style>
  @media print { body { background:#fff !important; } .no-print { display:none !important; } }
  body { font-family:'Gotham','Montserrat',system-ui,-apple-system,sans-serif; background:#FAF7F2; margin:0; padding:32px; color:#0a1628; -webkit-font-smoothing:antialiased; }
  .container { max-width:880px; margin:0 auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  h1 { font-family:inherit; font-weight:800; font-size:30px; letter-spacing:-0.02em; line-height:1.15; margin:0 0 4px; color:#0a1628; }
  h1 em { font-style:italic; font-weight:800; color:#0074C7; }
  h2 { font-family:inherit; font-weight:700; font-size:18px; letter-spacing:-0.01em; margin:32px 0 12px; color:#0a1628; border-bottom:2px solid #0074C7; padding-bottom:6px; }
  .meta { font-family:inherit; font-weight:600; font-size:11px; color:#475569; letter-spacing:2px; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; }
  ul { padding-left:0; list-style:none; }
</style>
</head>
<body>
<div class="container">
  <div style="border-bottom:1px solid #E2E8F0; padding-bottom:16px; margin-bottom:20px;">
    <div class="meta">DIAGNÓSTICO DE SESSÃO · ACTIVE IA</div>
    <h1>${config.name}</h1>
    <div style="font-size:13px;color:#475569;margin-top:4px;">Estudante: <strong>${state.userName || '—'}</strong> · Nível: ${config.levels[state.level].label} · ${new Date(state.completedAt || Date.now()).toLocaleString('pt-BR')}</div>
  </div>

  <h2>Indicadores finais</h2>
  ${indicatorsHTML}

  <h2>Mapa de domínio conceitual</h2>
  <table>
    <thead><tr><th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #0a1628;">Conceito</th><th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #0a1628;">Referência</th><th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #0a1628;">Estado</th><th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #0a1628;">Justificativa</th></tr></thead>
    <tbody>${conceptRows}</tbody>
  </table>

  <h2>Pontos fortes</h2>
  <ul>${strengths || '<li style="font-size:13px;color:#475569;font-style:italic;">Nenhum ponto forte de destaque foi identificado nesta sessão.</li>'}</ul>

  <h2>Pontos a revisitar</h2>
  <ul>${weaknesses || '<li style="font-size:13px;color:#475569;font-style:italic;">Nenhum ponto crítico foi identificado nesta sessão.</li>'}</ul>

  <h2>Recomendação de próximo passo</h2>
  <div style="background:${recMeta.color}11; border-left:4px solid ${recMeta.color}; padding:16px 20px; border-radius:6px;">
    <div style="font-weight:600; font-size:15px; color:${recMeta.color}; margin-bottom:6px;">${recMeta.label}</div>
    <div style="font-size:13px; line-height:1.6; color:#0a1628;">${recRationale}</div>
  </div>

  <div style="margin-top:40px; padding-top:16px; border-top:1px solid #E2E8F0; font-size:11px; color:#94a3b8; text-align:center;">
    Conteúdo gerado pela metodologia Active IA — Galícia Educação · Core v${CORE_VERSION}
  </div>
</div>
</body>
</html>`;
  }

  function exportSessionHTML(state, diagnosis, config) {
    const html = buildDashboardHTML(state, diagnosis, config);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostico-${config.id}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Constrói HTML completo com transcript da sessão + evolução de indicadores
   * turno a turno. Inclui tudo do dashboard (indicadores, mapa conceitual,
   * pontos fortes/frágeis, recomendação) MAIS:
   *   - Tabela de evolução dos indicadores por turno (com mini-barra por valor)
   *   - Transcript completo turno a turno (resposta do estudante + narrativa
   *     da IA + feedback + indicadores ao final daquele turno)
   *
   * É HTML auto-imprimível: o estudante pode usar Ctrl+P → "Salvar como PDF"
   * direto no navegador. Estilo @media print fica limpo (sem botões, fundo branco).
   *
   * @param {Object} state - appState (com state.turnLog populado)
   * @param {Object} diagnosis - estrutura retornada por generateFinalDiagnosis
   * @param {Object} config - SIMULATOR_CONFIG
   * @returns {string} HTML standalone
   */
  function buildFullReportHTML(state, diagnosis, config) {
    const turnLog = state.turnLog || [];

    // Evolução dos indicadores turno a turno (tabela)
    const indicatorsEvolutionHTML = (() => {
      if (turnLog.length === 0) return '<p style="font-size:13px;color:#475569;font-style:italic;">Nenhum turno foi registrado.</p>';
      const indicatorsList = config.indicators;
      const headerCells = ['<th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #0a1628;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Turno</th>']
        .concat(indicatorsList.map(i => `<th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #0a1628;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${i.name}</th>`))
        .join('');
      const rows = turnLog.map((t, idx) => {
        const turnIndicators = t.indicators_snapshot || t.indicators || {};
        const cells = [`<td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:600;color:#0a1628;">${idx + 1}</td>`]
          .concat(indicatorsList.map(i => {
            const v = turnIndicators[i.id] !== undefined ? turnIndicators[i.id] : 0;
            const pct = Math.round((v / i.max) * 100);
            return `<td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-variant-numeric:tabular-nums;font-weight:600;color:#0a1628;min-width:34px;">${Math.round(v)}</span>
                <div style="flex:1;max-width:120px;height:4px;background:#E2E8F0;border-radius:2px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:#0074C7;"></div>
                </div>
              </div>
            </td>`;
          }))
          .join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    })();

    // Transcript completo turno a turno
    const transcriptHTML = turnLog.map((t, idx) => {
      const turnNumber = idx + 1;
      const articulationLabel = {
        articulada: { label: 'Articulação plena', color: '#1D9E75' },
        parcial: { label: 'Articulação parcial', color: '#BA7517' },
        generica: { label: 'Articulação genérica', color: '#A32D2D' }
      };
      const artMeta = articulationLabel[t.articulation_class] || { label: '—', color: '#94a3b8' };

      const userResponseHTML = t.userResponse
        ? `<div style="margin-bottom:14px;">
            <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0074C7;margin-bottom:6px;">Sua resposta</div>
            <div style="padding:14px 16px;background:#E8F4FF;border-left:3px solid #0074C7;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;white-space:pre-wrap;">${escapeHTML(t.userResponse)}</div>
          </div>`
        : '<div style="margin-bottom:14px;font-size:12px;color:#94a3b8;font-style:italic;">(Turno de abertura — sem resposta do estudante.)</div>';

      const narrativeHTML = t.assistantNarrative
        ? `<div style="margin-bottom:14px;">
            <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#475569;margin-bottom:6px;">O que aconteceu</div>
            <div style="padding:14px 16px;background:#FAF7F2;border-left:3px solid #94a3b8;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;white-space:pre-wrap;">${escapeHTML(t.assistantNarrative)}</div>
          </div>`
        : '';

      const feedbackHTML = t.feedback
        ? `<div style="margin-bottom:14px;">
            <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0F6E56;margin-bottom:6px;">Avaliação da IA</div>
            <div style="padding:14px 16px;background:#E6F4EC;border-left:3px solid #1D9E75;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;white-space:pre-wrap;">${escapeHTML(t.feedback)}</div>
          </div>`
        : '';

      return `<div style="margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid #E2E8F0;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
          <h3 style="font-family:inherit;font-weight:800;font-size:22px;letter-spacing:-0.02em;color:#0a1628;margin:0;">Turno ${String(turnNumber).padStart(2, '0')}</h3>
          ${t.articulation_class ? `<span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${artMeta.color};">${artMeta.label}</span>` : ''}
        </div>
        ${userResponseHTML}
        ${narrativeHTML}
        ${feedbackHTML}
      </div>`;
    }).join('');

    // Reaproveita os blocos do dashboard
    const dashboardHTML = buildDashboardHTML(state, diagnosis, config);
    // Extrai apenas o conteúdo do <body> do dashboard pra reaproveitar
    const bodyMatch = dashboardHTML.match(/<body>([\s\S]*)<\/body>/);
    const dashboardBody = bodyMatch ? bodyMatch[1] : '';

    // Injeta as 2 novas seções ANTES do "<div style="margin-top:40px..." (rodapé)
    // do dashboard
    const sessionId = getPublicSessionId(state);
    const moduleDiscipline = (config.module || '').replace(/—.*$/, '').trim();
    const newSectionsHTML = `
      <h2>Evolução dos indicadores turno a turno</h2>
      <p style="font-size:13px;color:#475569;margin:-6px 0 14px;">Como cada indicador se moveu ao longo da sessão. Permite ver onde houve crescimento, estabilidade ou queda.</p>
      ${indicatorsEvolutionHTML}

      <h2>Transcript completo da sessão</h2>
      <p style="font-size:13px;color:#475569;margin:-6px 0 20px;">Cada turno: sua resposta, o que aconteceu na cena, e a avaliação da IA. Documento de leitura e estudo.</p>
      ${transcriptHTML || '<p style="font-size:13px;color:#475569;font-style:italic;">Nenhum turno foi registrado.</p>'}
    `;

    // Injeta as novas seções logo após "Recomendação de próximo passo" (antes do rodapé)
    const enhancedBody = dashboardBody.replace(
      /(<div style="margin-top:40px;[\s\S]*?<\/div>\s*)$/,
      newSectionsHTML + '$1'
    );

    // Constrói HTML final, herdando o <head> e estilos do dashboard mas com cabeçalho ampliado
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório completo — ${config.name} — ${state.userName || 'Estudante'}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&display=swap" rel="stylesheet">
<style>
  @media print {
    body { background:#fff !important; }
    .no-print { display:none !important; }
    h2 { page-break-after:avoid; }
    h3 { page-break-after:avoid; }
  }
  body { font-family:'Gotham','Montserrat',system-ui,-apple-system,sans-serif; background:#FAF7F2; margin:0; padding:32px; color:#0a1628; -webkit-font-smoothing:antialiased; }
  .container { max-width:900px; margin:0 auto; background:#fff; border-radius:12px; padding:48px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  h1 { font-family:inherit; font-weight:800; font-size:34px; letter-spacing:-0.025em; line-height:1.15; margin:0 0 4px; color:#0a1628; }
  h1 em { font-style:italic; font-weight:800; color:#0074C7; }
  h2 { font-family:inherit; font-weight:700; font-size:19px; letter-spacing:-0.01em; margin:36px 0 14px; color:#0a1628; border-bottom:2px solid #0074C7; padding-bottom:6px; }
  h3 { font-family:inherit; }
  .meta { font-family:inherit; font-weight:600; font-size:11px; color:#475569; letter-spacing:2px; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; }
  ul { padding-left:0; list-style:none; }
  .print-btn { position:fixed; top:24px; right:24px; background:#0074C7; color:#fff; padding:10px 18px; border-radius:8px; font-family:inherit; font-weight:600; font-size:13px; letter-spacing:0.5px; border:none; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.15); }
  .print-btn:hover { background:#005a9e; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">📄 Salvar como PDF</button>
<div class="container">
  <div style="border-bottom:1px solid #E2E8F0; padding-bottom:20px; margin-bottom:24px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:14px;flex-wrap:wrap;">
      <div class="meta">RELATÓRIO COMPLETO · ACTIVE IA · GALÍCIA EDUCAÇÃO</div>
      <div style="text-align:right;">
        <div style="font-size:9.5px;font-weight:600;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Sessão</div>
        <div style="font-size:14px;font-weight:600;color:#0074C7;letter-spacing:0.5px;">${sessionId}</div>
      </div>
    </div>
    <h1>${escapeHTML(config.name)}</h1>
    <div style="font-size:14px;color:#475569;margin-top:8px;line-height:1.6;">
      <strong>${escapeHTML(state.userName || 'Estudante')}</strong> conduziu ${turnLog.length} ${turnLog.length === 1 ? 'turno' : 'turnos'} no nível ${config.levels[state.level].label}${moduleDiscipline ? ` · módulo de ${moduleDiscipline}` : ''}.<br>
      <span style="font-size:12px;color:#94a3b8;">Concluído em ${new Date(state.completedAt || Date.now()).toLocaleString('pt-BR')}</span>
    </div>
  </div>

  ${enhancedBody.replace(/<div style="border-bottom:1px solid #E2E8F0[\s\S]*?<\/div>\s*<h2>/, '<h2>')}
</div>
</body>
</html>`;
  }

  /**
   * Dispara download do relatório completo (HTML auto-imprimível).
   * O HTML inclui botão "Salvar como PDF" que chama window.print() —
   * o navegador converte pra PDF nativamente.
   */
  function exportFullReportHTML(state, diagnosis, config) {
    const html = buildFullReportHTML(state, diagnosis, config);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (state.userName || 'estudante').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    a.download = `relatorio-${config.id}-${safeName}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSessionPDF(state, diagnosis, config) {
    const html = buildDashboardHTML(state, diagnosis, config);
    const win = window.open('', '_blank');
    if (!win) {
      showModal({
        eyebrow: 'EXPORTAR PDF',
        title: 'Pop-ups bloqueados',
        body: 'O navegador bloqueou a abertura da janela de impressão. Permita pop-ups para este site, ou use a opção "Baixar HTML" para depois imprimir manualmente.',
        actions: [{ label: 'Entendi', primary: true, close: true }]
      });
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch (e) {} }, 600);
  }

  // ==========================================================================
  // SEÇÃO 12 — CARD LINKEDIN 1080×1080
  // ==========================================================================

  /**
   * Gera o card LinkedIn 1080×1080 (v1.2.6 — Caminho A: claro, editorial).
   *
   * Decisão de produto: o card é peça de PROPAGANDA do estudante e da Galícia
   * no LinkedIn. Por isso:
   *   - Fundo claro (legibilidade no feed, sensação editorial elegante)
   *   - Sem nível Júnior/Pleno/Sênior (desincentiva quem está em Júnior a postar)
   *   - Sem grid de números frios (8 de 9, 8 de 15) — substitui por PROSA de
   *     competências demonstradas, que vende muito melhor
   *   - Bordão "Conhecer para decidir. Decidir para fazer diferença." em
   *     destaque visual (caixa lateral com tint cyan)
   *   - Selo simples MAI-2026 no canto (sem hash, decisão v1.2.6)
   *
   * REGRA DURA DE TIPOGRAFIA (Lição 25): Montserrat exclusivamente (Gotham não
   * roda em Canvas runtime). Hierarquia construída com peso/tamanho/letter-spacing
   * e itálico — nenhuma fonte com serifa.
   *
   * @param {Object} state - appState
   * @param {Object} diagnosis - estrutura retornada por generateFinalDiagnosis
   * @param {Object} config - SIMULATOR_CONFIG
   * @returns {Promise<Blob>} blob image/png 1080×1080
   */
  async function generateLinkedInCard(state, diagnosis, config) {
    try { await document.fonts.ready; } catch (e) {}

    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ====== FUNDO CLARO COM GRADIENTE SUTIL ======
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#FAF7F2');
    bgGrad.addColorStop(1, '#F2EDE4');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ====== BARRA-GRADIENTE GALÍCIA NO TOPO (assinatura) ======
    const topBar = ctx.createLinearGradient(0, 0, W, 0);
    topBar.addColorStop(0, '#0074C7');
    topBar.addColorStop(0.5, '#00BDFF');
    topBar.addColorStop(1, '#91F2FF');
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, W, 6);

    const padL = 80, padR = 80;

    // ====== EYEBROW + SELO DE SESSÃO ======
    const eyeY = 110;
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 14px "Montserrat", sans-serif';
    ctx.textBaseline = 'alphabetic';
    _drawTrackedText(ctx, 'ACTIVE IA · GALÍCIA EDUCAÇÃO', padL, eyeY, 2.5);

    // Selo público à direita
    const sessionId = getPublicSessionId(state);
    ctx.fillStyle = 'rgba(71,85,105,0.7)';
    ctx.font = '600 11px "Montserrat", sans-serif';
    ctx.textAlign = 'right';
    _drawTrackedText(ctx, 'SESSÃO', W - padR, eyeY - 14, 2);
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 15px "Montserrat", sans-serif';
    ctx.fillText(sessionId, W - padR, eyeY + 8);
    ctx.textAlign = 'left';

    // Linha divisória sutil
    ctx.strokeStyle = '#D9D0C4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, eyeY + 28);
    ctx.lineTo(W - padR, eyeY + 28);
    ctx.stroke();

    // ====== NOME DO ESTUDANTE (peça monumental, fundo claro) ======
    // Montserrat ExtraBold 80px, primeiro nome em navy + sobrenome em italic cyan azul
    ctx.fillStyle = '#0a1628';
    ctx.font = '800 76px "Montserrat", sans-serif';
    const userName = (state.userName || 'Estudante').trim();
    const nameParts = userName.split(/\s+/);
    const firstName = nameParts[0] || userName;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const nameY = 230;
    ctx.fillText(firstName, padL, nameY);
    const firstNameW = ctx.measureText(firstName).width;

    if (lastName) {
      const totalW = firstNameW + ctx.measureText(' ' + lastName).width;
      if (totalW < W - padL - padR) {
        ctx.fillStyle = '#0074C7';
        ctx.font = 'italic 800 76px "Montserrat", sans-serif';
        ctx.fillText(' ' + lastName, padL + firstNameW, nameY);
      } else {
        ctx.fillStyle = '#0074C7';
        ctx.font = 'italic 800 76px "Montserrat", sans-serif';
        ctx.fillText(lastName, padL, nameY + 80);
      }
    }
    const hasLineBreak = lastName && (firstNameW + ctx.measureText(' ' + lastName).width >= W - padL - padR);
    const nameEndY = hasLineBreak ? nameY + 80 : nameY;

    // Subtítulo (linha descritiva)
    ctx.fillStyle = '#475569';
    ctx.font = '400 20px "Montserrat", sans-serif';
    ctx.fillText('concluiu a simulação profissional', padL, nameEndY + 36);

    // ====== TÍTULO DO MÓDULO ======
    const moduleTopic = (config.name || '').split(':')[0].trim();
    ctx.fillStyle = '#0a1628';
    ctx.font = '700 30px "Montserrat", sans-serif';
    const titleLines = wrapText(ctx, moduleTopic, W - padL - padR).slice(0, 2);
    let ty = nameEndY + 80;
    for (const ln of titleLines) {
      ctx.fillText(ln, padL, ty);
      ty += 38;
    }
    let cursorY = ty + 16;

    // ====== PROCESSO (lista bullet) ======
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 12px "Montserrat", sans-serif';
    _drawTrackedText(ctx, 'PROCESSO', padL, cursorY, 2);
    cursorY += 28;

    const turnsPlayed = (state.turnLog || []).length || config.levels[state.level].turns;
    const consultantsUsed = state.consultantsUsed || 0;
    const processItems = [`${turnsPlayed} turnos de decisão sob pressão`];
    if (consultantsUsed > 0) {
      processItems.push(`${consultantsUsed} ${consultantsUsed > 1 ? 'consultas profissionais simuladas' : 'consulta profissional simulada'}`);
    }
    processItems.push('Caso real do mercado · sem múltipla escolha · sem gabarito');

    ctx.fillStyle = '#475569';
    ctx.font = '400 18px "Montserrat", sans-serif';
    for (const it of processItems) {
      ctx.fillText('▸  ' + it, padL, cursorY);
      cursorY += 28;
    }
    cursorY += 16;

    // ====== COMPETÊNCIAS DEMONSTRADAS (prosa, não números) ======
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 12px "Montserrat", sans-serif';
    _drawTrackedText(ctx, 'COMPETÊNCIAS DEMONSTRADAS', padL, cursorY, 2);
    cursorY += 28;

    const strengths = (diagnosis && diagnosis.strengths) || [];
    const competencyItems = strengths.slice(0, 3).map(s => {
      // Corta em 140 chars (Canvas não tem auto-truncate elegante)
      let txt = (s.description || '').trim();
      if (txt.length > 140) txt = txt.substring(0, 137) + '...';
      return txt;
    });

    if (competencyItems.length === 0) {
      // Fallback se diagnosis vier vazio
      competencyItems.push('Conduziu o caso com raciocínio próprio, sem gabarito ou múltipla escolha.');
    }

    ctx.fillStyle = '#0a1628';
    ctx.font = '400 17px "Montserrat", sans-serif';
    for (const it of competencyItems) {
      const lines = wrapText(ctx, '•  ' + it, W - padL - padR);
      for (const ln of lines.slice(0, 2)) {
        ctx.fillText(ln, padL, cursorY);
        cursorY += 24;
      }
      cursorY += 6;
    }

    // ====== BORDÃO INSTITUCIONAL (caixa de destaque) ======
    // Posição fixa próxima ao rodapé
    const bordaoY = 880;
    const bordaoH = 78;
    // Fundo tint cyan claro
    ctx.fillStyle = '#E8F4FF';
    ctx.fillRect(padL, bordaoY, W - padL - padR, bordaoH);
    // Barra lateral de destaque
    ctx.fillStyle = '#0074C7';
    ctx.fillRect(padL, bordaoY, 4, bordaoH);
    // Texto
    ctx.fillStyle = '#0a1628';
    ctx.font = '500 22px "Montserrat", sans-serif';
    ctx.fillText('Conhecer para decidir.', padL + 24, bordaoY + 32);
    ctx.fillStyle = '#0074C7';
    ctx.font = 'italic 600 22px "Montserrat", sans-serif';
    ctx.fillText('Decidir para fazer diferença.', padL + 24, bordaoY + 60);

    // ====== RODAPÉ ======
    // Linha sutil
    ctx.strokeStyle = '#D9D0C4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - 78);
    ctx.lineTo(W - padR, H - 78);
    ctx.stroke();

    // Método (esquerda)
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 12px "Montserrat", sans-serif';
    _drawTrackedText(ctx, 'MÉTODO ACTIVE IA', padL, H - 50, 2.5);

    // Subtítulo rodapé
    ctx.fillStyle = '#475569';
    ctx.font = '400 12px "Montserrat", sans-serif';
    ctx.fillText('Simulação profissional avaliada por IA em tempo real · Galícia Educação', padL, H - 28);

    // Data (direita)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px "Montserrat", sans-serif';
    const dateStr = new Date(state.completedAt || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - padR, H - 28);
    ctx.textAlign = 'left';

    // Barra gradiente Galícia no rodapé (espelha o topo)
    ctx.fillStyle = topBar;
    ctx.fillRect(0, H - 6, W, 6);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }


  /**
   * Desenha texto com letter-spacing simulado (Canvas não suporta letter-spacing nativo).
   * Percorre cada caractere e o posiciona manualmente com offset.
   */
  function _drawTrackedText(ctx, text, x, y, trackingPx) {
    const align = ctx.textAlign;
    if (align === 'right') {
      // Calcula largura total primeiro
      let totalW = 0;
      for (let i = 0; i < text.length; i++) totalW += ctx.measureText(text[i]).width + (i < text.length - 1 ? trackingPx : 0);
      let cx = x - totalW;
      ctx.textAlign = 'left';
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], cx, y);
        cx += ctx.measureText(text[i]).width + trackingPx;
      }
      ctx.textAlign = 'right';
    } else {
      let cx = x;
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], cx, y);
        cx += ctx.measureText(text[i]).width + trackingPx;
      }
    }
  }

  function _nextStepLabel(action, config, currentLevel) {
    const levels = { junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' };
    const order = ['junior', 'pleno', 'senior'];
    const idx = order.indexOf(currentLevel);
    switch (action) {
      case 'subir_nivel':
        return idx < 2 ? `Avançar para ${levels[order[idx + 1]]}` : 'Manter Sênior';
      case 'repetir_nivel':
        return `Repetir ${levels[currentLevel] || ''}`.trim();
      case 'voltar_nivel':
        return idx > 0 ? `Revisar em ${levels[order[idx - 1]]}` : 'Revisar fundamentos';
      case 'revisar_modulo':
        return 'Revisar o módulo';
      default:
        return action || '—';
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current + w + ' ';
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current.trim());
        current = w + ' ';
      } else {
        current = test;
      }
    }
    if (current) lines.push(current.trim());
    return lines;
  }

  // ==========================================================================
  // SEÇÃO 12B — LINKEDIN CAPTION (NOVO em v1.2.0)
  //
  // Gera o texto sugerido para postagem no LinkedIn. Tem cinco partes:
  //   1. Abertura específica (1-2 frases) — "Hoje conclui mais uma simulação..."
  //   2. Recapitulação do caso (1 parágrafo) — gerada pela IA a partir do state
  //   3. Bloco fixo da metodologia (3 frases) — sempre o mesmo
  //   4. Bordão institucional — "Conhecer para decidir. Decidir para fazer diferença."
  //   5. Hashtags — #ActiveIA #GalíciaEducação #[disciplina]
  //
  // Tom: profissional/conquista (versão A1, decisão A3 simplificada).
  // Active IA como protagonista, Galícia como casa do método (B1).
  // Metodologia descrita em 3 frases (C2).
  // ==========================================================================

  const LINKEDIN_BORDAO = 'Conhecer para decidir. Decidir para fazer diferença.';

  const LINKEDIN_METHOD_BLOCK = `O Active IA é a metodologia da Galícia Educação que substitui prova por simulação profissional. A inteligência artificial avalia o raciocínio do estudante, não a resposta. Fundamentada em pesquisas de Stanford, UCLA e Harvard sobre como adultos efetivamente desenvolvem competência prática.`;

  function _slugify(str) {
    return String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .replace(/^[0-9]+/, '');
  }

  function _buildHashtags(config) {
    const tags = ['#ActiveIA', '#GalíciaEducação'];
    // Tag da disciplina/escola
    if (config.school) {
      const schoolTag = '#' + _slugify(config.school);
      if (schoolTag.length > 1) tags.push(schoolTag);
    }
    // Tag específica do módulo (se o nome curto cabe)
    if (config.name) {
      // Pega primeira palavra significativa do nome do simulador
      const firstSubstantive = config.name.split(/[\s:]+/)[0];
      if (firstSubstantive && firstSubstantive.length > 3) {
        const slug = _slugify(firstSubstantive);
        if (slug && !tags.includes('#' + slug)) tags.push('#' + slug);
      }
    }
    return tags.join(' ');
  }

  /**
   * Gera o texto sugerido para LinkedIn. Faz UMA chamada à IA para produzir
   * o parágrafo de recapitulação personalizada do caso (parte 2).
   * Os blocos fixos (metodologia, bordão, hashtags) são montados localmente.
   */
  async function linkedinCaption(state, diagnosis, config) {
    // === Parte 2: recapitulação personalizada (chamada à IA) ===
    let recapBlock = '';
    try {
      const turnsPlayed = (state.turnLog || []).length || config.levels[state.level].turns;
      const consultantsUsed = state.consultantsUsed || 0;
      const archetypeDescription = state.archetype?.seed_description || 'um caso clínico complexo';
      const role = config.role_context || 'profissional do domínio';
      const articulationProfile = (state.articulationHistory || []).join(' → ') || '—';

      const userMsg = `Produza UM PARÁGRAFO de recapitulação para uma postagem de LinkedIn em primeira pessoa do estudante.

CONTEXTO (apenas para você entender — NÃO repita literalmente no parágrafo):
- Papel profissional assumido: ${role.substring(0, 300)}
- Natureza do caso (arquétipo): ${archetypeDescription}
- Turnos conduzidos: ${turnsPlayed}
- Consultas a colegas/especialistas durante a sessão: ${consultantsUsed}
- Pontos fortes da condução: ${(diagnosis?.strengths || []).map(s => s.description).slice(0, 3).join(' | ')}

REGRA EDITORIAL PRINCIPAL (IMPORTANTE):
O parágrafo NÃO repete a localização do módulo, escola, curso ou Galícia — isso já aparece na frase de abertura "Hoje conclui mais uma simulação Active IA do módulo em [disciplina] da Galícia Educação". Você começa o parágrafo DIRETO no conteúdo da experiência, sem repetir contexto institucional.

ESTRUTURA OBRIGATÓRIA DO PARÁGRAFO (3 frases ao todo, nesta ordem):

FRASE 1 — O desafio (1 frase, ~25-35 palavras):
Em linguagem acessível ao público leigo (mas digna ao profissional), descreva o desafio enfrentado. Use o papel profissional ("Assumi o papel de..." ou "Como cirurgião vascular...") e nomeie o problema central em termos compreensíveis. EVITE jargão técnico denso (escores, siglas, critérios). Exemplo do tom: "Assumi o papel de cirurgião vascular num caso complexo: precisei decidir conduta para um paciente com risco iminente de AVC, em janela apertada para intervenção cirúrgica."

FRASE 2 — Como conduziu (1 frase, ~30-40 palavras):
Descreva de forma sucinta como o raciocínio se desenvolveu ao longo dos turnos — sem listar técnicas ou escores específicos. Foque em o que precisou ARTICULAR (não em o que sabe). Exemplo do tom: "Conduzi o raciocínio em ${turnsPlayed} turnos, integrando avaliação clínica, interpretação de exames e decisão cirúrgica num único fluxo — sem múltipla escolha, sem gabarito."

FRASE 3 — Como a IA avaliou (1 frase, PRESERVAR EXATAMENTE este formato, ajustando só o tempo verbal e detalhe final):
"A IA não corrigiu certo ou errado: avaliou as premissas que assumi, os riscos que mapeei e os pontos em que meu raciocínio ainda operava de forma incompleta."

REGRAS GERAIS:
- Primeira pessoa do estudante ("assumi", "conduzi", "articulei").
- 3 frases (nem mais nem menos). Profissional, sóbrio, sem hipérbole.
- NÃO mencione: pós-graduação, módulo, curso, Galícia, escola (já está na frase de abertura).
- NÃO use escores/siglas técnicas densas (ABCD2, NASCET, ASPECTS, DAPT etc.). O LinkedIn é peça de publicidade — quem é da área já entende a profundidade, quem não é precisa entender o desafio.
- NÃO use emoji. NÃO use markdown. NÃO use JSON. Apenas o texto do parágrafo.
- NÃO comece com "Eu". Comece com verbo de ação ou "Como [papel profissional]".
- NUNCA use a palavra "aluno" ou "aluna" — use o papel profissional assumido na cena, ou "estudante" se precisar referência genérica.

Apenas o parágrafo (3 frases). Nada antes, nada depois.`;

      const result = await callAPI({
        systemFixed: 'Você é um redator profissional ajudando um estudante a recapitular sua experiência em uma simulação Active IA da Galícia Educação para postagem no LinkedIn. Tom: profissional, sóbrio, primeira pessoa, sem hipérbole. Apenas texto livre. Nunca JSON, nunca markdown. Nunca use a palavra "aluno" — use "estudante" ou o papel profissional jogado na cena.',
        systemDynamic: 'Modo: geração de parágrafo de recapitulação para postagem LinkedIn.',
        messages: [{ role: 'user', content: userMsg }],
        maxTokens: 500
      });

      recapBlock = ((result.rawText || '').trim())
        .replace(/```[\s\S]*?```/g, '')
        .replace(/^\{[\s\S]*\}$/g, '')
        .trim();

      if (!recapBlock) {
        // Fallback genérico caso a IA falhe
        recapBlock = `Assumi o papel descrito no simulador e enfrentei o caso ao longo de ${turnsPlayed} turnos de decisão. A cada turno, articulei minha conduta e fundamentação. A IA avaliou as premissas que assumi, os riscos que mapeei e os riscos que ignorei.`;
      }
    } catch (e) {
      console.warn('[ActiveIA] linkedinCaption: falha na geração da recap, usando fallback', e);
      const turnsPlayed = (state.turnLog || []).length || config.levels[state.level].turns;
      recapBlock = `Assumi o papel proposto no simulador e enfrentei o caso ao longo de ${turnsPlayed} turnos de decisão sob pressão. A cada turno, articulei conduta e fundamentação. A IA avaliou as premissas que assumi, os riscos que mapeei e os riscos que ignorei.`;
    }

    // === Parte 1: abertura padrão ===
    // Active IA é experimentado MÓDULO a MÓDULO — cada simulador roda dentro de
    // um módulo específico de um curso/disciplina. A estrutura editorial firmada:
    //   "Active IA do módulo em [disciplina] da Galícia Educação"
    // - disciplina: extraída de config.module, removendo identificadores
    //   internos do tipo "— Módulo 01" antes do em-dash
    // - o tema do módulo (config.name) NÃO entra na abertura — ele já aparece
    //   no card visual e no parágrafo gerado pela IA, evitando redundância
    const moduleDiscipline = (config.module || '').replace(/—.*$/, '').trim();

    let moduleRef = '';
    if (moduleDiscipline) {
      moduleRef = ` do módulo em ${moduleDiscipline} da Galícia Educação`;
    } else {
      moduleRef = ' da Galícia Educação';
    }
    const intro = `Hoje conclui mais uma simulação Active IA${moduleRef}. ${recapBlock}`;

    // === Parte 3, 4, 5: blocos fixos ===
    const hashtags = _buildHashtags(config);

    const fullCaption = `${intro}

${LINKEDIN_METHOD_BLOCK}

${LINKEDIN_BORDAO}

${hashtags}`;

    return fullCaption;
  }

  // ==========================================================================
  // SEÇÃO 12C — SHARE LINKEDIN MODAL (NOVO em v1.2.0)
  //
  // Abre modal Galícia que orquestra a publicação no LinkedIn:
  //   - Preview do card PNG renderizado
  //   - Texto sugerido (pode editar)
  //   - Botão "Copiar texto" (clipboard)
  //   - Botão "Baixar imagem" (PNG)
  //   - Botão "Abrir LinkedIn"
  // ==========================================================================

  async function shareLinkedInModal(state, diagnosis, config) {
    // Mostra modal de loading enquanto gera o card e o texto em paralelo
    showModal({
      eyebrow: 'COMPARTILHAR NO LINKEDIN',
      title: 'Preparando seu material...',
      body: `
        <div style="display:flex; align-items:center; gap:12px; padding:8px 0;">
          <span class="activeia-modal-spinner"></span>
          <span style="color:var(--gal-text-2, #475569);">Gerando imagem e texto personalizados a partir da sua sessão...</span>
        </div>
      `,
      bodyIsHTML: true,
      actions: [{ label: 'Aguarde...', disabled: true, close: false }],
      allowEscClose: false
    });

    let cardBlob, caption;
    try {
      [cardBlob, caption] = await Promise.all([
        generateLinkedInCard(state, diagnosis, config),
        linkedinCaption(state, diagnosis, config)
      ]);
    } catch (e) {
      console.error('[ActiveIA] shareLinkedInModal: erro ao gerar material', e);
      updateModalBody(`
        <p style="color:var(--gal-danger, #A32D2D); font-size:14px;">Não foi possível gerar o material agora. Tente novamente em alguns segundos.</p>
        <p style="font-size:12px; color:var(--gal-text-2, #475569); margin-top:8px;">Detalhe: ${escapeHTML(e.message || 'erro desconhecido')}</p>
      `, true);
      updateModalFooter([{ label: 'Fechar', primary: true, close: true }]);
      return;
    }

    const cardUrl = URL.createObjectURL(cardBlob);

    // Renderiza modal com preview + texto + botões
    updateModalBody(`
      <div style="display:grid; grid-template-columns: 180px 1fr; gap: 16px; align-items:start;">
        <div>
          <img src="${cardUrl}" alt="Card Active IA" style="width:100%; border-radius:10px; border:1px solid var(--gal-border, #E2E8F0); display:block;" />
          <div style="font-size:11px; color:var(--gal-text-2, #475569); margin-top:6px; text-align:center; font-family:'Montserrat',sans-serif; font-weight:600;">IMAGEM 1080×1080</div>
        </div>
        <div>
          <div style="font-family:'Montserrat',sans-serif; font-weight:600; font-size:10px; letter-spacing:0.1em; color:var(--gal-azul-escuro, #0074C7); font-weight:600; margin-bottom:6px;">TEXTO SUGERIDO</div>
          <textarea id="activeia-share-caption" class="activeia-modal-input" style="min-height:280px; font-size:13.5px; line-height:1.6;">${escapeHTML(caption)}</textarea>
          <p style="font-size:11.5px; color:var(--gal-text-2, #475569); margin-top:6px;">Você pode editar o texto antes de postar. As hashtags ajudam o alcance da publicação.</p>
        </div>
      </div>
    `, true);

    updateModalFooter([
      {
        label: 'Fechar',
        close: true,
        onClick: () => { URL.revokeObjectURL(cardUrl); }
      },
      {
        label: 'Copiar texto',
        close: false,
        onClick: () => {
          const ta = document.getElementById('activeia-share-caption');
          const text = ta?.value || caption;
          navigator.clipboard.writeText(text).then(() => {
            // Feedback visual rápido
            const btn = document.querySelector('.activeia-modal-footer button:nth-of-type(2)');
            if (btn) {
              const prevText = btn.textContent;
              btn.textContent = '✓ Copiado';
              setTimeout(() => { if (btn) btn.textContent = prevText; }, 1500);
            }
          }).catch(err => {
            console.warn('[ActiveIA] clipboard write failed:', err);
          });
          return false;
        }
      },
      {
        label: 'Baixar imagem',
        close: false,
        onClick: () => {
          const a = document.createElement('a');
          a.href = cardUrl;
          a.download = `active-ia-${config.id}-${state.userName?.replace(/\s+/g, '-').toLowerCase() || 'aluno'}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return false;
        }
      },
      {
        label: 'Abrir LinkedIn →',
        primary: true,
        close: false,
        onClick: () => {
          window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank');
          return false;
        }
      }
    ]);
  }

  // Mantém shareToLinkedIn como wrapper de compatibilidade
  // (caso algum simulador antigo ainda chame essa função)
  async function shareToLinkedIn(blob, suggestedText) {
    console.warn('[ActiveIA] shareToLinkedIn é DEPRECATED desde v1.2.0. Use ActiveIA.export.shareLinkedInModal(state, diagnosis, config).');
    if (!blob) return;
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'active-ia-conquista.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      const u = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(suggestedText || '')}`;
      window.open(u, '_blank');
      URL.revokeObjectURL(downloadUrl);
    }, 800);
  }

  // ==========================================================================
  // SEÇÃO 13 — THEME TOGGLE
  // ==========================================================================

  function initTheme(simulatorId) {
    const themeKey = `${simulatorId}_theme`;
    const saved = storageGet(themeKey);
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    global.ActiveIA_toggleTheme = function() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      storageSet(themeKey, isDark ? 'light' : 'dark');
    };
  }

  // ==========================================================================
  // SEÇÃO 14 — UI HELPERS
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
    const box = document.getElementById('errorBox') || document.getElementById('error-box');
    const textEl = document.getElementById('errorMsg');
    if (textEl) textEl.textContent = msg;
    if (box) box.classList.add('active');
  }

  function hideError() {
    const box = document.getElementById('errorBox') || document.getElementById('error-box');
    if (box) box.classList.remove('active');
  }

  /**
   * Mostra um modal Galícia diagnóstico para uma exceção classificada.
   * Distingue 5 cenários (offline, network, ai_unavailable, bad_response, technical)
   * e renderiza título + mensagem + explainer + botão Tentar novamente.
   *
   * @param {Error} error - erro (idealmente já classificado por _buildError)
   * @param {Function} [onRetry] - callback executado quando o estudante clica Tentar novamente
   */
  function showErrorFromException(error, onRetry) {
    const classified = classifyError(error);
    console.error('[ActiveIA] erro classificado:', classified.kind, classified.technicalDetail);

    const explainerHTML = classified.explainer
      ? `<p style="margin:14px 0 0; font-size:12.5px; color:rgba(71,85,105,0.85); line-height:1.55; padding-top:14px; border-top:1px solid #E2E8F0;"><em style="font-style:normal; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:1px; font-size:10px; display:block; margin-bottom:6px;">Por que isso aconteceu</em>${escapeHTML(classified.explainer)}</p>`
      : '';

    const technicalHTML = classified.technicalDetail
      ? `<details style="margin-top:14px;"><summary style="font-size:11px; color:#94a3b8; cursor:pointer; user-select:none;">Detalhes técnicos</summary><pre style="margin:8px 0 0; font-family:ui-monospace, 'SF Mono', Consolas, Menlo, monospace; font-size:11px; color:#64748b; background:#F5F1EA; padding:10px 12px; border-radius:6px; white-space:pre-wrap; word-break:break-all;">${escapeHTML(classified.technicalDetail)}</pre></details>`
      : '';

    const bodyHTML = `
      <p style="margin:0; font-size:14px; color:#0a1628; line-height:1.6;">${escapeHTML(classified.message)}</p>
      ${explainerHTML}
      ${technicalHTML}
    `;

    const actions = [];
    if (classified.recoverable && typeof onRetry === 'function') {
      actions.push({
        label: classified.cta || 'Tentar novamente',
        primary: true,
        close: true,
        onClick: onRetry
      });
    } else {
      actions.push({ label: 'Entendi', primary: true, close: true });
    }

    showModal({
      eyebrow: 'Conexão',
      title: classified.title,
      body: bodyHTML,
      bodyIsHTML: true,
      allowEscClose: false,
      actions
    });
  }

  /**
   * Injeta um indicador permanente de status de conexão num elemento alvo.
   * Comunica em tempo real ao estudante que ele está num ambiente online,
   * conectado a serviços externos. Estados: ok (verde), idle (cinza),
   * error/offline (vermelho).
   *
   * @param {HTMLElement|string} target - elemento ou seletor onde montar
   * @param {Object} [opts] - { showLabel: boolean (default true) }
   * @returns {Function} função de cleanup que remove o badge e o listener
   */
  function mountConnectionBadge(target, opts) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return () => {};
    const showLabel = !opts || opts.showLabel !== false;

    el.innerHTML = `
      <span class="aiaq-conn-dot" style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#94a3b8; transition:background 0.3s ease, box-shadow 0.3s ease;"></span>
      ${showLabel ? '<span class="aiaq-conn-label" style="font-size:9.5px; font-weight:600; text-transform:uppercase; letter-spacing:1.4px; color:rgba(255,255,255,0.65); transition:color 0.3s ease;">Conectando</span>' : ''}
    `;
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.gap = '8px';

    const dot = el.querySelector('.aiaq-conn-dot');
    const label = el.querySelector('.aiaq-conn-label');

    function render(status) {
      let dotColor, glow, text;
      switch (status.state) {
        case 'ok':
          dotColor = '#1D9E75';
          glow = '0 0 6px rgba(29,158,117,0.65)';
          // IMPORTANTE: nunca nomear o modelo ou o provedor. Active IA é
          // apresentado como produto Galícia próprio. Revelar "claude-sonnet-X"
          // ou "Anthropic" transfere percepção de propriedade intelectual
          // do método para fora da Galícia.
          text = 'IA conectada';
          break;
        case 'error':
          dotColor = '#E0635A';
          glow = '0 0 6px rgba(224,99,90,0.55)';
          if (status.lastError === 'offline') text = 'Sem internet';
          else if (status.lastError === 'ai_unavailable') text = 'IA indisponível';
          else if (status.lastError === 'network') text = 'Falha de rede';
          else text = 'Erro de conexão';
          break;
        case 'offline':
          dotColor = '#E0635A';
          glow = '0 0 6px rgba(224,99,90,0.55)';
          text = 'Sem internet';
          break;
        default:
          dotColor = '#94a3b8';
          glow = 'none';
          text = 'Conectando';
      }
      if (dot) {
        dot.style.background = dotColor;
        dot.style.boxShadow = glow;
      }
      if (label) {
        label.textContent = text;
      }
    }

    // Render inicial
    render(getConnectionStatus());
    // Subscrição
    const unsubscribe = onConnectionChange(render);

    return () => {
      unsubscribe();
      el.innerHTML = '';
    };
  }

  // ==========================================================================
  // SEÇÃO 15 — DAILY BLOCK
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
  // SEÇÃO 16 — SESSION PERSISTENCE
  // ==========================================================================

  function saveSession(simulatorId, state) {
    const key = `${simulatorId}_session`;
    try {
      storageSet(key, JSON.stringify({
        ...state,
        savedAt: new Date().toISOString(),
        coreVersion: CORE_VERSION
      }));
    } catch (e) { console.warn('saveSession failed', e); }
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

  /**
   * Gera um selo público de sessão para uso visual no dossiê e no card LinkedIn.
   * Formato simplificado v1.2.6: "MAI-2026" — mês-ano da sessão. Marca temporal
   * elegante, sem hash opaco. O hash anterior (KSM9Z) confundia mais do que
   * ajudava — não tinha função além de identidade visual, e como o pacote
   * inteiro já tem outras peças de identidade (nome do estudante, data, módulo),
   * o hash extra virava ruído.
   *
   * @param {Object} state - appState com startedAt
   * @returns {string} ex: "MAI-2026"
   */
  function getPublicSessionId(state) {
    if (!state || !state.startedAt) return '—';
    const date = new Date(state.startedAt);
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return `${months[date.getMonth()]}-${date.getFullYear()}`;
  }

  // ==========================================================================
  // SEÇÃO 18 — MODAL GENÉRICO GALÍCIA (NOVO em v1.1.0)
  //
  // Sistema de modal reusável no chassi Galícia. Substitui alert(), prompt()
  // e confirm() nativos do navegador, que quebram a imersão diegética e o
  // look-and-feel do simulador.
  //
  // Uso:
  //   ActiveIA.modal.show({
  //     eyebrow: 'TÍTULO PEQUENO',
  //     title: 'Pergunta ou aviso principal',
  //     body: 'HTML ou string a renderizar no corpo',
  //     bodyIsHTML: false,
  //     actions: [
  //       { label: 'Cancelar', close: true },
  //       { label: 'Confirmar', primary: true, onClick: () => {...}, close: true }
  //     ]
  //   });
  //
  //   ActiveIA.modal.close();
  // ==========================================================================

  const MODAL_CSS = `
.activeia-modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(10, 22, 40, 0.55);
  backdrop-filter: blur(4px);
  z-index: 2000;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'Gotham', 'Montserrat', system-ui, -apple-system, sans-serif;
}
.activeia-modal-overlay.active { display: flex; }
.activeia-modal {
  background: var(--gal-card, #FFFFFF);
  border-radius: 14px;
  max-width: 580px;
  width: 100%;
  max-height: 88vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(10, 22, 40, 0.18);
  border: 1px solid var(--gal-border, #E2E8F0);
  animation: activeia-modal-in 0.18s ease-out;
}
@keyframes activeia-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.activeia-modal-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--gal-border, #E2E8F0);
  background: linear-gradient(180deg, var(--gal-card-tint, #E8F4FF), var(--gal-card, #FFFFFF));
}
.activeia-modal-eyebrow {
  font-family: 'Gotham', 'Montserrat', sans-serif;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--gal-azul-escuro, #0074C7);
  font-weight: 600;
  text-transform: uppercase;
}
.activeia-modal-title {
  font-family: 'Gotham', 'Montserrat', sans-serif;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--gal-text, #0a1628);
  margin: 4px 0 2px;
}
.activeia-modal-subtitle {
  font-size: 12px;
  color: var(--gal-text-2, #475569);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.activeia-modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--gal-text, #0a1628);
}
.activeia-modal-body p { margin: 0 0 12px; }
.activeia-modal-body p:last-child { margin-bottom: 0; }
.activeia-modal-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--gal-border, #E2E8F0);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: var(--gal-bg, #FAF7F2);
}
.activeia-modal-footer button {
  font-family: 'Gotham', 'Montserrat', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--gal-border, #E2E8F0);
  background: var(--gal-card, #FFFFFF);
  color: var(--gal-text, #0a1628);
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.activeia-modal-footer button:hover {
  background: var(--gal-card-tint, #E8F4FF);
  border-color: var(--gal-azul-escuro, #0074C7);
}
.activeia-modal-footer button.primary {
  background: var(--gal-azul-escuro, #0074C7);
  color: #FFFFFF;
  border-color: var(--gal-azul-escuro, #0074C7);
}
.activeia-modal-footer button.primary:hover {
  background: var(--gal-dark-navy, #0a1628);
  border-color: var(--gal-dark-navy, #0a1628);
}
.activeia-modal-footer button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.activeia-modal-question-box {
  background: var(--gal-card-tint, #E8F4FF);
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--gal-text-2, #475569);
  margin-bottom: 16px;
  border-left: 3px solid var(--gal-azul-medio, #00BDFF);
}
.activeia-modal-question-label {
  font-family: 'Gotham', 'Montserrat', sans-serif;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--gal-azul-escuro, #0074C7);
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
}
.activeia-modal-input {
  width: 100%;
  min-height: 90px;
  resize: vertical;
  font-family: 'Gotham', 'Montserrat', system-ui, sans-serif;
  font-size: 14px;
  padding: 12px 14px;
  border: 1px solid var(--gal-border, #E2E8F0);
  border-radius: 10px;
  background: var(--gal-bg, #FAF7F2);
  color: var(--gal-text, #0a1628);
}
.activeia-modal-input:focus {
  outline: none;
  border-color: var(--gal-azul-escuro, #0074C7);
}
.activeia-modal-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid var(--gal-border, #E2E8F0);
  border-top-color: var(--gal-azul-escuro, #0074C7);
  border-radius: 50%;
  animation: activeia-spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: 10px;
}
@keyframes activeia-spin {
  to { transform: rotate(360deg); }
}
[data-theme="dark"] .activeia-modal {
  background: var(--gal-card, #161b22);
}
`;

  function _ensureModalCSS() {
    if (document.getElementById('activeia-modal-css')) return;
    const style = document.createElement('style');
    style.id = 'activeia-modal-css';
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);
  }

  function _ensureModalDOM() {
    if (document.getElementById('activeia-modal-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'activeia-modal-overlay';
    overlay.className = 'activeia-modal-overlay';
    overlay.innerHTML = `
      <div class="activeia-modal" role="dialog" aria-modal="true">
        <div class="activeia-modal-header">
          <div class="activeia-modal-eyebrow" id="activeia-modal-eyebrow"></div>
          <div class="activeia-modal-title" id="activeia-modal-title"></div>
          <div class="activeia-modal-subtitle" id="activeia-modal-subtitle"></div>
        </div>
        <div class="activeia-modal-body" id="activeia-modal-body"></div>
        <div class="activeia-modal-footer" id="activeia-modal-footer"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        const allowClose = overlay.dataset.allowEscClose !== 'false';
        if (allowClose) closeModal();
      }
    });
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showModal(opts) {
    opts = opts || {};
    _ensureModalCSS();
    _ensureModalDOM();

    const overlay = document.getElementById('activeia-modal-overlay');
    const eyebrowEl = document.getElementById('activeia-modal-eyebrow');
    const titleEl = document.getElementById('activeia-modal-title');
    const subtitleEl = document.getElementById('activeia-modal-subtitle');
    const bodyEl = document.getElementById('activeia-modal-body');
    const footerEl = document.getElementById('activeia-modal-footer');

    eyebrowEl.textContent = opts.eyebrow || '';
    eyebrowEl.style.display = opts.eyebrow ? '' : 'none';
    titleEl.textContent = opts.title || '';
    titleEl.style.display = opts.title ? '' : 'none';
    subtitleEl.textContent = opts.subtitle || '';
    subtitleEl.style.display = opts.subtitle ? '' : 'none';

    if (opts.bodyIsHTML) {
      bodyEl.innerHTML = opts.body || '';
    } else {
      bodyEl.textContent = opts.body || '';
    }

    footerEl.innerHTML = '';
    const actions = opts.actions || [{ label: 'Fechar', close: true }];
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      if (action.primary) btn.classList.add('primary');
      if (action.disabled) btn.disabled = true;
      if (action.id) btn.id = action.id;
      btn.addEventListener('click', () => {
        if (typeof action.onClick === 'function') {
          const result = action.onClick();
          if (result === false) return; // permite cancelar fechamento
        }
        if (action.close !== false) closeModal();
      });
      footerEl.appendChild(btn);
    });

    overlay.dataset.allowEscClose = opts.allowEscClose !== false ? 'true' : 'false';
    overlay.classList.add('active');

    if (typeof opts.afterOpen === 'function') {
      setTimeout(() => opts.afterOpen(bodyEl, footerEl), 50);
    }

    return { close: closeModal, bodyEl, footerEl };
  }

  function closeModal() {
    const overlay = document.getElementById('activeia-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function updateModalBody(html, isHTML) {
    const bodyEl = document.getElementById('activeia-modal-body');
    if (!bodyEl) return;
    if (isHTML) bodyEl.innerHTML = html;
    else bodyEl.textContent = html;
  }

  function updateModalFooter(actions) {
    const footerEl = document.getElementById('activeia-modal-footer');
    if (!footerEl) return;
    footerEl.innerHTML = '';
    (actions || []).forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      if (action.primary) btn.classList.add('primary');
      if (action.disabled) btn.disabled = true;
      if (action.id) btn.id = action.id;
      btn.addEventListener('click', () => {
        if (typeof action.onClick === 'function') {
          const result = action.onClick();
          if (result === false) return;
        }
        if (action.close !== false) closeModal();
      });
      footerEl.appendChild(btn);
    });
  }

  // ==========================================================================
  // SEÇÃO 19 — CONSULTOR COLEGIAL (NOVO em v1.1.0)
  //
  // Módulo completo de consulta colegial. Substitui qualquer implementação
  // ad-hoc de consultor com prompt() + alert() nativos do navegador, que
  // produziam UX degradada e prompts confusos (mistura de texto livre + JSON).
  //
  // Uso pelo simulador:
  //   await ActiveIA.consultant.open({
  //     consultant: { name, role, id },           // do SIMULATOR_CONFIG.consultants
  //     gameContext: {                            // contexto da sessão
  //       archetype, caseState, phase, level
  //     },
  //     onUsed: () => { ... },                    // callback após consulta bem-sucedida
  //     onError: () => { ... }                    // callback em caso de erro
  //   });
  //
  // O consultor responde em TEXTO LIVRE (não JSON). 2-5 frases.
  // A Regra de Proporcionalidade NÃO é injetada no prompt do consultor
  // (faz sentido pros turnos do jogo, é veneno pra conversa colegial).
  // ==========================================================================

  function buildConsultantSystemFixed(consultant) {
    return `Você é ${consultant.name}, ${consultant.role}, em consulta colegial breve com o profissional em formação dentro de um simulador Active IA da Galícia Educação.

REGRAS DE RESPOSTA (cumpra rigorosamente):
- Responda em TEXTO LIVRE em português brasileiro.
- NÃO use JSON em hipótese alguma. NÃO use markdown. NÃO use blocos de código (\`\`\`).
- Comprimento: 2 a 5 frases. Direto ao ponto.
- Tom: profissional, colegial, sem floreios nem retórica acadêmica. Você é um colega experiente sendo consultado de forma rápida.
- Pode tutear ou usar "doutor(a)" / "colega" conforme natural. Sem rigidez.
- Você é COLEGA, NÃO GABARITO: ofereça perspectiva especializada, eventualmente faça UMA pergunta de volta para ajudar o colega a pensar. NÃO entregue diagnóstico fechado nem plano completo.
- Se a pergunta for vaga ou genérica, peça precisão em UMA frase — sem ser professoral.
- NÃO mencione o "simulador" ou que isso é um exercício. Você é o(a) ${consultant.role.toLowerCase()} sendo consultado(a). Mantenha-se no personagem.

Apenas o texto da sua resposta. Nada antes, nada depois.`;
  }

  function buildConsultantSystemDynamic(gameContext) {
    const archetype = gameContext.archetype || {};
    const caseState = gameContext.caseState || {};
    return `Contexto interno do caso (NÃO citar literalmente; use apenas para calibrar sua resposta):
- Cenário: ${archetype.seed_description || 'em apresentação'}
- Hipótese dominante construída pelo colega: ${caseState.dominant_hypothesis || 'em formação'}
- Sinais já identificados: ${(caseState.key_signals_identified || []).join('; ') || 'poucos ainda'}
- Fase atual do raciocínio: ${gameContext.phase || 'inicial'}
- Nível do profissional: ${gameContext.level || 'em formação'}`;
  }

  async function openConsultant({ consultant, gameContext, onUsed, onError }) {
    if (!consultant || !consultant.name || !consultant.role) {
      console.warn('[ActiveIA] consultant.open: consultor inválido');
      return;
    }

    let currentQuestion = '';

    // === ETAPA 1: solicitar pergunta ===
    showModal({
      eyebrow: 'CONSULTORIA COLEGIAL',
      title: consultant.name,
      subtitle: consultant.role,
      body: `
        <p style="font-size:13px; color:var(--gal-text-2, #475569); margin:0 0 12px;">Formule uma pergunta objetiva. Lembre que ${consultant.name.split(' ')[0]} é colega, não gabarito — pode oferecer perspectiva ou questionar de volta.</p>
        <textarea id="activeia-consult-input" class="activeia-modal-input" placeholder="Sua pergunta para ${consultant.name.split(' ')[1] || consultant.name}..."></textarea>
      `,
      bodyIsHTML: true,
      actions: [
        { label: 'Cancelar', close: true, onClick: () => {} },
        {
          label: 'Enviar pergunta →',
          primary: true,
          close: false,
          onClick: () => {
            const input = document.getElementById('activeia-consult-input');
            const q = (input?.value || '').trim();
            if (q.length < 3) {
              input?.focus();
              return false; // não fecha modal
            }
            currentQuestion = q;
            sendConsultantQuestion({ consultant, question: q, gameContext, onUsed, onError });
            return false; // não fecha; sendConsultantQuestion atualiza o modal
          }
        }
      ],
      afterOpen: () => {
        const input = document.getElementById('activeia-consult-input');
        if (input) input.focus();
      }
    });
  }

  async function sendConsultantQuestion({ consultant, question, gameContext, onUsed, onError }) {
    // Estado: aguardando resposta
    updateModalBody(`
      <div class="activeia-modal-question-box">
        <span class="activeia-modal-question-label">SUA PERGUNTA</span>
        ${escapeHTML(question)}
      </div>
      <div style="display:flex; align-items:center; color:var(--gal-text-2, #475569); font-size:13px; padding:8px 0;">
        <span class="activeia-modal-spinner"></span>
        Aguardando resposta de ${escapeHTML(consultant.name.split(' ')[1] || consultant.name)}...
      </div>
    `, true);
    updateModalFooter([
      { label: 'Aguarde...', disabled: true, close: false }
    ]);

    // Marca como usado já (mesmo que falhe — defensivo, depois desconta se erro)
    if (typeof onUsed === 'function') onUsed();

    try {
      const systemFixed = buildConsultantSystemFixed(consultant);
      const systemDynamic = buildConsultantSystemDynamic(gameContext);

      const result = await callAPI({
        systemFixed,
        systemDynamic,
        messages: [{ role: 'user', content: question }],
        maxTokens: 400
      });

      // Consultor responde em texto livre — usa rawText, não tenta parsear JSON
      let answer = (result.rawText || '').trim();

      // Limpeza defensiva: se a IA tentar vazar JSON ou markdown, remove
      answer = answer.replace(/```[\s\S]*?```/g, '').trim();
      // Remove JSON puro residual (sem markdown)
      if (/^\{[\s\S]*\}$/.test(answer)) {
        try {
          const obj = JSON.parse(answer);
          answer = obj.answer || obj.resposta || obj.response || obj.text || answer;
        } catch (e) {}
      }
      if (!answer) answer = 'Não consegui formular uma resposta agora. Tente reformular a pergunta.';

      // Renderiza resposta
      updateModalBody(`
        <div class="activeia-modal-question-box">
          <span class="activeia-modal-question-label">SUA PERGUNTA</span>
          ${escapeHTML(question)}
        </div>
        <div style="font-size:14.5px; line-height:1.65; color:var(--gal-text, #0a1628); white-space:pre-wrap;">${escapeHTML(answer)}</div>
      `, true);
      updateModalFooter([
        { label: 'Voltar à cena', primary: true, close: true }
      ]);

    } catch (e) {
      console.error('[ActiveIA] consultant error:', e);
      if (typeof onError === 'function') onError(e);

      updateModalBody(`
        <p style="color:var(--gal-danger, #A32D2D); font-size:14px;">Não foi possível consultar agora. Sua cota não foi descontada.</p>
        <p style="font-size:12px; color:var(--gal-text-2, #475569); margin-top:8px;">Detalhe técnico: ${escapeHTML(e.message || 'erro desconhecido')}</p>
      `, true);
      updateModalFooter([
        { label: 'Fechar', primary: true, close: true }
      ]);
    }
  }

  // ==========================================================================
  // SEÇÃO 17 — INIT
  // ==========================================================================

  async function init(config) {
    if (!config || !config.id) {
      throw new Error('[ActiveIA] init: SIMULATOR_CONFIG inválido — campo "id" obrigatório');
    }

    console.log(`[ActiveIA] Core v${CORE_VERSION} inicializando simulador "${config.id}"`);

    // Garante CSS do modal injetado já no boot (antes de qualquer uso)
    _ensureModalCSS();

    await preloadCache([
      `${config.id}_session`,
      `${config.id}_theme`,
      `${config.id}_daily`,
      `${config.id}_played_archetypes`
    ]);

    initTheme(config.id);

    // O simulador específico recebe o config + utilitários do core para construir
    // sua própria UI. O core NÃO renderiza telas — apenas oferece a infraestrutura
    // (utilitários, motores, modais, exports). Cabe ao index.html chamar
    // core.session.load, core.daily.isBlocked, core.consultant.open, etc.

    if (typeof global.onCoreReady === 'function') {
      global.onCoreReady(config);
    } else {
      console.log('[ActiveIA] onCoreReady callback não definido pelo simulador. Core aguardando uso.');
    }
  }

  // ==========================================================================
  // EXPORT PÚBLICO
  // ==========================================================================

  global.ActiveIA = {
    version: CORE_VERSION,
    init: init,
    constants: { API_URL, MODEL, MAX_TOKENS },
    storage: { get: storageGet, set: storageSet, remove: storageRemove, preload: preloadCache },
    parseJSON: parseJSON,
    callAPI: callAPI,
    archetype: { select: selectArchetype, recordPlayed: recordArchetypePlayed },
    branching: { buildContext: buildBranchingContext },
    articulation: { rulesPromptBlock: getArticulationRulesPromptBlock },
    termination: { check: checkEarlyTermination },
    diagnosis: { generate: generateFinalDiagnosis },
    history: { summarize: summarizeEarlyHistory },
    export: {
      html: exportSessionHTML,
      pdf: exportSessionPDF,
      fullReport: exportFullReportHTML,
      linkedinCard: generateLinkedInCard,
      linkedinCaption: linkedinCaption,
      shareLinkedInModal: shareLinkedInModal,
      shareLinkedIn: shareToLinkedIn,
      buildDashboardHTML: buildDashboardHTML
    },
    ui: {
      showLoading,
      hideLoading,
      showError,
      hideError,
      showErrorFromException,
      mountConnectionBadge
    },
    connection: {
      status: getConnectionStatus,
      onChange: onConnectionChange
    },
    errors: {
      classify: classifyError
    },
    daily: { isBlocked: isDailyBlocked, markComplete: markDayComplete, getTimer: getDailyTimer },
    session: { save: saveSession, load: loadSession, clear: clearSession, publicId: getPublicSessionId },
    modal: {
      show: showModal,
      close: closeModal,
      updateBody: updateModalBody,
      updateFooter: updateModalFooter
    },
    consultant: {
      open: openConsultant
    },
    utils: {
      escapeHTML: escapeHTML
    }
  };

  console.log(`[ActiveIA] Core v${CORE_VERSION} carregado`);

})(typeof window !== 'undefined' ? window : globalThis);
