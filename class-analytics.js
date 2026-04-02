(function () {
  const STATUS_LABELS = {
    E: "Enchaîné",
    E2: "Enchaîné 2e essai",
    NE: "Non enchaîné",
    N3D: "Arrêt dégaine 3",
  };
  const SUCCESS_STATUSES = new Set(["E", "E2"]);
  const DEFAULT_LEVEL_SEQUENCE = [
    "3",
    "3+",
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
    "7B",
    "7B+",
    "7C",
    "7C+",
  ];
  const NUMERIC_FIELD_HINTS = [
    { key: "distance", label: "Distance", unit: "m", patterns: ["distance"], tolerateUnits: true },
    { key: "vitesse", label: "Vitesse", unit: "m/s", patterns: ["vitesse", "speed", "kmh", "km_h"], tolerateUnits: true },
    { key: "points_total", label: "Points", unit: "pts", patterns: ["points_total", "points", "score"], tolerateUnits: true },
    { key: "points_max", label: "Points max", unit: "pts", patterns: ["points_max"] },
    { key: "vma", label: "VMA", unit: "km/h", patterns: ["vma"] },
    { key: "temps_total", label: "Temps total", unit: "s", patterns: ["temps_total", "chrono", "time", "temps", "duration"], isTime: true },
  ];
  const SUMMARY_KEYS = ["overview", "strengths", "needs_work", "next_steps"];
  const STUDENT_PROFILE_KEYS = ["to_support", "strengths", "to_confirm"];
  const BUNDLE_PROFILE_KEYS = ["to_support", "strengths", "to_confirm", "contrasted"];
  const CROSS_TRAINING_EXERCISES = {
    bu: "Burpees",
    cr: "Crunch",
    di: "Dips",
    fe: "Fentes",
    jk: "Jumping jack",
    mt: "Mountain climber",
    sa: "Saut",
    po: "Pompes",
    ra: "Rameur",
    sq: "Squat",
  };
  const CROSS_TRAINING_VARIANT_LABELS = {
    "1": "Niveau 1",
    "2": "Niveau 2",
    l: "Niveau",
  };
  const CROSS_EXERCISE_IDS = Object.keys(CROSS_TRAINING_EXERCISES);
  const CROSS_DIFF_EQUAL_TOLERANCE = 0.05;
  // Student profile thresholds (kept centralized for easier tuning after field tests).
  const CLIMB_MIN_ATTEMPTS_FOR_STRONG_PROFILE = 3; // min voies before classifying as support/strength
  const CLIMB_MIN_ATTEMPTS_FOR_CONFIRM = 1;
  const CROSS_MIN_EXERCISES_FOR_STRONG_PROFILE = 3; // min exercices significatifs before strong signal
  const CROSS_MAX_EXERCISES_FOR_CONFIRM = 2;
  const CROSS_PROFILE_DIFF_SHARE_THRESHOLD = 0.12; // 12% relative écart to deem significant
  const CROSS_PROFILE_DIFF_ABS_THRESHOLD = 1; // fallback absolute écart
  const PROFILE_MAX_CONFIRM_ENTRIES = 1;
  const STUDENT_PROFILE_LABELS = {
    to_support: "À accompagner",
    strengths: "Point d'appui",
    to_confirm: "À confirmer",
  };
  const BUNDLE_PROFILE_LABELS = {
    ...STUDENT_PROFILE_LABELS,
    contrasted: "Profil contrasté",
  };
  const BUNDLE_PROFILE_LIMITS = {
    to_support: 2,
    strengths: 2,
    to_confirm: 1,
    contrasted: 2,
  };
  const CYCLE_PROFILE_KEYS = ["progressing", "stalled", "to_support", "strengths", "to_confirm"];
  const CYCLE_PROFILE_LABELS = {
    progressing: "Progression",
    stalled: "Stagnation",
    to_support: "À accompagner",
    strengths: "Point d'appui",
    to_confirm: "À confirmer",
  };
  const CYCLE_PROFILE_LIMITS = {
    progressing: 2,
    stalled: 2,
    to_support: 2,
    strengths: 2,
    to_confirm: 2,
  };
  const STUDENT_RANKING_KEYS = ["strongest", "weakest", "below_attempt_average"];
  const STUDENT_RANKING_LIMIT = 3;
  const MIN_STUDENT_RANKING_STUDENTS = 3;
  const STUDENT_HISTORY_LIMIT = 8;
  const HETEROGENEITY_RANK = {
    faible: 0,
    "faible": 0,
    moderee: 1,
    "moderee": 1,
    "modérée": 1,
    modérée: 1,
    marquee: 2,
    "marquee": 2,
    "marquée": 2,
  };

  function createSummarySentences() {
    return {
      overview: [],
      strengths: [],
      needs_work: [],
      next_steps: [],
    };
  }

  function analyze({ dataset = [], dictionary = null, summary = {}, manualText = "", studentRequest = null } = {}) {
    const entries = Array.isArray(dataset) ? dataset.filter((entry) => entry && typeof entry === "object") : [];
    const { students, studentCount, studentStats, entryKeys } = indexStudents(entries);
    const context = buildContext({ summary, dictionary, entryCount: entries.length, studentCount });
    const dataQuality = buildDataQuality({ entries, summary, studentStats, dictionary });
    const classOverview = buildClassOverview({ entries, students, studentCount });
    const translationProfile = fetchTranslationProfile(dictionary);
    if (translationProfile) {
      context.translation_profile = {
        id: translationProfile.id,
        analysis_profile: translationProfile.analysisProfile,
        minimum_signals: translationProfile.minimumUsableSignals,
        fallback_focus: translationProfile.fallbackFocus,
      };
    }

    const base = {
      context,
      data_quality: dataQuality,
      class_overview: classOverview,
      distributions: {},
      measures: {},
      comparisons: [],
      student_groups: [],
      pedagogical_signals: [],
      limits: [],
      summary_sentences: createSummarySentences(),
      student_profiles: createStudentProfileCollection(),
      student_profile_sentences: createStudentProfileSentences(),
      student_rankings: createStudentRankingCollection(),
      student_metrics: {},
    };

    const dictionaryId = dictionary?.id || "";
    if (dictionaryId === "climb_track") {
      const climbStats = analyzeClimbTrack(entries, {
        students,
        entryKeys,
        dictionary,
        manualText,
        summary,
        translator: translationProfile,
        studentRequest,
      });
      mergeAnalytics(base, climbStats);
    } else if (dictionaryId === "cross_training") {
      const crossStats = analyzeCrossTraining(entries, {
        students,
        entryKeys,
        dictionary,
        translator: translationProfile,
        studentRequest,
      });
      mergeAnalytics(base, crossStats);
    }
    if (!base.student_analysis && studentRequest && studentRequest.key && studentRequest.scope !== "cycle") {
      const genericAnalysis = buildGenericStudentSessionAnalysis({
        studentKey: studentRequest.key,
        students,
        classOverview: base.class_overview,
        dictionary,
        summary,
      });
      if (genericAnalysis) {
        base.student_analysis = genericAnalysis;
      }
    }

    const numericStats = analyzeNumericFields(entries, summary, dictionary);
    mergeAnalytics(base, numericStats);

    if (!base.student_rankings?.below_attempt_average?.length) {
      const fallbackRankings = buildGenericAttemptRankings(students, { includeBelowAverage: true });
      base.student_rankings = mergeStudentRankings(base.student_rankings, fallbackRankings);
    }

    finalizeAnalytics(base);
    attachTeachingInsights(base, dictionary);
    return base;
  }

  function analyzeSessionBundle({ sources = [], summary = {}, manualText = "" } = {}) {
    const normalizedSources = [];
    let combinedSummary = createSummarySentences();
    (Array.isArray(sources) ? sources : []).forEach((source, index) => {
      const normalized = normalizeBundleSource(source, summary, manualText, index);
      if (!normalized) return;
      normalizedSources.push(normalized);
      combinedSummary = mergeSummarySentences(combinedSummary, normalized.summary_sentences || createSummarySentences());
    });
    if (!normalizedSources.length) {
      return createMergedSessionAnalysis();
    }
    const trimmedSummary = trimMergedSummary(dedupeSummarySentences(combinedSummary));
    const bundleProfiles = buildBundleProfiles(normalizedSources);
    return {
      overview: trimmedSummary.overview,
      strengths: trimmedSummary.strengths,
      needs_work: trimmedSummary.needs_work,
      next_steps: trimmedSummary.next_steps,
      student_profiles: bundleProfiles.profiles,
      student_profile_sentences: bundleProfiles.sentences,
    };
  }

  function analyzeCycleBundle({ sessions = [], summary = {}, manualText = "" } = {}) {
    const normalizedSessions = (Array.isArray(sessions) ? sessions : [])
      .map((session, index) => normalizeCycleSession(session, summary, manualText, index))
      .filter(Boolean);
    if (normalizedSessions.length < 2) {
      return createMergedCycleAnalysis();
    }
    const isCrossTrainingCycle = normalizedSessions.some(isCrossTrainingSession);
    normalizedSessions.sort((a, b) => (parseDateValue(a.session_date) || 0) - (parseDateValue(b.session_date) || 0));
    normalizedSessions.forEach((session, index) => {
      session.session_index = index + 1;
    });
    const overviewBase = buildCycleOverviewSentences(normalizedSessions);
    const trendInsights = analyzeCycleTrends(normalizedSessions);
    const cycleProfiles = buildCycleProfiles(normalizedSessions);
    const aggregatedSummary = aggregateCycleSummarySentences(normalizedSessions);
    const baseNextSteps = buildCycleNextSteps(normalizedSessions, trendInsights.trendNextSteps);
    const analysis = {
      overview: combineUniqueStrings([overviewBase, aggregatedSummary.overview], 6),
      progressions: combineUniqueStrings([trendInsights.progressions, aggregatedSummary.strengths], 5),
      stagnations: combineUniqueStrings([trendInsights.stagnations, aggregatedSummary.needs_work], 5),
      regressions: combineUniqueStrings(
        [trendInsights.regressions, aggregatedSummary.needs_work],
        5
      ),
      next_steps: combineUniqueStrings([baseNextSteps, aggregatedSummary.next_steps], 5),
      student_profiles: cycleProfiles.profiles,
      student_profile_sentences: cycleProfiles.sentences,
    };
    return ensureMinimumCycleSignals(analysis, normalizedSessions, {
      isCrossTraining: isCrossTrainingCycle,
    });
  }

  function indexStudents(entries) {
    const students = new Map();
    const entryKeys = [];
    let missingIdentityEntries = 0;
    let missingClassEntries = 0;
    entries.forEach((entry, index) => {
      const identity = buildStudentIdentity(entry, index);
      if (!identity.nom && !identity.prenom) missingIdentityEntries += 1;
      if (!identity.classe) missingClassEntries += 1;
      entryKeys.push(identity.key);
      if (!students.has(identity.key)) {
        students.set(identity.key, {
      key: identity.key,
      nom: identity.nom,
      prenom: identity.prenom,
      classe: identity.classe,
      rawEntryCount: 0,
      attempts: 0,
      successAttempts: 0,
      highestLevel: null,
      highestLevelIndex: null,
      statusCounts: {},
      levelHistory: [],
    });
      }
      students.get(identity.key).rawEntryCount += 1;
    });
    return {
      students,
      studentCount: students.size,
      studentStats: {
        missingIdentityEntries,
        missingClassEntries,
      },
      entryKeys,
    };
  }

  function buildStudentIdentity(entry = {}, fallbackIndex = 0) {
    const nom = safeString(entry.nom || entry.Nom || entry.lastname || entry.last_name || "");
    const prenom = safeString(entry.prenom || entry.Prénom || entry.firstname || entry.first_name || "");
    const classe = safeString(entry.classe || entry.class || entry.groupe || entry.group || "");
    const keyParts = [nom.toLowerCase(), prenom.toLowerCase(), classe.toLowerCase()];
    let key = keyParts.join("|");
    if (!nom && !prenom) {
      key = `__anon_${fallbackIndex}`;
    }
    return { key, nom, prenom, classe };
  }

  function buildContext({ summary = {}, dictionary = null, entryCount = 0, studentCount = 0 } = {}) {
    const meta = summary?.meta || {};
    return {
      activity_id: dictionary?.id || meta.activityId || null,
      activity_label: dictionary?.label || meta.activityName || null,
      session_name: meta.sessionName || null,
      class_name: meta.className || (summary.classes && summary.classes[0]?.name) || null,
      dictionary_id: dictionary?.id || null,
      dictionary_confidence: dictionary?.confidence || null,
      dataset_entries: entryCount,
      reported_entries: summary.total || entryCount,
      student_count: studentCount,
      columns: summary.columns || [],
    };
  }

  function buildDataQuality({ entries, summary, studentStats, dictionary }) {
    const issues = [];
    if (studentStats.missingIdentityEntries) {
      issues.push(`${studentStats.missingIdentityEntries} entrée(s) sans nom/prénom.`);
    }
    if (studentStats.missingClassEntries) {
      issues.push(`${studentStats.missingClassEntries} entrée(s) sans classe.`);
    }
    if (summary.total && summary.total > entries.length) {
      issues.push(`Seuls ${entries.length} enregistrements sur ${summary.total} ont été transmis à l'analyse IA.`);
    }
    if (dictionary && dictionary.teacher_context_required) {
      issues.push("Cette activité nécessite un contexte enseignant pour interpréter les données finement.");
    }
    return {
      dataset_entries: entries.length,
      expected_entries: summary.total || entries.length,
      unique_students: summary?.meta?.studentCount || null,
      missing_identity_entries: studentStats.missingIdentityEntries || 0,
      missing_class_entries: studentStats.missingClassEntries || 0,
      issues,
      unknown_codes: {
        statuses: [],
        levels: [],
        fields: [],
      },
    };
  }

  function buildClassOverview({ entries, students, studentCount }) {
    const entryCount = entries.length;
    const perStudentCounts = Array.from(students.values()).map((student) => student.rawEntryCount || 0);
    const meanEntries = studentCount ? round(entryCount / Math.max(studentCount, 1), 2) : 0;
    const medianEntries = perStudentCounts.length ? round(calcMedian(perStudentCounts), 2) : 0;
    const summary = [
      { key: "students", label: "Élèves distincts", value: studentCount },
      { key: "entries", label: "Entrées enregistrées", value: entryCount },
    ];
    if (studentCount) {
      summary.push({ key: "entries_mean", label: "Entrées / élève", value: meanEntries });
    }
    return {
      summary,
      aggregate: {
        student_count: studentCount,
        total_entries: entryCount,
        mean_entries_per_student: meanEntries,
        median_entries_per_student: medianEntries,
      },
      highlights: [],
      notes: [],
    };
  }

  function analyzeClimbTrack(entries, { students, entryKeys, dictionary, manualText, translator = null, studentRequest = null }) {
    const result = {
      class_overview: { summary: [], aggregate: {}, highlights: [], notes: [] },
      distributions: {},
      measures: {},
      comparisons: [],
      student_groups: [],
      pedagogical_signals: [],
      limits: [],
      data_quality: {
        issues: [],
        unknown_codes: { statuses: [], levels: [] },
      },
    };
    const levelOrder = buildLevelOrder(dictionary);
    const levelSet = new Set(levelOrder.list);
    const levelCounts = new Map();
    const statusCounts = new Map();
    const unknownStatuses = new Set();
    const unknownLevels = new Set();
    const levelSamples = [];
    let attemptCount = 0;
    let missingStatusCount = 0;
    let missingLevelCount = 0;
    const perStudentAttemptCounts = new Map();

    entries.forEach((entry, index) => {
      const parsed = parseClimbEntry(entry, levelSet, levelOrder);
      if (!parsed) return;
      attemptCount += 1;
      const studentKey = entryKeys[index];
      if (!perStudentAttemptCounts.has(studentKey)) perStudentAttemptCounts.set(studentKey, 0);
      perStudentAttemptCounts.set(studentKey, perStudentAttemptCounts.get(studentKey) + 1);
      const studentRef = students.get(studentKey);
      if (studentRef) {
        studentRef.attempts = (studentRef.attempts || 0) + 1;
        studentRef.statusCounts = studentRef.statusCounts || {};
        studentRef.levelHistory = studentRef.levelHistory || [];
      }

      if (parsed.status) {
        incrementMap(statusCounts, parsed.status);
        if (!STATUS_LABELS[parsed.status]) {
          unknownStatuses.add(parsed.status);
        }
        if (studentRef) {
          studentRef.statusCounts[parsed.status] = (studentRef.statusCounts[parsed.status] || 0) + 1;
          if (SUCCESS_STATUSES.has(parsed.status)) {
            studentRef.successAttempts = (studentRef.successAttempts || 0) + 1;
          }
        }
      } else {
        missingStatusCount += 1;
        if (parsed.rawStatusValue) {
          unknownStatuses.add(String(parsed.rawStatusValue).trim());
        }
      }

      if (parsed.level) {
        incrementMap(levelCounts, parsed.level);
        const levelIndex = levelOrder.index[parsed.level];
        if (typeof levelIndex === "number") {
          levelSamples.push({ level: parsed.level, index: levelIndex });
          if (studentRef) {
            studentRef.levelHistory.push({ level: parsed.level, status: parsed.status || null, index: levelIndex });
            if (studentRef.highestLevelIndex == null || levelIndex > studentRef.highestLevelIndex) {
              studentRef.highestLevelIndex = levelIndex;
              studentRef.highestLevel = parsed.level;
            }
          }
        } else {
          unknownLevels.add(parsed.level);
        }
      } else {
        missingLevelCount += 1;
        if (parsed.rawLevelValue) {
          unknownLevels.add(String(parsed.rawLevelValue).trim());
        }
      }
    });

    const studentCount = students.size || 0;
    const attemptCountsArray = Array.from(students.values()).map((student) => student.attempts || 0);

    if (!attemptCount) {
      if (unknownLevels.size) result.data_quality.unknown_codes.levels = Array.from(unknownLevels);
      if (unknownStatuses.size) result.data_quality.unknown_codes.statuses = Array.from(unknownStatuses);
      result.limits.push("Aucune tentative Climb Track exploitable détectée (cotation / statut absents).");
      return result;
    }

    const meanAttempts = studentCount ? attemptCount / Math.max(studentCount, 1) : 0;
    const medianAttempts = attemptCountsArray.length ? calcMedian(attemptCountsArray) : 0;
    const minAttempts = attemptCountsArray.length ? Math.min(...attemptCountsArray) : 0;
    const maxAttempts = attemptCountsArray.length ? Math.max(...attemptCountsArray) : 0;
    const atLeastTwo = attemptCountsArray.filter((value) => value >= 2).length;
    const atLeastThree = attemptCountsArray.filter((value) => value >= 3).length;
    const shareTwo = studentCount ? atLeastTwo / Math.max(studentCount, 1) : 0;
    const shareThree = studentCount ? atLeastThree / Math.max(studentCount, 1) : 0;
    const attemptsDistribution = buildAttemptsDistribution(attemptCountsArray, studentCount);

    const statusDistribution = buildStatusDistribution(statusCounts);
    const successStudents = Array.from(students.values()).filter((student) => (student.successAttempts || 0) > 0).length;
    const successShare = studentCount ? successStudents / Math.max(studentCount, 1) : 0;
    const totalStatuses = Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0);
    const successAttemptCount = (statusCounts.get("E") || 0) + (statusCounts.get("E2") || 0);
    const successAttemptShare = totalStatuses ? successAttemptCount / totalStatuses : 0;
    const firstTryShare = totalStatuses ? (statusCounts.get("E") || 0) / totalStatuses : 0;
    const neShare = totalStatuses ? (statusCounts.get("NE") || 0) / totalStatuses : 0;

    const thresholdInfo = resolveCotationThreshold(manualText, levelSet, levelOrder.list);
    const thresholdStudents = thresholdInfo && typeof thresholdInfo.index === "number"
      ? Array.from(students.values()).filter(
          (student) => typeof student.highestLevelIndex === "number" && student.highestLevelIndex >= thresholdInfo.index
        ).length
      : 0;
    const thresholdShare = studentCount ? thresholdStudents / Math.max(studentCount, 1) : 0;

    const levelStats = computeLevelStats({ levelSamples, levelCounts, levelOrder });

    result.class_overview = {
      summary: [
        { key: "climb_attempts", label: "Voies renseignées", value: attemptCount },
        { key: "climb_mean", label: "Voies / élève", value: round(meanAttempts, 2) },
      ],
      aggregate: {
        total_attempts: attemptCount,
        mean_attempts_per_student: round(meanAttempts, 2),
        median_attempts_per_student: round(medianAttempts, 2),
        min_attempts_per_student: minAttempts,
        max_attempts_per_student: maxAttempts,
      },
      highlights: [
        buildHighlight(
          "Élèves avec ≥2 voies",
          atLeastTwo,
          studentCount
        ),
      ].filter(Boolean),
      notes: [],
    };
    if (atLeastThree) {
      result.class_overview.highlights.push(buildHighlight("Élèves avec ≥3 voies", atLeastThree, studentCount));
    }
    result.class_overview.highlights.push(buildHighlight("Élèves avec ≥1 réussite", successStudents, studentCount));

    result.distributions.attempts_per_student = attemptsDistribution;
    if (statusDistribution) result.distributions.statuses = statusDistribution;
    if (levelStats?.distribution) result.distributions.cotations = levelStats.distribution;

    result.measures.voies = {
      label: "Volume de voies",
      total: attemptCount,
      mean_per_student: round(meanAttempts, 2),
      median_per_student: round(medianAttempts, 2),
      min_per_student: minAttempts,
      max_per_student: maxAttempts,
      dispersion: classifyDispersion(calcStdDev(attemptCountsArray, meanAttempts), meanAttempts),
    };

    result.measures.cotation = {
      label: "Niveaux",
      max_level: levelStats?.maxLevel || null,
      median_level: levelStats?.medianLevel || null,
      majority_window: levelStats?.majorityWindow || null,
      heterogeneity: levelStats?.heterogeneity || null,
      threshold: thresholdInfo
        ? {
            level: thresholdInfo.level,
            students: thresholdStudents,
            share: round(thresholdShare, 4),
            origin: thresholdInfo.origin,
          }
        : null,
    };

    result.comparisons.push({
      label: "Réussites",
      detail: `${successStudents} élève(s) (${toPercent(successShare)}) ont validé au moins une voie.`,
      share: round(successShare, 4),
    });
    if (thresholdInfo) {
      result.comparisons.push({
        label: `Atteinte ${thresholdInfo.level}+`,
        detail: `${thresholdStudents} élève(s) (${toPercent(thresholdShare)}) ont atteint ${thresholdInfo.level} ou plus.`,
        share: round(thresholdShare, 4),
      });
    }

    result.student_groups = buildStudentGroups({
      students,
      studentCount,
      successStudents,
      atLeastThree,
    });

    result.pedagogical_signals = buildClimbSignals({
      studentCount,
      successShare,
      atLeastTwo,
      atLeastThree,
      thresholdShare,
      thresholdInfo,
      levelStats,
    });
    result.summary_sentences = buildClimbSummarySentences({
      studentCount,
      attemptCount,
      meanAttempts,
      medianAttempts,
      shareTwo,
      shareThree,
      successStudentShare: successShare,
      successAttemptShare,
      firstTryShare,
      neShare,
      thresholdInfo,
      thresholdShare,
      levelStats,
    });

    if (missingStatusCount) {
      result.data_quality.issues.push(`${missingStatusCount} tentative(s) sans statut (E / E2 / NE).`);
    }
    if (missingLevelCount) {
      result.data_quality.issues.push(`${missingLevelCount} tentative(s) sans cotation.`);
    }
    if (unknownStatuses.size) {
      result.data_quality.unknown_codes.statuses = Array.from(unknownStatuses);
      result.limits.push(`Statuts inconnus repérés : ${Array.from(unknownStatuses).join(", ")}.`);
    }
    if (unknownLevels.size) {
      result.data_quality.unknown_codes.levels = Array.from(unknownLevels);
      result.limits.push(`Cotation(s) non reconnues : ${Array.from(unknownLevels).join(", ")}.`);
    }
    if (thresholdInfo && thresholdInfo.origin === "default") {
      result.limits.push(`Seuil ${thresholdInfo.level} utilisé par défaut (ajustable via une consigne « seuil = ... »).`);
    }

    const climbProfiles = buildClimbTrackStudentProfiles(students);
    result.student_profiles = climbProfiles;
    result.student_profile_sentences = buildStudentProfileSentences(climbProfiles);
    result.student_rankings = buildClimbStudentRankings({
      students,
      meanAttempts,
    });
    result.student_metrics = snapshotStudentMetrics(students);
    if (studentRequest && studentRequest.key && studentRequest.scope !== "cycle") {
      const studentAnalysis = buildClimbStudentSessionAnalysis({
        studentKey: studentRequest.key,
        students,
        classOverview: result.class_overview,
        dictionary,
        summary,
        stats: {
          meanAttempts,
          successShare,
          successAttemptShare,
        },
      });
      if (studentAnalysis) result.student_analysis = studentAnalysis;
    }

    return result;
  }

  function analyzeCrossTraining(entries, { students, entryKeys, translator = null, studentRequest = null } = {}) {
    const result = {
      class_overview: { summary: [], aggregate: {}, highlights: [], notes: [] },
      distributions: {},
      measures: {},
      comparisons: [],
      student_groups: [],
      pedagogical_signals: [],
      limits: [],
      data_quality: {
        issues: [],
        unknown_codes: { statuses: [], levels: [], fields: [] },
      },
      summary_sentences: createSummarySentences(),
    };
    const exerciseStats = new Map();
    entries.forEach((entry, index) => {
      const studentKey = entryKeys[index] || `row_${index}`;
      const perExercise = extractCrossTrainingEntry(entry, translator);
      Object.values(perExercise).forEach((sample) => {
        if (sample.planned == null && sample.realized == null) return;
        const stat = ensureCrossExerciseStat(exerciseStats, sample.meta);
        const existing = stat.students.get(studentKey) || { planned: null, realized: null };
        if (sample.planned != null) existing.planned = sample.planned;
        if (sample.realized != null) existing.realized = sample.realized;
        stat.students.set(studentKey, existing);
      });
    });

    const summaries = [];
    exerciseStats.forEach((stat) => {
      const summary = computeCrossExerciseSummary(stat);
      if (summary) summaries.push(summary);
    });

    const studentCount = students.size;
    if (!summaries.length) {
      result.limits.push("Exercices Cross Training non exploitables (prévu/réalisé absents ou insuffisants).");
      return result;
    }

    const crossStudentStats = new Map();
    exerciseStats.forEach((stat) => {
      stat.students.forEach((sample, studentKey) => {
        if (!Number.isFinite(sample.planned) || !Number.isFinite(sample.realized)) return;
        const diff = sample.realized - sample.planned;
        let classification = classifyDiff(diff, sample.planned);
        if (!classification) return;
        if (classification !== "equal" && !isSignificantCrossDiff(diff, sample.planned)) {
          classification = "equal";
        }
        const record = crossStudentStats.get(studentKey) || {
          above: 0,
          below: 0,
          equal: 0,
          total: 0,
          markedBelow: 0,
          markedAbove: 0,
          records: [],
        };
        record[classification] += 1;
        record.total += 1;
        const detail = {
          label: stat.label,
          classification,
          diff,
          planned: sample.planned,
          realized: sample.realized,
        };
        if (classification === "below" && isMarkedNegativeDiff(diff, sample.planned)) {
          record.markedBelow = (record.markedBelow || 0) + 1;
          detail.marked = "below";
        } else if (classification === "above" && isMarkedPositiveDiff(diff, sample.planned)) {
          record.markedAbove = (record.markedAbove || 0) + 1;
          detail.marked = "above";
        }
        record.records.push(detail);
        crossStudentStats.set(studentKey, record);
      });
    });

    const exercisesWithMajority = summaries.filter((entry) => entry.shareAbove >= 0.5).length;
    const exercisesWithDifficulty = summaries.filter((entry) => entry.shareBelow >= 0.4).length;
    const absoluteDiffRanking = [...summaries].sort((a, b) => (b.absMeanDiff || 0) - (a.absMeanDiff || 0));
    const successRanking = [...summaries].sort((a, b) => (b.shareAbove || 0) - (a.shareAbove || 0));
    const difficultyRanking = [...summaries].sort((a, b) => (b.shareBelow || 0) - (a.shareBelow || 0));
    const dispersionRanking = [...summaries].sort((a, b) => (a.dispersion?.coefficient || 0) - (b.dispersion?.coefficient || 0));

    result.class_overview.summary = [
      { key: "cross_exercises", label: "Exercices exploitables", value: summaries.length },
    ];
    result.class_overview.aggregate = {
      exercises: summaries.length,
    };
    if (exercisesWithMajority) {
      result.class_overview.highlights.push(
        buildHighlight("Exercices ≥ objectif", exercisesWithMajority, summaries.length)
      );
    }
    if (exercisesWithDifficulty) {
      result.class_overview.highlights.push(
        buildHighlight("Exercices sous l'objectif", exercisesWithDifficulty, summaries.length)
      );
    }

    result.distributions.cross_training = {
      label: "Prévu vs réalisé",
      items: summaries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        mean_planned: round(entry.meanPlanned, 2),
        mean_realized: round(entry.meanRealized, 2),
        median_realized: round(entry.medianRealized, 2),
        min_realized: round(entry.minRealized, 2),
        max_realized: round(entry.maxRealized, 2),
        mean_diff: round(entry.meanDiff, 2),
        share_above: entry.shareAbove,
        share_equal: entry.shareEqual,
        share_below: entry.shareBelow,
        dispersion: entry.dispersion,
        sample_size: entry.validCount,
      })),
    };

    result.measures.cross_training = {
      label: "Synthèse Cross Training",
      total_exercises: summaries.length,
      exercises_with_majority: exercisesWithMajority,
      exercises_with_difficulty: exercisesWithDifficulty,
      most_positive_gap: absoluteDiffRanking[0] || null,
      most_negative_gap: absoluteDiffRanking.find((entry) => (entry.meanDiff || 0) < 0) || null,
    };

    if (successRanking[0]) {
      result.comparisons.push({
        label: "Exercices les plus réussis",
        detail: `${successRanking[0].label} : ${toPercent(successRanking[0].shareAbove)}% au-dessus du prévu.`,
        share: round(successRanking[0].shareAbove, 4),
      });
    }
    if (difficultyRanking[0]) {
      result.comparisons.push({
        label: "Exercices en difficulté",
        detail: `${difficultyRanking[0].label} : ${toPercent(difficultyRanking[0].shareBelow)}% en dessous du prévu.`,
        share: round(difficultyRanking[0].shareBelow, 4),
      });
    }
    if (absoluteDiffRanking[0]) {
      result.comparisons.push({
        label: "Écart prévu/réalisé le plus marqué",
        detail: `${absoluteDiffRanking[0].label} : écart moyen ${round(absoluteDiffRanking[0].meanDiff, 2)}.`,
        share: round(Math.abs(absoluteDiffRanking[0].meanDiff || 0), 4),
      });
    }

    const heteroHigh = [...dispersionRanking].reverse().find((entry) => entry.dispersion?.label === "marquée");
    const heteroLow = dispersionRanking.find((entry) => entry.dispersion?.label === "faible");
    if (heteroHigh && heteroLow) {
      result.pedagogical_signals.push(
        `Résultats homogènes sur ${heteroLow.label}, mais plus dispersés sur ${heteroHigh.label}.`
      );
    }
    if (successRanking[0]) {
      result.pedagogical_signals.push(
        `${successRanking[0].label} sert de repère : ${toPercent(successRanking[0].shareAbove)}% dépassent le plan.`
      );
    }
    if (difficultyRanking[0]) {
      result.pedagogical_signals.push(
        `${difficultyRanking[0].label} requiert un accompagnement (${toPercent(difficultyRanking[0].shareBelow)}% sous l'objectif).`
      );
    }
    result.pedagogical_signals = Array.from(new Set(result.pedagogical_signals));

    result.summary_sentences = buildCrossTrainingSummarySentences({
      studentCount,
      exerciseSummaries: summaries,
      bestExercise: successRanking[0],
      challengingExercise: difficultyRanking[0],
      largestGap: absoluteDiffRanking[0],
      homogeneousExercise: heteroLow,
      heterogeneousExercise: heteroHigh,
    });

    if (!result.summary_sentences.overview.length) {
      addSentence(
        result.summary_sentences.overview,
        `${studentCount} élève(s) analysé(s) sur ${summaries.length} exercice(s) exploitable(s).`
      );
    }

    const crossProfiles = buildCrossTrainingStudentProfiles({
      students,
      stats: crossStudentStats,
    });
    result.student_profiles = crossProfiles;
    result.student_profile_sentences = buildStudentProfileSentences(crossProfiles);
    result.student_rankings = buildCrossTrainingStudentRankings({
      students,
      stats: crossStudentStats,
    });
    result.student_metrics = snapshotStudentMetrics(students, { crossStats: crossStudentStats });
    if (studentRequest && studentRequest.key && studentRequest.scope !== "cycle") {
      const studentAnalysis = buildCrossStudentSessionAnalysis({
        studentKey: studentRequest.key,
        students,
        classOverview: result.class_overview,
        crossStats: crossStudentStats,
        summaries,
        dictionary,
      });
      if (studentAnalysis) result.student_analysis = studentAnalysis;
    }

    return result;
  }

  function parseClimbEntry(entry, levelSet, levelOrder) {
    if (!entry || typeof entry !== "object") return null;
    const normalizedKeys = Object.keys(entry).map((key) => ({
      original: key,
      normalized: normalizeKeyName(key),
    }));
    let level = null;
    let rawLevelValue = null;
    let status = null;
    let rawStatusValue = null;
    let hasSpecificField = false;

    normalizedKeys.forEach(({ original, normalized }) => {
      if (!original || original.startsWith("__")) return;
      const value = entry[original];
      if (value == null || value === "") return;
      if (normalized.includes("cotation") || normalized.includes("niveau")) {
        if (!level) {
          const normalizedLevel = normalizeLevelValue(value, levelSet);
          if (normalizedLevel) level = normalizedLevel;
          else rawLevelValue = value;
        }
        hasSpecificField = true;
      }
      if (
        normalized.includes("statut") ||
        normalized.includes("status") ||
        normalized.includes("etat") ||
        normalized.includes("résultat") ||
        normalized.includes("resultat")
      ) {
        if (!status) {
          const normalizedStatus = normalizeStatusValue(value);
          if (normalizedStatus) status = normalizedStatus;
          else rawStatusValue = value;
        }
        hasSpecificField = true;
      }
      if (
        normalized.includes("voie") ||
        normalized.includes("relais") ||
        normalized.includes("bloc") ||
        normalized.includes("couleur") ||
        normalized.includes("pratique") ||
        normalized === "m" ||
        normalized === "mt" ||
        normalized === "t"
      ) {
        hasSpecificField = true;
      }
    });

    if ((!level || !status) && normalizedKeys.length) {
      normalizedKeys.forEach(({ original }) => {
        if (level && status) return;
        const value = entry[original];
        if (value == null || typeof value !== "string") return;
        if (!level) {
          const candidate = detectLevelInText(value, levelSet);
          if (candidate) level = candidate;
        }
        if (!status) {
          const candidateStatus = detectStatusInText(value);
          if (candidateStatus) status = candidateStatus;
        }
      });
    }

    if (!level && !status && !hasSpecificField) return null;

    return {
      level,
      status,
      rawLevelValue,
      rawStatusValue,
    };
  }

  function buildLevelOrder(dictionary) {
    const rawLevels = Array.isArray(dictionary?.levels) && dictionary.levels.length ? dictionary.levels : DEFAULT_LEVEL_SEQUENCE;
    const list = [];
    const index = {};
    rawLevels.forEach((value) => {
      const token = normalizeLevelToken(value);
      if (!token) return;
      if (index[token] != null) return;
      index[token] = list.length;
      list.push(token);
    });
    return { list, index };
  }

  function buildAttemptsDistribution(attemptCountsArray, studentCount) {
    const histogram = new Map();
    attemptCountsArray.forEach((value) => {
      const safeValue = Number.isFinite(value) ? value : 0;
      histogram.set(safeValue, (histogram.get(safeValue) || 0) + 1);
    });
    const buckets = Array.from(histogram.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([count, freq]) => ({
        label: `${count} voie${count > 1 ? "s" : ""}`,
        count: freq,
        percentage: studentCount ? round(freq / Math.max(studentCount, 1), 4) : 0,
      }));
    return {
      label: "Répartition des voies / élève",
      unit: "voies",
      buckets,
      total: studentCount,
    };
  }

  function buildStatusDistribution(statusCounts) {
    const entries = Array.from(statusCounts.entries());
    if (!entries.length) return null;
    const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
    return {
      label: "Répartition des statuts",
      unit: "tentatives",
      buckets: entries.map(([status, count]) => ({
        label: STATUS_LABELS[status] || status,
        code: status,
        count,
        percentage: round(count / total, 4),
      })),
      total,
    };
  }

  function computeLevelStats({ levelSamples, levelCounts, levelOrder }) {
    if (!levelSamples.length) return null;
    const sortedSamples = [...levelSamples].sort((a, b) => a.index - b.index);
    const medianSample = sortedSamples[Math.floor(sortedSamples.length / 2)];
    const maxSample = sortedSamples[sortedSamples.length - 1];
    const minSample = sortedSamples[0];
    const majorityWindow = computeMajorityWindow(levelCounts, levelOrder);
    const heterogeneity = computeHeterogeneity(minSample.index, maxSample.index, minSample.level, maxSample.level);
    return {
      medianLevel: medianSample?.level || null,
      maxLevel: maxSample?.level || null,
      distribution: buildLevelDistribution(levelCounts, levelOrder),
      majorityWindow,
      heterogeneity,
    };
  }

  function buildLevelDistribution(levelCounts, levelOrder) {
    if (!levelCounts.size) return null;
    const list = Array.from(levelCounts.entries()).sort((a, b) => {
      const idxA = levelOrder.index[a[0]] ?? 0;
      const idxB = levelOrder.index[b[0]] ?? 0;
      return idxA - idxB;
    });
    const total = list.reduce((sum, [, count]) => sum + count, 0) || 1;
    return {
      label: "Répartition des cotations",
      unit: "voies",
      buckets: list.map(([level, count]) => ({
        label: level,
        code: level,
        count,
        percentage: round(count / total, 4),
      })),
      total,
    };
  }

  function computeMajorityWindow(levelCounts, levelOrder) {
    if (!levelCounts.size) return null;
    const sorted = Array.from(levelCounts.entries()).sort((a, b) => (levelOrder.index[a[0]] ?? 0) - (levelOrder.index[b[0]] ?? 0));
    const total = sorted.reduce((sum, [, count]) => sum + count, 0);
    if (!total) return null;
    let accumulated = 0;
    const windowLevels = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const [level, count] = sorted[i];
      windowLevels.push({ level, count });
      accumulated += count;
      if (accumulated / total >= 0.5) break;
    }
    const share = windowLevels.reduce((sum, entry) => sum + entry.count, 0) / total;
    return {
      from: windowLevels[0]?.level || null,
      to: windowLevels[windowLevels.length - 1]?.level || null,
      share: round(share, 4),
    };
  }

  function computeHeterogeneity(minIndex, maxIndex, minLevel, maxLevel) {
    if (minIndex == null || maxIndex == null) return null;
    const spread = maxIndex - minIndex;
    let label = "faible";
    if (spread >= 4) label = "marquée";
    else if (spread >= 2) label = "modérée";
    return { label, spread, min_level: minLevel, max_level: maxLevel };
  }

  function resolveCotationThreshold(manualText, levelSet, levelList) {
    const defaultLevel = levelSet.has("6A") ? "6A" : levelList[Math.floor(levelList.length * 0.65)] || levelList[levelList.length - 1];
    if (!manualText) {
      return defaultLevel
        ? { level: defaultLevel, origin: "default", index: levelList.indexOf(defaultLevel) }
        : null;
    }
    const regex = /(seuil|niveau|objectif|cible)\s*(?:min|minimum)?\s*(?:[:=])?\s*([0-9]{1,2}[A-C]?\+?)/gi;
    let match;
    while ((match = regex.exec(manualText))) {
      const candidate = normalizeLevelToken(match[2]);
      if (candidate && (!levelSet || levelSet.has(candidate))) {
        return { level: candidate, origin: "teacher", index: levelList.indexOf(candidate) };
      }
    }
    return defaultLevel
      ? { level: defaultLevel, origin: "default", index: levelList.indexOf(defaultLevel) }
      : null;
  }

  function buildStudentGroups({ students, studentCount, successStudents, atLeastThree }) {
    if (!studentCount) return [];
    const zeroSuccess = studentCount - successStudents;
    const groups = [
      buildHighlight("Volume élevé (≥3 voies)", atLeastThree, studentCount),
      buildHighlight("Sans réussite", zeroSuccess, studentCount),
    ];
    return groups.filter(Boolean);
  }

  function buildClimbSignals({ studentCount, successShare, atLeastTwo, atLeastThree, thresholdShare, thresholdInfo, levelStats }) {
    const signals = [];
    if (studentCount) {
      const shareTwo = studentCount ? atLeastTwo / Math.max(studentCount, 1) : 0;
      if (shareTwo >= 0.5) {
        signals.push(`${toPercent(shareTwo)}% de la classe ont réalisé au moins deux voies.`);
      }
      const shareThree = studentCount ? atLeastThree / Math.max(studentCount, 1) : 0;
      if (shareThree >= 0.3) {
        signals.push(`${toPercent(shareThree)}% ont grimpé au moins trois voies (profil très actif).`);
      }
    }
    if (thresholdInfo && thresholdShare) {
      signals.push(`${toPercent(thresholdShare)}% atteignent ${thresholdInfo.level} ou plus.`);
    }
    if (successShare < 0.5) {
      signals.push(`Moins de la moitié de la classe valide une voie (${toPercent(successShare)}%).`);
    }
    if (levelStats?.heterogeneity?.label === "marquée") {
      signals.push("Hétérogénéité marquée des niveaux observés (écart important entre les cotations).");
    }
    if (levelStats?.majorityWindow?.from && levelStats.majorityWindow.to) {
      signals.push(
        `La majorité des tentatives se situe entre ${levelStats.majorityWindow.from} et ${levelStats.majorityWindow.to}.`
      );
    }
    return Array.from(new Set(signals));
  }

  function buildClimbSummarySentences({
    studentCount,
    attemptCount,
    meanAttempts,
    medianAttempts,
    shareTwo,
    shareThree,
    successStudentShare,
    successAttemptShare,
    firstTryShare,
    neShare,
    thresholdInfo,
    thresholdShare,
    levelStats,
  }) {
    const sentences = createSummarySentences();
    if (!studentCount || !attemptCount) return sentences;
    addSentence(
      sentences.overview,
      `${attemptCount} voie(s) renseignée(s) pour ${studentCount} élève(s) (moyenne ${round(meanAttempts, 2)} / médiane ${round(
        medianAttempts,
        2
      )} voie(s)).`
    );
    addSentence(sentences.overview, buildShareSentence(shareTwo, "renseigné au moins deux voies."));
    addSentence(sentences.overview, buildShareSentence(shareThree, "tenté trois voies ou plus."));
    if (levelStats?.majorityWindow?.from || levelStats?.majorityWindow?.to) {
      const from = levelStats.majorityWindow?.from;
      const to = levelStats.majorityWindow?.to;
      if (from && to && from !== to) {
        addSentence(sentences.overview, `La majorité des cotations observées se situe entre ${from} et ${to}.`);
      } else if (from || to) {
        addSentence(sentences.overview, `La majorité des cotations observées se situe autour de ${from || to}.`);
      }
    }
    if (levelStats?.medianLevel) {
      const maxLevel = levelStats.maxLevel || levelStats.medianLevel;
      addSentence(sentences.overview, `Le niveau médian est ${levelStats.medianLevel} (max observé ${maxLevel}).`);
    }
    addSentence(sentences.overview, describeHeterogeneitySentence(levelStats?.heterogeneity?.label));
    addSentence(sentences.overview, buildShareSentence(successStudentShare, "validé au moins une voie."));

    if (successAttemptShare >= 0.55) {
      addSentence(
        sentences.strengths,
        `${toPercent(successAttemptShare)}% des tentatives aboutissent à un statut E/E2.`
      );
    }
    if (firstTryShare >= 0.5) {
      addSentence(sentences.strengths, "Les réussites au premier essai sont majoritaires.");
    }
    if (shareThree >= 0.33) {
      addSentence(sentences.strengths, buildShareSentence(shareThree, "tenté trois voies ou plus."));
    }
    if (thresholdInfo && thresholdShare >= 0.4) {
      addSentence(sentences.strengths, buildShareSentence(thresholdShare, `atteint ${thresholdInfo.level} ou plus.`));
    }
    if (successStudentShare >= 0.6) {
      addSentence(sentences.strengths, buildShareSentence(successStudentShare, "validé au moins une voie."));
    }

    if (successAttemptShare < 0.5) {
      addSentence(sentences.needs_work, "Moins de la moitié des tentatives se terminent par un statut E/E2.");
    }
    if (neShare >= 0.3) {
      addSentence(sentences.needs_work, `${toPercent(neShare)}% des tentatives restent en statut NE.`);
    }
    if (thresholdInfo && thresholdShare > 0 && thresholdShare < 0.35) {
      addSentence(
        sentences.needs_work,
        `Les voies de niveau ${thresholdInfo.level} et plus restent minoritaires (${toPercent(thresholdShare)}%).`
      );
    }
    if (shareTwo && shareTwo < 0.5) {
      addSentence(sentences.needs_work, "Moins de la moitié des élèves renseignent deux voies ou plus.");
    }
    if (levelStats?.heterogeneity?.label === "marquée") {
      addSentence(sentences.needs_work, "L'hétérogénéité marquée impose une différenciation plus fine.");
    }

    if (thresholdInfo && thresholdShare < 0.35) {
      addSentence(
        sentences.next_steps,
        `Prévoir des essais guidés pour amener davantage d'élèves vers ${thresholdInfo.level} et plus.`
      );
    }
    if (neShare >= 0.3) {
      addSentence(sentences.next_steps, "Planifier un travail ciblé sur les voies encore en statut NE.");
    }
    if (shareTwo && shareTwo < 0.5) {
      addSentence(sentences.next_steps, "Inciter chaque élève à tenter au moins deux voies pour disposer d'un volume utile.");
    }
    if (levelStats?.heterogeneity?.label === "marquée") {
      addSentence(sentences.next_steps, "Mettre en place des ateliers différenciés pour gérer l'hétérogénéité marquée.");
    }

    return sentences;
  }

  function extractCrossTrainingEntry(entry = {}, translator = null) {
    const perExercise = {};
    if (!entry || typeof entry !== "object") return perExercise;
    Object.keys(entry).forEach((key) => {
      if (!key || key.startsWith("__")) return;
      const normalized = normalizeKeyName(key);
      const parsed = parseCrossTrainingField(normalized, translator);
      if (!parsed) return;
      const numeric = coerceNumericValue(entry[key], { tolerateUnits: true });
      if (!Number.isFinite(numeric)) return;
      const exerciseKey = buildCrossExerciseKey(parsed.exerciseId, parsed.variant);
      if (!perExercise[exerciseKey]) {
        perExercise[exerciseKey] = {
          planned: null,
          realized: null,
          meta: {
            id: exerciseKey,
            exerciseId: parsed.exerciseId,
            variant: parsed.variant,
            label: formatExerciseLabel(parsed.exerciseId, parsed.variant, translator),
          },
        };
      }
      if (parsed.type === "p" || parsed.type === "planned") {
        perExercise[exerciseKey].planned = numeric;
      } else if (parsed.type === "r" || parsed.type === "realized") {
        perExercise[exerciseKey].realized = numeric;
      }
    });
    return perExercise;
  }

  function parseCrossTrainingField(normalizedKey, translator = null) {
    if (!normalizedKey) return null;
    const suffixInfo = resolveCrossFieldSuffix(normalizedKey, translator);
    if (!suffixInfo) return null;
    const { base, type } = suffixInfo;
    const exerciseId = translator
      ? resolveTranslatorExerciseId(base, translator)
      : CROSS_EXERCISE_IDS.find((id) => base === id || base.startsWith(`${id}_`));
    if (!exerciseId) return null;
    let variant = base.slice(exerciseId.length);
    variant = variant.replace(/^_/, "");
    if (!variant) variant = null;
    return { exerciseId, variant, type };
  }

  function resolveCrossFieldSuffix(normalizedKey, translator = null) {
    if (translator?.fields) {
      const entries = Object.values(translator.fields);
      for (let index = 0; index < entries.length; index += 1) {
        const field = entries[index];
        if (!field?.suffix) continue;
        if (!normalizedKey.endsWith(field.suffix)) continue;
        const base = normalizedKey.slice(0, normalizedKey.length - field.suffix.length);
        return { base, type: field.key };
      }
      return null;
    }
    const fallback = normalizedKey.match(/(.+)_([pr])$/);
    if (!fallback) return null;
    const type = fallback[2] === "p" ? "planned" : "realized";
    return { base: fallback[1], type };
  }

  function resolveTranslatorExerciseId(base, translator = null) {
    if (!translator?.columnMap) return null;
    if (translator.columnMap[base]) return base;
    const keys = Object.keys(translator.columnMap);
    return keys.find((key) => base.startsWith(`${key}_`)) || null;
  }

  function buildCrossExerciseKey(exerciseId, variant) {
    return variant ? `${exerciseId}_${variant}` : exerciseId;
  }

  function ensureCrossExerciseStat(map, meta) {
    if (map.has(meta.id)) return map.get(meta.id);
    const record = {
      id: meta.id,
      exerciseId: meta.exerciseId,
      variant: meta.variant,
      label: meta.label,
      students: new Map(),
    };
    map.set(meta.id, record);
    return record;
  }

  function computeCrossExerciseSummary(stat) {
    if (!stat || !stat.students || !stat.students.size) return null;
    const samples = Array.from(stat.students.values());
    const realizedValues = samples.map((sample) => (Number.isFinite(sample.realized) ? sample.realized : null)).filter(
      (value) => value != null
    );
    if (!realizedValues.length) return null;
    const plannedValues = samples
      .map((sample) => (Number.isFinite(sample.planned) ? sample.planned : null))
      .filter((value) => value != null);
    const paired = samples
      .map((sample) => {
        if (!Number.isFinite(sample.planned) || !Number.isFinite(sample.realized)) return null;
        return { planned: sample.planned, realized: sample.realized, diff: sample.realized - sample.planned };
      })
      .filter(Boolean);
    const meanRealized = realizedValues.reduce((sum, value) => sum + value, 0) / realizedValues.length;
    const meanPlanned = plannedValues.length
      ? plannedValues.reduce((sum, value) => sum + value, 0) / plannedValues.length
      : null;
    const meanDiff = paired.length ? paired.reduce((sum, sample) => sum + sample.diff, 0) / paired.length : null;
    const aboveCount = paired.filter((sample) => classifyDiff(sample.diff, sample.planned) === "above").length;
    const equalCount = paired.filter((sample) => classifyDiff(sample.diff, sample.planned) === "equal").length;
    const belowCount = paired.filter((sample) => classifyDiff(sample.diff, sample.planned) === "below").length;
    const totalPaired = paired.length || 0;
    return {
      id: stat.id,
      label: stat.label,
      meanPlanned,
      meanRealized,
      medianRealized: calcMedian(realizedValues),
      minRealized: Math.min(...realizedValues),
      maxRealized: Math.max(...realizedValues),
      meanDiff,
      absMeanDiff: meanDiff != null ? Math.abs(meanDiff) : null,
      shareAbove: totalPaired ? aboveCount / totalPaired : 0,
      shareEqual: totalPaired ? equalCount / totalPaired : 0,
      shareBelow: totalPaired ? belowCount / totalPaired : 0,
      dispersion: classifyDispersion(calcStdDev(realizedValues, meanRealized), meanRealized),
      validCount: realizedValues.length,
    };
  }

  function classifyDiff(diff, planned) {
    if (!Number.isFinite(diff)) return "equal";
    const baseTolerance = Math.max(Math.abs(planned || 0) * 0.05, CROSS_DIFF_EQUAL_TOLERANCE);
    if (diff > baseTolerance) return "above";
    if (diff < -baseTolerance) return "below";
    return "equal";
  }

  function isMarkedNegativeDiff(diff, planned) {
    if (!Number.isFinite(diff)) return false;
    const threshold = Math.max(Math.abs(planned || 0) * 0.15, CROSS_DIFF_EQUAL_TOLERANCE * 3);
    return diff < -threshold;
  }

  function isMarkedPositiveDiff(diff, planned) {
    if (!Number.isFinite(diff)) return false;
    const threshold = Math.max(Math.abs(planned || 0) * 0.15, CROSS_DIFF_EQUAL_TOLERANCE * 3);
    return diff > threshold;
  }

  function isSignificantCrossDiff(diff, planned) {
    if (!Number.isFinite(diff)) return false;
    const share = Math.abs(planned || 0) ? Math.abs(diff) / Math.max(Math.abs(planned), 1) : Math.abs(diff);
    if (share >= CROSS_PROFILE_DIFF_SHARE_THRESHOLD) return true;
    return Math.abs(diff) >= CROSS_PROFILE_DIFF_ABS_THRESHOLD;
  }

  function buildCrossTrainingSummarySentences({
    studentCount,
    exerciseSummaries,
    bestExercise,
    challengingExercise,
    largestGap,
    homogeneousExercise,
    heterogeneousExercise,
  }) {
    const sentences = createSummarySentences();
    if (!Array.isArray(exerciseSummaries) || !exerciseSummaries.length) return sentences;
    addSentence(
      sentences.overview,
      `${studentCount} élève(s) analysé(s) sur ${exerciseSummaries.length} exercice(s) exploitable(s).`
    );
    if (bestExercise?.shareAbove) {
      const intro = describeShareIntro(bestExercise.shareAbove);
      if (intro) {
        const verb = intro.singular ? "atteint" : "atteignent";
        addSentence(sentences.overview, `${intro.text} ${verb} l'objectif prévu sur ${bestExercise.label}.`);
      }
    }
    if (largestGap && Number.isFinite(largestGap.meanDiff)) {
      addSentence(
        sentences.overview,
        `${largestGap.label} présente l'écart prévu/réalisé le plus marqué (${round(largestGap.meanDiff || 0, 2)}).`
      );
    }
    if (homogeneousExercise && heterogeneousExercise) {
      addSentence(
        sentences.overview,
        `Les résultats sont plus homogènes sur ${homogeneousExercise.label} que sur ${heterogeneousExercise.label}.`
      );
    }
    if (bestExercise?.shareAbove >= 0.6) {
      const intro = describeShareIntro(bestExercise.shareAbove);
      if (intro) {
        const verb = intro.singular ? "représente" : "représentent";
        addSentence(sentences.strengths, `${intro.text} ${verb} un point fort sur ${bestExercise.label}.`);
      }
    }
    if (largestGap && Number.isFinite(largestGap.meanDiff) && Math.abs(largestGap.meanDiff || 0) >= 1) {
      const polarity = largestGap.meanDiff > 0 ? "au-dessus" : "en dessous";
      const text = `${largestGap.label} reste ${polarity} du plan en moyenne (${round(Math.abs(largestGap.meanDiff), 2)}).`;
      if (largestGap.meanDiff > 0) addSentence(sentences.strengths, text);
      else addSentence(sentences.needs_work, text);
    }
    if (challengingExercise?.shareBelow && challengingExercise.shareBelow >= 0.3) {
      const intro = describeShareIntro(challengingExercise.shareBelow);
      if (intro) {
        const verb = intro.singular ? "reste" : "restent";
        addSentence(sentences.needs_work, `${intro.text} ${verb} en dessous du prévu sur ${challengingExercise.label}.`);
      }
    }
    if (heterogeneousExercise) {
      addSentence(
        sentences.needs_work,
        `${heterogeneousExercise.label} montre une dispersion ${heterogeneousExercise.dispersion?.label || "marquée"}.`
      );
    }
    if (challengingExercise) {
      addSentence(
        sentences.next_steps,
        `Prévoir une différenciation de charge sur ${challengingExercise.label}.`
      );
    }
    if (largestGap && Number.isFinite(largestGap.meanDiff) && Math.abs(largestGap.meanDiff || 0) >= 1) {
      addSentence(
        sentences.next_steps,
        `Ajuster le volume prévu de ${largestGap.label} pour réduire l'écart constaté.`
      );
    }
    return sentences;
  }

  function addSentence(target, text) {
    if (!text || !Array.isArray(target)) return;
    target.push(text);
  }

  function buildShareSentence(share, action) {
    if (!action) return null;
    const descriptor = describeShareIntro(share);
    if (!descriptor) return null;
    const verb = descriptor.singular ? "a" : "ont";
    return `${descriptor.text} ${verb} ${action}`;
  }

  function describeShareIntro(share) {
    if (!Number.isFinite(share) || share <= 0) return null;
    if (share >= 0.92) return { text: "La quasi-totalité des élèves", singular: true };
    if (Math.abs(share - 0.5) <= 0.07) return { text: "La moitié des élèves", singular: true };
    if (Math.abs(share - 1 / 3) <= 0.05) return { text: "Un tiers des élèves", singular: true };
    if (share >= 0.66) return { text: "La majorité des élèves", singular: true };
    if (share <= 0.15) return { text: "Une minorité des élèves", singular: true };
    return { text: `${toPercent(share)} % des élèves`, singular: false };
  }

  function describeHeterogeneitySentence(label) {
    if (!label) return null;
    if (label === "faible") return "Le groupe apparaît peu hétérogène.";
    if (label === "modérée") return "Le groupe apparaît modérément hétérogène.";
    if (label === "marquée") return "Le groupe apparaît très hétérogène.";
    return null;
  }

  function formatExerciseLabel(exerciseId, variant, translator = null) {
    const base =
      translator?.columnMap?.[exerciseId]?.label ||
      CROSS_TRAINING_EXERCISES[exerciseId] ||
      exerciseId.toUpperCase();
    if (!variant) return base;
    const suffix = CROSS_TRAINING_VARIANT_LABELS[variant] || variant.toUpperCase();
    return `${base} (${suffix})`;
  }

  function createStudentProfileCollection() {
    return {
      to_support: [],
      strengths: [],
      to_confirm: [],
    };
  }

  function createBundleProfileCollection() {
    return {
      to_support: [],
      strengths: [],
      to_confirm: [],
      contrasted: [],
    };
  }

  function createBundleProfileSentences() {
    return {
      to_support: [],
      strengths: [],
      to_confirm: [],
      contrasted: [],
    };
  }

  function createStudentRankingCollection() {
    return {
      strongest: [],
      weakest: [],
      below_attempt_average: [],
    };
  }

  function snapshotStudentMetrics(students = new Map(), { crossStats = null } = {}) {
    const metrics = {};
    students.forEach((student, key) => {
      if (!student || !key) return;
      const attempts = Number(student.attempts || student.rawEntryCount || 0);
      const successes = Number(student.successAttempts || 0);
      metrics[key] = {
        key,
        student: {
          prenom: student.prenom || "",
          nom: student.nom || "",
          classe: student.classe || "",
        },
        attempts,
        successAttempts: successes,
        successRate: attempts ? round(successes / attempts, 3) : null,
        highestLevel: student.highestLevel || null,
        highestLevelIndex: typeof student.highestLevelIndex === "number" ? student.highestLevelIndex : null,
      };
    });
    if (crossStats instanceof Map) {
      crossStats.forEach((stat, key) => {
        const performance = evaluateCrossTrainingStudent(stat);
        if (!performance) return;
        metrics[key] = metrics[key] || {
          key,
          student: { prenom: "", nom: "", classe: "" },
          attempts: performance.total || 0,
        };
        metrics[key].cross = {
          total: performance.total,
          above: performance.above,
          below: performance.below,
          score: performance.score,
          aboveShare: performance.aboveShare,
          belowShare: performance.belowShare,
        };
      });
    }
    return metrics;
  }

  function createStudentProfileSentences() {
    return {
      to_support: [],
      strengths: [],
      to_confirm: [],
    };
  }

  function mergeProfileCollections(base = createStudentProfileCollection(), addition = createStudentProfileCollection()) {
    const merged = createStudentProfileCollection();
    STUDENT_PROFILE_KEYS.forEach((key) => {
      const combined = [...(base?.[key] || []), ...(addition?.[key] || [])];
      merged[key] = limitProfileEntries(dedupeProfiles(combined));
    });
    return merged;
  }

  function mergeStudentRankings(
    base = createStudentRankingCollection(),
    addition = createStudentRankingCollection()
  ) {
    const merged = createStudentRankingCollection();
    STUDENT_RANKING_KEYS.forEach((key) => {
      const existing = Array.isArray(base?.[key]) ? base[key] : [];
      const incoming = Array.isArray(addition?.[key]) ? addition[key] : [];
      merged[key] = limitRankingEntries([...existing, ...incoming], STUDENT_RANKING_LIMIT);
    });
    return merged;
  }

  function mergeSentenceCollections(base = createStudentProfileSentences(), addition = createStudentProfileSentences()) {
    const merged = createStudentProfileSentences();
    STUDENT_PROFILE_KEYS.forEach((key) => {
      merged[key] = Array.from(new Set([...(base?.[key] || []), ...(addition?.[key] || [])])).slice(0, 5);
    });
    return merged;
  }

  function dedupeProfileCollection(collection = createStudentProfileCollection()) {
    const cleaned = createStudentProfileCollection();
    STUDENT_PROFILE_KEYS.forEach((key) => {
      cleaned[key] = dedupeProfiles(collection[key] || []);
    });
    return cleaned;
  }

  function dedupeSentenceCollection(collection = createStudentProfileSentences()) {
    const cleaned = createStudentProfileSentences();
    STUDENT_PROFILE_KEYS.forEach((key) => {
      cleaned[key] = Array.from(new Set((collection[key] || []).filter(Boolean)));
    });
    return cleaned;
  }

  function dedupeProfiles(list = []) {
    const seen = new Set();
    return list.filter((profile) => {
      if (!profile || !profile.student) return false;
      const id = `${profile.student}|${profile.signal || ""}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function limitProfileEntries(list = [], max = 5) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, max);
  }

  function limitRankingEntries(list = [], max = STUDENT_RANKING_LIMIT) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const clean = [];
    list.forEach((entry) => {
      if (!entry || !entry.student) return;
      const signature = `${entry.student}|${entry.reason || ""}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      clean.push(entry);
    });
    return clean.slice(0, max);
  }

  function buildRankingList(candidates = [], max = STUDENT_RANKING_LIMIT) {
    if (!Array.isArray(candidates) || !candidates.length) return [];
    const ordered = candidates
      .filter((candidate) => candidate && candidate.entry && candidate.entry.student)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((candidate) => candidate.entry);
    return limitRankingEntries(ordered, max);
  }

  function buildStudentProfileSentences(profiles = createStudentProfileCollection()) {
    const sentences = createStudentProfileSentences();
    STUDENT_PROFILE_KEYS.forEach((key) => {
      sentences[key] = (profiles[key] || []).map((profile) => {
        const label = profile.student || "Élève";
        if (!profile.signal) return label;
        return `${label} — ${profile.signal}`;
      });
    });
    return sentences;
  }

  function createCycleProfileCollection() {
    return {
      progressing: [],
      stalled: [],
      to_support: [],
      strengths: [],
      to_confirm: [],
    };
  }

  function createCycleProfileSentences() {
    return {
      progressing: [],
      stalled: [],
      to_support: [],
      strengths: [],
      to_confirm: [],
    };
  }

  function buildCycleProfileSentences(profiles = createCycleProfileCollection()) {
    const sentences = createCycleProfileSentences();
    CYCLE_PROFILE_KEYS.forEach((key) => {
      const label = CYCLE_PROFILE_LABELS[key] || key;
      sentences[key] = (profiles[key] || [])
        .map((profile) => {
          if (!profile || !profile.student) return null;
          const detail = profile.signal ? ` — ${profile.signal}` : "";
          return `${label} : ${profile.student}${detail}`;
        })
        .filter(Boolean);
    });
    return sentences;
  }

  function buildBundleProfileSentences(profiles = createBundleProfileCollection()) {
    const sentences = createBundleProfileSentences();
    BUNDLE_PROFILE_KEYS.forEach((key) => {
      const label = BUNDLE_PROFILE_LABELS[key] || key;
      sentences[key] = (profiles[key] || []).map((profile) => {
        if (!profile?.student) return null;
        const detail = profile.signal ? ` — ${profile.signal}` : "";
        return `${label} : ${profile.student}${detail}`;
      }).filter(Boolean);
    });
    return sentences;
  }

  function createMergedSessionAnalysis() {
    return {
      overview: [],
      strengths: [],
      needs_work: [],
      next_steps: [],
      student_profiles: createBundleProfileCollection(),
      student_profile_sentences: createBundleProfileSentences(),
    };
  }

  function trimMergedSummary(summary = createSummarySentences()) {
    const trimmed = createSummarySentences();
    SUMMARY_KEYS.forEach((key) => {
      trimmed[key] = limitArray(Array.from(new Set(summary[key] || [])));
    });
    return trimmed;
  }

  function limitArray(list = [], max = 4) {
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean).slice(0, max);
  }

  function combineUniqueStrings(lists = [], limit = 4) {
    const seen = new Set();
    const combined = [];
    (lists || []).forEach((entries) => {
      (entries || []).forEach((item) => {
        const text = typeof item === "string" ? item.trim() : "";
        if (!text) return;
        if (seen.has(text)) return;
        seen.add(text);
        combined.push(text);
      });
    });
    return combined.slice(0, limit);
  }

  function normalizeBundleSource(source, fallbackSummary = {}, manualText = "", index = 0) {
    if (!source || typeof source !== "object") return null;
    const normalized = { ...source };
    let analytics = normalized.class_analytics;
    if (!analytics && Array.isArray(normalized.dataset) && normalized.dataset.length) {
      analytics = analyze({
        dataset: normalized.dataset,
        dictionary: normalized.dictionary || null,
        summary: normalized.summary || fallbackSummary,
        manualText: normalized.manualText || manualText,
      });
    }
    normalized.class_analytics = analytics || null;
    normalized.summary_sentences =
      normalized.summary_sentences || analytics?.summary_sentences || createSummarySentences();
    normalized.student_profiles =
      normalized.student_profiles || analytics?.student_profiles || createStudentProfileCollection();
    normalized.student_profile_sentences =
      normalized.student_profile_sentences ||
      analytics?.student_profile_sentences ||
      buildStudentProfileSentences(normalized.student_profiles);
    normalized.student_metrics =
      normalized.student_metrics || analytics?.student_metrics || {};
    normalized.student_rankings =
      normalized.student_rankings || analytics?.student_rankings || createStudentRankingCollection();
    normalized.app_id = normalized.app_id || normalized.appId || normalized.dictionary?.id || `source_${index + 1}`;
    normalized.app_label =
      normalized.app_label ||
      normalized.appLabel ||
      normalized.activity_label ||
      normalized.dictionary?.label ||
      normalized.app_id;
    return normalized;
  }

  function buildBundleProfiles(sources = []) {
    const ledger = new Map();
    sources.forEach((source) => {
      const profiles = source.student_profiles || createStudentProfileCollection();
      STUDENT_PROFILE_KEYS.forEach((category) => {
        (profiles[category] || []).forEach((profile) => {
          registerBundleProfileSignal(ledger, profile, category, source);
        });
      });
    });
    const merged = createBundleProfileCollection();
    ledger.forEach((entry) => {
      const category = resolveBundleCategory(entry);
      if (!category) return;
      const formatted = formatBundleProfile(entry, category);
      merged[category].push(formatted);
    });
    BUNDLE_PROFILE_KEYS.forEach((key) => {
      merged[key] = limitArray(dedupeProfiles(merged[key] || []), BUNDLE_PROFILE_LIMITS[key] || 3);
    });
    return {
      profiles: merged,
      sentences: buildBundleProfileSentences(merged),
    };
  }

  function registerBundleProfileSignal(ledger, profile = {}, category, source = {}) {
    if (!profile || !profile.student || !category) return;
    const student = String(profile.student).trim();
    if (!student) return;
    const key = student.toLowerCase();
    if (!ledger.has(key)) {
      ledger.set(key, {
        student,
        counts: { to_support: 0, strengths: 0, to_confirm: 0 },
        signals: [],
        evidence: new Set(),
        confidences: [],
      });
    }
    const entry = ledger.get(key);
    if (entry.counts[category] != null) {
      entry.counts[category] += 1;
    }
    entry.signals.push({
      category,
      text: profile.signal || "",
      sourceId: source.app_id || source.appId || null,
      sourceLabel: source.app_label || source.appLabel || "",
    });
    (profile.evidence_fields || []).forEach((field) => {
      if (field) entry.evidence.add(field);
    });
    if (profile.confidence) entry.confidences.push(profile.confidence);
  }

  function resolveBundleCategory(entry) {
    if (!entry) return null;
    if (entry.counts.to_support > 0 && entry.counts.strengths > 0) return "contrasted";
    if (entry.counts.to_support > 0) return "to_support";
    if (entry.counts.strengths > 0) return "strengths";
    if (entry.counts.to_confirm > 0) return "to_confirm";
    return null;
  }

  function formatBundleProfile(entry, category) {
    const relevantCategories =
      category === "contrasted" ? new Set(["to_support", "strengths"]) : new Set([category]);
    const relevantSignals = entry.signals.filter((signal) => relevantCategories.has(signal.category));
    const textParts = relevantSignals.map((signal) => {
      const prefix = signal.sourceLabel ? `${signal.sourceLabel} : ` : "";
      if (signal.text) return `${prefix}${signal.text}`;
      if (signal.category === "to_support") return `${prefix}difficultés répétées`;
      if (signal.category === "strengths") return `${prefix}réussites confirmées`;
      return `${prefix}signal observé`;
    });
    const combinedSignal = textParts.slice(0, 2).join(" / ");
    return {
      student: entry.student,
      signal: combinedSignal,
      evidence_fields: Array.from(entry.evidence).slice(0, 5),
      confidence: computeBundleConfidence(entry, category),
    };
  }

  function computeBundleConfidence(entry, category) {
    const counts = entry.counts || {};
    let baseline = "moderate";
    if (category === "to_support" || category === "strengths") {
      baseline = counts[category] >= 2 ? "high" : "moderate";
    } else if (category === "contrasted") {
      baseline = "moderate";
    } else if (category === "to_confirm") {
      baseline = counts.to_confirm > 1 ? "moderate" : "low";
    }
    const highestSource = pickHighestConfidence(entry.confidences || []);
    return pickHighestConfidence([baseline, highestSource]);
  }

  function pickHighestConfidence(levels = []) {
    const order = { low: 0, moderate: 1, high: 2 };
    let best = "moderate";
    (Array.isArray(levels) ? levels : [levels]).forEach((level) => {
      const normalized = normalizeConfidenceLevel(level);
      if (order[normalized] > order[best]) best = normalized;
    });
    return best;
  }

  function normalizeConfidenceLevel(value) {
    const lower = String(value || "").toLowerCase();
    if (lower === "high" || lower === "elevated") return "high";
    if (lower === "low" || lower === "faible") return "low";
    return "moderate";
  }

  function buildCycleProfiles(sessions = []) {
    const ledger = new Map();
    sessions.forEach((session, order) => {
      const profiles = session.student_profiles || {};
      STUDENT_PROFILE_KEYS.forEach((category) => {
        (profiles[category] || []).forEach((profile) => {
          registerCycleProfileSignal(ledger, profile, category, session, order);
        });
      });
    });
    const collection = createCycleProfileCollection();
    ledger.forEach((entry) => {
      const category = resolveCycleProfileCategory(entry);
      if (!category) return;
      const formatted = formatCycleProfile(entry, category);
      collection[category].push(formatted);
    });
    CYCLE_PROFILE_KEYS.forEach((key) => {
      collection[key] = limitArray(dedupeProfiles(collection[key] || []), CYCLE_PROFILE_LIMITS[key] || 3);
    });
    return {
      profiles: collection,
      sentences: buildCycleProfileSentences(collection),
    };
  }

  function registerCycleProfileSignal(ledger, profile = {}, category, session = {}, order = 0) {
    if (!profile || !profile.student || !category) return;
    const student = String(profile.student).trim();
    if (!student) return;
    const key = student.toLowerCase();
    if (!ledger.has(key)) {
      ledger.set(key, {
        student,
        counts: { to_support: 0, strengths: 0, to_confirm: 0 },
        history: [],
        firstSupportOrder: null,
        lastSupportOrder: null,
        lastStrengthOrder: null,
        evidence: new Set(),
        confidences: [],
      });
    }
    const entry = ledger.get(key);
    entry.counts[category] = (entry.counts[category] || 0) + 1;
    entry.history.push({
      category,
      order,
      sessionName: session.session_name || session.sessionName || `Séance ${order + 1}`,
    });
    if (category === "to_support") {
      if (entry.firstSupportOrder == null || order < entry.firstSupportOrder) {
        entry.firstSupportOrder = order;
      }
      entry.lastSupportOrder = order;
    }
    if (category === "strengths") {
      entry.lastStrengthOrder = order;
    }
    (profile.evidence_fields || []).forEach((field) => {
      if (field) entry.evidence.add(field);
    });
    if (profile.confidence) entry.confidences.push(profile.confidence);
  }

  function resolveCycleProfileCategory(entry) {
    if (!entry) return null;
    const supportCount = entry.counts?.to_support || 0;
    const strengthCount = entry.counts?.strengths || 0;
    if (
      supportCount &&
      strengthCount &&
      entry.lastStrengthOrder != null &&
      entry.firstSupportOrder != null &&
      entry.lastStrengthOrder > entry.firstSupportOrder
    ) {
      return "progressing";
    }
    if (supportCount >= 2 && strengthCount === 0) return "stalled";
    if (strengthCount >= Math.max(2, supportCount + 1)) return "strengths";
    if (supportCount > 0 && strengthCount === 0) return "to_support";
    if (strengthCount > 0 && supportCount === 0) return "strengths";
    if ((entry.counts?.to_confirm || 0) > 0) return "to_confirm";
    return null;
  }

  function formatCycleProfile(entry, category) {
    return {
      student: entry.student,
      signal: describeCycleProfileSignal(entry, category),
      evidence_fields: Array.from(entry.evidence || []),
      confidence: pickHighestConfidence(entry.confidences || []),
    };
  }

  function describeCycleProfileSignal(entry, category) {
    if (category === "progressing") {
      const start = entry.history.find((item) => item.category === "to_support");
      const end = [...entry.history].reverse().find((item) => item.category === "strengths");
      if (start && end) {
        return `progresse de ${start.sessionName} à ${end.sessionName}`;
      }
      return "progression constatée en fin de cycle";
    }
    if (category === "stalled") {
      return "difficultés récurrentes sur plusieurs séances";
    }
    if (category === "to_support") {
      const last = entry.history[entry.history.length - 1];
      return last ? `fragilités lors de ${last.sessionName}` : "fragilités observées récemment";
    }
    if (category === "strengths") {
      const last = entry.history[entry.history.length - 1];
      return last ? `réussites confirmées jusqu'à ${last.sessionName}` : "réussites répétées";
    }
    if (category === "to_confirm") {
      return "signal isolé à confirmer";
    }
    return "";
  }

  function createMergedCycleAnalysis() {
    return {
      overview: [],
      progressions: [],
      stagnations: [],
      regressions: [],
      next_steps: [],
      student_profiles: createCycleProfileCollection(),
      student_profile_sentences: createCycleProfileSentences(),
    };
  }

  function ensureMinimumCycleSignals(analysis = createMergedCycleAnalysis(), sessions = [], { isCrossTraining = false } = {}) {
    if (!Array.isArray(sessions) || sessions.length < 2) return analysis;
    const sessionCount = sessions.length;
    const continuityLine = `${sessionCount} séance(s) retenues : cycle maintenu malgré des relevés partiels.`;
    if (!hasMeaningfulCycleStrings(analysis.overview)) {
      analysis.overview = [continuityLine];
    } else if (!analysis.overview.includes(continuityLine) && analysis.overview.length < 3) {
      analysis.overview.push(continuityLine);
    }
    const engagementLine = isCrossTraining
      ? "Engagement stable observé sur l'activité même sans colonnes prévu/réalisé complètes."
      : "Participation continue constatée sur l'ensemble du cycle.";
    if (!hasMeaningfulCycleStrings(analysis.progressions)) {
      analysis.progressions = [engagementLine];
    }
    if (!hasMeaningfulCycleStrings(analysis.next_steps)) {
      analysis.next_steps = isCrossTraining
        ? [
            "Structurer un relevé prévu/réalisé identique sur chaque atelier.",
            "Stabiliser le protocole de collecte afin de comparer les séances.",
            "Poursuivre le cycle avec un indicateur régulier sur l'engagement.",
          ]
        : [
            "Fixer un format commun de relevé pour toutes les séances du cycle.",
            "Noter les mêmes indicateurs à chaque séance pour suivre la progression.",
          ];
    }
    return analysis;
  }

  function hasMeaningfulCycleStrings(list = []) {
    if (!Array.isArray(list)) return false;
    return list.some((entry) => !isCycleEmptyString(entry));
  }

  function isCycleEmptyString(entry) {
    const normalized = normalizeCycleFallbackString(entry);
    if (!normalized) return true;
    return (
      normalized === "aucune information disponible" ||
      normalized === "aucune donnée exploitable" ||
      normalized === "aucune information exploitable"
    );
  }

  function normalizeCycleFallbackString(entry) {
    if (entry == null) return "";
    return String(entry).trim().replace(/[.!;:?]+$/g, "").toLowerCase();
  }

  function isCrossTrainingSession(session = {}) {
    const dictionaryId = String(session?.dictionary_id || session?.dictionary?.id || "").trim().toLowerCase();
    if (dictionaryId === "cross_training") return true;
    const label = String(session?.dictionary?.label || session?.meta?.activityName || session?.app_label || "")
      .trim()
      .toLowerCase();
    return label.includes("cross") && label.includes("train");
  }

  function buildCycleOverviewSentences(sessions = []) {
    if (!sessions.length) return [];
    const activityLabel =
      sessions[0]?.dictionary?.label || sessions[0]?.meta?.activityName || "Cycle";
    const count = sessions.length;
    const firstDate = formatCycleDate(sessions[0].session_date);
    const lastDate = formatCycleDate(sessions[count - 1].session_date);
    const statements = [`${activityLabel} — ${count} séance(s) analysées.`];
    if (firstDate && lastDate) {
      if (firstDate === lastDate) statements.push(`Dernière séance le ${lastDate}.`);
      else statements.push(`Période du ${firstDate} au ${lastDate}.`);
    } else if (lastDate) {
      statements.push(`Dernière séance le ${lastDate}.`);
    }
    return limitArray(Array.from(new Set(statements.filter(Boolean))), 3);
  }

  function aggregateCycleSummarySentences(sessions = []) {
    const aggregated = {
      overview: [],
      strengths: [],
      needs_work: [],
      next_steps: [],
    };
    if (!Array.isArray(sessions) || !sessions.length) return aggregated;
    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];
    appendSessionSummarySentences(
      aggregated.overview,
      firstSession,
      "overview",
      `Début (${firstSession.session_name || "Séance 1"}) :`
    );
    appendSessionSummarySentences(
      aggregated.overview,
      lastSession,
      "overview",
      `Fin (${lastSession.session_name || `Séance ${sessions.length}`}) :`
    );
    appendSessionSummarySentences(
      aggregated.strengths,
      firstSession,
      "strengths",
      `Début (${firstSession.session_name || "Séance 1"}) :`
    );
    appendSessionSummarySentences(
      aggregated.strengths,
      lastSession,
      "strengths",
      `Fin (${lastSession.session_name || `Séance ${sessions.length}`}) :`
    );
    appendSessionSummarySentences(
      aggregated.needs_work,
      lastSession,
      "needs_work",
      `Fin (${lastSession.session_name || `Séance ${sessions.length}`}) :`
    );
    appendSessionSummarySentences(
      aggregated.needs_work,
      firstSession,
      "needs_work",
      `Début (${firstSession.session_name || "Séance 1"}) :`
    );
    appendSessionSummarySentences(
      aggregated.next_steps,
      lastSession,
      "next_steps",
      `Fin (${lastSession.session_name || `Séance ${sessions.length}`}) :`
    );
    sessions.forEach((session, index) => {
      const label = session.session_name || `Séance ${index + 1}`;
      const signals = session.class_analytics?.pedagogical_signals || [];
      signals.slice(0, 2).forEach((signal) => {
        const clean = String(signal || "").trim();
        if (clean) aggregated.needs_work.push(`${label} : ${clean}`);
      });
      const limits = session.class_analytics?.limits || [];
      limits.slice(0, 1).forEach((limitEntry) => {
        const clean = String(limitEntry || "").trim();
        if (clean) aggregated.needs_work.push(`${label} : ${clean}`);
      });
    });
    aggregated.overview = limitArray(Array.from(new Set(aggregated.overview.filter(Boolean))), 6);
    aggregated.strengths = limitArray(Array.from(new Set(aggregated.strengths.filter(Boolean))), 5);
    aggregated.needs_work = limitArray(Array.from(new Set(aggregated.needs_work.filter(Boolean))), 5);
    aggregated.next_steps = limitArray(Array.from(new Set(aggregated.next_steps.filter(Boolean))), 5);
    return aggregated;
  }

  function appendSessionSummarySentences(target = [], session = {}, key = "", prefix = "", max = 2) {
    if (!session || !key) return;
    const sentences = session.summary_sentences?.[key];
    if (!Array.isArray(sentences) || !sentences.length) return;
    sentences.slice(0, max).forEach((sentence) => {
      const clean = String(sentence || "").trim();
      if (!clean) return;
      target.push(prefix ? `${prefix} ${clean}` : clean);
    });
  }

  function formatCycleDate(value) {
    const timestamp = parseDateValue(value);
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleDateString("fr-FR");
    } catch {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }

  function analyzeCycleTrends(sessions = []) {
    const result = {
      progressions: [],
      stagnations: [],
      regressions: [],
      trendNextSteps: [],
    };
    if (!sessions.length) return result;
    const firstAnalytics = sessions[0].class_analytics || {};
    const lastAnalytics = sessions[sessions.length - 1].class_analytics || {};
    const firstMeasures = firstAnalytics.measures || {};
    const lastMeasures = lastAnalytics.measures || {};

    evaluateNumericTrend({
      label: "Voies par élève",
      firstValue: firstMeasures.voies?.mean_per_student,
      lastValue: lastMeasures.voies?.mean_per_student,
      threshold: 0.25,
      formatter: (value) => `${round(value, 2)}`,
      result,
      regressionNextStep: "Planifier un volume minimal de voies pour tous.",
    });

    evaluateNumericTrend({
      label: "Volume total de voies",
      firstValue: firstMeasures.voies?.total,
      lastValue: lastMeasures.voies?.total,
      threshold: 5,
      formatter: (value) => `${Math.round(value)}`,
      result,
      regressionNextStep: "Sécuriser les répétitions pour relancer le volume de passes.",
    });

    evaluateLevelTrend({
      label: "Cotation médiane",
      firstValue: firstMeasures.cotation?.median_level,
      lastValue: lastMeasures.cotation?.median_level,
      result,
    });

    evaluateThresholdTrend({
      label: firstMeasures.cotation?.threshold?.level || "Seuil",
      firstShare: firstMeasures.cotation?.threshold?.share,
      lastShare: lastMeasures.cotation?.threshold?.share,
      result,
    });

    evaluateHeterogeneityTrend({
      firstLabel: firstMeasures.cotation?.heterogeneity?.label,
      lastLabel: lastMeasures.cotation?.heterogeneity?.label,
      result,
    });

    result.progressions = limitArray(Array.from(new Set(result.progressions.filter(Boolean))), 4);
    result.stagnations = limitArray(Array.from(new Set(result.stagnations.filter(Boolean))), 4);
    result.regressions = limitArray(Array.from(new Set(result.regressions.filter(Boolean))), 4);
    result.trendNextSteps = limitArray(Array.from(new Set(result.trendNextSteps.filter(Boolean))), 4);
    return result;
  }

  function evaluateNumericTrend({ label, firstValue, lastValue, threshold = 0.1, formatter = (value) => `${round(value, 2)}`, result, regressionNextStep = "" }) {
    if (!Number.isFinite(firstValue) || !Number.isFinite(lastValue)) return;
    const diff = lastValue - firstValue;
    const sentence = `${label} : ${formatter(firstValue)} → ${formatter(lastValue)}.`;
    if (Math.abs(diff) < threshold) {
      result.stagnations.push(sentence);
      return;
    }
    if (diff > 0) {
      result.progressions.push(sentence);
    } else {
      result.regressions.push(sentence);
      if (regressionNextStep) result.trendNextSteps.push(regressionNextStep);
    }
  }

  function evaluateLevelTrend({ label, firstValue, lastValue, result }) {
    const firstIndex = levelIndexFromValue(firstValue);
    const lastIndex = levelIndexFromValue(lastValue);
    if (firstIndex == null || lastIndex == null) return;
    if (lastIndex === firstIndex) {
      result.stagnations.push(`Cotation médiane stable (${label || firstValue}).`);
      return;
    }
    if (lastIndex > firstIndex) {
      result.progressions.push(`Cotation médiane progresse de ${firstValue} à ${lastValue}.`);
    } else {
      result.regressions.push(`Cotation médiane baisse de ${firstValue} à ${lastValue}.`);
      result.trendNextSteps.push("Stabiliser les niveaux atteints avant d'augmenter la difficulté.");
    }
  }

  function evaluateThresholdTrend({ label, firstShare, lastShare, result }) {
    if (!Number.isFinite(firstShare) || !Number.isFinite(lastShare)) return;
    const sentence = `${label} : ${toPercent(firstShare)} % → ${toPercent(lastShare)} %.`;
    const diff = lastShare - firstShare;
    if (Math.abs(diff) < 0.05) {
      result.stagnations.push(sentence);
      return;
    }
    if (diff > 0) {
      result.progressions.push(sentence);
    } else {
      result.regressions.push(sentence);
      result.trendNextSteps.push(`Réactiver les repères pour atteindre ${label}.`);
    }
  }

  function evaluateHeterogeneityTrend({ firstLabel, lastLabel, result }) {
    if (!firstLabel || !lastLabel) return;
    const firstRank = heterogeneityRank(firstLabel);
    const lastRank = heterogeneityRank(lastLabel);
    if (firstRank == null || lastRank == null) return;
    if (lastRank === firstRank) {
      result.stagnations.push(`Hétérogénéité ${lastLabel}.`);
      return;
    }
    if (lastRank < firstRank) {
      result.progressions.push(`Hétérogénéité réduite (${firstLabel} → ${lastLabel}).`);
    } else {
      result.regressions.push(`Hétérogénéité en hausse (${firstLabel} → ${lastLabel}).`);
      result.trendNextSteps.push("Prévoir une différenciation plus marquée pour réduire l'écart.");
    }
  }

  function heterogeneityRank(label) {
    const normalized = String(label || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return HETEROGENEITY_RANK.hasOwnProperty(normalized) ? HETEROGENEITY_RANK[normalized] : null;
  }

  function levelIndexFromValue(value) {
    if (!value) return null;
    const normalized = normalizeLevelToken(value);
    if (!normalized) return null;
    const index = DEFAULT_LEVEL_SEQUENCE.indexOf(normalized);
    return index >= 0 ? index : null;
  }

  function buildCycleNextSteps(sessions = [], trendNextSteps = []) {
    if (!sessions.length) return trendNextSteps || [];
    const sentences = [...(trendNextSteps || [])];
    const lastSession = sessions[sessions.length - 1];
    if (lastSession?.summary_sentences?.next_steps?.length) {
      sentences.push(...lastSession.summary_sentences.next_steps);
    }
    return limitArray(Array.from(new Set(sentences.filter(Boolean))), 4);
  }

  function normalizeCycleSession(session = {}, summary = {}, manualText = "", index = 0) {
    if (!session || typeof session !== "object") return null;
    const normalized = { ...session };
    let analytics = normalized.class_analytics;
    if (!analytics && Array.isArray(normalized.dataset) && normalized.dataset.length) {
      analytics = analyze({
        dataset: normalized.dataset,
        dictionary: normalized.dictionary || null,
        summary: normalized.summary || summary,
        manualText: normalized.manualText || manualText,
      });
    }
    if (!analytics) return null;
    normalized.class_analytics = analytics;
    normalized.summary_sentences =
      normalized.summary_sentences || analytics.summary_sentences || createSummarySentences();
    normalized.student_profiles =
      normalized.student_profiles || analytics.student_profiles || createStudentProfileCollection();
    normalized.student_profile_sentences =
      normalized.student_profile_sentences ||
      analytics.student_profile_sentences ||
      buildStudentProfileSentences(normalized.student_profiles);
    normalized.student_metrics =
      normalized.student_metrics || analytics.student_metrics || {};
    normalized.student_rankings =
      normalized.student_rankings || analytics.student_rankings || createStudentRankingCollection();
    normalized.session_name = normalized.session_name || normalized.sessionName || normalized.name || `Séance ${index + 1}`;
    normalized.session_date = normalized.session_date || normalized.updatedAt || normalized.createdAt || null;
    normalized.session_index = normalized.session_index || index + 1;
    normalized.dictionary = normalized.dictionary || analytics.context?.dictionary || null;
    normalized.meta = normalized.meta || {};
    return normalized;
  }

  function parseDateValue(value) {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function buildClimbTrackStudentProfiles(students = new Map()) {
    const profiles = createStudentProfileCollection();
    const support = [];
    const strengths = [];
    const confirm = [];
    students.forEach((student) => {
      const name = formatStudentName(student);
      if (!name) return;
      const performance = evaluateClimbStudentPerformance(student);
      if (!performance) return;
      const supportSignal = describeClimbSupportSignal(performance);
      if (supportSignal) {
        support.push({
          profile: {
            student: name,
            signal: supportSignal.text,
            evidence_fields: ["statut", "cotation"],
            confidence: supportSignal.confidence,
          },
          score: supportSignal.weight,
        });
        return;
      }
      const strengthSignal = describeClimbStrengthSignal(performance);
      if (strengthSignal) {
        strengths.push({
          profile: {
            student: name,
            signal: strengthSignal.text,
            evidence_fields: ["cotation", "statut"],
            confidence: strengthSignal.confidence,
          },
          score: strengthSignal.weight,
        });
        return;
      }
      const confirmSignal = describeClimbConfirmSignal(performance);
      if (confirmSignal) {
        confirm.push({
          profile: {
            student: name,
            signal: confirmSignal.text,
            evidence_fields: ["statut", "cotation"],
            confidence: "low",
          },
          score: confirmSignal.weight,
        });
      }
    });
    profiles.to_support = limitProfileEntries(sortProfiles(support).map((entry) => entry.profile), 2);
    profiles.strengths = limitProfileEntries(sortProfiles(strengths).map((entry) => entry.profile), 2);
    profiles.to_confirm = limitProfileEntries(sortProfiles(confirm).map((entry) => entry.profile), PROFILE_MAX_CONFIRM_ENTRIES);
    return profiles;
  }

  function buildClimbStudentRankings({ students = new Map(), meanAttempts = 0 } = {}) {
    const rankings = createStudentRankingCollection();
    if (!students?.size || students.size < MIN_STUDENT_RANKING_STUDENTS) return rankings;
    const strong = [];
    const weak = [];
    const low = [];
    students.forEach((student) => {
      const name = formatStudentName(student);
      if (!name) return;
      const attempts = student.attempts || 0;
      if (!attempts) return;
      const successes = student.successAttempts || 0;
      const successRate = attempts ? successes / attempts : 0;
      const highestLevel = student.highestLevel || null;
      const hasHighLevel = highestLevel ? isHighClimbLevel(highestLevel) : false;
      if (
        attempts >= 2 &&
        (successRate >= 0.7 || (hasHighLevel && successes >= 1))
      ) {
        const reason =
          successRate >= 0.7
            ? `réussite régulière (${successes}/${attempts} voies)`
            : `niveau atteint ${highestLevel}`;
        strong.push({
          score: successRate + (hasHighLevel ? 0.2 : 0),
          entry: {
            student: name,
            metric: round(successRate, 2),
            attempts,
            reason,
          },
        });
      }
      const failed = Math.max(attempts - successes, 0);
      const failureRate = attempts ? failed / attempts : 1;
      if (attempts >= 2 && (failureRate >= 0.6 || successes === 0)) {
        const failureDetail =
          successes === 0 ? "aucune voie enchaînée" : `${failed}/${attempts} voies non enchaînées`;
        weak.push({
          score: failureRate,
          entry: {
            student: name,
            metric: round(failureRate, 2),
            attempts,
            reason: `difficultés persistantes (${failureDetail})`,
          },
        });
      }
      if (meanAttempts >= 2 && attempts && attempts < meanAttempts - 0.25) {
        low.push({
          score: meanAttempts - attempts,
          entry: {
            student: name,
            attempts,
            reason: `${attempts} tentative(s) vs moyenne ${round(meanAttempts, 1)}`,
          },
        });
      }
    });
    rankings.strongest = buildRankingList(strong);
    rankings.weakest = buildRankingList(weak);
    rankings.below_attempt_average = buildRankingList(low);
    return rankings;
  }

  function evaluateClimbStudentPerformance(student = {}) {
    const attempts = student.attempts || 0;
    if (!attempts) return null;
    const statusCounts = student.statusCounts || {};
    const eCount = statusCounts.E || 0;
    const e2Count = statusCounts.E2 || 0;
    const neCount = statusCounts.NE || 0;
    const otherFailures = Object.entries(statusCounts).reduce((sum, [code, count]) => {
      if (!SUCCESS_STATUSES.has(code) && code !== "NE") {
        return sum + (count || 0);
      }
      return sum;
    }, 0);
    let score = eCount * 2 + e2Count * 1 - neCount * 2 - otherFailures;
    const successLevels = [];
    const failureLevels = [];
    let highFailureCount = 0;
    let highSuccessCount = 0;
    (student.levelHistory || []).forEach((entry) => {
      if (!entry || !entry.status) return;
      if (SUCCESS_STATUSES.has(entry.status)) {
        if (entry.level) successLevels.push(entry.level);
        if (isHighClimbLevel(entry.level)) {
          score += 1;
          highSuccessCount += 1;
        }
      } else if (entry.status === "NE") {
        if (entry.level) failureLevels.push(entry.level);
        if (isHighClimbLevel(entry.level)) {
          score -= 1;
          highFailureCount += 1;
        }
      }
    });
    return {
      attempts,
      successes: eCount + e2Count,
      failures: neCount,
      successLevels,
      failureLevels,
      highFailureCount,
      highSuccessCount,
      score,
      highestLevel: student.highestLevel || null,
      confidence: attempts >= 4 ? "high" : attempts >= 2 ? "moderate" : "low",
    };
  }

  function describeClimbSupportSignal(performance) {
    if (!performance) return null;
    if (performance.attempts < CLIMB_MIN_ATTEMPTS_FOR_STRONG_PROFILE) return null;
    const repeatedFailures = performance.failures >= 2;
    const zeroSuccess = performance.successes === 0 && performance.attempts >= 3;
    const highFailures = performance.highFailureCount >= 1;
    const strongNegative = performance.score <= -4;
    if (!(repeatedFailures || zeroSuccess || highFailures || strongNegative)) return null;
    let text = "difficultés répétées à valider les voies";
    if (highFailures) {
      const hint = summarizeLevelRange(
        performance.failureLevels.filter((level) => isHighClimbLevel(level))
      );
      if (hint) text = `non-enchaînements ${hint}`;
      else text = "non-enchaînements sur des voies élevées";
    } else if (zeroSuccess) {
      text = `aucune voie validée sur ${performance.attempts} tentative${performance.attempts > 1 ? "s" : ""}`;
    } else if (performance.failures >= 2) {
      const list = formatLevelExamples(performance.failureLevels, 2);
      text = list
        ? `${performance.failures} non-enchaînements sur ${list}`
        : `${performance.failures} non-enchaînements successifs`;
    } else if (strongNegative) {
      text = "profil globalement en difficulté";
    }
    return {
      text,
      weight: Math.max(performance.failures, 1) + performance.highFailureCount + Math.max(0, -performance.score),
      confidence: performance.confidence,
    };
  }

  function describeClimbStrengthSignal(performance) {
    if (!performance) return null;
    if (performance.attempts < CLIMB_MIN_ATTEMPTS_FOR_STRONG_PROFILE) return null;
    if (performance.successes < 2) return null;
    if (performance.score < 4) return null;
    const levelHint = formatLevelExamples(performance.successLevels, 2) || summarizeLevelRange(performance.successLevels);
    let text = levelHint ? `réussites répétées sur ${levelHint}` : "réussites répétées et stables";
    if (performance.highSuccessCount && performance.highestLevel) {
      text = `réussites régulières jusqu'à ${performance.highestLevel}`;
    }
    return {
      text,
      weight: performance.successes + performance.highSuccessCount + performance.score / 2,
      confidence: performance.confidence,
    };
  }

  function describeClimbConfirmSignal(performance) {
    if (!performance) return null;
    if (performance.attempts < CLIMB_MIN_ATTEMPTS_FOR_CONFIRM) return null;
    if (performance.attempts >= CLIMB_MIN_ATTEMPTS_FOR_STRONG_PROFILE) return null;
    if (Math.abs(performance.score) < 2) return null;
    const attemptLabel =
      performance.attempts === 1 ? "une seule voie exploitée" : "deux voies exploitées";
    if (performance.successes >= 2) {
      const levels = formatLevelExamples(performance.successLevels, 2) || summarizeLevelRange(performance.successLevels);
      const detail = levels ? `réussites à confirmer sur ${levels}` : "réussites à confirmer";
      return {
        text: `${detail} (${attemptLabel})`,
        weight: performance.score,
      };
    }
    if (performance.failures >= 2) {
      const levels =
        formatLevelExamples(performance.failureLevels, 2) || summarizeLevelRange(performance.failureLevels);
      const detail = levels ? `non-enchaînements sur ${levels}` : "non-enchaînements à confirmer";
      return {
        text: `${detail} (${attemptLabel})`,
        weight: Math.abs(performance.score),
      };
    }
    if (performance.successes === 1) {
      const level = performance.successLevels[performance.successLevels.length - 1] || null;
      const detail = level ? `réussite isolée sur ${level}` : "réussite isolée";
      return {
        text: `${detail} (${attemptLabel})`,
        weight: performance.score,
      };
    }
    if (performance.failures === 1 && performance.score <= -2) {
      const level = performance.failureLevels[performance.failureLevels.length - 1] || null;
      const detail = level ? `échec isolé sur ${level}` : "échec isolé";
      return {
        text: `${detail} (${attemptLabel})`,
        weight: Math.abs(performance.score),
      };
    }
    return null;
  }

  function sortProfiles(entries = []) {
    return entries
      .filter((entry) => entry && entry.profile && entry.profile.student)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  function summarizeLevelRange(levels = []) {
    if (!levels.length) return "";
    const unique = Array.from(new Set(levels));
    if (unique.length === 1) return `sur ${unique[0]}`;
    return `entre ${unique[0]} et ${unique[unique.length - 1]}`;
  }

  function formatLevelExamples(levels = [], limit = 2) {
    const unique = Array.from(new Set(levels.filter(Boolean)));
    if (!unique.length) return "";
    const slice = unique.slice(0, limit);
    if (slice.length === 1) return slice[0];
    return `${slice.slice(0, -1).join(" et ")} et ${slice[slice.length - 1]}`;
  }

  function isHighClimbLevel(level = "") {
    const normalized = normalizeLevelToken(level);
    if (!normalized) return false;
    if (/^[67]/.test(normalized)) return true;
    return ["5C", "5C+", "5B+"].includes(normalized);
  }

  function formatStudentName(student = {}) {
    return student.prenom || student.nom || "";
  }

  function buildGenericAttemptRankings(
    students = new Map(),
    { includeBelowAverage = true } = {}
  ) {
    const rankings = createStudentRankingCollection();
    if (!includeBelowAverage || !students?.size || students.size < MIN_STUDENT_RANKING_STUDENTS) return rankings;
    const counts = [];
    students.forEach((student) => {
      const attempts = student.attempts || student.rawEntryCount || 0;
      counts.push({ student, attempts });
    });
    if (!counts.length) return rankings;
    const mean =
      counts.reduce((sum, entry) => sum + (entry.attempts || 0), 0) / Math.max(counts.length, 1);
    if (!mean || mean < 1.5) return rankings;
    const low = counts
      .map(({ student, attempts }) => {
        if (!attempts) return null;
        if (attempts >= mean - 0.25) return null;
        const name = formatStudentName(student);
        if (!name) return null;
        return {
          score: mean - attempts,
          entry: {
            student: name,
            attempts,
            reason: `${attempts} enregistrement(s) < moyenne ${round(mean, 1)}`,
          },
        };
      })
      .filter(Boolean);
    if (!low.length) return rankings;
    rankings.below_attempt_average = buildRankingList(low);
    return rankings;
  }

  function buildCrossTrainingStudentProfiles({ students = new Map(), stats = new Map() } = {}) {
    const profiles = createStudentProfileCollection();
    const support = [];
    const strengths = [];
    const confirm = [];
    stats.forEach((record, key) => {
      const student = students.get(key);
      const name = formatStudentName(student || {});
      if (!name) return;
      const performance = evaluateCrossTrainingStudent(record);
      if (!performance) return;
      const supportSignal = describeCrossSupportSignal(performance);
      if (supportSignal) {
        support.push({
          profile: {
            student: name,
            signal: supportSignal.text,
            evidence_fields: ["prévu", "réalisé"],
            confidence: supportSignal.confidence,
          },
          score: supportSignal.weight,
        });
        return;
      }
      const strengthSignal = describeCrossStrengthSignal(performance);
      if (strengthSignal) {
        strengths.push({
          profile: {
            student: name,
            signal: strengthSignal.text,
            evidence_fields: ["prévu", "réalisé"],
            confidence: strengthSignal.confidence,
          },
          score: strengthSignal.weight,
        });
        return;
      }
      const confirmSignal = describeCrossConfirmSignal(performance);
      if (confirmSignal) {
        confirm.push({
          profile: {
            student: name,
            signal: confirmSignal.text,
            evidence_fields: ["prévu", "réalisé"],
            confidence: "low",
          },
          score: confirmSignal.weight,
        });
      }
    });
    profiles.to_support = limitProfileEntries(sortProfiles(support).map((entry) => entry.profile), 2);
    profiles.strengths = limitProfileEntries(sortProfiles(strengths).map((entry) => entry.profile), 2);
    profiles.to_confirm = limitProfileEntries(sortProfiles(confirm).map((entry) => entry.profile), PROFILE_MAX_CONFIRM_ENTRIES);
    return profiles;
  }

  function buildCrossTrainingStudentRankings({ students = new Map(), stats = new Map() } = {}) {
    const rankings = createStudentRankingCollection();
    if (!stats?.size || stats.size < MIN_STUDENT_RANKING_STUDENTS) return rankings;
    const records = [];
    stats.forEach((record, key) => {
      const performance = evaluateCrossTrainingStudent(record);
      if (!performance) return;
      const student = students.get(key);
      const name = formatStudentName(student || {});
      if (!name) return;
      records.push({ name, performance });
    });
    if (records.length < MIN_STUDENT_RANKING_STUDENTS) return rankings;
    const meanAttempts =
      records.reduce((sum, entry) => sum + (entry.performance.total || 0), 0) / Math.max(records.length, 1);
    const strong = [];
    const weak = [];
    const low = [];
    records.forEach(({ name, performance }) => {
      const total = performance.total || 0;
      if (!total) return;
      const successShare = performance.aboveShare || 0;
      const failureShare = performance.belowShare || 0;
      if (total >= CROSS_MIN_EXERCISES_FOR_STRONG_PROFILE && successShare >= 0.6) {
        strong.push({
          score: successShare + (performance.score || 0),
          entry: {
            student: name,
            metric: round(successShare, 2),
            attempts: total,
            reason: `réussite régulière (${toPercent(successShare)}% des ateliers au-dessus du prévu)`,
          },
        });
      }
      if (
        total >= CROSS_MIN_EXERCISES_FOR_STRONG_PROFILE &&
        (failureShare >= 0.5 || (performance.score || 0) <= -2)
      ) {
        const reason =
          failureShare >= 0.5
            ? `écarts sous l'objectif (${toPercent(failureShare)}% des ateliers)`
            : "peu de réussites observées";
        weak.push({
          score: failureShare || Math.abs(performance.score || 0),
          entry: {
            student: name,
            metric: round(failureShare || Math.abs(performance.score || 0), 2),
            attempts: total,
            reason,
          },
        });
      }
    });
    if (meanAttempts >= 2) {
      records.forEach(({ name, performance }) => {
        const total = performance.total || 0;
        if (total && total < meanAttempts - 0.25) {
          low.push({
            score: meanAttempts - total,
            entry: {
              student: name,
              attempts: total,
              reason: `${total} atelier(s) renseigné(s) < moyenne ${round(meanAttempts, 1)}`,
            },
          });
        }
      });
    }
    rankings.strongest = buildRankingList(strong);
    rankings.weakest = buildRankingList(weak);
    rankings.below_attempt_average = buildRankingList(low);
    return rankings;
  }

  function buildClimbStudentSessionAnalysis({ studentKey, students = new Map(), classOverview = {}, dictionary = null, summary = {}, stats = {} }) {
    if (!studentKey || !students.has(studentKey)) return null;
    const student = students.get(studentKey);
    const attempts = student.attempts || student.rawEntryCount || 0;
    if (!attempts) return null;
    const classMean = classOverview?.aggregate?.mean_attempts_per_student || 0;
    const successAttempts = student.successAttempts || 0;
    const successRate = attempts ? successAttempts / attempts : null;
    const positioning = classifyRelativePosition(
      Number.isFinite(successRate) ? successRate : attempts,
      Number.isFinite(successRate) && Number.isFinite(stats.successAttemptShare || null)
        ? stats.successAttemptShare
        : classMean
    );
    const strengths = [];
    const focus = [];
    if (Number.isFinite(successRate)) {
      if (successRate >= 0.7) strengths.push("réussite régulière sur les voies tentées");
      if (successRate <= 0.4) focus.push("taux de réussite à consolider");
    }
    if (student.highestLevel) strengths.push(`niveau atteint : ${student.highestLevel}`);
    if (classMean) {
      if (attempts >= classMean + 0.5) strengths.push("engagement supérieur à la moyenne de classe");
      if (attempts + 0.5 <= classMean) focus.push("volume de pratique inférieur à la moyenne");
    }
    const nextSteps =
      focus.length > 0
        ? [
            "Programmer un essai guidé sur les voies ciblées.",
            "Fixer un objectif simple pour rejoindre la moyenne de classe.",
          ]
        : ["Proposer un défi d'un niveau supérieur pour maintenir la progression.", "Valoriser les réussites observées."];
    const comparisonNotes = [];
    if (Number.isFinite(successRate) && Number.isFinite(stats.successAttemptShare)) {
      comparisonNotes.push(`Réussite ${toPercent(successRate)}% vs classe ${toPercent(stats.successAttemptShare)}%.`);
    }
    if (classMean) comparisonNotes.push(`Volume ${attempts} vs moyenne ${round(classMean, 1)}.`);
    return composeStudentAnalysisPayload({
      studentKey,
      studentInfo: student,
      activityLabel: dictionary?.label || summary?.meta?.activityName || "",
      dictionaryId: dictionary?.id || "",
      scope: "session",
      attempts,
      classAttempts: classMean,
      performance:
        successRate != null
          ? { label: "Taux de réussite", value: round(successRate, 2), unit: "ratio" }
          : null,
      classPerformance:
        successRate != null && Number.isFinite(stats.successAttemptShare) ? round(stats.successAttemptShare, 2) : null,
      positioning,
      trend: "stable",
      strengths,
      focus,
      nextSteps,
      comparisonNotes,
    });
  }

  function buildCrossStudentSessionAnalysis({
    studentKey,
    students = new Map(),
    classOverview = {},
    crossStats = new Map(),
    summaries = [],
    dictionary = null,
  }) {
    if (!studentKey) return null;
    const student = students.get(studentKey);
    const performance = crossStats.get(studentKey) ? evaluateCrossTrainingStudent(crossStats.get(studentKey)) : null;
    const attempts = performance?.total || student?.rawEntryCount || 0;
    if (!attempts) return null;
    const classMean = classOverview?.aggregate?.mean_entries_per_student || 0;
    const successShare = performance?.aboveShare;
    const classSuccess =
      summaries && summaries.length
        ? summaries.reduce((sum, entry) => sum + (entry.shareAbove || 0), 0) / summaries.length
        : null;
    const positioning = classifyRelativePosition(
      Number.isFinite(successShare) ? successShare : attempts,
      Number.isFinite(successShare) && Number.isFinite(classSuccess) ? classSuccess : classMean
    );
    const strengths = [];
    const focus = [];
    if (Number.isFinite(successShare)) {
      if (successShare >= 0.6) strengths.push("réalise la plupart des ateliers conformément au prévu");
      if (successShare <= 0.4) focus.push("écarts importants entre prévu et réalisé");
    }
    if (performance?.score <= -2) focus.push("écarts sous le plan à résorber sur plusieurs ateliers");
    if (!Number.isFinite(successShare)) {
      if (classMean && attempts >= classMean + 0.5) strengths.push("engagement supérieur à la moyenne de classe");
      if (classMean && attempts + 0.5 <= classMean) focus.push("volume d'ateliers inférieur à la moyenne");
    }
    const nextSteps =
      focus.length > 0
        ? ["Revoir le dosage prévu/réalisé sur un atelier clé.", "Prévoir un retour intermédiaire pour ajuster l'effort."]
        : ["Maintenir la régularité observée tout en variant un atelier plus exigeant.", "Valoriser la gestion d'effort actuelle."];
    const comparisonNotes = [];
    if (Number.isFinite(successShare) && Number.isFinite(classSuccess)) {
      comparisonNotes.push(
        `Ateliers au-dessus du plan : ${toPercent(successShare)}% vs classe ${toPercent(classSuccess)}%.`
      );
    }
    if (classMean) comparisonNotes.push(`Volume ${attempts} ateliers vs moyenne ${round(classMean, 1)}.`);
    return composeStudentAnalysisPayload({
      studentKey,
      studentInfo: student || { prenom: "", nom: "", classe: "" },
      activityLabel: dictionary?.label || "",
      dictionaryId: dictionary?.id || "",
      scope: "session",
      attempts,
      classAttempts: classMean,
      performance:
        Number.isFinite(successShare)
          ? { label: "Ateliers au-dessus du plan", value: round(successShare, 2), unit: "ratio" }
          : null,
      classPerformance: Number.isFinite(classSuccess) ? round(classSuccess, 2) : null,
      positioning,
      trend: "stable",
      strengths,
      focus,
      nextSteps,
      comparisonNotes,
    });
  }

  function buildGenericStudentSessionAnalysis({
    studentKey,
    students = new Map(),
    classOverview = {},
    dictionary = null,
    summary = {},
  }) {
    if (!studentKey || !students.has(studentKey)) return null;
    const student = students.get(studentKey);
    const attempts = student.attempts || student.rawEntryCount || 0;
    if (!attempts) return null;
    const classMean =
      classOverview?.aggregate?.mean_entries_per_student ||
      classOverview?.aggregate?.mean_attempts_per_student ||
      0;
    const positioning = classifyRelativePosition(attempts, classMean);
    const strengths = [];
    const focus = [];
    if (classMean) {
      if (attempts >= classMean + 0.5) strengths.push("engagement supérieur à la moyenne de classe");
      if (attempts + 0.5 <= classMean) focus.push("volume de pratique inférieur à la moyenne");
    }
    const nextSteps =
      focus.length > 0
        ? ["Fixer un objectif simple pour rejoindre la moyenne de classe.", "Prévoir un accompagnement sur un atelier clé."]
        : ["Poursuivre la dynamique observée sur cette séance.", "Varier les situations pour maintenir la motivation."];
    const comparisonNotes = [];
    if (classMean) comparisonNotes.push(`Volume ${attempts} vs moyenne ${round(classMean, 1)}.`);
    return composeStudentAnalysisPayload({
      studentKey,
      studentInfo: student,
      activityLabel: dictionary?.label || summary?.meta?.activityName || "",
      dictionaryId: dictionary?.id || "",
      scope: "session",
      attempts,
      classAttempts: classMean || null,
      performance: null,
      classPerformance: null,
      positioning,
      trend: "stable",
      strengths,
      focus,
      nextSteps,
      comparisonNotes,
    });
  }

  function buildStudentCycleAnalysis({ sessions = [], studentKey, dictionary = null } = {}) {
    if (!studentKey || !Array.isArray(sessions) || sessions.length < 2) return null;
    const history = [];
    let studentInfo = null;
    let totalAttempts = 0;
    let attemptSamples = 0;
    let classAttemptSum = 0;
    let classAttemptSamples = 0;
    let successSum = 0;
    let successSamples = 0;
    let classSuccessSum = 0;
    let classSuccessSamples = 0;
    let crossSum = 0;
    let crossSamples = 0;
    let classCrossSum = 0;
    let classCrossSamples = 0;
    let firstSuccess = null;
    let lastSuccess = null;
    let firstAttempts = null;
    let lastAttempts = null;
    let firstCross = null;
    let lastCross = null;
    sessions.forEach((session, index) => {
      const metrics = session?.student_metrics?.[studentKey];
      if (!metrics) return;
      studentInfo = studentInfo || metrics.student || null;
      const attempts = Number(metrics.attempts || metrics.rawEntryCount || 0) || 0;
      const classAttempts = extractClassAttemptMean(session);
      const successRate = Number.isFinite(metrics.successRate) ? metrics.successRate : null;
      const classSuccess = extractClassSuccessRate(session);
      const crossShare =
        metrics.cross && Number.isFinite(metrics.cross.aboveShare) ? metrics.cross.aboveShare : null;
      const classCross = extractClassCrossShare(session);
      if (attempts) {
        totalAttempts += attempts;
        attemptSamples += 1;
        if (firstAttempts == null) firstAttempts = attempts;
        lastAttempts = attempts;
      }
      if (Number.isFinite(classAttempts)) {
        classAttemptSum += classAttempts;
        classAttemptSamples += 1;
      }
      if (Number.isFinite(successRate)) {
        successSum += successRate;
        successSamples += 1;
        if (firstSuccess == null) firstSuccess = successRate;
        lastSuccess = successRate;
      }
      if (Number.isFinite(classSuccess)) {
        classSuccessSum += classSuccess;
        classSuccessSamples += 1;
      }
      if (Number.isFinite(crossShare)) {
        crossSum += crossShare;
        crossSamples += 1;
        if (firstCross == null) firstCross = crossShare;
        lastCross = crossShare;
      }
      if (Number.isFinite(classCross)) {
        classCrossSum += classCross;
        classCrossSamples += 1;
      }
      history.push(
        formatStudentHistoryEntry({
          session,
          attempts,
          classAttempts,
          successRate,
          classSuccess,
          crossShare,
          classCross,
          order: session?.session_index || session?.index || index + 1,
        })
      );
    });
    if (!history.length) return null;
    history.sort((a, b) => a.order - b.order);
    const orderedHistory = history.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const clone = { ...entry };
      delete clone.order;
      return clone;
    });
    const meanAttempts = attemptSamples ? totalAttempts / attemptSamples : null;
    const classMeanAttempts = classAttemptSamples ? classAttemptSum / classAttemptSamples : null;
    const meanSuccess = successSamples ? successSum / successSamples : null;
    const classMeanSuccess = classSuccessSamples ? classSuccessSum / classSuccessSamples : null;
    const meanCross = crossSamples ? crossSum / crossSamples : null;
    const classMeanCross = classCrossSamples ? classCrossSum / classCrossSamples : null;
    let performanceMetric = null;
    if (Number.isFinite(meanCross)) {
      performanceMetric = {
        label: "Ateliers au-dessus du plan",
        value: meanCross,
        classValue: Number.isFinite(classMeanCross) ? classMeanCross : null,
        unit: "ratio",
      };
    } else if (Number.isFinite(meanSuccess)) {
      performanceMetric = {
        label: "Taux de réussite",
        value: meanSuccess,
        classValue: Number.isFinite(classMeanSuccess) ? classMeanSuccess : null,
        unit: "ratio",
      };
    }
    const positioning = classifyRelativePosition(
      performanceMetric ? performanceMetric.value : meanAttempts,
      performanceMetric ? performanceMetric.classValue : classMeanAttempts
    );
    const primaryDelta =
      Number.isFinite(lastCross) && Number.isFinite(firstCross)
        ? lastCross - firstCross
        : Number.isFinite(lastSuccess) && Number.isFinite(firstSuccess)
        ? lastSuccess - firstSuccess
        : null;
    const secondaryDelta =
      Number.isFinite(lastAttempts) && Number.isFinite(firstAttempts) ? lastAttempts - firstAttempts : null;
    const trend = classifyTrend(primaryDelta, secondaryDelta);
    const strengths = [];
    const focus = [];
    if (performanceMetric && Number.isFinite(performanceMetric.value) && Number.isFinite(performanceMetric.classValue)) {
      const diff = performanceMetric.value - performanceMetric.classValue;
      if (diff >= 0.05) {
        const detail =
          performanceMetric.unit === "ratio"
            ? `${toPercent(performanceMetric.value)}% vs classe ${toPercent(performanceMetric.classValue)}%`
            : `${round(performanceMetric.value, 2)} vs classe ${round(performanceMetric.classValue, 2)}`;
        strengths.push(`${performanceMetric.label.toLowerCase()} supérieur (${detail})`);
      }
      if (diff <= -0.05) {
        const detail =
          performanceMetric.unit === "ratio"
            ? `${toPercent(performanceMetric.value)}% vs classe ${toPercent(performanceMetric.classValue)}%`
            : `${round(performanceMetric.value, 2)} vs classe ${round(performanceMetric.classValue, 2)}`;
        focus.push(`${performanceMetric.label.toLowerCase()} sous la moyenne (${detail})`);
      }
    }
    if (Number.isFinite(meanAttempts) && Number.isFinite(classMeanAttempts)) {
      const delta = meanAttempts - classMeanAttempts;
      if (delta >= 0.5) {
        strengths.push("volume de tentatives supérieur à la moyenne de classe");
      } else if (delta <= -0.5) {
        focus.push("volume de tentatives inférieur à la moyenne de classe");
      }
    }
    if (trend === "progression") strengths.push("progression observable sur l'ensemble du cycle");
    if (trend === "soutien") focus.push("tendance en retrait à accompagner lors des prochaines séances");
    const nextSteps =
      focus.length > 0
        ? [
            "Prévoir un point d'étape individuel sur la prochaine séance.",
            "Fixer un objectif réaliste pour rejoindre la moyenne de classe.",
          ]
        : [
            "Valoriser les réussites observées et proposer un défi complémentaire.",
            "Maintenir un relevé régulier pour confirmer la progression.",
          ];
    const comparisonNotes = [];
    if (Number.isFinite(meanAttempts) && Number.isFinite(classMeanAttempts)) {
      comparisonNotes.push(
        `Volume moyen : ${round(meanAttempts, 1)} essais vs classe ${round(classMeanAttempts, 1)}.`
      );
    }
    if (performanceMetric && Number.isFinite(performanceMetric.classValue)) {
      const formattedStudent =
        performanceMetric.unit === "ratio"
          ? `${toPercent(performanceMetric.value)}%`
          : `${round(performanceMetric.value, 2)}`;
      const formattedClass =
        performanceMetric.unit === "ratio"
          ? `${toPercent(performanceMetric.classValue)}%`
          : `${round(performanceMetric.classValue, 2)}`;
      comparisonNotes.push(`${performanceMetric.label} : ${formattedStudent} vs classe ${formattedClass}.`);
    }
    const activityLabel =
      dictionary?.label ||
      sessions[0]?.dictionary?.label ||
      sessions[0]?.meta?.activityName ||
      "Activité";
    const dictionaryId = dictionary?.id || sessions[0]?.dictionary?.id || "";
    return composeStudentAnalysisPayload({
      studentKey,
      studentInfo,
      activityLabel,
      dictionaryId,
      scope: "cycle",
      attempts: {
        student: Number.isFinite(meanAttempts) ? meanAttempts : null,
        class_mean: Number.isFinite(classMeanAttempts) ? classMeanAttempts : null,
      },
      classAttempts: Number.isFinite(classMeanAttempts) ? classMeanAttempts : null,
      performance: performanceMetric
        ? {
            label: performanceMetric.label,
            value: Number.isFinite(performanceMetric.value) ? round(performanceMetric.value, 2) : null,
            unit: performanceMetric.unit,
          }
        : null,
      classPerformance:
        performanceMetric && Number.isFinite(performanceMetric.classValue)
          ? round(performanceMetric.classValue, 2)
          : null,
      positioning,
      trend,
      strengths,
      focus,
      nextSteps,
      comparisonNotes,
      history: orderedHistory.slice(0, STUDENT_HISTORY_LIMIT),
    });
  }

  function formatStudentHistoryEntry({
    session = {},
    attempts = null,
    classAttempts = null,
    successRate = null,
    classSuccess = null,
    crossShare = null,
    classCross = null,
    order = 0,
  } = {}) {
    return {
      order,
      session_label: session?.session_name || `Séance ${order}`,
      session_date: session?.session_date || null,
      attempts: Number.isFinite(attempts) ? round(attempts, 2) : null,
      class_attempts: Number.isFinite(classAttempts) ? round(classAttempts, 2) : null,
      success_rate: Number.isFinite(successRate) ? round(successRate, 2) : null,
      class_success_rate: Number.isFinite(classSuccess) ? round(classSuccess, 2) : null,
      cross_above_share: Number.isFinite(crossShare) ? round(crossShare, 2) : null,
      class_cross_above_share: Number.isFinite(classCross) ? round(classCross, 2) : null,
    };
  }

  function composeStudentAnalysisPayload({
    studentKey,
    studentInfo = {},
    activityLabel = "",
    dictionaryId = "",
    scope = "session",
    attempts = null,
    classAttempts = null,
    performance = null,
    classPerformance = null,
    positioning = "near",
    trend = "stable",
    strengths = [],
    focus = [],
    nextSteps = [],
    comparisonNotes = [],
    history = [],
  }) {
    if (!studentKey) return null;
    const strengthList = Array.from(new Set((strengths || []).filter(Boolean))).slice(0, 4);
    const focusList = Array.from(new Set((focus || []).filter(Boolean))).slice(0, 4);
    const nextList = Array.from(new Set((nextSteps || []).filter(Boolean))).slice(0, 4);
    return {
      student_key: studentKey,
      student_label: buildStudentDisplayName(studentInfo) || "Élève",
      classe: studentInfo?.classe || "",
      activity_label: activityLabel || "",
      dictionary_id: dictionaryId || "",
      scope,
      attempts: {
        student: attempts != null ? round(attempts, 2) : null,
        class_mean: classAttempts != null ? round(classAttempts, 2) : null,
      },
      performance: performance
        ? {
            label: performance.label || "",
            student_value: performance.value != null ? performance.value : null,
            class_value: classPerformance != null ? classPerformance : null,
            unit: performance.unit || null,
          }
        : null,
      positioning,
      trend,
      strengths: strengthList,
      focus: focusList,
      next_steps: nextList,
      comparisons: comparisonNotes.slice(0, 3),
      history: Array.isArray(history) ? history.slice(0, STUDENT_HISTORY_LIMIT) : [],
    };
  }

  function extractClassAttemptMean(session = {}) {
    const aggregate = session?.class_analytics?.class_overview?.aggregate || {};
    if (Number.isFinite(aggregate.mean_attempts_per_student)) return aggregate.mean_attempts_per_student;
    if (Number.isFinite(aggregate.mean_entries_per_student)) return aggregate.mean_entries_per_student;
    const measures = session?.class_analytics?.measures || {};
    if (Number.isFinite(measures.voies?.mean_per_student)) return measures.voies.mean_per_student;
    return null;
  }

  function extractClassSuccessRate(session = {}) {
    return averageMetricValue(session?.student_metrics, (entry) =>
      Number.isFinite(entry?.successRate) ? entry.successRate : null
    );
  }

  function extractClassCrossShare(session = {}) {
    return averageMetricValue(session?.student_metrics, (entry) =>
      Number.isFinite(entry?.cross?.aboveShare) ? entry.cross.aboveShare : null
    );
  }

  function averageMetricValue(metrics, pickValue) {
    if (!metrics || typeof pickValue !== "function") return null;
    const values = [];
    if (metrics instanceof Map) {
      metrics.forEach((entry) => {
        const value = pickValue(entry);
        if (Number.isFinite(value)) values.push(value);
      });
    } else {
      Object.values(metrics).forEach((entry) => {
        const value = pickValue(entry);
        if (Number.isFinite(value)) values.push(value);
      });
    }
    if (!values.length) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  function buildStudentDisplayName(student = {}) {
    const parts = [student?.prenom || "", student?.nom || ""].filter(Boolean);
    return parts.join(" ").trim();
  }

  function classifyRelativePosition(studentValue, classMean, tolerance = 0.15) {
    if (!Number.isFinite(studentValue) || !Number.isFinite(classMean) || !classMean) return "near";
    const ratio = studentValue / classMean;
    if (ratio >= 1 + tolerance) return "above";
    if (ratio <= 1 - tolerance) return "below";
    return "near";
  }

  function classifyTrend(primaryDelta, secondaryDelta = 0) {
    if (Number.isFinite(primaryDelta) && Math.abs(primaryDelta) >= 0.08) {
      return primaryDelta > 0 ? "progression" : "soutien";
    }
    if (Number.isFinite(secondaryDelta) && Math.abs(secondaryDelta) >= 1) {
      return secondaryDelta > 0 ? "progression" : "soutien";
    }
    return "stable";
  }

  function evaluateCrossTrainingStudent(record = {}) {
    const entries = Array.isArray(record?.records) ? record.records : [];
    const total = entries.length || record.total || 0;
    if (!total) return null;
    let score = 0;
    const belowLabels = [];
    const aboveLabels = [];
    const markedBelowLabels = [];
    entries.forEach((entry) => {
      if (!entry || !entry.classification) return;
      if (entry.classification === "below") {
        if (entry.label) belowLabels.push(entry.label);
        score -= 1;
        if (entry.marked === "below") {
          score -= 1;
          if (entry.label) markedBelowLabels.push(entry.label);
        }
      } else if (entry.classification === "above") {
        if (entry.label) aboveLabels.push(entry.label);
        score += 1;
        if (entry.marked === "above") {
          score += 0.5;
        }
      }
    });
    const below = belowLabels.length || record.below || 0;
    const above = aboveLabels.length || record.above || 0;
    const equal = Math.max(total - below - above, 0);
    return {
      total,
      score,
      below,
      above,
      equal,
      belowShare: total ? below / total : 0,
      aboveShare: total ? above / total : 0,
      belowLabels,
      aboveLabels,
      markedBelowLabels,
      confidence: total >= 5 ? "high" : total >= 3 ? "moderate" : "low",
    };
  }

  function describeCrossSupportSignal(performance) {
    if (!performance) return null;
    if (performance.total < CROSS_MIN_EXERCISES_FOR_STRONG_PROFILE) return null;
    const repeated = performance.below >= 2 || performance.belowShare >= 0.5 || performance.score <= -2;
    if (!repeated && !performance.markedBelowLabels.length) return null;
    const focusList = performance.markedBelowLabels.length
      ? performance.markedBelowLabels
      : performance.belowLabels;
    const labelText = formatExerciseList(focusList.slice(0, 3));
    if (!labelText) return null;
    const text = performance.markedBelowLabels.length
      ? `écarts marqués sur ${labelText}`
      : `souvent en dessous du prévu sur ${labelText}`;
    return {
      text,
      weight: Math.max(performance.below, 1) + Math.max(0, -performance.score),
      confidence: performance.confidence,
    };
  }

  function describeCrossStrengthSignal(performance) {
    if (!performance) return null;
    if (performance.total < CROSS_MIN_EXERCISES_FOR_STRONG_PROFILE) return null;
    if (performance.above < 2 && performance.aboveShare < 0.5 && performance.score < 2) return null;
    const labelText = formatExerciseList(performance.aboveLabels.slice(0, 3));
    if (!labelText) return null;
    return {
      text: `atteint ou dépasse régulièrement le prévu sur ${labelText}`,
      weight: performance.score + performance.above,
      confidence: performance.confidence,
    };
  }

  function describeCrossConfirmSignal(performance) {
    if (!performance) return null;
    if (performance.total > CROSS_MAX_EXERCISES_FOR_CONFIRM) return null;
    if (Math.abs(performance.score) < 1) return null;
    const referenceList = performance.score > 0 ? performance.aboveLabels : performance.belowLabels;
    if (!referenceList.length) return null;
    const labelText = formatExerciseList(referenceList.slice(0, 1));
    if (!labelText) return null;
    const attemptsText = performance.total === 1 ? "un seul exercice exploitable" : "deux exercices exploitables";
    const text =
      performance.score > 0
        ? `réussite isolée sur ${labelText} (${attemptsText})`
        : `écart négatif isolé sur ${labelText} (${attemptsText})`;
    return {
      text,
      weight: Math.abs(performance.score),
    };
  }

  function formatExerciseList(list = []) {
    const unique = Array.from(new Set(list.filter(Boolean)));
    if (!unique.length) return "";
    if (unique.length === 1) return unique[0];
    const head = unique.slice(0, -1).join(", ");
    const tail = unique[unique.length - 1];
    return `${head} et ${tail}`;
  }

  function buildHighlight(label, count, total) {
    if (!count || !total) return null;
    return {
      label,
      count,
      share: round(count / Math.max(total, 1), 4),
    };
  }

  function analyzeNumericFields(entries, summary, dictionary) {
    const metrics = {};
    entries.forEach((entry) => {
      Object.entries(entry).forEach(([key, value]) => {
        if (!key || key.startsWith("__")) return;
        const normalized = normalizeKeyName(key);
        if (["nom", "prenom", "prénom", "classe", "sexe"].includes(normalized)) return;
        const descriptor = matchNumericDescriptor(normalized);
        if (!descriptor) return;
        const numeric = coerceNumericValue(value, descriptor);
        if (numeric == null || Number.isNaN(numeric)) return;
        if (!metrics[descriptor.key]) {
          metrics[descriptor.key] = {
            label: descriptor.label,
            unit: descriptor.unit,
            values: [],
          };
        }
        metrics[descriptor.key].values.push(numeric);
      });
    });

    const measures = {};
    const distributions = {};
    Object.entries(metrics).forEach(([key, info]) => {
      if (!info.values.length) return;
      const stats = calcNumericStats(info.values);
      measures[key] = {
        label: info.label,
        unit: info.unit,
        count: info.values.length,
        mean: round(stats.mean, 2),
        median: round(stats.median, 2),
        min: round(stats.min, 2),
        max: round(stats.max, 2),
        dispersion: classifyDispersion(stats.stddev, stats.mean),
      };
      const distribution = buildNumericDistribution(info.values, info.label, info.unit);
      if (distribution) distributions[key] = distribution;
    });

    return {
      measures,
      distributions,
      comparisons: [],
      student_groups: [],
      pedagogical_signals: [],
      limits: [],
    };
  }

  function matchNumericDescriptor(normalizedKey) {
    return NUMERIC_FIELD_HINTS.find((hint) => hint.patterns.some((pattern) => normalizedKey.includes(pattern)));
  }

  function coerceNumericValue(value, descriptor) {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const str = String(value).trim();
    if (!str) return null;
    if (descriptor?.isTime && /^(\d{1,2}:){1,2}\d{2}$/.test(str)) {
      return timeStringToSeconds(str);
    }
    const compact = str.replace(/\s+/g, "");
    const numericPattern = /^-?\d+(?:[.,]\d+)?$/;
    const numericUnitPattern = /^-?\d+(?:[.,]\d+)?(?:m|km|pts|pt|s|sec|secondes|m\/s|km\/h)?$/i;
    if (numericPattern.test(compact)) {
      return parseFloat(compact.replace(",", "."));
    }
    if (descriptor?.tolerateUnits && numericUnitPattern.test(str)) {
      const sanitized = str.replace(/[^0-9.,-]/g, "");
      if (sanitized) return parseFloat(sanitized.replace(",", "."));
    }
    return null;
  }

  function calcNumericStats(values) {
    if (!values.length) {
      return { mean: 0, median: 0, min: 0, max: 0, stddev: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = calcMedian(sorted);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const stddev = calcStdDev(values, mean);
    return { mean, median, min, max, stddev };
  }

  function buildNumericDistribution(values, label, unit) {
    if (values.length < 3) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const buckets = [
      {
        label: `≤ ${round(q1, 2)}`,
        count: sorted.filter((v) => v <= q1).length,
      },
      {
        label: `${round(q1, 2)} - ${round(q3, 2)}`,
        count: sorted.filter((v) => v > q1 && v < q3).length,
      },
      {
        label: `≥ ${round(q3, 2)}`,
        count: sorted.filter((v) => v >= q3).length,
      },
    ];
    const total = values.length;
    buckets.forEach((bucket) => {
      bucket.percentage = round(bucket.count / total, 4);
    });
    return { label: `Répartition ${label.toLowerCase()}`, unit, buckets, total };
  }

  function mergeAnalytics(target, addition) {
    if (!addition) return;
    if (addition.context) {
      target.context = { ...target.context, ...addition.context };
    }
    if (addition.data_quality) {
      target.data_quality = mergeDataQuality(target.data_quality, addition.data_quality);
    }
    if (addition.class_overview) {
      target.class_overview = mergeClassOverview(target.class_overview, addition.class_overview);
    }
    if (addition.distributions) {
      target.distributions = { ...target.distributions, ...addition.distributions };
    }
    if (addition.measures) {
      target.measures = { ...target.measures, ...addition.measures };
    }
    if (addition.comparisons?.length) {
      target.comparisons.push(...addition.comparisons);
    }
    if (addition.student_groups?.length) {
      target.student_groups.push(...addition.student_groups);
    }
    if (addition.pedagogical_signals?.length) {
      target.pedagogical_signals.push(...addition.pedagogical_signals);
    }
    if (addition.limits?.length) {
      target.limits.push(...addition.limits);
    }
    if (addition.summary_sentences) {
      target.summary_sentences = mergeSummarySentences(target.summary_sentences, addition.summary_sentences);
    }
    if (addition.student_profiles) {
      target.student_profiles = mergeProfileCollections(target.student_profiles, addition.student_profiles);
    }
    if (addition.student_profile_sentences) {
      target.student_profile_sentences = mergeSentenceCollections(
        target.student_profile_sentences,
        addition.student_profile_sentences
      );
    }
    if (addition.student_rankings) {
      target.student_rankings = mergeStudentRankings(target.student_rankings, addition.student_rankings);
    }
    if (addition.student_metrics) {
      target.student_metrics = { ...(target.student_metrics || {}), ...(addition.student_metrics || {}) };
    }
    if (addition.student_analysis && !target.student_analysis) {
      target.student_analysis = addition.student_analysis;
    }
  }

  function mergeDataQuality(base, addition) {
    const merged = { ...base };
    if (addition.issues?.length) {
      merged.issues = [...(merged.issues || []), ...addition.issues];
    }
    merged.unknown_codes = merged.unknown_codes || { statuses: [], levels: [], fields: [] };
    const targetUnknown = merged.unknown_codes;
    if (addition.unknown_codes) {
      ["statuses", "levels", "fields"].forEach((key) => {
        if (addition.unknown_codes[key]?.length) {
          targetUnknown[key] = Array.from(new Set([...(targetUnknown[key] || []), ...addition.unknown_codes[key]]));
        }
      });
    }
    return merged;
  }

  function mergeClassOverview(base, addition) {
    const merged = { ...base };
    if (addition.summary?.length) {
      const existingKeys = new Set((merged.summary || []).map((item) => item.key));
      const extras = addition.summary.filter((item) => !existingKeys.has(item.key));
      merged.summary = [...(merged.summary || []), ...extras];
    }
    merged.aggregate = { ...(merged.aggregate || {}), ...(addition.aggregate || {}) };
    if (addition.highlights?.length) {
      merged.highlights = [...(merged.highlights || []), ...addition.highlights];
    }
    if (addition.notes?.length) {
      merged.notes = [...(merged.notes || []), ...addition.notes];
    }
    return merged;
  }

  function mergeSummarySentences(base = createSummarySentences(), addition = createSummarySentences()) {
    const merged = createSummarySentences();
    SUMMARY_KEYS.forEach((key) => {
      merged[key] = [...(base?.[key] || []), ...(addition?.[key] || [])];
    });
    return merged;
  }

  function dedupeSummarySentences(summary = createSummarySentences()) {
    const cleaned = createSummarySentences();
    SUMMARY_KEYS.forEach((key) => {
      cleaned[key] = Array.from(new Set((summary?.[key] || []).filter(Boolean)));
    });
    return cleaned;
  }

  function finalizeAnalytics(base) {
    base.pedagogical_signals = Array.from(new Set(base.pedagogical_signals || []));
    base.limits = Array.from(new Set(base.limits || []));
    if (base.data_quality?.issues) {
      base.data_quality.issues = Array.from(new Set(base.data_quality.issues));
    }
    if (base.summary_sentences) {
      base.summary_sentences = dedupeSummarySentences(base.summary_sentences);
    }
    if (base.student_profiles) {
      base.student_profiles = dedupeProfileCollection(base.student_profiles);
    }
    if (base.student_profile_sentences) {
      base.student_profile_sentences = dedupeSentenceCollection(base.student_profile_sentences);
    }
    if (base.student_rankings) {
      STUDENT_RANKING_KEYS.forEach((key) => {
        base.student_rankings[key] = limitRankingEntries(base.student_rankings[key], STUDENT_RANKING_LIMIT);
      });
    }
  }

  function attachTeachingInsights(base, dictionary) {
    if (!base) return;
    const payload = buildTeachingDiagnosisInsights(base, dictionary);
    if (!payload) return;
    if (payload.teachingDiagnosis) {
      base.teaching_diagnosis = payload.teachingDiagnosis;
    }
    if (payload.nextSessionGuidance) {
      base.next_session_guidance = payload.nextSessionGuidance;
    }
    if (payload.summary_sentences) {
      base.summary_sentences = mergeSummarySentences(base.summary_sentences || createSummarySentences(), payload.summary_sentences);
    }
  }

  function buildTeachingDiagnosisInsights(base = {}, dictionary = {}) {
    const aggregate = base.class_overview?.aggregate || {};
    const meanEntries = Number.isFinite(aggregate.mean_entries_per_student)
      ? aggregate.mean_entries_per_student
      : Number.isFinite(base.measures?.voies?.mean_per_student)
      ? base.measures.voies.mean_per_student
      : 0;
    const medianEntries = Number.isFinite(aggregate.median_entries_per_student)
      ? aggregate.median_entries_per_student
      : Number.isFinite(base.measures?.voies?.median_per_student)
      ? base.measures.voies.median_per_student
      : 0;
    const studentCount = aggregate.student_count || base.data_quality?.unique_students || 0;
    const datasetEntries = aggregate.total_entries || base.data_quality?.dataset_entries || 0;
    const dataIssues = base.data_quality?.issues || [];
    const heterogeneityLabel =
      base.measures?.cotation?.heterogeneity?.label ||
      base.measures?.cross_training?.heterogeneity?.label ||
      null;
    const heterogeneityScore = heterogeneityRank(heterogeneityLabel);
    const successShare = findComparisonShare(base, "réuss");
    const learningField = dictionary?.learningField || dictionary?.label || "l’activité";

    const coverageLow = datasetEntries < Math.max(studentCount, 1) || meanEntries < 1;
    const recurrentIssues = dataIssues.length >= 2;
    const heterogeneityHigh = heterogeneityScore != null && heterogeneityScore >= 2;
    const challengePlateau = Number.isFinite(successShare) && successShare >= 0.7 && !heterogeneityHigh;
    const engagementLow = meanEntries > 0 && meanEntries < 1.3 && !recurrentIssues;

    let scenario = "balanced";
    if (recurrentIssues || coverageLow) scenario = "data_gap";
    else if (heterogeneityHigh) scenario = "heterogeneity";
    else if (challengePlateau) scenario = "raise_level";
    else if (engagementLow) scenario = "engagement";

    const teachingPriorities = dictionary?.teachingPriorities || [];
    const didacticLevers = dictionary?.didacticLevers || [];
    const sessionTemplates = dictionary?.nextSessionTemplates || [];

    const evidence = [];
    if (Number.isFinite(meanEntries) && studentCount) {
      evidence.push(`${round(meanEntries, 2)} essai(s) en moyenne pour ${studentCount} élève(s).`);
    }
    if (Number.isFinite(medianEntries) && studentCount) {
      evidence.push(`Médiane à ${round(medianEntries, 2)} essai(s).`);
    }
    if (Number.isFinite(successShare)) {
      evidence.push(`${toPercent(successShare)} % des élèves valident au moins une tentative.`);
    }
    if (heterogeneityLabel) {
      evidence.push(`Hétérogénéité ${heterogeneityLabel}.`);
    }
    if (dataIssues.length) {
      evidence.push(dataIssues[0]);
    }

    const summarySentences = createSummarySentences();
    const diagnosis = {
      learning_field: learningField,
      scenario,
      evidence: Array.from(new Set(evidence.filter(Boolean))).slice(0, 4),
    };
    const guidance = {
      learning_field: learningField,
      levers: [],
      next_session_ideas: [],
    };

    switch (scenario) {
      case "data_gap": {
        diagnosis.main_finding = `Les relevés restent trop partiels pour lire la progression en ${learningField}.`;
        diagnosis.class_profile =
          "L'engagement existe mais les colonnes prévues/renseignées ne suffisent pas à dégager une tendance.";
        diagnosis.priority_hint =
          "Stabiliser un protocole de collecte identique pour toute la classe lors de la prochaine séance.";
        guidance.priority_for_next_session = diagnosis.priority_hint;
        guidance.rationale =
          "Des données homogènes permettront de comparer les séances et d'objectiver les progrès.";
        guidance.levers = selectGuidanceItems(
          ["Imposer la même feuille prévu/réalisé", "Nommer un binôme garant des relevés."],
          didacticLevers,
          3
        );
        guidance.next_session_ideas = selectGuidanceItems(
          ["Démarrer la séance par un court rappel des indicateurs à renseigner."],
          sessionTemplates,
          3
        );
        break;
      }
      case "heterogeneity": {
        diagnosis.main_finding = `La classe présente une hétérogénéité marquée sur ${learningField}.`;
        diagnosis.class_profile =
          "Les écarts de niveau/engagement nécessitent une différenciation plus visible pour maintenir tout le monde en progression.";
        diagnosis.priority_hint = "Préparer des tâches différenciées (groupes de besoin ou paliers de difficulté).";
        guidance.priority_for_next_session = diagnosis.priority_hint;
        guidance.rationale = "Chaque sous-groupe doit identifier un défi atteignable et observable.";
        guidance.levers = selectGuidanceItems(
          ["Constituer 2 à 3 ateliers avec consignes graduées.", "Formaliser des contrats d’essais par groupe."],
          didacticLevers,
          3
        );
        guidance.next_session_ideas = selectGuidanceItems(
          ["Installer une rotation libre mais avec objectif clair pour chaque couleur / atelier."],
          sessionTemplates,
          3
        );
        break;
      }
      case "raise_level": {
        diagnosis.main_finding = `La majorité des élèves valide les tâches sécurisées : la montée en exigence reste à provoquer.`;
        diagnosis.class_profile = `Les indicateurs montrent une forte réussite mais peu de tentatives sur le niveau supérieur en ${learningField}.`;
        diagnosis.priority_hint = "Planifier une montée en difficulté accompagnée pour faire évoluer les repères.";
        guidance.priority_for_next_session = diagnosis.priority_hint;
        guidance.rationale = "La progression passe par des essais guidés sur une difficulté légèrement supérieure.";
        guidance.levers = selectGuidanceItems(
          ["Prévoir un essai guidé sur la cotation +1 ou sur un tempo plus exigeant."],
          didacticLevers,
          3
        );
        guidance.next_session_ideas = selectGuidanceItems(
          ["Mettre en place un défi 'voie repère' ou 'atelier intensité' à comparer avec la séance précédente."],
          sessionTemplates,
          3
        );
        break;
      }
      case "engagement": {
        diagnosis.main_finding = `L'engagement reste mesuré (${round(meanEntries, 2)} essai(s) / élève) : il faut densifier la pratique.`;
        diagnosis.class_profile = "Plusieurs élèves n'ont pas encore un volume suffisant pour objectiver une progression.";
        diagnosis.priority_hint = "Augmenter le nombre d'essais observables par élève avec un temps d'activité plus dense.";
        guidance.priority_for_next_session = diagnosis.priority_hint;
        guidance.rationale = "Sans volume minimum, les repères restent fragiles.";
        guidance.levers = selectGuidanceItems(
          ["Organiser des séries courtes et répétées avec feedback immédiat."],
          didacticLevers,
          3
        );
        guidance.next_session_ideas = selectGuidanceItems(
          ["Alterner deux passages rapides plutôt qu'un seul long essai pour chaque élève."],
          sessionTemplates,
          3
        );
        break;
      }
      default: {
        diagnosis.main_finding = `Les données offrent une base exploitable : il est possible d'affiner la lecture pédagogique en ${learningField}.`;
        diagnosis.class_profile = "Le groupe est engagé, il reste à préciser la prochaine marche de progression.";
        const defaultPriority =
          teachingPriorities[0] || "Identifier une priorité claire (montée en difficulté, précision, régularité).";
        diagnosis.priority_hint = defaultPriority;
        guidance.priority_for_next_session = defaultPriority;
        guidance.rationale = "Clarifier la priorité rendra la séance suivante plus lisible pour les élèves.";
        guidance.levers = selectGuidanceItems([], didacticLevers, 3);
        guidance.next_session_ideas = selectGuidanceItems([], sessionTemplates, 3);
      }
    }

    if (diagnosis.main_finding) summarySentences.overview.push(diagnosis.main_finding);
    if (diagnosis.priority_hint) summarySentences.needs_work.push(diagnosis.priority_hint);
    if (guidance.priority_for_next_session) summarySentences.next_steps.push(guidance.priority_for_next_session);
    if (guidance.next_session_ideas?.length) {
      summarySentences.next_steps.push(guidance.next_session_ideas[0]);
    }

    return {
      teachingDiagnosis: diagnosis,
      nextSessionGuidance: {
        priority_for_next_session: guidance.priority_for_next_session,
        rationale: guidance.rationale,
        teaching_levers: guidance.levers,
        next_session_ideas: guidance.next_session_ideas,
        learning_field: guidance.learning_field,
      },
      summary_sentences: summarySentences,
    };
  }

  function selectGuidanceItems(primary = [], secondary = [], limit = 3) {
    const combined = [...(primary || []), ...(secondary || [])].filter(Boolean);
    const seen = new Set();
    const result = [];
    for (const entry of combined) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      result.push(entry);
      if (result.length >= limit) break;
    }
    return result;
  }

  function findComparisonShare(base, needle) {
    if (!base || !needle) return null;
    const list = Array.isArray(base.comparisons) ? base.comparisons : [];
    const target = list.find((entry) => {
      if (!entry || !entry.label) return false;
      return entry.label.toLowerCase().includes(needle.toLowerCase());
    });
    return Number.isFinite(target?.share) ? target.share : null;
  }

  function normalizeKeyName(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function fetchTranslationProfile(dictionary) {
    if (!dictionary) return null;
    if (typeof window === "undefined") return null;
    const api = window.ScanProfAIDictionaries;
    if (!api || typeof api.getTranslationProfile !== "function") return null;
    try {
      return api.getTranslationProfile(dictionary.id || dictionary.label || "");
    } catch {
      return null;
    }
  }

  function safeString(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  function normalizeLevelValue(raw, levelSet) {
    const token = normalizeLevelToken(raw);
    if (!token) return null;
    if (levelSet && !levelSet.has(token)) return null;
    return token;
  }

  function normalizeLevelToken(raw) {
    if (raw == null) return "";
    const text = String(raw).trim().toUpperCase().replace(/\s+/g, "");
    if (!text) return "";
    const match = text.match(/^([3-8])([ABC])?(\+)?$/);
    if (match) {
      const digit = match[1];
      const letter = match[2] || (Number(digit) >= 5 ? "A" : "");
      const plus = match[3] || "";
      return `${digit}${letter}${plus}`;
    }
    if (/^(3|4)\+$/.test(text)) return text;
    return "";
  }

  function normalizeStatusValue(raw) {
    if (raw == null) return null;
    const text = String(raw).trim().toUpperCase();
    if (STATUS_LABELS[text]) return text;
    if (SUCCESS_STATUSES.has(text)) return text;
    if (text === "N3D") return "N3D";
    return null;
  }

  function detectLevelInText(text, levelSet) {
    const tokens = String(text || "")
      .toUpperCase()
      .split(/[^0-9A-Z+]+/)
      .filter(Boolean);
    for (const token of tokens) {
      const normalized = normalizeLevelToken(token);
      if (normalized && (!levelSet || levelSet.has(normalized))) return normalized;
    }
    return null;
  }

  function detectStatusInText(text) {
    const tokens = String(text || "")
      .toUpperCase()
      .split(/[^0-9A-Z]+/)
      .filter(Boolean);
    return tokens.find((token) => STATUS_LABELS[token] || SUCCESS_STATUSES.has(token)) || null;
  }

  function calcMedian(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  function calcStdDev(values, mean) {
    if (!values.length) return 0;
    const avg = mean ?? values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  function classifyDispersion(stddev, mean) {
    if (!Number.isFinite(stddev)) return { label: "non défini", coefficient: null };
    const base = Math.abs(mean) > 1e-6 ? Math.abs(mean) : 1;
    const coeff = Math.abs(stddev / base);
    if (!Number.isFinite(coeff)) return { label: "non défini", coefficient: null };
    if (coeff < 0.1) return { label: "faible", coefficient: round(coeff, 3) };
    if (coeff < 0.25) return { label: "modérée", coefficient: round(coeff, 3) };
    return { label: "marquée", coefficient: round(coeff, 3) };
  }

  function percentile(sortedValues, ratio) {
    if (!sortedValues.length) return 0;
    const index = (sortedValues.length - 1) * ratio;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower];
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  function timeStringToSeconds(text) {
    const parts = text.split(":").map((part) => parseInt(part, 10));
    if (parts.some((value) => Number.isNaN(value))) return null;
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return null;
  }

  function round(value, precision = 2) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  function toPercent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }

  window.ScanProfClassAnalytics = {
    analyze,
    analyzeSessionBundle,
    analyzeCycleBundle,
    buildStudentCycleAnalysis,
  };
})();
