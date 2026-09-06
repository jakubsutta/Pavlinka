// ============================================================
// parcel.js – Správa pozemků, modal výběru, zobrazení v mapě
// ============================================================

// ── Vlastní implementace transformace WGS84 → S-JTSK (Křovák) ──
// Standardní matematický vzorec, nezávislý na proj4 a jeho případně špatné definici.
// Vrací { x: S-JTSK_X (northing ≈1092xxx pro Ostravu),
//          y: S-JTSK_Y (easting  ≈598xxx  pro Ostravu) }
// Pro MapaIdentifikace.aspx: x_param = sjtsk.y, y_param = sjtsk.x
function wgs84ToSjtskKrovak(lat, lng) {
    const D2R = Math.PI / 180;
    // WGS84 → Bessel 1841 (přibližná transformace pro ČR)
    const a_wgs = 6378137.0, f_wgs = 1 / 298.257223563;
    const a_bes = 6377397.155, f_bes = 1 / 299.1528128;
    const dx = -570.8, dy = -85.7, dz = -462.8;
    const wx = -4.998 * D2R / 3600, wy = -1.587 * D2R / 3600, wz = -5.261 * D2R / 3600;
    const m = 1 - 3.56e-6;

    const phi = lat * D2R, lam = lng * D2R;
    const e2_wgs = 2 * f_wgs - f_wgs * f_wgs;
    const N = a_wgs / Math.sqrt(1 - e2_wgs * Math.sin(phi) * Math.sin(phi));
    const X = (N + 0) * Math.cos(phi) * Math.cos(lam);
    const Y_c = (N + 0) * Math.cos(phi) * Math.sin(lam);
    const Z = (N * (1 - e2_wgs) + 0) * Math.sin(phi);

    // Helmert 7-parametrová transformace
    const X2 = m * (X + wz * Y_c - wy * Z) + dx;
    const Y2 = m * (-wz * X + Y_c + wx * Z) + dy;
    const Z2 = m * (wy * X - wx * Y_c + Z) + dz;

    // XYZ → geografické souřadnice na Besselově elipsoidu
    const e2_bes = 2 * f_bes - f_bes * f_bes;
    let phi_b = Math.atan2(Z2, Math.sqrt(X2 * X2 + Y2 * Y2) * (1 - e2_bes));
    for (let i = 0; i < 10; i++) {
        const N_b = a_bes / Math.sqrt(1 - e2_bes * Math.sin(phi_b) * Math.sin(phi_b));
        phi_b = Math.atan2(Z2 + e2_bes * N_b * Math.sin(phi_b), Math.sqrt(X2 * X2 + Y2 * Y2));
    }
    const lam_b = Math.atan2(Y2, X2);

    // Bessel → S-JTSK (Křovák)
    const a0 = 49.5 * D2R, b0 = 78.5 * D2R;
    const lam0 = (17 + 2/3) * D2R; // 17°40' = Ferro meridian shift from Greenwich
    const ferro = 17.66666666667 * D2R; // approx
    const lam_ferro = lam_b - (lam0 - 17.66666666667 * D2R);

    // Gaussovo zobrazení na kulové ploše
    const sinAlpha = 0.9967422, cosAlpha = 0.080463;  // Křovák α
    const k = 1.003419164;
    const n = 0.9999;
    const rho0 = 6380703.61;

    // Přesná implementace (standardní vzorec z ČÚZK)
    const e_bes = Math.sqrt(e2_bes);
    const sinPhi = Math.sin(phi_b);
    const t = Math.tan(Math.PI / 4 - phi_b / 2) /
              Math.pow((1 - e_bes * sinPhi) / (1 + e_bes * sinPhi), e_bes / 2);
    const U = 2 * (Math.atan(k * Math.pow(Math.tan(phi_b / 2 + Math.PI / 4), 0.9967422) *
              Math.pow((1 + e_bes * sinPhi) / (1 - e_bes * sinPhi), e_bes * 0.9967422 / 2)) - Math.PI / 4);
    const V = lam_b - 24.83333333 * D2R;  // Ferro diff
    const sinU = Math.sin(U), cosU = Math.cos(U);
    const cosV = Math.cos(V);
    const T = Math.asin(Math.cos(a0) * sinU + Math.sin(a0) * cosU * cosV);
    const D = Math.asin(cosU * Math.sin(V) / Math.cos(T));
    const theta = n * D;
    const r = rho0 / Math.pow(Math.tan(T / 2 + Math.PI / 4), n);

    const jtsk_x = r * Math.cos(theta);
    const jtsk_y = r * Math.sin(theta);

    return {
        x: Math.round(Math.abs(jtsk_x)),  // northing
        y: Math.round(Math.abs(jtsk_y))   // easting
    };
}

