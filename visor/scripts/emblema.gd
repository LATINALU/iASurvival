## Emblema de una civilización: escudo con su color y un símbolo dibujado por código (arte propio).
## `borde` colorea el contorno (en las relaciones: rojo guerra, ámbar tensión, verde alianza).
class_name Emblema
extends Control

var color := Color.WHITE
var simbolo := "sol"
var borde := Color(0, 0, 0, 0)
var tachado := false

static func crear(col: Color, sim: String, lado: float, borde_col := Color(0, 0, 0, 0)) -> Emblema:
	var e := Emblema.new()
	e.color = col
	e.simbolo = sim
	e.borde = borde_col
	e.custom_minimum_size = Vector2(lado, lado * 1.15)
	e.mouse_filter = Control.MOUSE_FILTER_PASS
	return e

func _escudo(w: float, h: float, inset: float) -> PackedVector2Array:
	var p := PackedVector2Array()
	p.append(Vector2(inset, inset))
	p.append(Vector2(w - inset, inset))
	p.append(Vector2(w - inset, h * 0.55))
	for k in range(1, 9):
		var a := PI * 0.5 * k / 8.0
		p.append(Vector2(w / 2.0 + (w / 2.0 - inset) * cos(a), h * 0.55 + (h * 0.45 - inset) * sin(a)))
	for k in range(1, 9):
		var a := PI * 0.5 + PI * 0.5 * k / 8.0
		p.append(Vector2(w / 2.0 + (w / 2.0 - inset) * cos(a), h * 0.55 + (h * 0.45 - inset) * sin(a)))
	p.append(Vector2(inset, h * 0.55))
	return p

func _draw() -> void:
	var w := size.x
	var h := size.y
	if borde.a > 0.0:
		draw_colored_polygon(_escudo(w, h, 0.0), borde)
		draw_colored_polygon(_escudo(w, h, maxf(2.0, w * 0.09)), color.darkened(0.25))
	else:
		draw_colored_polygon(_escudo(w, h, 0.0), Color(0.08, 0.08, 0.08))
		draw_colored_polygon(_escudo(w, h, maxf(1.5, w * 0.05)), color.darkened(0.25))
	# Franja superior con el color claro.
	var ins := maxf(2.0, w * 0.1)
	draw_rect(Rect2(ins, ins, w - ins * 2.0, h * 0.12), color.lightened(0.15))
	_simbolo(Vector2(w * 0.5, h * 0.55), w * 0.32, Color(0.97, 0.93, 0.82))
	if tachado:
		draw_line(Vector2(2, 2), Vector2(w - 2, h - 2), Color(0.1, 0.1, 0.1), 2.0)

func _poli(c: Vector2, r: float, puntos: Array, col: Color) -> void:
	var p := PackedVector2Array()
	for q in puntos:
		p.append(c + Vector2(q[0], q[1]) * r)
	draw_colored_polygon(p, col)

