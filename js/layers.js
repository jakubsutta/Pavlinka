// ============================================================
// layers.js – Stylování a načítání QGIS/Supabase vrstev
// ============================================================


function getStyle(feature, layerType) {
    // Speciální early-return pro pyrotechnické zóny
    if (layerType === 'pyro') {
        return {
            color: '#cc0000',
            weight: 4,
            fillColor: '#cc0000',
            fillOpacity: 0.30
        };
    }

    let color = '#000000';
    let opacity = 0.5;
    let fillPattern = null;

    const featId = (feature.properties._table || '') + '_' + (feature.properties.ID || feature.properties.id);
    if (layerType === 'floorplan' && featId && floorplanOverrides[featId]) {
        const typeKey = floorplanOverrides[featId];
        if (FLOORPLAN_TYPES[typeKey]) {
            color = FLOORPLAN_TYPES[typeKey].color;
            return { color, weight: 2, fillColor: color, fillOpacity: 0.5 };
        }
    }

    switch (layerType) {
        case 'camera':
            // Definice pevných barev pro typy 1, 2, 3
            const cameraColors = {
                '1': '#50c878', // Smaragdově zelená
                '2': '#ff5722', // Oranžová
                '3': '#9c27b0'  // Fialová
            };

            // Načteme hodnotu z atributu 'Typ' (případně 'typ' s malým)
            let typKamery = String(feature.properties.Typ || feature.properties.typ || '');

            // Přepis z LocalStorage (stejně jako půdorysy)
            if (featId && cameraOverrides[featId]) {
                typKamery = cameraOverrides[featId];
            }

            // Nastavíme barvu linky podle vybraného typu, jinak černá
            color = cameraColors[typKamery] || '#000000';
            opacity = 1;

            // Nastavíme dynamický název vzoru podle typu (např. url(#camera-srafy-2)), jinak výchozí černý
            fillPattern = cameraColors[typKamery] ? `url(#camera-srafy-${typKamery})` : `url(#camera-srafy-default)`;
            break;

        case 'floorplan': color = 'gray'; break;
        case 'elektrina': color = 'red'; break;
        case 'kanalizace':
            if (feature.properties.Typ === 'splašková' || feature.properties.typ === 'splašková') color = 'darkred';
            else if (feature.properties.Typ === 'dešťová' || feature.properties.typ === 'dešťová') color = 'orange';
            else color = 'saddlebrown';
            break;
        case 'vodovod': color = 'blue'; break;
        case 'plynovod': color = 'yellow'; break;
        case 'komunikace': color = 'pink'; break;
        case 'katastr': color = 'lime'; break;
        case 'budovy': color = 'black'; break;
        case 'vybaveni': color = 'gray'; break;
        case 'ostatni': color = 'purple'; break;
    }

    // Pokud máme nadefinovaný vzor (šrafy), vrátíme ho jako fillColor
    return {
        color: color,
        weight: 2,
        fillColor: fillPattern ? fillPattern : color,
        fillOpacity: opacity
    };
}

// ── Interakce s vrstvami ──
let _selectedLayer = null;

function resetSelectedLayer() {
    if (_selectedLayer) {
        if (map.hasLayer(_selectedLayer)) {
            _selectedLayer.setStyle(getStyle(_selectedLayer.feature, _selectedLayer.options.layerType));
        }
        _selectedLayer = null;
    }
}

