/**
 * 3D Globe Component - Interactive Three.js Globe
 * Dark futuristic theme with continents
 * @version 3.0.0
 */

(function() {
  'use strict';

  class Globe3D {
    constructor(canvasId, options = {}) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) {
        console.warn(`Globe3D: Canvas with id "${canvasId}" not found`);
        return;
      }

      this.options = {
        autoRotate: true,
        rotationSpeed: 0.003,
        cameraZ: 6,
        globeRadius: 2,
        locations: [],
        ...options
      };

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.globeGroup = null;
      this.isDragging = false;
      this.autoRotate = this.options.autoRotate;
      this.targetRotation = { x: 0, y: 0 };
      this.time = 0;

      // Zoom properties
      this.targetCameraZ = this.options.cameraZ;
      this.minCameraZ = 3.5;
      this.maxCameraZ = 12;
      this.initialPinchDistance = 0;

      this.init();
    }

    init() {
      // Setup scene
      this.scene = new THREE.Scene();

      // Setup camera
      const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      this.camera.position.z = this.options.cameraZ;

      // Setup renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true
      });
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Create globe
      this.createGlobe();
      this.createLocations();
      this.createConnections();
      this.setupControls();
      this.setupEventListeners();

      // Start animation
      this.animate();

      // Hide loading
      setTimeout(() => this.hideLoading(), 300);
    }

    createGlobe() {
      this.globeGroup = new THREE.Group();
      this.scene.add(this.globeGroup);

      const radius = this.options.globeRadius;

      // Main sphere with real earth texture (from globe.html - BMNG)
      const sphereGeometry = new THREE.SphereGeometry(radius, 64, 64);

      // Load real earth texture (same as WorldWind BMNG)
      const textureLoader = new THREE.TextureLoader();

      // Use reliable CDN for earth texture
      const earthTexture = textureLoader.load(
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        () => {
          console.log('Earth texture loaded');
        },
        undefined,
        (error) => {
          console.warn('Primary texture failed, trying alternative');
          // Fallback texture
          const fallbackTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
            () => console.log('Fallback texture loaded'),
            undefined,
            () => {
              console.error('All textures failed, using generated texture');
              // If all fails, use generated texture
              const fallbackGenTexture = this.createEarthTexture();
              sphere.material.map = fallbackGenTexture;
              sphere.material.needsUpdate = true;
            }
          );
          sphere.material.map = fallbackTexture;
          sphere.material.needsUpdate = true;
        }
      );

      const sphereMaterial = new THREE.MeshBasicMaterial({
        map: earthTexture,
        transparent: true,
        opacity: 1
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      this.globeGroup.add(sphere);
      this.sphere = sphere;

      // Dark night overlay for futuristic look
      const overlayGeometry = new THREE.SphereGeometry(radius + 0.005, 64, 64);
      const overlayMaterial = new THREE.MeshBasicMaterial({
        color: 0x050510,
        transparent: true,
        opacity: 0.5,
        side: THREE.FrontSide
      });
      const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
      this.globeGroup.add(overlay);

      // Cyan atmosphere glow (futuristic night effect)
      const atmosphereGeometry = new THREE.SphereGeometry(radius + 0.12, 64, 64);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 glowColor = vec3(0.0, 0.6, 1.0) * intensity;
            gl_FragColor = vec4(glowColor, intensity * 0.6);
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      this.globeGroup.add(atmosphere);

      // Tech grid overlay (subtle)
      const gridMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.03
      });
      const grid = new THREE.Mesh(sphereGeometry, gridMaterial);
      this.globeGroup.add(grid);

      // Floating particles
      this.createParticles(radius);

      // Store references
      this.atmosphere = atmosphere;
      this.sphere = sphere;
    }

    createEarthTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');

      // Deep dark ocean
      ctx.fillStyle = '#030308';
      ctx.fillRect(0, 0, 2048, 1024);

      // Subtle grid
      ctx.strokeStyle = '#0a0a1a';
      ctx.lineWidth = 1;
      const gridSize = 64;
      for (let x = 0; x < 2048; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }
      for (let y = 0; y < 1024; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(2048, y);
        ctx.stroke();
      }

      // Draw continents
      ctx.fillStyle = '#0d1520';
      ctx.strokeStyle = '#1a3050';
      ctx.lineWidth = 2;

      // North America
      this.drawContinent(ctx, [
        [150, 200], [280, 180], [380, 200], [450, 280], [400, 380], [320, 420], [240, 400], [180, 320]
      ]);

      // South America
      this.drawContinent(ctx, [
        [360, 450], [420, 470], [450, 550], [430, 680], [380, 720], [340, 620], [320, 520]
      ]);

      // Europe
      this.drawContinent(ctx, [
        [880, 170], [980, 150], [1050, 180], [1020, 260], [960, 290], [900, 260]
      ]);

      // Africa
      this.drawContinent(ctx, [
        [900, 300], [1000, 280], [1080, 320], [1100, 450], [1050, 580], [960, 600], [920, 480]
      ]);

      // Asia
      this.drawContinent(ctx, [
        [1040, 140], [1200, 120], [1400, 160], [1550, 220], [1500, 350], [1400, 400], [1250, 380], [1120, 320], [1060, 240]
      ]);

      // Japan
      this.drawContinent(ctx, [
        [1560, 260], [1600, 250], [1630, 290], [1600, 340], [1570, 320]
      ]);

      // Australia
      this.drawContinent(ctx, [
        [1480, 520], [1560, 510], [1640, 550], [1660, 640], [1600, 700], [1520, 680], [1480, 600]
      ]);

      // Add glowing city lights on continents
      this.addCityLights(ctx);

      return new THREE.CanvasTexture(canvas);
    }

    drawContinent(ctx, points) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    addCityLights(ctx) {
      // Add glowing city lights at major population centers
      const cities = [
        // Europe
        { x: 950, y: 230, size: 4, color: '#00ffff' },  // London/Paris area
        { x: 980, y: 250, size: 3, color: '#ff00ff' },  // Germany
        { x: 1000, y: 240, size: 2, color: '#00ffff' }, // Italy area
        // North America
        { x: 260, y: 240, size: 5, color: '#00ffff' },  // East Coast
        { x: 220, y: 280, size: 4, color: '#ff00ff' },  // West Coast
        { x: 280, y: 260, size: 3, color: '#00ffff' },  // Central
        // Asia
        { x: 1250, y: 260, size: 6, color: '#00ffff' }, // China/East Asia
        { x: 1400, y: 300, size: 3, color: '#ff00ff' }, // Japan
        { x: 1180, y: 280, size: 4, color: '#00ffff' }, // India
        // South America
        { x: 390, y: 620, size: 3, color: '#00ffff' }, // Brazil
        // Africa
        { x: 980, y: 450, size: 2, color: '#ff00ff' },
        // Australia
        { x: 1560, y: 600, size: 2, color: '#00ffff' },
      ];

      cities.forEach(city => {
        // Glow
        const gradient = ctx.createRadialGradient(city.x, city.y, 0, city.x, city.y, city.size * 4);
        gradient.addColorStop(0, city.color);
        gradient.addColorStop(0.3, city.color + '80');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.size * 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    createLocations() {
      const colors = [0x00ffff, 0xff00ff, 0x3b82f6, 0x8b5cf6, 0x06b6d4];

      // International locations only (no Italy)
      const locations = this.options.locations.length > 0 ? this.options.locations : [
        { lat: 40.7128, lon: -74.0060, name: 'New York' },
        { lat: 51.5074, lon: -0.1278, name: 'London' },
        { lat: 48.8566, lon: 2.3522, name: 'Paris' },
        { lat: 52.5200, lon: 13.4050, name: 'Berlin' },
        { lat: 35.6762, lon: 139.6503, name: 'Tokyo' },
        { lat: 37.7749, lon: -122.4194, name: 'San Francisco' },
        { lat: 1.3521, lon: 103.8198, name: 'Singapore' },
        { lat: -33.8688, lon: 151.2093, name: 'Sydney' },
        { lat: 55.7558, lon: 37.6173, name: 'Mosca' },
        { lat: -23.5505, lon: -46.6333, name: 'San Paolo' },
        { lat: 28.6139, lon: 77.2090, name: 'New Delhi' },
        { lat: 39.9042, lon: 116.4074, name: 'Pechino' },
        { lat: 37.5665, lon: 126.9780, name: 'Seoul' }
      ];

      this.markers = [];
      const radius = this.options.globeRadius;

      locations.forEach((loc, index) => {
        const pos = this.latLonToVector3(loc.lat, loc.lon, radius);
        const color = colors[index % colors.length];

        // Outer glow ring
        const glowGeometry = new THREE.RingGeometry(0.05, 0.08, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(pos);
        glow.lookAt(0, 0, 0);
        this.globeGroup.add(glow);
        this.markers.push({ mesh: glow, type: 'glow' });

        // Main ring
        const ringGeometry = new THREE.RingGeometry(0.03, 0.045, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(pos.clone().multiplyScalar(1.001));
        ring.lookAt(0, 0, 0);
        this.globeGroup.add(ring);
        this.markers.push({ mesh: ring, type: 'ring' });

        // Center dot
        const dotGeometry = new THREE.CircleGeometry(0.02, 32);
        const dotMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.copy(pos.clone().multiplyScalar(1.002));
        dot.lookAt(0, 0, 0);
        this.globeGroup.add(dot);
        this.markers.push({ mesh: dot, type: 'dot' });
      });
    }

    createConnections() {
      const baseLocations = this.options.locations.length > 0 ? this.options.locations : [
        { lat: 40.7128, lon: -74.0060 }, { lat: 51.5074, lon: -0.1278 },
        { lat: 48.8566, lon: 2.3522 }, { lat: 52.5200, lon: 13.4050 },
        { lat: 35.6762, lon: 139.6503 }, { lat: 37.7749, lon: -122.4194 },
        { lat: 1.3521, lon: 103.8198 }, { lat: -33.8688, lon: 151.2093 }
      ];

      const radius = this.options.globeRadius;

      // Create tech connections between major hubs
      const connections = [
        [0, 1], [0, 4], [0, 5], // New York
        [1, 2], [1, 3], // London
        [2, 3], [2, 6], // Paris/Berlin
        [3, 4], [3, 7], // Asia
        [4, 5], // Tokyo-SF
        [5, 6], // SF-Singapore
      ];

      connections.forEach(([startIdx, endIdx]) => {
        const start = this.latLonToVector3(baseLocations[startIdx].lat, baseLocations[startIdx].lon, radius);
        const end = this.latLonToVector3(baseLocations[endIdx].lat, baseLocations[endIdx].lon, radius);

        // High arc for tech look
        const mid = start.clone().add(end).multiplyScalar(0.5);
        const midLength = mid.length();
        mid.normalize().multiplyScalar(midLength * 1.35);

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const curvePoints = curve.getPoints(60);

        // Cyan main line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.5
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        this.globeGroup.add(line);

        // Purple glow line
        const glowGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const glowMaterial = new THREE.LineBasicMaterial({
          color: 0xff00ff,
          transparent: true,
          opacity: 0.25
        });
        const glowLine = new THREE.Line(glowGeometry, glowMaterial);
        this.globeGroup.add(glowLine);
      });
    }

    createParticles(radius) {
      const particleCount = 150;
      const particleGeometry = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius + 0.15 + Math.random() * 0.5;

        particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        particlePositions[i * 3 + 1] = r * Math.cos(phi);
        particlePositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        // Cyan and purple colors
        const isCyan = Math.random() > 0.5;
        particleColors[i * 3] = isCyan ? 0 : 0.8;
        particleColors[i * 3 + 1] = isCyan ? 0.8 : 0.1;
        particleColors[i * 3 + 2] = isCyan ? 1 : 0.9;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.02,
        transparent: true,
        opacity: 0.7,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });

      this.particles = new THREE.Points(particleGeometry, particleMaterial);
      this.globeGroup.add(this.particles);
    }

    setupControls() {
      const rotateBtn = document.getElementById('globeRotateBtn');
      const resetBtn = document.getElementById('globeResetBtn');

      if (rotateBtn) {
        rotateBtn.addEventListener('click', () => {
          this.toggleAutoRotate();
          rotateBtn.classList.toggle('active', this.autoRotate);
        });
        rotateBtn.classList.add('active');
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.reset();
          if (rotateBtn) rotateBtn.classList.add('active');
        });
      }
    }

    setupEventListeners() {
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
      this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
      this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
      this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
      window.addEventListener('resize', this.onResize.bind(this));
    }

    onMouseDown(e) {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.autoRotate = false;
      const btn = document.getElementById('globeRotateBtn');
      if (btn) btn.classList.remove('active');
    }

    onMouseMove(e) {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;
      this.targetRotation.y += deltaX * 0.005;
      this.targetRotation.x += deltaY * 0.005;
      this.targetRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.targetRotation.x));
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    onMouseUp() {
      this.isDragging = false;
    }

    onWheel(e) {
      e.preventDefault();
      const zoomSpeed = 0.001;
      this.targetCameraZ += e.deltaY * zoomSpeed;
      this.targetCameraZ = Math.max(this.minCameraZ, Math.min(this.maxCameraZ, this.targetCameraZ));
    }

    onTouchStart(e) {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.autoRotate = false;
        const btn = document.getElementById('globeRotateBtn');
        if (btn) btn.classList.remove('active');
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    }

    onTouchMove(e) {
      if (e.touches.length === 1 && this.isDragging) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
        this.targetRotation.y += deltaX * 0.005;
        this.targetRotation.x += deltaY * 0.005;
        this.targetRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.targetRotation.x));
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        if (this.initialPinchDistance > 0) {
          const delta = this.initialPinchDistance - currentDistance;
          const zoomSpeed = 0.01;
          this.targetCameraZ += delta * zoomSpeed;
          this.targetCameraZ = Math.max(this.minCameraZ, Math.min(this.maxCameraZ, this.targetCameraZ));
        }
        this.initialPinchDistance = currentDistance;
      }
    }

    onTouchEnd() {
      this.isDragging = false;
    }

    onResize() {
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    latLonToVector3(lat, lon, radius) {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }

    toggleAutoRotate() {
      this.autoRotate = !this.autoRotate;
    }

    reset() {
      this.targetRotation = { x: 0, y: 0 };
      this.targetCameraZ = this.options.cameraZ;
      this.autoRotate = true;
    }

    hideLoading() {
      const loadingEl = document.getElementById('globeLoading');
      if (loadingEl) {
        loadingEl.style.opacity = '0';
        setTimeout(() => loadingEl.style.display = 'none', 500);
      }
    }

    animate() {
      requestAnimationFrame(this.animate.bind(this));

      this.time += 0.01;

      if (this.autoRotate) {
        this.targetRotation.y += this.options.rotationSpeed;
      }

      if (this.globeGroup) {
        this.globeGroup.rotation.y += (this.targetRotation.y - this.globeGroup.rotation.y) * 0.05;
        this.globeGroup.rotation.x += (this.targetRotation.x - this.globeGroup.rotation.x) * 0.05;

        if (this.particles) {
          this.particles.rotation.y = this.time * 0.05;
        }

        this.markers.forEach((marker, index) => {
          if (marker.type === 'glow') {
            const scale = 1 + Math.sin(this.time * 2 + index * 0.5) * 0.3;
            marker.mesh.scale.set(scale, scale, 1);
          }
        });
      }

      if (this.camera) {
        this.camera.position.z += (this.targetCameraZ - this.camera.position.z) * 0.08;
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  window.Globe3D = Globe3D;
})();

