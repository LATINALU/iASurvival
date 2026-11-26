# Modelos 3D del juego generados por código (arte propio, low-poly con color por vértice): árboles por especie,
# arbustos, rocas, pasto y flores; construcciones de cada tribu; personajes articulados con apariencia variable
# (piel, pelo, barba, complexión, ropa del color de su tribu) y animales articulados.
class_name Modelos
extends RefCounted

const PIELES := ["#f2d3b5", "#e3b48f", "#c98e64", "#a5704a", "#7c4f32", "#5a3824"]
const COLORES_PELO := ["#1c1512", "#3b2516", "#6b4226", "#a0612f", "#c99a5a", "#e3c98a", "#8a8a8a", "#e8e4dc", "#9c3b22"]
const MADERA := Color(0.45, 0.31, 0.19)
const MADERA_OSCURA := Color(0.3, 0.2, 0.12)
const PIEDRA := Color(0.5, 0.47, 0.42)
const PAJA := Color(0.72, 0.6, 0.33)

static var _cache := {}

static func color_tribu(h: float) -> Color:
	return Color.from_hsv(h, 0.62, 0.72)

static func xf(pos := Vector3.ZERO, rot := Vector3.ZERO, esc := Vector3.ONE) -> Transform3D:
	return Mallas.xf(pos, rot, esc)

# ------------------------------------------------------------------ vegetación y rocas

## Árbol completo por variante (para MultiMesh).
static func arbol(variante: String) -> ArrayMesh:
	var clave := "arbol_" + variante
	if _cache.has(clave):
		return _cache[clave]
	var m := Mallas.new()
	match variante:
		"pino":
			m.cilindro(xf(), 0.16, 0.1, 1.6, 6, MADERA_OSCURA)
			var verde := Color(0.13, 0.3, 0.18)
			for i in 4:
				var y := 1.0 + i * 0.85
				m.cilindro(xf(Vector3(0, y, 0)), 1.35 - i * 0.27, 0.0, 1.5, 8, verde.lightened(i * 0.04))
		"abeto":
			m.cilindro(xf(), 0.14, 0.08, 1.4, 6, MADERA_OSCURA)
			var verde := Color(0.1, 0.25, 0.2)
			for i in 5:
				m.cilindro(xf(Vector3(0, 0.9 + i * 0.75, 0)), 0.95 - i * 0.16, 0.0, 1.2, 7, verde.lightened(i * 0.03))
		"roble":
			m.cilindro(xf(), 0.26, 0.18, 2.0, 7, MADERA)
			m.cilindro(xf(Vector3(0, 1.6, 0), Vector3(0, 0, 0.5)), 0.12, 0.06, 1.1, 5, MADERA)
			var verde := Color(0.23, 0.42, 0.18)
			m.esfera(xf(Vector3(0, 2.9, 0)), 1.5, 8, 5, verde, Vector3(1, 0.8, 1), 0.25, 1)
			m.esfera(xf(Vector3(0.9, 2.5, 0.4)), 0.95, 7, 4, verde.lightened(0.06), Vector3.ONE, 0.25, 2)
			m.esfera(xf(Vector3(-0.8, 2.6, -0.5)), 1.0, 7, 4, verde.darkened(0.05), Vector3.ONE, 0.25, 3)
		"abedul":
			m.cilindro(xf(), 0.13, 0.09, 3.0, 6, Color(0.88, 0.86, 0.8))
			m.caja(xf(Vector3(0, 1.0, 0.11)), Vector3(0.12, 0.05, 0.02), Color(0.15, 0.15, 0.15))
			m.caja(xf(Vector3(0.1, 1.9, 0.0)), Vector3(0.02, 0.06, 0.1), Color(0.15, 0.15, 0.15))
			var verde := Color(0.42, 0.58, 0.22)
			m.esfera(xf(Vector3(0, 3.2, 0)), 0.95, 7, 5, verde, Vector3(1, 1.3, 1), 0.3, 4)
			m.esfera(xf(Vector3(0.4, 2.6, 0.2)), 0.6, 6, 4, verde.lightened(0.08), Vector3.ONE, 0.3, 5)
		"sauce":
			m.cilindro(xf(), 0.24, 0.16, 1.8, 6, MADERA_OSCURA)
			var verde := Color(0.35, 0.48, 0.2)
			m.esfera(xf(Vector3(0, 2.3, 0)), 1.3, 8, 5, verde, Vector3(1.2, 0.7, 1.2), 0.2, 6)
			for k in 7:
				var a := TAU * k / 7.0
				m.cilindro(xf(Vector3(cos(a) * 1.1, 0.7, sin(a) * 1.1)), 0.05, 0.25, 1.6, 4, verde.darkened(0.08), false)
		"cactus":
			var v := Color(0.3, 0.5, 0.25)
			m.cilindro(xf(), 0.22, 0.2, 2.2, 8, v)
			m.esfera(xf(Vector3(0, 2.2, 0)), 0.21, 8, 3, v.lightened(0.05))
			m.cilindro(xf(Vector3(0.2, 0.9, 0), Vector3(0, 0, -PI / 2)), 0.12, 0.12, 0.45, 6, v)
			m.cilindro(xf(Vector3(0.62, 0.9, 0)), 0.12, 0.11, 0.7, 6, v)
			m.cilindro(xf(Vector3(-0.2, 1.3, 0), Vector3(0, 0, PI / 2)), 0.1, 0.1, 0.35, 6, v)
			m.cilindro(xf(Vector3(-0.53, 1.3, 0)), 0.1, 0.09, 0.55, 6, v)
			m.esfera(xf(Vector3(0, 2.4, 0)), 0.09, 5, 2, Color(0.95, 0.55, 0.7))
		"acacia":
			m.cilindro(xf(), 0.16, 0.1, 1.9, 6, MADERA_OSCURA)
			m.cilindro(xf(Vector3(0, 1.6, 0), Vector3(0, 0, 0.6)), 0.08, 0.05, 1.0, 5, MADERA_OSCURA)
			m.cilindro(xf(Vector3(0, 1.6, 0), Vector3(0, 0, -0.6)), 0.08, 0.05, 1.0, 5, MADERA_OSCURA)
			var copa := Color(0.4, 0.5, 0.2)
			m.esfera(xf(Vector3(0, 2.5, 0)), 1.8, 9, 3, copa, Vector3(1, 0.28, 1), 0.2, 11)
		"palmera":
			for k in 6:
				m.cilindro(xf(Vector3(sin(k * 0.3) * 0.15 * k, k * 0.55, 0)), 0.14 - k * 0.01, 0.13 - k * 0.01, 0.56, 6, MADERA.lightened(0.08 * (k % 2)))
			var hoja := Color(0.25, 0.5, 0.18)
			for k in 7:
				var a := TAU * k / 7.0
				m.caja(xf(Vector3(0.75 + cos(a) * 0.8, 3.2, sin(a) * 0.8), Vector3(0, -a, 0.45)), Vector3(1.6, 0.05, 0.4), hoja)
			m.esfera(xf(Vector3(0.8, 3.15, 0)), 0.14, 5, 3, Color(0.4, 0.28, 0.15))
		"jungla":
			m.cilindro(xf(), 0.3, 0.18, 4.5, 7, MADERA_OSCURA)
			for k in 4:
				var a := TAU * k / 4.0
				m.cilindro(xf(Vector3(cos(a) * 0.3, 0, sin(a) * 0.3), Vector3(sin(a) * 0.5, 0, -cos(a) * 0.5)), 0.12, 0.03, 0.8, 4, MADERA_OSCURA)
			var verde := Color(0.12, 0.38, 0.14)
			m.esfera(xf(Vector3(0, 4.8, 0)), 2.0, 9, 4, verde, Vector3(1, 0.55, 1), 0.3, 12)
			m.esfera(xf(Vector3(1.2, 4.2, 0.6)), 1.1, 7, 4, verde.lightened(0.08), Vector3.ONE, 0.3, 13)
			m.esfera(xf(Vector3(-1.1, 4.4, -0.7)), 1.2, 7, 4, verde.darkened(0.05), Vector3.ONE, 0.3, 14)
		"nevado":
			m.cilindro(xf(), 0.14, 0.08, 1.4, 6, MADERA_OSCURA)
			for i in 5:
				m.cilindro(xf(Vector3(0, 0.9 + i * 0.75, 0)), 0.95 - i * 0.16, 0.0, 1.2, 7, Color(0.12, 0.24, 0.2))
				m.cilindro(xf(Vector3(0, 1.35 + i * 0.75, 0)), (0.95 - i * 0.16) * 0.6, 0.0, 0.75, 7, Color(0.92, 0.94, 0.97))
		_:
			return arbol("roble")
	_cache[clave] = m.malla()
	return _cache[clave]

static func tocon() -> ArrayMesh:
	if not _cache.has("tocon"):
		var m := Mallas.new()
		m.cilindro(xf(), 0.24, 0.2, 0.35, 7, MADERA)
		m.cilindro(xf(Vector3(0, 0.35, 0)), 0.2, 0.0, 0.02, 7, Color(0.75, 0.6, 0.4))
		_cache["tocon"] = m.malla()
	return _cache["tocon"]

static func quemado() -> ArrayMesh:
	if not _cache.has("quemado"):
		var m := Mallas.new()
		m.cilindro(xf(), 0.18, 0.06, 1.8, 5, Color(0.12, 0.1, 0.09))
		m.cilindro(xf(Vector3(0, 1.2, 0), Vector3(0, 0, 0.8)), 0.06, 0.02, 0.8, 4, Color(0.12, 0.1, 0.09))
		_cache["quemado"] = m.malla()
	return _cache["quemado"]

static func arbusto(bayas: bool) -> ArrayMesh:
	var clave := "arbusto_%s" % bayas
	if _cache.has(clave):
		return _cache[clave]
	var m := Mallas.new()
	var verde := Color(0.24, 0.4, 0.17)
	m.esfera(xf(Vector3(0, 0.35, 0)), 0.55, 7, 4, verde, Vector3(1, 0.75, 1), 0.3, 7)
	m.esfera(xf(Vector3(0.35, 0.3, 0.15)), 0.35, 6, 3, verde.lightened(0.07), Vector3.ONE, 0.3, 8)
	if bayas:
		for k in 9:
			var a := TAU * k / 9.0
			m.esfera(xf(Vector3(cos(a) * 0.45, 0.3 + (k % 3) * 0.15, sin(a) * 0.45)), 0.07, 4, 2, Color(0.75, 0.1, 0.18))
	_cache[clave] = m.malla()
	return _cache[clave]

static func hierbas() -> ArrayMesh:
	if not _cache.has("hierbas"):
		var m := Mallas.new()
		for k in 7:
			var a := TAU * k / 7.0
			m.cilindro(xf(Vector3(cos(a) * 0.15, 0, sin(a) * 0.15), Vector3(cos(a) * 0.3, 0, sin(a) * 0.3)), 0.06, 0.0, 0.8, 3, Color(0.45, 0.55, 0.22).darkened(0.05 * (k % 3)), false)
		m.esfera(xf(Vector3(0, 0.75, 0)), 0.07, 4, 2, Color(0.85, 0.8, 0.95))
		_cache["hierbas"] = m.malla()
	return _cache["hierbas"]

static func roca(semilla: int) -> ArrayMesh:
	var clave := "roca_%d" % (semilla % 4)
	if _cache.has(clave):
		return _cache[clave]
	var m := Mallas.new()
	m.esfera(xf(Vector3(0, 0.15, 0)), 0.6, 6, 4, PIEDRA, Vector3(1.25, 0.75, 1.0), 0.45, semilla % 4)
	m.esfera(xf(Vector3(0.45, 0.05, 0.2)), 0.3, 5, 3, PIEDRA.darkened(0.08), Vector3.ONE, 0.4, semilla % 4 + 9)
	_cache[clave] = m.malla()
	return _cache[clave]

const COLOR_VETA := {"carbon": Color(0.08, 0.08, 0.09), "cobre": Color(0.85, 0.45, 0.2), "hierro": Color(0.55, 0.3, 0.25), "oro": Color(1.0, 0.82, 0.25), "azufre": Color(0.92, 0.88, 0.3)}

## Roca con vetas de mineral a la vista.
const VETA := {"carbon": Color(0.12, 0.12, 0.13), "cobre": Color(0.8, 0.45, 0.22), "hierro": Color(0.55, 0.36, 0.3), "oro": Color(0.95, 0.78, 0.25), "azufre": Color(0.92, 0.85, 0.25)}

