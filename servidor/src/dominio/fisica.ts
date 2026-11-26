// Física de los cuerpos en el mundo: dos colonos no ocupan el mismo lugar (se apartan con suavidad) y nadie es
// empujado al agua ni dentro de una pared. Quien duerme, está derribado o sentado no se mueve.
import { sentado } from "./asientos.ts";
import { impacto } from "./actividades.ts";
import { destreza } from "./colonos.ts";
import { alturaEn } from "./terreno.ts";
import type { Mundo } from "./mundo.ts";
import type { Colono } from "./tipos.ts";

const RADIO = 0.32;

export function sistemaFisica(m: Mundo, _dt: number): void {
  const celdas = new Map<number, Colono[]>();
  for (const c of m.colonos.values()) {
    if (!c.vivo) continue;
    const k = Math.floor(c.z) * 4096 + Math.floor(c.x);
    (celdas.get(k) ?? celdas.set(k, []).get(k)!).push(c);
  }
  const quieto = (c: Colono): boolean => c.dormido || c.derribado || sentado(c);
  for (const [k, lista] of celdas) {
    const cx = k % 4096, cz = Math.floor(k / 4096);
    for (const a of lista) {
      if (quieto(a)) continue;
      let px = 0, pz = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        for (const b of celdas.get((cz + dz) * 4096 + cx + dx) ?? []) {
          if (b === a) continue;
          let ex = a.x - b.x, ez = a.z - b.z;
          let d = Math.hypot(ex, ez);
          if (d >= RADIO * 2) continue;
          if (d < 1e-4) { const ang = (a.nacio % 628) / 100; ex = Math.cos(ang); ez = Math.sin(ang); d = 1; }
          const empuje = (RADIO * 2 - Math.min(d, RADIO * 2)) * (quieto(b) ? 1 : 0.5);
          px += (ex / d) * empuje;
          pz += (ez / d) * empuje;
        }
      }
      const largo = Math.hypot(px, pz);
      if (largo < 1e-4) continue;
      const tope = Math.min(largo, 0.08) / largo;
      const nx = a.x + px * tope, nz = a.z + pz * tope;
      if (m.pisable(nx, nz)) { a.x = nx; a.z = nz; }
    }
  }
}

// ------------------------------------------------------------ proyectiles

/** Dispara una flecha o una bala hacia (tx, tz): vuela con gravedad y choca con el primero que encuentra. */
export function disparar(m: Mundo, c: Colono, tx: number, tz: number, danio: number, tipo: "flecha" | "bala"): void {
  const vel = tipo === "bala" ? 70 : 26;
  const y0 = alturaEn(m.terreno, c.x, c.z) + 1.4;
  const yt = alturaEn(m.terreno, tx, tz) + 1.0;
  const d = Math.max(0.5, Math.hypot(tx - c.x, tz - c.z));
  // Puntería: el error depende del combate del tirador.
  const error = (tipo === "bala" ? 0.03 : 0.06) * Math.max(0.3, 1.4 - destreza(c, "combate") * 0.4);
  const ang = Math.atan2(tz - c.z, tx - c.x) + m.azar.rango(-error, error);
  const T = d / vel;
  const G = tipo === "bala" ? 2 : 9.8;
  const vy = (yt - y0 + 0.5 * G * T * T) / T * m.azar.rango(0.95, 1.05);
  m.proyectiles.push({ id: m.nuevoId("p"), tipo, de: c.id, tribu: c.tribu, x: c.x, y: y0, z: c.z, vx: Math.cos(ang) * vel, vy, vz: Math.sin(ang) * vel, g: G, danio, vida: 3 });
}

export function sistemaProyectiles(m: Mundo, dt: number): void {
  if (!m.proyectiles.length) return;
  const vivos: typeof m.proyectiles = [];
  for (const p of m.proyectiles) {
    const px = p.x, pz = p.z;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= p.g * dt; p.vida -= dt;
    // ¿Le dio a alguien en el tramo recorrido? (colonos de otro bando y animales)
    let blanco: string | null = null, mejor = Infinity;
    const lx = p.x - px, lz = p.z - pz, l2 = lx * lx + lz * lz || 1;
    const prueba = (id: string, x: number, z: number, r: number, alto: number): void => {
      const u = Math.max(0, Math.min(1, ((x - px) * lx + (z - pz) * lz) / l2));
      const d = Math.hypot(px + lx * u - x, pz + lz * u - z);
      const suelo = alturaEn(m.terreno, x, z);
      if (d < r && p.y > suelo - 0.2 && p.y < suelo + alto && u < mejor) { mejor = u; blanco = id; }
    };
    for (const c of m.colonos.values()) if (c.vivo && c.id !== p.de && c.tribu !== p.tribu && Math.abs(c.x - p.x) < 4 && Math.abs(c.z - p.z) < 4) prueba(c.id, c.x, c.z, 0.45, 1.9);
    for (const b of m.animales.values()) if (Math.abs(b.cuerpo.x - p.x) < 4 && Math.abs(b.cuerpo.y - p.z) < 4) prueba(b.id, b.cuerpo.x, b.cuerpo.y, 0.6, 1.4);
    if (blanco) {
      const tirador = m.colonos.get(p.de);
      if (tirador) impacto(m, tirador, blanco, p.danio);
      continue;
    }
    if (p.vida <= 0 || p.y < alturaEn(m.terreno, p.x, p.z) || !m.pisable(p.x, p.z) && p.y < alturaEn(m.terreno, p.x, p.z) + 2) continue;
    vivos.push(p);
  }
  m.proyectiles.length = 0;
  m.proyectiles.push(...vivos);
}
