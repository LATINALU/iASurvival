# Interfaz estilo juego de colonias: barra superior (fecha, estación, clima, velocidad), panel de tribus,
# ficha del colono con pestañas (necesidades, ánimo, rasgos, habilidades, social, historia), barra de poderes
# de dios, diario de sucesos, subtítulos de lo que se dice y avisos.
class_name Interfaz
extends CanvasLayer

signal velocidad(v: float)
signal poder(def: Dictionary)
signal ver_tribu(id: String)
signal cerrar_ficha

const NOMBRE_HAB := {"tala": "Tala", "mineria": "Minería", "recoleccion": "Recolección", "caza": "Caza", "cocina": "Cocina", "construccion": "Construcción", "cultivo": "Cultivo", "medicina": "Medicina", "combate": "Combate", "artesania": "Artesanía", "social": "Social"}
const NOMBRE_EJE := {"sociable": "Sociable", "valiente": "Valiente", "trabajador": "Trabajador", "empatico": "Empático", "impulsivo": "Impulsivo"}
const CLIMA := {"despejado": "Despejado", "nublado": "Nublado", "lluvia": "Lluvia", "tormenta": "Tormenta", "nieve": "Nieve", "niebla": "Niebla"}
const ESTADO_DIPLO := {"alianza": ["Alianza", Color(0.45, 0.85, 0.5)], "paz": ["Paz", Color(0.75, 0.8, 0.78)], "tension": ["Tensión", Color(0.95, 0.75, 0.35)], "guerra": ["Guerra", Color(1.0, 0.4, 0.35)]}

var _fecha: Label
var _clima: Label
var _vel_botones: Array = []
var _tribus: VBoxContainer
var _tribus_desliz: ScrollContainer
var _ficha: PanelContainer
var _ficha_titulo: RichTextLabel
var _ficha_cuerpo: RichTextLabel
var _pestana := "estado"
var _ultima_ficha := {}
var _diario: RichTextLabel
var _lineas: Array = []
var _subtitulos: RichTextLabel
var _subs: Array = []
var _aviso: Label
var _aviso_t := 0.0
var _poderes: HBoxContainer
var _poder_label: Label
var _motivo: Label
var _estado_red: Label

