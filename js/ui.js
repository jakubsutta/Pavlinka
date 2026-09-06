// ============================================================
// ui.js – Panel, záložky, detail a editační formulář
// ============================================================

const rightPanel = document.getElementById('right-panel');
const toggleBtn  = document.getElementById('toggle-panel-btn');
const layerManager = document.getElementById('layer-manager');
const editForm   = document.getElementById('edit-form');
const detailView = document.getElementById('detail-view');
const tabsArea   = document.getElementById('tabs-area');
const tabNav     = document.getElementById('tab-nav');

let _currentProperties = null;
let _currentLayerType  = null;

// ── Toggle panelu ──
toggleBtn.addEventListener('click', () => {
    rightPanel.classList.toggle('collapsed');
    toggleBtn.textContent = rightPanel.classList.contains('collapsed') ? '▶' : '◀';
});

// ── Změna šířky panelu (Resizer) ──
const resizer = document.getElementById('panel-resizer');
let isResizing = false;

if (resizer) {
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'ew-resize';
        // Automaticky rozbalit panel, pokud je sbalený a uživatel za něj tahá
        if (rightPanel.classList.contains('collapsed')) {
            rightPanel.classList.remove('collapsed');
            toggleBtn.textContent = '◀';
        }
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        // Získáme novou šířku podle pozice myši
        let newWidth = e.clientX;
        
        // Omezení šířky (Mawis styl - min a max šířka)
        if (newWidth < 250) newWidth = 250;
        if (newWidth > 600) newWidth = 600;
        
        rightPanel.style.width = newWidth + 'px';
        document.documentElement.style.setProperty('--panel-width', newWidth + 'px');
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = ''; // Reset cursor
            // Pokud je načtena mapa (proměnná map), řekneme jí, ať se přizpůsobí novému rozměru
            if (typeof map !== 'undefined' && map.invalidateSize) {
                map.invalidateSize();
            } else if (window.map && window.map.invalidateSize) {
                window.map.invalidateSize();
            }
        }
    });
}

// ── Přepínání záložek ──
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll(`.tab-btn[data-tab="${btn.dataset.tab}"]`).forEach(b => b.classList.add('active'));
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'objekty') renderObjectsList();
        if (btn.dataset.tab === 'data') renderObjectsList();
        localStorage.setItem('pavlinka_tab', btn.dataset.tab);
        window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: btn.dataset.tab } }));
        if (rightPanel.classList.contains('collapsed')) {
            rightPanel.classList.remove('collapsed');
            toggleBtn.textContent = '◀';
        }
    });
});

// ── Tlačítko pro obnovení seznamu QGIS prvků ──
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('btn-refresh-objects');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.style.transition = 'transform 0.4s';
                icon.style.transform = 'rotate(360deg)';
                setTimeout(() => { icon.style.transform = ''; }, 400);
            }
            renderObjectsList();
        });
    }
});

// ── Pomocné funkce pro zobrazování panelů ──
function hideAll() {
    tabsArea.style.display  = 'none';
    tabNav.style.display    = 'none';
    detailView.style.display = 'none';
    editForm.style.display  = 'none';
}

// ── Komprese obrázku a převod na Base64 (JPEG, max 800px, 70% kvalita) pro úsporu místa v localStorage ──
function compressAndGetBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
    });
}

