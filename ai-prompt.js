(function () {
  const MODE_SCHEMAS = {
    bilan: [
      { key: "synthese", label: "Synthèse", type: "text" },
      { key: "points_forts", label: "Points forts", type: "list" },
      { key: "points_a_retravailler", label: "Points à retravailler", type: "list" },
      { key: "suite_proposee", label: "Suite proposée", type: "list" },
      { key: "reperages_eleves", label: "Repérages élèves", type: "list" },
    ],
    difficulte: [
      { key: "synthese", label: "Synthèse", type: "text" },
      { key: "eleves_difficulte", label: "Élèves en difficulté", type: "list" },
      { key: "points_vigilance", label: "Points de vigilance", type: "list" },
    ],
    points_forts: [
      { key: "synthese", label: "Synthèse", type: "text" },
      { key: "points_forts", label: "Points forts", type: "list" },
      { key: "idees_consolidation", label: "Idées pour consolider", type: "list" },
    ],
    suivi: [
      { key: "synthese", label: "Synthèse", type: "text" },
      { key: "priorites", label: "Priorités", type: "list" },
      { key: "suggestions", label: "Suggestions", type: "list" },
    ],
    question: [
      { key: "reponse", label: "Réponse", type: "text" },
      { key: "pistes", label: "Pistes d'action", type: "list" },
    ],
  };

  const SECTION_SCHEMA = MODE_SCHEMAS.bilan;
  const QUESTION_SCHEMA = MODE_SCHEMAS.question;

  const MODE_OBJECTIVES = {
    bilan: "Résume la séance en trois idées clés et ce qui suit.",
    difficulte: "Repère les difficultés majeures et ce qu’il faut surveiller rapidement.",
    points_forts: "Mets en valeur les réussites et indique comment les consolider.",
    suivi: "Prépare la prochaine séance avec des priorités simples et actionnables.",
    question: "Réponds précisément à la question en restant concret et ancré dans les données.",
    test: "Réponds simplement par la chaîne «OK» si tout est clair.",
  };

  const REFERENTIAL_ALIASES = {
    climb_track: "climb_track",
    "climb track": "climb_track",
    climbtrack: "climb_track",
    "arcathlon v2": "arcathlon_v2",
    arcathlon_v2: "arcathlon_v2",
    arcathlon: "arcathlon_v2",
    "arc athlon v2": "arcathlon_v2",
    "cross training": "cross_training",
    crosstraining: "cross_training",
    cross_training: "cross_training",
    "cross-training": "cross_training",
  };

  const REFERENTIAL_BLOCKS = {
    arcathlon_v2: buildArcAthlonBlock,
    cross_training: buildCrossTrainingBlock,
  };

  function buildPrompt({ analysisInput, mode = "bilan", analysisMode = "session" }) {
    const payload = analysisInput || {};
    console.info("[ScanProf IA] prompt mode", {
      hasCycle: !!payload?.cycle_bundle,
      cycleSessions: payload?.cycle_bundle?.sessions?.length || 0,
      hasMultiApps: !!payload?.session_bundle,
      multiSources: payload?.session_bundle?.sources?.length || 0,
      requestedMode: analysisMode,
    });
    const contexte = payload.contexte || {};
    const objectif = MODE_OBJECTIVES[mode] || MODE_OBJECTIVES.bilan;
    const schema = MODE_SCHEMAS[mode] || SECTION_SCHEMA;
    const sessionBundle = payload.session_bundle || null;
    const cycleBundle = payload.cycle_bundle || null;
    const requestedMode = analysisMode || "session";
    const cycleBundleAvailable = cycleBundle?.sessions?.length > 1;
    const isCycleBundle = mode === "bilan" && cycleBundleAvailable && requestedMode === "cycle";
    const isMultiSourceBundle = !isCycleBundle && mode === "bilan" && sessionBundle?.sources?.length > 1;
    const referentiel = isCycleBundle
      ? detectReferentialFromCycle(cycleBundle)
      : isMultiSourceBundle
      ? null
      : detectReferential({ contexte, payload });
    const sessionMeta = {
      activityLabel:
        contexte.activite ||
        contexte.activity_label ||
        contexte.dictionnaire_activite?.label ||
        payload.class_analytics?.context?.activity_label ||
        "",
      dictionaryId:
        contexte.dictionnaire_activite?.id ||
        payload.class_analytics?.context?.dictionary_id ||
        "",
    };
    const datasetSummary = {
      hasSummarySentences: Boolean(payload.summary_sentences || payload.class_analytics?.summary_sentences),
      hasClassAnalytics: Boolean(payload.class_analytics),
    };
    const pedagogicalRules = {
      hasStudentProfiles: Boolean(payload.student_profiles || payload.student_profile_sentences),
    };
    const dataset = Array.isArray(payload.donnees_eleves) ? payload.donnees_eleves : payload.eleves || [];
    const datasetSignals = analyzeDatasetSignals({ referentiel, dataset });
    const useLegacy = !isCycleBundle && !isMultiSourceBundle && (mode !== "bilan" || referentiel === "climb_track");
    const instructions = isCycleBundle
      ? buildCyclePrompt({ schema, objective: objectif, cycleBundle })
      : isMultiSourceBundle
      ? buildMultiSourcePrompt({ schema, objective: objectif, sessionBundle })
      : useLegacy
      ? buildLegacyInstructions({ schema, objective: objectif, mode })
      : buildAIPrompt({
          referentiel,
          sessionMeta,
          datasetSummary,
          pedagogicalRules,
          schema,
          objective: objectif,
          mode,
          datasetSignals,
        });
    const promptBranch = isCycleBundle
      ? "cycle"
      : isMultiSourceBundle
      ? "multi-apps"
      : useLegacy && referentiel === "climb_track"
      ? "climb-track-legacy"
      : useLegacy
      ? "legacy"
      : "standard";
    console.info("[ScanProf IA][Prompt] Branche sélectionnée", {
      branch: promptBranch,
      isCycleBundle,
      isMultiSourceBundle,
      referentiel,
    });

  const content = {
      contexte,
      intention: mode,
      donnees_eleves: payload.eleves || [],
      question: payload.questionText || "",
      interpretation: payload.interpretation || null,
      pre_analysis: payload.pre_analysis || null,
      summary_sentences: payload.summary_sentences || payload.class_analytics?.summary_sentences || null,
      student_profiles: payload.student_profiles || payload.class_analytics?.student_profiles || null,
      student_profile_sentences:
        payload.student_profile_sentences || payload.class_analytics?.student_profile_sentences || null,
      student_analysis: payload.student_analysis || payload.class_analytics?.student_analysis || null,
      class_analytics: payload.class_analytics || null,
      session_bundle: sessionBundle,
      cycle_bundle: cycleBundle,
    };

  const messages = [
      {
        role: "system",
        content:
          "Tu es un assistant pédagogique francophone spécialisé en analyse de séances d'EPS. Réponds toujours en français et fournis des recommandations concrètes.",
      },
      {
        role: "user",
        content: `${instructions}\n\nDonnées structurées :\n\`\`\`json\n${JSON.stringify(
          content
        )}\n\`\`\``,
      },
    ];

    return { messages, schema };
  }

  function buildAIPrompt({
    referentiel,
    sessionMeta = {},
    datasetSummary = {},
    pedagogicalRules = {},
    schema,
    objective,
    mode,
    datasetSignals = {},
  }) {
    const schemaStructure = buildStructureHint(schema);
    const prioritizeSummary = referentiel !== "arcathlon_v2" && referentiel !== "cross_training";
    const sections = [
      buildCommonPromptSection({ schemaStructure, datasetSummary, pedagogicalRules, prioritizeSummary }),
      buildReferentialBlock(referentiel, sessionMeta, datasetSignals),
      mode === "question"
        ? "Réponds obligatoirement à la question fournie en t’appuyant sur les données de séance. N’invente jamais de valeur."
        : null,
      objective,
    ];
    return sections.filter(Boolean).join("\n\n");
  }

  function buildMultiSourcePrompt({ schema, objective, sessionBundle }) {
    const schemaStructure = buildStructureHint(schema);
    const sourceLines = (sessionBundle?.sources || []).map((source, index) => {
      const label = source?.app_label || source?.app_id || `Source ${index + 1}`;
      const count = Array.isArray(source?.dataset) ? source.dataset.length : null;
      return count != null ? `- ${label} (${count} entrées)` : `- ${label}`;
    });
    const lines = [
      "MODE MULTI-APPLICATIONS — plusieurs référentiels QR ont alimenté cette séance.",
      "Sources disponibles :",
      sourceLines.length ? sourceLines.join("\n") : "- (sources non listées)",
      "",
      "Consignes spécifiques :",
      "- Utilise d'abord `session_bundle.merged_session_analysis` pour décrire la vision globale (overview, strengths, needs_work, next_steps).",
      "- Appuie-toi ensuite sur `session_bundle.sources[]` pour illustrer les constats en citant l'application concernée lorsque c'est pertinent.",
      "- Ne fusionne pas les datasets : garde la provenance explicite (« Cross Training : … », « Climb Track : … »).",
      "- `reperages_eleves` provient exclusivement de `merged_session_analysis.student_profiles` / `student_profile_sentences`. Si aucun profil fusionné n'est disponible, renvoie une liste vide sans inventer.",
      "- Mentionne les limites lorsqu'une source manque de données plutôt que d'inventer.",
      "- Chaque section texte doit tenir en ≤ 12 mots ; chaque liste contient 2 à 4 éléments factuels ou [].",
      "- Les suites pédagogiques doivent proposer des actions concrètes tenant compte de l'ensemble des applications.",
      "- Respecte strictement ce format JSON (aucun markdown, aucun texte avant/après) :",
      schemaStructure,
      "",
      objective,
    ];
    return lines.filter(Boolean).join("\n");
  }

  function buildCyclePrompt({ schema, objective, cycleBundle }) {
    const schemaStructure = buildStructureHint(schema);
    const meta = cycleBundle?.cycle_meta || {};
    const sessionCount = meta.session_count || (cycleBundle?.sessions?.length || 0);
    const appLabel = meta.app_label || meta.activity_name || "Application";
    const lines = [
      `MODE BILAN DE CYCLE — ${appLabel} — ${sessionCount} séance(s).`,
      "- Utilise en priorité `cycle_bundle.merged_cycle_analysis` (overview, progressions, stagnations, regressions, next_steps).",
      "- Compare explicitement la première et la dernière séance dès que des mesures existent (volume de voies, niveaux atteints, statuts, vitesses, etc.).",
      "- Mets en avant les progrès observables (progressions) avant d’ajouter des compléments issus des séances finales.",
      "- Identifie ensuite les stagnations ou fragilités persistantes en t’appuyant sur `stagnations` et `regressions`, puis précise les limites si les données sont partielles.",
      "- Décris la dynamique temporelle du cycle : mentionne ce qui change entre le début et la fin (ex. « moins d’absences », « niveau médian plus élevé »).",
      "- Reformule des suites pédagogiques concrètes à partir de `next_steps`; ajoute-en seulement si elles sont justifiées par les données.",
      "- Utilise `class_analytics.teaching_diagnosis` pour relier les constats à la lecture pédagogique de l'activité.",
      "- Appuie-toi sur `class_analytics.next_session_guidance` pour fixer la priorité principale de la prochaine séance et citer les leviers proposés.",
      "- Enchaîne systématiquement : 1) ce que montrent les données du cycle, 2) la lecture pédagogique (diagnostic / problem_type), 3) la priorité annoncée, 4) la suite concrète.",
      "- Si disponible, mentionne explicitement `class_analytics.teaching_diagnosis.problem_type` pour cadrer la priorité (ex. hétérogénéité, data gap).",
      "- Interdiction d’écrire « continuer », « poursuivre » ou « être attentif » sans objet précis : chaque recommandation doit citer un levier ou un indicateur à suivre.",
      "- `reperages_eleves` repose exclusivement sur `merged_cycle_analysis.student_profile_sentences`; si aucun profil fiable n’est fourni, renvoie [].",
      "- Les données partielles ne justifient jamais « Aucune information disponible » : base la synthèse sur la continuité du cycle, l'organisation des séances, la qualité de collecte et des améliorations concrètes du suivi.",
      "- Tu peux citer ponctuellement `cycle_bundle.sessions[]` (ex. « Séance 2 ») pour étayer un constat sans recalculer.",
      "- Réponse attendue en JSON strict sans texte autour, avec exactement les clés suivantes :",
      schemaStructure,
      "",
      objective,
    ];
    return lines.filter(Boolean).join("\n");
  }

  function buildCommonPromptSection({
    schemaStructure,
    datasetSummary = {},
    pedagogicalRules = {},
    prioritizeSummary = true,
  }) {
    const summaryHint = prioritizeSummary
      ? datasetSummary.hasSummarySentences
        ? "- Utilise en priorité `summary_sentences` : `overview` pour la synthèse, `strengths` pour les points forts, `needs_work` pour les points à retravailler et `next_steps` pour la suite."
        : "- `summary_sentences` peut être vide : construis alors chaque section directement à partir de `class_analytics`, `pre_analysis` et des données brutes."
      : "- Commence par analyser `donnees_eleves`, `pre_analysis` et `class_analytics`, puis n'utilise `summary_sentences` qu'en complément lorsqu'elles apportent des constats fiables.";
    const profileHint = pedagogicalRules.hasStudentProfiles
      ? "- Les prénoms cités dans « repérages élèves » proviennent uniquement de `student_profiles` / `student_profile_sentences`."
      : "- Si aucun profil nominatif fiable n'est fourni, renvoie `reperages_eleves: []`.";
    const teachingDiagnosisHint =
      "- Appuie-toi sur `class_analytics.teaching_diagnosis` (main_finding, class_profile, priority_hint, evidence) pour formuler la lecture pédagogique et relier chaque constat aux données.";
    const nextGuidanceHint =
      "- Reformule `class_analytics.next_session_guidance` (priority_for_next_session, teaching_levers, next_session_ideas) pour préciser la priorité de travail et proposer des suites concrètes.";
    const lines = [
      "Tu es un assistant pédagogique francophone pour des enseignants d'EPS.",
      "SOCLE COMMUN — livrables attendus :",
      "1. Synthèse courte de la séance (≤ 12 mots).",
      "2. 2 à 4 points forts concrets basés sur les données transmises.",
      "3. 2 à 4 points à retravailler en reliant chaque constat aux données observables.",
      "4. 2 à 4 suites pédagogiques concrètes et actionnables.",
      "5. Un bloc « repérages élèves » uniquement si des signaux nominaux fiables existent.",
      "",
      "Méthode générale :",
      "- Analyse uniquement les données transmises. Si une information manque, signale la limite sans inventer.",
      "- Respecte l'ordre : 1) données factuelles, 2) dictionnaire métier, 3) précisions enseignant.",
      "- Signale tout code, suffixe ou niveau non documenté plutôt que d'en déduire une signification.",
      "- Les aides d'interprétation (`interpretation`) complètent les données mais ne les remplacent jamais.",
      summaryHint,
      "- Appuie-toi ensuite sur `class_analytics` (context, data_quality, distributions, measures, comparisons, student_groups, pedagogical_signals, limits) pour enrichir l'analyse sans recalculer.",
      "- Exploite `pre_analysis` : restitue `known_facts`, `allowed_comparisons`, `pedagogical_signals`, et mentionne les `unknown_codes` avec prudence.",
      "- Si les données sont partielles, maintiens une lecture utile et prudente plutôt que de répondre « Aucune information disponible ».",
      teachingDiagnosisHint,
      nextGuidanceHint,
      "- Pour chaque section, applique la séquence : donnée observée → lecture pédagogique → conséquence/action concrète.",
      "- Cite `class_analytics.teaching_diagnosis.problem_type` ou `priority_hint` quand tu exposes la priorité pour montrer le lien avec les données.",
      "- Dans `points_a_retravailler`, relie chaque besoin aux indices fournis (`summary_sentences.needs_work`, `teaching_diagnosis.evidence`).",
      "- Dans `suite_proposee`, commence par la priorité annoncée (`next_session_guidance.priority_for_next_session`), puis ajoute 1 à 2 leviers précis (`teaching_levers`, `next_session_ideas`).",
      "- Interdiction d’écrire des consignes vagues telles que « continuer », « poursuivre » ou « être attentif » sans préciser l’objet et l’indicateur associé.",
      "- Chaque champ texte se limite à une phrase simple (≤ 12 mots).",
      "- Chaque liste contient 2 à 4 éléments courts quand une information existe ; sinon renvoie [].",
      "- Utilise les pourcentages et volumes fournis pour formuler « la moitié », « un tiers », « X % » sans extrapoler.",
      "- Tu peux citer un code ou une colonne pour souligner une limite ou une consigne claire.",
      "- N'utilise jamais de markdown ni de blocs ``` dans la réponse finale.",
      profileHint,
      "- Structure ta réponse en JSON strict, sans texte avant ou après, en respectant exactement ce format :",
      schemaStructure,
      'Chaque clé est obligatoire : "synthese", "points_forts", "points_a_retravailler", "suite_proposee", "reperages_eleves". N\'ajoute aucun autre champ.',
    ];
    return lines.filter(Boolean).join("\n");
  }

  function buildReferentialBlock(referentiel, sessionMeta = {}, datasetSignals = {}) {
    if (!referentiel) {
      return buildFallbackReferentialBlock(sessionMeta.activityLabel);
    }
    const builder = REFERENTIAL_BLOCKS[referentiel];
    if (typeof builder === "function") {
      return builder(datasetSignals);
    }
    return buildFallbackReferentialBlock(sessionMeta.activityLabel);
  }

  function buildFallbackReferentialBlock(activityLabel = "") {
    const activityText = activityLabel ? ` pour l'activité « ${activityLabel} »` : "";
    return [
      `Bloc prudent${activityText} :`,
      "- Aucun référentiel spécifique reconnu. Reste descriptif et factuel.",
      "- Signale clairement les limites dues à l'absence de référentiel ou à des colonnes non documentées.",
      "- Repère malgré tout les tendances simples (volumes, moyennes, écarts) dès qu'elles sont explicites.",
    ].join("\n");
  }

  function buildArcAthlonBlock(datasetSignals = {}) {
    const arcFields = datasetSignals.arcathlonFields || [];
    const arcFieldNote = arcFields.length
      ? `- Données brutes détectées : ${arcFields.join(", ")}. Analyse-les directement avant de te référer à un résumé.`
      : "- Analyse directement les champs nb_10→nb_6, points_total, points_max et zone2_* lorsqu'ils sont présents.";
    return [
      "Bloc spécifique — ArcAthlon V2 :",
      "- Codes disponibles : distance, indice_arc, nb_10 à nb_6, points_max, points_total, zone_entries, zone2_points, zone2_shots.",
      "- Compare points_total à points_max pour situer la marge de progression globale.",
      "- Analyse la distribution des scores (nb_10 → nb_6) pour décrire la précision et la régularité.",
      "- Observe zone_entries, zone2_points et zone2_shots pour lire l'activité et l'efficacité en zone 2.",
      "- Compare les distances uniquement si le protocole de séance est identique ; sinon mentionne la limite.",
      "- Interprète indice_arc avec prudence si la formule exacte n'est pas fournie.",
      arcFieldNote,
      "- Signaux attendus : précision solide (beaucoup de 10/9), dispersion des impacts, marge entre points_total et points_max, rendement zone 2 (bon ou insuffisant), nombreuses entrées peu efficaces.",
      "- Limites : n'invente jamais la formule d'indice_arc, ne surinterprète pas une variation isolée et base tes conclusions uniquement sur les scores saisis.",
    ].join("\n");
  }

  function buildCrossTrainingBlock(datasetSignals = {}) {
    const planColumns = datasetSignals.crossPlanColumns || [];
    const planNote = planColumns.length
      ? `- Colonnes prévu/réalisé détectées : ${planColumns.join(", ")}. Exploite-les systématiquement pour comparer l'engagement.`
      : "- Si les colonnes *_p / *_r sont absentes, précise que la comparaison prévu/réalisé est limitée.";
    return [
      "Bloc spécifique — CrossTraining :",
      "- Codes ateliers : bu (burpees), cr (crunch), di (dips), fe (fentes), jk (jumping jack), mt (mountain climber), sa (saut), po (pompes), ra (rameur), sq (squat).",
      "- Suffixes : `_p` (prévu), `_r` (réalisé), `_l` (niveau/difficulté), `_1` (N1) et `_2` (N2). Les abréviations ajoutées par l'enseignant priment.",
      "- Compare systématiquement prévu (_p) et réalisé (_r) pour repérer la gestion de l'effort et la régularité sur chaque atelier.",
      planNote,
      "- Repère les écarts significatifs (≈10-15 % ou plus) : ils signalent soit une difficulté de dosage/endurance soit un engagement supérieur au plan.",
      "- Valorise les élèves/ateliers qui réalisent la majorité du prévu ou qui dépassent régulièrement l'objectif.",
      "- Signale les blocages récurrents sur un même atelier ou des écarts importants entre niveaux (N1 vs N2) pour justifier une différenciation.",
      "- Limites : ne déduis aucune explication physiologique si elle n'est pas observée et reste prudent si certaines colonnes prévues/réalisées manquent.",
    ].join("\n");
  }

  function buildLegacyInstructions({ schema, objective, mode }) {
    const lines = [
      "Tu es un assistant pédagogique francophone pour des enseignants d'EPS.",
      "Analyse uniquement les données transmises. Si une information est absente, indique-le clairement sans l'inventer.",
      "Les colonnes détectées sont fournies dans le contexte. Si aucune signification n'est précisée, reste descriptif et indique que l'abréviation n'a pas été expliquée.",
      "Des aides d'interprétation peuvent être présentes dans le champ `interpretation`. Utilise-les après les informations explicites de la séance, puis complète avec le dictionnaire associé à l'activité, puis avec les indications saisies par l'enseignant.",
      "Respecte l'ordre : 1) données factuelles, 2) dictionnaire métier, 3) notes manuelles. Ne déduis rien au-delà.",
      "Si un code, suffixe ou niveau n'apparaît pas dans le dictionnaire fourni, mentionne qu'il est non documenté et invite à compléter le référentiel plutôt que d'inventer.",
      "Lorsque le dictionnaire précise un niveau, une pratique ou une règle, cite-la uniquement si elle éclaire l'analyse.",
      "Les dictionnaires fournissent des champs `abbreviations`, `suffixes`, `levels` ou `practices` : ne les utilise que s'ils sont présents.",
      "Pour toute colonne ou abréviation non définie, mentionne simplement qu'elle n'est pas expliquée au lieu d'en inventer le sens.",
      "Si une information clé n'est pas comprise, signale clairement la limite ou propose de poser la question correspondante.",
      "Chaque champ texte doit tenir en UNE SEULE phrase simple (≤ 12 mots).",
      "Chaque liste doit contenir au maximum 3 éléments courts, concrets, actionnables.",
      "Chaque liste doit contenir au moins un élément : si aucune donnée exploitable, ajoute «Aucune donnée exploitable.» comme entrée unique.",
      "Tu peux citer un code ou une colonne si c'est nécessaire pour signaler une limite ou une consigne claire.",
      "Appuie-toi sur l'objet `pre_analysis` : restitue les `known_facts`, signale les `unknown_codes`, exploite `allowed_comparisons`, `pedagogical_signals` et `questions_for_teacher` pour guider l'enseignant.",
      "Si `pre_analysis` contient `unknown_codes`, mentionne explicitement que l'analyse reste prudente dessus.",
      "Utilise en priorité `summary_sentences` : `overview` alimente la Synthèse, `strengths` les Points forts, `needs_work` les Points à retravailler (ou équivalents) et `next_steps` la Suite/priorités. Reformule ces phrases sans les supprimer.",
      "Complète ensuite avec `class_analytics` (context, data_quality, class_overview, distributions, measures, comparisons, student_groups, pedagogical_signals, limits) pour ajouter d'autres constats chiffrés sans recalculer ni extrapoler.",
      "N'écris «Aucune information disponible.» que si `summary_sentences`, `class_analytics` ET `pre_analysis` sont tous vides pour la section concernée.",
      "Les prénoms ne doivent provenir que de `student_profile_sentences` ou `student_profiles`. N'en invente jamais.",
      "Chaque repérage élève doit rester factuel et actionnable, sans jugement psychologique.",
      "Si aucune donnée nominative fiable n'est disponible, laisse `reperages_eleves` vide ou signale prudemment l'absence de repérage fiable.",
      "Utilise les pourcentages fournis pour produire des formulations comme « la moitié », « un tiers », « X % » ; si une donnée manque, signale la limite correspondante plutôt que d'inventer.",
      "N'utilise jamais de blocs de code dans ta réponse finale.",
      "Le ton doit rester professionnel, positif et directement exploitable.",
      "Structure obligatoirement ta réponse en JSON strict, sans ajout de texte avant ou après. Utilise exactement la structure suivante :",
      buildStructureHint(schema),
      "Chaque champ doit être rempli. Si aucune donnée, écris «Aucune information disponible.» ou un tableau vide.",
      "N'ajoute aucun autre champ et n'utilise pas de blocs ```.",
      mode === "question"
        ? "Réponds obligatoirement à la question fournie en t’appuyant sur les données de séance. N’invente jamais de valeur."
        : null,
      objective,
    ];
    return lines.filter(Boolean).join("\n");
  }

  function detectReferential({ contexte = {}, payload = {} }) {
    const dictionary = contexte.dictionnaire_activite || {};
    const analyticsContext = payload.class_analytics?.context || {};
    const candidates = [
      dictionary.id,
      dictionary.label,
      contexte.activity_id,
      contexte.activity_label,
      contexte.activite,
      analyticsContext.activity_id,
      analyticsContext.activity_label,
      analyticsContext.dictionary_id,
    ].filter(Boolean);
    for (let i = 0; i < candidates.length; i += 1) {
      const normalized = normalizeReferentialName(candidates[i]);
      if (!normalized) continue;
      if (REFERENTIAL_ALIASES[normalized]) {
        return REFERENTIAL_ALIASES[normalized];
      }
    }
    return null;
  }

  function detectReferentialFromCycle(cycleBundle) {
    if (!cycleBundle?.cycle_meta) return null;
    const candidate =
      cycleBundle.cycle_meta.app_id ||
      cycleBundle.cycle_meta.app_label ||
      cycleBundle.cycle_meta.activity_name ||
      "";
    const normalized = normalizeReferentialName(candidate);
    if (!normalized) return null;
    return REFERENTIAL_ALIASES[normalized] || null;
  }

  function normalizeReferentialName(value) {
    if (!value && value !== 0) return "";
    return String(value).trim().toLowerCase();
  }

  function analyzeDatasetSignals({ referentiel, dataset = [] }) {
    const keySet = new Set();
    dataset.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      Object.keys(entry).forEach((key) => keySet.add(key));
    });
    const allKeys = Array.from(keySet);
    const lowerKeys = allKeys.map((key) => key.toLowerCase());
    const crossPlanColumns = allKeys.filter((key) => /(_p|_r)$/i.test(key));
    const arcathlonFieldsList = [
      "nb_10",
      "nb_9",
      "nb_8",
      "nb_7",
      "nb_6",
      "points_total",
      "points_max",
      "zone_entries",
      "zone2_points",
      "zone2_shots",
    ].filter((field) => lowerKeys.includes(field));
    return {
      allKeys,
      crossPlanColumns,
      arcathlonFields: arcathlonFieldsList,
    };
  }

  window.ScanProfAIPrompt = {
    buildPrompt,
    SECTION_SCHEMA,
    QUESTION_SCHEMA,
  };

  function buildStructureHint(schema = []) {
    const fields = schema
      .map((section) => {
        const value = section.type === "list" ? '["..."]' : '"..."';
        return `  "${section.key}": ${value}`;
      })
      .join(",\n");
    return `{\n${fields}\n}`;
  }
})();