func _ready() -> void:
	var raiz := Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tema := Theme.new()
	tema.default_font_size = 15
	raiz.theme = tema
	add_child(raiz)

	# ---------------- barra superior
	var barra := _panel(raiz, Color(0.06, 0.08, 0.07, 0.85))
	barra.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	barra.offset_bottom = 40
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 18)
	barra.add_child(h)
	var titulo := Label.new()
	titulo.text = "iASurvival"
	titulo.add_theme_font_size_override("font_size", 20)
	h.add_child(titulo)
	_fecha = Label.new()
	h.add_child(_fecha)
	_clima = Label.new()
	h.add_child(_clima)
	var hueco := Control.new()
	hueco.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(hueco)
	_estado_red = Label.new()
	_estado_red.modulate = Color(0.7, 0.78, 0.74)
	h.add_child(_estado_red)
	for v in [[0.0, "⏸", 0], [1.0, "x1", 1], [2.0, "x2", 2], [4.0, "x4", 3], [8.0, "x8", 4], [16.0, "x16", 5], [32.0, "x32", 6], [64.0, "x64", 7], [128.0, "x128", 8]]:
		var b := Button.new()
		b.text = v[1]
		b.custom_minimum_size = Vector2(40, 0)
		b.tooltip_text = "Pausa (Espacio)" if v[0] == 0.0 else "Velocidad x%d (tecla %d)" % [int(v[0]), int(v[2])]
		var val: float = v[0]
		b.pressed.connect(func(): velocidad.emit(val))
		b.toggle_mode = true
		h.add_child(b)
		_vel_botones.append([val, b])

	_motivo = Label.new()
	_motivo.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_motivo.offset_top = 48
	_motivo.offset_left = -400
	_motivo.offset_right = 400
	_motivo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_motivo.add_theme_font_size_override("font_size", 18)
	_sombra(_motivo)
	raiz.add_child(_motivo)

	# ---------------- tribus (izquierda)
	var pt := _panel(raiz, Color(0.06, 0.08, 0.07, 0.8))
	pt.position = Vector2(12, 50)
	pt.custom_minimum_size = Vector2(250, 0)
	var desliz := ScrollContainer.new()
	desliz.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	desliz.custom_minimum_size = Vector2(250, 0)
	pt.add_child(desliz)
	_tribus_desliz = desliz
	_tribus = VBoxContainer.new()
	_tribus.add_theme_constant_override("separation", 5)
	_tribus.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	desliz.add_child(_tribus)

	# ---------------- ficha (derecha)
	_ficha = _panel(raiz, Color(0.06, 0.08, 0.07, 0.9))
	_ficha.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_ficha.offset_left = -430
	_ficha.offset_right = -12
	_ficha.offset_top = 52
	_ficha.custom_minimum_size = Vector2(418, 0)
	_ficha.visible = false
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	_ficha.add_child(v)
	var cab := HBoxContainer.new()
	v.add_child(cab)
	_ficha_titulo = RichTextLabel.new()
	_ficha_titulo.bbcode_enabled = true
	_ficha_titulo.fit_content = true
	_ficha_titulo.scroll_active = false
	_ficha_titulo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(_ficha_titulo)
	var cerrar := Button.new()
	cerrar.text = "✕"
	cerrar.pressed.connect(func(): cerrar_ficha.emit())
	cab.add_child(cerrar)
	var pest := HBoxContainer.new()
	v.add_child(pest)
	for p in [["estado", "Estado"], ["animo", "Ánimo"], ["rasgos", "Rasgos"], ["habilidades", "Habilidades"], ["social", "Social"], ["historia", "Historia"]]:
		var b := Button.new()
		b.text = p[1]
		var id: String = p[0]
		b.pressed.connect(func(): _pestana = id; _pintar_ficha())
		pest.add_child(b)
	_ficha_cuerpo = RichTextLabel.new()
	_ficha_cuerpo.bbcode_enabled = true
	_ficha_cuerpo.custom_minimum_size = Vector2(400, 380)
	_ficha_cuerpo.scroll_active = true
	v.add_child(_ficha_cuerpo)

	# ---------------- diario (abajo a la izquierda)
	_diario = RichTextLabel.new()
	_diario.bbcode_enabled = true
	_diario.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_diario.offset_top = -330
	_diario.offset_bottom = -78
	_diario.offset_left = 14
	_diario.offset_right = 520
	_diario.scroll_active = false
	_diario.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_diario.add_theme_font_size_override("normal_font_size", 14)
	_diario.add_theme_constant_override("outline_size", 5)
	_diario.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	raiz.add_child(_diario)

	# ---------------- subtítulos
	_subtitulos = RichTextLabel.new()
	_subtitulos.bbcode_enabled = true
	_subtitulos.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_subtitulos.offset_left = -520
	_subtitulos.offset_right = 520
	_subtitulos.offset_top = -190
	_subtitulos.offset_bottom = -82
	_subtitulos.scroll_active = false
	_subtitulos.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_subtitulos.add_theme_font_size_override("normal_font_size", 19)
	_subtitulos.add_theme_constant_override("outline_size", 7)
	_subtitulos.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	raiz.add_child(_subtitulos)

	# ---------------- poderes (abajo)
	var pp := _panel(raiz, Color(0.06, 0.08, 0.07, 0.88))
	pp.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	pp.offset_top = -70
	var vp := VBoxContainer.new()
	pp.add_child(vp)
	_poder_label = Label.new()
	_poder_label.text = "Poderes de dios — elige uno y haz clic en el mapa (clic derecho para cancelar)"
	_poder_label.modulate = Color(0.85, 0.82, 0.65)
	vp.add_child(_poder_label)
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(0, 34)
	sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vp.add_child(sc)
	_poderes = HBoxContainer.new()
	sc.add_child(_poderes)

	_aviso = Label.new()
	_aviso.set_anchors_preset(Control.PRESET_CENTER)
	_aviso.offset_left = -400
	_aviso.offset_right = 400
	_aviso.offset_top = -160
	_aviso.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_aviso.add_theme_font_size_override("font_size", 24)
	_sombra(_aviso)
	raiz.add_child(_aviso)

	var ayuda := Label.new()
	ayuda.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	ayuda.offset_left = -640
	ayuda.offset_right = -14
	ayuda.offset_top = -96
	ayuda.offset_bottom = -74
	ayuda.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ayuda.text = "WASD mover · rueda zoom · Q/E girar · clic: elegir colono · F seguir · Tab director · Espacio pausa · H ocultar"
	ayuda.add_theme_font_size_override("font_size", 12)
	ayuda.modulate = Color(1, 1, 1, 0.65)
	_sombra(ayuda)
	raiz.add_child(ayuda)

