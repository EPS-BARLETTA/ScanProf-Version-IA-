(function () {
  const CORE_COLUMNS = ["nom", "prenom", "classe", "sexe", "distance", "vitesse", "vma", "temps_total"];

  function analyze({ dataset = [], columns = [], dictionary = null, manualText = "", summary = {} } = {}) {
    const manualTokens = extractManualTokens(manualText);
    const classification = classifyColumns(columns, dictionary, manualTokens);
    const knownFacts = buildKnownFacts(summary, dictionary, dataset);
    augmentKnownFactsWithClassification(knownFacts, classification);
    const unknownCodes = classification.unknown.map((entry) => formatReason(entry.name, entry.reason));
    const uncertainFields = buildUncertainties(classification, dictionary);
    const allowedComparisons = buildAllowedComparisons(classification, dictionary, columns);
    const pedagogicalSignals = buildSignals(dictionary, classification);
    const questionsForTeacher = buildQuestions(dictionary, classification);

    return {
      known_facts: knownFacts,
      unknown_codes: unknownCodes,
      uncertain_fields: uncertainFields,
      allowed_comparisons: allowedComparisons,
      pedagogical_signals: pedagogicalSignals,
      questions_for_teacher: questionsForTeacher,
      coverage: {
        documented: classification.documented.map((item) => item.name),
        partial: classification.partial.map((item) => item.name),
        unknown: classification.unknown.map((item) => item.name),
        total_columns: columns.length,
      },
      manual_tokens: Array.from(manualTokens),
      raw: classification,
    };
  }

  function buildKnownFacts(summary = {}, dictionary, dataset = []) {
    const facts = [];
    if (summary?.meta?.className) {
      facts.push(`Classe concernée : ${summary.meta.className}`);
    }
    if (summary?.meta?.sessionName) {
      facts.push(`Séance : ${summary.meta.sessionName}`);
    }
    if (dictionary?.label) {
      const desc = dictionary.description ? ` — ${dictionary.description}` : "";
      facts.push(`Activité documentée : ${dictionary.label}${desc}`);
    } else if (!dictionary) {
      facts.push("Activité non documentée : interprétation générique uniquement.");
    }
    if (dataset?.length) {
      facts.push(`${dataset.length} enregistrement(s) exploitables.`);
    } else if (summary?.total) {
      facts.push(`${summary.total} enregistrement(s) repérés.`);
    }
    if (dictionary?.limits?.length) {
      facts.push(`Limites connues : ${dictionary.limits.slice(0, 2).join(" / ")}`);
    }
    return facts;
  }

  function augmentKnownFactsWithClassification(facts = [], classification = {}) {
    if (!Array.isArray(facts) || !classification) return;
    if (classification.documented?.length) {
      facts.push(
        `${classification.documented.length} code(s) reconnu(s) : ${summarizeColumnList(classification.documented)}`
      );
    }
    if (classification.partial?.length) {
      facts.push(
        `${classification.partial.length} code(s) partiellement compris : ${summarizeColumnList(classification.partial)}`
      );
    }
    if (classification.unknown?.length) {
      facts.push(`${classification.unknown.length} code(s) à documenter.`);
    }
  }

  function buildUncertainties(classification, dictionary) {
    const uncertainties = [];
    if (dictionary?.teacher_context_required) {
      uncertainties.push("Cette activité nécessite un complément de contexte enseignant pour être interprétée finement.");
    }
    if (dictionary && (dictionary.confidence === "low" || dictionary.confidence === "unknown")) {
      uncertainties.push("Référentiel partiel : fiabilité limitée sans vérification sur le terrain.");
    }
    classification.partial.forEach((item) => {
      uncertainties.push(formatReason(item.name, item.reason));
    });
    return uncertainties;
  }

  function buildAllowedComparisons(classification, dictionary, columns = []) {
    const comparisons = [];
    if (Array.isArray(dictionary?.comparison_rules) && dictionary.comparison_rules.length) {
      comparisons.push(...dictionary.comparison_rules);
    }
    const suffixMap = (dictionary?.suffixes && Object.keys(dictionary.suffixes)) || [];
    if (suffixMap.includes("_p") && suffixMap.includes("_r")) {
      const baseKeys = new Set();
      columns.forEach((col) => {
        const normalized = normalizeKey(col);
        if (!normalized) return;
        if (normalized.endsWith("_p") || normalized.endsWith("_r")) {
          baseKeys.add(normalized.replace(/_(p|r)$/, ""));
        }
      });
      baseKeys.forEach((base) => {
        const hasP = columns.some((col) => normalizeKey(col) === `${base}_p`);
        const hasR = columns.some((col) => normalizeKey(col) === `${base}_r`);
        if (hasP && hasR) {
          comparisons.push(`Comparer ${base}_p et ${base}_r pour mesurer l'écart prévu/réalisé.`);
        }
      });
    }
    return Array.from(new Set(comparisons));
  }

  function buildSignals(dictionary, classification) {
    const signals = [];
    if (Array.isArray(dictionary?.signal_rules)) {
      signals.push(...dictionary.signal_rules);
    }
    if (classification.documented.length) {
      signals.push(`Colonnes exploitables : ${summarizeColumnList(classification.documented)}.`);
    }
    if (!classification.documented.length && classification.partial.length) {
      signals.push("Plusieurs codes partiellement compris : confirmer leur signification pour affiner l'analyse.");
    }
    if (classification.unknown.length) {
      signals.push("Documenter les codes inconnus pour enrichir les recommandations.");
    }
    if (!dictionary && classification.documented.length === 0) {
      signals.push("Rester sur des observations factuelles tant que le dictionnaire n'est pas renseigné.");
    }
    if (!signals.length) {
      signals.push("S'appuyer sur les données observables et expliciter les limites restantes.");
    }
    return Array.from(new Set(signals));
  }

  function buildQuestions(dictionary, classification) {
    const questions = [];
    classification.unknown.forEach((item) => {
      questions.push(`Que signifie ${item.name} dans cette activité ?`);
    });
    classification.partial.forEach((item) => {
      questions.push(`Préciser ${item.name} pour fiabiliser l'analyse (${item.reason}).`);
    });
    if (Array.isArray(dictionary?.limits)) {
      dictionary.limits.forEach((limit) => questions.push(limit));
    }
    return questions;
  }

  function classifyColumns(columns = [], dictionary, manualTokens = new Set()) {
    const documented = [];
    const partial = [];
    const unknown = [];
    const dictionaryKeys = dictionary ? Object.keys(dictionary.abbreviations || {}) : [];
    const suffixKeys = dictionary ? Object.keys(dictionary.suffixes || {}) : [];
    columns.forEach((col) => {
      const normalized = normalizeKey(col);
      if (!normalized || CORE_COLUMNS.includes(normalized)) return;
      const analysis = analyseColumn(normalized, dictionaryKeys, suffixKeys, manualTokens, dictionary);
      if (analysis.status === "documented") documented.push({ name: col, reason: analysis.reason });
      else if (analysis.status === "partial") partial.push({ name: col, reason: analysis.reason });
      else unknown.push({ name: col, reason: analysis.reason });
    });
    return { documented, partial, unknown };
  }

  function analyseColumn(normalized, dictionaryKeys, suffixKeys, manualTokens, dictionary) {
    if (!normalized) return { status: "unknown", reason: "Nom de colonne vide." };
    if (dictionaryKeys.includes(normalized)) {
      return {
        status: dictionary && requiresTeacherContext(dictionary) ? "partial" : "documented",
        reason: dictionary?.abbreviations?.[normalized] || "Code documenté dans le dictionnaire.",
      };
    }
    const baseKey = stripSuffix(normalized, suffixKeys);
    if (baseKey && dictionaryKeys.includes(baseKey)) {
      const suffixName = normalized.slice(baseKey.length);
      const suffixDesc = dictionary?.suffixes?.[suffixName] || "Suffixe détecté.";
      const baseDesc = dictionary?.abbreviations?.[baseKey] || "Code documenté.";
      const combinedReason = `${baseDesc} (${suffixDesc.trim()})`;
      const status = dictionary && requiresTeacherContext(dictionary) ? "partial" : "documented";
      return { status, reason: combinedReason };
    }
    if (manualTokens.has(normalized)) {
      return {
        status: "documented",
        reason: "Défini par l'enseignant dans les consignes.",
      };
    }
    return {
      status: "unknown",
      reason: "Code non documenté dans le référentiel actuel.",
    };
  }

  function requiresTeacherContext(dictionary) {
    if (!dictionary) return false;
    return dictionary.teacher_context_required || dictionary.confidence === "low" || dictionary.confidence === "unknown";
  }

  function stripSuffix(normalized, suffixKeys = []) {
    if (!suffixKeys || !suffixKeys.length) return null;
    const matched = suffixKeys.find((suffix) => normalized.endsWith(suffix));
    if (!matched) return null;
    const base = normalized.slice(0, normalized.length - matched.length);
    return base || null;
  }

  function normalizeKey(key) {
    if (!key) return "";
    return String(key)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function extractManualTokens(text = "") {
    const tokens = new Set();
    if (!text) return tokens;
    text
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const match = line.match(/^([a-z0-9_\-]+)\s*=/i);
        if (match) {
          tokens.add(normalizeKey(match[1]));
          return;
        }
        if (line.split(/\s+/).length === 1) {
          tokens.add(normalizeKey(line));
        }
      });
    return tokens;
  }

  function formatReason(name, reason) {
    if (!reason) return name;
    return `${name} — ${reason}`;
  }

  function summarizeColumnList(entries = [], limit = 3) {
    if (!Array.isArray(entries) || !entries.length) return "—";
    const names = entries.slice(0, limit).map((entry) => entry.name);
    const extra = entries.length > limit ? ` +${entries.length - limit}` : "";
    return `${names.join(", ")}${extra}`;
  }

  window.ScanProfAIInterpretationEngine = {
    analyze,
    extractManualTokens,
  };
})();
