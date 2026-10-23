import * as T from "three";

export function canvasTexture(size, paint, height = size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  paint(canvas.getContext("2d"), size);
  return new T.CanvasTexture(canvas);
}

export function createHelpers(config, quality) {
  const stripe = canvasTexture(128, (x, n) => {
    x.fillStyle = "#fff";
    x.fillRect(0, 0, n, n);
    x.fillStyle = "rgba(0,0,0,.17)";
    for (let i = 4; i < n; i += 10) x.fillRect(i, 0, 4, n);
  });
  const shadowTexture = canvasTexture(128, (x, n) => {
    const gradient = x.createRadialGradient(
      n / 2,
      n / 2,
      0,
      n / 2,
      n / 2,
      n / 2,
    );
    gradient.addColorStop(0, "rgba(0,0,0,.34)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gradient;
    x.fillRect(0, 0, n, n);
  });
  const shadowGeometry = new T.PlaneGeometry(1, 1);
  function shadow(parent, x, z, width, depth, y = 0.01) {
    const mesh = new T.Mesh(
      shadowGeometry,
      new T.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(width, depth, 1);
    mesh.position.set(x, y, z);
    mesh.userData.sh = true;
    parent.add(mesh);
    return mesh;
  }
  function tag(text, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 214;
    const x = canvas.getContext("2d");
    x.fillStyle = colour;
    x.fillRect(0, 0, 512, 214);
    x.fillStyle = "rgba(0,0,0,.2)";
    for (let i = 0; i < 512; i += 32) x.fillRect(i, 0, 6, 214);
    x.fillStyle = ["#ffb79d", "#d9d6d4"].includes(colour.toLowerCase())
      ? "#20221f"
      : "#fff";
    x.font = '500 42px "Inter Tight",system-ui,sans-serif';
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, 256, 107);
    return new T.CanvasTexture(canvas);
  }
  function cont(colour, text) {
    const material = new T.MeshStandardMaterial({
      color: colour,
      map: stripe,
      roughness: 0.55,
      metalness: 0.25,
    });
    const front = text
      ? new T.MeshStandardMaterial({
          map: tag(text, `#${new T.Color(colour).getHexString()}`),
        })
      : material;
    const mesh = new T.Mesh(new T.BoxGeometry(2.4, 1, 1), [
      material,
      material,
      material,
      material,
      front,
      material,
    ]);
    if (text && !quality.mobile) {
      const corner = new T.MeshStandardMaterial({
        color: 0x2b2625,
        roughness: 0.6,
      });
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const bolt = new T.Mesh(
              new T.BoxGeometry(0.14, 0.14, 0.14),
              corner,
            );
            bolt.position.set(x * 1.2, y * 0.5, z * 0.5);
            mesh.add(bolt);
          }
    }
    return mesh;
  }
  return { cont, shadow, shadowTexture, shadowGeometry, canvasTexture };
}