func _panel(padre: Control, color: Color) -> PanelContainer:
	var p := PanelContainer.new()
	var s := StyleBoxFlat.new()
	s.bg_color = color
	s.set_corner_radius_all(8)
	s.content_margin_left = 12; s.content_margin_right = 12; s.content_margin_top = 8; s.content_margin_bottom = 8
	p.add_theme_stylebox_override("panel", s)
	padre.add_child(p)
	return p

func _sombra(l: Label) -> void:
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))

# ------------------------------------------------------------------ datos que llegan

func conexion(_ok: bool, texto: String) -> void:
	_estado_red.text = texto

func estado(d: Dictionary) -> void:
	var est: String = d["estacion"]
	var f := str(d.get("fecha", ""))
	_fecha.text = "%s · %s · %s" % [f.substr(0, 1).to_upper() + f.substr(1), est.capitalize(), d["hora"]]
	_clima.text = "%s · %.0f °C%s" % [CLIMA.get(d["clima"], d["clima"]), float(d["temperatura"]), " · sequía" if d["sequia"] else ""]
	var v := float(d.get("velocidad", 1.0))
	for par in _vel_botones:
		(par[1] as Button).set_pressed_no_signal(absf(float(par[0]) - v) < 0.01)

const ROMANOS := ["", "I", "II", "III", "IV", "V"]

## Tarjetas compactas: emblema, nombre, habitantes y era; abajo, emblemas pequeños de con quién está en guerra
## (borde rojo), en tensión (ámbar) o aliada (verde). Caben 10 o más civilizaciones; el detalle va en el tooltip.
func tribus(lista: Array) -> void:
	for h in _tribus.get_children():
		h.queue_free()
	var vivas: Array = lista.filter(func(t): return not t["extinta"])
	var titulo := HBoxContainer.new()
	titulo.add_theme_constant_override("separation", 8)
	var lt := Label.new()
	lt.text = "Civilizaciones (%d)" % vivas.size()
	lt.add_theme_font_size_override("font_size", 15)
	titulo.add_child(lt)
	for par in [["guerra", "Guerra"], ["tension", "Tensión"], ["alianza", "Alianza"]]:
		var marca := ColorRect.new()
		marca.color = ESTADO_DIPLO[par[0]][1]
		marca.custom_minimum_size = Vector2(9, 9)
		marca.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		titulo.add_child(marca)
		var l := Label.new()
		l.text = par[1]
		l.add_theme_font_size_override("font_size", 11)
		l.add_theme_color_override("font_color", Color(0.75, 0.75, 0.75))
		titulo.add_child(l)
	_tribus.add_child(titulo)
	var por_id := {}
	for t in lista:
		por_id[t["id"]] = t
	var compacto := vivas.size() > 6
	for t in vivas:
		var col := Modelos.color_tribu(float(t["color"]))
		var fila := HBoxContainer.new()
		fila.add_theme_constant_override("separation", 8)
		fila.mouse_filter = Control.MOUSE_FILTER_STOP
		fila.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var id: String = t["id"]
		fila.gui_input.connect(func(ev): if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT: ver_tribu.emit(id))
		var tip := "%s
