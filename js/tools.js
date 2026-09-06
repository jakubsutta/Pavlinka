// ============================================================
// tools.js – Měření, kreslení (Geoman), tisk
// ============================================================

// ── Blokování pohybu mapy během měření ──
let _measureActive = false;
const mapMoveMethods  = ['setView', 'panTo', 'panBy', 'flyTo', 'flyToBounds', 'fitBounds'];
const originalMethods = {};

mapMoveMethods.forEach(method => {
    originalMethods[method] = map[method].bind(map);
    map[method] = function () {
        if (_measureActive) return map;
        return originalMethods[method].apply(map, arguments);
    };
});

map.on('measurestart', () => {
    _measureActive = true;
    map.dragging.disable();
    if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
    if (map.smoothWheelZoom) map.smoothWheelZoom.disable();
});
map.on('measurefinish', () => {
    _measureActive = false;
    map.dragging.enable();
    if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
    if (map.smoothWheelZoom) map.smoothWheelZoom.enable();
});

// ── Měření ──
const measureStatusEl  = document.getElementById('measure-status');
const measureResultsEl = document.getElementById('measure-results');
const btnMeasureStart  = document.getElementById('btn-measure-start');
const btnMeasureClear  = document.getElementById('btn-measure-clear');

let isMeasuring      = false;
let measurePoints    = [];
let measureMode      = 'line';
let measureLayerGroup = L.featureGroup().addTo(map);
let measureLine      = null;
let measurePolygon   = null;
let previewLine      = null;
let snapMarker       = null;

document.querySelectorAll('input[name="measure-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        measureMode = e.target.value;
        if (isMeasuring) { clearMeasurement(); startMeasurement(); }
        else              { clearMeasurement(); }
    });
});

function setMeasureStatus(state) {
    measureStatusEl.className = 'measure-status measure-status--' + state;
    if (state === 'idle')   measureStatusEl.innerHTML = '<i class="ph ph-circle-dashed"></i> Připraveno k měření';
    if (state === 'active') measureStatusEl.innerHTML = '<i class="ph ph-circle-notch"></i> Probíhá měření… (' + (measureMode === 'line' ? 'Linie' : 'Plocha') + ')';
    if (state === 'done')   measureStatusEl.innerHTML = '<i class="ph ph-check-circle"></i> Měření dokončeno';
}

function getSphericalArea(latlngs) {
    const radius = 6378137;
    let area = 0;
    const len = latlngs.length;
    if (len > 2) {
        for (let i = 0; i < len; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[(i + 1) % len];
            area += (p2.lng - p1.lng) * Math.PI / 180 *
                (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
        }
        area = Math.abs(area * radius * radius / 2.0);
    }
    return area;
}

function updateMeasureResults() {
    let dist = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
        dist += measurePoints[i].distanceTo(measurePoints[i + 1]);
    }
    let area = 0;
    if (measureMode === 'area' && measurePoints.length > 2) area = getSphericalArea(measurePoints);

    const distStr = dist > 0 ? (dist >= 1000 ? (dist / 1000).toFixed(3) + ' km' : dist.toFixed(1) + ' m') : null;
    const areaStr = area > 0 ? (area >= 10000 ? (area / 10000).toFixed(4) + ' ha' : area.toFixed(1) + ' m²') : null;

    let html = '';
    if (distStr) html += `<div class="measure-result-item"><div class="measure-result-label">Délka trasy</div><div class="measure-result-value">${distStr}</div></div>`;
    if (measureMode === 'area' && areaStr) {
        html += `<div class="measure-result-item"><div class="measure-result-label">Plocha</div><div class="measure-result-value">${areaStr}</div></div>`;
    }
    measureResultsEl.innerHTML = html || '<div class="measure-results-empty">Zatím žádné výsledky. Klikněte do mapy.</div>';
}