function showTabs() {
    tabsArea.style.display   = '';
    tabNav.style.display     = '';
    detailView.style.display = 'none';
    editForm.style.display   = 'none';
    resetSelectedLayer();
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Detail objektu (read-only) ──
const ATTR_MAP = [
    { key: ['ID', 'id'],               label: 'ID' },
    { key: ['Nazev', 'nazev'],         label: 'Název' },
    { key: ['Typ', 'typ'],             label: 'Typ' },
    { key: ['Poznamka', 'poznamka'],   label: 'Poznámka' },
    { key: ['Popis', 'popis'],         label: 'Popis' },
    { key: ['Material', 'material'],   label: 'Materiál' },
    { key: ['Stav', 'stav'],           label: 'Stav' },
    { key: ['Rok', 'rok'],             label: 'Rok' },
];

function openDetailView(properties, layerType) {
    _currentProperties = properties;
    _currentLayerType  = layerType || null;

    const name = properties.Nazev || properties.nazev || properties.ID || properties.id || '(bez názvu)';
    document.getElementById('detail-name').textContent = name;

    const iconMap = {
        elektrina: 'ph-lightning', kanalizace: 'ph-drop', vodovod: 'ph-pipe',
        plynovod: 'ph-flame', budovy: 'ph-buildings', vybaveni: 'ph-tag', ostatni: 'ph-map-trifold'
    };
    document.getElementById('detail-icon').className = 'ph ' + (iconMap[layerType] || 'ph-map-pin');

    let html = '';

    const featUniqueId = (properties._table || '') + '_' + (properties.ID || properties.id);

    if (layerType === 'floorplan') {
        if (featUniqueId && floorplanOverrides[featUniqueId]) {
            const typeInfo = FLOORPLAN_TYPES[floorplanOverrides[featUniqueId]];
            if (typeInfo) {
                html += `<div class="detail-attr-row"><div class="detail-attr-label">Typ místnosti</div><div class="detail-attr-value" style="color:var(--accent); font-weight:bold;">${typeInfo.text}</div></div>`;
            }
        }
    }

    for (const attr of ATTR_MAP) {
        let val = null;
        for (const k of attr.key) {
            if (properties[k] !== undefined && properties[k] !== null && properties[k] !== '') { val = properties[k]; break; }
        }
        if (val !== null) {
            html += `<div class="detail-attr-row"><div class="detail-attr-label">${attr.label}</div><div class="detail-attr-value">${val}</div></div>`;
        }
    }

    const knownKeys = new Set(ATTR_MAP.flatMap(a => a.key).concat(['geom', 'geometry', 'Fotografie', 'fotografie', 'photo']));
    for (const [k, v] of Object.entries(properties)) {
        if (!knownKeys.has(k) && v !== null && v !== undefined && v !== '' && typeof v !== 'object') {
            html += `<div class="detail-attr-row"><div class="detail-attr-label">${k}</div><div class="detail-attr-value">${v}</div></div>`;
        }
    }

    // Načtení a vykreslení fotografie jako obrázek
    const photo = properties.Fotografie || properties.fotografie || properties.photo || (featUniqueId ? photoOverrides[featUniqueId] : null);
    if (photo) {
        html += `
        <div class="detail-attr-row" style="flex-direction: column; align-items: flex-start; gap: 8px; border-top: 1px solid var(--accent-border); padding-top: 12px; margin-top: 8px;">
            <div class="detail-attr-label">Fotografie</div>
            <div class="detail-attr-value" style="width: 100%;">
                <img src="${photo}" alt="Fotografie objektu" style="max-width: 100%; max-height: 250px; border-radius: 8px; border: 1px solid var(--accent-border); cursor: pointer; display: block; margin: 0 auto;" onclick="window.open('${photo}', '_blank')">
            </div>
        </div>`;
    }

    document.getElementById('detail-attrs').innerHTML = html || '<div class="detail-attr-row"><div class="detail-attr-value">Objekt nemá žádné atributy.</div></div>';

    hideAll();
    detailView.style.display = 'block';
}

document.getElementById('close-detail-btn').addEventListener('click', () => showTabs());
document.getElementById('open-edit-btn').addEventListener('click', () => {
    if (_currentProperties) openEditForm(_currentProperties);
});

// ── Editační formulář ──
function openEditForm(properties) {
    hideAll();
    editForm.style.display = 'block';

    const featId = properties.ID || properties.id || '';
    document.getElementById('obj-id').value   = featId;
    document.getElementById('obj-name').value = properties.Nazev || properties.nazev || '';
    document.getElementById('obj-type').value = properties.Typ || properties.typ || '';
    document.getElementById('obj-note').value = properties.Poznamka || properties.poznamka || '';

    const featUniqueId = (properties._table || '') + '_' + (properties.ID || properties.id);
    const floorSelect  = document.getElementById('obj-floor-type');

    // Zobrazení stávající fotky a ošetření jejího smazání
    const photo = properties.Fotografie || properties.fotografie || properties.photo || (featUniqueId ? photoOverrides[featUniqueId] : null);
    const previewContainer = document.getElementById('edit-photo-preview-container');
    const previewImg       = document.getElementById('edit-photo-preview');
    if (photo) {
        previewImg.src = photo;
        previewContainer.style.display = 'block';
    } else {
        previewImg.src = '';
        previewContainer.style.display = 'none';
    }

    const btnDeletePhoto = document.getElementById('btn-delete-photo');
    const newBtnDeletePhoto = btnDeletePhoto.cloneNode(true);
    btnDeletePhoto.parentNode.replaceChild(newBtnDeletePhoto, btnDeletePhoto);
    newBtnDeletePhoto.addEventListener('click', () => {
        if (confirm('Opravdu chcete tuto fotografii odstranit?')) {
            const currentFeatUniqueId = (_currentProperties._table || '') + '_' + (document.getElementById('obj-id').value);
            if (currentFeatUniqueId) {
                delete photoOverrides[currentFeatUniqueId];
                localStorage.setItem('pavlinka_photos', JSON.stringify(photoOverrides));
                delete _currentProperties.Fotografie;
                delete _currentProperties.fotografie;
                delete _currentProperties.photo;
                previewImg.src = '';
                previewContainer.style.display = 'none';
                showToast('Fotografie byla odstraněna');
            }
        }
    });

    // Resetovat zobrazení všech polí pro Typ
    document.getElementById('group-obj-floor-type').style.display = 'none';
    document.getElementById('group-obj-type-generic').style.display = 'none';
    document.getElementById('group-obj-camera-type').style.display = 'none';

    if (_currentLayerType === 'floorplan') {
        document.getElementById('group-obj-floor-type').style.display = 'block';
        if (featUniqueId && floorplanOverrides[featUniqueId]) {
            floorSelect.value = floorplanOverrides[featUniqueId];
        } else {
            floorSelect.value = '';
        }
    } else if (_currentLayerType === 'camera') {
        document.getElementById('group-obj-camera-type').style.display = 'block';
        document.getElementById('obj-camera-type').value = properties.Typ || properties.typ || '';
    } else {
        document.getElementById('group-obj-type-generic').style.display = 'block';
        document.getElementById('obj-type').value = properties.Typ || properties.typ || '';
    }
}

document.getElementById('feature-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!_currentProperties) return;

    const idObj   = document.getElementById('obj-id').value;
    const nameObj = document.getElementById('obj-name').value;
    const noteObj = document.getElementById('obj-note').value;

    let typeObj = '';
    if (_currentLayerType === 'camera') {
        typeObj = document.getElementById('obj-camera-type').value;
    } else {
        typeObj = document.getElementById('obj-type').value;
    }

    if ('Nazev' in _currentProperties || !('nazev' in _currentProperties)) _currentProperties.Nazev = nameObj;
    else _currentProperties.nazev = nameObj;
    if ('Typ' in _currentProperties || !('typ' in _currentProperties)) _currentProperties.Typ = typeObj;
    else _currentProperties.typ = typeObj;
    if ('Poznamka' in _currentProperties || !('poznamka' in _currentProperties)) _currentProperties.Poznamka = noteObj;
    else _currentProperties.poznamka = noteObj;

    const photoInput = document.getElementById('obj-photo');
    let photoDataUrl = null;
    if (photoInput.files && photoInput.files[0]) {
        try {
            photoDataUrl = await compressAndGetBase64(photoInput.files[0], 800, 800, 0.7);
            photoInput.value = ''; // vyresetujeme input po zpracování
        } catch (err) {
            console.error('Chyba při kompresi a čtení fotografie:', err);
        }
    }
    
    // --- Uložení do Supabase ---
    if (_currentProperties._table) {
        try {
            let payload = {};
            if ('Nazev' in _currentProperties) payload.Nazev = nameObj;
            else payload.nazev = nameObj;
            
            if ('Typ' in _currentProperties) payload.Typ = typeObj;
            else payload.typ = typeObj;
            
            if ('Poznamka' in _currentProperties) payload.Poznamka = noteObj;
            else payload.poznamka = noteObj;

            let idKey = 'id';
            if ('ID' in _currentProperties) idKey = 'ID';

            const response = await fetch(`${supabaseUrl}/rest/v1/${_currentProperties._table}?${idKey}=eq.${idObj}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Chyba Supabase (PATCH):', errorText);
                showToast('Varování: Změny se nepodařilo uložit do databáze.');
            }
        } catch (err) {
            console.error('Síťová chyba při ukládání do Supabase:', err);
            showToast('Varování: Nelze se spojit s databází.');
        }
    }
    // ---------------------------

    try {
        const featUniqueId = (_currentProperties._table || '') + '_' + idObj;

        if (photoDataUrl && featUniqueId) {
            photoOverrides[featUniqueId] = photoDataUrl;
            localStorage.setItem('pavlinka_photos', JSON.stringify(photoOverrides));
        }

        // Nastavíme fotku do properties pro okamžité zobrazení v detailu
        if (featUniqueId && photoOverrides[featUniqueId]) {
            _currentProperties.Fotografie = photoOverrides[featUniqueId];
        }

        if (_currentLayerType === 'floorplan' && featUniqueId) {
            const floorType = document.getElementById('obj-floor-type').value;
            if (floorType) floorplanOverrides[featUniqueId] = floorType;
            else delete floorplanOverrides[featUniqueId];
            localStorage.setItem('pavlinka_floorplan_overrides', JSON.stringify(floorplanOverrides));
        }

        if (_currentLayerType === 'camera' && featUniqueId) {
            const camType = document.getElementById('obj-camera-type').value;
            if (camType) cameraOverrides[featUniqueId] = camType;
            else delete cameraOverrides[featUniqueId];
            localStorage.setItem('pavlinka_camera_overrides', JSON.stringify(cameraOverrides));
        }

        if (_selectedLayer && typeof _selectedLayer.setStyle === 'function') {
            // Tímto se překreslí vrstva podle nového "Typu"
            _selectedLayer.setStyle(getStyle(_currentProperties, _currentLayerType));
            
            // Pokud to je bodová vrstva, musíme ikonku taky překreslit
            if (_selectedLayer instanceof L.Marker && _selectedLayer.setIcon) {
                if (_currentLayerType === 'camera') {
                    const cameraColors = { '1': '#0da9b4', '2': '#ff5722', '3': '#9c27b0' };
                    const ikonaBarva = cameraColors[typeObj] || '#000000';
                    const cameraIcon = L.divIcon({
                        html: `<i class="ph-fill ph-security-camera" style="color: ${ikonaBarva} !important;"></i>`,
                        className: 'camera-map-icon',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    _selectedLayer.setIcon(cameraIcon);
                }
            }
        }
        // Pokud jsme zrovna na kartě Data a máme vybrané QGIS vrstvy, seznam se aktualizuje
        const tabData = document.getElementById('tab-data');
        if (tabData && tabData.classList.contains('active')) {
            const target = typeof getActiveQueryTarget === 'function' ? getActiveQueryTarget() : 'qgis';
            if (target === 'qgis') {
                renderObjectsList();
            }
        }
    } catch (err) {
        console.error('Chyba při ukládání:', err);
    }

    editForm.style.display = 'none';
    openDetailView(_currentProperties, _currentLayerType);
    showToast('Změny byly uloženy');
});

document.getElementById('close-form-btn').addEventListener('click', () => {
    if (_currentProperties) openDetailView(_currentProperties, _currentLayerType);
    else showTabs();
});

document.getElementById('delete-btn').addEventListener('click', () => {
    if (confirm('Opravdu si přejete tento objekt smazat?')) {
        const table = _currentProperties?._table;
        const idVal = _currentProperties?.ID || _currentProperties?.id;

        if (table && idVal) {
            const idKey = ('ID' in _currentProperties) ? 'ID' : 'id';
            fetch(`${supabaseUrl}/rest/v1/${table}?${idKey}=eq.${idVal}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=minimal'
                }
            }).then(resp => {
                if (resp.ok) {
                    showToast('Objekt byl smazán.');
                } else {
                    resp.text().then(t => console.error('Chyba mazání Supabase:', t));
                    showToast('Chyba při mazání ze serveru.');
                }
            }).catch(err => {
                console.error('Síťová chyba při mazání:', err);
                showToast('Síťová chyba při mazání.');
            });
        } else {
            showToast('Tento objekt nelze smazat (chybí identifikátor).');
        }

        // Odebereme vrstvu z mapy okamžitě
        if (_selectedLayer) {
            _selectedLayer.remove();
            _selectedLayer = null;
        }
        _currentProperties = null;
        showTabs();
    }
});