## Yacimiento grande: cantera escalonada ("roca") o mina con boca apuntalada y vetas del mineral.
static func yacimiento(tipo: String) -> ArrayMesh:
	var clave := "yac_" + tipo
	if _cache.has(clave):
		return _cache[clave]
	var m := Mallas.new()
	if tipo == "roca":
		# Cantera: bloques cortados en escalones, sillares sueltos y una grúa de palos.
		for k in 9:
			var a := TAU * k / 9.0
			m.esfera(xf(Vector3(cos(a) * 1.7, 0.5, sin(a) * 1.7)), 0.9, 6, 4, PIEDRA.darkened(0.05 * (k % 3)), Vector3(1.0, 0.9, 0.9), 0.35, k)
		for f in 3:
			var r := 1.6 - f * 0.55
			m.caja(xf(Vector3(0, 0.6 + f * 0.55, 0), Vector3(0, f * 0.4, 0)), Vector3(r * 2.0, 0.55, r * 1.8), PIEDRA.lightened(0.06 * f), 0.08)
		for k in 4:
			m.caja(xf(Vector3(2.6 + (k % 2) * 0.55, 0.22 + int(k / 2) * 0.42, -0.8 + (k % 2) * 0.1)), Vector3(0.5, 0.4, 0.8), PIEDRA.lightened(0.12), 0.05)
		m.cilindro(xf(Vector3(-2.4, 0, 1.4), Vector3(0, 0, -0.15)), 0.07, 0.06, 3.2, 5, MADERA_OSCURA)
		m.cilindro(xf(Vector3(-2.15, 3.0, 1.4), Vector3(0, 0, -PI / 2.6)), 0.05, 0.05, 1.8, 5, MADERA_OSCURA)
	else:
		var veta: Color = VETA.get(tipo, Color(0.5, 0.5, 0.5))
		# Montículo de roca con la boca de la mina apuntalada mirando a +z.
		m.esfera(xf(Vector3(0, 0.7, -0.3)), 2.2, 9, 5, PIEDRA.darkened(0.12), Vector3(1.05, 0.75, 0.95), 0.3, hash(tipo) % 7)
		m.caja(xf(Vector3(0, 0.8, 1.55)), Vector3(1.2, 1.5, 0.3), Color(0.05, 0.05, 0.06))
		for x in [-0.7, 0.7]:
			m.cilindro(xf(Vector3(x, 0, 1.75)), 0.09, 0.09, 1.7, 5, MADERA_OSCURA)
		m.caja(xf(Vector3(0, 1.72, 1.75)), Vector3(1.7, 0.16, 0.18), MADERA_OSCURA)
		for k in 7:
			var a := TAU * k / 7.0 + 0.4
			m.esfera(xf(Vector3(cos(a) * 1.5, 0.5 + (k % 3) * 0.35, sin(a) * 1.2 - 0.3)), 0.22, 5, 3, veta, Vector3(1.2, 0.8, 1.0), 0.3, k)
		# Vagoneta con mineral y rieles.
		m.caja(xf(Vector3(1.6, 0.35, 2.2)), Vector3(0.7, 0.4, 0.9), MADERA)
		m.esfera(xf(Vector3(1.6, 0.6, 2.2)), 0.3, 5, 3, veta, Vector3(1.0, 0.6, 1.3))
		for x in [-0.3, 0.3]:
			m.caja(xf(Vector3(x, 0.04, 2.6)), Vector3(0.06, 0.06, 2.0), Color(0.35, 0.33, 0.32))
	_cache[clave] = m.malla()
	return _cache[clave]

static func mineral(tipo: String) -> ArrayMesh:
	var clave := "mineral_" + tipo
	if _cache.has(clave):
		return _cache[clave]
	var m := Mallas.new()
	var base := PIEDRA.darkened(0.15)
	m.esfera(xf(Vector3(0, 0.25, 0)), 0.75, 7, 4, base, Vector3(1.2, 0.85, 1.0), 0.4, hash(tipo) % 7)
	var col: Color = COLOR_VETA.get(tipo, Color.WHITE)
	for k in 7:
		var a := TAU * k / 7.0
		m.esfera(xf(Vector3(cos(a) * 0.62, 0.3 + (k % 3) * 0.14, sin(a) * 0.5)), 0.14 + (k % 2) * 0.05, 5, 3, col)
	_cache[clave] = m.malla()
	return _cache[clave]

static func pasto() -> ArrayMesh:
	if not _cache.has("pasto"):
		var m := Mallas.new()
		for k in 5:
			var a := TAU * k / 5.0 + 0.3
			m.cilindro(xf(Vector3(cos(a) * 0.07, 0, sin(a) * 0.07), Vector3(cos(a) * 0.35, a, sin(a) * 0.35)), 0.035, 0.0, 0.42, 3, Color(0.38, 0.55, 0.2).lightened(0.05 * (k % 2)), false)
		_cache["pasto"] = m.malla()
	return _cache["pasto"]

static func flor(color: Color) -> ArrayMesh:
	var clave := "flor_" + color.to_html()
	if not _cache.has(clave):
		var m := Mallas.new()
		m.cilindro(xf(), 0.015, 0.015, 0.3, 3, Color(0.3, 0.5, 0.2), false)
		m.esfera(xf(Vector3(0, 0.32, 0)), 0.07, 5, 2, color)
		_cache[clave] = m.malla()
	return _cache[clave]

# ------------------------------------------------------------------ construcciones

static func _mi(malla: Mesh, padre: Node3D, nombre := "") -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = malla
	mi.material_override = Mallas.material()
	if nombre != "":
		mi.name = nombre
	padre.add_child(mi)
	return mi

