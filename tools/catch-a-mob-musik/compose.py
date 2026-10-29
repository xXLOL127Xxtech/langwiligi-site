#!/usr/bin/env python3
"""
Catch a Mob – Soundtrack-Generator
Komponiert + rendert alle Tracks (loopbar) als OGG + MP3 nach ../audio

Konzept: Die Welt wandert klanglich von KLASSISCH (Cembalo, Flöte, Streicher)
über RETRO (Chiptune: Pulse, Triangle, Noise) zu ARCADE (Supersaw, 16tel-Bass,
Four-on-the-floor). Jedes Gebiet hat einen Explore-Track und einen Kampf-Track
in verwandter Tonart (Crossfade klingt sauber).

Aufruf:  python3 compose.py            -> alles
         python3 compose.py 03 b03     -> nur Tracks, deren ID diese Teile enthält
"""
import numpy as np, random, os, sys, wave, subprocess, tempfile

SR = 44100
OUT = os.environ.get('CAM_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')
OGG_Q = os.environ.get('CAM_OGG_Q', '5')
FORMATS = os.environ.get('CAM_FORMATS', 'ogg,mp3').split(',')

# ----------------------------------------------------------------- Theorie
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10],
        'dim': [0, 3, 6], 'maj7': [0, 4, 7, 11], 'sus4': [0, 5, 7], '5': [0, 7, 12]}
SCALES = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10],
          'dorian': [0, 2, 3, 5, 7, 9, 10], 'phrygdom': [0, 1, 4, 5, 7, 8, 10],
          'lydian': [0, 2, 4, 6, 7, 9, 11], 'harmminor': [0, 2, 3, 5, 7, 8, 11]}

def pc_of(s):
    p = PC[s[0]]
    for ch in s[1:]:
        p += 1 if ch == '#' else -1 if ch == 'b' else 0
    return p % 12

def parse_chord(sym):
    i = 2 if len(sym) > 1 and sym[1] in '#b' else 1
    return pc_of(sym[:i]), QUAL[sym[i:]]

def chord_pcs(sym):
    r, iv = parse_chord(sym)
    return {(r + x) % 12 for x in iv}

def tones(sym, base):
    r, iv = parse_chord(sym)
    r0 = base + ((r - base) % 12)
    return [r0 + i for i in iv]

def root_at(sym, base=36):
    return tones(sym, base)[0]

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
def nname(m):
    return f"{NAMES[m % 12]}{m // 12 - 1}"

# ----------------------------------------------------------------- Hüllkurve / Oszillatoren
def env(ng, a=.004, d=0., s=1., r=.03):
    ng = max(int(ng), 1)
    n = ng + int(r * SR)
    t = np.arange(n) / SR
    e = np.minimum(t / a, 1.) if a > 0 else np.ones(n)
    if d > 0:
        e = e * (s + (1 - s) * np.exp(-np.maximum(t - a, 0) / d))
    if r > 0:
        rel = np.ones(n)
        rel[ng:] = np.clip(1 - (np.arange(n - ng)) / (r * SR), 0, 1)
        e = e * rel
    return e

def ph(freq, n, vib=0., vrate=5.5, vdelay=0.):
    f = np.full(n, freq, dtype=np.float64)
    if vib:
        t = np.arange(n) / SR
        f *= 1 + vib * np.sin(2 * np.pi * vrate * t) * np.clip((t - vdelay) / .2, 0, 1)
    return np.cumsum(f) / SR

def additive(freq, n, w, tau=None, detune=0.):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for h, a in enumerate(w, 1):
        fh = freq * h * (1 + detune)
        if fh > SR * .45:
            break
        x = a * np.sin(2 * np.pi * fh * t)
        if tau:
            x *= np.exp(-t / (tau / (1 + .5 * (h - 1))))
        out += x
    return out

def fade_end(x, ms=30):
    k = min(int(ms * SR / 1000), len(x))
    x[-k:] *= np.linspace(1, 0, k)
    return x

# ----------------------------------------------------------------- Instrumente
def mk_pulse(duty=.5, d=0., s=1., vib=0., r=.03):
    def f(freq, dur):
        e = env(dur * SR, .002, d, s, r)
        p = ph(freq, len(e), vib, 5.5, .12)
        return np.where((p % 1) < duty, 1., -1.) * e
    return f

def i_tri(freq, dur):
    e = env(dur * SR, .002, 0, 1, .02)
    p = ph(freq, len(e))
    w = 2 * np.abs(2 * (p % 1) - 1) - 1
    return np.round(w * 7.5) / 7.5 * e          # 4-bit-Treppen wie auf dem NES

def mk_saw(d=0., s=1., vib=0.):
    def f(freq, dur):
        e = env(dur * SR, .004, d, s, .04)
        p = ph(freq, len(e), vib, 5.5, .1)
        return (2 * (p % 1) - 1) * e
    return f

def i_supersaw(freq, dur):
    e = env(dur * SR, .006, 0, 1, .06)
    out = 0
    for dt in (-.006, 0, .006):
        p = ph(freq * (1 + dt), len(e), .004, 5.8, .1)
        out = out + (2 * (p % 1) - 1) / 3
    return out * e

def i_harpsichord(freq, dur):
    ng = int(dur * SR)
    n = ng + int(.25 * SR)
    x = additive(freq, n, [1, .7, .5, .35, .25, .18, .12], tau=.45)
    rng = np.random.default_rng(int(freq))
    k = int(.004 * SR)
    x[:k] += rng.uniform(-1, 1, k) * .5
    r = np.ones(n)
    r[ng:] = np.linspace(1, 0, n - ng)
    return x * r

def i_pizz(freq, dur):
    n = int(min(dur + .1, .6) * SR)
    return fade_end(additive(freq, n, [1, .5, .25, .12], tau=.14), 15)

