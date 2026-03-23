(function () {
  const OPEN_EVENT = "scanprof:open-dictionary";
  const DICTIONARY_EVENT = "scanprof:dictionaries-changed";
  const STATE_EVENT = "scanprof:dictionary-state-changed";
  const AI_CONTEXT_KEY = "scanprof_ai_context";
  const api = window.ScanProfAIDictionaries;
  if (!api) {
    console.error("[ScanProf Dictionary] API non chargée (ScanProfAIDictionaries introuvable).");
    return;
  }

  const state = {
    selectedId: "",
    editingId: null,
    idTouched: false,
    currentActivityName: "",
  };
  const refs = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    console.debug("[ScanProf Dictionary] init start", { hasApi: !!api });
    refs.openBtn = document.getElementById("ai-dictionary-open-btn");
    refs.modal = document.getElementById("ai-dictionary-modal");
    refs.closeBtn = document.getElementById("ai-dictionary-close");
    refs.body = document.querySelector("#ai-dictionary-modal .ai-dictionary-body");
    refs.currentContent = document.getElementById("ai-dictionary-current-content");
    refs.currentAddBtn = document.getElementById("ai-dictionary-add-current-btn");
    refs.select = document.getElementById("ai-dictionary-select");
    refs.selectedDetails = document.getElementById("ai-dictionary-selected-details");
    refs.addBtn = document.getElementById("ai-dictionary-add-btn");
    refs.editBtn = document.getElementById("ai-dictionary-edit-btn");
    refs.removeBtn = document.getElementById("ai-dictionary-remove-btn");
    refs.editorWrapper = document.getElementById("ai-dictionary-editor");
    refs.form = document.getElementById("ai-dictionary-form");
    refs.formTitle = document.getElementById("ai-dictionary-editor-title");
    refs.formName = document.getElementById("dict-app-name");
    refs.formId = document.getElementById("dict-app-id");
    refs.formKeywords = document.getElementById("dict-app-keywords");
    refs.formDescription = document.getElementById("dict-app-description");
    refs.formAbbr = document.getElementById("dict-app-abbreviations");
    refs.formSuffixes = document.getElementById("dict-app-suffixes");
    refs.formLevels = document.getElementById("dict-app-levels");
    refs.formInterpretation = document.getElementById("dict-app-interpretation");
    refs.formNotes = document.getElementById("dict-app-notes");
    refs.formConfidence = document.getElementById("dict-app-confidence");
    refs.formInfer = document.getElementById("dict-app-aiinfer");
    refs.formTeacherContext = document.getElementById("dict-app-teacher-context");
    refs.formLimits = document.getElementById("dict-app-limits");
    refs.formExamples = document.getElementById("dict-app-examples");
    refs.formComparisons = document.getElementById("dict-app-comparisons");
    refs.formSignals = document.getElementById("dict-app-signals");
    refs.formStatus = document.getElementById("dict-form-status");
    refs.formCancel = document.getElementById("dict-form-cancel");
    refs.exportBtn = document.getElementById("ai-dictionary-export-btn");
    refs.importBtn = document.getElementById("ai-dictionary-import-btn");
    refs.importInput = document.getElementById("ai-dictionary-import-input");
    refs.feedback = document.getElementById("ai-dictionary-feedback");
    refs.detectedLabel = document.getElementById("ai-dictionary-detected-label");
    refs.appliedLabel = document.getElementById("ai-dictionary-applied-label");
    refs.stateComment = document.getElementById("ai-dictionary-state-comment");
    refs.applyBtn = document.getElementById("ai-dictionary-apply-btn");
    refs.resetBtn = document.getElementById("ai-dictionary-reset-btn");

    if (!refs.modal) {
      console.error("[ScanProf Dictionary] Modal introuvable (#ai-dictionary-modal).");
      return;
    }

    refs.openBtn?.addEventListener("click", () => openModal());
    refs.closeBtn?.addEventListener("click", closeModal);
    refs.modal.addEventListener("click", (event) => {
      if (event.target === refs.modal) closeModal();
    });
    refs.currentAddBtn?.addEventListener("click", handleCurrentAddClick);
    refs.addBtn?.addEventListener("click", () => startEditor());
    refs.editBtn?.addEventListener("click", () => startEditor({ dictionaryId: state.selectedId || null }));
    refs.removeBtn?.addEventListener("click", handleRemoveSelected);
    refs.select?.addEventListener("change", handleSelectChange);
    refs.form?.addEventListener("submit", handleFormSubmit);
    refs.formCancel?.addEventListener("click", () => toggleEditor(false));
    refs.exportBtn?.addEventListener("click", exportDictionaries);
    refs.importBtn?.addEventListener("click", () => refs.importInput?.click());
    refs.importInput?.addEventListener("change", handleImportFile);
    refs.formName?.addEventListener("input", handleNameInput);
    refs.formId?.addEventListener("input", handleIdInput);
    refs.applyBtn?.addEventListener("click", handleApplySelected);
    refs.resetBtn?.addEventListener("click", handleResetManual);

    window.addEventListener(OPEN_EVENT, (event) => openModal(event?.detail?.activityName || ""));
    window.addEventListener(DICTIONARY_EVENT, () => {
      renderSelector();
      renderCurrentSection();
      if (!refs.editorWrapper?.classList.contains("sp-hidden") && state.editingId) {
        populateForm(api.getDictionaryById(state.editingId));
      }
    });
    window.addEventListener(STATE_EVENT, () => renderCurrentSection());
    const datasetEvent = (window.ScanProfParticipants && window.ScanProfParticipants.eventName) || "scanprof:dataset-changed";
    document.addEventListener(datasetEvent, () => {
      state.currentActivityName = getCurrentActivityName();
      renderCurrentSection(state.currentActivityName);
    });

    renderModal();
  }

  function openModal(activityName) {
    if (!refs.modal) return;
    console.debug("[ScanProf Dictionary] openModal", { activityName: activityName || null });
    refs.modal.classList.remove("sp-hidden");
    renderModal(activityName);
  }

  function closeModal() {
    refs.modal?.classList.add("sp-hidden");
    toggleEditor(false);
  }

  function renderModal(activityName) {
    console.debug("[ScanProf Dictionary] renderModal", { incomingActivity: activityName || null });
    state.currentActivityName = activityName || state.currentActivityName || getCurrentActivityName();
    renderCurrentSection(state.currentActivityName);
    renderSelector();
    toggleEditor(false);
    setFeedback("");
  }

  function renderCurrentSection(activityNameOverride) {
    if (!refs.currentContent) return;
    const activityName = activityNameOverride || getCurrentActivityName();
    state.currentActivityName = activityName || "";
    const dictionary = activityName ? api.getDictionaryForActivity(activityName) : null;
    console.debug("[ScanProf Dictionary] Render current section", {
      activityName: state.currentActivityName || null,
      dictionaryId: dictionary?.id || null,
    });
    const nameDisplay = activityName ? `Activité détectée : <strong>${escapeHtml(activityName)}</strong>` : "Activité non renseignée.";
    let content = `<p>${nameDisplay}</p>`;
    if (dictionary) {
      content += renderDictionaryDetails(dictionary);
      if (refs.currentAddBtn) {
        refs.currentAddBtn.textContent = "Compléter cette app";
        refs.currentAddBtn.dataset.dictionaryId = dictionary.id;
        refs.currentAddBtn.dataset.activityName = activityName || "";
        refs.currentAddBtn.disabled = false;
      }
    } else if (activityName) {
      content += `<p class="ai-panel__note">Cette activité n’a pas encore de dictionnaire. Ajoutez-en un pour aider l’IA et les enseignants.</p>`;
      if (refs.currentAddBtn) {
        refs.currentAddBtn.textContent = "Ajouter cette app";
        refs.currentAddBtn.dataset.dictionaryId = "";
        refs.currentAddBtn.dataset.activityName = activityName;
        refs.currentAddBtn.disabled = false;
      }
    } else {
      content += `<p class="ai-panel__note">Chargez d'abord une activité via les classes pour pouvoir lier un dictionnaire.</p>`;
      if (refs.currentAddBtn) {
        refs.currentAddBtn.textContent = "Ajouter une app";
        refs.currentAddBtn.dataset.dictionaryId = "";
        refs.currentAddBtn.dataset.activityName = "";
        refs.currentAddBtn.disabled = true;
      }
    }
    refs.currentContent.innerHTML = content;
    updateDictionaryMeta({
      activityName,
      dictionary,
      stateSnapshot: getDictionaryStateSnapshot(),
    });
    updateApplyResetControls();
  }

  function renderSelector() {
    console.debug("[ScanProf Dictionary] renderSelector invoked");
    if (!refs.select) {
      console.error("[ScanProf Dictionary] refs.select introuvable.");
      return;
    }
    const previous = refs.select.value || state.selectedId || "";
    const forcedOptions = [
      { id: "", label: "Sélectionner...", selected: previous === "" },
      { id: "cross_training", label: "Cross Training", selected: previous === "cross_training" },
      { id: "climb_track", label: "Climb Track", selected: previous === "climb_track" },
      { id: "arcathlon_v2", label: "ArcAthlon V2", selected: previous === "arcathlon_v2" },
      { id: "laser_run", label: "Laser Run", selected: previous === "laser_run" },
    ]
      .map(
        (entry, index) =>
          `<option value="${escapeHtml(entry.id)}"${entry.selected || (index === 0 && !previous) ? " selected" : ""}>${escapeHtml(entry.label)}</option>`
      )
      .join("");
    refs.select.innerHTML = forcedOptions;
    state.selectedId = refs.select.value || "";
    console.debug("[ScanProf Dictionary] forced select content", {
      outerHTML: refs.select.outerHTML,
      optionsLength: refs.select.options.length,
      selectedId: state.selectedId,
    });
    renderSelectedDetails();
    updateApplyResetControls();
  }

  function renderSelectedDetails() {
    if (!refs.selectedDetails) return;
    const dictionary = state.selectedId ? api.getDictionaryById(state.selectedId) : null;
    if (!dictionary) {
      refs.selectedDetails.innerHTML = `<p>Sélectionnez une app pour consulter son dictionnaire.</p>`;
      refs.editBtn.disabled = true;
      refs.removeBtn.disabled = true;
      updateApplyResetControls();
      return;
    }
    refs.selectedDetails.innerHTML = renderDictionaryDetails(dictionary);
    refs.editBtn.disabled = false;
    refs.removeBtn.disabled = dictionary.source !== "custom";
    updateApplyResetControls();
  }

  function getCatalogueDictionaries() {
    if (!api) return [];
    let dictionaries = [];
    let error = null;
    try {
      dictionaries = api.list({ includeSource: true }) || [];
    } catch (err) {
      error = err;
      console.error("[ScanProf Dictionary] Impossible de charger les dictionnaires personnalisés :", err);
      dictionaries = [];
    }
    if (!dictionaries.length) {
      dictionaries = getDefaultCatalogue();
    }
    logCatalogueDebug({
      fetchedCount: Array.isArray(dictionaries) ? dictionaries.length : 0,
      hadError: !!error,
      defaultKeys: api.DEFAULT_DICTIONARIES ? Object.keys(api.DEFAULT_DICTIONARIES) : ["cross_training", "climb_track", "arcathlon_v2", "laser_run"],
      labels: (dictionaries || []).map((dict) => dict.label || dict.id),
    });
    return dictionaries;
  }

  function getDefaultCatalogue() {
    if (api?.DEFAULT_DICTIONARIES) {
      return Object.values(api.DEFAULT_DICTIONARIES).map((dict) => ({ ...dict, source: dict.source || "default" }));
    }
    const fallbackLabels = {
      cross_training: "Cross Training",
      climb_track: "Climb Track",
      arcathlon_v2: "ArcAthlon V2",
      laser_run: "Laser Run",
    };
    return Object.entries(fallbackLabels).map(([id, label]) => ({ id, label, source: "default" }));
  }

  function buildOptionMarkup(dict, previousId) {
    if (!dict || !dict.id) return "";
    const selected = dict.id === previousId ? " selected" : "";
    const suffix =
      dict.source === "custom" ? " (perso)" : dict.source === "default" || !dict.source ? " (défaut)" : "";
    return `<option value="${escapeHtml(dict.id)}"${selected}>${escapeHtml(dict.label || dict.id)}${suffix}</option>`;
  }

  function buildStaticFallbackOptions(previousId = "") {
    return getDefaultCatalogue()
      .map((dict) => buildOptionMarkup(dict, previousId))
      .join("");
  }

  function logCatalogueDebug(info) {
    if (!window || !window.console || typeof console.debug !== "function") return;
    console.debug("[ScanProf Dictionary] Catalogue", info);
  }

  function renderDictionaryDetails(dict) {
    if (!dict) {
      return `<p>Aucune donnée disponible.</p>`;
    }
    const chipParts = [dict.source === "custom" ? "Personnalisé" : "Défaut"];
    if (dict.confidence && dict.confidence !== "unknown") {
      chipParts.push(`Confiance : ${dict.confidence}`);
    }
    if (dict.teacher_context_required) chipParts.push("Contexte enseignant requis");
    if (dict.ai_may_infer) chipParts.push("IA autorisée à déduire");
    const chips = chipParts.map((label) => `<span class="ai-dictionary-chip">${escapeHtml(label)}</span>`).join(" ");
    const sections = [];
    if (dict.description) sections.push(`<div><strong>Description</strong><p>${escapeHtml(dict.description)}</p></div>`);
    const abbr = renderListFromObject(dict.abbreviations, "Codes");
    if (abbr) sections.push(abbr);
    const suffix = renderListFromObject(dict.suffixes, "Suffixes");
    if (suffix) sections.push(suffix);
    if (dict.levels?.length) {
      sections.push(renderListFromArray(dict.levels, "Niveaux / pratiques"));
    }
    if (dict.practices?.length) {
      sections.push(renderListFromArray(dict.practices, "Pratiques"));
    }
    if (dict.interpretation?.length) {
      sections.push(renderListFromArray(dict.interpretation, "Règles d’interprétation"));
    }
    if (dict.notes?.length) {
      sections.push(renderListFromArray(dict.notes, "Notes pédagogiques"));
    }
    if (dict.comparison_rules?.length) {
      sections.push(renderListFromArray(dict.comparison_rules, "Comparaisons autorisées"));
    }
    if (dict.signal_rules?.length) {
      sections.push(renderListFromArray(dict.signal_rules, "Signaux pédagogiques"));
    }
    if (dict.limits?.length) {
      sections.push(renderListFromArray(dict.limits, "Limites / questions"));
    }
    if (dict.examples?.length) {
      sections.push(renderListFromArray(dict.examples, "Exemples"));
    }
    return `${chips}<div class="ai-dictionary-details__grid">${sections.join("") || "<p>Aucune donnée.</p>"}</div>`;
  }

  function renderListFromObject(record, title) {
    const entries = Object.entries(record || {});
    if (!entries.length) return "";
    const list = entries.map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong> : ${escapeHtml(value)}</li>`).join("");
    return `<div><strong>${escapeHtml(title)}</strong><ul>${list}</ul></div>`;
  }

  function renderListFromArray(list, title) {
    if (!Array.isArray(list) || !list.length) return "";
    const items = list.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    return `<div><strong>${escapeHtml(title)}</strong><ul>${items}</ul></div>`;
  }

  function handleApplySelected() {
    if (!state.selectedId) {
      setFeedback("Choisissez un dictionnaire avant de l’appliquer.", "error");
      return;
    }
    const manager = window.ScanProfDictionaryState;
    if (!manager || typeof manager.applyForCurrentContext !== "function") {
      setFeedback("Application du référentiel impossible (contexte manquant).", "error");
      return;
    }
    const result = manager.applyForCurrentContext(state.selectedId);
    if (!result?.success) {
      setFeedback(result?.message || "Impossible d’appliquer ce référentiel.", "error");
      return;
    }
    const dictionary = api.getDictionaryById(state.selectedId);
    setFeedback(`Référentiel ${dictionary?.label || state.selectedId} appliqué à cette séance.`, "success");
    renderCurrentSection();
    renderSelector();
  }

  function handleResetManual() {
    const manager = window.ScanProfDictionaryState;
    if (!manager || typeof manager.clearForCurrentContext !== "function") {
      setFeedback("Impossible de revenir à la détection automatique.", "error");
      return;
    }
    const result = manager.clearForCurrentContext();
    if (!result?.success) {
      setFeedback(result?.message || "Impossible de réinitialiser le référentiel.", "error");
      return;
    }
    setFeedback("Retour à la détection automatique.", "success");
    renderCurrentSection();
    renderSelector();
  }

  function getDictionaryStateSnapshot() {
    const context = getStoredAIContext();
    const manager = window.ScanProfDictionaryState;
    if (!context || !manager || typeof manager.getStateForContext !== "function") return { manual: null, auto: null };
    return manager.getStateForContext(context) || { manual: null, auto: null };
  }

  function updateDictionaryMeta({ activityName, dictionary, stateSnapshot }) {
    if (!refs.detectedLabel && !refs.appliedLabel) return;
    const manualEntry = stateSnapshot?.manual;
    const autoEntry = stateSnapshot?.auto;
    const detectedText = activityName || autoEntry?.activityName || "—";
    if (refs.detectedLabel) refs.detectedLabel.textContent = `Activité détectée : ${escapeHtml(detectedText || "—")}`;
    const manualLabel = manualEntry?.dictionary?.label || manualEntry?.label || "";
    const autoLabel = autoEntry?.label || dictionary?.label || "";
    if (refs.appliedLabel) {
      if (manualLabel) refs.appliedLabel.textContent = `Référentiel appliqué : ${manualLabel} (manuel)`;
      else if (autoLabel) refs.appliedLabel.textContent = `Référentiel appliqué : ${autoLabel} (auto)`;
      else refs.appliedLabel.textContent = "Référentiel appliqué : Aucun (mode générique)";
    }
    if (refs.stateComment) {
      if (manualLabel && autoLabel && autoLabel !== manualLabel) {
        refs.stateComment.textContent = `La détection automatique proposait ${autoLabel}.`;
      } else if (manualLabel) {
        refs.stateComment.textContent = "Le référentiel manuel prime sur la détection.";
      } else if (autoLabel) {
        refs.stateComment.textContent = "Référentiel issu de la détection automatique.";
      } else {
        refs.stateComment.textContent = "Aucun référentiel appliqué pour l’instant.";
      }
    }
  }

  function updateApplyResetControls(snapshot) {
    const stateSnapshot = snapshot || getDictionaryStateSnapshot();
    if (refs.applyBtn) refs.applyBtn.disabled = !state.selectedId;
    if (refs.resetBtn) refs.resetBtn.disabled = !stateSnapshot?.manual;
  }

  function handleSelectChange() {
    state.selectedId = refs.select?.value || "";
    renderSelectedDetails();
    updateApplyResetControls();
  }

  function handleCurrentAddClick() {
    const dictionaryId = refs.currentAddBtn?.dataset.dictionaryId || "";
    const activityName = refs.currentAddBtn?.dataset.activityName || state.currentActivityName || "";
    if (dictionaryId) startEditor({ dictionaryId });
    else startEditor({ activityName });
  }

  function startEditor({ dictionaryId = null, activityName = "" } = {}) {
    if (!refs.editorWrapper) return;
    state.editingId = dictionaryId;
    state.idTouched = !!dictionaryId;
    refs.formTitle.textContent = dictionaryId ? "Modifier le dictionnaire" : "Ajouter une app";
    toggleEditor(true);
    populateForm(dictionaryId ? api.getDictionaryById(dictionaryId) : null, activityName);
  }

  function populateForm(dictionary, fallbackName = "") {
    if (!refs.form) return;
    refs.form.reset();
    const label = dictionary?.label || fallbackName || "";
    refs.formName.value = label;
    refs.formId.value = dictionary?.id || api.slugify(label || "");
    refs.formKeywords.value = (dictionary?.keywords || (label ? [label] : [])).join(", ");
    refs.formDescription.value = dictionary?.description || "";
    refs.formAbbr.value = formatKeyValueText(dictionary?.abbreviations);
    refs.formSuffixes.value = formatKeyValueText(dictionary?.suffixes);
    refs.formLevels.value = formatListText(dictionary?.levels?.length ? dictionary.levels : dictionary?.practices);
    refs.formInterpretation.value = formatListText(dictionary?.interpretation);
    refs.formNotes.value = formatListText(dictionary?.notes);
    if (refs.formConfidence) refs.formConfidence.value = dictionary?.confidence || "unknown";
    if (refs.formInfer) refs.formInfer.checked = !!dictionary?.ai_may_infer;
    if (refs.formTeacherContext) refs.formTeacherContext.checked = !!dictionary?.teacher_context_required;
    if (refs.formLimits) refs.formLimits.value = formatListText(dictionary?.limits);
    if (refs.formExamples) refs.formExamples.value = formatListText(dictionary?.examples);
    if (refs.formComparisons) refs.formComparisons.value = formatListText(dictionary?.comparison_rules);
    if (refs.formSignals) refs.formSignals.value = formatListText(dictionary?.signal_rules);
    refs.formStatus.textContent = "";
  }

  function toggleEditor(show) {
    if (!refs.editorWrapper) return;
    refs.editorWrapper.classList.toggle("sp-hidden", !show);
    if (!show) {
      state.editingId = null;
      state.idTouched = false;
      refs.form?.reset();
      refs.formStatus.textContent = "";
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    if (!refs.form) return;
    try {
      const payload = buildFormPayload();
      if (!payload.id) {
        setFormStatus("Identifiant invalide.", "error");
        return;
      }
      api.upsertDictionary(payload);
      setFormStatus("Dictionnaire enregistré.", "success");
      toggleEditor(false);
      renderSelector();
      renderCurrentSection(state.currentActivityName);
      setFeedback("Dictionnaire mis à jour.", "success");
    } catch (err) {
      console.error(err);
      setFormStatus(err?.message || "Impossible d’enregistrer.", "error");
    }
  }

  function buildFormPayload() {
    const id = api.slugify(refs.formId?.value || "");
    if (!id) throw new Error("Identifiant requis.");
    return {
      id,
      label: (refs.formName?.value || "").trim() || id,
      description: refs.formDescription?.value || "",
      keywords: parseKeywords(refs.formKeywords?.value || ""),
      abbreviations: parseKeyValueLines(refs.formAbbr?.value || ""),
      suffixes: parseKeyValueLines(refs.formSuffixes?.value || ""),
      interpretation: parseList(refs.formInterpretation?.value || ""),
      notes: parseList(refs.formNotes?.value || ""),
      levels: parseList(refs.formLevels?.value || ""),
      confidence: refs.formConfidence?.value || "unknown",
      ai_may_infer: !!refs.formInfer?.checked,
      teacher_context_required: !!refs.formTeacherContext?.checked,
      limits: parseList(refs.formLimits?.value || ""),
      examples: parseList(refs.formExamples?.value || ""),
      comparison_rules: parseList(refs.formComparisons?.value || ""),
      signal_rules: parseList(refs.formSignals?.value || ""),
    };
  }

  function handleRemoveSelected() {
    if (!state.selectedId) return;
    if (!confirm("Supprimer ce dictionnaire personnalisé ?")) return;
    api.removeDictionary(state.selectedId);
    state.selectedId = "";
    renderSelector();
    renderCurrentSection(state.currentActivityName);
    setFeedback("Dictionnaire supprimé.", "success");
  }

  function exportDictionaries() {
    try {
      const payload = api.export();
      const content = JSON.stringify(payload, null, 2);
      downloadFile(content, `scanprof-dictionnaires-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      setFeedback("Export généré.", "success");
    } catch (err) {
      console.error(err);
      setFeedback("Export impossible.", "error");
    }
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        api.import(reader.result, { merge: true });
        setFeedback("Import fusionné avec succès.", "success");
        renderSelector();
        renderCurrentSection(state.currentActivityName);
      } catch (err) {
        console.error(err);
        setFeedback(err?.message || "Import invalide.", "error");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setFeedback("Lecture du fichier impossible.", "error");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function parseKeyValueLines(text) {
    const entries = {};
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [key, ...rest] = line.split("=");
        if (!key) return;
        const normalizedKey = key.trim();
        const value = rest.join("=").trim();
        if (normalizedKey) entries[normalizedKey] = value || "";
      });
    return entries;
  }

  function parseKeywords(text) {
    return text
      .split(/[,;\n]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function parseList(text) {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function formatKeyValueText(record = {}) {
    const entries = Object.entries(record || {});
    if (!entries.length) return "";
    return entries.map(([key, value]) => `${key} = ${value || ""}`).join("\n");
  }

  function formatListText(list) {
    if (!Array.isArray(list) || !list.length) return "";
    return list.join("\n");
  }

  function getCurrentActivityName() {
    try {
      const raw = localStorage.getItem(AI_CONTEXT_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return parsed?.activite || "";
    } catch {
      return "";
    }
  }

  function setFeedback(message, type = "info") {
    if (!refs.feedback) return;
    refs.feedback.textContent = message || "";
    refs.feedback.className = "ai-status";
    if (message) refs.feedback.classList.add(type === "error" ? "error" : "success");
  }

  function setFormStatus(message, type) {
    if (!refs.formStatus) return;
    refs.formStatus.textContent = message;
    refs.formStatus.className = type === "error" ? "ai-status error" : "ai-status success";
  }

  function handleNameInput() {
    if (state.idTouched) return;
    refs.formId.value = api.slugify(refs.formName?.value || "");
  }

  function handleIdInput() {
    state.idTouched = true;
    refs.formId.value = api.slugify(refs.formId?.value || "");
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