// ── Data parcel ──
const PARCELY = {
    '469': {
        cislo: '469',
        obec: 'Ostrava',
        obecKod: '554821',
        ku: 'Krásné Pole',
        kuKod: '673722',
        vymera: 641,
        druh: 'zahrada',
        typ: 'parcela katastru nemovitostí',
        lv: '238',
        vlastnik: 'Kamil Šutta',
        omezeni: null,
        bpej: null,
        stavebniObjekt: null,
        budova: null,
        zpusobVyuziti: null,
        knUrl: 'https://nahlizenidokn.cuzk.gov.cz/ZobrazObjekt.aspx?encrypted=NAHL~u4YLWie4dFKPWXR25bgglDPF4c_LkBQ6Eh__8uUztJ7pGPDJ-wAYwIRHqlFroZBD0MKDLrvRbbhMLtvCs2Q3tUoO21LggfdPfVklw9WHMJuBCY-MEu7cw6sI56Unp7HNqFPqw6jWcsHw4lrh61yDS02nsBMobjnXvxK67_KIklonM48ZbQduwVzy1pkhVH81c02dvONgxhiUbQ__RSycTB5iZNfszkr0BejHt6CUiH-UNGNCfNPW7pHw5Id4ggPx'
    },
    '468': {
        cislo: '468',
        obec: 'Ostrava',
        obecKod: '554821',
        ku: 'Krásné Pole',
        kuKod: '673722',
        vymera: 610,
        druh: 'zastavěná plocha a nádvoří',
        typ: 'parcela katastru nemovitostí',
        lv: '238',
        vlastnik: 'Kamil Šutta',
        omezeni: ['Věcné břemeno užívání'],
        bpej: null,
        stavebniObjekt: 'č.p. 298',
        budova: 'rodinný dům',
        zpusobVyuziti: null,
        knUrl: null
    },
    '470': {
        cislo: '470',
        obec: 'Ostrava',
        obecKod: '554821',
        ku: 'Krásné Pole',
        kuKod: '673722',
        vymera: 1564,
        druh: 'zahrada',
        typ: 'parcela katastru nemovitostí',
        lv: '238',
        vlastnik: 'Kamil Šutta',
        omezeni: ['Věcné břemeno užívání'],
        bpej: ['64600', '64610'],
        stavebniObjekt: null,
        budova: null,
        zpusobVyuziti: null,
        knUrl: null
    },
    '471': {
        cislo: '471',
        obec: 'Ostrava',
        obecKod: '554821',
        ku: 'Krásné Pole',
        kuKod: '673722',
        vymera: 606,
        druh: 'ostatní plocha',
        typ: 'parcela katastru nemovitostí',
        lv: '1402',
        vlastnik: 'Daniel Lukáč',
        omezeni: [
            'Věcné břemeno chůze a jízdy',
            'Umístění a provoz elektrorozvodného zařízení',
            'Ve prospěch nemovitosti neevidované v katastru'
        ],
        bpej: null,
        stavebniObjekt: null,
        budova: null,
        zpusobVyuziti: 'ostatní komunikace',
        knUrl: null
    },
    '1850/138': {
        cislo: '1850/138',
        obec: 'Ostrava',
        obecKod: '554821',
        ku: 'Krásné Pole',
        kuKod: '673722',
        vymera: 2715,
        druh: 'ostatní orná půda',
        typ: 'parcela katastru nemovitostí',
        lv: '867',
        vlastnik: 'Milan Bajgar',
        omezeni: null,
        bpej: ['64600', '64610'],
        stavebniObjekt: null,
        budova: null,
        zpusobVyuziti: null,
        knUrl: null
    }
};

// ── Stav ──
let isParcelToolActive = false;
let activeParcelaId = null;
let parcelaLayerGroup = null;        // L.featureGroup pro polygony parcel
let parcelaVertexLayerGroup = null;  // L.featureGroup pro uzlové body
let parcelaDimLayerGroup = null;     // L.featureGroup pro rozměry (kóty)

