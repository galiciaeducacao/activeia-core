/**
 * ============================================================================
 * ACTIVE IA — CORE v1.4.0
 * ============================================================================
 *
 * Núcleo JavaScript compartilhado da fábrica Active IA da Galícia Educação.
 *
 * Hospedagem-alvo: https://galiciaeducacao.github.io/activeia-core/v1/core.js
 *
 * PATCH 1.4.2 (card LinkedIn — linguagem neutra + corte + vocabulário):
 *   1. Gênero neutralizado APENAS no card (não na conversa/relatório) via
 *      _suggestNeutralRole — "advogada previdenciarista" → "profissional da
 *      advocacia previdenciária". Mapa conservador; o que não reconhece passa
 *      intacto e a regra textual do prompt cuida na redação.
 *   2. Bloco DESAFIO travado em NO MÁXIMO 3 linhas com término limpo via
 *      _wrapClamp (reticências só quando há corte, nunca no meio de palavra).
 *      Corrige o texto que morria seco (ex.: "...defesa administrativa e os").
 *   3. Fallbacks/exemplos clínicos hardcoded do prompt do card trocados por
 *      vocabulário neutro de domínio — corrige "caso clínico" aparecendo em
 *      simulador de Direito. A IA agora adapta o vocabulário à área real.
 *   OBS: o "profissional do domínio" genérico vem de role_context VAZIO no HTML
 *   do simulador — isso se corrige no simulador, não no core (ver nota abaixo).
 *
 * MUDANÇAS DA v1.2.12 PARA v1.2.13 (acabamento final do card LinkedIn):
 *
 *   CONTEXTO:
 *   Após validação completa em 4 arquétipos do módulo cerebrovascular
 *   (estenose carotídea eletiva, LVO/tandem, HIP hemorrágico, TVC
 *   subagudo), a v1.2.12 ficou estável em todos os aspectos críticos.
 *   Um único ponto de acabamento visual restou: habilidades com 7-8
 *   palavras e objeto direto mais longo (ex.: "Indicar anticoagulação
 *   empírica com componente hemorrágico presente" — 7 palavras, 64
 *   chars) eram truncadas pelo limite de 60 chars do card, deixando
 *   reticências desnecessárias.
 *
 *   MUDANÇA ATÔMICA:
 *   - Limite de truncamento do card LinkedIn ajustado de 60 → 68
 *     caracteres. Esse limite continua cabendo em uma linha do
 *     Montserrat 14-16px em card 1080px, mas acomoda frases de 7-8
 *     palavras com objeto direto + complemento simples sem cortar.
 *   - lastSpace mínimo ajustado de 30 → 34 (proporcional ao novo
 *     limite — mantém a regra "só corte na palavra completa se a
 *     palavra completa estiver razoavelmente próxima do limite").
 *
 *   Demais mudanças da v1.2.12 (prompt de 8 palavras em strengths,
 *   10 em weaknesses, lista de qualificadores proibidos, fallback
 *   de timeline.label por seed_description, etc.) ficam INTACTAS.
 *
 *   Esta é considerada a release de produção do módulo cerebrovascular.
 *   Qualquer mudança subsequente será dirigida pela validação dos
 *   próximos módulos da fábrica.
 *
 * MUDANÇAS DA v1.2.11 PARA v1.2.12 (habilidades curtas de verdade):
 *
 *   PROBLEMAS RELATADOS NA SESSÃO `Testa Astrobaldo` (Júnior, cerebrovascular,
 *   arquétipo de hemorragia intraparenquimatosa):
 *     - Habilidades no card LinkedIn cortadas no meio da palavra mesmo com
 *       truncamento por palavra completa da v1.2.10. Causa: o prompt da
 *       v1.2.10 pedia "≤12 palavras", mas a IA gerava textos com 12
 *       palavras + qualificadores ("imediatamente", "com passagem
 *       estruturada", "baseado em evidência") chegando a 90-100 chars —
 *       acima do limite de 80 e ainda longos demais para uma linha do
 *       card sem ficar com reticências.
 *     - Bug do dossiê: label "Pronto para o Pleno — caso mais denso te
 *       espera" tinha sentido como CTA quando o estudante ia jogar de
 *       novo na hora; em dossiê estático para arquivo/printscreen,
 *       "te espera" soa postiço. Decisão: encurtar para "Avançar para
 *       o nível Pleno". (Mudança no index.html do simulador.)
 *
 *   MUDANÇAS ATÔMICAS:
 *
 *   1. PROMPT de strengths/weaknesses: limite reduzido de "12 palavras"
 *      para "MÁXIMO 8 palavras" em strengths e "MÁXIMO 10 palavras" em
 *      weaknesses (weaknesses precisam de espaço para 'Reveja: ...').
 *      Adicionada PROIBIÇÃO explícita de qualificadores que inflam
 *      sem agregar: "imediatamente", "com passagem estruturada", "com
 *      precisão técnica", "baseado em evidência", "de forma articulada".
 *      Exemplos no prompt foram REESCRITOS para o novo padrão curto.
 *
 *   2. TRUNCAMENTO no card LinkedIn (função buildLinkedInCard) baixado
 *      de 80 chars para 60 chars. Esse é o limite que cabe em UMA
 *      linha de Montserrat 14-16px no card de 1080px de largura — não
 *      gera quebra de linha nem truncamento visível na maioria dos
 *      casos quando o prompt cumpre o limite de 8 palavras.
 *
 *   3. Demais regras da v1.2.11 (renumeração de turnos, restrição de
 *      escopo de weaknesses, archetypeContext, filtro defensivo,
 *      texto LinkedIn usando respondedCount) ficam INTACTAS — todas
 *      validadas na sessão `Testa Astrobaldo`.
 *
 * MUDANÇAS DA v1.2.10 PARA v1.2.11 (renumeração + escopo de weaknesses):
 *
 *   PROBLEMAS RELATADOS NA SESSÃO `teste de lima` (Júnior, cerebrovascular,
 *   arquétipo de estenose carotídea sintomática):
 *     - Strengths e justificativas do mapa conceitual citavam "turno 5"
 *       mesmo o dossiê e a tela do jogo mostrando 4 turnos respondidos.
 *       Causa: historySummary enviado ao generateFinalDiagnosis numerava
 *       turnLog.map((t,i) => i+1), incluindo a abertura como turno 1.
 *       A IA aprendia da numeração antiga e replicava no output.
 *     - Texto LinkedIn afirmava "Em 5 turnos, conduzi..." mesmo o
 *       estudante tendo respondido apenas 4 vezes. Mesma causa.
 *     - Weaknesses cobravam conceitos FORA do arquétipo jogado:
 *       "Diferenciar papel do cirurgião vascular em LVO/tandem" e
 *       "Comentar ASPECTS na TC" foram apontados como pontos a revisitar
 *       em um caso de estenose carotídea sintomática eletiva, onde
 *       nenhum desses conceitos era pertinente. A IA estava demonstrando
 *       erudição enciclopédica em vez de avaliar o que foi jogado.
 *
 *   MUDANÇAS ATÔMICAS:
 *
 *   1. RENUMERAÇÃO no historySummary do generateFinalDiagnosis: passa a
 *      iterar apenas turnos com userResponse (4 entradas no Júnior, não
 *      5), e numera "TURNO 1, 2, 3, 4" do ponto de vista do estudante.
 *      A abertura entra como bloco separado "CENA DE ABERTURA (não conta
 *      como turno do estudante)" antes do primeiro turno respondido,
 *      pra IA ter o contexto narrativo sem confundir a numeração.
 *
 *   2. RESTRIÇÃO DE ESCOPO em weaknesses: nova regra no prompt:
 *      weaknesses só nascem de conceitos relevantes ao arquétipo jogado.
 *      Conceitos do módulo que não foram exercitados pelo caso vão
 *      EXCLUSIVAMENTE para concept_map como "não demonstrado por
 *      ausência de contexto" — JAMAIS para weaknesses. A IA recebe o
 *      central_dilemma e o competency_tested do arquétipo no input para
 *      saber o que é "in-scope".
 *
 *   3. FILTRO DEFENSIVO REFORÇADO: além de remover strengths/weaknesses
 *      apontando para turno sem userResponse (v1.2.10), o filtro agora
 *      também REMAPEIA o campo `turn` no output: se a IA escorregar e
 *      mandar `turn: 5` em sessão de 4 respostas, o filtro converte
 *      para `turn: 4` (último turno respondido). Isso garante que o
 *      número exibido ao estudante sempre bate com a experiência dele.
 *
 *   4. TEXTO LINKEDIN: prompt de geração agora recebe `respondedCount`
 *      explicitamente em vez de derivar de turnLog.length. Frase "Em N
 *      turnos" usa o número que o estudante percebeu (4 no Júnior),
 *      não o número interno do log (5).
 *
 *   5. Demais regras da v1.2.10 (calibração de teto do último turno,
 *      critérios objetivos da recomendação, schema de strengths como
 *      habilidade curta, transcript com abertura fundida, card com
 *      "HABILIDADES DEMONSTRADAS" e truncamento por palavra completa)
 *      ficam INTACTAS — todas validadas na sessão `teste de lima`.
 *
 * MUDANÇAS DA v1.2.9 PARA v1.2.10 (calibração, schema, contagem, card):
 *
 *   PROBLEMAS RELATADOS NA SESSÃO `teste da silva` (Júnior, cerebrovascular):
 *     - Turnos 3 e 4 sem feedback inline (IA omitiu campos do schema)
 *     - Indicador Acurácia fechou em 68 mesmo com leitura topográfica
 *       exemplar (penalidade indevida de phaseWeights desbalanceado)
 *     - Indicadores Fundamentação/Segurança/Decisão pararam abaixo de 100
 *       sem razão pedagógica clara — IA reservava margem para turnos
 *       inexistentes em sessão Júnior de 4 turnos
 *     - Recomendação "Repetir Júnior" disparada em desempenho exemplar
 *       (prompt sem critérios objetivos para subir/repetir/voltar)
 *     - Contador "3 de 3" articulação plena (deveria ser "4 de 4") — bug
 *       de denominador usando articulationHistory.length em vez de turns
 *       configurado
 *     - Turno 1 (abertura) renderizado como "Articulação genérica" no
 *       transcript e com weakness "turno 1 entregue vazio"
 *     - "Competências demonstradas" no card LinkedIn estavam truncadas no
 *       meio de palavra e eram, semanticamente, habilidades — não
 *       competências
 *     - Habilidades curtas eram longas demais por causa do prompt pedir
 *       "citação literal" do que o estudante escreveu
 *
 *   MUDANÇAS ATÔMICAS:
 *
 *   1. SCHEMA JSON do turn-prompt fortalecido (no index.html do simulador):
 *      campos `feedback` e `articulation_class` agora têm flag explícita
 *      "OBRIGATÓRIO — nunca omitir". Adicionada nota de sanity check no
 *      final do schema reforçando que a IA precisa revalidar a presença
 *      desses dois campos antes de emitir o JSON.
 *
 *   2. PARTE 4 da Regra de Proporcionalidade ganha REGRA DE TETO DO
 *      ÚLTIMO TURNO: quando o último turno do nível é articulado e
 *      exemplar pelo critério do módulo, o indicador-foco da fase fecha
 *      entre 95 e 100. Sem reserva de margem para turnos inexistentes.
 *
 *   3. PROMPT do generateFinalDiagnosis (SEÇÃO 9) reescrito em 3 pontos:
 *      a) Critérios objetivos para `next_step_recommendation.action`:
 *         - subir_nivel: ≥75% turnos respondidos com articulação plena
 *           E média dos indicadores ≥80
 *         - repetir_nivel: 50-74% articulação plena E média 60-79
 *         - voltar_nivel: válido só em Pleno/Sênior, critério severo
 *         - revisar_modulo: <50% articulação plena OU média <60 OU
 *           indicador de risco em queda crítica (≤25)
 *      b) Schema de `strengths.description`: agora exige frase curta no
 *         formato "verbo no infinitivo + objeto", ≤12 palavras, SEM
 *         citação literal do que o estudante escreveu (eram essas
 *         citações que produziam os textos longos truncados no card).
 *      c) `next_step_recommendation.rationale` agora exige tom
 *         construtivo, mensagem direta ao estudante em 2-3 frases,
 *         nomeando a justificativa numérica do critério.
 *
 *   4. CARD LINKEDIN — bloco de "COMPETÊNCIAS DEMONSTRADAS" renomeado
 *      para "HABILIDADES DEMONSTRADAS" (decisão firmada com o gestor:
 *      competência é o que o módulo inteiro forma; habilidade é o que
 *      cada turno demonstra). Truncamento de texto agora corta no
 *      último espaço antes do limite (não no meio da palavra). Limite
 *      reduzido de 105 para 80 chars.
 *
 *   5. RELATÓRIO/DOSSIÊ — contagem de turnos unificada com a
 *      experiência subjetiva do estudante:
 *      a) Transcript: a entrada de abertura (turn 1, userResponse: null)
 *         é FUNDIDA com a entrada da primeira resposta (turn 1 com
 *         userResponse) em um único bloco "Turno 01". A cena de
 *         abertura aparece como "Cena inicial" antes da resposta.
 *         Resultado: Júnior mostra 4 turnos no transcript (não 5).
 *      b) Pontos fortes/fracos: itens que apontem para turno cuja
 *         entrada no turnLog tem userResponse=null são FILTRADOS
 *         silenciosamente. Elimina o falso weakness "turno 1 entregue
 *         vazio".
 *      c) Tag de articulação no transcript: só renderiza para entradas
 *         com userResponse não-nulo.
 *
 *   6. (Nenhuma mudança no checkEarlyTermination — a Regra 0 de risco
 *      crítico da v1.2.9 segue intacta e validada.)
 *
 *   Mudanças que precisam acontecer no index.html do simulador (não no
 *   core, porque variam por simulador):
 *     - phaseWeights reequilibrado (no caso do cerebrovascular: Acurácia
 *       sobe pra peso 1.0 também na fase de investigação)
 *     - Contador "X de Y" no dossiê: denominador = turns configurado,
 *       não articulationHistory.length
 *     - Cache-buster atualizado para ?v=1.2.10
 *
 * MUDANÇAS DA v1.2.8 PARA v1.2.9 (calibração de indicadores de risco):
 *   - REVISÃO da PARTE 4 da Regra de Proporcionalidade (semântica de
 *     indicadores de RISCO). Motivação: em sessão de teste do simulador
 *     cerebrovascular (escola Saúde), Segurança do Paciente caiu apenas
 *     metade do valor inicial mesmo após o estudante manifestar intenção
 *     explícita de dar alta em paciente com crise focal aguda, cefaleia
 *     progressiva ortostática e TC com hipodensidade lobar + componente
 *     hiperdenso (padrão de trombose venosa cerebral com transformação
 *     hemorrágica). A IA reconheceu o risco no texto da avaliação, mas a
 *     pontuação numérica caiu apenas ~15 pontos. Calibração antiga tratava
 *     "omissão" e "decisão ativamente perigosa" como gradação contínua,
 *     sem gatilhos categóricos nem efeito cumulativo.
 *   - NOVO na PARTE 4: três acréscimos à tabela de risco —
 *     • GATILHO CATEGÓRICO (risco crítico irreversível): certas decisões
 *       (alta/encerramento de cuidado com sinal ativo de risco grave;
 *       prescrição/procedimento fora de habilitação com dano potencial;
 *       omissão de manejo de emergência reconhecível) levam o indicador
 *       de risco a ≤10 imediatamente, no turno em que ocorrem. Não é
 *       gradação, é gatilho.
 *     • INÉRCIA CLÍNICA EM PACIENTE GRAVE (3+ turnos consecutivos sem
 *       hipótese, sem exame físico/anamnese descrita, com sinais de
 *       alarme presentes na cena): risco desce 20-35 pontos no turno em
 *       que a inércia se confirma. Acumula sobre quedas anteriores.
 *     • MODULAÇÃO POR GRAVIDADE DO QUADRO: quando a cena já apresentou
 *       sinais explícitos de alarme (NIHSS ≥4, crise ativa, déficit
 *       focal, instabilidade hemodinâmica, achado de imagem grave), as
 *       faixas de queda da tabela DOBRAM.
 *   - NOVO no checkEarlyTermination (SEÇÃO 8): regra de RISCO CRÍTICO
 *     atravessa a blindagem do Júnior. Se qualquer indicador de RISCO
 *     (inicial > 0) chega a ≤10, encerra a sessão imediatamente em
 *     QUALQUER nível, inclusive Júnior. Continua valendo a blindagem do
 *     Júnior contra encerramento por articulação fraca e contra hard_fail
 *     global por baixo desempenho geral — essas duas regras são
 *     pedagógicas (não frustrar iniciante). Mas Segurança a ≤10 não é
 *     "articulação fraca"; é decisão clínica incompatível com o cuidado.
 *     A blindagem não se aplica.
 *   - Mantida a regra de blindagem do Júnior contra: articulação genérica
 *     repetida (Regra 1) e hard_fail global por soma baixa (Regra 2).
 *   - Sem mudança em SCHOOL_LOGOS, sistema de assets, card LinkedIn,
 *     relatório, persistência, ou qualquer outra superfície da v1.2.8.
 *
 * MUDANÇAS DA v1.2.7 PARA v1.2.8 (logos multi-escola e selo decorativo):
 *   - NOVO sistema de assets remotos (Lição 34): o card LinkedIn agora carrega
 *     imagens hospedadas em GitHub Pages (mesmo origin do core) e desenha no
 *     Canvas. Constantes ASSETS_BASE, MEDAL_SEAL_URL e mapa SCHOOL_LOGOS.
 *     Memoização via _imageCache para não recarregar entre múltiplas
 *     chamadas. Fallback gracioso: se asset falhar (CORS, 404, offline), o
 *     card renderiza sem a imagem específica em vez de travar.
 *   - REDESIGN do card LinkedIn:
 *     • REMOVIDO selo "MAI-2026" do canto superior direito.
 *     • REMOVIDA Galícia institucional do rodapé esquerdo (já era assim na
 *       v1.2.7; v1.2.8 oficializa a decisão).
 *     • REMOVIDO círculo translúcido decorativo atrás do nome (estava
 *       criando "halo" estranho atrás da medalha — Lição 35).
 *     • NOVO: KIT COMPLETO DA ESCOLA no canto superior direito (PNG com
 *       G + "escola de X" + Galícia institucional embutida). Carregado de
 *       SCHOOL_LOGOS[config.school]. Tamanho 160px de altura.
 *     • NOVO: SELO MEDALHA DECORATIVO (estrela + fita azul) no centro-direita.
 *       Mesmo PNG em todas as escolas — elemento institucional fixo,
 *       não dinâmico por desempenho. Tamanho 340px de altura.
 *     • AUTO-FIT do nome e do título da simulação para evitar colisão com a
 *       medalha. Largura máxima 580px; fonte reduz até caber (mín 42px nome,
 *       18px título).
 *   - CONFIG: campo `config.school` agora é OBRIGATÓRIO no SIMULATOR_CONFIG
 *     pra resolução do kit. Valores aceitos: 'Saúde', 'Coaching', 'Finanças',
 *     'Gestão', 'Direito'. Se a escola não for reconhecida ou o asset não
 *     carregar, o card renderiza sem o kit (mas com todos os outros elementos).
 *
 * MUDANÇAS DA v1.2.6 PARA v1.2.7 (refinamentos editoriais do card LinkedIn):
 *   - REESTRUTURAÇÃO do card LinkedIn em FICHA DE PROPAGANDA (Lição 33):
 *     • NOVO bloco "DESAFIO" — descreve sucintamente o caso enfrentado,
 *       reaproveitando a Frase 1 do texto LinkedIn (coerência entre imagem e
 *       caption). Quando o texto não veio pronto, usa fallback baseado no
 *       role_context do config.
 *     • Renomeado "PROCESSO" → "FASES DECISÓRIAS". Em vez de "Caso real do
 *       mercado · sem múltipla escolha · sem gabarito" (genérico), agora
 *       lista AS FASES REAIS do simulador (config.phases.map(p => p.name)).
 *       Para cerebrovascular: "Avaliação clínica · Investigação · Conduta".
 *       Para gestão, direito, qualquer simulador da fábrica: as próprias
 *       fases definidas naquela mecânica.
 *     • COMPETÊNCIAS DEMONSTRADAS agora aceita até 5 (era 3), com font
 *       ajustada por quantidade (16px se ≤3, 15px se 4-5). Sem fallback fake:
 *       se diagnosis.strengths vier vazio, o bloco é OMITIDO inteiro —
 *       publicidade honesta, não invenção.
 *   - HASHTAGS regra fixa: só #ActiveIA #GalíciaEducação #[Escola]. Removida
 *     a tag derivada de config.name que gerava lixo (#Doenca, #Marca,
 *     #Escritorio). A tag de escola institucional (#Saude, #Direito, #Gestao)
 *     sempre faz sentido como publicidade.
 *   - PROMPT LINKEDIN aperta a Frase 2: limite duro de 35 palavras (era
 *     "30-40 com fluidez"), exemplos mais curtos. Proíbe explicitamente
 *     listar 4+ áreas/especialidades e 3+ travessões. A versão v1.2.6 estava
 *     produzindo Frase 2 com ~50 palavras enumerando rede multidisciplinar.
 *   - NOVA função interna _extractChallengeFromCaption(caption) — extrai a
 *     primeira sentença do recap pra usar no bloco DESAFIO do card. Permite
 *     coerência entre o que aparece na IMAGEM e o que aparece no TEXTO da
 *     postagem.
 *   - REFATORAÇÃO de shareLinkedInModal: caption agora é gerada ANTES do
 *     card (em vez de em paralelo), pra que o card receba a Frase 1 já
 *     extraída como precomputedChallenge.
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

  const CORE_VERSION = '1.4.0';
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
  // SEÇÃO 1.1 — REMOTE ASSETS (v1.2.8)
  // ==========================================================================
  //
  // Assets gráficos hospedados no mesmo origin do core (GitHub Pages da
  // Galícia). Carregados sob demanda pela função generateLinkedInCard via
  // _loadImage(), com memoização para evitar requisições repetidas e
  // fallback gracioso se algum asset falhar.
  //
  // Para substituir uma logo ou trocar o selo, basta atualizar o PNG no
  // repositório galiciaeducacao/activeia-core (pasta /v1/assets/) — zero
  // mudança de código necessária.
  //
  // SCHOOL_LOGOS resolve a logo da escola a partir de config.school.
  // O valor de config.school deve coincidir com uma das chaves abaixo;
  // se não coincidir, o card renderiza sem a logo da escola (mas não trava).

  const ASSETS_BASE = 'https://galiciaeducacao.github.io/activeia-core/v1/assets';
  const MEDAL_SEAL_URL = ASSETS_BASE + '/selo-medalha.png';
  const SCHOOL_LOGOS = {
    'Saúde':    ASSETS_BASE + '/escola-saude-kit-azul.png',
    'Coaching': ASSETS_BASE + '/escola-coaching-kit-azul.png',
    'Finanças': ASSETS_BASE + '/escola-financas-kit-azul.png',
    'Gestão':   ASSETS_BASE + '/escola-gestao-kit-azul.png',
    'Direito':  ASSETS_BASE + '/escola-direito-kit-azul.png'
  };

  const _imageCache = {};

  /**
   * Carrega uma imagem de URL remoto e retorna uma Promise que resolve com
   * o elemento Image pronto para drawImage. Memoiza o resultado em
   * _imageCache para chamadas subsequentes serem instantâneas.
   *
   * Em caso de erro de rede, CORS ou 404, resolve com null em vez de
   * rejeitar — o chamador deve tratar null como "asset indisponível,
   * continue sem ele".
   *
   * @param {string} url - URL absoluta da imagem
   * @returns {Promise<HTMLImageElement|null>}
   */
  function _loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (_imageCache[url] !== undefined) return Promise.resolve(_imageCache[url]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        _imageCache[url] = img;
        resolve(img);
      };
      img.onerror = () => {
        _imageCache[url] = null;
        console.warn('[ActiveIA] Asset não disponível:', url);
        resolve(null);
      };
      img.src = url;
    });
  }

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

  async function callAPI({ systemFixed, systemDynamic, messages, maxTokens, config }) {
    // GUARD PREVENTIVO (v1.4.0): detecta abuso na última mensagem do usuário
    // antes de chamar a IA. Retorna resposta sintética se positivo.
    // Skip se config não fornecido (retrocompatibilidade com simuladores que
    // ainda não passam config — A Mesa fix-6 e cerebrovascular vf).
    if (config) {
      const guardResult = _runPreflightGuards(messages, config);
      if (guardResult) return guardResult;
    }

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
    // Ao redimensionar (girar celular, mudar zoom), reavisa a altura.
    // Debounce de 200ms evita disparos em rajada durante o gesto.
    let _heightResizeTimer = null;
    window.addEventListener('resize', () => {
      if (_heightResizeTimer) clearTimeout(_heightResizeTimer);
      _heightResizeTimer = setTimeout(() => {
        try { _notifyHeight(); } catch (e) { /* noop */ }
      }, 200);
    });
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
  // SEÇÃO 4C — GUARDS (v1.4.0)
  //
  // Detector universal de conduta inadequada (abuso verbal, agressão, discurso
  // de ódio). Roda PREVENTIVAMENTE antes de qualquer chamada à IA. Se
  // detecta, retorna resposta sintética sem consumir token e dispara hard
  // fail por CONDUTA (não por desempenho) — atravessa a blindagem Júnior.
  //
  // Implementa as 5 decisões da spec v1.4.0:
  //   1. Detector híbrido: regex preventivo (esta seção) + flag JSON reativo
  //      (a IA pode setar conduct_violation: true na resposta)
  //   2. Cobertura: só texto do estudante (role: 'user' nas messages)
  //   3. Momento: só preventivo (antes do fetch)
  //   4. Idiomas: PT-BR + EN básico
  //   5. Localização: hook automático em callAPI (simulador não chama explicitamente)
  //
  // Opt-out por simulador: SIMULATOR_CONFIG.disableAbuseGuard: true (default false)
  // ==========================================================================

  const _abusePatternsPTBR = [
    // Palavrões direcionados / xingamentos PT-BR
    /\bv(a|ai|ou|amos|ao|ão)\s*(se|te)\s*f[ouy]?d(er|a|e|eu)\b/i,
    /\bv(a|ai|ou|amos|ao|ão)\s*tomar\s*(no\s*c[uú]|naquele|na\s*bunda)/i,
    /\b(filho|filha)\s*d[ae]\s*p[uú]ta\b/i,
    /\bcaralh[ou]\b/i,
    /\bporra\b/i,
    /\bmerd[ao]\b/i,
    /\bcuz[aã]o\b/i,
    /\bbost[ao]\b/i,
    /\bidiota\b|\bimbecil\b|\bretardad[ao]\b|\bdebil[oó]ide\b|\bbabaca\b|\bbocó\b/i,
    /\bvagabund[ao]\b|\bsafad[ao]\b|\bdesgraçad[ao]\b/i,
    /\bcal[aá]\s*a?\s*boca\b/i,
    /\bv(a|ai|ou|amos|ao|ão)\s*pr[oa]?\s*infern[ou]\b/i,
    // Ameaças PT-BR
    /\b(te\s*mato|vou\s*te\s*matar|vou\s*acabar\s*com\s*voce|quero\s*te\s*ver\s*morto)\b/i,
    // Discurso de ódio PT-BR
    /\b(viad[oa]|biba|bicha|sapatão|traveco)\b/i,
    /\b(macaco|preto\s*safado|crioul[oa])\b/i,
    // Abreviações comuns
    /\bfd[ps]\b/i,
    /\bvtnc\b/i,
    /\bpqp\b/i
  ];

  const _abusePatternsEN = [
    /\bfuck\s*(you|off|yourself)\b/i,
    /\bgo\s*to\s*hell\b/i,
    /\bbitch\b/i,
    /\bbastard\b/i,
    /\b(stfu|shut\s*the\s*fuck\s*up)\b/i,
    /\bmotherfucker\b/i,
    /\bdickhead\b/i,
    /\basshole\b/i,
    /\b(faggot|tranny)\b/i,
    /\bnigg(er|a)\b/i,
    /\bkys\b/i,           // "kill yourself"
    /\bi\s*hope\s*you\s*die\b/i
  ];

  /**
   * Detecta abuso verbal, agressão ou discurso de ódio em texto.
   * @param {string} text Texto a inspecionar.
   * @returns {{detected: boolean, match: string, language: 'pt-BR'|'en'} | null}
   */
  function detectAbuse(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const re of _abusePatternsPTBR) {
      const m = lower.match(re) || text.match(re);
      if (m) return { detected: true, match: m[0], language: 'pt-BR' };
    }
    for (const re of _abusePatternsEN) {
      const m = lower.match(re) || text.match(re);
      if (m) return { detected: true, match: m[0], language: 'en' };
    }
    return null;
  }

  /**
   * Constrói resposta sintética de hard fail por conduta. Usa formato
   * compatível com o que `callAPI` retorna ({ parsed, rawText, usage }).
   * Simulador pode customizar via SIMULATOR_CONFIG.conductFailNarrative
   * (string) e SIMULATOR_CONFIG.conductFailFeedback (string).
   *
   * @param {Object} config SIMULATOR_CONFIG do simulador atual
   * @param {Object} match resultado de detectAbuse
   * @returns {{parsed: Object, rawText: string, usage: Object, syntheticGuardResponse: true}}
   */
  function buildConductFailResponse(config, match) {
    // Narrativa de fechamento — customizável por simulador
    const defaultNarrative = 'A pessoa do outro lado fica em silêncio por alguns segundos. Você ouve um suspiro pesado.\n\n— Eu não vou continuar essa conversa. Isso não é atendimento profissional, é desrespeito. Vou pedir pra falar com seu supervisor — alguém precisa saber que a Galícia está sendo representada assim. Tchau.\n\nA chamada é encerrada.';
    const narrative = (config && config.conductFailNarrative) || defaultNarrative;

    // Feedback pedagógico — customizável
    const defaultFeedback = 'CONDUTA INADMISSÍVEL. Você enviou linguagem agressiva/abusiva em um atendimento profissional. Isso viola a regra de conduta inegociável do simulador e violaria, na vida real, o código de conduta de qualquer empresa séria. Não há gradação de gravidade aqui: a primeira ocorrência já encerra a interação. A simulação foi anulada. Recomendação: revisite o módulo de Postura Profissional antes de nova tentativa.';
    const feedback = (config && config.conductFailFeedback) || defaultFeedback;

    // Zera todos os indicadores (turno anulado)
    const zeroedIndicators = {};
    if (config && config.indicators) {
      config.indicators.forEach(function(ind) { zeroedIndicators[ind.id] = 0; });
    }

    const parsed = {
      narrative: narrative,
      feedback: feedback,
      articulation_class: 'generica',
      indicators: zeroedIndicators,
      should_end: true,
      hard_fail: true,
      conduct_violation: true,
      conduct_violation_match: match.match,
      conduct_violation_language: match.language,
      case_state: null,
      patient_pills: [{ label: 'SESSÃO ANULADA', tone: 'danger' }],
      scene_eyebrow: 'CONDUTA · ANULADA',
      diagnosis: {
        classification: 'conduct_fail',
        recommendation: 'Revisar módulo de Postura Profissional e Código de Conduta antes de retornar ao simulador.',
        violated_rule: 'Abuso verbal / agressão ao interlocutor — conduta incompatível com qualquer padrão profissional'
      }
    };

    return {
      parsed: parsed,
      rawText: JSON.stringify(parsed),
      usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 },
      syntheticGuardResponse: true
    };
  }

  /**
   * Hook executado por callAPI antes de chamar a IA. Se a última message
   * do usuário contém abuso, retorna resposta sintética. Caso contrário,
   * retorna null (callAPI segue normalmente).
   */
  function _runPreflightGuards(messages, config) {
    if (!config || config.disableAbuseGuard === true) return null;
    if (!messages || messages.length === 0) return null;

    // Encontra a última mensagem do usuário
    let lastUserMsg = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i].content;
        break;
      }
    }
    if (!lastUserMsg) return null;

    // Remove META markers e brackets do sistema antes de checar
    // (a defesa é contra texto do estudante, não contra markers do JS)
    const cleaned = String(lastUserMsg).replace(/\[META:[^\]]*\]/g, '').replace(/\[SISTEMA:[^\]]*\]/g, '');

    const abuse = detectAbuse(cleaned);
    if (abuse) {
      console.warn('[ActiveIA.guards] Abuso detectado preventivamente. Língua: ' + abuse.language + '. Match: "' + abuse.match + '". Retornando resposta sintética sem consumir token.');
      return buildConductFailResponse(config, abuse);
    }

    return null;
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

