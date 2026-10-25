# v93: gas re-priced by area and week, Ram at 17 mpg, IRS rate by date (Oct 25 2026)

| | |
|---|---|
| **Branch** | `claude/best-solution-gas-audit-hmjs4l` |
| **App version** | v92 → **v93** |
| **Tests** | `node tests/gas-area-v93.test.js` (37 checks, new); `expense-audit` updated for the new prices (67/67) |
| **Live data changed** | No Supabase read or write. The update runs on Froggy's device the first time v93 opens (`gas_area_v93`). |

## REQUESTED

Froggy: look up the real regular gas price on the dates of every show, done and upcoming, in the area he
was for that show. Recalculate gas for every show, driving back and forth each day in the Ram at **17 mpg**.
Cranberry Fest was the only Airbnb (Warrens ↔ Merrillan every day, about 45 min) and he paid gas for 3
vehicles there. Do not miss a cent of mileage deduction. Audit day by day, flag anything he is doing wrong
or missing, and suggest easier ways.

## WHAT CHANGED

**1. Gas price by area and week (`GAS_AREA_2026`, `gasMarketPrice`).** Five areas, each a list of dated
regular-unleaded readings; days between readings are interpolated:

| Area | Used for | Basis |
|---|---|---|
| `wi` | Every SE Wisconsin show (Milwaukee, Mukwonago, Waukesha, West Bend, Franklin, Racine, Pewaukee, Plymouth) and the WI half of every Illinois trip | AAA Milwaukee-Waukesha metro; WI statewide where no metro figure was reported |
| `wiw` | Cranberry Fest (Warrens / Merrillan) | AAA La Crosse / Eau Claire |
| `chi` | Carol Stream, North Aurora, Rosemont | AAA Chicago metro (EIA Chicago + 12¢ where AAA was not reported) |
| `iln` | McHenry, Antioch, Gurnee, Woodstock, Lakemoor | AAA / GasBuddy Lake County |
| `ilc` | Burgoo (Utica) | IL statewide minus 10¢ (LaSalle County runs below the state) |

An Illinois trip is priced where the miles are driven: Chicago-area shows 28% WI / 72% IL, Lake-McHenry
45% IL, Utica 83% IL (`GAS_AREA_IL_SHARE`).

**2. Ram at 17 mpg** (`RAM_MPG`). Setup default 17.5 → 17, and any show set to 17.5 → 17. Another
vehicle's mpg on a show is left alone.

**3. Cranberry Fest, three vehicles leg by leg** (`v93Cranberry`). Thu 9/24 home → Warrens (home price),
Warrens → Merrillan 35; Fri + Sat Merrillan ↔ Warrens 70 a day; Sun Merrillan → Warrens 35, Warrens → home
(Warrens-area price). Ram 570 mi / 17 = **$144.58** (was $140.06 at 17.5 / $4.30). TJ Terrain 580 mi / 23 =
**$108.74** (was $108.43). Anthony Impala 554 mi / 14 = **$170.62** (was $170.19). The Ram's legs are saved
on the show (`routeLegs`) for the mileage log.

**4. IRS rate by date** (`IRS_RATES`, `irsRateOn`). The app used a flat 70¢ (the 2025 rate). 2026 is
**72.5¢ Jan-Jun (Notice 2026-10) and 76¢ from Jul 1 (Announcement 2026-11, mid-year raise for fuel
prices)**. Setup's IRS field now means "2027 on" (set to 76¢ until the IRS posts 2027 in late December).

**5. Rep-only shows are not Froggy's miles** (`showIrsMiles`). The deduction is for his own vehicle. A show
marked rep-only counted the rep's drive as his mileage. Now 0, unless Edit Show's new "Miles YOU drove your
truck" box says he drove stock out (`sh.ownerMiles`). Gas he paid the rep still counts as a cost.

**6. Tax view** (`calcYTD().taxProfit`, `showOwnGas`). The standard mileage rate replaces the gas for his
own truck on Schedule C; it does not stack. The Mileage screen and Accountant Package now show: mileage
deduction, his truck's gas inside expenses, and profit for the tax return = app profit + own-truck gas −
mileage. Gas paid for someone else's car (TJ, Anthony) stays deductible.

**7. IRS mileage log** (`exportMileageLog`). Mileage screen button. One row per trip: date, from, to,
business purpose, miles, rate, deduction, parking/tolls. A 5-day show he drove home from each night is 5
rows. Cranberry is its 6 legs.

