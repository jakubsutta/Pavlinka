class SolarAnalyzer {
    constructor(map) {
        this.map = map;
        this.marker = null;
        this.active = false;
        this.chartInstance = null;
        
        this.btnStart = document.getElementById('btn-solar-start');
        this.btnClear = document.getElementById('btn-clear-solar');
        this.statusEl = document.getElementById('solar-status');
        this.resultEl = document.getElementById('solar-result');
        
        this.inputArea = document.getElementById('solar-area');
        this.inputSlope = document.getElementById('solar-slope');
        this.inputAzimuth = document.getElementById('solar-azimuth');
        
        this.modeRadios = document.querySelectorAll('input[name="solar-mode"]');
        if (this.modeRadios) {
            this.modeRadios.forEach(r => r.addEventListener('change', (e) => this.onModeChange(e.target.value)));
        }
        this.selectionMode = 'point';
        this.polygon = null;
        
        this.drawListener = this.onDrawComplete.bind(this);
        
        // Setup slider event listeners to update text values instantly
        if (this.inputArea) {
            this.inputArea.addEventListener('input', (e) => {
                document.getElementById('solar-area-val').textContent = `${e.target.value} m²`;
                const kwp = (e.target.value / 5.5).toFixed(1);
                document.getElementById('solar-kwp-val').textContent = kwp;
                if (this.lastLatLng) this.calculateSolar(this.lastLatLng);
            });
        }
        
        if (this.inputSlope) {
            this.inputSlope.addEventListener('input', (e) => {
                document.getElementById('solar-slope-val').textContent = `${e.target.value}°`;
                if (this.lastLatLng) this.calculateSolar(this.lastLatLng);
            });
        }

        if (this.inputAzimuth) {
            this.inputAzimuth.addEventListener('change', () => {
                if (this.lastLatLng) this.calculateSolar(this.lastLatLng);
            });
        }
        
        if (this.btnStart) {
            this.btnStart.addEventListener('click', () => this.toggleSelectionMode());
        }
        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => this.clear());
        }
        
        this.selectionMode = 'point'; // 'point' nebo 'polygon'
        this.lastLatLng = null;
        this.mapClickListener = this.onMapClick.bind(this);
    }
    
    onModeChange(newMode) {
        this.selectionMode = newMode;
        if (newMode === 'polygon') {
            this.inputArea.disabled = true;
            this.inputArea.style.opacity = '0.5';
            document.getElementById('solar-area-label').textContent = 'Plocha střechy (spočítáno z nákresu):';
            if (this.btnStart) this.btnStart.innerHTML = '<i class="ph ph-vector-two"></i> Nakreslit plochu';
        } else {
            this.inputArea.disabled = false;
            this.inputArea.style.opacity = '1';
            document.getElementById('solar-area-label').textContent = 'Plocha střechy (m²):';
            if (this.btnStart) this.btnStart.innerHTML = '<i class="ph ph-target"></i> Zvolit místo na mapě';
        }
        this.cancelSelectionMode();
    }
    
    toggleSelectionMode() {
        this.active = !this.active;
        if (this.active) {
            this.btnStart.innerHTML = '<i class="ph ph-x"></i> Zrušit výběr';
            this.btnStart.classList.add('tab-action-btn--danger');
            this.btnStart.classList.remove('tab-action-btn--confirm');
            
            if (this.selectionMode === 'point') {
                document.getElementById('map').style.cursor = 'crosshair';
                this.map.on('click', this.mapClickListener);
            } else {
                this.map.pm.enableDraw('Polygon', {
                    snappable: true,
                    snapDistance: 20,
                    pathOptions: {
                        color: '#e63946',
                        fillColor: '#e63946',
                        fillOpacity: 0.2,
                        weight: 2
                    },
                    templineStyle: { color: '#e63946', weight: 2, dashArray: '5,5' },
                    hintlineStyle: { color: '#e63946', weight: 2, dashArray: '5,5' }
                });
                this.map.on('pm:create', this.drawListener);
            }
        } else {
            this.cancelSelectionMode();
        }
    }
    
    cancelSelectionMode() {
        this.active = false;
        if (this.btnStart) {
            if (this.selectionMode === 'polygon') {
                this.btnStart.innerHTML = '<i class="ph ph-vector-two"></i> Nakreslit plochu';
            } else {
                this.btnStart.innerHTML = '<i class="ph ph-target"></i> Zvolit místo na mapě';
            }
            this.btnStart.classList.remove('tab-action-btn--danger');
            this.btnStart.classList.add('tab-action-btn--confirm');
        }
        document.getElementById('map').style.cursor = '';
        this.map.off('click', this.mapClickListener);
        
        if (this.map.pm) {
            this.map.pm.disableDraw();
        }
        this.map.off('pm:create', this.drawListener);
    }
    
    clear() {
        if (this.marker) {
            this.map.removeLayer(this.marker);
            this.marker = null;
        }
        if (this.polygon) {
            this.map.removeLayer(this.polygon);
            this.polygon = null;
        }
        
        // Občas Geoman zanechá vrstvy, proto smažeme i vrstvy v módu kreslení
        this.map.eachLayer((layer) => {
            if (layer.pm && layer._drawnByGeoman) {
                this.map.removeLayer(layer);
            }
        });

        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
        this.lastLatLng = null;
        if (this.resultEl) this.resultEl.style.display = 'none';
        if (this.btnClear) this.btnClear.style.display = 'none';
        if (this.statusEl) this.statusEl.style.display = 'none';
    }
    
    async onDrawComplete(e) {
        if (e.shape !== 'Polygon') return;
        this.cancelSelectionMode();
        
        if (this.polygon) {
            this.map.removeLayer(this.polygon);
        }
        if (this.marker) {
            this.map.removeLayer(this.marker);
            this.marker = null;
        }
        
        this.polygon = e.layer;
        
        // Stylování nakresleného polygonu (sluneční oranžová)
        this.polygon.setStyle({
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.35,
            weight: 2
        });
        
        const latlngs = this.polygon.getLatLngs()[0];
        
        // Výpočet reálné plochy přes funkci z tools.js
        let area = 30;
        if (typeof getSphericalArea === 'function') {
            area = getSphericalArea(latlngs);
        }
        
        // Update posuvníku
        if (area > parseFloat(this.inputArea.max)) {
            this.inputArea.max = Math.ceil(area);
        }
        this.inputArea.value = area;
        
        const event = new Event('input');
        this.inputArea.dispatchEvent(event);
        
        const center = this.polygon.getBounds().getCenter();
        this.lastLatLng = center;
        
        await this.calculateSolar(center);
    }
    
    async onMapClick(e) {
        this.cancelSelectionMode();
        
        const latlng = e.latlng;
        this.lastLatLng = latlng;
        
        if (this.polygon) {
            this.map.removeLayer(this.polygon);
            this.polygon = null;
        }
        
        if (this.marker) {
            this.marker.setLatLng(latlng);
        } else {
            const iconHtml = `<div style="background:#f59e0b;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 6px rgba(0,0,0,0.3); border:2px solid white;"><i class="ph-bold ph-sun" style="font-size:16px;"></i></div>`;
            this.marker = L.marker(latlng, {
                icon: L.divIcon({ html: iconHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15] })
            }).addTo(this.map);
        }
        
        await this.calculateSolar(latlng);
    }
    
    async calculateSolar(latlng) {
        this.statusEl.style.display = 'block';
        this.resultEl.style.display = 'none';
        
        const area = parseFloat(this.inputArea.value) || 30;
        const slope = parseFloat(this.inputSlope.value) || 35;
        const azimuth = parseFloat(this.inputAzimuth.value) || 0;
        
        // 1 kWp vyžaduje zhruba 5.5 m2 moderních panelů
        const peakPower = area / 5.5;
        
        try {
            // Volání EU PVGIS API (zdarma, bez klíče)
            // Vysvětlení parametrů:
            // lat, lon = souřadnice
            // peakpower = instalovaný výkon (kWp)
            // loss = systémové ztráty (standardně se bere 14%)
            // angle = sklon panelů
            // aspect = azimut (0 = Jih, 90 = Západ, -90 = Východ, -180 = Sever)
            const targetUrl = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${latlng.lat}&lon=${latlng.lng}&peakpower=${peakPower.toFixed(2)}&loss=14&angle=${slope}&aspect=${azimuth}&outputformat=json`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error('Není možné získat data z PVGIS');
            }
            
            const data = await response.json();
            
            const annualProduction = data.outputs.totals.fixed.E_y; // kWh per year
            const monthlyData = data.outputs.monthly.fixed.map(m => m.E_m);
            const months = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
            
            // Finanční úspora (předpoklad průměrné ceny cca 6 Kč/kWh vč. distribuce atd.)
            const pricePerKwh = 6.0;
            const savings = Math.round(annualProduction * pricePerKwh);
            
            // Zobrazení výsledků
            document.getElementById('solar-annual-val').textContent = Math.round(annualProduction).toLocaleString('cs-CZ');
            document.getElementById('solar-power-val').textContent = peakPower.toFixed(2);
            document.getElementById('solar-saving-val').textContent = savings.toLocaleString('cs-CZ');
            
            this.renderChart(months, monthlyData);
            
            this.statusEl.style.display = 'none';
            this.resultEl.style.display = 'block';
            this.btnClear.style.display = 'block';
            
        } catch (err) {
            console.error(err);
            if (typeof showToast === 'function') showToast('Chyba při výpočtu solárního potenciálu: ' + err.message);
            this.statusEl.style.display = 'none';
        }
    }
    
    renderChart(labels, dataArray) {
        const ctx = document.getElementById('solarChart').getContext('2d');

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)'); // #f59e0b (oranžová/žlutá pro slunce)
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.2)');

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Výroba (kWh)',
                    data: dataArray,
                    backgroundColor: gradient,
                    borderRadius: 4,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(0) + ' kWh';
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            callback: function(value) { return value + ' kWh'; }
                        }
                    }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const interval = setInterval(() => {
        if (typeof map !== 'undefined' && typeof Chart !== 'undefined') {
            clearInterval(interval);
            window.solarAnalyzer = new SolarAnalyzer(map);
        }
    }, 500);
});
