## Física visible del mundo: árboles que caen girando sobre su base con gravedad y rebotan al tocar el suelo,
## flechas en trayectoria parabólica que se clavan, escombros que vuelan, rebotan y ruedan con fricción,
## colonos que se desploman al morir y polvo al impactar. Todo choca con la altura real del terreno.
class_name Fisica
extends Node3D

const G := 9.8

var mundo: Node3D
var _cuerpos: Array = []
var _mat: StandardMaterial3D

func _init(m: Node3D) -> void:
	mundo = m
	name = "Fisica"
	_mat = Mallas.material()

func _suelo(p: Vector3) -> float:
	return float(mundo.altura(p.x, p.z))

func _cerca(p: Vector3, r := 90.0) -> bool:
	var cam := get_viewport().get_camera_3d()
	return cam != null and cam.global_position.distance_squared_to(p) < r * r

# ------------------------------------------------------------------ altas

## Árbol talado: pivota en la base hacia `direccion` (ángulo en radianes) acelerando como una vara que cae.
func arbol_cae(base: Vector3, malla: Mesh, escala: float, giro: float, direccion: float) -> void:
	if not _cerca(base):
		return
	var pivote := Node3D.new()
	pivote.position = base
	pivote.rotation.y = direccion
	add_child(pivote)
	var mi := MeshInstance3D.new()
	mi.mesh = malla
	mi.material_override = _mat
	mi.rotation.y = giro - direccion
	mi.scale = Vector3.ONE * escala
	pivote.add_child(mi)
	_cuerpos.append({"t": "arbol", "n": pivote, "th": 0.04, "w": 0.0, "L": 4.5 * escala, "vida": 7.0, "golpes": 0})

static func malla_flecha() -> Mesh:
	var m := Mallas.new()
	m.cilindro(Mallas.xf(Vector3(0, 0, -0.35), Vector3(PI / 2, 0, 0)), 0.012, 0.012, 0.7, 4, Color(0.55, 0.42, 0.25))
	m.cilindro(Mallas.xf(Vector3(0, 0, 0.35), Vector3(PI / 2, 0, 0)), 0.03, 0.0, 0.08, 4, Color(0.4, 0.4, 0.42))
	m.caja(Mallas.xf(Vector3(0, 0, -0.32)), Vector3(0.07, 0.005, 0.1), Color(0.9, 0.9, 0.85))
	return m.malla()

static func malla_bala() -> Mesh:
	var m := Mallas.new()
	m.esfera(Mallas.xf(), 0.035, 5, 3, Color(0.25, 0.25, 0.27))
	m.cilindro(Mallas.xf(Vector3(0, 0, -0.5), Vector3(PI / 2, 0, 0)), 0.01, 0.0, 0.5, 4, Color(0.95, 0.85, 0.6))
	return m.malla()

## Deja un proyectil clavado donde cayó (2,5 s y se hunde).
func clavar(n: Node3D) -> void:
	if n.get_parent() != null:
		n.get_parent().remove_child(n)
	add_child(n)
	_cuerpos.append({"t": "fija", "n": n, "vida": 2.5})

## Flecha (o virote) de `a` hacia `b`: velocidad inicial resuelta para caer en el blanco con gravedad.
func flecha(a: Vector3, b: Vector3) -> void:
	if not _cerca(a, 70.0):
		return
	var d := a.distance_to(b)
	var tvuelo := clampf(d / 24.0, 0.15, 1.6)
	var v := (b - a - Vector3(0, -0.5 * G * tvuelo * tvuelo, 0)) / tvuelo
	var m := Mallas.new()
	m.cilindro(Mallas.xf(Vector3(0, 0, -0.35), Vector3(PI / 2, 0, 0)), 0.012, 0.012, 0.7, 4, Color(0.55, 0.42, 0.25))
	m.cilindro(Mallas.xf(Vector3(0, 0, 0.35), Vector3(PI / 2, 0, 0)), 0.03, 0.0, 0.08, 4, Color(0.4, 0.4, 0.42))
	m.caja(Mallas.xf(Vector3(0, 0, -0.32)), Vector3(0.07, 0.005, 0.1), Color(0.9, 0.9, 0.85))
	var n := MeshInstance3D.new()
	n.mesh = m.malla()
	n.material_override = _mat
	n.position = a
	add_child(n)
	_cuerpos.append({"t": "flecha", "n": n, "v": v, "vida": 4.0, "clavada": false, "meta": tvuelo + 0.05})

## Escombros: piedras, astillas o tejas que salen despedidas desde `p`.
func escombros(p: Vector3, color: Color, cuantos: int, fuerza: float) -> void:
	if not _cerca(p, 120.0):
		return
	for i in cuantos:
		var m := Mallas.new()
		var tam := randf_range(0.12, 0.35)
		m.esfera(Mallas.xf(), tam, 5, 3, color.darkened(randf() * 0.3), Vector3(randf_range(0.7, 1.3), randf_range(0.6, 1.1), randf_range(0.7, 1.3)), 0.35, i)
		var n := MeshInstance3D.new()
		n.mesh = m.malla()
		n.material_override = _mat
		n.position = p + Vector3(randf_range(-0.5, 0.5), 0.4, randf_range(-0.5, 0.5))
		add_child(n)
		var ang := randf() * TAU
		var v := Vector3(cos(ang), 0, sin(ang)) * randf_range(0.3, 1.0) * fuerza + Vector3(0, randf_range(0.6, 1.2) * fuerza, 0)
		_cuerpos.append({"t": "escombro", "n": n, "v": v, "w": Vector3(randf_range(-8, 8), randf_range(-8, 8), randf_range(-8, 8)), "r": tam, "vida": 9.0})

