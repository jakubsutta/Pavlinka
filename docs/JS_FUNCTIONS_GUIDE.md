# 🧩 Průvodce JS funkcemi – Pavlínka

Tento dokument slouží jako rychlý přehled všech klíčových JavaScript funkcí a jejich účelu.  
Soubory pro aplikaci Pavlínka se načítají v tomto pořadí (záleží na závislostech):

```
config.js → map.js → routing.js → layers.js → ui.js → tools.js →
search.js → katastr.js → elevationProfile.js → viewshed.js → solar.js → boxy.js → init.js
```

> `legend-config.js` se načítá před `config.js` (globální const LEGEND_DATA).  
> `init.js` musí být vždy poslední – obnovuje stav z LocalStorage.

*Poznámka: Projekt MapEurope (Státy) běží odděleně v souboru `states.html` a používá výhradně izolovaný skript `states-map.js`. Pro detailní rozpis jeho funkcí viz `STATES_JS_GUIDE.md`.*

---

## 📁 `js/config.js`
Globální konstanty, žádné funkce.

| Proměnná | Popis |
|---|---|
| `center` | Výchozí střed mapy `[lat, lng]` |
| `bounds` | Maximální hranice pohybu mapy |
| `FLOORPLAN_TYPES` | Mapa typů místností → barva, text |
| `floorplanOverrides` | LocalStorage cache přepisů půdorysů |
| `cameraOverrides` | LocalStorage cache přepisů kamer |
| `photoOverrides` | LocalStorage cache fotografií objektů |
| `supabaseUrl`, `supabaseKey` | Přihlašovací údaje k Supabase |
| `qgisGroupMeta` | Metadata skupin QGIS vrstev (ikona, barva, název) |
| `cesiumViewer` | Reference na instanci Cesium (null = neaktivní) |

---

## 📁 `js/map.js`
Inicializace mapy, basemapy, WMS vrstvy, Street View, souřadnicový nástroj.

| Funkce | Popis |
|---|---|
| `map` | Hlavní instance Leaflet mapy (globální `const`, bez `minZoom`) |
| `overlayLayers` | Objekt všech WMS overlay vrstev (klíč = `id` checkboxu) |
| `saveWmsState()` | Uloží zapnuté WMS vrstvy do LocalStorage |
| `toggleStreetViewMode()` | Zapne/vypne režim Street View do embed panelu |
| `updateStreetViewPosition(latlng)` | Aktualizuje iframe Street View na nové souřadnice |
| `onMapClickForStreetView(e)` | Reakce na klik v mapě – aktualizuje Street View |
| `toggleCoordsMode()` | Zapne/vypne mód kliknutí → zobrazení souřadnic |
| `onMapClickForCoords(e)` | Zachytí klik a zobrazí souřadnice v panelu |
| `initCesium3DView()` | Inicializuje 3D pohled přes CesiumJS |
| `fetchFotbalData()` | async – stáhne a vyfiltruje lokální `iscus_fotbal.geojson` vrstvu do Viewportu |

**Klíčové WMS checkbox eventy:**
- `input.wms-overlay[change]` → přidá/odstraní vrstvu z `overlayLayers` a uloží stav

---

## 📁 `js/routing.js`
Nástroj Trasa – vyhledávání tras pomocí OSRM a geocodingu přes ArcGIS REST API.

| Funkce / Vlastnost | Popis |
|---|---|
| `RoutingTool` | Hlavní objekt nástroje (singleton, volá `init()` po načtení) |
| `.init()` | Inicializuje DOM reference, event listenery (tlačítko, přepínače) |
| `._getProfile()` | Vrátí aktivní profil: `'driving'` / `'cycling'` / `'foot'` |
| `._suggest(val, type)` | async – Našeptávač adres přes ArcGIS World Geocoding Service |
| `._geocodeByMagicKey(key, text, type)` | async – Geokóduje adresu přes magicKey |
| `._geocode(label, type)` | async – Fallback geokódování bez magicKey |
| `._placePoint(ll, label, type)` | Umístí marker na mapu (start/cíl). Nespouští trasu automaticky! |
| `.fetchRoute()` | async – Zavolá OSRM, vykreslí dvouvrstvou trasu + tooltip |
| `.clearRoute()` | Smaže markery, trasu, tooltip a výsledky |
| `._osrmBaseUrl` | Objekt URL dle profilu: driving/cycling/foot (různé OSRM servery) |

**Vizuální styl trasy:**
- Dvouvrstvý „cased" styl (tmavý obrys 9px + barevná výplň 5px)
- Barvy: Auto = červená, Kolo = modrá, Pěšky = teal (+ tečkovaná linie)
- Trasa se spouští **pouze** kliknutím na tlačítko „Vyhledat trasu"

---