def i_flute(freq, dur):
    e = env(dur * SR, .05, .15, .8, .12)
    n = len(e)
    p = ph(freq, n, .006, 5.2, .25)
    w = np.sin(2 * np.pi * p) + .25 * np.sin(4 * np.pi * p) + .08 * np.sin(6 * np.pi * p)
    rng = np.random.default_rng(int(freq * 7))
    br = rng.uniform(-1, 1, n)
    br = (br + np.roll(br, 1) + np.roll(br, 2)) / 3 * .06
    return (w + br) * e

def i_strings(freq, dur):
    e = env(dur * SR, .14, 0, 1, .35)
    n = len(e)
    w = [1 / h ** 1.1 for h in range(1, 11)]
    x = sum(additive(freq, n, w, detune=dt) for dt in (-.004, 0, .004))
    return x * e

def i_brass(freq, dur):
    e = env(dur * SR, .035, .25, .75, .08)
    return additive(freq, len(e), [1 / h ** .8 for h in range(1, 13)]) * e

def i_organ(freq, dur):
    e = env(dur * SR, .012, 0, 1, .05)
    return additive(freq, len(e), [1, .9, .6, .5, .35, .3, .2, .15]) * e

def i_bell(freq, dur):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    I = 3 * np.exp(-t / .35)
    x = np.sin(2 * np.pi * freq * t + I * np.sin(2 * np.pi * freq * 3.5 * t)) * np.exp(-t / .8)
    x += .3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / .3)
    return fade_end(x, 50)

INST = {
    'pulse12': mk_pulse(.125), 'pulse25': mk_pulse(.25), 'pulse50': mk_pulse(.5),
    'pulse25v': mk_pulse(.25, vib=.009), 'pulse50v': mk_pulse(.5, vib=.007),
    'pluckpulse': mk_pulse(.25, d=.1, s=.15), 'arpulse': mk_pulse(.5, d=.07, s=.3),
    'tri': i_tri, 'saw': mk_saw(), 'sawpluck': mk_saw(d=.12, s=.35), 'sawv': mk_saw(vib=.006),
    'supersaw': i_supersaw, 'harpsichord': i_harpsichord, 'pizz': i_pizz,
    'flute': i_flute, 'strings': i_strings, 'brass': i_brass, 'organ': i_organ, 'bell': i_bell,
}

def _calibrate():
    lv = {}
    for k, f in INST.items():
        x = f(220.0, .5)[:int(.4 * SR)]
        lv[k] = .3 / max(np.sqrt(np.mean(x ** 2)), 1e-6)
    return lv
LEVEL = _calibrate()

# ----------------------------------------------------------------- Drums
_dc = {}
def drum(name, chip=False):
    key = (name, chip)
    if key in _dc:
        return _dc[key]
    rng = np.random.default_rng(abs(hash(name)) % 1000 + 5)
    def noise(n, hold=1):
        x = rng.uniform(-1, 1, n // hold + 1)
        return np.repeat(x, hold)[:n]
    if name == 'k':
        n = int(.28 * SR); t = np.arange(n) / SR
        p = np.cumsum(45 + 110 * np.exp(-t / .03)) / SR
        x = np.sin(2 * np.pi * p) * np.exp(-t / .11)
        x[:int(.002 * SR)] += .4
        if chip:
            x = np.round(x * 4) / 4
    elif name == 's':
        n = int(.22 * SR); t = np.arange(n) / SR
        nz = noise(n, 6 if chip else 1)
        x = nz * np.exp(-t / .07) * .8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / .04) * .5
    elif name in ('h', 'H'):
        n = int((.13 if name == 'H' else .03) * SR * (1 if not chip else .8)); t = np.arange(n) / SR
        nz = noise(n, 2 if chip else 1)
        x = (nz - np.roll(nz, 1)) * np.exp(-t / (.07 if name == 'H' else .015))
    elif name == 't':        # Pauke
        n = int(.6 * SR); t = np.arange(n) / SR
        p = np.cumsum(75 + 40 * np.exp(-t / .06)) / SR
        x = np.sin(2 * np.pi * p) * np.exp(-t / .22) + noise(n) * np.exp(-t / .01) * .5
    elif name == 'm':        # Tom
        n = int(.3 * SR); t = np.arange(n) / SR
        p = np.cumsum(110 + 90 * np.exp(-t / .05)) / SR
        x = np.sin(2 * np.pi * p) * np.exp(-t / .12)
    elif name == 'c':        # Crash
        n = int(1.1 * SR); t = np.arange(n) / SR
        nz = noise(n)
        x = (nz - np.roll(nz, 1)) * np.exp(-t / .35)
    else:
        raise KeyError(name)
    _dc[key] = x.astype(np.float64)
    return _dc[key]

DGAIN = {'k': .9, 's': .6, 'h': .16, 'H': .18, 't': .85, 'm': .5, 'c': .3}

PAT = {
    'shaker':    dict(h='x.o.x.o.x.o.x.o.'),
    'march':     dict(k='x...x...x...x...', s='..o...o...o...x.', h='x.x.x.x.x.x.x.x.'),
    'half':      dict(k='x.......x.......', s='........x.......', h='..x...x...x...x.'),
    'rock':      dict(k='x.......x.x.....', s='....x.......x...', h='x.x.x.x.x.x.x.x.'),
    'four':      dict(k='x...x...x...x...', s='....x.......x...', H='..x...x...x...x.', h='o.o.o.o.o.o.o.o.'),
    'chipbeat':  dict(k='x.....x.x.....x.', s='....x.......x...', h='x.x.x.x.x.x.x.x.', chip=True),
    'chipfast':  dict(k='x..x..x.x..x..x.', s='....x.......x..x', h='xoxoxoxoxoxoxoxo', chip=True),
    'darbuka':   dict(k='x....x..x.......', m='..x...x...x.x.x.', h='x.x.x.x.x.x.x.x.'),
    'timp':      dict(t='x.x.x.x.x.x.x.x.', s='....o.......o...', m='...............o'),
    'battle':    dict(k='x..xx..xx..xx.x.', s='....x.......x..x', h='xoxoxoxoxoxoxoxo'),
    'double':    dict(k='x.xxx.x.x.xxx.x.', s='....x.......x...', h='x.x.x.x.x.x.x.x.', t='x...............'),
    'fastfour':  dict(k='x.x.x.x.x.x.x.x.', s='..x...x...x...x.', H='.o.o.o.o.o.o.o.o'[:16], h='x.x.x.x.x.x.x.x.'),
}