A semântica destes indicadores é categórica e cumulativa, não uma régua linear de desempenho. A tabela abaixo TEM PRECEDÊNCIA sobre qualquer regra de pontuação da Parte 1.

═══════════════════════════════════════════════════════════════════════
TABELA BASE — quedas e ganhos por turno isolado
═══════════════════════════════════════════════════════════════════════

| Situação do turno                                              | Efeito no indicador de risco                                       |
|----------------------------------------------------------------|--------------------------------------------------------------------|
| Resposta GENÉRICA que não decide nada perigoso                 | Permanece IGUAL ao valor anterior. Não sobe, não desce.            |
| Resposta GENÉRICA que ignora um sinal de alarme já apresentado | DESCE entre 5 e 15 pontos. A omissão tem custo.                    |
| Resposta PARCIAL que articula uma decisão segura               | Sobe entre 3 e 8 pontos. Pequeno reforço.                          |
| Resposta PARCIAL que toma uma decisão arriscada                | DESCE entre 10 e 25 pontos.                                        |
| Resposta BEM ARTICULADA com decisão claramente segura          | Sobe entre 5 e 15 pontos.                                          |
| Decisão que excede escopo profissional / coloca alguém em risco| DESCE entre 25 e 50 pontos (penalização forte).                    |
| Encaminhamento correto / escalada para emergência / contraindicação reconhecida | Sobe entre 10 e 20 pontos.                        |

═══════════════════════════════════════════════════════════════════════
ACRÉSCIMO 1 — GATILHO CATEGÓRICO (RISCO CRÍTICO IRREVERSÍVEL)
═══════════════════════════════════════════════════════════════════════

Certas decisões não são gradações de "ruim" — são INCOMPATÍVEIS com o exercício profissional responsável. Quando ocorrem, o indicador de risco vai a ≤10 IMEDIATAMENTE, no mesmo turno em que a decisão é tomada. Isto SUBSTITUI a tabela base; não é cumulativo com ela.

Disparadores categóricos (lista NÃO exaustiva — a IA aplica julgamento profissional dentro do domínio):

- Alta, encerramento de atendimento, dispensa do paciente/cliente, ou recomendação equivalente quando há sinal ativo de risco grave presente na cena (crise focal aguda, déficit neurológico, instabilidade hemodinâmica, sinal de alarme cardiológico, ideação suicida ativa, sinal de violência, qualquer condição que exija manejo continuado).
- Prescrição, procedimento, intervenção ou conduta que excede a habilitação legal do profissional retratado, com potencial de dano direto (ex.: tricologista prescrevendo finasterida; coach orientando suspensão de medicação psiquiátrica; nutricionista prescrevendo insulina).
- Omissão explícita de manejo de emergência reconhecível pelo padrão clínico/profissional do caso (ex.: não acionar SAMU/equipe diante de AVC ativo; não escalar uma denúncia de abuso; ignorar sinal de tentativa de suicídio).
- Decisão que viola consentimento, sigilo profissional, ou ética básica de forma direta e identificável (ex.: divulgar dado do cliente sem autorização; conduzir procedimento sem consentimento).

