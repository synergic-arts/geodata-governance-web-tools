(() => {
  const $ = id => document.getElementById(id);
  const state = { features: [], name: "ejemplo.geojson", source: null, detected: [], contract: [], issues: [], validated: false };
  const demo = { type: "FeatureCollection", name: "inventario-demo", features: [
    { type: "Feature", id: "A-01", geometry: { type: "Point", coordinates: [-3.7038, 40.4168] }, properties: { codigo: "A-01", nombre: "Puerta histórica", periodo: "romano", visitas: 120, latitud: 40.4168 } },
    { type: "Feature", id: "A-02", geometry: { type: "Point", coordinates: [-0.3763, 39.4699] }, properties: { codigo: "A-02", nombre: "Torre del puerto", periodo: "medieval", visitas: 86, latitud: 39.4699 } },
    { type: "Feature", id: "A-02", geometry: { type: "Point", coordinates: [-5.9845, 37.3891] }, properties: { codigo: "A-02", nombre: "Muro sur", periodo: "romano", visitas: -4, latitud: null } },
    { type: "Feature", id: "A-04", geometry: null, properties: { codigo: "A-04", nombre: "", periodo: "otro", visitas: 510, latitud: 37.3891 } }
  ] };
  const typeLabels = { text: "Texto", number: "Número", boolean: "Booleano", date: "Fecha" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = value => value === null || value === undefined || value === "" ? "∅" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const isEmpty = value => value === null || value === undefined || (typeof value === "string" && value.trim() === "");
  function normalize(input) {
    if (input?.type === "FeatureCollection") return input.features.map((f, i) => ({ ...f, _row: i + 1, properties: f.properties && typeof f.properties === "object" ? f.properties : {} }));
    if (input?.type === "Feature") return [{ ...input, _row: 1, properties: input.properties && typeof input.properties === "object" ? input.properties : {} }];
    if (Array.isArray(input)) return input.map((record, i) => ({ type: "Feature", properties: record && typeof record === "object" ? record : { value: record }, geometry: null, _row: i + 1 }));
    if (input && typeof input === "object") return [{ type: "Feature", properties: input, geometry: null, _row: 1 }];
    throw new Error("El JSON no contiene una FeatureCollection, Feature o lista de registros.");
  }
  function inferType(values) {
    const used = values.filter(v => !isEmpty(v));
    if (!used.length) return "text";
    if (used.every(v => typeof v === "boolean")) return "boolean";
    if (used.every(v => typeof v === "number" && Number.isFinite(v))) return "number";
    if (used.every(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v) && !Number.isNaN(Date.parse(v)))) return "date";
    return "text";
  }
  function detect() {
    const keys = [...new Set(state.features.flatMap(f => Object.keys(f.properties || {})))];
    state.detected = keys.map(key => {
      const values = state.features.map(f => f.properties?.[key]);
      const type = inferType(values); const nonEmpty = values.filter(v => !isEmpty(v));
      const numeric = type === "number" ? nonEmpty : [];
      const unique = nonEmpty.length > 0 && new Set(nonEmpty.map(v => JSON.stringify(v))).size === nonEmpty.length;
      return { field: key, type, required: values.some(v => isEmpty(v)) === false, unique, min: numeric.length ? Math.min(...numeric) : "", max: numeric.length ? Math.max(...numeric) : "", allowed: type === "text" ? [...new Set(nonEmpty.map(String))].slice(0, 12).join(", ") : "" };
    });
    state.contract = state.detected.map(rule => ({ ...rule }));
    renderContract(); renderSummary();
  }
  function renderContract() {
    $("contract-rows").innerHTML = state.contract.length ? state.contract.map((r, i) => `<tr data-index="${i}"><td><b>${esc(r.field)}</b><small>${esc(typeLabels[r.type])}</small></td><td><select data-key="type"><option value="text">Texto</option><option value="number">Número</option><option value="boolean">Booleano</option><option value="date">Fecha</option></select></td><td><input data-key="required" type="checkbox" aria-label="${esc(r.field)} obligatorio"></td><td><input data-key="unique" type="checkbox" aria-label="${esc(r.field)} único"></td><td><input data-key="min" type="number" step="any" placeholder="—" aria-label="mínimo ${esc(r.field)}"></td><td><input data-key="max" type="number" step="any" placeholder="—" aria-label="máximo ${esc(r.field)}"></td><td><input data-key="allowed" type="text" placeholder="a, b, c" aria-label="valores permitidos ${esc(r.field)}"></td></tr>`).join("") : `<tr><td colspan="7"><div class="empty">No se han detectado atributos.</div></td></tr>`;
    state.contract.forEach((r, i) => { const row = $("contract-rows").children[i]; ["type","required","unique","min","max","allowed"].forEach(key => { const el = row.querySelector(`[data-key="${key}"]`); if (el.type === "checkbox") el.checked = Boolean(r[key]); else el.value = r[key] ?? ""; el.addEventListener("change", () => { r[key] = el.type === "checkbox" ? el.checked : el.value; if (key === "type") { renderContract(); } state.validated = false; }); }); });
  }
  function readContract() { state.contract.forEach((r, i) => { const row = $("contract-rows").children[i]; if (!row) return; ["type","required","unique","min","max","allowed"].forEach(key => { const el = row.querySelector(`[data-key="${key}"]`); r[key] = el.type === "checkbox" ? el.checked : el.value; }); }); }
  function cast(value, type) {
    if (isEmpty(value)) return { ok: false, empty: true };
    if (type === "number") return { ok: typeof value === "number" ? Number.isFinite(value) : value !== "" && Number.isFinite(Number(value)), value: Number(value) };
    if (type === "boolean") return { ok: typeof value === "boolean" || value === true || value === false || ["true","false"].includes(String(value).toLowerCase()), value: value === true || String(value).toLowerCase() === "true" };
    if (type === "date") return { ok: !Number.isNaN(Date.parse(String(value))), value: String(value) };
    return { ok: typeof value === "string" || typeof value === "number" || typeof value === "boolean", value: String(value) };
  }
  function validate() {
    readContract(); const issues = []; const seen = new Map();
    const add = (feature, field, rule, value, detail, severity = "error") => issues.push({ row: feature._row, field, rule, value: fmt(value), detail, severity });
    state.contract.forEach(rule => { if (rule.unique) seen.set(rule.field, new Map()); });
    state.features.forEach(feature => {
      const props = feature.properties || {};
      state.contract.forEach(rule => {
        const value = props[rule.field]; const result = cast(value, rule.type);
        if (rule.required && result.empty) add(feature, rule.field, "obligatorio", value, "Falta un valor requerido");
        if (!result.empty && !result.ok) add(feature, rule.field, "tipo", value, `Se esperaba ${typeLabels[rule.type].toLowerCase()}`);
        if (!result.empty && result.ok && rule.type === "number") {
          if (rule.min !== "" && Number(result.value) < Number(rule.min)) add(feature, rule.field, "mínimo", value, `Debe ser ≥ ${rule.min}`);
          if (rule.max !== "" && Number(result.value) > Number(rule.max)) add(feature, rule.field, "máximo", value, `Debe ser ≤ ${rule.max}`);
        }
        const allowed = String(rule.allowed || "").split(",").map(v => v.trim()).filter(Boolean);
        if (!result.empty && allowed.length && !allowed.includes(String(value))) add(feature, rule.field, "catálogo", value, `No está entre los valores permitidos: ${allowed.join(", ")}`);
        if (rule.unique && !result.empty) { const key = JSON.stringify(value); const map = seen.get(rule.field); if (map.has(key)) add(feature, rule.field, "único", value, `Repite el valor de la entidad ${map.get(key)}`); else map.set(key, feature._row); }
      });
      if (!feature.geometry) add(feature, "(geometría)", "geometría", "∅", "La entidad no tiene geometría", "warning");
    });
    state.issues = issues; state.validated = true; renderResults(); renderSummary(); $("status").textContent = issues.length ? `Validación completada: ${issues.length} incidencia(s).` : "Validación completada: todas las entidades cumplen el contrato."; $("status").className = `status ${issues.length ? "error" : "success"}`;
  }
  function renderResults() {
    const q = $("query").value.toLowerCase(); const severity = $("severity").value; const rows = state.issues.filter(x => (severity === "all" || x.severity === severity) && [x.row,x.field,x.rule,x.value,x.detail].join(" ").toLowerCase().includes(q));
    $("issue-rows").innerHTML = rows.length ? rows.slice(0, 500).map(x => `<tr><td>#${x.row}</td><td>${esc(x.field)}</td><td><span class="badge ${x.severity}">${esc(x.rule)}</span></td><td><code>${esc(x.value)}</code></td><td>${esc(x.detail)}</td></tr>`).join("") : `<tr><td colspan="5"><div class="empty">${state.validated ? "No hay incidencias con este filtro." : "Pulsa “Validar contrato” para obtener resultados."}</div></td></tr>`;
    $("table-note").textContent = rows.length > 500 ? `Mostrando 500 de ${rows.length}. Exporta el CSV para el detalle completo.` : `${rows.length} incidencia(s) visibles.`; $("result-note").textContent = state.validated ? `${state.issues.length} total` : "Pendiente de validar";
    const invalidRows = new Set(state.issues.filter(x => x.severity === "error").map(x => x.row)); $("count").textContent = state.features.length; $("fields").textContent = state.contract.length; $("issues").textContent = state.issues.length; $("valid").textContent = Math.max(0, state.features.length - invalidRows.size);
  }
  function renderSummary() { $("summary-list").innerHTML = state.contract.length ? state.contract.map(r => { const count = state.features.filter(f => !isEmpty(f.properties?.[r.field])).length; const fieldIssues = state.issues.filter(i => i.field === r.field).length; return `<div class="summary-item"><b>${esc(r.field)}<small>${esc(typeLabels[r.type])}${r.required ? " · obligatorio" : ""}${r.unique ? " · único" : ""}</small></b><span>${count}/${state.features.length} con valor<br>${fieldIssues ? `<em class="issue-error">${fieldIssues} incidencia(s)</em>` : `<em class="issue-error" style="color:#067647">OK</em>`}</span></div>`; }).join("") : `<div class="empty">Carga una capa para detectar campos.</div>`; }
  function parseInput(input, name) { try { state.features = normalize(input); state.name = name || "capa.geojson"; $("file-name").textContent = `${state.name} · ${state.features.length} entidades`; $("workspace").classList.remove("hidden"); detect(); state.issues = []; state.validated = false; renderResults(); renderSummary(); $("status").textContent = "Contrato detectado. Revisa las reglas y valida la capa."; $("status").className = "status"; } catch (e) { $("status").textContent = e.message; $("status").className = "status error"; } }
  function loadFile(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { parseInput(JSON.parse(reader.result), file.name); } catch { $("status").textContent = "No se ha podido leer el JSON."; $("status").className = "status error"; } }; reader.readAsText(file); }
  function download(name, content, type) { const blob = new Blob([content], { type }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
  function contractPayload() { readContract(); return { tool: "Schema Contract Lab", version: 1, createdAt: new Date().toISOString(), sourceFile: state.name, rules: state.contract.map(r => ({ field: r.field, type: r.type, required: Boolean(r.required), unique: Boolean(r.unique), min: r.min === "" ? null : Number(r.min), max: r.max === "" ? null : Number(r.max), allowed: String(r.allowed || "").split(",").map(v => v.trim()).filter(Boolean) })) }; }
  function reportPayload() { return { ...contractPayload(), validation: { validated: state.validated, entities: state.features.length, validEntities: Number($("valid").textContent), issues: state.issues.length, errors: state.issues.filter(x => x.severity === "error").length, warnings: state.issues.filter(x => x.severity === "warning").length }, issues: state.issues }; }
  function csv() { const head = ["entidad","campo","regla","valor","detalle","severidad"]; const lines = state.issues.map(x => [x.row,x.field,x.rule,x.value,x.detail,x.severity].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")); return "\ufeff" + [head.join(","), ...lines].join("\n"); }
  $("file").addEventListener("change", e => loadFile(e.target.files[0])); $("drop").addEventListener("click", () => $("file").click()); $("drop").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") $("file").click(); }); $("drop").addEventListener("dragover", e => { e.preventDefault(); $("drop").classList.add("drag"); }); $("drop").addEventListener("dragleave", () => $("drop").classList.remove("drag")); $("drop").addEventListener("drop", e => { e.preventDefault(); $("drop").classList.remove("drag"); loadFile(e.dataTransfer.files[0]); });
  $("demo").addEventListener("click", () => parseInput(demo, "inventario-demo.geojson")); $("clear").addEventListener("click", () => { state.features = []; state.issues = []; state.validated = false; $("workspace").classList.add("hidden"); $("file").value = ""; $("file-name").textContent = "Sin archivo"; $("status").textContent = "Carga una capa para comenzar."; }); $("validate").addEventListener("click", validate); $("reset-contract").addEventListener("click", () => { state.contract = state.detected.map(r => ({ ...r })); renderContract(); state.validated = false; renderResults(); renderSummary(); }); $("query").addEventListener("input", renderResults); $("severity").addEventListener("change", renderResults); $("contract-json").addEventListener("click", () => download("schema-contract.json", JSON.stringify(contractPayload(), null, 2), "application/json")); $("report-json").addEventListener("click", () => download("schema-validation-report.json", JSON.stringify(reportPayload(), null, 2), "application/json")); $("issues-csv").addEventListener("click", () => download("schema-issues.csv", csv(), "text/csv;charset=utf-8"));
  renderSummary(); renderResults();
})();