# ----------------------------------------------------------------- Begleitmuster
def c_alberti(s):
    t = tones(s, 48)[:3]
    seq = [t[0], t[2], t[1], t[2]] * 2
    return [(i * 2, 2, m, 1. if i % 4 == 0 else .7) for i, m in enumerate(seq)]
def c_arp16(s):
    t = tones(s, 48); t4 = [t[0], t[1], t[2], t[0] + 12]
    seq = [t4[j] for j in [0, 1, 2, 3, 2, 1] * 3][:16]
    return [(i, 1, m, 1. if i % 4 == 0 else .7) for i, m in enumerate(seq)]
def c_arp8(s):
    t = tones(s, 48); t4 = [t[0], t[1], t[2], t[0] + 12]
    seq = [t4[j] for j in [0, 1, 2, 3, 2, 1, 2, 3]]
    return [(i * 2, 2, m, 1. if i % 2 == 0 else .7) for i, m in enumerate(seq)]
def c_oompah(s):
    return [(st, 3, m, .8) for st in (4, 12) for m in tones(s, 52)[:3]]
def c_stab(s):
    return [(st, 1, m, .8) for st in (2, 6, 10, 14) for m in tones(s, 52)[:3]]
def c_pulse8(s):
    return [(i * 2, 1, m, 1. if i % 2 == 0 else .75) for i in range(8) for m in tones(s, 52)[:3]]
def c_sync(s):
    return [(st, 1, m, .85) for st in (0, 3, 6, 8, 11, 14) for m in tones(s, 55)[:3]]
COMP = dict(alberti=c_alberti, arp16=c_arp16, arp8=c_arp8, oompah=c_oompah,
            stab=c_stab, pulse8=c_pulse8, sync=c_sync)

def b_whole(s): r = root_at(s); return [(0, 16, r, 1.)]
def b_half(s): r = root_at(s); return [(0, 8, r, 1.), (8, 8, r + 7, .85)]
def b_walk(s): r = root_at(s); return [(i * 4, 4, m, 1.) for i, m in enumerate([r, r + 7, r + 12, r + 7])]
def b_octave(s): r = root_at(s); return [(i * 2, 2, r + (12 if i % 2 else 0), 1.) for i in range(8)]
def b_eighth(s): r = root_at(s); return [(i * 2, 2, r, 1.) for i in range(8)]
def b_gallop(s):
    r = root_at(s)
    return [e for b in range(4) for e in ((b * 4, 2, r, 1.), (b * 4 + 2, 1, r, .8), (b * 4 + 3, 1, r + (7 if b == 3 else 0), .8))]
def b_drive(s): r = root_at(s); return [(i, 1, r + (12 if i % 4 == 2 else 0), 1. if i % 4 == 0 else .8) for i in range(16)]
def b_oompah(s): r = root_at(s); return [(0, 4, r, 1.), (8, 4, r + 7, .9)]
def b_sync(s):
    r = root_at(s)
    return [(0, 3, r, 1.), (3, 3, r, .8), (6, 2, r + 7, .8), (8, 3, r, 1.), (11, 3, r, .8), (14, 2, r + 7, .8)]
BASS = dict(whole=b_whole, half=b_half, walk=b_walk, octave=b_octave, eighth=b_eighth,
            gallop=b_gallop, drive=b_drive, oompah=b_oompah, sync=b_sync)

# ----------------------------------------------------------------- Melodie-Generator
RHY = {
    'slow': [[8, 4, 4], [6, 2, 4, 4], [4, 4, 8], [4, 4, 4, 4], [6, 2, 8], [4, 2, 2, 8], [8, 8], [4, 2, 2, 4, 4]],
    'mid':  [[4, 4, 4, 4], [4, 2, 2, 4, 4], [2, 2, 4, 4, 4], [6, 2, 4, 4], [4, 4, 2, 2, 4], [3, 3, 2, 4, 4], [2, 2, 2, 2, 4, 4]],
    'fast': [[2] * 8, [2, 2, 4, 2, 2, 4], [4, 2, 2, 4, 2, 2], [2, 2, 2, 2, 4, 2, 2], [3, 3, 2, 3, 3, 2], [2, 2, 2, 2, 2, 2, 4]],
}
CAD = {
    'slow': [[4, 4, 8], [8, 8], [6, 2, 8], [4, 2, 2, 8]],
    'mid':  [[4, 4, 8], [2, 2, 4, 8], [8, 8], [4, 2, 2, 8]],
    'fast': [[2, 2, 2, 2, 8], [4, 4, 8], [2, 2, 4, 8], [8, 8]],
}
for _d in RHY.values():
    for _c in _d: assert sum(_c) == 16, _c
for _d in CAD.values():
    for _c in _d: assert sum(_c) == 16, _c
REST_P = dict(slow=.12, mid=.1, fast=.05)

