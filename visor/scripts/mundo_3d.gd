# El mundo en 3D: terreno por trozos con shader (12 biomas, roca en pendientes, nieve, humedad), agua animada,
# vegetación y vetas de mineral en MultiMesh por trozos (con distancia de visión), pasto y flores, caminos, y
# todas las entidades sincronizadas con el motor. Colonos y animales están articulados y se animan por código.
class_name Mundo3D
extends Node3D

# agua, pradera, bosque, roca, denso, pantano, arena, desierto, nieve, taiga, sabana, selva
const COLORES_BIOMA := [Color(0.3, 0.27, 0.2), Color(0.36, 0.5, 0.18), Color(0.25, 0.4, 0.15), Color(0.4, 0.38, 0.35), Color(0.17, 0.3, 0.12), Color(0.3, 0.34, 0.2), Color(0.72, 0.66, 0.46),
	Color(0.8, 0.66, 0.42), Color(0.88, 0.9, 0.94), Color(0.27, 0.36, 0.25), Color(0.62, 0.58, 0.3), Color(0.16, 0.38, 0.12)]
const FLORES := [Color(0.95, 0.85, 0.3), Color(0.9, 0.45, 0.6), Color(0.65, 0.55, 0.95), Color(0.98, 0.98, 0.95)]
const TROZO := 64
const TROZO_VEG := 96
const MINERALES := ["carbon", "cobre", "hierro", "oro", "azufre"]
const HERRAMIENTA_DE := {"talar": "hacha", "minar": "pico", "construir": "martillo", "recolectar": "cesta", "forrajear": "cesta", "cosechar": "cesta", "investigar": "libro"}

var tam := 576
var esquinas := PackedFloat32Array()
var biomas := PackedByteArray()
var listo := false
var tonos := {}
var poderes: Array = []

var _mat_terreno: ShaderMaterial
var _mat_vegetacion: ShaderMaterial
var _mat_agua: ShaderMaterial
var _nodos := {}
var _mms := {}
var _mmis := {}
var _flores: Array = []
var _caminos: Node3D
var colonos := {}
var animales := {}
var _estructuras := {}
var _cuerpos := {}
var _fuegos: Array = []
var _t := 0.0
## Terreno por niveles de detalle: cada trozo tiene una malla lejana (1 de cada 4 vértices, siempre) y una cercana
## (todos los vértices) que se construye solo alrededor de la cámara. El pasto y las flores igual: solo cerca.
const R_CERCA := 210.0
const R_LEJOS_FINO := 320.0
const R_PASTO := 120.0
const R_PASTO_FUERA := 180.0
var _trozos := {}
var _mats_veg := {}
var _reloj_lod := 0.0
var _proy := {}
## Velocidad de la simulación (la pone main.gd): los proyectiles se extrapolan a ese ritmo.
var velocidad_sim := 1.0
var fisica: Fisica

# ------------------------------------------------------------------ alturas

func _h(cx: int, cz: int) -> float:
	return esquinas[clampi(cz, 0, tam) * (tam + 1) + clampi(cx, 0, tam)]

## Altura del terreno en (x, z) (bilineal entre esquinas).
func altura(x: float, z: float) -> float:
	if esquinas.is_empty():
		return 0.0
	var cx := clampi(int(floor(x)), 0, tam - 1)
	var cz := clampi(int(floor(z)), 0, tam - 1)
	var fx := clampf(x - cx, 0.0, 1.0)
	var fz := clampf(z - cz, 0.0, 1.0)
	return lerpf(lerpf(_h(cx, cz), _h(cx + 1, cz), fx), lerpf(_h(cx, cz + 1), _h(cx + 1, cz + 1), fx), fz)

func _bioma(x: int, z: int) -> int:
	return biomas[clampi(z, 0, tam - 1) * tam + clampi(x, 0, tam - 1)]

# ------------------------------------------------------------------ terreno

func construir(d: Dictionary) -> void:
	for h in get_children():
		h.queue_free()
	_nodos.clear(); _mms.clear(); _mmis.clear(); colonos.clear(); animales.clear(); _estructuras.clear(); _cuerpos.clear(); _fuegos.clear(); _flores.clear()
	tam = int(d["tam"])
	poderes = d.get("poderes", [])
	fisica = Fisica.new(self)
	add_child(fisica)
	esquinas = PackedFloat32Array(d["esquinas"])
	biomas = PackedByteArray(d["biomas"])
	_mat_terreno = ShaderMaterial.new()
	_mat_terreno.shader = load("res://shaders/terreno.gdshader")
	_mat_terreno.set_shader_parameter("nieve", 0.0)
	_mat_terreno.set_shader_parameter("humedad", 0.0)
	_trozos.clear()
	_mats_veg.clear()
	for tz in range(0, tam, TROZO):
		for tx in range(0, tam, TROZO):
			var lejos := _malla_trozo(tx, tz, 4)
			add_child(lejos)
			_trozos["%d_%d" % [tx, tz]] = {"tx": tx, "tz": tz, "lejos": lejos, "cerca": null, "pasto": []}
	_mat_agua = ShaderMaterial.new()
	_mat_agua.shader = load("res://shaders/agua.gdshader")
	var agua := MeshInstance3D.new()
	var plano := PlaneMesh.new()
	plano.size = Vector2(tam + 400, tam + 400)
	plano.subdivide_width = 160
	plano.subdivide_depth = 160
	agua.mesh = plano
	agua.material_override = _mat_agua
	agua.position = Vector3(tam / 2.0, -0.18, tam / 2.0)
	add_child(agua)
	_caminos = Node3D.new()
	_caminos.name = "Caminos"
	add_child(_caminos)
	_mat_vegetacion = ShaderMaterial.new()
	_mat_vegetacion.shader = load("res://shaders/vegetacion.gdshader")
	_crear_nodos(d["nodos"])
	listo = true

func _color_esquina(x: int, z: int) -> Color:
	return (COLORES_BIOMA[_bioma(x - 1, z - 1)] + COLORES_BIOMA[_bioma(x, z - 1)] + COLORES_BIOMA[_bioma(x - 1, z)] + COLORES_BIOMA[_bioma(x, z)]) / 4.0

## Malla de un trozo con `paso` (1 = detalle completo, 4 = lejana) y un faldón hacia abajo en el borde.
func _malla_trozo(tx: int, tz: int, paso: int) -> MeshInstance3D:
	var n := TROZO / paso + 1
	var v := PackedVector3Array()
	var nor := PackedVector3Array()
	var col := PackedColorArray()
	var idx := PackedInt32Array()
	v.resize(n * n)
	nor.resize(n * n)
	col.resize(n * n)
	for z in n:
		for x in n:
			var gx := mini(tx + x * paso, tam)
			var gz := mini(tz + z * paso, tam)
			var i := z * n + x
			v[i] = Vector3(gx, _h(gx, gz), gz)
			nor[i] = Vector3(_h(gx - paso, gz) - _h(gx + paso, gz), 2.0 * paso, _h(gx, gz - paso) - _h(gx, gz + paso)).normalized()
			col[i] = _color_esquina(gx, gz)
	for z in n - 1:
		for x in n - 1:
			var a := z * n + x
			idx.append_array([a, a + 1, a + n, a + 1, a + n + 1, a + n])
	# Faldón: el borde baja 3 m para tapar las grietas con el trozo vecino de otro nivel.
	var bordes := []
	for k in n:
		bordes.append([k, k + 1])
	var lados := [[], [], [], []]
	for k in n:
		lados[0].append(k)
		lados[1].append((n - 1) * n + k)
		lados[2].append(k * n)
		lados[3].append(k * n + n - 1)
	for lado in lados:
		var base := v.size()
		for i in lado:
			v.append(v[i] - Vector3(0, 3.0, 0))
			nor.append(nor[i])
			col.append(col[i])
		for k in lado.size() - 1:
			var a: int = lado[k]
			var b: int = lado[k + 1]
			idx.append_array([a, b, base + k, b, base + k + 1, base + k])
			idx.append_array([a, base + k, b, b, base + k, base + k + 1])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = nor
	arr[Mesh.ARRAY_COLOR] = col
	arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.mesh = am
	mi.material_override = _mat_terreno
	return mi

