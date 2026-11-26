// Terreno: color del bioma (por vértice, ya mezclado entre celdas) + detalle de ruido a varias escalas, roca en
// las pendientes, nieve en invierno y suelo oscuro y brillante cuando llueve.
shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx;

uniform float nieve : hint_range(0.0, 1.0) = 0.0;
uniform float humedad : hint_range(0.0, 1.0) = 0.0;

varying vec3 pos_mundo;
varying vec3 normal_mundo;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ruido(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void vertex() {
	pos_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	normal_mundo = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec2 p = pos_mundo.xz;
	float n = ruido(p * 0.18) * 0.45 + ruido(p * 0.9) * 0.35 + ruido(p * 4.0) * 0.2;
	vec3 base = COLOR.rgb * (0.78 + 0.42 * n);
	// Manchas de tierra en el pasto.
	float tierra = smoothstep(0.62, 0.78, ruido(p * 0.35 + 7.0));
	base = mix(base, vec3(0.36, 0.29, 0.2) * (0.85 + 0.3 * n), tierra * 0.35 * step(0.3, COLOR.g - COLOR.r));
	// Roca en las pendientes.
	float pendiente = 1.0 - normal_mundo.y;
	base = mix(base, vec3(0.34, 0.32, 0.29) * (0.75 + 0.5 * n), smoothstep(0.28, 0.5, pendiente));
	// Nieve sobre lo plano.
	float s = nieve * smoothstep(0.35, 0.7, normal_mundo.y) * smoothstep(0.15, 0.55, n + nieve * 0.4);
	base = mix(base, vec3(0.9, 0.92, 0.96), s);
	base *= 1.0 - humedad * 0.22;
	ALBEDO = base;
	ROUGHNESS = mix(0.96, 0.55, humedad * (1.0 - s));
}
