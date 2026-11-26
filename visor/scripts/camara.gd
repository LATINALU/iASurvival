# Cámara de juego de gestión: vista oblicua desde arriba que se mueve con WASD o las flechas (o arrastrando con
# el botón central), gira con Q/E y se acerca con la rueda. Además puede SEGUIR a un colono o ir en modo
# DIRECTOR (documental): corta sola a lo más interesante que pasa en el mundo.
class_name CamaraJuego
extends Camera3D

enum Modo { LIBRE, SEGUIR, DIRECTOR }

var modo := Modo.LIBRE
var mundo: Mundo3D
var sujeto := ""
var punto := Vector3(96, 0, 96)
var yaw := 0.0
var pitch := 0.95
var distancia := 38.0
var motivo := ""

var _arrastre := false
var _girando := false
var _eventos: Array = []
var _cambio := 0.0
var _dist_objetivo := 38.0

func _ready() -> void:
	far = 3200.0
	fov = 50.0

func registrar_evento(ev: Dictionary) -> void:
	_eventos.append({"ev": ev, "t": Time.get_ticks_msec() / 1000.0})
	if _eventos.size() > 40:
		_eventos.pop_front()
	if modo == Modo.DIRECTOR and int(ev.get("interes", 0)) >= 3:
		_cambio = 0.0

func seguir(id: String) -> void:
	sujeto = id
	modo = Modo.SEGUIR
	_dist_objetivo = min(distancia, 16.0)

func ir_a(p: Vector3) -> void:
	sujeto = ""
	if modo != Modo.DIRECTOR:
		modo = Modo.LIBRE
	punto = p

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		match e.button_index:
			MOUSE_BUTTON_MIDDLE:
				_arrastre = e.pressed
			MOUSE_BUTTON_RIGHT:
				_girando = e.pressed and e.shift_pressed
			MOUSE_BUTTON_WHEEL_UP:
				if e.pressed:
					_dist_objetivo = maxf(6.0, _dist_objetivo * 0.88)
			MOUSE_BUTTON_WHEEL_DOWN:
				if e.pressed:
					_dist_objetivo = minf(1100.0, _dist_objetivo * 1.13)
	elif e is InputEventMouseMotion:
		if _arrastre:
			if modo != Modo.LIBRE:
				modo = Modo.LIBRE
				sujeto = ""
			var factor := distancia * 0.0022
			punto -= Basis(Vector3.UP, yaw) * Vector3(e.relative.x, 0, e.relative.y) * factor
		elif _girando:
			yaw -= e.relative.x * 0.006
			pitch = clampf(pitch + e.relative.y * 0.004, 0.35, 1.45)

func _process(delta: float) -> void:
	if mundo == null or not mundo.listo:
		return
	var mover := Vector3.ZERO
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP): mover.z -= 1
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN): mover.z += 1
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT): mover.x -= 1
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT): mover.x += 1
	if Input.is_key_pressed(KEY_Q): yaw += delta * 1.6
	if Input.is_key_pressed(KEY_E): yaw -= delta * 1.6
	if mover != Vector3.ZERO:
		if modo != Modo.LIBRE:
			modo = Modo.LIBRE
			sujeto = ""
		punto += Basis(Vector3.UP, yaw) * mover.normalized() * delta * (10.0 + distancia * 0.9)
	if modo == Modo.DIRECTOR:
		_cambio -= delta
		if _cambio <= 0.0:
			_dirigir()
		yaw += delta * 0.04
	var objetivo := punto
	if sujeto != "":
		var p = mundo.posicion_de(sujeto)
		if p == null:
			sujeto = ""
			if modo == Modo.SEGUIR:
				modo = Modo.LIBRE
		else:
			punto = p
			objetivo = p + Vector3(0, 0.8, 0)
	punto.x = clampf(punto.x, 0, mundo.tam)
	punto.z = clampf(punto.z, 0, mundo.tam)
	objetivo.y = mundo.altura(objetivo.x, objetivo.z) + (0.8 if sujeto != "" else 0.0)
	distancia = lerpf(distancia, _dist_objetivo, 1.0 - exp(-6.0 * delta))
	var offset := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * distancia
	var deseada := objetivo + offset
	deseada.y = maxf(deseada.y, mundo.altura(deseada.x, deseada.z) + 1.5)
	var suave := 1.0 - exp(-(10.0 if modo == Modo.LIBRE else 3.0) * delta)
	position = position.lerp(deseada, suave)
	look_at(position - offset, Vector3.UP)

func _dirigir() -> void:
	var ahora := Time.get_ticks_msec() / 1000.0
	var mejor = null
	var mejor_p := 0.0
	for r in _eventos:
		var ev: Dictionary = r["ev"]
		var edad: float = ahora - r["t"]
		if edad > 40.0:
			continue
		var p := float(ev.get("interes", 0)) * 2.0 - edad / 10.0
		if p > mejor_p:
			mejor_p = p
			mejor = ev
	var planos := [[9.0, 0.45], [14.0, 0.6], [26.0, 0.85], [7.0, 0.3]]
	var plano: Array = planos[randi() % planos.size()]
	_dist_objetivo = plano[0]
	pitch = plano[1]
	_cambio = randf_range(10.0, 18.0)
	if mejor != null:
		_eventos = _eventos.filter(func(r): return r["ev"] != mejor)
		for a in mejor.get("actores", []):
			if mundo.colonos.has(a):
				sujeto = a
				motivo = str(mejor["texto"])
				return
		if mejor.get("x") != null:
			sujeto = ""
			punto = Vector3(mejor["x"], 0, mejor["z"])
			motivo = str(mejor["texto"])
			return
	var ids: Array = mundo.colonos.keys()
	if ids.is_empty():
		return
	sujeto = ids[randi() % ids.size()]
	var d: Dictionary = mundo.colonos[sujeto]["datos"]
	motivo = "%s, en su día a día" % d["n"]

## Punto del suelo que mira la cámara (para el detalle del terreno y el pasto).
func foco() -> Vector3:
	return punto
