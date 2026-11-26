# Menú de inicio: nuevo mundo (semilla, tribus, colonos por tribu), continuar el último y salir.
# Mientras el motor arranca muestra "Despertando el mundo…"; si falla, el error en claro.
class_name MenuInicio
extends CanvasLayer

signal empezar(nuevo: bool, opciones: Dictionary)
signal salir

var _panel: PanelContainer
var _estado: Label
var _semilla: LineEdit
var _tribus: SpinBox
var _colonos: SpinBox
var _tam: OptionButton
var _continuar: Button
var _botones: Array = []

func _ready() -> void:
	layer = 10
	var fondo := ColorRect.new()
	fondo.color = Color(0.04, 0.06, 0.05, 0.82)
	fondo.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(fondo)
	var centro := CenterContainer.new()
	centro.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centro)
	_panel = PanelContainer.new()
	var caja := StyleBoxFlat.new()
	caja.bg_color = Color(0.09, 0.12, 0.1, 0.95)
	caja.set_corner_radius_all(14)
	caja.content_margin_left = 40; caja.content_margin_right = 40; caja.content_margin_top = 30; caja.content_margin_bottom = 30
	_panel.add_theme_stylebox_override("panel", caja)
	centro.add_child(_panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	v.custom_minimum_size = Vector2(460, 0)
	_panel.add_child(v)
	var titulo := Label.new()
	titulo.text = "iASurvival"
	titulo.add_theme_font_size_override("font_size", 52)
	titulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(titulo)
	var sub := Label.new()
	sub.text = "Tribus de inteligencias que sobreviven solas. Tú observas… y a veces intervienes."
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.modulate = Color(0.75, 0.85, 0.78)
	v.add_child(sub)
	_continuar = _boton(v, "Continuar el último mundo", func(): _ir(false))
	v.add_child(HSeparator.new())
	_semilla = LineEdit.new()
	_semilla.placeholder_text = "Semilla (vacío = al azar)"
	v.add_child(_fila("Semilla", _semilla))
	_tam = OptionButton.new()
	for o in [["Grande (1536 m) — imperios", 1536], ["Mediano (1152 m)", 1152], ["Pequeño (576 m) — PC modesta", 576]]:
		_tam.add_item(o[0])
		_tam.set_item_metadata(_tam.item_count - 1, o[1])
	v.add_child(_fila("Tamaño del mundo", _tam))
	_tribus = _spin(1, 10, 1)
	v.add_child(_fila("Pueblos iniciales", _tribus))
	_colonos = _spin(3, 12, 8)
	v.add_child(_fila("Colonos por pueblo", _colonos))
	_boton(v, "Crear mundo nuevo", func(): _ir(true))
	_boton(v, "Salir", func(): salir.emit())
	_estado = Label.new()
	_estado.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_estado.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_estado)

func _boton(padre: Control, texto: String, f: Callable) -> Button:
	var b := Button.new()
	b.text = texto
	b.custom_minimum_size = Vector2(0, 44)
	b.pressed.connect(f)
	padre.add_child(b)
	_botones.append(b)
	return b

func _spin(a: int, b: int, v: int) -> SpinBox:
	var s := SpinBox.new()
	s.min_value = a; s.max_value = b; s.value = v
	return s

func _fila(texto: String, c: Control) -> HBoxContainer:
	var h := HBoxContainer.new()
	var l := Label.new(); l.text = texto; l.custom_minimum_size = Vector2(170, 0)
	h.add_child(l)
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(c)
	return h

func mostrar(hay_partida: bool) -> void:
	visible = true
	_continuar.visible = hay_partida
	for b in _botones:
		b.disabled = false
	_estado.text = ""

func _ir(nuevo: bool) -> void:
	for b in _botones:
		b.disabled = true
	_estado.modulate = Color(0.85, 0.9, 0.86)
	_estado.text = "Despertando el mundo…"
	var op := {}
	if nuevo:
		var s := _semilla.text.strip_edges()
		op["semilla"] = int(s) if s.is_valid_int() else (abs(s.hash()) if s != "" else randi() % 1000000)
		op["tribus"] = int(_tribus.value)
		op["colonos"] = int(_colonos.value)
		op["tam"] = int(_tam.get_item_metadata(_tam.selected))
	empezar.emit(nuevo, op)

func fallo(texto: String) -> void:
	for b in _botones:
		b.disabled = false
	_estado.modulate = Color(1, 0.55, 0.5)
	_estado.text = texto
