# Home page images

The home page has 22 image slots. Each one has a placeholder in
`assets/home/img/` right now (3D renders made for the layout), so the page is
complete without them. Replace them in any order.

The first screen and the big picture on the right of each project card are
not images: they are live 3D models built in code (see `README.md`). Their
stills, `model-*.webp`, are rendered from the models, so leave those four
files alone.

## How to swap one in

1. Paste the prompt into your image model and generate.
2. Attach the image in your chat with Claude and say which slot it is for.
   PNG or JPG is fine. If your tool cannot make the exact shape, any
   landscape size works: the picture is cropped to fit, keeping the middle.
3. Claude fits it to the slot as WebP, replaces the placeholder, checks the
   page and pushes it.

Done so far: `about-valve`, `about-duct`, `about-cube`.

Order that matters most: the six project pictures, then the hard hat, then
the marquee.

## 1. About section icons

Four small glossy 3D objects in the corners around "About me". Each is a
**1:1 transparent PNG, 1024×1024**. The valve, duct and cube are done. For
the hard hat, upload those three images together with its prompt, so it comes
out in the same style.

| File | Where |
|---|---|
| `about-hardhat` | top left |
| `about-valve` | bottom left |
| `about-duct` | top right |
| `about-cube` | bottom right |

**about-hardhat**
> The three uploaded images are a set of icons: a valve, a duct elbow and a glass cube. Make a fourth icon for the same set, matching their style exactly: the same glossy realistic 3D render with fine detail, the same three-quarter view from the front-left and slightly above, the same soft studio lighting with the strong pink-magenta rim light on the right edge, and the same size in the frame. The object is a yellow construction safety helmet with raised ridges on top, a short front peak and a smooth glossy shell. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text, no logos.

**about-valve**
> A glossy 3D icon of an industrial gate valve: a bright red round handwheel on top, a dark grey metal valve body with bolted flanges, and short cyan pipe ends on both sides. Smooth rounded shapes, soft clay-plastic look, same style as the hard hat icon. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

**about-duct**
> A glossy 3D icon of a rectangular HVAC ductwork 90-degree elbow in galvanised silver sheet metal, with flange connectors at both ends and softly rounded edges, same style as the hard hat icon. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

**about-cube**
> A glossy 3D icon of a clear glass cube with rounded edges, with three shiny pipes inside it, red, cyan and magenta, each bending through the cube with smooth elbows, like a tiny coordinated BIM model sealed in glass. Same style as the hard hat icon. Three-quarter view from the front-left, slightly above. Soft studio lighting with a pink-magenta rim light on the right edge. Centred, floating, isolated on a transparent background, no ground shadow. Square 1:1, 1024×1024. No text.

## 2. Marquee (the two moving rows under the first screen)

AI images get MEP details wrong - fittings, connections, supports - and an
engineer notices. So none of these show MEP parts up close: they are
futuristic, technology and project-landscape images instead.

Twelve tiles shown at 420×270. Make each **3:2 landscape, 1536×1024**, subject
in the middle. Row one is 01–06, row two is 07–12.

**marquee-01**
> A modern Gulf city skyline at dusk seen across calm water, glass towers glowing, thin cyan wireframe lines tracing the outline of the buildings like a digital twin, purple and orange sky. Cinematic photorealistic image, 3:2 landscape. No text, no logos, no watermark.

**marquee-02**
> Over-the-shoulder view of an engineer holding a tablet on a construction site at dusk, a glowing holographic 3D building rising out of the tablet screen in cyan and magenta light, the site blurred behind. Cinematic, futuristic, 3:2 landscape. No text, no logos, no watermark.

**marquee-03**
> A holographic blueprint of a skyscraper made of fine glowing cyan and magenta lines, floating above a dark glass table, soft bokeh lights in the background. Minimal, cinematic, 3:2 landscape. No text, no logos, no watermark.

**marquee-04**
> Drone view of a large construction site at golden hour, tower cranes silhouetted against a purple and orange sunset sky, a high-rise concrete frame rising, site lights starting to glow. Cinematic photorealistic image, 3:2 landscape. No text, no logos, no watermark.

