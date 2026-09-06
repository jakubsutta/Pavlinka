// ============================================================
// Výdejní boxy (Z-BOX, AlzaBox, PPL, atd.) z Overpass API
// ============================================================

const boxyLayer = L.featureGroup();
let boxyAbortController = null;
let boxyDebounceTimer = null;

// Registrace vrstvy do globálního overlayLayers pro checkbox
if (typeof overlayLayers !== 'undefined') {
    overlayLayers['vydejni-boxy'] = boxyLayer;
}

// Funkce pro určení barvy a brandu podle tagů
function getBoxyStyle(brand, operator, name) {
    const text = [brand, operator, name].join(' ').toLowerCase();
    
    if (text.includes('z-box') || text.includes('packeta') || text.includes('zásilkovna') || text.includes('zasilkovna')) {
        return { color: '#e3000f', bg: '#e3000f', name: 'Z-BOX' };
    }
    if (text.includes('alza')) {
        return { color: '#0050b5', bg: '#0050b5', name: 'AlzaBox' };
    }
    if (text.includes('ppl')) {
        return { color: '#005a9b', bg: '#005a9b', name: 'PPL Parcelbox' };
    }
    if (text.includes('dpd')) {
        return { color: '#dc0032', bg: '#dc0032', name: 'DPD Pickup Box' };
    }
    if (text.includes('gls')) {
        return { color: '#004b87', bg: '#ffcc00', name: 'GLS ParcelBox' }; // GLS: žluté pozadí, modrá ikona
    }
    if (text.includes('balíkovna') || text.includes('balikovna') || text.includes('ceska posta') || text.includes('česká pošta')) {
        return { color: '#ffcc00', bg: '#ffcc00', name: 'Balíkovna' };
    }
    // Default
    return { color: '#666666', bg: '#666666', name: 'Výdejní box' };
}