function onEachFeature(feature, layer, layerType) {
    layer.options.layerType = layerType;
    const naseNazev = feature.properties.Nazev || feature.properties.nazev;
    if (naseNazev) {
        layer.bindTooltip(naseNazev, { sticky: true, className: 'custom-tooltip' });
    }

    layer.on('mouseover', function () {
        if (_selectedLayer !== layer && typeof layer.setStyle === 'function') {
            // Pyro zóna: pouze modrý obrys, průhledná vüpľň
            const hoverFill = (layerType === 'pyro') ? 0 : 0.8;
            layer.setStyle({ weight: 4, color: '#00a8ff', fillOpacity: hoverFill });
        }
    });
    layer.on('mouseout', function () {
        if (_selectedLayer !== layer && typeof layer.setStyle === 'function') {
            layer.setStyle(getStyle(feature, layerType));
        }
    });
    layer.on('click', function (e) {
        resetSelectedLayer();
        _selectedLayer = layer;
        if (typeof layer.setStyle === 'function') {
            layer.setStyle({ weight: 5, color: '#ff0000', fillOpacity: 1 });
        }
        if (typeof layer.bringToFront === 'function') layer.bringToFront();
        openDetailView(feature.properties, layerType);
        L.DomEvent.stopPropagation(e);
    });
}

// ── Supabase – načítání dat ──
const skupinyVrstev = {};
const qgisFeaturesData = {};

function setGroupOpacity(group, opacity) {
    if (!group) return;
    group.eachLayer(layer => {
        if (layer.setOpacity) {
            layer.setOpacity(opacity);
        }
        if (layer.setStyle) {
            const fillOpacity = layer.feature && layer.feature.properties && layer.feature.properties._geomType && layer.feature.properties._geomType.toLowerCase().includes('point') ? opacity * 0.8 : opacity * 0.15;
            layer.setStyle({
                opacity: opacity,
                fillOpacity: fillOpacity
            });
        }
        if (layer.eachLayer) {
            setGroupOpacity(layer, opacity);
        }
    });
}



async function nactiDataZeSupabase(tabulka) {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${tabulka}?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();
        return {
            type: 'FeatureCollection',
            features: data.map(row => {
                let geom = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom;
                return { type: 'Feature', geometry: geom, properties: { ...row, _table: tabulka } };
            })
        };
    } catch (err) {
        console.error(err);
        return null;
    }
}

function saveQgisState() {
    const checked = Array.from(document.querySelectorAll('.qgis-layer:checked')).map(cb => cb.value);
    localStorage.setItem('pavlinka_qgis', JSON.stringify(checked));
}

