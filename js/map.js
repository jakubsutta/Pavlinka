// ============================================================
// map.js – Inicializace mapy, podkladové vrstvy, 2D/3D přepínání
// ============================================================

// Potlačení autoPan u popupů (musí být před inicializací mapy)
const originalPopupInit = L.Popup.prototype.initialize;
L.Popup.prototype.initialize = function (options, source) {
    if (options) options.autoPan = false;
    else options = { autoPan: false };
    originalPopupInit.call(this, options, source);
};

// Pomocná funkce pro bezpečné vytažení vrstvy do popředí (podporuje i L.layerGroup)
function safeBringToFront(layer) {
    if (typeof layer.bringToFront === 'function') {
        layer.bringToFront();
    } else if (typeof layer.eachLayer === 'function') {
        layer.eachLayer(l => {
            if (typeof l.bringToFront === 'function') l.bringToFront();
        });
    }
}

// ── Inicializace Leaflet mapy ──
const map = L.map('map', {
    scrollWheelZoom: false,
    smoothWheelZoom: true,
    smoothSensitivity: 1,
    zoomSnap: 0,
    inertia: false,
    maxZoom: 30,
    attributionControl: false,
    zoomControl: false
});

window.addEventListener('load', () => {
    // 1. Společný control pro Podkladovou mapu a Zoom (jako u MAWIS)
    L.Control.ZoomBasemap = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-control custom-zoom-basemap-group');
            container.style.clear = 'both';

            // Přesuneme tlačítko pro toggle basemap do tohoto kontejneru (Levá část)
            const toggleBtn = document.getElementById('basemap-toggle-btn');
            if (toggleBtn) {
                container.appendChild(toggleBtn);
            }

            // Pravá část (sloupec pro zoom)
            const zoomCol = L.DomUtil.create('div', 'zoom-controls-col', container);

            // Tlačítko Zoom In
            const zoomIn = L.DomUtil.create('a', 'leaflet-control-zoom-in', zoomCol);
            zoomIn.href = '#';
            zoomIn.title = 'Přiblížit';
            zoomIn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><line x1="128" y1="40" x2="128" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>';
            L.DomEvent.on(zoomIn, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                map.zoomIn(map.options.zoomDelta * (e.shiftKey ? 3 : 1));
            });

            // Číselný ukazatel zoomu (uprostřed jako u Mawis výchozí pohled)
            const zoomInfoDisplay = L.DomUtil.create('div', 'zoom-info-display', zoomCol);
            zoomInfoDisplay.title = 'Aktuální zoom';
            zoomInfoDisplay.innerText = Math.round(map.getZoom());
            map.on('zoom zoomend', () => {
                zoomInfoDisplay.innerText = Math.round(map.getZoom());
            });

            // Tlačítko Zoom Out
            const zoomOut = L.DomUtil.create('a', 'leaflet-control-zoom-out', zoomCol);
            zoomOut.href = '#';
            zoomOut.title = 'Oddálit';
            zoomOut.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>';
            L.DomEvent.on(zoomOut, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                map.zoomOut(map.options.zoomDelta * (e.shiftKey ? 3 : 1));
            });

            L.DomEvent.disableClickPropagation(container);
            
            // Přesuneme také expandovatelný panel pod tento container, aby byl součástí struktury,
            // ale absolutně pozicovaný vůči němu.
            const panel = document.getElementById('basemap-expandable-panel');
            if (panel) {
                container.appendChild(panel);
                // Nastavíme, aby se při scrollování uvnitř panelu nezoomovala mapa,
                // ale zároveň zůstal panel scrollovatelný
                L.DomEvent.disableScrollPropagation(panel);
            }

            return container;
        }
    });
    
    new L.Control.ZoomBasemap({ position: 'topright' }).addTo(map);
    
    // Toggle logic for basemap expandable panel
    const toggleBtn = document.getElementById('basemap-toggle-btn');
    const panel = document.getElementById('basemap-expandable-panel');
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            panel.classList.toggle('is-hidden');
            this.classList.toggle('is-open', !panel.classList.contains('is-hidden'));
        });
        
        // Zavření při kliknutí mimo
        document.addEventListener('click', function(e) {
            if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
                panel.classList.add('is-hidden');
                toggleBtn.classList.remove('is-open');
            }
        });

        // Defaultně sbalit všechny kromě skupiny s aktivní mapou
        const activeRadio = document.querySelector('input[name="basemap"]:checked');
        panel.querySelectorAll('.basemap-thumbnails').forEach(thumbGroup => {
            if (!activeRadio || !thumbGroup.contains(activeRadio)) {
                thumbGroup.classList.add('is-collapsed');
                const header = thumbGroup.previousElementSibling;
                if (header) {
                    const icon = header.querySelector('.toggle-icon');
                    if (icon) {
                        icon.classList.remove('ph-caret-double-down');
                        icon.classList.add('ph-caret-double-up');
                    }
                }
            } else {
                // Pokud je skupina aktivní, tak ikonu aktivujeme hned při startu
                const headerIcon = thumbGroup.previousElementSibling.querySelector('span i');
                const mainOverlayIcon = document.querySelector('.basemap-overlay-icon i');
                if (headerIcon && mainOverlayIcon) {
                    mainOverlayIcon.className = headerIcon.className;
                }
            }
        });
        
        // Zamezit zavření panelu při kliknutí dovnitř panelu (na scrollovací lištu atd)
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById('active-basemap-info-btn');
    const infoContent = document.getElementById('active-basemap-info-content');
    if (infoBtn && infoContent) {
        infoBtn.addEventListener('click', () => {
            infoContent.classList.toggle('is-collapsed');
            infoBtn.classList.toggle('active');
        });
    }
});

// Obnova pozice z LocalStorage
const savedZoom = localStorage.getItem('mapZoom');
const savedLat = localStorage.getItem('mapLat');
const savedLng = localStorage.getItem('mapLng');
if (savedZoom && savedLat && savedLng) {
    map.setView([parseFloat(savedLat), parseFloat(savedLng)], parseFloat(savedZoom));
} else {
    map.setView(center, 18);
}


map.on('moveend', () => {
    const actCenter = map.getCenter();
    localStorage.setItem('mapZoom', map.getZoom());
    localStorage.setItem('mapLat', actCenter.lat);
    localStorage.setItem('mapLng', actCenter.lng);
});

