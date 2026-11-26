# iASurvival — el juego: arranca el motor, muestra el valle en 3D, deja mirar y elegir colonos, y usar poderes
# de dios. Argumentos de prueba (después de `--`): --auto=nuevo|continuar --semilla=N --tribus=N --colonos=N
# --servidor=ws://… --captura=ruta.png --tras=segundos --velocidad=N --seguir=1 --poder=id
extends Node3D

var red: Red
var mundo: Mundo3D
var camara: CamaraJuego
var ui: Interfaz
var lanzador: Lanzador
var menu: MenuInicio
var sol: DirectionalLight3D
var entorno: Environment
var cielo: ProceduralSkyMaterial
var lluvia: GPUParticles3D
var nieve: GPUParticles3D
var _estado := {}
var _args := {}
var _captura := ""
var _tras := 10.0
var _seleccion := ""
var _poder = null
var _consulta := 0.0
var _velocidad := 1.0
var _antes_pausa := 1.0
var _poder_prueba_hecho := false
var _vitrina_hecha := false
var _centrado := false

func _ready() -> void:
	for a in OS.get_cmdline_user_args() + OS.get_cmdline_args():
		if a.begins_with("--") and "=" in a:
			var p: PackedStringArray = a.substr(2).split("=", true, 1)
			_args[p[0]] = p[1]
	_captura = _args.get("captura", "")
	_tras = float(_args.get("tras", "10"))
	get_tree().auto_accept_quit = false

	entorno = Environment.new()
	cielo = ProceduralSkyMaterial.new()
	var sky := Sky.new()
	sky.sky_material = cielo
	entorno.background_mode = Environment.BG_SKY
	entorno.sky = sky
	entorno.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	entorno.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	entorno.tonemap_exposure = 0.95
	entorno.adjustment_enabled = true
	entorno.adjustment_saturation = 1.05
	entorno.adjustment_contrast = 1.08
	entorno.ssao_enabled = true
	entorno.ssao_radius = 1.2
	entorno.ssao_intensity = 1.4
	entorno.fog_enabled = true
	entorno.fog_density = 0.0016
	entorno.fog_aerial_perspective = 0.5
	entorno.glow_enabled = false
	var we := WorldEnvironment.new()
	we.environment = entorno
	add_child(we)
	sol = DirectionalLight3D.new()
	sol.shadow_enabled = true
	sol.directional_shadow_max_distance = 120.0
	add_child(sol)

	mundo = Mundo3D.new()
	add_child(mundo)
	camara = CamaraJuego.new()
	camara.mundo = mundo
	camara.position = Vector3(288, 120, 400)
	add_child(camara)
	camara.make_current()
	lluvia = _particulas(false)
	nieve = _particulas(true)
	ui = Interfaz.new()
	add_child(ui)
	ui.velocidad.connect(_fijar_velocidad)
	ui.poder.connect(_elegir_poder)
	ui.ver_tribu.connect(_ver_tribu)
	ui.cerrar_ficha.connect(func(): _seleccion = ""; ui.mostrar_ficha(null))
	red = Red.new()
	red.mensaje.connect(_mensaje)
	red.conexion.connect(ui.conexion)
	add_child(red)
	_luz(0.3, 1.0, "despejado")
	lanzador = Lanzador.new()
	add_child(lanzador)
	lanzador.listo.connect(_motor_listo)
	lanzador.error.connect(func(t): menu.fallo(t))
	menu = MenuInicio.new()
	add_child(menu)
	menu.empezar.connect(func(nuevo, op): lanzador.arrancar(nuevo, op))
	menu.salir.connect(_salir)
	if _args.has("servidor"):
		menu.visible = false
		_motor_listo(_args["servidor"])
	elif _args.has("auto"):
		menu.visible = false
		lanzador.arrancar(_args["auto"] == "nuevo", {"semilla": int(_args.get("semilla", "1")), "tribus": int(_args.get("tribus", "3")), "colonos": int(_args.get("colonos", "5")), "tam": int(_args.get("tam", "1536"))})
	else:
		menu.mostrar(lanzador.hay_partida())

