// Every word and image on the home page, in one place.
//
// The only pictures left on this page are the four model-*.webp renders, and
// they are not drawings: `npm run posters` renders them from the 3D models in
// src/three/, which are built in code out of MEP parts at real sizes.
//
// Twenty-two illustrations went with the redesign - a twelve-image scrolling
// strip, four objects floating behind the About text, and two on each project
// card. They were the main thing making the page look like a generated
// template rather than like somebody's actual work.

import type { SceneName } from './three/scenes'

const IMG = '/assets/home/img/'

/** A 3D model and its still; the still's size is what scripts/posters.mjs renders. */
export type Model = { scene: SceneName; poster: string; alt: string; width: number; height: number }

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
  // Rendered uppercase. The apostrophe is a real curly one.
  heading: 'Hi, i’m Ajmal',
  tagline: 'An MEP BIM coordinator building the models, and the tools that build them faster',
  model: {
    scene: 'tower',
    poster: `${IMG}model-tower.webp`,
    alt: 'A 3D model of a building core and its MEP risers, with plant on the roof',
    width: 1040,
    height: 1300,
  } satisfies Model,
}

export const about = {
  heading: 'About me',
  text:
    'Since 2015 in Doha, I have taken HVAC, plumbing, drainage and firefighting models from concept to as-built, ' +
    'from villas and towers to fourteen schools, an airport and a live petrochemical plant. ' +
    'I also write the Revit tools my team runs on. Let’s build it right the first time!',
}

export const services = [
  {
    num: '01',
    name: 'MEP BIM Modelling',
    desc: 'HVAC, chilled water, plumbing, drainage and firefighting modelled in Revit from concept to as-built, at the LOD each milestone asks for.',
  },
  {
    num: '02',
    name: 'Clash Coordination',
    desc: 'Federated models in Navisworks, rule-based clash tests per discipline pair, and issues driven to closure in BIM 360 or ACC, not just reported.',
  },
  {
    num: '03',
    name: 'Drawing Production',
    desc: 'Shop, coordination and builder’s work drawings, isometrics, schematics, RCPs and as-builts, produced straight from the model through approval.',
  },
  {
    num: '04',
    name: 'BIM Standards',
    desc: 'Templates, shared parameters, worksets, ISO 19650 naming and LOD matrices, plus model audits that catch drift before submission week.',
  },
  {
    num: '05',
    name: 'Revit Automation',
    desc: 'C# add-ins, pyRevit, Dynamo and AutoLISP, shipped with an installer, versioning and documentation, so a whole team runs the same tools.',
  },
]

export type Project = {
  num: string
  category: string
  name: string
  href: string
  model: Model
}

export const projects: Project[] = [
  {
    num: '01',
    category: 'Selected work · Qatar',
    name: 'MEP BIM Coordination',
    href: '/work/',
    model: {
      scene: 'riser',
      poster: `${IMG}model-riser.webp`,
      alt: 'A 3D model of three floors of a building core: the MEP risers and the branches each floor takes off them',
      width: 1200,
      height: 1200,
    },
  },
  {
    num: '02',
    category: 'Revit add-ins · C# and Python',
    name: 'Revit Automation',
    href: '/automation/',
    model: {
      scene: 'void',
      poster: `${IMG}model-void.webp`,
      alt: 'A 3D model of a corridor ceiling void: ducts, pipes and a cable tray, each tagged, with a chained dimension',
      width: 1200,
      height: 857,
    },
  },
  {
    num: '03',
    category: 'AI for BIM · in development',
    name: 'Heron AI',
    href: '/heron-ai/',
    model: {
      scene: 'xray',
      poster: `${IMG}model-xray.webp`,
      alt: 'A 3D x-ray of two floors, asking which unit feeds a diffuser, with the answer’s chilled water and air path lit up',
      width: 1200,
      height: 1200,
    },
  },
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
