#!/usr/bin/env python3
"""
Qué sigue a cada verbo en conversaciones reales con niños (CHILDES, español).

Lee las transcripciones CHAT de una carpeta local (por defecto ~/childes-es) y SOLO produce recuentos
agregados: para cada verbo, de qué va (su objeto o complemento según el análisis sintáctico %gra:
lo que se come, adónde se va…) agrupado en las categorías del catálogo de carpetas, personas u otro
verbo en infinitivo. Los sujetos no cuentan. No copia ni muestra frases.

Datos: CHILDES / TalkBank, licencia CC BY-NC-SA 3.0 (cita obligatoria, sin uso comercial).
Las transcripciones no se suben a ningún sitio: este programa se ejecuta en el ordenador.

Uso:  python3 scripts/childes/frames.py [carpeta] [--json salida.json] [--verbo comer]
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def fold(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().strip()


def load_catalog() -> dict[str, list[str]]:
    """Categorías del catálogo de la app (src/lib/catalog.ts): palabra -> categorías"""
    src = (ROOT / 'src/lib/catalog.ts').read_text()
    body = src[src.index('FOLDER_CATALOG'):src.index('export const CATALOG_WORDS')]
    out: dict[str, list[str]] = defaultdict(list)
    for m in re.finditer(r"(?:'([^']+)'|([A-ZÁÉÍÓÚ][\wáéíóúñ]*)):\s*\[(.*?)\]", body, re.S):
        cat = m.group(1) or m.group(2)
        for w in re.findall(r"'([^']+)'", m.group(3)):
            out[fold(w)].append(cat)
            # el análisis da el lema en singular: «galletas» -> galleta
            for sing in (re.sub(r'es$', '', fold(w)), re.sub(r's$', '', fold(w))):
                if sing != fold(w):
                    out.setdefault(sing, out[fold(w)])
    return out


TOKEN = re.compile(r'^([a-z:]+)\|([^-~]+)(.*)$')
PERSON_NOUNS = {'mama', 'papa', 'abuelo', 'abuela', 'hermano', 'hermana', 'tio', 'tia', 'primo', 'prima', 'amigo', 'amiga', 'nino', 'nina', 'bebe', 'profesor', 'profesora', 'senor', 'senora'}
# Relaciones (Universal Dependencies) que dicen «de qué va» el verbo: lo que se come, adónde se va…
ARGS = {'OBJ', 'OBL', 'OBL-ARG', 'IOBJ'}


def utterances(folder: Path):
    """
    (hablante, palabras) por enunciado. Cada palabra: (categoría, lema, rasgos, núcleo, relación),
    juntando el análisis morfológico (%mor) y el sintáctico (%gra), que van palabra a palabra.
    """
    for f in sorted(folder.rglob('*.cha')):
        speaker = None
        roles: dict[str, str] = {}
        mor: list[tuple[str, str, str]] = []
        for line in f.read_text(errors='ignore').splitlines():
            if line.startswith('@Participants:'):
                for part in line.split(':', 1)[1].split(','):
                    bits = part.split()
                    if len(bits) >= 2:
                        roles[bits[0]] = bits[-1]
            elif line.startswith('*'):
                speaker = roles.get(line[1:4], 'Other')
                mor = []
            elif line.startswith('%mor:'):
                mor = []
                for raw in line[5:].split():
                    for piece in raw.split('~'):
                        m = TOKEN.match(piece)
                        mor.append((m.group(1), fold(m.group(2)), m.group(3)) if m else ('punct', piece, ''))
            elif line.startswith('%gra:') and speaker and mor:
                rels = line[5:].split()
                if len(rels) != len(mor):
                    continue  # análisis desalineado: mejor no contarlo
                words = []
                for (pos, lemma, feats), rel in zip(mor, rels):
                    bits = rel.split('|')
                    head = int(bits[1]) if len(bits) == 3 and bits[1].isdigit() else -1
                    words.append((pos, lemma, feats, head, bits[-1]))
                yield speaker, words


def main():
    args = sys.argv[1:]
    folder = Path(args[0]).expanduser() if args and not args[0].startswith('--') else Path('~/childes-es').expanduser()
    out_json = args[args.index('--json') + 1] if '--json' in args else None
    only = fold(args[args.index('--verbo') + 1]) if '--verbo' in args else None
    catalog = load_catalog()

    total = Counter()  # verbo -> veces
    cats = defaultdict(Counter)  # verbo -> categoría -> veces
    chain = defaultdict(Counter)  # verbo -> verbo en infinitivo que le sigue
    unknown = defaultdict(Counter)  # verbo -> nombres que siguen y no están en el catálogo
    child_total = Counter()
    n_utt = 0

    for speaker, words in utterances(folder):
        n_utt += 1
        for i, (pos, lemma, feats, head, rel) in enumerate(words):
            if pos != 'verb':
                continue
            total[lemma] += 1
            if speaker == 'Target_Child':
                child_total[lemma] += 1
            me = i + 1  # en %gra las palabras se numeran desde 1
            seen: set[str] = set()
            for pos2, lemma2, feats2, head2, rel2 in words:
                if head2 != me:
                    continue
                # «quiero comer»: otro verbo en infinitivo que depende de este
                if rel2 in ('XCOMP', 'CCOMP') and pos2 == 'verb' and '-Inf' in feats2:
                    chain[lemma][lemma2] += 1
                    continue
                if rel2 not in ARGS:
                    continue
                if pos2 == 'propn' or (pos2 == 'noun' and lemma2 in PERSON_NOUNS):
                    keys = ['@personas']
                elif pos2 in ('noun', 'adj'):
                    keys = catalog.get(lemma2, [])
                    if not keys and pos2 == 'noun':
                        unknown[lemma][lemma2] += 1
                else:
                    keys = []
                for key in keys:
                    if key not in seen:
                        seen.add(key)
                        cats[lemma][key] += 1

    verbs = [v for v, _ in total.most_common() if total[v] >= 15 and (not only or v == only)]
    print(f'{n_utt} enunciados · {len(total)} verbos distintos · {len(verbs)} con 15+ apariciones\n')
    result = {}
    for rank, v in enumerate(verbs):
        comp = sum(cats[v].values())
        top = ', '.join(f'{c} {100 * n // max(1, comp)}%' for c, n in cats[v].most_common(6))
        ch = ', '.join(f'{w} {n}' for w, n in chain[v].most_common(5))
        if only or rank < 60:
            print(f'{v:12} {total[v]:6} (niño {child_total[v]:5})  → {top}' + (f'  | +inf: {ch}' if ch else ''))
        if only:
            print('   nombres fuera del catálogo:', ', '.join(f'{w} {n}' for w, n in unknown[v].most_common(25)))
        result[v] = {
            'total': total[v],
            'child': child_total[v],
            'categories': dict(cats[v].most_common()),
            'chain': dict(chain[v].most_common(15)),
            'unknownNouns': dict(unknown[v].most_common(30)),
        }
    if out_json:
        Path(out_json).write_text(json.dumps(result, ensure_ascii=False, indent=1))
        print(f'\nGuardado en {out_json}')


if __name__ == '__main__':
    main()
