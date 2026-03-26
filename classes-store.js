(function () {
  const STORE_KEY = "scanprof_classes_store_v1";

  function loadClasses() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveClasses(classes) {
    localStorage.setItem(STORE_KEY, JSON.stringify(classes || []));
  }

  function generateId(prefix = "cls") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function createClass(name, color) {
    return {
      id: generateId("cls"),
      name: name || "Classe sans nom",
      color: color || "#1e90ff",
      createdAt: new Date().toISOString(),
      activities: [],
    };
  }

  function createActivity(name) {
    return {
      id: generateId("act"),
      name: name || "Activité sans nom",
      createdAt: new Date().toISOString(),
      sessions: [],
    };
  }

  function createSession(name, data) {
    return {
      id: generateId("ses"),
      name: name || "Séance sans titre",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: Array.isArray(data) ? data : [],
    };
  }

  function exportClassesBackup(classIds = null) {
    const allClasses = loadClasses();
    const hasSelection = Array.isArray(classIds) && classIds.length > 0;
    let filtered = allClasses;

    if (Array.isArray(classIds)) {
      if (classIds.length === 0) {
        filtered = [];
      } else {
        const allow = new Set(classIds);
        filtered = allClasses.filter((cls) => allow.has(cls?.id));
      }
    }

    return {
      format: "scanprof.classes.export",
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: hasSelection ? "selection" : "all",
      classes: JSON.parse(JSON.stringify(filtered || [])),
    };
  }

  function validateClassesBackupPayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload introuvable.");
    }
    if (payload.format !== "scanprof.classes.export") {
      throw new Error("Format de sauvegarde non reconnu.");
    }
    if (payload.version !== 1) {
      throw new Error("Version de sauvegarde non supportée.");
    }
    if (!Array.isArray(payload.classes)) {
      throw new Error("Liste des classes manquante.");
    }
    return payload;
  }

  function normalizeImportedClass(item) {
    if (!item || typeof item !== "object") return null;
    const clone = JSON.parse(JSON.stringify(item));
    const id = typeof clone.id === "string" ? clone.id.trim() : "";
    if (!id) return null;
    clone.id = id;
    if (typeof clone.name !== "string" || !clone.name.trim()) {
      clone.name = "Classe importée";
    }
    if (typeof clone.color !== "string" || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clone.color)) {
      clone.color = "#1e90ff";
    }
    if (!Array.isArray(clone.activities)) {
      clone.activities = [];
    }
    if (typeof clone.createdAt !== "string") {
      clone.createdAt = new Date().toISOString();
    }
    if (clone.updatedAt && typeof clone.updatedAt !== "string") {
      delete clone.updatedAt;
    }
    return clone;
  }

  function importClassesBackup(payload) {
    const validated = validateClassesBackupPayload(payload);
    const incomingRaw = validated.classes || [];
    let skipped = 0;
    const incoming = [];

    incomingRaw.forEach((item) => {
      const normalized = normalizeImportedClass(item);
      if (normalized) {
        incoming.push(normalized);
      } else {
        skipped += 1;
      }
    });

    if (!incoming.length) {
      throw new Error("Aucune classe exploitable dans la sauvegarde.");
    }

    const existing = loadClasses();
    const byId = new Map((existing || []).map((cls) => [cls.id, cls]));
    let added = 0;
    let replaced = 0;

    incoming.forEach((cls) => {
      if (byId.has(cls.id)) {
        replaced += 1;
      } else {
        added += 1;
      }
      byId.set(cls.id, cls);
    });

    const merged = Array.from(byId.values());
    saveClasses(merged);

    return {
      imported: incoming.length,
      added,
      replaced,
      skipped,
      total: merged.length,
    };
  }

  window.ScanProfClassesStore = {
    loadClasses,
    saveClasses,
    generateId,
    createClass,
    createActivity,
    createSession,
    STORE_KEY,
    exportClassesBackup,
    importClassesBackup,
  };
})();
