# 🤖 Pravidla a Design Manuál pro AI (Pavlínka)

Tento soubor slouží jako **závazný design manuál** pro jakéhokoli AI agenta pracujícího na tomto repozitáři. Při vytváření nových prvků, funkcí nebo stylů se vždy podívej na tyto zásady, aby byl zaručen konzistentní a prémiový vzhled webové aplikace Pavlínka.

---

## 0. Struktura projektu

```
Pavlinka/
├── index.html              # Hlavní HTML stránka aplikace Pavlínka
├── states.html             # Sesterská aplikace MapEurope (Státy – Místa, kde jsem byl)
├── info.html               # Statická info/O aplikaci stránka
├── docs/
│   ├── AI_DESIGN_GUIDELINES.md  # Tento soubor – závazný design manuál
│   ├── JS_FUNCTIONS_GUIDE.md    # Přehled JS funkcí pro Pavlínku
│   ├── STATES_JS_GUIDE.md       # Přehled JS funkcí pro MapEurope
│   └── STATES_CSS_GUIDE.md      # CSS design a styling manuál pro MapEurope
├── css/
│   ├── style.css           # Hlavní stylesheet (4000+ řádků, primární)
│   ├── basemap.css         # Styly přepínačů podkladových map + info overlay
│   ├── elevationProfile.css# Styly výškového profilu a stat-boxů
│   ├── form-style.css      # Styly formulářů a input prvků
│   ├── layers.css          # Styly správce vrstev
│   ├── legend.css          # Styly legendy + metadata štítky (.lmb)
│   ├── routing.css         # Styly nástroje Trasa (routing panel)
│   ├── state_style.css     # SMAZÁN – byl součástí MapEurope
│   ├── info.css            # Pouze pro info.html
│   └── status.css          # Styly modalu stavu projektu + .btn, .btn-update, .btn-actual, .btn-experimental, .btn-to_update
├── js/
│   ├── config.js           # Globální konstanty (načíst jako 1.)
│   ├── map.js              # Mapa, basemapy, WMS, Street View, Cesium
│   ├── routing.js          # Nástroj Trasa (OSRM routing, geocoding ArcGIS)
│   ├── layers.js           # QGIS/Supabase vrstvy, stylování, legenda
│   ├── ui.js               # Panel, záložky, detail, editace objektů
│   ├── tools.js            # Měření, kreslení (Geoman), tisk
│   ├── search.js           # Vyhledávání adres (Nominatim)
│   ├── katastr.js          # WMS GetFeatureInfo dotazování
│   ├── elevationProfile.js # Výškový profil (DMR 5G + Chart.js)
│   ├── viewshed.js         # Analýza viditelnosti (Terrarium + ray-casting)
│   ├── solar.js            # Analýza solárního záření
│   ├── boxy.js             # Výdejní boxy (Z-BOX, Alza…) – vrstva z API
│   ├── legend-config.js    # Statická data legendy (LEGEND_DATA const)
│   ├── init.js             # Inicializace stavu (načíst jako POSLEDNÍ!)
│   ├── floorplan.js        # Půdorysy (Excalidraw, Supabase pudorysy tabulka)
│   └── lib/
│       └── SmoothWheelZoom.js  # Vendored lib (neupravovat)
└── img/                    # Náhledové obrázky podkladových map
```

**Pořadí načítání JS souborů v index.html** (důležité pro závislosti):
```
config.js → map.js → routing.js → layers.js → ui.js → tools.js →
search.js → katastr.js → elevationProfile.js → viewshed.js → solar.js → boxy.js → init.js
```
> `legend-config.js` se načítá před `config.js` (globální const LEGEND_DATA).  
> `init.js` musí být vždy poslední – obnovuje stav z LocalStorage.

---

## 1. Technologický Stack & Přístup
- **Základ:** Čisté HTML, CSS a Vanilla JavaScript (žádný React, Angular ani Vue.js).
- **Stylování:** Čisté CSS (bez Tailwindu a jiných frameworků). Využívají se CSS proměnné definované v souborech (např. `--accent`, `--text`, `--text-light`).
- **Mapová knihovna:** Leaflet.js (+ Geoman pro kreslení, Esri Leaflet pro služby ČÚZK/ArcGIS).
- **Ikony:** Výhradně **Phosphor Icons** (např. `<i class="ph ph-map-pin"></i>` nebo `<i class="ph-bold ph-chart-line"></i>`). Nepoužívat FontAwesome!
- **Routování:** OSRM backend (různé servery dle profilu – viz `routing.js`).

---

## 2. Barevná Paleta
- **Primární / Akcentní barva:** `#50c878` (Emerald Green, využívá se jako `--accent`).
  - Světlejší varianta border: `#62d488` (`--accent-light`)
  - Tmavší varianta: `#368c54`