## Cada 0,2 s: detalle completo y pasto alrededor del punto que mira la cámara (con un tope de trabajo por cuadro).
func _streaming(delta: float) -> void:
	_reloj_lod -= delta
	if _reloj_lod > 0.0 or not listo:
		return
	_reloj_lod = 0.2
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var foco := cam.global_position
	if cam.has_method("foco"):
		foco = cam.foco()
	var altura_cam := maxf(0.0, cam.global_position.y - foco.y)
	var r_cerca := R_CERCA if altura_cam < 260.0 else 0.0
	var hechos := 0
	var pastos := 0
	for k in _trozos:
		var tr: Dictionary = _trozos[k]
		var centro := Vector3(tr["tx"] + TROZO / 2.0, 0, tr["tz"] + TROZO / 2.0)
		var d := Vector2(centro.x - foco.x, centro.z - foco.z).length()
		var cerca: MeshInstance3D = tr["cerca"]
		if d < r_cerca and cerca == null and hechos < 2:
			cerca = _malla_trozo(tr["tx"], tr["tz"], 1)
			add_child(cerca)
			tr["cerca"] = cerca
			(tr["lejos"] as Node3D).visible = false
			hechos += 1
		elif cerca != null and (d > R_LEJOS_FINO or r_cerca == 0.0):
			cerca.queue_free()
			tr["cerca"] = null
			(tr["lejos"] as Node3D).visible = true
		var pasto: Array = tr["pasto"]
		if d < R_PASTO and pasto.is_empty() and pastos < 1 and altura_cam < 160.0:
			tr["pasto"] = _pasto_trozo(tr["tx"], tr["tz"])
			pastos += 1
		elif not pasto.is_empty() and (d > R_PASTO_FUERA or altura_cam >= 160.0):
			for p in pasto:
				_flores.erase(p)
				(p as Node).queue_free()
			tr["pasto"] = []

## Pasto y flores de un trozo (determinista por posición).
func _pasto_trozo(tx: int, tz: int) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(Vector2i(tx, tz)) + tam
	var pasto: Array = []
	var flores := {}
	for z in range(maxi(1, tz), mini(tam - 1, tz + TROZO)):
		for x in range(maxi(1, tx), mini(tam - 1, tx + TROZO)):
			var b := _bioma(x, z)
			var p := 0.0
			match b:
				1: p = 0.45
				2: p = 0.25
				5: p = 0.35
				9: p = 0.15
				10: p = 0.5
				11: p = 0.3
				4: p = 0.1
			if p > 0.0 and rng.randf() < p:
				var px := x + rng.randf()
				var pz := z + rng.randf()
				pasto.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.55, 1.05)), Vector3(px, altura(px, pz) - 0.03, pz)))
			if (b == 1 or b == 10) and rng.randf() < 0.035:
				var fx := x + rng.randf()
				var fz := z + rng.randf()
				var c := rng.randi() % FLORES.size()
				if not flores.has(c):
					flores[c] = []
				flores[c].append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU), Vector3(fx, altura(fx, fz), fz)))
	var nodos: Array = []
	if not pasto.is_empty():
		nodos.append(_mmi_suelto(Modelos.pasto(), pasto, 1.5, 90.0))
	for c in flores:
		var fl := _mmi_suelto(Modelos.flor(FLORES[c]), flores[c], 1.5, 70.0)
		_flores.append(fl)
		nodos.append(fl)
	return nodos

func _mmi_suelto(malla: Mesh, lista: Array, flexible: float, rango: float) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = malla
	mm.instance_count = lista.size()
	for i in lista.size():
		mm.set_instance_transform(i, lista[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = _mat_veg(flexible)
	mmi.visibility_range_end = rango
	mmi.visibility_range_end_margin = 15.0
	mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	add_child(mmi)
	return mmi

## Un material de vegetación por flexibilidad (compartido: menos cambios de estado al dibujar).
func _mat_veg(flexible: float) -> ShaderMaterial:
	if not _mats_veg.has(flexible):
		var mat := _mat_vegetacion.duplicate() as ShaderMaterial
		mat.set_shader_parameter("flexible", flexible)
		_mats_veg[flexible] = mat
	return _mats_veg[flexible]

# ------------------------------------------------------------------ vegetación por trozos

func _clave_trozo(x: float, z: float) -> String:
	return "%d_%d" % [int(x / TROZO_VEG), int(z / TROZO_VEG)]

func _mm(clave: String, malla: Mesh, n: int, flexible: float, rango: float) -> MultiMesh:
	if _mms.has(clave):
		return _mms[clave]
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = malla
	mm.instance_count = n
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = _mat_veg(flexible)
	mmi.visibility_range_end = rango
	mmi.visibility_range_end_margin = 20.0
	mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	mmi.name = clave.replace("@", "__")
	add_child(mmi)
	_mms[clave] = mm
	_mmis[clave] = mmi
	return mm

func _malla_nodo(tipo: String, variante: String, id: String) -> Mesh:
	match tipo:
		"arbol": return Modelos.arbol(variante)
		"arbusto": return Modelos.arbusto(true)
		"hierbas": return Modelos.hierbas()
	return Modelos.yacimiento(tipo)

func _crear_nodos(lista: Array) -> void:
	var cuenta := {}
	var claves := []
	claves.resize(lista.size())
	for i in lista.size():
		var n: Array = lista[i]
		var tipo: String = n[1]
		var base: String = ("arbol_" + str(n[2])) if tipo == "arbol" else tipo
		var k: String = base + "@" + _clave_trozo(n[3], n[4])
		claves[i] = k
		cuenta[k] = cuenta.get(k, 0) + 1
		if tipo == "arbol" or tipo == "arbusto":
			var off: String = ("tocon" if tipo == "arbol" else "arbusto_vacio") + "@" + _clave_trozo(n[3], n[4])
			cuenta[off] = cuenta.get(off, 0) + 1
	var usados := {}
	for i in lista.size():
		var n: Array = lista[i]
		var id: String = n[0]
		var tipo: String = n[1]
		var k: String = claves[i]
		var rango := 300.0 if tipo == "arbol" else (130.0 if tipo in ["hierbas", "arbusto"] else 220.0)
		_mm(k, _malla_nodo(tipo, n[2], id), cuenta[k], 0.0 if (tipo == "roca" or tipo in MINERALES) else (0.6 if tipo == "arbol" else 1.0), rango)
		var yac: bool = tipo == "roca" or tipo in MINERALES
		var info := {"mm": k, "i": usados.get(k, 0), "x": float(n[3]), "z": float(n[4]), "t": tipo, "s": 1.0 if yac else 0.8 + float(hash(id) % 100) / 220.0, "r": float(hash(id + "r") % 628) / 100.0, "yac": yac}
		usados[k] = int(info["i"]) + 1
		if tipo == "arbol" or tipo == "arbusto":
			var off: String = ("tocon" if tipo == "arbol" else "arbusto_vacio") + "@" + _clave_trozo(n[3], n[4])
			_mm(off, Modelos.tocon() if tipo == "arbol" else Modelos.arbusto(false), cuenta[off], 1.0, 160.0)
			info["off"] = off
			info["io"] = usados.get(off, 0)
			usados[off] = int(info["io"]) + 1
		_nodos[id] = info
		poner_nodo(id, int(n[5]))
	_impostores(lista)

## Árboles de lejos: una copa simple coloreada por variante, visible de 260 m en adelante (uno por trozo de 96 m).
const COLOR_LEJOS := {"pino": Color(0.16, 0.32, 0.18), "abeto": Color(0.14, 0.28, 0.2), "roble": Color(0.25, 0.42, 0.16), "abedul": Color(0.4, 0.55, 0.22),
	"sauce": Color(0.3, 0.45, 0.2), "nevado": Color(0.75, 0.82, 0.85), "acacia": Color(0.45, 0.5, 0.2), "palmera": Color(0.3, 0.5, 0.18), "jungla": Color(0.12, 0.35, 0.12), "cactus": Color(0.3, 0.5, 0.25)}

func _impostores(lista: Array) -> void:
	var por_trozo := {}
	for n in lista:
		if n[1] != "arbol":
			continue
		var k := _clave_trozo(n[3], n[4])
		if not por_trozo.has(k):
			por_trozo[k] = []
		por_trozo[k].append(n)
	var m := Mallas.new()
	m.cilindro(Mallas.xf(Vector3(0, 0, 0)), 0.25, 0.2, 1.6, 4, Color(0.35, 0.25, 0.15))
	m.cilindro(Mallas.xf(Vector3(0, 1.2, 0)), 1.6, 0.0, 4.2, 5, Color.WHITE)
	var malla := m.malla()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	for k in por_trozo:
		var arr: Array = por_trozo[k]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = malla
		mm.instance_count = arr.size()
		for i in arr.size():
			var n: Array = arr[i]
			var x := float(n[3])
			var z := float(n[4])
			var s := 0.8 + float(hash(n[0]) % 100) / 220.0
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * s), Vector3(x, altura(x, z) - 0.05, z)))
			mm.set_instance_color(i, COLOR_LEJOS.get(n[2], Color(0.2, 0.38, 0.17)))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = mat
		mmi.visibility_range_begin = 260.0
		mmi.visibility_range_begin_margin = 25.0
		mmi.visibility_range_end = 2200.0
		mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)

