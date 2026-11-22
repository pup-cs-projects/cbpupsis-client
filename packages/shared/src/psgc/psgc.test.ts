import { afterEach, describe, expect, it, vi } from "vitest";

import {
  citiesOf,
  formatAddress,
  isNcr,
  loadProvinces,
  NCR_REGION_ID,
  PSGC_REGIONS,
} from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("psgc data", () => {
  it("loads every region from the bundle without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const region of PSGC_REGIONS) {
      const provinces = await loadProvinces(region.id);
      expect(provinces.length, region.id).toBeGreaterThan(0);
      const cities = provinces.flatMap((p) => p.cities);
      expect(cities.length, region.id).toBeGreaterThan(0);
      // Every city a student can pick must offer at least one barangay.
      expect(cities.filter((c) => c.barangays.length === 0).map((c) => c.name)).toEqual([]);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists NCR as one province-less group of 17 cities, with Manila's 897 barangays", async () => {
    expect(isNcr(NCR_REGION_ID)).toBe(true);
    const provinces = await loadProvinces(NCR_REGION_ID);

    expect(provinces).toHaveLength(1);
    const cities = citiesOf(provinces, provinces[0]!.name);
    expect(cities).toHaveLength(17);
    const manila = cities.find((c) => c.name === "Manila");
    expect(manila?.barangays).toHaveLength(897);
    expect(manila?.barangays).toContain("Barangay 630");
  });

  it("keeps each city under its own province when names repeat", async () => {
    const provinces = await loadProvinces("region-iii");
    const pampanga = citiesOf(provinces, "Pampanga").map((c) => c.name);
    const bulacan = citiesOf(provinces, "Bulacan").map((c) => c.name);

    expect(pampanga).toContain("San Fernando");
    expect(bulacan).not.toContain("San Fernando");
  });

  it("rejects an unknown region instead of caching the failure", async () => {
    await expect(loadProvinces("atlantis")).rejects.toThrow("Unknown PSGC region");
    await expect(loadProvinces("atlantis")).rejects.toThrow("Unknown PSGC region");
  });
});

describe("formatAddress", () => {
  it("writes NCR as street, barangay, city, Metro Manila", () => {
    expect(
      formatAddress({
        street: "123 Mabini St.",
        barangay: "Barangay 630",
        city: "Manila",
        province: "",
        regionId: "ncr",
      }),
    ).toBe("123 Mabini St., Brgy. 630, Manila, Metro Manila");
  });

  it("writes every other region with its province and region", () => {
    expect(
      formatAddress({
        street: "  25 Mabini   Street ",
        barangay: "San Roque",
        city: "City of Antipolo",
        province: "Rizal",
        regionId: "region-iv-a",
      }),
    ).toBe("25 Mabini Street, Brgy. San Roque, City of Antipolo, Rizal, CALABARZON (Region IV-A)");
  });
});
