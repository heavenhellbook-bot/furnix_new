I read the requested researcher instructions first. I can’t save a file from this environment, so I’m returning the research notes here for transfer to `research_notes\Furniture compatibility data sources\standards_workflow.md`.

# Furniture compatibility data sources and workflow

## Is there a universal compatibility database?

### Takeaway
I found no neutral, universal database that determines whether arbitrary furniture panels, fittings, and accessories work together. Standards and exchange formats can describe product characteristics, geometry, or test performance; they do not, by themselves, provide a cross-manufacturer cabinet-fitting compatibility engine.

### Cited Findings
- ISO 10303 describes representation and exchange of product information across systems and the product lifecycle. Its scope is data exchange—not furniture-specific fit rules. [ISO 10303-1:2021](https://www.iso.org/standard/72237.html)
- ISO 10303-21 defines a clear-text exchange format for product data expressed in EXPRESS. It is an encoding mechanism, not a compatibility database. [ISO 10303-21:2016](https://www.iso.org/standard/63141.html)
- ETIM organizes products into classes with defined features, values, units, and identifiers. ETIM MC adds parameters for 3D product representations; neither description establishes a general fitting-compatibility rule engine. [ETIM model information](https://www.etim-international.com/classification/model-information/)
- BMEcat is an XML-based exchange format for B2B catalogue data. It helps transfer product-catalogue information, but does not define whether a fitting is compatible with a particular cabinet design. [BMEcat, BME](https://www.bme.de/en/services/bmecat/)
- **Inference:** A platform may use these standards to exchange or classify data, but FURNIX still needs an application-level model of cabinet geometry and compatibility rules. [ISO 10303-1](https://www.iso.org/standard/72237.html); [ETIM model information](https://www.etim-international.com/classification/model-information/); [BMEcat, BME](https://www.bme.de/en/services/bmecat/)

### Inferences
- Treat “universal compatibility database” as an unsupported assumption unless a provider demonstrates coverage, maintained product variants, documented rules, and explicit redistribution rights.
- Keep a clear distinction between **a component’s descriptive data** and **a rule that says it can be used in a specific design**.

### Gaps
- I could not verify an authoritative cross-industry inventory proving that no commercial proprietary database exists. The conclusion is that I found no neutral/open universal source in the standards, exchange-format, manufacturer-service, and open-source sources reviewed.

## Standards and exchange formats: scope and limits

### Takeaway
Furniture standards are useful for requirements and testing, including storage-unit safety/stability and hardware durability. They should not be represented as universal dimensional interchangeability rules. STEP, DXF, IFC, BMEcat, and ETIM address different data-exchange or classification needs; none replaces FURNIX’s own compatibility logic.

### Cited Findings
- ISO 7170 concerns test methods for storage-unit strength, durability, and stability; ISO 7171 concerns storage-unit stability. These are performance-test subjects, not a database of component mounting patterns or cross-brand compatibility. Locate current editions in the [ISO catalogue](https://www.iso.org/search.html?q=7170) and check the applicable national standards body’s catalogue before claiming edition or status.
- EN 14749 addresses safety requirements and test methods for domestic and kitchen storage units and worktops. It is not a general fitting-compatibility schema. Check the [CEN-CENELEC standards catalogue](https://standards.cencenelec.eu/) for current edition and national adoption.
- Relevant hardware test-standard families include EN 15338 (extension elements), EN 15570 (hinges), and EN 15706 (sliding-door/roll-front slide fittings). Their focus is strength/durability testing of the relevant hardware, not an exhaustive product-selection or interchangeability database. Check current status and exact titles in the [CEN-CENELEC catalogue](https://standards.cencenelec.eu/). A secondary catalogue result for [EN 15706](https://standards.iteh.ai/catalog/standards/cen/faaa984a-0be3-4dc7-987a-f75390b5977b/en-15706-2009) describes slide-fittings testing; confirm against the licensed standard before relying on its detailed scope.
- ISO states that its publications and materials are protected by copyright and that reproduction requires written permission, except for content made available under its open-data terms. This is a material constraint on reproducing standard text, tables, or test procedures in FURNIX. [ISO copyright notice](https://www.iso.org/search.html?q=7170)
- STEP (ISO 10303) is appropriate for structured product geometry and product-data exchange when the participating systems support a compatible schema/application protocol. Part 21 is a particular clear-text exchange structure; a STEP file alone does not establish fit, installation limits, or suitability. [ISO 10303-1](https://www.iso.org/standard/72237.html); [ISO 10303-21](https://www.iso.org/standard/63141.html)
- DXF is useful as a CAD drawing exchange route for 2D geometry, but a drawing file should not be treated as a canonical source for all product properties or selection logic. [Autodesk AutoCAD Help](https://help.autodesk.com/view/ACD/2026/ENU/)
- IFC is a buildingSMART information-model standard and may be useful for representing furniture in a building/BIM context; it should not be presumed to encode manufacturer-specific cabinet-fitting compatibility. I could not inspect the official buildingSMART schema page during this research because the request was blocked (403). [buildingSMART IFC standards](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/)
- ETIM’s official description defines product groups/classes and features; ETIM MC adds 3D modelling parameters. This can support classification and product/geometry descriptions, but FURNIX should separately model selection and compatibility predicates. [ETIM model information](https://www.etim-international.com/classification/model-information/)
- BMEcat’s current version is listed by BME as 2005.2; its purpose is B2B catalogue exchange. The format does not guarantee that any specific supplier provides enough dimensional, installation, or compatibility data for FURNIX. [BMEcat, BME](https://www.bme.de/en/services/bmecat/)

### Inferences
- Consider formats as separate adapters: STEP for supported 3D geometry/product data; DXF for drawings; IFC for BIM context; ETIM for classification/features where relevant; BMEcat for catalogue records and commercial attributes.
- Normalize imported values into FURNIX’s own schema rather than making any one exchange format the internal source of truth.
- Do not expose standards-derived safety or performance tests as installation compatibility unless the applicable test result and intended use actually support that conclusion.

### Gaps
- The ISO catalogue search page did not render useful results in this research environment. Exact current editions and status of the furniture/hardware standards above should be checked in ISO, CEN-CENELEC, and the relevant national standards-body catalogue before product requirements or compliance claims are published.
- The buildingSMART page could not be fetched; verify the IFC furniture entities and attributes in the official schema documentation before implementing a mapping.

## Open-source references, manufacturer data, and recommended workflow

### Takeaway
OpenCutList is a useful reference for cut-list and material workflows, not evidence of an authoritative fitting-compatibility catalogue. Manufacturer services offer substantially more useful product-specific CAD, technical details, and configuration results, but access to a download or free account is not proof of permission to republish that data. FURNIX should author its general rules and obtain permission for manufacturer-specific data it distributes.

### Cited Findings
- OpenCutList describes itself as a SketchUp extension that generates parts lists, cutting diagrams, labels, and cost/weight reports for woodworking projects. Its stated scope is production/cut-list assistance, not a universal hardware compatibility service. [OpenCutList README](https://raw.githubusercontent.com/lairdubois/lairdubois-opencutlist-sketchup-extension/master/README.md)
- OpenCutList’s documentation says it is installed as a SketchUp extension and that its feature availability depends in part on SketchUp version. This is a product-specific workflow reference, not a neutral interchange standard. [OpenCutList installation documentation](https://docs.opencutlist.org/getting-started/installing)
- The OpenCutList repository includes a GNU GPL v3 license. That license applies to the covered software; it does not automatically grant rights to redistribute third-party manufacturer drawings, models, photos, or catalog content stored or referenced by an application. [OpenCutList LICENSE](https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension/blob/master/LICENSE)
- The public FreeCAD Lumberjack project describes parametric woodworking/furniture design, including panel and drawer generation, joinery variants, and parametric dimensions. It is a useful design-workflow reference, not an industry compatibility database or standards authority. [FreeCAD Lumberjack README](https://github.com/tomster/FreeCAD-lumberjack/blob/main/README.md)
- Blum’s Product Database offers technical information, product descriptions, CAD data, drawings, and technical features; access to the full range requires a free E-SERVICES account. [Blum Product Database](https://www.blum.com/us/en/services/e-services/productdatabase/)
- Blum’s Product Configurator produces parts lists, CAD data, and planning information for configured hardware applications; it also describes complete checked parts lists and design/assembly/manufacturing information. This is a practical route to validated manufacturer-specific results, subject to Blum’s terms for any integration or onward distribution. [Blum Product Configurator](https://www.blum.com/us/en/services/e-services/onlineproductconfigurator/)
- A downloadable manufacturer model is an asset, not a license grant to mirror the model or associated content. ISO’s copyright notice illustrates why access and redistribution must be treated separately; manufacturer-specific terms need separate review. [ISO copyright notice](https://www.iso.org/search.html?q=7170); [Blum Product Database](https://www.blum.com/us/en/services/e-services/productdatabase/)

### Inferences
**Separate data into three domains:**

1. **Descriptive product/geometry data:** manufacturer and SKU, product variant, dimensions, materials/finish, weight/load rating, geometry files, units, coordinate system, and version.
2. **Compatibility and design rules:** predicates such as permitted board/door thickness, required mounting pattern, edge offsets, runner length range, installation clearances, load/size limits, required companion components, and applicable cabinet configuration.
3. **Provenance and rights:** source URL/provider, retrieval date, effective/retired dates, version/hash, permitted uses, redistribution status, and verification state.

**Recommended source-of-truth workflow for FURNIX:**
- Keep a FURNIX-owned canonical product/part schema and stable internal IDs. Make STEP/DXF/IFC/BMEcat/ETIM import-export adapters—not the authoritative internal model.
- Store geometry/material metadata separately from rule records. A CAD model or catalogue row can provide dimensions; it does not automatically establish a valid installation combination.
- Author generic cabinet rules in FURNIX: panel/joinery construction, dimensional constraints, hardware placement/clearance, and validation of cabinet geometry. Mark rules as authored, tested, and versioned.
- For manufacturer-specific fitting selection, use official product configurators, product databases, licensed feeds/APIs, or written manufacturer permission. Capture the precise product family/variant and rule/data version. Where only public technical material is available, link to it or use it for internal validation only unless redistribution rights are clear.
- Keep a rule’s source, assumptions, limits, and tests alongside the rule; don’t infer “compatible” from matching geometry or broad product classification alone.
- Add a rights gate before ingesting or redistributing any manufacturer CAD, image, catalogue, or standards content. Confirm commercial use, caching, transformations, and public redistribution explicitly.

### Gaps
- I did not verify publicly documented manufacturer APIs, bulk-feed terms, or redistribution licences for Blum or Hettich. Blum confirms that data and CAD files are available through its services, but that is not enough to conclude that FURNIX may mirror or republish them.
- I could not verify Hettich’s current CAD-data landing page in this research session. Its 404 response may be a changed URL or locale issue; identify the current official service and review its terms before planning integration.
- The FreeCAD Lumberjack README was inspected, but no repository license was confirmed in the material reviewed. Do not copy its code or data until its license is checked.
- The required GitHub `get_me` identity lookup was not available among the tools exposed in this research session.