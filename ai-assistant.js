(function () {
  const STORAGE = {
    API_KEY: "scanprof_ai_api_key",
    MODEL: "scanprof_ai_model",
    NOTES: "scanprof_ai_notes",
    PROVIDER: "scanprof_ai_provider",
  };
  const PROVIDERS = {
    openai: {
      label: "OpenAI",
      defaultModel: "gpt-4o-mini",
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    },
    gemini: {
      label: "Gemini",
      defaultModel: "gemini-1.5-flash-latest",
      models: ["gemini-1.5-flash-latest", "gemini-1.5-pro-latest"],
    },
  };
  const DEFAULT_PROVIDER = "openai";
  const API_URL = "https://api.openai.com/v1/chat/completions";
  const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const MAX_ELEVES = 150;
  const CORE_COLUMNS = new Set(["nom", "prenom", "classe", "sexe", "distance", "vitesse", "vma", "temps_total"]);
  const SECTION_ICONS = {
    "Synthèse de la séance": "📘",
    "Élèves en difficulté": "⚠️",
    "Élèves à surveiller": "👀",
    "Points forts": "🌟",
    "Points à retravailler": "🔄",
    "Recommandations pour la séance suivante": "🧭",
    Différenciation: "🎯",
    "Réponse à la question": "💬",
    "Pistes concrètes": "🛠️",
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

  function initAssistant() {
    refs = {
      panel: document.getElementById("ai-panel"),
      apiKeyInput: document.getElementById("ai-api-key"),
      saveBtn: document.getElementById("ai-save-key-btn"),
      deleteBtn: document.getElementById("ai-delete-key-btn"),
      testBtn: document.getElementById("ai-test-key-btn"),
      notesField: document.getElementById("ai-session-notes"),
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
      modalLoading: document.getElementById("ai-modal-loading"),
      modalContent: document.getElementById("ai-modal-content"),
      copyBtn: document.getElementById("ai-copy-report-btn"),
      downloadBtn: document.getElementById("ai-download-report-btn"),
    };
    if (!refs.panel) return;

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
    refs.apiKeyInput?.addEventListener("change", handleKeyInputChange);
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
      if (storedKey) {
        setStatus(refs.keyStatus, "Clé chargée.", "success");
      }
    } catch {
      setStatus(refs.keyStatus, "Impossible de charger la clé enregistrée.", "error");
    }
  }

  function setProvider(providerKey, presetModel) {
    const key = PROVIDERS[providerKey] ? providerKey : DEFAULT_PROVIDER;
    const provider = PROVIDERS[key];
    currentProvider = key;
    currentModel = provider.models.includes(presetModel) ? presetModel : provider.defaultModel;
    try {
      localStorage.setItem(STORAGE.PROVIDER, key);
      localStorage.setItem(STORAGE.MODEL, currentModel);
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
      setStatus(refs.keyStatus, `Erreur de connexion : ${err.message}`, "error");
    }
  }

  async function handleAnalysis(intent = "bilan", questionText = "") {
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
      const summary = summarizeDataset();
      currentContext = {
        ...(summary.meta || {}),
        className:
          (summary.meta && summary.meta.className) ||
          (summary.classes && summary.classes[0] && summary.classes[0].name) ||
          "",
        activityName: (summary.meta && summary.meta.activityName) || "",
        sessionName: (summary.meta && summary.meta.sessionName) || "",
        providerLabel,
        intent,
        updatedAt:
          (summary.meta && (summary.meta.updatedAt || summary.meta.savedAt)) || new Date().toISOString(),
      };
      lastQuestionText = intent === "question" ? (questionText || "").trim() : "";
      const sliced = dataset.slice(0, MAX_ELEVES).map(cleanEntry);
      const analysisInput = {
        contexte: buildContext(
          summary,
          notes,
          dataset.length,
          sliced.length,
          providerKey,
          intent,
          lastQuestionText
        ),
        eleves: sliced,
        intent,
        questionText: lastQuestionText,
      };
      const builder = window.ScanProfAIPrompt;
      if (!builder || typeof builder.buildPrompt !== "function") {
        throw new Error("Module de prompt introuvable.");
      }
      const { messages, schema } = builder.buildPrompt({ analysisInput, mode: intent });
      const model = getSelectedModel();
      const responseText = await callProvider(providerKey, apiKey, model, messages, {
        temperature: intent === "difficulte" ? 0.15 : 0.25,
        max_tokens: 1200,
        intent,
      });
      const parsed = parseReport(responseText);
      renderReport(schema, parsed, responseText);
      setStatus(statusTarget, "Analyse terminée 🎉", "success");
      setModalLoading(false);
      setPanelBusy(false);
    } catch (err) {
      setStatus(statusTarget, `Analyse impossible : ${err.message}`, "error");
      renderFallbackError(err.message);
      setModalLoading(false);
      setPanelBusy(false);
    }
  }

  function buildContext(summary, notes, totalEntries, usedEntries, providerKey, intent, questionText) {
    const meta = summary.meta || {};
    const bestClass = meta?.className || summary.classes?.[0]?.name || "";
    const info = {
      date_iso: new Date().toISOString(),
      nb_eleves_total: totalEntries,
      nb_eleves_transmis: usedEntries,
      colonnes: summary.columns || [],
      repartition_classes: summary.classes || [],
      classe: bestClass,
      activite: meta?.activityName || "",
      seance: meta?.sessionName || "",
      notes_enseignant: notes || "",
    };
    if (meta?.updatedAt) info.session_mise_a_jour = meta.updatedAt;
    const providerLabel = PROVIDERS[providerKey]?.label;
    if (providerLabel) info.fournisseur = providerLabel;
    if (intent) info.intent = intent;
    if (questionText) info.question_utilisateur = questionText;
    if (totalEntries > usedEntries) {
      info.tronque = `Seuls ${usedEntries} élèves sur ${totalEntries} ont été envoyés pour limiter la taille du prompt.`;
    }
    return info;
  }

  function renderReport(schema, report, fallbackText) {
    const sections = Array.isArray(schema) ? schema : window.ScanProfAIPrompt.SECTION_SCHEMA || [];
    const container = refs.modalContent;
    if (!container) return;
    if (!report) {
      renderPlainTextFallback(fallbackText);
      return;
    }
    let html = sections
      .map((section) => renderSection(section.label, report && report[section.key]))
      .join("");
    if (lastIntent === "question" && lastQuestionText) {
      html =
        `<article class="ai-modal__section"><h3>Question posée</h3><p>${escapeHtml(lastQuestionText)}</p></article>` +
        html;
    }
    container.innerHTML = html;
    container.classList.remove("sp-hidden");
    refs.modalLoading?.classList.add("sp-hidden");
    refs.modalTitle.textContent = intentTitle(lastIntent);
    refs.modalSubtitle.textContent = buildModalSubtitle();
    lastReportSections = sections.map((section) => ({
      label: section.label,
      content: valueToPlainText(report && report[section.key]),
    }));
    lastReportText = sections
      .map(
        (section) =>
          `${section.label}\n${"-".repeat(section.label.length)}\n${valueToPlainText(report && report[section.key]) || "Aucune information disponible."}`
      )
      .join("\n\n");
    lastReportText = lastReportText || fallbackText || "Aucun résultat exploitable.";
    if (lastIntent === "question" && lastQuestionText) {
      lastReportText = `Question posée\n----------------\n${lastQuestionText}\n\n${lastReportText}`;
    }
  }

  function renderPlainTextFallback(text) {
    if (!refs.modalContent) return;
    const safeText = escapeHtml(text || "Réponse vide.");
    let html = `<article class="ai-modal__section"><h3>Bilan textuel</h3><p>${safeText.replace(/\n/g, "<br>")}</p></article>`;
    if (lastIntent === "question" && lastQuestionText) {
      html =
        `<article class="ai-modal__section"><h3>Question posée</h3><p>${escapeHtml(lastQuestionText)}</p></article>` +
        html;
    }
    refs.modalContent.innerHTML = html;
    refs.modalContent.classList.remove("sp-hidden");
    refs.modalLoading?.classList.add("sp-hidden");
    refs.modalTitle.textContent = intentTitle(lastIntent);
    refs.modalSubtitle.textContent = buildModalSubtitle();
    lastReportText = text || "";
    if (lastIntent === "question" && lastQuestionText) {
      lastReportText = `Question posée\n----------------\n${lastQuestionText}\n\n${lastReportText}`;
    }
    lastReportSections = [{ label: "Bilan textuel", content: text || "" }];
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
    return `<p>${escapeHtml(String(value))}</p>`;
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

  function parseReport(responseText) {
    if (!responseText) return null;
    try {
      return JSON.parse(responseText);
    } catch {
      return null;
    }
  }

  function renderFallbackError(message) {
    if (!refs.modalContent) return;
    let html = `<article class="ai-modal__section"><h3>Erreur</h3><p>${escapeHtml(
      message || "Analyse indisponible."
    )}</p></article>`;
    if (lastIntent === "question" && lastQuestionText) {
      html =
        `<article class="ai-modal__section"><h3>Question posée</h3><p>${escapeHtml(lastQuestionText)}</p></article>` +
        html;
    }
    refs.modalContent.innerHTML = html;
    refs.modalContent.classList.remove("sp-hidden");
    refs.modalLoading?.classList.add("sp-hidden");
    lastReportText = message || "";
    if (lastIntent === "question" && lastQuestionText) {
      lastReportText = `Question posée\n----------------\n${lastQuestionText}\n\n${lastReportText}`;
    }
    lastReportSections = [{ label: "Erreur", content: message || "" }];
    refs.modalTitle.textContent = intentTitle(lastIntent);
    refs.modalSubtitle.textContent = buildModalSubtitle();
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
    if (!refs.panel) return;
    refs.panel.classList.toggle("ai-panel--busy", !!isBusy);
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
    const meta = summary.meta || {};
    const prominentClass = meta.className || (summary.classes && summary.classes[0] && summary.classes[0].name) || "Non renseignée";
    refs.summaryClass.textContent = prominentClass || "Non renseignée";
    refs.summaryCount.textContent = summary.total || 0;
    const inferredTypes = inferTypeLabels(summary.columns || []);
    refs.summaryTypes.textContent = inferredTypes.length ? inferredTypes.join(", ") : "Mesures standards";
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

  function getSelectedProviderKey() {
    return currentProvider;
  }

  function getProviderConfig() {
    return { key: currentProvider, ...PROVIDERS[currentProvider] };
  }

  function getSelectedModel() {
    return currentModel;
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
    return clone;
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
    const text = messagesToPlaintext(messages);
    const body = {
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.max_tokens ?? 1024,
      },
    };
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = json?.error?.message || "Erreur API Gemini.";
      throw new Error(message);
    }
    const candidate = json.candidates && json.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;
    const output = Array.isArray(parts) ? parts.map((part) => part.text || "").join("\n") : "";
    if (!output.trim()) throw new Error("Réponse vide de Gemini.");
    return output.trim();
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
