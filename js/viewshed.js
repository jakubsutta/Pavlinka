class ViewshedAnalyzer {
    constructor(map) {
        this.map = map;
        this.overlay = null;
        this.marker = null;
        this.active = false;
        
        this.btnStart = document.getElementById('btn-viewshed-start');
        this.btnClear = document.getElementById('btn-clear-viewshed');
        this.statusEl = document.getElementById('viewshed-status');
        this.resultEl = document.getElementById('viewshed-result');
        
        if (this.btnStart) {
            this.btnStart.addEventListener('click', () => this.toggleSelectionMode());
        }
        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => this.clear());
        }
        
        this.mapClickListener = this.onMapClick.bind(this);
    }
    
    toggleSelectionMode() {
        this.active = !this.active;
        if (this.active) {
            this.btnStart.innerHTML = '<i class="ph ph-x"></i> Zrušit výběr bodu';
            this.btnStart.classList.add('tab-action-btn--danger');
            this.btnStart.classList.remove('tab-action-btn--confirm');
            document.getElementById('map').style.cursor = 'crosshair';
            this.map.on('click', this.mapClickListener);
        } else {
            this.cancelSelectionMode();
        }
    }
    
    cancelSelectionMode() {
        this.active = false;
        if (this.btnStart) {
            this.btnStart.innerHTML = '<i class="ph ph-target"></i> Zvolit bod na mapě';
            this.btnStart.classList.remove('tab-action-btn--danger');
            this.btnStart.classList.add('tab-action-btn--confirm');
        }
        document.getElementById('map').style.cursor = '';
        this.map.off('click', this.mapClickListener);
    }
    
    clear() {
        if (this.overlay) {
            this.map.removeLayer(this.overlay);
            this.overlay = null;
        }
        if (this.marker) {
            this.map.removeLayer(this.marker);
            this.marker = null;
        }
        if (this.resultEl) this.resultEl.style.display = 'none';
        if (this.btnClear) this.btnClear.style.display = 'none';
    }
    
    async onMapClick(e) {
        this.cancelSelectionMode();
        this.clear();
        
        const latlng = e.latlng;
        
        // Vlastní marker
        const iconHtml = `<div style="background:var(--accent);color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 6px rgba(0,0,0,0.3); border:2px solid white;"><i class="ph-bold ph-map-pin-simple-area" style="font-size:16px;"></i></div>`;
        this.marker = L.marker(latlng, {
            icon: L.divIcon({ html: iconHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15] })
        }).addTo(this.map);
        
        const observerHeight = parseFloat(document.getElementById('viewshed-observer-height').value) || 1.7;
        const obstacleHeight = parseFloat(document.getElementById('viewshed-obstacle-height').value) || 1.0;
        const radiusMeters = 5000; 
        
        this.statusEl.style.display = 'block';
        try {
            await this.calculateViewshed(latlng, observerHeight, obstacleHeight, radiusMeters);
        } catch (err) {
            console.error(err);
            if (typeof showToast === 'function') showToast('Chyba při výpočtu viditelnosti: ' + err.message);
        }
        this.statusEl.style.display = 'none';
    }
    
    async calculateViewshed(centerLatLng, observerHeight, obstacleHeight, radiusMeters) {
        const zoom = 13; // Zvýšeno na zoom 13 (cca 12m / pixel) pro reálnější hrboly a překážky
        
        function lon2tile(lon, zoom) { return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom))); }
        function lat2tile(lat, zoom) { return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))); }
        function tile2lon(x, z) { return (x / Math.pow(2, z) * 360 - 180); }
        function tile2lat(y, z) { var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))); }
        
        const latDelta = (radiusMeters / 111000);
        const lonDelta = (radiusMeters / (111000 * Math.cos(centerLatLng.lat * Math.PI / 180)));
        
        const minLat = centerLatLng.lat - latDelta;
        const maxLat = centerLatLng.lat + latDelta;
        const minLon = centerLatLng.lng - lonDelta;
        const maxLon = centerLatLng.lng + lonDelta;
        
        const minX = lon2tile(minLon, zoom);
        const maxX = lon2tile(maxLon, zoom);
        const minY = lat2tile(maxLat, zoom); 
        const maxY = lat2tile(minLat, zoom); 
        
        const cols = maxX - minX + 1;
        const rows = maxY - minY + 1;
        
        const TILE_SIZE = 256;
        const canvasWidth = cols * TILE_SIZE;
        const canvasHeight = rows * TILE_SIZE;
        
        if (cols * rows > 36) {
            throw new Error("Příliš velká oblast. Omezte poloměr.");
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const promises = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                promises.push(new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
                    img.onload = () => {
                        const px = (x - minX) * TILE_SIZE;
                        const py = (y - minY) * TILE_SIZE;
                        ctx.drawImage(img, px, py);
                        resolve();
                    };
                    img.onerror = () => resolve();
                }));
            }
        }
        
        await Promise.all(promises);
        
        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imgData.data;
        const elevations = new Float32Array(canvasWidth * canvasHeight);
        
        let validPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            // Check if pixel is empty (0,0,0,0) - happens on error or no data
            if (data[i+3] === 0) {
                elevations[i/4] = -9999;
            } else {
                elevations[i/4] = (data[i] * 256 + data[i+1] + data[i+2] / 256) - 32768;
                validPixels++;
            }
        }
        
        if (validPixels === 0) throw new Error("Chyba při stahování výškopisných dat z Amazon S3.");
        
        const centerTileXFraction = (centerLatLng.lng + 180) / 360 * Math.pow(2, zoom);
        const centerTileYFraction = (1 - Math.log(Math.tan(centerLatLng.lat * Math.PI / 180) + 1 / Math.cos(centerLatLng.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
        
        const cx = Math.floor((centerTileXFraction - minX) * TILE_SIZE);
        const cy = Math.floor((centerTileYFraction - minY) * TILE_SIZE);
        
        let baseElevation = elevations[cy * canvasWidth + cx];
        if (baseElevation === -9999) throw new Error("V tomto bodě nejsou dostupná výšková data (z globálního modelu).");
        
        // Zpřesnění počáteční výšky přes ČÚZK DMR 5G
        try {
            const pt = L.CRS.EPSG3857.project(centerLatLng);
            const geometry = {
                "points": [[pt.x, pt.y]],
                "spatialReference": {"wkid": 3857}
            };
            const cuzkUrl = `https://ags.cuzk.gov.cz/arcgis/rest/services/3D/dmr5g_wm/ImageServer/identify?f=json&geometryType=esriGeometryMultipoint&returnGeometry=false&geometry=${encodeURIComponent(JSON.stringify(geometry))}`;
            const cuzkRes = await fetch(cuzkUrl);
            const cuzkData = await cuzkRes.json();
            if (cuzkData.results && cuzkData.results.length > 0 && cuzkData.results[0].value && cuzkData.results[0].value !== "NoData") {
                const cuzkElevation = parseFloat(cuzkData.results[0].value);
                console.log(`Výška z globálního modelu: ${baseElevation.toFixed(2)} m. Přesná výška z ČÚZK: ${cuzkElevation.toFixed(2)} m`);
                baseElevation = cuzkElevation;
            }
        } catch (e) {
            console.warn("Nepodařilo se získat přesnou výšku z ČÚZK, použije se globální model.", e);
        }
        
        const centerElevation = baseElevation + observerHeight;
        
        const resCanvas = document.createElement('canvas');
        resCanvas.width = canvasWidth;
        resCanvas.height = canvasHeight;
        const resCtx = resCanvas.getContext('2d');
        const resImgData = resCtx.createImageData(canvasWidth, canvasHeight);
        const resData = resImgData.data;
        
        const getElev = (px, py) => {
            if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) return -9999;
            return elevations[py * canvasWidth + px];
        };
        
        const metersPerPx = 40075016 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom + 8);
        const pxRadius = Math.ceil(radiusMeters / metersPerPx);
        
        let visibleCount = 0;
        const earthRadius = 6371000;
        
        // Zahuštění paprsků (aby na kraji kruhu nebyly mezery)
        const numRays = Math.max(360, Math.ceil(2 * Math.PI * pxRadius));
        
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * 2 * Math.PI;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            
            let maxSlope = -Infinity;
            
            let curX = cx;
            let curY = cy;
            
            let t = 0;
            // Krok 0.5 zajistí, že nepřeskočíme žádný pixel
            while (t < pxRadius) {
                t += 0.5;
                const px = Math.round(cx + dx * t);
                const py = Math.round(cy + dy * t);
                
                if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) break;
                
                if (px === curX && py === curY) continue;
                curX = px;
                curY = py;
                
                const elev = getElev(px, py);
                if (elev === -9999) break;
                
                const distMeters = t * metersPerPx;
                
                // Přidání umělé překážky podle nastavení UI
                const trueObstacleElev = elev + obstacleHeight;
                
                // Oprava o zakřivení země a refrakci
                const apparentElev = trueObstacleElev - (distMeters * distMeters / (2 * earthRadius)) * 0.87;
                const slope = (apparentElev - centerElevation) / distMeters;
                
                if (slope >= maxSlope) {
                    maxSlope = slope;
                    const idx = (py * canvasWidth + px) * 4;
                    // Nevykreslujeme víckrát
                    if (resData[idx+3] === 0) {
                        resData[idx] = 76; // R (zelená z našeho tématu)
                        resData[idx+1] = 175; // G
                        resData[idx+2] = 80; // B
                        resData[idx+3] = 140; // Alpha
                        visibleCount++;
                    }
                }
            }
        }
        
        resCtx.putImageData(resImgData, 0, 0);
        
        const bounds = [
            [tile2lat(maxY + 1, zoom), tile2lon(minX, zoom)],
            [tile2lat(minY, zoom), tile2lon(maxX + 1, zoom)]
        ];
        
        this.overlay = L.imageOverlay(resCanvas.toDataURL(), bounds, { opacity: 1, zIndex: 400 }).addTo(this.map);
        
        if (this.resultEl) {
            this.resultEl.style.display = 'block';
            document.getElementById('viewshed-coords-val').innerText = `${centerLatLng.lat.toFixed(5)}, ${centerLatLng.lng.toFixed(5)}`;
            document.getElementById('viewshed-elevation-val').innerText = Math.round(baseElevation);
            
            const areaM2 = visibleCount * metersPerPx * metersPerPx;
            const areaHa = areaM2 / 10000;
            document.getElementById('viewshed-area-val').innerText = areaHa.toFixed(1);
        }
        if (this.btnClear) this.btnClear.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const interval = setInterval(() => {
        if (typeof map !== 'undefined' && typeof map.getZoom === 'function') {
            clearInterval(interval);
            window.viewshedAnalyzer = new ViewshedAnalyzer(map);
        }
    }, 500);
});