def gen_phrase(rng, chords, pool, ilo, ihi, dens, final='half'):
    """4 Takte: Motiv (T1) – Antwort (T2) – Sequenz von T1 (T3) – Kadenz (T4)"""
    cells = RHY[dens]
    r1, r2 = rng.choice(cells), rng.choice(cells)
    rhythm = [r1, r2, r1, rng.choice(CAD[dens])]
    mid = (ilo + ihi) // 2
    def ctones(sym):
        pcs = chord_pcs(sym)
        return [i for i in range(ilo, ihi + 1) if pool[i] % 12 in pcs]
    def near(sym, idx, jitter=1.5):
        c = sorted(ctones(sym), key=lambda i: abs(i - idx) + rng.random() * jitter)
        return c
    idx = near(chords[0], mid + rng.randint(-3, 3))[0]
    direction = rng.choice([-1, 1])
    out = []
    bar0 = None
    for b in range(4):
        step = 0
        bar_notes = []
        if b == 2 and bar0:
            first = near(chords[2], bar0[0][1])[0]
            for (st, dur, di, rest) in bar0:
                i = min(max(first + (di - bar0[0][1]), ilo), ihi)
                if st % 8 == 0 and not rest:
                    i = near(chords[2], i, 0)[0]
                bar_notes.append((st, dur, i, rest))
                idx = i
        else:
            for k, dur in enumerate(rhythm[b]):
                strong = step % 4 == 0
                if k == 0 or (strong and rng.random() < .55):
                    c = near(chords[b], idx)
                    new = c[0] if (c[0] != idx or rng.random() < .3 or len(c) < 2) else c[1]
                else:
                    if rng.random() < .25: direction *= -1
                    if idx > ihi - 2: direction = -1
                    elif idx < ilo + 2: direction = 1
                    new = idx + direction * (1 if rng.random() < .8 else 2)
                    new = min(max(new, ilo), ihi)
                rest = (k > 0 and k < len(rhythm[b]) - 1 and dur <= 2 and rng.random() < REST_P[dens])
                bar_notes.append((step, dur, new, rest))
                if not rest: idx = new
                step += dur
        if b == 0:
            bar0 = bar_notes
        if b == 3:                                    # Kadenz
            st, dur, _, _ = bar_notes[-1]
            sym = chords[3]
            tgt = near(sym, mid, 0)[0] if final == 'half' else near(chords[3], mid, 0)[0]
            bar_notes[-1] = (st, dur, tgt, False)
            if len(bar_notes) > 1:
                st2, d2, _, _ = bar_notes[-2]
                prev = bar_notes[-2][2]
                bar_notes[-2] = (st2, d2, tgt + (1 if prev > tgt else -1), False)
        for (st, dur, i, rest) in bar_notes:
            if not rest:
                out.append((b * 16 + st, dur, i))
    return out

# ----------------------------------------------------------------- Track bauen
ROLE = dict(lead=(0.0, .55, .92), lead2=(0.35, .30, .85), comp=(-.35, .30, .85),
            bass=(0.0, .55, .9), pad=(0.0, .22, 1.0))
SEC = 8           # Takte pro Abschnitt
NSEC = 4          # A  A'  B  A''

def S(cfg, key, i):
    v = cfg.get(key)
    return v[i] if isinstance(v, list) else v

def build(cfg):
    """liefert (notes, drums, bars) – notes: (step, dur_steps, midi, vel, role, inst)"""
    pool_tonic = pc_of(cfg['key'])
    scale = SCALES[cfg['mode']]
    lo0, hi0 = cfg['reg']
    pool = [m for m in range(lo0 - 20, hi0 + 20) if (m - pool_tonic) % 12 in scale]
    notes, drums = [], []
    sets = [cfg['A'], cfg['A'], cfg['B'], cfg['A']]
    mseeds = [(0, 1), (0, 2), (10, 11), (0, 1)]
    for sec in range(NSEC):
        chords = sets[sec]
        base = sec * SEC * 16
        shift = 3 if sec == 2 else 0
        ilo = min(i for i, m in enumerate(pool) if m >= lo0 + shift)
        ihi = max(i for i, m in enumerate(pool) if m <= hi0 + shift)
        # Melodie
        mel = []
        for ph_i in range(2):
            rng = random.Random(cfg['seed'] * 100 + mseeds[sec][ph_i])
            ch4 = chords[ph_i * 4:ph_i * 4 + 4]
            for (st, dur, idx) in gen_phrase(rng, ch4, pool, ilo, ihi, cfg['dens']):
                mel.append((ph_i * 64 + st, dur, idx))
        lead = S(cfg, 'lead', sec)
        for (st, dur, idx) in mel:
            vel = 1. if st % 8 == 0 else .85
            notes.append((base + st, dur, pool[idx], vel, 'lead', lead))
        l2 = S(cfg, 'lead2', sec)
        if l2:
            inst, mode = l2
            for (st, dur, idx) in mel:
                if mode == 'third':
                    notes.append((base + st, dur, pool[idx - 2], .8, 'lead2', inst))
                elif mode == 'oct':
                    notes.append((base + st, dur, pool[idx] + 12, .7, 'lead2', inst))
                elif mode == 'echo' and st % 16 + 3 < 16:
                    notes.append((base + st + 3, max(dur - 1, 1), pool[idx], .45, 'lead2', inst))
        # Begleitung
        cp, bs, pad, dr = (S(cfg, 'comp', sec), S(cfg, 'bass', sec),
                           S(cfg, 'pad', sec), S(cfg, 'drums', sec))
        for b, sym in enumerate(chords):
            bb = base + b * 16
            if cp:
                for (st, dur, m, v) in COMP[cp[1]](sym):
                    notes.append((bb + st, dur, m, v, 'comp', cp[0]))
            if bs:
                for (st, dur, m, v) in BASS[bs[1]](sym):
                    notes.append((bb + st, dur, m, v, 'bass', bs[0]))
            if pad:
                for m in tones(sym, 55)[:3]:
                    notes.append((bb, 16, m, 1., 'pad', pad))
            if dr:
                p = PAT[dr]; chip = p.get('chip', False)
                for letter, pat in p.items():
                    if letter == 'chip': continue
                    for i, ch in enumerate(pat):
                        if ch != '.':
                            drums.append((bb + i, letter, 1. if ch == 'x' else .55, chip))
                if b == 0:
                    drums.append((bb, 'c', 1., chip))
                if b == SEC - 1:                      # Fill vor dem nächsten Abschnitt
                    for i in range(12, 16):
                        drums.append((bb + i, 's', .6 + .1 * (i - 12), chip))
    return notes, drums, SEC * NSEC