## 📁 `js/layers.js`
Stylování a načítání QGIS vrstev ze Supabase, interakce s prvky, legenda.

| Funkce | Popis |
|---|---|
| `getStyle(feature, layerType)` | Vrací Leaflet style objekt pro daný feature/layerType |
| `resetSelectedLayer()` | Odznačí aktuálně vybraný prvek (vrátí původní styl) |
| `onEachFeature(feature, layer, layerType)` | Přidá hover/click eventy na každý GeoJSON prvek |
| `setGroupOpacity(group, opacity)` | Nastaví průhlednost celé skupiny vrstev |
| `initLayerOpacityControls()` | Inicializuje slidery průhlednosti vedle checkboxů vrstev |
| `nactiDataZeSupabase(tabulka)` | async – stáhne GeoJSON z Supabase REST API |
| `saveQgisState()` | Uloží zapnuté QGIS vrstvy do LocalStorage |
| `setMapLoader(show)` | Zobrazí/skryje spinner loader přes mapu |
| `updateGroupCounters()` | Aktualizuje počítadla `(x/y)` u skupin vrstev |
| `updateActiveGroupsIndicator()` | Aktualizuje ikonky aktivních skupin vrstev (v rohu mapy) |
| `buildMetaBadgesHtml(meta)` | Sestaví HTML `.layer-meta-badges` z meta objektu pro popup legendy |

**Klíčové globální proměnné:**
- `skupinyVrstev` – `{key: L.LayerGroup}` – aktivní QGIS vrstvy na mapě
- `qgisFeaturesData` – `{key: [properties]}` – data pro seznam objektů
- `_selectedLayer` – reference na aktuálně vybraný Leaflet layer

---

## 📁 `js/ui.js`
Pravý panel, záložky, detail a editace objektů, seznam objektů.

| Funkce | Popis |
|---|---|
| `hideAll()` | Skryje všechny panely (záložky, detail, editaci) |
| `showTabs()` | Zobrazí hlavní záložky, skryje detail/editaci |
| `showToast(message)` | Zobrazí dočasnou notifikaci (2.5s) v rohu obrazovky |
| `compressAndGetBase64(file, maxW, maxH, quality)` | async – zkomprimuje obrázek a vrátí Base64 string |
| `openDetailView(properties, layerType)` | Otevře detail vybraného objektu (read-only zobrazení) |
| `openEditForm(properties)` | Otevře formulář pro editaci objektu |
| `getLegendKey(table)` | Převede název tabulky na klíč do `LEGEND_DATA` |
| `getGeometryCategory(geomType)` | Převede WKT typ geometrie na `'Body'/'Linie'/'Plochy'` |
| `zoomToQgisFeature(table, id)` | Přiblíží mapu na konkrétní prvek, spustí jeho `click` event |
| `renderObjectsList()` | Vykreslí seznam QGIS objektů v kartě Objekty/Data |

---

## 📁 `js/tools.js`
Měření vzdáleností, kreslení (Geoman), přepínání módů, tisk, mazání kresby.

| Funkce | Popis |
|---|---|
| `startMeasurement()` | Spustí mód měření (čára na mapě) |
| `finishMeasurement()` | Dokončí a zobrazí výsledek měření |
| `clearMeasurement()` | Smaže všechny nakreslené měřicí prvky |
| `onMapClickMeasure(e)` | Přidá bod do aktuálního měření |
| `onMapMouseMoveMeasure(e)` | Vykresluje živou linii při pohybu myši |

**Klíčové globální stavové proměnné:**
- `isMeasuring` – `bool` – je aktivní mód měření?
- `_measureActive` – alternativní stav (pro interoperabilitu s jinými skripty)

---

## 📁 `js/search.js`
Vyhledávání adres přes Nominatim (OpenStreetMap geocoder).

| Funkce | Popis |
|---|---|
| `searchAddress(query)` | async – zavolá Nominatim API, vrátí výsledky |
| `displayResults(results)` | Vykreslí dropdown výsledků pod vyhledávacím polem |
| `selectResult(result)` | Přiblíží mapu na vybraný výsledek, přidá dočasný marker |

---

## 📁 `js/katastr.js`
WMS GetFeatureInfo dotazování – katastr, DTM sítě, dopravní info, dopravní kamery.

