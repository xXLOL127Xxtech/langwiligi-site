// Gitterkrieg – WebGL-Renderer: leuchtende Vektorlinien als Kapseln, HDR-Szene und mehrstufiger Bloom
'use strict';

const R = (() => {
  let gl = null, isGL2 = false, hdr = false, canvas = null;
  let W = 1, H = 1;              // Zeichenpuffer in Pixeln
  let pLine, pBlur, pDown, pComp;
  let vbo, ibo, quadBuf;
  let fbScene, fbs = [];         // Bloom-Stufen: [{a, b, w, h}]
  const MAXQ = 16000;
  const STRIDE = 7;              // Floats pro Ecke: x, y, lx, ly, L, r, Farbe(4 Bytes)
  const ab = new ArrayBuffer(MAXQ * 4 * STRIDE * 4);
  const f32 = new Float32Array(ab), u8 = new Uint8Array(ab);
  let nq = 0;
  let cx = 0, cy = 0, zoom = 1, minR = 1;      // Kamera
  let view = [0, 0, 0, 0];                    // sichtbarer Weltbereich
  let quadsDrawn = 0;
  const stat = { quads: 0 };

  const VS_LINE = `
attribute vec2 a_pos; attribute vec2 a_loc; attribute vec2 a_lr; attribute vec4 a_col;
uniform vec4 u_cam;
varying vec2 v_loc; varying vec2 v_lr; varying vec4 v_col;
void main() {
  v_loc = a_loc; v_lr = a_lr; v_col = a_col;
  gl_Position = vec4((a_pos.x - u_cam.x) * u_cam.z, (a_pos.y - u_cam.y) * u_cam.w, 0.0, 1.0);
}`;
  const FS_LINE = `
precision mediump float;
varying vec2 v_loc; varying vec2 v_lr; varying vec4 v_col;
void main() {
  float dx = max(0.0, max(-v_loc.x, v_loc.x - v_lr.x));
  float d = length(vec2(dx, v_loc.y)) / v_lr.y;
  float f = clamp(1.0 - d, 0.0, 1.0);
  float core = f * f;
  float m = max(v_col.r, max(v_col.g, v_col.b));
  vec3 c = v_col.rgb * core * 1.5 + vec3(pow(f, 4.0) * m * m * 0.9);
  gl_FragColor = vec4(c * v_col.a, 1.0);
}`;
  const VS_FULL = `
attribute vec2 a_p; varying vec2 v_uv;
void main() { v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }`;
  const FS_DOWN = `
precision mediump float;
uniform sampler2D u_t; uniform vec2 u_px; uniform float u_thr; varying vec2 v_uv;
void main() {
  vec3 c = texture2D(u_t, v_uv + u_px * vec2(-1.0, -1.0)).rgb + texture2D(u_t, v_uv + u_px * vec2(1.0, -1.0)).rgb
         + texture2D(u_t, v_uv + u_px * vec2(-1.0, 1.0)).rgb + texture2D(u_t, v_uv + u_px * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  c = max(c - vec3(u_thr), vec3(0.0));
  gl_FragColor = vec4(c, 1.0);
}`;
  const FS_BLUR = `
precision mediump float;
uniform sampler2D u_t; uniform vec2 u_dir; varying vec2 v_uv;
void main() {
  vec3 s = texture2D(u_t, v_uv).rgb * 0.227027;
  s += (texture2D(u_t, v_uv + u_dir * 1.3846154).rgb + texture2D(u_t, v_uv - u_dir * 1.3846154).rgb) * 0.3162162;
  s += (texture2D(u_t, v_uv + u_dir * 3.2307692).rgb + texture2D(u_t, v_uv - u_dir * 3.2307692).rgb) * 0.0702703;
  gl_FragColor = vec4(s, 1.0);
}`;
  const FS_COMP = `
precision mediump float;
uniform sampler2D u_s; uniform sampler2D u_b1; uniform sampler2D u_b2; uniform sampler2D u_b3; uniform sampler2D u_b4;
uniform float u_flash; uniform vec3 u_tint; uniform float u_exp;
varying vec2 v_uv;
void main() {
  vec2 d = v_uv - 0.5;
  float r2 = dot(d, d);
  vec2 ca = d * (0.0012 + r2 * 0.006);
  vec3 sc = vec3(texture2D(u_s, v_uv + ca).r, texture2D(u_s, v_uv).g, texture2D(u_s, v_uv - ca).b);
  vec3 b = texture2D(u_b1, v_uv).rgb * 0.55 + texture2D(u_b2, v_uv).rgb * 0.7 + texture2D(u_b3, v_uv).rgb * 0.9 + texture2D(u_b4, v_uv).rgb * 1.2;
  vec3 c = sc + b + u_tint * u_flash;
  c = vec3(1.0) - exp(-c * u_exp);
  c *= 1.0 - r2 * 0.85;
  gl_FragColor = vec4(c, 1.0);
}`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const okFb = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h, ok: okFb };
  }
  function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }

  function init(cv) {
    canvas = cv;
    const opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
    gl = cv.getContext('webgl2', opts);
    if (gl) {
      isGL2 = true;
      hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    } else {
      gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
      if (!gl) return false;
    }
    pLine = program(VS_LINE, FS_LINE, ['a_pos', 'a_loc', 'a_lr', 'a_col']);
    pBlur = program(VS_FULL, FS_BLUR, ['a_p']);
    pDown = program(VS_FULL, FS_DOWN, ['a_p']);
    pComp = program(VS_FULL, FS_COMP, ['a_p']);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, ab.byteLength, gl.DYNAMIC_DRAW);
    const idx = new Uint16Array(MAXQ * 6);
    for (let i = 0; i < MAXQ; i++) {
      const v = i * 4, o = i * 6;
      idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3;
    }
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    canvas.addEventListener('webglcontextlost', e => e.preventDefault());
    return true;
  }

  function resize(w, h) {
    w = Math.max(16, w | 0); h = Math.max(16, h | 0);
    if (w === W && h === H && fbScene) return;
    W = w; H = h;
    canvas.width = W; canvas.height = H;
    freeTarget(fbScene); fbs.forEach(s => { freeTarget(s.a); freeTarget(s.b); });
    fbScene = makeTarget(W, H);
    if (hdr && !fbScene.ok) { hdr = false; freeTarget(fbScene); fbScene = makeTarget(W, H); }
    fbs = [];
    let fw = W, fh = H;
    for (let i = 0; i < 4; i++) {
      fw = Math.max(4, fw >> 1); fh = Math.max(4, fh >> 1);
      fbs.push({ a: makeTarget(fw, fh), b: makeTarget(fw, fh), w: fw, h: fh });
    }
  }

  // Kamera setzen: Mittelpunkt und Pixel pro Welteinheit (im Zeichenpuffer)
  function camera(x, y, z) {
    cx = x; cy = y; zoom = z;
    minR = 0.85 / zoom;
    const hw = W / 2 / zoom, hh = H / 2 / zoom;
    view[0] = cx - hw; view[1] = cy - hh; view[2] = cx + hw; view[3] = cy + hh;
  }

  function begin() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.004, 0.004, 0.018, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pLine.p);
    gl.uniform4f(pLine.u.u_cam, cx, cy, 2 * zoom / W, -2 * zoom / H);
    nq = 0; quadsDrawn = 0;
  }

  function flush() {
    if (!nq) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32.subarray(0, nq * 4 * STRIDE));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const s = STRIDE * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, s, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, s, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, s, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, s, 24);
    gl.drawElements(gl.TRIANGLES, nq * 6, gl.UNSIGNED_SHORT, 0);
    quadsDrawn += nq;
    nq = 0;
  }

  // Leuchtende Kapsel von (x1,y1) nach (x2,y2), Radius r (Welt), Farbe rgb 0..1 (HDR: >1 erlaubt bis 2), a Helligkeit
  function seg(x1, y1, x2, y2, r, cr, cg, cb, a) {
    if (r < minR) { a *= r / minR; r = minR; }
    if (a <= 0.004) return;
    // grob ausserhalb der Sicht? weglassen
    const m = r + 2;
    if ((x1 < view[0] - m && x2 < view[0] - m) || (x1 > view[2] + m && x2 > view[2] + m) ||
        (y1 < view[1] - m && y2 < view[1] - m) || (y1 > view[3] + m && y2 > view[3] + m)) return;
    if (nq >= MAXQ) flush();
    let dx = x2 - x1, dy = y2 - y1;
    const L = Math.sqrt(dx * dx + dy * dy);
    if (L > 1e-4) { dx /= L; dy /= L; } else { dx = 1; dy = 0; }
    const nx = -dy * r, ny = dx * r, ex = dx * r, ey = dy * r;
    const R8 = Math.min(255, cr * 127.5) | 0, G8 = Math.min(255, cg * 127.5) | 0, B8 = Math.min(255, cb * 127.5) | 0;
    const A8 = Math.min(255, a * 255) | 0;
    let o = nq * 4 * STRIDE;
    // Ecke 0: Anfang, links
    f32[o] = x1 - ex + nx; f32[o + 1] = y1 - ey + ny; f32[o + 2] = -r; f32[o + 3] = r; f32[o + 4] = L; f32[o + 5] = r;
    let b = (o + 6) * 4; u8[b] = R8; u8[b + 1] = G8; u8[b + 2] = B8; u8[b + 3] = A8;
    o += STRIDE;
    f32[o] = x2 + ex + nx; f32[o + 1] = y2 + ey + ny; f32[o + 2] = L + r; f32[o + 3] = r; f32[o + 4] = L; f32[o + 5] = r;
    b = (o + 6) * 4; u8[b] = R8; u8[b + 1] = G8; u8[b + 2] = B8; u8[b + 3] = A8;
    o += STRIDE;
    f32[o] = x2 + ex - nx; f32[o + 1] = y2 + ey - ny; f32[o + 2] = L + r; f32[o + 3] = -r; f32[o + 4] = L; f32[o + 5] = r;
    b = (o + 6) * 4; u8[b] = R8; u8[b + 1] = G8; u8[b + 2] = B8; u8[b + 3] = A8;
    o += STRIDE;
    f32[o] = x1 - ex - nx; f32[o + 1] = y1 - ey - ny; f32[o + 2] = -r; f32[o + 3] = -r; f32[o + 4] = L; f32[o + 5] = r;
    b = (o + 6) * 4; u8[b] = R8; u8[b + 1] = G8; u8[b + 2] = B8; u8[b + 3] = A8;
    nq++;
  }

  // Geschlossene Form aus lokalen Punkten [x0,y0,x1,y1,...], gedreht und skaliert
  function shape(pts, x, y, ang, sx, sy, r, c, a, open) {
    const co = Math.cos(ang), si = Math.sin(ang);
    const n = pts.length / 2;
    let px = 0, py = 0, fx = 0, fy = 0;
    for (let i = 0; i < n; i++) {
      const lx = pts[i * 2] * sx, ly = pts[i * 2 + 1] * sy;
      const wx = x + lx * co - ly * si, wy = y + lx * si + ly * co;
      if (i > 0) seg(px, py, wx, wy, r, c[0], c[1], c[2], a); else { fx = wx; fy = wy; }
      px = wx; py = wy;
    }
    if (!open) seg(px, py, fx, fy, r, c[0], c[1], c[2], a);
  }

  function circle(x, y, rad, n, r, c, a, rot) {
    rot = rot || 0;
    let px = x + Math.cos(rot) * rad, py = y + Math.sin(rot) * rad;
    for (let i = 1; i <= n; i++) {
      const t = rot + i / n * TAU;
      const qx = x + Math.cos(t) * rad, qy = y + Math.sin(t) * rad;
      seg(px, py, qx, qy, r, c[0], c[1], c[2], a);
      px = qx; py = qy;
    }
  }

  function drawFull() {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function bindTex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); }

  // Szene abschliessen: Bloom berechnen und auf den Bildschirm bringen
  function end(flash, tint, bloomOn) {
    flush();
    stat.quads = quadsDrawn;
    gl.disable(gl.BLEND);
    // Herunterskalieren mit Schwelle, dann weichzeichnen
    let src = fbScene;
    const lv = bloomOn ? fbs.length : 0;
    for (let i = 0; i < lv; i++) {
      const st = fbs[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.a.fb); gl.viewport(0, 0, st.w, st.h);
      gl.useProgram(pDown.p);
      bindTex(0, src); gl.uniform1i(pDown.u.u_t, 0);
      gl.uniform2f(pDown.u.u_px, 0.5 / src.w, 0.5 / src.h);
      gl.uniform1f(pDown.u.u_thr, i === 0 ? (hdr ? 0.16 : 0.1) : 0);
      drawFull();
      gl.useProgram(pBlur.p); gl.uniform1i(pBlur.u.u_t, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.b.fb);
      bindTex(0, st.a); gl.uniform2f(pBlur.u.u_dir, 1 / st.w, 0); drawFull();
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.a.fb);
      bindTex(0, st.b); gl.uniform2f(pBlur.u.u_dir, 0, 1 / st.h); drawFull();
      src = st.a;
    }
    if (!bloomOn) { // leere Bloom-Puffer, damit die Komposition stimmt
      for (const st of fbs) { gl.bindFramebuffer(gl.FRAMEBUFFER, st.a.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(pComp.p);
    bindTex(0, fbScene); gl.uniform1i(pComp.u.u_s, 0);
    for (let i = 0; i < 4; i++) { bindTex(i + 1, fbs[i].a); gl.uniform1i(pComp.u['u_b' + (i + 1)], i + 1); }
    gl.uniform1f(pComp.u.u_flash, flash || 0);
    gl.uniform3f(pComp.u.u_tint, tint[0], tint[1], tint[2]);
    gl.uniform1f(pComp.u.u_exp, hdr ? 1.25 : 1.6);
    drawFull();
    gl.activeTexture(gl.TEXTURE0);
  }

  return {
    init, resize, camera, begin, seg, shape, circle, flush, end, stat,
    get W() { return W; }, get H() { return H; }, get zoom() { return zoom; }, get view() { return view; },
    get cx() { return cx; }, get cy() { return cy; }, get hdr() { return hdr; }, get gl2() { return isGL2; },
  };
})();
