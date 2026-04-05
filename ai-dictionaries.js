(function () {
  const STORAGE_KEYS = {
    USER_DICTIONARIES: "scanprof_app_dictionaries_v1",
  };

  const EVENT_NAME = "scanprof:dictionaries-changed";
  try {
    console.debug("[ScanProfAIDictionaries] DEFAULT_DICTIONARIES keys", Object.keys(DEFAULT_DICTIONARIES));
  } catch {
    /* console unavailable */
  }
  const DEFAULT_DICTIONARIES = Object.freeze({
    cross_training: {
      id: "cross_training",
      label: "Cross training",
      description: "Circuit training cardio / renforcement avec rotations d'ateliers.",
      keywords: ["cross", "cross training", "cross-training", "circuit", "wod"],
      abbreviations: {
        bu: "Burpees",
        cr: "Crunch / relevé de buste",
        di: "Dips",
        fe: "Fentes",
        jk: "Jumping jack",
        mt: "Mountain climber",
        sa: "Saut",
        po: "Pompes",
        ra: "Rameur",
        sq: "Squat",
      },
      suffixes: {
        _1: "Niveau 1 (training)",
        _2: "Niveau 2 (training)",
        _l: "Niveau / difficulté",
        _p: "Valeur prévue",
        _r: "Valeur réalisée",
      },
      interpretation: [
        "Alterner cardio et renforcement, surveiller la technique en fin de séance.",
        "Comparer prévu vs réalisé (_p / _r) pour repérer la gestion d'effort.",
      ],
      notes: [
        "Adapter le volume selon le niveau, éviter les écarts trop importants.",
      ],
      levels: ["N1 = parcours allégé", "N2 = parcours complet"],
      confidence: "medium",
      ai_may_infer: false,
      teacher_context_required: false,
      limits: [
        "Ne pas déduire la fatigue si aucun code *_r n'est présent.",
        "Les abréviations ajoutées par l'enseignant priment sur ce dictionnaire.",
      ],
      examples: ["bu_r = burpees réalisés", "po_p = pompes prévues sur le plan."],
      comparison_rules: ["Comparer *_p avec *_r pour repérer les écarts prévu/réalisé."],
      signal_rules: [
        "Mettre en avant les élèves qui complètent tous les ateliers prévus.",
        "Signaler ceux qui restent bloqués sur un même code plusieurs tours.",
      ],
      learningField: "Cross Training — engagement moteur et gestion prévu/réalisé",
      teachingPriorities: [
        "Sécuriser un relevé prévu/réalisé identique pour tous les ateliers à chaque rotation.",
        "Installer une lecture régulière de l’engagement cardio/renforcement tour après tour.",
        "Faire expliciter les écarts réalisés afin d’ajuster l’intensité et la récupération.",
      ],
      didacticLevers: [
        "Tableau collectif prévu/réalisé rempli devant la classe à chaque fin de tour.",
        "Binômes observateurs chronométrent, comptent et valident la colonne réalisée.",
        "Groupes de besoin différenciant charges, temps de travail et récupération pour clarifier l’objectif.",
        "Rituels express de verbalisation « objectif vs réalisé » avant de relancer la rotation.",
      ],
      nextSessionTemplates: [
        "Mini-circuit (4 ateliers) avec colonnes _p/_r imposées et temps morts dédiés au relevé commun.",
        "Séance miroir : tour repère puis tour objectif en limitant l’écart prévu/réalisé à ±2 répétitions.",
        "Débrief final où chaque groupe annonce l’atelier à stabiliser et l’indicateur suivi la prochaine fois.",
      ],
    },
    climb_track: {
      id: "climb_track",
      label: "Climb Track",
      description: "Suivi escalade regroupant difficulté, bloc et vitesse.",
      keywords: ["climb", "climbtrack", "climb track", "escalade", "voie", "grimpe", "bloc", "boulder", "vitesse"],
      abbreviations: {
        m: "M = Moulinette.",
        mt: "MT = Mouli-tête.",
        t: "T = En tête.",
        e: "E = Enchaîné.",
        e2: "E2 = Enchaîné au second essai.",
        n3d: "N3D = Non enchaîné dégaine 3.",
        vitesse: "Temps réalisé sur la voie de vitesse.",
        relais: "Numéro du relais atteint (difficulté).",
        cotation: "Cotation de difficulté (4, 5A, 6B+, etc.).",
        couleur: "Couleur du bloc (jaune, vert, bleu, rouge, ...).",
        bloc: "Nom/numéro du bloc.",
        r: "R + numéro : relais (difficulté) ou identifiant bloc selon le contexte.",
      },
      suffixes: {},
      interpretation: [
        "Climb Track couvre 3 logiques distinctes : difficulté, bloc, vitesse.",
        "En difficulté, lire M/MT/T + R + cotation + statut (E, E2, N3D).",
        "En bloc, la couleur = niveau relatif et R + numéro = identifiant du bloc.",
        "En vitesse, interpréter le temps seulement si le protocole est identique.",
        "Signalement obligatoire si une chaîne locale est partiellement comprise.",
      ],
      notes: [
        "En bloc, la couleur représente la difficulté relative.",
        "En bloc, R + numéro = identifiant bloc (jaune R35 = bloc jaune n°35).",
        "En difficulté, R + numéro = relais atteint (M R6 5A E).",
        "En vitesse, 00:34:00 représente un temps de réalisation.",
        "Ne jamais conclure sur la sécurité sans contexte enseignant.",
      ],
      practices: ["M = Moulinette", "MT = Mouli-tête", "T = En tête"],
      levels: ["4", "4+", "5A", "5A+", "5B", "5B+", "5C", "5C+", "6A", "6A+", "6B", "6B+", "6C", "6C+", "7A", "7A+"],
      confidence: "medium",
      ai_may_infer: false,
      teacher_context_required: true,
      limits: [
        "Ne jamais inventer la signification exacte d’un code local ambigu.",
        "N3D reste descriptif : ne pas surinterpréter pédagogiquement sans précision.",
        "Un code R + numéro doit être interprété selon le contexte (bloc ou difficulté).",
        "Si une chaîne n’est comprise qu’en partie, la signaler comme partiellement documentée.",
        "Ne pas conclure sur la technique seulement à partir d’un statut E/E2/N3D.",
      ],
      examples: ["M R6 5A E", "M R10 5B E", "jaune R35", "M R4 4 E2", "N3D"],
      comparison_rules: [
        "Comparer les performances de même pratique (M/MT/T) uniquement si le contexte est homogène.",
        "Comparer des cotations proches avec prudence et uniquement si la séance suit la même logique.",
        "Comparer les statuts E / E2 / N3D sans inventer leur portée pédagogique.",
        "En vitesse, comparer des temps seulement dans un protocole identique.",
        "En bloc, comparer des blocs de même logique locale avec prudence.",
      ],
      signal_rules: [
        "Passage de M vers MT ou T = progression d’engagement possible.",
        "Réussite régulière sur des cotations stables = consolidation possible.",
        "Échecs répétés sur une même zone = niveau à stabiliser.",
        "En vitesse, baisse nette du temps = progression potentielle.",
        "En bloc, réussite sur couleurs supérieures = progression relative.",
      ],
      learningField: "Escalade — engagement progressif et lecture de voie",
      teachingPriorities: [
        "Faire passer chaque grimpeur d’une voie validée à une tentative accompagnée sur la cotation supérieure.",
        "Multiplier les essais guidés pour travailler la lecture de voie et l’anticipation des clips.",
        "Constituer des groupes de besoin explicitant critères de réussite et prise de risque contrôlée.",
      ],
      didacticLevers: [
        "Contrat « deux essais dont un guidé » consigné (voie, statut, sensation, prochaine cible).",
        "Binômes grimpeur/observateur notant cotation, statut et conseil pour l’essai suivant.",
        "Repères visuels posés sur les voies cibles : sections clés, repos, clip stratégique.",
        "Mur de suivi classant voies repères par couleur/niveau avec cases tentée/validée.",
      ],
      nextSessionTemplates: [
        "Séquence en deux temps : essai libre sur la voie maîtrisée puis essai guidé sur la cotation +1.",
        "Groupes « consolider / tenter +1 / oser l’en tête » chacun avec critère de réussite clair.",
        "Mur collectif où chaque binôme coche voies tentées/validées et annonce la prochaine cible accompagnée.",
      ],
    },
    arcathlon_v2: {
      id: "arcathlon_v2",
      label: "ArcAthlon V2",
      description: "Application de suivi ArcAthlon V2 (course + tir à l’arc).",
      keywords: ["arcathlon", "arcathlon_v2", "arcathlon-v2", "arcathlon v2"],
      abbreviations: {
        distance: "Distance parcourue durant la séquence course.",
        indice_arc: "Indice Arc (synthèse course/tir, formule locale).",
        nb_10: "Nombre de tirs scorés 10.",
        nb_9: "Nombre de tirs scorés 9.",
        nb_8: "Nombre de tirs scorés 8.",
        nb_7: "Nombre de tirs scorés 7.",
        nb_6: "Nombre de tirs scorés 6.",
        points_max: "Plafond théorique si l’élève ne fait que des 10.",
        points_total: "Total réellement marqué sur la séance.",
        zone_entries: "Nombre d’entrées en zone de tir 2.",
        zone2_points: "Points marqués depuis la zone 2.",
        zone2_shots: "Tirs effectués depuis la zone 2.",
      },
      suffixes: {},
      interpretation: [
        "Comparer points_total à points_max pour situer la marge de progression.",
        "Analyser la distribution nb_10→nb_6 pour suivre la précision du tir.",
        "Observer zone_entries / zone2_points / zone2_shots pour lire la zone 2.",
      ],
      notes: [
        "points_max correspond à des séries parfaites (que des 10).",
        "zone_entries = nombre d’entrées dans la zone de tir 2.",
        "zone2_points = points réellement marqués depuis la zone 2.",
        "zone2_shots = nombre de tirs en zone 2 (peut être différent de zone_entries).",
        "indice_arc reste prudent si sa formule exacte n’est pas fournie.",
      ],
      confidence: "high",
      ai_may_infer: true,
      teacher_context_required: false,
      limits: [
        "Ne pas inventer la formule précise de indice_arc si elle n’est pas décrite.",
        "Ne pas surinterpréter une variation isolée de distance sans contexte connu.",
        "Ne pas conclure au-delà des scores réellement saisis.",
      ],
      examples: [],
      comparison_rules: [
        "Comparer points_total à points_max.",
        "Comparer nb_10 à nb_6 pour décrire la distribution des tirs.",
        "Comparer zone2_points à zone_entries.",
        "Comparer zone2_points à zone2_shots.",
        "Comparer indice_arc uniquement si le mode de calcul est identique.",
        "Comparer distance uniquement si le protocole de séance est identique.",
      ],
      signal_rules: [
        "Écart important points_total / points_max = marge de réussite.",
        "Beaucoup de scores 10/9 = précision plus solide.",
        "Faible rendement zone 2 = piste de travail utile.",
        "Entrées fréquentes zone 2 mais peu de points = efficacité à améliorer.",
        "Distribution stable nb_10→nb_6 = profil de tir régulier.",
      ],
      learningField: "ArcAthlon — précision de tir et continuité de l’effort",
      teachingPriorities: [
        "Relier systématiquement points_total à points_max pour situer la marge réelle/potentielle.",
        "Maintenir la précision après les phases de course en objectivant les séries.",
        "Comparer l’efficacité zone 2 (entrées, tirs, points) pour ajuster la stratégie.",
      ],
      didacticLevers: [
        "Lecture partagée du barème points_total / points_max avant chaque séquence.",
        "Défis zone 2 sous fatigue : relance course courte puis tir avec objectif chiffré.",
        "Tableau synthétique points_total / points_max / indice_arc tenu par binômes observateurs.",
      ],
      nextSessionTemplates: [
        "Deux passages comparés : le premier repère, le second avec objectif précis sur zone 2 ou points_max.",
        "Auto-analyse immédiate points_total vs points_max puis annonce de la marge visée la prochaine fois.",
        "Temps calme final où chaque binôme décrit ses séries (nb_10→nb_6) et fixe la priorité suivante.",
      ],
    },
    laser_run: {
      id: "laser_run",
      label: "Laser Run",
      description: "Alternance course / tir type pentathlon moderne.",
      keywords: ["laser", "laser run", "laser_run", "run"],
      abbreviations: {
        distance: "Distance parcourue pendant la séance.",
        vitesse: "Vitesse moyenne mesurée dans la séance.",
        indice_tir: "Indice de tir (formule locale).",
        nb_led_0: "Nombre de tirs concluants avec 0 LED allumée.",
        nb_led_1: "Nombre de tirs avec 1 LED.",
        nb_led_2: "Nombre de tirs avec 2 LED.",
        nb_led_3: "Nombre de tirs avec 3 LED.",
        nb_led_4: "Nombre de tirs avec 4 LED.",
        nb_led_5: "Nombre de tirs avec 5 LED.",
      },
      interpretation: [
        "Laser Run combine déplacement et tir : croiser distance/vitesse avec indice_tir.",
        "Répartition nb_led_0→nb_led_5 = qualité du tir, à lire prudemment si non détaillée.",
      ],
      notes: [
        "Les LED représentent le niveau de réussite sur chaque tir.",
        "Toujours vérifier que la signification locale des LED est partagée avec la classe.",
      ],
      confidence: "medium",
      ai_may_infer: true,
      teacher_context_required: true,
      limits: [
        "Ne pas inventer la formule précise de indice_tir si elle n’est pas fournie.",
        "Ne pas surinterpréter la répartition LED sans explication locale.",
        "Ne pas déduire une cause technique sans observation complémentaire.",
      ],
      examples: [],
      comparison_rules: [
        "Comparer indice_tir entre élèves/passages seulement si le protocole est identique.",
        "Comparer vitesse et distance dans un même cadre de séance.",
        "Comparer la répartition nb_led_0 à nb_led_5 si leur signification est stable.",
        "Comparer la régularité tir/course d’une boucle à l’autre.",
      ],
      signal_rules: [
        "Répartition défavorable sur les LED = précision/efficacité à travailler.",
        "Bon indice_tir avec vitesse stable = profil potentiellement équilibré.",
        "Forte dissociation déplacement vs tir = axe de travail prioritaire.",
        "Distance correcte mais tir fragile = accompagnement sur la précision.",
      ],
      learningField: "Laser Run — alternance effort/course et précision de tir",
      teachingPriorities: [
        "Coordonner la relance course et la stabilité du tir sur chaque boucle.",
        "Donner des repères LED simples pour qualifier la précision sans attendre la fin de la séance.",
        "Rendre comparables les boucles successives (distance, temps, LED) afin d’observer la régularité.",
      ],
      didacticLevers: [
        "Fiches binômes boucle par boucle : temps, LED, respiration, consigne suivante.",
        "Scénarios différenciés : relance rapide vs relance maîtrisée en comparant les LED.",
        "Rituels de respiration/ancrage avant chaque série de tir pour stabiliser la visée.",
      ],
      nextSessionTemplates: [
        "Alterner boucle rapide puis boucle maîtrisée en notant LED pour comparer immédiatement.",
        "Tableau Distance / Temps / LED rempli après chaque passage avec objectif annoncé avant la boucle.",
        "Contrat LED précis (viser 0-1 LED sur les deux derniers tirs) puis analyse collective de l’écart.",
      ],
    },
  });

  const CROSS_TRAINING_ABBREVIATIONS = DEFAULT_DICTIONARIES.cross_training?.abbreviations || {};
  const CLIMB_TRACK_ABBREVIATIONS = DEFAULT_DICTIONARIES.climb_track?.abbreviations || {};
  const ARCATHLON_ABBREVIATIONS = DEFAULT_DICTIONARIES.arcathlon_v2?.abbreviations || {};
  const LASER_RUN_ABBREVIATIONS = DEFAULT_DICTIONARIES.laser_run?.abbreviations || {};

  const APPLICATION_TRANSLATIONS = Object.freeze(
    normalizeTranslationProfiles({
      cross_training: {
        id: "cross_training",
        aliases: ["cross training", "cross-training", "cross", "circuit training", "wod"],
        abbreviations: CROSS_TRAINING_ABBREVIATIONS,
        fields: {
          planned: { label: "Valeur prévue", normalizedField: "planned_volume", suffix: "_p" },
          realized: { label: "Valeur réalisée", normalizedField: "realized_volume", suffix: "_r" },
        },
        columnMap: {
          bu: { label: CROSS_TRAINING_ABBREVIATIONS.bu, normalizedField: "burpees", type: "exercise" },
          cr: { label: CROSS_TRAINING_ABBREVIATIONS.cr, normalizedField: "crunch", type: "exercise" },
          di: { label: CROSS_TRAINING_ABBREVIATIONS.di, normalizedField: "dips", type: "exercise" },
          fe: { label: CROSS_TRAINING_ABBREVIATIONS.fe, normalizedField: "fentes", type: "exercise" },
          jk: { label: CROSS_TRAINING_ABBREVIATIONS.jk, normalizedField: "jumping_jack", type: "exercise" },
          mt: { label: CROSS_TRAINING_ABBREVIATIONS.mt, normalizedField: "mountain_climber", type: "exercise" },
          sa: { label: CROSS_TRAINING_ABBREVIATIONS.sa, normalizedField: "saut", type: "exercise" },
          po: { label: CROSS_TRAINING_ABBREVIATIONS.po, normalizedField: "pompes", type: "exercise" },
          ra: { label: CROSS_TRAINING_ABBREVIATIONS.ra, normalizedField: "rameur", type: "exercise" },
          sq: { label: CROSS_TRAINING_ABBREVIATIONS.sq, normalizedField: "squat", type: "exercise" },
        },
        minimumUsableSignals: ["planned_vs_realized_gap"],
        fallbackFocus: ["engagement", "collecte_prevu_realise"],
        analysisProfile: "light",
      },
      climb_track: {
        id: "climb_track",
        aliases: ["climb track", "climbtrack", "escalade", "grimpe"],
        abbreviations: CLIMB_TRACK_ABBREVIATIONS,
        fields: {
          statut: { label: "Statut", normalizedField: "status" },
          niveau: { label: "Cotation", normalizedField: "level" },
          pratique: { label: "Pratique", normalizedField: "practice" },
        },
        columnMap: {
          m: { label: CLIMB_TRACK_ABBREVIATIONS.m, normalizedField: "practice_m", type: "practice" },
          mt: { label: CLIMB_TRACK_ABBREVIATIONS.mt, normalizedField: "practice_mt", type: "practice" },
          t: { label: CLIMB_TRACK_ABBREVIATIONS.t, normalizedField: "practice_t", type: "practice" },
          e: { label: CLIMB_TRACK_ABBREVIATIONS.e, normalizedField: "status_e", type: "status" },
          e2: { label: CLIMB_TRACK_ABBREVIATIONS.e2, normalizedField: "status_e2", type: "status" },
          n3d: { label: CLIMB_TRACK_ABBREVIATIONS.n3d, normalizedField: "status_n3d", type: "status" },
          relais: { label: CLIMB_TRACK_ABBREVIATIONS.relais, normalizedField: "relais", type: "metric" },
          cotation: { label: CLIMB_TRACK_ABBREVIATIONS.cotation, normalizedField: "cotation", type: "level" },
          bloc: { label: CLIMB_TRACK_ABBREVIATIONS.bloc, normalizedField: "bloc", type: "identifier" },
          vitesse: { label: CLIMB_TRACK_ABBREVIATIONS.vitesse, normalizedField: "vitesse", type: "time" },
          couleur: { label: CLIMB_TRACK_ABBREVIATIONS.couleur, normalizedField: "couleur", type: "level" },
          r: { label: CLIMB_TRACK_ABBREVIATIONS.r, normalizedField: "repere", type: "identifier" },
        },
        minimumUsableSignals: ["status_distribution", "cotation_trend", "practice_distribution"],
        fallbackFocus: ["statuts_voies", "progression_cotations", "engagement_pratiques"],
        analysisProfile: "rich",
      },
      arcathlon_v2: {
        id: "arcathlon_v2",
        aliases: ["arcathlon v2", "arcathlon-v2", "arcathlon"],
        abbreviations: ARCATHLON_ABBREVIATIONS,
        fields: {
          points_total: { label: "Points total", normalizedField: "points_total" },
          points_max: { label: "Points max", normalizedField: "points_max" },
          precision: { label: "Distribution des tirs", normalizedField: "precision" },
          zone2: { label: "Zone 2", normalizedField: "zone2" },
        },
        columnMap: {
          distance: { label: ARCATHLON_ABBREVIATIONS.distance, normalizedField: "distance", type: "distance" },
          indice_arc: { label: ARCATHLON_ABBREVIATIONS.indice_arc, normalizedField: "indice_arc", type: "index" },
          nb_10: { label: ARCATHLON_ABBREVIATIONS.nb_10, normalizedField: "shots_10", type: "distribution" },
          nb_9: { label: ARCATHLON_ABBREVIATIONS.nb_9, normalizedField: "shots_9", type: "distribution" },
          nb_8: { label: ARCATHLON_ABBREVIATIONS.nb_8, normalizedField: "shots_8", type: "distribution" },
          nb_7: { label: ARCATHLON_ABBREVIATIONS.nb_7, normalizedField: "shots_7", type: "distribution" },
          nb_6: { label: ARCATHLON_ABBREVIATIONS.nb_6, normalizedField: "shots_6", type: "distribution" },
          points_max: { label: ARCATHLON_ABBREVIATIONS.points_max, normalizedField: "points_max", type: "score" },
          points_total: { label: ARCATHLON_ABBREVIATIONS.points_total, normalizedField: "points_total", type: "score" },
          zone_entries: { label: ARCATHLON_ABBREVIATIONS.zone_entries, normalizedField: "zone_entries", type: "metric" },
          zone2_points: { label: ARCATHLON_ABBREVIATIONS.zone2_points, normalizedField: "zone2_points", type: "score" },
          zone2_shots: { label: ARCATHLON_ABBREVIATIONS.zone2_shots, normalizedField: "zone2_shots", type: "metric" },
        },
        minimumUsableSignals: ["points_total_vs_points_max", "precision_distribution", "zone2_rendement"],
        fallbackFocus: ["points_total", "zone2_points", "indice_arc"],
        analysisProfile: "mixed",
      },
      laser_run: {
        id: "laser_run",
        aliases: ["laser run", "laser-run", "laser", "run"],
        abbreviations: LASER_RUN_ABBREVIATIONS,
        fields: {
          distance: { label: "Distance", normalizedField: "distance" },
          vitesse: { label: "Vitesse", normalizedField: "speed" },
          indice_tir: { label: "Indice de tir", normalizedField: "shooting_index" },
          leds: { label: "LED tir", normalizedField: "led_distribution" },
        },
        columnMap: {
          distance: { label: LASER_RUN_ABBREVIATIONS.distance, normalizedField: "distance", type: "distance" },
          vitesse: { label: LASER_RUN_ABBREVIATIONS.vitesse, normalizedField: "vitesse", type: "speed" },
          indice_tir: { label: LASER_RUN_ABBREVIATIONS.indice_tir, normalizedField: "indice_tir", type: "index" },
          nb_led_0: { label: LASER_RUN_ABBREVIATIONS.nb_led_0, normalizedField: "led_0", type: "distribution" },
          nb_led_1: { label: LASER_RUN_ABBREVIATIONS.nb_led_1, normalizedField: "led_1", type: "distribution" },
          nb_led_2: { label: LASER_RUN_ABBREVIATIONS.nb_led_2, normalizedField: "led_2", type: "distribution" },
          nb_led_3: { label: LASER_RUN_ABBREVIATIONS.nb_led_3, normalizedField: "led_3", type: "distribution" },
          nb_led_4: { label: LASER_RUN_ABBREVIATIONS.nb_led_4, normalizedField: "led_4", type: "distribution" },
          nb_led_5: { label: LASER_RUN_ABBREVIATIONS.nb_led_5, normalizedField: "led_5", type: "distribution" },
        },
        minimumUsableSignals: ["indice_tir", "led_distribution"],
        fallbackFocus: ["equilibre_course_tir", "collecte_led"],
        analysisProfile: "mixed",
      },
    })
  );

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getDefaultDictionaries() {
    return deepClone(DEFAULT_DICTIONARIES);
  }

  function slugify(text = "") {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeTranslationProfiles(record = {}) {
    const normalized = {};
    Object.entries(record || {}).forEach(([key, profile]) => {
      if (!profile) return;
      const id = slugify(profile.id || key);
      if (!id) return;
      const aliases = filterStringList(profile.aliases || []);
      const aliasSlugs = Array.from(new Set([id, ...aliases.map((alias) => slugify(alias))])).filter(Boolean);
      const normalizedProfile = {
        id,
        aliases,
        aliasSlugs,
        abbreviations: profile.abbreviations ? deepClone(profile.abbreviations) : {},
        columnMap: normalizeTranslationColumnMap(profile.columnMap || {}),
        fields: normalizeTranslationFields(profile.fields || {}),
        minimumUsableSignals: filterStringList(profile.minimumUsableSignals || []),
        fallbackFocus: filterStringList(profile.fallbackFocus || []),
        analysisProfile: ["rich", "mixed", "light"].includes(profile.analysisProfile)
          ? profile.analysisProfile
          : "mixed",
      };
      normalized[id] = normalizedProfile;
    });
    return normalized;
  }

  function normalizeTranslationColumnMap(columnMap = {}) {
    const normalized = {};
    Object.entries(columnMap).forEach(([key, entry]) => {
      if (!key) return;
      const normalizedKey = slugify(key);
      if (!normalizedKey) return;
      const payload = entry || {};
      normalized[normalizedKey] = {
        key: normalizedKey,
        rawKey: key,
        normalizedField: payload.normalizedField || normalizedKey,
        label: payload.label || payload.name || key,
        type: payload.type || "metric",
        description: payload.description || "",
      };
    });
    return normalized;
  }

  function normalizeTranslationFields(fieldMap = {}) {
    const normalized = {};
    Object.entries(fieldMap).forEach(([key, entry]) => {
      if (!key) return;
      const normalizedKey = slugify(key);
      if (!normalizedKey) return;
      const payload = entry || {};
      normalized[normalizedKey] = {
        key: normalizedKey,
        label: payload.label || payload.name || key,
        normalizedField: payload.normalizedField || normalizedKey,
        suffix: payload.suffix || null,
        description: payload.description || "",
      };
    });
    return normalized;
  }

  function filterStringList(list = []) {
    const seen = new Set();
    const values = [];
    (Array.isArray(list) ? list : []).forEach((value) => {
      const text = String(value || "").trim();
      if (!text) return;
      if (seen.has(text)) return;
      seen.add(text);
      values.push(text);
    });
    return values;
  }

  function attachTranslationProfile(profile) {
    if (!profile) return null;
    const cloned = deepClone(profile);
    if (cloned.aliasSlugs) delete cloned.aliasSlugs;
    return cloned;
  }

  function listTranslationProfiles() {
    return Object.values(APPLICATION_TRANSLATIONS).map((profile) => attachTranslationProfile(profile));
  }

  function getTranslationProfile(idOrActivityName) {
    if (!idOrActivityName) return null;
    const slug = slugify(idOrActivityName);
    if (APPLICATION_TRANSLATIONS[slug]) {
      return attachTranslationProfile(APPLICATION_TRANSLATIONS[slug]);
    }
    const match = Object.values(APPLICATION_TRANSLATIONS).find((entry) =>
      entry.aliasSlugs.includes(slug)
    );
    return match ? attachTranslationProfile(match) : null;
  }

  function loadUserDictionaries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_DICTIONARIES);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveUserDictionaries(payload) {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_DICTIONARIES, JSON.stringify(payload || {}));
    } catch (err) {
      console.warn("[ScanProfAIDictionaries] save failed", err);
    }
  }

  function emitChange(type, detail) {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { type, ...(detail || {}) },
        })
      );
    } catch {
      /* noop */
    }
  }

  function mergeDictionaries(base, override) {
    const target = deepClone(base);
    Object.entries(override || {}).forEach(([key, userDict]) => {
      if (!userDict || typeof userDict !== "object") return;
      const cleanKey = slugify(userDict.id || key);
      if (!cleanKey) return;
      const merged = { ...(target[cleanKey] || {}), ...userDict, id: cleanKey };
      if (target[cleanKey]?.inherit && !merged.inherit) {
        delete merged.inherit;
      }
      target[cleanKey] = normalizeDictionaryStructure(merged);
    });
    return target;
  }

  function normalizeDictionaryStructure(dict) {
    const normalized = {
      id: slugify(dict.id || dict.key || dict.label || ""),
      label: dict.label || dict.name || dict.id || "Activité",
      description: dict.description || "",
      keywords: Array.isArray(dict.keywords) ? dict.keywords.filter(Boolean) : [],
      abbreviations: { ...(dict.abbreviations || {}), ...(dict.columns || {}) },
      suffixes: { ...(dict.suffixes || {}) },
      interpretation: Array.isArray(dict.interpretation) ? dict.interpretation.filter(Boolean) : [],
      notes: Array.isArray(dict.notes) ? dict.notes.filter(Boolean) : [],
      levels: Array.isArray(dict.levels) ? dict.levels.filter(Boolean) : [],
      practices: Array.isArray(dict.practices) ? dict.practices.filter(Boolean) : [],
      meta: dict.meta || {},
      confidence: dict.confidence || "unknown",
      ai_may_infer: Boolean(dict.ai_may_infer),
      teacher_context_required: Boolean(dict.teacher_context_required),
      limits: Array.isArray(dict.limits) ? dict.limits.filter(Boolean) : [],
      examples: Array.isArray(dict.examples) ? dict.examples.filter(Boolean) : [],
      comparison_rules: Array.isArray(dict.comparison_rules) ? dict.comparison_rules.filter(Boolean) : [],
      signal_rules: Array.isArray(dict.signal_rules) ? dict.signal_rules.filter(Boolean) : [],
      learningField: dict.learningField || dict.learning_field || (dict.meta && dict.meta.learning_field) || "",
      teachingPriorities: filterStringList(
        dict.teachingPriorities || dict.teaching_priorities || (dict.meta && dict.meta.teaching_priorities) || []
      ),
      didacticLevers: filterStringList(
        dict.didacticLevers || dict.didactic_levers || (dict.meta && dict.meta.didactic_levers) || []
      ),
      nextSessionTemplates: filterStringList(
        dict.nextSessionTemplates || dict.next_session_templates || (dict.meta && dict.meta.next_session_templates) || []
      ),
    };
    if (!normalized.id) normalized.id = slugify(normalized.label);
    return normalized;
  }

  function resolveInheritance(key, source, stack = []) {
    if (stack.includes(key)) {
      console.warn("[ScanProfAIDictionaries] circular inheritance detected", stack);
      return source[key];
    }
    const dict = source[key];
    if (!dict || !dict.inherit) return dict;
    const parentKey = dict.inherit;
    const parent = source[parentKey];
    if (!parent) return dict;
    const base = resolveInheritance(parentKey, source, [...stack, key]);
    if (!base) return dict;
    const merged = normalizeDictionaryStructure({
      ...deepClone(base),
      ...dict,
      abbreviations: { ...(base.abbreviations || {}), ...(dict.abbreviations || {}) },
      suffixes: { ...(base.suffixes || {}), ...(dict.suffixes || {}) },
      interpretation: [...(base.interpretation || []), ...(dict.interpretation || [])],
      notes: [...(base.notes || []), ...(dict.notes || [])],
      limits: [...(base.limits || []), ...(dict.limits || [])],
      examples: [...(base.examples || []), ...(dict.examples || [])],
      comparison_rules: [...(base.comparison_rules || []), ...(dict.comparison_rules || [])],
      signal_rules: [...(base.signal_rules || []), ...(dict.signal_rules || [])],
      levels: [...(base.levels || []), ...(dict.levels || [])],
      practices: [...(base.practices || []), ...(dict.practices || [])],
      teachingPriorities: [...(base.teachingPriorities || []), ...(dict.teachingPriorities || [])],
      didacticLevers: [...(base.didacticLevers || []), ...(dict.didacticLevers || [])],
      nextSessionTemplates: [...(base.nextSessionTemplates || []), ...(dict.nextSessionTemplates || [])],
    });
    delete merged.inherit;
    source[key] = merged;
    return merged;
  }

  function computeEffectiveDictionaries() {
    const base = normalizeAll(getDefaultDictionaries());
    const merged = mergeDictionaries(base, loadUserDictionaries());
    Object.keys(base).forEach((key) => {
      if (!merged[key]) merged[key] = base[key];
    });
    Object.keys(merged).forEach((key) => {
      resolveInheritance(key, merged);
    });
    return merged;
  }

  function normalizeAll(record) {
    const out = {};
    Object.entries(record || {}).forEach(([key, dict]) => {
      if (!dict) return;
      const normalized = normalizeDictionaryStructure({ id: key, ...dict });
      out[normalized.id] = normalized;
    });
    return out;
  }

  function getSourceForId(id) {
    if (!id) return "default";
    const payload = loadUserDictionaries();
    return payload[slugify(id)] ? "custom" : "default";
  }

  function attachSource(dict) {
    if (!dict) return null;
    return { ...deepClone(dict), source: getSourceForId(dict.id) };
  }

  function getDictionaryForActivity(activityName = "", opts = {}) {
    const slug = slugify(activityName || "");
    if (!slug) return null;
    const all = computeEffectiveDictionaries();
    if (all[slug]) return attachSource(all[slug]);
    const match = Object.values(all).find((dict) =>
      (dict.keywords || []).some((kw) => slugify(kw) === slug || slug.includes(slugify(kw)))
    );
    if (match) return attachSource(match);
    if (opts.strict) return null;
    return null;
  }

  function listDictionaries(options = {}) {
    const includeSource = !!options.includeSource;
    try {
      const all = computeEffectiveDictionaries();
      const values = Object.values(all).map((dict) => (includeSource ? attachSource(dict) : deepClone(dict)));
      console.debug("[ScanProfAIDictionaries] list() result", { count: values.length, includeSource });
      return values;
    } catch (err) {
      console.error("[ScanProfAIDictionaries] list() failed, fallback to defaults.", err);
      const fallback = normalizeAll(getDefaultDictionaries());
      const values = Object.values(fallback).map((dict) => (includeSource ? attachSource(dict) : deepClone(dict)));
      console.debug("[ScanProfAIDictionaries] fallback list() result", { count: values.length, includeSource });
      return values;
    }
  }

  function getDictionaryById(id) {
    const all = computeEffectiveDictionaries();
    return all[slugify(id)] ? attachSource(all[slugify(id)]) : null;
  }

  function matchActivityDictionary(activityName, options = {}) {
    return getDictionaryForActivity(activityName, options);
  }

  function getDictionary(idOrActivityName, options = {}) {
    if (!idOrActivityName) return null;
    const byId = getDictionaryById(idOrActivityName);
    if (byId) return byId;
    if (options?.strictId) return null;
    return matchActivityDictionary(idOrActivityName, options);
  }

  function upsertDictionary(dict) {
    if (!dict) return null;
    const payload = loadUserDictionaries();
    const normalized = normalizeDictionaryStructure(dict);
    payload[normalized.id] = normalized;
    saveUserDictionaries(payload);
    emitChange("upsert", { id: normalized.id });
    return normalized;
  }

  function removeDictionary(id) {
    const payload = loadUserDictionaries();
    const key = slugify(id);
    if (payload[key]) {
      delete payload[key];
      saveUserDictionaries(payload);
      emitChange("remove", { id: key });
      return true;
    }
    return false;
  }

  function exportDictionaries() {
    const payload = loadUserDictionaries();
    return {
      version: 1,
      generated_at: new Date().toISOString(),
      dictionaries: payload,
    };
  }

  function importDictionaries(json, { merge = true } = {}) {
    if (!json) throw new Error("Aucun contenu fourni.");
    let data = json;
    if (typeof json === "string") {
      data = JSON.parse(json);
    }
    if (!data || typeof data !== "object") {
      throw new Error("Format de dictionnaire invalide.");
    }
    const incoming = data.dictionaries || data;
    if (!incoming || typeof incoming !== "object") {
      throw new Error("Structure de dictionnaire introuvable.");
    }
    const normalized = normalizeAll(incoming);
    if (merge) {
      const payload = loadUserDictionaries();
      Object.assign(payload, normalized);
      saveUserDictionaries(payload);
    } else {
      saveUserDictionaries(normalized);
    }
    emitChange("import", { merge: !!merge });
    return normalized;
  }

  window.ScanProfAIDictionaries = {
    STORAGE_KEYS,
    DEFAULT_DICTIONARIES: normalizeAll(getDefaultDictionaries()),
    list: listDictionaries,
    get: getDictionary,
    getDictionaryForActivity,
    matchActivity: matchActivityDictionary,
    getDictionaryById,
    listTranslationProfiles,
    getTranslationProfile,
    getDefaultDictionaries: () => deepClone(DEFAULT_DICTIONARIES),
    upsertDictionary,
    removeDictionary,
    export: exportDictionaries,
    import: importDictionaries,
    resetUserDictionaries() {
      saveUserDictionaries({});
      emitChange("reset");
    },
    loadUserRaw: loadUserDictionaries,
    slugify,
  };
})();
