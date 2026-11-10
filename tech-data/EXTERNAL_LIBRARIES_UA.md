# Зовнішні професійні бібліотеки: офіційні джерела

Ці посилання — **не вбудовані завантажені бібліотеки**, а перевірені сторінки для отримання технічної документації, моделей або партнерського доступу.

| Виробник/проєкт | Джерело | Що необхідно для реального імпорту |
| --- | --- | --- |
| Blum | https://www.blum.com/gb/en/services/technical-services/e-services/ | доступ E-SERVICES / партнерський дозвіл / розбір BXF або CAD |
| Blum CAD/CAM | https://www.blum.com/ua/uk/services/industrial-production/cad-cam-interface/ | авторизований експорт BXF/CAD-CAM |
| Hettich | https://www.hettich.com/en-de/services/hettich-cad/cad-downloads | перевірити ліцензію, обрати конкретні артикули й CAD-пакети |
| GRASS | https://www.grass.eu/en/tec-center/cad-data/ | дозволи, STEP, креслення, правила монтажу |
| Salice | https://www.salice.com/ww/en/download/catalogues | PDF схем; окремі CAD дані за доступністю |
| EGGER | https://www.egger.com/ | технічні листи за артикулом плити/крайки |
| Kronospan | https://kronospan.com/ | технічні листи за артикулом |
| ВІЯР | https://www.viyar.pro/service/doc/?cid=dsp&s=limitations | підтвердити правила на дату замовлення та профіль виробництва |
| ViyarPro | https://www.viyar.pro/service/doc/?cid=dsp&s=details-import | підтвердити точне зіставлення полів/крайки й провести контрольний імпорт |
| KRONAS | https://kronas.com.ua/online-services-3d | погодити доступні формати та чинні обмеження |
| FreeCAD Woodworking | https://github.com/dprojects/Woodworking | відкритий код MIT; **працює у FreeCAD**, не підключається до браузера без адаптера |
| OpenCutList | https://www.opencutlist.org/en/download | GPLv3, **розширення SketchUp**; не поширювати його як наш пропрієтарний модуль |
| OpenCascade.js | https://ocjs.org/ | окреме геометричне ядро WASM, потрібна інженерна інтеграція |
| SketchUp 3D Warehouse | https://3dwarehouse.sketchup.com/ | не скопіювати весь каталог; урахувати ліцензійні обмеження |

## Що потрібно робити після отримання справжнього CAD-файлу

1. Звірити **виробника, артикул, редакцію креслення**.
2. Розпізнати геометрію в оригінальних одиницях із перевіркою масштабу.
3. Окремо імпортувати **правила монтажу, присадки, зазорів** — геометрія STEP сама по собі не описує правила корпусу.
4. Прив'язати обмеження до конфігурації фурнітури та версії модуля.
5. Зберегти статус `draft` до перевірки технологом і контрольного виробу.
