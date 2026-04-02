(function () {
  const STORAGE = {
    API_KEY: "scanprof_ai_api_key",
    MODEL: "scanprof_ai_model",
    NOTES: "scanprof_ai_notes",
    PROVIDER: "scanprof_ai_provider",
    INTERPRETATION: "scanprof_ai_interpretation_hints",
    MANUAL_DICTIONARIES: "scanprof_ai_manual_dictionary_map",
    AUTO_DICTIONARIES: "scanprof_ai_auto_dictionary_map",
    BASE_PREF: "scanprof_ai_base_preference",
  };
  const AI_CONTEXT_KEY = "scanprof_ai_context";
  const PROVIDERS = {
    openai: {
      label: "OpenAI",
      defaultModel: "gpt-4o-mini",
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    },
    gemini: {
      label: "Gemini",
      defaultModel: "gemini-1.5-flash",
      models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
    },
  };
  const DEFAULT_PROVIDER = "openai";
  const API_URL = "https://api.openai.com/v1/chat/completions";
  const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const GEMINI_MODEL_FALLBACKS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];
  const GEMINI_MODEL_ALIASES = {
    "gemini-1.5-flash-latest": "gemini-1.5-flash",
    "gemini-1.5-pro-latest": "gemini-1.5-pro",
    "gemini-pro-latest": "gemini-pro",
    "gemini-1.0-pro-latest": "gemini-1.0-pro",
  };
  const GEMINI_USER_MESSAGES = {
    invalidKey: "Cette clé Gemini est invalide ou mal renseignée.",
    forbidden: "Cette clé Gemini n’a pas accès au modèle requis.",
    quota: "Le quota de cette clé Gemini est atteint ou temporairement indisponible.",
    modelUnavailable: "Aucun modèle Gemini compatible n’est disponible avec cette clé.",
    network: "Connexion impossible au service Gemini.",
    generic: "Analyse Gemini indisponible pour le moment.",
  };
  const MAX_ELEVES = 60;
  const CORE_COLUMNS = new Set(["nom", "prenom", "classe", "sexe", "distance", "vitesse", "vma", "temps_total"]);
  const INCOMPLETE_RESPONSE_ERROR = "AI_INCOMPLETE_RESPONSE";
  const DEBUG_AI = true;
  const DEBUG_PREFIX = "[ScanProf IA]";
  const SECTION_ICONS = {
    Synthèse: "📘",
    "Élèves en difficulté": "⚠️",
    "Élèves à surveiller": "👀",
    "Points forts": "🌟",
    "Points à retravailler": "🔄",
    "Recommandations pour la séance suivante": "🧭",
    Différenciation: "🎯",
    "Suite proposée": "📅",
    "Points de vigilance": "⚠️",
    Priorités: "🎯",
    Suggestions: "💡",
    "Idées pour consolider": "🧱",
    "Réponse": "💬",
    "Pistes d'action": "🛠️",
    "Bilan textuel": "📄",
    "Question posée": "❓",
    Erreur: "⚠️",
    "Bilan textuel": "📄",
    "Question posée": "❓",
    Erreur: "⚠️",
    "Repérages élèves": "🧭",
  };
  const STUDENT_PROFILE_SECTION_KEY = "reperages_eleves";
  const STUDENT_PROFILE_CATEGORIES = ["to_support", "strengths", "to_confirm"];
  const STUDENT_PROFILE_CATEGORY_LABELS = {
    to_support: "À accompagner",
    strengths: "Point d'appui",
    to_confirm: "À confirmer",
  };
  const STUDENT_RANKING_KEYS = ["strongest", "weakest", "below_attempt_average"];
  const STUDENT_RANKING_LABELS = {
    strongest: "En réussite",
    weakest: "À soutenir davantage",
    below_attempt_average: "Volume à relancer",
  };
  const CYCLE_PROFILE_CATEGORY_LABELS = {
    progressing: "Progression",
    stalled: "À surveiller",
  };
  const SUMMARY_SECTION_MAP = {
    synthese: { source: "overview", type: "text", limit: 3 },
    points_forts: { source: "strengths", type: "list", limit: 3 },
    points_a_retravailler: { source: "needs_work", type: "list", limit: 3 },
    suite_proposee: { source: "next_steps", type: "list", limit: 3 },
    priorites: { source: "next_steps", type: "list", limit: 3 },
    suggestions: { source: "next_steps", type: "list", limit: 3 },
  };
  const EMPTY_SECTION_TEXT = "Aucune information disponible.";
  const DICTIONARY_EVENT = "scanprof:dictionaries-changed";
  const DICTIONARY_STATE_EVENT = "scanprof:dictionary-state-changed";
  const OPEN_DICTIONARY_EVENT = "scanprof:open-dictionary";
  const MAX_TOTAL_COLUMNS = 18;
  const SESSION_META_KEY = "scanprof_current_session_meta";
  const MAX_CYCLE_SESSIONS = 5;
  const CYCLE_DEBUG_PREFIX = "[ScanProf IA][Cycle]";
  const SESSION_BUNDLE_MIN_SOURCES = 2;
  const CYCLE_TRIGGER_KEY = "scanprof_cycle_trigger";
  const CYCLE_REJECTION_MESSAGES = {
    dataset_vide: "données absentes",
    referentiel_introuvable: "référentiel introuvable",
    referentiel_different: "référentiel incompatible",
    activite_differente: "activité différente",
    colonnes_insuffisantes: "colonnes non reconnues",
    signature_invalide: "séance incompatible",
  };
  const CYCLE_MIN_SESSIONS_FOR_FALLBACK = 2;
  const CYCLE_ULTIMATE_FALLBACKS = {
    points_forts: [
      "Cycle maintenu sur plusieurs séances malgré des relevés partiels.",
      "Engagement du groupe confirmé sur l'activité retenue.",
    ],
    suite_proposee: [
      "Structurer un suivi prévu/réalisé simple pour chaque atelier.",
      "Stabiliser le protocole de collecte avec les mêmes colonnes à chaque séance.",
      "Poursuivre le cycle en notant des indicateurs réguliers séance après séance.",
    ],
  };
  const ANALYSIS_MODES = {
    session: "session",
    cycle: "cycle",
    student: "student",
  };
  const STUDENT_SCOPES = {
    session: "session",
    cycle: "cycle",
  };
  const BASE_READING_OPTIONS = {
    auto: null,
    climb_track: "climb_track",
    cross_training: "cross_training",
    arcathlon_v2: "arcathlon_v2",
    laser_run: "laser_run",
  };
  const BASE_READING_LABELS = {
    auto: "Auto",
    climb_track: "Climb Track",
    cross_training: "Cross Training",
    arcathlon_v2: "ArcAthlon V2",
    laser_run: "Laser Run",
  };
  const ANALYSIS_MODE_STORAGE_KEY = "scanprof_ai_analysis_mode";
  const BASE_SCOPE_FALLBACK_KEY = "__default__";
  const FRIENDLY_ERROR_COOLDOWN_MS = 3500;
  const STUDENT_HISTORY_LIMIT_SAFE =
    typeof window !== "undefined" && typeof window.STUDENT_HISTORY_LIMIT === "number"
      ? window.STUDENT_HISTORY_LIMIT
      : 8;

  let refs = {};
  let lastReportText = "";
  let lastReportSections = [];
  let currentContext = {};
  let currentProvider = DEFAULT_PROVIDER;
  let currentModel = PROVIDERS[DEFAULT_PROVIDER].defaultModel;
  let lastIntent = "bilan";
  let lastQuestionText = "";
  let lastDictionaryCoverage = null;
  let lastActivityName = "";
  let lastCycleDiagnostics = { totalCandidates: 0, retained: 0, rejections: [] };
  let cycleRejectionLog = [];
  let studentDirectory = new Map();
  let selectedAnalysisMode = ANALYSIS_MODES.session;
  let selectedStudentScope = STUDENT_SCOPES.session;
  let selectedBase = "auto";
  let lastBaseScopeKey = "";
  let lastFriendlyErrorAt = 0;

  document.addEventListener("DOMContentLoaded", initAssistant);

  function geminiUserMessage(type) {
    return GEMINI_USER_MESSAGES[type] || GEMINI_USER_MESSAGES.generic;
  }

  function normalizeModelForProvider(providerKey, modelName) {
    if (!modelName) return null;
    const raw = String(modelName).trim();
    if (!raw) return null;
    if (providerKey === "gemini") {
      let normalized = raw.replace(/^models\//i, "");
      const lower = normalized.toLowerCase();
      const alias = GEMINI_MODEL_ALIASES[normalized] || GEMINI_MODEL_ALIASES[lower];
      if (alias) return alias;
      if (GEMINI_MODEL_FALLBACKS.includes(normalized)) return normalized;
      if (GEMINI_MODEL_FALLBACKS.includes(lower)) return lower;
      return lower;
    }
    const provider = PROVIDERS[providerKey];
    if (!provider) return null;
    if (provider.models.includes(raw)) return raw;
    const lower = raw.toLowerCase();
    const match = provider.models.find((entry) => entry.toLowerCase() === lower);
    return match || null;
  }

  function getGeminiModelCandidates(preferredModel) {
    const initial = normalizeModelForProvider("gemini", preferredModel) || PROVIDERS.gemini.defaultModel;
    const ordered = [initial, ...GEMINI_MODEL_FALLBACKS];
    const seen = new Set();
    return ordered
      .map((entry) => (entry ? String(entry).trim() : ""))
      .filter((entry) => {
        if (!entry) return false;
        const lower = entry.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
  }

  function rememberModelSelection(model, providerKey = currentProvider) {
    const provider = PROVIDERS[providerKey] || PROVIDERS[DEFAULT_PROVIDER];
    const normalized = normalizeModelForProvider(providerKey, model) || provider.defaultModel;
    currentModel = normalized;
    try {
      localStorage.setItem(STORAGE.MODEL, normalized);
    } catch {
      /* noop */
    }
  }

  function detectGeminiModelError(status, message = "", errorStatus = "") {
    const code = Number(status) || 0;
    const lower = (message || "").toLowerCase();
    const statusTag = (errorStatus || "").toUpperCase();
    if (code === 404 || statusTag.includes("NOT_FOUND")) return true;
    if (code === 403) {
      if (lower.includes("model") || lower.includes("permission") || lower.includes("access")) return true;
      if (statusTag.includes("PERMISSION")) return true;
    }
    if (code === 400 && lower.includes("model")) return true;
    if (lower.includes("model") && lower.includes("not found")) return true;
    return false;
  }

  function classifyGeminiError(meta = {}, message = "", shouldRetry = false) {
    if (meta.category) return meta.category;
    if (meta.networkError) return "network";
    const status = Number(meta.status) || 0;
    const statusText = (meta.errorStatus || "").toUpperCase();
    const text = (message || "").toLowerCase();
    if (status === 401 || statusText.includes("UNAUTHENTICATED") || text.includes("api key") || text.includes("invalid key")) {
      return "invalidKey";
    }
    if (status === 403 || statusText.includes("PERMISSION") || text.includes("permission") || text.includes("not have access") || text.includes("access denied") || text.includes("not authorized")) {
      return "forbidden";
    }
    if (status === 429 || status === 503 || statusText.includes("RESOURCE_EXHAUSTED") || text.includes("quota") || text.includes("exceeded") || text.includes("rate limit")) {
      return "quota";
    }
    if (shouldRetry || status === 404 || statusText.includes("NOT_FOUND")) {
      return "modelUnavailable";
    }
    return "generic";
  }

  function buildGeminiError(message, meta = {}) {
    const text = message || "Erreur API Gemini.";
    const shouldRetry =
      meta.forceModelError != null
        ? !!meta.forceModelError
        : detectGeminiModelError(meta.status, text, meta.errorStatus);
    const category = classifyGeminiError(meta, text, shouldRetry);
    const err = new Error(text);
    err.status = meta.status;
    err.code = meta.code;
    err.provider = "gemini";
    err.model = meta.model;
    err.category = category;
    err.userMessage = geminiUserMessage(category);
    err.geminiModelError = shouldRetry;
    err.logMessage = meta.logMessage || `[Gemini ${meta.model || "?"}] ${text}${meta.status ? ` (HTTP ${meta.status})` : ""}`;
    return err;
  }

  function createFriendlyError(message, logMessage, category = "generic") {
    const err = new Error(message);
    err.userMessage = message;
    err.logMessage = logMessage || message;
    err.provider = "gemini";
    err.category = category;
    err.geminiModelError = false;
    return err;
  }

  function getActivityDictionary(activityName = "") {
    const api = window.ScanProfAIDictionaries;
    if (!api || typeof api.getDictionaryForActivity !== "function") return null;
    return api.getDictionaryForActivity(activityName);
  }

  function getDictionaryByIdSafe(id) {
    if (!id) return null;
    const api = window.ScanProfAIDictionaries;
    if (!api || typeof api.getDictionaryById !== "function") return null;
    return api.getDictionaryById(id);
  }

  function resolveDictionarySourceTag({ forcedDictionary, manualEntry, baseApplied, autoDictionary, dictionary }) {
    if (forcedDictionary) return "forced";
    if (manualEntry) return "manual";
    if (baseApplied) return "base-preference";
    if (autoDictionary) return "auto";
    return dictionary?.source || "default";
  }

  function loadBasePreferenceMap() {
    try {
      const raw = localStorage.getItem(STORAGE.BASE_PREF);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveBasePreferenceMap(map) {
    try {
      localStorage.setItem(STORAGE.BASE_PREF, JSON.stringify(map || {}));
    } catch {
      /* noop */
    }
  }

  function getBasePreferenceKey(context = {}) {
    const key = getContextScopeKey(context || {});
    return key || BASE_SCOPE_FALLBACK_KEY;
  }

  function getStoredBasePreference(context = {}) {
    const map = loadBasePreferenceMap();
    const key = getBasePreferenceKey(context);
    return map[key] || "auto";
  }

  function rememberBasePreferenceForContext(baseValue = "auto") {
    const context = getActiveScopeContext();
    const key = getBasePreferenceKey(context);
    const map = loadBasePreferenceMap();
    lastBaseScopeKey = key;
    if (!baseValue || baseValue === "auto") delete map[key];
    else map[key] = baseValue;
    saveBasePreferenceMap(map);
  }

  function getActiveScopeContext() {
    if (currentContext && (currentContext.className || currentContext.activityName)) {
      return {
        classe: currentContext.className || currentContext.storedContext?.classe || "",
        activite: currentContext.activityName || currentContext.storedContext?.activite || "",
        datasetSignature: currentContext.storedContext?.datasetSignature || "",
      };
    }
    const storedContext = getStoredAIContext();
    return storedContext || {};
  }

  function syncBasePreferenceWithContext(force = false) {
    const context = getActiveScopeContext();
    const key = getBasePreferenceKey(context);
    if (!force && key === lastBaseScopeKey) {
      updateBaseIndicator();
      return;
    }
    lastBaseScopeKey = key;
    const storedValue = getStoredBasePreference(context);
    setBasePreference(storedValue, { persist: false, updateInputs: true });
  }

  function setBasePreference(value, { persist = false, updateInputs = true } = {}) {
    const normalized = BASE_READING_OPTIONS[value] ? value : "auto";
    selectedBase = normalized;
    if (updateInputs) syncBaseInputs(normalized);
    updateBaseIndicator();
    updateDictionaryIndicators();
    if (persist) {
      rememberBasePreferenceForContext(normalized);
    }
  }

  function syncBaseInputs(baseValue) {
    if (!refs.baseInputs) return;
    refs.baseInputs.forEach((input) => {
      if (!input) return;
      input.checked = input.value === baseValue;
    });
  }

  function updateBaseIndicator() {
    if (!refs.baseIndicator) return;
    const label = BASE_READING_LABELS[selectedBase] || BASE_READING_LABELS.auto;
    const suffix = selectedBase === "auto" ? "" : " (choisie)";
    refs.baseIndicator.textContent = `Lecture actuelle : ${label}${suffix}`;
  }

  function getBaseReadingSnapshot() {
    return {
      value: selectedBase,
      label: BASE_READING_LABELS[selectedBase] || BASE_READING_LABELS.auto,
    };
  }

  function getPreferredBaseDictionary(context = {}) {
    const baseKey =
      selectedBase && selectedBase !== "auto" ? selectedBase : getStoredBasePreference(context || getActiveScopeContext());
    if (!baseKey || baseKey === "auto") return null;
    const dictionaryId = BASE_READING_OPTIONS[baseKey];
    if (!dictionaryId) return null;
    return getDictionaryByIdSafe(dictionaryId);
  }

  function setAnalysisMode(mode) {
    const normalized = Object.values(ANALYSIS_MODES).includes(mode) ? mode : ANALYSIS_MODES.session;
    if (selectedAnalysisMode === normalized) {
      updateContextVisibility();
      updateModeIndicators();
      return;
    }
    selectedAnalysisMode = normalized;
    syncAnalysisModeInputs(normalized);
    updateContextVisibility();
    updatePrimaryButtonState();
    updateModeIndicators();
  }

  function formatAnalysisModeLabel(mode) {
    switch (mode) {
      case ANALYSIS_MODES.cycle:
        return "Cycle";
      case ANALYSIS_MODES.student:
        return "Élève";
      default:
        return "Séance";
    }
  }

  function syncAnalysisModeInputs(mode) {
    if (!refs.analysisModeInputs) return;
    refs.analysisModeInputs.forEach((input) => {
      if (!input) return;
      input.checked = input.value === mode;
    });
  }

  function rememberAnalysisModePreference() {
    try {
      localStorage.setItem(ANALYSIS_MODE_STORAGE_KEY, selectedAnalysisMode);
    } catch {
      /* noop */
    }
  }

  function restoreAnalysisModePreference() {
    let stored = null;
    try {
      stored = localStorage.getItem(ANALYSIS_MODE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    setAnalysisMode(Object.values(ANALYSIS_MODES).includes(stored) ? stored : ANALYSIS_MODES.session);
  }

  function updateContextVisibility() {
    const visibility = {
      session: selectedAnalysisMode === ANALYSIS_MODES.session,
      cycle: selectedAnalysisMode === ANALYSIS_MODES.cycle,
      student: selectedAnalysisMode === ANALYSIS_MODES.student,
    };
    Object.entries(refs.contextBoxes || {}).forEach(([key, element]) => {
      if (!element) return;
      element.classList.toggle("sp-hidden", !visibility[key]);
    });
    if (refs.cycleDiagnostics) {
      refs.cycleDiagnostics.classList.toggle("sp-hidden", selectedAnalysisMode !== ANALYSIS_MODES.cycle);
    }
  }

  function updatePrimaryButtonState() {
    if (!refs.runBtn) return;
    const summary = summarizeDataset();
    if (selectedAnalysisMode === ANALYSIS_MODES.student) {
      const hasSelection = Boolean(refs.studentSelect && refs.studentSelect.value);
      const hasOptions = studentDirectory.size > 0;
      const disabled = !hasOptions || !hasSelection;
      refs.runBtn.disabled = disabled;
      refs.runBtn.title = disabled ? "Choisissez un élève et un mode pour lancer le bilan." : "";
      return;
    }
    const hasEntries = summary.total > 0;
    refs.runBtn.disabled = !hasEntries;
    refs.runBtn.title = hasEntries ? "" : "Ajoutez des élèves pour lancer l’analyse.";
  }

  function attachGlobalErrorHandlers() {
    window.addEventListener(
      "error",
      (event) => {
        if (!event) return;
        handleGlobalIssue(event.message || "");
      },
      true
    );
    window.addEventListener(
      "unhandledrejection",
      (event) => {
        handleGlobalIssue(event?.reason?.message || event?.reason || "");
      },
      true
    );
  }

  function handleGlobalIssue(message) {
    if (!message) return;
    const now = Date.now();
    if (now - lastFriendlyErrorAt < FRIENDLY_ERROR_COOLDOWN_MS) return;
    lastFriendlyErrorAt = now;
    if (refs.runStatus) {
      setStatus(refs.runStatus, "Un imprévu technique est survenu. Consultez la console pour le détail.", "error");
    }
  }

  function getContextScopeKey(context = {}) {
    const classeSource = context.classe || context.className || context.datasetSignature || "";
    const classe = slug(String(classeSource || "").trim() || "classe");
    const rawActivity = context.activite || context.activityName || "";
    const hasActivity = Boolean(String(rawActivity || "").trim());
    const datasetSignature = context.datasetSignature || context.sessionId || "";
    const activitySlug = slug(
      String(hasActivity ? rawActivity : datasetSignature || "activite")
        .trim() || "activite"
    );
    const datasetSegment = !hasActivity && datasetSignature ? `::${slug(String(datasetSignature).trim())}` : "";
    return `${classe}::${activitySlug}${datasetSegment}`;
  }

  function loadManualDictionaryMap() {
    try {
      const raw = localStorage.getItem(STORAGE.MANUAL_DICTIONARIES);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveManualDictionaryMap(map) {
    try {
      localStorage.setItem(STORAGE.MANUAL_DICTIONARIES, JSON.stringify(map || {}));
    } catch {
      /* noop */
    }
  }

  function loadAutoDictionaryMap() {
    try {
      const raw = localStorage.getItem(STORAGE.AUTO_DICTIONARIES);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveAutoDictionaryMap(map) {
    try {
      localStorage.setItem(STORAGE.AUTO_DICTIONARIES, JSON.stringify(map || {}));
    } catch {
      /* noop */
    }
  }

  function getManualDictionaryEntry(context = {}) {
    const key = getContextScopeKey(context);
    if (!key) return null;
    const map = loadManualDictionaryMap();
    const entry = map[key];
    if (!entry || !entry.dictionaryId) return null;
    const dictionary = getDictionaryByIdSafe(entry.dictionaryId);
    if (!dictionary) return null;
    return { ...entry, dictionary };
  }

  function getAutoDictionaryEntry(context = {}) {
    const key = getContextScopeKey(context);
    if (!key) return null;
    const map = loadAutoDictionaryMap();
    return map[key] || null;
  }

  function applyManualDictionary(dictionaryId, context) {
    const key = getContextScopeKey(context);
    if (!key) {
      return { success: false, message: "Contexte de séance introuvable." };
    }
    if (!dictionaryId) {
      return clearManualDictionary(context);
    }
    const dictionary = getDictionaryByIdSafe(dictionaryId);
    if (!dictionary) {
      return { success: false, message: "Dictionnaire introuvable." };
    }
    const map = loadManualDictionaryMap();
    map[key] = {
      dictionaryId,
      label: dictionary.label || dictionaryId,
      appliedAt: new Date().toISOString(),
      activityName: context?.activite || context?.activityName || "",
    };
    saveManualDictionaryMap(map);
    emitDictionaryStateChange({ type: "manual_apply", scope: key, dictionaryId, label: dictionary.label || dictionaryId });
    return { success: true, entry: map[key], dictionary };
  }

  function clearManualDictionary(context) {
    const key = getContextScopeKey(context);
    if (!key) return { success: false, message: "Contexte de séance introuvable." };
    const map = loadManualDictionaryMap();
    if (map[key]) {
      delete map[key];
      saveManualDictionaryMap(map);
      emitDictionaryStateChange({ type: "manual_clear", scope: key });
    }
    return { success: true };
  }

  function rememberAutoDictionary(context, dictionary) {
    if (!dictionary) return;
    const key = getContextScopeKey(context);
    if (!key) return;
    const map = loadAutoDictionaryMap();
    map[key] = {
      dictionaryId: dictionary?.id || null,
      label: dictionary?.label || "",
      detectedAt: new Date().toISOString(),
      activityName: context?.activite || context?.activityName || "",
    };
    saveAutoDictionaryMap(map);
    emitDictionaryStateChange({ type: "auto_detected", scope: key, dictionaryId: map[key].dictionaryId, label: map[key].label });
  }

  function emitDictionaryStateChange(detail) {
    try {
      window.dispatchEvent(
        new CustomEvent(DICTIONARY_STATE_EVENT, {
          detail: detail || {},
        })
      );
    } catch {
      /* noop */
    }
  }

  window.ScanProfDictionaryState = {
    applyForCurrentContext(dictionaryId) {
      const context = getStoredAIContext();
      if (!context) return { success: false, message: "Aucune séance chargée." };
      return applyManualDictionary(dictionaryId, context);
    },
    clearForCurrentContext() {
      const context = getStoredAIContext();
      if (!context) return { success: false, message: "Aucune séance chargée." };
      return clearManualDictionary(context);
    },
    getStateForContext(context) {
      const manual = context ? getManualDictionaryEntry(context) : null;
      const auto = context ? getAutoDictionaryEntry(context) : null;
      return { manual, auto };
    },
    getStateForStoredContext() {
      const context = getStoredAIContext();
      return context ? this.getStateForContext(context) : { manual: null, auto: null };
    },
  };

  function buildInterpretationSupport({ columns = [], activityName = "", manualText = "", dictionary = null }) {
    const cleanColumns = (columns || []).map((col) => (col == null ? "" : String(col))).filter(Boolean);
    const trimmedManual = (manualText || "").trim();
    const safeDictionary = sanitizeDictionaryForPrompt(dictionary);
    const guides = [];
    if (cleanColumns.length) {
      guides.push(`Colonnes détectées : ${cleanColumns.join(", ")}`);
    }
    if (safeDictionary) {
      const label = safeDictionary.label || safeDictionary.id || "Activité";
      if (safeDictionary.description) {
        guides.push(`Description ${label} : ${safeDictionary.description}`);
      }
      const abbreviationsGuide = formatDictionaryPairs(safeDictionary.abbreviations, 12);
      if (abbreviationsGuide) {
        guides.push(`Codes ${label} :\n${abbreviationsGuide}`);
      }
      const suffixGuide = formatDictionaryPairs(safeDictionary.suffixes, 8);
      if (suffixGuide) {
        guides.push(`Suffixes ${label} :\n${suffixGuide}`);
      }
      if (safeDictionary.levels?.length) {
        guides.push(`Niveaux / difficultés : ${safeDictionary.levels.slice(0, 10).join(", ")}`);
      }
      if (safeDictionary.practices?.length) {
        guides.push(`Pratiques : ${safeDictionary.practices.slice(0, 10).join(", ")}`);
      }
      if (safeDictionary.interpretation?.length) {
        guides.push(`Règles d'interprétation : ${safeDictionary.interpretation.join(" ")}`);
      }
      if (safeDictionary.notes?.length) {
        guides.push(`Repères activité : ${safeDictionary.notes.join(" ")}`);
      }
      if (safeDictionary.comparison_rules?.length) {
        guides.push(`Comparaisons autorisées : ${safeDictionary.comparison_rules.join(" / ")}`);
      }
      if (safeDictionary.signal_rules?.length) {
        guides.push(`Signaux pédagogiques : ${safeDictionary.signal_rules.join(" / ")}`);
      }
      if (safeDictionary.limits?.length) {
        guides.push(`Limites connues : ${safeDictionary.limits.join(" / ")}`);
      }
      if (safeDictionary.examples?.length) {
        guides.push(`Exemples : ${safeDictionary.examples.join(" / ")}`);
      }
      if (safeDictionary.teacher_context_required) {
        guides.push("Cette activité requiert un complément de contexte enseignant.");
      }
      if (safeDictionary.confidence && safeDictionary.confidence !== "unknown") {
        guides.push(`Fiabilité référentiel : ${safeDictionary.confidence}.`);
      }
    }
    if (trimmedManual) {
      guides.push(`Indications de l'enseignant :\n${trimmedManual}`);
    }
    return {
      activityName,
      columns: cleanColumns,
      dictionary: safeDictionary,
      manual: trimmedManual,
      guides,
    };
  }

  function sanitizeDictionaryForPrompt(dictionary) {
    if (!dictionary) return null;
    return {
      id: dictionary.id || "",
      label: dictionary.label || dictionary.id || "",
      description: dictionary.description || "",
      abbreviations: { ...(dictionary.abbreviations || {}) },
      suffixes: { ...(dictionary.suffixes || {}) },
      interpretation: Array.isArray(dictionary.interpretation) ? dictionary.interpretation.filter(Boolean) : [],
      notes: Array.isArray(dictionary.notes) ? dictionary.notes.filter(Boolean) : [],
      levels: Array.isArray(dictionary.levels) ? dictionary.levels.filter(Boolean) : [],
      practices: Array.isArray(dictionary.practices) ? dictionary.practices.filter(Boolean) : [],
      source: dictionary.source || "default",
      confidence: dictionary.confidence || "unknown",
      ai_may_infer: Boolean(dictionary.ai_may_infer),
      teacher_context_required: Boolean(dictionary.teacher_context_required),
      limits: Array.isArray(dictionary.limits) ? dictionary.limits.filter(Boolean) : [],
      examples: Array.isArray(dictionary.examples) ? dictionary.examples.filter(Boolean) : [],
      comparison_rules: Array.isArray(dictionary.comparison_rules) ? dictionary.comparison_rules.filter(Boolean) : [],
      signal_rules: Array.isArray(dictionary.signal_rules) ? dictionary.signal_rules.filter(Boolean) : [],
    };
  }

  function formatDictionaryPairs(record = {}, limit = 12) {
    const entries = Object.entries(record || {});
    if (!entries.length) return "";
    return entries
      .slice(0, limit)
      .map(([key, desc]) => `${key} : ${desc}`)
      .join("\n");
  }

  function initAssistant() {
    refs = {
      openBtn: document.getElementById("ai-open-btn"),
      drawerBackdrop: document.getElementById("ai-drawer"),
      drawerPanel: document.querySelector("#ai-drawer .ai-drawer"),
      drawerClose: document.getElementById("ai-drawer-close"),
      apiKeyInput: document.getElementById("ai-api-key"),
      saveBtn: document.getElementById("ai-save-key-btn"),
      deleteBtn: document.getElementById("ai-delete-key-btn"),
      testBtn: document.getElementById("ai-test-key-btn"),
      notesField: document.getElementById("ai-session-notes"),
      interpretationField: document.getElementById("ai-interpretation-notes"),
      dictionaryAlert: document.getElementById("ai-dictionary-alert"),
      dictionaryHint: document.getElementById("ai-dictionary-hint"),
      keyStatus: document.getElementById("ai-key-status"),
      runStatus: document.getElementById("ai-run-status"),
      runBtn: document.getElementById("ai-run-btn"),
      questionInput: document.getElementById("ai-question-input"),
      questionBtn: document.getElementById("ai-question-btn"),
      questionStatus: document.getElementById("ai-question-status"),
      summaryClass: document.getElementById("ai-summary-class"),
      summaryCount: document.getElementById("ai-summary-count"),
      summaryTypes: document.getElementById("ai-summary-types"),
      studentSelect: document.getElementById("ai-student-select"),
      studentScopeInputs: document.querySelectorAll('input[name="ai-student-scope"]'),
      studentSessionBtn: document.getElementById("ai-student-session-btn"),
      studentCycleBtn: document.getElementById("ai-student-cycle-btn"),
      studentStatus: document.getElementById("ai-student-status"),
      modeIndicator: document.getElementById("ai-mode-indicator"),
      dictionaryIndicator: document.getElementById("ai-dictionary-indicator"),
      cycleWarning: document.getElementById("ai-cycle-warning"),
      cycleDiagnostics: document.getElementById("ai-cycle-diagnostics"),
      cycleDiagnosticsList: document.getElementById("ai-cycle-diagnostics-list"),
      settingsPanel: document.getElementById("ai-settings-panel"),
      keyStateNote: document.getElementById("ai-key-state"),
      analysisModeInputs: document.querySelectorAll('input[name="ai-analysis"]'),
      baseInputs: document.querySelectorAll('input[name="ai-base"]'),
      baseIndicator: document.getElementById("ai-base-indicator"),
      contextBoxes: {
        session: document.getElementById("ai-context-session"),
        cycle: document.getElementById("ai-context-cycle"),
        student: document.getElementById("ai-context-student"),
      },
      contextTexts: {
        session: document.getElementById("ai-context-session-text"),
        cycle: document.getElementById("ai-context-cycle-text"),
      },
      actionButtons: {
        assistant: document.getElementById("ai-action-assistant"),
        bilan: document.getElementById("ai-action-bilan"),
        difficulte: document.getElementById("ai-action-difficulte"),
        points: document.getElementById("ai-action-points"),
        suivi: document.getElementById("ai-action-suivi"),
      },
      dictionaryInlineBtn: document.getElementById("ai-open-dictionary-inline"),
      questionSuggestions: document.querySelectorAll(".ai-question-suggestion"),
      modal: document.getElementById("ai-modal"),
      modalClose: document.getElementById("ai-modal-close"),
      modalDismiss: document.getElementById("ai-modal-dismiss"),
      modalTitle: document.getElementById("ai-modal-title"),
      modalSubtitle: document.getElementById("ai-modal-subtitle"),
      modalBody: document.getElementById("ai-modal-body"),
      modalContext: document.getElementById("ai-modal-context"),
      modalLoading: document.getElementById("ai-modal-loading"),
      modalContent: document.getElementById("ai-modal-content"),
      modalModeIndicator: document.getElementById("ai-modal-mode-indicator"),
      modalDictionaryIndicator: document.getElementById("ai-modal-dictionary-indicator"),
      copyBtn: document.getElementById("ai-copy-report-btn"),
      downloadBtn: document.getElementById("ai-download-report-btn"),
    };
    if (!refs.drawerPanel) return;

    loadStoredSettings();
    bindEvents();
    setupDictionaryHint();
    updateBaseIndicator();
    restoreAnalysisModePreference();
    updateSummaryUI();
    checkPendingCycleTrigger();
    updateModeIndicators();
    attachGlobalErrorHandlers();
    const eventName = (window.ScanProfParticipants && window.ScanProfParticipants.eventName) || "scanprof:dataset-changed";
    document.addEventListener(eventName, () => updateSummaryUI());
  }

  function bindEvents() {
    refs.saveBtn?.addEventListener("click", saveApiKey);
    refs.deleteBtn?.addEventListener("click", deleteApiKey);
    refs.testBtn?.addEventListener("click", testConnection);
     refs.runBtn?.addEventListener("click", handlePrimaryAction);
    refs.actionButtons?.assistant?.addEventListener("click", () => handleAnalysis("bilan"));
    refs.actionButtons?.bilan?.addEventListener("click", () => handleAnalysis("bilan"));
    refs.actionButtons?.difficulte?.addEventListener("click", () => handleAnalysis("difficulte"));
    refs.actionButtons?.points?.addEventListener("click", () => handleAnalysis("points_forts"));
    refs.actionButtons?.suivi?.addEventListener("click", () => handleAnalysis("suivi"));
    refs.dictionaryInlineBtn?.addEventListener("click", () => openDictionaryPanel());
    refs.questionBtn?.addEventListener("click", handleQuestion);
    refs.notesField?.addEventListener("input", handleNotesChange);
    refs.interpretationField?.addEventListener("input", handleInterpretationChange);
    refs.apiKeyInput?.addEventListener("change", handleKeyInputChange);
    refs.analysisModeInputs?.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) handleAnalysisModeChange(input.value);
      });
    });
    refs.baseInputs?.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) handleBaseSelectionChange(input.value);
      });
    });
    refs.studentScopeInputs?.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) updateStudentScope(input.value);
      });
    });
    refs.openBtn?.addEventListener("click", () => toggleDrawer(true));
    refs.drawerClose?.addEventListener("click", () => toggleDrawer(false));
    refs.drawerBackdrop?.addEventListener("click", (event) => {
      if (event.target === refs.drawerBackdrop) toggleDrawer(false);
    });
    refs.questionSuggestions?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-question") || "";
        if (text && refs.questionInput) {
          refs.questionInput.value = text;
          setStatus(refs.questionStatus, "", "info");
          refs.questionInput.focus();
        }
      });
    });
    refs.modalClose?.addEventListener("click", closeModal);
    refs.modalDismiss?.addEventListener("click", closeModal);
    refs.copyBtn?.addEventListener("click", copyReport);
    refs.downloadBtn?.addEventListener("click", downloadReport);
    if (refs.modal) {
      refs.modal.addEventListener("click", (event) => {
        if (event.target === refs.modal) closeModal();
      });
    }
    refs.studentSessionBtn?.addEventListener("click", () => handleStudentAnalysis("session"));
    refs.studentCycleBtn?.addEventListener("click", () => handleStudentAnalysis("cycle"));
    refs.studentSelect?.addEventListener("change", () => {
      setStatus(refs.studentStatus, "", "info");
      updatePrimaryButtonState();
    });
  }

  function handlePrimaryAction() {
    if (selectedAnalysisMode === ANALYSIS_MODES.student) {
      handleStudentAnalysis(selectedStudentScope);
      return;
    }
    if (selectedAnalysisMode === ANALYSIS_MODES.cycle) {
      const diagnostics = getCycleDiagnostics();
      let retained = diagnostics.retained || 0;
      if (retained < CYCLE_MIN_SESSIONS_FOR_FALLBACK) {
        const rawSessions = collectCycleSessions();
        retained = Math.max(retained, Array.isArray(rawSessions) ? rawSessions.length : 0);
      }
      if (retained < CYCLE_MIN_SESSIONS_FOR_FALLBACK) {
        const needed = Math.max(CYCLE_MIN_SESSIONS_FOR_FALLBACK - retained, 1);
        const message =
          retained === 0
            ? "Cycle indisponible : au moins deux séances retenues sont nécessaires."
            : `Cycle incomplet : ajoutez encore ${needed} séance${needed > 1 ? "s" : ""} retenue${needed > 1 ? "s" : ""}.`;
        setStatus(refs.runStatus, message, "error");
        updateModeIndicators();
        return;
      }
    }
    handleAnalysis("bilan");
  }

  function handleAnalysisModeChange(value) {
    setAnalysisMode(value || ANALYSIS_MODES.session);
    rememberAnalysisModePreference();
  }

  function handleBaseSelectionChange(value) {
    setBasePreference(value || "auto", { persist: true });
  }

  function updateStudentScope(value) {
    if (!value || !Object.values(STUDENT_SCOPES).includes(value)) {
      selectedStudentScope = STUDENT_SCOPES.session;
      return;
    }
    selectedStudentScope = value;
  }

  function setupDictionaryHint() {
    refreshDictionaryHint();
    if (refs.dictionaryHint) {
      refs.dictionaryHint.addEventListener("click", handleDictionaryHintClick);
    }
    window.addEventListener(DICTIONARY_EVENT, () => refreshDictionaryHint());
    window.addEventListener(DICTIONARY_STATE_EVENT, () => refreshDictionaryHint());
  }

  function refreshDictionaryHint(activityName, coverage, dictionaryInfo) {
    if (!refs.dictionaryHint) return;
    const storedContext = getStoredAIContext();
    const explicitName = (activityName || "").trim();
    const storedActivity = (storedContext?.activite || "").trim();
    const target = explicitName || storedActivity;
    if (explicitName) lastActivityName = explicitName;
    else if (!storedActivity) lastActivityName = "";
    if (coverage) lastDictionaryCoverage = coverage;
    const currentCoverage = coverage || lastDictionaryCoverage || null;
    const stateApi = window.ScanProfDictionaryState;
    const stateSnapshot =
      dictionaryInfo ||
      (stateApi && typeof stateApi.getStateForStoredContext === "function" ? stateApi.getStateForStoredContext() : null);
    let manualEntry = null;
    let autoEntry = null;
    let dictionary = null;
    if (stateSnapshot && stateSnapshot.manual) manualEntry = stateSnapshot.manual;
    if (stateSnapshot && stateSnapshot.auto) autoEntry = stateSnapshot.auto;
    if (dictionaryInfo && dictionaryInfo.label) {
      dictionary = { label: dictionaryInfo.label };
    }
    if (!dictionary && manualEntry?.dictionaryId) {
      dictionary = getDictionaryByIdSafe(manualEntry.dictionaryId) || { label: manualEntry.dictionary?.label || manualEntry.label };
    }
    if (!dictionary && autoEntry?.dictionaryId) {
      dictionary = getDictionaryByIdSafe(autoEntry.dictionaryId) || { label: autoEntry.label };
    }
    if (!dictionary && target) {
      dictionary = getActivityDictionary(target);
    }
    logDictionaryDetection({
      explicitActivity: explicitName || null,
      storedActivity,
      resolvedActivity: target || null,
      manualDictionaryId: manualEntry?.dictionaryId || null,
      autoDictionaryId: autoEntry?.dictionaryId || null,
      contextScope: storedContext ? getContextScopeKey(storedContext) : null,
      datasetSignature: storedContext?.datasetSignature || null,
    });
    const unknownCount = currentCoverage?.unknown?.length || 0;
    const manualActive = !!manualEntry?.dictionaryId;
    const autoLabel = autoEntry?.label || "";
    if (dictionary) {
      const baseLabel = dictionary.label || dictionary.id || "Activité";
      const badge = manualActive
        ? "manuel"
        : unknownCount > 0
        ? "référentiel partiel"
        : dictionary.source === "custom"
        ? "par défaut"
        : "auto";
      const suffix = unknownCount > 0 ? ` — ${unknownCount} code(s) à documenter.` : "";
      const autoNote = manualActive && autoLabel && autoLabel !== baseLabel ? ` (détection : ${escapeHtml(autoLabel)})` : "";
      refs.dictionaryHint.innerHTML = `📘 Référentiel ${manualActive ? "manuel" : "chargé"} : <strong>${escapeHtml(
        baseLabel
      )}</strong> (${badge})${suffix}${autoNote}`;
      refs.dictionaryHint.classList.remove("ai-dictionary-hint--empty");
      refs.dictionaryHint.dataset.state = manualActive ? "manual" : unknownCount > 0 ? "partial" : "loaded";
      refs.dictionaryHint.setAttribute("aria-live", "polite");
      updateDictionaryAlert(currentCoverage);
    } else {
      const message = target
        ? `Aucun dictionnaire n’est encore configuré pour cette activité.`
        : "Associez la séance à une activité pour charger un dictionnaire.";
      refs.dictionaryHint.innerHTML = `${message} <button type="button" class="ai-dictionary-link" data-dictionary-action="open">Ajouter / compléter</button>`;
      refs.dictionaryHint.classList.add("ai-dictionary-hint--empty");
      refs.dictionaryHint.dataset.state = "empty";
      refs.dictionaryHint.setAttribute("aria-live", "polite");
      updateDictionaryAlert(null);
    }
  }

  function handleDictionaryHintClick(event) {
    const trigger = event.target.closest("[data-dictionary-action]");
    if (!trigger) return;
    const action = trigger.getAttribute("data-dictionary-action");
    if (action === "open") {
      const context = getStoredAIContext();
      openDictionaryPanel(context?.activite || lastActivityName || "");
    }
  }

  function updateDictionaryAlert(coverage) {
    if (!refs.dictionaryAlert) return;
    if (!coverage || !coverage.unknown || !coverage.unknown.length) {
      refs.dictionaryAlert.classList.add("sp-hidden");
      refs.dictionaryAlert.textContent = "";
      return;
    }
    const unknownList = coverage.unknown.slice(0, 5).join(", ");
    const more = coverage.unknown.length > 5 ? ` +${coverage.unknown.length - 5}` : "";
    refs.dictionaryAlert.innerHTML = `<strong>Codes à documenter :</strong> ${escapeHtml(unknownList)}${more ? escapeHtml(more) : ""}`;
    refs.dictionaryAlert.classList.remove("sp-hidden");
  }

  function openDictionaryPanel(activityName = "") {
    const context = getStoredAIContext();
    const resolved = activityName || context?.activite || "";
    try {
      window.dispatchEvent(
        new CustomEvent(OPEN_DICTIONARY_EVENT, {
          detail: { activityName: resolved, source: "assistant" },
        })
      );
    } catch {
      const btn = document.getElementById("ai-dictionary-open-btn");
      if (btn) btn.click();
    }
  }

  function loadStoredSettings() {
    try {
      const storedProvider = localStorage.getItem(STORAGE.PROVIDER) || null;
      const storedModel = localStorage.getItem(STORAGE.MODEL) || null;
      setProvider(storedProvider, storedModel);
      const storedKey = localStorage.getItem(STORAGE.API_KEY) || "";
      if (storedKey && refs.apiKeyInput) refs.apiKeyInput.value = storedKey;
      const storedNotes = localStorage.getItem(STORAGE.NOTES) || "";
      if (refs.notesField) refs.notesField.value = storedNotes;
      const storedInterpretation = localStorage.getItem(STORAGE.INTERPRETATION) || "";
      if (refs.interpretationField) refs.interpretationField.value = storedInterpretation;
      if (storedKey) {
        setStatus(refs.keyStatus, "Clé chargée.", "success");
      }
      syncSettingsPanelState(Boolean(storedKey));
    } catch {
      setStatus(refs.keyStatus, "Impossible de charger la clé enregistrée.", "error");
      syncSettingsPanelState(false);
    }
  }

  function syncSettingsPanelState(hasKey) {
    if (!refs.settingsPanel) return;
    if (hasKey) refs.settingsPanel.removeAttribute("open");
    else refs.settingsPanel.setAttribute("open", "");
    if (refs.keyStateNote) {
      refs.keyStateNote.textContent = hasKey ? "Clé enregistrée" : "Aucune clé enregistrée.";
    }
  }

  function setProvider(providerKey, presetModel) {
    const key = PROVIDERS[providerKey] ? providerKey : DEFAULT_PROVIDER;
    currentProvider = key;
    rememberModelSelection(presetModel, key);
    try {
      localStorage.setItem(STORAGE.PROVIDER, key);
    } catch {
      /* noop */
    }
    if (refs.apiKeyInput) {
      refs.apiKeyInput.placeholder = "Ex : sk-... ou AIza-...";
    }
  }

  function handleKeyInputChange() {
    const key = refs.apiKeyInput?.value || "";
    if (!key) return;
    const providerKey = inferProviderFromKey(key);
    if (providerKey && providerKey !== currentProvider) {
      setProvider(providerKey);
      setStatus(refs.keyStatus, `Détection automatique : ${PROVIDERS[providerKey].label}`, "info");
    }
  }

  function handleNotesChange(event) {
    try {
      localStorage.setItem(STORAGE.NOTES, event.target.value || "");
    } catch {
      /* noop */
    }
  }

  function handleInterpretationChange(event) {
    try {
      localStorage.setItem(STORAGE.INTERPRETATION, event.target.value || "");
    } catch {
      /* noop */
    }
  }

  function handleQuestion() {
    const question = (refs.questionInput?.value || "").trim();
    if (!question) {
      setStatus(refs.questionStatus, "Merci de saisir une question.", "error");
      return;
    }
    handleAnalysis("question", question);
  }

  function saveApiKey() {
    const value = (refs.apiKeyInput?.value || "").trim();
    if (!value) {
      setStatus(refs.keyStatus, "Merci d’entrer une clé avant d’enregistrer.", "error");
      return;
    }
    try {
      localStorage.setItem(STORAGE.API_KEY, value);
      const inferred = inferProviderFromKey(value);
      setProvider(inferred);
      setStatus(refs.keyStatus, "Clé enregistrée (stockée localement).", "success");
      syncSettingsPanelState(true);
    } catch {
      setStatus(refs.keyStatus, "Stockage impossible (quota localStorage atteint ?).", "error");
    }
  }

  function deleteApiKey() {
    try {
      localStorage.removeItem(STORAGE.API_KEY);
    } catch {
      /* noop */
    }
    if (refs.apiKeyInput) refs.apiKeyInput.value = "";
    setStatus(refs.keyStatus, "Clé supprimée de cet appareil.", "success");
    syncSettingsPanelState(false);
  }

  async function testConnection() {
    const apiKey = getApiKey();
    if (!apiKey) {
      setStatus(refs.keyStatus, "Veuillez renseigner et enregistrer votre clé.", "error");
      return;
    }
    const { key: providerKey, label } = getProviderConfig();
    setStatus(refs.keyStatus, `Test de connexion (${label})...`, "info");
    try {
      const model = getSelectedModel();
      await callProvider(providerKey, apiKey, model, [
        { role: "system", content: "Tu confirmes uniquement la bonne réception des instructions." },
        { role: "user", content: "Réponds strictement par OK." },
      ], { max_tokens: 16, temperature: 0, intent: "test" });
      setStatus(refs.keyStatus, "Connexion validée ✅", "success");
    } catch (err) {
      if (err?.logMessage) console.error(err.logMessage, err);
      else console.error(err);
      const message = err?.userMessage || err?.message || "Erreur de connexion.";
      setStatus(refs.keyStatus, message, "error");
    }
  }

  async function handleAnalysis(intent = "bilan", questionText = "") {
    logDebug("handleAnalysis start", { intent });
    lastIntent = intent;
    const statusTarget = intent === "question" ? refs.questionStatus : refs.runStatus;
    const apiKey = getApiKey();
    if (!apiKey) {
      setStatus(statusTarget, "Clé manquante. Merci de l’ajouter avant de lancer l’analyse.", "error");
      return;
    }
    const dataset = getDataset();
    if (!dataset.length) {
      setStatus(statusTarget, "Aucun élève enregistré pour cette séance.", "error");
      return;
    }
    logDebug("Dataset loaded", { size: dataset.length });
    logDebug("Dataset sample columns", { columns: summarizeDataset().columns || [] });
    const { key: providerKey, label: providerLabel } = getProviderConfig();

    setPanelBusy(true);
    openModal();
    setModalLoading(true);
    setStatus(statusTarget, `Analyse en cours via ${providerLabel}...`, "info");

    try {
      const notes = refs.notesField?.value || "";
      const storedContext = getStoredAIContext();
      const sessionMeta = getStoredSessionMeta();
      const forcedDictionaryId = sessionMeta?.forcedDictionaryId || null;
      const forcedDictionary = forcedDictionaryId ? getDictionaryByIdSafe(forcedDictionaryId) : null;
      const summary = summarizeDataset();
      const manualInterpretation = refs.interpretationField?.value || localStorage.getItem(STORAGE.INTERPRETATION) || "";
      const autoDictionary = getActivityDictionary(currentContext.activityName || storedContext.activite || "");
      const manualEntry = getManualDictionaryEntry(storedContext);
      const manualDictionary = manualEntry?.dictionary || null;
      const baseDictionary = forcedDictionary || manualDictionary ? null : getPreferredBaseDictionary(storedContext);
      logDebug("Dictionary detection state", {
        storedActivity: storedContext.activite || null,
        manualDictionaryId: manualEntry?.dictionaryId || null,
        autoDictionaryId: autoDictionary?.id || null,
      });
      rememberAutoDictionary(storedContext, autoDictionary);
      const dictionaryToUse = forcedDictionary || manualDictionary || baseDictionary || autoDictionary;
      const dictionarySource = forcedDictionary
        ? "cycle-forced"
        : manualEntry
        ? "manual"
        : baseDictionary
        ? "base-preference"
        : dictionaryToUse?.source || "auto";
      logDebug("Dictionary to use", { id: dictionaryToUse?.id || null, label: dictionaryToUse?.label || null });
      const retentionPlan = buildColumnRetentionPlan(summary.columns || [], dictionaryToUse, manualInterpretation);
      const sliced = dataset.slice(0, MAX_ELEVES).map((entry) => cleanEntry(entry, retentionPlan));
      logDebug("Dataset trimmed", {
        originalCount: dataset.length,
        sentCount: sliced.length,
        columns: summary.columns,
      });
      currentContext = {
        ...(summary.meta || {}),
        className:
          storedContext.classe ||
          (summary.meta && summary.meta.className) ||
          (summary.classes && summary.classes[0] && summary.classes[0].name) ||
          "",
        activityName: storedContext.activite || (summary.meta && summary.meta.activityName) || "",
        sessionName: storedContext.seance || (summary.meta && summary.meta.sessionName) || "",
        providerLabel,
        intent,
        storedContext,
        sessionMeta,
        totalEntries: dataset.length,
        usedEntries: sliced.length,
        studentCount: dataset.length,
        sessionDate: storedContext?.date || null,
        updatedAt:
          (summary.meta && (summary.meta.updatedAt || summary.meta.savedAt)) || new Date().toISOString(),
        dictionaryInfo: null,
        preAnalysis: null,
        cycleAnalysis: null,
        isCycle: false,
        cycleSessionCount: 0,
        baseReading: getBaseReadingSnapshot(),
        analysisMode: selectedAnalysisMode,
      };
      if (dictionaryToUse) {
        currentContext.dictionaryInfo = {
          id: dictionaryToUse.id,
          label: dictionaryToUse.label || dictionaryToUse.id || "Activité",
          source: dictionarySource || "default",
          manualDictionaryId: manualEntry?.dictionaryId || null,
          manualLabel: manualEntry?.dictionary?.label || manualEntry?.label || null,
          autoDictionaryId: autoDictionary?.id || null,
          autoLabel: autoDictionary?.label || null,
          forcedDictionaryId: forcedDictionaryId || null,
          forcedLabel: forcedDictionary?.label || null,
        };
      }
      const interpretationEngine = window.ScanProfAIInterpretationEngine;
      const preAnalysis = interpretationEngine
        ? interpretationEngine.analyze({
            dataset: sliced,
            columns: summary.columns || [],
            dictionary: dictionaryToUse,
            manualText: manualInterpretation,
            summary,
          })
        : null;
      logDebug("Pre-analysis completed", {
        hasEngine: !!interpretationEngine,
        coverage: preAnalysis?.coverage || null,
        unknownCodes: preAnalysis?.unknown_codes?.length || 0,
      });
      currentContext.preAnalysis = preAnalysis;
      const analyticsEngine = window.ScanProfClassAnalytics;
      const classAnalytics = analyticsEngine
        ? analyticsEngine.analyze({
            dataset: sliced,
            dictionary: dictionaryToUse,
            summary,
            manualText: manualInterpretation,
          })
        : null;
      logDebug("Class analytics completed", {
        hasEngine: !!analyticsEngine,
        hasAnalytics: !!classAnalytics,
        measures: Object.keys(classAnalytics?.measures || {}),
      });
      currentContext.classAnalytics = classAnalytics;
      if (preAnalysis?.coverage && currentContext.dictionaryInfo) {
        currentContext.dictionaryInfo.coverage = preAnalysis.coverage;
      }
      refreshDictionaryHint(
        currentContext.activityName || storedContext.activite || "",
        preAnalysis?.coverage,
        currentContext.dictionaryInfo
      );
      updateDictionaryAlert(dictionaryToUse ? preAnalysis?.coverage : null);
      const interpretationSupport = buildInterpretationSupport({
        columns: summary.columns || [],
        activityName: currentContext.activityName || "",
        manualText: manualInterpretation,
        dictionary: dictionaryToUse,
      });
      lastQuestionText = intent === "question" ? (questionText || "").trim() : "";
      const studentProfiles = classAnalytics?.student_profiles || null;
      const studentProfileSentences = classAnalytics?.student_profile_sentences || null;
      const sessionSources = collectSessionSources() || [];
      const cycleSessions = collectCycleSessions() || [];
      const sessionBundle = buildSessionBundle(sessionSources, {
        sessionMeta: {
          class_name: currentContext.className || "",
          session_name: currentContext.sessionName || "",
          activity_label: currentContext.activityName || "",
          date: currentContext.sessionDate || storedContext?.date || new Date().toISOString(),
        },
        summary,
        manualText: manualInterpretation,
        baseDictionary: dictionaryToUse,
        interpretationEngine,
        analyticsEngine,
      });
      const cycleBundle = buildCycleBundle(cycleSessions, {
        sessionMeta,
        baseDictionary: dictionaryToUse,
        forcedDictionaryId,
        forcedDictionary,
        manualText: manualInterpretation,
        summary,
        interpretationEngine,
        analyticsEngine,
      });
      const cycleDiagnostics = getCycleDiagnostics();
      console.info("[ScanProf IA] cycle diagnostics", {
        totalSessions: cycleDiagnostics.totalCandidates || 0,
        retainedSessions: cycleDiagnostics.retained || 0,
      });
      updateModeIndicators({
        cycleBundle,
        sessionBundle,
        cycleCandidateCount: cycleDiagnostics.totalCandidates || 0,
        cycleRetainedCount: cycleDiagnostics.retained || 0,
        cycleDiagnostics,
      });
      const retainedCycleSessions = cycleBundle?.sessions?.length || 0;
      currentContext.cycleSessionCount = retainedCycleSessions;
      if (cycleBundle?.merged_cycle_analysis && retainedCycleSessions >= CYCLE_MIN_SESSIONS_FOR_FALLBACK) {
        currentContext.isCycle = true;
        currentContext.cycleAnalysis = cycleBundle.merged_cycle_analysis;
      } else {
        currentContext.isCycle = false;
        currentContext.cycleAnalysis = cycleBundle?.merged_cycle_analysis || null;
      }
      if (cycleBundle) {
        console.info(`${CYCLE_DEBUG_PREFIX} Cycle bundle ready`, cycleBundle);
      } else {
        console.info(`${CYCLE_DEBUG_PREFIX} Cycle bundle not created.`);
      }
      const analysisInput = {
        contexte: buildContext(
          summary,
          notes,
          dataset.length,
          sliced.length,
          providerKey,
          intent,
          lastQuestionText,
          storedContext,
          interpretationSupport,
          preAnalysis,
          classAnalytics,
          studentProfiles,
          studentProfileSentences
        ),
        eleves: sliced,
        intent,
        questionText: lastQuestionText,
        interpretation: interpretationSupport,
        pre_analysis: preAnalysis,
        summary_sentences: classAnalytics?.summary_sentences || null,
        student_profiles: studentProfiles,
        student_profile_sentences: studentProfileSentences,
        student_analysis: classAnalytics?.student_analysis || null,
        class_analytics: classAnalytics,
        session_bundle: sessionBundle,
        cycle_bundle: cycleBundle,
        analysis_mode: selectedAnalysisMode,
        base_reading: currentContext.baseReading,
      };
      console.info("[ScanProf IA] cycle_bundle present", analysisInput.cycle_bundle);
      console.info("[ScanProf IA] session_bundle present", analysisInput.session_bundle);
      const builder = window.ScanProfAIPrompt;
      if (!builder || typeof builder.buildPrompt !== "function") {
        throw new Error("Module de prompt introuvable.");
      }
      const { messages, schema } = builder.buildPrompt({ analysisInput, mode: intent, analysisMode: selectedAnalysisMode });
      logDebug("Prompt built", {
        intent,
        schemaKeys: schema.map((section) => section.key),
        messageCount: messages.length,
      });
      logDebug("Prompt schema keys", schema.map((section) => section.key));
      logPromptDiagnostics(messages, sliced, summary.columns || []);
      const model = getSelectedModel();
      const processed = await generateAIResponseWithRetry({
        providerKey,
        apiKey,
        model,
        messages,
        schema,
        options: {
          temperature: intent === "difficulte" ? 0.15 : 0.25,
          max_tokens: 900,
          intent,
        },
      });
      renderReport(schema, processed);
      setStatus(statusTarget, "Analyse terminée 🎉", "success");
      setModalLoading(false);
      setPanelBusy(false);
    } catch (err) {
      const userMessage = err?.userMessage || err?.message || "Analyse impossible pour le moment.";
      if (err?.logMessage) console.error(err.logMessage, err);
      else console.error(err);
      setStatus(statusTarget, userMessage, "error");
      renderFallbackError(userMessage);
      setModalLoading(false);
      setPanelBusy(false);
    }
  }

  function buildContext(
    summary,
    notes,
    totalEntries,
    usedEntries,
    providerKey,
    intent,
    questionText,
    storedContext,
    interpretationSupport,
    preAnalysis,
    classAnalytics,
    studentProfiles,
    studentProfileSentences
  ) {
    const meta = summary.meta || {};
    const bestClass = meta?.className || summary.classes?.[0]?.name || "";
    const info = {
      date_iso: new Date().toISOString(),
      nb_eleves_total: totalEntries,
      nb_eleves_transmis: usedEntries,
      colonnes: summary.columns || [],
      repartition_classes: summary.classes || [],
      classe: storedContext?.classe || bestClass,
      activite: storedContext?.activite || meta?.activityName || "",
      seance: storedContext?.seance || meta?.sessionName || "",
      notes_enseignant: notes || "",
      contexte_supplementaire: storedContext || {},
    };
    if (meta?.updatedAt) info.session_mise_a_jour = meta.updatedAt;
    if (storedContext?.date) info.date_seance = storedContext.date;
    const providerLabel = PROVIDERS[providerKey]?.label;
    if (providerLabel) info.fournisseur = providerLabel;
    if (intent) info.intent = intent;
    if (questionText) info.question_utilisateur = questionText;
    if (interpretationSupport?.guides?.length) info.aide_interpretation = interpretationSupport.guides;
    if (interpretationSupport?.dictionary) info.dictionnaire_activite = interpretationSupport.dictionary;
    if (interpretationSupport?.manual) info.indications_enseignant_interpretation = interpretationSupport.manual;
    if (preAnalysis) info.pre_analysis = preAnalysis;
    if (classAnalytics) info.class_analytics = classAnalytics;
    if (studentProfiles) info.student_profiles = studentProfiles;
    if (studentProfileSentences) info.student_profile_sentences = studentProfileSentences;
    if (totalEntries > usedEntries) {
      info.tronque = `Seuls ${usedEntries} élèves sur ${totalEntries} ont été envoyés pour limiter la taille du prompt.`;
    }
    const modeDemande = currentContext?.analysisMode || selectedAnalysisMode;
    info.mode_demande = modeDemande;
    info.base_lecture = currentContext?.baseReading || getBaseReadingSnapshot();
    return info;
  }

  async function generateAIResponseWithRetry({ providerKey, apiKey, model, messages, schema, options = {} }) {
    let attempt = 0;
    let currentMessages = messages;
    while (attempt < 2) {
      try {
        logDebug("AI call attempt", { attempt: attempt + 1, provider: providerKey, model });
        const responseText = await callProvider(providerKey, apiKey, model, currentMessages, options);
        logDebug("AI raw response", { attempt: attempt + 1, length: responseText?.length || 0, preview: (responseText || "").slice(0, 500) });
        const processed = processAIResponse(schema, responseText);
        logDebug("AI processed response", { attempt: attempt + 1, type: processed.type });
        return processed;
      } catch (err) {
        if (isIncompleteResponseError(err) && attempt === 0) {
          logDebug("Incomplete response detected, retrying with shorter prompt", { details: err.details });
          attempt += 1;
          currentMessages = shortenMessagesForRetry(messages);
          continue;
        }
        logDebug("AI call failed", { attempt: attempt + 1, error: err });
        throw err;
      }
    }
    throw createIncompleteResponseError();
  }

  function shortenMessagesForRetry(messages = []) {
    return messages.map((msg) => {
      if (msg.role !== "user") return msg;
      return {
        ...msg,
        content: condenseUserMessageForRetry(msg.content || ""),
      };
    });
  }

  function condenseUserMessageForRetry(content = "") {
    const hint =
      "Consigne courte : réponds uniquement avec le JSON demandé, phrases ≤ 8 mots, listes limitées à 2 éléments.";
    const block = extractJsonBlock(content);
    if (!block) return `${content}\n\n${hint}`;
    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(block.jsonText);
    } catch {
      /* ignore parsing error, we’ll fall back to hint */
    }
    if (!parsedPayload || typeof parsedPayload !== "object") {
      return `${content}\n\n${hint}`;
    }
    if (Array.isArray(parsedPayload.donnees_eleves) && parsedPayload.donnees_eleves.length > 35) {
      parsedPayload.donnees_eleves = parsedPayload.donnees_eleves.slice(0, 35);
    }
    if (parsedPayload.contexte) {
      const ctx = parsedPayload.contexte;
      if (Array.isArray(ctx.aide_interpretation)) {
        ctx.aide_interpretation = ctx.aide_interpretation.slice(0, 3);
      }
      if (ctx.pre_analysis?.known_facts?.length > 5) {
        ctx.pre_analysis.known_facts = ctx.pre_analysis.known_facts.slice(0, 5);
      }
      if (ctx.pre_analysis?.pedagogical_signals?.length > 3) {
        ctx.pre_analysis.pedagogical_signals = ctx.pre_analysis.pedagogical_signals.slice(0, 3);
      }
      if (ctx.class_analytics) {
        ctx.class_analytics = slimClassAnalyticsPayload(ctx.class_analytics);
      }
    }
    if (parsedPayload.summary_sentences) {
      parsedPayload.summary_sentences = slimSummarySentences(parsedPayload.summary_sentences);
    }
    if (parsedPayload.student_profile_sentences) {
      parsedPayload.student_profile_sentences = slimProfileSentences(parsedPayload.student_profile_sentences);
    }
    if (parsedPayload.student_profiles) {
      parsedPayload.student_profiles = slimStudentProfiles(parsedPayload.student_profiles);
    }
    const slimJson = JSON.stringify(parsedPayload);
    return `${hint}\n${block.prefix}${slimJson}\n${block.suffix}\n\n(Version condensée pour relancer.)`;
  }

  function slimClassAnalyticsPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const clone = { ...payload };
    if (clone.class_overview) {
      clone.class_overview = { ...clone.class_overview };
      if (Array.isArray(clone.class_overview.highlights) && clone.class_overview.highlights.length > 3) {
        clone.class_overview.highlights = clone.class_overview.highlights.slice(0, 3);
      }
      if (Array.isArray(clone.class_overview.summary) && clone.class_overview.summary.length > 6) {
        clone.class_overview.summary = clone.class_overview.summary.slice(0, 6);
      }
    }
    if (clone.data_quality?.issues?.length > 4) {
      clone.data_quality = { ...clone.data_quality, issues: clone.data_quality.issues.slice(0, 4) };
    }
    if (clone.distributions && typeof clone.distributions === "object") {
      const trimmed = {};
      Object.entries(clone.distributions).forEach(([key, dist]) => {
        if (!dist || typeof dist !== "object") return;
        trimmed[key] = {
          ...dist,
          buckets: Array.isArray(dist.buckets) ? dist.buckets.slice(0, 4) : dist.buckets,
        };
      });
      clone.distributions = trimmed;
    }
    ["comparisons", "student_groups", "pedagogical_signals", "limits"].forEach((field) => {
      if (Array.isArray(clone[field]) && clone[field].length > 4) {
        clone[field] = clone[field].slice(0, 4);
      }
    });
    if (clone.student_profiles) {
      clone.student_profiles = slimStudentProfiles(clone.student_profiles);
    }
    if (clone.student_profile_sentences) {
      clone.student_profile_sentences = slimProfileSentences(clone.student_profile_sentences);
    }
    return clone;
  }

  function slimSummarySentences(summary = {}) {
    const keys = ["overview", "strengths", "needs_work", "next_steps"];
    const trimmed = {};
    keys.forEach((key) => {
      if (Array.isArray(summary[key])) {
        trimmed[key] = summary[key].slice(0, 4);
      }
    });
    return trimmed;
  }

  function slimStudentProfiles(profiles = {}) {
    const trimmed = {};
    STUDENT_PROFILE_CATEGORIES.forEach((key) => {
      if (Array.isArray(profiles[key])) {
        trimmed[key] = profiles[key].slice(0, 3);
      }
    });
    return trimmed;
  }

  function slimProfileSentences(sentences = {}) {
    const trimmed = {};
    STUDENT_PROFILE_CATEGORIES.forEach((key) => {
      if (Array.isArray(sentences[key])) {
        trimmed[key] = sentences[key].slice(0, 4);
      }
    });
    return trimmed;
  }

  function extractJsonBlock(content = "") {
    const regex = /```json([\s\S]*?)```/i;
    const match = regex.exec(content);
    if (!match) return null;
    const start = match.index || 0;
    const prefix = `${content.slice(0, start)}\`\`\`json\n`;
    const closingStart = start + match[0].length - 3;
    const suffix = content.slice(closingStart);
    return {
      jsonText: match[1].trim(),
      prefix,
      suffix,
    };
  }

  function processAIResponse(schema, rawText) {
    const cleaned = stripCodeFences(rawText);
    if (!cleaned) {
      logDebug("processAIResponse: empty response detected");
      throw createIncompleteResponseError("Réponse IA vide, merci de relancer l’analyse.", "empty_string");
    }
    const trimmed = cleaned.trim();
    if (!trimmed) {
      logDebug("processAIResponse: whitespace-only response");
      throw createIncompleteResponseError("Réponse IA vide, merci de relancer l’analyse.", "whitespace_only");
    }
    const structured = parseJsonWithTolerance(trimmed);
    if (structured?.data) {
      const normalized = ensureSchemaDefaults(schema, structured.data);
      logDebug("processAIResponse: parsed structured JSON", { strategy: structured.strategy, keys: Object.keys(normalized) });
      return { type: "structured", data: normalized, raw: trimmed };
    }
    if (looksLikeJson(trimmed)) {
      const partial = buildPartialStructuredData(schema, trimmed);
      if (partial) {
        logDebug("processAIResponse: partial JSON extracted", { keys: Object.keys(partial) });
        return { type: "structured", data: partial, raw: trimmed };
      }
    }
    const cleanedText = stripJsonArtifacts(trimmed);
    logDebug("processAIResponse: fallback to text", { reason: structured?.error || "unstructured_text" });
    return { type: "text", text: cleanedText, raw: trimmed };
  }

  function createIncompleteResponseError(message, details) {
    const err = new Error(message || "Réponse IA incomplète, merci de relancer l’analyse.");
    err.code = INCOMPLETE_RESPONSE_ERROR;
    err.userMessage = err.message;
    if (details) err.details = details;
    logDebug("createIncompleteResponseError", { message: err.message, details });
    return err;
  }

  function isIncompleteResponseError(err) {
    return err && err.code === INCOMPLETE_RESPONSE_ERROR;
  }

  function stripCodeFences(text = "") {
    let trimmed = String(text == null ? "" : text).trim();
    const fenceMatch = trimmed.match(/^```(?:json)?([\s\S]*?)```$/i);
    if (fenceMatch) return fenceMatch[1].trim();
    if (trimmed.startsWith("```")) {
      trimmed = trimmed.replace(/^```(?:json)?/i, "").trim();
    }
    if (trimmed.endsWith("```")) {
      trimmed = trimmed.replace(/```$/, "").trim();
    }
    return trimmed;
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function looksLikeJson(text = "") {
    const trimmed = String(text || "").trim();
    if (!trimmed) return false;
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true;
    return /"[a-z0-9_\- ]+"\s*:/.test(trimmed);
  }

  function parseJsonWithTolerance(text = "") {
    const attempts = [];
    const direct = tryParseJson(text);
    if (direct && typeof direct === "object") return { data: direct, strategy: "direct" };
    attempts.push("direct");
    const extracted = extractJSONObject(text);
    if (extracted) {
      const parsed = tryParseJson(extracted);
      if (parsed && typeof parsed === "object") return { data: parsed, strategy: "extracted" };
      attempts.push("extracted");
    }
    const trimmedSnippet = trimJsonEnvelope(text);
    if (trimmedSnippet && trimmedSnippet !== text) {
      const parsed = tryParseJson(trimmedSnippet);
      if (parsed && typeof parsed === "object") return { data: parsed, strategy: "trimmed_envelope" };
      attempts.push("trimmed_envelope");
    }
    const repaired = repairLooseJson(text);
    if (repaired && repaired !== text) {
      const parsed = tryParseJson(repaired);
      if (parsed && typeof parsed === "object") return { data: parsed, strategy: "repaired_commas" };
      attempts.push("repaired_commas");
    }
    return { error: "json_parse_failed", attempts };
  }

  function extractJSONObject(text = "") {
    const str = String(text || "");
    let start = -1;
    const stack = [];
    let inString = false;
    let escapeNext = false;
    for (let i = 0; i < str.length; i += 1) {
      const char = str[i];
      if (inString) {
        if (escapeNext) {
          escapeNext = false;
        } else if (char === "\\") {
          escapeNext = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{" || char === "[") {
        if (start === -1) start = i;
        stack.push(char === "{" ? "}" : "]");
        continue;
      }
      if (char === "}" || char === "]") {
        if (!stack.length) return null;
        const expected = stack.pop();
        if (char !== expected) return null;
        if (!stack.length && start !== -1) {
          return str.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  function trimJsonEnvelope(text = "") {
    const str = String(text || "");
    const braceStart = str.indexOf("{");
    const braceEnd = str.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      return str.slice(braceStart, braceEnd + 1);
    }
    const bracketStart = str.indexOf("[");
    const bracketEnd = str.lastIndexOf("]");
    if (bracketStart !== -1 && bracketEnd > bracketStart) {
      return str.slice(bracketStart, bracketEnd + 1);
    }
    return "";
  }

  function repairLooseJson(text = "") {
    const trimmed = String(text || "").trim();
    if (!trimmed) return "";
    const fixedTrailingCommas = trimmed.replace(/,\s*(\}|\])/g, "$1");
    if (fixedTrailingCommas !== trimmed) return fixedTrailingCommas;
    return "";
  }

  function ensureSchemaDefaults(schema, payload) {
    const safeData = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
    const list = Array.isArray(schema) && schema.length ? schema : window.ScanProfAIPrompt.SECTION_SCHEMA || [];
    list.forEach((section) => {
      if (!(section.key in safeData) || safeData[section.key] == null) {
        safeData[section.key] = section.type === "list" ? [] : EMPTY_SECTION_TEXT;
        return;
      }
      if (section.type === "list") {
        safeData[section.key] = normalizeListValue(safeData[section.key]);
      } else if (typeof safeData[section.key] !== "string") {
        const normalized = valueToPlainText(safeData[section.key]);
        safeData[section.key] = normalized || EMPTY_SECTION_TEXT;
      }
    });
    return safeData;
  }

  function normalizeListValue(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => (typeof entry === "string" ? entry : valueToPlainText(entry))).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/\n+|;/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (value == null) return [];
    const fallback = valueToPlainText(value);
    return fallback ? [fallback] : [];
  }

  function buildPartialStructuredData(schema = [], text = "") {
    if (!schema || !schema.length || !text) return null;
    const matches = [...String(text).matchAll(/"([^"]+)"\s*:\s*"([^"]*)/g)];
    if (!matches.length) return null;
    const draft = {};
    matches.forEach(([, key, value]) => {
      if (!key) return;
      draft[key.trim()] = value != null ? value.trim() : "";
    });
    const hasKnownKeys = schema.some((section) => section.key in draft);
    if (!hasKnownKeys) return null;
    return ensureSchemaDefaults(schema, draft);
  }

  function stripJsonArtifacts(text = "") {
    const str = String(text == null ? "" : text);
    if (!str) return "";
    return str
      .replace(/^{+|}+$/g, "")
      .replace(/\\"/g, '"')
      .replace(/"(.*?)"\s*:\s*/g, (_, key) => `${key}: `)
      .replace(/[{[\]}]/g, "")
      .trim();
  }

  function renderReport(schema, processed) {
    if (!processed) {
      renderPlainTextFallback("Réponse IA indisponible.");
      return;
    }
    if (processed.type === "structured") {
      logDebug("Rendering structured report");
      renderStructuredReport(schema, processed.data);
    } else {
      logDebug("Rendering text fallback");
      renderPlainTextFallback(processed.text || "");
    }
  }

  function renderStructuredReport(schema, data) {
    const container = refs.modalContent;
    if (!container) return;
    const list = Array.isArray(schema) && schema.length ? schema : window.ScanProfAIPrompt.SECTION_SCHEMA || [];
    debugSchemaConsistency(schema);
    const localOverrides = buildLocalSectionOverrides();
    let entries = list.map((section) => {
      const localValue = localOverrides[section.key];
      const llmValue = data ? data[section.key] : null;
      const value = resolveSectionValue(section, localValue, llmValue);
      return {
        key: section.key,
        label: section.label,
        type: section.type || "text",
        value,
      };
    });
    entries = applyCycleUltimateFallback(entries);
    const entriesWithContent = entries.map((entry) => ({
      ...entry,
      content: valueToPlainText(entry.value) || EMPTY_SECTION_TEXT,
    }));
    const filteredEntries = entriesWithContent.filter((entry) => {
      if (entry.key === STUDENT_PROFILE_SECTION_KEY) {
        return Array.isArray(entry.value) && entry.value.length > 0;
      }
      return true;
    });
    const displayEntries = addQuestionSection(filteredEntries);
    container.innerHTML = displayEntries.map((entry) => renderSection(entry.label, entry.value)).join("");
    updateReportState(displayEntries.map(({ label, content }) => ({ label, content })));
  }

  function renderPlainTextFallback(text) {
    if (!refs.modalContent) return;
    logDebug("Rendering plain text fallback");
    const content = (text && text.trim()) || "Aucun résultat exploitable.";
    const sections = addQuestionSection([{ label: "Bilan textuel", value: content, content }]);
    refs.modalContent.innerHTML = sections.map((entry) => renderSection(entry.label, entry.value)).join("");
    updateReportState(sections.map(({ label, content: value }) => ({ label, content: value })));
  }

  function renderSection(label, value) {
    const safeLabel = escapeHtml(label);
    const content = formatValueAsHtml(value, label);
    const icon = SECTION_ICONS[label] || "📌";
    return `<article class="ai-modal__section"><div class="ai-modal__section-header"><span class="ai-result-icon">${icon}</span><h3>${safeLabel}</h3></div>${content}</article>`;
  }

  function formatValueAsHtml(value, label = "") {
    if (!value && value !== 0) {
      return `<p>${EMPTY_SECTION_TEXT}</p>`;
    }
    if (Array.isArray(value)) {
      if (!value.length) return `<p>${EMPTY_SECTION_TEXT}</p>`;
      if (label === "Repérages élèves") {
        return renderStudentHighlightCards(value);
      }
      const items = value
        .map((entry) => `<li>${escapeHtml(typeof entry === "string" ? entry : JSON.stringify(entry))}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }
    if (typeof value === "object") {
      const entries = Object.entries(value)
        .map(([key, val]) => `<li><strong>${escapeHtml(key)} :</strong> ${escapeHtml(valueToPlainText(val))}</li>`)
        .join("");
      return `<ul>${entries}</ul>`;
    }
    const str = String(value);
    return `<p>${escapeHtml(str).replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>")}</p>`;
  }

  function renderStudentHighlightCards(entries = []) {
    const groups = {};
    entries.forEach((rawEntry) => {
      const text = typeof rawEntry === "string" ? rawEntry : valueToPlainText(rawEntry);
      if (!text) return;
      const separatorIndex = text.indexOf(":");
      if (separatorIndex === -1) {
        groups.Autres = groups.Autres || [];
        groups.Autres.push(text.trim());
        return;
      }
      const label = text.slice(0, separatorIndex).trim() || "Repérage";
      const content = text.slice(separatorIndex + 1).trim() || "";
      if (!groups[label]) groups[label] = [];
      groups[label].push(content || text);
    });
    const cards = Object.entries(groups).map(([category, items]) => {
      const bulletItems = items
        .slice(0, 4)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return `<div class="ai-reperage-card"><strong>${escapeHtml(category)}</strong><ul>${bulletItems}</ul></div>`;
    });
    return `<div class="ai-reperage-grid">${cards.join("")}</div>`;
  }

  function buildLocalSectionOverrides() {
    const overrides = {};
    const summary = currentContext?.classAnalytics?.summary_sentences;
    if (summary) {
      Object.entries(SUMMARY_SECTION_MAP).forEach(([sectionKey, config]) => {
        const sentences = summary[config.source];
        if (!Array.isArray(sentences) || !sentences.length) return;
        const subset = sentences.slice(0, config.limit || (config.type === "text" ? 3 : 3));
        if (!subset.length) return;
        overrides[sectionKey] = config.type === "text" ? subset.join(" ") : subset;
      });
    }
    const studentProfileSentences = currentContext?.classAnalytics?.student_profile_sentences;
    const studentRankings = currentContext?.classAnalytics?.student_rankings;
    if (studentProfileSentences || studentRankings) {
      const lines = buildStudentProfileLines(studentProfileSentences, studentRankings);
      if (lines.length) {
        overrides[STUDENT_PROFILE_SECTION_KEY] = lines;
      }
    }
    if (currentContext?.isCycle && currentContext.cycleAnalysis) {
      const cycleOverrides = buildCycleAnalysisOverrides(currentContext.cycleAnalysis);
      Object.assign(overrides, cycleOverrides);
    }
    return overrides;
  }

  function buildStudentProfileLines(sentences = {}, rankings = null, limitPerCategory = 3) {
    const lines = [];
    const sentenceSource = sentences && typeof sentences === "object" ? sentences : {};
    const categories = [...STUDENT_PROFILE_CATEGORIES, "progressing", "stalled"];
    categories.forEach((key) => {
      const entries = sentenceSource[key];
      if (!Array.isArray(entries) || !entries.length) return;
      const label =
        STUDENT_PROFILE_CATEGORY_LABELS[key] ||
        CYCLE_PROFILE_CATEGORY_LABELS[key] ||
        (key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
      entries.slice(0, limitPerCategory).forEach((text) => {
        const clean = String(text || "").trim();
        if (!clean) return;
        lines.push(`${label} : ${clean}`);
      });
    });
    if (rankings && typeof rankings === "object") {
      STUDENT_RANKING_KEYS.forEach((key) => {
        const entries = rankings[key];
        if (!Array.isArray(entries) || !entries.length) return;
        const label = STUDENT_RANKING_LABELS[key] || key;
        entries.slice(0, limitPerCategory).forEach((entry) => {
          if (!entry || !entry.student) return;
          const reason = entry.reason ? ` — ${entry.reason}` : "";
          lines.push(`${label} : ${entry.student}${reason}`);
        });
      });
    }
    return lines.slice(0, 9);
  }

  function takeNonEmptyStrings(list = [], limit = 3) {
    const entries = Array.isArray(list) ? list : [];
    const seen = new Set();
    const result = [];
    entries.forEach((item) => {
      const text = typeof item === "string" ? item.trim() : "";
      if (!text) return;
      if (seen.has(text)) return;
      seen.add(text);
      result.push(text);
    });
    return result.slice(0, limit);
  }

  function buildCycleAnalysisOverrides(analysis = {}) {
    const overrides = {};
    const overviewLines = takeNonEmptyStrings(analysis.overview, 3);
    if (overviewLines.length) {
      overrides.synthese = overviewLines.join(" ");
    }
    const strengths = takeNonEmptyStrings(analysis.progressions, 3);
    if (strengths.length) {
      overrides.points_forts = strengths;
    }
    const needs = takeNonEmptyStrings(
      [...(analysis.regressions || []), ...(analysis.stagnations || [])],
      3
    );
    if (needs.length) {
      overrides.points_a_retravailler = needs;
    }
    const nextSteps = takeNonEmptyStrings(analysis.next_steps, 3);
    if (nextSteps.length) {
      overrides.suite_proposee = nextSteps;
    }
    const profileLines = buildStudentProfileLines(
      analysis.student_profile_sentences,
      analysis.student_rankings
    );
    if (profileLines.length) {
      overrides.reperages_eleves = profileLines;
    }
    if (!overrides.synthese) {
      if (strengths.length) {
        overrides.synthese = strengths[0];
      } else if (needs.length) {
        overrides.synthese = needs[0];
      } else if (overviewLines.length) {
        overrides.synthese = overviewLines.join(" ");
      }
    }
    return overrides;
  }

  function applyCycleUltimateFallback(entries = []) {
    if (!shouldApplyCycleFallback()) return entries;
    return entries.map((entry) => {
      if (!entry) return entry;
      if (entry.key === "points_forts" && !hasMeaningfulCycleList(entry.value)) {
        return { ...entry, value: CYCLE_ULTIMATE_FALLBACKS.points_forts.slice() };
      }
      if (entry.key === "suite_proposee" && !hasMeaningfulCycleList(entry.value)) {
        return { ...entry, value: CYCLE_ULTIMATE_FALLBACKS.suite_proposee.slice() };
      }
      return entry;
    });
  }

  function shouldApplyCycleFallback() {
    if (!currentContext || !currentContext.isCycle) return false;
    const sessionCount = currentContext.cycleSessionCount || 0;
    return sessionCount >= CYCLE_MIN_SESSIONS_FOR_FALLBACK;
  }

  function hasMeaningfulCycleList(value) {
    if (Array.isArray(value)) {
      return value.some((entry) => !isCycleEmptyToken(entry));
    }
    return !isCycleEmptyToken(value);
  }

  function isCycleEmptyToken(entry) {
    const normalized = normalizeCycleEmptyToken(entry);
    if (!normalized) return true;
    return (
      normalized === "aucune information disponible" ||
      normalized === "aucune information exploitable" ||
      normalized === "aucune donnée exploitable"
    );
  }

  function normalizeCycleEmptyToken(entry) {
    if (entry == null) return "";
    return String(entry)
      .trim()
      .replace(/[.!;:?]+$/g, "")
      .toLowerCase();
  }

  function resolveSectionValue(section, localValue, llmValue) {
    if (section.key === STUDENT_PROFILE_SECTION_KEY) {
      if (hasSectionContent(localValue, "list")) return localValue;
      if (hasSectionContent(llmValue, "list")) return llmValue;
      return [];
    }
    if (hasSectionContent(localValue, section.type)) return localValue;
    if (hasSectionContent(llmValue, section.type)) return llmValue;
    return section.type === "list" ? [] : EMPTY_SECTION_TEXT;
  }

  function hasSectionContent(value, type) {
    if (type === "list") return Array.isArray(value) && value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value == null) return false;
    const text = String(value).trim();
    if (!text) return false;
    if (text === EMPTY_SECTION_TEXT) return false;
    return true;
  }

  function valueToPlainText(value) {
    if (!value && value !== 0) return "";
    if (Array.isArray(value)) {
      const parts = value.map((v) => valueToPlainText(v)).filter(Boolean);
      if (!parts.length) return "";
      return parts.map((part) => `- ${part}`).join("\n");
    }
    if (typeof value === "object") return Object.entries(value).map(([k, v]) => `${k}: ${valueToPlainText(v)}`).join("; ");
    return String(value);
  }

  function renderFallbackError(message) {
    if (!refs.modalContent) return;
    logDebug("Rendering fallback error", { message });
    const text = message || "Analyse indisponible.";
    const sections = addQuestionSection([{ label: "Erreur", value: text, content: text }]);
    refs.modalContent.innerHTML = sections.map((entry) => renderSection(entry.label, entry.value)).join("");
    updateReportState(sections.map(({ label, content }) => ({ label, content })));
  }

  function addQuestionSection(sections = []) {
    const list = Array.isArray(sections) ? sections.map((section) => ({ ...section })) : [];
    if (
      lastIntent === "question" &&
      lastQuestionText &&
      !list.some((entry) => entry && entry.label === "Question posée")
    ) {
      logDebug("Injecting question section");
      list.unshift({ label: "Question posée", value: lastQuestionText, content: lastQuestionText });
    }
    return list;
  }

  function updateReportState(sections = []) {
    revealModalContent();
    renderModalContext();
    refs.modalTitle.textContent = intentTitle(lastIntent);
    refs.modalSubtitle.textContent = buildModalSubtitle();
    lastReportSections = sections.map((section) => ({
      label: section.label,
      content: section.content || "",
    }));
    lastReportText = buildPlainTextFromSections(lastReportSections);
    logDebug("Report state updated", {
      sections: lastReportSections.map((section) => section.label),
      resultType: sections.length ? "structured" : "empty",
    });
  }

  function revealModalContent() {
    refs.modalContent?.classList.remove("sp-hidden");
    refs.modalLoading?.classList.add("sp-hidden");
  }

  function renderModalContext() {
    if (!refs.modalContext) return;
    const meta = currentContext || {};
    const lines = [];
    const headerParts = [meta.className, meta.activityName, meta.sessionName].filter(Boolean);
    if (headerParts.length) {
      lines.push(`<div class="ai-context__line">🏫 ${escapeHtml(headerParts.join(" • "))}</div>`);
    }
    if (meta.studentLabel) {
      const studentLabel = meta.studentClasse
        ? `${meta.studentLabel} (${meta.studentClasse})`
        : meta.studentLabel;
      lines.push(`<div class="ai-context__line">👤 ${escapeHtml(studentLabel)}</div>`);
    }
    const count = meta.usedEntries || meta.totalEntries || meta.studentCount;
    if (count) {
      lines.push(`<div class="ai-context__line">👥 ${count} élève(s) analysé(s)</div>`);
    }
    const dateSource = meta.updatedAt || meta.sessionDate || meta.date || meta.date_iso;
    if (dateSource) {
      const date = new Date(dateSource);
      lines.push(`<div class="ai-context__line">🕒 ${escapeHtml(date.toLocaleString())}</div>`);
    }
    if (meta.dictionaryInfo?.label) {
      const sourceLabel =
        meta.dictionaryInfo.manualDictionaryId && meta.dictionaryInfo.manualLabel
          ? "manuel"
          : meta.dictionaryInfo.source === "custom"
          ? "par défaut"
          : "auto";
      lines.push(
        `<div class="ai-context__line">📘 Référentiel : ${escapeHtml(meta.dictionaryInfo.label)} (${sourceLabel})</div>`
      );
      if (meta.dictionaryInfo.manualDictionaryId && meta.dictionaryInfo.autoLabel && meta.dictionaryInfo.autoLabel !== meta.dictionaryInfo.manualLabel) {
        lines.push(
          `<div class="ai-context__line">🧭 Détection automatique : ${escapeHtml(meta.dictionaryInfo.autoLabel)}</div>`
        );
      }
      const coverage = meta.dictionaryInfo.coverage;
      if (coverage) {
        const unknownCount = coverage.unknown?.length || 0;
        const partialNote = unknownCount > 0 ? `${unknownCount} code(s) à documenter` : "Référentiel complet";
        lines.push(`<div class="ai-context__line">📊 ${partialNote}</div>`);
      }
    }
    if (!lines.length) {
      logDebug("Modal context hidden (no lines)");
      refs.modalContext.classList.add("sp-hidden");
      refs.modalContext.innerHTML = "";
      return;
    }
    refs.modalContext.innerHTML = lines.join("");
    refs.modalContext.classList.remove("sp-hidden");
    logDebug("Modal context", { lines: lines.map((line) => line.replace(/<[^>]+>/g, "")) });
  }

  function buildPlainTextFromSections(sections = []) {
    if (!sections.length) return "";
    return sections
      .map((section) => {
        const label = section.label || "";
        const content = section.content && section.content.trim ? section.content.trim() : section.content || "";
        const body = content || "Aucune information disponible.";
        return `${label}\n${"-".repeat(label.length || 3)}\n${body}`;
      })
      .join("\n\n");
  }

  async function copyReport() {
    if (!lastReportText) {
      setStatus(refs.runStatus, "Aucun bilan à copier pour le moment.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(lastReportText);
      setStatus(refs.runStatus, "Bilan copié dans le presse-papier.", "success");
    } catch {
      setStatus(refs.runStatus, "Impossible de copier automatiquement ce texte.", "error");
    }
  }

  function downloadReport() {
    if (!lastReportText) {
      setStatus(refs.runStatus, "Aucun bilan à télécharger.", "error");
      return;
    }
    const meta = currentContext || {};
    const baseName = meta.className ? slug(`bilan-ia-${meta.className}`) : "bilan-seance";
    const dateStr = formatDateForFilename(meta.updatedAt || new Date().toISOString());
    const intentSlug = slug(lastIntent || "bilan");
    const blob = new Blob([lastReportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}-${intentSlug}-${dateStr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function openModal() {
    refs.modal?.classList.remove("sp-hidden");
    refs.modalContent?.classList.add("sp-hidden");
    refs.modalLoading?.classList.remove("sp-hidden");
    if (refs.modalContext) {
      refs.modalContext.classList.add("sp-hidden");
      refs.modalContext.innerHTML = "";
    }
  }

  function closeModal() {
    refs.modal?.classList.add("sp-hidden");
  }

  function setModalLoading(isLoading) {
    if (isLoading) {
      refs.modalLoading?.classList.remove("sp-hidden");
      refs.modalContent?.classList.add("sp-hidden");
    } else {
      refs.modalLoading?.classList.add("sp-hidden");
      refs.modalContent?.classList.remove("sp-hidden");
    }
  }

  function setPanelBusy(isBusy) {
    if (!refs.drawerPanel) return;
    refs.drawerPanel.classList.toggle("ai-panel--busy", !!isBusy);
  }

  function toggleDrawer(open) {
    if (!refs.drawerBackdrop) return;
    if (open) {
      refs.drawerBackdrop.classList.remove("sp-hidden");
      if (refs.openBtn) refs.openBtn.blur();
    } else {
      refs.drawerBackdrop.classList.add("sp-hidden");
    }
  }

  function summarizeDataset() {
    const api = window.ScanProfParticipants;
    if (!api || typeof api.summarizeDataset !== "function") {
      const fallbackDataset = getDataset();
      return {
        total: fallbackDataset.length,
        columns: [],
        classes: [],
        meta: null,
      };
    }
    return api.summarizeDataset();
  }

  function updateSummaryUI() {
    if (!refs.summaryClass || !refs.summaryCount || !refs.summaryTypes) return;
    const summary = summarizeDataset();
    const storedContext = getStoredAIContext();
    const meta = summary.meta || {};
    const activityName = storedContext.activite || meta.activityName || "";
    refreshDictionaryHint(activityName);
    const prominentClass =
      storedContext.classe ||
      meta.className ||
      (summary.classes && summary.classes[0] && summary.classes[0].name) ||
      "Non renseignée";
    refs.summaryClass.textContent = prominentClass || "Non renseignée";
    refs.summaryCount.textContent = summary.total || 0;
    const inferredTypes = inferTypeLabels(summary.columns || []);
    refs.summaryTypes.textContent = inferredTypes.length ? inferredTypes.join(", ") : "Mesures standards";
    if (refs.openBtn) {
      const hasData = summary.total > 0;
      refs.openBtn.disabled = !hasData;
      refs.openBtn.title = hasData ? "" : "Ajoutez des élèves pour utiliser l’analyse IA";
    }
    if (refs.contextTexts?.session) {
      if (summary.total > 0) {
        const sessionLabel = storedContext.seance || meta.sessionName || "Séance en cours";
        const classLabel = prominentClass || "Classe";
        refs.contextTexts.session.textContent = `${classLabel} • ${summary.total} élève${
          summary.total > 1 ? "s" : ""
        } • ${sessionLabel}`;
      } else {
        refs.contextTexts.session.textContent = "Aucun élève chargé pour cette séance.";
      }
    }
    syncBasePreferenceWithContext();
    updateContextVisibility();
    refreshStudentOptions();
    updatePrimaryButtonState();
  }

  function refreshStudentOptions() {
    if (!refs.studentSelect) return;
    const dataset = getDataset();
    const options = buildStudentOptionList(dataset);
    const previousValue = refs.studentSelect.value || "";
    const hasPrevious = options.some((entry) => entry.key === previousValue);
    const selectedValue = hasPrevious ? previousValue : "";
    refs.studentSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length ? "Sélectionner un élève..." : "Aucun élève disponible";
    placeholder.disabled = true;
    if (!selectedValue) placeholder.selected = true;
    refs.studentSelect.appendChild(placeholder);
    options.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.key;
      option.textContent = entry.classe ? `${entry.label} — ${entry.classe}` : entry.label;
      if (entry.key === selectedValue) option.selected = true;
      refs.studentSelect.appendChild(option);
    });
    if (selectedValue) {
      refs.studentSelect.value = selectedValue;
    }
    const hasOptions = options.length > 0;
    refs.studentSelect.disabled = !hasOptions;
    if (refs.studentSessionBtn) refs.studentSessionBtn.disabled = !hasOptions;
    if (refs.studentCycleBtn) refs.studentCycleBtn.disabled = !hasOptions;
    if (!hasOptions) {
      studentDirectory = new Map();
      setStatus(refs.studentStatus, "Ajoutez des élèves pour lancer un bilan individuel.", "info");
      updatePrimaryButtonState();
      return;
    }
    setStatus(refs.studentStatus, "", "info");
    studentDirectory = new Map(options.map((entry) => [entry.key, entry]));
    updatePrimaryButtonState();
  }

  function buildStudentOptionList(entries = []) {
    const ledger = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const identity = buildStudentIdentityFromRow(entry, index);
      if (!identity || !identity.key) return;
      if (!ledger.has(identity.key)) {
        ledger.set(identity.key, identity);
      }
    });
    return Array.from(ledger.values()).sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
  }

  function buildStudentIdentityFromRow(entry = {}, index = 0) {
    const nom = safeStudentString(entry.nom || entry.Nom || entry.lastname || entry.last_name);
    const prenom = safeStudentString(entry.prenom || entry.Prénom || entry.firstname || entry.first_name);
    const classe = safeStudentString(entry.classe || entry.class || entry.groupe || entry.group);
    let key = "";
    if (!nom && !prenom) key = `__anon_${index}`;
    else key = `${nom.toLowerCase()}|${prenom.toLowerCase()}|${classe.toLowerCase()}`;
    const labelParts = [prenom, nom].filter(Boolean);
    const label = labelParts.length ? labelParts.join(" ") : classe ? `Élève ${classe}` : `Élève ${index + 1}`;
    return { key, label, prenom, nom, classe };
  }

  function safeStudentString(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function handleStudentAnalysis(scope = "session") {
    if (!refs.studentSelect) return;
    const studentKey = refs.studentSelect.value;
    if (!studentKey) {
      setStatus(refs.studentStatus, "Sélectionnez un élève avant de lancer le bilan.", "error");
      refs.studentSelect.focus();
      return;
    }
    const selected = studentDirectory.get(studentKey);
    const label = selected?.label || "Élève";
    setStatus(refs.studentStatus, `Analyse locale de ${label}...`, "info");
    lastIntent = scope === "cycle" ? "eleve_cycle" : "eleve_session";
    openModal();
    setModalLoading(true);
    setPanelBusy(true);
    try {
      const analysis =
        scope === "cycle" ? runStudentCycleAnalysis(studentKey) : runStudentSessionAnalysis(studentKey);
      if (!analysis) {
        throw new Error("Données insuffisantes pour cet élève.");
      }
      currentContext.studentLabel = analysis.student_label || label;
      currentContext.studentClasse = analysis.classe || selected?.classe || "";
      currentContext.student_analysis = analysis;
      renderStudentAnalysisReport(analysis, scope);
      setStatus(refs.studentStatus, "Bilan élève disponible dans l’aperçu.", "success");
    } catch (error) {
      const userMessage = error?.userMessage || error?.message || "Bilan élève impossible pour le moment.";
      renderFallbackError(userMessage);
      setStatus(refs.studentStatus, userMessage, "error");
    } finally {
      setModalLoading(false);
      setPanelBusy(false);
    }
  }

  function runStudentSessionAnalysis(studentKey) {
    const dataset = getDataset();
    if (!dataset.length) {
      throw new Error("Aucune donnée élève disponible pour cette séance.");
    }
    const summary = summarizeDataset();
    const storedContext = getStoredAIContext();
    const sessionMeta = getStoredSessionMeta();
    const manualInterpretation = refs.interpretationField?.value || localStorage.getItem(STORAGE.INTERPRETATION) || "";
    const { dictionary, forcedDictionary, forcedDictionaryId, manualEntry, autoDictionary, baseDictionary } =
      resolveDictionaryForStudentContext({
        storedContext,
        summary,
        sessionMeta,
      });
    const retentionPlan = buildColumnRetentionPlan(summary.columns || [], dictionary, manualInterpretation);
    const preparedDataset = dataset.map((entry) => cleanEntry(entry, retentionPlan));
    const analyticsEngine = window.ScanProfClassAnalytics;
    if (!analyticsEngine) {
      throw new Error("Moteur d’analyse locale indisponible.");
    }
    const analytics = analyticsEngine.analyze({
      dataset: preparedDataset,
      dictionary,
      summary,
      manualText: manualInterpretation,
      studentRequest: { key: studentKey, scope: "session" },
    });
    if (!analytics?.student_analysis) {
      throw new Error("Impossible de calculer un bilan fiable avec ces données.");
    }
    setCurrentStudentContext({
      storedContext,
      summary,
      dictionary,
      datasetSize: dataset.length,
      usedEntries: preparedDataset.length,
      scope: "session",
      dictionarySource: resolveDictionarySourceTag({
        forcedDictionary,
        manualEntry,
        baseApplied: Boolean(baseDictionary),
        autoDictionary,
        dictionary,
      }),
    });
    return analytics.student_analysis;
  }

  function runStudentCycleAnalysis(studentKey) {
    const cycleSessions = collectCycleSessions();
    if (!cycleSessions.length) {
      throw new Error("Aucun cycle enregistré pour cette activité.");
    }
    const sessionMeta = getStoredSessionMeta() || {};
    const storedContext = getStoredAIContext();
    const manualInterpretation = refs.interpretationField?.value || localStorage.getItem(STORAGE.INTERPRETATION) || "";
    const { dictionary, forcedDictionary, forcedDictionaryId, manualEntry, autoDictionary, baseDictionary } =
      resolveDictionaryForStudentContext({
        storedContext,
        summary: {},
        sessionMeta,
      });
    const analyticsEngine = window.ScanProfClassAnalytics;
    if (!analyticsEngine || typeof analyticsEngine.buildStudentCycleAnalysis !== "function") {
      throw new Error("Moteur d’analyse de cycle indisponible.");
    }
    const cycleBundle = buildCycleBundle(cycleSessions, {
      sessionMeta,
      baseDictionary: dictionary,
      forcedDictionaryId,
      forcedDictionary,
      manualText: manualInterpretation,
      summary: {},
      interpretationEngine: window.ScanProfAIInterpretationEngine || null,
      analyticsEngine,
    });
    if (!cycleBundle || !Array.isArray(cycleBundle.sessions) || cycleBundle.sessions.length < 2) {
      const diagnostics = getCycleDiagnostics();
      const retained = diagnostics.retained || 0;
      throw new Error(`Cycle incomplet (${retained} séance${retained > 1 ? "s" : ""} exploitable${retained > 1 ? "s" : ""}).`);
    }
    const studentAnalysis = analyticsEngine.buildStudentCycleAnalysis({
      sessions: cycleBundle.sessions,
      studentKey,
      dictionary,
    });
    if (!studentAnalysis) {
      throw new Error("Aucun signal exploitable pour cet élève sur le cycle.");
    }
    const totalEntries = cycleBundle.sessions.reduce(
      (sum, session) => sum + (Array.isArray(session.dataset) ? session.dataset.length : 0),
      0
    );
    setCurrentStudentContext({
      storedContext,
      summary: {},
      dictionary,
      datasetSize: totalEntries,
      usedEntries: totalEntries,
      scope: "cycle",
      cycleMeta: cycleBundle.cycle_meta || null,
      cycleSessionCount: cycleBundle.sessions.length,
      cycleAnalysis: cycleBundle.merged_cycle_analysis || null,
      dictionarySource: resolveDictionarySourceTag({
        forcedDictionary,
        manualEntry,
        baseApplied: Boolean(baseDictionary),
        autoDictionary,
        dictionary,
      }),
    });
    return studentAnalysis;
  }

  function resolveDictionaryForStudentContext({ storedContext = {}, summary = {}, sessionMeta = null }) {
    const forcedDictionaryId = sessionMeta?.forcedDictionaryId || null;
    const forcedDictionary = forcedDictionaryId ? getDictionaryByIdSafe(forcedDictionaryId) : null;
    const manualEntry = forcedDictionary ? null : getManualDictionaryEntry(storedContext);
    const manualDictionary = manualEntry?.dictionary || null;
    const autoDictionary =
      forcedDictionary || manualDictionary
        ? null
        : getActivityDictionary(
            storedContext?.activite || summary?.meta?.activityName || sessionMeta?.activityName || ""
          );
    const baseDictionary = forcedDictionary || manualDictionary ? null : getPreferredBaseDictionary(storedContext);
    const dictionary = forcedDictionary || manualDictionary || baseDictionary || autoDictionary || null;
    return { dictionary, forcedDictionary, forcedDictionaryId, manualEntry, autoDictionary, baseDictionary };
  }

  function setCurrentStudentContext({
    storedContext = {},
    summary = {},
    dictionary = null,
    datasetSize = 0,
    usedEntries = 0,
    scope = "session",
    cycleMeta = null,
    cycleSessionCount = 0,
    cycleAnalysis = null,
    dictionarySource = "default",
  }) {
    const meta = summary.meta || {};
    const className = cycleMeta?.class_name || storedContext?.classe || meta.className || "";
    const activityName =
      cycleMeta?.activity_name || storedContext?.activite || meta.activityName || dictionary?.label || "";
    const sessionName =
      scope === "cycle"
        ? cycleMeta?.cycle_name || storedContext?.seance || `Cycle (${cycleSessionCount} séances)`
        : storedContext?.seance || meta.sessionName || "";
    currentContext = {
      className,
      activityName,
      sessionName,
      providerLabel: "Analyse locale",
      intent: lastIntent,
      totalEntries: datasetSize,
      usedEntries,
      studentCount: datasetSize,
      sessionDate: storedContext?.date || meta.updatedAt || meta.savedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dictionaryInfo: dictionary
        ? {
            id: dictionary.id || "",
            label: dictionary.label || dictionary.id || "",
            source: dictionarySource,
          }
        : null,
      isCycle: scope === "cycle",
      cycleSessionCount: scope === "cycle" ? cycleSessionCount : 0,
      cycleAnalysis: scope === "cycle" ? cycleAnalysis : null,
      studentLabel: "",
      studentClasse: "",
      baseReading: getBaseReadingSnapshot(),
      analysisMode: scope === "cycle" ? ANALYSIS_MODES.cycle : ANALYSIS_MODES.session,
    };
  }

  function renderStudentAnalysisReport(analysis, scope = "session") {
    if (!analysis) {
      renderFallbackError("Aucun résultat à afficher.");
      return;
    }
    const summaryLines = buildStudentSummaryLines(analysis);
    const metricLines = buildStudentMetricLines(analysis);
    const historyLines = buildStudentHistoryLines(analysis.history || []);
    const sections = [
      {
        label: "Synthèse",
        value: summaryLines.length ? summaryLines.join(" ") : "Analyse locale réalisée avec les données disponibles.",
      },
      {
        label: "Points forts",
        value: Array.isArray(analysis.strengths) && analysis.strengths.length ? analysis.strengths : [],
      },
      {
        label: "Points de vigilance",
        value: Array.isArray(analysis.focus) && analysis.focus.length ? analysis.focus : [],
      },
      {
        label: "Suite proposée",
        value: Array.isArray(analysis.next_steps) && analysis.next_steps.length ? analysis.next_steps : [],
      },
      {
        label: "Repères chiffrés",
        value: metricLines.length ? metricLines : analysis.comparisons || [],
      },
    ];
    if (historyLines.length) {
      sections.push({
        label: scope === "cycle" ? "Historique du cycle" : "Historique",
        value: historyLines,
      });
    }
    if (refs.modalModeIndicator) {
      refs.modalModeIndicator.textContent =
        scope === "cycle" ? "Bilan élève : cycle" : "Bilan élève : séance";
    }
    refs.modalDictionaryIndicator?.classList.add("sp-hidden");
    const entries = sections.map((section) => ({
      label: section.label,
      value: section.value,
      content: valueToPlainText(section.value) || EMPTY_SECTION_TEXT,
    }));
    refs.modalContent.innerHTML = entries.map((entry) => renderSection(entry.label, entry.value)).join("");
    updateReportState(entries);
  }

  function buildStudentSummaryLines(analysis = {}) {
    const lines = [];
    if (analysis.student_label) {
      const nameLine = analysis.classe ? `${analysis.student_label} — ${analysis.classe}` : analysis.student_label;
      lines.push(nameLine);
    }
    if (analysis.activity_label) {
      lines.push(`Activité : ${analysis.activity_label}.`);
    }
    if (analysis.positioning) {
      lines.push(`Positionnement : ${describeStudentPositioning(analysis.positioning)}.`);
    }
    if (analysis.trend) {
      lines.push(`Tendance : ${describeStudentTrend(analysis.trend)}.`);
    }
    return lines;
  }

  function buildStudentMetricLines(analysis = {}) {
    const lines = [];
    if (analysis.attempts && (Number.isFinite(analysis.attempts.student) || Number.isFinite(analysis.attempts.class_mean))) {
      const studentValue = Number.isFinite(analysis.attempts.student)
        ? `${roundValue(analysis.attempts.student, 1)} essai(s)`
        : null;
      const classValue = Number.isFinite(analysis.attempts.class_mean)
        ? `${roundValue(analysis.attempts.class_mean, 1)} en classe`
        : null;
      if (studentValue || classValue) {
        lines.push(
          [`Volume d’essais`, studentValue, classValue ? `(${classValue})` : null].filter(Boolean).join(" ")
        );
      }
    }
    if (analysis.performance && analysis.performance.label) {
      const studentPerf =
        analysis.performance.unit === "ratio"
          ? formatRatioValue(analysis.performance.student_value)
          : analysis.performance.student_value != null
          ? `${analysis.performance.student_value}`
          : null;
      const classPerf =
        analysis.performance.unit === "ratio"
          ? formatRatioValue(analysis.performance.class_value)
          : analysis.performance.class_value != null
          ? `${analysis.performance.class_value}`
          : null;
      if (studentPerf || classPerf) {
        lines.push(
          `${analysis.performance.label} : ${studentPerf || "—"}${classPerf ? ` (classe ${classPerf})` : ""}`
        );
      }
    }
    (analysis.comparisons || []).forEach((item) => {
      if (item) lines.push(item);
    });
    return lines.slice(0, 5);
  }

  function buildStudentHistoryLines(history = []) {
    const list = [];
    history.forEach((entry) => {
      if (!entry) return;
      const parts = [entry.session_label || "Séance"];
      if (entry.session_date) {
        parts.push(formatHistoryDate(entry.session_date));
      }
      const details = [];
      if (Number.isFinite(entry.attempts)) details.push(`${roundValue(entry.attempts, 1)} essai(s)`);
      if (Number.isFinite(entry.success_rate)) details.push(`${formatRatioValue(entry.success_rate)} réussite`);
      if (Number.isFinite(entry.cross_above_share)) details.push(`${formatRatioValue(entry.cross_above_share)} au-dessus du plan`);
      if (!details.length && Number.isFinite(entry.class_attempts)) {
        details.push(`Classe : ${roundValue(entry.class_attempts, 1)} essai(s)`);
      }
      const line = details.length ? `${parts.join(" • ")} — ${details.join(" • ")}` : parts.join(" • ");
      list.push(line);
    });
    return list.slice(0, STUDENT_HISTORY_LIMIT_SAFE);
  }

  function formatHistoryDate(value) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      try {
        return new Date(timestamp).toLocaleDateString("fr-FR");
      } catch {
        return new Date(timestamp).toISOString().slice(0, 10);
      }
    }
    return String(value);
  }

  function describeStudentPositioning(positioning = "near") {
    if (positioning === "above") return "au-dessus de la moyenne de classe";
    if (positioning === "below") return "en dessous de la moyenne de classe";
    return "proche de la moyenne de classe";
  }

  function describeStudentTrend(trend = "stable") {
    if (trend === "progression") return "en progression";
    if (trend === "soutien") return "à relancer";
    return "stable";
  }

  function formatRatioValue(value) {
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value * 100)}%`;
  }

  function roundValue(value, precision = 2) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  function checkPendingCycleTrigger() {
    const trigger = consumeCycleTriggerRequest();
    if (!trigger) return;
    console.info("[ScanProf IA] cycle trigger détecté", trigger);
    toggleDrawer(true);
    setTimeout(() => launchCycleAnalysisFromActivity(trigger), 250);
  }

  function updateModeIndicators({
    cycleBundle = null,
    sessionBundle = null,
    cycleCandidateCount = 0,
    cycleRetainedCount = 0,
    cycleDiagnostics = null,
  } = {}) {
    const diagnostics = cycleDiagnostics || getCycleDiagnostics();
    const cycleCount = cycleBundle?.sessions?.length || diagnostics.retained || 0;
    const sourceCount = sessionBundle?.sources?.length || 0;
    const totalCandidates = cycleCandidateCount || diagnostics.totalCandidates || cycleCount || 0;
    const retained = cycleCount || cycleRetainedCount || diagnostics.retained || 0;
    const requestedMode = selectedAnalysisMode;
    const modeLabel = formatAnalysisModeLabel(requestedMode);
    let indicatorText = `Type d’analyse : ${modeLabel}`;
    if (requestedMode === ANALYSIS_MODES.cycle) {
      if (retained >= CYCLE_MIN_SESSIONS_FOR_FALLBACK) {
        indicatorText += ` • ${retained} séance${retained > 1 ? "s" : ""} retenue${retained > 1 ? "s" : ""}`;
      } else if (totalCandidates > 0) {
        indicatorText += ` • ${retained}/${totalCandidates} séance${totalCandidates > 1 ? "s" : ""}`;
      } else {
        indicatorText += " • en attente de cycle";
      }
    } else if (requestedMode === ANALYSIS_MODES.student) {
      const count = studentDirectory.size || 0;
      indicatorText += ` • ${count} élève${count > 1 ? "s" : ""}`;
    } else if (sourceCount > 1) {
      indicatorText += ` • ${sourceCount} source${sourceCount > 1 ? "s" : ""} QR`;
    } else if (retained >= CYCLE_MIN_SESSIONS_FOR_FALLBACK) {
      indicatorText += ` • cycle prêt (${retained} séance${retained > 1 ? "s" : ""})`;
    }
    if (refs.modeIndicator) refs.modeIndicator.textContent = indicatorText;
    if (refs.modalModeIndicator) refs.modalModeIndicator.textContent = indicatorText;
    if (refs.contextTexts?.cycle) {
      if (totalCandidates > 0) {
        refs.contextTexts.cycle.textContent = `Séances retenues : ${retained} sur ${totalCandidates}`;
      } else {
        refs.contextTexts.cycle.textContent = "Cycle non détecté pour cette classe.";
      }
    }
    if (refs.cycleWarning) {
      if (requestedMode === ANALYSIS_MODES.cycle) {
        const message =
          retained >= CYCLE_MIN_SESSIONS_FOR_FALLBACK
            ? "Cycle prêt à être analysé."
            : "Ajoutez au moins deux séances retenues pour lancer le bilan.";
        refs.cycleWarning.textContent = message;
        refs.cycleWarning.classList.toggle("ai-mode-indicator--warning", retained < CYCLE_MIN_SESSIONS_FOR_FALLBACK);
        refs.cycleWarning.classList.remove("sp-hidden");
      } else {
        refs.cycleWarning.classList.add("sp-hidden");
      }
    }
    updateDictionaryIndicators();
    renderCycleDiagnostics(diagnostics, retained >= CYCLE_MIN_SESSIONS_FOR_FALLBACK, totalCandidates);
  }

  function updateDictionaryIndicators() {
    const text = buildDictionaryIndicatorText();
    if (refs.dictionaryIndicator) {
      if (text) {
        refs.dictionaryIndicator.textContent = text;
        refs.dictionaryIndicator.classList.remove("sp-hidden");
      } else {
        refs.dictionaryIndicator.textContent = "";
        refs.dictionaryIndicator.classList.add("sp-hidden");
      }
    }
    if (refs.modalDictionaryIndicator) {
      if (text) {
        refs.modalDictionaryIndicator.textContent = text;
        refs.modalDictionaryIndicator.classList.remove("sp-hidden");
      } else {
        refs.modalDictionaryIndicator.textContent = "";
        refs.modalDictionaryIndicator.classList.add("sp-hidden");
      }
    }
  }

  function buildDictionaryIndicatorText() {
    const info = currentContext?.dictionaryInfo;
    const baseLabel = selectedBase !== "auto" ? BASE_READING_LABELS[selectedBase] : "";
    if (!info || !info.label) {
      return baseLabel ? `Lecture actuelle : ${baseLabel}` : "";
    }
    const sourceLabel = formatDictionarySourceLabel(info.source);
    let text = `Référentiel : ${info.label}`;
    if (sourceLabel) text += ` (${sourceLabel})`;
    if (baseLabel && info.label !== baseLabel) {
      text += ` • Lecture : ${baseLabel}`;
    }
    return text;
  }

  function formatDictionarySourceLabel(source = "") {
    const normalized = String(source || "").toLowerCase();
    if (!normalized) return "";
    if (normalized.includes("manual")) return "manuel";
    if (normalized.includes("forced")) return "manuel";
    if (normalized.includes("base")) return "lecture fixée";
    if (normalized.includes("auto") || normalized === "default") return "auto";
    return normalized;
  }

  function renderCycleDiagnostics(diagnostics = {}, hasCycle = false, totalCandidates = 0) {
    if (!refs.cycleDiagnostics || !refs.cycleDiagnosticsList) return;
    const entries = Array.isArray(diagnostics.rejections) ? diagnostics.rejections : [];
    if (!entries.length || selectedAnalysisMode !== ANALYSIS_MODES.cycle) {
      refs.cycleDiagnosticsList.innerHTML = "";
      refs.cycleDiagnostics.classList.add("sp-hidden");
      return;
    }
    const limited = entries.slice(0, 6).map((entry) => `<li>${escapeHtml(formatCycleRejectionEntry(entry))}</li>`);
    refs.cycleDiagnosticsList.innerHTML = limited.join("");
    refs.cycleDiagnostics.classList.remove("sp-hidden");
  }

  function formatCycleRejectionEntry(entry = {}) {
    const session = entry.sessionName || entry.session || "Séance";
    const date = formatCycleIndicatorDate(entry.sessionDate);
    const label = CYCLE_REJECTION_MESSAGES[entry.reason] || entry.reasonLabel || entry.reason || "motif inconnu";
    let extra = "";
    if (entry.reason === "dataset_vide" && typeof entry.extra?.datasetSize === "number") {
      extra = ` – ${entry.extra.datasetSize} entrée(s) transmises`;
    } else if (entry.reason === "referentiel_different") {
      const expectedLabel = describeCycleSignature(entry.extra?.expected);
      const candidateLabel = describeCycleSignature(entry.extra?.candidate);
      if (expectedLabel || candidateLabel) {
        extra = ` – attendu ${expectedLabel || "?"}, reçu ${candidateLabel || "?"}`;
      }
    } else if (entry.reason === "referentiel_introuvable" && entry.extra?.activity) {
      extra = ` – ${entry.extra.activity}`;
    } else if (entry.extra?.message) {
      extra = ` – ${entry.extra.message}`;
    }
    const datePart = date ? ` (${date})` : "";
    return `${session}${datePart} — ${label}${extra}`;
  }

  function describeCycleSignature(signature = {}) {
    if (!signature) return "";
    if (signature.dictionaryLabel) return signature.dictionaryLabel;
    if (signature.dictionaryId) return signature.dictionaryId;
    if (signature.label) return signature.label;
    if (signature.activityId) return signature.activityId;
    return "";
  }

  function formatCycleIndicatorDate(value) {
    if (!value) return "";
    const timestamp = parseDateValue(value);
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toLocaleDateString("fr-FR");
    } catch {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }

  function inferTypeLabels(columns = []) {
    return columns
      .filter((col) => {
        if (!col) return false;
        const lower = col.toLowerCase();
        if (CORE_COLUMNS.has(lower)) return false;
        if (/^t\d+$/i.test(lower)) return false;
        return true;
      })
      .slice(0, 3)
      .map((col) => col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  function getDataset() {
    const api = window.ScanProfParticipants;
    if (!api || typeof api.getCurrentDataset !== "function") return [];
    return api.getCurrentDataset() || [];
  }

  function getStoredAIContext() {
    try {
      const raw = localStorage.getItem(AI_CONTEXT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function getStoredSessionMeta() {
    try {
      const raw = localStorage.getItem(SESSION_META_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const meta = parsed && typeof parsed === "object" ? parsed : null;
      console.info(`${CYCLE_DEBUG_PREFIX} Session meta`, meta);
      return meta;
    } catch {
      console.warn(`${CYCLE_DEBUG_PREFIX} Session meta parse failed`);
      return null;
    }
  }

  function getSelectedProviderKey() {
    return currentProvider;
  }

  function getProviderConfig() {
    return { key: currentProvider, ...PROVIDERS[currentProvider] };
  }

  function getSelectedModel() {
    const provider = PROVIDERS[currentProvider] || PROVIDERS[DEFAULT_PROVIDER];
    return normalizeModelForProvider(currentProvider, currentModel) || provider.defaultModel;
  }

  function inferProviderFromKey(key = "") {
    const raw = key.trim();
    const lower = raw.toLowerCase();
    if (!raw) return currentProvider || DEFAULT_PROVIDER;
    if (lower.startsWith("sk-") || lower.includes("openai")) return "openai";
    if (raw.startsWith("AIza") || lower.startsWith("gk") || lower.includes("google")) return "gemini";
    return DEFAULT_PROVIDER;
  }

  function cleanEntry(entry, retentionPlan) {
    if (!entry || typeof entry !== "object") return entry;
    const clone = {};
    Object.keys(entry).forEach((key) => {
      if (key.startsWith("__")) return;
      clone[key] = entry[key];
    });
    return compactEntry(clone, retentionPlan);
  }

  function compactEntry(entry, plan) {
    if (!entry || typeof entry !== "object") return entry;
    if (!plan) return entry;
    const protectedSet = plan.protected || new Set(CORE_COLUMNS);
    const result = {};
    const optional = [];
    Object.keys(entry).forEach((key) => {
      if (key.startsWith("__")) return;
      const normalized = normalizeColumnKey(key);
      if (protectedSet.has(normalized)) {
        result[key] = entry[key];
        return;
      }
      optional.push({ key });
    });
    const limit = plan.limit || MAX_TOTAL_COLUMNS;
    if (limit <= 0) return result;
    let count = Object.keys(result).length;
    if (count >= limit) return result;
    for (const item of optional) {
      if (count >= limit) break;
      result[item.key] = entry[item.key];
      count += 1;
    }
    return result;
  }

  function buildColumnRetentionPlan(columns = [], dictionary = null, manualText = "") {
    const plan = {
      protected: new Set(CORE_COLUMNS),
      limit: MAX_TOTAL_COLUMNS,
    };
    const manualTokens =
      (window.ScanProfAIInterpretationEngine && window.ScanProfAIInterpretationEngine.extractManualTokens(manualText)) ||
      new Set();
    manualTokens.forEach((token) => plan.protected.add(token));
    const dictionaryKeys = new Set(
      Object.keys(dictionary?.abbreviations || {}).map((key) => normalizeColumnKey(key)).filter(Boolean)
    );
    const suffixes = Object.keys(dictionary?.suffixes || {});
    (columns || []).forEach((col) => {
      const normalized = normalizeColumnKey(col);
      if (!normalized || plan.protected.has(normalized)) return;
      if (dictionaryKeys.has(normalized)) {
        plan.protected.add(normalized);
        return;
      }
      const base = stripSuffixForPlan(normalized, suffixes);
      if (base && dictionaryKeys.has(base)) {
        plan.protected.add(normalized);
        return;
      }
      if (manualTokens.has(normalized)) {
        plan.protected.add(normalized);
      }
    });
    return plan;
  }

  function collectCycleSessions(options = {}) {
    const store = window.ScanProfClassesStore;
    if (!store || typeof store.loadClasses !== "function") return [];
    const sessionMetaOverride = options.sessionMetaOverride || null;
    const sessionMeta = sessionMetaOverride || getStoredSessionMeta() || {};
    const targetClassId = options.classId || sessionMeta?.classId;
    const targetActivityId = options.activityId || sessionMeta?.activityId;
    if (!targetClassId || !targetActivityId) return [];
    let classes = [];
    try {
      classes = store.loadClasses() || [];
    } catch (err) {
      console.warn("[ScanProf IA] Impossible de charger les classes pour le cycle.", err);
      return [];
    }
    const cls = classes.find((item) => item.id === targetClassId);
    const activity = cls?.activities?.find((act) => act.id === targetActivityId);
    if (!cls || !activity || !Array.isArray(activity.sessions) || !activity.sessions.length) return [];
    console.info(`${CYCLE_DEBUG_PREFIX} Sessions trouvées`, {
      classId: cls.id,
      activityId: activity.id,
      totalSessions: activity.sessions.length,
      activityName: activity.name,
    });
    return activity.sessions.map((session) => ({
      session_id: session.id,
      session_name: session.name,
      session_date: session.updatedAt || session.createdAt || null,
      dataset: Array.isArray(session.data) ? session.data : [],
      activity_label: activity.name,
      app_label: activity.name,
      meta: {
        classId: cls.id,
        className: cls.name,
        activityId: activity.id,
        activityName: activity.name,
      },
    }));
  }

  function consumeCycleTriggerRequest() {
    try {
      const raw = localStorage.getItem(CYCLE_TRIGGER_KEY);
      if (!raw) return null;
      localStorage.removeItem(CYCLE_TRIGGER_KEY);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      try {
        localStorage.removeItem(CYCLE_TRIGGER_KEY);
      } catch {
        /* noop */
      }
      return null;
    }
  }

  function setCycleDiagnostics(total = 0, retained = 0) {
    lastCycleDiagnostics = {
      totalCandidates: Number.isFinite(total) && total > 0 ? total : 0,
      retained: Number.isFinite(retained) && retained > 0 ? retained : 0,
      rejections: cycleRejectionLog.slice(),
    };
  }

  function getCycleDiagnostics() {
    return {
      totalCandidates: lastCycleDiagnostics.totalCandidates || 0,
      retained: lastCycleDiagnostics.retained || 0,
      rejections: Array.isArray(lastCycleDiagnostics.rejections) ? lastCycleDiagnostics.rejections.slice() : [],
    };
  }

  function resetCycleRejections() {
    cycleRejectionLog = [];
  }

  async function launchCycleAnalysisFromActivity(trigger = {}) {
    if (!trigger?.classId || !trigger?.activityId) return;
    const statusTarget = refs.runStatus || null;
    setStatus(statusTarget, "Analyse du cycle en préparation...", "info");
    const providerConfig = getProviderConfig();
    const apiKey = getApiKey();
    if (!apiKey) {
      setStatus(statusTarget, "Clé API manquante pour lancer l’analyse du cycle.", "error");
      return;
    }
    openModal();
    setModalLoading(true);
    setPanelBusy(true);
    const cycleSessions = collectCycleSessions({
      classId: trigger.classId,
      activityId: trigger.activityId,
      sessionMetaOverride: {
        classId: trigger.classId,
        className: trigger.className || "",
        activityId: trigger.activityId,
        activityName: trigger.activityName || "",
        forcedDictionaryId: trigger.forcedDictionaryId || null,
      },
    });
    if (cycleSessions.length < 2) {
      const msg = `Cycle impossible : ${cycleSessions.length} séance${cycleSessions.length > 1 ? "s" : ""} disponible${cycleSessions.length > 1 ? "s" : ""}.`;
      setStatus(statusTarget, msg, "error");
      renderFallbackError(msg);
      setModalLoading(false);
      setPanelBusy(false);
      return;
    }
    const notes = refs.notesField?.value || "";
    const manualInterpretation = refs.interpretationField?.value || localStorage.getItem(STORAGE.INTERPRETATION) || "";
    const storedContext = {
      classe: trigger.className || "",
      activite: trigger.activityName || "",
      seance: `Cycle (${trigger.sessionCount || cycleSessions.length} séances)`,
      date: new Date().toISOString(),
    };
    const forcedDictionaryId = trigger.forcedDictionaryId || null;
    const forcedDictionary = forcedDictionaryId ? getDictionaryByIdSafe(forcedDictionaryId) : null;
    const manualEntry = forcedDictionary ? null : getManualDictionaryEntry(storedContext);
    const baseDictionary = forcedDictionary ? null : getPreferredBaseDictionary(storedContext);
    const autoDictionary = forcedDictionary ? null : getActivityDictionary(storedContext.activite || "");
    const dictionaryToUse = forcedDictionary || manualEntry?.dictionary || baseDictionary || autoDictionary;
    const dictionarySource = forcedDictionary
      ? "cycle-forced"
      : manualEntry
      ? "manual"
      : baseDictionary
      ? "base-preference"
      : dictionaryToUse?.source || "default";
    rememberAutoDictionary(storedContext, dictionaryToUse);
    currentContext = {
      className: trigger.className || "",
      activityName: trigger.activityName || "",
      sessionName: storedContext.seance,
      providerLabel: providerConfig.label,
      intent: "bilan",
      storedContext,
      sessionMeta: {
        classId: trigger.classId,
        className: trigger.className || "",
        activityId: trigger.activityId,
        activityName: trigger.activityName || "",
        forcedDictionaryId,
      },
      totalEntries: 0,
      usedEntries: 0,
      studentCount: 0,
      sessionDate: new Date().toISOString(),
      dictionaryInfo: dictionaryToUse
        ? {
            id: dictionaryToUse.id,
            label: dictionaryToUse.label || dictionaryToUse.id || "Activité",
            source: dictionarySource || "default",
            forcedDictionaryId: forcedDictionaryId || null,
            forcedLabel: forcedDictionary?.label || null,
          }
        : null,
      preAnalysis: null,
      classAnalytics: null,
      cycleAnalysis: null,
      isCycle: false,
      cycleSessionCount: 0,
      baseReading: getBaseReadingSnapshot(),
      analysisMode: ANALYSIS_MODES.cycle,
    };
    const interpretationEngine = window.ScanProfAIInterpretationEngine;
    const analyticsEngine = window.ScanProfClassAnalytics;
    const cycleBundle = buildCycleBundle(cycleSessions, {
      sessionMeta: {
        classId: trigger.classId,
        className: trigger.className || "",
        activityId: trigger.activityId,
        activityName: trigger.activityName || "",
        cycleName: trigger.activityName || "",
        forcedDictionaryId,
      },
      baseDictionary: dictionaryToUse,
      forcedDictionaryId,
      forcedDictionary,
      manualText: manualInterpretation,
      summary: {},
      interpretationEngine,
      analyticsEngine,
    });
    const retainedCycleSessions = cycleBundle?.sessions?.length || 0;
    currentContext.cycleSessionCount = retainedCycleSessions;
    if (cycleBundle?.merged_cycle_analysis && retainedCycleSessions >= CYCLE_MIN_SESSIONS_FOR_FALLBACK) {
      currentContext.isCycle = true;
      currentContext.cycleAnalysis = cycleBundle.merged_cycle_analysis;
    } else {
      currentContext.isCycle = false;
      currentContext.cycleAnalysis = cycleBundle?.merged_cycle_analysis || null;
    }
    const diagnostics = getCycleDiagnostics();
    updateModeIndicators({
      cycleBundle,
      sessionBundle: null,
      cycleCandidateCount: diagnostics.totalCandidates || cycleSessions.length,
      cycleRetainedCount: diagnostics.retained || (cycleBundle?.sessions?.length || 0),
      cycleDiagnostics: diagnostics,
    });
    if (!cycleBundle) {
      const retained = diagnostics.retained || 0;
      const total = diagnostics.totalCandidates || cycleSessions.length;
      const retainedLabel = `séance${retained > 1 ? "s" : ""}`;
      const msg = `Cycle impossible : ${retained} ${retainedLabel} retenue${retained > 1 ? "s" : ""} sur ${total}.`;
      setStatus(statusTarget, msg, "error");
      renderFallbackError(msg);
      setModalLoading(false);
      setPanelBusy(false);
      return;
    }
    const representativeSession =
      cycleBundle.sessions[cycleBundle.sessions.length - 1] || cycleBundle.sessions[0];
    const sampleDataset = Array.isArray(representativeSession?.dataset)
      ? representativeSession.dataset.slice(0, MAX_ELEVES)
      : [];
    const summary = summarizeSubsetEntries(sampleDataset, representativeSession?.meta || {});
    const interpretationSupport = buildInterpretationSupport({
      columns: summary.columns || [],
      activityName: storedContext.activite || "",
      manualText: manualInterpretation,
      dictionary: dictionaryToUse,
    });
    const analysisInput = {
      contexte: buildContext(
        summary,
        notes,
        sampleDataset.length,
        sampleDataset.length,
        providerConfig.key,
        "bilan",
        "",
        storedContext,
        interpretationSupport,
        representativeSession?.pre_analysis || null,
        representativeSession?.class_analytics || null,
        representativeSession?.student_profiles || null,
        representativeSession?.student_profile_sentences || null
      ),
      eleves: sampleDataset,
      intent: "bilan",
      questionText: "",
      interpretation: interpretationSupport,
      pre_analysis: representativeSession?.pre_analysis || null,
      summary_sentences: representativeSession?.summary_sentences || null,
      student_profiles: representativeSession?.student_profiles || null,
      student_profile_sentences: representativeSession?.student_profile_sentences || null,
      student_analysis: representativeSession?.student_analysis || null,
      class_analytics: representativeSession?.class_analytics || null,
      session_bundle: null,
      cycle_bundle: cycleBundle,
      analysis_mode: ANALYSIS_MODES.cycle,
      base_reading: currentContext.baseReading,
    };
    console.info("[ScanProf IA] cycle_bundle present", analysisInput.cycle_bundle);
    console.info("[ScanProf IA] session_bundle present", analysisInput.session_bundle);
    try {
      const builder = window.ScanProfAIPrompt;
      if (!builder || typeof builder.buildPrompt !== "function") {
        throw new Error("Module de prompt introuvable.");
      }
      const { messages, schema } = builder.buildPrompt({
        analysisInput,
        mode: "bilan",
        analysisMode: ANALYSIS_MODES.cycle,
      });
      logPromptDiagnostics(messages, sampleDataset, summary.columns || []);
      const model = getSelectedModel();
      const processed = await generateAIResponseWithRetry({
        providerKey: providerConfig.key,
        apiKey,
        model,
        messages,
        schema,
        options: { temperature: 0.25, max_tokens: 900, intent: "bilan" },
      });
      renderReport(schema, processed);
      setStatus(statusTarget, "Analyse de cycle terminée 🎉", "success");
      setModalLoading(false);
      setPanelBusy(false);
    } catch (err) {
      const userMessage = err?.userMessage || err?.message || "Analyse de cycle impossible pour le moment.";
      if (err?.logMessage) console.error(err.logMessage, err);
      else console.error(err);
      setStatus(statusTarget, userMessage, "error");
      renderFallbackError(userMessage);
      setModalLoading(false);
      setPanelBusy(false);
    }
  }

  function buildCycleBundle(collectedSessions = [], globalContext = {}) {
    resetCycleRejections();
    const sessions = Array.isArray(collectedSessions) ? collectedSessions : [];
    const totalCandidates = sessions.length;
    setCycleDiagnostics(totalCandidates, 0);
    console.info(`${CYCLE_DEBUG_PREFIX} Cycle candidates`, { totalCandidates });
    const datasetFiltered = [];
    sessions.forEach((entry) => {
      const filteredRows = Array.isArray(entry?.dataset)
        ? entry.dataset.filter((row) => row && typeof row === "object")
        : [];
      if (!filteredRows.length) {
        logCycleRejection("dataset_vide", entry, {
          datasetSize: Array.isArray(entry?.dataset) ? entry.dataset.length : 0,
        });
        return;
      }
      datasetFiltered.push({ ...entry, dataset: filteredRows });
    });
    console.info(`${CYCLE_DEBUG_PREFIX} Après filtre dataset`, {
      retained: datasetFiltered.length,
      rejected: totalCandidates - datasetFiltered.length,
    });
    if (datasetFiltered.length < 2) {
      setCycleDiagnostics(totalCandidates, datasetFiltered.length);
      return null;
    }
    const analyticsEngine = globalContext.analyticsEngine || window.ScanProfClassAnalytics;
    if (!analyticsEngine || typeof analyticsEngine.analyzeCycleBundle !== "function") return null;
    const baseDictionary = globalContext.baseDictionary || null;
    const manualText = globalContext.manualText || "";
    const summary = globalContext.summary || {};
    const interpretationEngine = globalContext.interpretationEngine || null;
    const sessionMeta = globalContext.sessionMeta || null;
    const forcedDictionaryId =
      globalContext.forcedDictionaryId ||
      sessionMeta?.forcedDictionaryId ||
      null;
    const forcedDictionary =
      globalContext.forcedDictionary ||
      (forcedDictionaryId ? getDictionaryByIdSafe(forcedDictionaryId) : null);

    const sorted = datasetFiltered
      .map((session) => ({ ...session }))
      .sort((a, b) => (parseDateValue(a.session_date) || 0) - (parseDateValue(b.session_date) || 0));
    const limit = globalContext.cycleSessionLimit || MAX_CYCLE_SESSIONS;
    const selected = sorted.slice(Math.max(sorted.length - limit, 0));

    console.info(`${CYCLE_DEBUG_PREFIX} Sessions retenues après tri`, {
      selected: selected.length,
      limit,
      sessionNames: selected.map((s) => s.session_name),
    });
    const normalized = [];
    let expectedSignature =
      forcedDictionaryId && (forcedDictionary?.label || sessionMeta?.activityName)
        ? {
            dictionaryId: forcedDictionaryId,
            dictionaryLabel: forcedDictionary?.label || sessionMeta?.activityName || "",
            label: normalizeCycleLabel(forcedDictionary?.label || sessionMeta?.activityName || ""),
          }
        : null;
    selected.forEach((rawSession, index) => {
      const prepared = prepareCycleSession(rawSession, index, {
        baseDictionary,
        manualText,
        summary,
        interpretationEngine,
        analyticsEngine,
        forcedDictionary,
        forcedDictionaryId,
        onReject: (reason, extra = {}) => logCycleRejection(reason, rawSession, extra),
      });
      if (!prepared) return;
      const candidateSignature = buildCycleSignature(
        rawSession,
        prepared,
        baseDictionary,
        forcedDictionaryId,
        forcedDictionary
      );
      if (!expectedSignature) {
        expectedSignature = candidateSignature;
      } else if (!cycleSignaturesCompatible(expectedSignature, candidateSignature, forcedDictionaryId)) {
        const mismatchReason =
          expectedSignature.dictionaryId &&
          candidateSignature.dictionaryId &&
          candidateSignature.dictionaryId !== expectedSignature.dictionaryId
            ? "referentiel_different"
            : "activite_differente";
        logCycleRejection(mismatchReason, rawSession, {
          expected: expectedSignature,
          candidate: candidateSignature,
        });
        return;
      }
      normalized.push(prepared);
    });
    setCycleDiagnostics(totalCandidates, normalized.length);
    console.info(`${CYCLE_DEBUG_PREFIX} Sessions retenues`, {
      totalCandidates,
      retained: normalized.length,
    });
    if (normalized.length < 2) return null;
    normalized.forEach((session, index) => {
      session.index = index + 1;
    });
    const merged = analyticsEngine.analyzeCycleBundle({
      sessions: normalized,
      summary,
      manualText,
    });
    const firstMeta = normalized[0]?.meta || {};
    const cycleMeta = {
      app_id: forcedDictionaryId || expectedSignature?.dictionaryId || baseDictionary?.id || "",
      app_label:
        forcedDictionary?.label ||
        baseDictionary?.label ||
        normalized[0]?.dictionary?.label ||
        firstMeta.activityName ||
        sessionMeta?.activityName ||
        "Activité",
      class_name: sessionMeta?.className || firstMeta.className || "",
      activity_name: sessionMeta?.activityName || firstMeta.activityName || "",
      cycle_name:
        sessionMeta?.cycleName ||
        sessionMeta?.activityName ||
        firstMeta.activityName ||
        baseDictionary?.label ||
        "Cycle",
      session_count: normalized.length,
      dictionary_source: forcedDictionaryId ? "cycle-forced" : baseDictionary?.source || "default",
    };
    const bundle = {
      cycle_meta: cycleMeta,
      sessions: normalized,
      merged_cycle_analysis: merged,
    };
    console.info(`${CYCLE_DEBUG_PREFIX} Cycle bundle final`, {
      totalCandidates,
      retained: normalized.length,
      names: normalized.map((session) => session.session_name),
    });
    return bundle;
  }

  function prepareCycleSession(rawSession = {}, index = 0, options = {}) {
    const rows = Array.isArray(rawSession.dataset) ? rawSession.dataset.filter((row) => row && typeof row === "object") : [];
    if (!rows.length) {
      options.onReject?.("dataset_vide", { reason: "rows_empty" });
      return null;
    }
    const augmentedSource = {
      ...rawSession,
      activity_label: rawSession.activity_label || rawSession.meta?.activityName || "",
      app_label: rawSession.app_label || rawSession.meta?.activityName || "",
    };
    const dictionary =
      options.forcedDictionary ||
      resolveDictionaryForSource(augmentedSource, options.baseDictionary || null) ||
      options.baseDictionary ||
      null;
    if (!dictionary) {
      options.onReject?.("referentiel_introuvable", { activity: augmentedSource.activity_label || null });
      return null;
    }
    const columns =
      (Array.isArray(rawSession.columns) && rawSession.columns.length ? rawSession.columns : inferColumnsForDataset(rows)) ||
      [];
    const retentionPlan = buildColumnRetentionPlan(columns, dictionary, options.manualText || "");
    const cleanedEntries = rows.slice(0, MAX_ELEVES).map((entry) => cleanEntry(entry, retentionPlan));
    const summary = rawSession.summary || summarizeSubsetEntries(cleanedEntries, rawSession.meta || {});
    const interpretationEngine = options.interpretationEngine;
    const preAnalysis =
      rawSession.pre_analysis ||
      (interpretationEngine &&
        interpretationEngine.analyze({
          dataset: cleanedEntries,
          columns,
          dictionary,
          manualText: options.manualText || "",
          summary,
        }));
    const analyticsEngine = options.analyticsEngine;
    const classAnalytics =
      rawSession.class_analytics ||
      (analyticsEngine &&
        analyticsEngine.analyze({
          dataset: cleanedEntries,
          dictionary,
          summary,
          manualText: options.manualText || "",
        }));
    const profileCollection = rawSession.student_profiles || classAnalytics?.student_profiles || null;
    const profileSentences =
      rawSession.student_profile_sentences || classAnalytics?.student_profile_sentences || null;
    return {
      session_id: rawSession.session_id || rawSession.sessionId || rawSession.id || `session_${index + 1}`,
      session_name: rawSession.session_name || rawSession.sessionName || rawSession.name || `Séance ${index + 1}`,
      session_date: rawSession.session_date || rawSession.updatedAt || rawSession.createdAt || null,
      index: index + 1,
      dataset: cleanedEntries,
      dictionary,
      dictionary_id: options.forcedDictionaryId || dictionary?.id || null,
      pre_analysis: preAnalysis || null,
      class_analytics: classAnalytics || null,
      summary_sentences: rawSession.summary_sentences || classAnalytics?.summary_sentences || null,
      student_profiles: profileCollection,
      student_profile_sentences: profileSentences,
      meta: rawSession.meta || {},
    };
  }

  function buildCycleSignature(
    rawSession = {},
    preparedSession = {},
    baseDictionary = null,
    forcedDictionaryId = null,
    forcedDictionary = null
  ) {
    const dictionaryId =
      toCleanLower(
        forcedDictionaryId ||
          preparedSession?.dictionary_id ||
          rawSession.dictionary_id ||
          rawSession.dictionaryId ||
          baseDictionary?.id ||
          preparedSession?.dictionary?.id
      ) || "";
    const activityId =
      toCleanLower(
        rawSession.meta?.activityId || rawSession.activity_id || rawSession.activityId || preparedSession?.meta?.activityId
      ) || "";
    const label =
      normalizeCycleLabel(
        forcedDictionary?.label ||
          preparedSession?.dictionary?.label ||
          rawSession.activity_label ||
          rawSession.app_label ||
          rawSession.meta?.activityName ||
          baseDictionary?.label ||
          ""
      ) || "";
    return {
      dictionaryId,
      dictionaryLabel:
        forcedDictionary?.label ||
        preparedSession?.dictionary?.label ||
        rawSession.activity_label ||
        rawSession.app_label ||
        rawSession.meta?.activityName ||
        "",
      activityId,
      label,
    };
  }

  function cycleSignaturesCompatible(expected = {}, candidate = {}, forcedDictionaryId = null) {
    if (forcedDictionaryId) return true;
    if (!expected || !candidate) return true;
    if (expected.dictionaryId && candidate.dictionaryId) {
      return expected.dictionaryId === candidate.dictionaryId;
    }
    if (expected.activityId && candidate.activityId) {
      return expected.activityId === candidate.activityId;
    }
    if (expected.label && candidate.label) {
      return expected.label === candidate.label;
    }
    return true;
  }

  function normalizeCycleLabel(label = "") {
    return label
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function toCleanLower(value) {
    if (value == null) return "";
    return String(value).trim().toLowerCase();
  }

  function logCycleRejection(reason = "invalide", session = {}, extra = {}) {
    const name =
      session.session_name ||
      session.sessionName ||
      session.name ||
      session.meta?.sessionName ||
      session.meta?.activityName ||
      "Séance";
    const record = {
      reason,
      reasonLabel: CYCLE_REJECTION_MESSAGES[reason] || reason,
      sessionName: name,
      sessionDate: session.session_date || session.sessionDate || session.updatedAt || session.createdAt || null,
      extra,
    };
    if (cycleRejectionLog.length < 10) {
      cycleRejectionLog.push(record);
    }
    console.warn(`${CYCLE_DEBUG_PREFIX} Rejet séance`, {
      reason,
      session: name,
      ...extra,
    });
  }

  function collectSessionSources() {
    const api = window.ScanProfParticipants;
    if (!api || typeof api.getCurrentSources !== "function") return [];
    try {
      const sources = api.getCurrentSources();
      return Array.isArray(sources) ? sources.filter(Boolean) : [];
    } catch (err) {
      console.warn("[ScanProf IA] Impossible de récupérer les sources multi-applications.", err);
      return [];
    }
  }

  function buildSessionBundle(collectedSources = [], globalContext = {}) {
    const sources = Array.isArray(collectedSources) ? collectedSources.filter(Boolean) : [];
    if (sources.length < SESSION_BUNDLE_MIN_SOURCES) return null;
    const analyticsEngine = globalContext.analyticsEngine || window.ScanProfClassAnalytics;
    if (!analyticsEngine || typeof analyticsEngine.analyzeSessionBundle !== "function") return null;
    const normalizedSources = [];
    sources.forEach((rawSource, index) => {
      const prepared = prepareBundleSource(rawSource, index, {
        manualText: globalContext.manualText || "",
        baseDictionary: globalContext.baseDictionary || null,
        summary: globalContext.summary || {},
        interpretationEngine: globalContext.interpretationEngine || null,
        analyticsEngine,
      });
      if (prepared) normalizedSources.push(prepared);
    });
    if (normalizedSources.length < SESSION_BUNDLE_MIN_SOURCES) return null;
    const mergedSessionAnalysis = analyticsEngine.analyzeSessionBundle({
      sources: normalizedSources,
      summary: globalContext.summary || {},
      manualText: globalContext.manualText || "",
    });
    return {
      session_meta: {
        class_name: globalContext.sessionMeta?.class_name || globalContext.sessionMeta?.className || "",
        session_name: globalContext.sessionMeta?.session_name || globalContext.sessionMeta?.sessionName || "",
        activity_label: globalContext.sessionMeta?.activity_label || globalContext.sessionMeta?.activityLabel || "",
        date: globalContext.sessionMeta?.date || new Date().toISOString(),
      },
      sources: normalizedSources,
      merged_session_analysis: mergedSessionAnalysis,
    };
  }

  function prepareBundleSource(rawSource = {}, index = 0, options = {}) {
    const rows = Array.isArray(rawSource.dataset) ? rawSource.dataset.filter((row) => row && typeof row === "object") : [];
    if (!rows.length) return null;
    const dictionary = resolveDictionaryForSource(rawSource, options.baseDictionary);
    const columns = Array.isArray(rawSource.columns) && rawSource.columns.length
      ? rawSource.columns
      : inferColumnsForDataset(rows);
    const manualText = rawSource.manualText || options.manualText || "";
    const retentionPlan = buildColumnRetentionPlan(columns, dictionary, manualText);
    const cleanedEntries = rows.slice(0, MAX_ELEVES).map((entry) => cleanEntry(entry, retentionPlan));
    const summary = rawSource.summary && typeof rawSource.summary === "object"
      ? rawSource.summary
      : summarizeSubsetEntries(cleanedEntries, rawSource.meta || {});
    const interpretationEngine = options.interpretationEngine;
    const preAnalysis =
      interpretationEngine && typeof interpretationEngine.analyze === "function"
        ? interpretationEngine.analyze({
            dataset: cleanedEntries,
            columns,
            dictionary,
            manualText,
            summary,
          })
        : null;
    const analyticsEngine = options.analyticsEngine;
    const classAnalytics =
      analyticsEngine && typeof analyticsEngine.analyze === "function"
        ? analyticsEngine.analyze({
            dataset: cleanedEntries,
            dictionary,
            summary,
            manualText,
          })
        : null;
    return {
      app_id: rawSource.app_id || rawSource.appId || dictionary?.id || `source_${index + 1}`,
      app_label:
        rawSource.app_label ||
        rawSource.appLabel ||
        rawSource.activity_label ||
        rawSource.activityLabel ||
        dictionary?.label ||
        `Source ${index + 1}`,
      dataset: cleanedEntries,
      dictionary,
      dictionary_id: dictionary?.id || rawSource.dictionary_id || rawSource.dictionaryId || null,
      pre_analysis: rawSource.pre_analysis || preAnalysis,
      class_analytics: rawSource.class_analytics || classAnalytics,
      summary_sentences:
        rawSource.summary_sentences || classAnalytics?.summary_sentences || preAnalysis?.summary_sentences || null,
      student_profiles: rawSource.student_profiles || classAnalytics?.student_profiles || null,
      student_profile_sentences:
        rawSource.student_profile_sentences || classAnalytics?.student_profile_sentences || null,
    };
  }

  function resolveDictionaryForSource(rawSource = {}, fallback = null) {
    if (rawSource.dictionary) return rawSource.dictionary;
    const registry = window.ScanProfAIDictionaries;
    const idsToTry = [
      rawSource.dictionary_id,
      rawSource.dictionaryId,
      rawSource.app_id,
      rawSource.appId,
      rawSource.activity_id,
    ].filter(Boolean);
    if (registry && typeof registry.get === "function") {
      for (const id of idsToTry) {
        const dict = registry.get(id);
        if (dict) return dict;
      }
    }
    const label = rawSource.app_label || rawSource.appLabel || rawSource.activity_label || rawSource.activityLabel || "";
    if (label && registry && typeof registry.matchActivity === "function") {
      const match = registry.matchActivity(label);
      if (match) return match;
    }
    return fallback || null;
  }

  function summarizeSubsetEntries(entries = [], meta = {}) {
    const columns = inferColumnsForDataset(entries, meta.columns);
    return {
      total: meta.total || entries.length,
      columns,
      classes: meta.classes || countClassesInEntries(entries),
      meta: meta.meta || {},
    };
  }

  function inferColumnsForDataset(entries = [], fallback = []) {
    const set = new Set(Array.isArray(fallback) ? fallback.filter(Boolean) : []);
    entries.slice(0, 20).forEach((entry) => {
      Object.keys(entry || {}).forEach((key) => {
        if (!key || key.startsWith("__")) return;
        set.add(key);
      });
    });
    return Array.from(set);
  }

  function countClassesInEntries(entries = []) {
    const counts = {};
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const cls = String(entry.classe || entry.class || "Non renseigné").trim() || "Non renseigné";
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  function parseDateValue(value) {
    if (!value) return null;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return null;
    return timestamp;
  }

  function normalizeColumnKey(key) {
    if (!key) return "";
    return String(key)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function stripSuffixForPlan(normalized, suffixes = []) {
    if (!normalized || !suffixes.length) return null;
    const match = suffixes.find((suffix) => normalized.endsWith(suffix));
    if (!match) return null;
    const base = normalized.slice(0, normalized.length - match.length);
    return base || null;
  }

  function getApiKey() {
    const raw = refs.apiKeyInput?.value || "";
    return raw.trim();
  }

  async function callProvider(providerKey, apiKey, model, messages, options = {}) {
    if (providerKey === "gemini") {
      return callGemini(apiKey, model, messages, options);
    }
    return callOpenAI(apiKey, {
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 1200,
    });
  }

  async function callOpenAI(apiKey, body) {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = json?.error?.message || "Erreur API OpenAI.";
      throw new Error(message);
    }
    const choice = json.choices && json.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error("Réponse vide de l'IA.");
    }
    return choice.message.content.trim();
  }

  async function callGemini(apiKey, model, messages, options = {}) {
    const prompt = messagesToPlaintext(messages);
    const candidates = getGeminiModelCandidates(model);
    let lastError = null;
    let allModelsMissing = true;

    for (const candidate of candidates) {
      const result = await requestGeminiModel(apiKey, candidate, prompt, options);
      if (result.status === "success" && result.text) {
        rememberModelSelection(candidate, "gemini");
        return result.text;
      }
      if (result.status !== "model_missing") allModelsMissing = false;
      if (result.error) console.warn(result.error.logMessage || result.error.message || result.error);
      if (["invalid_key", "forbidden", "quota"].includes(result.status)) {
        throw result.error;
      }
      if (!lastError || result.status === "network" || result.status === "other_error") {
        lastError = result.error;
      }
    }

    if (allModelsMissing) {
      const fallbackModel = await findGeminiFallbackModel(apiKey);
      if (fallbackModel) {
        const fallbackResult = await requestGeminiModel(apiKey, fallbackModel, prompt, options);
        if (fallbackResult.status === "success" && fallbackResult.text) {
          rememberModelSelection(fallbackModel, "gemini");
          return fallbackResult.text;
        }
        if (fallbackResult.error) console.warn(fallbackResult.error.logMessage || fallbackResult.error.message || fallbackResult.error);
        if (["invalid_key", "forbidden", "quota"].includes(fallbackResult.status)) {
          throw fallbackResult.error;
        }
        lastError = fallbackResult.error || lastError;
      }
    }

    throw lastError || createFriendlyError(geminiUserMessage("generic"), "[Gemini] Aucune réponse exploitable.");
  }

  async function requestGeminiModel(apiKey, model, prompt, options = {}) {
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.max_tokens ?? 1024,
      },
    });
    let resp;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (networkErr) {
      return {
        status: "network",
        error: createFriendlyError(
          geminiUserMessage("network"),
          `[Gemini ${model}] ${networkErr && networkErr.message ? networkErr.message : networkErr}`,
          "network"
        ),
      };
    }
    const json = await resp.json().catch(() => ({}));
    const errorPayload = {
      status: resp.status,
      code: json?.error?.code,
      errorStatus: json?.error?.status,
      model,
    };
    if (resp.status === 404) {
      return {
        status: "model_missing",
        error: buildGeminiError("Modèle Gemini introuvable.", errorPayload),
      };
    }
    if (resp.status === 429) {
      return {
        status: "quota",
        error: buildGeminiError("Quota Gemini atteint.", errorPayload),
      };
    }
    if (resp.status === 401) {
      return {
        status: "invalid_key",
        error: buildGeminiError("Clé Gemini invalide.", errorPayload),
      };
    }
    if (resp.status === 403) {
      return {
        status: "forbidden",
        error: buildGeminiError("Accès refusé pour ce modèle Gemini.", errorPayload),
      };
    }
    if (!resp.ok) {
      return {
        status: "other_error",
        error: buildGeminiError(json?.error?.message || "Erreur API Gemini.", errorPayload),
      };
    }
    const text = extractGeminiText(json);
    if (!text) {
      return {
        status: "model_missing",
        error: buildGeminiError("Réponse Gemini vide.", {
          ...errorPayload,
          forceModelError: false,
          logMessage: `[Gemini ${model}] Réponse vide.`,
        }),
      };
    }
    return { status: "success", text };
  }

  async function findGeminiFallbackModel(apiKey) {
    try {
      const resp = await fetch(`${GEMINI_API_BASE}?key=${encodeURIComponent(apiKey)}`);
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => null);
      const models = Array.isArray(data?.models) ? data.models : [];
      const candidate = models
        .map((entry) => {
          const name = (entry?.name || "").replace(/^models\//, "");
          const supports = Array.isArray(entry?.supportedGenerationMethods)
            ? entry.supportedGenerationMethods.includes("generateContent")
            : false;
          return { name, supports };
        })
        .filter((item) => item.name && item.supports)
        .sort((a, b) => scoreGeminiModel(b.name) - scoreGeminiModel(a.name))[0];
      return candidate?.name || null;
    } catch (error) {
      console.warn("Impossible de récupérer la liste des modèles Gemini pour fallback.", error);
      return null;
    }
  }

  function scoreGeminiModel(name = "") {
    const lower = name.toLowerCase();
    if (lower.includes("flash")) return 3;
    if (lower.includes("pro")) return 2;
    return 1;
  }

  function extractGeminiText(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const first = parts.find((part) => typeof part?.text === "string" && part.text.trim());
    if (first) return first.text.trim();
    const fallback = parts.map((part) => (part && part.text ? String(part.text).trim() : "")).filter(Boolean).join("\n");
    return fallback.trim();
  }

  function setStatus(element, text, type) {
    if (!element) return;
    element.textContent = text || "";
    element.style.color =
      type === "success" ? "#138c27" : type === "error" ? "#b00020" : type === "info" ? "var(--sp-text,#111)" : "var(--sp-muted,#666)";
  }

  function messagesToPlaintext(messages = []) {
    return messages
      .map((msg) => {
        if (!msg) return "";
        const role = (msg.role || "user").toUpperCase();
        return `[${role}]\n${msg.content || ""}`;
      })
      .join("\n\n");
  }

  function buildModalSubtitle() {
    const meta = currentContext || {};
    const date = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : new Date().toLocaleString();
    const provider = meta.providerLabel ? ` • ${meta.providerLabel}` : "";
    const studentSegment = meta.studentLabel
      ? `${meta.studentLabel}${meta.studentClasse ? ` (${meta.studentClasse})` : ""} • `
      : "";
    if (meta.className) {
      return `${studentSegment}${meta.className}${
        meta.activityName ? ` • ${meta.activityName}` : ""
      }${meta.sessionName ? ` • ${meta.sessionName}` : ""}${provider} — ${date}`;
    }
    return `${studentSegment}Bilan généré le ${date}${provider}`;
  }

  function intentTitle(intent) {
    switch (intent) {
      case "difficulte":
        return "Diagnostic des difficultés";
      case "points_forts":
        return "Points forts & réussites";
      case "suivi":
        return "Préparer la séance suivante";
      case "question":
        return "Question sur la séance";
      case "eleve_session":
        return "Bilan élève (séance)";
      case "eleve_cycle":
        return "Bilan élève (cycle)";
      default:
        return "Bilan IA de la séance";
    }
  }

  function formatDateForFilename(value) {
    try {
      const date = new Date(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return "date";
    }
  }

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "bilan";
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function logDebug(message, payload) {
    if (!DEBUG_AI) return;
    if (payload !== undefined) console.log(DEBUG_PREFIX, message, payload);
    else console.log(DEBUG_PREFIX, message);
  }

  function logPromptDiagnostics(messages = [], students = [], columns = []) {
    if (!DEBUG_AI) return;
    const promptPreview = messages
      .map((msg) => `[${msg.role}] ${msg.content || ""}`)
      .join("\n\n");
    let byteLength = promptPreview.length;
    try {
      byteLength = new TextEncoder().encode(promptPreview).length;
    } catch {
      /* encoder not available */
    }
    const sampleStudent = students[0] ? Object.keys(students[0]) : [];
    logDebug("Prompt diagnostics", {
      totalMessages: messages.length,
      approxBytes: byteLength,
      sampleMessage: messages[1]?.content?.slice(0, 2000) || "",
      studentsSent: students.length,
      sampleStudentKeys: sampleStudent,
      columnsSent: columns,
    });
  }

  function debugSchemaConsistency(schema = []) {
    if (!DEBUG_AI) return;
    const schemaKeys = schema.map((section) => section.key);
    logDebug("Schema consistency check", {
      promptSchemaKeys: schemaKeys,
      rendererSchemaFallback: (window.ScanProfAIPrompt && window.ScanProfAIPrompt.SECTION_SCHEMA || []).map((s) => s.key),
    });
  }

  function logDictionaryDetection(details = {}) {
    if (!DEBUG_AI) return;
    logDebug("Dictionary detection snapshot", details);
  }
})();