// ── Inicializace po načtení DOM ──
document.addEventListener('DOMContentLoaded', () => {
    // Delegace na tlačítka v detailu záložky
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-cancel-parcel')) cancelParcela();
        if (e.target.closest('#btn-zoom-parcel')) zoomToActiveParcela();
        if (e.target.closest('#btn-dim-parcel')) toggleParcelaDimensions();
    });
});

// ── Zapnutí/vypnutí nástroje pro výběr parcely v mapě ──
function toggleParcelTool() {
    isParcelToolActive = !isParcelToolActive;
    setParcelBtnActive(isParcelToolActive);

    if (isParcelToolActive) {
        // Nástroj aktivován
        if (!parcelaLayerGroup) {
            loadAllParcelsGeometry(); // První načtení
        } else {
            if (typeof map !== 'undefined') {
                map.addLayer(parcelaLayerGroup);
                map.addLayer(parcelaVertexLayerGroup);
            }
        }
        
        const tabBtn = document.querySelector('.tab-btn[data-tab="pozemek"]');
        if (tabBtn) tabBtn.click();

        if (!activeParcelaId) {
            const container = document.getElementById('pozemek-detail-container');
            if (container) container.innerHTML = getEmptyStateHtml();
        }
    } else {
        // Nástroj deaktivován – skryjeme vrstvy
        if (parcelaLayerGroup && typeof map !== 'undefined') {
            map.removeLayer(parcelaLayerGroup);
            map.removeLayer(parcelaVertexLayerGroup);
        }
    }
}

// ── Aktualizace aktivního stavu tlačítka v mapě ──
function setParcelBtnActive(isActive) {
    const btn = document.getElementById('parcel-toggle-btn');
    if (!btn) return;
    if (isActive) {
        btn.classList.add('active');
        btn.title = 'Pozemek – nástroj aktivní (kliknutím vypneš)';
    } else {
        btn.classList.remove('active');
        btn.title = 'Pozemek – zapnout výběr parcel';
    }
}

// ── Výběr parcely ──
function selectParcela(parcelId) {
    if (!PARCELY[parcelId]) return;

    activeParcelaId = parcelId;

    const tabBtn = document.querySelector('.tab-btn[data-tab="pozemek"]');
    if (tabBtn) tabBtn.click();

    renderParcelaDetail(parcelId);
    updateParcelLayersStyle();
}

// ── Zrušení výběru ──
function cancelParcela() {
    activeParcelaId = null;

    updateParcelLayersStyle();
    clearParcelaDimensions();

    const container = document.getElementById('pozemek-detail-container');
    if (container) container.innerHTML = getEmptyStateHtml();
}

// ── Zoom na aktivní parcelu ──
function zoomToActiveParcela() {
    if (parcelaLayerGroup && activeParcelaId && typeof map !== 'undefined') {
        parcelaLayerGroup.eachLayer(layer => {
            if (layer.options.parcelKey === activeParcelaId) {
                map.fitBounds(layer.getBounds(), { padding: [60, 60] });
            }
        });
    }
}

// ── Vykreslení kót (rozměrů) aktivní parcely ──
function clearParcelaDimensions() {
    if (parcelaDimLayerGroup && typeof map !== 'undefined') {
        map.removeLayer(parcelaDimLayerGroup);
        parcelaDimLayerGroup = null;
    }
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.classList.remove('show-parcel-dimensions');
}

function addParcelaDimensions(parcelId) {
    if (typeof map === 'undefined' || !parcelaLayerGroup) return;

    clearParcelaDimensions();
    parcelaDimLayerGroup = L.featureGroup().addTo(map);

    parcelaLayerGroup.eachLayer(layer => {
        if (layer.options.parcelKey !== parcelId) return;
        if (!layer.getLatLngs) return;

        const latlngs = layer.getLatLngs();

        function processRing(ring) {
            if (!ring || ring.length < 2) return;
            if (Array.isArray(ring[0])) { ring.forEach(processRing); return; }

            for (let i = 0; i < ring.length; i++) {
                const p1 = ring[i];
                const p2 = ring[(i + 1) % ring.length];
                const distance = map.distance(p1, p2);
                if (distance < 0.5) continue;

                const midLat = (p1.lat + p2.lat) / 2;
                const midLng = (p1.lng + p2.lng) / 2;

                const proj1 = map.project(p1, 15);
                const proj2 = map.project(p2, 15);
                let angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x) * (180 / Math.PI);
                if (angle > 90) angle -= 180;
                else if (angle < -90) angle += 180;

                const icon = L.divIcon({
                    className: 'geom-length-label-wrapper',
                    html: `<div style="display:flex;align-items:center;justify-content:center;width:max-content;transform:translate(-50%,-50%) rotate(${angle}deg);background-color:#cc0000;color:white;padding:1.5px 3.5px;font-size:7.5px;font-family:Inter,Roboto,sans-serif;font-weight:700;border-radius:2px;border:1px solid white;white-space:nowrap;pointer-events:none;box-shadow:0 1px 2px rgba(0,0,0,0.3);text-shadow:none;letter-spacing:0.1px;">${distance.toFixed(2)} m</div>`,
                    iconSize: [0, 0]
                });
                L.marker([midLat, midLng], { icon, interactive: false, keyboard: false }).addTo(parcelaDimLayerGroup);
            }
        }

        latlngs.forEach(processRing);
    });

    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.classList.add('show-parcel-dimensions');
}

