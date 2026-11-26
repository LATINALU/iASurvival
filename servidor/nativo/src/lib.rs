//! Núcleo nativo de iASurvival, compilado a WebAssembly (sin dependencias).
//!
//! 1. **Terreno**: la pasada pesada de ruido (elevación con dominio deformado, crestas, mar, ríos con vados,
//!    latitud y humedad), portada EXACTAMENTE del ruido de TxNucleo (`hash2`, `ruidoValor`, `fbm`,
//!    `ruidoDeformado`) para dar el mismo mundo que la versión en TypeScript.
//! 2. **Caminos**: A* sobre la grilla de costos del mundo (8 vecinos sin cortar esquinas, misma heurística que
//!    `navegacion.grafoGrilla` de TxNucleo), con arreglos sellados por búsqueda: nada de mapas ni basura.
//!
//! Interfaz C simple: JS reserva búferes con `reservar`, escribe/lee la memoria lineal y llama a las funciones.

use std::alloc::{alloc, dealloc, Layout};

// ------------------------------------------------------------------ memoria

#[no_mangle]
pub extern "C" fn reservar(bytes: usize) -> *mut u8 {
    unsafe { alloc(Layout::from_size_align(bytes.max(8), 8).unwrap()) }
}

#[no_mangle]
pub extern "C" fn liberar(p: *mut u8, bytes: usize) {
    unsafe { dealloc(p, Layout::from_size_align(bytes.max(8), 8).unwrap()) }
}

// ------------------------------------------------------------------ ruido (port exacto de TxNucleo)

#[inline]
fn a_i32(v: f64) -> i32 {
    // ToInt32 de JS (los valores del juego son chicos: no hace falta el módulo completo).
    if v.is_finite() { (v as i64) as i32 } else { 0 }
}

#[inline]
fn hash2(x: f64, y: f64, semilla: f64) -> f64 {
    let mut h = a_i32(x)
        .wrapping_mul(374761393)
        .wrapping_add(a_i32(y).wrapping_mul(668265263))
        .wrapping_add(a_i32(semilla).wrapping_mul(2147483647));
    h = (h ^ ((h as u32) >> 13) as i32).wrapping_mul(1274126177);
    ((h ^ ((h as u32) >> 16) as i32) as u32) as f64 / 4294967296.0
}

#[inline]
fn suave(t: f64) -> f64 {
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}

