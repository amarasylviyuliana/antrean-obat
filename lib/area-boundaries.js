import boundaries from './area-boundaries.json';

export function getAreaBoundary(city, kecamatan, kelurahan) {
  return boundaries[city]?.[kecamatan]?.[kelurahan] || null;
}
