/**
 * Globe Component - Web WorldWind with Dark Theme
 * Shows continents with markers and connections
 * @version 1.0.0
 */

(function() {
  'use strict';

  class GlobeWorldWind {
    constructor(canvasId, options = {}) {
      this.canvasId = canvasId;
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) {
        console.warn(`GlobeWorldWind: Canvas with id "${canvasId}" not found`);
        return;
      }

      this.options = {
        autoRotate: true,
        rotationSpeed: 0.1,
        ...options
      };

      this.wwd = null;
      this.markersLayer = null;
      this.connectionsLayer = null;
      this.isDragging = false;
      this.autoRotate = this.options.autoRotate;
      this.lastMousePosition = { x: 0, y: 0 };

      // Italy locations
      this.italyLocations = [
        { lat: 41.9028, lon: 12.4964, name: 'Roma' },
        { lat: 45.4408, lon: 12.3155, name: 'Venezia' },
        { lat: 45.4642, lon: 9.1900, name: 'Milano' },
        { lat: 43.7696, lon: 11.2558, name: 'Firenze' },
        { lat: 40.8518, lon: 14.2681, name: 'Napoli' },
        { lat: 37.5079, lon: 15.0830, name: 'Catania' },
        { lat: 39.2435, lon: 9.1334, name: 'Cagliari' },
        { lat: 44.4949, lon: 11.3428, name: 'Bologna' }
      ];

      // International locations
      this.internationalLocations = [
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

      this.init();
    }

    init() {
      try {
        console.log('[GlobeWorldWind] Initializing...');

        // Check if WorldWind is available
        if (typeof WorldWind === 'undefined') {
          throw new Error('WorldWind is not loaded. Check if the script is included correctly.');
        }

        // Set canvas size explicitly for Web WorldWind
        const container = this.canvas.parentElement;
        if (!container) {
          throw new Error('Canvas container not found');
        }
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        console.log('[GlobeWorldWind] Canvas size:', rect.width, 'x', rect.height);

        // Create WorldWindow
        this.wwd = new WorldWind.WorldWindow(this.canvasId);
        console.log('[GlobeWorldWind] WorldWindow created');

        // Configure dark theme layers
        this.setupLayers();
        console.log('[GlobeWorldWind] Layers configured');

        this.createMarkers();
        console.log('[GlobeWorldWind] Markers created');

        this.createConnections();
        console.log('[GlobeWorldWind] Connections created');

        this.setupControls();
        this.setupEventListeners();

        // Set initial view (centered on Italy)
        this.wwd.navigator.lookAtLocation = {
          latitude: 42.5,
          longitude: 12.5
        };
        this.wwd.navigator.range = 3e7; // Zoom level
        this.wwd.navigator.heading = 0;
        this.wwd.navigator.tilt = 0;
        this.wwd.navigator.roll = 0;
        console.log('[GlobeWorldWind] Initial view set');

        // Start animation
        this.animate();
        console.log('[GlobeWorldWind] Animation started');

        // Hide loading
        const loadingEl = document.getElementById('globeLoading');
        if (loadingEl) {
          loadingEl.style.opacity = '0';
          setTimeout(() => loadingEl.style.display = 'none', 500);
        }

        console.log('[GlobeWorldWind] Initialization complete');
      } catch (error) {
        console.error('[GlobeWorldWind] Initialization error:', error);
        // Hide loading and show error
        const loadingEl = document.getElementById('globeLoading');
        if (loadingEl) {
          loadingEl.innerHTML = '<p style="color: #ef4444;">Errore nel caricamento del globo. <br>Controlla la console per dettagli.</p>';
        }
      }
    }

    setupLayers() {
      // Background color - dark
      this.wwd.backgroundColor = new WorldWind.Color(0.04, 0.04, 0.06, 1);

      // Add layers in order
      // 1. Blue Marble (basemap)
      const bingAerialLayer = new WorldWind.BingAerialWithLabelsLayer();
      bingAerialLayer.enabled = true;
      this.wwd.addLayer(bingAerialLayer);

      // 2. Compass (minimal styling)
      const compassLayer = new WorldWind.CompassLayer();
      compassLayer.enabled = false; // Disabled for cleaner look
      this.wwd.addLayer(compassLayer);

      // 3. Coordinates display
      const coordinatesLayer = new WorldWind.CoordinatesDisplayLayer(this.wwd);
      coordinatesLayer.enabled = false; // Disabled for cleaner look
      this.wwd.addLayer(coordinatesLayer);

      // 4. View controls
      const viewControlsLayer = new WorldWind.ViewControlsLayer(this.wwd);
      viewControlsLayer.enabled = false; // We use custom controls
      this.wwd.addLayer(viewControlsLayer);

      // 5. Markers layer
      this.markersLayer = new WorldWind.RenderableLayer("Markers");
      this.markersLayer.enabled = true;
      this.wwd.addLayer(this.markersLayer);

      // 6. Connections layer
      this.connectionsLayer = new WorldWind.RenderableLayer("Connections");
      this.connectionsLayer.enabled = true;
      this.wwd.addLayer(this.connectionsLayer);
    }

    createMarkers() {
      // Placemark attributes for Italy locations (green, larger)
      const italyAttributes = new WorldWind.PlacemarkAttributes(null);
      italyAttributes.imageScale = 0.6;
      italyAttributes.imageOffset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 0.5
      );
      italyAttributes.imageColor = WorldWind.Color.WHITE;
      italyAttributes.labelAttributes.offset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 1.2
      );
      italyAttributes.labelAttributes.color = WorldWind.Color.fromBytes(16, 185, 129, 255); // Green
      italyAttributes.labelAttributes.font = new WorldWind.Font("Arial", 10, WorldWind.Font.BOLD);
      italyAttributes.drawLeaderLine = true;
      italyAttributes.leaderLineAttributes.outlineColor = WorldWind.Color.fromBytes(16, 185, 129, 255);

      // Placemark attributes for international locations (blue)
      const intlAttributes = new WorldWind.PlacemarkAttributes(null);
      intlAttributes.imageScale = 0.4;
      intlAttributes.imageOffset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 0.5
      );
      intlAttributes.imageColor = WorldWind.Color.WHITE;
      intlAttributes.labelAttributes.offset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 1.2
      );
      intlAttributes.labelAttributes.color = WorldWind.Color.fromBytes(59, 130, 246, 255); // Blue
      intlAttributes.labelAttributes.font = new WorldWind.Font("Arial", 9, WorldWind.Font.NORMAL);
      intlAttributes.drawLeaderLine = false;

      // Use pushpin images
      const italyPinUrl = "https://files.worldwind.arc.nasa.gov/artifactory/web/0.9.0/images/pushpins/castshadow-green.png";
      const intlPinUrl = "https://files.worldwind.arc.nasa.gov/artifactory/web/0.9.0/images/pushpins/castshadow-blue.png";

      // Add Italy markers
      this.italyLocations.forEach(loc => {
        const position = new WorldWind.Position(loc.lat, loc.lon, 0);
        const placemark = new WorldWind.Placemark(position, false, italyAttributes);
        placemark.label = loc.name;
        placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
        placemark.attributes = italyAttributes;
        placemark.attributes.imageSource = italyPinUrl;
        this.markersLayer.addRenderable(placemark);
      });

      // Add international markers
      this.internationalLocations.forEach(loc => {
        const position = new WorldWind.Position(loc.lat, loc.lon, 0);
        const placemark = new WorldWind.Placemark(position, false, intlAttributes);
        placemark.label = loc.name;
        placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
        placemark.attributes = intlAttributes;
        placemark.attributes.imageSource = intlPinUrl;
        this.markersLayer.addRenderable(placemark);
      });
    }

    createConnections() {
      const shapeAttributes = new WorldWind.ShapeAttributes(null);
      shapeAttributes.outlineColor = WorldWind.Color.fromBytes(59, 130, 246, 255); // Blue
      shapeAttributes.outlineWidth = 1.5;
      shapeAttributes.outlineOpacity = 0.4;
      shapeAttributes.interiorColor = WorldWind.Color.fromBytes(59, 130, 246, 255);
      shapeAttributes.interiorOpacity = 0.1;

      // Italy connections (green, more visible)
      const italyConnectionAttrs = new WorldWind.ShapeAttributes(null);
      italyConnectionAttrs.outlineColor = WorldWind.Color.fromBytes(16, 185, 129, 255); // Green
      italyConnectionAttrs.outlineWidth = 2;
      italyConnectionAttrs.outlineOpacity = 0.5;
      italyConnectionAttrs.interiorColor = WorldWind.Color.fromBytes(16, 185, 129, 255);
      italyConnectionAttrs.interiorOpacity = 0.15;

      // Create connections between Italian cities
      for (let i = 0; i < this.italyLocations.length; i++) {
        for (let j = i + 1; j < this.italyLocations.length; j++) {
          const positions = [
            new WorldWind.Position(this.italyLocations[i].lat, this.italyLocations[i].lon, 0),
            new WorldWind.Position(this.italyLocations[j].lat, this.italyLocations[j].lon, 0)
          ];

          const path = new WorldWind.SurfacePolyline(positions, italyConnectionAttrs);
          path.pathType = WorldWind.GREAT_CIRCLE;
          this.connectionsLayer.addRenderable(path);
        }
      }

      // Create some international connections
      const limit = Math.min(this.internationalLocations.length, 8);
      for (let i = 0; i < limit; i++) {
        for (let j = i + 1; j < limit; j++) {
          if (Math.random() > 0.5) continue;

          const positions = [
            new WorldWind.Position(this.internationalLocations[i].lat, this.internationalLocations[i].lon, 0),
            new WorldWind.Position(this.internationalLocations[j].lat, this.internationalLocations[j].lon, 0)
          ];

          const path = new WorldWind.SurfacePolyline(positions, shapeAttributes);
          path.pathType = WorldWind.GREAT_CIRCLE;
          this.connectionsLayer.addRenderable(path);
        }
      }
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
      // Mouse events
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

      // Touch events
      this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
      this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

      // Resize
      window.addEventListener('resize', this.onResize.bind(this));
    }

    onMouseDown(e) {
      this.isDragging = true;
      this.lastMousePosition = { x: e.clientX, y: e.clientY };
      this.autoRotate = false;
      const btn = document.getElementById('globeRotateBtn');
      if (btn) btn.classList.remove('active');
    }

    onMouseMove(e) {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.lastMousePosition.x;
      const deltaY = e.clientY - this.lastMousePosition.y;

      this.wwd.navigator.heading += deltaX * 0.1;
      this.wwd.navigator.tilt += deltaY * 0.1;
      this.wwd.navigator.tilt = Math.max(0, Math.min(90, this.wwd.navigator.tilt));

      this.lastMousePosition = { x: e.clientX, y: e.clientY };
    }

    onMouseUp() {
      this.isDragging = false;
    }

    onTouchStart(e) {
      this.isDragging = true;
      this.lastMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.autoRotate = false;
      const btn = document.getElementById('globeRotateBtn');
      if (btn) btn.classList.remove('active');
    }

    onTouchMove(e) {
      if (!this.isDragging) return;
      e.preventDefault();

      const deltaX = e.touches[0].clientX - this.lastMousePosition.x;
      const deltaY = e.touches[0].clientY - this.lastMousePosition.y;

      this.wwd.navigator.heading += deltaX * 0.1;
      this.wwd.navigator.tilt += deltaY * 0.1;
      this.wwd.navigator.tilt = Math.max(0, Math.min(90, this.wwd.navigator.tilt));

      this.lastMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    onTouchEnd() {
      this.isDragging = false;
    }

    onResize() {
      if (this.wwd && this.canvas) {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.wwd.redraw();
      }
    }

    toggleAutoRotate() {
      this.autoRotate = !this.autoRotate;
    }

    reset() {
      if (this.wwd) {
        this.wwd.navigator.lookAtLocation = {
          latitude: 42.5,
          longitude: 12.5
        };
        this.wwd.navigator.range = 3e7;
        this.wwd.navigator.heading = 0;
        this.wwd.navigator.tilt = 0;
        this.wwd.navigator.roll = 0;
        this.autoRotate = true;
      }
    }

    animate() {
      requestAnimationFrame(this.animate.bind(this));

      if (this.wwd) {
        if (this.autoRotate) {
          this.wwd.navigator.heading += this.options.rotationSpeed;
        }
        this.wwd.redraw();
      }
    }
  }

  // Export to global
  window.GlobeWorldWind = GlobeWorldWind;
})();
