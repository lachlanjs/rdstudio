import { surveyDocs, abDocs } from './tools/survey.mjs';
import { phoneDocs } from './tools/phone.mjs';
import { terminalDocs } from './tools/terminal.mjs';
import { projectDocs } from './tools/project.mjs';
import { atlas2Docs } from './tools/atlas2.mjs';
import { retroDocs, retroAtlas } from './tools/retro.mjs';
import { instrumentDocs } from './tools/instrument.mjs';
const at = atlas2Docs();
export default { ...surveyDocs(), ...instrumentDocs(), ...abDocs(), ...terminalDocs(), ...phoneDocs(), ...projectDocs(), ...at, ...retroDocs(), RetroAtlas: retroAtlas(at.OrganicNote, 'The Atlas as a vector display: contour folders, a note selected, pale phosphor lines on a registration grid. The pens are unchanged.') };