function setMapLoader(show) {
    const loader = document.getElementById('map-loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}


document.querySelectorAll('.qgis-layer').forEach(checkbox => {
    checkbox.addEventListener('change', async function () {
        const seznamTabulek = this.value.split(',');
        const klicSkupiny = this.value;
        const layerType = seznamTabulek[0].split('_')[0];

        if (this.checked) {
            setMapLoader(true);
            try {
                skupinyVrstev[klicSkupiny] = L.layerGroup().addTo(map);
                qgisFeaturesData[klicSkupiny] = [];

                for (const tabulka of seznamTabulek) {
                    const geojsonData = await nactiDataZeSupabase(tabulka);
                    if (geojsonData && geojsonData.features) {
                        try {
                            geojsonData.features.forEach(f => qgisFeaturesData[klicSkupiny].push({ ...f.properties, _geomType: f.geometry ? f.geometry.type : null }));
                            const geojsonVrstva = L.geoJSON(geojsonData, {
                                style: (feature) => getStyle(feature, layerType),
                                pointToLayer: (feature, latlng) => {
                                    if (tabulka.includes('camera')) {
                                        const cameraColors = {
                                            '1': '#50c878',
                                            '2': '#ff5722',
                                            '3': '#9c27b0'
                                        };
                                        let typKamery = String(feature.properties.Typ || feature.properties.typ || '');
                                        const featId2 = (feature.properties._table || '') + '_' + (feature.properties.ID || feature.properties.id);
                                        if (featId2 && cameraOverrides[featId2]) {
                                            typKamery = cameraOverrides[featId2];
                                        }
                                        const ikonaBarva = cameraColors[typKamery] || '#000000';
                                        const cameraIcon = L.divIcon({
                                            html: `<i class="ph-fill ph-security-camera" style="color: ${ikonaBarva} !important;"></i>`,
                                            className: 'camera-map-icon',
                                            iconSize: [24, 24],
                                            iconAnchor: [12, 12]
                                        });
                                        return L.marker(latlng, { icon: cameraIcon });
                                    }

                                    const s = getStyle(feature, layerType);
                                    return L.circleMarker(latlng, {
                                        radius: 6, fillColor: s.fillColor,
                                        color: '#000', weight: 1, fillOpacity: 0.8
                                    });
                                },
                                onEachFeature: (feature, layer) => onEachFeature(feature, layer, layerType)
                            });
                            skupinyVrstev[klicSkupiny].addLayer(geojsonVrstva);

                            if (tabulka === 'pyro_area') {
                                geojsonData.features.forEach(feature => {
                                    const nazev = feature.properties.nazev || feature.properties.Nazev;
                                    if (!nazev || !feature.geometry) return;
                                    const tmpLayer = L.geoJSON(feature);
                                    const center = tmpLayer.getBounds().getCenter();
                                    const labelMarker = L.marker(center, {
                                        icon: L.divIcon({
                                            className: 'pyro-label-icon',
                                            html: `<span class="pyro-label-text">${nazev.toUpperCase()}</span>`,
                                            iconSize: [0, 0],
                                            iconAnchor: [0, 0]
                                        }),
                                        interactive: false,
                                        zIndexOffset: 500
                                    });
                                    skupinyVrstev[klicSkupiny].addLayer(labelMarker);
                                });
                            }
                        } catch (err) {
                            console.error('Chyba při zpracování GeoJSON vrstvy:', tabulka, err);
                        }
                    }
                }
                
                // Použít uloženou průhlednost
                const savedOpacities = JSON.parse(localStorage.getItem('pavlinka_layers_opacity') || '{}');
                const layerId = this.id || this.value;
                if (savedOpacities[layerId] !== undefined) {
                    setGroupOpacity(skupinyVrstev[klicSkupiny], savedOpacities[layerId]);
                }
                
            } catch (err) {
                console.error('Kritická chyba při načítání QGIS vrstvy:', klicSkupiny, err);
            } finally {
                setMapLoader(false);
            }
        } else {
            if (skupinyVrstev[klicSkupiny]) {
                map.removeLayer(skupinyVrstev[klicSkupiny]);
                delete skupinyVrstev[klicSkupiny];
            }
            delete qgisFeaturesData[klicSkupiny];
        }
        saveQgisState();
    });
});

// ── Zabalení/rozbalení skupin vrstev ──
document.querySelectorAll('.layer-group-header').forEach(header => {
    header.addEventListener('click', function (e) {
        if (e.target.closest('.group-master-checkbox')) return; // Zamezí rozbalení při kliknutí na checkbox

        const content = this.nextElementSibling;
        if (content && (content.classList.contains('layer-group') || content.classList.contains('basemap-thumbnails'))) {
            content.classList.toggle('is-collapsed');
            const icon = this.querySelector('.toggle-icon');
            icon.classList.toggle('ph-caret-double-up');
            icon.classList.toggle('ph-caret-double-down');
        }
        if (typeof saveExpandedGroups === 'function') saveExpandedGroups();
    });
});

// ── Funkce pro aktualizaci počítadel a stavů master checkboxů ──
function updateGroupCounters() {
    document.querySelectorAll('.layer-group-header').forEach(header => {
        const counter = header.querySelector('.group-counter');
        const masterCb = header.querySelector('.group-master-checkbox');
        if (!counter || !masterCb) return;

        const content = header.nextElementSibling;
        if (content && content.classList.contains('layer-group')) {
            const checkboxes = content.querySelectorAll('input[type="checkbox"]');
            const total = checkboxes.length;
            const checked = Array.from(checkboxes).filter(cb => cb.checked).length;

            if (checked > 0) {
                counter.textContent = `(${checked}/${total})`;
            } else {
                counter.textContent = '';
            }

            masterCb.checked = checked === total && total > 0;
            masterCb.indeterminate = checked > 0 && checked < total;
        }
    });

    updateActiveGroupsIndicator();
}

// ── Indikátor aktivních skupin ──
function updateActiveGroupsIndicator() {
    let indicator = document.getElementById('active-groups-indicator');
    if (!indicator) return;
    
    indicator.innerHTML = '';
    
    document.querySelectorAll('.layer-group-header').forEach(header => {
        const content = header.nextElementSibling;
        if (!content || !content.classList.contains('layer-group')) return;
        
        // Zkontrolujeme, zda jsou zapnuté nějaké (normální) vrstvy
        // Subgroups (podskupiny) fungují také, protože jejich inputy zachytíme (pokud nemají .subgroup-master)
        // nebo prostě vezmeme všechny zaškrtnuté. Ale master checkbox v podskupině může být checked,
        // což je ok. Akorát bychom nechtěli počítat master dvakrát, i kdyz to jen overujeme na > 0.
        // Raději ověříme jen konkrétní pod-vrstvy:
        const checked = content.querySelectorAll('input[type="checkbox"]:not(.subgroup-master):checked').length;
        
        if (checked > 0) {
            const iconEl = header.querySelector('.group-header-inner i');
            if (iconEl) {
                const groupStyle = getComputedStyle(header);
                let bgColor = groupStyle.getPropertyValue('--group-bg').trim() || 'rgba(0,0,0,0.1)';
                let textColor = groupStyle.getPropertyValue('--group-color').trim() || 'var(--accent)';
                
                const iconDiv = document.createElement('div');
                iconDiv.className = 'active-group-icon';
                iconDiv.style.setProperty('--icon-bg', bgColor);
                iconDiv.style.setProperty('--icon-color', textColor);
                
                // Mírné ztmavení hoveru řešíme přes transition, ale title je dobré přidat
                const nameSpan = header.querySelector('.group-header-inner span:not(.group-counter)');
                iconDiv.title = nameSpan ? nameSpan.textContent.trim() : '';
                
                iconDiv.innerHTML = `<i class="${iconEl.className}"></i>`;
                indicator.appendChild(iconDiv);
            }
        }
    });
}

// ── Událost pro kliknutí na master checkbox ──
document.querySelectorAll('.group-master-checkbox').forEach(masterCb => {
    masterCb.addEventListener('change', function () {
        const isChecked = this.checked;
        const header = this.closest('.layer-group-header');
        const content = header.nextElementSibling;
        if (content && content.classList.contains('layer-group')) {
            const checkboxes = content.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (cb.checked !== isChecked) {
                    cb.checked = isChecked;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        }
        updateGroupCounters();
    });
});

// Zajištění aktualizace počítadel při kliknutí na běžné vrstvy
document.querySelectorAll('.layer-group input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateGroupCounters);
});

// Prvotní přepočítání po případném načtení z localStorage
setTimeout(updateGroupCounters, 100);

// ── Legenda ──

/**
 * Sestaví HTML řádek s meta štítky (typ dat, geometrie, dotazovací).
 * @param {object|undefined} meta – objekt { dataType, geomType, queryable }
 * @returns {string} HTML fragmentu .layer-meta-badges nebo ''
 */
function buildMetaBadgesHtml(meta) {
    if (!meta) return '';

    const badges = [];

    // Typ dat
    const dataIcons = {
        raster: 'ph-image',
        vector: 'ph-line-segments',
        '3d':   'ph-three-d'
    };
    const dataLabels = { raster: 'Rastr', vector: 'Vektor', '3d': '3D' };
    if (meta.dataType && dataIcons[meta.dataType]) {
        badges.push(
            `<span class="lmb lmb--${meta.dataType}">` +
            `<i class="ph-bold ${dataIcons[meta.dataType]}"></i> ${dataLabels[meta.dataType]}` +
            `</span>`
        );
    }

    // Typ geometrie
    const geomIcons = {
        point:   'ph-dot-outline',
        line:    'ph-line-segment',
        polygon: 'ph-polygon',
        mixed:   'ph-line-segments'
    };
    const geomLabels = {
        point: 'Bod', line: 'Linie', polygon: 'Polygon', mixed: 'Smíšená'
    };
    if (meta.geomType && geomIcons[meta.geomType]) {
        badges.push(
            `<span class="lmb lmb--${meta.geomType}">` +
            `<i class="ph-bold ${geomIcons[meta.geomType]}"></i> ${geomLabels[meta.geomType]}` +
            `</span>`
        );
    }

    // Dotazovací
    if (meta.queryable) {
        badges.push(
            `<span class="lmb lmb--queryable">` +
            `<i class="ph-bold ph-cursor-click"></i> Dotazovací` +
            `</span>`
        );
    }

    if (!badges.length) return '';
    return `<div class="layer-meta-badges">${badges.join('')}</div>`;
}

document.addEventListener('click', function (e) {
    const btn = e.target.closest('.legend-btn');
    
    // Uzavření jakékoliv existující legendy po kliknutí mimo (nepovinné, ale dobré)
    if (!btn && !e.target.closest('.inline-legend-container') && !e.target.closest('.legend-btn')) {
        document.querySelectorAll('.inline-legend-container').forEach(el => el.remove());
    }

    if (btn) {
        e.stopPropagation();
        const layerId = btn.getAttribute('data-layer');
        const layerLabel = btn.closest('label');
        
        // Pokud už je tato legenda otevřená, zavřeme ji a skončíme
        const existing = layerLabel.nextElementSibling;
        if (existing && existing.classList.contains('inline-legend-container')) {
            existing.remove();
            return;
        }

        // Zavřít všechny ostatní legendy
        document.querySelectorAll('.inline-legend-container').forEach(el => el.remove());

        const labelText = layerLabel.querySelector('.label-text') ? layerLabel.querySelector('.label-text').innerText.trim() : 'Vrstva';
        const data = LEGEND_DATA[layerId] || { title: labelText, meta: [], items: [] };

        const container = document.createElement('div');
        container.className = 'inline-legend-container';
        
        // Získání barvy vrstvy pro podbarvení pozadí legendy
        let groupColor = '#f0f4f8'; // výchozí jemná šedá
        const groupEl = layerLabel.closest('.layer-group');
        if (groupEl && groupEl.previousElementSibling) {
            const h3 = groupEl.previousElementSibling;
            const bgVar = window.getComputedStyle(h3).getPropertyValue('--group-bg');
            if (bgVar && bgVar.trim() !== '') {
                // Převod rgba(..., 0.07) na trochu výraznější (0.15), aby bílý rámeček legendy vynikl
                groupColor = bgVar.trim().replace(/0\.\d+\)/, '0.15)');
            }
        }
        container.style.backgroundColor = groupColor;
        
        const fullLayerId = 'layer-' + layerId;
        let layerInstance = typeof overlayLayers !== 'undefined' ? overlayLayers[fullLayerId] : null;
        let currentOpacity = 100;
        
        // Pokud vrstva není v overlayLayers, zkusíme najít checkbox, jestli není QGIS vrstva
        if (!layerInstance) {
            const cb = layerLabel.querySelector('input[type="checkbox"]');
            if (cb && cb.classList.contains('qgis-layer')) {
                layerInstance = skupinyVrstev[cb.value];
            }
        }
        
        if (layerInstance && layerInstance.options && layerInstance.options.opacity !== undefined) {
            currentOpacity = Math.round(layerInstance.options.opacity * 100);
        } else {
            // Zkusit najít z localStorage
            const savedOpacities = JSON.parse(localStorage.getItem('pavlinka_layers_opacity') || '{}');
            const cb = layerLabel.querySelector('input[type="checkbox"]');
            const cbId = cb ? (cb.id || cb.value) : layerId;
            if (savedOpacities[cbId] !== undefined) {
                currentOpacity = Math.round(savedOpacities[cbId] * 100);
            }
        }

        const itemsHtml = (data.items || []).map(item => {
            const bgStyle = item.type === 'poly-pyro' ? '' : `background:${item.color};`;
            return `
            <div class="inline-legend-item">
                <span class="legend-shape l-${item.type}" style="${bgStyle}"></span>
                <span>${item.text}</span>
            </div>`;
        }).join('');

        let legendBoxHtml = '';
        if ((data.items && data.items.length > 0) || (data.meta && data.meta.length > 0)) {
            legendBoxHtml = `
            <div class="legend-items-box">
                <strong style="display:block; margin-bottom:8px;">${data.title}</strong>
                ${buildMetaBadgesHtml(data.meta || [])}
                <div class="legend-items">
                    ${itemsHtml}
                </div>
            </div>`;
        }

        container.innerHTML = `
            <div class="legend-controls-row">
                <button type="button" class="zoom-to-layer-btn" data-layer="${layerId}" title="Vycentrovat na vrstvu">
                    <i class="ph ph-magnifying-glass-plus"></i>
                </button>
                <i class="ph ph-sun" title="Průhlednost vrstvy" style="color: #666; font-size: 14px; margin-left: 8px;"></i>
                <input type="range" min="0" max="100" value="${currentOpacity}" class="opacity-slider" title="Průhlednost vrstvy">
            </div>
            ${legendBoxHtml}
        `;
        
        container.addEventListener('click', ev => ev.stopPropagation());
        
        const zoomBtn = container.querySelector('.zoom-to-layer-btn');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const projectCenter = [49.84291, 18.12103];
                const projectZoom = 18;
                if (document.getElementById('cesiumContainer') && document.getElementById('cesiumContainer').style.display === 'block' && typeof cesiumViewer !== 'undefined' && cesiumViewer) {
                    const height = 15000000 / Math.pow(2, projectZoom);
                    cesiumViewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(projectCenter[1], projectCenter[0], height),
                        orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35), roll: 0 }
                    });
                } else if (typeof map !== 'undefined') {
                    // Zkusíme najít vrstvu a přiblížit se na ni
                    if (layerInstance) {
                        if (typeof layerInstance.getBounds === 'function') {
                            const bounds = layerInstance.getBounds();
                            if (bounds && bounds.isValid()) {
                                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 19 });
                                return;
                            }
                        } else if (layerInstance.eachLayer) {
                            const bounds = L.latLngBounds();
                            let hasBounds = false;
                            layerInstance.eachLayer(l => {
                                if (typeof l.getBounds === 'function') {
                                    const b = l.getBounds();
                                    if (b && b.isValid()) { bounds.extend(b); hasBounds = true; }
                                } else if (typeof l.getLatLng === 'function') {
                                    const ll = l.getLatLng();
                                    if (ll) { bounds.extend(ll); hasBounds = true; }
                                }
                            });
                            if (hasBounds && bounds.isValid()) {
                                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 19 });
                                return;
                            }
                        }
                    }
                    // Fallback
                    map.flyTo(projectCenter, projectZoom);
                }
            });
        }
        
        const slider = container.querySelector('.opacity-slider');
        if (slider && layerInstance) {
            slider.addEventListener('input', (ev) => {
                const val = ev.target.value / 100;
                
                // Uložení opacity do localStorage
                const savedOpacities = JSON.parse(localStorage.getItem('pavlinka_layers_opacity') || '{}');
                const cb = layerLabel.querySelector('input[type="checkbox"]');
                const cbId = cb ? (cb.id || cb.value) : layerId;
                savedOpacities[cbId] = val;
                localStorage.setItem('pavlinka_layers_opacity', JSON.stringify(savedOpacities));

                // Aplikace opacity na vrstvu
                if (layerInstance.eachLayer) {
                    // Je to LayerGroup (např. QGIS vektorová vrstva)
                    setGroupOpacity(layerInstance, val);
                } else if (layerInstance.setOpacity) {
                    // Je to přímo WMS vrstva
                    layerInstance.setOpacity(val);
                }
            });
        }

        layerLabel.insertAdjacentElement('afterend', container);
    }
});

