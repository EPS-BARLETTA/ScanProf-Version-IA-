(function () {
  const STORAGE_KEYS = {
    USER_DICTIONARIES: "scanprof_app_dictionaries_v1",
  };

  const EVENT_NAME = "scanprof:dictionaries-changed";
  const DEFAULT_DICTIONARIES = {
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
    },
    climb_track: {
      id: "climb_track",
      label: "Climb Track",
      description: "Suivi complet escalade : voies, vitesse et bloc.",
      keywords: ["climb", "climbtrack", "climb track", "escalade", "voie", "grimpe", "bloc", "boulder"],
      abbreviations: {
        vitesse: "Temps réalisé sur l'épreuve vitesse (format mm:ss ou hh:mm:ss).",
        relais: "Numéro du relais atteint, ex. R12.",
        cotation: "Cotation de difficulté, ex. 5B, 6A+.",
        etat: "Statut de la tentative : E (enchaîné), E2 (2e tentative), NE (non enchaîné), NED2 (non enchaîné dégaine 2).",
        couleur: "Couleur du bloc (niveau relatif : jaune, vert, bleu, rouge, noir...).",
        bloc: "Nom ou numéro du bloc tenté (ex. R1, Bloc 3).",
        r: "Référence rapide du bloc : R1 à Rx.",
      },
      suffixes: {},
      interpretation: [
        "Pratiques M < MT < T : moulinette simple, mouli-tête, grimpe en tête.",
        "Les cotations augmentent progressivement : 4, 4+, 5A...6C+, etc.",
        "Si certains codes ne sont pas compris (ex. R12), signaler la limite et demander précision.",
        "En bloc, la couleur représente la difficulté relative (jaune très accessible → noir expert).",
        "Les références R1, R2... désignent simplement le numéro du bloc (ex. Jaune R3 = bloc jaune n°3).",
      ],
      notes: [
        "Insister sur la sécurité et la progression de l'engagement.",
        "Pour le bloc, noter la couleur et le numéro (R1… R6) pour relier les réussites à chaque bloc.",
      ],
      practices: [
        "M = Moulinette (sécurité maximale)",
        "MT = Mouli-tête (compromis engagement)",
        "T = En tête (engagement fort)",
      ],
      levels: [
        "4",
        "4+",
        "5A",
        "5A+",
        "5B",
        "5B+",
        "5C",
        "5C+",
        "6A",
        "6A+",
        "6B",
        "6B+",
        "6C",
        "6C+",
        "7A",
        "7A+",
        "Couleurs bloc : Jaune, Vert, Bleu, Rouge, Noir",
      ],
      confidence: "medium",
      ai_may_infer: false,
      teacher_context_required: true,
      limits: [
        "Les vitesses doivent être au même format pour être comparées.",
        "Sans info sur l'assurage, ne pas conclure sur la sécurité.",
      ],
      examples: ["Bleu R3 = bloc bleu n°3 tenté/réussi.", "E2 = voie réussie à la 2e tentative."],
      comparison_rules: [
        "Comparer les statuts M/MT/T pour suivre l'engagement.",
        "Comparer vitesse ou cotation seulement si la séance précise les mêmes repères.",
      ],
      signal_rules: [
        "Mettre en avant ceux qui progressent de M vers MT ou T.",
        "Repérer les répétitions de codes NE/NED2 sur les mêmes voies.",
      ],
    },
    arcathlon_v2: {
      id: "arcathlon_v2",
      label: "ArcAthlon V2",
      description: "Application de suivi arcAthlon V2 (courses + tir).",
      keywords: ["arcathlon", "arcathlon_v2", "arcathlon-v2", "arcathlon v2", "arcathlon app"],
      abbreviations: {
        indice_arc: "Indice Arc : synthèse performance tir/course.",
        nb_0: "Nombre de flèches dans la cible 0.",
        points_max: "Points maximum atteignables selon les tentatives planifiées.",
        points_total: "Points réellement obtenus.",
        zone_entries: "Nombre d'entrées en zone de tir 2.",
        zone2_points: "Points marqués en zone 2.",
        zone2_shots: "Tirs effectués en zone 2.",
      },
      suffixes: {},
      interpretation: [
        "Comparer points total vs points max pour suivre la réussite.",
        "Surveiller la zone 2 (entries / shots / points) pour identifier la précision.",
        "Nb 0 reflète les tirs à côté, utile pour cibler l'accompagnement.",
      ],
      notes: [
        "Permet de régler durée, longueur de tour, règle Tours → Flèches, et commentaires.",
      ],
      confidence: "medium",
      ai_may_infer: false,
      teacher_context_required: false,
      limits: [
        "Sans info sur durée et longueur d'un tour, l'indice Arc reste limité.",
        "La zone 2 doit être paramétrée pour interpréter zone_entries.",
      ],
      examples: ["zone2_points = points marqués dans la zone 2 uniquement."],
      comparison_rules: [
        "Comparer points_total vs points_max pour suivre l'efficacité.",
        "Comparer zone2_points vs zone2_shots pour évaluer la précision.",
      ],
      signal_rules: [
        "Signaler les progressions fortes sur zone2_points.",
        "Repérer les écarts importants entre nb_0 et zone_entries.",
      ],
    },
    laser_run: {
      id: "laser_run",
      label: "Laser Run",
      description: "Alternance course / tir type pentathlon moderne.",
      keywords: ["laser", "laser run", "run"],
      abbreviations: {
        s1: "Session de tir 1",
        s2: "Session de tir 2",
        course: "Temps de course",
        pen: "Pénalités cumulées",
      },
      interpretation: [
        "Observez la régularité tir/course d'une boucle à l'autre.",
        "Les pénalités impactent le classement final.",
      ],
      notes: [
        "Penser à signaler les écarts de rythme importants.",
      ],
      confidence: "medium",
      ai_may_infer: false,
      teacher_context_required: false,
      limits: [
        "Les temps de course doivent correspondre à la même distance pour comparaison.",
      ],
      examples: ["s1 = premier stand de tir, s2 = second."],
      comparison_rules: ["Comparer s1 et s2 pour détecter la régularité des tirs."],
      signal_rules: [
        "Repérer les élèves stables entre s1 et s2.",
        "Signaler ceux dont les pénalités explosent d'une boucle à l'autre.",
      ],
    },
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function slugify(text = "") {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
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
    });
    delete merged.inherit;
    source[key] = merged;
    return merged;
  }

  function computeEffectiveDictionaries() {
    const merged = mergeDictionaries(normalizeAll(DEFAULT_DICTIONARIES), loadUserDictionaries());
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
    const all = computeEffectiveDictionaries();
    const includeSource = !!options.includeSource;
    return Object.values(all).map((dict) => (includeSource ? attachSource(dict) : deepClone(dict)));
  }

  function getDictionaryById(id) {
    const all = computeEffectiveDictionaries();
    return all[slugify(id)] ? attachSource(all[slugify(id)]) : null;
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
    DEFAULT_DICTIONARIES: normalizeAll(DEFAULT_DICTIONARIES),
    list: listDictionaries,
    getDictionaryForActivity,
    getDictionaryById,
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
