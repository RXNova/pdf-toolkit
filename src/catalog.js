/**
 * Tool catalog: the single source of truth shared by the UI (labels, form fields)
 * and the core (input validation, option parsing, output names). Adding a tool means
 * adding an entry here plus a handler in src/core/tools; a contract test keeps them in sync.
 *
 * @typedef {'text' | 'ranges' | 'number' | 'select' | 'password' | 'color' | 'image' | 'json'} OptionType
 *
 * @typedef {object} OptionDef
 * @property {string} key
 * @property {string} label
 * @property {OptionType} type
 * @property {string | number} [default]
 * @property {boolean} [required]        only enforced while the option is visible
 * @property {'percent'} [display]       UI hint: show a 0–1 number as a slider in percent
 * @property {boolean} [hidden]          set by a custom control (placement box, signature pad…), not a form field
 * @property {boolean} [array]           for json options: the value is an array rather than an object
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string} [placeholder]
 * @property {[string, string, string?][]} [choices]   [value, label, hint?] for selects; ≤4 render as a segmented control
 * @property {Record<string, string>} [showIf] visible only when other options have these values
 *
 * @typedef {object} ToolDef
 * @property {string} id
 * @property {string} title
 * @property {string} desc
 * @property {string} color        tile and number-tab colour
 * @property {[string, string]} ink  accent text colour on [light, dark] backgrounds
 * @property {string} icon         icon name; the UI maps it to a Lucide component (src/app/icons.jsx)
 * @property {keyof CATEGORIES} category  home-screen grouping
 * @property {keyof ACCEPT} accept
 * @property {boolean} multi         accepts more than one input file
 * @property {number} minFiles
 * @property {string} suffix         output name is "<first input name>_<suffix>.pdf" (or .zip)
 * @property {OptionDef[]} options
 * @property {'keep' | 'remove' | 'arrange' | 'split'} [pageEdit]  how the page grid uses the page option: select pages to
 *   keep or remove, drag them into order, or (split) just label each page with its output file
 * @property {'main'} [thread]   run on the UI thread instead of the worker (needs the browser's PDF renderer)
 * @property {boolean} [fillSign]  the Fill & sign editor: form fields plus items dragged onto pages
 * @property {boolean} [prefillMetadata]  fill the text options from the PDF's document properties
 * @property {string} [hint]       a tip shown under the options
 * @property {boolean} [livePreview]  re-run the tool on every option change and show the result in the viewer
 * @property {'files' | 'pages' | 'viewer'} preview  how the UI shows the input: file cards, every page, or one page viewer
 */

/** Home-screen sections, in display order. */
export const CATEGORIES = Object.freeze({
  organize: 'Organize',
  edit: 'Edit',
  optimize: 'Optimize & convert',
  security: 'Security',
});

/** Accepted input extensions per input kind. */
export const ACCEPT = Object.freeze({
  pdf: ['pdf'],
  image: ['jpg', 'jpeg', 'png'],
});

const ranges = (label, placeholder, extra = {}) => ({ key: 'ranges', label, type: 'ranges', placeholder, ...extra });

