#!/usr/bin/env python3
import re
import json
import urllib.request
import os
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

URL = "https://iscus.cz/web/pasport/?is_map_active=1"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'iscus_fotbal.geojson')

def fetch_data():
    print(f"Stahuji data z IS CUS: {URL}")
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
    
    # Regex pro extrakci markrů ze scriptu v HTML
    pattern = r"title:\s*'([^']*)',\s*url:\s*'([^']*)',\s*lat:\s*'([\d\.]+)',\s*lng:\s*'([\d\.]+)'"
    matches = re.findall(pattern, html, re.DOTALL)
    print(f"Celkem nalezeno {len(matches)} sportovišť všeho druhu.")
    
    features = []
    
    # Filtrujeme jen ta hřiště, co mají něco společného s fotbalem
    # (podle názvu zařízení nebo jména klubu)
    for title, url, lat, lng in matches:
        title_lower = title.lower()
        if 'fotbal' in title_lower or 'fc ' in title_lower or 'fk ' in title_lower or 'hřiště kopané' in title_lower:
            feature = {
                "type": "Feature",
                "properties": {
                    "name": title,
                    "url": url,
                    "source": "IS CUS"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(lng), float(lat)] # GeoJSON pořadí je [lng, lat]
                }
            }
            features.append(feature)
            
    return features

def save_geojson(features):
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
        
    print(f"Úspěšně uloženo {len(features)} fotbalových hřišť do souboru {OUTPUT_FILE}")

if __name__ == '__main__':
    features = fetch_data()
    save_geojson(features)
