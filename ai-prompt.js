(function () {
  const SECTION_SCHEMA = [
    { key: "synthese", label: "Synthèse de la séance" },
    { key: "eleves_difficulte", label: "Élèves en difficulté" },
    { key: "eleves_a_surveiller", label: "Élèves à surveiller" },
    { key: "points_forts", label: "Points forts" },
    { key: "points_a_retravailler", label: "Points à retravailler" },
    { key: "recommandations", label: "Recommandations pour la séance suivante" },
    { key: "differenciation", label: "Différenciation" },
  ];

  const QUESTION_SCHEMA = [
    { key: "reponse", label: "Réponse à la question" },
    { key: "suggestions", label: "Pistes concrètes" },
  ];

  const MODE_OBJECTIVES = {
    bilan: "Fournis un bilan pédagogique complet de fin de séance en couvrant l’ensemble des points demandés.",
    difficulte: "Fournis un diagnostic centré sur les élèves en difficulté et les leviers de remédiation tout en complétant toutes les sections.",
    points_forts: "Valorise les réussites et les points forts observés en restant fidèle aux données, puis propose des idées pour consolider ces acquis.",
    suivi: "Fournis un bilan mettant l’accent sur la préparation de la prochaine séance (objectifs, différenciation) tout en complétant toutes les sections.",
    question:
      "Réponds précisément à la question de l’enseignant en t’appuyant uniquement sur les données fournies, puis propose des pistes concrètes.",
    test: "Réponds simplement par la chaîne «OK» si tout est clair.",
  };

  function buildPrompt({ analysisInput, mode = "bilan" }) {
    const payload = analysisInput || {};
    const contexte = payload.contexte || {};
    const objectif = MODE_OBJECTIVES[mode] || MODE_OBJECTIVES.bilan;
    const schema = mode === "question" ? QUESTION_SCHEMA : SECTION_SCHEMA;
    const instructions = [
      "Tu es un assistant pédagogique francophone pour des enseignants d'EPS.",
      "Analyse uniquement les données transmises. Si une information est absente, indique-le clairement sans l'inventer.",
      "Le ton doit rester professionnel, positif et directement exploitable.",
      "Structure obligatoirement ta réponse en JSON strict avec les clés suivantes :",
      JSON.stringify(schema.map((section) => section.key), null, 2),
      "Pour chaque clé :",
      "- utilise une chaîne de caractères pour les paragraphes courts ;",
      "- utilise un tableau de chaînes si plusieurs éléments sont attendus (ex. listes d'élèves ou de points) ;",
      "- place la valeur «Aucune information disponible.» si tu n'as rien de pertinent.",
      "N'ajoute aucun autre champ.",
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
})();