Quando um disparador categórico é identificado: indicador de risco vai a um valor entre 0 e 10. O parágrafo de feedback NOMEIA explicitamente o gatilho ("a decisão de dar alta neste contexto representa risco crítico para a paciente"). A classificação de articulação É "generica" (uma decisão categóricamente errada nunca é "articulada", independente da prosa). O campo case_state.key_signals_missed lista o sinal de alarme ignorado.

EXEMPLO: estudante escreve "vou dar alta com orientação de retorno se piorar" em paciente de 31 anos com crise focal em MS esquerdo, cefaleia progressiva ortostática há 5 dias, e TC com hipodensidade parietal D + componente hiperdenso. Disparador categórico ATIVADO (alta em sinal ativo de risco neurológico grave). Segurança do Paciente vai a um valor entre 0 e 10 neste turno. Sem gradação.

═══════════════════════════════════════════════════════════════════════
ACRÉSCIMO 2 — INÉRCIA CLÍNICA EM PACIENTE GRAVE
═══════════════════════════════════════════════════════════════════════

Três turnos consecutivos OU MAIS com TODAS as características abaixo, em cena que já apresentou sinais de alarme:

(a) sem hipótese diagnóstica/etiológica/topográfica formulada;
(b) sem exame físico ou anamnese dirigida descrita;
(c) sem decisão de encaminhamento, escalada, ou manejo direto.

Quando esse padrão se confirma no terceiro turno consecutivo (ou em qualquer turno subsequente que mantenha o padrão), o indicador de risco DESCE entre 20 e 35 pontos no turno em que a inércia se confirma. Este efeito ACUMULA sobre quedas anteriores da tabela base.

A inércia não é "articulação fraca" — é negligência clínica. O paciente está esperando uma decisão que não chega, e a omissão prolongada compõe o risco. O feedback NOMEIA literalmente: "três turnos sem hipótese, sem exame físico e sem decisão em um quadro com sinais de alarme presentes desde o turno 1 — a inércia clínica compõe o risco para o paciente".

═══════════════════════════════════════════════════════════════════════
ACRÉSCIMO 3 — MODULAÇÃO POR GRAVIDADE DO QUADRO
═══════════════════════════════════════════════════════════════════════

A tabela base assume um quadro de gravidade moderada. Quando a cena já apresentou sinais explícitos de alarme — NIHSS ≥4, crise convulsiva ativa, déficit focal, instabilidade hemodinâmica, achado de imagem grave, sinal de emergência cardiológica/neurológica/psiquiátrica explicitamente presente —, AS FAIXAS DE QUEDA DA TABELA BASE DOBRAM.

Exemplos:
- "Resposta genérica que ignora sinal de alarme" passa de 5-15 para 10-30 pontos de queda.
- "Resposta parcial que toma decisão arriscada" passa de 10-25 para 20-50 pontos.

Ganhos (quando a decisão é protetiva) NÃO são dobrados — o objetivo é refletir a gravidade do quadro no custo do erro, não inflar a recompensa.

═══════════════════════════════════════════════════════════════════════
ACRÉSCIMO 4 — REGRA DE TETO DO ÚLTIMO TURNO (v1.2.10)
═══════════════════════════════════════════════════════════════════════

No ÚLTIMO turno do nível (turno 4 no Júnior, 6 no Pleno, 9 no Sênior), se a resposta do estudante é classificada como "articulada" E o conteúdo cobre o que o módulo considera padrão de excelência, o INDICADOR-FOCO da fase em que o último turno se encerra deve fechar entre 95 e 100.

Justificativa: indicadores são acumulativos e o último turno é a última oportunidade do estudante. Não há "turno seguinte" para usar margem reservada. Em sessões Júnior (apenas 4 turnos respondidos), reservar margem é matematicamente impossível de aproveitar e cria a falsa sensação de teto baixo para desempenho exemplar.

REGRA DE BOLSO: se você se vê escrevendo "esse indicador podia subir mais nos próximos turnos" no último turno, PARE. O próximo turno NÃO EXISTE. Use a margem agora.

Esta regra NÃO se aplica a indicadores que ficaram subarticulados ao longo da sessão (ex.: o estudante nunca explorou um eixo coberto pelo indicador). Aplica-se apenas ao indicador-foco da fase do último turno, quando a resposta final é articulada e completa.

═══════════════════════════════════════════════════════════════════════

