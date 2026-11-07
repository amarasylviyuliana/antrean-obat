import { NextResponse } from 'next/server';
import { AREAS_BY_CITY, findPointInPolygon } from '@/lib/geo';
import { getAreaBoundary } from '@/lib/area-boundaries';

export const dynamic = 'force-dynamic';

export function GET(req) {
  const params = new URL(req.url).searchParams;
  const city = params.get('city') || '';
  const kecamatan = params.get('kecamatan') || '';
  const kelurahan = params.get('kelurahan') || '';
  const area = AREAS_BY_CITY[city]?.find((entry) => entry.kecamatan === kecamatan);
  if (!area || !area.kelurahan.includes(kelurahan)) {
    return NextResponse.json({ error: 'Pilih kelurahan sesuai kota/kabupaten dan kecamatan.' }, { status: 400 });
  }

  const boundary = getAreaBoundary(city, kecamatan, kelurahan);
  if (!boundary) {
    console.error(`[GET /api/area-boundaries] Boundary data is missing for ${city}/${kecamatan}/${kelurahan}`);
    return NextResponse.json({ error: 'Batas wilayah belum tersedia.' }, { status: 500 });
  }

  const point = findPointInPolygon(boundary.path, boundary.lat, boundary.lng);
  if (!point) {
    console.error(`[GET /api/area-boundaries] Invalid polygon for ${city}/${kecamatan}/${kelurahan}`);
    return NextResponse.json({ error: 'Batas wilayah tidak valid.' }, { status: 500 });
  }

  return NextResponse.json({ boundary: { ...boundary, ...point } });
}
