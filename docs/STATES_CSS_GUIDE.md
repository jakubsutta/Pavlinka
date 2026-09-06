# 🎨 MapEurope (Státy) – CSS Design Manuál

Tento dokument slouží jako průvodce stylováním pro sesterskou aplikaci **MapEurope (Státy - Místa, kde jsem byl)**, která běží na adrese `states.html`.

Tato aplikace sice částečně využívá UI komponenty z hlavní aplikace Pavlínky, ale má vlastní, oranžovou vizuální identitu (`#f2930d`).

## 1. Jak funguje překrývání (Overrides) stylů

Soubor `states.html` načítá CSS soubory v následujícím pořadí:
1. `css/style.css` (Hlavní styly Pavlínky – obsahují tyrkysovou identitu `#368c54`).
2. `css/basemap.css` (Styly přepínače map).
3. `css/form-style.css` (Styly tlačítek a inputů).
4. **`css/states-map.css`** (Hlavní styly MapEurope – na samotném konci, aby přepisovaly ty předchozí).

### 1.1 CSS Proměnné
Na začátku `states-map.css` se pomocí selektoru `:root` přepisují základní barvy definované Pavlínkou:
```css
:root {
    --accent:         #f2930d;
    --accent-light:   #fbdca8;
    --accent-border:  #f2930d;
    --text-dark:      #f2930d;
}
```
Díky tomu se **téměř všechna** tlačítka, nadpisy a interaktivní komponenty automaticky obarví na oranžovou, aniž by se musely upravovat jejich konkrétní třídy.

### 1.2 "Tvrdé" Přepisy (Hardcoded overrides)
Některé třídy v `style.css` v Pavlínce mají natvrdo definované hex nebo `rgba` hodnoty pro zelenou barvu (např. v pseudo-třídách jako `:hover` nebo `:has()`).
Pro ně jsou v `states-map.css` na konci souboru tyto specifické override instrukce:

- **Hlavičky skupin v panelu (Vyhledat stát, Město):**
  Třída `.layer-group-header` přepisuje pozadí i hover barvu textu:
  ```css
  .layer-group-header {
      --group-color: var(--accent) !important;
      --group-bg: rgba(242, 147, 13, 0.07) !important;
  }
  ```

- **Tlačítko patičky ("zpět na Pavlínku"):**
  Třída `.footer-info-btn` musela dostat explicitní `rgba` oranžové, jelikož Pavlínka pro ni používá fixní zelené RGB kódy.
  ```css
  .footer-info-btn {
      background: rgba(242, 147, 13, 0.08) !important;
      color: var(--accent) !important;
  }
  ```

## 2. Plovoucí panely a Popupy

### 2.1 Plovoucí Datový Panel
Vzhled datové karty státu (obsahující ISO kód, polohu a formulář pro uložení/smazání) zajišťuje třída `.ms-search-data-panel`.
Tento panel používá prémiový glassmorphism design:
- Bílý box (`background: var(--white-transparent, rgba(255,255,255,0.8))`)
- Jemný stín a lehký blur.

### 2.2 Zobrazení popupů v mapě (Leaflet)
Všechny bubliny (popups) nad markery využívají sdílenou třídu `.coords-leaflet-popup`. I když pochází z hlavní Pavlínky, díky přepsání CSS proměnné `--accent` se v MapEurope popupy automaticky barví do oranžova (nadpis státu, města).

## 3. Průhlednosti a filtry

### 3.1 Šedá podkladová OSM mapa
Aby barevné polygony států vizuálně vynikaly nad běžnou mapou (OpenStreetMap), je tato vrstva "odbarvena".
V Leafletu to řeší přidání třídy do options vrstvy: `className: 'osm-grayscale'`.
S tím souvisí i miniatura v menu v pravém rohu, na které je aplikován in-line styl: `filter: grayscale(100%);`.

---
**Při přidávání nového kódu do MapEurope vždy kontroluj, zda neimportuješ natvrdo nějaký zelený hex-kód z hlavní aplikace.** Vše upravuj buď pomocí `--accent`, nebo dodej explicitní override do spodní části `states-map.css`.