## Construcción terminada (y su versión "en obra" se arma escalando "Cuerpo" y mostrando "Andamio").
static func estructura(tipo: String, tono: float, edad := 1, radio := 2.0) -> Node3D:
	var raiz := Node3D.new()
	var cuerpo := Node3D.new()
	cuerpo.name = "Cuerpo"
	raiz.add_child(cuerpo)
	var ct := color_tribu(tono)
	var m := Mallas.new()
	if BANCOS.has(tipo):
		_bancos(m, tipo)
	match tipo:
		"fogata":
			for k in 8:
				var a := TAU * k / 8.0
				m.esfera(xf(Vector3(cos(a) * 0.5, 0.08, sin(a) * 0.5)), 0.14, 5, 3, PIEDRA.darkened(0.1 * (k % 2)))
			m.cilindro(xf(Vector3(-0.35, 0.1, 0), Vector3(0, 0, -PI / 2.6)), 0.06, 0.05, 0.8, 5, MADERA_OSCURA)
			m.cilindro(xf(Vector3(0.35, 0.1, 0), Vector3(0, 0, PI / 2.6)), 0.06, 0.05, 0.8, 5, MADERA_OSCURA)
			m.cilindro(xf(Vector3(0, 0.1, -0.35), Vector3(PI / 2.6, 0, 0)), 0.06, 0.05, 0.8, 5, MADERA_OSCURA)
			_mi(m.malla(), cuerpo)
			_fuego(raiz, 1.0)
		"almacen":
			for x in [-1.6, 1.6]:
				for z in [-1.2, 1.2]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.1, 0.09, 2.2, 5, MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.2, 0)), 3.8, 1.0, 3.0, PAJA)
			m.caja(xf(Vector3(0, 0.06, 0)), Vector3(3.4, 0.12, 2.6), MADERA)
			# Montones de leña y piedra.
			for i in 4:
				m.cilindro(xf(Vector3(-1.0 + i * 0.12, 0.25 + (i % 2) * 0.2, -0.6), Vector3(PI / 2, 0, 0)), 0.1, 0.1, 1.1, 5, MADERA.lightened(0.05 * i))
			for i in 5:
				m.esfera(xf(Vector3(0.8 + (i % 3) * 0.25, 0.2 + int(i / 3) * 0.22, 0.5)), 0.17, 5, 3, PIEDRA)
			m.caja(xf(Vector3(0.0, 0.35, 0.6)), Vector3(0.6, 0.5, 0.5), MADERA.darkened(0.1), 0.3)
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(1.9, 0, 1.4))
		"choza":
			for k in 10:
				var a := TAU * k / 10.0
				m.cilindro(xf(Vector3(cos(a) * 1.5, 0, sin(a) * 1.5)), 0.13, 0.12, 1.6, 5, MADERA.darkened(0.05 * (k % 2)))
				# Pared de barro y ramas entre poste y poste (el tramo de la puerta queda abierto).
				if k != 2:
					var a2 := TAU * (k + 0.5) / 10.0
					var largo := 2.0 * 1.5 * sin(PI / 10.0)
					m.caja(xf(Vector3(cos(a2) * 1.43, 0.72, sin(a2) * 1.43), Vector3(0, -a2 + PI / 2, 0)), Vector3(largo, 1.44, 0.12), Color(0.55, 0.42, 0.28).darkened(0.06 * (k % 3)), 0.12)
			m.cilindro(xf(Vector3(0, 1.4, 0)), 2.0, 0.1, 1.8, 10, PAJA)
			m.caja(xf(Vector3(0.45, 0.6, 1.5), Vector3(0, -0.5, 0)), Vector3(0.7, 1.2, 0.06), MADERA_OSCURA)
			m.caja(xf(Vector3(0, 1.45, 1.6)), Vector3(1.6, 0.12, 0.08), ct)
			_mi(m.malla(), cuerpo)
		"casa":
			# Casa de piedra: zócalo, muros de sillares, puerta de madera, ventanas con contraventanas, tejado
			# de tejas rojizas y chimenea.
			m.caja(xf(Vector3(0, 0.15, 0)), Vector3(4.8, 0.3, 4.2), PIEDRA.darkened(0.15))
			for fila in 4:
				for lado in [[Vector3(0, 0, -1.9), Vector3(4.4, 0.55, 0.32)], [Vector3(-2.05, 0, 0), Vector3(0.32, 0.55, 3.5)], [Vector3(2.05, 0, 0), Vector3(0.32, 0.55, 3.5)]]:
					m.caja(xf(lado[0] + Vector3(0.0, 0.58 + fila * 0.55, 0)), lado[1], PIEDRA.darkened(0.05 * (fila % 2)), 0.15)
				m.caja(xf(Vector3(-1.35, 0.58 + fila * 0.55, 1.9)), Vector3(1.7, 0.55, 0.32), PIEDRA.darkened(0.05 * (fila % 2)), 0.15)
				m.caja(xf(Vector3(1.35, 0.58 + fila * 0.55, 1.9)), Vector3(1.7, 0.55, 0.32), PIEDRA.darkened(0.05 * (fila % 2)), 0.15)
			m.caja(xf(Vector3(0, 2.05, 1.9)), Vector3(1.0, 0.55, 0.32), PIEDRA, 0.15)
			m.caja(xf(Vector3(0, 0.95, 1.95)), Vector3(0.9, 1.6, 0.08), MADERA_OSCURA)
			m.caja(xf(Vector3(0.3, 0.95, 2.0)), Vector3(0.06, 0.06, 0.04), Color(0.7, 0.65, 0.5))
			for x in [-1.35, 1.35]:
				m.caja(xf(Vector3(x, 1.55, 2.07)), Vector3(0.6, 0.55, 0.04), Color(0.95, 0.82, 0.45))
				m.caja(xf(Vector3(x - 0.42, 1.55, 2.08)), Vector3(0.22, 0.6, 0.05), MADERA)
				m.caja(xf(Vector3(x + 0.42, 1.55, 2.08)), Vector3(0.22, 0.6, 0.05), MADERA)
			m.techo(xf(Vector3(0, 2.5, 0)), 5.2, 1.8, 4.6, Color(0.6, 0.27, 0.18))
			m.caja(xf(Vector3(1.4, 3.4, -0.7)), Vector3(0.5, 1.4, 0.5), PIEDRA.darkened(0.2))
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(2.6, 0, 2.3))
		"huerto":
			m.caja(xf(Vector3(0, 0.05, 0)), Vector3(3.4, 0.1, 2.6), Color(0.33, 0.23, 0.15))
			for x in [-1.75, 1.75]:
				m.caja(xf(Vector3(x, 0.15, 0)), Vector3(0.1, 0.3, 2.7), MADERA)
			for z in [-1.35, 1.35]:
				m.caja(xf(Vector3(0, 0.15, z)), Vector3(3.6, 0.3, 0.1), MADERA)
			for i in 4:
				m.caja(xf(Vector3(0, 0.12, -0.9 + i * 0.6)), Vector3(3.0, 0.08, 0.25), Color(0.25, 0.17, 0.1))
			_mi(m.malla(), cuerpo)
			var plantas := Node3D.new()
			plantas.name = "Cultivo"
			var pm := Mallas.new()
			for i in 4:
				for j in 6:
					var p := Vector3(-1.25 + j * 0.5, 0.12, -0.9 + i * 0.6)
					pm.cilindro(xf(p), 0.06, 0.0, 0.5, 4, Color(0.3, 0.55, 0.2), false)
					pm.esfera(xf(p + Vector3(0, 0.45, 0)), 0.1, 5, 2, Color(0.85, 0.55, 0.15))
			_mi(pm.malla(), plantas)
			cuerpo.add_child(plantas)
		"cocina":
			m.cilindro(xf(), 1.0, 0.85, 0.5, 8, PIEDRA)
			m.esfera(xf(Vector3(0, 0.5, 0)), 0.9, 8, 4, PIEDRA.lightened(0.05), Vector3(1, 0.8, 1))
			m.caja(xf(Vector3(0, 0.45, 0.82)), Vector3(0.5, 0.4, 0.2), Color(0.1, 0.07, 0.05))
			m.cilindro(xf(Vector3(0.3, 1.0, -0.3)), 0.15, 0.13, 0.9, 6, PIEDRA.darkened(0.15))
			_mi(m.malla(), cuerpo)
			_fuego(raiz, 0.45, Vector3(0, 0.45, 0.75))
		"taller":
			for x in [-1.4, 1.4]:
				for z in [-1.0, 1.0]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.09, 0.08, 2.0, 5, MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.0, 0)), 3.4, 0.8, 2.6, MADERA.darkened(0.1))
			m.caja(xf(Vector3(0, 0.45, 0)), Vector3(1.8, 0.12, 0.8), MADERA)
			m.caja(xf(Vector3(-0.7, 0.2, 0)), Vector3(0.12, 0.4, 0.6), MADERA_OSCURA)
			m.caja(xf(Vector3(0.7, 0.2, 0)), Vector3(0.12, 0.4, 0.6), MADERA_OSCURA)
			m.cilindro(xf(Vector3(1.0, 0, 0.8)), 0.3, 0.28, 0.6, 7, MADERA)
			m.caja(xf(Vector3(0.2, 0.56, 0.1)), Vector3(0.5, 0.06, 0.1), Color(0.6, 0.6, 0.62))
			_mi(m.malla(), cuerpo)
		"totem":
			m.cilindro(xf(), 0.35, 0.3, 3.2, 8, MADERA)
			for i in 3:
				m.caja(xf(Vector3(0, 0.8 + i * 0.9, 0.28)), Vector3(0.5, 0.18, 0.1), ct.darkened(0.1 * i))
				m.caja(xf(Vector3(0.12, 1.05 + i * 0.9, 0.3)), Vector3(0.08, 0.08, 0.05), Color(0.95, 0.9, 0.7))
				m.caja(xf(Vector3(-0.12, 1.05 + i * 0.9, 0.3)), Vector3(0.08, 0.08, 0.05), Color(0.95, 0.9, 0.7))
			m.caja(xf(Vector3(0, 3.0, 0)), Vector3(1.6, 0.2, 0.25), ct)
			m.cilindro(xf(Vector3(0, 3.2, 0)), 0.3, 0.0, 0.6, 6, ct.lightened(0.15))
			_mi(m.malla(), cuerpo)
		"torre":
			for x in [-0.9, 0.9]:
				for z in [-0.9, 0.9]:
					m.cilindro(xf(Vector3(x, 0, z), Vector3(-z * 0.05, 0, x * 0.05)), 0.12, 0.1, 4.2, 5, MADERA_OSCURA)
			m.caja(xf(Vector3(0, 4.1, 0)), Vector3(2.3, 0.15, 2.3), MADERA)
			for x in [-1.1, 1.1]:
				m.caja(xf(Vector3(x, 4.5, 0)), Vector3(0.1, 0.7, 2.3), MADERA.darkened(0.1))
			m.caja(xf(Vector3(0, 4.5, 1.1)), Vector3(2.3, 0.7, 0.1), MADERA.darkened(0.1))
			m.techo(xf(Vector3(0, 5.2, 0)), 2.8, 1.0, 2.8, PAJA)
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(0, 5.6, 0), 1.2)
		"empalizada":
			for i in 5:
				m.cilindro(xf(Vector3(-1.0 + i * 0.5, 0, 0)), 0.17, 0.15, 2.0 + (i % 2) * 0.25, 6, MADERA.darkened(0.05 * (i % 2)))
				m.cilindro(xf(Vector3(-1.0 + i * 0.5, 2.0 + (i % 2) * 0.25, 0)), 0.15, 0.0, 0.35, 6, MADERA_OSCURA)
			m.caja(xf(Vector3(0, 1.1, 0.16)), Vector3(2.6, 0.12, 0.08), MADERA_OSCURA)
			_mi(m.malla(), cuerpo)
		"pozo":
			m.cilindro(xf(), 0.9, 0.9, 0.75, 10, PIEDRA)
			m.cilindro(xf(Vector3(0, 0.74, 0)), 0.72, 0.72, 0.02, 10, Color(0.15, 0.3, 0.4))
			for x in [-0.8, 0.8]:
				m.cilindro(xf(Vector3(x, 0.7, 0)), 0.06, 0.06, 1.3, 5, MADERA_OSCURA)
			m.cilindro(xf(Vector3(-0.85, 1.9, 0), Vector3(0, 0, -PI / 2)), 0.05, 0.05, 1.7, 5, MADERA)
			m.techo(xf(Vector3(0, 1.95, 0)), 2.0, 0.6, 1.2, PAJA)
			m.cilindro(xf(Vector3(0, 1.0, 0)), 0.16, 0.14, 0.25, 6, MADERA)
			_mi(m.malla(), cuerpo)
		"circulo":
			for k in 7:
				var a := TAU * k / 7.0
				m.esfera(xf(Vector3(cos(a) * 1.7, 0.45, sin(a) * 1.7), Vector3(0, -a, 0)), 0.35, 6, 4, PIEDRA.darkened(0.05 * (k % 3)), Vector3(0.9, 1.6 + (k % 2) * 0.4, 0.7), 0.3, k)
			m.esfera(xf(Vector3(0, 0.08, 0)), 0.3, 6, 3, Color(0.25, 0.22, 0.2))
			_mi(m.malla(), cuerpo)
		"cabana":
			# Cabaña de troncos apilados, puerta, ventana y techo de tablas.
			for fila in 6:
				for lado in [[Vector3(0, 0, -1.7), Vector3(3.8, 0, 0), PI / 2], [Vector3(0, 0, 1.7), Vector3(3.8, 0, 0), PI / 2]]:
					m.cilindro(xf(lado[0] + Vector3(-1.9, 0.2 + fila * 0.36, 0), Vector3(0, 0, -PI / 2)), 0.18, 0.18, 3.8, 6, MADERA.darkened(0.06 * (fila % 2)), false)
				m.cilindro(xf(Vector3(-1.75, 0.2 + fila * 0.36 + 0.18, -1.9), Vector3(PI / 2, 0, 0)), 0.18, 0.18, 3.8, 6, MADERA.lightened(0.04 * (fila % 2)), false)
				m.cilindro(xf(Vector3(1.75, 0.2 + fila * 0.36 + 0.18, -1.9), Vector3(PI / 2, 0, 0)), 0.18, 0.18, 3.8, 6, MADERA.lightened(0.04 * (fila % 2)), false)
			m.caja(xf(Vector3(1.78, 0.85, 0.0)), Vector3(0.08, 1.5, 0.8), MADERA_OSCURA)
			m.caja(xf(Vector3(-1.78, 1.3, 0.5)), Vector3(0.08, 0.5, 0.6), Color(0.95, 0.82, 0.45))
			m.techo(xf(Vector3(0, 2.35, 0), Vector3(0, PI / 2, 0)), 4.5, 1.5, 4.4, MADERA_OSCURA.lightened(0.1))
			m.caja(xf(Vector3(0.9, 3.0, -0.8)), Vector3(0.4, 1.0, 0.4), PIEDRA)
			_mi(m.malla(), cuerpo)
		"casa_grande":
			# Dos pisos: planta baja de piedra, planta alta de madera con balcón, gran tejado.
			m.caja(xf(Vector3(0, 0.15, 0)), Vector3(6.2, 0.3, 5.2), PIEDRA.darkened(0.15))
			m.caja(xf(Vector3(0, 1.35, 0)), Vector3(5.8, 2.1, 4.8), PIEDRA, 0.2)
			m.caja(xf(Vector3(0, 3.35, 0)), Vector3(6.2, 1.9, 5.2), Color(0.85, 0.78, 0.62), 0.15)
			for x in [-2.9, -1.0, 1.0, 2.9]:
				m.caja(xf(Vector3(x, 3.35, 2.62)), Vector3(0.18, 1.9, 0.08), MADERA_OSCURA)
			m.caja(xf(Vector3(0, 2.45, 2.62)), Vector3(6.2, 0.15, 0.08), MADERA_OSCURA)
			m.caja(xf(Vector3(0, 1.0, 2.43)), Vector3(1.1, 1.8, 0.08), MADERA_OSCURA)
			for x in [-2.0, 2.0]:
				m.caja(xf(Vector3(x, 1.5, 2.43)), Vector3(0.7, 0.6, 0.05), Color(0.95, 0.82, 0.45))
				m.caja(xf(Vector3(x, 3.4, 2.65)), Vector3(0.7, 0.7, 0.05), Color(0.95, 0.82, 0.45))
			m.caja(xf(Vector3(0, 2.6, 3.0)), Vector3(2.6, 0.12, 0.8), MADERA)
			m.caja(xf(Vector3(0, 2.9, 3.38)), Vector3(2.6, 0.45, 0.06), MADERA_OSCURA)
			m.techo(xf(Vector3(0, 4.3, 0)), 6.8, 2.2, 5.8, Color(0.5, 0.22, 0.15))
			m.caja(xf(Vector3(-2.0, 5.3, -1.0)), Vector3(0.55, 1.6, 0.55), PIEDRA.darkened(0.2))
			m.caja(xf(Vector3(2.0, 5.3, -1.0)), Vector3(0.55, 1.6, 0.55), PIEDRA.darkened(0.2))
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(3.3, 0, 2.8), 3.4)
		"centro":
			# Centro urbano: gran salón de piedra con zócalo, pórtico de columnas, tejado de dos aguas, campana y estandarte.
			m.caja(xf(Vector3(0, 0.2, 0)), Vector3(6.6, 0.4, 5.8), PIEDRA.darkened(0.18))
			m.caja(xf(Vector3(0, 1.75, -0.3)), Vector3(6.0, 2.7, 4.6), PIEDRA.lightened(0.04), 0.15)
			for x in [-2.9, -1.0, 1.0, 2.9]:
				m.cilindro(xf(Vector3(x, 0.4, 2.45)), 0.22, 0.2, 2.6, 8, Color(0.85, 0.82, 0.74))
			m.caja(xf(Vector3(0, 3.05, 2.45)), Vector3(6.4, 0.3, 0.5), PIEDRA.lightened(0.1))
			m.caja(xf(Vector3(0, 1.3, 2.05)), Vector3(1.3, 2.2, 0.1), MADERA_OSCURA)
			m.caja(xf(Vector3(0, 1.3, 2.1)), Vector3(0.08, 2.0, 0.04), Color(0.6, 0.5, 0.3))
			for x in [-2.1, 2.1]:
				m.caja(xf(Vector3(x, 1.8, 2.04)), Vector3(0.9, 0.9, 0.06), Color(0.95, 0.82, 0.45))
			m.techo(xf(Vector3(0, 3.2, 0)), 7.0, 2.2, 6.2, Color(0.52, 0.24, 0.16))
			# Torre de la campana.
			m.caja(xf(Vector3(-2.2, 4.4, -1.6)), Vector3(1.3, 2.6, 1.3), PIEDRA)
			m.cilindro(xf(Vector3(-2.2, 5.7, -1.6)), 1.0, 0.0, 1.2, 4, Color(0.45, 0.2, 0.14))
			m.cilindro(xf(Vector3(-2.2, 4.7, -1.6)), 0.25, 0.32, 0.45, 8, Color(0.7, 0.55, 0.25))
			# Escalones.
			for k in 2:
				m.caja(xf(Vector3(0, 0.1 + k * 0.15, 3.2 - k * 0.3)), Vector3(2.4 - k * 0.4, 0.15, 0.6), PIEDRA.lightened(0.08))
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(2.8, 0, 3.0), 4.2)
		"campamento_maderero":
			# Cobertizo abierto con troncos apilados, caballete de serrar y hacha clavada en un tocón.
			for x in [-1.5, 1.5]:
				for z in [-1.0, 1.0]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.1, 0.09, 2.3, 5, MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.3, 0)), 3.6, 0.9, 2.7, MADERA.lightened(0.05))
			for f in 3:
				for k in 4 - f:
					m.cilindro(xf(Vector3(-1.0 + k * 0.42 + f * 0.21, 0.2 + f * 0.36, 0.2), Vector3(PI / 2, 0, 0)), 0.18, 0.18, 1.8, 7, MADERA.darkened(0.04 * ((k + f) % 3)))
			m.caja(xf(Vector3(1.6, 0.45, 1.7)), Vector3(1.2, 0.08, 0.12), MADERA)
			for x in [1.15, 2.05]:
				m.caja(xf(Vector3(x, 0.22, 1.7), Vector3(0, 0, 0.3)), Vector3(0.06, 0.5, 0.3), MADERA_OSCURA)
			m.cilindro(xf(Vector3(-1.8, 0, 1.7)), 0.3, 0.3, 0.45, 8, MADERA)
			m.caja(xf(Vector3(-1.8, 0.62, 1.7), Vector3(0, 0, 0.4)), Vector3(0.05, 0.4, 0.05), MADERA_OSCURA)
			m.caja(xf(Vector3(-1.72, 0.5, 1.7)), Vector3(0.18, 0.12, 0.03), Color(0.55, 0.55, 0.58))
			_mi(m.malla(), cuerpo)
		"campamento_minero":
			# Cobertizo con carretilla, cestos de mineral, montón de piedra y picos colgados.
			for x in [-1.5, 1.5]:
				for z in [-1.0, 1.0]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.1, 0.09, 2.2, 5, MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.2, 0)), 3.6, 0.8, 2.7, Color(0.4, 0.36, 0.3))
			for k in 6:
				m.esfera(xf(Vector3(-0.8 + (k % 3) * 0.5, 0.25 + int(k / 3) * 0.3, -0.3)), 0.28, 5, 3, PIEDRA.darkened(0.05 * (k % 3)))
			for k in 2:
				m.cilindro(xf(Vector3(0.6 + k * 0.6, 0, 0.5)), 0.25, 0.3, 0.5, 8, PAJA.darkened(0.2))
				m.esfera(xf(Vector3(0.6 + k * 0.6, 0.5, 0.5)), 0.22, 5, 3, [Color(0.8, 0.45, 0.22), Color(0.2, 0.2, 0.22)][k])
			m.caja(xf(Vector3(1.9, 0.35, 1.6)), Vector3(0.7, 0.35, 1.0), MADERA)
			m.cilindro(xf(Vector3(1.9, 0.15, 2.2), Vector3(0, 0, PI / 2)), 0.16, 0.16, 0.08, 8, MADERA_OSCURA)
			for k in 2:
				m.caja(xf(Vector3(-1.45, 1.3, -0.4 + k * 0.5), Vector3(0, 0, 0.2)), Vector3(0.05, 0.7, 0.05), MADERA_OSCURA)
				m.caja(xf(Vector3(-1.4, 1.62, -0.4 + k * 0.5)), Vector3(0.4, 0.06, 0.05), Color(0.55, 0.55, 0.58))
			_mi(m.malla(), cuerpo)
		"molino":
			# Torre de piedra cónica, techo de paja, puerta y aspas de madera con lona.
			m.cilindro(xf(Vector3(0, 0, 0)), 1.9, 1.4, 4.2, 10, PIEDRA.lightened(0.06))
			m.cilindro(xf(Vector3(0, 4.2, 0)), 1.7, 0.1, 1.8, 10, PAJA)
			m.caja(xf(Vector3(0, 0.8, 1.8)), Vector3(0.8, 1.5, 0.12), MADERA_OSCURA)
			m.caja(xf(Vector3(0.9, 2.6, 1.4)), Vector3(0.45, 0.5, 0.08), Color(0.95, 0.82, 0.45))
			for k in 4:
				var a := TAU * k / 4.0 + 0.4
				var p := Vector3(cos(a) * 1.6, 3.6 + sin(a) * 1.6, 1.75)
				m.caja(xf(Vector3(0, 3.6, 1.75) + (p - Vector3(0, 3.6, 1.75)) * 0.5, Vector3(0, 0, a)), Vector3(3.2, 0.08, 0.06), MADERA)
				m.caja(xf(Vector3(0, 3.6, 1.78) + (p - Vector3(0, 3.6, 1.75)) * 0.62, Vector3(0, 0, a)), Vector3(1.8, 0.45, 0.02), Color(0.88, 0.84, 0.74))
			m.cilindro(xf(Vector3(0, 3.6, 1.6), Vector3(PI / 2, 0, 0)), 0.15, 0.15, 0.3, 8, MADERA_OSCURA)
			for k in 3:
				_saco(m, Vector3(-1.9 + k * 0.45, 0, 1.4))
			_mi(m.malla(), cuerpo)
		"cuartel":
			# Cuartel: nave larga de madera con patio de armas, estacas de práctica y estante de lanzas.
			m.caja(xf(Vector3(0, 0.15, -0.8)), Vector3(5.6, 0.3, 3.0), PIEDRA.darkened(0.15))
			m.caja(xf(Vector3(0, 1.3, -0.8)), Vector3(5.2, 2.2, 2.6), MADERA, 0.12)
			for x in [-2.0, -0.7, 0.7, 2.0]:
				m.caja(xf(Vector3(x, 1.3, 0.52)), Vector3(0.18, 2.2, 0.06), MADERA_OSCURA)
			m.caja(xf(Vector3(0, 0.95, 0.52)), Vector3(1.0, 1.7, 0.08), MADERA_OSCURA.darkened(0.2))
			m.techo(xf(Vector3(0, 2.4, -0.8)), 5.8, 1.3, 3.2, PAJA)
			for x in [-1.8, 0.0, 1.8]:
				m.cilindro(xf(Vector3(x, 0, 2.2)), 0.12, 0.12, 1.6, 6, MADERA)
				m.cilindro(xf(Vector3(x, 1.2, 2.2), Vector3(0, 0, PI / 2)), 0.06, 0.06, 0.8, 5, MADERA)
				m.esfera(xf(Vector3(x, 1.75, 2.2)), 0.16, 6, 3, PAJA)
			m.caja(xf(Vector3(2.9, 0.9, 1.4)), Vector3(0.1, 1.8, 1.0), MADERA_OSCURA)
			for k in 4:
				m.cilindro(xf(Vector3(2.85, 0.1, 1.0 + k * 0.25), Vector3(0, 0, 0.12)), 0.025, 0.025, 2.0, 4, MADERA)
				m.cilindro(xf(Vector3(2.62, 2.05, 1.0 + k * 0.25), Vector3(0, 0, 0.12)), 0.05, 0.0, 0.2, 4, Color(0.6, 0.6, 0.62))
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(-2.8, 0, 0.8), 3.4)
		"galeria":
			# Galería de tiro: cobertizo con mostradores, dianas de paja en fila y carcaj.
			for x in [-2.4, 2.4]:
				for z in [-1.0, 1.0]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.12, 0.11, 2.4, 6, MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.4, 0)), 5.4, 1.0, 2.8, PAJA)
			m.caja(xf(Vector3(0, 0.9, 1.0)), Vector3(4.8, 0.1, 0.4), MADERA)
			for k in 3:
				var x := -1.8 + k * 1.8
				m.cilindro(xf(Vector3(x, 0, -2.6)), 0.06, 0.06, 1.2, 4, MADERA_OSCURA)
				m.cilindro(xf(Vector3(x, 1.3, -2.5), Vector3(PI / 2, 0, 0)), 0.5, 0.5, 0.15, 12, PAJA)
				m.cilindro(xf(Vector3(x, 1.3, -2.42), Vector3(PI / 2, 0, 0)), 0.3, 0.3, 0.02, 10, Color(0.85, 0.25, 0.2))
				m.cilindro(xf(Vector3(x, 1.3, -2.4), Vector3(PI / 2, 0, 0)), 0.1, 0.1, 0.02, 8, Color(0.95, 0.9, 0.8))
			m.cilindro(xf(Vector3(1.5, 0.95, 1.0)), 0.08, 0.08, 0.5, 6, Color(0.45, 0.3, 0.18))
			_mi(m.malla(), cuerpo)
		"mercado":
			# Mercado: puestos con toldos de colores, cajas de frutas, telas y ánforas.
			var toldos := [Color(0.85, 0.3, 0.25), Color(0.25, 0.5, 0.8), Color(0.9, 0.75, 0.25), Color(0.35, 0.65, 0.35)]
			for k in 4:
				var a := TAU * k / 4.0 + PI / 4
				var p := Vector3(cos(a) * 1.9, 0, sin(a) * 1.9)
				for d in [Vector3(-0.6, 0, -0.4), Vector3(0.6, 0, -0.4), Vector3(-0.6, 0, 0.4), Vector3(0.6, 0, 0.4)]:
					m.cilindro(xf(p + d), 0.05, 0.05, 1.9, 4, MADERA_OSCURA)
				m.caja(xf(p + Vector3(0, 1.95, 0), Vector3(0.15, -a, 0)), Vector3(1.5, 0.05, 1.1), toldos[k])
				m.caja(xf(p + Vector3(0, 0.75, 0)), Vector3(1.3, 0.1, 0.8), MADERA)
				for j in 3:
					m.esfera(xf(p + Vector3(-0.4 + j * 0.4, 0.88, 0)), 0.12, 5, 3, [Color(0.85, 0.2, 0.2), Color(0.95, 0.7, 0.2), Color(0.4, 0.7, 0.25)][j])
			for k in 3:
				m.cilindro(xf(Vector3(-0.4 + k * 0.4, 0, 0)), 0.18, 0.12, 0.6, 8, Color(0.7, 0.42, 0.28))
			_mi(m.malla(), cuerpo)
		"templo":
			# Templo: escalinata, columnas, frontón y llama sagrada en el altar.
			for k in 3:
				m.caja(xf(Vector3(0, 0.15 + k * 0.3, 0)), Vector3(6.0 - k * 0.5, 0.3, 5.0 - k * 0.5), Color(0.85, 0.82, 0.75).darkened(0.05 * k))
			for x in [-2.0, -0.7, 0.7, 2.0]:
				for z in [-1.6, 1.6]:
					m.cilindro(xf(Vector3(x, 0.9, z)), 0.24, 0.22, 2.6, 10, Color(0.92, 0.9, 0.84))
			m.caja(xf(Vector3(0, 1.9, -0.2)), Vector3(3.6, 2.0, 2.4), Color(0.88, 0.85, 0.78))
			m.caja(xf(Vector3(0, 3.6, 0)), Vector3(5.2, 0.3, 4.0), Color(0.82, 0.8, 0.72))
			m.techo(xf(Vector3(0, 3.75, 0)), 5.4, 1.2, 4.2, Color(0.62, 0.3, 0.2))
			m.cilindro(xf(Vector3(0, 0.9, 2.1)), 0.35, 0.3, 0.6, 8, PIEDRA.lightened(0.1))
			_mi(m.malla(), cuerpo)
			_fuego(raiz, 0.5, Vector3(0, 1.5, 2.1))
		"universidad":
			# Universidad: edificio de dos alas, cúpula central, ventanales y escalera.
			m.caja(xf(Vector3(0, 0.2, 0)), Vector3(7.0, 0.4, 5.4), PIEDRA.darkened(0.12))
			for x in [-2.3, 2.3]:
				m.caja(xf(Vector3(x, 1.8, 0)), Vector3(2.4, 2.8, 4.6), Color(0.82, 0.76, 0.64), 0.1)
				m.techo(xf(Vector3(x, 3.2, 0), Vector3(0, PI / 2, 0)), 4.9, 1.1, 2.7, Color(0.38, 0.4, 0.45))
				for k in 3:
					m.caja(xf(Vector3(x - 0.7 + k * 0.7, 2.0, 2.32)), Vector3(0.4, 1.0, 0.05), Color(0.95, 0.85, 0.55))
			m.caja(xf(Vector3(0, 2.2, 0)), Vector3(2.4, 3.6, 3.4), Color(0.88, 0.82, 0.7))
			m.esfera(xf(Vector3(0, 4.0, 0)), 1.25, 12, 6, Color(0.45, 0.55, 0.62), Vector3(1, 0.85, 1))
			m.cilindro(xf(Vector3(0, 5.0, 0)), 0.08, 0.0, 0.8, 6, Color(0.8, 0.7, 0.3))
			m.caja(xf(Vector3(0, 1.1, 1.72)), Vector3(1.1, 1.9, 0.08), MADERA_OSCURA)
			_mi(m.malla(), cuerpo)
		"castillo":
			# Castillo: muralla cuadrada con almenas, cuatro torres con tejado cónico y torre del homenaje.
			var piedra_c := PIEDRA.lightened(0.05)
			for lado in [[Vector3(0, 0, -3.4), Vector3(7.0, 3.0, 0.6)], [Vector3(0, 0, 3.4), Vector3(7.0, 3.0, 0.6)], [Vector3(-3.4, 0, 0), Vector3(0.6, 3.0, 7.0)], [Vector3(3.4, 0, 0), Vector3(0.6, 3.0, 7.0)]]:
				m.caja(xf(lado[0] + Vector3(0, 1.5, 0)), lado[1], piedra_c, 0.12)
				var largo: float = maxf(lado[1].x, lado[1].z)
				for k in int(largo / 0.8):
					var off := -largo / 2.0 + 0.4 + k * 0.8
					var pos: Vector3 = lado[0] + (Vector3(off, 3.2, 0) if lado[1].x > lado[1].z else Vector3(0, 3.2, off))
					if k % 2 == 0:
						m.caja(xf(pos), Vector3(0.45, 0.4, 0.62), piedra_c.darkened(0.05))
			for x in [-3.4, 3.4]:
				for z in [-3.4, 3.4]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.95, 0.9, 4.2, 10, piedra_c.darkened(0.04))
					m.cilindro(xf(Vector3(x, 4.2, z)), 1.1, 0.0, 1.6, 10, Color(0.42, 0.22, 0.16))
			m.caja(xf(Vector3(0, 2.6, -0.6)), Vector3(3.0, 5.2, 3.0), piedra_c.darkened(0.02), 0.12)
			m.cilindro(xf(Vector3(0, 5.2, -0.6)), 2.0, 0.0, 1.8, 4, Color(0.42, 0.22, 0.16))
			m.caja(xf(Vector3(0, 1.1, 3.72)), Vector3(1.4, 2.2, 0.1), MADERA_OSCURA)
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(0, 7.0, -0.6), 2.6)
		"maravilla":
			# Maravilla: zigurat escalonado con escalinata, obelisco dorado y braseros.
			for k in 6:
				var lado := 10.0 - k * 1.5
				m.caja(xf(Vector3(0, 0.6 + k * 1.2, 0)), Vector3(lado, 1.2, lado), Color(0.86, 0.8, 0.66).darkened(0.04 * (k % 2)), 0.06)
			m.caja(xf(Vector3(0, 3.6, 4.2), Vector3(-0.85, 0, 0)), Vector3(2.0, 0.3, 8.6), Color(0.8, 0.74, 0.6))
			m.cilindro(xf(Vector3(0, 7.2, 0)), 0.5, 0.15, 4.0, 4, Color(0.92, 0.78, 0.3))
			m.cilindro(xf(Vector3(0, 11.2, 0)), 0.15, 0.0, 0.6, 4, Color(0.98, 0.9, 0.5))
			for x in [-4.6, 4.6]:
				m.cilindro(xf(Vector3(x, 0, 5.2)), 0.35, 0.25, 1.2, 8, PIEDRA)
			_mi(m.malla(), cuerpo)
			_fuego(raiz, 0.45, Vector3(-4.6, 1.3, 5.2))
			_fuego(raiz, 0.45, Vector3(4.6, 1.3, 5.2))
		"granero":
			m.caja(xf(Vector3(0, 1.3, 0)), Vector3(4.0, 2.6, 3.2), Color(0.55, 0.22, 0.16), 0.2)
			m.techo(xf(Vector3(0, 2.6, 0)), 4.5, 1.6, 3.6, Color(0.35, 0.3, 0.28))
			m.caja(xf(Vector3(0, 1.0, 1.62)), Vector3(1.6, 2.0, 0.06), Color(0.9, 0.88, 0.82))
			m.caja(xf(Vector3(0, 1.0, 1.66)), Vector3(1.5, 0.1, 0.04), Color(0.55, 0.22, 0.16))
			for i in 3:
				m.cilindro(xf(Vector3(-2.4, 0, -0.8 + i * 0.8)), 0.35, 0.35, 0.7, 8, PAJA)
			_mi(m.malla(), cuerpo)
		"horno":
			m.cilindro(xf(), 1.2, 0.9, 1.6, 9, PIEDRA.darkened(0.1))
			m.cilindro(xf(Vector3(0, 1.6, 0)), 0.9, 0.45, 1.4, 9, PIEDRA.darkened(0.2))
			m.cilindro(xf(Vector3(0, 3.0, 0)), 0.45, 0.4, 0.6, 7, PIEDRA.darkened(0.25))
			m.caja(xf(Vector3(0, 0.45, 1.05)), Vector3(0.6, 0.5, 0.3), Color(0.12, 0.06, 0.03))
			m.caja(xf(Vector3(1.4, 0.3, 0)), Vector3(0.7, 0.6, 0.9), Color(0.1, 0.1, 0.1), 0.2)
			_mi(m.malla(), cuerpo)
			_fuego(raiz, 0.5, Vector3(0, 0.35, 1.0))
		"forja":
			for x in [-1.6, 1.6]:
				for z in [-1.2, 1.2]:
					m.cilindro(xf(Vector3(x, 0, z)), 0.1, 0.09, 2.4, 5, MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.4, 0)), 3.8, 0.9, 3.0, Color(0.35, 0.3, 0.28))
			m.caja(xf(Vector3(-0.8, 0.5, -0.6)), Vector3(1.2, 1.0, 1.0), PIEDRA.darkened(0.2), 0.2)
			m.caja(xf(Vector3(0.8, 0.35, 0.3)), Vector3(0.35, 0.7, 0.35), MADERA_OSCURA)
			m.caja(xf(Vector3(0.8, 0.78, 0.3)), Vector3(0.8, 0.18, 0.3), Color(0.25, 0.25, 0.27))
			m.cilindro(xf(Vector3(1.2, 0.78, 0.3), Vector3(0, 0, -PI / 2)), 0.08, 0.0, 0.3, 5, Color(0.25, 0.25, 0.27))
			m.cilindro(xf(Vector3(1.4, 0, -0.8)), 0.3, 0.3, 0.6, 8, Color(0.25, 0.35, 0.45))
			_mi(m.malla(), cuerpo)
			_fuego(raiz, 0.45, Vector3(-0.8, 1.0, -0.6))
		"biblioteca":
			m.caja(xf(Vector3(0, 0.2, 0)), Vector3(5.0, 0.4, 4.0), PIEDRA.lightened(0.05))
			for x in [-2.0, -0.7, 0.7, 2.0]:
				m.cilindro(xf(Vector3(x, 0.4, 1.7)), 0.18, 0.16, 2.4, 8, Color(0.88, 0.85, 0.78))
			m.caja(xf(Vector3(0, 1.6, -0.3)), Vector3(4.6, 2.4, 3.0), Color(0.82, 0.78, 0.7), 0.15)
			m.caja(xf(Vector3(0, 1.0, 1.22)), Vector3(1.0, 1.6, 0.06), MADERA_OSCURA)
			m.techo(xf(Vector3(0, 2.8, 0)), 5.4, 1.2, 4.4, Color(0.4, 0.42, 0.45))
			m.caja(xf(Vector3(0, 3.3, 2.2)), Vector3(0.6, 0.6, 0.05), ct)
			_mi(m.malla(), cuerpo)
		"enfermeria":
			m.caja(xf(Vector3(0, 1.2, 0)), Vector3(4.6, 2.4, 3.6), Color(0.9, 0.88, 0.82), 0.12)
			m.techo(xf(Vector3(0, 2.4, 0)), 5.0, 1.2, 4.0, Color(0.45, 0.32, 0.22))
			m.caja(xf(Vector3(0, 1.0, 1.82)), Vector3(1.0, 1.7, 0.06), MADERA)
			m.caja(xf(Vector3(0, 2.15, 1.85)), Vector3(0.6, 0.18, 0.04), Color(0.8, 0.15, 0.15))
			m.caja(xf(Vector3(0, 2.15, 1.85)), Vector3(0.18, 0.6, 0.04), Color(0.8, 0.15, 0.15))
			_mi(m.malla(), cuerpo)
		"portal":
			for x in [-1.3, 1.3]:
				m.cilindro(xf(Vector3(x, 0, 0)), 0.22, 0.2, 3.0, 7, MADERA_OSCURA)
				m.cilindro(xf(Vector3(x, 3.0, 0)), 0.2, 0.0, 0.4, 7, MADERA_OSCURA)
			m.caja(xf(Vector3(0, 2.6, 0)), Vector3(3.0, 0.25, 0.3), MADERA)
			for i in 4:
				m.caja(xf(Vector3(-0.85 + i * 0.57, 1.1, 0.0)), Vector3(0.5, 2.0, 0.12), MADERA.darkened(0.05 * (i % 2)))
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(1.3, 3.0, 0), 1.0)
		"muralla":
			m.caja(xf(Vector3(0, 1.3, 0)), Vector3(2.4, 2.6, 0.9), PIEDRA, 0.2)
			m.caja(xf(Vector3(0, 0.15, 0)), Vector3(2.5, 0.3, 1.1), PIEDRA.darkened(0.2))
			for k in [-0.8, 0.0, 0.8]:
				m.caja(xf(Vector3(k, 2.85, 0)), Vector3(0.5, 0.5, 0.9), PIEDRA.lightened(0.05), 0.2)
			_mi(m.malla(), cuerpo)
		"puerta":
			for x in [-1.6, 1.6]:
				m.caja(xf(Vector3(x, 1.9, 0)), Vector3(1.0, 3.8, 1.2), PIEDRA, 0.2)
				m.caja(xf(Vector3(x, 4.05, 0)), Vector3(1.2, 0.5, 1.4), PIEDRA.lightened(0.05))
			m.caja(xf(Vector3(0, 3.3, 0)), Vector3(2.4, 0.8, 1.2), PIEDRA, 0.2)
			m.caja(xf(Vector3(0, 1.45, 0.1)), Vector3(2.1, 2.9, 0.16), MADERA_OSCURA)
			for i in 5:
				m.caja(xf(Vector3(-0.8 + i * 0.4, 1.45, 0.2)), Vector3(0.06, 2.8, 0.04), Color(0.3, 0.3, 0.32))
			_mi(m.malla(), cuerpo)
			_bandera(raiz, ct, Vector3(1.6, 4.3, 0), 1.3)
		_:
			m.caja(xf(Vector3(0, 0.3, 0)), Vector3(0.8, 0.6, 0.5), MADERA, 0.3)
			_mi(m.malla(), cuerpo)
	# Detalles alrededor de cada construcción (vida de pueblo: barriles, leña, faroles, vallas…).
	var deco := Mallas.new()
	var hay_deco := true
	match tipo:
		"choza":
			_lena(deco, Vector3(1.7, 0, -1.2))
			_barril(deco, Vector3(-1.7, 0, 1.1))
			deco.cilindro(xf(Vector3(0, 3.1, 0)), 0.25, 0.08, 0.35, 6, PAJA.darkened(0.25))
			_valla(deco, Vector3(-2.6, 0, 2.0), Vector3(-1.0, 0, 2.6))
		"cabana":
			for x in [-1.2, 1.2]:
				deco.cilindro(xf(Vector3(2.4, 0, x)), 0.08, 0.08, 2.0, 5, MADERA_OSCURA)
			deco.caja(xf(Vector3(2.4, 2.0, 0)), Vector3(1.4, 0.08, 3.0), MADERA_OSCURA.lightened(0.1))
			deco.caja(xf(Vector3(2.2, 0.06, 0)), Vector3(0.9, 0.12, 2.8), MADERA)
			_barril(deco, Vector3(2.6, 0, 1.0))
			_lena(deco, Vector3(-2.3, 0, -1.0))
			_farol(deco, Vector3(2.35, 1.6, -0.7))
			deco.caja(xf(Vector3(-1.85, 1.0, 0.5)), Vector3(0.15, 0.15, 0.7), Color(0.4, 0.28, 0.15))
			for k in 3:
				deco.esfera(xf(Vector3(-1.9, 1.15, 0.25 + k * 0.25)), 0.07, 4, 2, [Color(0.9, 0.3, 0.3), Color(0.95, 0.85, 0.3), Color(0.7, 0.4, 0.9)][k])
		"casa":
			_valla(deco, Vector3(-3.2, 0, 3.0), Vector3(-1.0, 0, 3.4))
			_valla(deco, Vector3(1.0, 0, 3.4), Vector3(3.2, 0, 3.0))
			_barril(deco, Vector3(2.7, 0, 1.6))
			_caja_madera(deco, Vector3(-2.8, 0, -1.6))
			_farol(deco, Vector3(0.7, 1.8, 2.15))
			_lena(deco, Vector3(-2.9, 0, 0.8))
		"casa_grande":
			_barril(deco, Vector3(3.5, 0, 1.8))
			_barril(deco, Vector3(3.6, 0, 1.0))
			_caja_madera(deco, Vector3(-3.5, 0, 1.8))
			_farol(deco, Vector3(-0.8, 1.9, 2.55))
			_farol(deco, Vector3(0.8, 1.9, 2.55))
			for x in [-2.4, 2.4]:
				deco.caja(xf(Vector3(x, 3.2, 2.7)), Vector3(0.5, 1.3, 0.04), ct)
		"almacen":
			for k in 3:
				_saco(deco, Vector3(-1.2 + k * 0.5, 0, 0.8))
			_barril(deco, Vector3(1.3, 0, -0.6))
			_barril(deco, Vector3(1.0, 0, -0.95))
			_caja_madera(deco, Vector3(0.9, 0, 0.9))
			_caja_madera(deco, Vector3(0.9, 0.5, 0.9))
		"taller":
			deco.caja(xf(Vector3(-1.0, 0.35, 0.9)), Vector3(1.0, 0.1, 0.25), MADERA)
			for x in [-1.4, -0.6]:
				deco.caja(xf(Vector3(x, 0.17, 0.9)), Vector3(0.08, 0.35, 0.25), MADERA_OSCURA)
			_lena(deco, Vector3(1.6, 0, -1.1))
			deco.caja(xf(Vector3(-0.3, 0.56, 0.0)), Vector3(0.3, 0.05, 0.05), Color(0.6, 0.6, 0.62))
			deco.caja(xf(Vector3(0.4, 0.58, -0.1)), Vector3(0.18, 0.08, 0.1), PIEDRA)
		"huerto":
			deco.cilindro(xf(Vector3(1.4, 0, 1.0)), 0.04, 0.04, 1.5, 4, MADERA_OSCURA)
			deco.caja(xf(Vector3(1.4, 1.2, 1.0)), Vector3(0.9, 0.06, 0.06), MADERA_OSCURA)
			deco.esfera(xf(Vector3(1.4, 1.55, 1.0)), 0.16, 5, 3, PAJA)
			deco.caja(xf(Vector3(1.4, 1.15, 1.0)), Vector3(0.45, 0.4, 0.2), Color(0.55, 0.3, 0.25))
			deco.cilindro(xf(Vector3(1.4, 1.65, 1.0)), 0.25, 0.0, 0.18, 6, PAJA.darkened(0.2))
		"forja":
			deco.caja(xf(Vector3(-1.5, 0.35, 0.6)), Vector3(0.5, 0.25, 0.4), Color(0.35, 0.24, 0.14))
			deco.cilindro(xf(Vector3(-1.5, 0.48, 0.6), Vector3(0, 0, -PI / 2)), 0.12, 0.02, 0.4, 5, Color(0.35, 0.24, 0.14))
			_barril(deco, Vector3(1.5, 0, -0.9))
			for k in 3:
				deco.caja(xf(Vector3(0.2 + k * 0.15, 0.85, -0.6)), Vector3(0.05, 0.4, 0.02), Color(0.55, 0.55, 0.58))
		"granero":
			for k in 3:
				deco.cilindro(xf(Vector3(2.4, 0.35, -0.8 + k * 0.8), Vector3(0, 0, PI / 2)), 0.35, 0.35, 0.7, 8, PAJA)
			deco.cilindro(xf(Vector3(-2.1, 0, 1.2), Vector3(-0.3, 0, 0)), 0.04, 0.04, 2.6, 4, MADERA)
			deco.cilindro(xf(Vector3(-1.7, 0, 1.2), Vector3(-0.3, 0, 0)), 0.04, 0.04, 2.6, 4, MADERA)
		"pozo":
			deco.cilindro(xf(Vector3(0.95, 0.75, 0)), 0.16, 0.13, 0.25, 7, MADERA)
			deco.cilindro(xf(Vector3(0, 1.2, 0)), 0.01, 0.01, 0.7, 3, PAJA.darkened(0.4))
		"torre":
			for k in 8:
				deco.caja(xf(Vector3(0.95, 0.3 + k * 0.5, 0.95)), Vector3(0.5, 0.05, 0.08), MADERA)
			deco.cilindro(xf(Vector3(0, 4.2, 0)), 0.3, 0.4, 0.3, 7, Color(0.3, 0.3, 0.32))
			_farol(deco, Vector3(0, 4.55, 0))
		"totem":
			for k in 4:
				var a := TAU * k / 4.0
				deco.caja(xf(Vector3(cos(a) * 0.32, 2.7, sin(a) * 0.32), Vector3(0, -a, 0.3)), Vector3(0.05, 0.45, 0.12), [Color(0.9, 0.2, 0.2), Color(0.95, 0.85, 0.3), Color(0.2, 0.5, 0.9), Color(0.95, 0.95, 0.9)][k])
			for k in 6:
				var a := TAU * k / 6.0
				deco.esfera(xf(Vector3(cos(a) * 0.8, 0.08, sin(a) * 0.8)), 0.12, 5, 2, PIEDRA)
		"circulo":
			for k in 3:
				deco.caja(xf(Vector3(-0.3 + k * 0.3, 0.25, 0.0)), Vector3(0.18, 0.04, 0.24), [Color(0.6, 0.25, 0.2), Color(0.3, 0.4, 0.6), Color(0.5, 0.45, 0.25)][k])
		"biblioteca":
			for x in [-1.8, 1.8]:
				deco.cilindro(xf(Vector3(x, 0.4, 2.3)), 0.05, 0.05, 1.4, 5, MADERA_OSCURA)
				_farol(deco, Vector3(x, 1.85, 2.3))
		"enfermeria":
			for k in 3:
				deco.cilindro(xf(Vector3(-2.6, 0, -1.0 + k * 0.6)), 0.12, 0.12, 0.3, 6, Color(0.4, 0.55, 0.3))
				deco.esfera(xf(Vector3(-2.6, 0.38, -1.0 + k * 0.6)), 0.12, 5, 2, Color(0.35, 0.6, 0.3))
		_:
			hay_deco = false
	if hay_deco:
		_mi(deco.malla(), cuerpo, "Deco")
	# Obra por etapas: cimientos marcados (estacas y cuerdas) con pila de material, y andamio a la medida.
	var r := clampf(radio * 0.85, 0.8, 4.5)
	var anda := Mallas.new()
	var vara := Color(0.6, 0.48, 0.3)
	for x in [-r, 0.0, r]:
		for z in [-r * 0.85, r * 0.85]:
			anda.cilindro(xf(Vector3(x, 0, z)), 0.05, 0.05, 2.6, 4, vara)
	for y in [1.0, 2.0]:
		anda.caja(xf(Vector3(0, y, r * 0.85)), Vector3(r * 2.0 + 0.1, 0.06, 0.08), vara)
		anda.caja(xf(Vector3(0, y, -r * 0.85)), Vector3(r * 2.0 + 0.1, 0.06, 0.08), vara)
		anda.caja(xf(Vector3(r, y, 0)), Vector3(0.08, 0.06, r * 1.7), vara)
		anda.caja(xf(Vector3(-r, y, 0)), Vector3(0.08, 0.06, r * 1.7), vara)
		anda.caja(xf(Vector3(0, y - 0.05, r * 0.85 + 0.25)), Vector3(r * 2.0, 0.04, 0.4), vara.lightened(0.1))
	anda.caja(xf(Vector3(r * 0.2, 1.1, r * 0.85), Vector3(0, 0, 0.6)), Vector3(r * 2.2, 0.05, 0.06), vara)
	var mi_anda := _mi(anda.malla(), raiz, "Andamio")
	mi_anda.visible = false
	var cim := Mallas.new()
	for x in [-r, r]:
		for z in [-r * 0.85, r * 0.85]:
			cim.cilindro(xf(Vector3(x, 0, z)), 0.04, 0.03, 0.5, 4, vara)
	for lado in [[Vector3(0, 0.3, r * 0.85), Vector3(r * 2, 0.02, 0.02)], [Vector3(0, 0.3, -r * 0.85), Vector3(r * 2, 0.02, 0.02)], [Vector3(r, 0.3, 0), Vector3(0.02, 0.02, r * 1.7)], [Vector3(-r, 0.3, 0), Vector3(0.02, 0.02, r * 1.7)]]:
		cim.caja(xf(lado[0]), lado[1], Color(0.85, 0.8, 0.65))
	cim.caja(xf(Vector3(0, 0.04, 0)), Vector3(r * 2, 0.08, r * 1.7), Color(0.45, 0.38, 0.28))
	for k in 3:
		cim.cilindro(xf(Vector3(r + 0.8, 0.15 + k * 0.25, -0.4 + k * 0.1), Vector3(PI / 2, 0, 0)), 0.12, 0.12, 1.4, 6, MADERA)
	for k in 4:
		cim.esfera(xf(Vector3(-r - 0.8 + (k % 2) * 0.35, 0.18 + int(k / 2) * 0.25, 0.3)), 0.2, 5, 3, PIEDRA)
	var mi_cim := _mi(cim.malla(), raiz, "Cimientos")
	mi_cim.visible = false
	if edad > 1:
		_remap_edad(cuerpo, edad)
	return raiz

