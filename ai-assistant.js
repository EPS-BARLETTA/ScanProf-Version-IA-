(function () {
  const STORAGE = {
    API_KEY: "scanprof_ai_api_key",
    MODEL: "scanprof_ai_model",
    NOTES: "scanprof_ai_notes",
    PROVIDER: "scanprof_ai_provider",
    INTERPRETATION: "scanprof_ai_interpretation_hints",
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
  const MAX_EXTRA_COLUMNS = 4;
  const CORE_COLUMNS = new Set(["nom", "prenom", "classe", "sexe", "distance", "vitesse", "vma", "temps_total"]);
  const INCOMPLETE_RESPONSE_ERROR = "AI_INCOMPLETE_RESPONSE";
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
  };

  let refs = {};
  let lastReportText = "";
  let lastReportSections = [];
  let currentContext = {};
  let currentProvider = DEFAULT_PROVIDER;
  let currentModel = PROVIDERS[DEFAULT_PROVIDER].defaultModel;
  let lastIntent = "bilan";
  let lastQuestionText = "";

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

  function buildInterpretationSupport({ columns = [], activityName = "", manualText = "", dictionary = null }) {
    const cleanColumns = (columns || []).map((col) => (col == null ? "" : String(col))).filter(Boolean);
    const trimmedManual = (manualText || "").trim();
    const guides = [];
    if (cleanColumns.length) {
      guides.push(`Colonnes détectées : ${cleanColumns.join(", ")}`);
    }
    if (dictionary && dictionary.columns) {
      const entries = Object.entries(dictionary.columns)
        .map(([key, desc]) => `${key} : ${desc}`)
        .slice(0, 12);
      if (entries.length) {
        const label = dictionary.label || dictionary.key || "Activité";
        guides.push(`Dictionnaire ${label} :\n${entries.join("\n")}`);
      }
      if (dictionary.notes && dictionary.notes.length) {
        guides.push(`Repères activité : ${dictionary.notes.join(" ")}`);
      }
    }
    if (trimmedManual) {
      guides.push(`Indications de l'enseignant :\n${trimmedManual}`);
    }
    return {
      activityName,
      columns: cleanColumns,
      dictionary: dictionary
        ? { key: dictionary.key, label: dictionary.label || "", columns: dictionary.columns || {}, notes: dictionary.notes || [] }
        : null,
      manual: trimmedManual,
      guides,
    };
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
      keyStatus: document.getElementById("ai-key-status"),
      runStatus: document.getElementById("ai-run-status"),
      questionInput: document.getElementById("ai-question-input"),
      questionBtn: document.getElementById("ai-question-btn"),
      questionStatus: document.getElementById("ai-question-status"),
      summaryClass: document.getElementById("ai-summary-class"),
      summaryCount: document.getElementById("ai-summary-count"),
      summaryTypes: document.getElementById("ai-summary-types"),
      actionButtons: {
        bilan: document.getElementById("ai-action-bilan"),
        difficulte: document.getElementById("ai-action-difficulte"),
        points: document.getElementById("ai-action-points"),
        suivi: document.getElementById("ai-action-suivi"),
      },
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
      copyBtn: document.getElementById("ai-copy-report-btn"),
      downloadBtn: document.getElementById("ai-download-report-btn"),
    };
    if (!refs.drawerPanel) return;

    loadStoredSettings();
    bindEvents();
    updateSummaryUI();
    const eventName = (window.ScanProfParticipants && window.ScanProfParticipants.eventName) || "scanprof:dataset-changed";
    document.addEventListener(eventName, () => updateSummaryUI());
  }

  function bindEvents() {
    refs.saveBtn?.addEventListener("click", saveApiKey);
    refs.deleteBtn?.addEventListener("click", deleteApiKey);
    refs.testBtn?.addEventListener("click", testConnection);
    refs.actionButtons?.bilan?.addEventListener("click", () => handleAnalysis("bilan"));
    refs.actionButtons?.difficulte?.addEventListener("click", () => handleAnalysis("difficulte"));
    refs.actionButtons?.points?.addEventListener("click", () => handleAnalysis("points_forts"));
    refs.actionButtons?.suivi?.addEventListener("click", () => handleAnalysis("suivi"));
    refs.questionBtn?.addEventListener("click", handleQuestion);
    refs.notesField?.addEventListener("input", handleNotesChange);
    refs.interpretationField?.addEventListener("input", handleInterpretationChange);
    refs.apiKeyInput?.addEventListener("change", handleKeyInputChange);
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
    } catch {
      setStatus(refs.keyStatus, "Impossible de charger la clé enregistrée.", "error");
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
    console.log("[ScanProf IA] handleAnalysis invoked from scanprofV2/ai-assistant.js (intent:", intent, ")");
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
    const { key: providerKey, label: providerLabel } = getProviderConfig();

    setPanelBusy(true);
    openModal();
    setModalLoading(true);
    setStatus(statusTarget, `Analyse en cours via ${providerLabel}...`, "info");

    try {
      const notes = refs.notesField?.value || "";
      const storedContext = getStoredAIContext();
      const summary = summarizeDataset();
      const manualInterpretation = refs.interpretationField?.value || localStorage.getItem(STORAGE.INTERPRETATION) || "";
      const sliced = dataset.slice(0, MAX_ELEVES).map(cleanEntry);
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
        totalEntries: dataset.length,
        usedEntries: sliced.length,
        studentCount: dataset.length,
        sessionDate: storedContext?.date || null,
        updatedAt:
          (summary.meta && (summary.meta.updatedAt || summary.meta.savedAt)) || new Date().toISOString(),
      };
      const activityDictionary = getActivityDictionary(currentContext.activityName || storedContext.activite || "");
      const interpretationSupport = buildInterpretationSupport({
        columns: summary.columns || [],
        activityName: currentContext.activityName || "",
        manualText: manualInterpretation,
        dictionary: activityDictionary,
      });
      lastQuestionText = intent === "question" ? (questionText || "").trim() : "";
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
          interpretationSupport
        ),
        eleves: sliced,
        intent,
        questionText: lastQuestionText,
        interpretation: interpretationSupport,
      };
      const builder = window.ScanProfAIPrompt;
      if (!builder || typeof builder.buildPrompt !== "function") {
        throw new Error("Module de prompt introuvable.");
      }
      const { messages, schema } = builder.buildPrompt({ analysisInput, mode: intent });
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
    interpretationSupport
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
    if (totalEntries > usedEntries) {
      info.tronque = `Seuls ${usedEntries} élèves sur ${totalEntries} ont été envoyés pour limiter la taille du prompt.`;
    }
    return info;
  }

  async function generateAIResponseWithRetry({ providerKey, apiKey, model, messages, schema, options = {} }) {
    let attempt = 0;
    let currentMessages = messages;
    while (attempt < 2) {
      try {
        const responseText = await callProvider(providerKey, apiKey, model, currentMessages, options);
        return processAIResponse(schema, responseText);
      } catch (err) {
        if (isIncompleteResponseError(err) && attempt === 0) {
          attempt += 1;
          currentMessages = shortenMessagesForRetry(messages);
          continue;
        }
        throw err;
      }
    }
    throw createIncompleteResponseError();
  }

  function shortenMessagesForRetry(messages = []) {
    return messages.map((msg, index) => {
      if (index === messages.length - 1 && msg.role === "user") {
        return {
          ...msg,
          content: `${msg.content}\n\nConsigne additionnelle : Réponds en JSON strict très court (une phrase par champ, listes de 2 éléments maximum).`,
        };
      }
      return msg;
    });
  }

  function processAIResponse(schema, rawText) {
    const cleaned = stripCodeFences(rawText);
    if (!cleaned) {
      throw createIncompleteResponseError("Réponse IA vide, merci de relancer l’analyse.");
    }
    const parsed = tryParseJson(cleaned);
    if (parsed && typeof parsed === "object") {
      return { type: "structured", data: parsed, raw: cleaned };
    }
    if (looksLikeJson(cleaned)) {
      throw createIncompleteResponseError("Réponse IA incomplète, merci de relancer l’analyse.");
    }
    if (!cleaned.trim()) {
      throw createIncompleteResponseError("Réponse IA vide, merci de relancer l’analyse.");
    }
    return { type: "text", text: cleaned.trim(), raw: cleaned };
  }

  function createIncompleteResponseError(message) {
    const err = new Error(message || "Réponse IA incomplète, merci de relancer l’analyse.");
    err.code = INCOMPLETE_RESPONSE_ERROR;
    err.userMessage = err.message;
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

  function renderReport(schema, processed) {
    if (!processed) {
      renderPlainTextFallback("Réponse IA indisponible.");
      return;
    }
    if (processed.type === "structured") {
      renderStructuredReport(schema, processed.data);
    } else {
      renderPlainTextFallback(processed.text || "");
    }
  }

  function renderStructuredReport(schema, data) {
    const container = refs.modalContent;
    if (!container) return;
    const list = Array.isArray(schema) && schema.length ? schema : window.ScanProfAIPrompt.SECTION_SCHEMA || [];
    const entries = list.map((section) => {
      const value = data ? data[section.key] : null;
      return {
        label: section.label,
        value,
        content: valueToPlainText(value) || "Aucune information disponible.",
      };
    });
    const displayEntries = addQuestionSection(entries);
    container.innerHTML = displayEntries.map((entry) => renderSection(entry.label, entry.value)).join("");
    updateReportState(displayEntries.map(({ label, content }) => ({ label, content })));
  }

  function renderPlainTextFallback(text) {
    if (!refs.modalContent) return;
    const content = (text && text.trim()) || "Aucun résultat exploitable.";
    const sections = addQuestionSection([{ label: "Bilan textuel", value: content, content }]);
    refs.modalContent.innerHTML = sections.map((entry) => renderSection(entry.label, entry.value)).join("");
    updateReportState(sections.map(({ label, content: value }) => ({ label, content: value })));
  }

  function renderSection(label, value) {
    const safeLabel = escapeHtml(label);
    const content = formatValueAsHtml(value);
    const icon = SECTION_ICONS[label] || "📌";
    return `<article class="ai-modal__section"><div class="ai-modal__section-header"><span class="ai-result-icon">${icon}</span><h3>${safeLabel}</h3></div>${content}</article>`;
  }

  function formatValueAsHtml(value) {
    if (!value && value !== 0) {
      return `<p>Aucune information disponible.</p>`;
    }
    if (Array.isArray(value)) {
      if (!value.length) return `<p>Aucune information disponible.</p>`;
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
    const count = meta.usedEntries || meta.totalEntries || meta.studentCount;
    if (count) {
      lines.push(`<div class="ai-context__line">👥 ${count} élève(s) analysé(s)</div>`);
    }
    const dateSource = meta.updatedAt || meta.sessionDate || meta.date || meta.date_iso;
    if (dateSource) {
      const date = new Date(dateSource);
      lines.push(`<div class="ai-context__line">🕒 ${escapeHtml(date.toLocaleString())}</div>`);
    }
    if (!lines.length) {
      refs.modalContext.classList.add("sp-hidden");
      refs.modalContext.innerHTML = "";
      return;
    }
    refs.modalContext.innerHTML = lines.join("");
    refs.modalContext.classList.remove("sp-hidden");
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

  function cleanEntry(entry) {
    if (!entry || typeof entry !== "object") return entry;
    const clone = {};
    Object.keys(entry).forEach((key) => {
      if (key.startsWith("__")) return;
      clone[key] = entry[key];
    });
    return compactEntry(clone);
  }

  function compactEntry(entry) {
    if (!entry || typeof entry !== "object") return entry;
    const essentials = [
      "nom",
      "prenom",
      "classe",
      "sexe",
      "distance",
      "vitesse",
      "vma",
      "temps_total",
    ];
    const result = {};
    essentials.forEach((field) => {
      if (entry[field] != null && entry[field] !== "") result[field] = entry[field];
    });
    let extrasAdded = 0;
    Object.keys(entry).forEach((key) => {
      if (essentials.includes(key)) return;
      if (extrasAdded >= MAX_EXTRA_COLUMNS) return;
      result[key] = entry[key];
      extrasAdded += 1;
    });
    return result;
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
    if (meta.className) {
      return `${meta.className}${meta.activityName ? ` • ${meta.activityName}` : ""}${meta.sessionName ? ` • ${meta.sessionName}` : ""}${provider} — ${date}`;
    }
    return `Bilan généré le ${date}${provider}`;
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
})();
