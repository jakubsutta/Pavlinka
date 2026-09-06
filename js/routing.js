/*
 * routing.js – Nástroj Vyhledat trasu
 * Geocoding / Suggest: RUIAN ČÚZK API (stejné jako search.js)
 * Routing:             OSRM (per-profile backendy)
 *   - Auto:   https://router.project-osrm.org/route/v1/driving/
 *   - Kolo:   https://routing.openstreetmap.de/routed-bike/route/v1/cycling/
 *   - Pěšky:  https://routing.openstreetmap.de/routed-foot/route/v1/foot/
 */

const RoutingTool = {
    startPoint:  null,
    endPoint:    null,
    startMarker: null,
    endMarker:   null,
    routeLayer:  null,
    routeLabel:  null,

    _debounceStart: null,
    _debounceEnd:   null,

    // OSRM backendy dle profilu (veřejné instance OSM/OSRM)
    _osrmBaseUrl: {
        driving: 'https://router.project-osrm.org/route/v1/driving/',
        cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/cycling/',
        foot:    'https://routing.openstreetmap.de/routed-foot/route/v1/foot/'
    },

    // ── Inicializace ──────────────────────────────────────────────────────────
    init() {
        this._els = {
            startInput:       document.getElementById('route-start-input'),
            endInput:         document.getElementById('route-end-input'),
            startSuggestions: document.getElementById('route-start-suggestions'),
            endSuggestions:   document.getElementById('route-end-suggestions'),
            btnStartSearch:   document.getElementById('btn-route-start-search'),
            btnEndSearch:     document.getElementById('btn-route-end-search'),
            btnRoute:         document.getElementById('btn-route-start'),
            btnClear:         document.getElementById('btn-route-clear'),
            status:           document.getElementById('route-status'),
            results:          document.getElementById('route-results'),
        };

        if (!this._els.btnRoute) return;

        // Tlačítka – trasa POUZE na kliknutí, ne automaticky
        this._els.btnRoute.addEventListener('click', () => this.fetchRoute());
        this._els.btnClear.addEventListener('click', () => this.clearRoute());

        // Suggest – Start
        this._els.startInput.addEventListener('input', () => {
            clearTimeout(this._debounceStart);
            this._debounceStart = setTimeout(() =>
                this._suggest(this._els.startInput.value, 'start'), 300);
        });
        this._els.startInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') this._geocode(this._els.startInput.value, 'start');
        });
        this._els.btnStartSearch.addEventListener('click', () =>
            this._geocode(this._els.startInput.value, 'start'));

        // Suggest – Cíl
        this._els.endInput.addEventListener('input', () => {
            clearTimeout(this._debounceEnd);
            this._debounceEnd = setTimeout(() =>
                this._suggest(this._els.endInput.value, 'end'), 300);
        });
        this._els.endInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') this._geocode(this._els.endInput.value, 'end');
        });
        this._els.btnEndSearch.addEventListener('click', () =>
            this._geocode(this._els.endInput.value, 'end'));

        // Klik do mapy → umísti bod (BEZ automatického výpočtu trasy)
        map.on('click', e => this._onMapClick(e));

        // Schovej suggestions po kliknutí jinam
        document.addEventListener('click', e => {
            if (!e.target.closest('#notes-route-section')) {
                this._hideSuggestions('start');
                this._hideSuggestions('end');
            }
        });

        // Markery – Phosphor ikony jako divIcon
        this._startIcon = L.divIcon({
            html: '<i class="ph ph-map-pin" style="color:#50c878;font-size:28px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));"></i>',
            className: '',
            iconSize:   [28, 28],
            iconAnchor: [14, 28]
        });
        this._endIcon = L.divIcon({
            html: '<i class="ph-fill ph-map-pin" style="color:#e63946;font-size:28px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));"></i>',
            className: '',
            iconSize:   [28, 28],
            iconAnchor: [14, 28]
        });
    },

    // ── Pomocné ──────────────────────────────────────────────────────────────
    _isActive() {
        const btn = document.querySelector('.notes-switch-btn.active');
        return btn && btn.dataset.notesMode === 'route';
    },

    _setStatus(html, error = false) {
        if (!this._els?.status) return;
        this._els.status.innerHTML = html;
        this._els.status.style.color = error ? '#e63946' : '';
    },

    _hideSuggestions(type) {
        const el = type === 'start' ? this._els.startSuggestions : this._els.endSuggestions;
        if (el) el.classList.add('hidden');
    },

    _getProfile() {
        return (document.querySelector('input[name="route-profile"]:checked')?.value) || 'driving';
    },

    // ── Klik do mapy ─────────────────────────────────────────────────────────
    _onMapClick(e) {
        if (!this._isActive()) return;

        // Třetí klik → reset a znova
        if (this.startPoint && this.endPoint) this.clearRoute();

        const ll = e.latlng;
        const coord = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;

        if (!this.startPoint) {
            this.startPoint = ll;
            if (this.startMarker) map.removeLayer(this.startMarker);
            this.startMarker = L.marker(ll, { icon: this._startIcon }).addTo(map);
            this._els.startInput.value = coord;
            this._setStatus('<i class="ph ph-map-pin"></i> Klikněte do mapy pro cílový bod');
        } else {
            this.endPoint = ll;
            if (this.endMarker) map.removeLayer(this.endMarker);
            this.endMarker = L.marker(ll, { icon: this._endIcon }).addTo(map);
            this._els.endInput.value = coord;
            // Trasa se NEspouští automaticky – uživatel klikne "Vyhledat trasu"
            this._setStatus('<i class="ph ph-check-circle"></i> Start i cíl nastaven – klikněte Vyhledat trasu');
        }
    },

    // ── RUIAN Suggest (autocomplete) ──────────────────────────────────────────
    async _suggest(text, type) {
        const container = type === 'start' ? this._els.startSuggestions : this._els.endSuggestions;
        if (!text || text.length < 3) {
            container.classList.add('hidden');
            return;
        }
        try {
            const params = new URLSearchParams({ text, maxSuggestions: '6', f: 'json' });
            const res  = await fetch(
                `https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE/suggest?${params}`
            );
            const data = await res.json();

            if (data.suggestions?.length) {
                container.innerHTML = '';
                data.suggestions.forEach(s => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = s.text;
                    div.addEventListener('click', () => {
                        const input = type === 'start' ? this._els.startInput : this._els.endInput;
                        input.value = s.text;
                        container.classList.add('hidden');
                        if (s.magicKey) this._geocodeByMagicKey(s.magicKey, s.text, type);
                        else            this._geocode(s.text, type);
                    });
                    container.appendChild(div);
                });
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        } catch (err) {
            console.error('RUIAN suggest error:', err);
        }
    },

    // ── RUIAN Geocode – plný text ─────────────────────────────────────────────
    async _geocode(query, type) {
        if (!query?.trim()) return;
        this._hideSuggestions(type);
        this._setStatus('<i class="ph ph-spinner ph-spin"></i> Vyhledávám adresu…');

        try {
            const params = new URLSearchParams({
                SingleLine:   query,
                outSR:        '4326',
                maxLocations: '1',
                f:            'json'
            });
            const res  = await fetch(
                `https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE/findAddressCandidates?${params}`
            );
            const data = await res.json();

            if (data.candidates?.length) {
                const c  = data.candidates[0];
                const ll = L.latLng(c.location.y, c.location.x);
                this._placePoint(ll, c.address, type);
            } else {
                this._setStatus('Adresa nenalezena v RUIAN.', true);
            }
        } catch (err) {
            console.error('RUIAN geocode error:', err);
            this._setStatus('Chyba při vyhledávání adresy.', true);
        }
    },

    // ── RUIAN Geocode – přes magicKey (výsledek suggest) ─────────────────────
    async _geocodeByMagicKey(magicKey, addressLabel, type) {
        const parts = magicKey.split('_');
        if (parts.length < 2) { this._geocode(addressLabel, type); return; }
        try {
            const url = `https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/${parts[0]}/query?objectIds=${parts[1]}&outSR=4326&returnGeometry=true&outFields=*&f=json`;
            const res  = await fetch(url);
            const data = await res.json();

            if (data.features?.length) {
                const f   = data.features[0];
                const geo = f.geometry;
                let lat, lng;

                if (geo.x !== undefined && geo.y !== undefined) {
                    lat = geo.y; lng = geo.x;
                } else if (geo.rings?.length) {
                    const ring = geo.rings[0];
                    lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
                    lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
                } else if (geo.paths?.length) {
                    lat = geo.paths[0][0][1]; lng = geo.paths[0][0][0];
                }

                if (lat !== undefined && lng !== undefined) {
                    this._placePoint(L.latLng(lat, lng), addressLabel, type);
                } else {
                    this._geocode(addressLabel, type);
                }
            } else {
                this._geocode(addressLabel, type);
            }
        } catch (err) {
            this._geocode(addressLabel, type);
        }
    },


    // ── Umísti bod na mapě ───────────────────────────────────────────────────
    _placePoint(ll, label, type) {
        const input = type === 'start' ? this._els.startInput : this._els.endInput;
        input.value = label;

        if (type === 'start') {
            this.startPoint = ll;
            if (this.startMarker) map.removeLayer(this.startMarker);
            this.startMarker = L.marker(ll, { icon: this._startIcon }).addTo(map);
        } else {
            this.endPoint = ll;
            if (this.endMarker) map.removeLayer(this.endMarker);
            this.endMarker = L.marker(ll, { icon: this._endIcon }).addTo(map);
        }
        map.setView(ll, Math.max(map.getZoom(), 14));

        // Informuj uživatele – trasa se NESPOUŠTÍ automaticky
        if (this.startPoint && this.endPoint) {
            this._setStatus('<i class="ph ph-check-circle"></i> Start i cíl nastaven – klikněte Vyhledat trasu');
        } else {
            this._setStatus('<i class="ph ph-check-circle"></i> Adresa nalezena');
        }
    },

    // ── Výpočet trasy (OSRM, per-profile backend) ────────────────────────────
    async fetchRoute() {
        if (!this.startPoint || !this.endPoint) {
            this._setStatus('Zadejte start i cíl.', true);
            return;
        }

        const profile = this._getProfile();
        this._setStatus('<i class="ph ph-spinner ph-spin"></i> Počítám trasu…');

        // Smazat starou trasu z mapy
        if (this.routeLayerOuter) { map.removeLayer(this.routeLayerOuter); this.routeLayerOuter = null; }
        if (this.routeLayer)      { map.removeLayer(this.routeLayer);      this.routeLayer      = null; }
        if (this.routeLabel)      { map.removeLayer(this.routeLabel);      this.routeLabel      = null; }

        // Per-profile OSRM backend URL
        const base = this._osrmBaseUrl[profile] ?? this._osrmBaseUrl.driving;
        const url = `${base}${this.startPoint.lng},${this.startPoint.lat};${this.endPoint.lng},${this.endPoint.lat}?overview=full&geometries=geojson`;

        try {
            const res  = await fetch(url);
            if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
            const data = await res.json();

            if (data.code !== 'Ok' || !data.routes?.length) {
                this._setStatus('Trasa nebyla nalezena.', true);
                return;
            }

            const route    = data.routes[0];
            const distKm   = (route.distance / 1000).toFixed(1);
            const totalMin = Math.round(route.duration / 60);
            const timeStr  = totalMin < 60
                ? `${totalMin} min`
                : `${Math.floor(totalMin / 60)} h ${totalMin % 60} min`;

            // Barvy dle profilu (vnější obrys + vnitřní barva)
            const outerColor = { driving: '#9b1220', cycling: '#1d4b63', foot: '#117265' }[profile] ?? '#9b1220';
            const innerColor = { driving: '#e63946', cycling: '#457b9d', foot: '#2a9d8f' }[profile] ?? '#e63946';

            // Vrstva 1 – tmavší obrys (cased road style)
            this.routeLayerOuter = L.geoJSON(route.geometry, {
                style: {
                    color:   outerColor,
                    weight:  9,
                    opacity: 1,
                    lineCap:  'round',
                    lineJoin: 'round'
                }
            }).addTo(map);

            // Vrstva 2 – barevná výplň
            this.routeLayer = L.geoJSON(route.geometry, {
                style: {
                    color:     innerColor,
                    weight:    5,
                    opacity:   1,
                    lineCap:   'round',
                    lineJoin:  'round',
                    dashArray: profile === 'foot' ? '1, 12' : null,
                    dashOffset: profile === 'foot' ? '0' : null
                }
            }).addTo(map);

            // Popisek přímo na středu linie v mapě
            const coords = route.geometry.coordinates;
            const midPt  = coords[Math.floor(coords.length / 2)];
            this.routeLabel = L.tooltip({
                permanent:   true,
                direction:   'top',
                offset:      [0, -4],
                className:   'route-line-tooltip',
                interactive: false
            })
            .setLatLng([midPt[1], midPt[0]])
            .setContent(`<i class="ph ph-ruler" style="margin-right:4px;"></i><strong>${distKm} km</strong> &nbsp;·&nbsp; <i class="ph ph-clock" style="margin-right:3px;"></i>${timeStr}`)
            .addTo(map);

            map.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40], maxZoom: 15 });

            this._setStatus('<i class="ph ph-check-circle"></i> Trasa nalezena');

            // Výsledky – stat-boxy dle design guide 4.2
            const ico = { driving: 'ph-car', cycling: 'ph-bicycle', foot: 'ph-sneaker' }[profile] ?? 'ph-car';
            this._els.results.innerHTML = `
              <div class="route-results-grid">
                <div class="route-stat-box">
                  <span class="route-stat-label"><i class="ph-bold ph-ruler"></i> Vzdálenost</span>
                  <span class="route-stat-value">${distKm}<span class="route-stat-unit"> km</span></span>
                </div>
                <div class="route-stat-box">
                  <span class="route-stat-label"><i class="ph-bold ph-clock"></i> Čas jízdy</span>
                  <span class="route-stat-value" style="font-size:13px;">${timeStr}</span>
                </div>
              </div>`;

        } catch (err) {
            console.error('Routing error:', err);
            this._setStatus('Chyba při výpočtu trasy.', true);
        }
    },

    // ── Smazat vše ───────────────────────────────────────────────────────────
    clearRoute() {
        if (this.startMarker)    { map.removeLayer(this.startMarker);    this.startMarker    = null; }
        if (this.endMarker)      { map.removeLayer(this.endMarker);      this.endMarker      = null; }
        if (this.routeLayerOuter){ map.removeLayer(this.routeLayerOuter);this.routeLayerOuter= null; }
        if (this.routeLayer)     { map.removeLayer(this.routeLayer);     this.routeLayer     = null; }
        if (this.routeLabel)     { map.removeLayer(this.routeLabel);     this.routeLabel     = null; }

        this.startPoint = null;
        this.endPoint   = null;

        if (this._els) {
            this._els.startInput.value   = '';
            this._els.endInput.value     = '';
            this._els.results.innerHTML  = '';
            this._setStatus('<i class="ph ph-circle-dashed"></i> Připraveno – zadejte start a cíl');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => RoutingTool.init(), 1200);
});