function fetchBoxyData() {
    clearTimeout(boxyDebounceTimer);
    boxyDebounceTimer = setTimeout(() => {
        if (!map.hasLayer(boxyLayer)) return;
        
        // Stahovat data pouze pokud je uživatel dostatečně přiblížený (zabrání přetížení OSM api pro celou ČR)
        if (map.getZoom() < 12) {
            boxyLayer.clearLayers();
            return;
        }
        
        const bounds = map.getBounds();
        const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
        const query = `[out:json];node["amenity"="parcel_locker"](${bbox});out body;`;

        if (boxyAbortController) boxyAbortController.abort();
        boxyAbortController = new AbortController();

        fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            signal: boxyAbortController.signal
        })
        .then(r => r.json())
        .then(data => {
            boxyLayer.clearLayers();
            data.elements.forEach(el => {
                if (el.type === 'node') {
                    const tags = el.tags || {};
                    const style = getBoxyStyle(tags.brand, tags.operator, tags.name);
                    const displayName = tags.name || tags.brand || style.name;
                    
                    // Barva ikony a nadpisu: pro GLS/Balíkovnu (žlutý bg) je kontrast modrý, jinak brand barva
                    const accentColor = (style.bg === '#ffcc00') ? '#004b87' : style.bg;

                    const sections = [];

                    if (tags.operator) {
                        sections.push(`
                            <div class="coords-popup-section" style="margin-bottom: 0; gap: 1px;">
                                <span class="stat-label" style="display:flex; align-items:center; gap:4px;"><i class="ph-bold ph-briefcase"></i> Provozovatel</span>
                                <span class="coords-popup-val" style="white-space:normal; color:#333;">${tags.operator}</span>
                            </div>`);
                    }
                    // Zkusíme nejdřív OSM adresu, jinak použijeme placeholder pro async reverse geocoding
                    const addrOsm = [
                        tags['addr:street'] && tags['addr:housenumber']
                            ? `${tags['addr:street']} ${tags['addr:housenumber']}`
                            : (tags['addr:street'] || tags['addr:place'] || ''),
                        tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || ''
                    ].filter(Boolean).join(', ');

                    const addrPlaceholderId = `boxy-addr-${el.id || (el.lat + '' + el.lon).replace('.', '')}`;  
                    sections.push(`
                        <div class="coords-popup-section" style="margin-bottom: 0; gap: 1px;">
                            <span class="stat-label" style="display:flex; align-items:center; gap:4px;"><i class="ph-bold ph-map-pin"></i> Adresa</span>
                            <span class="coords-popup-val" style="white-space:normal; color:#333;" id="${addrPlaceholderId}">${addrOsm || '<span style="color:#aaa; font-style:italic;">načítám…</span>'}</span>
                        </div>`);
                    if (tags.opening_hours) {
                        sections.push(`
                            <div class="coords-popup-section" style="margin-bottom: 0; gap: 1px;">
                                <span class="stat-label" style="display:flex; align-items:center; gap:4px;"><i class="ph-bold ph-clock"></i> Otevřeno</span>
                                <span class="coords-popup-val" style="white-space:normal; color:#333;">${tags.opening_hours.replace(/;/g, ' · ')}</span>
                            </div>`);
                    }
                    
                    const marker = L.marker([el.lat, el.lon], {
                        icon: L.divIcon({
                            className: 'boxy-icon',
                            html: `
                                <div style="background: ${style.bg}; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid ${style.bg === '#ffcc00' ? '#004b87' : 'white'}; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                                    <i class="ph-fill ph-package" style="color: ${style.bg === '#ffcc00' ? '#004b87' : 'white'}; font-size: 14px;"></i>
                                </div>
                            `,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    });
                    
                    const sectionsHtml = sections.length > 0
                        ? sections.join('<div class="coords-popup-divider"></div>')
                        : `<div class="coords-popup-section"><span class="coords-popup-val" style="color:#aaa;">Žádné další informace</span></div>`;

                    const popupHtml = `
                        <div class="coords-popup-container" style="width: 240px; box-sizing: border-box;">
                            <div class="coords-popup-header">
                                <div style="display:flex; align-items:center; gap:6px; color:${accentColor}; min-width:0; overflow:hidden;">
                                    <i class="ph-fill ph-package" style="font-size:15px; flex-shrink:0;"></i>
                                    <strong style="font-size:13px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</strong>
                                </div>
                                <button class="coords-popup-close-btn" onclick="map.closePopup()" title="Zavřít">
                                    <i class="ph-bold ph-x"></i>
                                </button>
                            </div>
                            <div class="coords-popup-divider"></div>
                            ${sectionsHtml}
                        </div>
                    `;
                    marker.bindPopup(popupHtml, { className: 'coords-leaflet-popup', maxWidth: 400 });

                    // Async reverse geocoding přes Nominatim — spustí se jen jednou při prvním otevření popupu
                    if (!addrOsm) {
                        marker.once('popupopen', () => {
                            const el2 = document.getElementById(addrPlaceholderId);
                            if (!el2) return;
                            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${el.lat}&lon=${el.lon}&zoom=18&addressdetails=1`, {
                                headers: { 'Accept-Language': 'cs' }
                            })
                            .then(r => r.json())
                            .then(d => {
                                if (d && d.address) {
                                    const a = d.address;
                                    const street = a.road || a.pedestrian || a.path || '';
                                    const num    = a.house_number || '';
                                    const city   = a.city || a.town || a.village || a.municipality || '';
                                    const parts  = [street && num ? `${street} ${num}` : street, city].filter(Boolean).join(', ');
                                    el2.textContent = parts || d.display_name?.split(',').slice(0,2).join(',') || '—';
                                } else {
                                    el2.textContent = '—';
                                }
                            })
                            .catch(() => { el2.textContent = '—'; });
                        });
                    }

                    boxyLayer.addLayer(marker);
                }
            });
        })
        .catch(err => {
            if (err.name !== 'AbortError') {
                console.error('Chyba při stahování výdejních boxů z OSM:', err);
            }
        });
    }, 500);
}

// Navěšení dotazování na události mapy
map.on('moveend zoomend', () => {
    if (map.hasLayer(boxyLayer)) {
        fetchBoxyData();
    }
});

// Ihned načíst data po zapnutí vrstvy
map.on('layeradd', (e) => {
    if (e.layer === boxyLayer) {
        fetchBoxyData();
    }
});
