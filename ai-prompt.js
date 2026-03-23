(function () {
  const MODE_SCHEMAS = {
    bilan: [
      { key: "synthese", label: "Synthèse", type: "text" },
      { key: "points_forts", label: "Points forts", type: "list" },
      { key: "points_a_retravailler", label: "Points à retravailler", type: "list" },
      { key: "suite", label: "Suite proposée", type: "list" },
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

  function buildPrompt({ analysisInput, mode = "bilan" }) {
    const payload = analysisInput || {};
    const contexte = payload.contexte || {};
    const objectif = MODE_OBJECTIVES[mode] || MODE_OBJECTIVES.bilan;
    const schema = MODE_SCHEMAS[mode] || SECTION_SCHEMA;
    const instructions = [
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
      "N'utilise jamais de blocs de code dans ta réponse finale.",
      "Le ton doit rester professionnel, positif et directement exploitable.",
      "Structure obligatoirement ta réponse en JSON strict, sans ajout de texte avant ou après. Utilise exactement la structure suivante :",
      buildStructureHint(schema),
      "Chaque champ doit être rempli. Si aucune donnée, écris «Aucune information disponible.» ou un tableau vide.",
      "N'ajoute aucun autre champ et n'utilise pas de blocs ```.",
      mode === "question"
        ? "Réponds obligatoirement à la question fournie en t’appuyant sur les données de séance. N’invente jamais de valeur."
        : null,
      objectif,
    ]
      .filter(Boolean)
      .join("\n");

    const content = {
      contexte,
      intention: mode,
      donnees_eleves: payload.eleves || [],
      question: payload.questionText || "",
      interpretation: payload.interpretation || null,
      pre_analysis: payload.pre_analysis || null,
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