function renderMeasureVisuals(cursorLatLng) {
    measureLayerGroup.clearLayers();
    
    if (measurePoints.length === 0) return;

    let pts = [...measurePoints];
    
    // Snapping logic for area
    if (measureMode === 'area' && measurePoints.length > 2 && cursorLatLng && isMeasuring) {
        const firstPointMap = map.latLngToLayerPoint(measurePoints[0]);
        const mousePoint    = map.latLngToLayerPoint(cursorLatLng);
        if (firstPointMap.distanceTo(mousePoint) < 15) {
            cursorLatLng = measurePoints[0];
            L.circleMarker(measurePoints[0], { radius: 8, color: '#e63946', fillColor: 'transparent', weight: 2 }).addTo(measureLayerGroup);
        }
    }

    if (isMeasuring && cursorLatLng) {
        pts.push(cursorLatLng);
    }

    // Vykresleni bodu
    measurePoints.forEach(p => {
        L.circleMarker(p, { radius: 4, color: '#e63946', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(measureLayerGroup);
    });

    // Vykresleni car a polygonu
    if (pts.length > 1) {
        L.polyline(pts, { color: '#e63946', weight: 3, dashArray: '6, 6' }).addTo(measureLayerGroup);
        if (measureMode === 'area' && pts.length > 2) {
            L.polygon(pts, { color: 'transparent', weight: 0, fillColor: '#e63946', fillOpacity: 0.2 }).addTo(measureLayerGroup);
        }
    }

    // Stitky delek segmentu - pouzijeme L.tooltip permanent
    for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        if (p1.equals(p2)) continue;
        const dist = p1.distanceTo(p2);
        const distStr = dist >= 1000 ? (dist / 1000).toFixed(2) + ' km' : dist.toFixed(1) + ' m';
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;
        L.tooltip({ permanent: true, direction: 'center', className: 'measure-seg-lbl', interactive: false })
            .setLatLng([midLat, midLng])
            .setContent(distStr)
            .addTo(measureLayerGroup);
    }
    
    // Pro dokonceny polygon - zaviraci segment + stitel plochy
    if (measureMode === 'area' && pts.length > 2 && !isMeasuring) {
        const pLast = pts[pts.length - 1];
        const pFirst = pts[0];
        if (!pLast.equals(pFirst)) {
            const dist = pLast.distanceTo(pFirst);
            const distStr = dist >= 1000 ? (dist / 1000).toFixed(2) + ' km' : dist.toFixed(1) + ' m';
            const midLat = (pLast.lat + pFirst.lat) / 2;
            const midLng = (pLast.lng + pFirst.lng) / 2;
            L.tooltip({ permanent: true, direction: 'center', className: 'measure-seg-lbl', interactive: false })
                .setLatLng([midLat, midLng])
                .setContent(distStr)
                .addTo(measureLayerGroup);
        }
        const area = getSphericalArea(pts);
        if (area > 0) {
            const areaStr = area >= 10000 ? (area / 10000).toFixed(4) + ' ha' : area.toFixed(1) + ' m²';
            const bounds = L.latLngBounds(pts);
            const center = bounds.getCenter();
            L.tooltip({ permanent: true, direction: 'center', className: 'measure-area-lbl', interactive: false })
                .setLatLng(center)
                .setContent(areaStr)
                .addTo(measureLayerGroup);
        }
    }
}

function finishMeasurement() {
    isMeasuring = false;
    map.off('click', onMapClickMeasure);
    map.off('mousemove', onMapMouseMoveMeasure);
    
    renderMeasureVisuals(null); // Finální překreslení bez kurzoru

    setMeasureStatus('done');
    btnMeasureStart.innerHTML = '<i class="ph ph-play"></i> Nové měření';
    document.getElementById('map').style.cursor = '';
    updateMeasureResults();
    const measureBtn = document.querySelector('[data-notes-mode="measure"]');
    if (measureBtn) measureBtn.classList.remove('has-active-tool');
}

function onMapClickMeasure(e) {
    L.DomEvent.stopPropagation(e);
    if (measureMode === 'area' && measurePoints.length > 2) {
        const firstPointMap = map.latLngToLayerPoint(measurePoints[0]);
        const clickPoint    = map.latLngToLayerPoint(e.latlng);
        if (firstPointMap.distanceTo(clickPoint) < 15) {
            // Zavíráme polygon (nepřidáváme bod, renderMeasureVisuals se postará o vizuální uzavření)
            finishMeasurement();
            return;
        }
    }
    measurePoints.push(e.latlng);
    renderMeasureVisuals(e.latlng);
    updateMeasureResults();
}

function onMapMouseMoveMeasure(e) {
    if (measurePoints.length === 0) return;
    renderMeasureVisuals(e.latlng);
}

function clearMeasurement() {
    measureLayerGroup.clearLayers();
    measurePoints  = [];
    measureResultsEl.innerHTML = '<div class="measure-results-empty">Zatím žádné výsledky.</div>';
    setMeasureStatus('idle');
    document.getElementById('map').style.cursor = '';
    if (isMeasuring) {
        map.off('click', onMapClickMeasure);
        map.off('mousemove', onMapMouseMoveMeasure);
        isMeasuring = false;
        btnMeasureStart.innerHTML = '<i class="ph ph-play"></i> Zahájit měření';
    }
    const measureBtn = document.querySelector('[data-notes-mode="measure"]');
    if (measureBtn) measureBtn.classList.remove('has-active-tool');
}

function startMeasurement() {
    clearMeasurement();
    isMeasuring = true;
    setMeasureStatus('active');
    btnMeasureStart.innerHTML = '<i class="ph ph-check"></i> Dokončit měření';
    document.getElementById('map').style.cursor = 'crosshair';
    const measureBtn = document.querySelector('[data-notes-mode="measure"]');
    if (measureBtn) measureBtn.classList.add('has-active-tool');
    setTimeout(() => {
        map.on('click', onMapClickMeasure);
        map.on('mousemove', onMapMouseMoveMeasure);
    }, 100);
}

btnMeasureStart.addEventListener('click', () => {
    if (isMeasuring) finishMeasurement();
    else startMeasurement();
});
btnMeasureClear.addEventListener('click', () => clearMeasurement());

// ── Kreslení (Leaflet.Geoman) ──
map.pm.addControls({
    position: 'topleft',
    drawMarker: false, drawCircleMarker: false, drawPolyline: false,
    drawRectangle: false, drawPolygon: false, drawCircle: false,
    drawText: false, editMode: false, dragMode: false,
    cutPolygon: false, removalMode: false, rotateMode: false,
});

// Globální nastavení stylu lomových bodů pro Geoman
map.pm.setGlobalOptions({
    markerStyle: {
        radius: 4,
        color: '#e63946',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2
    }
});

// ── Přepis stylu vertex markerů během kreslení ──
// Geoman ignoruje markerStyle pro Line/Polygon – nutno přestylovat ručně přes event
const VERTEX_STYLE = { radius: 4, color: '#e63946', fillColor: '#fff', fillOpacity: 1, weight: 2 };

map.on('pm:drawstart', ({ workingLayer }) => {
    if (!workingLayer) return;
    // Zachytit každý nově přidaný layer (CircleMarker = vertex)
    workingLayer.on('layeradd', ({ layer }) => {
        if (layer instanceof L.CircleMarker) {
            layer.setStyle(VERTEX_STYLE);
        }
    });
});

// Český překlad pro Geoman
map.pm.setLang('cs', {
  tooltips: {
    placeMarker: 'Kliknutím umístíte bod',
    firstVertex: 'Kliknutím do mapy umístíte první bod trasy',
    continueLine: 'Kliknutím do mapy pokračujte v trase',
    finishLine: 'Kliknutím na existující bod nebo dvojklikem trasu dokončíte',
    finishPoly: 'Kliknutím na první bod dokončíte polygon',
    finishRect: 'Kliknutím dokončíte obdélník',
    startCircle: 'Kliknutím umístíte střed kruhu',
    finishCircle: 'Kliknutím dokončíte kruh',
    placeCircleMarker: 'Kliknutím umístíte bod'
  },
  actions: {
    finish: 'Dokončit',
    cancel: 'Zrušit',
    removeLastVertex: 'Zpět'
  }
});
map.pm.setLang('cs');

const customMarkerIcon = L.divIcon({
    className: 'custom-search-marker',
    html: '<div class="marker-pin"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 30]
});

const drawLayerGroup = L.geoJSON(null, {
    pointToLayer: (feature, latlng) => {
        return L.marker(latlng, { icon: customMarkerIcon });
    },
    onEachFeature: (feature, layer) => {
        if (feature.properties && feature.properties.note) {
            layer.bindPopup(`<div style="font-family:Roboto;font-size:13px;"><strong>Poznámka:</strong><br>${feature.properties.note}</div>`);
        }
        if (feature.properties && feature.properties.color && layer.setStyle) {
            if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
                layer.setStyle({ color: feature.properties.color, fillColor: feature.properties.color });
            }
        }
    }
}).addTo(map);

