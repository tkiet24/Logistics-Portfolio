import * as T from "three";

// Remap the kit's purple paint and orange trim while retaining its texture detail.
// Texture data stays shared and untouched, so other scenes keep their own palette.
export function finishFactoryModel(model, bodyColour, trimColour) {
  const materials = new Map();
  function finish(source) {
    if (materials.has(source)) return materials.get(source);
    const material = source.clone();
    materials.set(source, material);
    // Three's clone does not copy these hooks. Retain source shader changes and
    // their cache identity before adding paint (and, later, scene coverage).
    const compile = source.onBeforeCompile;
    const cacheKey = source.customProgramCacheKey();
    material.onBeforeCompile = compile;
    material.customProgramCacheKey = () => cacheKey;
    if (/glass/i.test(source.name)) {
      material.color.setHex(0x8fb6b8);
      material.roughness = 0.25;
      return material;
    }
    material.roughness = 0.72;
    material.metalness = 0.12;
    const body = new T.Color(bodyColour);
    const trim = new T.Color(trimColour);
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      shader.uniforms ??= {};
      shader.uniforms.factoryBody = { value: body };
      shader.uniforms.factoryTrim = { value: trim };
      shader.fragmentShader =
        "uniform vec3 factoryBody;\nuniform vec3 factoryTrim;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         vec3 kitColour = diffuseColor.rgb;
         float luminance = dot(kitColour, vec3(0.2126, 0.7152, 0.0722));
         float purple = smoothstep(0.012, 0.07, kitColour.b - max(kitColour.r, kitColour.g));
         float orange = smoothstep(0.08, 0.3, kitColour.r - kitColour.b)
                      * smoothstep(0.025, 0.12, kitColour.g - kitColour.b);
         diffuseColor.rgb = mix(kitColour, factoryBody * (0.38 + luminance * 1.5), purple);
         diffuseColor.rgb = mix(diffuseColor.rgb, factoryTrim * (0.6 + luminance * 0.55), orange);`,
      );
    };
    material.customProgramCacheKey = () => `${cacheKey}:factory-industrial-finish-v1`;
    material.needsUpdate = true;
    return material;
  }
  model.traverse((part) => {
    if (!part.isMesh) return;
    part.material = Array.isArray(part.material)
      ? part.material.map(finish)
      : finish(part.material);
  });
}