## Nodos que aparecen durante la partida (vetas nuevas, afloramientos): cada uno con su propia malla.
func agregar_nodos(lista: Array) -> void:
	for n in lista:
		var id: String = n[0]
		if _nodos.has(id):
			continue
		var tipo: String = n[1]
		var mi := MeshInstance3D.new()
		mi.mesh = _malla_nodo(tipo, n[2], id)
		mi.material_override = _mat_veg(0.0 if tipo != "arbol" else 0.6)
		var x := float(n[3])
		var z := float(n[4])
		mi.position = Vector3(x, altura(x, z) - 0.05, z)
		mi.rotation.y = float(hash(id + "r") % 628) / 100.0
		add_child(mi)
		_nodos[id] = {"mi": mi, "x": x, "z": z, "t": tipo, "s": 1.0, "yac": tipo == "roca" or tipo in MINERALES}
		if fisica != null and tipo != "arbol":
			fisica.polvo(mi.position + Vector3(0, 1, 0), Color(0.5, 0.46, 0.4), 30)

## 1 = disponible, 0 = agotado, talado o quemado.
func poner_nodo(id: String, estado: int) -> void:
	if not _nodos.has(id):
		return
	var n: Dictionary = _nodos[id]
	if n.has("mi"):
		(n["mi"] as Node3D).scale = Vector3.ONE * (1.0 if estado == 1 else (0.8 if n["yac"] else 0.35))
		return
	var base := Vector3(n["x"], altura(n["x"], n["z"]) - 0.05, n["z"])
	var s: float = n["s"]
	var t := Transform3D(Basis(Vector3.UP, n["r"]).scaled(Vector3.ONE * s), base)
	var cero := Transform3D(Basis().scaled(Vector3.ONE * 0.0001), base)
	var mm: MultiMesh = _mms[n["mm"]]
	if n["t"] == "arbol" and int(n.get("e", -1)) == 1 and estado == 0 and fisica != null:
		fisica.arbol_cae(base, mm.mesh, s, n["r"], randf() * TAU)
	n["e"] = estado
	if n.has("off"):
		mm.set_instance_transform(n["i"], t if estado == 1 else cero)
		(_mms[n["off"]] as MultiMesh).set_instance_transform(n["io"], cero if estado == 1 else t)
	else:
		# Los yacimientos no desaparecen: en reposo se ven algo hundidos (la veta se profundiza).
		var esc := s if estado == 1 else s * (0.8 if n.get("yac", false) else 0.35)
		mm.set_instance_transform(n["i"], Transform3D(Basis(Vector3.UP, n["r"]).scaled(Vector3.ONE * esc), base))

## Caminos: tiras de tierra sobre el terreno.
func trazar(d: Dictionary) -> void:
	if _caminos == null:
		return
	for h in _caminos.get_children():
		h.queue_free()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var color := Color(0.45, 0.36, 0.24)
	var hay := false
	for c in d["caminos"]:
		var p: Array = c["p"]
		var ancho := 0.9 if str(c["id"]).begins_with("calle") else 0.7
		for k in p.size() - 1:
			var a := Vector3(p[k][0], 0, p[k][1])
			var b := Vector3(p[k + 1][0], 0, p[k + 1][1])
			var dir := b - a
			if dir.length() < 0.01:
				continue
			var lado := Vector3(-dir.z, 0, dir.x).normalized() * ancho
			var pasos := int(ceil(dir.length() / 1.5))
			for s in pasos:
				var p0 := a + dir * (float(s) / pasos)
				var p1 := a + dir * (float(s + 1) / pasos)
				var q := [p0 - lado, p0 + lado, p1 + lado, p1 - lado]
				var ys: Array = []
				for v in q:
					ys.append(Vector3(v.x, altura(v.x, v.z) + 0.04, v.z))
				for tri in [[0, 1, 2], [0, 2, 3]]:
					for i in tri:
						st.set_color(color)
						st.set_normal(Vector3.UP)
						st.add_vertex(ys[i])
				hay = true
	if not hay:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = Mallas.material()
	_caminos.add_child(mi)

## Estación y clima en los materiales (transición suave).
func ambiente(estacion: String, clima: String) -> void:
	if not listo:
		return
	var nieve := 0.0
	if estacion == "invierno":
		nieve = 0.85 if clima == "nieve" else 0.5
	var humedo := 1.0 if clima in ["lluvia", "tormenta"] else 0.0
	var n_act := lerpf(float(_mat_terreno.get_shader_parameter("nieve")), nieve, 0.03)
	_mat_terreno.set_shader_parameter("nieve", n_act)
	_mat_terreno.set_shader_parameter("humedad", lerpf(float(_mat_terreno.get_shader_parameter("humedad")), humedo, 0.03))
	var viento := 0.9 if clima == "tormenta" else (0.5 if clima in ["lluvia", "nieve"] else 0.3)
	if Engine.get_process_frames() % 30 == 0:
		for f in _mats_veg:
			var mat := _mats_veg[f] as ShaderMaterial
			mat.set_shader_parameter("viento", viento)
			mat.set_shader_parameter("nieve", n_act)
		for fl in _flores:
			fl.visible = estacion in ["primavera", "verano"]