## Un colono que muere: el cuerpo se desploma hacia atrás o hacia un lado con gravedad (luego queda el túmulo).
func desplomar(nodo: Node3D) -> void:
	if not _cerca(nodo.position):
		nodo.queue_free()
		return
	var pos := nodo.global_position
	var rot := nodo.rotation.y
	nodo.get_parent().remove_child(nodo)
	var pivote := Node3D.new()
	pivote.position = pos
	pivote.rotation.y = rot + (PI if randf() < 0.6 else (PI / 2 if randf() < 0.5 else -PI / 2))
	add_child(pivote)
	nodo.position = Vector3.ZERO
	nodo.rotation = Vector3(0, -pivote.rotation.y + rot, 0)
	pivote.add_child(nodo)
	_cuerpos.append({"t": "cuerpo", "n": pivote, "th": 0.05, "w": 0.0, "L": 1.6, "vida": 4.0, "golpes": 0})

## Nube de polvo al impactar (partículas que suben, se frenan y caen).
func polvo(p: Vector3, color := Color(0.6, 0.55, 0.45), cantidad := 18) -> void:
	if not _cerca(p, 70.0):
		return
	var part := GPUParticles3D.new()
	part.amount = cantidad
	part.lifetime = 1.1
	part.one_shot = true
	part.explosiveness = 0.95
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 80.0
	pm.initial_velocity_min = 0.8
	pm.initial_velocity_max = 2.4
	pm.gravity = Vector3(0, -2.5, 0)
	pm.damping_min = 1.5
	pm.damping_max = 3.0
	pm.scale_min = 0.6
	pm.scale_max = 1.4
	pm.color = color
	part.process_material = pm
	var q := BoxMesh.new()
	q.size = Vector3(0.09, 0.09, 0.09)
	var mq := StandardMaterial3D.new()
	mq.vertex_color_use_as_albedo = true
	mq.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	q.material = mq
	part.draw_pass_1 = q
	part.position = p
	add_child(part)
	part.emitting = true
	get_tree().create_timer(1.6).timeout.connect(part.queue_free)

# ------------------------------------------------------------------ integración

func _process(delta: float) -> void:
	var dt := minf(delta, 1.0 / 30.0)
	var vivos: Array = []
	for c in _cuerpos:
		c["vida"] = float(c["vida"]) - delta
		var n: Node3D = c["n"]
		if float(c["vida"]) <= 0.0 or not is_instance_valid(n):
			if is_instance_valid(n):
				n.queue_free()
			continue
		match str(c["t"]):
			"arbol", "cuerpo":
				_pivote(c, dt)
			"flecha":
				_flecha(c, dt)
			"escombro":
				_escombro(c, dt)
		# Últimos 1.2 s: se hunde en el suelo para desaparecer sin parpadeos.
		if float(c["vida"]) < 1.2 and str(c["t"]) != "flecha":
			n.position.y -= dt * 0.6
		vivos.append(c)
	_cuerpos = vivos

## Vara rígida que gira sobre su base: α = (3g / 2L)·sin θ. Al llegar al suelo rebota con pérdida y se asienta.
func _pivote(c: Dictionary, dt: float) -> void:
	var n: Node3D = c["n"]
	var th: float = c["th"]
	var w: float = c["w"]
	var L: float = c["L"]
	var suelo := PI / 2.0 - 0.06
	if th < suelo or absf(w) > 0.01:
		w += (3.0 * G / (2.0 * L)) * sin(th) * dt
		th += w * dt
		if th >= suelo:
			th = suelo
			if absf(w) > 0.6 and int(c["golpes"]) < 2:
				w = -w * 0.22
				c["golpes"] = int(c["golpes"]) + 1
				if int(c["golpes"]) == 1:
					var punta := n.global_position + n.global_transform.basis.y * (L * 0.7)
					punta.y = _suelo(punta)
					polvo(punta, Color(0.45, 0.5, 0.3) if str(c["t"]) == "arbol" else Color(0.55, 0.5, 0.42), 22 if str(c["t"]) == "arbol" else 10)
			else:
				w = 0.0
	c["th"] = th
	c["w"] = w
	n.rotation.x = th

func _flecha(c: Dictionary, dt: float) -> void:
	var n: Node3D = c["n"]
	if c["clavada"]:
		return
	var v: Vector3 = c["v"]
	v.y -= G * dt
	n.position += v * dt
	c["v"] = v
	c["meta"] = float(c["meta"]) - dt
	if v.length_squared() > 0.01:
		n.look_at(n.position + v, Vector3.UP)
		n.rotate_object_local(Vector3.UP, PI)
	if n.position.y <= _suelo(n.position) + 0.05 or float(c["meta"]) <= 0.0:
		# Se clava (en el suelo o en el blanco) y queda vibrando un instante.
		c["clavada"] = true
		c["vida"] = minf(float(c["vida"]), 2.5)

func _escombro(c: Dictionary, dt: float) -> void:
	var n: Node3D = c["n"]
	var v: Vector3 = c["v"]
	var w: Vector3 = c["w"]
	v.y -= G * dt
	n.position += v * dt
	n.rotation += w * dt
	var piso := _suelo(n.position) + float(c["r"]) * 0.6
	if n.position.y < piso:
		n.position.y = piso
		if v.y < -1.2:
			v.y = -v.y * 0.35
			v.x *= 0.6
			v.z *= 0.6
			w *= 0.5
		else:
			# Rueda y se frena por fricción hasta quedar quieto.
			v.y = 0.0
			v.x = move_toward(v.x, 0.0, 6.0 * dt)
			v.z = move_toward(v.z, 0.0, 6.0 * dt)
			w = w.move_toward(Vector3.ZERO, 12.0 * dt)
	c["v"] = v
	c["w"] = w
