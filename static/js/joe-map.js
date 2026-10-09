/* Job Map: AEA JOE postings on a Leaflet map with filters and an in-view list.
   Data comes from static/data/joe-postings.json (scripts/joe/build_joe.py). */
(function () {
  "use strict";

  var root = document.getElementById("joe");
  if (!root || !window.L) return;

  // Color follows job type, in fixed order (validated: CVD-safe for 3 slots).
  var GROUP_ORDER = ["academic-tt", "academic-other", "nonacademic"];
  var GROUP_COLOR = { "academic-tt": "#2a78d6", "academic-other": "#eb6834", "nonacademic": "#1baf7a" };
  var GROUP_SHORT = { "academic-tt": "Tenure-track academic", "academic-other": "Visiting / temporary academic", "nonacademic": "Nonacademic" };
  var VIEWS = {
    world: [[-45, -130], [62, 150]],
    na: [[24, -126], [52, -64]],
    "us-ne": [[38.5, -80.5], [44.8, -69.5]],
    europe: [[36, -10], [60, 30]],
    asia: [[18, 100], [42, 142]]
  };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var fmtDate = function (iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  var today = new Date().toISOString().slice(0, 10);

  var state = { q: "", jel: "", open: true, groups: { "academic-tt": true, "academic-other": true, "nonacademic": true } };
  var data, postings = [], markersById = {};

  var map = L.map("joe-map", { worldCopyJump: true, minZoom: 1, zoomSnap: 0.5 });
  // Basemap: CARTO light (needs a key since Sept 2026; set params.cartoApiKey in config.toml).
  // Without a key, fall back to standard OpenStreetMap tiles, which need none.
  var osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var cartoKey = root.dataset.cartoKey;
  if (cartoKey) {
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=" + encodeURIComponent(cartoKey), {
      maxZoom: 18, subdomains: "abcd",
      attribution: osm + ' &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
  } else {
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: osm }).addTo(map);
  }
  map.fitBounds(VIEWS.world);

  var clusters = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: function (zoom) { return zoom < 4 ? 60 : 40; },
    spiderfyOnMaxZoom: true,
    iconCreateFunction: function (cluster) {
      var n = cluster.getChildCount();
      var size = n < 10 ? 28 : n < 50 ? 34 : 42;
      return L.divIcon({ html: "<div>" + n + "</div>", className: "joe-cluster", iconSize: [size, size] });
    }
  }).addTo(map);

  function popupHtml(p) {
    var locs = p.locations.map(function (l) { return esc(l.label); }).join("; ");
    var jel = p.jel.length ? p.jel.join(", ") : "";
    return '<div class="joe-popup">' +
      '<span class="joe-type"><span class="joe-swatch" style="--c:' + GROUP_COLOR[p.group] + '"></span>' + esc(GROUP_SHORT[p.group]) + "</span>" +
      '<span class="joe-inst">' + esc(p.institution) + "</span>" +
      (p.unit ? '<span class="joe-sub">' + esc(p.unit) + "</span>" : "") +
      "<p>" + esc(p.title) + "</p>" +
      "<p class=\"joe-sub\">" + locs + "</p>" +
      "<p class=\"joe-sub\">" + (p.deadline ? "Deadline " + fmtDate(p.deadline) : "Deadline not listed") +
      (p.posted ? " · Posted " + fmtDate(p.posted) : "") + "</p>" +
      (jel ? '<p class="joe-sub">JEL ' + esc(jel) + "</p>" : "") +
      '<p><a href="' + esc(p.url) + '" target="_blank" rel="noopener">View on JOE &#8599;</a></p>' +
      "</div>";
  }

  function makeMarker(p, loc) {
    var c = GROUP_COLOR[p.group];
    var exact = loc.precision === "city";
    var m = L.circleMarker([loc.lat, loc.lon], exact
      ? { radius: 7, color: "#ffffff", weight: 2, fillColor: c, fillOpacity: 1 }
      : { radius: 8, color: c, weight: 2, dashArray: "3 3", fillColor: c, fillOpacity: 0.18 });
    m.posting = p;
    m.bindTooltip(esc(p.institution) + "<br>" + esc(p.title), { direction: "top", offset: [0, -6] });
    m.bindPopup(function () { return '<div class="joe-popup-scroll">' + popupHtml(p) + "</div>"; }, { maxWidth: 300 });
    return m;
  }

  function matches(p, ignoreGroup) {
    if (!ignoreGroup && !state.groups[p.group]) return false;
    if (state.open && p.deadline && p.deadline < today) return false;
    if (state.jel && p.jel.indexOf(state.jel) < 0) return false;
    if (state.q) {
      var hay = [p.institution, p.title, p.unit, p.section].concat(
        p.locations.map(function (l) { return l.label; }),
        p.jel, p.jel.map(function (j) { return data.jel[j] || ""; })
      ).join(" ").toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  function renderTypes() {
    var counts = {};
    postings.forEach(function (p) { if (matches(p, true)) counts[p.group] = (counts[p.group] || 0) + 1; });
    $("joe-types").innerHTML = GROUP_ORDER.map(function (g) {
      return '<button type="button" class="joe-chip" data-group="' + g + '" aria-pressed="' + state.groups[g] + '">' +
        '<span class="joe-swatch" style="--c:' + GROUP_COLOR[g] + '"></span>' + esc(GROUP_SHORT[g]) +
        ' <span class="joe-count">' + (counts[g] || 0) + "</span></button>";
    }).join("");
  }

  function refreshLayers() {
    clusters.clearLayers();
    var layers = [];
    postings.forEach(function (p) {
      if (matches(p)) layers.push.apply(layers, markersById[p.id]);
    });
    clusters.addLayers(layers);
    renderTypes();
    renderList();
  }

  function renderList() {
    var bounds = map.getBounds();
    var shown = postings.filter(function (p) {
      return matches(p) && markersById[p.id].some(function (m) { return bounds.contains(m.getLatLng()); });
    });
    var total = postings.filter(function (p) { return matches(p); }).length;
    shown.sort(function (a, b) {
      return (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.institution.localeCompare(b.institution);
    });
    $("joe-count").textContent = shown.length + " of " + total + " matching postings in this view";
    if (!shown.length) {
      $("joe-list").innerHTML = '<li class="joe-empty">No postings here. Zoom out or change the filters.</li>';
      return;
    }
    $("joe-list").innerHTML = shown.map(function (p) {
      return "<li>" +
        '<button type="button" class="joe-item" data-id="' + p.id + '">' +
        '<span class="joe-type"><span class="joe-swatch" style="--c:' + GROUP_COLOR[p.group] + '"></span>' + esc(GROUP_SHORT[p.group]) + "</span>" +
        '<span class="joe-inst">' + esc(p.institution) + "</span>" +
        '<span class="joe-title">' + esc(p.title) + "</span>" +
        '<span class="joe-sub">' + esc(p.locations.map(function (l) { return l.label; }).join("; ")) + "</span>" +
        '<span class="joe-sub">' + (p.deadline ? "Deadline " + fmtDate(p.deadline) : "Deadline not listed") + "</span>" +
        "</button>" +
        '<a class="joe-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">View on JOE &#8599;</a>' +
        "</li>";
    }).join("");
  }

  function focusPosting(id) {
    var ms = markersById[id];
    if (!ms || !ms.length) return;
    if (ms.length === 1) {
      clusters.zoomToShowLayer(ms[0], function () { ms[0].openPopup(); });
    } else {
      map.fitBounds(L.latLngBounds(ms.map(function (m) { return m.getLatLng(); })).pad(0.3), { maxZoom: 9 });
      map.once("moveend", function () { L.popup().setLatLng(ms[0].getLatLng()).setContent(popupHtml(ms[0].posting)).openOn(map); });
    }
  }

  // Wire up controls.
  var qTimer;
  $("joe-q").addEventListener("input", function (e) {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { state.q = e.target.value.trim(); refreshLayers(); }, 150);
  });
  $("joe-jel").addEventListener("change", function (e) { state.jel = e.target.value; refreshLayers(); });
  $("joe-open").addEventListener("change", function (e) { state.open = e.target.checked; refreshLayers(); });
  $("joe-types").addEventListener("click", function (e) {
    var b = e.target.closest("[data-group]");
    if (!b) return;
    state.groups[b.dataset.group] = !state.groups[b.dataset.group];
    refreshLayers();
    var again = $("joe-types").querySelector('[data-group="' + b.dataset.group + '"]');
    if (again) again.focus();
  });
  $("joe-reset").addEventListener("click", function () {
    state = { q: "", jel: "", open: true, groups: { "academic-tt": true, "academic-other": true, "nonacademic": true } };
    $("joe-q").value = ""; $("joe-jel").value = ""; $("joe-open").checked = true;
    map.fitBounds(VIEWS.world);
    refreshLayers();
  });
  root.querySelector(".joe-views").addEventListener("click", function (e) {
    var v = e.target.closest("[data-view]");
    if (v) map.fitBounds(VIEWS[v.dataset.view]);
  });
  $("joe-list").addEventListener("click", function (e) {
    var item = e.target.closest(".joe-item");
    if (item) focusPosting(Number(item.dataset.id));
  });
  map.on("moveend", renderList);

  fetch(root.dataset.src)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      data = d;
      postings = d.postings.filter(function (p) { return p.locations.length; });
      postings.forEach(function (p) { markersById[p.id] = p.locations.map(function (l) { return makeMarker(p, l); }); });
      // "World" = every posting, so nothing starts off-screen (e.g. Australia, Chile).
      var all = [];
      postings.forEach(function (p) { markersById[p.id].forEach(function (m) { all.push(m.getLatLng()); }); });
      if (all.length) VIEWS.world = L.latLngBounds(all).pad(0.05);
      map.fitBounds(VIEWS.world);
      var used = {};
      postings.forEach(function (p) { p.jel.forEach(function (j) { used[j] = true; }); });
      $("joe-jel").insertAdjacentHTML("beforeend", Object.keys(used).sort().map(function (j) {
        return '<option value="' + esc(j) + '">' + esc(j) + " · " + esc(d.jel[j] || "") + "</option>";
      }).join(""));
      $("joe-meta").textContent = d.postings.length + " postings · JOE issue " + d.issues.join(", ") +
        (d.latest_posting ? " · newest posted " + fmtDate(d.latest_posting) : "") +
        " · map data updated " + fmtDate(d.generated);
      refreshLayers();
    })
    .catch(function () { $("joe-meta").textContent = "Could not load the postings. Please try again later."; });
})();
