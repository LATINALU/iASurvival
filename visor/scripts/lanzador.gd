# Arranca el motor de la simulación (node + servidor empaquetado) como proceso hijo y avisa cuando está listo.
# Exportado: <carpeta del .exe>/motor/node.exe + servidor.mjs. En el editor: `node servidor/src/principal.ts`.
class_name Lanzador
extends Node

signal listo(url_ws: String)
signal error(texto: String)

var pid := -1
var puerto := 0
var _http: HTTPRequest
var _espera := 0.0
var _intentando := false

func carpeta_datos() -> String:
	return OS.get_user_data_dir().path_join("bosque")

func hay_partida() -> bool:
	return FileAccess.file_exists(carpeta_datos().path_join("mundo.json"))

func _rutas() -> Dictionary:
	var dir_exe := OS.get_executable_path().get_base_dir()
	var motor := dir_exe.path_join("motor")
	if FileAccess.file_exists(motor.path_join("servidor.mjs")):
		return {"node": motor.path_join("node.exe"), "script": motor.path_join("servidor.mjs"), "docs": motor.path_join("API.md")}
	# Desarrollo: desde el proyecto de Godot, el servidor está en ../servidor.
	var srv := ProjectSettings.globalize_path("res://").path_join("../servidor").simplify_path()
	return {"node": "node", "script": srv.path_join("src/principal.ts"), "docs": srv.path_join("../docs/API.md").simplify_path()}

## Arranca el motor. `nuevo`: empieza un mundo nuevo con `opciones` (semilla, tribus, colonos).
func arrancar(nuevo: bool, opciones := {}) -> void:
	var r := _rutas()
	puerto = 20000 + randi() % 20000
	var args := PackedStringArray([r["script"], "--puerto", str(puerto), "--datos", carpeta_datos(), "--docs", r["docs"], "--padre", str(OS.get_process_id())])
	if nuevo:
		args.append("--nuevo")
		for k in opciones:
			args.append("--" + str(k))
			args.append(str(opciones[k]))
	DirAccess.make_dir_recursive_absolute(carpeta_datos())
	pid = OS.create_process(r["node"], args, false)
	if pid <= 0:
		error.emit("No se pudo arrancar el motor del juego (%s). Si estás en el editor, instala Node 23.6 o superior." % r["node"])
		return
	_http = HTTPRequest.new()
	_http.timeout = 2.0
	add_child(_http)
	_http.request_completed.connect(_respuesta)
	_espera = 0.0
	_intentando = true
	_probar()

func _probar() -> void:
	_http.request("http://127.0.0.1:%d/api/mundo" % puerto)

func _respuesta(_res: int, codigo: int, _h: PackedStringArray, _cuerpo: PackedByteArray) -> void:
	if not _intentando:
		return
	if codigo == 200:
		_intentando = false
		listo.emit("ws://127.0.0.1:%d/observador" % puerto)
	else:
		await get_tree().create_timer(0.3).timeout
		if _intentando:
			_probar()

func _process(delta: float) -> void:
	if _intentando:
		_espera += delta
		if _espera > 40.0:
			_intentando = false
			error.emit("El motor no respondió en 40 s. Revisa que la carpeta 'motor' esté junto al .exe.")

## Cierra el motor (después de que el visor le pidió guardar y salir).
func detener() -> void:
	if pid > 0 and OS.is_process_running(pid):
		OS.kill(pid)
	pid = -1