function loadDrawings() {
    // Jednorázové smazání starých linií (z chybného testování profilu), aby nerušily na mapě
    if (!localStorage.getItem('pavlinka_wiped_old_lines')) {
        localStorage.removeItem('pavlinka_drawings');
        localStorage.setItem('pavlinka_wiped_old_lines', 'true');
    }

    const saved = localStorage.getItem('pavlinka_drawings');
    if (saved) {
        try { const geojson = JSON.parse(saved); drawLayerGroup.addData(geojson); updateDrawList(); }
        catch (e) { }
    } else { updateDrawList(); }
}

function saveDrawings() {
    localStorage.setItem('pavlinka_drawings', JSON.stringify(drawLayerGroup.toGeoJSON()));
    updateDrawList();
}

map.on('pm:create', (e) => {
    // Ignorovat kreslení, pokud je aktivní nástroj pro výškový profil
    if (typeof elevationProfileActive !== 'undefined' && elevationProfileActive) return;
    
    // Ignorovat kreslení, pokud je aktivní solární potenciál v režimu kreslení plochy
    if (typeof solarAnalyzer !== 'undefined' && solarAnalyzer.active && solarAnalyzer.selectionMode === 'polygon') return;

    const layer = e.layer;
    const DRAW_COLOR = '#e63946';
    const note  = document.getElementById('draw-note').value.trim();
    const geojson = layer.toGeoJSON();
    geojson.properties = geojson.properties || {};
    geojson.properties.color = DRAW_COLOR;
    geojson.properties.note  = note;
    geojson.properties.id    = Date.now().toString();
    map.removeLayer(layer);
    drawLayerGroup.addData(geojson);
    saveDrawings();
    document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-draw-cancel').style.display = 'none';
    document.getElementById('draw-note').value = '';
    const drawBtn = document.querySelector('[data-notes-mode="draw"]');
    if (drawBtn) drawBtn.classList.remove('has-active-tool');
});

