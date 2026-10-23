export const skyVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragment = `
  varying vec2 vUv;
  uniform float nightMix;
  uniform float aspect;
  uniform vec2 lightPosition;
  void main() {
    float height = clamp((vUv.y - .53) / .47, 0.0, 1.0);
    vec3 day = mix(vec3(.941,.937,.858), vec3(.48,.70,.82), pow(height,.72));
    vec3 night = mix(vec3(.15,.22,.28), vec3(.025,.055,.11), pow(height,.6));
    vec2 point = vec2((vUv.x * 2.0 - 1.0) * aspect, vUv.y * 2.0 - 1.0);
    float distanceToLight = length(point - lightPosition);
    vec3 colour = mix(day, night, nightMix);
    // Broad atmospheric scattering and a smaller halo, without lens-flare rings.
    colour += (vec3(1.0,.79,.46) * .16 * exp(-distanceToLight * 3.2)
             + vec3(1.0,.91,.72) * .28 * exp(-distanceToLight * 13.0)) * (1.0 - nightMix);
    colour += vec3(.34,.46,.64) * .12 * exp(-distanceToLight * 8.0) * nightMix;
    gl_FragColor = vec4(colour, smoothstep(.48,.58,vUv.y));
  }
`;

export const discFragment = `
  varying vec2 vUv;
  uniform float nightMix;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
  }
  float craters(vec2 p) {
    vec2 cell = floor(p);
    float value = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 key = cell + vec2(float(x),float(y));
        vec2 centre = key + vec2(hash(key),hash(key+17.0));
        float r = .12 + hash(key + 4.0) * .2;
        float d = length(p - centre) / r;
        value += .14 * exp(-pow((d - 1.0) * 5.0, 2.0)) - .12 * exp(-d * d * 3.0);
      }
    }
    return value;
  }
  void main() {
    vec2 p = (vUv - .5) * 2.0;
    float r = dot(p,p);
    if (r > 1.0) discard;
    vec3 normal = vec3(p, sqrt(max(0.0,1.0-r)));
    float diffuse = max(0.0,dot(normal,normalize(vec3(-.62,.32,.78))));
    float maria = smoothstep(.28,.68,noise(p * 3.6 + 2.0) * .75 + noise(p * 8.0) * .25);
    float detail = noise(p * 65.0) * .045 + craters(p * 8.0) + craters(p * 19.0) * .35;
    vec3 moon = mix(vec3(.45,.51,.58),vec3(.88,.90,.86),maria) + detail;
    moon *= .12 + .88 * pow(diffuse,.65);
    vec3 sun = mix(vec3(1.0,.91,.65),vec3(1.0,.99,.9),pow(normal.z,.5));
    gl_FragColor = vec4(mix(sun,moon,nightMix), 1.0 - smoothstep(.97,1.0,r));
  }
`;

export const starVertex = `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  uniform float time;
  uniform float pixelRatio;
  uniform float nightMix;
  uniform float progress;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x = mod(p.x + 1.0 - progress * .012, 2.0) - 1.0;
    vTint = tint;
    vAlpha = nightMix * smoothstep(.10,.65,p.y) * (.72 + .18 * sin(time * .7 + phase));
    gl_Position = vec4(p, 1.0);
    gl_PointSize = size * pixelRatio;
  }
`;

export const starFragment = `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - .5) * 2.0;
    float alpha = exp(-d * d * 4.0) * (1.0 - smoothstep(.6,1.0,d));
    gl_FragColor = vec4(vTint, alpha * vAlpha);
  }
`;
