/**
 * ============================================================================
 * ACTIVE IA — CORE v1.2.0
 * ============================================================================
 *
 * Núcleo JavaScript compartilhado da fábrica Active IA da Galícia Educação.
 *
 * Hospedagem-alvo: https://galiciaeducacao.github.io/activeia-core/v1/core.js
 *
 * MUDANÇAS DA v1.1.0 PARA v1.2.0:
 *   - NOVO: ActiveIA.export.linkedinCaption — gera texto pronto e personalizado
 *           para postagem no LinkedIn, baseado na sessão do aluno. Explicita a
 *           metodologia Active IA para a audiência do LinkedIn (publicidade
 *           dupla: aluno + Galícia).
 *   - NOVO: ActiveIA.export.shareLinkedInModal — abre modal Galícia com preview
 *           do card PNG + texto pronto + botões copiar/baixar/abrir LinkedIn.
 *   - AJUSTADO: ActiveIA.export.linkedinCard agora inclui rodapé reforçado
 *               com "MÉTODO ACTIVE IA · Galícia Educação" e métricas de processo
 *               (turnos de decisão, consultas profissionais) além das competências.
 *   - BORDÃO INSTITUCIONAL: "Conhecer para decidir. Decidir para fazer diferença."
 *           — usado no card visual e no texto sugerido. Memorável, repetível.
 *
 * MUDANÇAS DA v1.0.0 PARA v1.1.0:
 *   - NOVO: ActiveIA.modal — sistema de modal Galícia reusável
 *   - NOVO: ActiveIA.consultant — módulo de consultor colegial
 *   - CORREÇÃO: exportSessionPDF usa modal Galícia em vez de alert() nativo
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

  const CORE_VERSION = '1.2.0';
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
  // ==========================================================================

  async function callAPI({ systemFixed, systemDynamic, messages, maxTokens }) {
    const systemArray = [
      { type: 'text', text: systemFixed, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: systemDynamic || '' }
    ];

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens || MAX_TOKENS,
        system: systemArray,
        messages: messages
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`API ${response.status}: ${response.statusText} — ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();

    if (data.usage && data.usage.cache_read_input_tokens > 0) {
      console.log(`[ActiveIA] Cache hit: ${data.usage.cache_read_input_tokens} tokens lidos`);
    }

    const textBlock = data.content.find(c => c.type === 'text');
    if (!textBlock) throw new Error('Resposta vazia da API');

    const parsed = parseJSON(textBlock.text);
    return { parsed, rawText: textBlock.text, usage: data.usage };
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
      junior: 'RAMIFICAÇÃO LEVE. Mantenha coerência. Desfecho geral é o mesmo, com pequenas variações conforme caminho do aluno.',
      pleno:  'RAMIFICAÇÃO MODERADA. Desfechos efetivamente distintos conforme raciocínio. Caminho mais raso leva a desfecho funcionalmente pior.',
      senior: 'RAMIFICAÇÃO DENSA. Rota errada pode ser irrecuperável, com aprendizado embutido no encerramento. Coerência rígida com estado.'
    };

    const decisions = (caseState.key_decisions_taken || []).join(' · ') || '—';
    const identified = (caseState.key_signals_identified || []).join(' · ') || '—';
    const missed = (caseState.key_signals_missed || []).join(' · ') || '—';

    return `
ESTADO DO CASO ATUAL (mantenha coerência rígida com os campos abaixo):
- Hipótese dominante construída pelo aluno: ${caseState.dominant_hypothesis || 'ainda em formação'}
- Decisões-chave já tomadas: ${decisions}
- Sinais identificados pelo aluno: ${identified}
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

PARTE 1 — PROTOCOLO DE TRADUÇÃO LITERAL DA RESPOSTA DO ALUNO

Antes de produzir qualquer narrativa, classifique INTERNAMENTE a resposta do aluno em uma destas três categorias:

(a) GENÉRICA — apenas nomeia categoria, instrumento ou intenção, sem especificar eixos, hipóteses, justificativa teórica ou método. Exemplos: "vou fazer anamnese", "peço exames", "vou negociar com o cliente", "fundamento na teoria", "encaminho para especialista".

(b) PARCIAL — nomeia 1 ou 2 eixos concretos COM especificidade, mas deixa outros eixos relevantes para o domínio em aberto.

(c) BEM ARTICULADA — lista eixos concretos cobrindo o quê (eixo/instrumento específico), o por quê (justificativa teórica ou clínica) e o como (método, ordem, critério).

ESSA CLASSIFICAÇÃO TEM CONSEQUÊNCIAS RÍGIDAS:

| Classificação    | Narrativa                                  | Indicadores no turno          |
|------------------|--------------------------------------------|-------------------------------|
| Genérica         | Revela APENAS o mínimo absoluto da cena.   | 10-20% do máximo do turno     |
| Parcial          | Revela APENAS os eixos explicitados.       | 40-60% do máximo do turno     |
| Bem articulada   | Revela tudo que foi explicitamente pedido. | 70-100% do máximo do turno    |

EXEMPLO CRÍTICO: se o aluno escreveu apenas "vou pedir exames", a IA NÃO entrega nenhum resultado de exame. A IA pergunta de volta, na voz do colega/residente/interlocutor da cena: "Quais exames, em que ordem, com que objetivo?". Indicadores recebem entre 10 e 20% do máximo do turno. O feedback abre nomeando literalmente "vou pedir exames" e caracterizando como genérico.

PARTE 2 — FORMATO OBRIGATÓRIO DO FEEDBACK PEDAGÓGICO

O parágrafo "📝 Feedback:" ao final da narrativa SEMPRE:
1. Começa nomeando literalmente o que o aluno escreveu (entre aspas, ou parafrase fiel).
2. Caracteriza a especificidade da resposta como genérica, parcial ou bem articulada.
3. Lista o que foi de fato coberto pelo aluno (mesmo que pouco).
4. Lista o que ficou de fora e deveria ter aparecido.
5. Orienta o próximo turno.

EXEMPLOS DE FRASES PROIBIDAS:
- "Você conduziu a avaliação de forma estruturada e completa..." (quando o aluno só escreveu "vou avaliar")
- "Excelente articulação clínica..." (sem ter de fato havido articulação)
- Qualquer elogio que não corresponda ao que está LITERALMENTE no texto do aluno.

PARTE 3 — PEDAGOGIA DA ESPECIFICIDADE

A IA NUNCA completa pelo aluno. Se o aluno omitiu eixo importante, esse eixo permanece omitido até o aluno EXPLICITAMENTE mobilizá-lo. A IA não infere boa intenção e não preenche lacunas. O aluno articula ou não articula. O simulador é diagnóstico, não compensatório.

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

    // Regra 2 — hard fail global (a partir do turno 3)
    if (currentTurn >= 3) {
      const totalIndicators = Object.values(indicators).reduce((a, b) => a + b, 0);
      // Máximo teórico = soma dos máximos de cada indicador (max do config) × proporção de turnos já jogados
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
Resposta do aluno: "${(t.userResponse || '').substring(0, 500)}"
Sinais identificados: ${(t.case_state?.key_signals_identified || []).join(', ') || '—'}
Decisões: ${(t.case_state?.key_decisions_taken || []).join(', ') || '—'}`;
    }).join('\n\n');

    const finalIndicators = state.indicators;
    const articulationProfile = state.articulationHistory.join(' → ');

    const userMsg = `Analise a sessão completa do aluno abaixo e produza diagnóstico final estruturado.

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
    { "turn": N, "description": "Frase específica e concreta sobre o que o aluno fez bem, citando literalmente o que ele articulou." }
  ],
  "weaknesses": [
    { "turn": N, "description": "Frase específica sobre o que faltou nesse turno. Termine com 'Reveja: <referência específica ao módulo>.'" }
  ],
  "next_step_recommendation": {
    "action": "subir_nivel" | "repetir_nivel" | "voltar_nivel" | "revisar_modulo",
    "rationale": "Mensagem clara e direta ao aluno explicando a recomendação, em 2-3 frases."
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
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:11px;font-family:'JetBrains Mono',monospace;color:#475569;">${c.module_ref}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:11px;"><span style="background:${meta.color}22;color:${meta.color};padding:3px 10px;border-radius:6px;font-weight:600;">${meta.label}</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#475569;">${just}</td>
      </tr>`;
    }).join('');

    const strengths = (diagnosis.strengths || []).map(s =>
      `<li style="margin-bottom:10px;font-size:13px;line-height:1.6;"><strong style="color:#0F6E56;font-family:'JetBrains Mono',monospace;font-size:11px;">TURNO ${s.turn}</strong><br>${s.description}</li>`
    ).join('');

    const weaknesses = (diagnosis.weaknesses || []).map(w =>
      `<li style="margin-bottom:10px;font-size:13px;line-height:1.6;"><strong style="color:#A32D2D;font-family:'JetBrains Mono',monospace;font-size:11px;">TURNO ${w.turn}</strong><br>${w.description}</li>`
    ).join('');

    const indicatorsHTML = config.indicators.map(ind => {
      const v = state.indicators[ind.id] || 0;
      const pct = Math.round((v / ind.max) * 100);
      return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;">
          <span style="color:#475569;">${ind.name}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#0a1628;">${v} / ${ind.max}</span>
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Montserrat:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @media print { body { background:#fff !important; } .no-print { display:none !important; } }
  body { font-family:'Montserrat',sans-serif; background:#FAF7F2; margin:0; padding:32px; color:#0a1628; }
  .container { max-width:880px; margin:0 auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  h1 { font-family:'Playfair Display',serif; font-weight:600; font-size:28px; margin:0 0 4px; color:#0a1628; }
  h2 { font-family:'Playfair Display',serif; font-weight:500; font-size:20px; margin:32px 0 12px; color:#0a1628; border-bottom:2px solid #0074C7; padding-bottom:6px; }
  .meta { font-family:'JetBrains Mono',monospace; font-size:11px; color:#475569; letter-spacing:0.5px; }
  table { width:100%; border-collapse:collapse; }
  ul { padding-left:0; list-style:none; }
</style>
</head>
<body>
<div class="container">
  <div style="border-bottom:1px solid #E2E8F0; padding-bottom:16px; margin-bottom:20px;">
    <div class="meta">DIAGNÓSTICO DE SESSÃO · ACTIVE IA</div>
    <h1>${config.name}</h1>
    <div style="font-size:13px;color:#475569;margin-top:4px;">Aluno(a): <strong>${state.userName || '—'}</strong> · Nível: ${config.levels[state.level].label} · ${new Date(state.completedAt || Date.now()).toLocaleString('pt-BR')}</div>
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

  async function generateLinkedInCard(state, diagnosis, config) {
    try { await document.fonts.ready; } catch (e) {}

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // ====== Fundo Galícia ======
    ctx.fillStyle = '#FAF7F2';
    ctx.fillRect(0, 0, 1080, 1080);

    // Faixa decorativa superior (gradiente Galícia)
    const grad = ctx.createLinearGradient(0, 0, 1080, 0);
    grad.addColorStop(0, '#0074C7');
    grad.addColorStop(0.5, '#00BDFF');
    grad.addColorStop(1, '#91F2FF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 8);

    // ====== HEADER ======
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 22px "JetBrains Mono", monospace';
    ctx.fillText('ACTIVE IA · GALÍCIA EDUCAÇÃO', 80, 80);

    // Linha divisória
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 110); ctx.lineTo(1000, 110); ctx.stroke();

    // ====== NOME DO ALUNO ======
    ctx.fillStyle = '#0a1628';
    ctx.font = '500 56px "Playfair Display", Georgia, serif';
    const userName = state.userName || 'Aluno(a)';
    ctx.fillText(userName, 80, 200);

    ctx.fillStyle = '#475569';
    ctx.font = '400 22px "Montserrat", sans-serif';
    ctx.fillText('concluiu a simulação profissional', 80, 240);

    // ====== NOME DO SIMULADOR (até 2 linhas) ======
    ctx.fillStyle = '#0a1628';
    ctx.font = '600 34px "Playfair Display", Georgia, serif';
    const simName = config.name;
    const titleLines = wrapText(ctx, simName, 920).slice(0, 2);
    let y = 300;
    for (const ln of titleLines) {
      ctx.fillText(ln, 80, y);
      y += 44;
    }
    const titleEndY = y + 4;

    // ====== BADGE DE NÍVEL + MÓDULO ======
    const levelLabel = config.levels[state.level].label.toUpperCase();
    const badgeY = titleEndY + 18;
    ctx.fillStyle = '#0074C7';
    ctx.fillRect(80, badgeY, 220, 50);
    ctx.fillStyle = '#FAF7F2';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`NÍVEL ${levelLabel}`, 190, badgeY + 32);
    ctx.textAlign = 'left';

    // Módulo (ao lado do badge)
    if (config.module) {
      ctx.fillStyle = '#475569';
      ctx.font = '400 16px "JetBrains Mono", monospace';
      ctx.fillText(config.module.toUpperCase(), 320, badgeY + 32);
    }

    // ====== HEADLINE METRIC ======
    const blockY = badgeY + 100;
    const headline = (diagnosis && diagnosis.headline_metric) || '';
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 28px "Montserrat", sans-serif';
    if (headline) {
      const lines = wrapText(ctx, headline, 920).slice(0, 2);
      let hy = blockY;
      for (const ln of lines) {
        ctx.fillText(ln, 80, hy);
        hy += 38;
      }
    }

    // ====== MÉTRICAS DE PROCESSO ======
    // Mostra que houve trabalho: turnos de decisão + consultas profissionais
    const metricsY = blockY + 90;
    const turnsPlayed = (state.turnLog || []).length || config.levels[state.level].turns;
    const consultantsUsed = state.consultantsUsed || 0;

    ctx.fillStyle = '#0a1628';
    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillText('PROCESSO', 80, metricsY);

    ctx.font = '400 20px "Montserrat", sans-serif';
    ctx.fillStyle = '#475569';
    let mtX = 80;
    const metric1 = `${turnsPlayed} turnos de decisão sob pressão`;
    ctx.fillText('▸ ' + metric1, mtX, metricsY + 32);

    if (consultantsUsed > 0) {
      const metric2 = `${consultantsUsed} consulta${consultantsUsed > 1 ? 's' : ''} profissional${consultantsUsed > 1 ? 'is' : ''} simulada${consultantsUsed > 1 ? 's' : ''}`;
      ctx.fillText('▸ ' + metric2, mtX, metricsY + 60);
    }

    const metric3 = `Caso real do mercado · sem múltipla escolha · sem gabarito`;
    ctx.fillText('▸ ' + metric3, mtX, metricsY + (consultantsUsed > 0 ? 88 : 60));

    // ====== COMPETÊNCIAS ======
    const compY = metricsY + (consultantsUsed > 0 ? 140 : 112);
    ctx.fillStyle = '#0a1628';
    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillText('COMPETÊNCIAS DEMONSTRADAS', 80, compY);

    ctx.font = '400 19px "Montserrat", sans-serif';
    ctx.fillStyle = '#0a1628';
    const strengths = (diagnosis && diagnosis.strengths) || [];
    const items = strengths.slice(0, 3).map(s => (s.description || '').substring(0, 100));
    let cy = compY + 30;
    for (const it of items) {
      const lines = wrapText(ctx, '• ' + it, 920);
      for (const ln of lines.slice(0, 2)) {
        ctx.fillText(ln, 80, cy);
        cy += 26;
      }
      cy += 4;
    }

    // ====== BORDÃO INSTITUCIONAL (selo conceitual) ======
    // Posição fixa próxima ao rodapé, em destaque
    const bordaoY = 930;

    // Caixa de fundo sutil
    ctx.fillStyle = '#E8F4FF';
    ctx.fillRect(80, bordaoY - 28, 920, 56);

    // Linha lateral de destaque
    ctx.fillStyle = '#0074C7';
    ctx.fillRect(80, bordaoY - 28, 4, 56);

    ctx.fillStyle = '#0a1628';
    ctx.font = 'italic 600 22px "Playfair Display", Georgia, serif';
    ctx.fillText('"Conhecer para decidir. Decidir para fazer diferença."', 104, bordaoY + 6);

    // ====== RODAPÉ REFORÇADO ======
    // Linha "MÉTODO ACTIVE IA"
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('MÉTODO ACTIVE IA', 80, 1010);

    // Descrição curta da metodologia
    ctx.fillStyle = '#475569';
    ctx.font = '400 14px "Montserrat", sans-serif';
    ctx.fillText('Simulação profissional avaliada por IA em tempo real · Galícia Educação', 80, 1034);

    // Data (canto direito)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 13px "JetBrains Mono", monospace';
    const dateStr = new Date(state.completedAt || Date.now()).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr.toUpperCase(), 1000, 1034);
    ctx.textAlign = 'left';

    // Faixa inferior (gradiente Galícia)
    ctx.fillStyle = grad;
    ctx.fillRect(0, 1072, 1080, 8);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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

  const LINKEDIN_METHOD_BLOCK = `O Active IA é a metodologia da Galícia Educação que substitui prova por simulação profissional. A inteligência artificial avalia o raciocínio do aluno, não a resposta. Fundamentada em pesquisas de Stanford, UCLA e Harvard sobre como adultos efetivamente desenvolvem competência prática.`;

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

      const userMsg = `Produza UM PARÁGRAFO de recapitulação para uma postagem de LinkedIn em primeira pessoa do aluno.

CONTEXTO:
- Nome do simulador: ${config.name}
- Disciplina/módulo: ${config.module || 'pós-graduação Galícia'}
- Papel que o aluno assumiu: ${role.substring(0, 300)}
- Arquétipo do caso (cenário base): ${archetypeDescription}
- Nível jogado: ${config.levels[state.level].label}
- Turnos jogados: ${turnsPlayed}
- Consultas a colegas: ${consultantsUsed}
- Perfil de articulação turno a turno: ${articulationProfile}
- Pontos fortes: ${(diagnosis?.strengths || []).map(s => s.description).slice(0, 3).join(' | ')}

REQUISITOS DO PARÁGRAFO:
- Primeira pessoa do aluno ("assumi o papel de...", "conduzi...", "articulei...").
- 3 a 5 frases. Profissional, sóbrio, sem hipérbole.
- Mencione concretamente o que o aluno FEZ (não o que aprendeu, não como se sentiu).
- Pode citar a natureza do caso (sem revelar diagnóstico se for de saúde — fale do desafio enfrentado).
- Termine com uma frase descrevendo COMO A IA AVALIOU (algo como: "A IA não corrigiu certo ou errado: avaliou as premissas que assumi, os riscos que mapeei, os riscos que ignorei").
- NÃO use emoji. NÃO use markdown. NÃO use JSON. Apenas o texto do parágrafo.
- NÃO comece com "Eu". Comece com verbo de ação ou contexto.

Apenas o parágrafo. Nada antes, nada depois.`;

      const result = await callAPI({
        systemFixed: 'Você é um redator profissional ajudando um aluno a recapitular sua experiência em uma simulação Active IA da Galícia Educação para postagem no LinkedIn. Tom: profissional, sóbrio, primeira pessoa, sem hipérbole. Apenas texto livre. Nunca JSON, nunca markdown.',
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
    const moduleRef = config.module ? ` na pós-graduação em ${config.module.replace(/—.*$/, '').trim()}` : '';
    const intro = `Hoje conclui mais uma simulação Active IA${moduleRef} da Galícia Educação. ${recapBlock}`;

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
          <div style="font-size:11px; color:var(--gal-text-2, #475569); margin-top:6px; text-align:center; font-family:'JetBrains Mono', monospace;">IMAGEM 1080×1080</div>
        </div>
        <div>
          <div style="font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:0.1em; color:var(--gal-azul-escuro, #0074C7); font-weight:600; margin-bottom:6px;">TEXTO SUGERIDO</div>
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
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--gal-azul-escuro, #0074C7);
  font-weight: 600;
  text-transform: uppercase;
}
.activeia-modal-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 20px;
  font-weight: 600;
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
  font-family: 'JetBrains Mono', monospace;
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
      linkedinCard: generateLinkedInCard,
      linkedinCaption: linkedinCaption,
      shareLinkedInModal: shareLinkedInModal,
      shareLinkedIn: shareToLinkedIn,
      buildDashboardHTML: buildDashboardHTML
    },
    ui: { showLoading, hideLoading, showError, hideError },
    daily: { isBlocked: isDailyBlocked, markComplete: markDayComplete, getTimer: getDailyTimer },
    session: { save: saveSession, load: loadSession, clear: clearSession },
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