- **Texty:**
  - Hlavní text: `#333333` nebo `#222222`
  - Sekundární texty / popisky: `#888888` nebo `#666666`
- **Pozadí:**
  - Zcela bílá: `#ffffff`
  - Jemně šedá pro odlišení (panely, stat boxy): `#fcfcfc`, `#f8f9fa`, `rgba(0, 0, 0, 0.02)`
- **Výstrahy / Stavy:**
  - Danger (Smazat, Ukončit): `#e63946`
  - Úspěch / Pozitivní: `#4CAF50`
  - Informační: `#2196F3`

---

## 3. Typografie
- **Písmo:** `Roboto, sans-serif`.
- **Nadpisy:** Čisté, ne příliš velké, často s barvou `--accent`.
- **Malé popisky (Labels):** Používat velikost `10px - 11px`, `text-transform: uppercase`, tloušťka `700` a mírný `letter-spacing: 0.05em`. (Typicky třída `.stat-label`).
- **Zvýrazněné hodnoty (Values):** Větší font (`13px - 16px`), velmi tučné (`800`), barva `#222` (Typicky třída `.stat-value`).

---

## 4. UI Prvky & Design Patterns

### 4.1 Tlačítka (Buttons)
Vždy používej existující systém tříd pro tlačítka. Tlačítka by měla obsahovat ikonu zleva a text.
- **Základní akční tlačítko:** `.tab-action-btn` (Display flex, gap 6px, border-radius 4px, centrování).
- **Potvrzovací/Hlavní akce:** Přidej modifikátor `.tab-action-btn--confirm`.
- **Kritická akce (Smazání):** Přidej modifikátor `.tab-action-btn--danger`.
- Vždy přidávej plynulé přechody (`transition: background-color 0.2s, transform 0.2s;`).
- Tlačítka musí mít `inline-flex` layout – zabrání layoutovým posunům při přidávání modifikátorů.

**Stavové tlačítko projektu** (v hlavičce panelu, `#project-status-btn`):
Používá třídy `.btn` + modifikátor. Definovány v `css/status.css`. **Nikdy nemazat!**
Vzor: **světlé pozadí + tmavý text** v dané barvě (NIKDY bílý text na plném pozadí).
- `.btn-update` – 🟠 bg `#ffedd5`, text `#c2410c` – Pavlínka se aktualizuje
- `.btn-to_update` – 🟡 bg `#fefce8`, text `#854d0e` – K doplnění
- `.btn-actual` – 🟢 bg `#dcfce7`, text `#15803d` – Vše aktuální
- `.btn-experimental` – 🔵 bg `#dbeafe`, text `#1d4ed8` – Experimentální funkce

### 4.2 Panely a Karty (Cards / Stat Boxes)
Pro jakékoliv zobrazování datových výsledků (např. výsledky měření, analytika) používej prémiový vzhled „karet":
- **Základ (Kontejner):** Bílý nebo `#fcfcfc` podklad.
- **Rámeček:** Jemný a moderní: `border: 1px solid rgba(0, 0, 0, 0.06)`.
- **Zaoblení (Border-radius):** Maximální povolené zaoblení je `4px` pro konzistentní, ostřejší a techničtější vzhled.
- **Stíny:** Extrémně jemné: `box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03)`.
- **Hover efekty (Interakce):** U interaktivních karet použij `transform: translateY(-2px)` a mírně silnější stín.
- **Struktura položky (Stat box):**
  ```html
  <div class="stat-box">
    <div class="stat-icon" style="color: var(--accent);"><i class="ph-bold ph-trend-up"></i></div>
    <div class="stat-content">
      <span class="stat-label">Label</span>
      <span class="stat-value">Hodnota</span>
    </div>
  </div>
  ```

### 4.3 Navigační prvky (Přepínače / Switchers)
Existují **dva typy přepínačů** – musí být vizuálně odlišeny:

**Hlavní přepínač** (`.notes-switcher` + `.notes-switch-btn`):
- Tmavě zelené aktivní pozadí, bílý text a ikona.
- Použití: přepínání hlavních nástrojů (Trasa / Výška / Viditelnost apod.).

**Podřízený přepínač / segmented control** (`.draw-tools` + `.draw-tool-btn`):
- Šedý track, aktivní stav = bílý chip + zelený text/ikona.
- Použití: přepínání variant uvnitř nástroje (Auto / Kolo / Pěšky, Den / Noc apod.).
- Vizuálně odlišnější od hlavního přepínače – menší, iOS-style.

- Hover efekt nesmí schovat ikonu u aktivního stavu (selektor `.notes-switch-btn:hover:not(.active) i`).
- **Pozor na velikost:** Panel má pevnou šířku. Při přidávání nového přepínače zmenši `font-size` na `11.5px` a `padding` na `8px 4px`, aby se nepřetékalo.

