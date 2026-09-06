/* 
=================================================
  ELEVATION PROFILE TOOL
  Propojení s ČÚZK DMR 5G a Chart.js
=================================================
*/

let elevationProfileActive = false;
let currentElevationLayer = null;
let elevationChartInstance = null;

function toggleElevationProfileTool() {
    elevationProfileActive = !elevationProfileActive;
    
    const startBtn = document.getElementById('btn-elevation-start');

    if (elevationProfileActive) {
        if (startBtn) {
            startBtn.classList.add('active');
            startBtn.classList.replace('tab-action-btn--confirm', 'tab-action-btn--danger');
            startBtn.innerHTML = '<i class="ph ph-stop"></i> Ukončit trasování';
        }

        // Ujistíme se, že jsme v záložce Nástroje a pod-záložce Profil
        const nastrojeTabBtn = document.querySelector('.tab-btn[data-tab="poznamky"]');
        if (nastrojeTabBtn && !nastrojeTabBtn.classList.contains('active')) nastrojeTabBtn.click();
        
        const profileSwitchBtn = document.querySelector('.notes-switch-btn[data-notes-mode="profile"]');
        if (profileSwitchBtn && !profileSwitchBtn.classList.contains('active')) profileSwitchBtn.click();

        // Přidat posluchač pro styling nově přidaných lomových bodů
        map.once('pm:drawstart', (e) => {
            if (e.workingLayer) {
                e.workingLayer.on('pm:vertexadded', (v) => {
                    if (v.marker && v.marker.setStyle) {
                        v.marker.setStyle({
                            radius: 4,
                            color: '#e63946',
                            fillColor: '#fff',
                            fillOpacity: 1,
                            weight: 2
                        });
                    }
                });
            }
        });

        // Zapnout kreslení linie přes Geoman
        map.pm.enableDraw('Line', {
            snappable: true,
            snapDistance: 20,
            allowSelfIntersection: true,
            finishOn: 'dblclick',
            templineStyle: { color: '#e63946', weight: 2, dashArray: '6, 6' },
            hintlineStyle: { color: '#e63946', weight: 2, dashArray: '6, 6' },
            pathOptions: { color: '#e63946', weight: 2, dashArray: '6, 6' },
            markerStyle: {
                radius: 4,
                color: '#e63946',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2
            }
        });
        
        // Změna kurzoru
        document.getElementById('map').style.cursor = 'crosshair';
        
        // Připojení eventu pro dokončení
        map.on('pm:create', onElevationLineCreated);

    } else {
        // Vypnout nástroj
        map.pm.disableDraw();
        map.off('pm:create', onElevationLineCreated);
        document.getElementById('map').style.cursor = '';
        
        if (startBtn) {
            startBtn.classList.remove('active');
            startBtn.classList.replace('tab-action-btn--danger', 'tab-action-btn--confirm');
            startBtn.innerHTML = '<i class="ph ph-play"></i> Zahájit trasování';
        }
        
        if (currentElevationLayer) {
            map.removeLayer(currentElevationLayer);
            currentElevationLayer = null;
        }
        
        resetElevationPanel();
    }
}

function onElevationLineCreated(e) {
    if (e.shape !== 'Line') return;

    // Odstranit předchozí linii, pokud existuje
    if (currentElevationLayer) {
        map.removeLayer(currentElevationLayer);
    }
    
    currentElevationLayer = e.layer;
    
    // Přidat do vrstvy mapy s hezkým stylem
    currentElevationLayer.setStyle({ color: '#e63946', weight: 3, dashArray: '6, 6' });
    
    // Deaktivovat kreslení pro zabránění dalších čar
    map.pm.disableDraw();
    document.getElementById('map').style.cursor = '';

    const latlngs = currentElevationLayer.getLatLngs();
    if (latlngs.length < 2) return;

    fetchElevationData(latlngs);
}