/** @type {readonly ToolDef[]} */
export const TOOL_CATALOG = Object.freeze([
  {
    id: 'merge', title: 'Merge PDF', icon: 'files', color: '#2f7bf5', ink: ['#1a5bc4', '#7fb0ff'], category: 'organize', preview: 'files',
    desc: 'Combine several PDFs into one, in the order you choose.',
    accept: 'pdf', multi: true, minFiles: 2, suffix: 'merged',
    options: [],
  },
  {
    id: 'split', title: 'Split PDF', icon: 'scissors', color: '#e8573f', ink: ['#b83a24', '#ff8a70'], category: 'organize', preview: 'pages',
    desc: 'Break a PDF into separate files by page range, or one file per page. Download them as a .zip.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'split',
    pageEdit: 'split', // read-only: the page grid labels which output file each page goes to
    options: [
      { key: 'mode', label: 'Split mode', type: 'select', default: 'ranges',
        choices: [['ranges', 'Custom ranges'], ['every', 'Every page']] },
      ranges('Ranges (one file per group)', '1-3, 4-6, 7-', { required: true, showIf: { mode: 'ranges' } }),
    ],
  },
  {
    id: 'extract', title: 'Extract pages', icon: 'file-output', color: '#8b5cf6', ink: ['#6a3fd6', '#b69cff'], category: 'organize', preview: 'pages',
    desc: 'Pull selected pages into a new PDF.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'extracted',
    pageEdit: 'keep', // the page grid selects pages into this tool's first option
    options: [ranges('Pages to keep', '1-3, 7', { required: true })],
  },
  {
    id: 'remove', title: 'Remove pages', icon: 'trash', color: '#f2a516', ink: ['#8a5800', '#ffc14d'], category: 'organize', preview: 'pages',
    desc: 'Delete pages you don’t need.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'trimmed',
    pageEdit: 'remove',
    options: [ranges('Pages to remove', '2, 5-6', { required: true })],
  },
  {
    id: 'reorder', title: 'Organize pages', icon: 'arrow-up-down', color: '#12a58a', ink: ['#0a7563', '#3fd6b8'], category: 'organize', preview: 'pages',
    desc: 'Put pages in a new order. Pages can be repeated or left out.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'reordered',
    pageEdit: 'arrange',
    options: [{ key: 'order', label: 'New page order (blank = as is)', type: 'ranges', placeholder: '3, 1, 2, 4-' }],
  },
  {
    id: 'crop', title: 'Crop & resize', icon: 'crop', color: '#b45309', ink: ['#8a3f06', '#f0a35c'], category: 'edit', preview: 'viewer',
    livePreview: true,
    desc: 'Trim page margins, or fit pages onto A4, Letter, A5 or Legal.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'cropped',
    options: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'crop', choices: [['crop', 'Trim margins'], ['resize', 'Change page size']] },
      { key: 'top', label: 'Top (mm)', type: 'number', default: 10, min: 0, max: 500, showIf: { mode: 'crop' } },
      { key: 'bottom', label: 'Bottom (mm)', type: 'number', default: 10, min: 0, max: 500, showIf: { mode: 'crop' } },
      { key: 'left', label: 'Left (mm)', type: 'number', default: 10, min: 0, max: 500, showIf: { mode: 'crop' } },
      { key: 'right', label: 'Right (mm)', type: 'number', default: 10, min: 0, max: 500, showIf: { mode: 'crop' } },
      { key: 'size', label: 'Page size', type: 'select', default: 'a4', showIf: { mode: 'resize' },
        choices: [['a4', 'A4'], ['letter', 'Letter'], ['a5', 'A5'], ['legal', 'Legal']] },
      { key: 'orientation', label: 'Orientation', type: 'select', default: 'auto', showIf: { mode: 'resize' },
        choices: [['auto', 'Match page'], ['portrait', 'Portrait'], ['landscape', 'Landscape']] },
      ranges('Pages (blank = all)', 'all pages'),
    ],
  },
  {
    id: 'rotate', title: 'Rotate PDF', icon: 'rotate', color: '#e0368f', ink: ['#b0206c', '#ff7ab8'], category: 'edit', preview: 'viewer',
    livePreview: true,
    desc: 'Rotate all pages or just some.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'rotated',
    options: [
      { key: 'angle', label: 'Rotation', type: 'select', default: '90',
        choices: [['90', '90° right'], ['180', '180°'], ['270', '90° left']] },
      ranges('Pages (blank = all)', 'all pages'),
    ],
  },
  {
    id: 'compress', title: 'Compress PDF', icon: 'minimize', color: '#7bb51c', ink: ['#457008', '#a6e04a'], category: 'optimize', preview: 'viewer',
    desc: 'Shrink PDFs with photos or scans by re-encoding their images.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'compressed',
    options: [
      { key: 'level', label: 'Compression', type: 'select', default: 'recommended',
        choices: [
          ['strong', 'Strong', 'Smallest file. Images are noticeably softer.'],
          ['recommended', 'Balanced', 'Much smaller, with images that still look sharp.'],
          ['light', 'Light', 'Near-original image quality, smaller savings.'],
        ] },
    ],
  },
  {
    id: 'images', title: 'JPG / PNG to PDF', icon: 'image', color: '#3f5fe0', ink: ['#2a44b8', '#8ea2ff'], category: 'optimize', preview: 'files',
    desc: 'Turn images into a PDF, one image per page.',
    accept: 'image', multi: true, minFiles: 1, suffix: 'images',
    options: [
      { key: 'pageSize', label: 'Page size', type: 'select', default: 'fit',
        choices: [['fit', 'Fit image'], ['a4', 'A4'], ['letter', 'US Letter']] },
      { key: 'margin', label: 'Margin (pt)', type: 'number', default: 0, min: 0, max: 200 },
    ],
  },
  {
    id: 'toimage', title: 'PDF to JPG / PNG', icon: 'image-down', color: '#0d9488', ink: ['#0b6e66', '#4fd1c5'], category: 'optimize', preview: 'pages',
    pageEdit: 'keep', thread: 'main',
    desc: 'Save pages as images, one per page. Several come as a .zip.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'images',
    options: [
      ranges('Pages (blank = all)', 'all pages'),
      { key: 'format', label: 'Format', type: 'select', default: 'png', choices: [['png', 'PNG', 'Sharp text, larger files.'], ['jpg', 'JPG', 'Smaller files, best for photos.']] },
      { key: 'dpi', label: 'Resolution', type: 'select', default: '150',
        choices: [['72', 'Screen', '72 dpi'], ['150', 'Standard', '150 dpi'], ['300', 'Print', '300 dpi']] },
      { key: 'quality', label: 'JPG quality', type: 'number', default: 0.85, min: 0.3, max: 1, step: 0.05, display: 'percent', showIf: { format: 'jpg' } },
    ],
  },
  {
    id: 'watermark', title: 'Add watermark', icon: 'stamp', color: '#f07a1e', ink: ['#a84f0a', '#ffa060'], category: 'edit', preview: 'viewer',
    livePreview: true,
    desc: 'Stamp text on a PDF: once or tiled, at any angle, over or behind the content.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'watermarked',
    options: [
      { key: 'text', label: 'Text', type: 'text', default: 'CONFIDENTIAL', required: true },
      { key: 'font', label: 'Font', type: 'select', default: 'sans-bold',
        choices: [['sans-bold', 'Sans bold'], ['sans', 'Sans'], ['serif-bold', 'Serif bold'], ['serif-italic', 'Serif italic'],
                  ['mono-bold', 'Mono bold']] },
      { key: 'size', label: 'Font size', type: 'number', default: 60, min: 8, max: 300 },
      { key: 'color', label: 'Color', type: 'color', default: '#d9480f' },
      { key: 'opacity', label: 'Opacity', type: 'number', default: 0.2, min: 0.05, max: 1, step: 0.05, display: 'percent' },
      { key: 'angle', label: 'Direction', type: 'select', default: '45',
        choices: [['45', '45° ↗'], ['0', '0° →'], ['-45', '−45° ↘'], ['90', '90° ↑']] },
      { key: 'layout', label: 'Pattern', type: 'select', default: 'single',
        choices: [['single', 'Once'], ['tile', 'Tiled']] },
      { key: 'position', label: 'Position', type: 'select', default: 'center', showIf: { layout: 'single' },
        choices: [['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']] },
      { key: 'density', label: 'Spacing', type: 'select', default: 'normal', showIf: { layout: 'tile' },
        choices: [['sparse', 'Sparse'], ['normal', 'Normal'], ['dense', 'Dense']] },
      { key: 'layer', label: 'Layer', type: 'select', default: 'over',
        choices: [['over', 'Over content', 'Always visible.'], ['under', 'Behind content', 'Under text and images; hidden by full-page scans.']] },
      ranges('Pages (blank = all)', 'all pages'),
    ],
  },
  {
    id: 'numbers', title: 'Page numbers', icon: 'hash', color: '#1fa5c9', ink: ['#0e7290', '#5fd0ee'], category: 'edit', preview: 'viewer',
    livePreview: true,
    desc: 'Add page numbers to every page.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'numbered',
    options: [
      { key: 'position', label: 'Position', type: 'select', default: 'bottom-center',
        choices: [['bottom-center', 'Bottom center'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'],
                  ['top-center', 'Top center'], ['top-right', 'Top right'], ['top-left', 'Top left']] },
      { key: 'format', label: 'Format', type: 'text', default: '{n} / {total}', required: true },
      { key: 'start', label: 'First number', type: 'number', default: 1, min: -99999, max: 99999 },
      { key: 'size', label: 'Font size', type: 'number', default: 11, min: 6, max: 48 },
    ],
  },
  {
    id: 'headerfooter', title: 'Header & footer', icon: 'panel-top', color: '#4f46e5', ink: ['#3730a3', '#a5b4fc'], category: 'edit', preview: 'viewer',
    livePreview: true,
    desc: 'Add a line of text at the top or bottom of every page.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'header',
    options: [
      { key: 'header', label: 'Header', type: 'text', default: '', placeholder: '{file}' },
      { key: 'footer', label: 'Footer', type: 'text', default: 'Page {n} of {total}', placeholder: '{date}' },
      { key: 'align', label: 'Align', type: 'select', default: 'center', choices: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
      { key: 'size', label: 'Font size', type: 'number', default: 10, min: 6, max: 48 },
      { key: 'color', label: 'Color', type: 'color', default: '#333333' },
      { key: 'margin', label: 'Distance from edge (pt)', type: 'number', default: 28, min: 6, max: 200 },
      ranges('Pages (blank = all)', 'all pages'),
    ],
    hint: 'Placeholders: {n} page number, {total} page count, {date} today, {file} file name.',
  },
  {
    id: 'fillsign', title: 'Fill & sign', icon: 'signature', color: '#2b4bb8', ink: ['#1e40af', '#93b4ff'], category: 'edit', preview: 'viewer',
    fillSign: true, livePreview: true,
    desc: 'Fill in forms, sign, and add text, dates or a logo. Drag everything into place.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'signed',
    options: [
      { key: 'items', label: 'Items on the page', type: 'json', array: true, default: '[]', hidden: true },
      { key: 'values', label: 'Field values', type: 'json', default: '{}', hidden: true },
      { key: 'flatten', label: 'After filling', type: 'select', default: 'yes', showIf: { hasForm: 'yes' },
        choices: [['yes', 'Flatten', 'Answers become part of the page.'], ['no', 'Keep editable', 'Fields can still be changed.']] },
      { key: 'hasForm', label: 'Has form', type: 'select', default: 'no', choices: [['no', 'No'], ['yes', 'Yes']], hidden: true },
    ],
  },
  {
    id: 'protect', title: 'Protect PDF', icon: 'lock', color: '#1f9d55', ink: ['#12703a', '#4fd68a'], category: 'security', preview: 'viewer',
    desc: 'Encrypt a PDF with a password (AES-256).',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'protected',
    options: [
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'confirm', label: 'Confirm password', type: 'password', required: true },
    ],
  },
  {
    id: 'unlock', title: 'Unlock PDF', icon: 'lock-open', color: '#3ea6e8', ink: ['#1a6fa8', '#7cc8ff'], category: 'security', preview: 'viewer',
    desc: 'Remove the password from a PDF you can open.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'unlocked',
    options: [{ key: 'password', label: 'Current password', type: 'password' }],
  },
  {
    id: 'metadata', title: 'Edit metadata', icon: 'tags', color: '#64748b', ink: ['#475569', '#cbd5e1'], category: 'security', preview: 'viewer',
    prefillMetadata: true,
    desc: 'Change the title, author and keywords, or remove all document properties.',
    accept: 'pdf', multi: false, minFiles: 1, suffix: 'metadata',
    options: [
      { key: 'action', label: 'Action', type: 'select', default: 'edit', choices: [['edit', 'Edit'], ['strip', 'Remove all', 'Clears title, author, dates and the producing app.']] },
      { key: 'title', label: 'Title', type: 'text', default: '', showIf: { action: 'edit' } },
      { key: 'author', label: 'Author', type: 'text', default: '', showIf: { action: 'edit' } },
      { key: 'subject', label: 'Subject', type: 'text', default: '', showIf: { action: 'edit' } },
      { key: 'keywords', label: 'Keywords (comma-separated)', type: 'text', default: '', showIf: { action: 'edit' } },
    ],
  },
]);

/** @param {string} id */
export const getToolDef = (id) => TOOL_CATALOG.find((t) => t.id === id);

/**
 * Whether an option should be shown (and validated) given the current raw values.
 * @param {OptionDef} option
 * @param {Record<string, unknown>} values
 */
export function isOptionVisible(option, values) {
  return !option.showIf || Object.entries(option.showIf).every(([k, v]) => String(values[k]) === v);
}

/**
 * Initial form values for a tool, as strings (the shape form inputs produce).
 * @param {ToolDef} tool
 * @returns {Record<string, string>}
 */
export function defaultFormValues(tool) {
  return Object.fromEntries(tool.options.map((o) => [o.key, String(o.default ?? '')]));
}