function toggleParcelaDimensions() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (mapEl.classList.contains('show-parcel-dimensions')) {
        clearParcelaDimensions();
        // Aktualizace vzhledu tlačítka
        const btn = document.getElementById('btn-dim-parcel');
        if (btn) btn.classList.remove('active');
    } else {
        if (activeParcelaId) {
            addParcelaDimensions(activeParcelaId);
            const btn = document.getElementById('btn-dim-parcel');
            if (btn) btn.classList.add('active');
        }
    }
}

// ── Render detailu parcely ──
function renderParcelaDetail(parcelId) {
    const p = PARCELY[parcelId];
    if (!p) return;

    let finalKnUrl = p.knUrl;
    if (!finalKnUrl && p.ruianId) {
        finalKnUrl = `https://nahlizenidokn.cuzk.gov.cz/ZobrazObjekt.aspx?typ=parcela&id=${p.ruianId}`;
    }
    const knLinkStyle = !finalKnUrl ? ' style="opacity:0.4; pointer-events:none;"' : '';
    const knLinkText = finalKnUrl ? 'Odkaz do KN (Nahlížení)' : 'Odkaz do KN (načítá se…)';

    let extraRows = '';
    if (p.stavebniObjekt) {
        extraRows += `<div class="parcel-row"><span class="parcel-label">Stavební objekt</span><span class="parcel-value">${p.stavebniObjekt}</span></div>`;
    }
    if (p.budova) {
        extraRows += `<div class="parcel-row"><span class="parcel-label">Budova</span><span class="parcel-value">${p.budova}</span></div>`;
    }
    if (p.zpusobVyuziti) {
        extraRows += `<div class="parcel-row"><span class="parcel-label">Způsob využití</span><span class="parcel-value">${p.zpusobVyuziti}</span></div>`;
    }
    if (p.bpej && p.bpej.length > 0) {
        extraRows += `<div class="parcel-row"><span class="parcel-label">Seznam BPEJ</span><span class="parcel-value">${p.bpej.join(', ')}</span></div>`;
    }

    let omezeniHtml = '';
    if (p.omezeni && p.omezeni.length > 0) {
        omezeniHtml = `
            <div class="parcel-row parcel-row--omezeni">
                <span class="parcel-label">Omezení vlastnického práva</span>
                <span class="parcel-value parcel-omezeni">
                    ${p.omezeni.map(o => `<span class="omezeni-tag">${o}</span>`).join('')}
                </span>
            </div>`;
    }

    const html = `
        <div class="parcel-detail">
            <div class="parcel-header">
                <div class="parcel-cislo-box">
                    <i class="ph-bold ph-layout"></i>
                    <span>Parcela č. ${p.cislo}</span>
                </div>
                <span class="parcel-druh-badge">${p.druh}</span>
            </div>
            <div class="parcel-rows">
                <div class="parcel-row"><span class="parcel-label">Obec</span><span class="parcel-value">${p.obec} <span class="parcel-code">[${p.obecKod}]</span></span></div>
                <div class="parcel-row"><span class="parcel-label">Katastrální území</span><span class="parcel-value">${p.ku} <span class="parcel-code">[${p.kuKod}]</span></span></div>
                <div class="parcel-row"><span class="parcel-label">Výměra</span><span class="parcel-value">${p.vymera.toLocaleString('cs-CZ')} m²</span></div>
                <div class="parcel-row"><span class="parcel-label">Typ parcely</span><span class="parcel-value">${p.typ}</span></div>
                ${extraRows}
                <div class="parcel-row"><span class="parcel-label">Číslo LV</span><span class="parcel-value">${p.lv}</span></div>
                <div class="parcel-row"><span class="parcel-label">Vlastnické právo</span><span class="parcel-value parcel-vlastnik">${p.vlastnik}</span></div>
                ${omezeniHtml}
            </div>
            <a href="${finalKnUrl || 'javascript:void(0)'}" target="${finalKnUrl ? '_blank' : '_self'}" rel="noopener" class="tab-action-btn tab-action-btn--confirm parcel-kn-link"${knLinkStyle}>
                <i class="ph-bold ph-arrow-square-out"></i> ${knLinkText}
            </a>
            <div class="parcel-actions">
                <button class="tab-action-btn" id="btn-zoom-parcel">
                    <i class="ph-bold ph-magnifying-glass-plus"></i> Přiblížit na parcelu
                </button>
                <button class="tab-action-btn" id="btn-dim-parcel">
                    <i class="ph-bold ph-ruler"></i> Rozměry parcely
                </button>
                <button class="tab-action-btn tab-action-btn--danger" id="btn-cancel-parcel">
                    <i class="ph-bold ph-x"></i> Zrušit výběr
                </button>
            </div>
        </div>
    `;

    const container = document.getElementById('pozemek-detail-container');
    if (container) container.innerHTML = html;
}