func _simbolo(c: Vector2, r: float, col: Color) -> void:
	var g := maxf(1.2, r * 0.18)
	match simbolo:
		"sol":
			draw_circle(c, r * 0.45, col)
			for k in 8:
				var a := TAU * k / 8.0
				draw_line(c + Vector2(cos(a), sin(a)) * r * 0.6, c + Vector2(cos(a), sin(a)) * r * 0.95, col, g)
		"luna":
			draw_circle(c, r * 0.8, col)
			draw_circle(c + Vector2(r * 0.35, -r * 0.2), r * 0.7, color.darkened(0.25))
		"estrella":
			var p := PackedVector2Array()
			for k in 10:
				var a := -PI / 2 + TAU * k / 10.0
				var rr := r * (0.95 if k % 2 == 0 else 0.4)
				p.append(c + Vector2(cos(a), sin(a)) * rr)
			draw_colored_polygon(p, col)
		"arbol":
			_poli(c, r, [[0, -1], [0.75, 0.35], [-0.75, 0.35]], col)
			draw_rect(Rect2(c + Vector2(-0.12, 0.3) * r, Vector2(0.24, 0.6) * r), col)
		"hoja":
			var p := PackedVector2Array()
			for k in 16:
				var a := TAU * k / 16.0
				p.append(c + Vector2(sin(a) * 0.5, -cos(a)) * r)
			draw_colored_polygon(p, col)
			draw_line(c + Vector2(0, -0.9) * r, c + Vector2(0, 1.0) * r, color.darkened(0.25), g * 0.7)
		"montana":
			_poli(c, r, [[-1, 0.8], [-0.2, -0.7], [0.2, 0.0], [0.5, -0.4], [1, 0.8]], col)
		"rio":
			for f in 3:
				var pts := PackedVector2Array()
				for k in 9:
					var x := -0.9 + k * 0.225
					pts.append(c + Vector2(x, -0.5 + f * 0.5 + sin(x * 4.0) * 0.15) * r)
				draw_polyline(pts, col, g)
		"rayo":
			_poli(c, r, [[0.2, -1], [-0.5, 0.1], [0.0, 0.1], [-0.25, 1], [0.55, -0.15], [0.05, -0.15], [0.35, -1]], col)
		"llama":
			_poli(c, r, [[0, -1], [0.55, -0.1], [0.6, 0.45], [0.3, 0.85], [-0.3, 0.85], [-0.6, 0.45], [-0.45, -0.05], [-0.15, 0.2]], col)
		"lobo":
			_poli(c, r, [[-0.75, -0.9], [-0.35, -0.35], [0.35, -0.35], [0.75, -0.9], [0.7, 0.1], [0.0, 0.95], [-0.7, 0.1]], col)
			draw_circle(c + Vector2(-0.28, -0.05) * r, r * 0.1, color.darkened(0.25))
			draw_circle(c + Vector2(0.28, -0.05) * r, r * 0.1, color.darkened(0.25))
		"oso":
			draw_circle(c + Vector2(0, 0.15) * r, r * 0.7, col)
			draw_circle(c + Vector2(-0.55, -0.5) * r, r * 0.25, col)
			draw_circle(c + Vector2(0.55, -0.5) * r, r * 0.25, col)
			draw_circle(c + Vector2(0, 0.4) * r, r * 0.18, color.darkened(0.25))
		"ciervo":
			draw_circle(c + Vector2(0, 0.45) * r, r * 0.35, col)
			for lado in [-1.0, 1.0]:
				draw_polyline(PackedVector2Array([c + Vector2(lado * 0.15, 0.15) * r, c + Vector2(lado * 0.5, -0.4) * r, c + Vector2(lado * 0.4, -0.95) * r]), col, g)
				draw_line(c + Vector2(lado * 0.45, -0.3) * r, c + Vector2(lado * 0.85, -0.6) * r, col, g)
		"cuervo", "aguila":
			_poli(c, r, [[-1, -0.2], [-0.2, 0.1], [0, -0.5], [0.2, 0.1], [1, -0.2], [0.3, 0.45], [0.15, 0.95], [-0.15, 0.95], [-0.3, 0.45]], col)
			if simbolo == "aguila":
				draw_circle(c + Vector2(0, -0.55) * r, r * 0.2, col)
		"serpiente":
			var pts := PackedVector2Array()
			for k in 14:
				var y := -0.9 + k * 0.14
				pts.append(c + Vector2(sin(y * 5.0) * 0.45, y) * r)
			draw_polyline(pts, col, g * 1.4)
			draw_circle(pts[0], r * 0.16, col)
		"martillo":
			draw_rect(Rect2(c + Vector2(-0.7, -0.85) * r, Vector2(1.4, 0.55) * r), col)
			draw_rect(Rect2(c + Vector2(-0.12, -0.3) * r, Vector2(0.24, 1.2) * r), col)
		_:
			draw_circle(c, r * 0.6, col)