## Materiales según la edad de la civilización: techos de paja → tejuelas de madera → tejas; muros de madera →
## piedra (Edad del Hierro) → piedra labrada (Pólvora).
static func _remap_edad(nodo: Node, edad: int) -> void:
	for h in nodo.get_children():
		if h is MeshInstance3D and (h as MeshInstance3D).mesh is ArrayMesh:
			var mi := h as MeshInstance3D
			var am := mi.mesh as ArrayMesh
			var nueva := ArrayMesh.new()
			for s in am.get_surface_count():
				var arr := am.surface_get_arrays(s)
				var cols: PackedColorArray = arr[Mesh.ARRAY_COLOR]
				for i in cols.size():
					var c := cols[i]
					if _cerca_color(c, PAJA, 0.13):
						cols[i] = Color(0.44, 0.33, 0.22) if edad == 2 else Color(0.6, 0.27, 0.18).darkened(0.05 * (i % 3))
					elif edad >= 3 and _cerca_color(c, MADERA, 0.035):
						cols[i] = PIEDRA.lightened(0.12 if edad >= 4 else 0.04)
					elif edad >= 4 and _cerca_color(c, PIEDRA, 0.06):
						cols[i] = Color(0.74, 0.7, 0.62)
				arr[Mesh.ARRAY_COLOR] = cols
				nueva.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			mi.mesh = nueva

