// ============================================================
// init.js – Inicializace a obnova stavu po načtení stránky
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    // 0. Inicializace sliderů pro průhlednost vrstev

    // 1. Basemap
    const savedBasemap = localStorage.getItem('pavlinka_basemap');
    if (savedBasemap) {
        const radio = document.querySelector(`input[name="basemap"][value="${savedBasemap}"]`);
        if (radio) {
            radio.checked = true;
        }
    }
    // Vždy odpálíme change event pro aktivní mapu na začátku (pro inicializaci UI info bloku a widgetu)
    const activeRadio = document.querySelector('input[name="basemap"]:checked');
    if (activeRadio) {
        activeRadio.dispatchEvent(new Event('change'));
    }

    // 2. WMS překryvné vrstvy
    try {
        const savedWms = JSON.parse(localStorage.getItem('pavlinka_wms'));
        if (savedWms && Array.isArray(savedWms)) {
            savedWms.forEach(id => {
                const cb = document.getElementById(id);
                if (cb) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        }
    } catch (e) { }

    // 3. QGIS (Supabase) vrstvy
    try {
        const savedQgis = JSON.parse(localStorage.getItem('pavlinka_qgis'));
        if (savedQgis && Array.isArray(savedQgis)) {
            savedQgis.forEach(val => {
                const cb = document.querySelector(`.qgis-layer[value="${val}"]`);
                if (cb) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        }
    } catch (e) { }

    // 4. Obnova rozbalených skupin a podskupin v menu
    try {
        const expandedStateStr = localStorage.getItem('pavlinka_expanded_groups');
        if (expandedStateStr) {
            const expandedState = JSON.parse(expandedStateStr);
            if (expandedState.main && Array.isArray(expandedState.main)) {
                expandedState.main.forEach(id => {
                    const header = document.getElementById(id);
                    if (header) {
                        const content = header.nextElementSibling;
                        if (content && content.classList.contains('is-collapsed')) {
                            content.classList.remove('is-collapsed');
                            const icon = header.querySelector('.toggle-icon');
                            if (icon) {
                                icon.classList.remove('ph-caret-double-down');
                                icon.classList.add('ph-caret-double-up');
                            }
                        }
                    }
                });
            }
            if (expandedState.sub && Array.isArray(expandedState.sub)) {
                expandedState.sub.forEach(groupId => {
                    const children = document.querySelectorAll('.subgroup-child.' + groupId);
                    if (children.length > 0) {
                        children.forEach(child => child.classList.add('is-visible'));
                        const masterCb = document.querySelector(`.subgroup-master[data-subgroup="${groupId}"]`);
                        if (masterCb) {
                            const parentLabel = masterCb.closest('.subgroup-parent');
                            if (parentLabel) {
                                const icon = parentLabel.querySelector('.subgroup-toggle');
                                if (icon) icon.classList.add('is-collapsed-icon');
                            }
                        }
                    }
                });
            }
        }
    } catch (e) { }

    // 5. Naposledy otevřená záložka
    let savedTab = localStorage.getItem('pavlinka_tab');
    if (savedTab === 'mereni' || savedTab === 'kresleni') {
        const mappedNotesMode = savedTab === 'mereni' ? 'measure' : 'draw';
        localStorage.setItem('pavlinka_notes_mode', mappedNotesMode);
        savedTab = 'poznamky';
        localStorage.setItem('pavlinka_tab', 'poznamky');
    }
    if (savedTab) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
        if (tabBtn) tabBtn.click();
    }
});

// Inicializace prvků, tooltipů a globální event listenery
document.addEventListener('DOMContentLoaded', () => {
    // ONE-TIME CLEANUP: Odstranění zbloudilých testovacích solárních polygonů z localStorage
    try {
        const saved = localStorage.getItem('pavlinka_drawings');
        if (saved) {
            const geojson = JSON.parse(saved);
            const filteredFeatures = geojson.features.filter(f => {
                // Smazat polygony z předchozích testů (barva #e63946 a bez poznámky, typ Polygon)
                const isOrphanedSolar = f.geometry.type === 'Polygon' && f.properties.color === '#e63946' && (!f.properties.note || f.properties.note === '');
                return !isOrphanedSolar;
            });
            if (filteredFeatures.length !== geojson.features.length) {
                geojson.features = filteredFeatures;
                localStorage.setItem('pavlinka_drawings', JSON.stringify(geojson));
            }
        }
    } catch (e) { }

    const defaultTheme = localStorage.getItem('pavlinka_theme') || 'light';
});

// ── Skrytí preloaderu po úplném načtení ──
window.addEventListener('load', () => {
    const preloader = document.getElementById('app-preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('hidden');
        }, 800); // Mírná prodleva pro plynulý dojem
    }
});