%s · %d habitantes · comida %d · %d obras" % [t["nombre"], t["eraNombre"], int(t["poblacion"]), int(t["comida"]), int(t["construcciones"])]
		if t["lider"] != null:
			tip += "
Guía: %s" % t["lider"]
		if t["investigando"] != null:
			tip += "
Investiga: %s (%d%%)" % [t["investigando"], int(t["progreso"])]
		if t["origen"] != null:
			tip += "
Nació de %s" % t["origen"]
		tip += "
Sabe: " + ", ".join(t["conoce"])
		fila.tooltip_text = tip
		fila.add_child(Emblema.crear(col, str(t.get("simbolo", "sol")), 26.0 if compacto else 34.0))
		var info := VBoxContainer.new()
		info.add_theme_constant_override("separation", 1)
		info.mouse_filter = Control.MOUSE_FILTER_IGNORE
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var nombre := Label.new()
		nombre.text = str(t["nombre"])
		nombre.clip_text = true
		nombre.custom_minimum_size = Vector2(150, 0)
		nombre.add_theme_font_size_override("font_size", 12 if compacto else 13)
		nombre.add_theme_color_override("font_color", col.lightened(0.5))
		nombre.mouse_filter = Control.MOUSE_FILTER_IGNORE
		info.add_child(nombre)
		var abajo := HBoxContainer.new()
		abajo.add_theme_constant_override("separation", 4)
		abajo.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var datos := Label.new()
		var era_n := int(t.get("era", 1))
		var ciudades := int(t.get("ciudades", 1))
		datos.text = "%d hab%s · era %s%s" % [int(t["poblacion"]), (" · %d ciudades" % ciudades) if ciudades > 1 else "", ROMANOS[clampi(era_n, 0, 5)], (" · %d%%" % int(t["progreso"])) if t["investigando"] != null else ""]
		datos.add_theme_font_size_override("font_size", 11)
		datos.add_theme_color_override("font_color", Color(0.72, 0.74, 0.72))
		datos.mouse_filter = Control.MOUSE_FILTER_IGNORE
		abajo.add_child(datos)
		for otra in t["relaciones"]:
			var r: Dictionary = t["relaciones"][otra]
			if r["estado"] == "paz" or not por_id.has(otra) or por_id[otra]["extinta"]:
				continue
			var o: Dictionary = por_id[otra]
			var e: Array = ESTADO_DIPLO[r["estado"]]
			var mini := Emblema.crear(Modelos.color_tribu(float(o["color"])), str(o.get("simbolo", "sol")), 15.0, e[1])
			mini.tooltip_text = "%s con %s (%d)" % [e[0], o["nombre"], int(r["valor"])]
			mini.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			abajo.add_child(mini)
		info.add_child(abajo)
		fila.add_child(info)
		_tribus.add_child(fila)

func cargar_poderes(lista: Array) -> void:
	for h in _poderes.get_children():
		h.queue_free()
	for p in lista:
		var b := Button.new()
		b.text = p["nombre"]
		b.tooltip_text = p["descripcion"]
		var def: Dictionary = p
		b.pressed.connect(func(): poder.emit(def))
		_poderes.add_child(b)

func poder_activo(def) -> void:
	if def == null:
		_poder_label.text = "Poderes de dios — elige uno y haz clic en el mapa (clic derecho para cancelar)"
		_poder_label.modulate = Color(0.85, 0.82, 0.65)
	else:
		var objetivo := {"punto": "haz clic en el mapa", "colono": "haz clic sobre un colono", "cuerpo": "haz clic sobre un cuerpo", "mundo": ""}
		_poder_label.text = "► %s: %s — %s" % [def["nombre"], def["descripcion"], objetivo.get(def["objetivo"], "")]
		_poder_label.modulate = Color(1.0, 0.9, 0.5)

