// ============================================================
// config.js – Globální konstanty a konfigurace
// ============================================================

// Cesium Ion token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0NDJiODkwNS0yYTM1LTQ1YWUtODg1Yy1kMGQzNDkxOGFiMDciLCJpZCI6ODk5NjIsInN1YiI6Impha3Vic3V0dGEiLCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoiamFrdWJzdXR0YV9kZWZhdWx0IiwiaWF0IjoxNzc4MjcyMDI0fQ.4bdp7gaqxXvLB76ufmvZLZBnhn7jj1CBCtOD681G0Og';

// Výchozí střed mapy a maximální hranice
const center = [49.84291, 18.12103];
const bounds = L.latLngBounds(
    L.latLng(49.841, 18.118),
    L.latLng(49.845, 18.124)
);

// Typy místností pro půdorysy
const FLOORPLAN_TYPES = {
    'chodba':    { text: 'chodba/předsíň', color: '#FFCC80' },
    'schodiste': { text: 'schodiště',      color: '#FFA726' },
    'toaleta':   { text: 'toaleta',        color: '#fa8181' },
    'koupelna':  { text: 'koupelna',       color: '#f32121' },
    'pokoj':     { text: 'pokoj',          color: '#EF9A9A' },
    'loznice':   { text: 'ložnice',        color: '#F44336' },
    'obyvak':    { text: 'obývák',         color: '#A5D6A7' },
    'kuchyn':    { text: 'kuchyň',         color: '#FFEB3B' },
    'jidelna':   { text: 'jídelna',        color: '#FFF59D' },
    'kotelna':   { text: 'kotelna',        color: '#5D4037' },
    'pradelna':  { text: 'prádelna',       color: '#801a1a' },
    'dilna':     { text: 'dílna',          color: '#9E9E9E' },
    'garaz':     { text: 'garáž',          color: '#000000' },
    'naradovna': { text: 'nářaďovna',      color: '#FFD700' },
    'puda':      { text: 'půda',           color: '#F48FB1' },
    'ostatni':   { text: 'ostatní',        color: '#FFFFFF' }
};

// Přepisy typů místností uložené v LocalStorage
let floorplanOverrides = JSON.parse(localStorage.getItem('pavlinka_floorplan_overrides')) || {};
let cameraOverrides = JSON.parse(localStorage.getItem('pavlinka_camera_overrides')) || {};
let photoOverrides = JSON.parse(localStorage.getItem('pavlinka_photos')) || {};

// Supabase
const supabaseUrl = 'https://wjvwxeafinmtzymmgnzf.supabase.co';
const supabaseKey = 'sb_publishable_IsbfCfi6Q-doz3SBgBBIhQ_D9451AqY';

// Metainformace o skupinách QGIS vrstev
const qgisGroupMeta = {
    'elektrina_body,elektrina_linie,elektrina_plochy':    { name: 'Elektřina',  icon: 'ph-lightning',    color: 'red' },
    'kanalizace_body,kanalizace_linie,kanalizace_plochy': { name: 'Kanalizace', icon: 'ph-drop',         color: 'saddlebrown' },
    'vodovod_body,vodovod_linie,vodovod_plochy':          { name: 'Vodovod',    icon: 'ph-pipe',         color: 'darkred' },
    'plynovod_body,plynovod_linie':                       { name: 'Plynovod',   icon: 'ph-flame',        color: '#b8a000' },
    'budovy_linie':                                       { name: 'Budovy',     icon: 'ph-buildings',    color: '#333' },
    'vybaveni_body,vybaveni_linie,vybaveni_plochy':       { name: 'Užití',      icon: 'ph-tag',          color: 'gray' },
    'ostatni_linie':                                      { name: 'Katastr',    icon: 'ph-map-trifold',  color: 'purple' }
};

// Sdílený stav 3D prohlížeče
let cesiumViewer = null;