static func _cerca_color(a: Color, b: Color, tol: float) -> bool:
	return absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) < tol * 3.0

# ------------------------------------------------------------------ utilería de pueblo

## Bancos (mismas posiciones que servidor/src/dominio/asientos.ts → BANCOS).
const BANCOS := {"fogata": [2.3, 4, 0.4], "circulo": [1.25, 3, 0.0], "biblioteca": [3.6, 2, 1.2]}

static func _bancos(m: Mallas, tipo: String) -> void:
	var b: Array = BANCOS[tipo]
	for k in int(b[1]):
		var a := float(b[2]) + TAU * k / float(b[1])
		var c := Vector3(cos(a) * float(b[0]), 0, sin(a) * float(b[0]))
		var giro := atan2(-cos(a), -sin(a))
		var tan := Vector3(-sin(a), 0, cos(a))
		m.caja(xf(c + Vector3(0, 0.4, 0), Vector3(0, giro, 0)), Vector3(1.35, 0.08, 0.4), MADERA.lightened(0.08), 0.15)
		m.caja(xf(c + Vector3(0, 0.355, 0), Vector3(0, giro, 0)), Vector3(1.3, 0.04, 0.34), MADERA_OSCURA)
		for s in [-0.5, 0.5]:
			m.caja(xf(c + tan * s + Vector3(0, 0.18, 0), Vector3(0, giro, 0)), Vector3(0.1, 0.36, 0.32), MADERA_OSCURA)