// ── Prázdný stav záložky ──
function getEmptyStateHtml() {
    return `
        <div class="parcel-empty-state">
            <i class="ph-bold ph-layout parcel-empty-icon"></i>
            <p>Pro zobrazení informací o pozemku klikni na tlačítko
                <i class="ph-bold ph-layout" style="color: var(--accent); font-size: 14px;"></i>
                v pravé části mapy.
            </p>
        </div>
    `;
}

// ── Styly parcel ──
const STYLE_INACTIVE = {
    color: '#cc0000',
    weight: 2,
    opacity: 0.75,
    fillOpacity: 0
};
const STYLE_INACTIVE_HOVER = {
    color: '#cc0000',
    weight: 2.5,
    opacity: 1,
    fillColor: '#cc0000',
    fillOpacity: 0.12
};
const STYLE_ACTIVE = {
    color: '#cc0000',
    weight: 3,
    opacity: 1,
    fillColor: '#cc0000',
    fillOpacity: 0.22
};

// ── Styly uzlů ──
const VERTEX_STYLE_INACTIVE = {
    radius: 3,
    color: '#cc0000',
    weight: 1.5,
    fillOpacity: 0,
    opacity: 0.75,
    interactive: false
};
const VERTEX_STYLE_ACTIVE = {
    radius: 4.5,
    color: '#cc0000',
    weight: 2,
    fillColor: '#ffffff',
    fillOpacity: 1,
    opacity: 1,
    interactive: false
};

// ── Aktualizace stylů na základě aktuálně vybrané parcely ──
function updateParcelLayersStyle() {
    if (!parcelaLayerGroup) return;

    parcelaLayerGroup.eachLayer(layer => {
        if (layer.options.parcelKey === activeParcelaId) {
            layer.setStyle(STYLE_ACTIVE);
            layer.bringToFront();
        } else {
            layer.setStyle(STYLE_INACTIVE);
        }
    });

    if (parcelaVertexLayerGroup) {
        parcelaVertexLayerGroup.eachLayer(vertex => {
            if (typeof vertex.setStyle === 'function') {
                if (vertex.options.parcelKey === activeParcelaId) {
                    vertex.setStyle(VERTEX_STYLE_ACTIVE);
                    vertex.bringToFront();
                } else {
                    vertex.setStyle(VERTEX_STYLE_INACTIVE);
                }
            }
        });
    }
}