func _particulas(es_nieve: bool) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 1800 if es_nieve else 2600
	p.lifetime = 3.0 if es_nieve else 1.1
	p.visibility_aabb = AABB(Vector3(-40, -30, -40), Vector3(80, 60, 80))
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = Vector3(35, 1, 35)
	m.direction = Vector3(0.1, -1, 0)
	m.spread = 6.0 if not es_nieve else 25.0
	m.initial_velocity_min = 16.0 if not es_nieve else 1.5
	m.initial_velocity_max = 20.0 if not es_nieve else 2.5
	m.gravity = Vector3(0, -9.8, 0) if not es_nieve else Vector3(0.3, -0.6, 0)
	p.process_material = m
	var q: PrimitiveMesh = BoxMesh.new() if not es_nieve else SphereMesh.new()
	if es_nieve:
		(q as SphereMesh).radius = 0.05
		(q as SphereMesh).height = 0.1
		(q as SphereMesh).radial_segments = 4
		(q as SphereMesh).rings = 2
	else:
		(q as BoxMesh).size = Vector3(0.015, 0.45, 0.015)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.75, 0.8, 0.9, 0.55) if not es_nieve else Color(1, 1, 1, 0.9)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	q.material = mat
	p.draw_pass_1 = q
	p.emitting = false
	add_child(p)
	return p

func _motor_listo(url: String) -> void:
	menu.visible = false
	red.conectar(url)

func _mensaje(d: Dictionary) -> void:
	match d.get("t", ""):
		"inicio":
			mundo.construir(d)
			ui.cargar_poderes(d.get("poderes", []))
			camara.punto = Vector3(mundo.tam / 2.0, 0, mundo.tam / 2.0)
		"tribus":
			mundo.aplicar_tribus(d["tribus"])
			ui.tribus(d["tribus"])
			if not _centrado and not d["tribus"].is_empty():
				_centrado = true
				var t: Dictionary = d["tribus"][0]
				camara.punto = Vector3(t["cx"], 0, t["cz"])
		"historia":
			for ev in d["eventos"]:
				ui.suceso(ev)
				if ev.get("x") != null and mundo.fisica != null:
					var p := Vector3(float(ev["x"]), mundo.altura(float(ev["x"]), float(ev["z"])), float(ev["z"]))
					match str(ev["tipo"]):
						"meteorito":
							mundo.fisica.escombros(p, Color(0.35, 0.3, 0.28), 26, 11.0)
							mundo.fisica.polvo(p + Vector3(0, 0.5, 0), Color(0.45, 0.4, 0.36), 40)
						"terremoto", "derrumbe":
							mundo.fisica.escombros(p, Color(0.5, 0.45, 0.4), 10, 4.0)
		"estado":
			_estado = d
			_velocidad = float(d.get("velocidad", 1.0))
			mundo.aplicar_estado(d)
			ui.estado(d)
			_luz(float(d["tiempo"]), float(d["luz"]), d["clima"])
			mundo.ambiente(d["estacion"], d["clima"])
			mundo.velocidad_sim = float(d.get("velocidad", 1.0))
			for c in d["colonos"]:
				if c["di"] != null and not mundo.colonos.get(c["id"], {}).get("dijo_visto", "") == c["di"]:
					if mundo.colonos.has(c["id"]):
						mundo.colonos[c["id"]]["dijo_visto"] = c["di"]
						if camara.sujeto == c["id"] or _seleccion == c["id"] or (camara.position.distance_to(Vector3(c["x"], 0, c["z"])) < 45.0):
							ui.dice(c["n"], c["di"])
		"trazado":
			mundo.trazar(d)
		"nodos_nuevos":
			mundo.agregar_nodos(d["nodos"])
		"nodos":
			for n in d["nodos"]:
				mundo.poner_nodo(n[0], int(n[1]))
		"eventos":
			for ev in d["eventos"]:
				ui.suceso(ev)
				camara.registrar_evento(ev)
		"respuesta":
			if d.get("pedido") == "ficha" and d.get("ok", false):
				if d["id"] == _seleccion:
					ui.mostrar_ficha(d)
			elif d.get("pedido") == "poder":
				ui.avisar(str(d.get("mensaje", d.get("error", ""))))