### 4.4 Posuvníky (Sliders)
- **Všechny posuvníky (rozsahy, průhlednost, parametry analýz)** musí vypadat konzistentně napříč celou aplikací (stejně jako posuvník průhlednosti vrstev v `.layer-opacity-slider`).
- Posuvníky vždy spoléhají na výchozí vlastnost **`accent-color: var(--accent);`** a jednoduchou stopu posuvníku s `background: #e2e8f0;`.
- **Thumb (Úchopový bod):** Musí mít velikost 10x10 px, zaoblení `50%`, výplň `var(--accent)`, tenký bílý okraj `1.5px solid #ffffff` a jemný stín `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25)`.
- Tento konzistentní vzhled se řídí existující CSS třídou `.range-slider`. Nevytvářej nové nebo odlišné verze.

### 4.5 Indikátory nad mapou (Plovoucí prvky)
- Prvky vznášející se nad mapou (např. indikátory aktivních skupin vrstev `.active-group-icon`) by měly mít sjednocený vzhled a nereagovat neočekávaně na barvy podkladu.
- **Pozadí:** Pro barvení těchto prvků je ideální použít plně bílé pozadí (`#ffffff`) a přes něj aplikovat poloprůhledný barevný tint pomocí absolutně pozicovaného `::before` pseudo-elementu.
- **Rozměry a tvary:** Kompaktní velikost (např. 28x28 px), zaoblení `var(--border-radius)`, centrovaný obsah (flexbox).
- **Stíny:** Jemné, např. `box-shadow: 0 2px 6px rgba(0,0,0,0.15)`.
- **Barvy ikon:** Musíš explicitně cílit na tag `i` (např. `.active-group-icon i { color: var(--icon-color) !important; }`).

### 4.6 Popup v mapě (Leaflet Popup) — ZÁVAZNÝ VZOR

Všechny popup bubliny v mapě (pro OSM vrstvy, souřadnice, vyhledávání) **musí** používat třídu `coords-leaflet-popup` a jednotnou HTML strukturu uvnitř. Nikdy nepiš popup bez obalového `coords-popup-container`!

**Registrace popupu:**
```js
marker.bindPopup(popupHtml, { className: 'coords-leaflet-popup', maxWidth: 400 });
// nebo s pevnou šířkou pro jednoduché popupy:
marker.bindPopup(popupHtml, { className: 'coords-leaflet-popup', minWidth: 240, maxWidth: 400 });
```

**Struktura HTML (závazná):**
```html
<div class="coords-popup-container" style="width: 240px; box-sizing: border-box;">

    <!-- HLAVIČKA: ikona + název + tlačítko zavřít -->
    <div class="coords-popup-header">
        <div style="display:flex; align-items:center; gap:6px; color:var(--accent); min-width:0; overflow:hidden;">
            <i class="ph-fill ph-map-pin" style="font-size:15px; flex-shrink:0;"></i>
            <strong style="font-size:13px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Název</strong>
        </div>
        <button class="coords-popup-close-btn" onclick="map.closePopup()" title="Zavřít">
            <i class="ph-bold ph-x"></i>
        </button>
    </div>

    <!-- ODDĚLOVAČ (vždy za hlavičkou) -->
    <div class="coords-popup-divider"></div>

    <!-- SEKCE: každá sekce = jeden datový blok -->
    <div class="coords-popup-section">
        <span class="stat-label" style="display:flex; align-items:center; gap:4px;">
            <i class="ph-bold ph-map-pin"></i> Popisek sekce
        </span>
        <span class="coords-popup-val" style="color:#333;">Hodnota</span>
    </div>

</div>
```

**Klíčová pravidla:**
- Šířka: `width: 240px` pro kompaktní popupy, `width: 280px` pro datově bohatší.
- Ikony v `stat-label` jsou **vždy** z Phosphor (`ph-bold`).
- Barva hodnot `.coords-popup-val` musí být explicitně `color:#333;`.
- Zavírací tlačítko `coords-popup-close-btn` je **povinné** — volá `map.closePopup()`.

### 4.7 Metadata štítky vrstev (Layer Meta Badges)

Legendové popupy (ozubené kolo) a info overlay podkladových map zobrazují barevné odznaky s metadaty.
Třídy definovány v `css/legend.css`. Data jsou v `js/legend-config.js` pod klíčem `meta`.

```html
<div class="layer-meta-badges">
  <span class="lmb lmb--raster"><i class="ph-bold ph-image"></i> Rastr</span>
  <span class="lmb lmb--polygon"><i class="ph-bold ph-polygon"></i> Polygon</span>
  <span class="lmb lmb--queryable"><i class="ph-bold ph-cursor-click"></i> Dotazovací</span>
</div>
```