#[inline]
fn mezcla(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

fn ruido_valor(x: f64, y: f64, semilla: f64) -> f64 {
    let xi = x.floor();
    let yi = y.floor();
    let tx = suave(x - xi);
    let ty = suave(y - yi);
    mezcla(
        mezcla(hash2(xi, yi, semilla), hash2(xi + 1.0, yi, semilla), tx),
        mezcla(hash2(xi, yi + 1.0, semilla), hash2(xi + 1.0, yi + 1.0, semilla), tx),
        ty,
    )
}

fn fbm(x: f64, y: f64, semilla: f64, octavas: u32) -> f64 {
    let (mut s, mut amp, mut frec, mut norm) = (0.0, 1.0, 1.0, 0.0);
    for i in 0..octavas {
        s += ruido_valor(x * frec, y * frec, semilla + (i as f64) * 101.0) * amp;
        norm += amp;
        amp *= 0.5;
        frec *= 2.0;
    }
    s / norm
}

fn ruido_deformado(x: f64, y: f64, fuerza: f64, semilla: f64) -> f64 {
    let qx = fbm(x, y, semilla, 4);
    let qy = fbm(x + 5.2, y + 1.3, semilla + 7.0, 4);
    fbm(x + fuerza * qx, y + fuerza * qy, semilla + 13.0, 4)
}

/// Pasada 1 del terreno (ver `terreno.ts`). `rios` = [vertical, base, onda, fase] × n_rios (f64).
/// Salidas (cada una tam*tam): elevación f32, latitud f32, humedad f32, río u8 (0 nada, 1 río, 2 vado).
#[no_mangle]
pub extern "C" fn terreno_pasada1(
    semilla: f64, tam: u32, ox: f64, oz: f64, lado_mar: u32, rios: *const f64, n_rios: u32,
    elev: *mut f32, lat: *mut f32, hum: *mut f32, rio: *mut u8,
) {
    let tam_u = tam as usize;
    let n = tam_u * tam_u;
    let rios = unsafe { std::slice::from_raw_parts(rios, (n_rios * 4) as usize) };
    let elev = unsafe { std::slice::from_raw_parts_mut(elev, n) };
    let lat = unsafe { std::slice::from_raw_parts_mut(lat, n) };
    let hum = unsafe { std::slice::from_raw_parts_mut(hum, n) };
    let rio = unsafe { std::slice::from_raw_parts_mut(rio, n) };
    let t = tam as f64;
    // El centro de cada río solo depende de una coordenada: se calcula una vez por fila/columna.
    let centros: Vec<Vec<f64>> = rios
        .chunks_exact(4)
        .map(|r| (0..tam_u).map(|k| {
            let tt = k as f64;
            r[1] * t + (tt / r[2] + r[3]).sin() * t * 0.05 + (fbm(tt / 170.0 + r[3], 3.1, semilla + 9.0, 4) - 0.5) * 180.0
        }).collect())
        .collect();
    for z in 0..tam_u {
        let zf = z as f64;
        for x in 0..tam_u {
            let xf = x as f64;
            let i = z * tam_u + x;
            let e0 = ruido_deformado(xf / 420.0 + ox, zf / 420.0 + oz, 2.2, semilla);
            let detalle = fbm(xf / 26.0 + ox, zf / 26.0 + oz, semilla + 3.0, 3);
            let cresta = 1.0 - (2.0 * fbm(xf / 190.0 + oz, zf / 190.0 + ox, semilla + 11.0, 3) - 1.0).abs();
            let mascara = fbm(xf / 650.0 + 7.0, zf / 650.0 + 3.0, semilla + 13.0, 2);
            let mut e = e0 * 0.82 + detalle * 0.12 + (mascara - 0.58).max(0.0) * 1.5 * cresta.powi(4);
            let d_borde = [zf, t - 1.0 - xf, t - 1.0 - zf, xf];
            let d_mar = d_borde[lado_mar as usize] / t;
            e -= (0.09 - d_mar).max(0.0) * 3.2
                + (fbm(xf / 60.0, zf / 60.0, semilla + 17.0, 4) - 0.5) * 0.08 * if d_mar < 0.12 { 1.0 } else { 0.0 };
            let mut borde = f64::INFINITY;
            for (k, d) in d_borde.iter().enumerate() {
                if k as u32 != lado_mar && *d < borde {
                    borde = *d;
                }
            }
            e += (0.03 - borde / t).max(0.0) * 6.0;
            elev[i] = e as f32;
            let mut d_rio = f64::INFINITY;
            let mut vado = false;
            for (k, r) in rios.chunks_exact(4).enumerate() {
                let vertical = r[0] != 0.0;
                let (tt, u) = if vertical { (zf, xf) } else { (xf, zf) };
                let centro = centros[k][tt as usize];
                let d = (u - centro).abs();
                if d < d_rio {
                    d_rio = d;
                    vado = (tt % 140.0) < 7.0;
                }
            }
            let ancho = 1.6 + fbm(xf / 90.0, zf / 90.0, semilla + 19.0, 4) * 1.6;
            rio[i] = if d_rio < ancho && xf > 4.0 && zf > 4.0 && xf < t - 4.0 && zf < t - 4.0 { if vado { 2 } else { 1 } } else { 0 };
            lat[i] = (zf / t + (fbm(xf / 300.0 + 50.0, zf / 300.0, semilla + 31.0, 3) - 0.5) * 0.3) as f32;
            hum[i] = (fbm(xf / 240.0 + 40.0 + ox, zf / 240.0 + 40.0, semilla + 5.0, 4)
                + if d_rio < 18.0 { 0.12 } else { 0.0 }
                + if d_mar < 0.14 { 0.08 } else { 0.0 }) as f32;
        }
    }
}

// ------------------------------------------------------------------ A* sobre la grilla

struct Grilla {
    tam: usize,
    costos: Vec<f32>,
    g: Vec<f32>,
    padre: Vec<i32>,
    sello: Vec<u32>,
    cerrado: Vec<u32>,
    turno: u32,
    monticulo: Vec<(f32, u32)>,
    ruta: Vec<i32>,
}

static mut GRILLA: Option<Grilla> = None;

#[allow(static_mut_refs)]
fn grilla() -> &'static mut Grilla {
    unsafe { GRILLA.as_mut().expect("grilla sin iniciar") }
}

