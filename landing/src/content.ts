// Every word and image on the home page, in one place.
//
// Images are plain files in /assets/home/img/ at the repo root, referenced by
// path. Replacing one with a new file of the same name needs no rebuild.
//
// The hero and the tall picture on each project card are live 3D models
// (src/three/). Their model-*.webp stills are rendered from the models by
// `npm run posters`, so those four are made, not drawn: leave them be.

import type { SceneName } from './three/scenes'

const IMG = '/assets/home/img/'

/** A 3D model and its still; the still's size is what scripts/posters.mjs renders. */
export type Model = { scene: SceneName; poster: string; alt: string; width: number; height: number }

export const nav = [
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '/contact/' },
]

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

// Two rows, each repeated three times so the scroll never shows an edge.
export const marqueeRows: string[][] = [
  ['01', '02', '03', '04', '05', '06'].map((n) => `${IMG}marquee-${n}.webp`),
  ['07', '08', '09', '10', '11', '12'].map((n) => `${IMG}marquee-${n}.webp`),
]

export const about = {
  heading: 'About me',
  text:
    'Since 2015 in Doha, I have taken HVAC, plumbing, drainage and firefighting models from concept to as-built, ' +
    'from villas and towers to fourteen schools, an airport and a live petrochemical plant. ' +
    'I also write the Revit tools my team runs on. Let’s build it right the first time!',
  // Decorative, so they carry empty alt text.
  images: {
    topLeft: `${IMG}about-hardhat.webp`,
    bottomLeft: `${IMG}about-valve.webp`,
    topRight: `${IMG}about-duct.webp`,
    bottomRight: `${IMG}about-cube.webp`,
  },
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
  images: [{ src: string; alt: string }, { src: string; alt: string }]
  model: Model
}

export const projects: Project[] = [
  {
    num: '01',
    category: 'Selected work · Qatar',
    name: 'MEP BIM Coordination',
    href: '/work/',
    images: [
      { src: `${IMG}project-1-a.webp`, alt: 'Illustration: a coordinated MEP model, colour-coded by system' },
      { src: `${IMG}project-1-b.webp`, alt: 'Illustration: services on an industrial pipe rack at dusk' },
    ],
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
    category: 'Revit add-in · C#',
    name: 'AJ-Tools',
    href: '/aj-tools/',
    images: [
      { src: `${IMG}project-2-a.webp`, alt: 'Illustration: ducts and pipes tagged and dimensioned automatically' },
      { src: `${IMG}project-2-b.webp`, alt: 'Illustration: a ribbon of Revit tool buttons' },
    ],
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
    images: [
      { src: `${IMG}project-3-a.webp`, alt: 'Illustration: a plain-language question and the pipe it traces' },
      { src: `${IMG}project-3-b.webp`, alt: 'Illustration: a system traced through connected pipework' },
    ],
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
  pages: [
    { label: 'Story', href: '/story/' },
    { label: 'Experience', href: '/experience/' },
    { label: 'Work', href: '/work/' },
    { label: 'AJ-Tools', href: '/aj-tools/' },
    { label: 'Heron AI', href: '/heron-ai/' },
    { label: 'Toolbox', href: '/toolbox/' },
    { label: 'Skills', href: '/skills/' },
    { label: 'About', href: '/about/' },
    { label: 'FAQ', href: '/faq/' },
    { label: 'Contact', href: '/contact/' },
  ],
  // The page is rendered to static HTML at build time, so it cannot read the
  // clock there without the output changing with the date. This is what the
  // HTML says; the browser swaps in the current year once it runs.
  year: 2026,
}
