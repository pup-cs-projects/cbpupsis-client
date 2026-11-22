/**
 * Offline Philippine Standard Geographic Code (PSGC) data: region -> province -> city or
 * municipality -> barangay. Everything is bundled with the app; nothing here calls a network.
 *
 * The region list is small and always loaded. Each region's provinces, cities, and barangays
 * live in their own JSON file and load on first use, so a student pays only for their region.
 * The data comes from the open `psgc` dataset (see ./README.md).
 */

export interface PsgcRegion {
  /** Stable key, also the name of the region's data file. */
  id: string;
  name: string;
  designation: string;
  /** What the dropdown and a saved address show, e.g. `National Capital Region (NCR)`. */
  label: string;
}

export interface PsgcCity {
  name: string;
  /** Barangay names exactly as the PSGC writes them, e.g. `Barangay 630`. */
  barangays: string[];
}

export interface PsgcProvince {
  name: string;
  cities: PsgcCity[];
}

function region(id: string, name: string, designation: string): PsgcRegion {
  return { id, name, designation, label: `${name} (${designation})` };
}

/** In PSGC order: NCR first, then the Cordillera, then the numbered regions. */
export const PSGC_REGIONS: readonly PsgcRegion[] = [
  region("ncr", "National Capital Region", "NCR"),
  region("car", "Cordillera Administrative Region", "CAR"),
  region("region-i", "Ilocos Region", "Region I"),
  region("region-ii", "Cagayan Valley", "Region II"),
  region("region-iii", "Central Luzon", "Region III"),
  region("region-iv-a", "CALABARZON", "Region IV-A"),
  region("mimaropa", "Southwestern Tagalog Region", "MIMAROPA"),
  region("region-v", "Bicol Region", "Region V"),
  region("region-vi", "Western Visayas", "Region VI"),
  region("region-vii", "Central Visayas", "Region VII"),
  region("region-viii", "Eastern Visayas", "Region VIII"),
  region("region-ix", "Zamboanga Peninsula", "Region IX"),
  region("region-x", "Northern Mindanao", "Region X"),
  region("region-xi", "Davao Region", "Region XI"),
  region("region-xii", "SOCCSKSARGEN", "Region XII"),
  region("region-xiii", "Caraga Region", "Region XIII"),
  region("barmm", "Bangsamoro Autonomous Region in Muslim Mindanao", "BARMM"),
];

export const NCR_REGION_ID = "ncr";

/** What a saved NCR address names in place of a province and region. */
export const NCR_ADDRESS_NAME = "Metro Manila";

/** NCR has no provinces: the picker skips that step and lists its cities directly. */
export function isNcr(regionId: string): boolean {
  return regionId === NCR_REGION_ID;
}

export function findRegion(regionId: string): PsgcRegion | undefined {
  return PSGC_REGIONS.find((r) => r.id === regionId);
}

type RawProvince = { name: string; cities: [string, string[]][] };

// One literal import per file so a bundler can split each region into its own chunk.
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  ncr: () => import("./data/ncr.json"),
  car: () => import("./data/car.json"),
  "region-i": () => import("./data/region-i.json"),
  "region-ii": () => import("./data/region-ii.json"),
  "region-iii": () => import("./data/region-iii.json"),
  "region-iv-a": () => import("./data/region-iv-a.json"),
  mimaropa: () => import("./data/mimaropa.json"),
  "region-v": () => import("./data/region-v.json"),
  "region-vi": () => import("./data/region-vi.json"),
  "region-vii": () => import("./data/region-vii.json"),
  "region-viii": () => import("./data/region-viii.json"),
  "region-ix": () => import("./data/region-ix.json"),
  "region-x": () => import("./data/region-x.json"),
  "region-xi": () => import("./data/region-xi.json"),
  "region-xii": () => import("./data/region-xii.json"),
  "region-xiii": () => import("./data/region-xiii.json"),
  barmm: () => import("./data/barmm.json"),
};

const loaded = new Map<string, Promise<PsgcProvince[]>>();

/** The region's provinces with their cities and barangays, loaded once and then cached. */
export function loadProvinces(regionId: string): Promise<PsgcProvince[]> {
  const cached = loaded.get(regionId);
  if (cached) return cached;
  const load = LOADERS[regionId];
  if (!load) return Promise.reject(new Error(`Unknown PSGC region: ${regionId}`));
  const promise = load().then((module) =>
    (module.default as RawProvince[]).map((province) => ({
      name: province.name,
      cities: province.cities.map(([name, barangays]) => ({ name, barangays })),
    })),
  );
  // A failed load must not be cached, or the picker could never retry.
  promise.catch(() => loaded.delete(regionId));
  loaded.set(regionId, promise);
  return promise;
}

/** The cities a region offers: NCR's directly, every other region's through its provinces. */
export function citiesOf(provinces: readonly PsgcProvince[], provinceName: string): PsgcCity[] {
  return provinces.find((p) => p.name === provinceName)?.cities ?? [];
}

export interface AddressParts {
  /** House number and street, free text. */
  street: string;
  barangay: string;
  city: string;
  /** Empty for NCR. */
  province: string;
  regionId: string;
}

/** `Barangay 630` -> `630`, so the saved line reads `Brgy. 630` and not `Brgy. Barangay 630`. */
function barangayLabel(name: string): string {
  return name.replace(/^(?:Barangay|Bgy\.?)\s+/i, "").trim();
}

/**
 * The one comma-separated line a student's address is saved as:
 * `<House No. & Street>, Brgy. <Barangay>, <City/Municipality>, <Province>, <Region>`, or for
 * NCR `<House No. & Street>, Brgy. <Barangay>, <City/Municipality>, Metro Manila`.
 */
export function formatAddress(parts: AddressParts): string {
  const street = parts.street.trim().replace(/\s+/g, " ");
  const head = [street, `Brgy. ${barangayLabel(parts.barangay)}`, parts.city];
  if (isNcr(parts.regionId)) return [...head, NCR_ADDRESS_NAME].join(", ");
  const regionLabel = findRegion(parts.regionId)?.label ?? parts.regionId;
  return [...head, parts.province, regionLabel].join(", ");
}
