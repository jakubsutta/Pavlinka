// ============================================================
// katastr.js – Dotazování na parcely v katastru (KN)
// ============================================================

// Definice souřadnicového systému S-JTSK (EPSG:5514) pro knihovnu proj4
if (typeof proj4 !== 'undefined') {
    proj4.defs("EPSG:5514", "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813975277778 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs");
} else {
    console.error("Proj4js library is not loaded. Coordinate conversion for Katastr will not work.");
}

/**
 * Převod z WGS84 (GPS) do S-JTSK (Křovák)
 * @param {number} lat - zeměpisná šířka
 * @param {number} lng - zeměpisná délka
 * @returns {object} {x: JTSK_X, y: JTSK_Y} (absolutní kladné hodnoty pro ČÚZK)
 */
function wgs84ToSjtsk(lat, lng) {
    if (typeof proj4 === 'undefined') {
        return { x: 0, y: 0 };
    }
    // Proj4js očekává [longitude, latitude] pro EPSG:4326
    const res = proj4("EPSG:4326", "EPSG:5514", [lng, lat]);
    // res[0] je Easting (osa Y v S-JTSK), res[1] je Northing (osa X v S-JTSK)
    return {
        x: Math.abs(res[1]), // Northing (parametr y v nahlížení)
        y: Math.abs(res[0])  // Easting (parametr x v nahlížení)
    };
}

// ── Inicializace vrstev na mapě pro zvýraznění ──
if (typeof map !== 'undefined') {
    if (!map.highlightLayer) {
        map.highlightLayer = L.featureGroup().addTo(map);
    }
    if (!map.hoverHighlightLayer) {
        map.hoverHighlightLayer = L.featureGroup().addTo(map);
    }
    if (!map.dtmHighlightLayer) {
        map.dtmHighlightLayer = L.featureGroup().addTo(map);
    }
}


// Slovník pro překlad hlaviček z WMS ČÚZK do češtiny
const KATASTR_ATTR_LABELS = {
    "Číslo parcely": "Č. parcely",
    "Cislo parcely": "Č. parcely",
    "Výměra parcely": "Výměra",
    "Vymera parcely": "Výměra",
    "Kód druhu pozemku": "Druh pozemku",
    "Kod druhu pozemku": "Druh pozemku",
    "Druh pozemku": "Druh pozemku",
    "Způsob využití pozemku": "Způsob využití",
    "Zpusob vyuziti pozemku": "Způsob využití",
    "Rozlišení druhu číslování parcely": "Typ číslování",
    "Rozliseni druhu cislovani parcely": "Typ číslování",
    "Nadřazené katastrální území": "Kód K.Ú.",
    "Nadrazene katastralni uzemi": "Kód K.Ú.",
    "Kód katastrálního území": "Kód K.Ú.",
    "Kod katastralniho uzemi": "Kód K.Ú.",
    "Název katastrálního území": "K.Ú.",
    "Nazev katastralniho uzemi": "K.Ú.",
    "Kód obce": "Kód obce",
    "Kod obce": "Kód obce",
    "Název obce": "Obec",
    "Nazev obce": "Obec",
    "Kód budovy": "Kód budovy",
    "Kod budovy": "Kód budovy",
    "Katastrální území kód": "Kód K.Ú.",
    "Katastrální území název": "Název K.Ú.",

    // DTM (Technické sítě) atributy
    "id": "ID objektu",
    "id_prvku": "ID prvku",
    "idexterni": "Externí ID",
    "zpusobporizeniti": "Způsob pořízení",
    "ideditora": "ID editora",
    "vkladosoba": "Vklad osoba",
    "vklad_osoba": "Vklad osoba",
    "code_base": "Kód prvku",
    "evidencnicisloobjektu": "Evidenční číslo",
    "objektovytypnazev": "Typ objektu",
    "urovenumisteniobjektuti": "Úroveň umístění",
    "tridapresnostipoloha": "Přesnost polohy",
    "tridapresnostivyska": "Přesnost výšky",
    "datumvkladu": "Datum vkladu",
    "idzmeny": "ID změny",
    "idvlastnika": "ID vlastníka",
    "idspravce": "ID správce",
    "idprovozovatele": "ID provozovatele",
    "nazevvlastnika": "Vlastník",
    "nazevspravce": "Správce",
    "nazevprovozovatele": "Provozovatel",
    "ics": "ICS",
    "neuplnadata": "Neúplná data",
    "maximalninapetovahladina": "Max. napětí",
    "typ_svedeni": "Typ svedení",
    "typ_sit": "Typ sítě",
    "druh_sit": "Druh sítě",
    "nazev_sit": "Název sítě",
    "kategorie": "Kategorie",
    "stav": "Stav",
    "spravce": "Správce",
    "druh_vedeni": "Druh vedení",
    "nazev_prvku": "Název prvku",
    "popis": "Popis",
    "katastralni_uzemi": "K.Ú.",
    "zadavatel": "Zadavatel",
    "datum_porizeni": "Datum pořízení",
    "chyba_polohy": "Polohová chyba",

    // NDIC (Dopravní info) atributy
    "situation_record_type": "Typ události",
    "txevc": "Kód události (txevc)",
    "mtxt": "Popis události",
    
    // Dopravní kamery atributy
    "misto": "Umístění kamery",
    "oznaceni": "Označení"
};

/**
 * Získání srozumitelného názvu atributu z překladového slovníku nebo formátováním
 */
function getAttributeLabel(key) {
    if (KATASTR_ATTR_LABELS[key]) {
        return KATASTR_ATTR_LABELS[key];
    }
    // Zkusíme najít case-insensitive shodu
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(KATASTR_ATTR_LABELS)) {
        if (k.toLowerCase() === lowerKey) {
            return v;
        }
    }
    // Fallback: nahradit podtržítka mezerami, rozdělit camelCase a zvětšit první písmeno
    let label = key.replace(/_/g, ' ');
    label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
    return label.charAt(0).toUpperCase() + label.slice(1);
}
/**
 * Formátování hodnoty atributů
 */
function formatKatastrValue(header, value) {
    if (value === null || value === undefined || value === "Null" || value.trim() === "") {
        return "—";
    }

    // Pokud je hlavička výměra, zkusíme přidat jednotky m²
    if (header.toLowerCase().includes("výměra") || header.toLowerCase().includes("vymera")) {
        const cleanVal = value.replace(/\s/g, '');
        if (!isNaN(cleanVal) && !value.includes("m²")) {
            return Number(cleanVal).toLocaleString('cs-CZ') + " m²";
        }
    }

    return value;
}

/**
 * Vymazání červeného zvýraznění vybrané parcely
 */
function clearKatastrHighlight() {
    if (typeof map !== 'undefined' && map.highlightLayer) {
        map.highlightLayer.clearLayers();
    }
    const clearBtn = document.getElementById('btn-katastr-clear-highlight');
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    const selectedEl = document.getElementById('selected-parcel-text');
    if (selectedEl) {
        selectedEl.innerText = "Vyberte kliknutím";
        selectedEl.classList.add("text-muted");
    }
    const dimBtn = document.getElementById('toggle-dimensions-btn');
    if (dimBtn) {
        dimBtn.disabled = true;
        dimBtn.classList.remove("active");
    }
    const mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.classList.remove('show-parcel-dimensions');
    }
    const selectedHalf = document.querySelector('.parcel-selected-half');
    if (selectedHalf) selectedHalf.classList.remove('has-selection');
    const selIcon = document.getElementById('parcel-selected-icon');
    if (selIcon) selIcon.style.display = 'none';
}