// ── Podkladové mapy (basemaps) ──
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        className: 'osm-grayscale',
        maxZoom: 30,
    }),
    carto: L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO', maxZoom: 22
    }),
    cuzk_orto: L.tileLayer('https://ags.cuzk.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 22, attribution: '© ČÚZK', keepBuffer: 4, updateWhenZooming: false
    }),
    msk_orto: L.tileLayer.wms('https://msk.krajdtm.cz/mapservice/v1/wms/ortofoto?', {
        layers: 'ortofoto', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© MSK', keepBuffer: 4, updateWhenZooming: false
    }),
    orto50: L.tileLayer.wms('https://wjvwxeafinmtzymmgnzf.supabase.co/functions/v1/wms-proxy', {
        layers: 'orto', format: 'image/jpeg', transparent: false, version: '1.1.1', attribution: '© ČÚZK / CENIA (50. léta)'
    }),
    vojI: L.tileLayer.wms('http://www.chartae-antiquae.cz/WMS/Military1/', {
        layers: 'Military1', format: 'image/png', transparent: true, maxZoom: 22, attribution: '© I. vojenské mapování'
    }),
    vojII: L.tileLayer.wms('http://www.chartae-antiquae.cz/WMS/Military2/', {
        layers: 'Military2', format: 'image/png', transparent: true, maxZoom: 22, attribution: '© II. vojenské mapování'
    }),
    vojIII: L.tileLayer.wms('http://www.chartae-antiquae.cz/WMS/Military3/', {
        layers: 'Military3', format: 'image/png', transparent: true, maxZoom: 22, attribution: '© III. vojenské mapování'
    }),
    ostrava_orto: L.tileLayer.wms('https://mapy.ostrava.cz/arcgisserver/services/WMS/WMS/MapServer/WMSServer', {
        layers: '0', format: 'image/png', transparent: true, maxZoom: 22, attribution: '© Ostrava'
    }),
    cuzk_prehledova: L.tileLayer.wms('https://datsklad.izscr.cz/mapservices/services/tabl/MAPA_POINTX_6_5_2016_wms/MapServer/WMSServer', {
        layers: '0', format: 'image/png32', transparent: false, version: '1.3.0', attribution: '© IZS ČR / PointX', maxZoom: 22
    }),
    cuzk_topograficka: L.tileLayer.wms('https://ags.cuzk.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© ČÚZK', maxZoom: 22
    }),
    dmp: L.tileLayer.wms('https://ags.cuzk.gov.cz/arcgis2/services/dmp_obrazova_korelace/ImageServer/WMSServer?', {
        layers: 'dmp_obrazova_korelace:GrayscaleHillshade', format: 'image/png', transparent: false, attribution: '© Statutární město Ostrava', maxZoom: 22
    }),
    slope: L.tileLayer.wms('https://ags.cuzk.gov.cz/arcgis2/services/dmp_obrazova_korelace/ImageServer/WMSServer?', {
        layers: 'dmp_obrazova_korelace:SlopeRGBMap', format: 'image/png', transparent: false, attribution: '© Statutární město Ostrava', maxZoom: 22
    }),
    aspect: L.tileLayer.wms('https://ags.cuzk.gov.cz/arcgis2/services/dmp_obrazova_korelace/ImageServer/WMSServer?', {
        layers: 'dmp_obrazova_korelace:AspectRGBMap', format: 'image/png', transparent: false, attribution: '© Statutární město Ostrava', maxZoom: 22
    }),
    google_sat: L.tileLayer('http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', {
        attribution: '© Google Satellite', maxZoom: 22, keepBuffer: 4, updateWhenZooming: false
    }),
    msk_up: L.esri.tiledMapLayer({
        url: 'https://gis2.msk.cz/arcgis/rest/services/UP/UP_02_HlavniVykres_wm/MapServer',
        maxZoom: 22, attribution: '© MSK ÚP'
    }),
    msk_cisar: L.esri.tiledMapLayer({
        url: 'https://gis2.msk.cz/arcgis/rest/services/podklad/podklad_cis_otisky_wm/MapServer',
        maxZoom: 22, attribution: '© MSK Císař'
    }),
    mullerM: L.tileLayer.wms('http://www.chartae-antiquae.cz/WMS/MullerM/', {
        layers: 'MullerM', format: 'image/png', transparent: false, version: '1.3.0', attribution: '© MullerM', maxZoom: 22
    }),
    msk_orto_1955: L.nonTiledLayer.wms('https://wjvwxeafinmtzymmgnzf.supabase.co/functions/v1/wms-proxy', {
        layers: 'orto',
        format: 'image/jpeg',
        transparent: false,
        version: '1.1.1',
        maxZoom: 30,
        attribution: '© MSK 1955'
    }),
    msk_osluneni: L.nonTiledLayer.wms(
        'https://wjvwxeafinmtzymmgnzf.supabase.co/functions/v1/wms-proxy-msk', {
        layers: '0',
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        wms: 'https://gis2.msk.cz/arcgis/services/public2/msk_osluneni/MapServer/WMSServer',
        attribution: '© MSK Oslunění'
    }
    ),
    parcelni: L.tileLayer('http://tile.poloha.net/parcely/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd', maxZoom: 22
    }),
};
basemaps.cuzk_orto.addTo(map);

// Maximální zoomy pro zobrazení varování
const maxVisibleZooms = {
    'mullerM': 22,
    'vojI': 22,
    'vojII': 22,
    'vojIII': 18,
    'cuzk_prehledova': 22,
    'cuzk_orto': 22,
    'cuzk_topograficka': 22,
    'google_sat': 22,
    'orto50': 18,
    'orto_archiv': 22,
    'msk_cisar': 18,
    'msk_up': 18,
    'msk_orto_1955': 18,
    'msk_osluneni': 18,
    'dmp': 22,
    'slope': 22,
    'aspect': 30,
    'osm': 25
};

function checkZoomWarning() {
    const warningEl = document.getElementById('zoom-warning');
    if (!warningEl) return;

    const currentZoom = map.getZoom();

    // V režimu swipe kontrolujeme obě zobrazené mapy
    if (swipeActive) {
        const maxL = maxVisibleZooms[swipeLeftKey];
        const maxR = maxVisibleZooms[swipeRightKey];
        const exceeded = (maxL && currentZoom > maxL) || (maxR && currentZoom > maxR);
        warningEl.classList.toggle('visible', exceeded);
        return;
    }

    const activeBasemapInput = document.querySelector('input[name="basemap"]:checked');
    if (!activeBasemapInput) return;

    // Pokud jsme v 3D režimu, varování skryjeme
    if (activeBasemapInput.value.startsWith('cesium_')) {
        warningEl.classList.remove('visible');
        return;
    }

    const basemapVal = activeBasemapInput.value;
    const maxZoom = maxVisibleZooms[basemapVal];

    if (maxZoom && currentZoom > maxZoom) {
        warningEl.classList.add('visible');
    } else {
        warningEl.classList.remove('visible');
    }
}

map.on('zoom zoomend', checkZoomWarning);

// ── Bod "Domů" – Zauliční 298/1, Ostrava Krásné Pole ──
// WGS84 přesně dle mapy.cz: x=18.1210188, y=49.8428821
const HOME_LATLNG = [49.8428821, 18.1210188];
const HOME_ZOOM = 17;