static func _barril(m: Mallas, p: Vector3) -> void:
	m.cilindro(xf(p), 0.28, 0.3, 0.75, 8, MADERA.lightened(0.05))
	m.cilindro(xf(p + Vector3(0, 0.15, 0)), 0.31, 0.31, 0.05, 8, Color(0.3, 0.3, 0.32), false)
	m.cilindro(xf(p + Vector3(0, 0.55, 0)), 0.31, 0.31, 0.05, 8, Color(0.3, 0.3, 0.32), false)

static func _caja_madera(m: Mallas, p: Vector3) -> void:
	m.caja(xf(p + Vector3(0, 0.25, 0)), Vector3(0.5, 0.5, 0.5), MADERA.lightened(0.1), 0.25)
	m.caja(xf(p + Vector3(0, 0.25, 0.26)), Vector3(0.52, 0.06, 0.02), MADERA_OSCURA)

static func _saco(m: Mallas, p: Vector3) -> void:
	m.esfera(xf(p + Vector3(0, 0.25, 0)), 0.25, 6, 3, Color(0.75, 0.68, 0.5), Vector3(1, 1.2, 0.9))

static func _lena(m: Mallas, p: Vector3) -> void:
	for f in 3:
		for k in 3 - f:
			m.cilindro(xf(p + Vector3(-0.25 + k * 0.25 + f * 0.12, 0.12 + f * 0.2, 0), Vector3(PI / 2, 0, 0)), 0.1, 0.1, 0.9, 6, MADERA.darkened(0.05 * ((k + f) % 3)))

static func _farol(m: Mallas, p: Vector3) -> void:
	m.caja(xf(p), Vector3(0.16, 0.22, 0.16), Color(0.25, 0.22, 0.18))
	m.caja(xf(p), Vector3(0.12, 0.16, 0.17), Color(1.0, 0.8, 0.45))

static func _valla(m: Mallas, a: Vector3, b: Vector3) -> void:
	var largo := a.distance_to(b)
	var n := maxi(2, int(largo / 0.6))
	for k in n + 1:
		var p := a.lerp(b, float(k) / n)
		m.cilindro(xf(p), 0.04, 0.035, 0.7, 4, MADERA_OSCURA)
	var giro := atan2(b.x - a.x, b.z - a.z)
	m.caja(xf((a + b) / 2.0 + Vector3(0, 0.5, 0), Vector3(0, giro, 0)), Vector3(0.04, 0.05, largo), MADERA)
	m.caja(xf((a + b) / 2.0 + Vector3(0, 0.25, 0), Vector3(0, giro, 0)), Vector3(0.04, 0.05, largo), MADERA)

static func _bandera(padre: Node3D, col: Color, pos: Vector3, alto := 2.6) -> void:
	var m := Mallas.new()
	m.cilindro(xf(pos), 0.05, 0.04, alto, 4, MADERA_OSCURA)
	m.caja(xf(pos + Vector3(0.35, alto - 0.3, 0)), Vector3(0.7, 0.45, 0.03), col)
	_mi(m.malla(), padre, "Bandera")

