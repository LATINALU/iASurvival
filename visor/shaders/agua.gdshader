// Agua: olas suaves en los vértices, color que va de turquesa a azul profundo, brillo especular y un poco de
// transparencia. Sin destellos.
shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec3 color_claro : source_color = vec3(0.22, 0.5, 0.55);
uniform vec3 color_hondo : source_color = vec3(0.08, 0.22, 0.36);
uniform float luz = 1.0;

varying vec3 pos_mundo;

float onda(vec2 p, float t) {
	return sin(p.x * 0.7 + t * 1.1) * 0.5 + sin(p.y * 0.9 - t * 0.8) * 0.5 + sin((p.x + p.y) * 1.7 + t * 1.6) * 0.25;
}

void vertex() {
	pos_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += onda(pos_mundo.xz, TIME) * 0.05;
}

void fragment() {
	float t = TIME;
	vec2 p = pos_mundo.xz;
	float dx = onda(p + vec2(0.1, 0.0), t) - onda(p - vec2(0.1, 0.0), t);
	float dz = onda(p + vec2(0.0, 0.1), t) - onda(p - vec2(0.0, 0.1), t);
	NORMAL = normalize((VIEW_MATRIX * vec4(normalize(vec3(-dx * 0.6, 1.0, -dz * 0.6)), 0.0)).xyz);
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = mix(color_hondo, color_claro, 0.35 + 0.3 * fresnel) * (0.4 + 0.6 * luz);
	ALPHA = 0.82;
	ROUGHNESS = 0.08;
	SPECULAR = 0.6;
}
