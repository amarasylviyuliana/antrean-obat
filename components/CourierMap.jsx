'use client';

import { useEffect, useRef, useState } from 'react';
import { CLINIC } from '@/lib/geo';

function getProgress(startedAt, durationMinutes, now = Date.now()) {
  const value = String(startedAt || '');
  const timestamp = Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}+07:00`
  );
  if (!Number.isFinite(timestamp)) return 0;
  const duration = Math.max(1, Number(durationMinutes)) * 60 * 1000;
  return Math.min(1, Math.max(0, (now - timestamp) / duration));
}

function courierPosition(destination, progress) {
  const fraction = Math.min(1, Math.max(0, progress));
  return [
    CLINIC.lat + (destination.lat - CLINIC.lat) * fraction,
    CLINIC.lng + (destination.lng - CLINIC.lng) * fraction,
  ];
}

export default function CourierMap({ destination, startedAt, durationMinutes }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const [progress, setProgress] = useState(() => getProgress(startedAt, durationMinutes));

  useEffect(() => {
    const updateProgress = () => setProgress(getProgress(startedAt, durationMinutes));
    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      const clinic = [CLINIC.lat, CLINIC.lng];
      const target = [destination.lat, destination.lng];
      const map = L.map(elRef.current).setView(clinic, 14);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const icon = (emoji) =>
        L.divIcon({ html: emoji, className: 'emoji-pin', iconSize: [28, 28], iconAnchor: [14, 26] });
      courierMarkerRef.current = L.marker(
        courierPosition(destination, getProgress(startedAt, durationMinutes)),
        { icon: icon('🛵'), zIndexOffset: 1000 }
      )
        .addTo(map)
        .bindPopup('Posisi kurir (estimasi)');
      L.marker(clinic, { icon: icon('🏥') })
        .addTo(map)
        .bindPopup(CLINIC.name);
      L.marker(target, { icon: icon('🏠') })
        .addTo(map)
        .bindPopup('Alamat tujuan');
      L.polyline([clinic, target], {
        color: '#0d9488',
        weight: 3,
        dashArray: '6 6',
      }).addTo(map);
      map.fitBounds(
        [clinic, target],
        { padding: [24, 24], maxZoom: 15 }
      );
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        courierMarkerRef.current = null;
      }
    };
  }, [destination.lat, destination.lng]);

  useEffect(() => {
    if (!courierMarkerRef.current) return;
    courierMarkerRef.current.setLatLng(courierPosition(destination, progress));
  }, [destination.lat, destination.lng, progress]);

  const remainingMinutes = Math.ceil(
    (Math.max(1, Number(durationMinutes)) * 60 * (1 - progress)) / 60
  );

  return (
    <div className="space-y-2">
      <div ref={elRef} className="h-72 w-full overflow-hidden rounded-xl border border-slate-300" />
      <p className="text-sm font-medium text-teal-800" aria-live="polite">
        {progress >= 1
          ? '🛵 Kurir diperkirakan sudah tiba di rumah.'
          : `🛵 Kurir diperkirakan tiba sekitar ${remainingMinutes} menit lagi.`}
      </p>
    </div>
  );
}