# ----------------------------------------------------------------- Rendering
def pan_gains(p):
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)

def mix_notes(buf, notes, sps):
    cache = {}
    for (step, dur, m, vel, role, inst) in notes:
        pan, gain, gate = ROLE[role]
        dur_s = max(dur * sps / SR * gate, .04)
        key = (inst, m, round(dur_s * 1000))
        if key not in cache:
            cache[key] = INST[inst](mtof(m), dur_s) * LEVEL[inst]
        x = cache[key] * vel * gain
        s0 = int(round(step * sps))
        s1 = min(s0 + len(x), buf.shape[1])
        if s1 <= s0: continue
        gl, gr = pan_gains(pan)
        buf[0, s0:s1] += x[:s1 - s0] * gl
        buf[1, s0:s1] += x[:s1 - s0] * gr

def mix_drums(buf, drums, sps):
    for (step, letter, vel, chip) in drums:
        x = drum(letter, chip) * DGAIN[letter] * vel
        s0 = int(round(step * sps))
        s1 = min(s0 + len(x), buf.shape[1])
        if s1 <= s0: continue
        buf[0, s0:s1] += x[:s1 - s0]
        buf[1, s0:s1] += x[:s1 - s0]

def make_ir(rt, seed):
    rng = np.random.default_rng(seed)
    n = int(rt * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
    y = np.empty(n); a = .35; prev = 0.
    for i in range(n):                      # dunkler werdender Hall
        prev += a * (x[i] - prev); y[i] = prev
    y = np.concatenate([np.zeros(int(.012 * SR)), y])
    return y / np.sqrt(np.sum(y ** 2))

def reverb(buf, wet, rt):
    n = buf.shape[1]
    out = np.empty_like(buf)
    for ch in range(2):
        ir = make_ir(rt, 100 + ch)
        size = 1 << int(np.ceil(np.log2(n + len(ir))))
        conv = np.fft.irfft(np.fft.rfft(buf[ch], size) * np.fft.rfft(ir, size), size)[:n + len(ir)]
        out[ch] = np.pad(buf[ch], (0, len(conv) - n))[:len(conv)][:n] + wet * conv[:n]
    return out

def master(x, rms_db=-19.):
    """auf Ziel-Lautstärke (RMS) bringen, Spitzen weich begrenzen, Headroom für die Kodierung lassen"""
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 10 ** (rms_db / 20)
    x = np.tanh(x * 1.3) / 1.3
    return x * min(1., .84 / np.max(np.abs(x)))

def to_files(x, name):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').T.copy()
    tmp = tempfile.mkdtemp(prefix='cam_')
    wav = os.path.join(tmp, name + '.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    os.makedirs(OUT, exist_ok=True)
    for ext, codec in (('ogg', ['-c:a', 'libvorbis', '-q:a', OGG_Q]), ('mp3', ['-c:a', 'libmp3lame', '-q:a', '3'])):
        if ext not in FORMATS: continue
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, *codec,
                        os.path.join(OUT, f'{name}.{ext}')], check=True)
    os.remove(wav); os.rmdir(tmp)

def render_track(cfg):
    notes, drums, bars = build(cfg)
    sps = SR * 60 / cfg['bpm'] / 4
    L = int(round(bars * 16 * sps))
    pad = int(4.5 * SR)
    buf = np.zeros((2, L + pad))
    mix_notes(buf, notes, sps)
    mix_drums(buf, drums, sps)
    wet, rt = cfg['rev']
    buf = np.pad(buf, ((0, 0), (0, 0)))
    # Hall über Loop + Schwanz, dann Schwanz auf den Anfang falten -> nahtloser Loop
    n = buf.shape[1]
    ir = [make_ir(rt, 100 + c) for c in range(2)]
    out = np.zeros((2, L))
    for c in range(2):
        size = 1 << int(np.ceil(np.log2(n + len(ir[c]))))
        conv = np.fft.irfft(np.fft.rfft(buf[c], size) * np.fft.rfft(ir[c], size), size)[:n + len(ir[c])]
        full = np.pad(buf[c], (0, len(conv) - n)) + wet * conv
        res = full[:L].copy()
        k = 0
        while L * (k + 1) < len(full):
            seg = full[L * (k + 1):L * (k + 2)]
            res[:len(seg)] += seg
            k += 1
        out[c] = res
    return master(out, -17. if cfg['id'].startswith('b') else -19.), notes

def render_oneshot(spec):
    sps = SR * 60 / spec['bpm'] / 4
    notes = [(s, d, m, v, r, i) for (s, d, m, v, r, i) in spec['notes']]
    total = max(s + d for (s, d, *_ ) in notes) * sps / SR + 2.5
    buf = np.zeros((2, int(total * SR)))
    mix_notes(buf, notes, sps)
    mix_drums(buf, spec.get('drums', []), sps)
    wet, rt = spec.get('rev', (.2, 1.2))
    ir = make_ir(rt, 100)
    n = buf.shape[1]
    size = 1 << int(np.ceil(np.log2(n + len(ir))))
    for c in range(2):
        conv = np.fft.irfft(np.fft.rfft(buf[c], size) * np.fft.rfft(ir, size), size)[:n]
        buf[c] += wet * conv
    buf = fade_end_stereo(buf, 400)
    return master(buf, -18.)

def fade_end_stereo(b, ms):
    k = int(ms * SR / 1000)
    b[:, -k:] *= np.linspace(1, 0, k)
    return b

