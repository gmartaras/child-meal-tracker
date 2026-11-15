# UK branded catalogue

The collection contains 62 UK products. Each entry in src/data/ukBranded.ts links to the manufacturer or retailer label used, records when it was checked, and includes portion measures where the source provides them. Values are usually per 100 g as sold. Plant drinks use their label values per 100 ml. Entries with oven-baked values identify that preparation in both the name and the label details. The catalogue is separate from CoFID and practice-made foods. Product label data is also stored with the intake entry so catalogue updates do not change earlier calculations.

Record undisclosed nutrients as missing. Keep less-than statements as display bounds, with no exact numeric intake assigned. Folic acid and niacin declared on labels appear as separate label details. Do not silently substitute those figures for total folate or niacin equivalents.

When adding or updating products, check the exact UK variant and the numeric nutrition table. Do not infer a barcode from a retailer product code. Record known pack weights and avoid deriving portions from rounded nutrient amounts. Use serving weights that match the nutrition table's preparation. For example, a frozen product's weight per item can be calculated from pack size and count and must be described as a pack average. If the label differs across packs or time, give each confirmed formulation a distinct version. Check the packet when the website and packet disagree.

## Baseline for future licensed feeds

| Field | Published numeric values in this collection |
| --- | ---: |
| Energy | 62 of 62 |
| Fibre | 58 of 62 |
| Iron | 15 of 62 |
| Calcium | 12 of 62 |
| Vitamin D | 20 of 62 |
| Vitamin B12 | 10 of 62 |
| Vitamin C | 1 of 62 |
| Zinc | 0 of 62 |
| Iodine | 2 of 62 |

Before subscribing to a commercial feed, request matches for these exact products, with declared and estimated figures identified separately. Ask whether the licence permits stored snapshots and reports, including after cancellation. Record coverage by nutrient rather than treating a brand-name match as verification. There is no commercial API connection or automated retail importer in this release.