const homeMarker = L.marker(HOME_LATLNG, {
    icon: L.divIcon({
        className: 'home-marker-icon',
        html: `<div style="background:#fff; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid var(--accent); box-shadow:0 2px 6px rgba(0,0,0,0.25); cursor:pointer;">
                   <i class="ph-bold ph-house-line" style="color:var(--accent); font-size:15px;"></i>
               </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    }),
    zIndexOffset: 1000,
    interactive: true
}).addTo(map);

homeMarker.on('click', () => map.flyTo(HOME_LATLNG, HOME_ZOOM));

// Skrýt/zobrazit bod podle zoomu (mizí od zoom 17+)
// Používáme setOpacity, protože classList na getElement() nemusí fungovat před prvním renderem
function updateHomeMarkerVisibility() {
    homeMarker.setOpacity(map.getZoom() >= HOME_ZOOM ? 0 : 1);
}
map.on('zoomend', updateHomeMarkerVisibility);
// Spuštění po přidání markeru do mapy
homeMarker.on('add', updateHomeMarkerVisibility);

// Globální funkce pro tlačítko Domů v patičce (zoom 15 = kontext okolí)
window.flyToHome = () => map.flyTo(HOME_LATLNG, HOME_ZOOM);


// ── Překryvné WMS vrstvy ──
const overlayLayers = {
    'layer-kn': L.tileLayer.wms('https://services.cuzk.cz/wms/wms.asp', {
        layers: 'KN', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, zIndex: 1000
    }),
    'layer-charVl': L.tileLayer.wms('https://services.cuzk.cz/wms/wms.asp', {
        layers: 'char_vl,KN', opacity: 0.5, format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, zIndex: 1000
    }),
    'layer-vb': L.tileLayer.wms('https://services.cuzk.cz/wms/wms.asp', {
        layers: 'vb,vb_linie', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.5, maxZoom: 22, zIndex: 1001
    }),
    'layer-dtm-ti': L.tileLayer('https://dmvs.cuzk.gov.cz/api/wmts/dtm_ti_ver?service=WMTS&request=GetTile&version=1.0.0&layer=dtm_ti_ver&style=default&tilematrixset=grid_3857&tilematrix={z}&tilerow={y}&tilecol={x}&format=image%2Fpng', {
        transparent: true, maxZoom: 30
    }),
    'layer-dtm-zps': L.layerGroup([
        L.tileLayer('https://dmvs.cuzk.gov.cz/api/wmts/dtm_zps_plochy_bar?service=WMTS&request=GetTile&version=1.0.0&layer=dtm_zps_plochy_bar&style=default&tilematrixset=grid_3857&tilematrix={z}&tilerow={y}&tilecol={x}&format=image%2Fpng', {
            transparent: true, maxZoom: 30
        }),
        L.tileLayer('https://dmvs.cuzk.gov.cz/api/wmts/dtm_zps_linie_body?service=WMTS&request=GetTile&version=1.0.0&layer=dtm_zps_linie_body&style=default&tilematrixset=grid_3857&tilematrix={z}&tilerow={y}&tilecol={x}&format=image%2Fpng', {
            transparent: true, maxZoom: 30
        })
    ]),
    'layer-landuse': L.tileLayer('http://tile.poloha.net/landuse/{z}/{x}/{y}.png', {
        format: 'image/png', transparent: true, maxZoom: 30
    }),
    'aglo-hlukDen': L.tileLayer.wms('https://geoportal.mzcr.cz/server/services/SHM2022/Aglomerace_Celek_Ldvn/ImageServer/WMSServer?', {
        layers: '0', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© MZCR SHM 2022'
    }),
    'aglo-hlukNoc': L.tileLayer.wms('https://geoportal.mzcr.cz/server/services/SHM2022/Aglomerace_Celek_Ln/ImageServer/WMSServer?', {
        layers: '0', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© MZCR SHM 2022'
    }),
    'silnice-hlukDen': L.tileLayer.wms('https://geoportal.mzcr.cz/server/services/SHM2022/Aglomerace_Silnice_Ldvn/ImageServer/WMSServer?', {
        layers: '0', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© MZCR SHM 2022'
    }),
    'silnice-hlukNoc': L.tileLayer.wms('https://geoportal.mzcr.cz/server/services/SHM2022/Aglomerace_Silnice_Ln/ImageServer/WMSServer?', {
        layers: '0', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© MZCR SHM 2022'
    }),
    'zapluzemi-100': L.tileLayer.wms('https://heis.vuv.cz/data/webmap/wms.dll?', {
        layers: 'isvs_zapluz_100', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22
    }),
    'povodne-ohrozeni': L.tileLayer.wms('https://gis.cenia.cz/geoserver/povodnove_ohrozeni/wms', {
        layers: 'ohrozeni_2019', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22
    }),
    'dopravni-info': L.tileLayer.wms('https://www.edpp.cz/geoserver/wms?', {
        layers: 'ndic:ndic_dopravni_info', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22
    }),
    'dopravni-kamery': L.esri.dynamicMapLayer({
        url: 'https://datsklad.izscr.cz/mapservices/rest/services/live_sluzby/kamery_silnicni/MapServer',
        opacity: 1, maxZoom: 22
    }),
    'klima-teplota-30': L.layerGroup([
        L.esri.dynamicMapLayer({
            url: 'https://gis2.msk.cz/arcgis/rest/services/public/life_coala_miseklima/MapServer',
            layers: [45], opacity: 0.8, maxZoom: 22
        }),
        L.esri.dynamicMapLayer({
            url: 'https://gis2.msk.cz/arcgis/rest/services/public/podklad_ruian_2/MapServer',
            layers: [12], opacity: 0.8, maxZoom: 22
        })
    ]),
    'klima-srazky': L.layerGroup([
        L.esri.dynamicMapLayer({
            url: 'https://gis2.msk.cz/arcgis/rest/services/public/life_coala_miseklima/MapServer',
            layers: [51], opacity: 0.8, maxZoom: 22
        }),
        L.esri.dynamicMapLayer({
            url: 'https://gis2.msk.cz/arcgis/rest/services/public/podklad_ruian_2/MapServer',
            layers: [12], opacity: 0.8, maxZoom: 22
        })
    ]),
    'klima-eroze': L.esri.dynamicMapLayer({
        url: 'https://gis2.msk.cz/arcgis/rest/services/public/life_coala_miseklima/MapServer',
        layers: [41], opacity: 0.8, maxZoom: 22
    }),
    'klima-povrch': L.layerGroup([
        L.esri.dynamicMapLayer({
            url: 'https://gis2.msk.cz/arcgis/rest/services/public/life_coala_miseklima/MapServer',
            layers: [29], opacity: 0.8, maxZoom: 22
        }),
        L.esri.dynamicMapLayer({
            url: 'https://gis2.msk.cz/arcgis/rest/services/public/podklad_ruian_2/MapServer',
            layers: [12], opacity: 1, maxZoom: 22
        })
    ]),
    'krajina-zalesnene': L.tileLayer.wms('https://geoportal.nli.gov.cz/wms_dpz/WMService.aspx?', {
        layers: 'Les', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© NLI'
    }),
    'krajina-vodstvo': L.tileLayer.wms('https://geoportal.cuzk.gov.cz/WMS_INSPIRE_HY/WMService.aspx?', {
        layers: 'HY.PhysicalWaters.Waterbodies,HY.PhysicalWaters.LandWaterBoundary,HY.PhysicalWaters.ManMadeObject', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© ČÚZK'
    }),
    'krajina-honitby': L.tileLayer.wms('https://geoportal.nli.gov.cz/wms_mysl/WMService.aspx?', {
        layers: 'Honitby_hranice,Honitby_nazev_2,Honitby_kod_2', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© NLI'
    }),
    'krajina-meliorace': L.tileLayer.wms('http://eagri.cz/public/app/wms/public_ns.fcgi?', {
        layers: 'MELIORACE_AKT', format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: '© eAGRI'
    }),
    'turisticke-trasy': L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
        format: 'image/png', transparent: true, maxZoom: 30, attribution: '© Waymarked Trails'
    }),
    'cyklotrasy': L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
        format: 'image/png', transparent: true, maxZoom: 30, attribution: '© Waymarked Trails'
    })
};

function saveWmsState() {
    const checked = Array.from(document.querySelectorAll('.wms-overlay:checked')).map(cb => cb.id);
    localStorage.setItem('pavlinka_wms', JSON.stringify(checked));
}

document.querySelectorAll('.wms-overlay').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
        const layer = overlayLayers[this.id];
        if (layer) {
            if (this.checked) { layer.addTo(map); safeBringToFront(layer); }
            else { map.removeLayer(layer); }
        }
        saveWmsState();
    });
});



// ── Archivní ortofoto ──
let currentArchivLayer = null;
const archivSlider = document.getElementById('orto-year-slider');
const timelineYearDisplay = document.getElementById('timeline-year-display');

// Roky, které mohou mít výpadky, mají hvězdičku
const yearsWithAsterisk = ['1998', '2002', '2004', '2008', '2010'];

// Načtení uloženého roku z LocalStorage
const savedArchivYear = localStorage.getItem('pavlinka_archiv_year');
if (savedArchivYear) {
    archivSlider.value = savedArchivYear;
}

function updateArchivLayer() {
    const year = archivSlider.value;
    const displayYear = yearsWithAsterisk.includes(year) ? year + '*' : year;
    timelineYearDisplay.textContent = displayYear;
    localStorage.setItem('pavlinka_archiv_year', year);

    if (currentArchivLayer) map.removeLayer(currentArchivLayer);
    currentArchivLayer = L.tileLayer.wms('https://geoportal.cuzk.gov.cz/WMS_ORTOFOTO_ARCHIV/WMService.aspx?', {
        layers: year, format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22, attribution: `© ČÚZK (Archiv ${year})`
    });

    const activeRadio = document.querySelector('input[name="basemap"]:checked');
    if (activeRadio && activeRadio.value === 'orto_archiv') {
        currentArchivLayer.addTo(map);
        Object.values(overlayLayers).forEach(layer => { if (map.hasLayer(layer)) safeBringToFront(layer); });
        checkZoomWarning();
    }
}
archivSlider.addEventListener('input', updateArchivLayer);

// ── Přepínání podkladových map + 2D/3D ──
document.querySelectorAll('input[name="basemap"]').forEach(radio => {
    radio.addEventListener('change', function () {
        // Aktualizace UI aktivní mapy
        const parentLabel = this.closest('label');
        if (parentLabel) {
            const thumbImg = parentLabel.querySelector('.thumb-img');
            const nameSpan = parentLabel.querySelector('span:not(.layer-meta-badges span)');
            
            if (thumbImg) {
                const currentThumb = document.getElementById('current-basemap-thumb');
                if (currentThumb) currentThumb.className = thumbImg.className;
            }
            if (nameSpan) {
                const activeName = document.getElementById('active-basemap-name');
                if (activeName) activeName.textContent = nameSpan.textContent;
            }
            
            // Aktualizace ikony překryvu podle toho, do jaké skupiny patří
            const thumbnailsDiv = this.closest('.basemap-thumbnails');
            if (thumbnailsDiv && thumbnailsDiv.previousElementSibling) {
                const headerIcon = thumbnailsDiv.previousElementSibling.querySelector('span i');
                const mainOverlayIcon = document.querySelector('.basemap-overlay-icon i');
                if (headerIcon && mainOverlayIcon) {
                    mainOverlayIcon.className = headerIcon.className;
                }
            }
            
            const infoOverlay = parentLabel.querySelector('.info-overlay');
            const activeInfoContent = document.getElementById('active-basemap-info-content');
            if (infoOverlay && activeInfoContent) {
                // Překopírujeme vnitřek (kromě close buttonu, který tam nechceme)
                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = infoOverlay.innerHTML;
                const closeBtn = tempDiv.querySelector('.close-info-btn');
                if (closeBtn) closeBtn.remove();
                activeInfoContent.innerHTML = tempDiv.innerHTML;
            }
        }

        if (swipeActive) {
            if (this.value.startsWith('cesium_')) {
                showToast('3D zobrazení nelze použít v režimu porovnávání map.');
                const prevRadio = document.querySelector(`input[name="basemap"][value="${swipeLeftKey}"]`);
                if (prevRadio) prevRadio.checked = true;
                return;
            }
            selectLeft.value = this.value;
            selectLeft.dispatchEvent(new Event('change'));
            return;
        }

        if (cesiumViewer && document.getElementById('cesiumContainer').style.display === 'block') {
            const camera = cesiumViewer.camera;
            const cartographic = Cesium.Cartographic.fromCartesian(camera.position);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lng = Cesium.Math.toDegrees(cartographic.longitude);
            const height = cartographic.height;
            const zoom = Math.log2(15000000 / height);
            map.setView([lat, lng], Math.round(zoom));
        }

        if (this.value.startsWith('cesium_')) {
            document.getElementById('map').style.display = 'none';
            document.getElementById('cesiumContainer').style.display = 'block';
            document.getElementById('cesium-navigation').classList.remove('cesium-nav-hidden');

            if (!cesiumViewer) {
                cesiumViewer = new Cesium.Viewer('cesiumContainer', {
                    baseLayerPicker: false, geocoder: false, homeButton: false, infoBox: false,
                    sceneModePicker: false, selectionIndicator: false, navigationHelpButton: false,
                    navigationInstructionsInitiallyVisible: false, animation: false, timeline: false,
                    fullscreenButton: false, terrain: Cesium.Terrain.fromWorldTerrain(), baseLayer: false
                });
                cesiumViewer.creditContainer.style.display = 'none';
            }

            cesiumViewer.scene.primitives.removeAll();
            cesiumViewer.imageryLayers.removeAll();
            cesiumViewer.scene.globe.show = true;

            if (this.value === 'cesium_google_3d') {
                Cesium.createGooglePhotorealistic3DTileset().then(tileset => {
                    cesiumViewer.scene.primitives.add(tileset);
                }).catch(err => console.error('Chyba při načítání Google 3D Tiles:', err));
                cesiumViewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
                    url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
                    subdomains: 'abcd'
                }));
            } else if (this.value === 'cesium_bing_3d') {
                Cesium.IonImageryProvider.fromAssetId(3).then(imageryProvider => {
                    cesiumViewer.imageryLayers.addImageryProvider(imageryProvider);
                }).catch(err => console.error('Chyba při načítání Bing Maps:', err));
            }

            const mapCenter = map.getCenter();
            const mapZoom = map.getZoom();
            const height = 22000000 / Math.pow(2, mapZoom);
            cesiumViewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(mapCenter.lng, mapCenter.lat, height),
                orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35), roll: 0 }
            });
            cesiumViewer.scene.screenSpaceCameraController.enableTilt = true;
            cesiumViewer.scene.screenSpaceCameraController.enableLook = true;
            cesiumViewer.scene.requestRender();
            localStorage.setItem('pavlinka_basemap', this.value);
            return;
        } else {
            document.getElementById('cesiumContainer').style.display = 'none';
            document.getElementById('map').style.display = 'block';
            document.getElementById('cesium-navigation').classList.add('cesium-nav-hidden');
            map.invalidateSize();
        }

        Object.values(basemaps).forEach(layer => map.removeLayer(layer));
        if (currentArchivLayer) map.removeLayer(currentArchivLayer);

        const timelineContainer = document.getElementById('timeline-container');

        if (this.value === 'orto_archiv') {
            timelineContainer.classList.remove('timeline-hidden');
            updateArchivLayer();
        } else {
            timelineContainer.classList.add('timeline-hidden');
            if (basemaps[this.value]) {
                basemaps[this.value].addTo(map);
            } else {
                console.error("basemaps[" + this.value + "] is undefined!");
            }
        }

        Object.values(overlayLayers).forEach(layer => { if (map.hasLayer(layer)) safeBringToFront(layer); });
        localStorage.setItem('pavlinka_basemap', this.value);
        checkZoomWarning(); // Zkontrolovat zoom při změně mapy
    });
});

// ── Ovládání 3D navigace ──
function setupCesiumNav() {
    const moveAmt = 5;
    const rotAmt = Cesium.Math.toRadians(1);
    const navs = {
        'nav-move-up': () => cesiumViewer && cesiumViewer.camera.moveForward(moveAmt),
        'nav-move-down': () => cesiumViewer && cesiumViewer.camera.moveBackward(moveAmt),
        'nav-move-left': () => cesiumViewer && cesiumViewer.camera.moveLeft(moveAmt),
        'nav-move-right': () => cesiumViewer && cesiumViewer.camera.moveRight(moveAmt),
        'nav-rotate-left': () => cesiumViewer && cesiumViewer.camera.lookLeft(rotAmt),
        'nav-rotate-right': () => cesiumViewer && cesiumViewer.camera.lookRight(rotAmt),
        'nav-tilt-up': () => cesiumViewer && cesiumViewer.camera.lookUp(rotAmt / 2),
        'nav-tilt-down': () => cesiumViewer && cesiumViewer.camera.lookDown(rotAmt / 2)
    };
    Object.entries(navs).forEach(([id, action]) => {
        const btn = document.getElementById(id);
        let interval = null;
        const start = (e) => { e.preventDefault(); action(); interval = setInterval(action, 30); };
        const stop = () => clearInterval(interval);
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', stop);
        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('touchstart', start);
        btn.addEventListener('touchend', stop);
    });
}
window.addEventListener('load', setupCesiumNav);

// ── Info overlay pro basemapy ──
window.addEventListener('load', function () {
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.info-btn');
        if (btn) {
            e.stopPropagation();
            e.preventDefault();
            const card = btn.closest('.thumb-card');
            const overlay = card.querySelector('.info-overlay');

            const isAlreadyOpen = overlay.classList.contains('vyskoc-ven');

            // Zavřít všechny ostatní
            document.querySelectorAll('.info-overlay').forEach(el => el.classList.remove('vyskoc-ven'));

            if (!isAlreadyOpen) {
                const rectCard = card.getBoundingClientRect();
                overlay.classList.add('vyskoc-ven');

                // Zobrazit bublinu pod kartou
                overlay.style.top = (rectCard.bottom + 10) + 'px';

                // Výpočet pozice zleva, aby bublina nevyjela mimo obrazovku
                const popupWidth = 280;
                let leftPos = rectCard.left;
                if (leftPos + popupWidth > window.innerWidth) {
                    leftPos = window.innerWidth - popupWidth - 20;
                }
                // Nesmí být méně než 10px od kraje
                if (leftPos < 10) leftPos = 10;

                overlay.style.left = leftPos + 'px';
            }
            return;
        }
        if (e.target.closest('.close-info-btn')) {
            e.stopPropagation();
            e.preventDefault();
            e.target.closest('.info-overlay').classList.remove('vyskoc-ven');
            return;
        }
        if (!e.target.closest('.info-overlay')) {
            document.querySelectorAll('.info-overlay').forEach(el => el.classList.remove('vyskoc-ven'));
        }
    }, true);
});

// ── Měřítko a souřadnice ──
L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);


document.getElementById('current-year').innerText = new Date().getFullYear();

// ============================================================
// ── SEKCE PRO SWIPE POROVNÁVÁNÍ MAP ──
// ============================================================
let swipeActive = false;
let leftLayer = null;
let rightLayer = null;
let swipeLeftKey = '';
let swipeRightKey = '';
let panelWasExpanded = false;
let swipeArchivLayerLeft = null;
let swipeArchivLayerRight = null;

const swipeDivider = document.getElementById('swipe-divider');
const swipeControls = document.getElementById('swipe-controls-container');
const selectLeft = document.getElementById('swipe-select-left');
const selectRight = document.getElementById('swipe-select-right');

// Veškeré mapy dostupné ve swipe (bez 3D Cesium)
const swipeMapOptions = [
    { key: 'cuzk_orto', label: 'Ortofoto ČÚZK' },
    { key: 'orto50', label: 'Ortofoto 50. léta' },
    { key: 'orto_archiv', label: 'Archivní ortofoto' },
    { key: 'msk_orto', label: 'Ortofoto MSK' },
    { key: 'msk_orto_1955', label: 'Ortofoto MSK 1955' },
    { key: 'ostrava_orto', label: 'Ortofoto Ostrava' },
    { key: 'google_sat', label: 'Google Satelitní' },
    { key: 'osm', label: 'OSM Světlá' },
    { key: 'carto', label: 'Základní mapa' },
    { key: 'cuzk_prehledova', label: 'Přehledová ČÚZK' },
    { key: 'cuzk_topograficka', label: 'Topografická ČÚZK' },
    { key: 'msk_cisar', label: 'Císařské otisky' },
    { key: 'vojI', label: 'I. vojenské mapování' },
    { key: 'vojII', label: 'II. vojenské mapování' },
    { key: 'vojIII', label: 'III. vojenské mapování' },
    { key: 'mullerM', label: 'Müllerova mapa' },
    { key: 'dmp', label: 'Model povrchu (DMP)' },
    { key: 'slope', label: 'Sklon terénu (Slope)' },
    { key: 'aspect', label: 'Orientace svahů' },
    { key: 'msk_up', label: 'Územní plán MSK' },
    { key: 'msk_osluneni', label: 'Oslunění MSK' },
    { key: 'parcelni', label: 'Parcelová mapa' },
];

// Naplnění dropdownů
swipeMapOptions.forEach(opt => {
    const elL = document.createElement('option');
    elL.value = opt.key;
    elL.textContent = opt.label;
    selectLeft.appendChild(elL);

    const elR = document.createElement('option');
    elR.value = opt.key;
    elR.textContent = opt.label;
    selectRight.appendChild(elR);
});

// Reference na archivní rok slidery
const swipeSliderLeft = document.getElementById('swipe-archiv-slider-left');
const swipeSliderRight = document.getElementById('swipe-archiv-slider-right');
const swipeYearRowLeft = document.getElementById('swipe-year-row-left');
const swipeYearRowRight = document.getElementById('swipe-year-row-right');
const swipeYearLabelLeft = document.getElementById('swipe-year-label-left');
const swipeYearLabelRight = document.getElementById('swipe-year-label-right');

function createSwipeArchivLayer(year) {
    return L.tileLayer.wms('https://geoportal.cuzk.gov.cz/WMS_ORTOFOTO_ARCHIV/WMService.aspx?', {
        layers: String(year), format: 'image/png', transparent: true, version: '1.3.0', maxZoom: 22,
        attribution: `© ČÚZK (Archiv ${year})`
    });
}

function getSwipeLayer(key, side) {
    const year = (side === 'left') ? swipeSliderLeft.value : swipeSliderRight.value;
    if (key === 'orto_archiv') return createSwipeArchivLayer(year);
    return cloneTileLayer(basemaps[key]);
}

function getSwipeLayerLeft(key) {
    if (key === 'orto_archiv') return createSwipeArchivLayer(swipeSliderLeft.value);
    return basemaps[key];
}

// Zobrazení/skrytí roků a přenactení vrstvy při změně slideru
swipeSliderLeft.addEventListener('input', function () {
    swipeYearLabelLeft.textContent = this.value;
    if (!swipeActive || swipeLeftKey !== 'orto_archiv') return;
    if (leftLayer) map.removeLayer(leftLayer);
    leftLayer = createSwipeArchivLayer(this.value);
    leftLayer.addTo(map);
    if (rightLayer && map.hasLayer(rightLayer)) rightLayer.bringToFront();
    Object.values(overlayLayers).forEach(l => { if (map.hasLayer(l)) l.bringToFront(); });
    updateSwipeClip();
});

swipeSliderRight.addEventListener('input', function () {
    swipeYearLabelRight.textContent = this.value;
    if (!swipeActive || swipeRightKey !== 'orto_archiv') return;
    if (rightLayer) map.removeLayer(rightLayer);
    rightLayer = createSwipeArchivLayer(this.value);
    rightLayer.addTo(map);
    rightLayer.on('tileload load', updateSwipeClip);
    Object.values(overlayLayers).forEach(l => { if (map.hasLayer(l)) l.bringToFront(); });
    updateSwipeClip();
});

function updateSwipeYearVisibility() {
    swipeYearRowLeft.style.display = (swipeLeftKey === 'orto_archiv') ? 'flex' : 'none';
    swipeYearRowRight.style.display = (swipeRightKey === 'orto_archiv') ? 'flex' : 'none';
}

function cloneTileLayer(layer) {
    if (!layer) return null;
    if (L.NonTiledLayer && layer instanceof L.NonTiledLayer.WMS) {
        return L.nonTiledLayer.wms(layer._url, L.extend({}, layer.options));
    } else if (layer instanceof L.TileLayer.WMS) {
        return L.tileLayer.wms(layer._url, L.extend({}, layer.options));
    } else if (layer instanceof L.TileLayer) {
        return L.tileLayer(layer._url, L.extend({}, layer.options));
    } else if (L.esri && L.esri.tiledMapLayer && layer.options && layer.options.url) {
        return L.esri.tiledMapLayer(L.extend({}, layer.options));
    }
    return null;
}

function updateSwipeClip() {
    if (!swipeActive || !rightLayer) return;
    const rightContainer = rightLayer.getContainer();
    if (!rightContainer) return;

    const panePos = map._getMapPanePos();
    const dividerX = swipeDivider.offsetLeft;
    const paneX = dividerX - panePos.x;

    rightContainer.style.clipPath = `polygon(${paneX}px -99999px, 999999px -99999px, 999999px 99999px, ${paneX}px 99999px)`;

    // Vždy zajistit, že pravá vrstva je nad levou
    if (rightLayer && map.hasLayer(rightLayer)) rightLayer.bringToFront();
    Object.values(overlayLayers).forEach(l => { if (map.hasLayer(l)) l.bringToFront(); });
}

function toggleSwipeMode() {
    const btn = document.querySelector('.leaflet-control-swipe-toggle');
    const rPanel = document.getElementById('right-panel');
    const tBtn = document.getElementById('toggle-panel-btn');

    if (swipeActive) {
        swipeActive = false;
        if (btn) btn.classList.remove('active');
        document.body.classList.remove('swipe-active-mode');

        swipeDivider.style.display = 'none';
        swipeControls.style.display = 'none';
        swipeYearRowLeft.style.display = 'none';
        swipeYearRowRight.style.display = 'none';

        if (leftLayer) { map.removeLayer(leftLayer); leftLayer = null; }
        if (rightLayer) { map.removeLayer(rightLayer); rightLayer = null; }

        const activeRadio = document.querySelector('input[name="basemap"]:checked');
        if (activeRadio) {
            const val = activeRadio.value;
            if (val === 'orto_archiv') {
                updateArchivLayer();
            } else if (basemaps[val]) {
                basemaps[val].addTo(map);
            }
        }

        Object.values(overlayLayers).forEach(layer => {
            if (map.hasLayer(layer)) safeBringToFront(layer);
        });

        map.off('move', updateSwipeClip);
        map.off('zoom', updateSwipeClip);
        map.off('resize', updateSwipeClip);

        if (panelWasExpanded && rPanel && rPanel.classList.contains('collapsed')) {
            rPanel.classList.remove('collapsed');
            if (tBtn) tBtn.textContent = '◀';
        }
        setTimeout(() => map.invalidateSize(), 300);
    } else {
        const activeRadio = document.querySelector('input[name="basemap"]:checked');
        if (activeRadio && activeRadio.value.startsWith('cesium_')) {
            const cuzkRadio = document.querySelector('input[name="basemap"][value="cuzk_orto"]');
            if (cuzkRadio) {
                cuzkRadio.checked = true;
                cuzkRadio.dispatchEvent(new Event('change'));
            }
            showToast('Porovnávání map je dostupné pouze ve 2D zobrazení.');
        }

        swipeActive = true;
        if (btn) btn.classList.add('active');
        document.body.classList.add('swipe-active-mode');

        Object.values(basemaps).forEach(layer => map.removeLayer(layer));
        if (currentArchivLayer) map.removeLayer(currentArchivLayer);

        const currentBasemap = document.querySelector('input[name="basemap"]:checked')?.value || 'cuzk_orto';
        swipeLeftKey = currentBasemap.startsWith('cesium_') ? 'cuzk_orto' : currentBasemap;
        swipeRightKey = swipeLeftKey === 'cuzk_orto' ? 'osm' : 'cuzk_orto';

        selectLeft.value = swipeLeftKey;
        selectRight.value = swipeRightKey;

        leftLayer = getSwipeLayerLeft(swipeLeftKey);
        rightLayer = getSwipeLayer(swipeRightKey, 'right');
        updateSwipeYearVisibility();

        if (leftLayer) leftLayer.addTo(map);
        if (rightLayer) {
            rightLayer.addTo(map);
            rightLayer.on('tileload load', updateSwipeClip);
        }

        Object.values(overlayLayers).forEach(layer => {
            if (map.hasLayer(layer)) safeBringToFront(layer);
        });

        swipeDivider.style.display = 'block';
        swipeDivider.style.left = '50%';
        swipeControls.style.display = 'flex';

        map.on('move', updateSwipeClip);
        map.on('zoom', updateSwipeClip);
        map.on('resize', updateSwipeClip);

        panelWasExpanded = rPanel ? !rPanel.classList.contains('collapsed') : false;
        if (rPanel && !rPanel.classList.contains('collapsed')) {
            rPanel.classList.add('collapsed');
            if (tBtn) tBtn.textContent = '▶';
        }

        setTimeout(() => {
            map.invalidateSize();
            updateSwipeClip();
        }, 300);
    }
}

// Změna levé mapy
selectLeft.addEventListener('change', function () {
    if (!swipeActive) return;
    if (leftLayer) map.removeLayer(leftLayer);

    swipeLeftKey = this.value;
    updateSwipeYearVisibility();
    leftLayer = getSwipeLayerLeft(swipeLeftKey);
    if (leftLayer) {
        leftLayer.addTo(map);
        // Pravá vrstva musí zůstat nahoře
        if (rightLayer && map.hasLayer(rightLayer)) rightLayer.bringToFront();
        Object.values(overlayLayers).forEach(layer => {
            if (map.hasLayer(layer)) safeBringToFront(layer);
        });
        const correspondingRadio = document.querySelector(`input[name="basemap"][value="${swipeLeftKey}"]`);
        if (correspondingRadio) correspondingRadio.checked = true;
    }
    checkZoomWarning();
    updateSwipeClip();
});

// Změna pravé mapy
selectRight.addEventListener('change', function () {
    if (!swipeActive) return;
    if (rightLayer) map.removeLayer(rightLayer);

    swipeRightKey = this.value;
    updateSwipeYearVisibility();
    rightLayer = getSwipeLayer(swipeRightKey, 'right');
    if (rightLayer) {
        rightLayer.addTo(map);
        rightLayer.on('tileload load', updateSwipeClip);
        Object.values(overlayLayers).forEach(layer => {
            if (map.hasLayer(layer)) safeBringToFront(layer);
        });
    }
    checkZoomWarning();
    updateSwipeClip();
});

// Události pro tažení dělicí linie
let swipeDragging = false;

function startSwipeDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    swipeDragging = true;
    document.addEventListener('mousemove', swipeDrag);
    document.addEventListener('mouseup', stopSwipeDrag);
    document.addEventListener('touchmove', swipeDrag, { passive: false });
    document.addEventListener('touchend', stopSwipeDrag);
}

function swipeDrag(e) {
    if (!swipeDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const mapContainer = document.getElementById('map');
    const rect = mapContainer.getBoundingClientRect();

    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    swipeDivider.style.left = x + 'px';
    updateSwipeClip();
}

function stopSwipeDrag() {
    swipeDragging = false;
    document.removeEventListener('mousemove', swipeDrag);
    document.removeEventListener('mouseup', stopSwipeDrag);
    document.removeEventListener('touchmove', swipeDrag);
    document.removeEventListener('touchend', stopSwipeDrag);
}

swipeDivider.addEventListener('mousedown', startSwipeDrag);
swipeDivider.addEventListener('touchstart', startSwipeDrag, { passive: false });


// ============================================================
// ── PRŮHLEDNOST PODKLADOVÉ MAPY ──
// ============================================================
let opacityPanelOpen = false;

function getCurrentBasemapLayer() {
    if (swipeActive) return leftLayer;
    const radio = document.querySelector('input[name="basemap"]:checked');
    if (!radio) return null;
    if (radio.value === 'orto_archiv') return currentArchivLayer;
    return basemaps[radio.value] || null;
}

function applyBasemapOpacity(pct) {
    const layer = getCurrentBasemapLayer();
    if (layer && layer.setOpacity) layer.setOpacity(pct / 100);
}

function resetOpacityControl() {
    const slider = document.getElementById('basemap-opacity-slider');
    const label = document.getElementById('opacity-pct-label');
    if (!slider || !label) return;
    slider.value = 100;
    slider.style.background = `linear-gradient(to right, var(--accent) 100%, #d9d9d9 100%)`;
    label.textContent = '100%';
}

window.addEventListener('load', () => {
    const toprightContainer = document.querySelector('.leaflet-top.leaflet-right');
    if (!toprightContainer) return;

    // ── Skupina Nástrojů (4 tlačítka umístěná rovnou pod zoom/podkladovky) ──
    const toolsGridDiv = document.createElement('div');
    toolsGridDiv.className = 'leaflet-control tools-grid-container';
    toprightContainer.appendChild(toolsGridDiv);
    L.DomEvent.disableClickPropagation(toolsGridDiv);

    // ── Swipe tlačítko ──
    const swipeControlDiv = document.createElement('div');
    swipeControlDiv.className = 'leaflet-control leaflet-bar';
    swipeControlDiv.id = 'swipe-btn-wrapper';

    const swipeBtn = document.createElement('a');
    swipeBtn.className = 'leaflet-control-swipe-toggle leaflet-control-streetview-toggle';
    swipeBtn.href = '#';
    swipeBtn.title = 'Porovnání map (Swipe)';
    swipeBtn.setAttribute('role', 'button');
    swipeBtn.innerHTML = '<i class="ph-bold ph-arrows-out-line-horizontal"></i>';
    swipeControlDiv.appendChild(swipeBtn);
    toolsGridDiv.appendChild(swipeControlDiv);

    swipeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSwipeMode();
    });

    // ── Průhlednost podkladové mapy ──
    const opacityControlDiv = document.createElement('div');
    opacityControlDiv.className = 'leaflet-control leaflet-bar';
    opacityControlDiv.id = 'opacity-control-wrapper';

    const opacityBtn = document.createElement('a');
    opacityBtn.id = 'opacity-toggle-btn';
    opacityBtn.className = 'leaflet-control-streetview-toggle';
    opacityBtn.href = '#';
    opacityBtn.title = 'Průhlednost podkladové mapy';
    opacityBtn.setAttribute('role', 'button');
    opacityBtn.innerHTML = '<i class="ph-bold ph-eye"></i>';
    opacityControlDiv.appendChild(opacityBtn);
    toolsGridDiv.appendChild(opacityControlDiv);

    // Slider panel
    const sliderPanel = document.createElement('div');
    sliderPanel.id = 'opacity-slider-panel';
    sliderPanel.className = 'opacity-slider-panel';
    sliderPanel.innerHTML = `
        <span class="opacity-pct-label" id="opacity-pct-label">100%</span>
        <div class="opacity-track-wrap">
            <input type="range" id="basemap-opacity-slider" min="0" max="100" value="100" step="1">
        </div>
        <i class="ph ph-eye-slash opacity-eye-off"></i>
    `;
    document.body.appendChild(sliderPanel);

    function positionOpacityPanel() {
        const rect = opacityBtn.getBoundingClientRect();
        sliderPanel.style.top = (rect.bottom + 6) + 'px';
        sliderPanel.style.left = rect.left + 'px';
        sliderPanel.style.width = rect.width + 'px';
    }

    opacityBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        opacityPanelOpen = !opacityPanelOpen;
        if (opacityPanelOpen) positionOpacityPanel();
        sliderPanel.classList.toggle('open', opacityPanelOpen);
        opacityBtn.classList.toggle('active', opacityPanelOpen);
    });

    window.addEventListener('resize', () => { if (opacityPanelOpen) positionOpacityPanel(); });

    const slider = document.getElementById('basemap-opacity-slider');
    const pctLabel = document.getElementById('opacity-pct-label');

    function updateSliderTrack(pct) {
        slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, #d9d9d9 ${pct}%)`;
    }
    updateSliderTrack(100);

    slider.addEventListener('input', function () {
        const pct = parseInt(this.value);
        pctLabel.textContent = pct + '%';
        updateSliderTrack(pct);
        applyBasemapOpacity(pct);
    });

    document.querySelectorAll('input[name="basemap"]').forEach(radio => {
        radio.addEventListener('change', () => resetOpacityControl());
    });

    document.addEventListener('click', (e) => {
        if (opacityPanelOpen &&
            !sliderPanel.contains(e.target) &&
            !opacityControlDiv.contains(e.target)) {
            opacityPanelOpen = false;
            sliderPanel.classList.remove('open');
            opacityBtn.classList.remove('active');
        }
    });

    // ── Street View tlačítko ──
    const streetviewControlDiv = document.createElement('div');
    streetviewControlDiv.className = 'leaflet-control leaflet-bar';
    streetviewControlDiv.id = 'streetview-control-wrapper';

    const streetviewBtn = document.createElement('a');
    streetviewBtn.id = 'streetview-toggle-btn';
    streetviewBtn.className = 'leaflet-control-streetview-toggle';
    streetviewBtn.href = '#';
    streetviewBtn.title = 'Panoramatický pohled (Google Street View)';
    streetviewBtn.setAttribute('role', 'button');
    streetviewBtn.innerHTML = '<i class="ph-bold ph-panorama"></i>';
    streetviewControlDiv.appendChild(streetviewBtn);
    toolsGridDiv.appendChild(streetviewControlDiv);

    // ── Souřadnice tlačítko ──
    const coordsControlDiv = document.createElement('div');
    coordsControlDiv.className = 'leaflet-control leaflet-bar';
    coordsControlDiv.id = 'coords-picker-wrapper';

    const coordsBtn = document.createElement('a');
    coordsBtn.id = 'coords-toggle-btn';
    coordsBtn.className = 'leaflet-control-streetview-toggle';
    coordsBtn.href = '#';
    coordsBtn.title = 'Zobrazení souřadnic a výšky';
    coordsBtn.setAttribute('role', 'button');
    coordsBtn.innerHTML = '<i class="ph-bold ph-map-pin-area"></i>';
    coordsControlDiv.appendChild(coordsBtn);
    toolsGridDiv.appendChild(coordsControlDiv);

    coordsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCoordsTool();
    });

    // ── Pozemek tlačítko ──
    const parcelControlDiv = document.createElement('div');
    parcelControlDiv.className = 'leaflet-control leaflet-bar';
    parcelControlDiv.id = 'parcel-btn-wrapper';

    const parcelBtn = document.createElement('a');
    parcelBtn.id = 'parcel-toggle-btn';
    parcelBtn.className = 'leaflet-control-streetview-toggle';
    parcelBtn.href = '#';
    parcelBtn.title = 'Pozemek – výběr a info o parcele';
    parcelBtn.setAttribute('role', 'button');
    parcelBtn.innerHTML = '<i class="ph-bold ph-layout"></i>';
    parcelControlDiv.appendChild(parcelBtn);
    toolsGridDiv.appendChild(parcelControlDiv);

    parcelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof toggleParcelTool === 'function') toggleParcelTool();
    });

    // ── Půdorys tlačítko ──
    const floorplanControlDiv = document.createElement('div');
    floorplanControlDiv.className = 'leaflet-control leaflet-bar';
    floorplanControlDiv.id = 'floorplan-btn-wrapper';

    const floorplanBtn = document.createElement('a');
    floorplanBtn.id = 'floorplan-toggle-btn';
    floorplanBtn.className = 'leaflet-control-streetview-toggle';
    floorplanBtn.href = '#';
    floorplanBtn.title = 'Půdorysy objektů';
    floorplanBtn.setAttribute('role', 'button');
    floorplanBtn.innerHTML = '<i class="ph-bold ph-blueprint"></i>';
    floorplanControlDiv.appendChild(floorplanBtn);
    toolsGridDiv.appendChild(floorplanControlDiv);

    floorplanBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openFloorplanModal === 'function') {
            window.openFloorplanModal();
        } else {
            if (typeof showToast === 'function') showToast('Modul Půdorys se načítá...');
        }
    });

    streetviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleStreetViewMode();
    });

    // Zavřít Street View panel kliknutím na křížek
    const streetviewCloseBtn = document.getElementById('btn-streetview-close');
    if (streetviewCloseBtn) {
        streetviewCloseBtn.addEventListener('click', () => {
            if (streetViewActive) toggleStreetViewMode();
        });
    }
});



