# Home page images

The home page has 26 image slots. Each one has a placeholder in
`assets/home/img/` right now (3D renders made for the layout), so the page is
complete without them. Replace them in any order.

## How to swap one in

1. Paste the prompt into your image model and generate.
2. Attach the image in your chat with Claude and say which slot it is for.
   PNG or JPG is fine.
3. Claude fits it to the slot as WebP, replaces the placeholder, checks the
   page and pushes it.

Order that matters most: the portrait, then the three projects, then the four
About icons, then the marquee.

## 1. Hero portrait

| File | Shape | Where |
|---|---|---|
| `hero-portrait` | 4:5 portrait, at least 1600×2000, **transparent PNG** | centre of the first screen, standing on the bottom edge |

Upload your own photo to the image model together with this prompt:

> Use the uploaded photo as the face reference and keep my face, skin tone, hair and beard exactly the same. Create a professional half-body portrait of me facing the camera with a calm, confident expression and a slight smile. Frame from just above the head down to the waist, centred, with the body cut off cleanly by the bottom edge of the image. I am wearing a plain black crew-neck t-shirt with no logos. Soft studio key light from the left, a subtle cool rim light on the shoulders and hair, gentle shadows. Ultra-realistic photograph, sharp focus, 85mm lens look. Transparent background, PNG. Portrait 4:5, 1600×2000 px. No text, no watermark.

If your tool cannot do a transparent background, ask for a plain solid black
background instead and say so when you upload it.

## 2. About section icons

Four small glossy 3D objects in the corners around "About me". Each is a
**1:1 transparent PNG, 1024×1024**. Make all four in the same chat, so they
come out in one style.

| File | Where |
|---|---|
| `about-hardhat` | top left |
| `about-valve` | bottom left |
| `about-duct` | top right |
| `about-cube` | bottom right |

**about-hardhat**
> A glossy 3D icon of a yellow construction safety helmet with raised ridges on top and a short front peak, smooth rounded shapes, soft clay-plastic look. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

**about-valve**
> A glossy 3D icon of an industrial gate valve: a bright red round handwheel on top, a dark grey metal valve body with bolted flanges, and short cyan pipe ends on both sides. Smooth rounded shapes, soft clay-plastic look, same style as the hard hat icon. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

**about-duct**
> A glossy 3D icon of a rectangular HVAC ductwork 90-degree elbow in galvanised silver sheet metal, with flange connectors at both ends and softly rounded edges, same style as the hard hat icon. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

**about-cube**
> A glossy 3D icon of a clear glass cube with rounded edges, with three shiny pipes inside it, red, cyan and magenta, each bending through the cube with smooth elbows, like a tiny coordinated BIM model sealed in glass. Same style as the hard hat icon. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

## 3. Marquee (the two moving rows under the first screen)

Twelve tiles shown at 420×270. Make each **3:2 landscape, 1536×1024**, subject
in the middle. Row one is 01–06, row two is 07–12.

**marquee-01**
> Photorealistic 3D render of a coordinated MEP ceiling void in a corridor, seen from above at a three-quarter angle with the concrete slab cut away: a blue supply air duct, a magenta return air duct, a red sprinkler main with branch lines, cyan and dark blue chilled water pipes, a green drainage pipe and an orange cable tray, all hung on threaded-rod hangers. Revit and Navisworks BIM model style, clean geometry, soft shadows, cinematic lighting, dark navy background. 3:2 landscape. No text, no logos, no watermark.

**marquee-02**
> Photorealistic 3D render of an industrial pipe rack at a petrochemical plant at dusk: yellow steel portal frames, many parallel pipes in silver insulation, red, cyan and green, cable trays on the upper tier, one large pipe rising out of the rack with a long-radius bend. Low camera angle looking along the rack, purple and orange sunset sky, warm rim light. 3:2 landscape. No text, no logos, no watermark.

**marquee-03**
> Photorealistic 3D render of a mechanical plant room in BIM model style: an air handling unit, three chilled water pumps on concrete plinths, pipe headers with red valve handwheels, and blue and magenta ducts rising to the ceiling. Isometric three-quarter view from above, clean geometry, soft shadows, dark grey walls and floor. 3:2 landscape. No text, no logos, no watermark.

**marquee-04**
> Photorealistic 3D render of a four-storey building core as a BIM model: white concrete slabs and columns with a vertical MEP riser shaft carrying a blue duct and red, cyan and green pipes, with branches leaving on every floor. Three-quarter view, soft studio lighting, deep purple background. 3:2 landscape. No text, no logos, no watermark.

**marquee-05**
> A Navisworks clash detection view: a BIM model of ducts and pipes shown in faint grey x-ray transparency, one red pipe driven straight through a magenta duct, the clash point marked with a glowing translucent red sphere. Dark background, cinematic, technical and clean. 3:2 landscape. No text, no logos, no watermark.

**marquee-06**
> Ten glossy 3D app-style buttons floating in two rows, each with a simple white line icon: a tag, a dimension line, a duct, a pipe bend, a filter funnel, an eye, a level marker, a magic wand, a grid and a revision cloud. Colours purple, magenta, orange, blue, cyan and green, soft rounded shapes, studio lighting, dark plum background. 3:2 landscape. No text, no logos, no watermark.