// Reference na aktuální DTM highlight vrstvy
let dtmHighlightWmsLayer = null;
let dtmHighlightClickMarkers = [];

/**
 * Vymazání zvýraznění DTM objektu
 */
function clearDtmHighlight() {
    // Vyčistit WMS overlay vrstvu
    if (dtmHighlightWmsLayer && typeof map !== 'undefined' && map.hasLayer(dtmHighlightWmsLayer)) {
        map.removeLayer(dtmHighlightWmsLayer);
        dtmHighlightWmsLayer = null;
    }
    // Vyčistit markerové body
    dtmHighlightClickMarkers.forEach(m => {
        if (typeof map !== 'undefined' && map.hasLayer(m)) map.removeLayer(m);
    });
    dtmHighlightClickMarkers = [];
    // Kompatibilita se starým přístupem (featureGroup)
    if (typeof map !== 'undefined' && map.dtmHighlightLayer) {
        map.dtmHighlightLayer.clearLayers();
    }
    const clearBtn = document.getElementById('btn-katastr-clear-highlight');
    if (clearBtn) clearBtn.style.display = 'none';
}

/**
 * Vykreslení zvýraznění DTM objektu na mapě.
 *
 * ČÚZK DTM WMS GetFeatureInfo nikdy nevrací geometrii (ověřeno: json/xml/gml
 * nezahrnují souřadnice). WMS GetMap s SLD_BODY/CQL_FILTER filtrem server ignoruje.
 * Jediná vizuální zpětná vazba je proto animovaný zaměřovací marker na místě kliknutí.
 *
 * @param {Object} feature - GeoJSON feature z WMS GetFeatureInfo (bez geometry)
 * @param {Object} latlng - Leaflet LatLng místa kliknutí
 */
function drawDtmGeometry(feature, latlng) {
    if (!feature || typeof map === 'undefined') return;

    // Vyčistit předchozí markery
    if (dtmHighlightWmsLayer && map.hasLayer(dtmHighlightWmsLayer)) {
        map.removeLayer(dtmHighlightWmsLayer);
        dtmHighlightWmsLayer = null;
    }
    dtmHighlightClickMarkers.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    dtmHighlightClickMarkers = [];

    if (!latlng) return;

    // ── Marker: menší, v barvě akcentu webu (zelená) ──
    // Vnější obrys - pulzující
    const ring = L.circleMarker(latlng, {
        radius: 11,
        color: 'rgb(54, 140, 84)',
        weight: 2.5,
        opacity: 0.85,
        fillOpacity: 0,
        interactive: false
    }).addTo(map);
    const ringEl = ring.getElement();
    if (ringEl) ringEl.classList.add('dtm-highlight-ring');

    // Vnitřní vyplněný bod
    const dot = L.circleMarker(latlng, {
        radius: 5,
        color: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillColor: 'rgb(54, 140, 84)',
        fillOpacity: 1
    }).addTo(map);
    const dotEl = dot.getElement();
    if (dotEl) {
        dotEl.classList.add('dtm-highlight-dot');
        dotEl.style.cursor = 'pointer';
    }

    dtmHighlightClickMarkers = [ring, dot];

    // Zobrazit tlačítko pro zrušení zvýraznění
    const clearBtn = document.getElementById('btn-katastr-clear-highlight');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
}


/**
 * Vymazání modrého hover zvýraznění
 */
function clearKatastrHoverHighlight() {
    if (typeof map !== 'undefined' && map.hoverHighlightLayer) {
        map.hoverHighlightLayer.clearLayers();
    }
    const hoverEl = document.getElementById('hover-parcel-text');
    if (hoverEl) {
        hoverEl.innerText = "Najetím vyberte parcelu";
    }
}

/**
 * Vykreslení obdržené geometrie na mapě
 */
function drawGeometry(feature, type, latlng) {
    if (!feature || typeof map === 'undefined') return;

    let geojson = null;
    if (feature.geometry && feature.geometry.coordinates) {
        // Je to již GeoJSON prvek (např. z DTM WMS)
        geojson = feature;
    } else if (feature.geometry && (feature.geometry.rings || feature.geometry.paths || (feature.geometry.x && feature.geometry.y))) {
        if (typeof L.esri !== 'undefined' && L.esri.Util && L.esri.Util.arcgisToGeoJSON) {
            geojson = L.esri.Util.arcgisToGeoJSON(feature);
        } else {
            // Fallback pro převod geometrie bez knihovny esri-leaflet
            const geom = feature.geometry;
            let geojsonGeom = null;
            if (geom.rings) {
                geojsonGeom = {
                    type: 'Polygon',
                    coordinates: geom.rings.map(ring => ring.map(pt => [pt[0], pt[1]]))
                };
            } else if (geom.paths) {
                geojsonGeom = {
                    type: 'LineString',
                    coordinates: geom.paths[0].map(pt => [pt[0], pt[1]])
                };
            } else if (geom.x && geom.y) {
                geojsonGeom = {
                    type: 'Point',
                    coordinates: [geom.x, geom.y]
                };
            }
            if (geojsonGeom) {
                geojson = {
                    type: 'Feature',
                    geometry: geojsonGeom,
                    properties: feature.attributes || {}
                };
            }
        }
    } else if (latlng) {
        // Pokud geometrie chybí (např. WMS DTM TI), vytvoříme dočasnou bodovou geometrii (kruh) v místě dotazu
        geojson = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [latlng.lng, latlng.lat]
            },
            properties: feature.properties || {}
        };
    }

    if (!geojson || !geojson.geometry) return;

    // Funkce pro vykreslení délek jednotlivých stran
    function addLengthLabels(layer, targetGroup, bgColor) {
        if (!layer.getLatLngs) return;
        let latlngs = layer.getLatLngs();
        if (!latlngs || latlngs.length === 0) return;
        
        function processRing(ring) {
            if (!ring || ring.length < 2) return;
            if (Array.isArray(ring[0])) {
                ring.forEach(processRing);
                return;
            }
            
            for (let i = 0; i < ring.length; i++) {
                let p1 = ring[i];
                let p2 = ring[(i + 1) % ring.length];
                
                if (layer instanceof L.Polyline && !(layer instanceof L.Polygon) && i === ring.length - 1) break;
                
                let distance = map.distance(p1, p2);
                if (distance < 0.5) continue; // Skrýt extrémně malé úseky
                
                let midLat = (p1.lat + p2.lat) / 2;
                let midLng = (p1.lng + p2.lng) / 2;
                
                let proj1 = map.project(p1, 15);
                let proj2 = map.project(p2, 15);
                let dx = proj2.x - proj1.x;
                let dy = proj2.y - proj1.y;
                let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                
                // Zajistíme, aby text nebyl nikdy vzhůru nohama
                if (angle > 90) angle -= 180;
                else if (angle < -90) angle += 180;
                
                let icon = L.divIcon({
                    className: 'geom-length-label-wrapper',
                    html: `<div style="display: flex; align-items: center; justify-content: center; width: max-content; transform: translate(-50%, -50%) rotate(${angle}deg); background-color: ${bgColor}; color: white; padding: 1.5px 3.5px; font-size: 7.5px; font-family: Inter, Roboto, sans-serif; font-weight: 700; border-radius: 2px; border: 1px solid white; white-space: nowrap; pointer-events: none; box-shadow: 0 1px 2px rgba(0,0,0,0.3); text-shadow: none; letter-spacing: 0.1px;">${distance.toFixed(2)} m</div>`,
                    iconSize: [0, 0]
                });
                
                L.marker([midLat, midLng], {
                    icon: icon,
                    interactive: false,
                    keyboard: false
                }).addTo(targetGroup);
            }
        }
        
        if (layer instanceof L.Polygon) {
            latlngs.forEach(processRing);
        } else {
            if (Array.isArray(latlngs[0])) latlngs.forEach(processRing);
            else processRing(latlngs);
        }
    }

    if (type === 'click') {
        if (!map.highlightLayer) {
            map.highlightLayer = L.featureGroup().addTo(map);
        }
        map.highlightLayer.clearLayers();

        // Vykreslení geometrie: pokud je to bod, použijeme kruhový marker
        L.geoJSON(geojson, {
            onEachFeature: function(feature, layer) {
                if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
                    addLengthLabels(layer, map.highlightLayer, '#e53935'); // Červená – vykreslíme, ale CSS je skryje dokud tlačítko není stisknuto
                }
            },
            pointToLayer: function (geojsonPoint, latlngPoint) {
                return L.circleMarker(latlngPoint, {
                    radius: 12,
                    color: '#ff0000',
                    weight: 3,
                    opacity: 0.8,
                    fillColor: '#ff0000',
                    fillOpacity: 0.15,
                    pointerEvents: 'none'
                });
            },
            style: {
                color: '#ff0000',
                weight: 3,
                opacity: 0.8,
                fillColor: '#ff0000',
                fillOpacity: 0.15,
                pointerEvents: 'none'
            }
        }).addTo(map.highlightLayer);

        // Zobrazíme storno tlačítko
        const clearBtn = document.getElementById('btn-katastr-clear-highlight');
        if (clearBtn) {
            clearBtn.style.display = 'inline-flex';
        }
    } else if (type === 'hover') {
        if (!map.hoverHighlightLayer) {
            map.hoverHighlightLayer = L.featureGroup().addTo(map);
        }
        map.hoverHighlightLayer.clearLayers();

        // Vykreslení geometrie: pokud je to bod, použijeme kruhový marker
        L.geoJSON(geojson, {
            onEachFeature: function(feature, layer) {
                // Pro hover úmyslně nevoláme addLengthLabels, aby rozměry při pohybu myši neskákaly
            },
            pointToLayer: function (geojsonPoint, latlngPoint) {
                return L.circleMarker(latlngPoint, {
                    radius: 12,
                    color: '#0055ff',
                    weight: 0,
                    opacity: 0,
                    fillColor: '#0055ff',
                    fillOpacity: 0.15,
                    pointerEvents: 'none'
                });
            },
            style: {
                color: '#0055ff',
                weight: 0,
                opacity: 0,
                fillColor: '#0055ff',
                fillOpacity: 0.15,
                pointerEvents: 'none'
            }
        }).addTo(map.hoverHighlightLayer);
    }
}

