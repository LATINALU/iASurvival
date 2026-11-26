# Constructor de mallas low-poly con color por vértice (arte propio generado por código). Cada pieza (caja,
# cilindro/cono, esfera, prisma) se agrega a un SurfaceTool con su transformación y su color; al final se
# genera una sola ArrayMesh con normales planas (look facetado).
class_name Mallas
extends RefCounted

var st := SurfaceTool.new()

func _init() -> void:
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(-1)

## Godot toma como cara frontal la de orden horario: se emiten a, c, b para que las normales miren afuera.
func _tri(t: Transform3D, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	st.set_color(col); st.add_vertex(t * a)
	st.set_color(col); st.add_vertex(t * c)
	st.set_color(col); st.add_vertex(t * b)

func _quad(t: Transform3D, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	_tri(t, a, b, c, col)
	_tri(t, a, c, d, col)

## Caja centrada en el origen de `t`.
func caja(t: Transform3D, tam: Vector3, col: Color, variar := 0.0) -> Mallas:
	var h := tam / 2.0
	var v := [Vector3(-h.x, -h.y, -h.z), Vector3(h.x, -h.y, -h.z), Vector3(h.x, h.y, -h.z), Vector3(-h.x, h.y, -h.z),
		Vector3(-h.x, -h.y, h.z), Vector3(h.x, -h.y, h.z), Vector3(h.x, h.y, h.z), Vector3(-h.x, h.y, h.z)]
	var caras := [[4, 5, 6, 7], [1, 0, 3, 2], [0, 4, 7, 3], [5, 1, 2, 6], [7, 6, 2, 3], [0, 1, 5, 4]]
	var i := 0
	for f in caras:
		var c := col
		if variar > 0.0:
			c = col.darkened(variar * float(i % 3) / 3.0)
		if i == 4:
			c = c.lightened(0.06)
		_quad(t, v[f[0]], v[f[1]], v[f[2]], v[f[3]], c)
		i += 1
	return self

## Cilindro (o cono si r_arriba = 0) con la base en el origen de `t`, de altura `alto`.
func cilindro(t: Transform3D, r_abajo: float, r_arriba: float, alto: float, lados: int, col: Color, tapas := true) -> Mallas:
	for k in lados:
		var a0 := TAU * k / lados
		var a1 := TAU * (k + 1) / lados
		var b0 := Vector3(cos(a0) * r_abajo, 0, sin(a0) * r_abajo)
		var b1 := Vector3(cos(a1) * r_abajo, 0, sin(a1) * r_abajo)
		var s0 := Vector3(cos(a0) * r_arriba, alto, sin(a0) * r_arriba)
		var s1 := Vector3(cos(a1) * r_arriba, alto, sin(a1) * r_arriba)
		var c := col.darkened(0.08 * float(k % 2))
		if r_arriba > 0.0001:
			_quad(t, b0, s0, s1, b1, c)
			if tapas:
				_tri(t, Vector3(0, alto, 0), s1, s0, col.lightened(0.05))
		else:
			_tri(t, b0, Vector3(0, alto, 0), b1, c)
		if tapas:
			_tri(t, Vector3.ZERO, b0, b1, col.darkened(0.2))
	return self

## Esfera low-poly (`seg` meridianos, `anillos` paralelos) centrada en el origen de `t`; `escala` la deforma.
func esfera(t: Transform3D, r: float, seg: int, anillos: int, col: Color, escala := Vector3.ONE, ruido := 0.0, semilla := 0) -> Mallas:
	var pts := []
	for j in anillos + 1:
		var fila := []
		var phi := PI * j / anillos
		for k in seg:
			var th := TAU * k / seg
			var p := Vector3(sin(phi) * cos(th), cos(phi), sin(phi) * sin(th)) * r
			if ruido > 0.0 and j > 0 and j < anillos:
				p *= 1.0 + (float(hash(Vector3i(j, k, semilla)) % 1000) / 1000.0 - 0.5) * ruido
			fila.append(p * escala)
		pts.append(fila)
	for j in anillos:
		for k in seg:
			var a: Vector3 = pts[j][k]
			var b: Vector3 = pts[j][(k + 1) % seg]
			var c: Vector3 = pts[j + 1][(k + 1) % seg]
			var d: Vector3 = pts[j + 1][k]
			var cc := col.darkened(0.12 * float(j) / anillos)
			if j == 0:
				_tri(t, a, c, d, cc)
			elif j == anillos - 1:
				_tri(t, a, b, d, cc)
			else:
				_quad(t, a, b, c, d, cc)
	return self

## Prisma triangular (techo a dos aguas) de ancho x, alto y, largo z, con la base en el origen.
func techo(t: Transform3D, ancho: float, alto: float, largo: float, col: Color) -> Mallas:
	var w := ancho / 2.0
	var l := largo / 2.0
	_quad(t, Vector3(-w, 0, -l), Vector3(-w, 0, l), Vector3(0, alto, l), Vector3(0, alto, -l), col)
	_quad(t, Vector3(w, 0, l), Vector3(w, 0, -l), Vector3(0, alto, -l), Vector3(0, alto, l), col.darkened(0.12))
	_tri(t, Vector3(-w, 0, l), Vector3(w, 0, l), Vector3(0, alto, l), col.darkened(0.2))
	_tri(t, Vector3(w, 0, -l), Vector3(-w, 0, -l), Vector3(0, alto, -l), col.darkened(0.2))
	return self

func malla() -> ArrayMesh:
	st.generate_normals()
	return st.commit()

static func xf(pos := Vector3.ZERO, rot := Vector3.ZERO, esc := Vector3.ONE) -> Transform3D:
	return Transform3D(Basis.from_euler(rot) * Basis.from_scale(esc), pos)

static var _material_vc: StandardMaterial3D

## Material que pinta con el color de los vértices.
static func material() -> StandardMaterial3D:
	if _material_vc == null:
		_material_vc = StandardMaterial3D.new()
		_material_vc.vertex_color_use_as_albedo = true
		_material_vc.roughness = 0.9
	return _material_vc
