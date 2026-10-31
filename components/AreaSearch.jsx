'use client';

import { AREAS_BY_CITY } from '@/lib/geo';

export default function AreaSearch({ city, onCityChange, selected, onSelect }) {
  const areas = AREAS_BY_CITY[city] || [];
  const selectedArea = areas.find((area) => area.kecamatan === selected?.kecamatan);

  function selectKecamatan(kecamatan) {
    const area = areas.find((entry) => entry.kecamatan === kecamatan);
    if (area) onSelect({ kecamatan: area.kecamatan, kelurahan: '', lat: area.lat, lng: area.lng });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Kota/Kabupaten *</span>
        <select className="input" required value={city} onChange={(event) => onCityChange(event.target.value)}>
          <option value="">Pilih kota/kabupaten</option>
          <option value="Kota Bandung">Kota Bandung</option>
          <option value="Kabupaten Bandung">Kabupaten Bandung</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Kecamatan *</span>
        <select
          className="input"
          required
          disabled={!city}
          value={selected?.kecamatan || ''}
          onChange={(event) => selectKecamatan(event.target.value)}
        >
          <option value="">Pilih kecamatan</option>
          {areas.map((area) => <option key={area.kecamatan} value={area.kecamatan}>{area.kecamatan}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Desa/Kelurahan *</span>
        <select
          className="input"
          required
          value={selected?.kelurahan || ''}
          disabled={!selectedArea}
          onChange={(event) => {
            const kelurahan = selectedArea?.kelurahan.find((entry) => entry === event.target.value);
            if (selectedArea && kelurahan) {
              onSelect({
                kecamatan: selectedArea.kecamatan,
                kelurahan,
                lat: selectedArea.lat,
                lng: selectedArea.lng,
              });
            }
          }}
        >
          <option value="">Pilih kelurahan</option>
          {selectedArea?.kelurahan.map((kelurahan) => (
            <option key={kelurahan} value={kelurahan}>{kelurahan}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
