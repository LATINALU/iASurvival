# Comprueba que las normales de cada primitiva de Mallas apunten hacia afuera.
extends SceneTree

func _probar(nombre: String, m: Mallas) -> void:
	var malla := m.malla()
	var arr := malla.surface_get_arrays(0)
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var centro := Vector3.ZERO
	for p in v:
		centro += p
	centro /= v.size()
	var afuera := 0
	var adentro := 0
	for i in range(0, v.size(), 3):
		var c := (v[i] + v[i + 1] + v[i + 2]) / 3.0
		if (c - centro).dot(n[i]) >= 0.0: afuera += 1
		else: adentro += 1
	print(nombre, ": caras hacia afuera ", afuera, ", hacia adentro ", adentro)

func _init() -> void:
	_probar("caja", Mallas.new().caja(Transform3D(), Vector3(1, 1, 1), Color.WHITE))
	_probar("cilindro", Mallas.new().cilindro(Transform3D(Basis(), Vector3(0, -0.5, 0)), 0.5, 0.5, 1.0, 8, Color.WHITE))
	_probar("cono", Mallas.new().cilindro(Transform3D(Basis(), Vector3(0, -0.5, 0)), 0.5, 0.0, 1.0, 8, Color.WHITE))
	_probar("esfera", Mallas.new().esfera(Transform3D(), 0.5, 8, 5, Color.WHITE))
	_probar("techo", Mallas.new().techo(Transform3D(Basis(), Vector3(0, -0.3, 0)), 1.0, 0.6, 1.0, Color.WHITE))
	quit()