/// Crea (o recrea) la grilla de `tam`×`tam`. Devuelve el puntero a los costos (f32) para cargarlos desde JS.
#[no_mangle]
#[allow(static_mut_refs)]
pub extern "C" fn grilla_iniciar(tam: u32) -> *mut f32 {
    let n = (tam as usize) * (tam as usize);
    unsafe {
        GRILLA = Some(Grilla {
            tam: tam as usize,
            costos: vec![1.0; n],
            g: vec![0.0; n],
            padre: vec![-1; n],
            sello: vec![0; n],
            cerrado: vec![0; n],
            turno: 0,
            monticulo: Vec::with_capacity(1 << 16),
            ruta: Vec::with_capacity(4096),
        });
    }
    grilla().costos.as_mut_ptr()
}

/// Puntero a los costos (por si la memoria creció y JS tiene que rehacer su vista).
#[no_mangle]
pub extern "C" fn grilla_costos() -> *mut f32 {
    grilla().costos.as_mut_ptr()
}

/// Cambia costos sueltos: `indices` (u32) y `valores` (f32), `n` pares.
#[no_mangle]
pub extern "C" fn grilla_fijar(indices: *const u32, valores: *const f32, n: u32) {
    let gr = grilla();
    let (is, vs) = unsafe { (std::slice::from_raw_parts(indices, n as usize), std::slice::from_raw_parts(valores, n as usize)) };
    for k in 0..n as usize {
        gr.costos[is[k] as usize] = vs[k];
    }
}

fn libre(gr: &Grilla, c: i64, f: i64) -> bool {
    if c < 0 || f < 0 || c >= gr.tam as i64 || f >= gr.tam as i64 {
        return false;
    }
    let k = gr.costos[f as usize * gr.tam + c as usize];
    k > 0.0 && k.is_finite()
}

fn heur(c1: i64, f1: i64, c2: i64, f2: i64) -> f32 {
    let dx = (c1 - c2).abs() as f32;
    let dy = (f1 - f2).abs() as f32;
    dx + dy + (std::f32::consts::SQRT_2 - 2.0) * dx.min(dy)
}

fn subir(m: &mut Vec<(f32, u32)>, mut i: usize) {
    while i > 0 {
        let p = (i - 1) / 2;
        if m[p].0 <= m[i].0 {
            break;
        }
        m.swap(p, i);
        i = p;
    }
}

fn bajar(m: &mut Vec<(f32, u32)>, mut i: usize) {
    let n = m.len();
    loop {
        let (l, r) = (2 * i + 1, 2 * i + 2);
        let mut menor = i;
        if l < n && m[l].0 < m[menor].0 {
            menor = l;
        }
        if r < n && m[r].0 < m[menor].0 {
            menor = r;
        }
        if menor == i {
            break;
        }
        m.swap(menor, i);
        i = menor;
    }
}