const btnDrawCancel  = document.getElementById('btn-draw-cancel');
const btnDrawClearAll = document.getElementById('btn-draw-clear-all');
const drawList        = document.getElementById('draw-list');

document.querySelectorAll('.draw-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const shape = btn.getAttribute('data-draw');
        map.pm.disableDraw();
        document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btnDrawCancel.style.display = 'block';
        const drawBtn = document.querySelector('[data-notes-mode="draw"]');
        if (drawBtn) drawBtn.classList.add('has-active-tool');
        const DRAW_COLOR = '#e63946';

        // Ensure we force style every vertex added to the map during drawing
        map.once('pm:drawstart', (e) => {
            if (e.shape === 'Marker') {
                setTimeout(() => {
                    const drawInstance = map.pm.Draw.Marker;
                    if (drawInstance && drawInstance._hintMarker) {
                        drawInstance._hintMarker.setIcon(customMarkerIcon);
                    }
                }, 10);
            }
            if (e.workingLayer) {
                e.workingLayer.on('pm:vertexadded', (v) => {
                    if (v.marker && v.marker.setStyle) {
                        v.marker.setStyle({
                            radius: 5,
                            color: DRAW_COLOR,
                            fillColor: '#fff',
                            fillOpacity: 1,
                            weight: 2
                        });
                    }
                });
            }
        });

        let pathOptions = { color: DRAW_COLOR, fillColor: DRAW_COLOR, fillOpacity: 0.2, weight: 3, dashArray: '6, 6' };
        let markerStyle = {
            color: DRAW_COLOR,
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 2,
            radius: 5
        };

        if (shape === 'Marker') {
            markerStyle = { icon: customMarkerIcon };
        }
        
        map.pm.enableDraw(shape, {
            snappable: true, snapDistance: 15,
            templineStyle: { color: DRAW_COLOR, dashArray: '6, 6' },
            hintlineStyle: { color: DRAW_COLOR, dashArray: '6, 6' },
            pathOptions: pathOptions,
            markerStyle: markerStyle
        });
    });
});