async function fetchElevationData(latlngs) {
    // UI - Loading state
    document.getElementById('elevation-profile-idle').style.display = 'none';
    document.getElementById('elevation-profile-container').style.display = 'none';
    document.getElementById('elevation-profile-loading').style.display = 'flex';

    try {
        // Výpočet skutečné vzdálenosti linie pro osu X (v metrech)
        let totalDistance = 0;
        const distances = [0];
        for (let i = 0; i < latlngs.length - 1; i++) {
            const dist = latlngs[i].distanceTo(latlngs[i+1]);
            totalDistance += dist;
            distances.push(totalDistance);
        }

        // Vygenerování přesně 100 bodů podél trasy pro API OpenTopoData
        const sampleCount = 100;
        const step = totalDistance / (sampleCount - 1);
        const sampledLatLngs = [];

        for (let i = 0; i < sampleCount; i++) {
            const targetDist = i * step;
            // Najít segment, ve kterém se nacházíme
            let segmentIdx = 0;
            while (segmentIdx < distances.length - 1 && distances[segmentIdx + 1] < targetDist) {
                segmentIdx++;
            }
            
            const startPt = latlngs[segmentIdx];
            if (segmentIdx >= latlngs.length - 1) {
                sampledLatLngs.push(latlngs[latlngs.length - 1]);
                continue;
            }
            
            const endPt = latlngs[segmentIdx + 1];
            const segmentStartDist = distances[segmentIdx];
            const segmentLength = distances[segmentIdx + 1] - segmentStartDist;
            
            let ratio = 0;
            if (segmentLength > 0) {
                ratio = (targetDist - segmentStartDist) / segmentLength;
            }
            
            const lat = startPt.lat + (endPt.lat - startPt.lat) * ratio;
            const lng = startPt.lng + (endPt.lng - startPt.lng) * ratio;
            sampledLatLngs.push(L.latLng(lat, lng));
        }

        // Převod bodů do Web Mercator (EPSG:3857) pro ČÚZK
        const path3857 = sampledLatLngs.map(ll => {
            const pt = L.CRS.EPSG3857.project(ll);
            return [pt.x, pt.y];
        });

        const geometry = {
            "points": path3857,
            "spatialReference": {"wkid": 3857}
        };

        // Použití vysoce přesného modelu DMR 5G od ČÚZK přes identify endpoint (gov.cz podporuje CORS)
        const url = `https://ags.cuzk.gov.cz/arcgis/rest/services/3D/dmr5g_wm/ImageServer/identify?f=json&geometryType=esriGeometryMultipoint&returnGeometry=false&geometry=${encodeURIComponent(JSON.stringify(geometry))}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Chyba při dotazu na výšková data');

        const data = await response.json();
        if (data.error) throw new Error(data.error.message || 'Chyba v datech od ČÚZK');
        
        if (!data.results || data.results.length === 0) {
            throw new Error('Nebyly nalezeny žádné výškové body.');
        }

        // Zpracování dat z ČÚZK
        const elevations = data.results.map(r => r.value && r.value !== "NoData" ? parseFloat(r.value) : 0);
        
        // Vytvoření štítků osy X (vzdálenost podél linie)
        const labels = elevations.map((_, i) => (i * step).toFixed(0));

        // Nalezení indexů pro původní lomové body (aby šly zvýraznit v grafu a mapě)
        const breakPointIndices = [];
        distances.forEach(d => {
            const closestI = Math.round(d / step);
            if (closestI >= 0 && closestI < sampleCount) breakPointIndices.push(closestI);
        });
        
        // Zobrazení lomových bodů a jejich dat přímo v mapě přes Tooltipy
        if (!window.elevationMarkersGroup) {
            window.elevationMarkersGroup = L.layerGroup().addTo(map);
        } else {
            window.elevationMarkersGroup.clearLayers();
        }
        
        latlngs.forEach((ll, idx) => {
            const dist = distances[idx];
            let mappedIdx = breakPointIndices[idx];
            if (mappedIdx === undefined) mappedIdx = breakPointIndices[breakPointIndices.length - 1];
            const elev = elevations[mappedIdx];
            
            const tooltipText = `<b>${dist.toFixed(0)} m</b><br>${elev.toFixed(1)} m n.m.`;
            L.circleMarker(ll, {
                radius: 4,
                color: '#e63946',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2
            }).bindTooltip(tooltipText, { permanent: true, direction: 'top', className: 'elevation-marker-tooltip', offset: [0, -5] })
              .addTo(window.elevationMarkersGroup);
        });

        // Statistiky
        const maxElev = Math.max(...elevations);
        const minElev = Math.min(...elevations);

        // UI update
        document.getElementById('elev-stat-distance').textContent = `${totalDistance >= 1000 ? (totalDistance/1000).toFixed(2) + ' km' : Math.round(totalDistance) + ' m'}`;
        document.getElementById('elev-stat-max').textContent = `${maxElev.toFixed(1)} m`;
        document.getElementById('elev-stat-min').textContent = `${minElev.toFixed(1)} m`;

        document.getElementById('elevation-profile-loading').style.display = 'none';
        document.getElementById('elevation-profile-container').style.display = 'block';

        renderElevationChart(labels, elevations, breakPointIndices);

    } catch (error) {
        console.error('Chyba výškového profilu:', error);
        if (typeof showToast === 'function') showToast('Nepodařilo se načíst data o výšce. ' + error.message);
        document.getElementById('elevation-profile-loading').style.display = 'none';
        
        // Necháme kontejner zobrazený, aby šlo kliknout na "Smazat profil", 
        // ale skryjeme statistiky a graf, nebo je resetujeme
        document.getElementById('elevation-profile-container').style.display = 'flex';
        document.getElementById('elev-stat-distance').textContent = '-';
        document.getElementById('elev-stat-max').textContent = '-';
        document.getElementById('elev-stat-min').textContent = '-';
        if (elevationChartInstance) {
            elevationChartInstance.destroy();
            elevationChartInstance = null;
        }
        
        // Deaktivujeme profil
        elevationProfileActive = false;
        map.pm.disableDraw();
        document.getElementById('map').style.cursor = '';
    }
}

function renderElevationChart(labels, dataArray, breakPointIndices) {
    const ctx = document.getElementById('elevationChart').getContext('2d');

    // Zničit předchozí instanci grafu, pokud existuje
    if (elevationChartInstance) {
        elevationChartInstance.destroy();
    }

    // Gradient výplně
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(80, 200, 120, 0.4)'); // var(--accent)
    gradient.addColorStop(1, 'rgba(80, 200, 120, 0.0)');

    elevationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nadmořská výška (m)',
                data: dataArray,
                borderColor: '#e63946',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: dataArray.map((_, i) => breakPointIndices.includes(i) ? 4 : 0),
                pointBackgroundColor: '#fff',
                pointHoverRadius: dataArray.map((_, i) => breakPointIndices.includes(i) ? 6 : 5),
                pointHoverBackgroundColor: '#e63946',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                fill: true,
                tension: 0.3 // Lehce vyhlazená křivka
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false // Skryjeme legendu, text je jasný z UI
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 13, family: 'Roboto' },
                    bodyFont: { size: 14, weight: 'bold', family: 'Roboto' },
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            return 'Vzdálenost: ' + context[0].label + ' m';
                        },
                        label: function(context) {
                            return context.parsed.y.toFixed(1) + ' m n. m.';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Vzdálenost (m)',
                        color: '#666',
                        font: { size: 12, family: 'Roboto', weight: 'bold' }
                    },
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 6,
                        color: '#888',
                        font: { size: 11, family: 'Roboto' },
                        callback: function(value, index, values) {
                            // Přidání "m" za číslo
                            return this.getLabelForValue(value) + ' m';
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Nadmořská výška (m n.m.)',
                        color: '#666',
                        font: { size: 12, family: 'Roboto', weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#888',
                        font: { size: 11, family: 'Roboto' },
                        callback: function(value) {
                            return value + ' m';
                        }
                    }
                }
            }
        }
    });
}

function resetElevationPanel() {
    document.getElementById('elevation-profile-container').style.display = 'none';
    document.getElementById('elevation-profile-loading').style.display = 'none';
    document.getElementById('elevation-profile-idle').style.display = 'flex';
    if (window.elevationMarkersGroup) {
        window.elevationMarkersGroup.clearLayers();
    }
    
    if (elevationChartInstance) {
        elevationChartInstance.destroy();
        elevationChartInstance = null;
    }
}

// Obsluha tlačítka pro smazání
document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('btn-elevation-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (currentElevationLayer) {
                map.removeLayer(currentElevationLayer);
                currentElevationLayer = null;
            }
            resetElevationPanel();
            
            // Pokud je nástroj stále zapnutý, umožnit znovu kreslit
            if (elevationProfileActive) {
                map.pm.enableDraw('Line');
                document.getElementById('map').style.cursor = 'crosshair';
            }
        });
    }

    const startBtn = document.getElementById('btn-elevation-start');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            toggleElevationProfileTool();
        });
    }
    
    const exportBtn = document.getElementById('btn-elevation-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (elevationChartInstance) {
                const a = document.createElement('a');
                a.href = elevationChartInstance.toBase64Image();
                a.download = 'vyskovy_profil.png';
                a.click();
            }
        });
    }
});