## Sol, cielo y ambiente según la hora y el clima (sin parpadeos).
func _luz(tiempo: float, luz: float, clima: String) -> void:
	var elev := sin((tiempo - 0.25) * TAU)
	var nublado := 0.55 if clima in ["lluvia", "tormenta", "nieve"] else (0.25 if clima in ["nublado", "niebla"] else 0.0)
	sol.rotation = Vector3(-maxf(0.15, absf(elev)) * 1.15, tiempo * TAU + 0.6, 0)
	if elev > -0.05:
		var tarde := clampf(1.0 - elev * 2.5, 0.0, 1.0)
		sol.light_color = Color(1.0, 0.95, 0.86).lerp(Color(1.0, 0.64, 0.4), tarde)
		sol.light_energy = clampf(elev * 1.6, 0.15, 1.2) * (1.0 - nublado * 0.7)
	else:
		sol.light_color = Color(0.55, 0.65, 0.95)
		sol.light_energy = 0.16
	var dia := Color(0.38, 0.58, 0.85).lerp(Color(0.5, 0.55, 0.6), nublado)
	var noche := Color(0.03, 0.05, 0.1)
	cielo.sky_top_color = noche.lerp(dia, luz)
	cielo.sky_horizon_color = Color(0.08, 0.1, 0.15).lerp(Color(0.62, 0.72, 0.8).lerp(Color(0.55, 0.58, 0.6), nublado), luz)
	cielo.ground_horizon_color = cielo.sky_horizon_color
	cielo.ground_bottom_color = Color(0.05, 0.06, 0.06)
	entorno.ambient_light_energy = lerpf(0.22, 0.7, luz)
	entorno.fog_light_color = cielo.sky_horizon_color
	entorno.fog_density = 0.012 if clima == "niebla" else (0.004 if nublado > 0.4 else 0.0016)
	lluvia.emitting = clima in ["lluvia", "tormenta"]
	nieve.emitting = clima == "nieve"
	mundo.luz_agua(luz)

func _process(delta: float) -> void:
	lluvia.global_position = camara.global_position + Vector3(0, 14, 0) - camara.global_basis.z * 15.0
	nieve.global_position = lluvia.global_position
	ui.motivo(camara.motivo if camara.modo == CamaraJuego.Modo.DIRECTOR else "")
	# Ficha del seleccionado: se pide al motor una vez por segundo.
	_consulta -= delta
	if _seleccion != "" and _consulta <= 0.0 and red.conectado():
		_consulta = 1.0
		red.enviar({"tipo": "ficha", "id": _seleccion})
	_pruebas(delta)

## Automatismos de prueba (capturas, seguir a alguien, usar un poder).
func _pruebas(delta: float) -> void:
	if _args.has("velocidad") and red.conectado() and not _args.has("_vel_ok"):
		_args["_vel_ok"] = true
		_fijar_velocidad(float(_args["velocidad"]))
	if _args.has("seguir") and _seleccion == "" and not mundo.colonos.is_empty():
		_seleccion = mundo.colonos.keys()[0]
		camara.seguir(_seleccion)
		if _args.has("cerca"):
			camara._dist_objetivo = float(_args["cerca"])
			camara.pitch = 0.45
	if _args.has("vitrina") and mundo.listo and not _vitrina_hecha:
		_vitrina_hecha = true
		_vitrina(str(_args["vitrina"]))
	if _args.has("retrato") and _seleccion != "" and mundo.colonos.has(_seleccion):
		camara.yaw = float(mundo.colonos[_seleccion]["nodo"].rotation.y)
		camara.pitch = 0.18
		camara._dist_objetivo = float(_args["retrato"])
	if _args.has("poder") and not _poder_prueba_hecho and not mundo.colonos.is_empty() and _tras < 4.0:
		_poder_prueba_hecho = true
		var p = mundo.posicion_de(mundo.colonos.keys()[0])
		red.enviar({"tipo": "poder", "poder": _args["poder"], "x": p.x + 3, "z": p.z + 3})
	if _captura != "" and mundo.listo:
		_tras -= delta
		if _tras <= 0.0:
			get_viewport().get_texture().get_image().save_png(_captura)
			print("captura guardada en ", _captura, " · FPS ", Engine.get_frames_per_second())
			_captura = ""
			_salir()

func _fijar_velocidad(v: float) -> void:
	if v > 0.0:
		_antes_pausa = v
	red.enviar({"tipo": "velocidad", "valor": v})