btnDrawCancel.addEventListener('click', () => {
    map.pm.disableDraw();
    document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
    btnDrawCancel.style.display = 'none';
    const drawBtn = document.querySelector('[data-notes-mode="draw"]');
    if (drawBtn) drawBtn.classList.remove('has-active-tool');
});

btnDrawClearAll.addEventListener('click', () => {
    // Zrušíme případné aktivní kreslení
    map.pm.disableDraw();
    document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
    btnDrawCancel.style.display = 'none';
    const drawBtn = document.querySelector('[data-notes-mode="draw"]');
    if (drawBtn) drawBtn.classList.remove('has-active-tool');
    
    // Smažeme hlavní vrstvu
    drawLayerGroup.clearLayers();
    
    // Smažeme případné zatoulané Geoman vrstvy
    if (map.pm && typeof map.pm.getGeomanLayers === 'function') {
        map.pm.getGeomanLayers().forEach(layer => map.removeLayer(layer));
    }
    
    saveDrawings();
});

function updateDrawList() {
    drawList.innerHTML = '';
    const geojson = drawLayerGroup.toGeoJSON();
    if (geojson.features.length === 0) {
        drawList.innerHTML = '<div class="measure-results-empty">Zatím žádné nakreslené objekty.</div>';
        return;
    }
    geojson.features.forEach(f => {
        let typ = 'Neznámý';
        if (f.geometry.type === 'Point')      typ = 'Bod';
        if (f.geometry.type === 'LineString') typ = 'Linie';
        if (f.geometry.type === 'Polygon')    typ = 'Plocha';
        const noteTxt = f.properties.note ? ` - ${f.properties.note.substring(0, 20)}${f.properties.note.length > 20 ? '...' : ''}` : '';
        const item = document.createElement('div');
        item.className = 'draw-list-item';
        item.innerHTML = `
            <div class="shape-info">
                <div class="draw-list-item-color" style="background: ${f.properties.color || '#000'}"></div>
                <div><strong>${typ}</strong>${noteTxt}</div>
            </div>
            <button class="draw-list-item-delete" data-id="${f.properties.id}" title="Smazat"><i class="ph ph-trash"></i></button>
        `;
        drawList.appendChild(item);
    });
    drawList.querySelectorAll('.draw-list-item-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idToRemove = btn.getAttribute('data-id');
            let layerToRemove = null;
            drawLayerGroup.eachLayer(l => {
                if (l.feature && l.feature.properties && l.feature.properties.id === idToRemove) layerToRemove = l;
            });
            if (layerToRemove) { drawLayerGroup.removeLayer(layerToRemove); saveDrawings(); }
        });
    });
}

loadDrawings();

// ── Miniatura Tisku ──
let printMiniMap = null;

function syncPrintMiniatureLayers() {
    if (!printMiniMap) return;
    
    // Vyčistit staré vrstvy
    printMiniMap.eachLayer(layer => {
        printMiniMap.removeLayer(layer);
    });
    
    function cloneLayer(layer, target) {
        let clone = null;
        if (layer instanceof L.TileLayer.WMS) {
            clone = L.tileLayer.wms(layer._url, layer.options);
        } else if (layer instanceof L.TileLayer) {
            clone = L.tileLayer(layer._url, layer.options);
        } else if (layer instanceof L.Polygon) {
            clone = L.polygon(layer.getLatLngs(), layer.options);
        } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
            clone = L.polyline(layer.getLatLngs(), layer.options);
        } else if (layer instanceof L.Circle) {
            clone = L.circle(layer.getLatLng(), layer.options);
        } else if (layer instanceof L.Marker) {
            // OPTIMALIZACE VÝKONU:
            // Provedeme náhradu klasických obrázkových markerů za primitivní canvasové body.
            // Při tisících markerech by to miniaturní prohlížeč "zabilo", takhle se to vykreslí bleskově na jeden canvas.
            clone = L.circleMarker(layer.getLatLng(), { radius: 3, color: '#ffffff', weight: 1, fillColor: 'var(--accent)', fillOpacity: 0.8, interactive: false });
            layer.eachLayer(child => cloneLayer(child, target));
            return;
        }
        if (clone) {
            if (layer.options && clone.setStyle && !(layer instanceof L.Marker)) {
                clone.setStyle(layer.options);
            }
            clone.addTo(target);
        }
    }
    
    // Naklonovat všechny vrstvy z hlavní mapy (WMS, dlaždice, markery, polygony...)
    map.eachLayer(layer => {
        cloneLayer(layer, printMiniMap);
    });
}

