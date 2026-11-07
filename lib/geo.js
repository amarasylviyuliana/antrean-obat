// Konstanta lokasi, rumus jarak (Haversine), tarif ongkir, dan data kecamatan/kelurahan Kota Bandung.
// File ini aman dipakai di server maupun browser.

export const CLINIC = {
  name: 'Klinik Utama (Buahbatu)',
  kecamatan: 'Buahbatu',
  lat: -6.9483,
  lng: 107.6432,
};

export const MAX_KM = 20;
export const BASE_FEE = 8000; // 0 - 3 km
export const BASE_KM = 3;
export const PER_KM = 2500; // per km di atas 3 km

export const OUT_OF_RANGE_MSG =
  'Alamat di luar jangkauan pengantaran instant (Maksimal 20 km dari Buahbatu)';

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isPointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[j];
    const cross = (lng - lng1) * (lat2 - lat1) - (lat - lat1) * (lng2 - lng1);
    if (
      Math.abs(cross) < 1e-10 &&
      lng >= Math.min(lng1, lng2) - 1e-10 &&
      lng <= Math.max(lng1, lng2) + 1e-10 &&
      lat >= Math.min(lat1, lat2) - 1e-10 &&
      lat <= Math.max(lat1, lat2) + 1e-10
    ) {
      return true;
    }
    if ((lat1 > lat) !== (lat2 > lat) && lng < ((lng2 - lng1) * (lat - lat1)) / (lat2 - lat1) + lng1) {
      inside = !inside;
    }
  }
  return inside;
}

export function isPointInPolygon(lat, lng, rings) {
  if (!Array.isArray(rings) || !rings.length || !isPointInRing(lat, lng, rings[0])) return false;
  return !rings.slice(1).some((ring) => isPointInRing(lat, lng, ring));
}

export function findPointInPolygon(rings, preferredLat, preferredLng) {
  if (isPointInPolygon(preferredLat, preferredLng, rings)) {
    return { lat: preferredLat, lng: preferredLng };
  }
  const outerRing = rings?.[0];
  if (!Array.isArray(outerRing) || outerRing.length < 3) return null;

  const latitudes = outerRing.map(([lat]) => lat);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  let best = null;
  let bestWidth = 0;

  for (let step = 0; step <= 40; step += 1) {
    const lat = minLat + ((maxLat - minLat) * (step + 0.5)) / 41;
    const intersections = [];
    for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
      const [lat1, lng1] = outerRing[i];
      const [lat2, lng2] = outerRing[j];
      if ((lat1 > lat) !== (lat2 > lat)) {
        intersections.push(lng1 + ((lat - lat1) * (lng2 - lng1)) / (lat2 - lat1));
      }
    }
    intersections.sort((a, b) => a - b);

    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const lng = (intersections[i] + intersections[i + 1]) / 2;
      const width = intersections[i + 1] - intersections[i];
      if (width > bestWidth && isPointInPolygon(lat, lng, rings)) {
        best = { lat, lng };
        bestWidth = width;
      }
    }
  }

  if (best) return best;
  const fallback = { lat: outerRing[0][0], lng: outerRing[0][1] };
  return isPointInPolygon(fallback.lat, fallback.lng, rings) ? fallback : null;
}

export function calcShipping(lat, lng) {
  const km = Math.round(haversineKm(CLINIC.lat, CLINIC.lng, lat, lng) * 100) / 100;
  let fee = BASE_FEE;
  if (km > BASE_KM) fee = BASE_FEE + (km - BASE_KM) * PER_KM;
  fee = Math.ceil(fee / 100) * 100; // dibulatkan ke atas per Rp 100
  return { distanceKm: km, fee, within: km <= MAX_KM };
}

export function estimatedDeliveryMinutes(distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return null;
  return Math.max(15, Math.ceil((distance * 4 + 10) / 5) * 5);
}

