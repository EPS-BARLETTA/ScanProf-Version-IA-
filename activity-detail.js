(function () {
  const store = window.ScanProfClassesStore;
  if (!store) return;
  const SESSION_META_KEY = "scanprof_current_session_meta";
  const AI_CONTEXT_KEY = "scanprof_ai_context";
  const CYCLE_TRIGGER_KEY = "scanprof_cycle_trigger";

  let classes = [];
  let cls = null;
  let activity = null;

  const els = {};

  document.addEventListener("DOMContentLoaded", () => {
    els.sessionsList = document.getElementById("sessions-list");
    els.newSessionName = document.getElementById("new-session-name");
    els.createSessionBtn = document.getElementById("create-session-btn");
    els.sessionOverlay = document.getElementById("session-overlay");
    els.sessionFrame = document.getElementById("session-frame");
    els.sessionTitle = document.getElementById("session-overlay-title");
    els.sessionInfo = document.getElementById("session-overlay-info");
    els.sessionSave = document.getElementById("session-overlay-save");
    els.sessionCancel = document.getElementById("session-overlay-cancel");
    els.cycleBtn = document.getElementById("analyze-cycle-btn");

    classes = store.loadClasses();
    const url = new URL(window.location.href);
    const classId = url.searchParams.get("class");
    const activityId = url.searchParams.get("activity");
    cls = classes.find(c => c.id === classId);
    activity = cls ? cls.activities.find(a => a.id === activityId) : null;
    if (!cls || !activity) {
      alert("Activité introuvable.");
      window.location.href = "classes.html";
      return;
    }
    setupLinks();
    bind();
    render();
  });

  function setupLinks() {
    document.getElementById("back-class").href = `class.html?id=${encodeURIComponent(cls.id)}`;
  }

  function bind() {
    document.getElementById("activity-title").textContent = `${activity.name} — classe ${cls.name}`;
    document.getElementById("rename-activity-btn").addEventListener("click", () => {
      const name = prompt("Renommer l'activité :", activity.name);
      if (name == null) return;
      activity.name = name.trim() || activity.name;
      save();
      render();
    });
    document.getElementById("delete-activity-btn").addEventListener("click", () => {
      if (!confirm(`Supprimer l'activité « ${activity.name} » ?`)) return;
      cls.activities = cls.activities.filter(a => a.id !== activity.id);
      save();
      window.location.href = `class.html?id=${encodeURIComponent(cls.id)}`;
    });
    document.getElementById("export-activity-btn").addEventListener("click", exportActivityCSV);
    els.createSessionBtn.addEventListener("click", () => {
      const name = els.newSessionName.value.trim();
      const sessionName = name || `Séance ${activity.sessions.length + 1}`;
      const newSession = store.createSession(sessionName, []);
      activity.sessions.unshift(newSession);
      save();
      renderSessions();
      openSessionEditor(newSession, true);
      els.newSessionName.value = "";
    });
    if (els.cycleBtn) {
      els.cycleBtn.addEventListener("click", () => {
        if (activity.sessions.length < 2) return;
        triggerCycleAnalysis();
      });
    }
    els.sessionSave.addEventListener("click", () => closeSessionEditor(true));
    els.sessionCancel.addEventListener("click", () => closeSessionEditor(false));
  }

  function render() {
    document.getElementById("activity-meta").textContent = `${activity.sessions.length} séance(s)`;
    updateCycleButtonState();
    renderSessions();
  }

  function renderSessions() {
    if (!activity.sessions.length) {
      els.sessionsList.innerHTML = `<div class="empty-hint">Aucune séance archivée. Créez-en une ou utilisez “Archiver” depuis la page Participants.</div>`;
      return;
    }
    els.sessionsList.innerHTML = activity.sessions.map(sess => `
      <article class="session-card">
        <h3>${escapeHtml(sess.name)}</h3>
        <div class="session-meta">
          <span>${(sess.data || []).length} élève(s)</span>
          <span>Créé le ${formatDate(sess.createdAt)}</span>
          <span>Modifié le ${formatDate(sess.updatedAt)}</span>
        </div>
        <div class="session-actions">
          <button data-action="open" data-id="${sess.id}" class="primary">✏️ Ouvrir</button>
          <button data-action="load" data-id="${sess.id}">➡️ Charger dans Participants</button>
          <button data-action="csv" data-id="${sess.id}">📄 CSV</button>
          <button data-action="json" data-id="${sess.id}">🧾 JSON</button>
          <button data-action="rename" data-id="${sess.id}">✏️ Renommer</button>
          <button data-action="delete" data-id="${sess.id}" class="danger">🗑 Supprimer</button>
        </div>
      </article>
    `).join("");
    els.sessionsList.querySelectorAll("button[data-action]").forEach(btn => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      btn.addEventListener("click", () => handleSessionAction(action, id));
    });
  }

  function updateCycleButtonState() {
    if (!els.cycleBtn) return;
    const count = activity.sessions.length;
    if (count >= 2) {
      els.cycleBtn.disabled = false;
      els.cycleBtn.textContent = "🚀 Analyser le cycle";
      els.cycleBtn.title = `Analyser ${count} séance${count > 1 ? "s" : ""} archivée${count > 1 ? "s" : ""}`;
    } else {
      els.cycleBtn.disabled = true;
      els.cycleBtn.textContent = "Cycle indisponible (au moins 2 séances)";
      els.cycleBtn.title = "Ajoutez des séances pour activer l'analyse de cycle.";
    }
  }

  function handleSessionAction(action, id) {
    const session = activity.sessions.find(s => s.id === id);
    if (!session) return;
    switch (action) {
      case "open":
        openSessionEditor(session);
        break;
      case "load":
        localStorage.setItem("eleves", JSON.stringify(session.data || []));
        window.location.href = "participants.html";
        break;
      case "csv":
        exportSessionCSV(session);
        break;
      case "json":
        exportSessionJSON(session);
        break;
      case "rename":
        const name = prompt("Renommer la séance :", session.name);
        if (name == null) return;
        session.name = name.trim() || session.name;
        save();
        renderSessions();
        break;
      case "delete":
        if (!confirm(`Supprimer la séance « ${session.name} » ?`)) return;
        activity.sessions = activity.sessions.filter(s => s.id !== session.id);
        save();
        renderSessions();
        break;
    }
  }

  function openSessionEditor(session, isNew) {
    state.pendingSession = session;
    persistSessionMeta(session);
    const backup = localStorage.getItem("eleves");
    localStorage.setItem("scanprof_editor_backup", backup == null ? "__empty__" : backup);
    localStorage.setItem("eleves", JSON.stringify(session.data || []));
    els.sessionTitle.textContent = session.name;
    els.sessionInfo.textContent = `${cls.name} • ${activity.name}`;
    els.sessionOverlay.classList.remove("sp-hidden");
    els.sessionFrame.src = "participants.html?embedded=1";
    if (!isNew) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeSessionEditor(saveChanges) {
    els.sessionFrame.src = "about:blank";
    els.sessionOverlay.classList.add("sp-hidden");
    const backup = localStorage.getItem("scanprof_editor_backup");
    const session = state.pendingSession;
    if (session && saveChanges) {
      try {
        const data = JSON.parse(localStorage.getItem("eleves") || "[]");
        session.data = Array.isArray(data) ? data : [];
        session.updatedAt = new Date().toISOString();
        save();
        renderSessions();
      } catch (err) {
        console.warn("Impossible de récupérer les données de séance", err);
      }
    }
    restoreBackup(backup);
    state.pendingSession = null;
    clearSessionMeta();
  }

  function restoreBackup(marker) {
    if (marker === "__empty__") localStorage.removeItem("eleves");
    else if (marker != null) localStorage.setItem("eleves", marker);
    localStorage.removeItem("scanprof_editor_backup");
  }

  const state = { pendingSession: null };

  function exportSessionCSV(session) {
    const data = session.data || [];
    if (!data.length) {
      alert("Séance vide.");
      return;
    }
    const cols = extractColumns(data);
    const rows = data.map(row => cols.map(key => csvValue(row[key])));
    const csv = [cols.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadFile(csv, `classe_${slug(cls.name)}_${slug(activity.name)}_${slug(session.name)}.csv`, "text/csv");
  }

  function exportSessionJSON(session) {
    downloadFile(JSON.stringify(session, null, 2), `classe_${slug(cls.name)}_${slug(activity.name)}_${slug(session.name)}.json`, "application/json");
  }

  function exportActivityCSV() {
    if (!activity.sessions.length) {
      alert("Aucune séance à exporter.");
      return;
    }
    const columns = new Set(["__seance"]);
    const rows = [];
    activity.sessions.forEach(sess => {
      (sess.data || []).forEach(row => {
        Object.keys(row || {}).forEach(key => { if (!isInternalKey(key)) columns.add(key); });
      });
    });
    const header = Array.from(columns);
    activity.sessions.forEach(sess => {
      const data = Array.isArray(sess.data) ? sess.data : [];
      if (!data.length) {
        const blank = header.map(col => col === "__seance" ? csvValue(sess.name) : "");
        rows.push(blank);
        return;
      }
      data.forEach(row => {
        const obj = { ...row, __seance: sess.name };
        rows.push(header.map(col => csvValue(obj[col])));
      });
    });
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadFile(csv, `activite_${slug(activity.name)}.csv`, "text/csv");
  }

  function extractColumns(data) {
    const set = new Set();
    data.forEach(row => Object.keys(row || {}).forEach(key => { if (!isInternalKey(key)) set.add(key); }));
    return Array.from(set);
  }

  function csvValue(val) {
    if (val == null) return "";
    const str = String(val).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatDate(value) {
    try { return new Date(value).toLocaleString(); } catch { return value || ""; }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slug(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "fichier";
  }

  function isInternalKey(key = "") {
    return typeof key === "string" && key.startsWith("__");
  }

  function persistSessionMeta(session) {
    if (!session) return;
    const meta = {
      classId: cls?.id || null,
      className: cls?.name || "",
      activityId: activity?.id || null,
      activityName: activity?.name || "",
      sessionId: session.id,
      sessionName: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
      localStorage.setItem(
        AI_CONTEXT_KEY,
        JSON.stringify({
          classe: cls?.name || "",
          activite: activity?.name || "",
          seance: session.name || "",
          date: session.createdAt || new Date().toISOString(),
        })
      );
    } catch {
      /* noop */
    }
  }

  function clearSessionMeta() {
    try { localStorage.removeItem(SESSION_META_KEY); } catch { /* noop */ }
  }

  window.addEventListener("beforeunload", clearSessionMeta);

  function triggerCycleAnalysis() {
    if (!activity || activity.sessions.length < 2) return;
    const payload = {
      classId: cls?.id || null,
      className: cls?.name || "",
      activityId: activity.id,
      activityName: activity.name,
      sessionCount: activity.sessions.length,
      requestedAt: new Date().toISOString(),
    };
    const contextPayload = {
      classe: cls?.name || "",
      activite: activity?.name || "",
      seance: `Cycle (${activity.sessions.length} séances)`,
      date: new Date().toISOString(),
    };
    try {
      localStorage.setItem(CYCLE_TRIGGER_KEY, JSON.stringify(payload));
      localStorage.setItem(
        SESSION_META_KEY,
        JSON.stringify({
          classId: cls?.id || null,
          className: cls?.name || "",
          activityId: activity?.id || null,
          activityName: activity?.name || "",
          cycleName: activity?.name || "",
          savedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(AI_CONTEXT_KEY, JSON.stringify(contextPayload));
    } catch (err) {
      console.warn("Impossible de préparer l'analyse de cycle", err);
    }
    window.location.href = "participants.html?cycle=1";
  }
})();
