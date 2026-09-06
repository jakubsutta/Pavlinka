const LEGEND_DATA = {
    "kn": {
        title: "Legenda",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "line", color: "#000000", text: "Hranice parcely" }
        ]
    },
    "charVl": {
        title: "Legenda",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: []
    },
    "vb": {
        title: "Legenda",
        meta: { dataType: "raster", geomType: "mixed", queryable: false },
        items: [
            { type: "line", color: "#eaeaeaff", text: "Průběh věcného břemene" },
            { type: "poly", color: "rgb(128,20,255)", text: "Ostatní plochy" },
            { type: "poly", color: "rgb(255,128,128)", text: "Plochy/parcela užívání" },
            { type: "poly", color: "rgb(150,0,0)", text: "Plochy/parcela vedení" },
            { type: "poly", color: "rgb(255,0,255)", text: "Plochy/parcela chůze" },
            { type: "poly", color: "rgb(255,0,0)", text: "Plochy/parcela listina" },
        ]
    },
    "dtm-ti": {
        title: "Legenda",
        meta: { dataType: "raster", geomType: "line", queryable: false },
        items: [
            { type: "line", color: "rgb(128,20,255)", text: "Internet, optika, rozhlas, TV" },
            { type: "line", color: "rgb(255,0,0)", text: "Elektrické vedení NN/VN, Veřejné osvětlení" },
            { type: "line", color: "rgba(26, 255, 0, 1)", text: "Plynovod" },
        ]
    },
    "landuse": {
        title: "Legenda",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#E63946", text: "Hranice parcely" },
            { type: "poly", color: "#9d4545", text: "Výměra" }
        ]
    },
    "elektrina": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "mixed", queryable: true },
        items: [
            { type: "point", color: "rgb(255,0,0)", text: "Bod (stožár, zásuvka, jistič...)" },
            { type: "line", color: "rgb(255,0,0)", text: "Elektrické vedení" },
            { type: "poly", color: "rgb(255,0,0)", text: "Rozvaděč" }
        ]
    },
    "kanalizace": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "mixed", queryable: true },
        items: [
            { type: "point", color: "saddlebrown", text: "Šachta, drenáž, kanál" },
            { type: "line", color: "saddlebrown", text: "Splašková kanalizace" },
            { type: "poly", color: "saddlebrown", text: "Jímka" }
        ]
    },
    "vodovod": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "mixed", queryable: true },
        items: [
            { type: "point", color: "darkred", text: "Uzávěr" },
            { type: "line", color: "darkred", text: "Trasa vodovodu" },
            { type: "poly", color: "darkred", text: "Studna, nádoba" }
        ]
    },
    "plynovod": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "mixed", queryable: true },
        items: [
            { type: "point", color: "yellow", text: "Uzávěr" },
            { type: "line", color: "yellow", text: "Trasa plynovodu" }
        ]
    },
    "budovy": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "line", queryable: true },
        items: [
            { type: "line", color: "rgb(21, 21, 21)", text: "Hranice budovy/stavby" },
        ]
    },
    "vybaveni": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "mixed", queryable: true },
        items: [
            { type: "line", color: "rgb(132, 132, 132)", text: "Využití (pracuje se na tom...)" }
        ]
    },
    "ostatni": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "line", queryable: true },
        items: [
            { type: "line", color: "rgb(128,20,255)", text: "Hranice parcely" },
        ]
    },
    "camera_point": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "point", queryable: true },
        items: [
            { type: "point", color: "#000000", text: "Kamera (výchozí)" },
            { type: "point", color: "#50c878", text: "Kamera typ 1" },
            { type: "point", color: "#ff5722", text: "Kamera typ 2" },
            { type: "point", color: "#9c27b0", text: "Kamera typ 3" }
        ]
    },
    "floorplan_basement": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#FFA726", text: "Schodiště" },
            { type: "poly", color: "#9E9E9E", text: "Dílna" },
            { type: "poly", color: "#5D4037", text: "Kotelna" },
            { type: "poly", color: "#FFCC80", text: "Chodba" },
            { type: "poly", color: "#801a1a", text: "Prádelna" },
            { type: "poly", color: "#EF9A9A", text: "Pokoj" },
            { type: "poly", color: "#FFFFFF", text: "Ostatní" },
        ]
    },
    "floorplan_FirstFloor": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#FFA726", text: "Schodiště" },
            { type: "poly", color: "#FFCC80", text: "Chodba" },
            { type: "poly", color: "#fa8181", text: "Toaleta" },
            { type: "poly", color: "#f32121", text: "Koupelna" },
            { type: "poly", color: "#F44336", text: "Ložnice" },
            { type: "poly", color: "#EF9A9A", text: "Pokoj" },
            { type: "poly", color: "#FFFFFF", text: "Ostatní" },
            { type: "poly", color: "#A5D6A7", text: "Obývák" },
            { type: "poly", color: "#FFEB3B", text: "Kuchyň" },
            { type: "poly", color: "#FFF59D", text: "Jídelna" },
        ]
    },
    "floorplan_SecondFloor": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#FFA726", text: "Schodiště" },
            { type: "poly", color: "#FFCC80", text: "Chodba/předsíň" },
            { type: "poly", color: "#fa8181", text: "Toaleta" },
            { type: "poly", color: "#f32121", text: "Koupelna" },
            { type: "poly", color: "#F44336", text: "Ložnice" },
            { type: "poly", color: "#EF9A9A", text: "Pokoj" },
            { type: "poly", color: "#FFFFFF", text: "Ostatní" },
            { type: "poly", color: "#A5D6A7", text: "Obývák" },
            { type: "poly", color: "#FFEB3B", text: "Kuchyň" },
            { type: "poly", color: "#FFF59D", text: "Jídelna" },
        ]
    },
    "floorplan_roof": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#FFA726", text: "Schodiště" },
            { type: "poly", color: "#F48FB1", text: "Půda" },
        ]
    },
    "floorplan_garage": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#000000", text: "Garáž" },
            { type: "poly", color: "#FFD700", text: "Nářaďovna" },
        ]
    },
    "floorplan_GarageRoof": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#F48FB1", text: "Půda" },
        ]
    },
    "floorplan_SummerHouse": {
        title: "Legenda",
        meta: { dataType: "vector", geomType: "polygon", queryable: true },
        items: [
            { type: "poly", color: "#FFFFFF", text: "Altán" },
            { type: "poly", color: "#FFEB3B", text: "Kuchyňka" },
        ]
    },
    "pyro_area": {
        title: "Omezení pyrotechniky",
        meta: { dataType: "vector", geomType: "polygon", queryable: false },
        items: [
            { type: "poly-pyro", color: "#cc0000", text: "Zóna omezení použití pyrotechniky" },
        ]
    },

    // ── Hluk aglomerací – den (Ldvn) ──
    "aglo-hlukDen": {
        title: "Městský hluk – den (Ldvn)",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#FFFF00", text: "55–60 dB" },
            { type: "poly", color: "#FFCC00", text: "60–65 dB" },
            { type: "poly", color: "#FF9900", text: "65–70 dB" },
            { type: "poly", color: "#FF6600", text: "70–75 dB" },
            { type: "poly", color: "#FF0000", text: "75–80 dB" },
            { type: "poly", color: "#990000", text: "> 80 dB" },
        ]
    },

    // ── Hluk aglomerací – noc (Ln) ──
    "aglo-hlukNoc": {
        title: "Městský hluk – noc (Ln)",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#CCFFFF", text: "45–50 dB" },
            { type: "poly", color: "#66CCFF", text: "50–55 dB" },
            { type: "poly", color: "#0099FF", text: "55–60 dB" },
            { type: "poly", color: "#0055CC", text: "60–65 dB" },
            { type: "poly", color: "#003399", text: "65–70 dB" },
            { type: "poly", color: "#000066", text: "> 70 dB" },
        ]
    },

    // ── Hluk z silnic – den (Ldvn) ──
    "silnice-hlukDen": {
        title: "Hluk z silnic – den (Ldvn)",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#FFFF00", text: "55–60 dB" },
            { type: "poly", color: "#FFCC00", text: "60–65 dB" },
            { type: "poly", color: "#FF9900", text: "65–70 dB" },
            { type: "poly", color: "#FF6600", text: "70–75 dB" },
            { type: "poly", color: "#FF0000", text: "75–80 dB" },
            { type: "poly", color: "#990000", text: "> 80 dB" },
        ]
    },

    // ── Hluk z silnic – noc (Ln) ──
    "silnice-hlukNoc": {
        title: "Hluk z silnic – noc (Ln)",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#CCFFFF", text: "45–50 dB" },
            { type: "poly", color: "#66CCFF", text: "50–55 dB" },
            { type: "poly", color: "#0099FF", text: "55–60 dB" },
            { type: "poly", color: "#0055CC", text: "60–65 dB" },
            { type: "poly", color: "#003399", text: "65–70 dB" },
            { type: "poly", color: "#000066", text: "> 70 dB" },
        ]
    },

    // ── Záplavová území – Q100 (HEIS VÚV) ──
    "zapluzemi-100": {
        title: "Ohrožení \u201estoletou vodou\u201c (Q100)",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#84C1E8", text: "Aktivní zóna záplavového území Q100" },
        ]
    },

    // ── Povodňové ohrožení (ČENIA / MŽP) ──
    "povodne-ohrozeni": {
        title: "Povodňové ohrožení",
        meta: { dataType: "raster", geomType: "polygon", queryable: false },
        items: [
            { type: "poly", color: "#FF9900", text: "Nízká hloubka / rychlost" },
            { type: "poly", color: "#FF4400", text: "Střední ohrožení" },
            { type: "poly", color: "#CC0000", text: "Vysoké ohrožení (velká hloubka/rychlost)" },
        ]
    }
};