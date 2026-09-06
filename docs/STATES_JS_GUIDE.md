# 🧩 MapEurope (Státy) – JS Průvodce (states-map.js)

Tento dokument slouží jako rychlý přehled logiky na pozadí aplikace **MapEurope (Státy)**, která běží nezávisle na hlavní aplikaci Pavlínka, ale využívá některé její UI prvky.

Veškerý kód aplikace je centralizován ve skriptu `js/states-map.js`. Všechny globální proměnné a hlavní funkce pro tuto aplikaci nesou **prefix `ms`** (Map States), aby nedošlo k případným budoucím konfliktům, pokud by se aplikace někdy musela sloučit s Pavlínkou.

---

## 💾 Správa dat a úložiště

Aplikace funguje jako plně klientská ("serverless" z pohledu backendu).
*   **Geodata Evropy:** Státy jsou načteny přes `fetch('data/europe.geojson')`.
*   **Uložená místa:** Zvládá je výhradně prohlížeč uživatele. Ukládají se do `localStorage` pod klíčem `msMapStatesSaved` jako JSON objekt.
*   **Stav mapy:** Přiblížení a střed mapy po aktualizaci stránky drží klíče `msCenter` a `msZoom`.

---

## 🗺 Funkce a chování mapy

| Globální proměnná / Funkce | Popis |
|---|---|
| `msMap` | Instance Leaflet mapy (L.map) pro `states.html`. |
| `msOsm`, `msOrto` | Základní mapové vrstvy (OSM s šedým `grayscale` filtrem a Esri satelitní snímky). |
| `msStatesLayer` | Červený polygon (obrys a výplň) aktuálně vyhledaného/vybraného státu v režimu `hledat`. |
| `msStatesHaloLayer` | Bílý tlustý polygon pod `msStatesLayer`, tvořící "halo" obrys okolo vyhledaného státu. Obě vrstvy se mažou najednou. |
| `msCityMarker`, `msCityLayer` | Bodová reprezentace, nebo detailní geojson při hledání konkrétního města. |
| `msSavedMarkersLayer` | `L.layerGroup` obsahující všechny zelené/červené (oranžové) polygony uložených států z LocalStorage. |
| `msSearchState(name)` | Zavolá se po stisku tlačítka. Prověří lokální GeoJSON objekt, v případě shody nakreslí polygon a "halo" na mapu. Otevře `msStatesLayer.bindPopup()`. |
| `msSearchCity(name)` | Využívá externí API *Nominatim OpenStreetMap* k dohledání adres a měst. Po navrácení nakreslí bod / hranice obce. |

---

## 🗂 Panely a Formuláře

| Funkce | Popis |
|---|---|
| `msShowInfoPanel(state, extra)` | Vygeneruje blok v pravém menu ukazující Název a GPS souřadnice vyhledaného místa. Také vygeneruje křížek (Close) pro smazání z mapy. |
| `msClearSelection()` | Po kliku na křížek info panelu smaže dohledaný objekt (včetně halo polygonů `msStatesHaloLayer`), zavře formulář a vrátí mapu do defaultu. |
| `msRenderDataPanel(state)` | Generuje editační okno/formulář do panelu. Umožňuje uživateli objekt buď vložit do databáze (Save - checkbox "Navštíveno" / "Wishlist"), nebo existující objekt smazat (Delete). |
| `msSaveState(stateData)` | Uloží objekt se zadaným popiskem a atributy (id, name, datum, popisek) do `msSavedStates` a syncne do localStorage. Následně znovu překreslí uložené markery. |
| `msDeleteState(stateId)` | Odstraní záznam z lokálního úložiště a aktualizuje mapu. Rovněž se postará o smazání polygonu z mapy, aby tam nezůstával po odstranění "viset". |
| `msRenderSavedList()` | Zpracuje `msSavedStates` z LocalStorage a iterací vytvoří tzv. "Stat Karty" do záložky "Uložená", s možností kliknutí pro plynulý nálet mapy (`flyTo`) nad vybraný stát. |

---

## ⚙️ Nezávislé UI a Přepínače

Ačkoliv vzhled přepínačů odpovídá aplikaci Pavlínka, logika je oddělena.
*   **Přepínač panelu:** Funkce `msPanel.classList.toggle('collapsed')` je fixována na ID `#ms-toggle-panel-btn`.
*   **Přepínání záložek:** Ovládáno selektory `#ms-tab-nav .tab-btn`, které mění aktivní třídu `.tab-panel` uvnitř bloku `#ms-tabs-area`.
*   **Basemap Menu:** Funkce zprostředkovávající změnu vrstev je omezena pouze na mapy OSM a Orto. Pro ovládání stisku slouží selektor `.basemap-option`.