export function deliveryEta(startedAt, distanceKm) {
  const value = String(startedAt || '');
  const timestamp = Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}+07:00`
  );
  const minutes = estimatedDeliveryMinutes(distanceKm);
  if (!Number.isFinite(timestamp) || minutes === null) return null;
  return timestamp + minutes * 60 * 1000;
}

export function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

// Titik tengah kecamatan bersifat perkiraan; pasien bisa menggeser pin di peta untuk lokasi yang tepat.
export const BANDUNG_CITY_AREAS = [
  { kecamatan: 'Buahbatu', lat: -6.9483, lng: 107.6432, kelurahan: ['Cijaura', 'Jatisari', 'Margasari', 'Sekejati'] },
  { kecamatan: 'Bandung Kidul', lat: -6.954, lng: 107.615, kelurahan: ['Batununggal', 'Kujangsari', 'Mengger', 'Wates'] },
  { kecamatan: 'Lengkong', lat: -6.931, lng: 107.618, kelurahan: ['Burangrang', 'Cijagra', 'Cikawao', 'Lingkar Selatan', 'Malabar', 'Paledang', 'Turangga'] },
  { kecamatan: 'Rancasari', lat: -6.949, lng: 107.67, kelurahan: ['Cipamokolan', 'Derwati', 'Manjahlega', 'Mekar Jaya'] },
  { kecamatan: 'Gedebage', lat: -6.953, lng: 107.695, kelurahan: ['Cimincrang', 'Cisaranten Kidul', 'Rancabolang', 'Rancanumpang'] },
  { kecamatan: 'Kiaracondong', lat: -6.921, lng: 107.646, kelurahan: ['Babakan Sari', 'Babakan Surabaya', 'Cicaheum', 'Kebon Kangkung', 'Kebonjayanti', 'Sukapura'] },
  { kecamatan: 'Batununggal', lat: -6.923, lng: 107.628, kelurahan: ['Binong', 'Cibangkong', 'Gumuruh', 'Kacapiring', 'Kebongedang', 'Kebonwaru', 'Maleer', 'Samoja'] },
  { kecamatan: 'Regol', lat: -6.937, lng: 107.6, kelurahan: ['Ancol', 'Balonggede', 'Ciateul', 'Cigereleng', 'Ciseureuh', 'Pasirluyu', 'Pungkur'] },
  { kecamatan: 'Bojongloa Kidul', lat: -6.949, lng: 107.595, kelurahan: ['Cibaduyut', 'Cibaduyut Kidul', 'Cibaduyut Wetan', 'Kebonlega', 'Mekar Wangi', 'Situsaeur'] },
  { kecamatan: 'Bojongloa Kaler', lat: -6.933, lng: 107.588, kelurahan: ['Babakan Asih', 'Babakan Tarogong', 'Jamika', 'Kopo', 'Suka Asih'] },
  { kecamatan: 'Babakan Ciparay', lat: -6.942, lng: 107.58, kelurahan: ['Babakan', 'Babakan Ciparay', 'Cirangrang', 'Margahayu Utara', 'Margasuka', 'Sukahaji'] },
  { kecamatan: 'Bandung Kulon', lat: -6.938, lng: 107.56, kelurahan: ['Caringin', 'Cibuntu', 'Cigondewah Kaler', 'Cigondewah Kidul', 'Cigondewah Rahayu', 'Cijerah', 'Gempolsari', 'Warungmuncang'] },
  { kecamatan: 'Astanaanyar', lat: -6.936, lng: 107.604, kelurahan: ['Cibadak', 'Karanganyar', 'Karasak', 'Nyengseret', 'Panjunan', 'Pelindung Hewan'] },
  { kecamatan: 'Andir', lat: -6.914, lng: 107.577, kelurahan: ['Campaka', 'Ciroyom', 'Dungus Cariang', 'Garuda', 'Kebon Jeruk', 'Maleber'] },
  { kecamatan: 'Cicendo', lat: -6.9065, lng: 107.595, kelurahan: ['Arjuna', 'Husein Sastranegara', 'Pajajaran', 'Pamoyanan', 'Pasirkaliki', 'Sukaraja'] },
  { kecamatan: 'Sukajadi', lat: -6.887, lng: 107.59, kelurahan: ['Cipedes', 'Pasteur', 'Sukabungah', 'Sukagalih', 'Sukawarna'] },
  { kecamatan: 'Cidadap', lat: -6.87, lng: 107.607, kelurahan: ['Ciumbuleuit', 'Hegarmanah', 'Ledeng'] },
  { kecamatan: 'Sukasari', lat: -6.87, lng: 107.58, kelurahan: ['Gegerkalong', 'Isola', 'Sarijadi', 'Sukarasa'] },
  { kecamatan: 'Coblong', lat: -6.887, lng: 107.613, kelurahan: ['Cipaganti', 'Dago', 'Lebakgede', 'Lebaksiliwangi', 'Sadang Serang', 'Sekeloa'] },
  { kecamatan: 'Bandung Wetan', lat: -6.904, lng: 107.615, kelurahan: ['Cihapit', 'Citarum', 'Tamansari'] },
  { kecamatan: 'Sumur Bandung', lat: -6.916, lng: 107.607, kelurahan: ['Braga', 'Kebon Pisang', 'Merdeka', 'Babakan Ciamis'] },
  { kecamatan: 'Cibeunying Kidul', lat: -6.903, lng: 107.638, kelurahan: ['Cicadas', 'Cikutra', 'Padasuka', 'Pasirlayung', 'Sukamaju', 'Sukapada'] },
  { kecamatan: 'Cibeunying Kaler', lat: -6.887, lng: 107.633, kelurahan: ['Cigadung', 'Cihaurgeulis', 'Neglasari', 'Sukaluyu'] },
  { kecamatan: 'Antapani', lat: -6.912, lng: 107.66, kelurahan: ['Antapani Kidul', 'Antapani Kulon', 'Antapani Tengah', 'Antapani Wetan'] },
  { kecamatan: 'Arcamanik', lat: -6.916, lng: 107.68, kelurahan: ['Cisaranten Bina Harapan', 'Cisaranten Endah', 'Sukamiskin', 'Cisaranten Kulon'] },
  { kecamatan: 'Mandalajati', lat: -6.897, lng: 107.67, kelurahan: ['Jati Handap', 'Karang Pamulang', 'Pasir Impun', 'Sindang Jaya'] },
  { kecamatan: 'Cinambo', lat: -6.93, lng: 107.687, kelurahan: ['Babakan Penghulu', 'Cisaranten Wetan', 'Pakemitan', 'Sukamulya'] },
  { kecamatan: 'Ujungberung', lat: -6.91, lng: 107.705, kelurahan: ['Cigending', 'Pasanggrahan', 'Pasirendah', 'Pasirjati', 'Pasirwangi'] },
  { kecamatan: 'Panyileukan', lat: -6.933, lng: 107.705, kelurahan: ['Cipadung Kidul', 'Cipadung Kulon', 'Cipadung Wetan', 'Mekar Mulya'] },
  { kecamatan: 'Cibiru', lat: -6.925, lng: 107.725, kelurahan: ['Cipadung', 'Cisurupan', 'Palasari', 'Pasirbiru'] },
];

export const BANDUNG_REGENCY_AREAS = [
  { kecamatan: 'Bojongsoang', lat: -6.99, lng: 107.63, kelurahan: ['Bojongsoang', 'Bojongsari', 'Buahbatu', 'Cipagalo', 'Lengkong', 'Tegalluar'] },
  { kecamatan: 'Dayeuhkolot', lat: -6.99, lng: 107.62, kelurahan: ['Cangkuang Kulon', 'Cangkuang Wetan', 'Citeureup', 'Dayeuhkolot', 'Pasawahan', 'Sukapura'] },
  { kecamatan: 'Cileunyi', lat: -6.94, lng: 107.75, kelurahan: ['Cibiru Hilir', 'Cibiru Wetan', 'Cileunyi Kulon', 'Cileunyi Wetan', 'Cimekar', 'Cinunuk'] },
  { kecamatan: 'Cilengkrang', lat: -6.89, lng: 107.69, kelurahan: ['Cipanjalu', 'Ciporeat', 'Cilengkrang', 'Girimekar', 'Jatiendah', 'Melatiwangi'] },
  { kecamatan: 'Cimenyan', lat: -6.87, lng: 107.66, kelurahan: ['Cibeunying', 'Ciburial', 'Cikadut', 'Cimenyan', 'Mandalamekar', 'Mekarmanik', 'Mekarsaluyu', 'Padasuka', 'Sindanglaya'] },
  { kecamatan: 'Margahayu', lat: -6.97, lng: 107.57, kelurahan: ['Margahayu Selatan', 'Margahayu Tengah', 'Sayati', 'Sulaiman', 'Sukamenak'] },
  { kecamatan: 'Margaasih', lat: -6.97, lng: 107.55, kelurahan: ['Cigondewah Hilir', 'Lagadar', 'Mekarrahayu', 'Margaasih', 'Nanjung', 'Rahayu'] },
  { kecamatan: 'Katapang', lat: -7.02, lng: 107.57, kelurahan: ['Banyusari', 'Cilampeni', 'Gandasari', 'Katapang', 'Pangauban', 'Sangkanhurip', 'Sukamukti'] },
];

export const AREAS_BY_CITY = {
  'Kota Bandung': BANDUNG_CITY_AREAS,
  'Kabupaten Bandung': BANDUNG_REGENCY_AREAS,
};
