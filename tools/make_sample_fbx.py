#!/usr/bin/env python3
"""
Writes toolbox/ar-viewer/sample-plant-room.fbx, the model behind the AR
Viewer's "Try the sample" button and its browser check.

It is generated, not exported from Revit, so every line of it is ours to
publish. It is written the way a Revit FBX arrives, because those are the
cases the viewer has to get right:

- Z up, in feet (UnitScaleFactor 30.48), placed away from the origin the way a
  project's internal coordinates usually are.
- Walls and the slab with their corners in world coordinates and no transform.
- One wall with two materials: block core and a painted inside face.
- A glazed panel with a see-through material.
- One air handling unit geometry used twice, and the second copy mirrored
  (scale -1 in X), the way Revit writes a mirrored family.
- A supply duct along the ceiling.

The file is ASCII FBX 7.4, which three.js FBXLoader reads the same way it
reads Revit's binary files. About 25 kB.

Run:   python3 tools/make_sample_fbx.py
Needs: Python 3 only.
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "toolbox", "ar-viewer", "sample-plant-room.fbx")

FT = 1 / 0.3048            # feet per metre: sizes below are in metres, the file in feet
SITE = (420.0, 315.0, 0.0)  # feet; where the room sits in the project's coordinates

# box faces, counter-clockwise seen from outside (corner numbering below)
#   0 x0y0z0  1 x1y0z0  2 x1y1z0  3 x0y1z0  4 x0y0z1  5 x1y0z1  6 x1y1z1  7 x0y1z1
FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (3, 0, 4, 7), (1, 2, 6, 5)]
#          bottom        top           front -Y      back +Y       left -X       right +X


def box(x0, y0, z0, x1, y1, z1, offset=SITE):
    """Corners of an axis-aligned box given in metres, returned in feet."""
    ox, oy, oz = offset
    pts = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
           (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    return [(x * FT + ox, y * FT + oy, z * FT + oz) for x, y, z in pts]


def num(v):
    return f"{v:.6f}".rstrip("0").rstrip(".") if v != int(v) else str(int(v))


class Doc:
    def __init__(self):
        self.objects, self.links, self.next = [], [], 100000

    def uid(self):
        self.next += 1
        return self.next

    def material(self, name, rgb, opacity=1.0):
        i = self.uid()
        r, g, b = rgb
        props = [f'\t\t\tP: "DiffuseColor", "Color", "", "A",{num(r)},{num(g)},{num(b)}']
        if opacity < 1:
            props.append(f'\t\t\tP: "TransparencyFactor", "Number", "", "A",{num(1 - opacity)}')
            props.append(f'\t\t\tP: "Opacity", "double", "Number", "",{num(opacity)}')
        self.objects.append(
            f'\tMaterial: {i}, "Material::{name}", "" {{\n'
            '\t\tVersion: 102\n\t\tShadingModel: "phong"\n\t\tMultiLayer: 0\n'
            '\t\tProperties70:  {\n' + "\n".join(props) + '\n\t\t}\n\t}')
        return i

    def geometry(self, boxes, face_materials=None):
        """One mesh from several boxes. face_materials: per-face material slot, or None."""
        i = self.uid()
        verts, index = [], []
        for corners in boxes:
            base = len(verts)
            verts.extend(corners)
            for face in FACES:
                ids = [base + k for k in face]
                ids[-1] = -ids[-1] - 1          # FBX ends a polygon with a negative index
                index.extend(ids)
        flat = ",".join(num(c) for v in verts for c in v)
        idx = ",".join(str(k) for k in index)
        nfaces = len(index) // 4
        if face_materials:
            mats = ",".join(str(m) for m in face_materials)
            layer = (f'\t\tLayerElementMaterial: 0 {{\n\t\t\tVersion: 101\n\t\t\tName: ""\n'
                     f'\t\t\tMappingInformationType: "ByPolygon"\n\t\t\tReferenceInformationType: "IndexToDirect"\n'
                     f'\t\t\tMaterials: *{nfaces} {{\n\t\t\t\ta: {mats}\n\t\t\t}}\n\t\t}}\n')
        else:
            layer = ('\t\tLayerElementMaterial: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n'
                     '\t\t\tMappingInformationType: "AllSame"\n\t\t\tReferenceInformationType: "IndexToDirect"\n'
                     '\t\t\tMaterials: *1 {\n\t\t\t\ta: 0\n\t\t\t}\n\t\t}\n')
        self.objects.append(
            f'\tGeometry: {i}, "Geometry::", "Mesh" {{\n'
            f'\t\tVertices: *{len(verts) * 3} {{\n\t\t\ta: {flat}\n\t\t}}\n'
            f'\t\tPolygonVertexIndex: *{len(index)} {{\n\t\t\ta: {idx}\n\t\t}}\n'
            f'\t\tGeometryVersion: 124\n{layer}\t}}')
        return i

    def model(self, name, geometry, materials, translate=(0, 0, 0), scale=(1, 1, 1), rotate=(0, 0, 0)):
        i = self.uid()
        props = []
        if translate != (0, 0, 0):
            props.append('\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",' + ",".join(num(v) for v in translate))
        if rotate != (0, 0, 0):
            props.append('\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",' + ",".join(num(v) for v in rotate))
        if scale != (1, 1, 1):
            props.append('\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",' + ",".join(num(v) for v in scale))
        body = ('\t\tProperties70:  {\n' + "\n".join(props) + '\n\t\t}\n') if props else ''
        self.objects.append(f'\tModel: {i}, "Model::{name}", "Mesh" {{\n\t\tVersion: 232\n{body}\t\tCulling: "CullingOff"\n\t}}')
        self.links.append(f'\tC: "OO",{i},0')
        self.links.append(f'\tC: "OO",{geometry},{i}')
        for m in materials:
            self.links.append(f'\tC: "OO",{m},{i}')
        return i

    def text(self):
        return (
            "; FBX 7.4.0 project file\n"
            "; Sample plant room for the AR Viewer on ajmalps.com. Generated by tools/make_sample_fbx.py.\n"
            "; ----------------------------------------------------\n\n"
            "FBXHeaderExtension:  {\n\tFBXHeaderVersion: 1003\n\tFBXVersion: 7400\n"
            '\tCreator: "ajmalps.com make_sample_fbx.py"\n}\n'
            "GlobalSettings:  {\n\tVersion: 1000\n\tProperties70:  {\n"
            '\t\tP: "UpAxis", "int", "Integer", "",2\n'
            '\t\tP: "UpAxisSign", "int", "Integer", "",1\n'
            '\t\tP: "FrontAxis", "int", "Integer", "",1\n'
            '\t\tP: "FrontAxisSign", "int", "Integer", "",-1\n'
            '\t\tP: "CoordAxis", "int", "Integer", "",0\n'
            '\t\tP: "CoordAxisSign", "int", "Integer", "",1\n'
            '\t\tP: "UnitScaleFactor", "double", "Number", "",30.48\n'
            "\t}\n}\n\n"
            "Objects:  {\n" + "\n".join(self.objects) + "\n}\n\n"
            "Connections:  {\n" + "\n".join(self.links) + "\n}\n"
        )


d = Doc()
concrete = d.material("Concrete - Cast-in-Place Gray", (0.62, 0.62, 0.6))
block = d.material("Masonry - Concrete Block", (0.74, 0.72, 0.68))
paint = d.material("Paint - Off White", (0.93, 0.92, 0.88))
glass = d.material("Glass", (0.55, 0.7, 0.78), opacity=0.3)
steel = d.material("Metal - Painted - Gray", (0.5, 0.54, 0.58))
duct = d.material("Galvanised Steel", (0.78, 0.8, 0.82))

W, D, H, T = 8.0, 6.0, 3.2, 0.2      # room inside 8 x 6 m, 3.2 m to the slab, 200 mm walls

slab = d.geometry([box(-T, -T, -0.25, W + T, D + T, 0)])
d.model("Floor: Generic 250mm [312101]", slab, [concrete])

# back wall: block, with its inside face (front, -Y) painted. Face order: bottom, top, front, back, left, right
back = d.geometry([box(-T, D, 0, W + T, D + T, H)], face_materials=[0, 0, 1, 0, 0, 0])
d.model("Basic Wall: Generic 200mm Block [312102]", back, [block, paint])

left = d.geometry([box(-T, 0, 0, 0, D, H)])
d.model("Basic Wall: Generic 200mm Block [312103]", left, [block])

# right wall with a glazed panel: two wall pieces and the glass between them
right = d.geometry([box(W, 0, 0, W + T, 2.0, H), box(W, 4.0, 0, W + T, D, H),
                    box(W, 2.0, 0, W + T, 4.0, 0.9), box(W, 2.0, 2.4, W + T, 4.0, H)])
d.model("Basic Wall: Generic 200mm Block [312104]", right, [block])
pane = d.geometry([box(W + 0.08, 2.0, 0.9, W + 0.12, 4.0, 2.4)])
d.model("Fixed Window: 2000 x 1500mm [312105]", pane, [glass])

# air handling unit, 2.4 x 1.2 x 1.6 m, as one geometry used twice. Its local origin is one
# corner, so the mirrored copy (scale -1 in X) lands beside the first, the way Revit places it
ahu = d.geometry([box(0, 0, 0, 2.4, 1.2, 1.6, offset=(0, 0, 0)),             # casing
                  box(2.4, 0.3, 0.9, 2.9, 0.9, 1.4, offset=(0, 0, 0))])     # outlet collar
d.model("AHU: Packaged 5000 L/s [312106]", ahu, [steel],
        translate=(SITE[0] + 0.6 * FT, SITE[1] + 3.8 * FT, SITE[2]))
d.model("AHU: Packaged 5000 L/s [312107]", ahu, [steel],
        translate=(SITE[0] + 7.4 * FT, SITE[1] + 3.8 * FT, SITE[2]), scale=(-1, 1, 1))

# supply duct 600 x 400 mm along the room under the slab, with two drops to the units
run = d.geometry([box(1.0, 4.1, 2.6, 7.0, 4.7, 3.0),
                  box(3.3, 4.1, 1.4, 3.8, 4.7, 2.6), box(4.2, 4.1, 1.4, 4.7, 4.7, 2.6)])
d.model("Rectangular Duct: Supply 600x400 [312108]", run, [duct])

with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(d.text())
print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT):,} bytes)")