func luz_agua(luz: float) -> void:
	if _mat_agua:
		_mat_agua.set_shader_parameter("luz", luz)

# ------------------------------------------------------------------ entidades

func tono(tribu) -> float:
	return float(tonos.get(tribu, 0.1)) if tribu != null else 0.1

var _ultimo_dato := {}
var _edades := {}
var _remodelar: Array = []
var _reloj_remodelar := 0.0

func edad_de(tribu) -> int:
	return int(_edades.get(tribu, 1)) if tribu != null else 1

## Al subir de edad, los edificios de esa civilización se remodelan de a uno (con polvo de obra).
func _remodelacion(delta: float) -> void:
	_reloj_remodelar -= delta
	if _remodelar.is_empty() or _reloj_remodelar > 0.0:
		return
	_reloj_remodelar = 0.6
	var id: String = _remodelar.pop_front()
	if not _estructuras.has(id) or not _ultimo_dato.has(id):
		return
	var e: Dictionary = _ultimo_dato[id]
	var viejo: Node3D = _estructuras[id]
	var n := Modelos.estructura(e["t"], tono(e["tr"]), edad_de(e["tr"]), float(e.get("r", 2.0)))
	n.set_meta("edad", edad_de(e["tr"]))
	n.position = viejo.position
	n.rotation = viejo.rotation
	add_child(n)
	viejo.queue_free()
	_estructuras[id] = n
	_actualizar_estructura(n, e)
	if fisica != null:
		fisica.polvo(n.position + Vector3(0, 1.0, 0), Color(0.7, 0.66, 0.58), 16)

## Flechas y balas del motor: se dibujan donde están y se extrapolan entre estados; la flecha que cae queda clavada.
func _sincronizar_proyectiles(lista: Array) -> void:
	var vistos := {}
	for p in lista:
		var id: String = p[0]
		vistos[id] = true
		var pos := Vector3(float(p[2]), float(p[3]), float(p[4]))
		if not _proy.has(id):
			var nodo := MeshInstance3D.new()
			nodo.mesh = Fisica.malla_flecha() if p[1] == "flecha" else Fisica.malla_bala()
			nodo.material_override = Mallas.material()
			nodo.position = pos
			add_child(nodo)
			if p[1] == "bala" and fisica != null:
				fisica.polvo(pos, Color(0.86, 0.86, 0.84), 14)
			_proy[id] = {"n": nodo, "g": float(p[8]), "tipo": p[1]}
		var q: Dictionary = _proy[id]
		q["pos"] = pos
		q["vel"] = Vector3(float(p[5]), float(p[6]), float(p[7]))
	for id in _proy.keys():
		if not vistos.has(id):
			var q: Dictionary = _proy[id]
			if q["tipo"] == "flecha" and fisica != null:
				fisica.clavar(q["n"])
			else:
				(q["n"] as Node).queue_free()
			_proy.erase(id)

func _mover_proyectiles(delta: float) -> void:
	for id in _proy:
		var q: Dictionary = _proy[id]
		var v: Vector3 = q["vel"]
		var dt := delta * velocidad_sim
		v.y -= float(q["g"]) * dt
		q["vel"] = v
		q["pos"] = (q["pos"] as Vector3) + v * dt
		var n: Node3D = q["n"]
		n.position = q["pos"]
		if v.length_squared() > 0.01:
			n.look_at(n.position + v, Vector3.UP)
			n.rotate_object_local(Vector3.UP, PI)

func aplicar_tribus(lista: Array) -> void:
	for t in lista:
		var nueva := int(t.get("era", 1))
		if _edades.has(t["id"]) and int(_edades[t["id"]]) != nueva:
			_edades[t["id"]] = nueva
			for id in _estructuras:
				if _ultimo_dato.has(id) and _ultimo_dato[id]["tr"] == t["id"]:
					_remodelar.append(id)
		_edades[t["id"]] = nueva
	for t in lista:
		tonos[t["id"]] = float(t["color"])

func aplicar_estado(d: Dictionary) -> void:
	if not listo:
		return
	_sincronizar(colonos, d["colonos"], func(x): return _nuevo_colono(x))
	_sincronizar(animales, d["animales"], func(x): return Modelos.animal(x["e"]))
	_sincronizar_proyectiles(d.get("proyectiles", []))
	var vistos := {}
	for e in d["estructuras"]:
		var id: String = e["id"]
		vistos[id] = true
		if not _estructuras.has(id):
			var n := Modelos.estructura(e["t"], tono(e["tr"]), edad_de(e["tr"]), float(e.get("r", 2.0)))
			n.set_meta("edad", edad_de(e["tr"]))
			n.position = Vector3(e["x"], altura(e["x"], e["z"]), e["z"])
			n.rotation.y = float(e["rot"])
			add_child(n)
			_estructuras[id] = n
		if _ultimo_dato.has(id) and _ultimo_dato[id]["tr"] != e["tr"] and not _remodelar.has(id):
			# Cambió de dueño (conquista): se rehace con los colores del vencedor.
			_remodelar.append(id)
		_ultimo_dato[id] = e
		_actualizar_estructura(_estructuras[id], e)
	for id in _estructuras.keys():
		if not vistos.has(id) and fisica != null:
			var viejo: Node3D = _estructuras[id]
			fisica.escombros(viejo.position, Color(0.5, 0.45, 0.4), 12, 5.0)
			fisica.polvo(viejo.position + Vector3(0, 0.5, 0), Color(0.5, 0.47, 0.42), 30)
	_borrar(_estructuras, vistos)
	vistos = {}
	for k in d["cuerpos"]:
		var id: String = k["id"]
		vistos[id] = true
		if not _cuerpos.has(id):
			var n := _nuevo_cuerpo(k)
			n.position = Vector3(k["x"], altura(k["x"], k["z"]), k["z"])
			add_child(n)
			_cuerpos[id] = n
	_borrar(_cuerpos, vistos)
	_incendios(d["fuegos"])