**marquee-07**
> Photorealistic 3D render looking up at MEP services under a concrete slab: rectangular ducts, pipes and a cable tray running away into the distance in strong perspective, sprinkler heads hanging below, threaded-rod hangers. Revit BIM model style, teal night-time lighting, dark background. 3:2 landscape. No text, no logos, no watermark.

**marquee-08**
> Photorealistic close-up of large-diameter pipes resting on a yellow steel pipe rack at an industrial plant, silver insulation, red and blue painted pipes, warm orange sunset light from the side, long dramatic shadows, dark ember sky. 3:2 landscape. No text, no logos, no watermark.

**marquee-09**
> A BIM plant room shown in x-ray mode: every element faded to transparent grey except one chilled water system that glows bright cyan, traced from the pumps up through the pipe headers to the ceiling. Dark navy background, clean technical look. 3:2 landscape. No text, no logos, no watermark.

**marquee-10**
> Close-up 3D render of a coordinated duct and pipe run in Revit style, with neat dark annotation tags floating next to each service and white dimension lines between them, blue duct, magenta duct, cyan pipe, orange cable tray. Dark navy background, crisp and clean. 3:2 landscape. No watermark.

**marquee-11**
> Photorealistic close-up of an MEP riser shaft passing through concrete floor slabs: a galvanised duct with flanges and red, cyan and green pipes going straight up, fire-stopping collars where they pass each slab. Dramatic teal lighting, dark background. 3:2 landscape. No text, no logos, no watermark.

**marquee-12**
> An iPad held up on a construction site under an exposed concrete ceiling, its screen showing a 3D MEP model in augmented reality lined up with the real ceiling above, ducts and pipes in blue, magenta and red. Evening light, shallow depth of field, cinematic. 3:2 landscape. No text, no logos, no watermark.

## 4. Project cards

Each card has three images: a wide one top left, a medium one bottom left, and
a big one on the right. Keep the subject in the middle of the frame: the
picture is cropped differently on a phone and on a wide screen.

| Slot | Shape |
|---|---|
| `project-N-a` (top left) | 16:9, 1920×1080 |
| `project-N-b` (bottom left) | 4:3, 1600×1200 |
| `project-N-c` (right) | 1:1, 1600×1600 |

### Project 01 · MEP BIM Coordination

**project-1-a**
> Photorealistic 3D render of a federated MEP model over one floor of a school, seen from high above at a three-quarter angle: ducts, pipes and cable trays colour-coded by system (supply air blue, return air magenta, fire red, chilled water cyan, drainage green, cable tray orange) laid out over a light grey floor plan. Clean Revit BIM style, soft shadows, dark navy background. 16:9 landscape, subject centred. No text, no logos, no watermark.

**project-1-b**
> Photorealistic 3D render of HVAC ducts and process pipes on a steel pipe rack at a polyethylene plant, BIM model style, colour-coded services, dusk sky in purple and orange, warm rim light. 4:3, subject centred. No text, no logos, no watermark.

**project-1-c**
> Photorealistic 3D render of a building core cutaway: white slabs and columns with a coordinated MEP riser shaft, blue ducts and red, cyan and green pipes branching out on every floor. Clean BIM model style, three-quarter view, soft studio lighting, dark charcoal background. Square 1:1, subject centred. No text, no logos, no watermark.

### Project 02 · AJ-Tools

**project-2-a**
> Close-up 3D render of ducts and pipes in a Revit-style model with tidy annotation tags and white dimension strings placed automatically along them, blue and magenta ducts, cyan pipes, orange cable tray. Crisp, clean, dark navy background. 16:9 landscape, subject centred. No watermark.

**project-2-b**
> A floating 3D ribbon of glossy rounded tool buttons, like a Revit add-in toolbar, each with a simple white line icon (tag, dimension, duct, pipe, filter, eye, grid, wand), in purple, magenta, orange and blue, soft studio lighting, dark plum background. 4:3, subject centred. No text, no logos, no watermark.

**project-2-c**
> 3D render of two MEP pipe runs being joined by a new elbow that glows bright cyan, the rest of the model in neutral grey, clean Revit BIM style, three-quarter view, soft shadows, dark background. Square 1:1, subject centred. No text, no logos, no watermark.

### Project 03 · Heron AI

**project-3-a**
> A BIM model of a corridor ceiling void in faint grey x-ray transparency, with one chilled water pipe glowing bright cyan along its whole route, and a clean white chat bubble floating above it that says "Which unit feeds this?". Dark navy background, minimal and futuristic. 16:9 landscape, subject centred. No other text, no watermark.

**project-3-b**
> A BIM plant room in grey x-ray transparency, one pipe system glowing bright cyan and traced from a pump up to the ceiling, a small white chat bubble above it that says "Follow the pipe." Dark background, clean technical look. 4:3, subject centred. No other text, no watermark.

**project-3-c**
> An elegant heron made of glowing cyan light lines standing on top of a translucent grey BIM building model with MEP risers inside, dark midnight blue background, soft glow, minimal and futuristic. Square 1:1, subject centred. No text, no logos, no watermark.