// ── Načtení geometrie VŠECH parcel z ČÚZK RUIAN ArcGIS REST API ──
async function loadAllParcelsGeometry() {
    if (typeof map === 'undefined') return;

    const baseUrl = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/5/query';
    const kuBbox = '18.105,49.835,18.140,49.855'; // BBOX KÚ Krásné Pole s rezervou

    // Získáme seznam čísel parcel pro klauzuli IN
    const cisla = Object.values(PARCELY).map(p => `'${p.cislo}'`).join(',');
    
    const params = new URLSearchParams({
        geometry: kuBbox,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        where: `cisloparcely IN (${cisla})`,
        outFields: '*',
        outSR: '4326',
        returnGeometry: 'true',
        f: 'json'
    });

    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.error) {
            console.warn('[parcel.js] API chyba:', data.error.message || data.error);
            return;
        }
        if (!data.features || data.features.length === 0) {
            console.warn('[parcel.js] Parcely nenalezeny v RUIAN.');
            return;
        }

        parcelaLayerGroup = L.featureGroup().addTo(map);
        parcelaVertexLayerGroup = L.featureGroup().addTo(map);

        data.features.forEach(feature => {
            const geom = feature.geometry;
            if (!geom || !geom.rings || geom.rings.length === 0) return;

            const coordinates = geom.rings.map(ring => ring.map(pt => [pt[0], pt[1]]));
            const geoJsonFeature = {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates },
                properties: feature.attributes || {}
            };

            const cisloParcely = feature.attributes.cisloparcely;
            const parcelKey = Object.keys(PARCELY).find(k => PARCELY[k].cislo === cisloParcely);
            
            if (!parcelKey) return;

            // Uložení ruianId pro generování KN odkazu při renderování panelu
            if (feature.attributes.id) {
                PARCELY[parcelKey].ruianId = feature.attributes.id;
            }

            const layer = L.geoJSON(geoJsonFeature, {
                style: STYLE_INACTIVE,
                parcelKey: parcelKey,
                onEachFeature: (feat, l) => {
                    l.on('mouseover', () => {
                        if (activeParcelaId !== parcelKey) l.setStyle(STYLE_INACTIVE_HOVER);
                    });
                    l.on('mouseout', () => {
                        if (activeParcelaId !== parcelKey) l.setStyle(STYLE_INACTIVE);
                    });
                    l.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        selectParcela(parcelKey);
                    });
                }
            });

            // Extrakce vrstvy z GeoJSON objektu pro vložení do FeatureGroup
            // + přidání popisku jako Leaflet tooltip (stejný přístup jako RUIAN search)
            layer.eachLayer(l => {
                l.options.parcelKey = parcelKey;

                // Vypočtěí úhel nejdelší hrany polygonu v geografickém prostoru
                const lls = l.getLatLngs();
                const pts = [];
                const flattenPts = (arr) => { arr.forEach(pt => pt.lat ? pts.push(pt) : flattenPts(pt)); };
                flattenPts(lls);

                let maxGeoDist = 0, bestGeoAngle = 0;
                if (pts.length > 1) {
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                        const dLat = (p2.lat - p1.lat) * 111320; // m per degree lat
                        const dLng = (p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
                        const dist = Math.hypot(dLat, dLng);
                        if (dist > maxGeoDist) {
                            maxGeoDist = dist;
                            // Leaflet screen: y roste dolů, x doprava
                            // Ze severu na jih = pozitivní y = úhel 90°
                            let angle = Math.atan2(-dLat, dLng) * 180 / Math.PI;
                            if (angle > 90 || angle <= -90) angle += 180;
                            bestGeoAngle = angle;
                        }
                    }
                }

                // Popisek – bindTooltip s permanent/center (Leaflet určí pozici uvnitř polygonu)
                const labelHtml = Math.abs(bestGeoAngle) > 5
                    ? `<span style="display:inline-block;transform:rotate(${bestGeoAngle}deg)">${cisloParcely}</span>`
                    : cisloParcely;

                l.bindTooltip(labelHtml, {
                    permanent: true,
                    direction: 'center',
                    className: 'parcel-map-label',
                    interactive: false
                });

                parcelaLayerGroup.addLayer(l);
            });

            // Uzlové body
            const outerRing = coordinates[0];
            const step = outerRing.length > 200 ? 4 : outerRing.length > 80 ? 2 : 1;
            for (let i = 0; i < outerRing.length - 1; i += step) {
                const [lng, lat] = outerRing[i];
                const vertex = L.circleMarker([lat, lng], Object.assign({}, VERTEX_STYLE_INACTIVE, { parcelKey: parcelKey }));
                parcelaVertexLayerGroup.addLayer(vertex);
            }
        });

        // Zoom na všechny načtené parcely po prvotním načtení
        if (parcelaLayerGroup.getLayers().length > 0) {
            map.fitBounds(parcelaLayerGroup.getBounds(), { padding: [40, 40] });
        }

        updateParcelLayersStyle();

    } catch (err) {
        console.warn('[parcel.js] Chyba načtení geometrií:', err);
    }
}
