/** Lift dark source paint while preserving original windows, text and normal map. */
export function paintAircraft(material, settings) {
  material.color.set(settings.aircraftColour);
  material.metalnessMap = null;
  material.roughnessMap = null;
  material.metalness = settings.paintMetalness;
  material.roughness = settings.paintRoughness;
  material.emissive.set(settings.aircraftColour);
  material.emissiveIntensity = settings.paintFill;
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      #ifdef USE_MAP
        vec4 aircraftTexel = mapTexelToLinear(texture2D(map, vUv));
        float aircraftLuma = dot(aircraftTexel.rgb, vec3(0.2126, 0.7152, 0.0722));
        float aircraftPaint = smoothstep(0.010, 0.027, aircraftLuma);
        float panelShade = 0.88 + 0.12 * clamp(aircraftLuma / 0.12, 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(0.022, 0.030, 0.042), vec3(panelShade), aircraftPaint);
        diffuseColor.a *= aircraftTexel.a;
        totalEmissiveRadiance *= mix(0.03, 1.0, aircraftPaint);
      #endif
    `,
    );
  };
  material.customProgramCacheKey = () => "cargo-aircraft-grey-paint-v2";
  material.needsUpdate = true;
}
