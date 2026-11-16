# Nutrient Explorer

Open **Nutrient Explorer** below Food library, or choose **Add to Explorer** on a library food. This is an independent research workspace. It does not read or write client records, clinical assessments or their targets.

- **Foods** adds single foods, combinations and saved library recipes. Set grams, millilitres or available household measures; halve or double amounts. The initial amount is the source basis, normally 100 g/ml, or one dose.
- **Recipe** builds ingredients with a finished weight and portion count. Switch between whole recipe, per portion and per 100 g. **Save as library recipe** opens the existing recipe editor for review using current library data and saves to the signed-in account's food library.
- **Full day** separates meals in chronological order. The whole-day analysis includes all entered positive amounts. Switch the contribution chart between foods and meals.

Select a nutrient in the chart or searchable full profile. Contribution bars rank amounts for that nutrient; macro bars compare grams on a shared scale. These are composition calculations, without individual intake targets or deficiency classifications.

Missing data stays missing. Known subtotals are marked and never represented as complete totals. Inherited recipe partial values, derived salt, trace values and the NSP fallback for fibre are retained or flagged. Per-100-g analysis requires a known mass conversion or a user-entered recipe weight; ml are not silently assumed to weigh a gram. Household measures remain estimates. Cooking weight adjusts concentration without modelling nutrient losses. Recipe portion weights retain four decimal places when saved.

**Export analysis** downloads a CSV with the selected basis, nutrient results and data status, quantities, source identifiers, source URLs, available source dates/versions, source nutrient values and calculation notes. Spreadsheet formula prefixes in text are neutralised. CoFID entries link to the official dataset/user guide; branded entries link to their recorded label source. Edited CoFID and practitioner entries are identified separately.

Each draft is retained in application memory when navigating within the app, separately for all three modes. Refresh or sign-out clears it. It is excluded from backups and client records. The UI states this explicitly and warns before refreshing an active exploration. Save a recipe or export before closing. Food values are frozen when added; re-add a food to use later library edits. Exports contain only research foods and amounts, with no client data.

Validation covers amount/portion/yield scaling, unknown versus zero, derived and partial nutrients, source snapshots, density handling, safe CSV output, and recipe uncertainty. Browser coverage exercises foods, chart selection, export, navigation retention, recipe saving/re-use, full-day grouping and mobile layout with synthetic data.
