# UK branded catalogue

The initial collection contains 34 UK products. Each entry in src/data/ukBranded.ts links to the manufacturer or retailer label used, records when it was checked, and includes portion weights where the source provides them. Values are for 100 g as sold. The catalogue is separate from CoFID and practice-made foods. Product label data is also stored with the intake entry so catalogue updates do not change earlier calculations.

Record undisclosed nutrients as missing. Keep less-than statements as display bounds, with no exact numeric intake assigned. Folic acid and niacin declared on labels appear as separate label details. Do not silently substitute those figures for total folate or niacin equivalents.

When adding or updating products, check the exact UK variant and the numeric nutrition table. Do not infer a barcode from a retailer product code. Record known pack weights and avoid deriving portions from rounded nutrient amounts. If the label differs across packs or time, give each confirmed formulation a distinct version. Check the packet when the website and packet disagree.

## Baseline for future licensed feeds

| Field | Published numeric values in this collection |
| --- | ---: |
| Energy | 34 of 34 |
| Fibre | 32 of 34 |
| Iron | 14 of 34 |
| Calcium | 6 of 34 |
| Vitamin D | 13 of 34 |
| Vitamin B12 | 6 of 34 |
| Vitamin C | 1 of 34 |
| Zinc | 0 of 34 |
| Iodine | 0 of 34 |

Before subscribing to a commercial feed, request matches for these exact products, with declared and estimated figures identified separately. Ask whether the licence permits stored snapshots and reports, including after cancellation. Record coverage by nutrient rather than treating a brand-name match as verification. There is no commercial API connection or automated retail importer in this release.