# ----------------------------------------------------------------- Konfiguration: Gebiete
H = dict(slow='slow', mid='mid', fast='fast')
def cfg(**k): return k

TRACKS = [
 # ===== EXPLORE ========================================================
 # 1  Sonnenwiese – klassisch: Flöte, Cembalo-Alberti, Streicher (Haydn/Mozart-Gefühl)
 cfg(id='01_sonnenwiese', bpm=100, key='C', mode='major', seed=1, dens='slow', reg=(67, 88), rev=(.30, 1.9),
     A=['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G7'], B=['Am', 'Em', 'F', 'C', 'F', 'C', 'Dm', 'G7'],
     lead=['flute', 'flute', 'strings', 'flute'], lead2=[None, ('flute', 'third'), ('flute', 'third'), ('bell', 'oct')],
     comp=('harpsichord', 'alberti'), bass=('pizz', 'half'),
     pad=[None, 'strings', 'strings', 'strings'], drums=[None, None, 'shaker', 'shaker']),
 # 2  Flüsterwald – geheimnisvoll: Dorisch, Pizzicato, Celesta
 cfg(id='02_fluesterwald', bpm=86, key='D', mode='dorian', seed=2, dens='slow', reg=(62, 86), rev=(.38, 2.4),
     A=['Dm', 'G', 'Dm', 'C', 'Dm', 'G', 'C', 'Am'], B=['F', 'C', 'Gm', 'Dm', 'F', 'C', 'G', 'A'],
     lead=['flute', 'bell', 'flute', 'bell'], lead2=[None, ('flute', 'third'), ('pluckpulse', 'echo'), ('flute', 'third')],
     comp=('pizz', 'arp8'), bass=('pizz', 'half'),
     pad=['strings', 'strings', 'strings', 'strings'], drums=[None, 'shaker', 'shaker', 'half']),
 # 3  Kristallhöhle – Klassik trifft Chip: Glocken + Pulse-Arpeggios + Echo
 cfg(id='03_kristallhoehle', bpm=78, key='E', mode='minor', seed=3, dens='mid', reg=(64, 88), rev=(.42, 3.2),
     A=['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B7'], B=['C', 'G', 'D', 'Em', 'C', 'G', 'Am', 'B7'],
     lead=['bell', 'bell', 'pulse25v', 'bell'], lead2=[('pluckpulse', 'echo')] * 4,
     comp=[('pluckpulse', 'arp16')] * 4, bass=('tri', 'half'),
     pad=['strings'] * 4, drums=[None, 'shaker', 'half', 'half']),
 # 4  Wüstenwind – Orient: Phrygisch-Dominant, Pulse mit Vibrato, Darbuka
 cfg(id='04_wuestenwind', bpm=108, key='D', mode='phrygdom', seed=4, dens='mid', reg=(62, 84), rev=(.2, 1.5),
     A=['D', 'Eb', 'D', 'Eb', 'D', 'Gm', 'Eb', 'D'], B=['Gm', 'D', 'Gm', 'D', 'Eb', 'D', 'Gm', 'A'],
     lead=['flute', 'pulse25v', 'pulse25v', 'pulse25v'], lead2=[None, ('pulse50', 'echo'), ('pulse12', 'oct'), ('pulse50', 'echo')],
     comp=('pizz', 'stab'), bass=('tri', 'sync'),
     pad=[None, None, 'strings', 'strings'], drums=['darbuka'] * 4),
 # 5  Eisgipfel – Retro: Lydisch, Glocken + Chip, Triangle-Walking-Bass
 cfg(id='05_eisgipfel', bpm=112, key='F', mode='lydian', seed=5, dens='mid', reg=(69, 91), rev=(.25, 2.0),
     A=['F', 'G', 'F', 'C', 'Dm', 'G', 'Am', 'C'], B=['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'G', 'C'],
     lead=['bell', 'pulse50', 'pulse25', 'pulse50'], lead2=[None, ('bell', 'oct'), ('pulse12', 'echo'), ('bell', 'oct')],
     comp=('arpulse', 'arp16'), bass=('tri', 'walk'),
     pad=[None, None, 'strings', None], drums=[None, 'chipbeat', 'chipbeat', 'chipbeat']),
 # 6  Vulkan – Retro/Arcade: C-Moll, Sägezahn-Lead, Galopp-Bass
 cfg(id='06_vulkan', bpm=126, key='C', mode='harmminor', seed=6, dens='mid', reg=(60, 84), rev=(.15, 1.4),
     A=['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'G'], B=['Fm', 'Cm', 'Ab', 'Eb', 'Fm', 'Cm', 'G', 'G'],
     lead=['sawv', 'pulse25v', 'sawv', 'supersaw'], lead2=[('pulse12', 'echo')] * 4,
     comp=('arpulse', 'arp16'), bass=('tri', 'gallop'), pad=None, drums=['chipbeat', 'chipfast', 'chipfast', 'chipfast']),
 # 7  Neon-Stadt – Arcade/Synthwave: A-Moll, Supersaw, 16tel-Bass, Four-on-the-floor
 cfg(id='07_neonstadt', bpm=128, key='A', mode='harmminor', seed=7, dens='mid', reg=(64, 88), rev=(.18, 1.6),
     A=['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], B=['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'E'],
     lead=['supersaw', 'pulse25v', 'supersaw', 'supersaw'], lead2=[None, ('pulse12', 'echo'), ('pulse50', 'oct'), ('pulse12', 'echo')],
     comp=('arpulse', 'arp16'), bass=('saw', 'drive'),
     pad=[None, 'strings', 'strings', 'strings'], drums=['four'] * 4),
 # 8  Königsburg – Finale: Orgel/Toccata + Arcade (Klassik und Retro verschmelzen)
 cfg(id='08_koenigsburg', bpm=120, key='D', mode='minor', seed=8, dens='mid', reg=(62, 86), rev=(.28, 2.2),
     A=['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A'], B=['Bb', 'F', 'Gm', 'Dm', 'Bb', 'F', 'A', 'A'],
     lead=['organ', 'brass', 'pulse50v', 'organ'], lead2=[('pulse12', 'oct'), ('organ', 'third'), ('supersaw', 'oct'), ('brass', 'third')],
     comp=('harpsichord', 'arp16'), bass=[('tri', 'walk'), ('saw', 'octave'), ('saw', 'drive'), ('saw', 'drive')],
     pad=['strings'] * 4, drums=[None, 'rock', 'four', 'battle']),
 # ===== KAMPF ===========================================================
 # b1 Wiese: Vivaldi-Gewitter – Streicher-Staccato + Pauken
 cfg(id='b01_kampf_wiese', bpm=152, key='A', mode='minor', seed=21, dens='fast', reg=(64, 88), rev=(.22, 1.5),
     A=['Am', 'Am', 'Dm', 'E7', 'Am', 'F', 'Dm', 'E7'], B=['F', 'G', 'Am', 'E7', 'Dm', 'Am', 'Bdim', 'E7'],
     lead=['strings', 'brass', 'strings', 'brass'], lead2=[None, ('flute', 'oct'), ('strings', 'third'), ('flute', 'oct')],
     comp=('strings', 'pulse8'), bass=('pizz', 'octave'), pad=None, drums=['timp'] * 4),
 # b2 Wald: Cembalo-Ostinato + Chip-Drums
 cfg(id='b02_kampf_wald', bpm=142, key='D', mode='minor', seed=22, dens='fast', reg=(62, 86), rev=(.2, 1.6),
     A=['Dm', 'Dm', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A7'], B=['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'A', 'A'],
     lead=['pulse25', 'flute', 'pulse25v', 'pulse25v'], lead2=[('pulse12', 'echo'), ('flute', 'third'), ('pulse50', 'oct'), ('pulse12', 'echo')],
     comp=('harpsichord', 'arp16'), bass=('tri', 'gallop'), pad=[None, 'strings', 'strings', 'strings'],
     drums=['chipbeat', 'chipfast', 'chipfast', 'chipfast']),
 # b3 Höhle: Pulse-Jagd
 cfg(id='b03_kampf_hoehle', bpm=146, key='E', mode='minor', seed=23, dens='fast', reg=(64, 88), rev=(.25, 2.0),
     A=['Em', 'Em', 'C', 'D', 'Em', 'G', 'C', 'B7'], B=['C', 'D', 'Em', 'Em', 'C', 'D', 'B7', 'B7'],
     lead=['pulse25v', 'pulse50v', 'pulse25v', 'sawv'], lead2=[('pulse12', 'echo')] * 4,
     comp=('arpulse', 'arp16'), bass=('tri', 'gallop'), pad=[None, 'strings', None, 'strings'],
     drums=['chipfast'] * 4),
 # b4 Wüste: Orient-Battle
 cfg(id='b04_kampf_wueste', bpm=150, key='D', mode='phrygdom', seed=24, dens='fast', reg=(62, 84), rev=(.15, 1.3),
     A=['Dm', 'Eb', 'Dm', 'Eb', 'Gm', 'Eb', 'A', 'A'], B=['Gm', 'A', 'Dm', 'Eb', 'Gm', 'A', 'Dm', 'A'],
     lead=['pulse25v', 'sawv', 'pulse25v', 'sawv'], lead2=[('pulse12', 'echo'), ('pulse50', 'oct')] * 2,
     comp=('arpulse', 'stab'), bass=('saw', 'sync'), pad=None, drums=['battle'] * 4),
 # b5 Eis: Chip-Glocken-Kampf
 cfg(id='b05_kampf_eis', bpm=154, key='G', mode='minor', seed=25, dens='fast', reg=(67, 91), rev=(.22, 1.8),
     A=['Gm', 'Eb', 'F', 'D', 'Gm', 'Eb', 'F', 'D7'], B=['Cm', 'Gm', 'Eb', 'D', 'Cm', 'Gm', 'D', 'D'],
     lead=['pulse50', 'bell', 'pulse25v', 'sawv'], lead2=[('bell', 'oct'), ('pulse12', 'echo'), ('bell', 'oct'), ('pulse50', 'oct')],
     comp=('arpulse', 'arp16'), bass=('tri', 'octave'), pad=[None, None, 'strings', 'strings'],
     drums=['chipfast'] * 4),
 # b6 Vulkan: Hardcore-Chip
 cfg(id='b06_kampf_vulkan', bpm=168, key='C', mode='harmminor', seed=26, dens='fast', reg=(60, 84), rev=(.12, 1.2),
     A=['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'], B=['Fm', 'G', 'Cm', 'Ab', 'Fm', 'G', 'G', 'G'],
     lead=['sawv', 'pulse25v', 'sawv', 'supersaw'], lead2=[('pulse12', 'echo'), ('pulse50', 'oct')] * 2,
     comp=('arpulse', 'arp16'), bass=('saw', 'gallop'), pad=None, drums=['chipfast'] * 4),
 # b7 Neon: Arcade-Rave
 cfg(id='b07_kampf_neon', bpm=174, key='A', mode='harmminor', seed=27, dens='fast', reg=(64, 90), rev=(.15, 1.4),
     A=['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'], B=['F', 'G', 'Am', 'C', 'F', 'G', 'E', 'E'],
     lead=['supersaw', 'pulse25v', 'supersaw', 'supersaw'], lead2=[('pulse12', 'echo'), ('pulse50', 'oct')] * 2,
     comp=('arpulse', 'arp16'), bass=('saw', 'drive'), pad=['strings'] * 4, drums=['fastfour'] * 4),
 # b8 Boss: Orgel-Toccata mit Arcade-Wucht
 cfg(id='b08_kampf_boss', bpm=160, key='D', mode='minor', seed=28, dens='fast', reg=(62, 88), rev=(.28, 2.0),
     A=['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'Bb', 'A'], B=['Bb', 'C', 'Dm', 'F', 'Bb', 'C', 'A', 'A'],
     lead=['organ', 'brass', 'supersaw', 'organ'], lead2=[('pulse12', 'oct'), ('organ', 'third'), ('brass', 'third'), ('supersaw', 'oct')],
     comp=('harpsichord', 'arp16'), bass=('saw', 'drive'), pad=['strings'] * 4, drums=['double'] * 4),
 # ===== TITEL: erzählt die Reise Klassik -> Retro -> Arcade ===============
 cfg(id='00_titel', bpm=108, key='C', mode='major', seed=30, dens='mid', reg=(67, 88), rev=(.28, 1.9),
     A=['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G7'], B=['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G7'],
     lead=['flute', 'pulse50', 'supersaw', 'brass'], lead2=[('flute', 'third'), ('pulse12', 'echo'), ('pulse25', 'oct'), ('supersaw', 'oct')],
     comp=[('harpsichord', 'alberti'), ('arpulse', 'arp16'), ('arpulse', 'arp16'), ('harpsichord', 'arp16')],
     bass=[('pizz', 'half'), ('tri', 'walk'), ('saw', 'drive'), ('saw', 'drive')],
     pad=['strings', None, 'strings', 'strings'], drums=[None, 'chipbeat', 'four', 'battle']),
]

# ----------------------------------------------------------------- Jingles
def N(name): 
    return {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[name[0]] + (1 if '#' in name else -1 if name[1:2] == 'b' else 0) + 12 * (int(name[-1]) + 1)

def seq(role, inst, items, vel=1.):
    return [(s, d, N(n), v if v else vel, role, inst) for (s, d, n, *v) in
            [(a, b, c, (rest[0] if rest else 0)) for (a, b, c, *rest) in items]]

JINGLES = {
 'j_sieg': dict(bpm=150, rev=(.25, 1.6), notes=
    seq('lead', 'brass', [(0, 2, 'G4'), (2, 2, 'G4'), (4, 2, 'G4'), (6, 6, 'C5'), (12, 2, 'Bb4'), (14, 2, 'C5'), (16, 10, 'E5'),
                          (28, 2, 'D5'), (30, 2, 'E5'), (32, 14, 'G5')]) +
    seq('lead2', 'pulse50', [(0, 2, 'G5'), (2, 2, 'G5'), (4, 2, 'G5'), (6, 6, 'C6'), (12, 2, 'Bb5'), (14, 2, 'C6'), (16, 10, 'E6'),
                             (28, 2, 'D6'), (30, 2, 'E6'), (32, 14, 'G6')], .55) +
    seq('bass', 'tri', [(0, 6, 'C3'), (6, 6, 'C3'), (12, 4, 'G2'), (16, 12, 'C3'), (28, 4, 'G2'), (32, 14, 'C2')]) +
    seq('comp', 'strings', [(32, 14, 'C4'), (32, 14, 'E4'), (32, 14, 'G4')], .9),
    drums=[(0, 't', 1., False), (6, 't', 1., False), (12, 't', .8, False), (16, 't', 1., False), (32, 'c', 1., False), (32, 't', 1., False)]),
 'j_gefangen': dict(bpm=140, rev=(.25, 1.4), notes=
    seq('lead', 'pulse50', [(i, 1, n) for i, n in enumerate(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'])] + [(6, 10, 'C7')]) +
    seq('lead2', 'bell', [(6, 10, 'C6'), (8, 8, 'E6'), (10, 6, 'G6')], .8) +
    seq('bass', 'tri', [(0, 4, 'C3'), (6, 8, 'C3')]) +
    seq('comp', 'strings', [(6, 10, 'C4'), (6, 10, 'E4'), (6, 10, 'G4')], .8)),
 'j_levelup': dict(bpm=160, rev=(.2, 1.2), notes=
    seq('lead', 'pulse25', [(i, 1, n) for i, n in enumerate(['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'])] + [(8, 8, 'E6')]) +
    seq('lead2', 'pulse50', [(8, 8, 'C6'), (8, 8, 'G6')], .6) + seq('bass', 'tri', [(0, 8, 'C3'), (8, 8, 'C2')])),
 'j_niederlage': dict(bpm=66, rev=(.35, 2.4), notes=
    seq('lead', 'strings', [(0, 4, 'E5'), (4, 4, 'D5'), (8, 4, 'C5'), (12, 4, 'B4'), (16, 16, 'A4')]) +
    seq('lead2', 'flute', [(0, 4, 'C5'), (4, 4, 'B4'), (8, 4, 'A4'), (12, 4, 'G#4'), (16, 16, 'E4')], .8) +
    seq('bass', 'tri', [(0, 8, 'A2'), (8, 8, 'F2'), (16, 16, 'A1')]) +
    seq('comp', 'strings', [(16, 16, 'A3'), (16, 16, 'C4'), (16, 16, 'E4')], .8)),
}

# ----------------------------------------------------------------- main
def main(filt):
    for c in TRACKS:
        if filt and not any(f in c['id'] for f in filt): continue
        x, notes = render_track(c)
        to_files(x, c['id'])
        lead = [n for n in notes if n[4] == 'lead']
        print(f"{c['id']:<22} {x.shape[1] / SR:6.1f}s  {c['bpm']:>3} bpm  "
              f"lead {nname(min(n[2] for n in lead))}..{nname(max(n[2] for n in lead))}  {len(notes)} Noten", flush=True)
    for k, spec in JINGLES.items():
        if filt and not any(f in k for f in filt): continue
        x = render_oneshot(spec)
        to_files(x, k)
        print(f"{k:<22} {x.shape[1] / SR:6.1f}s", flush=True)

if __name__ == '__main__':
    main(sys.argv[1:])