function updatePrintMiniature() {
    const paper = document.getElementById('print-miniature-paper');
    if (!paper) return;

    const size = document.getElementById('print-size').value;
    const orient = document.querySelector('input[name="print-orient"]:checked').value;
    const ar = orient === 'portrait' ? (210/297) : (297/210);
    
    const wrapper = document.getElementById('print-miniature-wrapper');
    const maxH = wrapper.clientHeight - 20;
    const maxW = wrapper.clientWidth - 20;
    
    let h = maxH;
    let w = h * ar;
    if (w > maxW) {
        w = maxW;
        h = w / ar;
    }
    
    paper.style.width = w + 'px';
    paper.style.height = h + 'px';
    
    if (!printMiniMap) {
        printMiniMap = L.map('print-miniature-map', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            keyboard: false,
            boxZoom: false,
            preferCanvas: true // EXTRÉMNÍ ZRYCHLENÍ: vykresluje body/vektory rovnou na plátno místo stovek DOM divů
        });
        
        map.on('move', () => {
            if (printMiniMap && document.getElementById('tab-tisk').classList.contains('active')) {
                printMiniMap.setView(map.getCenter(), Math.max(0, map.getZoom() - 3), {animate: false});
            }
        });
        
        // Místo OSM dlaždic se načítají klony reálných vrstev
        syncPrintMiniatureLayers();
    }
    
    printMiniMap.invalidateSize();
    printMiniMap.setView(map.getCenter(), Math.max(0, map.getZoom() - 3), {animate: false});
    
    const titleText = document.getElementById('print-title').value || 'Pavlínka – tisk mapy';
    document.getElementById('mini-title').textContent = titleText;
    
    const showCoords = document.getElementById('print-coords').checked;
    document.getElementById('mini-coords').style.display = showCoords ? 'block' : 'none';
    
    const showLegend = document.getElementById('print-legend').checked;
    const legendEl = document.getElementById('mini-legend');
    if (showLegend) {
        legendEl.style.display = 'block';
        let c = 0;
        document.querySelectorAll('.legend-btn').forEach(btn => {
            const row = btn.closest('label');
            const checkbox = row ? row.querySelector('input[type="checkbox"]') : null;
            if (checkbox && checkbox.checked) c++;
        });
        legendEl.innerHTML = `<strong>Legenda</strong><br>${c} vrstev`;
    } else {
        legendEl.style.display = 'none';
    }
}

['print-title', 'print-size', 'print-legend', 'print-coords'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', updatePrintMiniature);
        el.addEventListener('change', updatePrintMiniature);
    }
});
document.querySelectorAll('input[name="print-orient"]').forEach(el => {
    el.addEventListener('change', updatePrintMiniature);
});