// Helper for legend key mapping from table name
function getLegendKey(table) {
    if (!table) return null;
    if (table.includes('camera')) return 'camera_point';
    return table.split('_')[0];
}

// Geometry type helper
function getGeometryCategory(geomType) {
    if (!geomType) return 'Ostatní';
    const gt = geomType.toLowerCase();
    if (gt.includes('point')) return 'Body';
    if (gt.includes('line')) return 'Linie';
    if (gt.includes('polygon')) return 'Plochy';
    return 'Ostatní';
}

const geomCategoriesMeta = {
    'Body': { name: 'Body', icon: 'ph-map-pin-line', classModifier: 'body' },
    'Linie': { name: 'Linie', icon: 'ph-line-segment', classModifier: 'linie' },
    'Plochy': { name: 'Plochy', icon: 'ph-polygon', classModifier: 'plochy' },
    'Ostatní': { name: 'Ostatní', icon: 'ph-circle', classModifier: 'ostatni' }
};

function zoomToQgisFeature(table, id) {
    if (!table || !id) return false;
    for (const groupKey in skupinyVrstev) {
        const group = skupinyVrstev[groupKey];
        let foundLayer = null;
        group.eachLayer(layer => {
            if (layer.eachLayer) {
                layer.eachLayer(subLayer => {
                    if (subLayer.feature && subLayer.feature.properties) {
                        const props = subLayer.feature.properties;
                        if (props._table === table && (props.ID === id || props.id === id)) {
                            foundLayer = subLayer;
                        }
                    }
                });
            } else if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                if (props._table === table && (props.ID === id || props.id === id)) {
                    foundLayer = layer;
                }
            }
        });

        if (foundLayer) {
            if (foundLayer.getBounds) {
                map.fitBounds(foundLayer.getBounds(), { maxZoom: 19 });
            } else if (foundLayer.getLatLng) {
                map.setView(foundLayer.getLatLng(), 19);
            }
            foundLayer.fire('click');
            return true;
        }
    }
    return false;
}

