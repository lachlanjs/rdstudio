import { surveyDocs, abDocs } from './tools/survey.mjs';
import { phoneDocs } from './tools/phone.mjs';
import { terminalDocs } from './tools/terminal.mjs';
import { projectDocs } from './tools/project.mjs';
import { atlas2Docs } from './tools/atlas2.mjs';
import { retroDocs, retroAtlas } from './tools/retro.mjs';
import { stationDocs } from './tools/station.mjs';
import { mathFontDocs } from './tools/mathfonts.mjs';
import { gridDocs, GROUP_G } from './tools/grid.mjs';
import { gridOptDocs } from './tools/gridopt.mjs';
const gopt = gridOptDocs((m) => console.error(m));
console.error(JSON.stringify(gopt.metrics, null, 1));
import { reskinAtlas } from './tools/retro.mjs';
import { S_CSS } from './tools/station.mjs';
import { instrumentDocs } from './tools/instrument.mjs';
const at = atlas2Docs();
const grid = gridDocs();
export default { ...gopt.docs, ...surveyDocs(), ...instrumentDocs(), ...abDocs(), ...terminalDocs(), ...phoneDocs(), ...projectDocs(), ...at, ...retroDocs(), RetroAtlas: retroAtlas(at.OrganicNote, 'The Atlas as a vector display: contour folders, a note selected, pale phosphor lines on a registration grid. The pens are unchanged.'), ...stationDocs(at.AtlasCalm), ...mathFontDocs(), ...grid,
  StationGridAtlas: reskinAtlas(grid.GridAtlas, { group: GROUP_G, dir: 'x', css: S_CSS, title: 'Atlas on a grid, station theme', defs: '', subtitle: 'The grid Atlas in the station terminal theme: the same blocks, walls and routes as a deck plan.' }),
  StationGridAtlasFolder: reskinAtlas(grid.GridAtlasFolder, { group: GROUP_G, dir: 'x', css: S_CSS, title: 'Atlas on a grid, a folder in focus, station theme', defs: '', subtitle: 'The zoomed grid Atlas in the station terminal theme, with pixel type inside the blocks.' }) };
