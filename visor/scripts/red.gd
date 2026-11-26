# Cliente del canal del observador (WebSocket de solo lectura). Reconecta solo si el servidor se cae.
class_name Red
extends Node

signal mensaje(datos: Dictionary)
signal conexion(conectado: bool, texto: String)

var url := ""
var _ws := WebSocketPeer.new()
var _estado := WebSocketPeer.STATE_CLOSED
var _reintento := 0.0
var _activo := false
var _sig_id := 0

## Empieza a conectar (y reconecta solo si se cae).
func conectar(u: String) -> void:
	url = u
	_activo = true
	_conectar()

## Manda un comando al motor (velocidad, poder, salir...). Devuelve su id.
func enviar(d: Dictionary) -> int:
	_sig_id += 1
	d["rid"] = _sig_id
	if _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		_ws.send_text(JSON.stringify(d))
	return _sig_id

func conectado() -> bool:
	return _ws.get_ready_state() == WebSocketPeer.STATE_OPEN

func _conectar() -> void:
	_ws = WebSocketPeer.new()
	# El primer mensaje trae todo el terreno: hace falta un búfer grande.
	_ws.inbound_buffer_size = 64 * 1024 * 1024
	_ws.max_queued_packets = 4096
	var err := _ws.connect_to_url(url)
	if err != OK:
		conexion.emit(false, "No se pudo conectar a %s" % url)
		_reintento = 3.0

func _process(delta: float) -> void:
	if not _activo:
		return
	if _reintento > 0.0:
		_reintento -= delta
		if _reintento <= 0.0:
			_conectar()
		return
	_ws.poll()
	var e := _ws.get_ready_state()
	if e != _estado:
		_estado = e
		if e == WebSocketPeer.STATE_OPEN:
			conexion.emit(true, "En directo")
		elif e == WebSocketPeer.STATE_CLOSED:
			conexion.emit(false, "Sin conexión con el bosque (%s). Reintentando…" % url)
			_reintento = 3.0
	while _ws.get_available_packet_count() > 0:
		var paquete := _ws.get_packet()
		if not _ws.was_string_packet():
			var ini := _decodificar_inicio(paquete)
			if not ini.is_empty():
				mensaje.emit(ini)
			continue
		var datos = JSON.parse_string(paquete.get_string_from_utf8())
		if datos is Dictionary:
			mensaje.emit(datos)

## Inicio binario "IAS1" (ver servidor/src/dominio/inicio_binario.ts): metadatos JSON + datos zlib.
func _decodificar_inicio(b: PackedByteArray) -> Dictionary:
	if b.size() < 8 or b.slice(0, 4).get_string_from_ascii() != "IAS1":
		return {}
	var largo := b.decode_u32(4)
	var meta = JSON.parse_string(b.slice(8, 8 + largo).get_string_from_utf8())
	if not (meta is Dictionary):
		return {}
	var datos := b.slice(8 + largo).decompress(int(meta["bytes"]), FileAccess.COMPRESSION_DEFLATE)
	var d: Dictionary = meta["desp"]
	var n := int(meta["n"])
	var tam := int(meta["tam"])
	var esq := datos.slice(int(d["esquinas"]), int(d["esquinas"]) + (tam + 1) * (tam + 1) * 4).to_float32_array()
	var ids := datos.slice(int(d["id"]), int(d["id"]) + n * 4).to_int32_array()
	var xs := datos.slice(int(d["x"]), int(d["x"]) + n * 4).to_float32_array()
	var zs := datos.slice(int(d["z"]), int(d["z"]) + n * 4).to_float32_array()
	var tipos: Array = meta["tipos"]
	var variantes: Array = meta["variantes"]
	var o_tipo := int(d["tipo"])
	var o_var := int(d["variante"])
	var o_est := int(d["estado"])
	var nodos := []
	nodos.resize(n)
	for i in n:
		nodos[i] = ["n" + str(ids[i]), tipos[datos[o_tipo + i]], variantes[datos[o_var + i]], xs[i], zs[i], datos[o_est + i]]
	meta["esquinas"] = esq
	meta["biomas"] = datos.slice(int(d["biomas"]), int(d["biomas"]) + tam * tam)
	meta["nodos"] = nodos
	return meta
