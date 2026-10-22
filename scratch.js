        /* About/Port scene: railway and train */
        const RAIL_Z = 1.4;
        const RAIL_Y = -0.49;

        const trainGroup = new T.Group();
        trainGroup.position.set(0, RAIL_Y, 0);
        P.add(trainGroup);

        const gravelMat = new T.MeshStandardMaterial({
          color: 0x444444,
          roughness: 1,
        });
        const gravel = new T.Mesh(new T.PlaneGeometry(40, 1.6), gravelMat);
        gravel.rotation.x = -Math.PI / 2;
        gravel.position.set(0, 0.01, RAIL_Z);
        trainGroup.add(gravel);

        const trainRig = new T.Group();
        trainRig.position.set(-22, 0, 0);
        trainGroup.add(trainRig);

        const trainWheels = [];
        const smokePuffs = [];
        const smokeMat = new T.MeshBasicMaterial({
          color: 0xd9d6d4,
          transparent: true,
          opacity: 0.6,
        });
        const smokeGeo = new T.SphereGeometry(0.12, 8, 8);
        const numPuffs = mob ? 4 : 8;
        for (let i = 0; i < numPuffs; i++) {
          const p = new T.Mesh(smokeGeo, smokeMat);
          p.visible = false;
          trainRig.add(p);
          smokePuffs.push({ mesh: p, life: 0, delay: i * (1.0 / numPuffs) });
        }

        const signalGroup = new T.Group();
        signalGroup.position.set(3, 0, RAIL_Z - 0.9);
        trainGroup.add(signalGroup);
        const sigPost = new T.Mesh(new T.BoxGeometry(0.1, 1.5, 0.1), cm);
        sigPost.position.y = 0.75;
        signalGroup.add(sigPost);
        const sigLightMat = new T.MeshBasicMaterial({ color: 0x00ff00 });
        const sigLight = new T.Mesh(new T.SphereGeometry(0.08, 8, 8), sigLightMat);
        sigLight.position.set(0, 1.4, 0.1);
        signalGroup.add(sigLight);

        let trainState = 0; // 0=parked/idle, 1=arriving
        let trainTime = 0;

        function normalizeModel(model, scale, isLoco = false) {
          const holder = new T.Group();
          holder.scale.setScalar(scale);
          const bb = new T.Box3().setFromObject(model);
          const size = new T.Vector3();
          bb.getSize(size);
          const center = new T.Vector3();
          bb.getCenter(center);
          
          model.position.set(-center.x, -bb.min.y, -center.z);
          holder.add(model);
          
          if (size.z > size.x) {
            holder.rotation.y = Math.PI / 2;
          } else if (isLoco) { // Loco needs to face +X
             // if it's longer in X, we need to check if we need to flip it, but assuming Kenney face Z, size.z > size.x usually.
          }
          return holder;
        }

        let railTopY = 0;

        // Load Track
        loadGLB("kits/train-kit/Models/GLB format/railroad-straight.glb", (model) => {
          const holder = normalizeModel(model, 1.1);
          const bb = new T.Box3().setFromObject(holder);
          const hSize = new T.Vector3();
          bb.getSize(hSize);
          railTopY = bb.max.y;
          trainRig.position.y = railTopY; // Train sits exactly on rails
          
          const len = hSize.x || 2.4;
          const count = 18;
          for (let n = 0; n < count; n++) {
            const piece = holder.clone();
            piece.position.set(n * len - (count * len) / 2, 0, RAIL_Z);
            trainGroup.add(piece);
          }
        });

        // Load Train Locomotives and Wagons
        let locoLen = 0;
        let locoFrontX = 0;
        let locoTopY = 0;
        loadGLB("kits/train-kit/Models/GLB format/train-locomotive-a.glb", (model) => {
          model.traverse((ch) => {
            if (ch.isMesh && ch.name.toLowerCase().includes("wheel")) {
              trainWheels.push(ch);
            }
          });
          const holder = normalizeModel(model, 0.95, true);
          const bb = new T.Box3().setFromObject(holder);
          const hSize = new T.Vector3();
          bb.getSize(hSize);
          locoLen = hSize.x;
          
          // Front is usually +X after rotation for Kenney if it faced Z
          locoFrontX = hSize.x / 2 - 0.2; // approx chimney location
          locoTopY = bb.max.y;
          
          holder.position.set(2.6, 0, RAIL_Z);
          trainRig.add(holder);
        });

        const numWagons = 3;
        for (let idx = 0; idx < numWagons; idx++) {
          loadGLB("kits/train-kit/Models/GLB format/train-carriage-flatbed.glb", (model) => {
            model.traverse((ch) => {
              if (ch.isMesh && ch.name.toLowerCase().includes("wheel")) {
                trainWheels.push(ch);
              }
            });
            const holder = normalizeModel(model, 0.95);
            const bb = new T.Box3().setFromObject(holder);
            const hSize = new T.Vector3();
            bb.getSize(hSize);
            const wLen = hSize.x;
            const gap = 0.06;
            
            // Layout wagons behind loco. loco is at 2.6.
            // Actually locoLen might not be loaded yet if async. We will just use fixed 2.6 spacing which was perfect before.
            // Let's use 2.6 spacing for simplicity as before.
            const wagonX = -idx * 2.6;
            holder.position.set(wagonX, 0, RAIL_Z);
            trainRig.add(holder);
            
            // Deck Raycast
            // We need to raycast down from above the wagon center in trainRig space.
            // Since wagon is at (wagonX, 0, RAIL_Z) in trainRig space.
            // We need the absolute world matrix updated for raycasting.
            // But doing it statically is tricky if not in scene. We can just guess the deck height, or do the raycast by updating matrixWorld.
          });
        }