/// A* de (c0,f0) a (c1,f1). Devuelve la cantidad de celdas del camino (incluye inicio y meta) o -1.
/// La ruta queda en `grilla_ruta()` como pares (c, f) i32.
#[no_mangle]
pub extern "C" fn grilla_camino(c0: i32, f0: i32, c1: i32, f1: i32, max_nodos: u32) -> i32 {
    let gr = grilla();
    let tam = gr.tam;
    if !libre(gr, c0 as i64, f0 as i64) && !(c0 == c1 && f0 == f1) {
        // El inicio puede no ser pisable (TS ya lo resuelve antes); igual se intenta.
    }
    gr.turno = gr.turno.wrapping_add(1);
    if gr.turno == 0 {
        gr.sello.iter_mut().for_each(|s| *s = 0);
        gr.cerrado.iter_mut().for_each(|s| *s = 0);
        gr.turno = 1;
    }
    let turno = gr.turno;
    let ini = f0 as usize * tam + c0 as usize;
    let meta = f1 as usize * tam + c1 as usize;
    gr.monticulo.clear();
    gr.g[ini] = 0.0;
    gr.padre[ini] = -1;
    gr.sello[ini] = turno;
    gr.monticulo.push((heur(c0 as i64, f0 as i64, c1 as i64, f1 as i64), ini as u32));
    let mut expandidos: u32 = 0;
    const DIRS: [(i64, i64); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];
    while let Some(&(_, k)) = gr.monticulo.first() {
        let last = gr.monticulo.pop().unwrap();
        if !gr.monticulo.is_empty() {
            gr.monticulo[0] = last;
            bajar(&mut gr.monticulo, 0);
        }
        let k = k as usize;
        if k == meta {
            gr.ruta.clear();
            let mut c = k as i32;
            while c >= 0 {
                gr.ruta.push(c);
                c = gr.padre[c as usize];
            }
            gr.ruta.reverse();
            let n = gr.ruta.len();
            let mut pares = Vec::with_capacity(n * 2);
            for &i in gr.ruta.iter() {
                pares.push(i % tam as i32);
                pares.push(i / tam as i32);
            }
            gr.ruta = pares;
            return n as i32;
        }
        if gr.cerrado[k] == turno {
            continue;
        }
        gr.cerrado[k] = turno;
        expandidos += 1;
        if expandidos > max_nodos {
            return -1;
        }
        let (c, f) = ((k % tam) as i64, (k / tam) as i64);
        let base = gr.g[k];
        for (d, &(dc, df)) in DIRS.iter().enumerate() {
            let (nc, nf) = (c + dc, f + df);
            if !libre(gr, nc, nf) {
                continue;
            }
            if d >= 4 && !(libre(gr, c + dc, f) && libre(gr, c, f + df)) {
                continue;
            }
            let kv = nf as usize * tam + nc as usize;
            if gr.cerrado[kv] == turno {
                continue;
            }
            let w = gr.costos[kv] * if d >= 4 { std::f32::consts::SQRT_2 } else { 1.0 };
            let nuevo = base + w;
            if gr.sello[kv] != turno || nuevo < gr.g[kv] {
                gr.sello[kv] = turno;
                gr.g[kv] = nuevo;
                gr.padre[kv] = k as i32;
                gr.monticulo.push((nuevo + heur(nc, nf, c1 as i64, f1 as i64), kv as u32));
                let ult = gr.monticulo.len() - 1;
                subir(&mut gr.monticulo, ult);
            }
        }
    }
    -1
}

/// Puntero a la última ruta: pares (c, f) i32.
#[no_mangle]
pub extern "C" fn grilla_ruta() -> *const i32 {
    grilla().ruta.as_ptr()
}

/// Campo de fBm de `tam`×`tam`: out[z*tam+x] = fbm(x/escala + ox, z/escala + oz, semilla, octavas).
#[no_mangle]
pub extern "C" fn campo_fbm(tam: u32, escala: f64, ox: f64, oz: f64, semilla: f64, octavas: u32, out: *mut f32) {
    let t = tam as usize;
    let out = unsafe { std::slice::from_raw_parts_mut(out, t * t) };
    for z in 0..t {
        for x in 0..t {
            out[z * t + x] = fbm(x as f64 / escala + ox, z as f64 / escala + oz, semilla, octavas) as f32;
        }
    }
}
