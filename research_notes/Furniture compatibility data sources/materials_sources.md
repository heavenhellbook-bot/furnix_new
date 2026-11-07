# Furniture material data sources for FURNIX — current as of November 2026

**I could not save a file in this environment.** The research notes are below, ready to save as `C:\Users\Андрей\Desktop\САЙТ Рай и Ад\Архив\furnix\research_notes\Furniture compatibility data sources\materials_sources.md`.

## Findings and recommended sources

| Supplier / official source | Useful data for FURNIX | Limitations and cautions |
|---|---|---|
| [EGGER](https://www.egger.com/) | The current homepage promotes the **Decorative Collection 26+** for furniture and interior design. Start from the manufacturer site to reach its current decor and product tools. | The decor/product subpages were not reliably accessible to this research tool, so I could not verify current downloadable asset formats, dimension tables, API terms, or matching-edge references. Do not treat the homepage’s decor imagery as licensed render assets. |
| [Kronospan products](https://www.kronospan.com/en_GB/products/) | The official product portal separates interior products, including melamine-faced boards, MDF products, HPL, compact boards, and edgebanding. This is a useful product-family entry point. | Catalog structure and availability are regional. Model stock and board sizes from the selected market’s product record, not from a global default. |
| [Kronospan edgebanding](https://kronospan.com/en_EN/products/view/kronodesign/edgebanding/edgebanding-15/) | Official product-specific page for the Kronodesign edgebanding range; a potential source for manufacturer edge references. | Confirm each edge SKU against its current decor and board product; a shared color name alone does not establish a production match. |
| [Pfleiderer DST System](https://www.pfleiderer.com/global-en/products/dst-system) | Explicitly separates **D = decor, S = surface texture, T = core technology**. A consistent visual design can be selected across different material solutions, while the core material is chosen for the application. | Pfleiderer notes that even the same decor/texture/core combination can vary slightly in appearance and feel across product groups and formats. Digital matching is a planning aid, not a guarantee of physical identity. |
| [Pfleiderer Product Finder](https://www.pfleiderer.com/global-en/products/product-finder) and [Decor Finder](https://www.pfleiderer.com/global-en/products/product-finder/decors) | The manufacturer says its finder supports selection by technical properties, emission class, recycled content, and certification; the Decor Finder lists decors and collections. | Use the product-level technical record for specification, not the decor record. |
| [Pfleiderer DecoBoard P2](https://www.pfleiderer.com/global-en/products/coated-panels/detail/decoboard-p2) | A useful example of a production-oriented record: it lists available board formats and thicknesses, product standard EN 14322, the P2 particleboard core conforming to EN 312, handling advice, and edging guidance. | Its listed sizes/thicknesses apply to that product and market record—not to all P2 boards or all suppliers. |
| [SWISS KRONO interiors](https://www.swisskrono.com/ch-en/products/) | The regional portal describes decor/structure options and product families including raw or coated particleboard, MDF, CDF, composite boards, work surfaces, and thick edges. | The page is regional and describes a broad portfolio; verify exact product availability, dimensions, and technical declarations in the relevant country catalog. |
| [REHAU RAUKANTEX](https://interior.rehau.com/en-en/raukantex) | Relevant official entry point for REHAU edge products and their selection tools. | Direct access was blocked to this research tool; I could not verify current edge-matching data, download formats, or licensing/API conditions. Confirm details in the supplier portal or with REHAU. |
| [Döllken Profiles](https://www.doellken-profiles.com/de/) | Official Döllken Profiles site. | The accessible page emphasizes floor profiles and skirting, not furniture edge tape. Do not assume its flooring decor finder is a furniture-board edge-match database; verify the exact Döllken product business and line before integration. |

### What to store for visual rendering

A decor or texture catalog can support **appearance and material selection**: supplier and collection, decor code/name, surface-texture code, finish, image or texture asset, grain direction, and a stated repeat/scale if supplied. Keep the manufacturer’s decor identifier separate from the product identifier. Pfleiderer’s DST model is a useful schema pattern because the same decor and texture can be paired with different core technologies. Its product information also warns that visual/tactile differences can occur between product groups and formats. ([DST System](https://www.pfleiderer.com/global-en/products/dst-system); [DecoBoard P2](https://www.pfleiderer.com/global-en/products/coated-panels/detail/decoboard-p2))

For FURNIX, render assets should be clearly labeled as **visual-only** unless the supplier expressly provides technical properties. Avoid deriving strength, stiffness, density, moisture resistance, fire performance, or fabrication tolerances from a decor image, collection brochure, or color-match listing. Use physical samples for final color/texture approval.

### What production calculations require

Keep production data in a separate, product-specific record: exact panel SKU and grade; core material; nominal thickness and applicable tolerance; sheet format; product standard; applicable declared properties and test methods; emission class; face orientation; and market/plant availability. For edge processing, add the exact edge SKU and material, width/thickness, decor/texture match reference, adhesive/process compatibility, and machine requirements. Pfleiderer’s DecoBoard P2 record is a good illustration: it provides format/thickness availability, identifies its core as P2 to EN 312, cites EN 14322, and recommends suitable edge types and EVA/PUR hot-melt adhesives. These are product-level facts—not universal rules for other boards. ([Pfleiderer DecoBoard P2](https://www.pfleiderer.com/global-en/products/coated-panels/detail/decoboard-p2))

An important standards distinction: BSI’s summaries of **EN 312** (particleboard) and **EN 636** (plywood) state that values in those product standards are **not characteristic values for design calculations**. The standards help classify/specify products; they do not let an app infer design strength from a grade name or decor catalog. ([EN 312 overview](https://knowledge.bsigroup.com/products/particleboards-specifications); [EN 636 overview](https://knowledge.bsigroup.com/products/plywood-specifications))

Useful standards to surface in product metadata, subject to checking the current edition and national adoption:

- **EN 312** — particleboard specifications; product type/use classification.
- **EN 622-5** — dry-process fibreboard/MDF specifications.
- **EN 636** — plywood specifications and use conditions.
- **EN 14322** — melamine-faced wood-based panels; cited by Pfleiderer for DecoBoard P2.
- **EN 438** — high-pressure decorative laminates (HPL).
- **EN 13986** — wood-based panels used in construction: characteristics, conformity assessment, and marking. BSI notes it covers plywood, particleboard, and MDF for construction uses, and that it is not intended for non-construction applications. ([BS EN 13986 overview](https://knowledge.bsigroup.com/products/wood-based-panels-for-use-in-construction-characteristics-evaluation-of-conformity-and-marking))

For a furniture CAD app, standards identifiers should guide the user to the supplier’s declarations and technical sheets; they are not substitutes for those documents. For structural use, use manufacturer-declared or applicable characteristic values and the relevant design rules, not generic decor or board-family assumptions.

### Facades and laminates

“Facade” can mean a **furniture front** or **exterior building cladding**; keep those as different application categories. For furniture fronts, the visual surface may be melamine-faced board, HPL, lacquered MDF, acrylic/PET-faced MDF, veneer, or solid wood. For exterior cladding, require an exterior-rated product and its system-specific technical documentation (including fixing and installation guidance); matching interior decor artwork is not evidence of weather, UV, fire, or structural suitability.

Pfleiderer’s DST approach illustrates how one appearance can be offered on different cores/surface products, while its product details provide the application-specific properties. The [Kronospan portal](https://www.kronospan.com/en_GB/products/) likewise separates HPL, compact boards, MDF-facing products, and edgebanding into different product families. Keep those material forms distinct in the app rather than treating “same decor” as “same material.”

## Licensing, APIs, and data ingestion

I did **not** verify an open public API or a blanket license permitting FURNIX to copy, store, repackage, or redistribute manufacturer decor images and texture assets. The portals establish that manufacturers provide product/decor-selection services, but that alone does not authorize bulk scraping or in-app redistribution. Treat images, textures, PDFs, and CAD assets as copyrighted unless the supplier’s terms or a written agreement explicitly permit the intended use.

Practical approach:

1. Link to supplier product/decor pages where no approved feed or reuse license exists.
2. Ask each supplier for its current data feed/API, asset license, attribution requirements, caching rules, and permission to show assets in a commercial CAD app.
3. Store supplier SKU, asset source, retrieval/version date, and license status alongside each imported asset.
4. Keep a manual/import path for catalogs and PDFs, but do not assume a PDF’s contents are reusable as a FURNIX-hosted database.

## FURNIX onboarding priorities

1. **Start with a normalized catalog model**: supplier, region/market, collection/version, decor code, texture code, material form, board grade/core, dimensions, edge SKU, technical-document URL, and asset/license status.
2. **Pilot with Pfleiderer DST**: its decor/texture/core separation and product-level DecoBoard record provide a clear starting pattern for compatible visual and technical data. ([DST System](https://www.pfleiderer.com/global-en/products/dst-system); [DecoBoard P2](https://www.pfleiderer.com/global-en/products/coated-panels/detail/decoboard-p2))
3. **Add regional supplier portals**: start with EGGER’s current Decorative Collection 26+, Kronospan’s product families, and the SWISS KRONO regional interior range. Maintain region-specific availability rather than assuming Europe/CIS catalogs are interchangeable. ([EGGER](https://www.egger.com/); [Kronospan](https://www.kronospan.com/en_GB/products/); [SWISS KRONO](https://www.swisskrono.com/ch-en/products/))
4. **Build edge matching as an explicit relationship**: board/decor → supplier-confirmed matching edge SKU, including finish and dimensions. Never generate an edge match from color-name similarity alone.
5. **Keep visual and production validation separate**: render from licensed decor/texture assets; calculate cut lists and machining from product-level dimensions and verified processing rules; show warnings when a property is unknown.
6. **Prioritize real samples for sign-off**: manufacturer catalogs support discovery and initial rendering, but visual differences by product group/format mean final color and tactile approval should rely on actual samples.

**Gaps:** Current EGGER detail-page downloads and reuse terms, REHAU’s accessible edge-match records, Döllken’s relevant furniture-edge range, and public API/asset-license terms were not verified in the pages accessible during this research. For CIS deployment, validate local distributor catalogs and current stock/standard declarations separately; a global manufacturer portfolio does not establish local supply.