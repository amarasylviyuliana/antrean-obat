'use client';

import { useEffect, useRef } from 'react';
import { CLINIC, isPointInPolygon, MAX_KM } from '@/lib/geo';

// Peta Leaflet/OpenStreetMap: marker klinik, pin pasien yang bisa digeser / diklik di peta.
export default function MapPicker({ value, boundary, onChange, onInvalid, flyKey }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const pinRef = useRef(null);
  const lineRef = useRef(null);
  const boundaryRef = useRef(boundary);
  const valueRef = useRef(value);
  const boundaryLayerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onInvalidRef = useRef(onInvalid);
  onChangeRef.current = onChange;
  onInvalidRef.current = onInvalid;
  boundaryRef.current = boundary;
  valueRef.current = value;

  // Inisialisasi peta sekali
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(elRef.current).setView([CLINIC.lat, CLINIC.lng], 12);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const icon = (emoji) =>
        L.divIcon({ html: emoji, className: 'emoji-pin', iconSize: [28, 28], iconAnchor: [14, 26] });

      L.marker([CLINIC.lat, CLINIC.lng], { icon: icon('🏥'), interactive: true })
        .addTo(map)
        .bindPopup(`<b>${CLINIC.name}</b>`);
      L.circle([CLINIC.lat, CLINIC.lng], {
        radius: MAX_KM * 1000,
        color: '#0d9488',
        weight: 1,
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(map);

      map.on('click', (e) => {
        const selectedBoundary = boundaryRef.current;
        if (!selectedBoundary) return;
        if (!isPointInPolygon(e.latlng.lat, e.latlng.lng, selectedBoundary.path)) {
          onInvalidRef.current();
          return;
        }
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });
      map._icon = icon;
      setTimeout(() => map.invalidateSize(), 100);
      syncPin();
      syncBoundary();
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        pinRef.current = null;
        lineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncPin() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!value) {
      if (pinRef.current) {
        map.removeLayer(pinRef.current);
        pinRef.current = null;
      }
      if (lineRef.current) {
        map.removeLayer(lineRef.current);
        lineRef.current = null;
      }
      return;
    }
    const ll = [value.lat, value.lng];
    if (!pinRef.current) {
      const pin = L.marker(ll, { draggable: Boolean(boundaryRef.current), icon: map._icon('📍') }).addTo(map);
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        const selectedBoundary = boundaryRef.current;
        if (!selectedBoundary || !isPointInPolygon(p.lat, p.lng, selectedBoundary.path)) {
          const previous = valueRef.current;
          if (previous) pin.setLatLng([previous.lat, previous.lng]);
          onInvalidRef.current();
          return;
        }
        onChangeRef.current(p.lat, p.lng);
      });
      pinRef.current = pin;
    } else {
      pinRef.current.setLatLng(ll);
    }
    if (!lineRef.current) {
      lineRef.current = L.polyline([[CLINIC.lat, CLINIC.lng], ll], {
        color: '#0d9488',
        weight: 3,
        dashArray: '6 6',
      }).addTo(map);
    } else {
      lineRef.current.setLatLngs([[CLINIC.lat, CLINIC.lng], ll]);
    }
  }

  function syncBoundary() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }
    if (boundaryRef.current) {
      boundaryLayerRef.current = L.polygon(boundaryRef.current.path, {
        color: '#0d9488',
        weight: 2,
        fillColor: '#14b8a6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
      map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [20, 20], maxZoom: 16 });
    }
  }

  useEffect(() => {
    syncPin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    syncBoundary();
  }, [boundary]);

  useEffect(() => {
    const pin = pinRef.current;
    if (pin) pin.dragging[boundary ? 'enable' : 'disable']();
  }, [boundary]);

  // Pindahkan tampilan peta saat pasien memilih kecamatan/kelurahan dari pencarian
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    if (boundaryLayerRef.current) {
      map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [20, 20], maxZoom: 16 });
    } else {
      map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey, boundary]);

  return <div ref={elRef} className="h-72 w-full overflow-hidden rounded-xl border border-slate-300" />;
}