const btnTogglePreview = document.getElementById('btn-toggle-print-preview');
if (btnTogglePreview) {
    btnTogglePreview.addEventListener('click', () => {
        const wrapper = document.getElementById('print-miniature-wrapper');
        const icon = document.getElementById('toggle-print-icon');
        const text = document.getElementById('toggle-print-text');
        
        if (wrapper.style.display === 'none') {
            wrapper.style.display = 'flex';
            
            // Otevřený stav (jako aktivní přepínač)
            btnTogglePreview.style.background = 'var(--accent)';
            btnTogglePreview.style.color = 'white';
            btnTogglePreview.style.border = '1px solid var(--accent)';
            
            document.getElementById('toggle-print-img-icon').style.color = 'white';
            text.style.color = 'white';
            
            icon.style.transform = 'rotate(180deg)';
            icon.style.color = 'white';
            text.textContent = 'Skrýt náhled rozložení';
            
            // Dáme DOMu čas vykreslit flex kontejner, než Leaflet přepočítá rozměry
            setTimeout(() => {
                updatePrintMiniature();
                syncPrintMiniatureLayers();
            }, 50);
        } else {
            wrapper.style.display = 'none';
            
            // Zavřený stav (jako neaktivní skupina přepínačů)
            btnTogglePreview.style.background = 'rgba(54, 140, 84, 0.05)';
            btnTogglePreview.style.color = 'var(--text)';
            btnTogglePreview.style.border = '1px solid rgba(54, 140, 84, 0.15)';
            
            document.getElementById('toggle-print-img-icon').style.color = 'var(--text)';
            text.style.color = 'var(--text)';
            
            icon.style.transform = 'rotate(0deg)';
            icon.style.color = 'var(--text)';
            text.textContent = 'Zobrazit náhled rozložení';
        }
    });
}

window.addEventListener('tabChanged', (e) => {
    if (e.detail && e.detail.tab === 'tisk') {
        setTimeout(() => {
            const wrapper = document.getElementById('print-miniature-wrapper');
            if (wrapper && wrapper.style.display !== 'none') {
                updatePrintMiniature();
                syncPrintMiniatureLayers();
            }
        }, 100);
    }
});

// ── Tisk ──
document.getElementById('btn-print').addEventListener('click', () => {
    const title       = document.getElementById('print-title').value || 'Pavlínka – tisk mapy';
    const size        = document.getElementById('print-size').value;
    const orient      = document.querySelector('input[name="print-orient"]:checked').value;
    const showLegend  = document.getElementById('print-legend').checked;
    const showCoords  = document.getElementById('print-coords').checked;

    let style = document.getElementById('print-style-override');
    if (!style) {
        style    = document.createElement('style');
        style.id = 'print-style-override';
        document.head.appendChild(style);
    }
    style.textContent = `
    @page { size: ${size} ${orient}; margin: 0; }
    @media print {
        body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        .panel { display: none !important; }
        .main-content {
            position: absolute !important; top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            margin: 0 !important; padding: 0 !important; z-index: 1000;
        }
        #map { width: 100% !important; height: 100% !important; }
        .leaflet-control-container, .leaflet-pm-toolbar { display: none !important; }
        .print-overlay { display: block !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }`;

    let titleOverlay = document.getElementById('print-title-overlay');
    if (!titleOverlay) {
        titleOverlay = document.createElement('div');
        titleOverlay.id        = 'print-title-overlay';
        titleOverlay.className = 'print-overlay';
        titleOverlay.style.cssText = 'display:none;position:absolute;top:0;left:0;right:0;z-index:99999;background:rgba(255,255,255,0.9);padding:15px 20px;font-size:24px;font-weight:700;color:#368c54;border-bottom:2px solid #7ae09e;font-family:Roboto,sans-serif;';
        document.getElementById('map').appendChild(titleOverlay);
    }
    titleOverlay.textContent = title;

    let legendOverlay = document.getElementById('print-legend-overlay');
    if (legendOverlay) legendOverlay.remove();
    if (showLegend) {
        legendOverlay = document.createElement('div');
        legendOverlay.id        = 'print-legend-overlay';
        legendOverlay.className = 'print-overlay';
        legendOverlay.style.cssText = 'display:none;position:absolute;bottom:30px;right:30px;z-index:99999;background:rgba(255,255,255,0.9);padding:15px;font-size:12px;font-family:Roboto,sans-serif;border:2px solid #7ae09e;border-radius:8px;max-height:80vh;overflow-y:auto;box-shadow:0 0 10px rgba(0,0,0,0.1);';
        let legendHtml = '<strong style="font-size:16px; margin-bottom:12px; display:block; color:#368c54;">Legenda</strong>';
        let hasActiveLegends = false;
        document.querySelectorAll('.legend-btn').forEach(btn => {
            const row      = btn.closest('label');
            const checkbox = row ? row.querySelector('input[type="checkbox"]') : null;
            if (checkbox && checkbox.checked) {
                const layerId = btn.getAttribute('data-layer');
                const data    = typeof LEGEND_DATA !== 'undefined' ? LEGEND_DATA[layerId] : null;
                if (data) {
                    hasActiveLegends = true;
                    const layerName  = row.querySelector('.label-text') ? row.querySelector('.label-text').textContent.trim() : data.title;
                    legendHtml += `<div style="margin-top:10px;font-weight:bold;color:#333;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:5px;">${layerName}</div>`;
                    data.items.forEach(item => {
                        legendHtml += `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;margin-bottom:4px;"><span class="legend-shape l-${item.type}" style="background:${item.color};border:1px solid rgba(0,0,0,0.2);"></span><span style="color:#444;">${item.text}</span></div>`;
                    });
                }
            }
        });
        if (hasActiveLegends) {
            legendOverlay.innerHTML = legendHtml;
            document.getElementById('map').appendChild(legendOverlay);
        }
    }

    let coordsOverlay = document.getElementById('print-coords-overlay');
    if (coordsOverlay) coordsOverlay.remove();
    if (showCoords) {
        coordsOverlay = document.createElement('div');
        coordsOverlay.id        = 'print-coords-overlay';
        coordsOverlay.className = 'print-overlay';
        coordsOverlay.style.cssText = 'display:none;position:absolute;bottom:30px;left:30px;z-index:99999;background:rgba(255,255,255,0.9);padding:8px 12px;font-size:14px;font-family:Roboto,sans-serif;border:2px solid #7ae09e;border-radius:6px;color:#368c54;font-weight:500;';
        coordsOverlay.innerHTML = `Souřadnice středu mapy: ${map.getCenter().lat.toFixed(5)}, ${map.getCenter().lng.toFixed(5)}`;
        document.getElementById('map').appendChild(coordsOverlay);
    }

    document.activeElement.blur();
    setTimeout(() => window.print(), 500);
});