**8. Log a business trip** (`settings.businessTrips`). Supply runs, post office trips for online orders,
product pickups. Round-trip miles, counted in the year's miles, the deduction and the log.

**9. Finished shows freeze at their own week's area price** (`v77FillBlanks`). Upcoming shows use Setup's
current price, now WI **$4.52** and a new IL field **$4.82**, blended for an Illinois show.

**Kept as he set it:** any per-show gas price he typed (anything but a v77 month value, 3.50, 4.00, 4.20,
4.30) and any "Actual Gas $". Each is named in the update log with that week's area price next to it, and
Edit Show has a "use it" link.

## SEED BOARD, BEFORE vs AFTER (approximate; the live board runs the same math on its real shows)

Every non-passed show through Oct 23 treated as worked. Fox & Found Oct and A Fair to Remember Fall are
crew-run on the seed.

| Date | Show | Area | Miles | Old $/gal | New $/gal | Old gas | New gas | Old IRS | New IRS |
|---|---|---|---|---|---|---|---|---|---|
| Jun 12 | Milwaukee Polish Fest (3d) | wi | 192 | 3.95 | 3.89 | 43.34 | 43.93 | 134.40 | 139.20 |
| Jun 13 | Maxwell Street Jun (2d) | wi | 56 | 3.95 | 3.88 | 12.64 | 12.78 | 39.20 | 40.60 |
| Jun 26 | Pewaukee Beach Party (2d) | wi | 128 | 3.95 | 3.70 | 28.89 | 27.86 | 89.60 | 92.80 |
| Jul 15 | Waukesha County Fair (5d) | wi | 220 | 4.03 | 3.77 | 50.66 | 48.79 | 154.00 | 167.20 |
| Jul 18 | Maxwell Street Jul (2d) | wi | 56 | 4.03 | 3.81 | 12.90 | 12.55 | 39.20 | 42.56 |
| Jul 21 | Washington County Fair (6d) | wi | 456 | 4.03 | 3.88 | 105.01 | 104.08 | 319.20 | 346.56 |
| Aug 2 | Rustic Fox Carol Stream | chi | 182 | 4.05 | 4.26 | 42.12 | 45.61 | 127.40 | 138.32 |
| Aug 4 | McHenry County Fair (6d) | iln | 540 | 4.05 | 4.04 | 124.97 | 128.33 | 378.00 | 410.40 |
| Aug 15 | Maxwell Street Aug (2d) | wi | 56 | 4.05 | 3.88 | 12.96 | 12.78 | 39.20 | 42.56 |
| Sep 3 | Sheboygan County Fair (5d) | wi | 620 | 4.30 | 3.78 | 152.34 | 137.86 | 434.00 | 471.20 |
| Sep 6 | Rustic Fox Carol Stream | chi | 182 | 4.30 | 4.27 | 44.72 | 45.71 | 127.40 | 138.32 |
| Sep 6 | St. Martins Fair (2d) | wi | 88 | 4.30 | 3.83 | 21.62 | 19.83 | 61.60 | 66.88 |
| Sep 12 | Harvest & Handmade | iln | 80 | 4.30 | 4.20 | 19.66 | 19.76 | 56.00 | 60.80 |
| Sep 12 | Maxwell Street Sep (2d) | wi | 56 | 4.30 | 4.04 | 13.76 | 13.31 | 39.20 | 42.56 |
| Sep 13 | A Girls Day Out | iln | 60 | 4.30 | 4.26 | 14.74 | 15.04 | 42.00 | 45.60 |
| Sep 19 | Party on the Pavement | wi | 48 | 4.30 | 4.45 | 11.79 | 12.56 | 33.60 | 36.48 |
| Sep 25 | Cranberry Fest (3 vehicles) | wiw | 570 | 4.30 | 4.31 | 418.68 | 423.94 | 399.00 | 433.20 |
| Oct 4 | Rustic Fox Carol Stream | chi | 182 | 4.20 | 4.60 | 43.68 | 49.25 | 127.40 | 138.32 |
| Oct 10 | Burgoo Fest (2d) | ilc | 600 | 4.20 | 4.52 | 144.00 | 159.53 | 420.00 | 456.00 |
| Oct 17 | Fox & Found N. Aurora (rep-only) | chi | 154 | 4.20 | 4.63 | 36.96 | 41.94 | 107.80 | 0.00 |
| Oct 23 | A Fair to Remember Fall (rep-only) | wi | 152 | 4.20 | 4.43 | 36.48 | 39.61 | 106.40 | 0.00 |
| | **Total** | | | | | **1,391.93** | **1,415.05** | **3,274.60** | **3,309.56** |