**marquee-05**
> A city at night with glowing light trails on the roads and a faint grid of cyan lines drawn over the buildings, like a smart city data layer. Cinematic, futuristic, 3:2 landscape. No text, no logos, no watermark.

**marquee-06**
> A small glowing building model floating inside a clear glass sphere, surrounded by drifting points of light and thin orbit lines, dark background, magenta and cyan glow. Minimal, futuristic, 3:2 landscape. No text, no logos, no watermark.

**marquee-07**
> A dark workspace at night, two large monitors glowing with abstract colourful 3D shapes, the screens slightly out of focus, neon magenta and cyan desk light, keyboard in soft focus. Cinematic, 3:2 landscape. No readable screen content, no text, no logos, no watermark.

**marquee-08**
> A modern school campus at sunset, clean contemporary architecture with shaded courtyards and palm trees, warm golden light and a purple sky. Cinematic photorealistic architecture photo, 3:2 landscape. No text, no logos, no watermark.

**marquee-09**
> A drone hovering over a construction site at dawn, projecting a faint grid of cyan laser lines onto the building below as it scans it, soft mist, purple and orange sky. Cinematic, futuristic, 3:2 landscape. No text, no logos, no watermark.

**marquee-10**
> Product shot of a VR headset resting on a dark desk, its glossy visor reflecting a glowing holographic building, neon magenta and cyan rim light. Minimal, cinematic, 3:2 landscape. No text, no logos, no watermark.

**marquee-11**
> A white architectural scale model of modern towers on a dark table, lit from the sides by neon magenta and cyan light, dramatic shadows, shallow depth of field. Cinematic photorealistic image, 3:2 landscape. No text, no logos, no watermark.

**marquee-12**
> An abstract city made entirely of glowing wireframe lines seen from above at an angle, cyan and magenta light on a black background, soft glow and depth of field. Futuristic, minimal, 3:2 landscape. No text, no logos, no watermark.

## 3. Project cards

Each card has two images on the left, a wide one on top and a medium one
under it; the right side is a 3D model. Keep the subject in the middle of the
frame: the picture is cropped differently on a phone and on a wide screen.
The same rule as the marquee: no MEP parts up close.

| Slot | Shape |
|---|---|
| `project-N-a` (top left) | 16:9, 1920×1080 |
| `project-N-b` (bottom left) | 4:3, 1600×1200 |

When these arrive, the alt text for each one in `src/content.ts` changes to
match it (that one needs a rebuild).

### Project 01 · MEP BIM Coordination

**project-1-a**
> A petrochemical plant on the coast seen from far away at dusk, thousands of warm lights, a calm sea in the foreground, purple and orange sky. Cinematic photorealistic image, 16:9 landscape, subject centred. No close-up details, no text, no logos, no watermark.

**project-1-b**
> Inside a modern airport terminal at sunset, a sweeping curved roof and tall glass walls, warm golden light and long shadows on a polished floor, empty and calm. Cinematic photorealistic architecture photo, 4:3, subject centred. No text, no signs, no logos, no watermark.

### Project 02 · AJ-Tools

**project-2-a**
> A glowing glass lightbulb on a dark surface, its filament shaped like a tiny wireframe skyscraper made of light, warm orange and magenta glow, soft reflections. Minimal, futuristic, photorealistic, 16:9 landscape, subject centred. No text, no logos, no watermark.

**project-2-b**
> Glossy 3D icons floating on a dark plum background: a wrench, a measuring ruler, a gear, a tag and a magic wand, smooth rounded cartoon style, purple, magenta, orange and cyan colours, soft studio light. 4:3, subject centred. No text, no logos, no watermark.

### Project 03 · Heron AI

**project-3-a**
> An elegant heron made of glowing cyan light lines standing in shallow water at night, a city skyline glowing softly behind it, reflections on the water. Cinematic, futuristic, 16:9 landscape, subject centred. No text, no logos, no watermark.

**project-3-b**
> A person seen from the side wearing a VR headset in a dark room, reaching toward a floating holographic building made of glowing magenta and cyan lines. Cinematic, futuristic, 4:3, subject centred. No text, no logos, no watermark.