**Barevné schéma odznaků:**
| Třída | Barva | Ikona | Účel |
|---|---|---|---|
| `.lmb--raster` | 🟢 zelená | `ph-image` | Rastrová (WMS) vrstva |
| `.lmb--vector` | 🔴 červená | `ph-line-segments` | Vektorová (QGIS/GeoJSON) |
| `.lmb--3d` | 🔵 modrá | `ph-three-d` | 3D podkladová mapa |
| `.lmb--queryable` | 🟡 žlutá | `ph-cursor-click` | Klikatelná vrstva (GetFeatureInfo) |
| `.lmb--point` | 🟠 oranžová | `ph-dot-outline` | Geometrie: bod |
| `.lmb--line` | 🟠 oranžová | `ph-line-segment` | Geometrie: linie |
| `.lmb--polygon` | 🟠 oranžová | `ph-polygon` | Geometrie: polygon |
| `.lmb--mixed` | 🟠 oranžová | `ph-line-segments` | Smíšená geometrie |

---

## 5. Výkon, Mapy a Architektura
1. **Leaflet Miniatury a Klonování vrstev:** Pokud potřebuješ vytvořit vedlejší `L.map` instanci, vždy inicializuj s `preferCanvas: true`.
2. **Skrývání UI při tisku:** Leaflet ovládací prvky nesmí jít do tisku. Používej `.leaflet-control-container { display: none !important; }` uvnitř `@media print`.
3. **Proměnná `map`:** Je deklarována jako `const map = L.map(...)` v `map.js`. **Není** na `window.map`! Při přístupu z jiných souborů používej přímý název `map`.
4. **`minZoom`:** Mapa **nemá** nastavený `minZoom` – lze se libovolně oddalovat. Nepoužívej `setMinZoom()` jako workaround. Pokud potřebuješ fitBounds pro dalekou trasu, Leaflet to zvládne sám.
5. **Routování (OSRM):** Každý dopravní profil používá jiný backend server – viz `routing.js`. Trasa se spouští **výhradně** kliknutím na tlačítko „Vyhledat trasu", nikoli automaticky po zadání adresy.

---

## 6. Přidávání nových nástrojů / záložek

### Přidání nového nástroje do záložky „Nástroje pro mapu" (Měřit):
1. Přidej tlačítko-přepínač do `.notes-switcher` v `index.html` s atributem `data-notes-mode="nazev"`.
2. Přidej sekci `<div id="notes-nazev-section" class="notes-section">` do stejné záložky.
3. Existující JS v `tools.js` automaticky zajistí přepínání (event listener na `.notes-switch-btn`).
4. Vytvoř nový soubor `js/nazevNastroje.js` a přidej ho **před** `</body>` v `index.html`.

### WMS dotazování (katastr.js):
Logika kliknutí do mapy funguje takto:
```
map.on('click') →
  blokovací podmínky (isMeasuring / pm.drawing / streetView / viewshed) → skip
  getActiveQueryTarget() → 'kn' / 'dtm' / 'dopravni-info'
  ověření checkboxů (DOM id: 'layer-kn' / 'layer-dtm-ti' / 'dopravni-info','dopravni-kamery') → skip
  → queryXxxGetFeatureInfo(latlng, 'click')
```

### Viewshed (viditelnost):
- Spravuje třída `ViewshedAnalyzer` v `js/viewshed.js`.
- Instance je na `window.viewshedAnalyzer`.
- Stav aktivního výběru bodu je `window.viewshedAnalyzer.active` (boolean).

---

## 7. Pravidla pro psaní kódu (AI)
1. **Znovupoužitelnost:** Než vytvoříš nové CSS třídy, zkontroluj `css/style.css`, jestli už neexistuje třída s podobným účelem.
2. **Konzistence okrajů:** Standardizované mezery: gap `4–10px`, marginy `15px`, padding `8–12px`.
3. **Plovoucí prvky mapy:** `box-shadow: 0 1px 5px rgba(0,0,0,0.4)`, `border-radius: 4px`, bílé pozadí, min. 34×34 px.
4. **Responzivita:** V pravém panelu vždy `display: flex`, `flex-direction: column`, `gap` pro mezery.
5. **Žádné zakomentované bloky kódu:** Smazej, nevybírej. Git slouží jako záloha.
6. **Čti JS guide:** Před psaním kódu si přečti `docs/JS_FUNCTIONS_GUIDE.md`, abys nevytvářel duplicitní funkce.
7. **Cache-busting:** Při úpravě souborů jako `routing.js` (pokud mají `?v=N` parametr), bumputuj verzi.
8. **LEGEND_DATA metadata:** Každý nový záznam v `legend-config.js` musí mít pole `meta: { dataType, geomType, queryable }`.

---
*Udržuj aplikaci čistou, rychlou a designově „prémiovou" (tzv. WOW efekt ihned po načtení UI).*
