// Vegetación (árboles, arbustos, pasto) pintada con el color de los vértices y mecida por un viento suave que
// crece con la altura de cada vértice. La fase depende de la posición: cada planta se mueve distinto.
shader_type spatial;
render_mode cull_disabled;

uniform float viento = 0.35;
uniform float nieve : hint_range(0.0, 1.0) = 0.0;
uniform float flexible = 1.0;

void vertex() {
	vec3 origen = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float fase = origen.x * 0.37 + origen.z * 0.23;
	float altura = max(VERTEX.y, 0.0);
	float k = altura * altura * 0.02 * viento * flexible;
	VERTEX.x += sin(TIME * 1.3 + fase) * k;
	VERTEX.z += cos(TIME * 1.1 + fase * 1.3) * k * 0.6;
}

void fragment() {
	vec3 c = COLOR.rgb;
	// Nieve en las caras que miran arriba.
	float arriba = clamp(dot(NORMAL, (VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz), 0.0, 1.0);
	c = mix(c, vec3(0.9, 0.92, 0.96), nieve * smoothstep(0.5, 0.9, arriba));
	ALBEDO = c;
	ROUGHNESS = 0.92;
}