// Odkaz na probíhající dotazy na hover, abychom zamezili race conditions
let hoverAbortController = null;

/**
 * Dotaz na ArcGIS REST API ČÚZK pro získání plné geometrie
 */
function queryHighlightGeometry(latlng, clickOrHover) {
    const baseUrl = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer';
    const params = new URLSearchParams({
        geometry: `${latlng.lng},${latlng.lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        outSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*', // Změněno z OBJECTID na * i pro hover, abychom získali cisloparcely a cisladomovni
        returnGeometry: 'true',
        returnM: 'false',
        returnZ: 'false',
        returnTrueCurves: 'false',
        f: 'json'
    });

    if (clickOrHover === 'hover') {
        if (hoverAbortController) {
            hoverAbortController.abort();
        }
        hoverAbortController = new AbortController();
        const signal = hoverAbortController.signal;

        const req3 = fetch(`${baseUrl}/3/query?${params.toString()}`, { signal }).then(r => r.json()).catch(() => ({}));
        const req5 = fetch(`${baseUrl}/5/query?${params.toString()}`, { signal }).then(r => r.json()).catch(() => ({}));

        Promise.all([req3, req5])
            .then(([d3, d5]) => {
                let hoverText = "Neznámá parcela";
                if (d3.features && d3.features.length > 0) {
                    drawGeometry(d3.features[0], 'hover', latlng);
                    const attr = d3.features[0].attributes;
                    if (attr && attr.cisladomovni) {
                        hoverText = `Budova č.p. ${attr.cisladomovni}`;
                    } else {
                        hoverText = "Budova";
                    }
                } else if (d5.features && d5.features.length > 0) {
                    drawGeometry(d5.features[0], 'hover', latlng);
                    const attr = d5.features[0].attributes;
                    if (attr && attr.cisloparcely) {
                        const typText = (attr.druhcislovanikod == 1) ? "st." : "poz.";
                        hoverText = `č. ${attr.cisloparcely} (${typText})`;
                    } else {
                        hoverText = "Parcela";
                    }
                } else {
                    clearKatastrHoverHighlight();
                    hoverText = "Najetím vyberte parcelu";
                }
                const hoverEl = document.getElementById('hover-parcel-text');
                if (hoverEl) hoverEl.innerText = hoverText;
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error("Chyba při dotazování na hover geometrii:", err);
                }
            });
    } else {
        // U kliknutí zrušíme jakýkoliv probíhající hover dotaz
        if (hoverAbortController) {
            hoverAbortController.abort();
        }

        // Nejprve stavební objekty (vrstva 3)
        fetch(`${baseUrl}/3/query?${params.toString()}`)
            .then(r => r.json())
            .then(d => {
                if (d.features && d.features.length > 0) {
                    drawGeometry(d.features[0], 'click', latlng);
                } else {
                    // Zkusíme parcely (vrstva 5)
                    fetch(`${baseUrl}/5/query?${params.toString()}`)
                        .then(r2 => r2.json())
                        .then(d2 => {
                            if (d2.features && d2.features.length > 0) {
                                drawGeometry(d2.features[0], 'click', latlng);
                            }
                        })
                        .catch(err => console.error("Chyba při stahování geometrie parcely (5):", err));
                }
            })
            .catch(err => console.error("Chyba při stahování geometrie stavebního objektu (3):", err));
    }
}

// ── Událost pro kliknutí na mapu ──
if (typeof map !== 'undefined') {
    map.on('click', function (e) {
        if (typeof isMeasuring !== 'undefined' && isMeasuring) return;
        if (typeof _measureActive !== 'undefined' && _measureActive) return;
        if (map.pm && map.pm.globalDrawModeEnabled()) return;
        if (typeof streetViewActive !== 'undefined' && streetViewActive) return;
        if (window.viewshedAnalyzer && window.viewshedAnalyzer.active) return;

        // Ověříme, zda je zapnutá alespoň jedna dotazovací vrstva
        const activeTarget = getActiveQueryTarget();
        if (!activeTarget) return;

        // Ověříme, zda má uživatel skutečně zapnutou danou vrstvu (podle checkboxů)
        let hasLayer = false;
        if (activeTarget === 'kn') {
            const layerKn = document.getElementById('layer-kn');
            if (layerKn && layerKn.checked) hasLayer = true;
        } else if (activeTarget === 'dtm') {
            const layerDtm = document.getElementById('layer-dtm-ti');
            if (layerDtm && layerDtm.checked) hasLayer = true;
        } else if (activeTarget === 'dopravni-info') {
            const layerDopravniInfo = document.getElementById('dopravni-info');
            const layerDopravniKamery = document.getElementById('dopravni-kamery');
            if ((layerDopravniInfo && layerDopravniInfo.checked) || (layerDopravniKamery && layerDopravniKamery.checked)) hasLayer = true;
        }

        if (!hasLayer) return; // Nemá vrstvu, neděláme nic

        // Smažeme hover obrys při kliknutí
        clearKatastrHoverHighlight();

        // Aktivujeme a zobrazíme záložku Data v panelu
        const dataTabBtn = document.querySelector('.tab-btn[data-tab="data"]');
        if (dataTabBtn) {
            dataTabBtn.click();
        }

        const statusEl = document.getElementById('katastr-status');
        const loaderEl = document.getElementById('katastr-loader');
        const resultEl = document.getElementById('katastr-result');

        if (!statusEl || !loaderEl || !resultEl) return;
        
        // Ověříme, zda má uživatel zapnutou příslušnou vrstvu
        const layerKn = document.getElementById('layer-kn');
        const layerDtm = document.getElementById('layer-dtm-ti');
        
        if (activeTarget === 'kn' && (!layerKn || !layerKn.checked)) {
            statusEl.classList.remove('hidden');
            resultEl.classList.add('hidden');
            loaderEl.classList.add('hidden');
            statusEl.innerHTML = '<i class="ph ph-warning" style="color: #ff9800;"></i> Pro získání informací o parcelách si nejprve zapněte vrstvu "Hranice parcel (KN)" v záložce Vrstvy.';
            return;
        }
        if (activeTarget === 'dtm' && (!layerDtm || !layerDtm.checked)) {
            statusEl.classList.remove('hidden');
            resultEl.classList.add('hidden');
            loaderEl.classList.add('hidden');
            statusEl.innerHTML = '<i class="ph ph-warning" style="color: #ff9800;"></i> Pro získání informací o sítích si nejprve zapněte vrstvu "Technické sítě" v záložce Vrstvy.';
            return;
        }

        // Pokud je aktivním cílem DTM, zavoláme DTM vyhledávání
        if (activeTarget === 'dtm') {
            queryDtmGetFeatureInfo(e.latlng, 'click');
            return;
        }

        // Pokud je aktivním cílem Doprava, zavoláme Dopravní vyhledávání
        if (activeTarget === 'dopravni-info') {
            const layerDoprava = document.getElementById('dopravni-info');
            const layerKamery = document.getElementById('dopravni-kamery');
            
            const isDopravaChecked = layerDoprava && layerDoprava.checked;
            const isKameryChecked = layerKamery && layerKamery.checked;
            
            if (!isDopravaChecked && !isKameryChecked) {
                statusEl.classList.remove('hidden');
                resultEl.classList.add('hidden');
                loaderEl.classList.add('hidden');
                statusEl.innerHTML = '<i class="ph ph-warning" style="color: #ff9800;"></i> Pro získání dopravních dat si nejprve zapněte vrstvu "Dopravní info" nebo "Dopravní kamery" v záložce Vrstvy.';
                return;
            }
            queryDopravniInfoGetFeatureInfo(e.latlng, 'click');
            return;
        }

        // Jinak provádíme dotaz na Katastr (kn)
        statusEl.classList.add('hidden');
        if (loaderEl) {
            const spanText = loaderEl.querySelector('span');
            if (spanText) spanText.textContent = "Vyhledávám parcelu v KN...";
            loaderEl.classList.remove('hidden');
        }
        resultEl.classList.add('hidden');

        var size = map.getSize();
        var b = map.getBounds();
        var p = map.latLngToContainerPoint(e.latlng);

        var bbox = b.getSouthWest().lng + "," + b.getSouthWest().lat + "," + b.getNorthEast().lng + "," + b.getNorthEast().lat;

        var url = "https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer?" +
            "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo" +
            "&LAYERS=Parcela&QUERY_LAYERS=Parcela" +
            "&X=" + Math.round(p.x) + "&Y=" + Math.round(p.y) +
            "&WIDTH=" + size.x + "&HEIGHT=" + size.y +
            "&SRS=EPSG:4326&BBOX=" + bbox +
            "&INFO_FORMAT=text/html";

        fetch(url)
            .then(res => res.text())
            .then(html => {
                loaderEl.classList.add('hidden');

                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var rows = doc.querySelectorAll("tr");

                if (rows.length >= 2) {
                    var headers = Array.from(rows[0].querySelectorAll("th")).map(th => th.textContent.trim());
                    var values = Array.from(rows[1].querySelectorAll("td")).map(td => td.textContent.trim());

                    function getVal(name) {
                        var idx = headers.indexOf(name);
                        if (idx !== -1) return values[idx];
                        const normName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                        const foundIdx = headers.findIndex(h => h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normName);
                        return (foundIdx !== -1) ? values[foundIdx] : null;
                    }

                    var cisloFull = getVal("Číslo parcely");
                    var cislovani = getVal("Rozlišení druhu číslování parcely");

                    if (cisloFull && cisloFull !== "Null") {
                        var typText = (cislovani && cislovani.toLowerCase().includes("stavební")) ? "st." : "poz.";

                        var l = wgs84ToSjtsk(e.latlng.lat, e.latlng.lng);
                        var knLink = "https://nahlizenidokn.cuzk.cz/MapaIdentifikace.aspx?l=KN&x=" + parseInt(l.y) + "&y=" + parseInt(l.x);

                        document.getElementById('katastr-parcel-title').textContent = "Parcela: " + cisloFull + " (" + typText + ")";

                        // --- Nové UI pro parcely (vybraná parcela) ---
                        const selectedEl = document.getElementById('selected-parcel-text');
                        if (selectedEl) {
                            selectedEl.innerText = `č. ${cisloFull} (${typText})`;
                            selectedEl.classList.remove("text-muted");
                        }
                        const selectedHalf = document.querySelector('.parcel-selected-half');
                        if (selectedHalf) selectedHalf.classList.add('has-selection');
                        const selIcon = document.getElementById('parcel-selected-icon');
                        if (selIcon) selIcon.style.display = '';
                        const dimBtn = document.getElementById('toggle-dimensions-btn');
                        if (dimBtn) {
                            dimBtn.disabled = false;
                            const mapEl = document.getElementById('map');
                            if (mapEl && mapEl.classList.contains('show-parcel-dimensions')) {
                                dimBtn.classList.add("active");
                            } else {
                                dimBtn.classList.remove("active");
                            }
                        }
                        // ---------------------------------------------

                        const geomIconEl = document.getElementById('katastr-geom-icon');
                        if (geomIconEl) {
                            geomIconEl.className = 'ph ph-polygon';
                            geomIconEl.title = 'Typ geometrie: plocha (parcela)';
                        }

                        hideDtmSelector();

                        const aLink = document.getElementById('katastr-link');
                        if (aLink) {
                            aLink.href = knLink;
                            aLink.innerHTML = '<i class="ph ph-arrow-square-out"></i> Více informací v KN';
                        }

                        let htmlContent = "";
                        headers.forEach((header, index) => {
                            const value = values[index];
                            if (header && header !== "FID" && header !== "OBJECTID" && header !== "SHAPE") {
                                const label = getAttributeLabel(header);
                                const formattedValue = formatKatastrValue(header, value);
                                htmlContent += `<div style="font-size: 13px; line-height: 1.4; color: var(--text-dark);"><strong style="font-weight: 600;">${label}:</strong> ${formattedValue}</div>`;
                            }
                        });

                        const attrsContainer = document.getElementById('katastr-attrs-content');
                        if (attrsContainer) {
                            attrsContainer.innerHTML = htmlContent;
                        }

                        resultEl.classList.remove('hidden');

                        queryHighlightGeometry(e.latlng, 'click');
                    } else {
                        showNoParcelWarning(statusEl);
                        clearKatastrHighlight();
                    }
                } else {
                    showNoParcelWarning(statusEl);
                    clearKatastrHighlight();
                }
            })
            .catch(err => {
                console.error("Chyba při stahování dat o parcele:", err);
                loaderEl.classList.add('hidden');
                statusEl.classList.remove('hidden');
                statusEl.innerHTML = '<i class="ph ph-x-circle"></i> Nepodařilo se získat informace o parcele.';
                clearKatastrHighlight();
            });
    });

    // Pomocná funkce pro zjištění, zda je bod uvnitř polygonu (ray-casting)
    function isPointInPolygon(latlng, polygon) {
        const lat = latlng.lat;
        const lng = latlng.lng;

        let coords = polygon.getLatLngs();
        if (!coords || coords.length === 0) return false;

        const rings = Array.isArray(coords[0]) ? coords : [coords];

        for (let r = 0; r < rings.length; r++) {
            const ring = rings[r];
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = ring[i].lng, yi = ring[i].lat;
                const xj = ring[j].lng, yj = ring[j].lat;

                const intersect = ((yi > lat) !== (yj > lat))
                    && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            if (inside) return true;
        }
        return false;
    }

    // Pomocná funkce pro zjištění, zda je bod uvnitř již načtených hover polygonů
    function isPointInHoveredLayers(latlng) {
        if (typeof map === 'undefined' || !map.hoverHighlightLayer) return false;
        let found = false;
        map.hoverHighlightLayer.eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                if (isPointInPolygon(latlng, layer)) {
                    found = true;
                }
            } else if (layer.eachLayer) {
                layer.eachLayer(subLayer => {
                    if (subLayer instanceof L.Polygon) {
                        if (isPointInPolygon(latlng, subLayer)) {
                            found = true;
                        }
                    }
                });
            }
        });
        return found;
    }

    // ── Událost pro najetí myší (hover) na mapu ──
    let hoverDebounceTimer = null;
    let lastHoverLatLng = null;

    map.on('mousemove', function (e) {
        // Pokud probíhá měření nebo kreslení, hover ignorujeme a smažeme případné zvýraznění
        if (typeof isMeasuring !== 'undefined' && isMeasuring) {
            clearKatastrHoverHighlight();
            return;
        }
        if (typeof _measureActive !== 'undefined' && _measureActive) {
            clearKatastrHoverHighlight();
            return;
        }
        if (map.pm && map.pm.globalDrawModeEnabled()) {
            clearKatastrHoverHighlight();
            return;
        }

        // Ověříme, zda je zapnutý nějaký cíl dotazování
        const activeTarget = getActiveQueryTarget();
        
        // Hover pro KN: ověříme, zda je zapnuta vrstva KN
        if (activeTarget === 'kn') {
            const layerKnEl = document.getElementById('layer-kn');
            if (!layerKnEl || !layerKnEl.checked) {
                clearKatastrHoverHighlight();
                return;
            }
        } else if (!activeTarget || activeTarget === 'dtm') {
            clearKatastrHoverHighlight();
            return;
        }

        const latlng = e.latlng;

        // Pokud je myš stále uvnitř stávající zvýrazněné hover geometrie, nic neděláme a ušetříme dotaz
        if (isPointInHoveredLayers(latlng)) {
            return;
        }

        // Pokud se myš posunula mimo parcelu/objekt, ihned zhasneme minulé zvýraznění pro vizuální plynulost
        clearKatastrHoverHighlight();

        // Pokud se souřadnice nezměnily, nebudeme znova dotazovat
        if (lastHoverLatLng && lastHoverLatLng.lat === latlng.lat && lastHoverLatLng.lng === latlng.lng) {
            return;
        }

        clearTimeout(hoverDebounceTimer);

        hoverDebounceTimer = setTimeout(() => {
            lastHoverLatLng = latlng;
            if (activeTarget === 'kn') {
                // Hover pouze při zapnuté vrstvě KN
                const layerKnEl = document.getElementById('layer-kn');
                if (!layerKnEl || !layerKnEl.checked) {
                    clearKatastrHoverHighlight();
                    return;
                }
                queryHighlightGeometry(latlng, 'hover');
            }
            // DTM hover je deaktivován (zpomaluje mapu)
        }, 10);
    });

    // Vymazání při opuštění mapy
    map.on('mouseout', function () {
        clearTimeout(hoverDebounceTimer);
        clearKatastrHoverHighlight();
    });
}

/**
 * Dotazování na Technické sítě (DTM)
 */
function queryDtmGetFeatureInfo(latlng, clickOrHover) {
    const statusEl = document.getElementById('katastr-status');
    const loaderEl = document.getElementById('katastr-loader');
    const resultEl = document.getElementById('katastr-result');
    const attrsContainer = document.getElementById('katastr-attrs-content');

    if (clickOrHover === 'click') {
        if (statusEl) statusEl.classList.add('hidden');
        if (loaderEl) {
            const spanText = loaderEl.querySelector('span');
            if (spanText) spanText.textContent = "Vyhledávám objekt technické sítě...";
            loaderEl.classList.remove('hidden');
        }
        if (resultEl) resultEl.classList.add('hidden');
        clearKatastrHighlight();
    }

    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const p = map.latLngToContainerPoint(latlng);

    // Pro WMS 1.3.0 a EPSG:4326 je pořadí os BBOX: minLat,minLng,maxLat,maxLng
    const bbox = sw.lat + "," + sw.lng + "," + ne.lat + "," + ne.lng;

    // Dotaz WMS 1.3.0 s formátem application/json (podporováno ČÚZK DMVS pro GeoJSON výstup)
    const url = "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?" +
        "SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo" +
        "&LAYERS=dtm_ti_ver&QUERY_LAYERS=dtm_ti_ver" +
        "&STYLES=" +
        "&I=" + Math.round(p.x) + "&J=" + Math.round(p.y) +
        "&WIDTH=" + size.x + "&HEIGHT=" + size.y +
        "&CRS=EPSG:4326&BBOX=" + bbox +
        "&INFO_FORMAT=application/json" +
        "&FEATURE_COUNT=25&BUFFER=10&TOLERANCE=10";

    if (clickOrHover === 'hover') {
        if (hoverAbortController) {
            hoverAbortController.abort();
        }
        hoverAbortController = new AbortController();
        const signal = hoverAbortController.signal;

        fetch(url, { signal })
            .then(res => {
                if (!res.ok) throw new Error("HTTP error");
                return res.json();
            })
            .then(geojson => {
                // DTM hover highlight je deaktivován
                clearKatastrHoverHighlight();
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error("Chyba při dotazování na Technické sítě (hover):", err);
                    clearKatastrHoverHighlight();
                }
            });
    } else {
        if (hoverAbortController) {
            hoverAbortController.abort();
        }

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("HTTP error");
                return res.json();
            })
            .then(geojson => {
                if (loaderEl) loaderEl.classList.add('hidden');

                if (geojson && geojson.features && geojson.features.length > 0) {
                    const features = geojson.features;

                    if (resultEl) resultEl.classList.remove('hidden');

                    if (features.length === 1) {
                        // Jediný prvek – rovnou zobrazíme
                        hideDtmSelector();
                        renderDtmFeature(features[0], undefined, latlng);
                    } else {
                        // Více prvků – zobrazíme selektor
                        showDtmSelector(features, latlng);
                        // Automaticky předvybereme první
                        renderDtmFeature(features[0], 0, latlng);
                    }
                } else {
                    showNoDtmFeatureWarning(statusEl);
                    clearDtmHighlight();
                }
            })
            .catch(err => {
                console.error("Chyba při stahování dat o technické síti:", err);
                if (loaderEl) loaderEl.classList.add('hidden');
                if (statusEl) {
                    statusEl.classList.remove('hidden');
                    statusEl.innerHTML = '<i class="ph ph-x-circle"></i> Nepodařilo se získat informace o technické síti.';
                }
                clearKatastrHighlight();
            });
    }
}

/**
 * Určí ikonu geometrie podle názvu typu objektu z DTM
 */
function getDtmGeomIcon(typNazev, codeBase) {
    if (!typNazev) return { icon: 'ph-minus', label: 'objekt' };
    const t = typNazev.toLowerCase();
    // Polygon / plocha / prostor / pásmo ochranné
    if (t.includes('prostor') || t.includes('pásmo') || t.includes('plocha') || t.includes('ochranné')) {
        return { icon: 'ph-polygon', label: 'plocha' };
    }
    // Linie / trasa / vedení / potrubí / kabel
    if (t.includes('trasa') || t.includes('vedení') || t.includes('potrubí') || t.includes('kabel') ||
        t.includes('vodovodní řad') || t.includes('kanalizační stoka') || t.includes('linie') ||
        t.includes('vedení') || t.includes('přípojka')) {
        return { icon: 'ph-line-segment', label: 'linie' };
    }
    // Bod / šachta / přípojný bod / pilíř / sloup
    if (t.includes('šachta') || t.includes('pilíř') || t.includes('sloup') || t.includes('bod') ||
        t.includes('uzávěr') || t.includes('armatura') || t.includes('hydrant') || t.includes('přípojný')) {
        return { icon: 'ph-map-pin', label: 'bod' };
    }
    // Fallback – linie (nejčastější u TI)
    return { icon: 'ph-line-segment', label: 'linie' };
}

// Uložení latlng pro selektor (potřebujeme ho v click handleru tlačítek)
let selectorLatlng = null;

/**
 * Zobrazí selektor pro výběr z více DTM prvků
 */
function showDtmSelector(features, latlng) {
    selectorLatlng = latlng || null;
    const selectorEl = document.getElementById('katastr-dtm-selector');
    const listEl = document.getElementById('katastr-dtm-selector-list');
    if (!selectorEl || !listEl) return;

    listEl.innerHTML = '';
    features.forEach((f, idx) => {
        const typ = f.properties.objektovytypnazev || 'Objekt TI';
        const vlastnik = f.properties.nazevvlastnika ? ` · ${f.properties.nazevvlastnika}` : '';
        const { icon, label } = getDtmGeomIcon(typ, f.properties.code_base);

        // Barvy podle typu geometrie (odpověď na požadavek uživatele)
        let activeBg, activeColor, activeOutline;
        if (label === 'plocha') {
            activeBg = '#e1f5fe'; activeColor = '#0277bd'; activeOutline = '#0288d1'; // modrá
        } else if (label === 'linie') {
            activeBg = '#e8f5e9'; activeColor = '#2e7d32'; activeOutline = '#43a047'; // zelená
        } else {
            activeBg = '#fff8e1'; activeColor = '#ff8f00'; activeOutline = '#ffb300'; // žlutá/oranžová
        }

        const btn = document.createElement('button');
        btn.id = `dtm-selector-item-${idx}`;
        // Všechny prvky mají rovnou své specifické barvy
        btn.style.cssText = `
            display: flex; align-items: center; gap: 7px; width: 100%;
            text-align: left; padding: 6px 9px; border-radius: 7px; border: none;
            background: ${activeBg}; cursor: pointer; font-size: 12px;
            color: ${activeColor}; transition: all 0.15s; font-family: inherit;
            opacity: 0.65;
        `;

        btn.dataset.activeOutline = activeOutline;

        btn.innerHTML = `
            <i class="ph ${icon} geom-icon" style="font-size:13px; color:${activeColor}; flex-shrink:0;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <strong style="font-weight:600;">${typ}</strong>${vlastnik}
            </span>
        `;

        function setActive() {
            // Zrušit výběr na všech tlačítkách
            listEl.querySelectorAll('button').forEach(b => {
                b.style.outline = 'none';
                b.style.opacity = '0.65';
                b.style.boxShadow = 'none';
            });
            // Zvýraznit vybrané
            btn.style.outline = `1.5px solid ${btn.dataset.activeOutline}`;
            btn.style.opacity = '1';
            btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
        }

        btn.addEventListener('click', () => {
            setActive();
            renderDtmFeature(f, idx, selectorLatlng);
        });

        // Výchozí stav prvního (předvybraného)
        if (idx === 0) {
            setActive();
        }

        listEl.appendChild(btn);
    });

    selectorEl.style.display = 'block';
}

/**
 * Skryje selektor DTM prvků
 */
function hideDtmSelector() {
    const selectorEl = document.getElementById('katastr-dtm-selector');
    if (selectorEl) selectorEl.style.display = 'none';
}

/**
 * Vykreslí atributy jednoho DTM prvku do panelu a zvýrazní geometrii na mapě
 * @param {Object} feature - GeoJSON feature
 * @param {number|undefined} idx - index v selektoru (nepovinný)
 * @param {Object|undefined} latlng - Leaflet LatLng (pro fallback bod)
 */
function renderDtmFeature(feature, idx, latlng) {
    const attrsContainer = document.getElementById('katastr-attrs-content');
    const titleEl = document.getElementById('katastr-parcel-title');
    const geomIconEl = document.getElementById('katastr-geom-icon');
    const aLink = document.getElementById('katastr-link');

    const typ = feature.properties.objektovytypnazev || 'Objekt technické sítě';
    const { icon, label } = getDtmGeomIcon(typ, feature.properties.code_base);

    // Nadpis s typem
    if (titleEl) titleEl.textContent = typ;

    // Ikona geometrie v nadpisu
    if (geomIconEl) {
        geomIconEl.className = `ph ${icon}`;
        geomIconEl.title = `Typ geometrie: ${label}`;
    }

    // Odkaz na portál DMVS
    if (aLink) {
        aLink.href = 'https://dmvs.cuzk.gov.cz/';
        aLink.innerHTML = '<i class="ph ph-arrow-square-out"></i> Portál DMVS';
    }

    // Výpis atributů
    let htmlContent = '';
    for (const [key, value] of Object.entries(feature.properties)) {
        if (key && value !== null && value !== undefined && value !== 'Null' &&
            String(value).trim() !== '' && key !== 'bbox') {
            const lbl = getAttributeLabel(key);
            htmlContent += `<div style="font-size: 13px; line-height: 1.4; color: var(--text-dark);">` +
                `<strong style="font-weight: 600;">${lbl}:</strong> ${value}</div>`;
        }
    }

    if (attrsContainer) attrsContainer.innerHTML = htmlContent;

    // Zvýraznění geometrie na mapě
    drawDtmGeometry(feature, latlng || selectorLatlng);
}

/**
 * Získání aktivního cíle dotazování
 */
function getActiveQueryTarget() {
    const selected = document.querySelector('input[name="data-query-target"]:checked');
    return selected ? selected.value : 'kn';
}

// ── Inicializační funkce ──
function initKatastrAndDtmQuery() {
    bindClearButton();

    // Také reagujeme na kliknutí na samotné přepínací radio knoflíky
    document.querySelectorAll('input[name="data-query-target"]').forEach(radio => {
        radio.addEventListener('change', () => {
            clearKatastrHighlight();
            clearKatastrHoverHighlight();
            clearDtmHighlight();

            const target = getActiveQueryTarget();
            
            // Vrátíme záložku do základního status stavu
            const statusEl = document.getElementById('katastr-status');
            const resultEl = document.getElementById('katastr-result');
            const loaderEl = document.getElementById('katastr-loader');
            if (statusEl && resultEl && loaderEl) {
                statusEl.classList.remove('hidden');
                resultEl.classList.add('hidden');
                loaderEl.classList.add('hidden');

                if (target === 'kn') {
                    statusEl.innerHTML = '<i class="ph ph-info"></i> Pro zobrazení informací klikněte na parcelu v mapě.';
                } else if (target === 'dtm') {
                    statusEl.innerHTML = '<i class="ph ph-info"></i> Pro zobrazení informací klikněte na prvek sítě v mapě.';
                }
            }
        });
    });
}

// ── Bind storno tlačítka ──
function bindClearButton() {
    const clearBtn = document.getElementById('btn-katastr-clear-highlight');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearKatastrHighlight();
            clearDtmHighlight();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKatastrAndDtmQuery);
} else {
    initKatastrAndDtmQuery();
}

// ESC klávesa pro vymazání zvýraznění
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
        clearKatastrHighlight();
        clearDtmHighlight();
    }
});


/**
 * Dotazování na Dopravní info
 */
function queryDopravniInfoGetFeatureInfo(latlng, clickOrHover) {
    const statusEl = document.getElementById('katastr-status');
    const loaderEl = document.getElementById('katastr-loader');
    const resultEl = document.getElementById('katastr-result');
    const attrsContainer = document.getElementById('katastr-attrs-content');

    if (clickOrHover === 'click') {
        if (statusEl) statusEl.classList.add('hidden');
        if (loaderEl) {
            const spanText = loaderEl.querySelector('span');
            if (spanText) spanText.textContent = "Vyhledávám dopravní data...";
            loaderEl.classList.remove('hidden');
        }
        if (resultEl) resultEl.classList.add('hidden');
        clearKatastrHighlight();
    }

    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const p = map.latLngToContainerPoint(latlng);
    const bbox = sw.lng + "," + sw.lat + "," + ne.lng + "," + ne.lat;
    
    // WMS očekává pořadí lat,lng pro 1.3.0
    const bboxWms = sw.lat + "," + sw.lng + "," + ne.lat + "," + ne.lng;

    const layerDoprava = document.getElementById('dopravni-info');
    const layerKamery = document.getElementById('dopravni-kamery');
    
    let promises = [];

    // 1. NDIC WMS Dopravní info
    if (layerDoprava && layerDoprava.checked) {
        const urlWms = "https://www.edpp.cz/geoserver/wms?" +
            "SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo" +
            "&LAYERS=ndic:ndic_dopravni_info&QUERY_LAYERS=ndic:ndic_dopravni_info" +
            "&STYLES=" +
            "&I=" + Math.round(p.x) + "&J=" + Math.round(p.y) +
            "&WIDTH=" + size.x + "&HEIGHT=" + size.y +
            "&CRS=EPSG:4326&BBOX=" + bboxWms +
            "&INFO_FORMAT=application/json" +
            "&FEATURE_COUNT=25&BUFFER=10";
            
        promises.push(
            fetch(urlWms).then(res => res.json()).then(geojson => {
                return (geojson && geojson.features) ? geojson.features : [];
            }).catch(e => { console.error(e); return []; })
        );
    }

    // 2. Kamery Esri MapServer Identify
    if (layerKamery && layerKamery.checked) {
        const urlKamery = "https://datsklad.izscr.cz/mapservices/rest/services/live_sluzby/kamery_silnicni/MapServer/identify?" +
            "f=json&geometryType=esriGeometryPoint&geometry=" + latlng.lng + "," + latlng.lat +
            "&tolerance=10&mapExtent=" + bbox +
            "&imageDisplay=" + size.x + "," + size.y + ",96&returnGeometry=true&sr=4326";
            
        promises.push(
            fetch(urlKamery).then(res => res.json()).then(data => {
                if (!data || !data.results) return [];
                return data.results.map(r => ({
                    type: "Feature",
                    properties: Object.assign({ _source: 'kamery' }, r.attributes),
                    geometry: {
                        type: "Point",
                        coordinates: [r.geometry.x, r.geometry.y]
                    }
                }));
            }).catch(e => { console.error(e); return []; })
        );
    }

    Promise.all(promises).then(results => {
        if (loaderEl) loaderEl.classList.add('hidden');
        
        let features = [];
        results.forEach(resArray => {
            features = features.concat(resArray);
        });

        if (features.length > 0) {
            if (resultEl) resultEl.classList.remove('hidden');

            if (features.length === 1) {
                hideDtmSelector();
                renderDopravniFeature(features[0]);
            } else {
                showDopravaSelector(features);
                renderDopravniFeature(features[0], 0);
            }
        } else {
            if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.innerHTML = '<i class="ph ph-info"></i> V tomto místě nebyla nalezena žádná dopravní data.';
            }
            clearKatastrHighlight();
        }
    });
}

function showDopravaSelector(features) {
    const selectorEl = document.getElementById('katastr-dtm-selector');
    const listEl = document.getElementById('katastr-dtm-selector-list');
    if (!selectorEl || !listEl) return;

    listEl.innerHTML = '';
    features.forEach((f, idx) => {
        const typ = f.properties.txevc || f.properties.situation_record_type || (f.properties.misto ? 'Kamera: ' + f.properties.misto : 'Dopravní událost');
        
        let activeBg = '#ffebee', activeColor = '#c62828', activeOutline = '#d32f2f'; // červená jako default
        
        const btn = document.createElement('button');
        btn.id = `dtm-selector-item-${idx}`;
        btn.style.cssText = `
            display: flex; align-items: center; gap: 7px; width: 100%;
            text-align: left; padding: 6px 9px; border-radius: 7px; border: none;
            background: ${activeBg}; cursor: pointer; font-size: 12px;
            color: ${activeColor}; transition: all 0.15s; font-family: inherit;
            opacity: 0.65;
        `;
        btn.dataset.activeOutline = activeOutline;

        btn.innerHTML = `
            <i class="ph ph-traffic-sign geom-icon" style="font-size:13px; color:${activeColor}; flex-shrink:0;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <strong style="font-weight:600;">${typ}</strong>
            </span>
        `;

        function setActive() {
            listEl.querySelectorAll('button').forEach(b => {
                b.style.outline = 'none';
                b.style.opacity = '0.65';
                b.style.boxShadow = 'none';
            });
            btn.style.outline = `1.5px solid ${btn.dataset.activeOutline}`;
            btn.style.opacity = '1';
            btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
        }

        btn.addEventListener('click', () => {
            setActive();
            renderDopravniFeature(f, idx);
        });

        if (idx === 0) setActive();
        listEl.appendChild(btn);
    });

    selectorEl.style.display = 'block';
}

function renderDopravniFeature(feature, idx) {
    const attrsContainer = document.getElementById('katastr-attrs-content');
    const titleEl = document.getElementById('katastr-parcel-title');
    const geomIconEl = document.getElementById('katastr-geom-icon');
    const aLink = document.getElementById('katastr-link');

    const isKamera = !!feature.properties.misto;
    const typ = feature.properties.txevc || feature.properties.situation_record_type || (isKamera ? 'Kamera: ' + feature.properties.misto : 'Dopravní událost');

    if (titleEl) titleEl.textContent = typ;
    if (geomIconEl) {
        geomIconEl.className = isKamera ? 'ph ph-video-camera' : 'ph ph-traffic-sign';
        geomIconEl.title = isKamera ? 'Typ: Dopravní kamera' : 'Typ: Dopravní informace';
    }

    if (aLink) {
        aLink.href = 'https://dopravniinfo.cz/';
        aLink.innerHTML = '<i class="ph ph-arrow-square-out"></i> Portál Dopravní Info';
    }

    let htmlContent = '';
    const ignoreList = ['bbox', 'geom', 'geometry', 'id', 'situation_record_type', '_source', 'shape', 'objectid'];
    
    // Nejprve projdeme běžné vlastnosti
    for (const [key, value] of Object.entries(feature.properties)) {
        if (!ignoreList.includes(key.toLowerCase()) && value !== null && value !== undefined && value !== 'Null' && String(value).trim() !== '') {
            if (key === 'link' && String(value).includes('CameraImage')) {
                // Kamera se vykreslí nakonec
                continue;
            }
            htmlContent += `<div style="font-size: 13px; line-height: 1.4; color: var(--text-dark);">` +
                `<strong style="font-weight: 600;">${getAttributeLabel(key)}:</strong> ${value}</div>`;
        }
    }
    
    // Obrázek kamery přidat na konec (pokud existuje)
    if (feature.properties.link && feature.properties.link.includes('CameraImage')) {
         let imgUrl = feature.properties.link.replace('dopravniinfo.cz', 'dopravniinfo.gov.cz').trim();
         const imgId = 'camera-img-' + Math.floor(Math.random() * 1000000);
         
         htmlContent += `<div style="margin-top: 12px; text-align: center; position: relative; min-height: 120px; background: #f5f5f5; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <div id="${imgId}-loader" style="position: absolute; z-index: 1;"><i class="ph ph-spinner ph-spin" style="font-size: 24px; color: #888;"></i></div>
            <img id="${imgId}" src="${imgUrl}" referrerpolicy="no-referrer" style="max-width:100%; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05); opacity: 0; transition: opacity 0.3s; position: relative; z-index: 2;" alt="Záběr z dopravní kamery" onload="this.style.opacity='1'; document.getElementById('${imgId}-loader').style.display='none'; this.parentElement.style.background='transparent'; this.parentElement.style.minHeight='auto';" onerror="this.style.opacity='0'; document.getElementById('${imgId}-loader').style.display='block'; document.getElementById('${imgId}-loader').innerHTML='<i class=\\\'ph ph-warning\\\' style=\\\'color: #ff9800;\\\'></i> Záběr není k dispozici';" />
            
            <button onclick="const img = document.getElementById('${imgId}'); const ldr = document.getElementById('${imgId}-loader'); img.style.opacity = '0'; ldr.style.display = 'block'; ldr.innerHTML = '<i class=\\'ph ph-spinner ph-spin\\' style=\\'font-size: 24px; color: #888;\\'></i>'; img.src = '${imgUrl}&t=' + new Date().getTime();" style="position: absolute; top: 6px; right: 6px; z-index: 3; background: rgba(255,255,255,0.85); border: none; border-radius: 4px; padding: 4px 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #333; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,1)'" onmouseout="this.style.background='rgba(255,255,255,0.85)'" title="Stáhnout nejnovější snímek">
                <i class="ph-bold ph-arrows-clockwise" style="font-size: 13px;"></i> Obnovit
            </button>
         </div>`;
    }

    if (attrsContainer) attrsContainer.innerHTML = htmlContent;

    // Vykreslit geometrii pro zvýraznění
    clearKatastrHighlight();
    if (feature.geometry) {
        let style = { color: '#ff0000', weight: 6, opacity: 0.8 };
        if (!map.highlightLayer) {
            map.highlightLayer = L.featureGroup().addTo(map);
        }
        if (feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint') {
            L.geoJSON(feature, {
                pointToLayer: function (geoJsonPoint, latlng) {
                    return L.circleMarker(latlng, { radius: 8, fillColor: '#ff0000', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8 });
                }
            }).addTo(map.highlightLayer);
        } else {
            L.geoJSON(feature, { style: style }).addTo(map.highlightLayer);
        }
        
        // Zobrazíme storno tlačítko
        const clearBtn = document.getElementById('btn-katastr-clear-highlight');
        if (clearBtn) clearBtn.style.display = 'flex';
    }
}


// ── Inicializace UI událostí pro Katastr panel ──
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tlačítko pro přepínání zobrazení rozměrů (kóty)
    const toggleDimBtn = document.getElementById('toggle-dimensions-btn');
    const mapEl = document.getElementById('map');
    if (toggleDimBtn && mapEl) {
        toggleDimBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isEnabled = mapEl.classList.toggle('show-parcel-dimensions');
            if (isEnabled) {
                toggleDimBtn.classList.add('active');
            } else {
                toggleDimBtn.classList.remove('active');
            }
        });
    }

    // 2. Skrývání/zobrazování celého pilulkového panelu v závislosti na vrstvě KN
    const parcelPanel = document.getElementById('parcel-info-panel');
    if (parcelPanel) L.DomEvent.disableClickPropagation(parcelPanel);
    const layerKnEl = document.getElementById('layer-kn');

    function updateParcelPanelVisibility() {
        if (!parcelPanel || !layerKnEl) return;
        
        // Zjistíme, zda je zapnutý Katastr (přes checkbox a přepínač)
        const isKnLayerChecked = layerKnEl.checked;
        const activeTarget = typeof getActiveQueryTarget === 'function' ? getActiveQueryTarget() : null;
        
        if (isKnLayerChecked && activeTarget === 'kn') {
            parcelPanel.classList.remove('hidden');
        } else {
            parcelPanel.classList.add('hidden');
        }
    }

    // Posloucháme změny checkboxu vrstvy
    if (layerKnEl) {
        layerKnEl.addEventListener('change', updateParcelPanelVisibility);
    }
    // Posloucháme změny radio buttonů pro dotazování
    const queryRadios = document.querySelectorAll('input[name="data-query-target"]');
    queryRadios.forEach(radio => {
        radio.addEventListener('change', updateParcelPanelVisibility);
    });

    // Počáteční nastavení
    setTimeout(updateParcelPanelVisibility, 100); // Mírné zpoždění pro načtení vrstev z localStorage
});
