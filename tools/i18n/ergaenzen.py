#!/usr/bin/env python3
"""Ergänzt das englische Wörterbuch einer Seite: python3 tools/i18n/ergaenzen.py <seite> < einträge.txt
Der Text auf stdin ist der Inhalt eines Python-Dicts (Zeilen wie  "Deutsch": "English",  ), '_exact' und '_names' sind Unterabschnitte.
Vorhandene Einträge werden überschrieben, alles andere bleibt."""
import ast, json, os, sys
root = os.path.join(os.path.dirname(__file__), '..', '..', 'games', '_shared', 'i18n')
name = sys.argv[1]
path = os.path.join(root, name + '.en.json')
new = ast.literal_eval('{' + sys.stdin.read() + '}')
old = json.load(open(path, encoding='utf8')) if os.path.exists(path) else {}
for k, v in new.items():
    if k in ('_exact', '_names'):
        old.setdefault(k, {}).update(v)
    else:
        old[k] = v
# Unterabschnitte zuerst, dann alphabetisch (stabile Diffs)
out = {k: old[k] for k in ('_names', '_exact') if k in old}
for k in sorted(k for k in old if k not in out):
    out[k] = old[k]
json.dump(out, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
open(path, 'a').write('\n')
print(name + ': ' + str(len(out)) + ' Einträge')