// ── Přepínání pod-karet v Poznámkách ──
document.querySelectorAll('.notes-switch-btn[data-notes-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.notesMode;
        document.querySelectorAll('.notes-switch-btn[data-notes-mode]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.notes-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const targetSection = document.getElementById(`notes-${mode}-section`);
        if (targetSection) targetSection.classList.add('active');
        localStorage.setItem('pavlinka_notes_mode', mode);

        // Deaktivace jiných nástrojů pro předcházení konfliktům v mapě
        if (mode === 'measure') {
            map.pm.disableDraw();
            document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
            if (btnDrawCancel) btnDrawCancel.style.display = 'none';
            const drawBtn = document.querySelector('[data-notes-mode="draw"]');
            if (drawBtn) drawBtn.classList.remove('has-active-tool');
            
            if (typeof elevationProfileActive !== 'undefined' && elevationProfileActive) {
                if (typeof toggleElevationProfileTool === 'function') toggleElevationProfileTool();
            }
        } else if (mode === 'draw') {
            if (isMeasuring) clearMeasurement();
            
            if (typeof elevationProfileActive !== 'undefined' && elevationProfileActive) {
                if (typeof toggleElevationProfileTool === 'function') toggleElevationProfileTool();
            }
        } else if (mode === 'profile' || mode === 'viewshed' || mode === 'solar' || mode === 'route') {
            map.pm.disableDraw();
            document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
            if (btnDrawCancel) btnDrawCancel.style.display = 'none';
            if (isMeasuring) clearMeasurement();
        }
        
        // Vypnutí případných spuštěných analýz, pokud se přepne jinam
        if (mode !== 'viewshed' && typeof viewshedAnalyzer !== 'undefined' && viewshedAnalyzer.active) {
            viewshedAnalyzer.cancelSelectionMode();
        }
        if (mode !== 'solar' && typeof solarAnalyzer !== 'undefined' && solarAnalyzer.active) {
            solarAnalyzer.cancelSelectionMode();
        }
    });
});

// Inicializace výchozího režimu v Poznámkách z localStorage
const savedNotesMode = localStorage.getItem('pavlinka_notes_mode') || 'measure';
const notesBtnToClick = document.querySelector(`.notes-switch-btn[data-notes-mode="${savedNotesMode}"]`);
if (notesBtnToClick) {
    notesBtnToClick.click();
}
