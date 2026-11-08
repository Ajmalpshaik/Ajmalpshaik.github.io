// Every word on the home page, in one place.
//
// The page has no pictures. The 3D model renders that used to stand in the
// first screen and on the project cards went in the second simplification
// (November 2026): the page is a name, four figures and three short lists.
// The models are still in src/three/, and `npm run posters` still renders
// them, if they are ever wanted back.

// The bar. These three groups and the button are the same ones
// tools/sync_chrome.py writes into every other page - if one changes, change
// the other, or the cover and the site stop agreeing about what is on it.
export const navGroups = [
  {
    name: 'Experience',
    items: [
      { href: '/story/', label: 'Story', note: 'How it started' },
      { href: '/experience/', label: 'Experience', note: 'Eleven years, and where' },
      { href: '/work/', label: 'Selected work', note: 'Five projects in Qatar' },
    ],
  },
  {
    name: 'Tools',
    items: [
      { href: '/automation/', label: 'Automation', note: 'The Revit tools I build' },
      { href: '/heron-ai/', label: 'Heron AI', note: 'An AI that works inside Revit' },
      { href: '/heron-tools/', label: 'Heron Tools', note: 'Everyday buttons on the Revit ribbon' },
      { href: '/heron-autocad/', label: 'Heron for AutoCAD', note: 'Heron AI, inside AutoCAD' },
      { href: '/toolbox/', label: 'Toolbox', note: 'Tools you can use in the browser' },
    ],
  },
  {
    name: 'About',
    items: [
      { href: '/skills/', label: 'Skills', note: 'The full stack, named' },
      { href: '/about/', label: 'About', note: 'Visa, notice, languages' },
      { href: '/faq/', label: 'FAQ', note: 'The questions before a call' },
    ],
  },
]

export const navCta = { href: '/contact/', label: 'Contact' }

export const contactHref = '/contact/'

export const hero = {
  // Sentence case, as the Heron brand writes. The apostrophe is a real curly one.
  heading: 'Hi, I’m Ajmal',
  tagline: 'MEP BIM coordinator in Doha. I build the models, and the tools that build them faster.',
}

// Four figures that do not go stale: none of them counts years.
export const figures = [
  { value: '2015', label: 'in Doha since' },
  { value: '14', label: 'school buildings modelled' },
  { value: '1', label: 'live petrochemical plant' },
  { value: '3', label: 'Heron products, open source' },
]

export const about = {
  heading: 'About me',
  text:
    'HVAC, plumbing, drainage and firefighting, from concept to as-built. ' +
    'Villas, towers, schools, an airport and a live plant. ' +
    'And the Revit tools my team runs on.',
}

export const services = [
  { num: '01', name: 'MEP BIM Modelling', desc: 'HVAC, plumbing, drainage and firefighting, concept to as-built.' },
  { num: '02', name: 'Clash Coordination', desc: 'Navisworks clash tests, driven to closure in BIM 360 or ACC.' },
  { num: '03', name: 'Drawing Production', desc: 'Shop, coordination and as-built drawings, straight from the model.' },
  { num: '04', name: 'BIM Standards', desc: 'Templates, ISO 19650 naming, LOD and model audits.' },
  { num: '05', name: 'Revit Automation', desc: 'C#, pyRevit, Dynamo and AutoLISP tools a whole team runs.' },
]

export type Project = {
  num: string
  category: string
  name: string
  href: string
}

export const projects: Project[] = [
  { num: '01', category: 'Five projects · Qatar', name: 'Selected Work', href: '/work/' },
  { num: '02', category: 'C# · pyRevit · Dynamo', name: 'Revit Automation', href: '/automation/' },
  { num: '03', category: 'AI for Revit and AutoCAD', name: 'Heron AI', href: '/heron-ai/' },
  { num: '04', category: 'Free · in the browser', name: 'Toolbox', href: '/toolbox/' },
]

export const footer = {
  heading: 'Let’s talk',
  text: 'Hiring, or want a tool built? Email is fastest, and I answer every message myself.',
  email: 'ajmalnattika@gmail.com',
  links: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ajmalps/' },
    { label: 'GitHub', href: 'https://github.com/Ajmalpshaik' },
    { label: 'WhatsApp', href: 'https://wa.me/97431033040?text=Hi%20Ajmal%2C%20I%20found%20you%20on%20ajmalps.com' },
  ],
  // Grouped the way the bar groups them, and the way the footer on every
  // other page does, so the site reads the same from either end.
  columns: [
    {
      name: 'Experience',
      links: [
        { label: 'Story', href: '/story/' },
        { label: 'Experience', href: '/experience/' },
        { label: 'Selected work', href: '/work/' },
      ],
    },
    {
      name: 'Tools',
      links: [
        { label: 'Automation', href: '/automation/' },
        { label: 'Heron AI', href: '/heron-ai/' },
        { label: 'Heron Tools', href: '/heron-tools/' },
        { label: 'Heron for AutoCAD', href: '/heron-autocad/' },
        { label: 'Toolbox', href: '/toolbox/' },
      ],
    },
    {
      name: 'About',
      links: [
        { label: 'Skills', href: '/skills/' },
        { label: 'About', href: '/about/' },
        { label: 'FAQ', href: '/faq/' },
        { label: 'Contact', href: '/contact/' },
      ],
    },
  ],
  // The page is rendered to static HTML at build time, so it cannot read the
  // clock there without the output changing with the date. This is what the
  // HTML says; the browser swaps in the current year once it runs.
  year: 2026,
}