// ── Seznam objektů (karta Objekty) ──
function renderObjectsList() {
    const container = document.getElementById('objects-list');
    const groups    = Object.keys(qgisFeaturesData);
    if (groups.length === 0) {
        container.innerHTML = '<div class="objects-empty"><i class="ph ph-layers"></i><p>Zapni nějakou vrstvu na kartě Vrstvy pro zobrazení objektů.</p></div>';
        return;
    }
    let html = '';
    for (const key of groups) {
        const meta     = qgisGroupMeta[key] || { name: key, icon: 'ph-circle', color: '#666' };
        const features = qgisFeaturesData[key];

        // Group features by geometry type
        const grouped = { 'Body': [], 'Linie': [], 'Plochy': [], 'Ostatní': [] };
        for (const props of features) {
            const cat = getGeometryCategory(props._geomType);
            grouped[cat].push(props);
        }

        html += `<div class="objects-group-header"><i class="ph ${meta.icon}"></i> ${meta.name} <span style="margin-left:auto;font-size:10px;opacity:0.6">${features.length}</span></div>`;

        for (const catKey of ['Body', 'Linie', 'Plochy', 'Ostatní']) {
            const catFeatures = grouped[catKey];
            if (catFeatures.length > 0) {
                html += `<div class="objects-subgroup-header objects-subgroup-header--${geomCategoriesMeta[catKey].classModifier}"><i class="ph ${geomCategoriesMeta[catKey].icon}"></i> ${geomCategoriesMeta[catKey].name} <span style="margin-left:auto;font-size:9px;opacity:0.6">${catFeatures.length}</span></div>`;
                for (const props of catFeatures) {
                    const name = props.Nazev || props.nazev || props.ID || props.id || '(bez názvu)';
                    const type = props.Typ   || props.typ   || '';
                    const legendKey = getLegendKey(props._table);
                    html += `<div class="object-item" data-group="${key}" data-props='${JSON.stringify(props).replace(/'/g, '&apos;')}'>`
                          + `<span class="object-item-icon" style="background:${meta.color}"></span>`
                          + `<div class="object-item-info"><div class="object-item-name">${name}</div>${type ? `<div class="object-item-type">${type}</div>` : ''}</div>`
                          + `<div style="display:flex; gap:2px; flex-shrink:0; align-items:center;">`
                          + `<button class="object-item-action-btn zoom-btn" title="Přiblížit na prvek"><i class="ph ph-magnifying-glass-plus"></i></button>`
                          + `${legendKey ? `<button class="object-item-action-btn legend-btn" data-layer="${legendKey}" title="Zobrazit legendu vrstvy"><i class="ph ph-gear"></i></button>` : ''}`
                          + `<button class="object-item-action-btn edit-btn" title="Otevřít detail"><i class="ph ph-pencil-simple"></i></button>`
                          + `</div>`
                          + `</div>`;
                }
            }
        }
    }
    container.innerHTML = html;
    container.querySelectorAll('.object-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.object-item-action-btn') || e.target.closest('.legend-btn')) return;
            try {
                const props     = JSON.parse(item.dataset.props.replace(/&apos;/g, "'"));
                const layerType = item.dataset.group ? item.dataset.group.split('_')[0] : null;
                openDetailView(props, layerType);
            } catch (e) { console.error(e); }
        });

        // Event listener for the zoom button
        const zoomBtn = item.querySelector('.zoom-btn');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const props = JSON.parse(item.dataset.props.replace(/&apos;/g, "'"));
                    zoomToQgisFeature(props._table, props.ID || props.id);
                } catch (err) { console.error(err); }
            });
        }

        // Event listener for the edit button
        const editBtn = item.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const props     = JSON.parse(item.dataset.props.replace(/&apos;/g, "'"));
                    const layerType = item.dataset.group ? item.dataset.group.split('_')[0] : null;
                    openDetailView(props, layerType);
                } catch (err) { console.error(err); }
            });
        }
    });
}
