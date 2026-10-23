import * as T from "three";
import { createCheckpoint } from "../three/checkpoint.js";
import { createRoad } from "../three/ribbon.js";
import {
  clamp,
  createRandom,
  damp,
  distanceStops,
  nearestStop,
  shortestAngle,
} from "../core/math.js";

export function createScene(ctx) {
  const { config, quality } = ctx;
  const { work } = config;
  const widths = work.buildingWidths;
  const random = createRandom(work.randomSeed);
  const group = new T.Group();
  group.position.x = config.layout.sceneSpacing * 3;
  const buildingY = config.layout.floorY + 0.02;
  const lowDetail = quality.mobile || quality.detail === "low";
  const curve = new T.CatmullRomCurve3(
    work.route.map((point) => new T.Vector3(...point)),
  );
  curve.arcLengthDivisions = 400;
  const stops = distanceStops(curve, work.milestones);
  const workLength = curve.getLength();
  const workStart = stops[0];
  const workEnd = stops[stops.length - 1];
  const milestonePoints = work.milestones.map((parameter) =>
    curve.getPoint(parameter),
  );
  const workPosition = new T.Vector3();
  const workDirection = new T.Vector3();
  const tangentSample = new T.Vector3();
  const wheels = [];
  const heroBuildings = [];
  const loads = [];
  let position = workStart;
  let activeIndex = -1;

  group.add(createRoad(curve, work.road, lowDetail));
  const nodes = milestonePoints.map((point, index) => {
    const checkpoint = createCheckpoint(ctx, index);
    const tangent = curve.getTangent(work.milestones[index]);
    const normal = new T.Vector3(-tangent.z, 0, tangent.x).normalize();
    checkpoint.group.position
      .copy(point)
      .addScaledVector(normal, work.road.width / 2 + 0.42);
    checkpoint.group.position.y = buildingY;
    group.add(checkpoint.group);
    return checkpoint;
  });

  function setWork(index) {
    if (index === activeIndex) return;
    activeIndex = index;
    ctx.ui.setWork(index);
    for (let i = 0; i < nodes.length; i++) nodes[i].setState(index);
  }

  // Curve.getTangentAt allocates temporary vectors internally in Three r128.
  function sampleRoute(parameter) {
    const mapped = curve.getUtoTmapping(parameter);
    curve.getPoint(mapped, workPosition);
    curve.getPoint(Math.max(0, mapped - 0.0001), workDirection);
    curve.getPoint(Math.min(1, mapped + 0.0001), tangentSample);
    workDirection.subVectors(tangentSample, workDirection).normalize();
    workPosition.x -= workDirection.z * work.road.laneOffset;
    workPosition.z += workDirection.x * work.road.laneOffset;
  }

  const car = new T.Group();
  sampleRoute(position);
  car.position.set(workPosition.x, workPosition.y + 0.3, workPosition.z);
  car.rotation.y = -Math.atan2(workDirection.z, workDirection.x);
  group.add(car);
  const carShadow = ctx.shadow(
    group,
    workPosition.x,
    workPosition.z,
    1.8,
    1,
    config.layout.floorY + 0.012,
  );
  loads.push(
    ctx
      .load("kits/car-kit/Models/GLB format/sedan-sports.glb", (model) => {
        model.scale.setScalar(work.carScale);
        model.rotation.y = Math.PI / 2;
        const bounds = new T.Box3().setFromObject(model);
        model.position.y = -0.38 - bounds.min.y;
        model.traverse((part) => {
          if (!part.isMesh || !part.name.startsWith("wheel-")) return;
          if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
          const size = part.geometry.boundingBox.getSize(new T.Vector3());
          wheels.push({
            mesh: part,
            radius: Math.max(size.y, size.z) * 0.5 * work.carScale,
          });
        });
        car.add(model);
      })
      .catch((error) => ctx.error(error)),
  );

  function loadCityModel(name, priority, place) {
    const pending = ctx.assets
      .load("kits/city-kit-commercial_2.1/Models/GLB format/" + name + ".glb", {
        priority,
      })
      .then((model) => {
        const holder = new T.Group();
        const bounds = new T.Box3().setFromObject(model);
        const center = bounds.getCenter(new T.Vector3());
        const size = bounds.getSize(new T.Vector3());
        holder.userData.size = size;
        model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
        holder.add(model);
        place(holder, size);
        group.add(holder);
        ctx.shadow(
          group,
          holder.position.x,
          holder.position.z,
          size.x * holder.scale.x + 0.4,
          size.z * holder.scale.z + 0.4,
          config.layout.floorY + 0.012,
        );
        ctx.changed();
      })
      .catch((error) => ctx.error(error));
    loads.push(pending);
  }

  const heroNames = [
    "building-a",
    "building-d",
    "building-h",
    "building-skyscraper-b",
    "building-skyscraper-a",
  ];
  milestonePoints.forEach((point, index) => {
    const name = heroNames[index % heroNames.length];
    loadCityModel(name, 0, (holder, size) => {
      const width = name.includes("skyscraper")
        ? widths.heroTower
        : widths.hero;
      const scale = width / Math.max(size.x, size.z, 0.1);
      holder.userData.baseScale = scale;
      holder.scale.setScalar(scale);
      holder.position.set(point.x, buildingY, point.z - 2.4);
      heroBuildings[index] = holder;
    });
  });

  if (!quality.mobile) {
    const names = [
      "building-b",
      "building-c",
      "building-e",
      "building-f",
      "building-g",
      "building-i",
      "building-j",
      "building-k",
    ];
    let index = 0;
    for (let x = -10; x < 10; x += 0.4 + random() * 0.4 + widths.middle) {
      if (milestonePoints.some((point) => Math.abs(x - point.x) < 1.5))
        continue;
      const name = names[index++ % names.length];
      const z = -4.5 - random() * 1.5;
      const height = 0.9 + random() * 0.5;
      loadCityModel(name, 2, (holder, size) => {
        const scale = widths.middle / Math.max(size.x, size.z, 0.1);
        holder.scale.set(scale, scale * height, scale);
        holder.position.set(x, buildingY, z);
      });
    }
  }

  const skyNames = [
    "building-skyscraper-c",
    "building-skyscraper-d",
    "building-skyscraper-e",
  ];
  const farCount = quality.mobile ? work.mobileFarCount : work.farCount;
  for (let index = 0; index < farCount; index++) {
    const tower = index === 3 || index === 8;
    const name = tower
      ? skyNames[index % skyNames.length]
      : "low-detail-building-" + String.fromCharCode(97 + (index % 14));
    const x = -15 + index * (30 / farCount);
    const z = -9 - random() * 3;
    const height = 0.8 + random() * 0.4;
    const width = tower ? widths.farTower : widths.far;
    loadCityModel(name, tower ? 3 : 4, (holder, size) => {
      const scale = width / Math.max(size.x, size.z, 0.1);
      holder.scale.set(scale, scale * height, scale);
      holder.position.set(x, buildingY, z);
    });
  }

  milestonePoints.forEach((point, index) => {
    const yaw = random() * Math.PI;
    loadCityModel(
      index % 2 ? "detail-parasol-b" : "detail-parasol-a",
      3,
      (holder, size) => {
        holder.scale.setScalar(widths.parasol / Math.max(size.x, size.z, 0.1));
        holder.position.set(point.x - 0.5, buildingY, point.z - 1.2);
        holder.rotation.y = yaw;
      },
    );
    if (index === 1 || index === 3) {
      loadCityModel(
        index === 1 ? "detail-awning" : "detail-overhang",
        3,
        (holder, size) => {
          holder.scale.setScalar(widths.awning / Math.max(size.x, size.z, 0.1));
          holder.position.set(point.x, buildingY, point.z - 2);
        },
      );
    }
  });

  const ready = Promise.allSettled(loads);
  function update(frame) {
    const { dt, reducedMotion } = frame;
    const target =
      workStart + (workEnd - workStart) * clamp(frame.workProgress);
    const previous = position;
    position = reducedMotion
      ? target
      : damp(position, target, work.followDamping, dt);
    if (Math.abs(target - position) <= 0.00001) position = target;
    sampleRoute(position);
    const heading = -Math.atan2(workDirection.z, workDirection.x);
    const turn = shortestAngle(car.rotation.y, heading);
    car.position.set(workPosition.x, workPosition.y + 0.3, workPosition.z);
    car.rotation.y += reducedMotion
      ? turn
      : damp(0, turn, work.steeringDamping, dt);
    const remainingTurn = shortestAngle(car.rotation.y, heading);
    let moving = position !== target || Math.abs(remainingTurn) > 0.001;
    if (Math.abs(remainingTurn) <= 0.001) car.rotation.y += remainingTurn;
    if (!reducedMotion) {
      const distance = (position - previous) * workLength;
      for (let i = 0; i < wheels.length; i++) {
        const wheel = wheels[i];
        if (wheel.radius > 0) wheel.mesh.rotation.x += distance / wheel.radius;
      }
    }
    if (position !== previous || activeIndex === -1)
      setWork(nearestStop(position, stops));
    carShadow.position.set(
      workPosition.x,
      carShadow.position.y,
      workPosition.z,
    );
    for (let i = 0; i < heroBuildings.length; i++) {
      const building = heroBuildings[i];
      if (!building) continue;
      const targetY = buildingY + (i === activeIndex ? 0.15 : 0);
      const targetScale =
        building.userData.baseScale * (i === activeIndex ? 1.06 : 1);
      let y = reducedMotion
        ? targetY
        : damp(building.position.y, targetY, 5, dt);
      let scale = reducedMotion
        ? targetScale
        : damp(building.scale.x, targetScale, 5, dt);
      if (Math.abs(targetY - y) <= 0.0001) y = targetY;
      if (Math.abs(targetScale - scale) <= 0.0001) scale = targetScale;
      building.position.y = y;
      building.scale.setScalar(scale);
      if (y !== targetY || scale !== targetScale) moving = true;
    }
    return moving;
  }

  return { group, ready, update };
}