| Funkce | Popis |
|---|---|
| `getActiveQueryTarget()` | Vrátí hodnotu zaškrtnutého radio buttonu (`'kn'/'dtm'/'dopravni-info'`) |
| `queryKatastrGetFeatureInfo(latlng, source)` | Dotaz na WMS ČÚZK katastr nemovitostí, zobrazí výsledky |
| `queryDtmGetFeatureInfo(latlng, source)` | Dotaz na WMS technické sítě DTM |
| `queryDopravniInfoGetFeatureInfo(latlng, source)` | Dotaz na WMS NDIC dopravní info + ESRI dopravní kamery |
| `renderKatastrFeature(feature)` | Vykreslí jeden feature z katastru do HTML výsledků |
| `renderDtmFeature(feature)` | Vykreslí jeden feature z DTM do HTML výsledků |
| `renderDopravniFeature(feature)` | Vykreslí jeden feature z dopravní vrstvy (s obrázkem kamery) |
| `clearKatastrHoverHighlight()` | Smaže hover zvýraznění parcel z mapy |
| `drawGeometry(feature, type, latlng)` | Vykreslí geometrii z WFS na mapu (klik/hover highlight) |

**Klíčová logika kliknutí do mapy:**
```
map.on('click') →
  kontrola: isMeasuring / pm.drawing / streetViewActive / viewshedAnalyzer.active → skip
  getActiveQueryTarget() → pokud není nic, skip
  kontrola checkboxů (layer-kn / layer-dtm-ti / dopravni-info / dopravni-kamery) → pokud žádná aktivní, skip
  → spustí příslušný query*GetFeatureInfo()
```

---

## 📁 `js/elevationProfile.js`
Výškový profil trasy – data z ČÚZK DMR 5G API.

| Funkce | Popis |
|---|---|
| `startElevationProfiling()` | Spustí mód kreslení trasy pro výškový profil |
| `finishElevationProfile(latlngs)` | async – stáhne výšková data, vykreslí graf (Chart.js) |
| `clearElevationProfile()` | Smaže vrstvu, graf a statistiky |
| `exportProfileChart()` | Uloží graf jako PNG soubor |

---

## 📁 `js/viewshed.js`
Analýza viditelnosti z bodu – stáhne výšková data (Terrarium AWS) a provede ray-casting.

| Třída/Funkce | Popis |
|---|---|
| `class ViewshedAnalyzer` | Hlavní třída analytického nástroje |
| `.toggleSelectionMode()` | Zapne/vypne mód výběru bodu (kurzor crosshair) |
| `.cancelSelectionMode()` | Zruší mód výběru bez akce |
| `.clear()` | Smaže vrstvu výsledku a marker z mapy |
| `.onMapClick(e)` | Zachytí klik, přidá marker, spustí výpočet |
| `.calculateViewshed(latlng, observerH, obstacleH, radius)` | async – stáhne Terrarium dlaždice, ray-casting, vykreslí overlay |

**Inicializace:** Po načtení DOM čeká na `typeof map.getZoom === 'function'` (setInterval 500ms), pak vytvoří `window.viewshedAnalyzer`.

---

## 📁 `js/solar.js`
Analýza solárního záření – výpočet potenciálu solárního záření pro dané místo.

| Funkce | Popis |
|---|---|
| *(specifické funkce dle implementace)* | Výpočty a vizualizace solárního potenciálu v mapě |

---

## 📁 `js/boxy.js`
Výdejní boxy (Z-BOX, Alza apod.) – načítá a zobrazuje vrstvu výdejních míst z externího API.

| Funkce | Popis |
|---|---|
| *(specifické funkce dle implementace)* | Fetch + vykreslení výdejních boxů jako mapových markerů |

---

## 📁 `js/init.js`
Inicializace a obnova stavu z LocalStorage po načtení stránky.

Spouští se na `DOMContentLoaded`:
1. `initLayerOpacityControls()` – slidery průhlednosti
2. Obnoví poslední basemap
3. Obnoví zapnuté WMS vrstvy
4. Obnoví zapnuté QGIS vrstvy
5. Přepne na poslední aktivní záložku

Na `window.load`: Skryje preloader (s 800ms zpožděním).

---

## 📁 `js/legend-config.js`
Statická data legendy. Exportuje globální `const LEGEND_DATA`.

Každý klíč (např. `'kn'`, `'camera_point'`) obsahuje:
- `title` – název legendy
- `meta` – objekt s metadaty: `{ dataType: 'raster'|'vector'|'3d', geomType: 'point'|'line'|'polygon'|'mixed', queryable: bool }`
- `items` – pole `{ type, color, text }` pro položky legendy

Metadata se renderují přes `buildMetaBadgesHtml(meta)` v `layers.js` jako barevné odznaky `.lmb`.

---

## 📁 `js/lib/SmoothWheelZoom.js`
Vendored knihovna třetí strany. Rozšiřuje Leaflet o plynulé scrollování. Neupravovat.

---

## 📁 `scripts/fetch_iscus.py` (Python skript pro data)
Standalone skript mimo hlavní JS bundle. Slouží pouze pro offline aktualizaci databáze fotbalových hřišť. Stahuje JSON data z `iscus.cz`, extrahuje markery a ukládá je jako `data/iscus_fotbal.geojson`. Spouští se ručně: `python3 scripts/fetch_iscus.py`.
