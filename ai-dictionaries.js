(function () {
  const ACTIVITY_DICTIONARIES = {
    cross_training: {
      label: "Cross training",
      keywords: ["cross", "cross training", "cross-training", "circuit", "wod"],
      columns: {
        bu: "Burpees effectués",
        cr: "Crunchs ou relevés de buste",
        gr: "Gainage (secondes)",
        t1: "Temps du circuit 1",
        t2: "Temps du circuit 2",
      },
      notes: ["Alterner cardio et renforcement, surveiller la fatigue et la technique."],
    },
    escalade: {
      label: "Escalade",
      keywords: ["escalade", "grimpe", "voie"],
      columns: {
        v: "Voie tentée",
        niv: "Difficulté estimée",
        ess: "Nombre d'essais",
        pen: "Pénalité ou chute",
      },
      notes: ["Préciser la hauteur atteinte et les zones d'assurage si disponibles."],
    },
    laser_run: {
      label: "Laser Run",
      keywords: ["laser", "laser run", "run"],
      columns: {
        s1: "Session de tir 1",
        s2: "Session de tir 2",
        course: "Temps de course",
        pen: "Pénalités cumulées",
      },
      notes: ["Alterner tir et course, regarder la régularité des temps."],
    },
  };

  function slugify(text = "") {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeActivityName(name = "") {
    const slug = slugify(name);
    if (!slug) return null;
    if (ACTIVITY_DICTIONARIES[slug]) return slug;
    const match = Object.entries(ACTIVITY_DICTIONARIES).find(([, dict]) =>
      (dict.keywords || []).some((kw) => slugify(kw) === slug || slug.includes(slugify(kw)))
    );
    return match ? match[0] : null;
  }

  function formatDictionary(key) {
    const dict = ACTIVITY_DICTIONARIES[key];
    if (!dict) return null;
    return {
      key,
      label: dict.label || key,
      columns: { ...(dict.columns || {}) },
      notes: Array.isArray(dict.notes) ? dict.notes.slice() : [],
    };
  }

  function getDictionaryForActivity(activityName = "") {
    const key = normalizeActivityName(activityName);
    if (!key) return null;
    return formatDictionary(key);
  }

  window.ScanProfAIDictionaries = {
    getDictionaryForActivity,
    getDictionaryByKey(key) {
      return formatDictionary(key);
    },
    listKeys() {
      return Object.keys(ACTIVITY_DICTIONARIES);
    },
  };
})();
