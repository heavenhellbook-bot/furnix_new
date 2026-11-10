/** Example: run on same origin as FURNIX (with a static server). */
import {loadTechCatalogs,findRecords,productionReadiness} from './tech-library.mjs';
const catalogs=await loadTechCatalogs();
console.log('Sample generic 18 mm boards',findRecords(catalogs.materials.items,'18 мм'));
console.log('Production readiness',productionReadiness(catalogs).ready); // false until technical signoff