func motivo(t: String) -> void:
	_motivo.text = t

func avisar(t: String) -> void:
	_aviso.text = t
	_aviso_t = 3.0

func suceso(ev: Dictionary) -> void:
	var tipo: String = ev["tipo"]
	if tipo in ["insulto", "cancion", "historia"] or int(ev.get("interes", 0)) < 1:
		if tipo in ["cancion", "historia"]:
			_subs.append({"t": Time.get_ticks_msec() / 1000.0, "txt": "[color=#e8dcae]%s[/color]" % ev["texto"]})
		if int(ev.get("interes", 0)) < 1:
			return
	var i := int(ev.get("interes", 0))
	var col := "#ff8b7d" if i >= 3 else ("#f2e2b0" if i == 2 else "#c9d2cc")
	_lineas.append("[color=#87938d]D%d %s[/color] [color=%s]%s[/color]" % [int(ev["dia"]), ev["hora"], col, ev["texto"]])
	if _lineas.size() > 13:
		_lineas.pop_front()
	_diario.text = "\n".join(_lineas)
	if i >= 3:
		avisar(ev["texto"])

func dice(nombre: String, texto: String) -> void:
	_subs.append({"t": Time.get_ticks_msec() / 1000.0, "txt": "[color=#ffffff][b]%s:[/b] %s[/color]" % [nombre, texto]})
	if _subs.size() > 3:
		_subs.pop_front()

func _process(delta: float) -> void:
	if _tribus_desliz:
		_tribus_desliz.custom_minimum_size.y = minf(_tribus.get_combined_minimum_size().y, get_viewport().get_visible_rect().size.y * 0.6)
	var ahora := Time.get_ticks_msec() / 1000.0
	_subs = _subs.filter(func(s): return ahora - s["t"] < 7.0)
	var t := ""
	for s in _subs:
		t += "[center]%s[/center]\n" % s["txt"]
	_subtitulos.text = t
	if _aviso_t > 0.0:
		_aviso_t -= delta
		_aviso.modulate.a = clampf(_aviso_t, 0.0, 1.0)

# ------------------------------------------------------------------ ficha del colono

func mostrar_ficha(d) -> void:
	_ficha.visible = d != null
	if d == null:
		return
	_ultima_ficha = d
	_pintar_ficha()

func _barra(v: float, color: String) -> String:
	var llenos := int(round(clampf(v, 0, 100) / 10.0))
	return "[color=%s]%s[/color][color=#3a423e]%s[/color]" % [color, "█".repeat(llenos), "█".repeat(10 - llenos)]

