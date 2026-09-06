#!/usr/bin/env python3
"""Sincroniza data/content.json con los datos actuales de Supabase.

Preserva las secciones estaticas (site y sections) del archivo existente y
reemplaza los datos (profile, experience, education, projects, skills, contact,
certifications, media_assets) con el contenido actual de las tablas en Supabase.
Uso:

    python3 sync-content.py

Como respaldo publico, solo descarga contenido con visibilidad publica:
profile y contact se leen desde las vistas profile_public/contact_public
(ya no son single-row: devuelven una fila por sitio con su campo `context`),
certifications desde certifications_public y las tablas de listas aplican RLS
(anon solo ve filas 'public'). media_assets se lee desde la vista
media_assets_public (metadatos sin object_key); los archivos se sirven por el
Media Gateway, nunca en bruto. El campo `context` viaja en cada fila para que
cada sitio filtre por presentación al cargar.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / 'supabase-config.js'
CONTENT_PATH = ROOT / 'data' / 'content.json'

# clave en content.json -> tabla/vista en Supabase
TABLES = {
    'profile': 'profile_public',
    'experience': 'experience',
    'education': 'education',
    'projects': 'projects',
    'skills': 'skills',
    'contact': 'contact_public',
    'certifications': 'certifications_public',
    'media_assets': 'media_assets_public',
}


def load_config(path):
    text = path.read_text(encoding='utf-8')
    url = re.search(r"SUPABASE_URL:\s*'([^']+)'", text)
    key = re.search(r"SUPABASE_ANON_KEY:\s*'([^']+)'", text)
    if not url or not key:
        raise SystemExit('No se pudo leer SUPABASE_URL/SUPABASE_ANON_KEY de supabase-config.js')
    return url.group(1).rstrip('/'), key.group(1)


def fetch_rows(base_url, anon_key, table):
    url = base_url + '/rest/v1/' + table + '?select=*&order=id.asc'
    request = urllib.request.Request(url, headers={
        'apikey': anon_key,
        'Authorization': 'Bearer ' + anon_key,
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        rows = json.loads(response.read().decode('utf-8'))
    return rows or []


def main():
    base_url, anon_key = load_config(CONFIG_PATH)

    content = {}
    if CONTENT_PATH.exists():
        content = json.loads(CONTENT_PATH.read_text(encoding='utf-8'))

    for key, table in TABLES.items():
        content[key] = fetch_rows(base_url, anon_key, table)

    CONTENT_PATH.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('content.json actualizado con los datos públicos de Supabase.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Error al sincronizar:', error, file=sys.stderr)
        sys.exit(1)
