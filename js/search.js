// ============================================================
// search.js – Vyhledávání v RUIAN a našeptávač
// ============================================================

const RUIAN_BASE_URL = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE';
const RUIAN_MAP_URL  = 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer';
let _searchDebounceTimer = null;

const RUIAN_ATTR_LABELS = {
    'nazev': 'Název', 'obec_nazev': 'Obec', 'cast_obce_nazev': 'Část obce',
    'ulice_nazev': 'Ulice', 'psc': 'PSČ', 'kod': 'Kód RUIAN',
    'cislo_domovni': 'Číslo domovní', 'cislo_orientacni': 'Číslo orientační',
    'cislo_orientacni_pismeno': 'Písmeno orientační', 'cisloparcely': 'Číslo parcely',
    'vymeraparcely': 'Výměra (m²)', 'katastralni_uzemi_kod': 'K.Ú. kód',
    'druh_pozemku_kod': 'Druh pozemku', 'Type': 'Typ objektu', 'Municipality': 'Obec',
    'Subregion': 'Okres', 'Region': 'Kraj', 'Street': 'Ulice', 'HouseNumber': 'Číslo domovní',
    'ZipCode': 'PSČ', 'ParcelNumber': 'Číslo parcely', 'StAddr': 'Adresa', 'City': 'Město',
    'plati_od': 'Platnost od', 'plati_do': 'Platnost do'
};

const RUIAN_VALUE_TRANSLATIONS = {
    'ZakladniSidelniJednotka': 'Základní sídelní jednotka',
    'AdresniMisto':            'Adresní místo',
    'Parcela':                 'Parcela',
    'Ulice':                   'Ulice',
    'Obec':                    'Obec',
    'CastObce':                'Část obce'
};

function shouldShowRuianAttr(key) {
    const technicalKeys = ['SCORE', 'X', 'Y', 'FID', 'OBJECTID', 'SHAPE', 'ID', 'FEATUREID', 'MAGICKEY', 'GLOBALNIID', 'IDTRANSAKCE', 'ID_TRANSAKCE'];
    if (technicalKeys.some(tk => key.toUpperCase().includes(tk))) return false;
    if (key.length > 15 && key === key.toUpperCase()) return false;
    return true;
}

function formatRuianValue(key, val) {
    if (!val) return '—';
    if ((key.toLowerCase().includes('plati_') || key.toLowerCase().includes('datum')) && typeof val === 'number' && val > 1000000000000) {
        return new Date(val).toLocaleDateString('cs-CZ');
    }
    return RUIAN_VALUE_TRANSLATIONS[val] || val;
}

async function searchRuian(query) {
    if (!query || query.length < 2) return;

    const loader = document.getElementById('ruian-search-loader');
    const resultsContainer = document.getElementById('ruian-search-results');
    const detailContainer  = document.getElementById('ruian-detail');
    const suggestionsContainer = document.getElementById('ruian-suggestions');

    loader.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('hidden');
    detailContainer.classList.add('hidden');
    suggestionsContainer.classList.add('hidden');

    try {
        // Změna na endpoint "suggest", protože findAddressCandidates nevrací magicKey,
        // který je nezbytný pro získání plné geometrie (polygon/linie) z MapServeru.
        const params = new URLSearchParams({ text: query, maxSuggestions: '15', f: 'json' });
        const response = await fetch(`${RUIAN_BASE_URL}/suggest?${params.toString()}`);
        const data = await response.json();

        loader.classList.add('hidden');
        if (data.suggestions && data.suggestions.length > 0) {
            displaySearchResults(data.suggestions);
        } else {
            resultsContainer.innerHTML = '<div class="search-results-empty">Nebyly nalezeny žádné výsledky.</div>';
        }
    } catch (error) {
        console.error('Chyba při vyhledávání v RUIAN:', error);
        loader.classList.add('hidden');
        resultsContainer.innerHTML = '<div class="search-results-empty">Chyba při vyhledávání. Zkuste to znovu.</div>';
    }
}

let _currentSuggestQuery = '';
async function suggestRuian(text) {
    if (!text || text.length < 3) {
        document.getElementById('ruian-suggestions').classList.add('hidden');
        return;
    }
    _currentSuggestQuery = text;
    try {
        const params = new URLSearchParams({ text: text, maxSuggestions: '5', f: 'json' });
        const response = await fetch(`${RUIAN_BASE_URL}/suggest?${params.toString()}`);
        const data = await response.json();

        // Ignorovat opožděné odpovědi z předchozích dotazů
        if (_currentSuggestQuery !== text) return;

        const container = document.getElementById('ruian-suggestions');
        if (data.suggestions && data.suggestions.length > 0) {
            container.innerHTML = '';
            data.suggestions.forEach(s => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = s.text;
                div.onclick = () => {
                    clearTimeout(_searchDebounceTimer);
                    _currentSuggestQuery = ''; // Zabránit otevření zpožděným výsledkem
                    document.getElementById('ruian-search-input').value = s.text;
                    container.classList.add('hidden');
                    if (s.magicKey) fetchFullRuianGeometry(s.magicKey, s.text);
                    else            searchRuian(s.text);
                };
                container.appendChild(div);
            });
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    } catch (e) {
        console.error('Chyba našeptávače:', e);
    }
}

