import * as THREE from "three";

export function createGlobe(host, landPoints) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
  camera.position.z = 4.1;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xffffff, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const globe = new THREE.Group();
  globe.rotation.y = -0.45;
  scene.add(globe);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xd9f2fa, 2.4);
  light.position.set(-3, 4, 5);
  scene.add(light);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.993, 48, 32), new THREE.MeshPhongMaterial({ color: 0xe0eeeb, shininess: 12 })));
  const position = (lat, lon, radius = 1) => {
    const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lon);
    return new THREE.Vector3(radius * Math.cos(a) * Math.sin(b), radius * Math.sin(a), radius * Math.cos(a) * Math.cos(b));
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(landPoints.flatMap(([lat, lon]) => position(lat, lon, 1.007).toArray()), 3));
  globe.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x167855, size: 0.014, sizeAttenuation: true })));
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x93c0b6, transparent: true, opacity: 0.25 });
  for (let lat = -60; lat <= 60; lat += 30) {
    globe.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, (_, i) => position(lat, i * 3, 1.002))), gridMaterial));
  }
  for (let lon = 0; lon < 180; lon += 30) {
    globe.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, (_, i) => {
      const angle = i * Math.PI / 60, b = THREE.MathUtils.degToRad(lon);
      return new THREE.Vector3(Math.cos(angle) * Math.sin(b), Math.sin(angle), Math.cos(angle) * Math.cos(b)).multiplyScalar(1.002);
    })), gridMaterial));
  }
  const origin = position(25.2, 55.3, 1.015);
  for (const [lat, lon] of [[51.5, -0.12], [43.7, -79.4], [14.6, 121]]) {
    const destination = position(lat, lon, 1.015);
    const middle = origin.clone().add(destination).normalize().multiplyScalar(1.42);
    const curve = new THREE.QuadraticBezierCurve3(origin, middle, destination);
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), new THREE.LineBasicMaterial({ color: 0x2574a5, transparent: true, opacity: 0.75 })));
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2574a5 }));
    marker.position.copy(destination); globe.add(marker);
  }
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), new THREE.MeshBasicMaterial({ color: 0x167855 }));
  marker.position.copy(origin); globe.add(marker);
  let paused = false, visible = false, frame = 0, last = 0, disposed = false;
  let targetX = 0, targetY = 0;
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
    render();
  };
  const render = () => renderer.render(scene, camera);
  const tick = (time) => {
    if (disposed || paused || !visible || document.hidden) { frame = 0; return; }
    if (time - last >= 32) {
      const elapsed = Math.min((time - last) / 1000, 0.06);
      globe.rotation.y += elapsed * 0.09;
      scene.rotation.x += (targetX - scene.rotation.x) * 0.05;
      scene.rotation.y += (targetY - scene.rotation.y) * 0.05;
      last = time; render();
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0; last = performance.now();
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
    else render();
  };
  const pointer = (event) => {
    if (paused || event.pointerType === "touch") return;
    const bounds = host.getBoundingClientRect();
    targetY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.18;
    targetX = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.12;
  };
  const leave = () => { targetX = 0; targetY = 0; };
  const lostContext = (event) => { event.preventDefault(); paused = true; sync(); host.dispatchEvent(new Event("globeunavailable")); };
  const observer = new ResizeObserver(resize); observer.observe(host);
  host.addEventListener("pointermove", pointer);
  host.addEventListener("pointerleave", leave);
  renderer.domElement.addEventListener("webglcontextlost", lostContext);
  document.addEventListener("visibilitychange", sync);
  resize();
  return {
    setPaused(value) { paused = value; sync(); },
    setVisible(value) { visible = value; sync(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener("pointermove", pointer); host.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", lostContext);
      document.removeEventListener("visibilitychange", sync);
      const geometries = new Set(), materials = new Set();
      scene.traverse((object) => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
