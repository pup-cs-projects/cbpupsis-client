# PSGC data

Offline Philippine Standard Geographic Code data for the address picker: 17 regions, their
provinces, 1,634 cities and municipalities, and 42,036 barangays. Nothing is fetched at runtime.

`data/<region-id>.json` holds one region as `[{ name, cities: [[cityName, [barangay, …]], …] }]`.
Each file loads on demand (see `index.ts`), so a student only downloads their own region.

## Source and build

Generated once from the MIT-licensed [`psgc`](https://www.npmjs.com/package/psgc) 2.2.0 package
(PSA PSGC), not edited by hand. Choices made while building it:

- Barangays are grouped by the first six digits of their PSGC code, and each group is matched to
  a city or municipality by name within its province.
- The source lists the same province twice (`Cotabato`, `North Cotabato`); both are `Cotabato`.
- Manila appears in the source as 14 legacy districts; they are merged into one city (897
  barangays). NCR's only "province" is Metro Manila, which the picker hides. Quezon City keeps
  its `City` so it is not mistaken for Quezon province.
- `Maguindanao del Norte` / `del Sur` follow the 2022 split. Datu Montawal has no barangays in
  the source, so it is left out.

To refresh the data, rebuild from a newer `psgc` release the same way and replace the JSON files;
the tests in `psgc.test.ts` check that every region loads and every city has barangays.