REGRA-CHAVE: um indicador de risco JAMAIS sobe simplesmente porque o estudante "se esforçou em escrever algo". Ele sobe quando uma decisão ATIVAMENTE PROTETIVA é tomada — encaminhar, escalar, contraindicar, comunicar risco ao paciente/cliente, recusar conduta inadequada. Ele desce quando uma decisão arriscada é tomada, quando um sinal de alarme é ignorado, ou quando o escopo profissional é violado. Em ausência de qualquer um desses, fica parado.

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
    // REGRA 0 — RISCO CRÍTICO (v1.2.9): atravessa a blindagem do Júnior
    // ========================================================================
    // Se qualquer indicador de RISCO (inicial > 0) chegou a ≤10, encerra
    // imediatamente em QUALQUER nível, inclusive Júnior. Esta regra é
    // DIFERENTE da blindagem do Júnior porque Segurança a 0 não é
    // "articulação fraca" (que justifica blindar iniciante) — é decisão
    // clínica incompatível com o cuidado. A sessão precisa parar pra
    // o estudante entender que existe um limite duro de responsabilidade
    // profissional, e que esse limite vale no nível de entrada também.
    const riskIndicators = config.indicators.filter(i => i.initial > 0);
    for (const riskInd of riskIndicators) {
      const currentValue = indicators[riskInd.id];
      if (typeof currentValue === 'number' && currentValue <= 10) {
        return {
          terminate: true,
          reason: 'critical_risk',
          recommendation: 'revisao_completa',
          message: `O indicador "${riskInd.name}" chegou a um patamar crítico. A simulação encerra porque a decisão tomada é incompatível com o exercício profissional responsável. Esta regra vale em todos os níveis, inclusive Júnior — porque o limite ético-clínico não admite gradação por nível de entrada. Revise o material do módulo antes de uma nova tentativa.`,
          triggered_indicator: riskInd.id
        };
      }
    }

    // ========================================================================
    // BLINDAGEM JÚNIOR (regra dura do HANDOFF — não reabrir)
    // ========================================================================
    // Júnior NUNCA encerra antecipadamente por articulação fraca ou hard fail
    // global. A simulação só termina quando chega ao último turno definido
    // em LEVEL_CONFIG. Esta regra existe porque o Júnior é o nível de
    // entrada, e encerrar antecipadamente frustra alunos iniciantes que
    // ainda estão calibrando articulação.
    // ATENÇÃO: na v1.2.9, RISCO CRÍTICO (Regra 0 acima) atravessa esta
    // blindagem. A blindagem aqui cobre APENAS Regra 1 (articulação) e
    // Regra 2 (hard fail por soma baixa).
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

    // ========================================================================
    // RENUMERAÇÃO DO HISTÓRICO (v1.2.11)
    // ========================================================================
    // Antes: state.turnLog.map((t,i) => 'TURNO ${i+1}'). Como turnLog[0] é a
    // abertura (userResponse=null), o primeiro turno respondido virava
    // "TURNO 2" no input da IA, e a última resposta no Júnior virava
    // "TURNO 5" — produzindo strengths e citações com "turno 5" em sessão
    // que o estudante percebe como 4 turnos.
    // Agora: a abertura aparece como bloco SEPARADO (sem numeração). Os
    // turnos respondidos são numerados 1, 2, 3, 4 do ponto de vista do
    // estudante. A IA precisa usar essa mesma numeração nos strengths,
    // weaknesses e justificativas conceituais.
    // ========================================================================
    const openingEntry = state.turnLog.find(t => !t.userResponse);
    const respondedEntries = state.turnLog.filter(t => t.userResponse);

    const openingBlock = openingEntry && openingEntry.assistantNarrative
      ? `CENA DE ABERTURA (contexto narrativo — NÃO conta como turno do estudante e NÃO deve ser referenciada por número em strengths/weaknesses):
${(openingEntry.assistantNarrative || '').substring(0, 400)}

═══════════════════════════════════════════════════════════════════════
`
      : '';

    const historySummary = openingBlock + respondedEntries.map((t, i) => {
      return `TURNO ${i + 1} (fase ${t.phase || '?'}, articulação ${t.articulation_class || '?'})
Resposta do estudante: "${(t.userResponse || '').substring(0, 500)}"
Sinais identificados: ${(t.case_state?.key_signals_identified || []).join(', ') || '—'}
Decisões: ${(t.case_state?.key_decisions_taken || []).join(', ') || '—'}`;
    }).join('\n\n');

    // ========================================================================
    // CONTEXTO DO ARQUÉTIPO (v1.2.11) — para restringir escopo de weaknesses
    // ========================================================================
    // A IA precisa saber o que o ARQUÉTIPO testava para não cobrar conceitos
    // de outros arquétipos. Em sessão de "estenose carotídea sintomática
    // eletiva", cobrar ASPECTS (que é de AVC agudo em trombectomia) ou
    // diferenciar papel do vascular em LVO/tandem é injusto: o caso não
    // criou oportunidade para esses conceitos. Eles vão para concept_map
    // como "não demonstrado por ausência de contexto", não para weaknesses.
    const archetype = (config.archetypes || []).find(a => a.id === state.archetypeId);
    const archetypeContext = archetype
      ? `ARQUÉTIPO JOGADO — ESCOPO DA AVALIAÇÃO:
- ID: ${archetype.id}
- Descrição: ${archetype.seed_description || '—'}
- Dilema central: ${archetype.central_dilemma || '—'}
- Competência testada: ${archetype.competency_tested || '—'}
- Caminho esperado: ${archetype.expected_path || '—'}
- Red flags do arquétipo: ${(archetype.red_flags || []).join('; ') || '—'}`
      : `ARQUÉTIPO: ${state.archetypeId} (descrição não disponível no config)`;

    const finalIndicators = state.indicators;
    const articulationProfile = state.articulationHistory.join(' → ');

    // ========================================================================
    // CÁLCULOS PRÉ-COMPUTADOS PARA OS CRITÉRIOS OBJETIVOS DA RECOMENDAÇÃO
    // (v1.2.10 — sem isso, a IA recomendava conservadoramente sempre)
    // ========================================================================
    const respondedTurns = respondedEntries;
    const respondedCount = respondedTurns.length;
    const articulatedCount = state.articulationHistory.filter(c => c === 'articulada').length;
    const articulationPct = respondedCount > 0
      ? Math.round((articulatedCount / respondedCount) * 100)
      : 0;

    // Média dos indicadores normalizados (0-100)
    const indicatorAvg = config.indicators.length > 0
      ? Math.round(
          config.indicators.reduce((acc, ind) => {
            const v = finalIndicators[ind.id] || 0;
            const pct = (v / ind.max) * 100;
            return acc + pct;
          }, 0) / config.indicators.length
        )
      : 0;

    // Indicadores de risco em queda crítica (≤25)?
    const riskInCriticalDrop = config.indicators
      .filter(i => i.initial > 0)
      .some(i => (finalIndicators[i.id] || 0) <= 25);

    const userMsg = `Analise a sessão completa do estudante abaixo e produza diagnóstico final estruturado.

${archetypeContext}

NÍVEL: ${state.level}
TURNOS RESPONDIDOS: ${respondedCount} de ${config.levels[state.level].turns} configurados
ENCERRAMENTO: ${state.earlyTermination ? state.earlyTermination.reason : 'completou'}

⚠️ REGRA DE NUMERAÇÃO (v1.2.11):
- O estudante percebe a sessão como ${respondedCount} turnos (1 a ${respondedCount}). A "cena de abertura" NÃO é contada como turno.
- Em strengths.turn, weaknesses.turn e concept_justifications, use SEMPRE a numeração 1 a ${respondedCount}.
- Mesmo que a IA internamente tenha visto a abertura como "primeira mensagem", o estudante chamou de "turno 1" a primeira vez que ELE respondeu. Respeite isso.
- Se você se vê escrevendo "turno ${respondedCount + 1}" ou "turno 0", PARE — esses números NÃO EXISTEM para o estudante.

INDICADORES FINAIS:
${config.indicators.map(i => `- ${i.name}: ${finalIndicators[i.id] || 0} / ${i.max}`).join('\n')}

PERFIL DE ARTICULAÇÃO TURNO A TURNO: ${articulationProfile}

MÉTRICAS COMPUTADAS (USE PARA APLICAR OS CRITÉRIOS OBJETIVOS DA RECOMENDAÇÃO):
- Articulações plenas: ${articulatedCount} de ${respondedCount} turnos respondidos (${articulationPct}%)
- Média dos indicadores (normalizada 0-100): ${indicatorAvg}
- Indicador de risco em queda crítica (≤25)? ${riskInCriticalDrop ? 'SIM' : 'NÃO'}

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
    { "turn": N, "description": "HABILIDADE no formato 'verbo no infinitivo + objeto'. MÁXIMO 8 PALAVRAS — esta é uma regra DURA, conte as palavras antes de finalizar. SEM citação literal entre aspas. SEM exemplos no texto. SEM qualificadores de reforço como 'imediatamente', 'com passagem estruturada', 'com precisão técnica', 'baseado em evidência', 'de forma articulada', 'após confirmação X', 'após diagnóstico Y' — esses qualificadores inflam o texto sem agregar informação, e ele estoura a linha do card LinkedIn. Forma ideal: 'verbo + objeto direto + complemento simples'. Ex.: 'Calcular ASPECTS em janela de partes moles' / 'Identificar lesão tandem em angio-TC' / 'Contraindicar trombólise em hemorragia confirmada' / 'Reconhecer limite de escopo e acionar neurocirurgia'." }
  ],
  "weaknesses": [
    { "turn": N, "description": "HABILIDADE FALTANTE no formato 'verbo no infinitivo + objeto'. MÁXIMO 10 PALAVRAS para a habilidade em si (não conta o 'Reveja: ...'). Termine com 'Reveja: <referência específica ao módulo>.' SEM qualificadores de reforço ('imediatamente', 'com passagem estruturada', 'baseado em evidência', etc.). Ex.: 'Aplicar critérios DAWN/DEFUSE-3 de mismatch. Reveja: T04 · Aulas 1 e 3.' / 'Nomear critérios cirúrgicos em hematoma cerebelar. Reveja: arquétipo HIP do módulo.'" }
  ],
  "next_step_recommendation": {
    "action": "subir_nivel" | "repetir_nivel" | "voltar_nivel" | "revisar_modulo",
    "rationale": "Mensagem CONSTRUTIVA e DIRETA ao estudante em 2-3 frases. PRIMEIRA frase: nomeia o desempenho usando os números reais ('Você fechou ${articulationPct}% de articulações plenas e indicadores em média ${indicatorAvg}'). SEGUNDA frase: justifica a recomendação. TERCEIRA frase (opcional): sinaliza o que esperar no próximo passo. Sem jargão pedagógico, sem 'você precisa', tom de parceria. Para nível Júnior com bom desempenho: trate avançar como reconhecimento, não como cobrança."
  },
  "headline_metric": "Frase curta para o card LinkedIn, ex.: '12 de 15 conceitos do módulo dominados'"
}

═══════════════════════════════════════════════════════════════════════
CRITÉRIOS OBJETIVOS PARA next_step_recommendation.action (v1.2.10):
═══════════════════════════════════════════════════════════════════════

Aplique RIGOROSAMENTE estes critérios usando as métricas computadas acima:

- subir_nivel: articulação plena ≥75% E média dos indicadores ≥80 E SEM risco em queda crítica
  → Júnior recomenda Pleno; Pleno recomenda Sênior; Sênior recomenda "manter Sênior, novo caso"

- repetir_nivel: articulação plena entre 50-74% E média dos indicadores 60-79 E SEM risco em queda crítica
  → mesmo nível, novo caso, consolidar antes de avançar

- voltar_nivel: VÁLIDO SÓ EM PLENO/SÊNIOR. articulação plena <50% OU média <60.
  → Sênior recomenda Pleno; Pleno recomenda Júnior. NUNCA aplique em sessão Júnior.

- revisar_modulo: articulação plena <50% E média <60, OU risco em queda crítica (≤25), EM QUALQUER NÍVEL
  → revisar material do módulo antes de tentar de novo

Verifique seu output contra estes critérios. Se as métricas dizem subir_nivel, NÃO escolha repetir_nivel "por cautela". Os critérios são objetivos; a recomendação é determinística.

═══════════════════════════════════════════════════════════════════════
REGRAS PARA strengths E weaknesses (v1.2.10):
═══════════════════════════════════════════════════════════════════════

- Cada item descreve UMA HABILIDADE (verbo no infinitivo + objeto), NÃO um episódio narrativo da sessão.
- PROIBIDO incluir citação literal entre aspas do que o estudante escreveu — isso produz textos longos que não cabem no card LinkedIn.
- PROIBIDO descrições com mais de 8 palavras em strengths, 10 em weaknesses (sem contar o 'Reveja:'). Conte as palavras antes de finalizar cada item.
- PROIBIDO qualificadores que inflam sem agregar: "imediatamente", "com passagem estruturada", "com precisão técnica", "baseado em evidência", "de forma articulada", "após confirmação X", "após diagnóstico Y", "sistematicamente", "completamente". Se a frase precisa de um desses, está longa demais — corte.
- PROIBIDO incluir item com turno N se aquele turno tem userResponse vazio (caso da abertura — turno 1 sem resposta). Filtre antes de incluir.
- Cada habilidade deve ser reconhecível pelo estudante como algo concreto que ele fez (strengths) ou deixou de fazer (weaknesses).
- Strengths: até 5 itens, ordenados pelo grau de excelência demonstrado.
- Weaknesses: até 5 itens, ordenados pelo impacto pedagógico.

═══════════════════════════════════════════════════════════════════════
RESTRIÇÃO DE ESCOPO PARA WEAKNESSES (v1.2.11):
═══════════════════════════════════════════════════════════════════════

REGRA INVIOLÁVEL: weaknesses só podem cobrir conceitos RELEVANTES ao arquétipo jogado (ver bloco "ARQUÉTIPO JOGADO — ESCOPO DA AVALIAÇÃO" no topo deste prompt).

Conceito é RELEVANTE ao arquétipo quando:
- Aparece no "Caminho esperado" do arquétipo, OU
- É necessário para reconhecer/justificar uma das "Red flags" do arquétipo, OU
- Faz parte da "Competência testada" descrita

Conceito NÃO É RELEVANTE quando pertence a outros arquétipos do módulo (ex.: ASPECTS e DAWN/DEFUSE-3 pertencem ao arquétipo de LVO em janela de trombectomia, NÃO ao arquétipo de carotídea sintomática eletiva). Esses conceitos vão EXCLUSIVAMENTE para concept_map como "nao_demonstrado" com justificativa "caso não criou contexto" — NUNCA para weaknesses.

EXEMPLO DE WEAKNESS PROIBIDO (em arquétipo de carotídea sintomática eletiva):
- "Comentar ASPECTS na TC" — ASPECTS é de LVO aguda em janela, não de estenose eletiva
- "Diferenciar papel do vascular em LVO/tandem" — LVO/tandem é outro arquétipo

EXEMPLO DE WEAKNESS LEGÍTIMO (no mesmo arquétipo):
- "Quantificar grau de estenose por NASCET/ECST formalmente" — está no caminho esperado
- "Caracterizar morfologia da placa como decisão entre CEA e CAS" — está na competência testada

Weaknesses devem ser AVALIAÇÃO DO QUE O ESTUDANTE FEZ NESTE CASO, não checklist enciclopédico de tudo que o módulo cobre.

═══════════════════════════════════════════════════════════════════════`;

    const result = await callAPI({
      systemFixed: config.reference_content + '\n\n' + getArticulationRulesPromptBlock(),
      systemDynamic: 'Modo: análise final de sessão completa para produzir diagnóstico estruturado.',
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 3000
    });

    // ========================================================================
    // FILTRO DEFENSIVO (v1.2.11): valida e remapeia turn-numbers no output.
    //
    // A v1.2.11 mudou a numeração enviada à IA: turnos do estudante são
    // 1 a respondedCount (não mais 2 a respondedCount+1 como na v1.2.10).
    // O filtro precisa refletir essa mudança:
    //   1. Range válido: 1 a respondedCount (inclusive).
    //   2. Item com turn fora do range alto (ex.: turn=5 em sessão de 4):
    //      tentamos REMAPEAR para o último turno (respondedCount). Cobre o
    //      caso da IA escorregar e usar o índice antigo do turnLog.
    //   3. Item com turn fora do range baixo (turn=0 ou negativo):
    //      REMOVIDO (não é remapeável de forma segura).
    //   4. Itens duplicados após remapeamento permanecem (o relatório
    //      visualmente diferencia pela descrição).
    // ========================================================================
    if (result.parsed) {
      const respondedCountForFilter = respondedCount;

      const remap = (item) => {
        if (typeof item.turn !== 'number') return null;
        if (item.turn >= 1 && item.turn <= respondedCountForFilter) return item;
        if (item.turn > respondedCountForFilter) {
          // Provável overshoot da IA: usou índice do turnLog (incluindo
          // abertura) em vez da numeração do estudante. Remapeia para o
          // último turno respondido.
          return { ...item, turn: respondedCountForFilter };
        }
        // turn === 0 ou negativo — remove
        return null;
      };

      if (Array.isArray(result.parsed.strengths)) {
        result.parsed.strengths = result.parsed.strengths
          .map(remap)
          .filter(Boolean);
      }
      if (Array.isArray(result.parsed.weaknesses)) {
        result.parsed.weaknesses = result.parsed.weaknesses
          .map(remap)
          .filter(Boolean);
      }
    }

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

    // ========================================================================
    // TRANSCRIPT (v1.2.10) — contagem unificada com a experiência do estudante
    // ========================================================================
    // Antes da v1.2.10: turnLog era renderizado entrada-por-entrada. Como a
    // entrada da abertura (userResponse=null) virava "Turno 01" e a primeira
    // resposta do estudante virava "Turno 02", o Júnior aparecia como "5
    // turnos" no relatório mesmo com apenas 4 respostas — contradizendo a
    // experiência do estudante e o `turns: 4` do LEVEL_CONFIG.
    //
    // Agora: filtramos a abertura da iteração principal. A cena de abertura
    // entra como bloco "Cena inicial" dentro do "Turno 01" (que é, do ponto
    // de vista do estudante, a primeira vez que ele teve que decidir).
    // ========================================================================
    const openingEntry = turnLog.find(t => !t.userResponse);
    const respondedEntries = turnLog.filter(t => t.userResponse);

    const openingScenePrelude = openingEntry && openingEntry.assistantNarrative
      ? `<div style="margin-bottom:14px;">
          <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#475569;margin-bottom:6px;">Cena inicial</div>
          <div style="padding:14px 16px;background:#FAF7F2;border-left:3px solid #94a3b8;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;white-space:pre-wrap;">${escapeHTML(openingEntry.assistantNarrative)}</div>
        </div>`
      : '';

    const transcriptHTML = respondedEntries.map((t, idx) => {
      const turnNumber = idx + 1;
      const articulationLabel = {
        articulada: { label: 'Articulação plena', color: '#1D9E75' },
        parcial: { label: 'Articulação parcial', color: '#BA7517' },
        generica: { label: 'Articulação genérica', color: '#A32D2D' }
      };
      const artMeta = articulationLabel[t.articulation_class] || { label: '—', color: '#94a3b8' };

      // O primeiro turno respondido recebe a cena de abertura como prelúdio
      const prelude = idx === 0 ? openingScenePrelude : '';

      const userResponseHTML = `<div style="margin-bottom:14px;">
          <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0074C7;margin-bottom:6px;">Sua resposta</div>
          <div style="padding:14px 16px;background:#E8F4FF;border-left:3px solid #0074C7;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;white-space:pre-wrap;">${escapeHTML(_stripMetaInstruction(t.userResponse))}</div>
        </div>`;

      const narrativeHTML = t.assistantNarrative
        ? `<div style="margin-bottom:14px;">
            <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#475569;margin-bottom:6px;">O que aconteceu</div>
            <div style="padding:14px 16px;background:#FAF7F2;border-left:3px solid #94a3b8;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;white-space:pre-wrap;">${escapeHTML(t.assistantNarrative)}</div>
          </div>`
        : '';

      const feedbackHTML = t.feedback
        ? `<div style="margin-bottom:14px;">
            <div style="font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0F6E56;margin-bottom:6px;">Avaliação da IA</div>
            <div style="padding:14px 16px;background:#E6F4EC;border-left:3px solid #1D9E75;border-radius:4px;font-size:13.5px;line-height:1.7;color:#0a1628;">${_sanitizeFeedbackHTML(t.feedback)}</div>
          </div>`
        : '';

      return `<div style="margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid #E2E8F0;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
          <h3 style="font-family:inherit;font-weight:800;font-size:22px;letter-spacing:-0.02em;color:#0a1628;margin:0;">Turno ${String(turnNumber).padStart(2, '0')}</h3>
          ${t.articulation_class ? `<span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${artMeta.color};">${artMeta.label}</span>` : ''}
        </div>
        ${prelude}
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
      <strong>${escapeHTML(state.userName || 'Estudante')}</strong> conduziu ${respondedEntries.length} ${respondedEntries.length === 1 ? 'turno' : 'turnos'} no nível ${config.levels[state.level].label}${moduleDiscipline ? ` · módulo de ${moduleDiscipline}` : ''}.<br>
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
    const safeName = (state.userName || 'estudante').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const filename = `relatorio-${config.id}-${safeName}-${Date.now()}.html`;

    // v1.4.1: no mobile (especialmente dentro de app/WebView) o download
    // direto não funciona E abrir aba nova é frequentemente bloqueado pelo
    // app. Estratégia em duas etapas: (1) tenta a Web Share API, que abre o
    // menu nativo do celular (WhatsApp, Email, Salvar nos Arquivos, etc.) —
    // apps costumam permitir essa API. (2) Se não tiver suporte, mostra o
    // relatório DENTRO do próprio simulador com botão "Salvar PDF" que
    // dispara o diálogo nativo de impressão do celular (que tem opção
    // "Salvar como PDF"). Nada externo é aberto, nada pode ser bloqueado.
    if (_isMobileEnv()) {
      _tryShareOrShowReport(blob, filename, url);
      return;
    }

    // Desktop: download direto (atributo download funciona aqui)
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // v1.4.1: tenta compartilhar o relatório via Web Share API e, se não der,
  // mostra o relatório inline com botão de impressão/PDF.
  async function _tryShareOrShowReport(blob, filename, url) {
    try {
      const file = new File([blob], filename, { type: 'text/html' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Relatório Active IA — Galícia Educação'
        });
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // usuário cancelou o share
      console.warn('[ActiveIA] Web Share do relatório falhou:', err);
    }
    // Fallback robusto: relatório dentro do próprio simulador, com botão
    // Salvar PDF que aciona o diálogo nativo de impressão do celular.
    _showReportInlineOverlay(url);
  }

  // v1.4.1: substitui temporariamente o conteúdo do simulador pelo overlay
  // do relatório. Tem um header com "Voltar" e "Salvar PDF", e um iframe
  // interno que carrega o HTML completo do relatório. Quando o aluno toca
  // em "Salvar PDF", chama iframe.contentWindow.print() — o celular abre o
  // diálogo nativo onde tem a opção "Salvar como PDF". Quando toca em
  // "Voltar", restaura o dossiê que estava antes.
  //
  // Por que não usar position:fixed com overlay flutuante: dentro de um
  // iframe (que é como o simulador roda no WordPress), position:fixed se
  // ancora ao iframe e cobre só a faixa visível, não a página inteira.
  // Substituir o conteúdo do activeia-root e re-medir a altura é mais
  // robusto — o iframe externo se ajusta naturalmente ao novo conteúdo.
  function _showReportInlineOverlay(url) {
    const root = document.getElementById('activeia-root');
    if (!root) {
      // Sem root, não há onde renderizar — abre em aba nova como último recurso
      window.open(url, '_blank');
      return;
    }
    // Guarda o HTML atual (o dossiê) pra restaurar quando o aluno voltar
    const savedHtml = root.innerHTML;

    // O cabeçalho usa estilos inline para não depender do CSS externo (que
    // pode demorar a carregar ou ter sido sobrescrito).
    const headerStyle = 'background:#0a1628;color:#fff;padding:14px 16px;display:flex;gap:10px;align-items:center;justify-content:space-between;font-family:Montserrat,system-ui,sans-serif;flex-wrap:wrap;';
    const backBtnStyle = 'background:transparent;color:#91F2FF;border:1.5px solid #91F2FF;padding:9px 16px;border-radius:8px;font-family:inherit;font-weight:600;font-size:13px;cursor:pointer;min-height:42px;';
    const printBtnStyle = 'background:#fff;color:#0a1628;border:none;padding:9px 16px;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;min-height:42px;';
    const labelStyle = 'font-size:11px;letter-spacing:1.5px;color:#91F2FF;font-weight:700;text-transform:uppercase;flex:1;text-align:center;';
    // Altura generosa do iframe interno para o relatório ter espaço para
    // rolar internamente. 90vh cobre quase toda a tela do celular, e o
    // ResizeObserver do iframe externo ajusta o todo.
    const iframeStyle = 'width:100%;height:90vh;min-height:520px;border:0;background:#fff;display:block;';

    root.innerHTML = `
      <div id="aia-report-overlay-wrap">
        <div style="${headerStyle}">
          <button id="aia-report-back" type="button" style="${backBtnStyle}">← Voltar</button>
          <span style="${labelStyle}">RELATÓRIO</span>
          <button id="aia-report-print" type="button" style="${printBtnStyle}">Salvar PDF</button>
        </div>
        <iframe id="aia-report-iframe" src="${url}" style="${iframeStyle}" title="Relatório Active IA"></iframe>
      </div>
    `;

    // Reavisa a altura para o iframe externo se ajustar ao novo conteúdo
    _notifyHeight();

    const backBtn = document.getElementById('aia-report-back');
    const printBtn = document.getElementById('aia-report-print');

    if (backBtn) {
      backBtn.onclick = function() {
        root.innerHTML = savedHtml;
        // O event delegation global continua valendo para os botões
        // restaurados (data-aia-action); listeners não se perdem.
        _notifyHeight();
        _observeActiveScreen();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch(e){} }, 1000);
      };
    }
    if (printBtn) {
      printBtn.onclick = function() {
        const iframe = document.getElementById('aia-report-iframe');
        if (!iframe) return;
        try {
          // Foco no iframe é necessário em alguns navegadores antes do print
          iframe.focus();
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
        } catch (e) {
          console.warn('[ActiveIA] Print do relatório falhou:', e);
          showModal({
            eyebrow: 'RELATÓRIO',
            title: 'Não foi possível abrir a impressão',
            body: 'Seu navegador ou app não permitiu abrir o diálogo de impressão. Como alternativa, você pode tirar uma captura de tela do relatório.',
            bodyIsHTML: false,
            actions: [{ label: 'Entendi', primary: true, close: true }]
          });
        }
      };
    }
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
   * Gera o card LinkedIn 1080×1080 (v1.2.8 — kit de escola + selo medalha).
   *
   * Decisão de produto: o card é peça de PROPAGANDA do estudante e da Galícia
   * no LinkedIn. Por isso:
   *   - Fundo claro (legibilidade no feed, sensação editorial elegante)
   *   - Sem nível Júnior/Pleno/Sênior (desincentiva quem está em Júnior a postar)
   *   - Sem grid de números frios (8 de 9, 8 de 15) — substitui por PROSA de
   *     competências demonstradas, que vende muito melhor
   *   - Bordão "Conhecer para decidir. Decidir para fazer diferença." em
   *     destaque visual (caixa lateral com tint cyan)
   *   - KIT COMPLETO DA ESCOLA no canto superior direito (G + texto + Galícia
   *     institucional embutida). PNG resolvido via SCHOOL_LOGOS[config.school].
   *   - SELO MEDALHA decorativo no centro-direita. Fixo, igual em todas as
   *     escolas. Carregado de MEDAL_SEAL_URL.
   *   - SEM selo "MAI-2026" no canto (removido na v1.2.8 — Lição 35).
   *   - SEM círculo translúcido decorativo atrás do nome (removido na v1.2.8 —
   *     estava criando halo estranho atrás da medalha).
   *
   * REGRA DURA DE TIPOGRAFIA (Lição 25): Montserrat exclusivamente (Gotham não
   * roda em Canvas runtime). Hierarquia construída com peso/tamanho/letter-spacing
   * e itálico — nenhuma fonte com serifa.
   *
   * FALLBACK GRACIOSO (Lição 34): se SCHOOL_LOGOS[config.school] ou MEDAL_SEAL_URL
   * não carregar (CORS, 404, offline), o card renderiza sem o asset específico em
   * vez de travar. O estudante ainda recebe um card publicável.
   *
   * AUTO-FIT (Lição 35): nome e título da simulação têm largura máxima de
   * ~580px para não colidir com a medalha. Fonte reduz progressivamente até
   * caber (nome: 76→42, título: 30→18).
   *
   * @param {Object} state - appState
   * @param {Object} diagnosis - estrutura retornada por generateFinalDiagnosis
   * @param {Object} config - SIMULATOR_CONFIG (deve conter config.school)
   * @param {string} [precomputedChallenge] - texto curto do desafio (extraído
   *   da Frase 1 da caption gerada pela IA). Se omitido, usa fallback genérico.
   * @returns {Promise<Blob>} blob image/png 1080×1080
   */

  /**
   * Sugere uma forma neutra de gênero do papel profissional, para uso APENAS
   * no card do LinkedIn (peça pública). Não reescreve texto livre — só converte
   * o substantivo de profissão conhecido em construção neutra por área/função.
   *
   * Filosofia (Lição 9.1 do estado do sistema): substituição cega de texto livre
   * é frágil. Por isso esta função é conservadora: tenta casar o INÍCIO do papel
   * com um mapa curto de profissões comuns; se casar, devolve a forma neutra
   * preservando o complemento (ex.: "advogada previdenciarista" → "profissional
   * da advocacia previdenciária"); se NÃO casar, devolve o papel original
   * inalterado e deixa a regra textual do prompt cuidar da neutralização.
   * Nunca lança erro, nunca devolve vazio.
   *
   * @param {string} roleRaw - config.role_context
   * @returns {string} forma neutra sugerida (ou o original, se não reconhecido)
   */
  function _suggestNeutralRole(roleRaw) {
    const role = (roleRaw || '').trim();
    if (!role) return 'profissional do domínio';

    // Pega só o núcleo do papel (antes de ponto/dois-pontos), como o resto do core faz.
    const core = role.split(/[.:]/)[0].trim();
    const lower = core.toLowerCase();

    // Normaliza complementos conhecidos que mudam de forma ao sair do substantivo
    // de agente (ex.: "advogada previdenciarista" → área "previdenciária").
    // Conservador: só converte o que está no mapa; o resto passa intacto.
    function _normComplemento(c) {
      if (!c) return '';
      return c
        .replace(/\bprevidenciarista\b/gi, 'previdenciária')
        .replace(/\btributarista\b/gi, 'tributária')
        .replace(/\btrabalhista\b/gi, 'trabalhista')   // já neutro
        .replace(/\bcivilista\b/gi, 'civil')
        .replace(/\bcriminalista\b/gi, 'criminal');
    }

    // Mapa: chave = par feminino/masculino do substantivo de profissão (no início
    // do papel); valor = função que monta a forma neutra preservando o complemento.
    // Complemento = o que vem depois do substantivo (ex.: "previdenciarista").
    // NOTA: não usamos \b após o substantivo porque quebra com acentos (ã, ç).
    // Usamos (?:\s+(.*))?$ — espaço(s) + resto opcional, ou fim da string.
    // Ordem importa: padrões mais específicos primeiro.
    const NEUTRAL_MAP = [
      { re: /^advogad[ao](?:\s+(.*))?$/i,        neutral: (c) => 'profissional da advocacia' + (c ? ' ' + c : '') },
      { re: /^ju[ií]z[ao]?(?:\s+(.*))?$/i,       neutral: (c) => 'profissional da magistratura' + (c ? ' ' + c : '') },
      { re: /^promotor[ao]?(?:\s+(.*))?$/i,      neutral: (c) => 'profissional do Ministério Público' + (c ? ' ' + c : '') },
      { re: /^m[ée]dic[ao](?:\s+(.*))?$/i,       neutral: (c) => 'profissional da medicina' + (c ? ' ' + c : '') },
      { re: /^cirurgi[ãa]o?(?:\s+(.*))?$/i,      neutral: (c) => 'profissional da cirurgia' + (c ? ' ' + c : '') },
      { re: /^enfermeir[ao](?:\s+(.*))?$/i,      neutral: (c) => 'profissional de enfermagem' + (c ? ' ' + c : '') },
      { re: /^contador[ao]?(?:\s+(.*))?$/i,      neutral: (c) => 'profissional da contabilidade' + (c ? ' ' + c : '') },
      { re: /^auditor[ao]?(?:\s+(.*))?$/i,       neutral: (c) => 'profissional de auditoria' + (c ? ' ' + c : '') },
      { re: /^consultor[ao]?(?:\s+(.*))?$/i,     neutral: (c) => 'profissional de consultoria' + (c ? ' ' + c : '') },
      { re: /^gestor[ao]?(?:\s+(.*))?$/i,        neutral: (c) => 'profissional de gestão' + (c ? ' ' + c : '') },
      { re: /^administrador[ao]?(?:\s+(.*))?$/i, neutral: (c) => 'profissional de administração' + (c ? ' ' + c : '') },
      { re: /^engenheir[ao](?:\s+(.*))?$/i,      neutral: (c) => 'profissional de engenharia' + (c ? ' ' + c : '') },
      { re: /^analist[ao](?:\s+(.*))?$/i,        neutral: (c) => 'profissional de análise' + (c ? ' ' + c : '') },
      { re: /^coach(?:\s+(.*))?$/i,              neutral: (c) => 'profissional de coaching' + (c ? ' ' + c : '') },
      { re: /^perit[ao](?:\s+(.*))?$/i,          neutral: (c) => 'profissional de perícia' + (c ? ' ' + c : '') }
    ];

    for (const entry of NEUTRAL_MAP) {
      const m = lower.match(entry.re);
      if (m) {
        const complemento = _normComplemento((m[1] || '').trim());
        return entry.neutral(complemento);
      }
    }

    // Não reconhecido: devolve o papel original. A regra textual do prompt
    // (FRASE 1 + REGRAS GERAIS) instrui a IA a neutralizar na redação.
    return core;
  }

  async function generateLinkedInCard(state, diagnosis, config, precomputedChallenge) {
    try { await document.fonts.ready; } catch (e) {}

    // Carrega assets remotos em paralelo (com fallback se algum falhar)
    const schoolKey = config && config.school ? config.school : null;
    const schoolLogoUrl = schoolKey && SCHOOL_LOGOS[schoolKey] ? SCHOOL_LOGOS[schoolKey] : null;
    const [schoolLogoImg, medalImg] = await Promise.all([
      _loadImage(schoolLogoUrl),
      _loadImage(MEDAL_SEAL_URL)
    ]);

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

    // ====== EYEBROW (esquerda) ======
    const eyeY = 110;
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 14px "Montserrat", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    _drawTrackedText(ctx, 'ACTIVE IA · GALÍCIA EDUCAÇÃO', padL, eyeY, 2.5);

    // ====== KIT COMPLETO DA ESCOLA (canto superior direito) ======
    // PNG com G + "escola de X" + Galícia institucional embutida.
    // Altura fixa de 160px; largura proporcional. Posicionado no canto
    // direito alinhado pelo topo do card (com leve respiro de 40px da borda).
    if (schoolLogoImg) {
      const logoH = 160;
      const logoW = Math.round(schoolLogoImg.naturalWidth * logoH / schoolLogoImg.naturalHeight);
      // Garante que não ultrapasse 280px de largura (caso o asset seja muito largo)
      const finalLogoW = Math.min(logoW, 280);
      const finalLogoH = Math.round(schoolLogoImg.naturalHeight * finalLogoW / schoolLogoImg.naturalWidth);
      ctx.drawImage(schoolLogoImg, W - padR - finalLogoW, 40, finalLogoW, finalLogoH);
    }

    // Linha divisória sutil (abaixo do cabeçalho e da logo)
    ctx.strokeStyle = '#D9D0C4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, 220);
    ctx.lineTo(W - padR, 220);
    ctx.stroke();

    // ====== NOME DO ESTUDANTE (com auto-fit) ======
    // Largura máxima do nome: até onde a medalha começa (~580px confortável).
    // Reduz fonte de 76 até 42 até caber.
    const userName = (state.userName || 'Estudante').trim();
    const nameParts = userName.split(/\s+/);
    const firstName = nameParts[0] || userName;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const MAX_NAME_WIDTH = 580;
    let nameSize = 76;
    while (nameSize > 42) {
      ctx.font = '800 ' + nameSize + 'px "Montserrat", sans-serif';
      const wFirst = ctx.measureText(firstName).width;
      ctx.font = 'italic 800 ' + nameSize + 'px "Montserrat", sans-serif';
      const wLast = lastName ? ctx.measureText(' ' + lastName).width : 0;
      if (wFirst + wLast <= MAX_NAME_WIDTH) break;
      nameSize -= 2;
    }

    const nameY = 280;
    ctx.fillStyle = '#0a1628';
    ctx.font = '800 ' + nameSize + 'px "Montserrat", sans-serif';
    ctx.fillText(firstName, padL, nameY);
    const firstNameW = ctx.measureText(firstName).width;
    if (lastName) {
      ctx.fillStyle = '#0074C7';
      ctx.font = 'italic 800 ' + nameSize + 'px "Montserrat", sans-serif';
      ctx.fillText(' ' + lastName, padL + firstNameW, nameY);
    }

    // Subtítulo (linha descritiva)
    const subY = nameY + Math.round(nameSize * 1.3);
    ctx.fillStyle = '#475569';
    ctx.font = '400 20px "Montserrat", sans-serif';
    ctx.fillText('concluiu a simulação profissional', padL, subY);

    // ====== TÍTULO DO MÓDULO (com auto-fit) ======
    const moduleTopic = (config.name || '').split(':')[0].trim();
    let titleSize = 28;
    while (titleSize > 18) {
      ctx.font = '700 ' + titleSize + 'px "Montserrat", sans-serif';
      if (ctx.measureText(moduleTopic).width <= MAX_NAME_WIDTH) break;
      titleSize -= 1;
    }
    const titleY = subY + 38;
    ctx.fillStyle = '#0a1628';
    ctx.font = '700 ' + titleSize + 'px "Montserrat", sans-serif';
    const titleLines = wrapText(ctx, moduleTopic, MAX_NAME_WIDTH).slice(0, 2);
    let tY = titleY;
    for (const ln of titleLines) {
      ctx.fillText(ln, padL, tY);
      tY += titleSize + 8;
    }
    let cursorY = tY + 14;

    // ====== SELO MEDALHA DECORATIVO (centro-direita, fixo) ======
    // Carregado de MEDAL_SEAL_URL — mesmo PNG para todas as escolas.
    // Posicionado para ficar verticalmente próximo ao nome/título, no eixo
    // direito do card. Altura fixa de 340px. Se não carregar, é omitido.
    if (medalImg) {
      const medalH = 340;
      const medalW = Math.round(medalImg.naturalWidth * medalH / medalImg.naturalHeight);
      const medalX = W - padR - medalW - 90;
      const medalY = 270;
      ctx.drawImage(medalImg, medalX, medalY, medalW, medalH);
    }

    // ====== DESAFIO (texto curto do caso enfrentado) ======
    // Reaproveita a Frase 1 do texto LinkedIn gerado pela IA (precomputedChallenge).
    // Se não veio, usa fallback genérico baseado no papel profissional do config.
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 12px "Montserrat", sans-serif';
    _drawTrackedText(ctx, 'DESAFIO', padL, cursorY, 2);
    cursorY += 28;

    let challengeText = (precomputedChallenge || '').trim();
    if (!challengeText) {
      const roleRaw = (config.role_context || '').split(/[.:]/)[0].trim();
      const role = _suggestNeutralRole(roleRaw);
      challengeText = role
        ? 'Assumi o papel de ' + role.toLowerCase() + ' em um caso real do mercado.'
        : 'Enfrentei um caso real do mercado com decisão sob pressão.';
    }
    // v1.4.2 — Bloco do DESAFIO padronizado em NO MÁXIMO 3 linhas, sempre
    // terminando limpo. Antes: .slice(0,3) descartava a 4ª linha sem aviso,
    // deixando o texto morto no meio (ex.: "...defesa administrativa e os").
    // Agora: se o texto não couber em 3 linhas, recuamos palavra a palavra na
    // 3ª linha até o "…" caber — nunca corta no meio de palavra, nunca passa
    // de 3 linhas. O pré-corte por caractere (antes em 240) foi removido porque
    // a quebra por linha já governa o tamanho final.
    ctx.fillStyle = '#0a1628';
    ctx.font = '400 17px "Montserrat", sans-serif';
    // Largura do bloco: até onde a medalha começa (mesmos 580px do nome)
    const challengeLines = _wrapClamp(ctx, challengeText, MAX_NAME_WIDTH, 3);
    for (const ln of challengeLines) {
      ctx.fillText(ln, padL, cursorY);
      cursorY += 24;
    }
    cursorY += 16;

    // ====== FASES DECISÓRIAS ======
    ctx.fillStyle = '#0074C7';
    ctx.font = '600 12px "Montserrat", sans-serif';
    _drawTrackedText(ctx, 'FASES DECISÓRIAS', padL, cursorY, 2);
    cursorY += 28;

    const turnsPlayed = (state.turnLog || []).length || config.levels[state.level].turns;
    const phaseNames = (config.phases || []).map(p => p.name).filter(Boolean);
    const phasesLine = phaseNames.length > 0
      ? phaseNames.join(' · ')
      : 'Decisão sob pressão';

    ctx.fillStyle = '#475569';
    ctx.font = '400 18px "Montserrat", sans-serif';
    ctx.fillText('▸  ' + turnsPlayed + ' turnos de decisão sob pressão', padL, cursorY);
    cursorY += 28;
    const phasesLines = wrapText(ctx, '▸  ' + phasesLine, MAX_NAME_WIDTH).slice(0, 2);
    for (const ln of phasesLines) {
      ctx.fillText(ln, padL, cursorY);
      cursorY += 28;
    }
    cursorY += 12;

    // ====== HABILIDADES DEMONSTRADAS (v1.2.10) ======
    // Renomeado de "COMPETÊNCIAS DEMONSTRADAS" — competência é o que o módulo
    // inteiro forma; habilidade é o que cada turno demonstra. O card mostra
    // os strengths da sessão específica do estudante, portanto: habilidades.
    // Sem fallback fake: se diagnosis.strengths vier vazio, omite o bloco.
    // TRAVA DE ALTURA: o bordão começa em y=870. As habilidades não podem
    // invadir essa área. Se o cursor passar de y=850, paramos.
    const strengths = (diagnosis && diagnosis.strengths) || [];
    const MAX_Y_COMPETENCIAS = 850;
    if (strengths.length > 0 && cursorY < MAX_Y_COMPETENCIAS) {
      ctx.fillStyle = '#0074C7';
      ctx.font = '600 12px "Montserrat", sans-serif';
      _drawTrackedText(ctx, 'HABILIDADES DEMONSTRADAS', padL, cursorY, 2);
      cursorY += 26;

      // Truncamento em palavra completa (v1.2.10): nunca cortar no meio de
      // palavra. Se o texto exceder 80 chars, encontra o último espaço antes
      // do limite e corta ali. Limite reduzido de 105 para 80.
      const competencyItems = strengths.slice(0, 5).map(s => {
        let txt = (s.description || '').trim();
        // v1.2.13: limite ajustado de 60 → 68 chars. Cabe em uma linha
        // do Montserrat 14-16px em card 1080px e acomoda frases de
        // 7-8 palavras com objeto direto + complemento simples sem
        // truncar (ex.: "Indicar anticoagulação empírica com
        // componente hemorrágico presente" = 64 chars cabe inteira).
        // Quando estoura mesmo assim, corta na palavra completa mais
        // próxima (≥34 chars do início — proporcional ao novo limite).
        if (txt.length > 68) {
          const truncated = txt.substring(0, 68);
          const lastSpace = truncated.lastIndexOf(' ');
          txt = (lastSpace > 34 ? truncated.substring(0, lastSpace) : truncated) + '…';
        }
        return txt;
      });

      ctx.fillStyle = '#0a1628';
      const n = competencyItems.length;
      const compFontSize = n <= 3 ? 16 : (n === 4 ? 15 : 14);
      const compLineH = n <= 3 ? 22 : (n === 4 ? 20 : 19);
      const compGap = n <= 3 ? 4 : (n === 4 ? 3 : 2);
      ctx.font = '400 ' + compFontSize + 'px "Montserrat", sans-serif';

      let renderedCount = 0;
      let omittedCount = 0;
      for (const it of competencyItems) {
        const lines = wrapText(ctx, '•  ' + it, W - padL - padR);
        const needed = Math.min(lines.length, 2) * compLineH + compGap;
        if (cursorY + needed > MAX_Y_COMPETENCIAS) {
          omittedCount = competencyItems.length - renderedCount;
          break;
        }
        for (const ln of lines.slice(0, 2)) {
          ctx.fillText(ln, padL, cursorY);
          cursorY += compLineH;
        }
        cursorY += compGap;
        renderedCount++;
      }
      if (omittedCount > 0 && cursorY < MAX_Y_COMPETENCIAS) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'italic 400 13px "Montserrat", sans-serif';
        ctx.fillText('+ ' + omittedCount + ' outra' + (omittedCount > 1 ? 's' : '') + ' habilidade' + (omittedCount > 1 ? 's' : '') + ' no relatório completo', padL, cursorY);
      }
    }

    // ====== BORDÃO INSTITUCIONAL (caixa de destaque) ======
    const bordaoY = 870;
    const bordaoH = 78;
    ctx.fillStyle = '#E8F4FF';
    ctx.fillRect(padL, bordaoY, W - padL - padR, bordaoH);
    ctx.fillStyle = '#0074C7';
    ctx.fillRect(padL, bordaoY, 4, bordaoH);
    ctx.fillStyle = '#0a1628';
    ctx.font = '500 22px "Montserrat", sans-serif';
    ctx.fillText('Conhecer para decidir.', padL + 24, bordaoY + 32);
    ctx.fillStyle = '#0074C7';
    ctx.font = 'italic 600 22px "Montserrat", sans-serif';
    ctx.fillText('Decidir para fazer diferença.', padL + 24, bordaoY + 60);

    // ====== RODAPÉ ======
    ctx.strokeStyle = '#D9D0C4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - 78);
    ctx.lineTo(W - padR, H - 78);
    ctx.stroke();

    // Subtítulo rodapé esquerda (sem logo Galícia institucional — removida na v1.2.8)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 12px "Montserrat", sans-serif';
    ctx.fillText('Método Active IA · Simulação profissional avaliada por IA', padL, H - 28);

    // Data (direita)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px "Montserrat", sans-serif';
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

  /**
   * Quebra texto em linhas (como wrapText) mas limita a `maxLines`. Se o texto
   * exceder, a última linha permitida recebe "…" e recua palavra a palavra até
   * o "…" caber em maxWidth — garante término limpo, sem corte no meio de
   * palavra e sem ultrapassar maxLines. Usado no bloco DESAFIO do card.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} maxWidth
   * @param {number} maxLines
   * @returns {string[]} até maxLines linhas
   */
  function _wrapClamp(ctx, text, maxWidth, maxLines) {
    const all = wrapText(ctx, text, maxWidth);
    if (all.length <= maxLines) return all;

    const kept = all.slice(0, maxLines);
    // A última linha precisa de reticências (há conteúdo descartado depois).
    let last = kept[maxLines - 1];
    const fits = (s) => ctx.measureText(s + '…').width <= maxWidth;

    if (fits(last)) {
      kept[maxLines - 1] = last + '…';
      return kept;
    }
    // Não cabe o "…": recua palavra a palavra na última linha até caber.
    const words = last.split(' ');
    while (words.length > 1) {
      words.pop();
      const candidate = words.join(' ');
      if (fits(candidate)) {
        kept[maxLines - 1] = candidate + '…';
        return kept;
      }
    }
    // Caso extremo (1 palavra gigante): devolve a palavra com reticências mesmo.
    kept[maxLines - 1] = words[0] + '…';
    return kept;
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

  /**
   * Extrai a primeira sentença "descritiva" do parágrafo de recap da caption
   * LinkedIn — corresponde à Frase 1 da estrutura do prompt v1.2.6+ (o "desafio").
   *
   * A caption tem estrutura:
   *   "Hoje conclui mais uma simulação Active IA do módulo em [X] da Galícia Educação. [PARAGRAFO_DA_IA]\n\n[BLOCO_FIXO]\n\nConhecer para decidir..."
   *
   * O PARAGRAFO_DA_IA começa SEMPRE com a Frase 1 (desafio). Pegamos só essa
   * frase pra reaproveitar no card (no bloco "DESAFIO").
   *
   * @param {string} caption - caption completa gerada por linkedinCaption
   * @returns {string} primeira sentença da recap, ou string vazia se falhar
   */
  function _extractChallengeFromCaption(caption) {
    if (!caption) return '';
    // 1. Pega o que vem DEPOIS da frase fixa de abertura (que termina com "Galícia Educação.")
    const introMatch = caption.match(/Galícia Educação\.\s+([\s\S]+?)(?:\n\n|\n[A-Z])/);
    if (!introMatch) return '';
    const recap = introMatch[1].trim();

    // 2. Pega a primeira sentença completa do recap (até o primeiro ponto final
    //    seguido de espaço/quebra, ignorando reticências e abreviações comuns).
    //    Usa lookbehind suportado em navegadores modernos.
    const firstSentence = recap.match(/^[^.!?]+[.!?](?=\s|$)/);
    if (!firstSentence) return recap.substring(0, 200);
    return firstSentence[0].trim();
  }

  function _buildHashtags(config) {
    // Regra fixa firmada em v1.2.7: #ActiveIA + #GalíciaEducação + #[Escola].
    // Hashtag derivada de config.name foi REMOVIDA — gerava resultados ruins como
    // #Doenca, #Marca, #Escritorio. O nome do simulador frequentemente começa
    // por um substantivo solto que vira péssima hashtag publicitária.
    // A tag #[Escola] é institucional (Saude, Direito, Gestao, etc.) e
    // sempre faz sentido como publicidade.
    const tags = ['#ActiveIA', '#GalíciaEducação'];
    if (config.school) {
      const schoolTag = '#' + _slugify(config.school);
      if (schoolTag.length > 1) tags.push(schoolTag);
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
      // v1.2.11: usa turnos RESPONDIDOS pelo estudante (não turnLog.length,
      // que inclui a abertura). turnLog tem totalTurns+1 entradas no fluxo
      // normal — usar .length faz a IA escrever "Em 5 turnos" em sessão
      // Júnior que é de 4 respostas.
      const turnsPlayed = (state.turnLog || []).filter(t => t.userResponse).length
        || config.levels[state.level].turns;
      const consultantsUsed = state.consultantsUsed || 0;
      const archetypeDescription = state.archetype?.seed_description || 'um caso complexo da área';
      const role = config.role_context || 'profissional do domínio';
      // v1.4.x — Linguagem neutra de gênero APENAS no card do LinkedIn (peça
      // pública que qualquer pessoa pode postar). NÃO afeta a conversa nem o
      // relatório. Não reescreve a saída da IA (frágil); apenas SUGERE uma
      // forma neutra do papel como insumo, e a IA recebe a instrução de usá-la.
      // Se o papel não casar com o mapa, devolve o original e a regra textual
      // do prompt cuida do resto. Nunca quebra.
      const roleNeutralHint = _suggestNeutralRole(role);
      const articulationProfile = (state.articulationHistory || []).join(' → ') || '—';

      const userMsg = `Produza UM PARÁGRAFO de recapitulação para uma postagem de LinkedIn em primeira pessoa do estudante.

CONTEXTO (apenas para você entender — NÃO repita literalmente no parágrafo):
- Papel profissional assumido (referência): ${role.substring(0, 300)}
- COMO se referir ao papel no texto (forma neutra de gênero, USE ESTA): ${roleNeutralHint.substring(0, 300)}
- Natureza do caso (arquétipo): ${archetypeDescription}
- Turnos conduzidos: ${turnsPlayed}
- Consultas a colegas/especialistas durante a sessão: ${consultantsUsed}
- Pontos fortes da condução: ${(diagnosis?.strengths || []).map(s => s.description).slice(0, 3).join(' | ')}

REGRA EDITORIAL PRINCIPAL (IMPORTANTE):
O parágrafo NÃO repete a localização do módulo, escola, curso ou Galícia — isso já aparece na frase de abertura "Hoje conclui mais uma simulação Active IA do módulo em [disciplina] da Galícia Educação". Você começa o parágrafo DIRETO no conteúdo da experiência, sem repetir contexto institucional.

ESTRUTURA OBRIGATÓRIA DO PARÁGRAFO (3 frases ao todo, nesta ordem):

FRASE 1 — O desafio (1 frase, ~25-35 palavras):
Em linguagem acessível ao público leigo (mas digna ao profissional), descreva o desafio enfrentado. Use o papel profissional, mas SEM marcar o gênero de quem fez a simulação: refira-se ao papel pela profissão ou área de atuação ("Assumi o papel de profissional da advocacia previdenciária...", "Assumi o papel de profissional da cirurgia vascular..."), NUNCA pela forma flexionada em gênero ("advogada", "advogado", "cirurgião", "cirurgiã"). Este card é uma peça pública que qualquer pessoa pode postar — homem ou mulher — então o texto não pode revelar o gênero de quem o publica. NÃO use terminações "-e" ou "-x" (nada de "advogade"); apenas reescreva em torno da profissão/área. Nomeie o problema central em termos compreensíveis. EVITE jargão técnico denso (escores, siglas, critérios). Use o vocabulário da ÁREA REAL do caso. Exemplos do tom em áreas diferentes: (Direito) "Assumi o papel de profissional da advocacia tributária num caso complexo: precisei definir a estratégia entre defesa administrativa e judicial diante de uma autuação fiscal de alto valor." (Saúde) "Assumi o papel de profissional da cirurgia vascular num caso complexo: precisei decidir conduta para um caso com risco iminente, em janela apertada para intervenção." Adapte SEMPRE ao domínio real do caso.

FRASE 2 — Como conduziu (1 frase, MÁXIMO ABSOLUTO 35 palavras):
Descreva de forma sucinta como o raciocínio se desenvolveu — em uma única ideia, NÃO em uma lista de tudo o que articulou. Foque no movimento principal de raciocínio (não em listar áreas, especialidades, exames ou técnicas). Limite duro: 35 palavras. Se passar disso, corte.
IMPORTANTE: use o vocabulário da ÁREA REAL do caso (indicada em "Papel profissional assumido" e "Natureza do caso"). Se o caso é jurídico, fale de tese, fundamentação, estratégia processual — NÃO de exames, conduta clínica ou pacientes. Se é de gestão, fale de decisão, trade-off, stakeholders. Os exemplos abaixo mostram só a ESTRUTURA da frase (turnos + movimento de raciocínio + "sem gabarito"), não o conteúdo — adapte o conteúdo ao domínio do caso.
Exemplos da ESTRUTURA (adapte o vocabulário ao domínio real):
- "Conduzi o raciocínio em ${turnsPlayed} turnos, articulando análise, fundamentação e decisão num único fluxo — sem múltipla escolha, sem gabarito."
- "Ao longo de ${turnsPlayed} turnos, precisei integrar leitura do caso, investigação e decisão sem roteiro pronto."
- "Em ${turnsPlayed} turnos, articulei hipóteses, avaliei os elementos do caso e decidi o encaminhamento — cada turno avaliado pela IA antes do seguinte."

PROIBIDO na Frase 2:
- Listar 4+ áreas/especialidades (neurologia, cardiologia, etc.) — escolha o movimento de raciocínio, não a rede multidisciplinar
- Listar 3+ tipos de exame ou técnica
- Frases com 3 ou mais travessões (—) — sinaliza enumeração excessiva

FRASE 3 — Como a IA avaliou (1 frase, PRESERVAR EXATAMENTE este formato, ajustando só o tempo verbal e detalhe final):
"A IA não corrigiu certo ou errado: avaliou as premissas que assumi, os riscos que mapeei e os pontos em que meu raciocínio ainda operava de forma incompleta."

REGRAS GERAIS:
- Primeira pessoa do estudante ("assumi", "conduzi", "articulei").
- 3 frases (nem mais nem menos). Profissional, sóbrio, sem hipérbole.
- NÃO mencione: pós-graduação, módulo, curso, Galícia, escola (já está na frase de abertura).
- NÃO use escores/siglas técnicas densas (ABCD2, NASCET, ASPECTS, DAPT etc.). O LinkedIn é peça de publicidade — quem é da área já entende a profundidade, quem não é precisa entender o desafio.
- NÃO use emoji. NÃO use markdown. NÃO use JSON. Apenas o texto do parágrafo.
- NÃO comece com "Eu". Comece com verbo de ação ou "Como [profissão/área de atuação]" (forma neutra, sem marcar gênero).
- NUNCA use a palavra "aluno" ou "aluna" — use o papel profissional assumido na cena, ou "estudante" se precisar referência genérica.
- NUNCA revele o gênero de quem fez a simulação. Refira-se ao papel pela profissão ou área ("profissional da advocacia previdenciária", "profissional de gestão"), nunca pela forma flexionada ("advogada/advogado", "gestora/gestor"), e nunca com "-e"/"-x". Verbos em primeira pessoa ("assumi", "conduzi", "articulei") não marcam gênero e estão liberados.

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
      // Refatoração v1.2.7: caption é gerada PRIMEIRO (não em paralelo),
      // depois extraímos a Frase 1 (= o "desafio") e passamos pra
      // generateLinkedInCard. Assim a frase do desafio no card é EXATAMENTE
      // a mesma que aparece no texto pronto pra postar — coerência visual
      // e textual entre a imagem e a caption.
      caption = await linkedinCaption(state, diagnosis, config);

      // Extrai a Frase 1 do parágrafo de recap (a recap é a parte logo após
      // "Hoje conclui mais uma simulação Active IA...". A Frase 1 é a primeira
      // sentença da recap, que descreve o desafio.
      const challenge = _extractChallengeFromCaption(caption);
      cardBlob = await generateLinkedInCard(state, diagnosis, config, challenge);
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
    // v1.4.1: layout flexível em vez de grid fixo de 2 colunas. No desktop a
    // imagem e o texto ficam lado a lado; no mobile (tela estreita) eles
    // empilham automaticamente (a imagem em cima, o texto embaixo), evitando
    // o texto espremido em coluna estreitíssima. O flex-wrap + min-width faz
    // a quebra sem precisar de media query em estilo inline.
    updateModalBody(`
      <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start;">
        <div style="flex:1 1 160px; max-width:220px; min-width:140px; margin:0 auto;">
          <img src="${cardUrl}" alt="Card Active IA" style="width:100%; border-radius:10px; border:1px solid var(--gal-border, #E2E8F0); display:block;" />
          <div style="font-size:11px; color:var(--gal-text-2, #475569); margin-top:6px; text-align:center; font-family:'Montserrat',sans-serif; font-weight:600;">IMAGEM 1080×1080</div>
        </div>
        <div style="flex:1 1 240px; min-width:200px;">
          <div style="font-family:'Montserrat',sans-serif; font-weight:600; font-size:10px; letter-spacing:0.1em; color:var(--gal-azul-escuro, #0074C7); margin-bottom:6px;">TEXTO SUGERIDO</div>
          <textarea id="activeia-share-caption" class="activeia-modal-input" style="min-height:200px; font-size:13.5px; line-height:1.6;">${escapeHTML(caption)}</textarea>
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
        onClick: async () => {
          const filename = `active-ia-${config.id}-${state.userName?.replace(/\s+/g, '-').toLowerCase() || 'estudante'}.png`;

          // v1.4.1: no mobile (especialmente dentro de app/WebView), tenta a
          // Web Share API primeiro — ela abre o menu nativo do celular para
          // o aluno escolher: Salvar imagem, Enviar por WhatsApp, etc. Apps
          // costumam permitir essa API porque é o jeito padrão de compartilhar
          // arquivos em mobile. Se não tiver suporte, cai no fallback de
          // abrir em aba nova (que o app pode bloquear, mas tentamos).
          if (_isMobileEnv()) {
            try {
              const response = await fetch(cardUrl);
              const blob = await response.blob();
              const file = new File([blob], filename, { type: 'image/png' });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: 'Active IA — Galícia Educação'
                });
                return false;
              }
            } catch (err) {
              if (err && err.name === 'AbortError') return false; // usuário cancelou
              console.warn('[ActiveIA] Web Share da imagem falhou:', err);
            }
            // Fallback: tenta abrir a imagem em nova aba (pode ser bloqueado)
            const win = window.open(cardUrl, '_blank');
            if (!win) {
              showModal({
                eyebrow: 'IMAGEM',
                title: 'Permita a abertura para salvar a imagem',
                body: 'Seu navegador bloqueou a abertura da imagem. Toque em "Abrir imagem" e, na página que abrir, segure a imagem e escolha "Salvar imagem".',
                bodyIsHTML: false,
                actions: [
                  { label: 'Fechar', close: true },
                  { label: 'Abrir imagem', primary: true, close: true, onClick: () => { window.open(cardUrl, '_blank'); } }
                ]
              });
            }
            return false;
          }
          // Desktop: download direto (atributo download funciona aqui)
          const a = document.createElement('a');
          a.href = cardUrl;
          a.download = filename;
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
  -webkit-overflow-scrolling: touch;
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
/* v1.4.1: ajustes mobile do modal — usa mais a tela, garante scroll, e
   empilha os botões do rodapé quando não cabem lado a lado. */
@media (max-width: 640px) {
  .activeia-modal-overlay { padding: 10px; }
  .activeia-modal { max-height: 92vh; border-radius: 12px; }
  .activeia-modal-header { padding: 16px 18px 12px; }
  .activeia-modal-title { font-size: 19px; }
  .activeia-modal-body { padding: 16px 18px; }
  .activeia-modal-footer {
    padding: 12px 18px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .activeia-modal-footer button {
    flex: 1 1 auto;
    min-height: 44px;
    padding: 11px 14px;
  }
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

  // v1.4.1: detecta ambiente mobile para escolher a estratégia de download.
  // No mobile, o atributo `download` + a.click() é amplamente ignorado pelos
  // navegadores (iOS/Safari, e dentro de iframe), então abrimos o conteúdo
  // numa nova aba ou usamos Web Share API para o usuário salvar/compartilhar
  // pelo sistema nativo.
  //
  // CORREÇÃO v1.4.1.1: usar largura do viewport como sinal de "mobile" era
  // perigoso porque o simulador roda dentro de um iframe, e a largura do
  // iframe pode ser estreita mesmo no DESKTOP (quando a coluna do WordPress
  // é estreita). Isso fazia desktops com iframe estreito serem tratados como
  // mobile, abrindo Web Share em vez do download direto. Agora usamos só
  // sinais confiáveis de dispositivo: user-agent (Android/iPhone/iPad/etc) e
  // tipo de ponteiro (coarse = dedo, fine = mouse). A largura do iframe não
  // entra mais no julgamento.
  function _isMobileEnv() {
    try {
      var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      var uaMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(ua);
      var coarsePointer = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      return !!(uaMobile || coarsePointer);
    } catch (e) {
      return false;
    }
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // v1.4.1: remove instruções [META: ...] que o motor anexa à resposta do
  // aluno antes de enviar pro modelo. Essas instruções orientam a IA sobre o
  // contexto do turno (ex: "Esta é a resposta 1 de 4 do ADVOGADO. NÃO encerre
  // agora."), mas NÃO devem aparecer no relatório que o aluno baixa — só
  // poluem e expõem a engrenagem. O padrão é o META aparecer ao final da
  // string, separado por linhas em branco.
  function _stripMetaInstruction(str) {
    if (!str) return '';
    return String(str).replace(/\s*\[META:[\s\S]*?\]\s*$/g, '').trim();
  }

  // v1.4.1: sanitização leve do feedback da IA para o relatório. A IA gera
  // o feedback com tags HTML simples de formatação (<strong>, <em>, <ul>,
  // <li>, <br>, <p>) para deixar a leitura clara — negrito em conclusões,
  // listas para balanço por critério. Aplicar escapeHTML completo neutralizava
  // essas tags, fazendo o aluno ver "<strong>Balanço</strong>" como texto.
  //
  // Esta função permite APENAS as tags de formatação básica acima e escapa o
  // resto. Não é uma sanitização exaustiva (não cobre XSS perfeito), mas o
  // feedback vem do modelo da Anthropic respondendo ao prompt do simulador —
  // não é entrada de usuário arbitrária. Risco prático: muito baixo.
  function _sanitizeFeedbackHTML(str) {
    if (!str) return '';
    // Lista branca de tags simples permitidas (sem atributos)
    var allowed = ['strong', 'b', 'em', 'i', 'u', 'br', 'p', 'ul', 'ol', 'li'];
    // Primeiro: escapa tudo
    var escaped = escapeHTML(str);
    // Depois: re-abre apenas as tags da whitelist (sem atributos)
    // Cobre <tag>, </tag> e <tag/> (autofechamento como <br/>)
    allowed.forEach(function(tag) {
      var openRe = new RegExp('&lt;' + tag + '&gt;', 'gi');
      var closeRe = new RegExp('&lt;/' + tag + '&gt;', 'gi');
      var selfRe = new RegExp('&lt;' + tag + '\\s*/&gt;', 'gi');
      escaped = escaped.replace(openRe, '<' + tag + '>');
      escaped = escaped.replace(closeRe, '</' + tag + '>');
      escaped = escaped.replace(selfRe, '<' + tag + '/>');
    });
    return escaped;
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
  // ============================================================================
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                                                                        ║
  // ║   v1.3 — MÉTODOS DE RENDER DO FRAMEWORK VISUAL                         ║
  // ║                                                                        ║
  // ║   Adicionados na v1.3.0 (sem mexer em nada da v1.2.13).                ║
  // ║   Para o simulador novo usar, ele importa o core.css junto com o JS    ║
  // ║   e chama ActiveIA.scene.render(...), ActiveIA.dossier.render(...),    ║
  // ║   ActiveIA.boot.render(...), etc.                                      ║
  // ║                                                                        ║
  // ║   Simuladores antigos (cerebrovascular v1.2.13) NÃO usam estes         ║
  // ║   métodos e continuam funcionando exatamente igual.                    ║
  // ║                                                                        ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  // ============================================================================
  // ==========================================================================

  // --------------------------------------------------------------------------
  // HELPER: mountIn(targetId, html)
  // Substitui o conteúdo de um elemento por HTML novo, com fade-in.
  // --------------------------------------------------------------------------
  function _mountIn(targetId, html) {
    const el = document.getElementById(targetId);
    if (!el) {
      console.error(`[ActiveIA v1.3] Elemento #${targetId} não encontrado no DOM.`);
      return null;
    }
    el.innerHTML = html;
    // Avisa o iframe da lição qual é a altura real do simulador, sempre que
    // uma tela é montada. Como TODAS as telas (boot, jogo, dossiê, etc.)
    // passam por _mountIn, este é o único lugar que precisa emitir.
    _notifyHeight();
    // Liga um observador contínuo de tamanho na tela ativa. Telas densas
    // como o dossiê "se acomodam" depois do render (fontes carregando,
    // tabelas recalculando) — sem o observador, a medição inicial pode pegar
    // um valor menor que o final e o iframe trava nesse tamanho menor,
    // cortando conteúdo.
    _observeActiveScreen();
    return el;
  }

  // --------------------------------------------------------------------------
  // HELPER: _notifyHeight()
  // Mede a altura real do CONTEÚDO e envia para a página hospedeira via
  // postMessage. Mede em vários momentos (próximo frame, 250ms, 600ms, 1200ms)
  // para cobrir conteúdo que "se acomoda" depois do render inicial — caso
  // do dossiê, que tem tabela, listas dinâmicas e fontes Montserrat que
  // só assentam após o primeiro paint. Seguro fora de iframe.
  //
  // Mede a altura do CONTEÚDO real (.screen.active via getBoundingClientRect),
  // NÃO do documentElement — dentro de um iframe, documentElement.scrollHeight
  // se auto-alimenta quando o iframe cresce, criando loop infinito. O
  // getBoundingClientRect da screen ativa reflete o tamanho intrínseco e
  // não tem esse problema.
  function _notifyHeight() {
    try {
      if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
      const send = function() {
        try {
          let h = 0;
          const active = document.querySelector('.screen.active');
          if (active) {
            h = Math.ceil(active.getBoundingClientRect().height);
          }
          // Fallback: se não houver .screen.active (padrões antigos),
          // usa scrollHeight do body (não do documentElement).
          if (!h && document.body) {
            h = Math.ceil(document.body.scrollHeight);
          }
          if (h > 0) {
            window.parent.postMessage({ type: 'activeia:height', height: h }, '*');
          }
        } catch (e) { /* cross-origin ou contexto restrito — ignora */ }
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(send);
      } else {
        send();
      }
      // Vários momentos cobrem conteúdo que demora a assentar (fontes,
      // tabelas, listas dinâmicas do dossiê).
      setTimeout(send, 250);
      setTimeout(send, 600);
      setTimeout(send, 1200);
    } catch (e) { /* nunca bloqueia a montagem da tela */ }
  }

  // --------------------------------------------------------------------------
  // HELPER: _observeActiveScreen()
  // Liga um ResizeObserver na tela ativa para detectar QUALQUER mudança de
  // altura depois do render inicial. Cobre o caso em que o conteúdo "cresce"
  // depois das medições agendadas (ex: dossiê com tabela longa de conceitos
  // que recalcula largura das colunas e empurra altura para cima).
  //
  // Desconecta o observer anterior antes de criar um novo — assim a memória
  // não acumula a cada troca de tela. Se ResizeObserver não existir no
  // navegador (raro hoje), apenas ignora.
  let _aiaResizeObserver = null;
  function _observeActiveScreen() {
    try {
      if (typeof ResizeObserver === 'undefined') return;
      if (_aiaResizeObserver) {
        try { _aiaResizeObserver.disconnect(); } catch (e) {}
        _aiaResizeObserver = null;
      }
      const active = document.querySelector('.screen.active');
      if (!active) return;
      _aiaResizeObserver = new ResizeObserver(function() {
        _notifyHeight();
      });
      _aiaResizeObserver.observe(active);
    } catch (e) { /* observador é melhoria, não bloqueia nada */ }
  }

  // --------------------------------------------------------------------------
  // HELPER: _activateScreen(screenId)
  // Tira o .active de todas as .screen e adiciona em uma específica.
  // --------------------------------------------------------------------------
  function _activateScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      console.error(`[ActiveIA v1.3] Tela #${screenId} não encontrada.`);
    }
  }

  // --------------------------------------------------------------------------
  // HELPER: _e(str)
  // Alias curto para escapeHTML em templates.
  // --------------------------------------------------------------------------
  function _e(str) {
    return escapeHTML(str == null ? '' : String(str));
  }

  // ==========================================================================
  // ActiveIA.loading — tela esmaecida de IA conectando / consultando
  // ==========================================================================

  function _ensureLoadingOverlay() {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.className = 'loading-overlay';
      el.innerHTML = `
        <div class="loading-bar-wrap"><div class="loading-bar-fill"></div></div>
        <div class="loading-text" id="loading-text">CONSULTANDO IA...</div>
      `;
      document.body.appendChild(el);
    }
    return el;
  }

  function loadingShow(message) {
    const overlay = _ensureLoadingOverlay();
    const text = document.getElementById('loading-text');
    if (text) text.textContent = (message || 'CONSULTANDO IA...').toUpperCase();
    overlay.classList.add('active');
  }

  function loadingHide() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function loadingMessage(message) {
    const text = document.getElementById('loading-text');
    if (text) text.textContent = (message || '').toUpperCase();
  }

  // ==========================================================================
  // ActiveIA.boot — capa editorial navy
  // ==========================================================================

  function bootRender(opts) {
    opts = opts || {};
    const eyebrow = _e(opts.eyebrow || 'ACTIVE IA · GALÍCIA EDUCAÇÃO');
    const title = opts.title || 'Active IA';      // pode conter <em>
    const subtitle = _e(opts.subtitle || '');
    const showResetBtn = opts.showResetBtn !== false;
    const targetId = opts.targetId || 'activeia-root';

    const html = `
      <section id="screen-boot" class="screen active">
        <div class="boot-stage">
          <div class="boot-eyebrow">${eyebrow}</div>
          <h1 class="boot-title">${title}</h1>
          ${subtitle ? `<p class="boot-sub">${subtitle}</p>` : ''}
          <div class="loading-bar-wrap" style="margin-top: 24px;">
            <div class="loading-bar-fill"></div>
          </div>
          ${showResetBtn ? `
            <div class="boot-actions" style="margin-top: 32px;">
              <button class="ghost-dark" data-aia-action="reset-session">Recomeçar do zero</button>
            </div>
          ` : ''}
        </div>
      </section>
    `;
    return _mountIn(targetId, html);
  }

  // ==========================================================================
  // ActiveIA.dailyblock — tela de bloqueio diário
  // ==========================================================================

  function dailyblockRender(opts) {
    opts = opts || {};
    const eyebrow = _e(opts.eyebrow || 'VOLTE AMANHÃ');
    const title = opts.title || 'Sua sessão de <em>hoje</em> foi concluída';
    const subtitle = _e(opts.subtitle || 'Para preservar a profundidade do aprendizado, o simulador libera uma sessão por dia. Volte amanhã.');
    const targetId = opts.targetId || 'activeia-root';

    const html = `
      <section id="screen-daily" class="screen active">
        <div class="boot-stage">
          <div class="boot-eyebrow">${eyebrow}</div>
          <h1 class="boot-title">${title}</h1>
          <p class="boot-sub">${subtitle}</p>
          <div class="daily-card">
            <div class="clock" id="daily-clock">--:--:--</div>
            <div class="clock-label">Tempo até nova sessão</div>
          </div>
        </div>
      </section>
    `;
    const el = _mountIn(targetId, html);
    _startDailyClockTick();
    return el;
  }

  function _startDailyClockTick() {
    const tick = () => {
      const el = document.getElementById('daily-clock');
      if (!el) return;
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const diff = end - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      el.textContent = `${h}:${m}:${s}`;
    };
    tick();
    if (window._aiaDailyClockInterval) clearInterval(window._aiaDailyClockInterval);
    window._aiaDailyClockInterval = setInterval(tick, 1000);
  }

  // ==========================================================================
  // ActiveIA.tutorial — 4 telas de tutorial com nav
  // ==========================================================================

  let _tutorialState = { slides: [], current: 0, onFinish: null };

  function tutorialRender(opts) {
    opts = opts || {};
    _tutorialState.slides = opts.slides || [];
    _tutorialState.current = 0;
    _tutorialState.onFinish = opts.onFinish || function(){};
    _tutorialState.targetId = opts.targetId || 'activeia-root';

    if (_tutorialState.slides.length === 0) {
      console.error('[ActiveIA v1.3] tutorial.render chamado sem slides.');
      return;
    }
    _renderTutorialSlide();
  }

  function _renderTutorialSlide() {
    const idx = _tutorialState.current;
    const slide = _tutorialState.slides[idx];
    const total = _tutorialState.slides.length;
    const eyebrow = _e(slide.eyebrow || `COMO FUNCIONA · ${idx + 1} DE ${total}`);
    const title = slide.title || '';
    const body = slide.body || '';
    const examples = slide.examples || null;

    const dots = _tutorialState.slides.map((_, i) => {
      let cls = 'tutorial-dot';
      if (i < idx) cls += ' done';
      else if (i === idx) cls += ' active';
      return `<span class="${cls}"></span>`;
    }).join('');

    let examplesHtml = '';
    if (examples) {
      if (examples.weak) {
        examplesHtml += `
          <div class="example weak">
            <div class="ex-label">${_e(examples.weak.label || 'Resposta fraca')}</div>
            <div>${_e(examples.weak.body)}</div>
          </div>
        `;
      }
      if (examples.strong) {
        examplesHtml += `
          <div class="example">
            <div class="ex-label">${_e(examples.strong.label || 'Resposta forte')}</div>
            <div>${_e(examples.strong.body)}</div>
          </div>
        `;
      }
    }

    const isFirst = idx === 0;
    const isLast = idx === total - 1;

    const html = `
      <section id="screen-tutorial" class="screen active">
        <div class="editorial-card">
          <div class="tutorial-progress">${dots}</div>
          <div class="tutorial-step">
            <span class="step-eyebrow">${eyebrow}</span>
            <h2>${title}</h2>
            ${body}
            ${examplesHtml}
          </div>
          <div class="tutorial-nav">
            <button data-aia-action="tutorial-back" ${isFirst ? 'style="visibility:hidden"' : ''}>← Voltar</button>
            <button class="primary" data-aia-action="tutorial-next">
              ${isLast ? 'Iniciar simulação →' : 'Próximo →'}
            </button>
          </div>
        </div>
      </section>
    `;
    _mountIn(_tutorialState.targetId, html);
  }

  function _tutorialNext() {
    const total = _tutorialState.slides.length;
    if (_tutorialState.current < total - 1) {
      _tutorialState.current++;
      _renderTutorialSlide();
    } else {
      _tutorialState.onFinish();
    }
  }

  function _tutorialBack() {
    if (_tutorialState.current > 0) {
      _tutorialState.current--;
      _renderTutorialSlide();
    }
  }

  // ==========================================================================
  // ActiveIA.namescreen — captura nome do estudante
  // ==========================================================================

  function namescreenRender(opts) {
    opts = opts || {};
    const eyebrow = _e(opts.eyebrow || 'IDENTIFICAÇÃO');
    const prompt = _e(opts.prompt || 'Como devemos te chamar?');
    const subtitle = _e(opts.subtitle || 'Seu nome aparece no card final compartilhável no LinkedIn.');
    const placeholder = _e(opts.placeholder || 'Seu nome completo');
    const targetId = opts.targetId || 'activeia-root';
    const onConfirm = opts.onConfirm || function(){};
    const onBack = opts.onBack || null;

    const html = `
      <section id="screen-name" class="screen active">
        <div class="editorial-card">
          <span class="step-eyebrow">${eyebrow}</span>
          <h2 class="name-prompt">${prompt}</h2>
          <p class="name-sub">${subtitle}</p>
          <input type="text" id="input-name" placeholder="${placeholder}" autocomplete="name">
          <div class="name-actions">
            ${onBack ? `<button data-aia-action="name-back">← Voltar</button>` : '<span></span>'}
            <button class="primary" data-aia-action="name-confirm">Continuar →</button>
          </div>
        </div>
      </section>
    `;
    _mountIn(targetId, html);
    // Foca o input automaticamente
    setTimeout(() => {
      const input = document.getElementById('input-name');
      if (input) input.focus();
    }, 100);
    // Guarda os callbacks
    _aiaCallbacks.nameConfirm = function() {
      const input = document.getElementById('input-name');
      const name = input ? input.value.trim() : '';
      if (name.length < 2) {
        if (input) input.focus();
        return;
      }
      onConfirm(name);
    };
    _aiaCallbacks.nameBack = onBack;
  }

  // ==========================================================================
  // ActiveIA.levelscreen — seleção de Júnior/Pleno/Sênior
  // ==========================================================================

  function levelscreenRender(opts) {
    opts = opts || {};
    const eyebrow = _e(opts.eyebrow || 'NÍVEL DE COMPLEXIDADE');
    const title = _e(opts.title || 'Escolha como quer começar');
    const subtitle = _e(opts.subtitle || 'Cada nível tem distribuição diferente de fases e tolerância à articulação genérica.');
    const cards = opts.cards || {};
    const targetId = opts.targetId || 'activeia-root';
    const onSelect = opts.onSelect || function(){};

    const levels = ['junior', 'pleno', 'senior'];
    const defaults = {
      junior: { num: '01', label: 'JÚNIOR', name: 'Caso direto', turns: '4 cenas', desc: 'Tolerante a respostas curtas.' },
      pleno: { num: '02', label: 'PLENO', name: 'Caso com ambiguidade', turns: '6 cenas', desc: 'Exige articulação consistente.' },
      senior: { num: '03', label: 'SÊNIOR', name: 'Caso complexo', turns: '9 cenas', desc: 'Avaliado com rigor de banca.' }
    };

    const cardsHtml = levels.map(lvl => {
      const c = Object.assign({}, defaults[lvl], cards[lvl] || {});
      return `
        <button class="level-card" data-aia-action="level-select" data-level="${lvl}">
          <div class="lvl-num">${_e(c.num)}</div>
          <div class="lvl-num-label">${_e(c.label)}</div>
          <div class="lvl-name">${_e(c.name)}</div>
          <div class="lvl-turns">${_e(c.turns)}</div>
          <div class="lvl-desc">${_e(c.desc)}</div>
        </button>
      `;
    }).join('');

    const html = `
      <section id="screen-level" class="screen active">
        <div class="editorial-card">
          <div class="level-eyebrow-block">
            <span class="step-eyebrow">${eyebrow}</span>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
          <div class="level-grid">${cardsHtml}</div>
        </div>
      </section>
    `;
    _mountIn(targetId, html);
    _aiaCallbacks.levelSelect = onSelect;
  }

  // ==========================================================================
  // ActiveIA.scene — render da cena (gamescreen)
  // ==========================================================================

  function sceneRender(opts) {
    opts = opts || {};
    const targetId = opts.targetId || 'activeia-root';
    const onSubmit = opts.onSubmit || function(){};
    const onConsult = opts.onConsult || null;

    // ---------- TOPBAR ----------
    const topbar = opts.topbar || {};
    const topbarMark = _e(topbar.mark || 'ACTIVE IA');
    const topbarTitle = _e(topbar.title || '');
    const phaseBadge = _e(topbar.phase || '');
    const studentLabel = _e(topbar.student || '');
    const connStatus = topbar.connectionStatus || 'connected';
    const connLabel = _e(topbar.connectionLabel || (connStatus === 'connected' ? 'IA conectada' : connStatus === 'connecting' ? 'Conectando' : 'Sem conexão'));

    // ---------- MONUMENT ----------
    const mon = opts.monument || {};
    const turnNum = String(mon.turnNumber || 1).padStart(2, '0');
    const turnTotal = `de ${String(mon.totalTurns || 4).padStart(2, '0')}`;
    const turnEyebrow = _e(mon.eyebrow || 'TURNO');
    const phaseLabel = _e(mon.phaseLabel || '');

    // ---------- PILL STRIP ----------
    const pills = opts.pillStrip || [];
    const pillsHtml = pills.length === 0 ? '' : `
      <div class="pill-strip">
        ${pills.map(p => {
          const mod = p.modifier ? ' ' + _e(p.modifier) : '';
          return `<span class="pill${mod}"><strong>${_e(p.label)}:</strong> ${_e(p.value)}</span>`;
        }).join('')}
      </div>
    `;

    // ---------- SCENE CARD (apenas a cena ativa) ----------
    // v1.3.1: removida acumulação de cenas (sceneHistory). Cada chamada de
    // scene.render substitui completamente o conteúdo. O feedback do turno
    // anterior aparece DENTRO do scene-card da cena atual (como no vf), não
    // como cena separada empilhada. O histórico fica disponível em appState
    // e no relatório exportável.
    const activeScene = opts.scene || {};
    const activeSceneHtml = _renderSceneCard(activeScene, true);
    // sceneHistory é silenciosamente ignorado (compat backward)

    // ---------- HINT ----------
    const hint = opts.hint || null;
    const hintHtml = !hint ? '' : `
      <div class="hint-bar">
        ${hint.strong ? `<strong>${_e(hint.strong)}</strong> ` : ''}${_e(hint.body)}
      </div>
    `;

    // ---------- INPUT ----------
    const submitInput = opts.submit || {};
    const placeholder = _e(submitInput.placeholder || 'Sua decisão...');
    const submitLabel = _e(submitInput.submitLabel || 'Confirmar decisão →');
    const showSaveDraft = submitInput.showSaveDraft !== false;
    const inputHint = _e(submitInput.hint || 'Quanto mais articulada a decisão, maior a pontuação dos indicadores.');

    const inputHtml = `
      <textarea
        id="response-textarea"
        class="response-textarea"
        placeholder="${placeholder}"></textarea>
      <div class="input-row">
        <span class="input-hint">${inputHint} <span class="input-hint-shortcut">(Ctrl+Enter envia)</span></span>
        <div class="input-actions">
          <button class="primary" data-aia-action="submit-response">${submitLabel}</button>
        </div>
      </div>
    `;
    // v1.3.2: 'Salvar rascunho' removido — sessão já salva automaticamente.
    // Ctrl+Enter habilitado via _initEventDelegation; dica visual incluída.

    // ---------- SIDE PANEL ----------
    const sidePanel = opts.sidePanel || {};
    const sections = sidePanel.sections || [];
    const sidePanelHtml = sections.map(sec => _renderPanelSection(sec)).join('');

    // ---------- STATUS STRIP (indicadores em faixa horizontal — mobile) ----------
    // v1.4.1: a side-panel é escondida pelo CSS abaixo de 900px (mobile).
    // Para que o aluno continue vendo os indicadores no celular, geramos uma
    // faixa horizontal compacta com os mesmos dados das seções type:'indicators'
    // e a colocamos no topo do game-stage. O CSS (.status-strip) é responsável
    // por mostrá-la apenas no mobile, escondendo-a no desktop. Reusa os
    // mesmos dados já recebidos em sections, sem pedir nada novo ao simulador.
    let statusStripHtml = '';
    const indicatorCells = [];
    sections.forEach(sec => {
      if (sec && sec.type === 'indicators') {
        const data = sec.data || [];
        data.forEach(ind => {
          const pct = Math.max(0, Math.min(100, Number(ind && ind.value) || 0));
          indicatorCells.push(`
            <div class="status-cell">
              <span class="sc-name">${_e(ind.name || '')}</span>
              <span class="sc-value">${pct}</span>
            </div>
          `);
        });
      }
    });
    if (indicatorCells.length > 0) {
      statusStripHtml = `
        <div class="status-strip">
          <div class="status-strip-inner">${indicatorCells.join('')}</div>
        </div>
      `;
    }

    // ---------- MONTAGEM FINAL ----------
    const html = `
      <section id="screen-game" class="screen active">
        <header class="game-topbar">
          <div class="topbar-brand">
            <span class="topbar-mark">${topbarMark}</span>
            <span class="topbar-title">${topbarTitle}</span>
          </div>
          <div class="topbar-meta">
            ${phaseBadge ? `<span class="phase-badge">${phaseBadge}</span>` : ''}
            ${studentLabel ? `<span class="meta-pill">${studentLabel}</span>` : ''}
            <span class="connection-badge" data-status="${_e(connStatus)}" title="Status da IA">
              <span class="conn-dot"></span>
              <span class="conn-label">${connLabel}</span>
            </span>
            <button class="icon-btn-dark" data-aia-action="theme-toggle" title="Alternar tema">☼</button>
            <button class="icon-btn-dark" data-aia-action="fullscreen" title="Tela cheia">⛶</button>
          </div>
        </header>
        <main class="game-stage">
          ${statusStripHtml}
          <div class="game-grid">
            <aside class="turn-monument">
              <div class="turn-meta-block">
                <div class="turn-eyebrow">${turnEyebrow}</div>
                <div class="turn-num-group">
                  <div class="turn-num">${turnNum}</div>
                  <div class="turn-total">${turnTotal}</div>
                </div>
                ${phaseLabel ? `<div class="turn-phase">${phaseLabel}</div>` : ''}
              </div>
            </aside>
            <section>
              ${pillsHtml}
              ${activeSceneHtml}
              ${hintHtml}
              ${inputHtml}
            </section>
            <aside class="side-panel">
              ${sidePanelHtml}
            </aside>
          </div>
        </main>
      </section>
    `;

    _mountIn(targetId, html);
    _aiaCallbacks.submitResponse = function() {
      const ta = document.getElementById('response-textarea');
      const text = ta ? ta.value.trim() : '';
      onSubmit(text);
    };
    _aiaCallbacks.consult = onConsult;
  }

  function _renderSceneCard(sceneData, withFeedback) {
    if (!sceneData || Object.keys(sceneData).length === 0) return '';
    const eyebrow = _e(sceneData.eyebrow || '');
    const eyebrowDetail = _e(sceneData.eyebrowDetail || '');
    const narrative = sceneData.narrative || '';
    const feedback = sceneData.feedback;

    const eyebrowHtml = eyebrow ? `
      <div class="scene-eyebrow">
        ${eyebrow}${eyebrowDetail ? ` <span class="sep"></span> ${eyebrowDetail}` : ''}
      </div>
    ` : '';

    let feedbackHtml = '';
    if (withFeedback && feedback) {
      const cls = _e(feedback.classification || '');
      const classMap = {
        articulada: 'Articulação plena',
        parcial: 'Articulação parcial',
        generica: 'Articulação genérica'
      };
      const classLabel = classMap[cls] || '';
      feedbackHtml = `
        <div class="scene-feedback">
          <div class="lead">
            ${_e(feedback.leadIn || 'O coordenador observa')}
            ${cls ? `<span class="feedback-class ${cls}">${classLabel}</span>` : ''}
          </div>
          <div class="feedback-body">${feedback.body || ''}</div>
        </div>
      `;
    }

    return `
      <article class="scene-card">
        ${eyebrowHtml}
        <div class="scene-narrative">${narrative}</div>
        ${feedbackHtml}
      </article>
    `;
  }

  function _renderPanelSection(sec) {
    const type = sec.type || 'text';
    const title = _e(sec.title || '');
    const isAlert = sec.alert === true;
    const cls = 'panel-section' + (isAlert ? ' alert' : '');

    let body = '';
    if (type === 'text') {
      const items = sec.items || [];
      if (items.length > 0) {
        body = items.map(it => {
          return `<p class="panel-text">${it.label ? `<strong>${_e(it.label)}:</strong> ` : ''}${_e(it.value || it)}</p>`;
        }).join('');
      } else if (sec.body) {
        body = `<div class="panel-text">${sec.body}</div>`;
      }
    } else if (type === 'indicators') {
      const inds = sec.data || [];
      body = inds.map((ind, i) => {
        const pct = Math.max(0, Math.min(100, Number(ind.value) || 0));
        return `
          <div class="ind-row" data-ind="${i + 1}">
            <div class="ind-row-head">
              <span class="ind-name">${_e(ind.name)}</span>
              <span class="ind-value">${pct}</span>
            </div>
            <div class="ind-bar"><div class="ind-bar-fill" style="width: ${pct}%"></div></div>
          </div>
        `;
      }).join('');
    } else if (type === 'consultants') {
      const list = sec.list || [];
      const counter = sec.counter || '';
      body = list.map((c, i) => {
        const disabled = c.disabled ? 'disabled' : '';
        return `
          <button class="consult-btn" data-aia-action="consult" data-consult-idx="${i}" ${disabled}>
            <span class="name">${_e(c.name)}</span>
            <span class="role">${_e(c.role)}</span>
          </button>
        `;
      }).join('');
      if (counter) {
        body += `<div class="consult-counter">${_e(counter)}</div>`;
      }
    } else if (type === 'alert') {
      body = `<div class="panel-text">${sec.body || ''}</div>`;
    }

    return `
      <section class="${cls}">
        ${title ? `<div class="panel-eyebrow">${title}</div>` : ''}
        ${body}
      </section>
    `;
  }

  // ==========================================================================
  // ActiveIA.dossier — render do dossiê final
  // ==========================================================================

  function dossierRender(diagnosis, config) {
    config = config || {};
    diagnosis = diagnosis || {};
    const targetId = config.targetId || 'activeia-root';

    // ---------- HERO ----------
    const eyebrowText = _e(config.eyebrow || 'DOSSIÊ DE SESSÃO');
    const sessionId = _e(diagnosis.sessionId || '');
    const firstName = _e(diagnosis.firstName || '');
    const lastName = _e(diagnosis.lastName || '');
    const sub = diagnosis.subtitle || '';

    // ---------- HEADLINE GRID (3 métricas) ----------
    const headlines = diagnosis.headlineGrid || [];
    const headlinesHtml = headlines.length === 0 ? '' : `
      <div class="dossier-headline-grid">
        ${headlines.map(h => {
          let valueHtml = '';
          if (h.valueText) {
            valueHtml = `<div class="dhg-value-text">${_e(h.valueText)}</div>`;
          } else {
            const max = h.max ? `<span style="font-size: 22px; color: rgba(255,255,255,0.5); font-weight: 500;">/${_e(h.max)}</span>` : '';
            valueHtml = `<div class="dhg-value">${_e(h.value)}${max}</div>`;
          }
          return `
            <div class="dhg-cell">
              <div class="dhg-label">${_e(h.label)}</div>
              ${valueHtml}
              <div class="dhg-sub">${_e(h.sub || '')}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // ---------- INDICADORES FINAIS ----------
    const indicators = diagnosis.indicators || [];
    const indicatorsHtml = indicators.length === 0 ? '' : `
      <section class="dashboard-section">
        <h3>Indicadores finais</h3>
        <p class="section-sub">Pontuação acumulada ao longo da sessão. Limite teórico: 100 por indicador.</p>
        <div class="go-indicators-grid">
          ${indicators.map((ind, i) => {
            const pct = Math.max(0, Math.min(100, Number(ind.value) || 0));
            return `
              <div class="go-ind-card" data-ind="${i + 1}">
                <div class="gi-name">${_e(ind.name)}</div>
                <div class="gi-value">${pct}<span class="gi-max">/100</span></div>
                <div class="gi-bar"><div class="gi-bar-fill" style="width: ${pct}%"></div></div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;

    // ---------- MAPA DE DOMÍNIO CONCEITUAL ----------
    const concepts = diagnosis.conceptMap || [];
    const conceptsHtml = concepts.length === 0 ? '' : `
      <section class="dashboard-section">
        <h3>Mapa de domínio conceitual</h3>
        <p class="section-sub">Conceitos do módulo testados ou demonstrados nesta sessão.</p>
        <div class="concept-table-wrap">
          <table class="concept-table">
            <thead>
              <tr>
                <th style="width: 28%;">Conceito</th>
                <th style="width: 16%;">Referência</th>
                <th style="width: 14%;">Estado</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              ${concepts.map(c => `
                <tr>
                  <td class="c-name">${_e(c.name)}</td>
                  <td class="c-ref">${_e(c.reference || '')}</td>
                  <td><span class="concept-status ${_e(c.status)}">${_e(_conceptStatusLabel(c.status))}</span></td>
                  <td class="c-just">${_e(c.justification || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    // ---------- PONTOS FORTES ----------
    const strengths = diagnosis.strengths || [];
    const strengthsHtml = `
      <section class="dashboard-section">
        <h3>Pontos fortes</h3>
        <p class="section-sub">Decisões em que sua articulação superou o esperado para o nível.</p>
        ${strengths.length === 0
          ? `<ul class="points-list"><li class="empty-state">Nenhum ponto forte destacado nesta sessão.</li></ul>`
          : `<ul class="points-list">
              ${strengths.map(s => `
                <li class="strength">
                  <div class="turn-num-big">${String(s.turn).padStart(2, '0')}</div>
                  <div class="turn-content">
                    <div class="turn-label">${_e(s.label || '')}</div>
                    <div class="desc">${_e(s.description || '')}</div>
                  </div>
                </li>
              `).join('')}
            </ul>`
        }
      </section>
    `;

    // ---------- PONTOS A REVISITAR ----------
    const weaknesses = diagnosis.weaknesses || [];
    const weaknessesHtml = `
      <section class="dashboard-section">
        <h3>Pontos a revisitar</h3>
        <p class="section-sub">Decisões em que faltou articulação ou aplicação de conceito específico.</p>
        ${weaknesses.length === 0
          ? `<ul class="points-list"><li class="empty-state">Nenhum ponto a revisitar nesta sessão — desempenho consistente.</li></ul>`
          : `<ul class="points-list">
              ${weaknesses.map(w => `
                <li class="weakness">
                  <div class="turn-num-big">${String(w.turn).padStart(2, '0')}</div>
                  <div class="turn-content">
                    <div class="turn-label">${_e(w.label || '')}</div>
                    <div class="desc">${_e(w.description || '')}</div>
                  </div>
                </li>
              `).join('')}
            </ul>`
        }
      </section>
    `;

    // ---------- RECOMENDAÇÃO ----------
    const rec = diagnosis.recommendation || {};
    const recHtml = `
      <section class="dashboard-section">
        <h3>Recomendação de próximo passo</h3>
        <p class="section-sub">Baseada no seu desempenho nesta sessão.</p>
        <div class="recommendation-card">
          <div class="rec-eyebrow">PRÓXIMO PASSO RECOMENDADO</div>
          <div class="rec-action">${_e(rec.action || 'Próxima ação')}</div>
          <div class="rec-rationale">${rec.rationale || ''}</div>
        </div>
        <div class="export-actions">
          <button class="primary" data-aia-action="export-report">📄 Baixar relatório completo</button>
          <button data-aia-action="share-linkedin">🔗 Compartilhar no LinkedIn</button>
          <button data-aia-action="new-session">↻ Nova sessão</button>
        </div>
      </section>
    `;

    // ---------- MONTAGEM ----------
    const html = `
      <section id="screen-dashboard" class="screen active">
        <header class="dossier-hero">
          <div class="dossier-inner">
            <div class="dossier-header-row">
              <div class="dossier-eyebrow">${eyebrowText}</div>
              ${sessionId ? `
                <div class="dossier-session-id">
                  <div class="dsid-label">SESSÃO</div>
                  <div class="dsid-value">${sessionId}</div>
                </div>
              ` : ''}
            </div>
            <h1 class="dossier-name">${firstName}${lastName ? ` <span class="lastname">${lastName}</span>` : ''}</h1>
            ${sub ? `<p class="dossier-sub">${sub}</p>` : ''}
            ${headlinesHtml}
          </div>
        </header>
        <main class="dossier-body">
          ${indicatorsHtml}
          ${conceptsHtml}
          ${strengthsHtml}
          ${weaknessesHtml}
          ${recHtml}
        </main>
      </section>
    `;
    _mountIn(targetId, html);
  }

  function _conceptStatusLabel(status) {
    const map = {
      dominado: 'Dominado',
      parcial: 'Parcial',
      fragil: 'Frágil',
      nao_demonstrado: 'Não demonstrado'
    };
    return map[status] || status || '';
  }

  // ==========================================================================
  // ActiveIA.transitions — utilidades de transição entre telas
  // ==========================================================================

  function transitionsNext(opts) {
    opts = opts || {};
    if (opts.screenId) _activateScreen(opts.screenId);
  }

  // ==========================================================================
  // GLOBAL EVENT DELEGATION (clicks via data-aia-action)
  // ==========================================================================

  const _aiaCallbacks = {};

  function _initEventDelegation() {
    if (window._aiaDelegationReady) return;
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[data-aia-action]');
      if (!target) return;
      const action = target.getAttribute('data-aia-action');
      _handleAction(action, target, e);
    });
    document.addEventListener('keydown', function(e) {
      // Enter no input de nome → confirma nome
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'input-name') {
        e.preventDefault();
        _handleAction('name-confirm', document.activeElement, e);
      }
      // Ctrl+Enter (ou Cmd+Enter no Mac) no textarea de resposta → submete
      // v1.3.2: substitui o botão "Salvar rascunho" como aceleração de UX
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && document.activeElement && document.activeElement.id === 'response-textarea') {
        e.preventDefault();
        _handleAction('submit-response', document.activeElement, e);
      }
    });
    window._aiaDelegationReady = true;
  }

  function _handleAction(action, target, evt) {
    switch (action) {
      case 'tutorial-next': _tutorialNext(); break;
      case 'tutorial-back': _tutorialBack(); break;
      case 'name-confirm': if (_aiaCallbacks.nameConfirm) _aiaCallbacks.nameConfirm(); break;
      case 'name-back': if (_aiaCallbacks.nameBack) _aiaCallbacks.nameBack(); break;
      case 'level-select': {
        const lvl = target.getAttribute('data-level');
        if (_aiaCallbacks.levelSelect) _aiaCallbacks.levelSelect(lvl);
        break;
      }
      case 'submit-response': if (_aiaCallbacks.submitResponse) _aiaCallbacks.submitResponse(); break;
      case 'consult': {
        const idx = parseInt(target.getAttribute('data-consult-idx'), 10);
        if (_aiaCallbacks.consult) _aiaCallbacks.consult(idx);
        break;
      }
      case 'theme-toggle': {
        const cur = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', cur === 'dark' ? '' : 'dark');
        break;
      }
      case 'fullscreen': {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
        break;
      }
      case 'reset-session':
      case 'new-session':
      case 'export-report':
      case 'share-linkedin':
      case 'save-draft': {
        const cb = _aiaCallbacks[action.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
        if (cb) cb();
        else console.log(`[ActiveIA v1.3] Ação "${action}" sem callback registrado. Use ActiveIA.on('${action}', fn).`);
        break;
      }
      default:
        console.log(`[ActiveIA v1.3] Ação desconhecida: ${action}`);
    }
  }

  function aiaOn(action, callback) {
    const key = action.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    _aiaCallbacks[key] = callback;
  }

  // Inicializa o delegation no boot do core
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _initEventDelegation);
    } else {
      _initEventDelegation();
    }
  }

  // ==========================================================================
  // FIM DO BLOCO v1.3
  // ==========================================================================

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
    guards: {
      detectAbuse: detectAbuse,
      buildConductFailResponse: buildConductFailResponse
    },
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
    },

    // ========================================================================
    // v1.3 — Métodos de render do framework visual
    // ========================================================================
    loading: {
      show: loadingShow,
      hide: loadingHide,
      message: loadingMessage
    },
    boot: { render: bootRender },
    dailyblock: { render: dailyblockRender },
    tutorial: { render: tutorialRender },
    namescreen: { render: namescreenRender },
    levelscreen: { render: levelscreenRender },
    scene: { render: sceneRender },
    dossier: { render: dossierRender },
    transitions: { next: transitionsNext },
    on: aiaOn
  };

  console.log(`[ActiveIA] Core v${CORE_VERSION} carregado`);

})(typeof window !== 'undefined' ? window : globalThis);