func _nuevo_colono(x: Dictionary) -> Node3D:
	var n := Modelos.colono(x["ap"], tono(x["tr"]))
	var nombre := Label3D.new()
	nombre.name = "Nombre"
	nombre.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	nombre.position = Vector3(0, 2.15, 0)
	nombre.font_size = 15
	nombre.pixel_size = 0.0011
	nombre.fixed_size = true
	nombre.visibility_range_end = 70.0
	nombre.outline_size = 6
	nombre.modulate = Modelos.color_tribu(tono(x["tr"])).lightened(0.55)
	nombre.text = x["n"]
	nombre.no_depth_test = true
	n.add_child(nombre)
	var dice := Label3D.new()
	dice.name = "Dice"
	dice.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	dice.position = Vector3(0, 2.55, 0)
	dice.font_size = 14
	dice.pixel_size = 0.0011
	dice.fixed_size = true
	dice.visibility_range_end = 16.0
	dice.outline_size = 6
	dice.width = 300
	dice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dice.no_depth_test = true
	n.add_child(dice)
	var part := GPUParticles3D.new()
	part.name = "Particulas"
	part.amount = 6
	part.lifetime = 0.7
	part.explosiveness = 0.6
	part.emitting = false
	part.position = Vector3(0, 0.9, 0.55)
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0.4)
	pm.spread = 55.0
	pm.initial_velocity_min = 1.2
	pm.initial_velocity_max = 2.6
	pm.gravity = Vector3(0, -7, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	part.process_material = pm
	var q := BoxMesh.new()
	q.size = Vector3(0.028, 0.028, 0.028)
	var mq := StandardMaterial3D.new()
	mq.vertex_color_use_as_albedo = true
	mq.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	q.material = mq
	part.draw_pass_1 = q
	n.add_child(part)
	var fogonazo := OmniLight3D.new()
	fogonazo.name = "Fogonazo"
	fogonazo.light_color = Color(1.0, 0.75, 0.4)
	fogonazo.omni_range = 4.0
	fogonazo.light_energy = 0.0
	fogonazo.position = Vector3(0, 1.4, 0.8)
	n.add_child(fogonazo)
	return n

func _sincronizar(tabla: Dictionary, lista: Array, crear: Callable) -> void:
	var vistos := {}
	for x in lista:
		var id: String = x["id"]
		vistos[id] = true
		var obj := Vector3(x["x"], altura(x["x"], x["z"]), x["z"])
		if not tabla.has(id):
			var n: Node3D = crear.call(x)
			n.position = obj
			add_child(n)
			tabla[id] = {"nodo": n, "datos": x, "objetivo": obj, "rumbo": float(x["r"]), "fase": randf() * TAU, "tribu": x.get("tr")}
		var e: Dictionary = tabla[id]
		if x.has("tr") and e["tribu"] != x["tr"]:
			# Cambió de tribu (cisma): se viste con el color de la nueva.
			var viejo: Node3D = e["nodo"]
			var n2: Node3D = crear.call(x)
			n2.position = viejo.position
			add_child(n2)
			viejo.queue_free()
			e["nodo"] = n2
			e["tribu"] = x["tr"]
		e["datos"] = x
		e["objetivo"] = obj
		e["rumbo"] = float(x["r"])
	for id in tabla.keys():
		if not vistos.has(id):
			if fisica != null:
				fisica.desplomar(tabla[id]["nodo"])
			else:
				tabla[id]["nodo"].queue_free()
			tabla.erase(id)

func _borrar(tabla: Dictionary, vistos: Dictionary) -> void:
	for id in tabla.keys():
		if not vistos.has(id):
			tabla[id].queue_free()
			tabla.erase(id)

func _actualizar_estructura(n: Node3D, e: Dictionary) -> void:
	var p := clampf(float(e["p"]), 0.0, 1.0)
	var cuerpo: Node3D = n.get_node("Cuerpo")
	var terminado := p >= 1.0
	# Etapas de obra: cimientos y material (0–25 %), andamio y muros que suben (25–100 %).
	cuerpo.scale = Vector3(1, 1.0 if terminado else clampf((p - 0.25) / 0.75, 0.08, 1.0), 1)
	cuerpo.visible = terminado or p >= 0.25
	(n.get_node("Andamio") as Node3D).visible = not terminado and p >= 0.15
	(n.get_node("Cimientos") as Node3D).visible = not terminado and p < 0.6
	var fuego := n.get_node_or_null("Fuego")
	if fuego:
		fuego.visible = terminado and int(e["f"]) == 1
	var cultivo := cuerpo.get_node_or_null("Cultivo")
	if cultivo:
		var c := float(e["cu"])
		cultivo.visible = c > 0.02
		cultivo.scale = Vector3(1, max(0.05, c), 1)

func _nuevo_cuerpo(k: Dictionary) -> Node3D:
	var n := Node3D.new()
	var m := Mallas.new()
	match k["t"]:
		"colono":
			m.caja(Mallas.xf(Vector3(0, 0.15, 0)), Vector3(0.45, 0.25, 1.4), Color(0.4, 0.38, 0.36), 0.2)
			m.caja(Mallas.xf(Vector3(0, 0.22, 0.8)), Vector3(0.28, 0.25, 0.28), Color(0.55, 0.45, 0.38))
			var l := Label3D.new()
			l.text = "✝ " + str(k["n"])
			l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			l.position = Vector3(0, 1.0, 0)
			l.font_size = 14
			l.pixel_size = 0.0011
			l.fixed_size = true
			l.visibility_range_end = 60.0
			l.outline_size = 6
			l.modulate = Color(0.85, 0.85, 0.9)
			n.add_child(l)
		"animal":
			m.caja(Mallas.xf(Vector3(0, 0.12, 0)), Vector3(0.5, 0.22, 0.85), Color(0.45, 0.3, 0.24), 0.2)
		_:
			m.esfera(Mallas.xf(Vector3(0, 0.2, 0)), 0.35, 6, 3, Color(0.45, 0.44, 0.42) if "meteorito" in str(k["n"]) else Color(0.5, 0.38, 0.22), Vector3.ONE, 0.4, 3)
	var mi := MeshInstance3D.new()
	mi.mesh = m.malla()
	mi.material_override = Mallas.material()
	n.add_child(mi)
	return n

func _incendios(lista: Array) -> void:
	while _fuegos.size() < min(lista.size(), 60):
		var f := Node3D.new()
		Modelos._fuego(f, 1.3)
		add_child(f)
		_fuegos.append(f)
	for i in _fuegos.size():
		var f: Node3D = _fuegos[i]
		if i < lista.size():
			var x: float = lista[i][0]
			var z: float = lista[i][1]
			f.visible = true
			f.position = Vector3(x, altura(x, z), z)
			f.scale = Vector3.ONE * clampf(0.6 + float(lista[i][2]) * 0.6, 0.4, 1.3)
			(f.get_node("Fuego/Luz") as OmniLight3D).visible = i % 4 == 0
		else:
			f.visible = false

# ------------------------------------------------------------------ animación

func _process(delta: float) -> void:
	_t += delta
	_streaming(delta)
	_remodelacion(delta)
	_mover_proyectiles(delta)
	var k := 1.0 - exp(-7.0 * delta)
	var cam := get_viewport().get_camera_3d()
	for id in colonos:
		var e: Dictionary = colonos[id]
		var n: Node3D = e["nodo"]
		n.position = n.position.lerp(e["objetivo"], k)
		n.rotation.y = lerp_angle(n.rotation.y, e["rumbo"], k)
		if cam == null or cam.global_position.distance_squared_to(n.position) < 140.0 * 140.0:
			_animar_colono(e, delta)
	for id in animales:
		var e: Dictionary = animales[id]
		var n: Node3D = e["nodo"]
		n.position = n.position.lerp(e["objetivo"], k)
		if int(e["datos"]["mv"]) == 1:
			n.rotation.y = lerp_angle(n.rotation.y, e["rumbo"], k)
		if cam == null or cam.global_position.distance_squared_to(n.position) < 120.0 * 120.0:
			_animar_animal(e)

## Pose por actividad: [cuerpo_x, caderas_y, torso_x, hombroI, codoI, hombroD, codoD, piernaI, rodillaI, piernaD, rodillaD, cuello_x].
func _pose(a, mv: bool, t: float, d: Dictionary) -> Array:
	# [12] giro de cadera (tajos horizontales) · [13] avance de cadera (estocadas).
	var p := [0.0, 0.86, 0.0, 0.0, -0.15, 0.0, -0.15, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
	var arma = d["eq"][0]
	var distancia: bool = arma in ["arco", "arcabuz"]
	if a == "dormir":
		p[0] = -PI / 2; p[1] = 0.22; p[3] = -1.2; p[4] = -1.6; p[5] = -1.0; p[6] = -1.7; p[7] = -0.6; p[8] = 1.1; p[9] = -0.4; p[10] = 0.9; p[11] = 0.3
		return p
	if a == "derribado":
		p[0] = -PI / 2; p[1] = 0.2; p[3] = -0.5 + sin(t * 2.0) * 0.15; p[4] = -1.2; p[8] = 0.9; p[10] = 0.4
		return p
	if mv:
		var rapido: bool = a in ["huir", "pelear", "cazar"]
		var vel := 12.0 if rapido else 8.0
		var amp := 0.7 if rapido else 0.5
		var s := sin(t * vel)
		p[7] = s * amp; p[8] = maxf(0.0, -s) * amp * 1.4
		p[9] = -s * amp; p[10] = maxf(0.0, s) * amp * 1.4
		p[3] = -s * amp * (1.1 if rapido else 0.8); p[5] = s * amp * (1.1 if rapido else 0.8)
		p[4] = -1.15 if rapido else -0.35; p[6] = -1.15 if rapido else -0.35
		p[1] = 0.86 + absf(s) * (0.09 if rapido else 0.04) - (0.04 if rapido else 0.0)
		p[2] = 0.32 if rapido else 0.04
		p[11] = -0.15 if rapido else 0.0
		if d["cg"] != null:
			p[5] = -2.6; p[6] = -1.4
		return p
	match str(a):
		"talar", "minar":
			# Sube despacio y cae de golpe.
			var fase := fmod(t * 0.7, 1.0)
			var g := 1.0 - 2.0 * (pow(fase / 0.75, 0.6) if fase < 0.75 else 1.0 - (fase - 0.75) / 0.25)
			p[3] = -2.4 + (1.0 - g) * 1.1; p[5] = -2.4 + (1.0 - g) * 1.1
			p[4] = -0.4; p[6] = -0.4
			p[2] = 0.1 + (1.0 - g) * 0.25
			p[7] = 0.35; p[8] = 0.2; p[9] = -0.25
		"construir":
			var g := maxf(0.0, sin(t * 7.0))
			p[1] = 0.62; p[7] = -0.5; p[8] = 1.5; p[9] = 0.4; p[10] = 0.2
			p[2] = 0.35
			p[5] = -1.4 - g * 0.9; p[6] = -0.9 + g * 0.6
			p[3] = -0.9; p[4] = -0.6
		"recolectar", "forrajear", "cosechar", "sembrar", "curar", "depositar":
			p[1] = 0.55; p[7] = -1.2; p[8] = 2.2; p[9] = -1.0; p[10] = 2.0
			p[2] = 0.55
			p[3] = -1.1 + sin(t * 4.0) * 0.35; p[4] = -0.5
			p[5] = -1.1 + cos(t * 4.0) * 0.35; p[6] = -0.5
		"cocinar", "avivar", "fabricar":
			p[2] = 0.3
			p[5] = -1.1 + sin(t * 6.0) * 0.35; p[6] = -0.9
			p[3] = -0.9; p[4] = -0.8
		"investigar":
			if int(d.get("se", 0)) == 1:
				p[1] = 0.44; p[7] = -1.5; p[8] = 1.5; p[9] = -1.5; p[10] = 1.5
			p[3] = -0.7; p[4] = -1.2; p[5] = -0.8; p[6] = -1.4
			p[11] = 0.35
		"comer":
			p[5] = -1.5 + sin(t * 6.0) * 0.2; p[6] = -1.9
		"beber":
			p[1] = 0.45; p[7] = -1.0; p[8] = 2.4; p[9] = -1.0; p[10] = 2.4; p[2] = 0.7
			p[3] = -1.2; p[5] = -1.2 + sin(t * 3.0) * 0.4; p[6] = -1.2
		"ocio", "calentarse", "charlar":
			if int(d.get("se", 0)) == 1:
				# Sentado en un banco: muslos en horizontal sobre el asiento, piernas colgando.
				p[1] = 0.44; p[7] = -1.5; p[8] = 1.5; p[9] = -1.5; p[10] = 1.5
			elif a == "calentarse":
				# De pie junto al fuego, con las manos hacia las llamas.
				p[3] = -1.2; p[4] = -0.3; p[5] = -1.2; p[6] = -0.3; p[2] = 0.1
				return p
			if a == "charlar" or d["di"] != null:
				p[5] = -0.8 + sin(t * 3.0) * 0.4; p[6] = -1.0
			else:
				p[3] = -0.4; p[4] = -0.9; p[5] = -0.4; p[6] = -0.9
		"pelear", "cazar":
			# Fase del ataque del motor: 0 = recién golpeó … 1 = golpea ahora. Combo: 0 tajo, 1 horizontal, 2 estocada.
			var cb = d.get("cb")
			var ph: float = float(cb[0]) if cb != null else fmod(t, 1.0)
			var combo: int = int(cb[1]) if cb != null else 0
			if arma == "arco":
				if ph < 0.2:
					# Saca una flecha del carcaj.
					p[5] = -0.6 - ph * 5.0; p[6] = -2.2; p[3] = -0.6; p[4] = -0.3
				else:
					var tension := clampf((ph - 0.2) / 0.55, 0.0, 1.0)
					p[3] = -1.55; p[4] = -0.05
					p[5] = -1.5; p[6] = -0.4 - tension * 1.9
					p[2] = -0.05; p[11] = 0.08
				p[7] = 0.3; p[9] = -0.35; p[10] = 0.15
			elif arma == "arcabuz":
				p[3] = -1.45; p[4] = -0.35; p[5] = -1.3; p[6] = -0.55; p[11] = 0.12
				if ph < 0.08:
					# Retroceso del disparo.
					p[2] = -0.3; p[3] = -1.9; p[5] = -1.75
				elif ph < 0.7:
					# Recarga con la baqueta.
					p[3] = -0.7; p[4] = -1.2; p[5] = -2.4 + absf(sin(ph * 40.0)) * 0.6; p[6] = -0.4; p[2] = 0.15
				p[7] = 0.35; p[9] = -0.3; p[10] = 0.2
			else:
				# Cuerpo a cuerpo: anticipación lenta, golpe rápido y recuperación.
				var prep := clampf((ph - 0.15) / 0.6, 0.0, 1.0)
				var gol := clampf((ph - 0.78) / 0.2, 0.0, 1.0)
				var rec := clampf(1.0 - ph / 0.15, 0.0, 1.0)
				match combo:
					0:
						p[5] = lerpf(-0.6, -2.7, ease(prep, 0.5)) + gol * 2.3 + rec * 0.6
						p[6] = -0.9 + gol * 0.7
						p[2] = 0.05 + gol * 0.35 + rec * 0.3
					1:
						p[5] = -1.5
						p[6] = lerpf(-0.3, -1.6, prep) + gol * 1.4
						p[12] = lerpf(0.0, 0.7, prep) - gol * 1.3 - rec * 0.6
					_:
						p[5] = lerpf(-1.0, -1.3, prep) - gol * 0.3
						p[6] = lerpf(-0.3, -2.0, prep) + gol * 2.0
						p[13] = gol * 0.35 + rec * 0.2
						p[2] = 0.1 + gol * 0.25
				p[3] = -0.7; p[4] = -1.1
				p[7] = 0.45; p[8] = 0.25; p[9] = -0.35; p[10] = 0.2
		"vigilar":
			p[5] = -0.3; p[6] = -0.6
		"crisis":
			p[3] = -2.8; p[4] = -1.8; p[5] = -2.8; p[6] = -1.8; p[2] = 0.4 + sin(t * 9.0) * 0.1
		"jugar":
			p[1] = 0.86 + absf(sin(t * 6.0)) * 0.25
			p[3] = -2.5; p[5] = -2.5
		"<null>":
			# De pie, quieto: respira y cambia el peso de pierna.
			p[7] = sin(t * 0.5) * 0.06
			p[9] = -sin(t * 0.5) * 0.06
			p[3] = sin(t * 0.9) * 0.05
			p[5] = -sin(t * 0.9) * 0.05
	return p

func _animar_colono(e: Dictionary, delta: float) -> void:
	var d: Dictionary = e["datos"]
	var n: Node3D = e["nodo"]
	var cuerpo: Node3D = n.get_node("Cuerpo")
	var caderas: Node3D = cuerpo.get_node("Caderas")
	var hi: Node3D = caderas.get_node("BrazoI")
	var hd: Node3D = caderas.get_node("BrazoD")
	var ci: Node3D = hi.get_node("Codo")
	var cd: Node3D = hd.get_node("Codo")
	var pi_: Node3D = caderas.get_node("PiernaI")
	var pd: Node3D = caderas.get_node("PiernaD")
	var ri: Node3D = pi_.get_node("Rodilla")
	var rd: Node3D = pd.get_node("Rodilla")
	var cuello: Node3D = caderas.get_node("Cuello")
	var a = d["a"]
	var mv: bool = d["mv"]
	var t: float = _t + e["fase"]
	n.scale = Vector3.ONE * (0.62 if int(d["ni"]) == 1 else 1.0)
	# Zancada según la distancia recorrida de verdad (sin pies que patinan; si se frena, las piernas también).
	var ahora := Vector2(n.position.x, n.position.z)
	var antes: Vector2 = e.get("prev", ahora)
	e["prev"] = ahora
	e["paso"] = float(e.get("paso", 0.0)) + ahora.distance_to(antes) / n.scale.x
	var tp := t
	if mv:
		tp = float(e["paso"]) * 4.6 / (12.0 if a in ["huir", "pelear", "cazar"] else 8.0)
	var p := _pose(a, mv, tp, d)
	var f := minf(1.0, delta * 12.0)
	cuerpo.rotation.x = lerpf(cuerpo.rotation.x, p[0], minf(1.0, delta * 6.0))
	caderas.position.y = lerpf(caderas.position.y, p[1], f)
	caderas.rotation.x = lerpf(caderas.rotation.x, p[2], f)
	hi.rotation.x = lerpf(hi.rotation.x, p[3], f)
	ci.rotation.x = lerpf(ci.rotation.x, p[4], f)
	hd.rotation.x = lerpf(hd.rotation.x, p[5], f)
	cd.rotation.x = lerpf(cd.rotation.x, p[6], f)
	pi_.rotation.x = lerpf(pi_.rotation.x, p[7], f)
	ri.rotation.x = lerpf(ri.rotation.x, p[8], f)
	pd.rotation.x = lerpf(pd.rotation.x, p[9], f)
	rd.rotation.x = lerpf(rd.rotation.x, p[10], f)
	cuello.rotation.x = lerpf(cuello.rotation.x, p[11], f)
	# Reacción al recibir daño: un respingo hacia atrás.
	var vida := int(d["v"])
	if vida < int(e.get("vida", vida)):
		e["respingo"] = 0.35
	e["vida"] = vida
	if float(e.get("respingo", 0.0)) > 0.0:
		e["respingo"] = float(e["respingo"]) - delta
		caderas.rotation.x -= 0.5 * float(e["respingo"]) / 0.35
	# Estocada (avance de cadera) y reacciones: esquiva lateral, bloqueo con el brazo, o el golpe recibido.
	caderas.position.z = lerpf(caderas.position.z, p[13], f)
	var re := int(d.get("re", 0))
	if re != 0 and int(e.get("re_prev", 0)) == 0:
		e["reaccion"] = re
		e["t_reaccion"] = 0.45
		e["lado"] = -1.0 if randf() < 0.5 else 1.0
	e["re_prev"] = re
	var tr := float(e.get("t_reaccion", 0.0))
	if tr > 0.0:
		e["t_reaccion"] = tr - delta
		var k := sin(tr / 0.45 * PI)
		match int(e.get("reaccion", 0)):
			1:
				caderas.position.x = float(e["lado"]) * 0.45 * k
				caderas.rotation.z = -float(e["lado"]) * 0.35 * k
				pi_.rotation.x = -0.5 * k; ri.rotation.x = 0.9 * k
			2:
				hi.rotation.x = -1.95; ci.rotation.x = -1.35
				caderas.rotation.x -= 0.15 * k
			3:
				caderas.rotation.x -= 0.4 * k
				cuello.rotation.x -= 0.3 * k
	else:
		caderas.position.x = lerpf(caderas.position.x, 0.0, f)
		caderas.rotation.z = lerpf(caderas.rotation.z, 0.0, f)
	# Duerme bajo techo: entra en la casa (no se ve), como en AoE; afuera duerme sobre un petate.
	n.visible = int(d.get("dn", 0)) == 0
	var petate: Node3D = n.get_node_or_null("Petate")
	if a == "dormir" and n.visible:
		if petate == null:
			var pm := Mallas.new()
			pm.caja(Mallas.xf(Vector3(0, 0.03, -0.75)), Vector3(0.75, 0.06, 1.9), Color(0.55, 0.42, 0.28))
			pm.caja(Mallas.xf(Vector3(0, 0.08, -1.55)), Vector3(0.6, 0.1, 0.3), Color(0.7, 0.62, 0.48))
			petate = MeshInstance3D.new()
			petate.name = "Petate"
			(petate as MeshInstance3D).mesh = pm.malla()
			(petate as MeshInstance3D).material_override = Mallas.material()
			n.add_child(petate)
		petate.visible = true
	elif petate != null:
		petate.visible = false
	# Respiración.
	(caderas.get_node("Torso") as Node3D).scale.y = 1.0 + sin(t * 1.6) * 0.015
	# Cara: parpadeo, gesto según el ánimo y boca que habla.
	var cabeza: Node3D = cuello.get_node("Cabeza")
	var ojos: Node3D = cabeza.get_node("Ojos")
	var boca: Node3D = cabeza.get_node("Boca")
	var parpadeo := fmod(t + float(e["fase"]) * 3.0, 4.3) < 0.13
	ojos.scale.y = 0.12 if (parpadeo or a == "dormir" or a == "derribado") else 1.0
	var animo := int(d.get("an", 50))
	var hablando: bool = d["di"] != null
	boca.scale = Vector3(1.35 if animo > 65 else (0.75 if animo < 30 else 1.0), (1.0 + absf(sin(t * 14.0)) * 2.5) if hablando else 1.0, 1.0)
	boca.position.y = 0.065 + (0.006 if animo > 65 else (-0.006 if animo < 30 else 0.0))
	boca.rotation.z = 0.25 if animo < 20 else 0.0
	# Caderas que giran al caminar, cabeza que compensa; asentir al charlar; mirar alrededor quieto.
	if mv:
		caderas.rotation.y = sin(t * (12.0 if a in ["huir", "pelear", "cazar"] else 8.0)) * 0.12
		cuello.rotation.y = -caderas.rotation.y * 0.8
	else:
		caderas.rotation.y = lerpf(caderas.rotation.y, p[12], f * 1.4)
		if a == "charlar" or hablando:
			cuello.rotation.x = p[11] + sin(t * 4.0) * 0.12
		elif a == null and fmod(t * 0.2 + float(e["fase"]), 3.0) < 1.0:
			cuello.rotation.y = lerpf(cuello.rotation.y, sin(t * 0.8) * 0.7, f * 0.3)
	# Los niños tienen la cabeza más grande en proporción.
	cabeza.scale = Vector3.ONE * (1.25 if int(d["ni"]) == 1 else 1.0)
	_particulas(n, a, mv, t)
	cuello.rotation.y = sin(t * 0.7) * 0.8 if a == "vigilar" else lerpf(cuello.rotation.y, 0.0, minf(1.0, delta * 4.0))
	var eq: Array = d["eq"]
	Modelos.vestir(cuerpo, eq[3] if eq.size() > 3 else null)
	Modelos.abrigar(cuerpo, eq[2])
	var mano: Node3D = cd.get_node("Mano")
	var lleva = null
	if a in ["pelear", "cazar", "vigilar"] and eq[0] != null:
		lleva = eq[0]
	elif HERRAMIENTA_DE.has(a) and not mv:
		var h: String = HERRAMIENTA_DE[a]
		lleva = eq[1] if (eq[1] != null and str(eq[1]).begins_with(h)) else h
	elif d["cg"] != null and mv:
		lleva = d["cg"]
	if lleva != (mano.get_meta("lleva") if mano.has_meta("lleva") else null):
		for h in mano.get_children():
			h.queue_free()
		if lleva != null:
			var mi := MeshInstance3D.new()
			mi.mesh = Modelos.objeto(lleva)
			mi.material_override = Mallas.material()
			var largo := str(lleva)
			if largo.begins_with("lanza") or largo.begins_with("hacha") or largo.begins_with("pico") or largo.begins_with("espada") or largo in ["arco", "arcabuz", "martillo"]:
				mi.rotation = Vector3(PI / 2, 0, 0)
			mano.add_child(mi)
		mano.set_meta("lleva", lleva)
	var fog: OmniLight3D = n.get_node("Fogonazo")
	var disparo: bool = a in ["pelear", "cazar"] and eq[0] == "arcabuz" and fmod(t, 3.2) < 0.12
	fog.light_energy = 2.5 if disparo else 0.0
	var dice: Label3D = n.get_node("Dice")
	if a == "dormir":
		dice.text = "z z z"
		dice.modulate = Color(0.75, 0.82, 1.0, 0.8)
	elif d["cr"] != null:
		dice.text = "¡%s!" % str(d["cr"]).to_upper()
		dice.modulate = Color(1.0, 0.5, 0.45)
	elif d["di"] != null:
		dice.text = "«%s»" % d["di"]
		dice.modulate = Color(1, 1, 1)
	else:
		dice.text = ""

func _disparar(e: Dictionary, d: Dictionary, a, mv: bool, delta: float) -> void:
	var arma = d["eq"][0]
	if mv or not (a in ["pelear", "cazar"]) or not (arma in ["arco", "arcabuz"]) or d.get("ob") == null or fisica == null:
		return
	e["tiro"] = float(e.get("tiro", randf() * 1.5)) - delta
	if float(e["tiro"]) > 0.0:
		return
	var n: Node3D = e["nodo"]
	var ob: Array = d["ob"]
	var blanco := Vector3(float(ob[0]), altura(float(ob[0]), float(ob[1])) + 0.9, float(ob[1]))
	var mano := n.position + Vector3(0, 1.35, 0) + (blanco - n.position).normalized() * 0.5
	if arma == "arco":
		e["tiro"] = 1.8
		fisica.flecha(mano, blanco + Vector3(randf_range(-0.4, 0.4), randf_range(-0.3, 0.2), randf_range(-0.4, 0.4)))
	else:
		e["tiro"] = 3.2
		fisica.polvo(mano, Color(0.82, 0.82, 0.8), 14)
		fisica.polvo(blanco - Vector3(0, 0.8, 0), Color(0.5, 0.45, 0.38), 8)

const PARTICULAS := {"talar": Color(0.6, 0.45, 0.25), "minar": Color(0.6, 0.58, 0.55), "construir": Color(0.75, 0.62, 0.42), "fabricar": Color(1.0, 0.65, 0.2),
	"recolectar": Color(0.35, 0.6, 0.25), "cosechar": Color(0.45, 0.65, 0.25), "sembrar": Color(0.4, 0.3, 0.2), "beber": Color(0.55, 0.75, 0.95)}

## Astillas, polvo, chispas, hojas o gotas según lo que hace (solo cerca de la cámara).
func _particulas(n: Node3D, a, mv: bool, t: float) -> void:
	var part: GPUParticles3D = n.get_node("Particulas")
	var cam := get_viewport().get_camera_3d()
	var cerca := cam != null and cam.global_position.distance_squared_to(n.position) < 45.0 * 45.0
	var hace: bool = not mv and PARTICULAS.has(str(a)) and cerca
	if not hace:
		part.emitting = false
		return
	var col: Color = PARTICULAS[str(a)]
	var pm := part.process_material as ParticleProcessMaterial
	if pm.color != col:
		pm.color = col
	# Golpes: emite en el momento del impacto.
	var golpe := fmod(t * 0.7, 1.0) > 0.75 if str(a) in ["talar", "minar"] else true
	part.emitting = golpe

func _animar_animal(e: Dictionary) -> void:
	var d: Dictionary = e["datos"]
	var cuerpo: Node3D = e["nodo"].get_node("Cuerpo")
	var mv := int(d["mv"]) == 1
	var vel := 12.0 if d["s"] in ["huir", "cazar"] else 7.0
	var t: float = _t + e["fase"]
	for i in 4:
		var p := cuerpo.get_node_or_null("Pata%d" % i) as Node3D
		if p:
			var sgn := 1.0 if i in [0, 3] else -1.0
			p.rotation.x = sin(t * vel) * 0.6 * sgn if mv else lerpf(p.rotation.x, 0.0, 0.2)
	if d["e"] == "conejo" and mv:
		cuerpo.position.y = abs(sin(t * vel)) * 0.15
	else:
		cuerpo.position.y = abs(sin(t * vel * 2.0)) * 0.03 if mv else 0.0

# ------------------------------------------------------------------ consultas para cámara y selección

func posicion_de(id: String) -> Variant:
	if colonos.has(id):
		return colonos[id]["nodo"].position
	if animales.has(id):
		return animales[id]["nodo"].position
	return null

func colono_en(cam: Camera3D, cursor: Vector2) -> String:
	var mejor := ""
	var md := 40.0
	for id in colonos:
		var p: Vector3 = colonos[id]["nodo"].position + Vector3(0, 1.0, 0)
		if cam.is_position_behind(p):
			continue
		var d := cam.unproject_position(p).distance_to(cursor)
		if d < md:
			md = d
			mejor = id
	return mejor

func cuerpo_en(cam: Camera3D, cursor: Vector2) -> String:
	var mejor := ""
	var md := 45.0
	for id in _cuerpos:
		var p: Vector3 = _cuerpos[id].position
		if cam.is_position_behind(p):
			continue
		var d := cam.unproject_position(p).distance_to(cursor)
		if d < md:
			md = d
			mejor = id
	return mejor

func punto_en(cam: Camera3D, cursor: Vector2) -> Variant:
	var o := cam.project_ray_origin(cursor)
	var dir := cam.project_ray_normal(cursor)
	var t := 0.0
	while t < 900.0:
		var p := o + dir * t
		if p.x >= 0 and p.z >= 0 and p.x < tam and p.z < tam and p.y <= altura(p.x, p.z):
			return Vector3(p.x, altura(p.x, p.z), p.z)
		t += 0.5
	return null