## Llama + luz cálida estable + humo suave (sin parpadeo).
static func _fuego(padre: Node3D, escala: float, pos := Vector3.ZERO) -> void:
	var f := Node3D.new()
	f.name = "Fuego"
	f.position = pos
	padre.add_child(f)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.55, 0.15)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.5, 0.12)
	mat.emission_energy_multiplier = 2.0
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var llama := MeshInstance3D.new()
	llama.name = "Llama"
	var cono := CylinderMesh.new()
	cono.top_radius = 0.0
	cono.bottom_radius = 0.28 * escala
	cono.height = 0.75 * escala
	cono.radial_segments = 6
	llama.mesh = cono
	llama.material_override = mat
	llama.position = Vector3(0, 0.38 * escala, 0)
	f.add_child(llama)
	var nucleo := MeshInstance3D.new()
	var c2 := CylinderMesh.new()
	c2.top_radius = 0.0
	c2.bottom_radius = 0.16 * escala
	c2.height = 0.5 * escala
	c2.radial_segments = 5
	nucleo.mesh = c2
	var mat2 := mat.duplicate()
	mat2.albedo_color = Color(1.0, 0.85, 0.4)
	mat2.emission = Color(1.0, 0.8, 0.35)
	nucleo.material_override = mat2
	nucleo.position = Vector3(0, 0.28 * escala, 0)
	f.add_child(nucleo)
	var luz := OmniLight3D.new()
	luz.name = "Luz"
	luz.light_color = Color(1.0, 0.64, 0.36)
	luz.omni_range = 9.0 * max(escala, 0.7)
	luz.light_energy = 1.5
	luz.position = Vector3(0, 0.9, 0)
	f.add_child(luz)
	var humo := GPUParticles3D.new()
	humo.name = "Humo"
	humo.amount = 14
	humo.lifetime = 4.0
	humo.position = Vector3(0, 0.8 * escala, 0)
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 12.0
	pm.initial_velocity_min = 0.5
	pm.initial_velocity_max = 0.9
	pm.gravity = Vector3(0.15, 0.1, 0)
	pm.scale_min = 0.4
	pm.scale_max = 0.9
	var curva := CurveTexture.new()
	var cv := Curve.new()
	cv.add_point(Vector2(0, 0.4))
	cv.add_point(Vector2(1, 1.6))
	curva.curve = cv
	pm.scale_curve = curva
	var grad := Gradient.new()
	grad.set_color(0, Color(0.5, 0.5, 0.5, 0.35))
	grad.set_color(1, Color(0.6, 0.6, 0.6, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	humo.process_material = pm
	var q := SphereMesh.new()
	q.radius = 0.25
	q.height = 0.5
	q.radial_segments = 6
	q.rings = 3
	var mq := StandardMaterial3D.new()
	mq.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mq.vertex_color_use_as_albedo = true
	mq.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	q.material = mq
	humo.draw_pass_1 = q
	f.add_child(humo)

# ------------------------------------------------------------------ personajes

## Personaje articulado. `ap` = [piel, peinado, colorPelo, barba, complexion, altura, sexo].
## Jerarquía: Cuerpo/Caderas/{Torso, Armadura, Cuello/Cabeza/{Ojos, Boca, Casco}, Brazo{I,D}/Codo/Mano, Pierna{I,D}/Rodilla}.
static func colono(ap: Array, tono: float) -> Node3D:
	var piel := Color(PIELES[int(ap[0]) % PIELES.size()])
	var pelo := Color(COLORES_PELO[int(ap[2]) % COLORES_PELO.size()])
	var comp := int(ap[4])
	var ancho: float = [0.88, 1.0, 1.1, 1.22][comp]
	var altura := float(ap[5])
	var mujer: bool = ap[6] == "f"
	var ropa := color_tribu(tono)
	var ropa2 := ropa.darkened(0.18)
	var pantalon := ropa.darkened(0.55)
	var cuero := Color(0.36, 0.24, 0.14)
	var raiz := Node3D.new()
	var cuerpo := Node3D.new()
	cuerpo.name = "Cuerpo"
	cuerpo.scale = Vector3(1, altura, 1)
	raiz.add_child(cuerpo)
	var caderas := Node3D.new()
	caderas.name = "Caderas"
	caderas.position = Vector3(0, 0.86, 0)
	cuerpo.add_child(caderas)
	# Torso: túnica ovalada más ancha en el pecho, cinturón con hebilla, faldón.
	var t := Mallas.new()
	var oval := Vector3(ancho, 1.0, 0.68 * ancho)
	t.cilindro(xf(Vector3(0, 0.12, 0), Vector3.ZERO, oval), 0.2, 0.235, 0.46, 10, ropa)
	t.esfera(xf(Vector3(0, 0.58, 0), Vector3.ZERO, Vector3(ancho * 1.05, 0.45, 0.7 * ancho)), 0.235, 10, 4, ropa)
	t.cilindro(xf(Vector3(0, 0.03, 0), Vector3.ZERO, oval), 0.215, 0.215, 0.09, 10, cuero)
	t.caja(xf(Vector3(0, 0.075, 0.148 * ancho)), Vector3(0.07, 0.06, 0.02), Color(0.78, 0.66, 0.36))
	var largo_faldon := 0.3 if mujer else 0.16
	t.cilindro(xf(Vector3(0, -largo_faldon + 0.04, 0), Vector3.ZERO, oval), 0.25 if mujer else 0.225, 0.215, largo_faldon, 10, ropa2)
	t.cilindro(xf(Vector3(0, 0.62, 0)), 0.075, 0.07, 0.1, 8, piel.darkened(0.05))
	var torso := _mi(t.malla(), caderas, "Torso")
	torso.set_meta("ropa", ropa)
	var armadura := MeshInstance3D.new()
	armadura.name = "Armadura"
	armadura.material_override = Mallas.material()
	caderas.add_child(armadura)
	# Cabeza (con ojos y boca aparte para parpadear y gesticular).
	var cuello := Node3D.new()
	cuello.name = "Cuello"
	cuello.position = Vector3(0, 0.7, 0)
	caderas.add_child(cuello)
	var c := Mallas.new()
	c.esfera(xf(Vector3(0, 0.15, 0)), 0.15, 12, 8, piel, Vector3(0.94, 1.1, 1.0))
	c.esfera(xf(Vector3(0, 0.07, 0.04)), 0.11, 10, 5, piel, Vector3(0.95, 0.75, 1.0))
	c.cilindro(xf(Vector3(0, 0.12, 0.135), Vector3(PI / 2.4, 0, 0)), 0.025, 0.012, 0.05, 6, piel.darkened(0.08))
	for lado in [-1, 1]:
		c.esfera(xf(Vector3(lado * 0.145, 0.15, -0.005)), 0.03, 6, 3, piel.darkened(0.06), Vector3(0.5, 1.0, 0.8))
		c.caja(xf(Vector3(lado * 0.055, 0.215, 0.135), Vector3(0, 0, -lado * 0.12)), Vector3(0.06, 0.014, 0.02), pelo.darkened(0.25))
	_pelo(c, int(ap[1]), pelo, mujer)
	_barba(c, int(ap[3]), pelo)
	var cabeza := _mi(c.malla(), cuello, "Cabeza")
	var ojos := Mallas.new()
	for lado in [-1, 1]:
		ojos.esfera(xf(Vector3(lado * 0.055, 0.0, 0.0)), 0.026, 8, 4, Color(0.97, 0.97, 0.95), Vector3(1.2, 0.9, 0.6))
		ojos.esfera(xf(Vector3(lado * 0.055, 0.0, 0.012)), 0.014, 6, 3, Color(0.25, 0.16, 0.1))
		ojos.esfera(xf(Vector3(lado * 0.055, 0.0, 0.018)), 0.007, 5, 2, Color(0.04, 0.03, 0.03))
	var mi_ojos := _mi(ojos.malla(), cabeza, "Ojos")
	mi_ojos.position = Vector3(0, 0.17, 0.122)
	var boca := Mallas.new()
	boca.caja(xf(), Vector3(0.06, 0.012, 0.015), Color(0.55, 0.28, 0.26))
	var mi_boca := _mi(boca.malla(), cabeza, "Boca")
	mi_boca.position = Vector3(0, 0.065, 0.142)
	var casco := MeshInstance3D.new()
	casco.name = "Casco"
	casco.material_override = Mallas.material()
	cabeza.add_child(casco)
	# Brazos: hombro → codo → mano.
	for lado in [-1, 1]:
		var hombro := Node3D.new()
		hombro.name = "BrazoI" if lado < 0 else "BrazoD"
		hombro.position = Vector3(lado * 0.255 * ancho, 0.58, 0)
		caderas.add_child(hombro)
		var b := Mallas.new()
		b.esfera(xf(Vector3(0, -0.01, 0)), 0.075, 8, 4, ropa)
		b.cilindro(xf(Vector3(0, -0.29, 0)), 0.055, 0.068, 0.28, 8, ropa.darkened(0.06))
		_mi(b.malla(), hombro)
		var codo := Node3D.new()
		codo.name = "Codo"
		codo.position = Vector3(0, -0.29, 0)
		hombro.add_child(codo)
		var a := Mallas.new()
		a.esfera(xf(), 0.055, 6, 3, ropa.darkened(0.1))
		a.cilindro(xf(Vector3(0, -0.24, 0)), 0.042, 0.052, 0.24, 8, piel)
		a.cilindro(xf(Vector3(0, -0.06, 0)), 0.058, 0.058, 0.05, 8, cuero)
		a.esfera(xf(Vector3(0, -0.29, 0.01)), 0.05, 7, 4, piel.darkened(0.03), Vector3(0.85, 1.1, 0.7))
		a.esfera(xf(Vector3(lado * -0.035, -0.27, 0.035)), 0.02, 5, 3, piel.darkened(0.06), Vector3(0.8, 1.6, 0.8))
		_mi(a.malla(), codo)
		var mano := Node3D.new()
		mano.name = "Mano"
		mano.position = Vector3(0, -0.3, 0.03)
		codo.add_child(mano)
	# Piernas: cadera → rodilla (con bota).
	for lado in [-1, 1]:
		var pierna := Node3D.new()
		pierna.name = "PiernaI" if lado < 0 else "PiernaD"
		pierna.position = Vector3(lado * 0.105 * ancho, -0.02, 0)
		caderas.add_child(pierna)
		var p := Mallas.new()
		p.cilindro(xf(Vector3(0, -0.42, 0)), 0.068, 0.088 * ancho, 0.42, 8, pantalon)
		_mi(p.malla(), pierna)
		var rodilla := Node3D.new()
		rodilla.name = "Rodilla"
		rodilla.position = Vector3(0, -0.42, 0)
		pierna.add_child(rodilla)
		var q := Mallas.new()
		q.esfera(xf(), 0.068, 6, 3, pantalon)
		q.cilindro(xf(Vector3(0, -0.3, 0)), 0.058, 0.066, 0.3, 8, pantalon.darkened(0.05))
		q.cilindro(xf(Vector3(0, -0.4, 0)), 0.068, 0.07, 0.2, 8, cuero)
		q.esfera(xf(Vector3(0, -0.4, 0.06)), 0.07, 8, 4, cuero.darkened(0.15), Vector3(0.95, 0.55, 1.7))
		_mi(q.malla(), rodilla)
	return raiz

const ARMADURA_COLOR := {"armadura_cuero": Color(0.45, 0.3, 0.17), "armadura_cobre": Color(0.78, 0.45, 0.22), "armadura_hierro": Color(0.55, 0.57, 0.6)}

## Viste (o desviste) la armadura y el casco según el equipo.
static func vestir(cuerpo: Node3D, armadura) -> void:
	var caderas := cuerpo.get_node("Caderas")
	var mi: MeshInstance3D = caderas.get_node("Armadura")
	var casco: MeshInstance3D = caderas.get_node("Cuello/Cabeza/Casco")
	if mi.get_meta("tipo", "") == str(armadura):
		return
	mi.set_meta("tipo", str(armadura))
	if armadura == null:
		mi.mesh = null
		casco.mesh = null
		return
	var col: Color = ARMADURA_COLOR.get(armadura, Color.GRAY)
	var m := Mallas.new()
	m.cilindro(xf(Vector3(0, 0.14, 0), Vector3.ZERO, Vector3(1.0, 1.0, 0.72)), 0.225, 0.26, 0.46, 10, col)
	m.esfera(xf(Vector3(0, 0.6, 0), Vector3.ZERO, Vector3(1.08, 0.42, 0.74)), 0.25, 10, 4, col.darkened(0.08))
	for lado in [-1, 1]:
		m.caja(xf(Vector3(lado * 0.3, 0.56, 0)), Vector3(0.16, 0.1, 0.2), col.lightened(0.08))
	if armadura != "armadura_cuero":
		m.caja(xf(Vector3(0, 0.42, 0.16)), Vector3(0.08, 0.3, 0.02), col.lightened(0.15))
	mi.mesh = m.malla()
	if armadura == "armadura_cuero":
		casco.mesh = null
	else:
		var h := Mallas.new()
		h.esfera(xf(Vector3(0, 0.22, -0.01)), 0.17, 10, 5, col, Vector3(1.02, 0.85, 1.05))
		h.caja(xf(Vector3(0, 0.17, 0.17)), Vector3(0.04, 0.14, 0.03), col.darkened(0.15))
		h.caja(xf(Vector3(0, 0.18, 0)), Vector3(0.38, 0.04, 0.38), col.darkened(0.1))
		casco.mesh = h.malla()

## Ropa de abrigo encima de la túnica: capa de piel con cuello de pelo, o manta de fibra a rayas sobre los hombros.
static func abrigar(cuerpo: Node3D, ropa) -> void:
	var caderas := cuerpo.get_node("Caderas")
	var mi: MeshInstance3D
	if caderas.has_node("Ropa"):
		mi = caderas.get_node("Ropa")
	else:
		mi = MeshInstance3D.new()
		mi.name = "Ropa"
		mi.material_override = Mallas.material()
		caderas.add_child(mi)
	if mi.has_meta("tipo") and mi.get_meta("tipo") == str(ropa):
		return
	mi.set_meta("tipo", str(ropa))
	if ropa == null or not (ropa in ["abrigo", "manta"]):
		mi.mesh = null
		return
	var m := Mallas.new()
	if ropa == "abrigo":
		var piel := Color(0.48, 0.34, 0.2)
		m.cilindro(xf(Vector3(0, -0.12, -0.03), Vector3.ZERO, Vector3(1.0, 1.0, 0.8)), 0.25, 0.3, 0.74, 10, piel)
		m.esfera(xf(Vector3(0, 0.6, -0.02), Vector3.ZERO, Vector3(1.12, 0.45, 0.82)), 0.26, 10, 4, piel.darkened(0.05))
		m.cilindro(xf(Vector3(0, 0.64, 0)), 0.16, 0.13, 0.1, 10, Color(0.85, 0.8, 0.7))
		for k in 6:
			var a := TAU * k / 6.0
			m.esfera(xf(Vector3(cos(a) * 0.15, 0.68, sin(a) * 0.12)), 0.05, 5, 3, Color(0.88, 0.84, 0.75))
		m.caja(xf(Vector3(0, 0.3, 0.215)), Vector3(0.03, 0.55, 0.02), piel.darkened(0.3))
	else:
		var tela := Color(0.72, 0.6, 0.38)
		m.esfera(xf(Vector3(0, 0.55, -0.02), Vector3.ZERO, Vector3(1.15, 0.6, 0.85)), 0.26, 10, 5, tela)
		for k in 3:
			m.cilindro(xf(Vector3(0, 0.42 + k * 0.1, -0.02), Vector3.ZERO, Vector3(1.0, 1.0, 0.75)), 0.29 - k * 0.02, 0.29 - k * 0.02, 0.03, 10, Color(0.6, 0.25, 0.2) if k % 2 == 0 else Color(0.3, 0.4, 0.55))
		m.caja(xf(Vector3(0.08, 0.25, 0.2), Vector3(0, 0, 0.2)), Vector3(0.12, 0.35, 0.03), tela.darkened(0.1))
	mi.mesh = m.malla()

static func _casquete(c: Mallas, col: Color, esc := Vector3(1.05, 1.0, 1.1)) -> void:
	# Casquete curvo que cubre la coronilla y la nuca, dejando la cara a la vista.
	c.esfera(xf(Vector3(0, 0.195, -0.03)), 0.156, 12, 7, col, esc, 0.06, 5)

static func _pelo(c: Mallas, estilo: int, col: Color, mujer: bool) -> void:
	match estilo:
		0:
			_casquete(c, col.darkened(0.15), Vector3(1.0, 0.95, 1.04))
		1:
			_casquete(c, col)
			c.esfera(xf(Vector3(0, 0.27, 0.07)), 0.07, 8, 4, col, Vector3(1.6, 0.5, 0.8))
		2:
			_casquete(c, col)
			c.esfera(xf(Vector3(0, 0.08, -0.12)), 0.13, 10, 6, col, Vector3(1.25, 1.7, 0.6), 0.08, 2)
			for lado in [-1, 1]:
				c.esfera(xf(Vector3(lado * 0.13, 0.07, 0.0)), 0.05, 6, 4, col, Vector3(0.7, 2.0, 1.0))
		3:
			_casquete(c, col)
			c.cilindro(xf(Vector3(0, 0.17, -0.16), Vector3(PI * 0.8, 0, 0)), 0.045, 0.02, 0.32, 7, col)
			c.esfera(xf(Vector3(0, 0.2, -0.165)), 0.04, 6, 3, Color(0.5, 0.2, 0.2))
		4:
			_casquete(c, col)
			for lado in [-1, 1]:
				for k in 5:
					c.esfera(xf(Vector3(lado * 0.12, 0.07 - k * 0.06, -0.06 - k * 0.01)), 0.033 - k * 0.002, 6, 3, col.darkened(0.06 * (k % 2)))
		5:
			c.esfera(xf(Vector3(0, 0.24, -0.02)), 0.05, 8, 4, col, Vector3(0.6, 1.6, 3.4))
		6:
			_casquete(c, col)
			c.esfera(xf(Vector3(0, 0.33, -0.08)), 0.07, 8, 5, col)
		7:
			for k in 14:
				var a := TAU * k / 14.0
				c.esfera(xf(Vector3(cos(a) * 0.11, 0.25 + sin(k * 1.7) * 0.03, sin(a) * 0.11 - 0.03)), 0.06, 6, 3, col.darkened(0.05 * (k % 3)))
			c.esfera(xf(Vector3(0, 0.3, -0.02)), 0.09, 8, 4, col)
		8:
			if mujer:
				_casquete(c, col, Vector3(1.0, 0.92, 1.04))

static func _barba(c: Mallas, estilo: int, col: Color) -> void:
	match estilo:
		3:
			c.esfera(xf(Vector3(0, 0.05, 0.08)), 0.11, 10, 5, col, Vector3(1.05, 0.6, 0.75))
		4:
			c.esfera(xf(Vector3(0, -0.01, 0.09)), 0.11, 10, 6, col, Vector3(1.0, 1.25, 0.75))
		5:
			c.esfera(xf(Vector3(0, 0.095, 0.15)), 0.035, 6, 3, col, Vector3(2.2, 0.5, 0.6))
		6:
			c.esfera(xf(Vector3(0, 0.02, 0.12)), 0.045, 6, 4, col, Vector3(0.9, 1.4, 0.8))

## Objeto en la mano (arma, herramienta o lo que carga).
static func objeto(id: String) -> ArrayMesh:
	var clave := "obj_" + id
	if _cache.has(clave):
		return _cache[clave]
	var m := Mallas.new()
	match id:
		"lanza":
			m.cilindro(xf(Vector3(0, -0.6, 0)), 0.025, 0.025, 1.7, 4, MADERA)
			m.cilindro(xf(Vector3(0, 1.1, 0)), 0.05, 0.0, 0.25, 4, PIEDRA.lightened(0.1))
		"hacha":
			m.cilindro(xf(Vector3(0, -0.2, 0)), 0.025, 0.025, 0.75, 4, MADERA)
			m.caja(xf(Vector3(0.08, 0.48, 0)), Vector3(0.18, 0.14, 0.04), PIEDRA)
		"pico":
			m.cilindro(xf(Vector3(0, -0.2, 0)), 0.025, 0.025, 0.75, 4, MADERA)
			m.caja(xf(Vector3(0, 0.5, 0)), Vector3(0.4, 0.06, 0.05), PIEDRA.darkened(0.1))
		"arco":
			m.cilindro(xf(Vector3(0, -0.5, 0)), 0.02, 0.02, 1.0, 4, MADERA.darkened(0.1))
			m.cilindro(xf(Vector3(0.03, -0.5, 0)), 0.004, 0.004, 1.0, 3, Color(0.9, 0.9, 0.85))
		"madera":
			m.cilindro(xf(Vector3(-0.2, 0, 0.15), Vector3(0, 0, PI / 2)), 0.07, 0.07, 0.6, 5, MADERA)
			m.cilindro(xf(Vector3(-0.2, 0.12, 0.15), Vector3(0, 0, PI / 2)), 0.07, 0.07, 0.6, 5, MADERA.lightened(0.05))
		"piedra":
			m.esfera(xf(Vector3(0, 0.05, 0.15)), 0.14, 5, 3, PIEDRA)
		"espada_cobre", "espada_hierro":
			var hoja := Color(0.8, 0.5, 0.25) if id == "espada_cobre" else Color(0.75, 0.76, 0.8)
			m.cilindro(xf(Vector3(0, -0.15, 0)), 0.025, 0.025, 0.2, 5, MADERA_OSCURA)
			m.caja(xf(Vector3(0, 0.07, 0)), Vector3(0.22, 0.04, 0.05), hoja.darkened(0.2))
			m.caja(xf(Vector3(0, 0.45, 0)), Vector3(0.07, 0.72, 0.015), hoja)
		"arcabuz":
			m.caja(xf(Vector3(0, -0.15, 0)), Vector3(0.08, 0.45, 0.12), MADERA)
			m.cilindro(xf(Vector3(0, 0.05, 0.02)), 0.03, 0.03, 0.9, 6, Color(0.25, 0.25, 0.27))
		"hacha_cobre", "hacha_hierro":
			m.cilindro(xf(Vector3(0, -0.2, 0)), 0.025, 0.025, 0.75, 4, MADERA)
			m.caja(xf(Vector3(0.09, 0.48, 0)), Vector3(0.2, 0.15, 0.03), Color(0.8, 0.5, 0.25) if id == "hacha_cobre" else Color(0.7, 0.71, 0.75))
		"pico_cobre", "pico_hierro":
			m.cilindro(xf(Vector3(0, -0.2, 0)), 0.025, 0.025, 0.75, 4, MADERA)
			m.caja(xf(Vector3(0, 0.5, 0)), Vector3(0.42, 0.06, 0.05), Color(0.8, 0.5, 0.25) if id == "pico_cobre" else Color(0.7, 0.71, 0.75))
		"martillo":
			m.cilindro(xf(Vector3(0, -0.15, 0)), 0.022, 0.022, 0.5, 4, MADERA)
			m.caja(xf(Vector3(0, 0.33, 0)), Vector3(0.16, 0.09, 0.09), PIEDRA.darkened(0.1))
		"cesta":
			m.cilindro(xf(Vector3(0, -0.2, 0.05)), 0.16, 0.2, 0.22, 8, PAJA.darkened(0.1))
			m.esfera(xf(Vector3(0, 0.03, 0.05)), 0.12, 5, 2, Color(0.75, 0.15, 0.2))
		"libro":
			m.caja(xf(Vector3(0, 0, 0.08)), Vector3(0.18, 0.04, 0.24), Color(0.45, 0.2, 0.15))
		_:
			m.esfera(xf(Vector3(0, 0.05, 0.15)), 0.12, 5, 3, Color(0.7, 0.25, 0.2) if id in ["bayas", "carne_cruda"] else Color(0.6, 0.5, 0.3))
	_cache[clave] = m.malla()
	return _cache[clave]

# ------------------------------------------------------------------ animales

static func animal(especie: String) -> Node3D:
	var raiz := Node3D.new()
	var cuerpo := Node3D.new()
	cuerpo.name = "Cuerpo"
	raiz.add_child(cuerpo)
	var m := Mallas.new()
	var col: Color
	var patas := []
	var largo_pata := 0.3
	match especie:
		"lobo":
			col = Color(0.42, 0.42, 0.44)
			m.caja(xf(Vector3(0, 0.6, 0)), Vector3(0.36, 0.38, 0.95), col, 0.15)
			m.caja(xf(Vector3(0, 0.78, 0.56)), Vector3(0.3, 0.3, 0.34), col.darkened(0.08))
			m.caja(xf(Vector3(0, 0.72, 0.8)), Vector3(0.16, 0.14, 0.2), col.darkened(0.15))
			m.cilindro(xf(Vector3(-0.09, 0.92, 0.55)), 0.06, 0.0, 0.16, 4, col)
			m.cilindro(xf(Vector3(0.09, 0.92, 0.55)), 0.06, 0.0, 0.16, 4, col)
			m.caja(xf(Vector3(-0.07, 0.82, 0.73)), Vector3(0.04, 0.03, 0.02), Color(0.95, 0.8, 0.3))
			m.caja(xf(Vector3(0.07, 0.82, 0.73)), Vector3(0.04, 0.03, 0.02), Color(0.95, 0.8, 0.3))
			m.cilindro(xf(Vector3(0, 0.66, -0.47), Vector3(-2.2, 0, 0)), 0.07, 0.03, 0.5, 5, col.lightened(0.05))
			patas = [Vector3(-0.12, 0.42, 0.33), Vector3(0.12, 0.42, 0.33), Vector3(-0.12, 0.42, -0.33), Vector3(0.12, 0.42, -0.33)]
			largo_pata = 0.42
		"ciervo":
			col = Color(0.58, 0.39, 0.22)
			m.caja(xf(Vector3(0, 0.95, 0)), Vector3(0.4, 0.45, 1.05), col, 0.12)
			m.caja(xf(Vector3(0, 1.3, 0.5)), Vector3(0.2, 0.55, 0.2), col)
			m.caja(xf(Vector3(0, 1.6, 0.62)), Vector3(0.22, 0.22, 0.38), col.lightened(0.05))
			m.caja(xf(Vector3(0, 0.95, -0.5)), Vector3(0.14, 0.14, 0.1), Color(0.95, 0.93, 0.88))
			for lado in [-1, 1]:
				m.cilindro(xf(Vector3(lado * 0.08, 1.7, 0.55), Vector3(0, 0, lado * 0.5)), 0.025, 0.015, 0.5, 4, Color(0.85, 0.78, 0.6))
				m.cilindro(xf(Vector3(lado * 0.2, 1.95, 0.55), Vector3(0.6, 0, lado * 0.2)), 0.02, 0.01, 0.25, 4, Color(0.85, 0.78, 0.6))
			patas = [Vector3(-0.14, 0.72, 0.38), Vector3(0.14, 0.72, 0.38), Vector3(-0.14, 0.72, -0.38), Vector3(0.14, 0.72, -0.38)]
			largo_pata = 0.72
		"jabali":
			col = Color(0.3, 0.22, 0.16)
			m.caja(xf(Vector3(0, 0.55, 0)), Vector3(0.5, 0.5, 0.95), col, 0.12)
			m.caja(xf(Vector3(0, 0.72, -0.05)), Vector3(0.15, 0.12, 0.8), col.darkened(0.2))
			m.caja(xf(Vector3(0, 0.5, 0.6)), Vector3(0.34, 0.32, 0.35), col.darkened(0.05))
			m.caja(xf(Vector3(0, 0.45, 0.82)), Vector3(0.18, 0.14, 0.1), Color(0.55, 0.38, 0.35))
			m.cilindro(xf(Vector3(-0.12, 0.4, 0.78), Vector3(-1.0, 0, 0)), 0.025, 0.0, 0.18, 4, Color(0.95, 0.92, 0.85))
			m.cilindro(xf(Vector3(0.12, 0.4, 0.78), Vector3(-1.0, 0, 0)), 0.025, 0.0, 0.18, 4, Color(0.95, 0.92, 0.85))
			patas = [Vector3(-0.16, 0.32, 0.3), Vector3(0.16, 0.32, 0.3), Vector3(-0.16, 0.32, -0.3), Vector3(0.16, 0.32, -0.3)]
			largo_pata = 0.32
		"oso":
			col = Color(0.32, 0.22, 0.14)
			m.caja(xf(Vector3(0, 1.0, 0)), Vector3(0.95, 0.85, 1.6), col, 0.1)
			m.esfera(xf(Vector3(0, 1.3, 0.3)), 0.55, 7, 4, col, Vector3(1, 0.8, 1.1))
			m.caja(xf(Vector3(0, 1.15, 0.95)), Vector3(0.55, 0.5, 0.5), col.lightened(0.04))
			m.caja(xf(Vector3(0, 1.05, 1.25)), Vector3(0.25, 0.22, 0.2), col.lightened(0.15))
			m.esfera(xf(Vector3(-0.2, 1.45, 0.9)), 0.1, 5, 3, col)
			m.esfera(xf(Vector3(0.2, 1.45, 0.9)), 0.1, 5, 3, col)
			patas = [Vector3(-0.3, 0.62, 0.5), Vector3(0.3, 0.62, 0.5), Vector3(-0.3, 0.62, -0.5), Vector3(0.3, 0.62, -0.5)]
			largo_pata = 0.62
		_:
			col = Color(0.72, 0.66, 0.56)
			m.esfera(xf(Vector3(0, 0.17, 0)), 0.17, 6, 4, col, Vector3(0.9, 0.85, 1.2))
			m.esfera(xf(Vector3(0, 0.26, 0.17)), 0.1, 5, 3, col)
			m.cilindro(xf(Vector3(-0.04, 0.32, 0.17), Vector3(-0.2, 0, -0.15)), 0.025, 0.02, 0.18, 4, col)
			m.cilindro(xf(Vector3(0.04, 0.32, 0.17), Vector3(-0.2, 0, 0.15)), 0.025, 0.02, 0.18, 4, col)
			m.esfera(xf(Vector3(0, 0.2, -0.18)), 0.05, 4, 2, Color(0.95, 0.95, 0.95))
	_mi(m.malla(), cuerpo, "Tronco")
	var i := 0
	for p in patas:
		var piv := Node3D.new()
		piv.name = "Pata%d" % i
		piv.position = p
		cuerpo.add_child(piv)
		var pm := Mallas.new()
		var grosor := 0.09 if especie != "oso" else 0.2
		pm.caja(xf(Vector3(0, -largo_pata / 2.0, 0)), Vector3(grosor, largo_pata, grosor), col.darkened(0.18))
		_mi(pm.malla(), piv)
		i += 1
	return raiz