Old IRS counted $214.20 of rep-driven miles that were never his; the new rate adds about 6¢ a mile from
July on. The live board's numbers are in Setup → Audit log (`gas_area_v93`) and on each show's history.

## PRICE SOURCES (regular unleaded, as reported)

Wisconsin, Milwaukee-Waukesha unless marked: May 14 WI peak 4.58 · Jun 3 4.05 · ~Jun 15 WI 3.86 (WKOW/WXOW) ·
Jun 26 ~3.71 (Jul 3 3.61 down 10¢ w/w, WBAY/Stacker) · Jul 9 3.54 (MJS) · Jul 21 "near $4" (WBAY, used 3.88,
estimate) · Aug 14 WI 3.89 (Aug 21 3.95 less 6¢ w/w) · Aug 21 3.83 (WBAY/Stacker) · Aug 31 3.72 (TMJ4/GasBuddy) ·
Sep 4 3.74 (Spectrum News) · Sep 14 WI 4.09 (Stacker) · Sep 16 4.04, Sep 17 4.29 (Spectrum News) · Sep 19 WI
4.45 (WISN) · Sep 23 WI 4.41 (Badger Herald) · Sep 25 WI 4.36 (WSAW) · Oct 2 4.17 (Stacker) · Oct 9 WI 4.15 ·
Oct 17 WI ~4.23 (WVBO, derived) · Oct 23 4.35 (aggregator citing AAA) · Oct 24 WI 4.52 (WVBO/AAA).
West WI: La Crosse Sep 14 4.17 · Eau Claire Sep 21 4.36 · Sep 28 4.25 (one source) · La Crosse Oct 2 4.17.
Chicago metro: Aug 2 ~4.40 (EIA 4.28 + gap; IL 4.32) · Sep 6 ~4.45 (EIA 4.32) · Sep 18 4.96 (Stacker/AAA) ·
Sep 21 5.05 (AAA month-ago) · Oct 5 4.75 · Oct 21 4.79 (AAA) · Oct 24 4.82 (CBS Chicago/AAA).
Lake County: Aug 8 4.22 (GasBuddy) · Aug 31 4.23 (IL stand-in) · Sep 12 4.43 · Sep 18 4.86 · Oct 21 4.62 (AAA).
LaSalle: Oct 12 4.59 (IL 4.69, GasBuddy, less 10¢).
IRS: irs.gov IR-2025-128 (72.5¢); Announcement 2026-11, IRB 2026-29 (76¢ from Jul 1).

Gaps filled by interpolation: Jul 15-26 and Aug 2-9 in WI, Oct 4 in WI. Exact pump receipts beat all of it:
"Actual Gas $" in Edit Show overrides.

## FOR FROGGY TO CHECK (not changed by code)

- **Carol Stream 91 mi and North Aurora 77 mi one way.** Kenosha → Carol Stream is 61 and Milwaukee → Carol
  Stream 88, so from Waterford Carol Stream is likely high; Racine → North Aurora is 83, so North Aurora may
  be low. Check both in Google Maps from the garage; overclaimed miles are what an audit catches.
- **Anthony's Impala at 14 mpg** is low for an Impala (most get 19-28). If it was a V8 SS, fine; if not, his
  Cranberry gas is overstated about $50.
- **Did TJ and Anthony each drive Merrillan ↔ Warrens every day, or ride with you?** Carpooling the local
  legs takes 210 mi off a car.
- **The 10 shows from v83 that list one rep and not you but are not marked Rep-only.** Each still counts
  your miles. Mark them in the Audit screen.
- **Tolls.** Rosemont, Carol Stream and North Aurora trips run on the Illinois Tollway. Tolls are deductible
  on top of the mileage rate; log them under Parking / Tolls on the day.
- **Lunch.** $20 a day on local one-day shows is your own meal, not deductible. Meals count (50%) only on
  overnight trips like Cranberry. Fine for cash tracking, wrong for taxes; tell the preparer.
- **Odometer.** Write the Ram's odometer Jan 1 and Dec 31. Schedule C asks for total miles next to business miles.
