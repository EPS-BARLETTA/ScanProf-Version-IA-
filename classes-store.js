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

  window.ScanProfClassesStore = {
    loadClasses,
    saveClasses,
    generateId,
    createClass,
    createActivity,
    createSession,
    STORE_KEY,
    exportClassesBackup,
  };
})();