// ── Zabalení/rozbalení a ovládání podskupin (subgroups) ──
document.querySelectorAll('.subgroup-parent').forEach(parentLabel => {
    // Rozbalení/sbalení při kliknutí na celý řádek
    parentLabel.addEventListener('click', function(e) {
        // Pokud jsme klikli přímo na checkbox, nechceme rozbalovat, jen měnit stav checkboxu
        if (e.target.tagName.toLowerCase() === 'input') return;
        
        e.preventDefault(); // Zabrání defaultnímu chování (kliknutí na label by změnilo checkbox)
        
        const masterCb = this.querySelector('.subgroup-master');
        const groupId = masterCb.dataset.subgroup;
        const icon = this.querySelector('.subgroup-toggle');
        const children = document.querySelectorAll('.subgroup-child.' + groupId);
        
        icon.classList.toggle('is-collapsed-icon');
        children.forEach(child => {
            child.classList.toggle('is-visible');
        });
        if (typeof saveExpandedGroups === 'function') saveExpandedGroups();
    });

    // Ovládání checkboxů
    const masterCb = parentLabel.querySelector('.subgroup-master');
    masterCb.addEventListener('change', function() {
        const groupId = this.dataset.subgroup;
        const isChecked = this.checked;
        const children = document.querySelectorAll('.subgroup-child.' + groupId + ' input[type="checkbox"]');
        
        children.forEach(childCb => {
            if (childCb.checked !== isChecked) {
                childCb.checked = isChecked;
                // Dispatch change event tak, aby zareagoval map.js (přidání/odebrání vrstvy)
                childCb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
});

// Aktualizace master checkboxu při kliknutí na child
document.querySelectorAll('.subgroup-child input[type="checkbox"]').forEach(childCb => {
    childCb.addEventListener('change', function() {
        const parentLabel = this.closest('.subgroup-child');
        const classes = Array.from(parentLabel.classList);
        const groupId = classes.find(c => c !== 'subgroup-child' && c !== 'is-visible');
        
        if (groupId) {
            const childrenCbs = document.querySelectorAll('.subgroup-child.' + groupId + ' input[type="checkbox"]');
            const allChecked = Array.from(childrenCbs).every(cb => cb.checked);
            const someChecked = Array.from(childrenCbs).some(cb => cb.checked);
            
            const masterCb = document.querySelector('.subgroup-master[data-subgroup="' + groupId + '"]');
            if (masterCb) {
                masterCb.checked = allChecked;
                masterCb.indeterminate = !allChecked && someChecked;
            }
        }
    });
});

function saveExpandedGroups() {
    const expandedHeaders = Array.from(document.querySelectorAll('.layer-group-header')).filter(header => {
        const content = header.nextElementSibling;
        return content && !content.classList.contains('is-collapsed');
    }).map(header => header.id).filter(id => id);
    
    const expandedSubgroups = Array.from(document.querySelectorAll('.subgroup-parent')).filter(parent => {
        const masterCb = parent.querySelector('.subgroup-master');
        if (!masterCb || !masterCb.dataset.subgroup) return false;
        const firstChild = document.querySelector('.subgroup-child.' + masterCb.dataset.subgroup);
        return firstChild && firstChild.classList.contains('is-visible');
    }).map(parent => parent.querySelector('.subgroup-master').dataset.subgroup);

    localStorage.setItem('pavlinka_expanded_groups', JSON.stringify({
        main: expandedHeaders,
        sub: expandedSubgroups
    }));
}