func _elegir_poder(def: Dictionary) -> void:
	if def["objetivo"] == "mundo":
		red.enviar({"tipo": "poder", "poder": def["id"]})
		_poder = null
		ui.poder_activo(null)
		return
	_poder = def
	ui.poder_activo(def)

func _ver_tribu(id: String) -> void:
	for t in mundo.tonos.keys():
		pass
	var p = null
	for c in mundo.colonos:
		if mundo.colonos[c]["datos"]["tr"] == id:
			p = mundo.colonos[c]["nodo"].position
			break
	if p != null:
		camara.ir_a(p)

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_LEFT:
			_clic(e.position)
		elif e.button_index == MOUSE_BUTTON_RIGHT and not e.shift_pressed:
			_poder = null
			ui.poder_activo(null)
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.keycode:
			KEY_SPACE:
				_fijar_velocidad(0.0 if _velocidad > 0.0 else _antes_pausa)
			KEY_1: _fijar_velocidad(1.0)
			KEY_2: _fijar_velocidad(2.0)
			KEY_3: _fijar_velocidad(4.0)
			KEY_4: _fijar_velocidad(8.0)
			KEY_5: _fijar_velocidad(16.0)
			KEY_6: _fijar_velocidad(32.0)
			KEY_7: _fijar_velocidad(64.0)
			KEY_8: _fijar_velocidad(128.0)
			KEY_F:
				if _seleccion != "":
					camara.seguir(_seleccion)
			KEY_TAB:
				camara.modo = CamaraJuego.Modo.DIRECTOR if camara.modo != CamaraJuego.Modo.DIRECTOR else CamaraJuego.Modo.LIBRE
			KEY_H:
				ui.visible = not ui.visible
			KEY_F11:
				var w := get_window()
				w.mode = Window.MODE_WINDOWED if w.mode == Window.MODE_FULLSCREEN else Window.MODE_FULLSCREEN
			KEY_ESCAPE:
				if _poder != null:
					_poder = null
					ui.poder_activo(null)
				elif _seleccion != "":
					_seleccion = ""
					ui.mostrar_ficha(null)
				else:
					_salir()

func _clic(pos: Vector2) -> void:
	if _poder != null:
		var def: Dictionary = _poder
		match def["objetivo"]:
			"colono":
				var id := mundo.colono_en(camara, pos)
				if id == "":
					ui.avisar("Haz clic sobre un colono")
					return
				red.enviar({"tipo": "poder", "poder": def["id"], "objetivo": id})
			"cuerpo":
				var k := mundo.cuerpo_en(camara, pos)
				if k == "":
					ui.avisar("Haz clic sobre el cuerpo de un colono")
					return
				red.enviar({"tipo": "poder", "poder": def["id"], "objetivo": k})
			_:
				var p = mundo.punto_en(camara, pos)
				if p == null:
					return
				red.enviar({"tipo": "poder", "poder": def["id"], "x": p.x, "z": p.z})
		if not Input.is_key_pressed(KEY_SHIFT):
			_poder = null
			ui.poder_activo(null)
		return
	var id := mundo.colono_en(camara, pos)
	if id != "":
		_seleccion = id
		_consulta = 0.0
	elif _seleccion != "":
		_seleccion = ""
		ui.mostrar_ficha(null)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_salir()

## Pide al motor que guarde y se cierre; si no contesta, lo cierra igual.
func _salir() -> void:
	if red.conectado():
		red.enviar({"tipo": "salir"})
		await get_tree().create_timer(1.5).timeout
	lanzador.detener()
	get_tree().quit()


## Prueba visual: una fila de edificios (separados por coma) en las 4 edades, junto a la cámara.
func _vitrina(lista: String) -> void:
	var tipos := lista.split(",")
	var base: Vector3 = camara.punto
	for i in tipos.size():
		for edad in [1, 2, 3, 4]:
			var x := base.x - 24.0 + i * 13.0
			var z: float = base.z - 18.0 + (edad - 1) * 13.0
			var n := Modelos.estructura(tipos[i], 0.35, edad, 3.0)
			n.position = Vector3(x, mundo.altura(x, z), z)
			n.rotation.y = 0.5
			mundo.add_child(n)
	camara.modo = camara.Modo.LIBRE
	camara.sujeto = ""
	camara.punto = base + Vector3(tipos.size() * 6.0 - 24.0, 0, 2.0)
	camara._dist_objetivo = 70.0