async function fetchFullRuianGeometry(magicKey, addressLabel) {
    const parts = magicKey.split('_');
    if (parts.length < 2) { searchRuian(addressLabel); return; }

    const layerId  = parts[0];
    const objectId = parts[1];

    try {
        const url = `${RUIAN_MAP_URL}/${layerId}/query?objectIds=${objectId}&outSR=4326&returnGeometry=true&outFields=*&f=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            feature.address = addressLabel;
            feature.attributes.Type = (layerId == 1) ? 'Adresní místo' : (layerId == 4) ? 'Ulice' : (layerId == 5) ? 'Parcela' : 'Objekt';
            zoomToRuianResult(feature);
        } else {
            searchRuian(addressLabel);
        }
    } catch (e) {
        console.error('Chyba při stahování plné geometrie:', e);
        searchRuian(addressLabel);
    }
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('ruian-search-results');
    resultsContainer.innerHTML = '';

    results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-item';

        let iconClass = 'ph-map-pin';
        // Podpora jak pro suggest (res.type), tak fallback pro findAddressCandidates
        let typeLabel = res.type || (res.attributes && res.attributes.Type) || 'Výsledek';
        let address = res.text || res.address || 'Neznámá adresa';
        const typeStr = typeLabel.toLowerCase();

        if (typeStr.includes('adre') || typeStr.includes('house') || typeStr.includes('point')) iconClass = 'ph-house';
        else if (typeStr.includes('ulic') || typeStr.includes('street'))                        iconClass = 'ph-road-horizon';
        else if (typeStr.includes('parc'))                                                      iconClass = 'ph-square-half';

        item.innerHTML = `
            <div class="search-item-icon"><i class="ph ${iconClass}"></i></div>
            <div class="search-item-info">
                <div class="search-item-title">${address}</div>
                <div class="search-item-subtitle">${typeLabel}</div>
            </div>
        `;
        item.onclick = () => {
            if (res.magicKey) fetchFullRuianGeometry(res.magicKey, address);
            else if (res.location) zoomToRuianResult(res); // Fallback na bod
        };
        resultsContainer.appendChild(item);
    });
}

function zoomToRuianResult(res) {
    if (window._searchMarker) map.removeLayer(window._searchMarker);

    let lat, lng, zoom = 17; // Lepší kontext pro body (než 19)
    let targetBounds = null;
    const geometry = res.geometry || res.location;

    if (!geometry) { showToast('Poloha objektu nebyla nalezena.'); return; }

    const customIcon = L.divIcon({
        className: 'custom-search-marker',
        html: '<div class="marker-pin"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });

    if (geometry.x && geometry.y) {
        lat = geometry.y; lng = geometry.x;
        window._searchMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        zoom = 17;
        
        window._searchMarker.bindTooltip(res.address || res.attributes?.nazev || 'Hledaný bod', { 
            permanent: true, direction: 'top', className: 'ruian-label', offset: [0, -15] 
        }).openTooltip();

    } else if (geometry.rings) {
        const coords = geometry.rings.map(ring => ring.map(c => [c[1], c[0]]));
        window._searchMarker = L.polygon(coords, { className: 'ruian-search-polygon', color: 'rgb(54, 140, 84)', weight: 3, fillColor: 'rgb(54, 140, 84)', fillOpacity: 0.15 }).addTo(map);
        targetBounds = window._searchMarker.getBounds();
        lat = targetBounds.getCenter().lat; lng = targetBounds.getCenter().lng;
        
        window._searchMarker.bindTooltip(res.address || res.attributes?.nazev || 'Hledaná plocha', { 
            permanent: true, direction: 'center', className: 'ruian-label' 
        }).openTooltip();

    } else if (geometry.paths) {
        const coords = geometry.paths.map(path => path.map(c => [c[1], c[0]]));
        window._searchMarker = L.polyline(coords, { className: 'ruian-search-polyline', color: 'rgb(54, 140, 84)', weight: 6, opacity: 0.8 }).addTo(map);
        targetBounds = window._searchMarker.getBounds();
        lat = targetBounds.getCenter().lat; lng = targetBounds.getCenter().lng;
        
        let longestSeg = 0; let bestAngle = 0; let bestCenter = [lat, lng];
        const targetZoom = map.getBoundsZoom(targetBounds, false, [80,80]) || 17;
        coords.forEach(path => {
            for (let i = 0; i < path.length - 1; i++) {
                const p1 = map.project(path[i], targetZoom);
                const p2 = map.project(path[i+1], targetZoom);
                const dist = p1.distanceTo(p2);
                if (dist > longestSeg) {
                    longestSeg = dist;
                    let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                    if (angle > 90 || angle < -90) angle += 180;
                    bestAngle = angle;
                    bestCenter = [ (path[i][0] + path[i+1][0])/2, (path[i][1] + path[i+1][1])/2 ];
                }
            }
        });
        
        const labelName = res.address || res.attributes?.nazev || 'Hledaná linie';
        const labelHtml = `<div style="transform: rotate(${bestAngle}deg); white-space: nowrap;">${labelName}</div>`;
        
        // Namísto bindTooltip navážeme tooltip přímo na vypočtený střed segmentu, nikoliv na bounding box
        window._searchMarker._customTooltip = L.tooltip({ permanent: true, direction: 'center', className: 'ruian-label ruian-label-line' })
            .setLatLng(bestCenter)
            .setContent(labelHtml)
            .addTo(map);
    }

    // JS Hover synchronizace obousměrně (Geometrie <-> Popisek)
    if (window._searchMarker) {
        const syncHover = (isHover) => {
            const tooltip = window._searchMarker.getTooltip() || window._searchMarker._customTooltip;
            const geomEl = window._searchMarker.getElement ? window._searchMarker.getElement() : null;
            
            if (isHover) {
                if (tooltip && tooltip._container) tooltip._container.classList.add('ruian-label-hovered');
                if (geomEl) geomEl.classList.add('geometry-hover-force');
            } else {
                if (tooltip && tooltip._container) tooltip._container.classList.remove('ruian-label-hovered');
                if (geomEl) geomEl.classList.remove('geometry-hover-force');
            }
        };

        // Krok 1: Hover z geometrie -> na popisek
        window._searchMarker.on('mouseover', () => syncHover(true));
        window._searchMarker.on('mouseout', () => syncHover(false));

        // Krok 2: Hover z popisku -> na geometrii
        const tooltip = window._searchMarker.getTooltip() || window._searchMarker._customTooltip;
        const bindTooltipEvents = () => {
            if (tooltip && tooltip._container) {
                tooltip._container.addEventListener('mouseover', () => syncHover(true));
                tooltip._container.addEventListener('mouseout', () => syncHover(false));
            } else if (tooltip) {
                setTimeout(bindTooltipEvents, 50);
            }
        };
        
        bindTooltipEvents();
    }

    if (lat && lng) {
        if (lat > 90 || lat < -90 || lng > 180 || lng < -180) {
            console.error('Chybné souřadnice (S-JTSK?):', lat, lng);
            showToast('Chyba souřadnicového systému.');
            return;
        }
        
        if (targetBounds) {
            // Větší padding (80px ze všech stran), aby byl objekt bezpečně uprostřed
            map.fitBounds(targetBounds, { maxZoom: 17, padding: [80, 80], animate: true, duration: 1.5 });
        } else {
            map.flyTo([lat, lng], zoom);
        }
        showRuianDetail(res);
    }
}

function showRuianDetail(res) {
    const resultsContainer = document.getElementById('ruian-search-results');
    const detailContainer  = document.getElementById('ruian-detail');
    const detailContent    = document.getElementById('ruian-detail-content');

    resultsContainer.classList.add('hidden');
    detailContainer.classList.remove('hidden');

    let html = `
        <div class="detail-title-row" style="margin-bottom: 20px;">
            <i class="ph ph-info" style="font-size:24px;color:var(--accent)"></i>
            <h2 class="detail-name" style="font-size: 14px;">${res.address || res.attributes.nazev || 'Detail objektu'}</h2>
        </div>
        <div class="detail-attrs">
    `;
    for (const [key, val] of Object.entries(res.attributes)) {
        if (val && typeof val !== 'object' && shouldShowRuianAttr(key)) {
            const label = RUIAN_ATTR_LABELS[key] || key;
            const translatedVal = formatRuianValue(key, val);
            html += `<div class="detail-attr-row"><div class="detail-attr-label">${label}</div><div class="detail-attr-value">${translatedVal}</div></div>`;
        }
    }
    html += `</div>`;
    detailContent.innerHTML = html;
}

window.addEventListener('load', () => {
    const searchInput = document.getElementById('ruian-search-input');
    const searchBtn   = document.getElementById('btn-ruian-search');
    const backBtn     = document.getElementById('btn-ruian-back');
    const suggestionsContainer = document.getElementById('ruian-suggestions');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            suggestionsContainer.classList.add('hidden');
            searchRuian(searchInput.value);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => suggestRuian(e.target.value), 300);
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                suggestionsContainer.classList.add('hidden');
                searchRuian(e.target.value);
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('ruian-search-results').classList.remove('hidden');
            document.getElementById('ruian-detail').classList.add('hidden');
            if (window._searchMarker) {
                if (window._searchMarker._customTooltip) map.removeLayer(window._searchMarker._customTooltip);
                map.removeLayer(window._searchMarker);
                window._searchMarker = null;
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) suggestionsContainer.classList.add('hidden');
    });
});