// ============================================================
// ── GOOGLE STREET VIEW INTEGRATION ──
// ============================================================
let streetViewActive = false;
let streetViewMarker = null;

function toggleStreetViewMode() {
    // Zavřít panel průhlednosti, pokud je otevřený
    if (typeof opacityPanelOpen !== 'undefined' && opacityPanelOpen) {
        opacityPanelOpen = false;
        const sliderPanel = document.getElementById('opacity-slider-panel');
        const opacityBtn = document.getElementById('opacity-toggle-btn');
        const svWrapper = document.getElementById('streetview-control-wrapper');
        if (sliderPanel) sliderPanel.classList.remove('open');
        if (opacityBtn) opacityBtn.classList.remove('active');
        if (svWrapper) svWrapper.classList.remove('shifted');
    }

    const activeBasemap = document.querySelector('input[name="basemap"]:checked')?.value || '';
    if (!streetViewActive && activeBasemap.startsWith('cesium_')) {
        if (typeof showToast === 'function') {
            showToast('Street View lze spustit pouze ve 2D zobrazení.');
        } else {
            alert('Street View lze spustit pouze ve 2D zobrazení.');
        }
        return;
    }

    streetViewActive = !streetViewActive;

    const btn = document.getElementById('streetview-toggle-btn');
    const panel = document.getElementById('right-panel');
    const streetviewPanel = document.getElementById('streetview-panel');

    if (btn) btn.classList.toggle('active', streetViewActive);
    if (panel) panel.classList.toggle('streetview-active', streetViewActive);

    if (streetViewActive) {
        // Zobrazit panel
        if (streetviewPanel) streetviewPanel.style.display = 'flex';

        // Zjistit aktuální střed mapy
        const center = map.getCenter();

        // Vytvořit custom marker, pokud neexistuje
        if (!streetViewMarker) {
            const pegmanIcon = L.divIcon({
                className: 'pegman-map-marker',
                html: `
                  <div class="pegman-marker-pin">
                    <i class="ph-bold ph-street-view"></i>
                  </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36]
            });

            streetViewMarker = L.marker(center, {
                icon: pegmanIcon,
                draggable: true,
                zIndexOffset: 1000
            }).addTo(map);

            streetViewMarker.on('dragend', function () {
                updateStreetViewPosition(streetViewMarker.getLatLng());
            });
        } else {
            streetViewMarker.setLatLng(center);
            if (!map.hasLayer(streetViewMarker)) {
                streetViewMarker.addTo(map);
            }
        }

        // Registrovat kliknutí do mapy
        map.on('click', onMapClickForStreetView);

        // Aktualizovat pozici Street View
        updateStreetViewPosition(center);
    } else {
        // Zavřít Street View
        if (streetviewPanel) streetviewPanel.style.display = 'none';

        // Odstranit marker
        if (streetViewMarker && map.hasLayer(streetViewMarker)) {
            map.removeLayer(streetViewMarker);
        }

        // Zrušit map click listener
        map.off('click', onMapClickForStreetView);

        // Vyčistit iframe
        const iframe = document.getElementById('streetview-iframe');
        if (iframe) iframe.src = '';
    }

    // Invalidovat velikost mapy po skončení transition
    setTimeout(() => {
        map.invalidateSize({ pan: false });
    }, 300);
}

function updateStreetViewPosition(latlng) {
    const lat = latlng.lat.toFixed(6);
    const lng = latlng.lng.toFixed(6);

    if (streetViewMarker) {
        streetViewMarker.setLatLng(latlng);
    }

    const iframe = document.getElementById('streetview-iframe');
    if (iframe) {
        // Formát doporučený uživatelem pro vkládání Google Street View bez API klíče
        iframe.src = `https://maps.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed`;
    }

    // Aktualizovat odkaz do Mapy.cz s aktuálními souřadnicemi
    const mapyCzBtn = document.getElementById('btn-streetview-mapy-cz');
    if (mapyCzBtn) {
        mapyCzBtn.href = `https://mapy.cz/zakladni?pano=1&x=${lng}&y=${lat}&z=17`;
    }

    // Aktualizovat odkaz do Google Maps s aktuálními souřadnicemi
    const googleMapsBtn = document.getElementById('btn-streetview-google-maps');
    if (googleMapsBtn) {
        googleMapsBtn.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    }
}

function onMapClickForStreetView(e) {
    if (!streetViewActive) return;
    updateStreetViewPosition(e.latlng);
}





// ============================================================
// ── SEKCE PRO NÁSTROJ SOUŘADNICE A VÝŠKA ──
// ============================================================
let coordsToolActive = false;
let coordsPopup = null;

function toggleCoordsTool() {
    coordsToolActive = !coordsToolActive;
    const btn = document.getElementById('coords-toggle-btn');
    if (btn) btn.classList.toggle('active', coordsToolActive);

    if (coordsToolActive) {
        document.getElementById('map').style.cursor = 'crosshair';
        map.on('click', onMapClickForCoords);
        // Vypneme ostatní nástroje, pokud běží
        if (typeof streetViewActive !== 'undefined' && streetViewActive) toggleStreetViewMode();
    } else {
        document.getElementById('map').style.cursor = '';
        map.off('click', onMapClickForCoords);
        if (coordsPopup) map.closePopup(coordsPopup);
    }
}

async function fetchElevationForPoint(latlng) {
    try {
        const pt = L.CRS.EPSG3857.project(latlng);
        const geometry = {
            "points": [[pt.x, pt.y]],
            "spatialReference": { "wkid": 3857 }
        };
        const url = `https://ags.cuzk.gov.cz/arcgis/rest/services/3D/dmr5g_wm/ImageServer/identify?f=json&geometryType=esriGeometryMultipoint&returnGeometry=false&geometry=${encodeURIComponent(JSON.stringify(geometry))}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.value && data.value !== "NoData") {
            return parseFloat(data.value).toFixed(2);
        }
    } catch (e) {
        console.error("Chyba při zjišťování výšky:", e);
    }
    return null;
}

window.copyToClipboard = function (text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try { document.execCommand('copy'); } catch (error) { console.error(error); }
        finally { textArea.remove(); }
    }
};

window.copyCoordsWrapper = function (btn, text) {
    window.copyToClipboard(text);
    const originalIcon = btn.innerHTML;
    btn.classList.add('copied-success');
    btn.innerHTML = '<i class="ph-bold ph-check"></i>';
    setTimeout(() => {
        btn.classList.remove('copied-success');
        btn.innerHTML = originalIcon;
    }, 1500);
};

async function onMapClickForCoords(e) {
    if (!coordsToolActive) return;
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // S-JTSK převod (pokud je proj4 k dispozici)
    let sjtskY = '---';
    let sjtskX = '---';
    if (typeof proj4 !== 'undefined') {
        const res = proj4("EPSG:4326", "EPSG:5514", [lng, lat]);
        sjtskY = Math.abs(res[0]).toFixed(2);
        sjtskX = Math.abs(res[1]).toFixed(2);
    }

    const popupHtml = `
        <div class="coords-popup-container">
            <div class="coords-popup-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="ph-bold ph-map-pin-area" style="color: var(--accent); font-size: 16px;"></i>
                    <strong>Souřadnice bodu</strong>
                </div>
                <button class="coords-popup-close-btn" onclick="map.closePopup(coordsPopup)" title="Zavřít">
                    <i class="ph-bold ph-x"></i>
                </button>
            </div>
            <div class="coords-popup-section">
                <span class="stat-label">Nadmořská výška</span>
                <span class="stat-value" id="coords-popup-elevation">Načítám...</span>
            </div>
            <div class="coords-popup-divider"></div>
            <div class="coords-popup-section-flex">
                <div class="coords-popup-section" style="margin: 0; border: none;">
                    <span class="stat-label">Souřadnice (WGS 84)</span>
                    <span class="coords-popup-val">${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E</span>
                </div>
                <button class="coords-copy-btn" onclick="copyCoordsWrapper(this, '${lat.toFixed(6)}, ${lng.toFixed(6)}')" title="Kopírovat do schránky">
                    <i class="ph-bold ph-copy"></i>
                </button>
            </div>
            <div class="coords-popup-divider"></div>
            <div class="coords-popup-section-flex">
                <div class="coords-popup-section" style="margin: 0; border: none;">
                    <span class="stat-label">Souřadnice (S-JTSK)</span>
                    <span class="coords-popup-val">Y: ${sjtskY}, X: ${sjtskX}</span>
                </div>
                <button class="coords-copy-btn" onclick="copyCoordsWrapper(this, '${sjtskY}, ${sjtskX}')" title="Kopírovat do schránky">
                    <i class="ph-bold ph-copy"></i>
                </button>
            </div>
        </div>
    `;

    coordsPopup = L.popup({ maxWidth: 400, minWidth: 320, className: 'coords-leaflet-popup' })
        .setLatLng(e.latlng)
        .setContent(popupHtml)
        .openOn(map);

    const elev = await fetchElevationForPoint(e.latlng);
    const elevEl = document.getElementById('coords-popup-elevation');
    if (elevEl) {
        if (elev) elevEl.innerHTML = `<span style="color: var(--accent);">${elev} m n.m.</span>`;
        else elevEl.innerHTML = "Nedostupné";
    }
}