func _pintar_ficha() -> void:
	var d: Dictionary = _ultima_ficha
	if d.is_empty():
		return
	var animo := int(d["animo"])
	var col_animo := "#7fd08a" if animo >= 60 else ("#e8d27a" if animo >= 35 else "#ff7b6e")
	_ficha_titulo.text = "[font_size=22][b]%s[/b][/font_size]  [color=#9aa]%s, %d años%s[/color]\n[color=#b9c7bd]%s[/color] · [color=%s]%s[/color]" % [
		d["nombre"], "mujer" if d["sexo"] == "f" else "hombre", int(d["edad"]), " · guía de la tribu" if d["lider"] else "",
		d["tribu"] if d["tribu"] != null else "", col_animo, d["actividad"] if d["vivo"] else "Murió " + str(d["causaMuerte"])]
	var t := ""
	match _pestana:
		"estado":
			t += "Vida      %s %d\n" % [_barra(d["vida"], "#e06a5f"), int(d["vida"])]
			t += "Ánimo     %s %d\n" % [_barra(animo, col_animo), animo]
			var n: Dictionary = d["necesidades"]
			var nombres := {"hambre": "Comida   ", "sed": "Agua     ", "energia": "Descanso ", "ocio": "Ocio     ", "social": "Compañía "}
			for k in ["hambre", "sed", "energia", "ocio", "social"]:
				t += "%s %s %d\n" % [nombres[k], _barra(n[k], "#9fc6e8"), int(n[k])]
			t += "\nTemperatura: %.1f °C%s\n" % [float(d["temperatura"]), "  [color=#7fb6ff](frío)[/color]" if float(d["temperatura"]) < 35.5 else ""]
			if d["enfermo"]:
				t += "[color=#e8b06e]Tiene fiebre[/color]\n"
			var eq: Dictionary = d["equipo"]
			t += "Arma: %s · Herramienta: %s · Ropa: %s\n" % [eq["arma"] if eq["arma"] != null else "—", eq["herramienta"] if eq["herramienta"] != null else "—", eq["ropa"] if eq["ropa"] != null else "—"]
			if d["pareja"] != null:
				t += "Pareja: [color=#f0a8c0]%s[/color]\n" % d["pareja"]
			var carga: Dictionary = d["carga"]
			if not carga.is_empty():
				var p: Array = []
				for k in carga:
					p.append("%s %d" % [k, int(carga[k])])
				t += "Lleva: %s\n" % ", ".join(p)
		"animo":
			t += "[b]Lo que piensa ahora[/b]\n"
			for p in d["pensamientos"]:
				var v := float(p["valor"])
				t += "[color=%s]%+d[/color]  %s\n" % ["#7fd08a" if v > 0 else "#ff8b7d", int(round(v)), p["texto"]]
		"rasgos":
			for r in d["rasgos"]:
				var c := "#7fd08a" if int(r["valencia"]) > 0 else ("#ff8b7d" if int(r["valencia"]) < 0 else "#e0dccb")
				t += "[color=%s][b]%s[/b][/color]%s  [color=#8a948f]%s[/color]\n%s\n\n" % [c, r["nombre"], " (don divino)" if r["temporal"] else "", r["categoria"], r["descripcion"]]
			t += "[b]Personalidad[/b]\n"
			for k in d["personalidad"]:
				var v := float(d["personalidad"][k])
				t += "%s: %s\n" % [NOMBRE_EJE.get(k, k), "muy alto" if v > 0.6 else ("alto" if v > 0.2 else ("bajo" if v < -0.2 else ("muy bajo" if v < -0.6 else "medio")))]
			t += "\n[b]Pasado[/b]\n"
			for tf in d["trasfondo"]:
				t += "[color=#d9c99a]%s[/color]: %s\n" % [tf["nombre"], tf["descripcion"]]
		"habilidades":
			for h in d["habilidades"]:
				var pas: String = ["", " [color=#f2c45c]♦[/color]", " [color=#ff9a4a]♦♦[/color]"][int(h["pasion"])]
				t += "%-13s %s %d%s\n" % [NOMBRE_HAB.get(h["id"], h["id"]), _barra(float(h["nivel"]) * 5.0, "#c8b46a"), int(h["nivel"]), pas]
		"social":
			for r in d["relaciones"]:
				var o := int(r["opinion"])
				t += "[color=%s]%+d[/color]  %s [color=#8a948f](%s)[/color]\n" % ["#7fd08a" if o > 0 else "#ff8b7d", o, r["nombre"], r["vinculo"]]
			if (d["relaciones"] as Array).is_empty():
				t += "Todavía no conoce bien a nadie."
		"historia":
			for l in d["historia"]:
				t += "· %s\n" % l
			if (d["historia"] as Array).is_empty():
				t += "Aún no le ha pasado nada digno de contarse."
	_ficha_cuerpo.text = t

func ficha_visible() -> bool:
	return _ficha.visible
