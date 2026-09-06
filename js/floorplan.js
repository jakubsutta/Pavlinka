import React, { useState, useEffect, useRef, createElement } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import * as ExcalidrawLib from "https://esm.sh/@excalidraw/excalidraw@0.17.6?deps=react@18.2.0,react-dom@18.2.0";
const Excalidraw = ExcalidrawLib.Excalidraw || ExcalidrawLib.default?.Excalidraw || ExcalidrawLib.default;

// --- GLOBAL STATE ---
let currentFloor = 'sklep';
let excalidrawApi = null;
let root = null;
let savedDataMap = {}; // InMemory cache

// --- SUPABASE CONFIG ---
// Zde používáme existující globální proměnné ze config.js

async function fetchFloorplans() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/pudorysy?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Cache-Control': 'no-cache'
            }
        });
        if (response.ok) {
            const data = await response.json();
            savedDataMap = {};
            data.forEach(row => {
                savedDataMap[row.patro] = row.data;
            });
        } else {
            console.warn('Tabulka pudorysy možná neexistuje nebo je chyba spojení.');
        }
    } catch (err) {
        console.error('Chyba při stahování půdorysů:', err);
    }
}

async function saveFloorplanToDB(patro, excalidrawElements, appState) {
    if (!supabaseUrl || !supabaseKey) return;
    try {
        const payload = {
            patro: patro,
            data: { elements: excalidrawElements, appState: { viewBackgroundColor: appState.viewBackgroundColor } }
        };
        // Upsert pomocí POST a On-Conflict
        const response = await fetch(`${supabaseUrl}/rest/v1/pudorysy`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            console.error('Chyba uložení do Supabase:', await response.text());
            if (typeof showToast === 'function') showToast('Chyba při ukládání půdorysu na server.');
        } else {
            if (typeof showToast === 'function') showToast('Půdorys úspěšně uložen.');
        }
    } catch (err) {
        console.error('Síťová chyba při ukládání:', err);
        if (typeof showToast === 'function') showToast('Síťová chyba při ukládání půdorysu.');
    }
}

// --- REACT COMPONENT ---
function FloorplanApp() {
    const [initialData, setInitialData] = useState(null);
    const [floor, setFloor] = useState(currentFloor);

    // Načteme data pro aktuální patro
    useEffect(() => {
        if (savedDataMap[floor]) {
            setInitialData(savedDataMap[floor]);
        } else {
            // Prázdný canvas
            setInitialData({ elements: [], appState: {} });
        }
    }, [floor]);

    // Globální funkce pro přepnutí patra z vnějšího UI (Vanilla JS tlačítka)
    window.switchFloorplanFloor = (newFloor) => {
        // Nejprve uložíme do in-memory aktuální stav
        if (excalidrawApi) {
            const elements = excalidrawApi.getSceneElements();
            const appState = excalidrawApi.getAppState();
            savedDataMap[currentFloor] = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor } };
            
            // Nahrajeme data pro nové patro přímo do Excalidraw
            const newData = savedDataMap[newFloor] || { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
            excalidrawApi.updateScene(newData);
        }
        currentFloor = newFloor;
        setFloor(newFloor);
    };

    // Uložení na server
    window.saveCurrentFloorplan = async () => {
        if (excalidrawApi) {
            const elements = excalidrawApi.getSceneElements();
            const appState = excalidrawApi.getAppState();
            savedDataMap[currentFloor] = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor } };
            
            const saveBtnIcon = document.querySelector('#btn-save-floorplan i');
            if (saveBtnIcon) {
                saveBtnIcon.className = 'ph ph-spinner ph-spin';
            }
            
            await saveFloorplanToDB(currentFloor, elements, appState);
            
            if (saveBtnIcon) {
                saveBtnIcon.className = 'ph ph-floppy-disk';
            }
        }
    };

    if (!initialData) return null;

    return createElement(
        'div',
        { style: { width: '100%', height: '100%' } },
        createElement(Excalidraw, {
            initialData: initialData,
            langCode: 'cs-CZ',
            excalidrawAPI: (api) => {
                excalidrawApi = api;
            },
            UIOptions: {
                canvasActions: {
                    loadScene: false,
                    saveToActiveFile: false,
                    export: { saveFileToDisk: true }
                }
            }
        })
    );
}

// --- INITIALIZATION ---
async function initFloorplan() {
    await fetchFloorplans();
    const container = document.getElementById('excalidraw-container');
    const loader = document.getElementById('floorplan-loader');
    if (loader) loader.style.display = 'none';

    root = createRoot(container);
    root.render(createElement(FloorplanApp));
}

// --- DOM BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Globální otevření
    window.openFloorplanModal = () => {
        const overlay = document.getElementById('floorplan-modal-overlay');
        overlay.classList.remove('hidden');
        
        // Zvýraznění tlačítka v mapě (přidání třídy active)
        const toggleBtn = document.getElementById('floorplan-toggle-btn');
        if (toggleBtn) toggleBtn.classList.add('active');

        if (!root) {
            initFloorplan();
        } else {
            // Jen fetch na pozadí a refresh dat, kdyby někdo jiný upravoval
            fetchFloorplans().then(() => {
                if (window.switchFloorplanFloor) {
                    window.switchFloorplanFloor(currentFloor); // force refresh of active
                }
            });
        }
    };

    // Zavření
    const closeBtn = document.getElementById('btn-close-floorplan');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('floorplan-modal-overlay').classList.add('hidden');
            
            // Zrušení zvýraznění tlačítka v mapě
            const toggleBtn = document.getElementById('floorplan-toggle-btn');
            if (toggleBtn) toggleBtn.classList.remove('active');
        });
    }

    // Přepínání pater
    const floorTabs = document.querySelectorAll('#floorplan-tabs .draw-tool-btn');
    floorTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Změna active classy
            floorTabs.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Volání Reactu
            if (window.switchFloorplanFloor) {
                window.switchFloorplanFloor(e.currentTarget.dataset.floor);
            }
        });
    });

    // Ukládání
    const saveBtn = document.getElementById('btn-save-floorplan');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (window.saveCurrentFloorplan) {
                window.saveCurrentFloorplan();
            }
        });
    }
});
