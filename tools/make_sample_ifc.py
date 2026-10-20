#!/usr/bin/env python3
"""
Writes toolbox/bim-viewer/sample-villa.ifc, the model the BIM Viewer opens
before anyone drops their own file in.

It is generated rather than downloaded so that every line of it is ours to
publish: a two-storey villa with walls, slabs, doors, windows, a stair, a
canopy, furniture, rooms, and a short run of duct, pipe and cable tray, so the
viewer has every kind of thing a Revit IFC export carries. Units are
millimetres, the way Revit writes them. Element names follow Revit's
"Family:Type:Id" pattern so the properties panel reads like a real export.

Run:   python3 tools/make_sample_ifc.py
Needs: pip install ifcopenshell   (0.9 or newer; only to regenerate the file)
"""

import os

import numpy as np
from ifcopenshell.api import (aggregate, context, feature, geometry, project as proj, pset, root,
                              spatial, style, unit)
from ifcopenshell.api import type as typ

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "toolbox", "bim-viewer", "sample-villa.ifc")

f = proj.create_file(version="IFC4")
project = root.create_entity(f, ifc_class="IfcProject", name="BIM Viewer sample villa")
unit.assign_unit(f, units=[unit.add_si_unit(f, "LENGTHUNIT", "MILLI"),
                           unit.add_si_unit(f, "AREAUNIT"),
                           unit.add_si_unit(f, "VOLUMEUNIT")])
model_ctx = context.add_context(f, context_type="Model")
body = context.add_context(f, context_type="Model", context_identifier="Body",
                           target_view="MODEL_VIEW", parent=model_ctx)

MM = 1000.0          # geometry is written in millimetres, placements in metres
L1 = 3.5             # first floor level
ROOF = 7.0           # roof level
_next_id = [312040]


def rid():
    _next_id[0] += 7
    return _next_id[0]


def moved(x=0.0, y=0.0, z=0.0):
    m = np.eye(4)
    m[:3, 3] = (x, y, z)
    return m


# ------------------------------------------------------------------ spatial
site = root.create_entity(f, ifc_class="IfcSite", name="Default Site")
building = root.create_entity(f, ifc_class="IfcBuilding", name="Sample Villa")
aggregate.assign_object(f, products=[site], relating_object=project)
aggregate.assign_object(f, products=[building], relating_object=site)
for e in (site, building):
    geometry.edit_object_placement(f, product=e, matrix=moved())

storeys = {}
for name, elev in (("Level 00", 0.0), ("Level 01", L1), ("Roof", ROOF)):
    s = root.create_entity(f, ifc_class="IfcBuildingStorey", name=name)
    s.Elevation = elev * MM
    aggregate.assign_object(f, products=[s], relating_object=building)
    geometry.edit_object_placement(f, product=s, matrix=moved(z=elev))
    storeys[name] = s
GF, FF, RF = storeys["Level 00"], storeys["Level 01"], storeys["Roof"]


# ------------------------------------------------------------------- styles
def surface(name, rgb, transparency=0.0):
    s = style.add_style(f, name=name)
    style.add_surface_style(f, style=s, ifc_class="IfcSurfaceStyleShading", attributes={
        "SurfaceColour": {"Name": None, "Red": rgb[0], "Green": rgb[1], "Blue": rgb[2]},
        "Transparency": transparency})
    return s


S = {
    "render":   surface("Render - White", (0.93, 0.91, 0.87)),
    "charcoal": surface("Render - Charcoal", (0.30, 0.31, 0.33)),
    "plaster":  surface("Plaster - Interior", (0.95, 0.95, 0.93)),
    "concrete": surface("Concrete - Cast In Situ", (0.64, 0.63, 0.61)),
    "roof":     surface("Roofing - Membrane", (0.42, 0.43, 0.45)),
    "frame":    surface("Aluminium - Dark Grey", (0.17, 0.18, 0.20)),
    "glass":    surface("Glass - Clear", (0.55, 0.74, 0.84), 0.72),
    "wood":     surface("Wood - Oak", (0.56, 0.38, 0.23)),
    "stone":    surface("Stone - Limestone", (0.80, 0.77, 0.70)),
    "column":   surface("Concrete - Fair Face", (0.76, 0.76, 0.74)),
    "duct":     surface("Galvanised Steel", (0.63, 0.70, 0.77)),
    "pipe":     surface("Pipe - Domestic Cold Water", (0.18, 0.62, 0.32)),
    "tray":     surface("Cable Tray - Hot Dip", (0.80, 0.63, 0.20)),
    "terminal": surface("Diffuser - White", (0.96, 0.96, 0.96)),
    "fabric":   surface("Fabric - Slate Blue", (0.30, 0.38, 0.50)),
    "linen":    surface("Fabric - Linen", (0.88, 0.85, 0.80)),
    "worktop":  surface("Quartz - White", (0.93, 0.93, 0.91)),
    "cabinet":  surface("Laminate - Graphite", (0.24, 0.25, 0.27)),
    "room":     surface("Room", (0.40, 0.70, 1.00), 0.85),
}


# ----------------------------------------------------------------- geometry
def box(x0, y0, z0, x1, y1, z1):
    """An axis-aligned block, corners in metres."""
    dx, dy, dz = x1 - x0, y1 - y0, z1 - z0
    prof = f.createIfcRectangleProfileDef(
        "AREA", None, f.createIfcAxis2Placement2D(f.createIfcCartesianPoint((dx * MM / 2, dy * MM / 2))),
        dx * MM, dy * MM)
    pos = f.createIfcAxis2Placement3D(f.createIfcCartesianPoint((x0 * MM, y0 * MM, z0 * MM)))
    return f.createIfcExtrudedAreaSolid(prof, pos, f.createIfcDirection((0.0, 0.0, 1.0)), dz * MM)


def tube_x(x0, x1, y, z, r):
    """A round bar along X, centre line at (y, z)."""
    prof = f.createIfcCircleProfileDef("AREA", None, None, r * MM)
    pos = f.createIfcAxis2Placement3D(f.createIfcCartesianPoint((x0 * MM, y * MM, z * MM)),
                                      f.createIfcDirection((1.0, 0.0, 0.0)),
                                      f.createIfcDirection((0.0, 1.0, 0.0)))
    return f.createIfcExtrudedAreaSolid(prof, pos, f.createIfcDirection((0.0, 0.0, 1.0)), (x1 - x0) * MM)


def shape(product, parts):
    """parts: [(item, style)]. Every product sits at the origin; its geometry
    carries the real coordinates, which keeps this script easy to read."""
    for item, st in parts:
        style.assign_item_style(f, item=item, style=st)
    rep = f.createIfcShapeRepresentation(body, "Body", "SweptSolid", [p[0] for p in parts])
    geometry.edit_object_placement(f, product=product, matrix=moved())
    geometry.assign_representation(f, product=product, representation=rep)


def props(product, name, values):
    ps = pset.add_pset(f, product=product, name=name)
    pset.edit_pset(f, pset=ps, properties=values)


def qto(product, name, values):
    q = pset.add_qto(f, product=product, name=name)
    pset.edit_qto(f, qto=q, properties=values)


TYPES = {}


def type_of(ifc_class, name):
    key = (ifc_class, name)
    if key not in TYPES:
        TYPES[key] = root.create_entity(f, ifc_class=ifc_class, name=name)
    return TYPES[key]


def element(ifc_class, family, storey, parts, type_class=None, predefined=None):
    e = root.create_entity(f, ifc_class=ifc_class, name=f"{family}:{rid()}", predefined_type=predefined)
    shape(e, parts)
    spatial.assign_container(f, products=[e], relating_structure=storey)
    if type_class:
        typ.assign_type(f, related_objects=[e], relating_type=type_of(type_class, family),
                        should_map_representations=False)
    e.Tag = str(_next_id[0])
    return e


# -------------------------------------------------------------------- walls
def wall(family, storey, bounds, st, external, height_note=None):
    w = element("IfcWall", family, storey, [(box(*bounds), st)], "IfcWallType", "STANDARD")
    x0, y0, z0, x1, y1, z1 = bounds
    length, width = (x1 - x0, y1 - y0) if (x1 - x0) >= (y1 - y0) else (y1 - y0, x1 - x0)
    props(w, "Pset_WallCommon", {"IsExternal": external, "LoadBearing": external,
                                 "FireRating": "60 min" if external else "30 min"})
    qto(w, "Qto_WallBaseQuantities", {"Length": length * MM, "Width": width * MM,
                                      "Height": (z1 - z0) * MM})
    return w


def hole(host, bounds):
    o = root.create_entity(f, ifc_class="IfcOpeningElement", name="Opening")
    shape(o, [(box(*bounds), S["frame"])])
    feature.add_feature(f, feature=o, element=host)
    return o


def frame_parts(along, a, b, w0, w1, z0, z1, bar=0.06, depth=0.10, sill=True):
    """Frame bars for an opening from a to b along the wall, whose thickness is w0..w1."""
    c = (w0 + w1) / 2
    d0, d1 = c - depth / 2, c + depth / 2

    def blk(u0, u1, v0, v1, h0, h1):
        return box(u0, v0, h0, u1, v1, h1) if along == "x" else box(v0, u0, h0, v1, u1, h1)
    parts = [(blk(a, a + bar, d0, d1, z0, z1), S["frame"]),
             (blk(b - bar, b, d0, d1, z0, z1), S["frame"]),
             (blk(a, b, d0, d1, z1 - bar, z1), S["frame"])]
    if sill:
        parts.append((blk(a, b, d0, d1, z0, z0 + bar), S["frame"]))
    return parts, blk, c


def window(host, storey, along, a, b, w0, w1, z0, z1, family="Fixed:1800 x 1500mm"):
    hole(host, (a, w0 - 0.05, z0, b, w1 + 0.05, z1) if along == "x" else (w0 - 0.05, a, z0, w1 + 0.05, b, z1))
    parts, blk, c = frame_parts(along, a, b, w0, w1, z0, z1)
    parts.append((blk(a + 0.06, b - 0.06, c - 0.006, c + 0.006, z0 + 0.06, z1 - 0.06), S["glass"]))
    win = element("IfcWindow", family, storey, parts, "IfcWindowType", "WINDOW")
    win.OverallWidth, win.OverallHeight = (b - a) * MM, (z1 - z0) * MM
    props(win, "Pset_WindowCommon", {"IsExternal": True, "ThermalTransmittance": 1.8,
                                     "GlazingAreaFraction": 0.82})
    return win


def door(host, storey, along, a, b, w0, w1, z0, z1, family, external, glass=False):
    hole(host, (a, w0 - 0.05, z0, b, w1 + 0.05, z1) if along == "x" else (w0 - 0.05, a, z0, w1 + 0.05, b, z1))
    parts, blk, c = frame_parts(along, a, b, w0, w1, z0, z1, bar=0.05, sill=False)
    if glass:   # two sliding leaves
        mid = (a + b) / 2
        for u0, u1, off in ((a + 0.05, mid + 0.03, -0.025), (mid - 0.03, b - 0.05, 0.025)):
            parts.append((blk(u0, u1, c + off - 0.02, c + off + 0.02, z0, z0 + 0.05), S["frame"]))
            parts.append((blk(u0, u0 + 0.05, c + off - 0.02, c + off + 0.02, z0, z1 - 0.05), S["frame"]))
            parts.append((blk(u1 - 0.05, u1, c + off - 0.02, c + off + 0.02, z0, z1 - 0.05), S["frame"]))
            parts.append((blk(u0 + 0.05, u1 - 0.05, c + off - 0.006, c + off + 0.006, z0 + 0.05, z1 - 0.05), S["glass"]))
    else:       # one leaf, ajar a little so it reads as a door
        parts.append((blk(a + 0.05, b - 0.05, c - 0.022, c + 0.022, z0 + 0.01, z1 - 0.05), S["wood"]))
    d = element("IfcDoor", family, storey, parts, "IfcDoorType", "DOOR")
    d.OverallWidth, d.OverallHeight = (b - a) * MM, (z1 - z0) * MM
    props(d, "Pset_DoorCommon", {"IsExternal": external, "FireRating": "30 min" if not external else "",
                                 "HandicapAccessible": (b - a) >= 0.9})
    return d


EXT_GF = "Basic Wall:Exterior - 250mm Block Render"
EXT_FF = "Basic Wall:Exterior - 250mm Block Charcoal"
INT = "Basic Wall:Interior - 120mm Partition"
T, IT = 0.25, 0.12          # wall thicknesses
W, D = 14.0, 10.0           # footprint

for storey, z0, z1, fam, st in ((GF, 0.0, L1 - 0.2, EXT_GF, S["render"]),
                                (FF, L1, ROOF - 0.2, EXT_FF, S["charcoal"])):
    south = wall(fam, storey, (0, 0, z0, W, T, z1), st, True)
    north = wall(fam, storey, (0, D - T, z0, W, D, z1), st, True)
    west = wall(fam, storey, (0, T, z0, T, D - T, z1), st, True)
    east = wall(fam, storey, (W - T, T, z0, W, D - T, z1), st, True)
    mid = wall(INT, storey, (7.0, T, z0, 7.0 + IT, D - T, z1), S["plaster"], False)
    split = wall(INT, storey, (7.0 + IT, 4.94, z0, W - T, 5.06, z1), S["plaster"], False)

    win = lambda host, along, a, b, w0, w1, sill=0.9, h=1.5: window(  # noqa: E731
        host, storey, along, a, b, w0, w1, z0 + sill, z0 + sill + h)

    if storey is GF:
        door(south, GF, "x", 3.0, 4.2, 0, T, 0.0, 2.4, "Single-Flush:1200 x 2400mm Entrance", True)
        win(south, "x", 5.0, 6.5, 0, T)
        win(south, "x", 9.5, 11.5, 0, T)
        door(north, GF, "x", 2.5, 5.5, D - T, D, 0.0, 2.4, "Sliding-Glazed:3000 x 2400mm", True, glass=True)
        win(north, "x", 9.0, 12.0, D - T, D, sill=1.1, h=1.0)
        win(west, "y", 1.0, 2.6, 0, T)
        win(east, "y", 1.5, 3.5, W - T, W)
        win(east, "y", 6.5, 8.5, W - T, W)
        door(mid, GF, "y", 1.5, 2.4, 7.0, 7.0 + IT, 0.0, 2.1, "Single-Flush:900 x 2100mm", False)
        hole(mid, (6.95, 6.0, 0.0, 7.0 + IT + 0.05, 8.0, 2.4))          # open to the kitchen
        door(split, GF, "x", 11.8, 12.7, 4.94, 5.06, 0.0, 2.1, "Single-Flush:900 x 2100mm", False)
    else:
        win(south, "x", 1.0, 3.0, 0, T)
        win(south, "x", 4.0, 6.5, 0, T)
        win(south, "x", 9.5, 11.5, 0, T)
        win(north, "x", 2.5, 5.0, D - T, D)
        win(north, "x", 9.0, 11.5, D - T, D)
        win(west, "y", 1.0, 2.6, 0, T)
        win(east, "y", 1.5, 3.5, W - T, W)
        win(east, "y", 6.5, 8.5, W - T, W)
        door(mid, FF, "y", 1.5, 2.4, 7.0, 7.0 + IT, L1, L1 + 2.1, "Single-Flush:900 x 2100mm", False)
        door(mid, FF, "y", 7.5, 8.4, 7.0, 7.0 + IT, L1, L1 + 2.1, "Single-Flush:900 x 2100mm", False)

# parapet round the roof
PAR = "Basic Wall:Parapet - 200mm"
for b in ((0, 0, ROOF, W, 0.2, ROOF + 0.9), (0, D - 0.2, ROOF, W, D, ROOF + 0.9),
          (0, 0.2, ROOF, 0.2, D - 0.2, ROOF + 0.9), (W - 0.2, 0.2, ROOF, W, D - 0.2, ROOF + 0.9)):
    wall(PAR, RF, b, S["render"], True)


# ------------------------------------------------------------------- slabs
def slab(family, storey, bounds, st, external=False, predefined="FLOOR"):
    s = element("IfcSlab", family, storey, [(box(*bounds), st)], "IfcSlabType", predefined)
    x0, y0, z0, x1, y1, z1 = bounds
    props(s, "Pset_SlabCommon", {"IsExternal": external, "LoadBearing": True})
    qto(s, "Qto_SlabBaseQuantities", {"Width": (z1 - z0) * MM, "GrossArea": (x1 - x0) * (y1 - y0)})
    return s


slab("Floor:Ground Bearing Slab 200mm", GF, (0, 0, -0.2, W, D, 0.0), S["stone"])
slab("Floor:Porch - Limestone 150mm", GF, (1.5, -2.5, -0.15, 6.0, 0.0, 0.0), S["stone"], True)
first = slab("Floor:Concrete 200mm", FF, (0, 0, L1 - 0.2, W, D, L1), S["concrete"])
STAIR_X0, STAIR_X1, STAIR_Y0 = T, T + 1.1, 3.5
RISE, GOING, RISERS = L1 / 20, 0.28, 20
STAIR_Y1 = STAIR_Y0 + (RISERS - 1) * GOING
hole(first, (STAIR_X0, STAIR_Y0, L1 - 0.3, STAIR_X1 + 0.05, STAIR_Y1, L1 + 0.1))
slab("Floor:Roof Slab 200mm", RF, (0, 0, ROOF - 0.2, W, D, ROOF), S["roof"], True, "ROOF")
slab("Floor:Canopy 200mm", GF, (2.0, -2.2, 2.9, 5.5, 0.0, 3.1), S["render"], True)

# ------------------------------------------------------------------ columns
for x, y in ((2.15, -2.05), (5.35, -2.05)):
    c = element("IfcColumn", "Concrete-Square-Column:250 x 250mm", GF,
                [(box(x - 0.125, y - 0.125, 0.0, x + 0.125, y + 0.125, 2.9), S["column"])],
                "IfcColumnType", "COLUMN")
    props(c, "Pset_ColumnCommon", {"IsExternal": True, "LoadBearing": True})

# -------------------------------------------------------------------- stair
steps = [(box(STAIR_X0, STAIR_Y0 + i * GOING, 0.0, STAIR_X1, STAIR_Y0 + (i + 1) * GOING, (i + 1) * RISE), S["stone"])
         for i in range(RISERS - 1)]
stair = element("IfcStairFlight", "Monolithic Stair:1100mm Width", GF, steps, "IfcStairFlightType", "STRAIGHT")
props(stair, "Pset_StairFlightCommon", {"NumberOfRiser": RISERS, "NumberOfTreads": RISERS - 1,
                                        "RiserHeight": round(RISE * MM, 1), "TreadLength": GOING * MM})
rail = element("IfcRailing", "Railing:Glass Balustrade 1000mm", FF, [
    (box(STAIR_X1 + 0.03, STAIR_Y0, L1, STAIR_X1 + 0.05, STAIR_Y1, L1 + 1.0), S["glass"]),
    (box(STAIR_X0, STAIR_Y0 - 0.05, L1, STAIR_X1 + 0.05, STAIR_Y0 - 0.03, L1 + 1.0), S["glass"]),
    (box(STAIR_X1 + 0.02, STAIR_Y0 - 0.05, L1 + 1.0, STAIR_X1 + 0.06, STAIR_Y1, L1 + 1.04), S["frame"]),
], "IfcRailingType", "BALUSTRADE")

# ---------------------------------------------------------------- furniture
FURN = [
    (GF, "Sofa:3 Seat 2400mm", [(box(2.0, 7.4, 0.0, 4.4, 8.3, 0.42), S["fabric"]),
                                (box(2.0, 8.05, 0.42, 4.4, 8.3, 0.85), S["fabric"])]),
    (GF, "Table-Coffee:1200 x 700mm", [(box(2.6, 6.1, 0.0, 3.8, 6.8, 0.42), S["wood"])]),
    (GF, "Base Cabinet:Run 5600mm", [(box(7.6, 9.1, 0.0, 13.2, 9.75, 0.86), S["cabinet"]),
                                     (box(7.6, 9.08, 0.86, 13.2, 9.75, 0.9), S["worktop"])]),
    (GF, "Kitchen Island:2000 x 900mm", [(box(9.5, 6.8, 0.0, 11.5, 7.7, 0.86), S["cabinet"]),
                                         (box(9.45, 6.75, 0.86, 11.55, 7.75, 0.9), S["worktop"])]),
    (GF, "Bed-Double:1600 x 2000mm", [(box(10.4, 1.0, 0.0, 12.0, 3.0, 0.5), S["linen"]),
                                      (box(10.35, 0.6, 0.0, 12.05, 0.7, 1.1), S["wood"])]),
    (FF, "Bed-Double:1600 x 2000mm", [(box(10.4, 1.0, L1, 12.0, 3.0, L1 + 0.5), S["linen"]),
                                      (box(10.35, 0.6, L1, 12.05, 0.7, L1 + 1.1), S["wood"])]),
    (FF, "Bed-Double:1600 x 2000mm", [(box(10.4, 6.8, L1, 12.0, 8.8, L1 + 0.5), S["linen"]),
                                      (box(10.35, 9.0, L1, 12.05, 9.1, L1 + 1.1), S["wood"])]),
    (FF, "Desk:1400 x 700mm", [(box(3.5, 8.8, L1, 4.9, 9.5, L1 + 0.75), S["wood"])]),
]
for storey, fam, parts in FURN:
    element("IfcFurniture", fam, storey, parts, "IfcFurnitureType", "NOTDEFINED")

# ---------------------------------------------------------------------- MEP
duct = element("IfcDuctSegment", "Rectangular Duct:Supply Air 500 x 300", GF,
               [(box(1.6, 4.75, 2.85, 6.6, 5.25, 3.15), S["duct"])], "IfcDuctSegmentType", "RIGIDSEGMENT")
props(duct, "AJ_MEP", {"System Name": "SA-01 Supply Air", "Size": "500x300", "Flow": "450 L/s"})
for x in (2.6, 5.2):
    t = element("IfcAirTerminal", "Supply Diffuser:Square 450 x 450", GF,
                [(box(x - 0.225, 4.775, 2.8, x + 0.225, 5.225, 2.85), S["terminal"])], "IfcAirTerminalType", "DIFFUSER")
    props(t, "AJ_MEP", {"System Name": "SA-01 Supply Air", "Flow": "225 L/s"})
pipe = element("IfcPipeSegment", "Pipe Types:Domestic Cold Water DN50", GF,
               [(tube_x(7.3, 13.5, 9.6, 2.7, 0.03), S["pipe"])], "IfcPipeSegmentType", "RIGIDSEGMENT")
props(pipe, "AJ_MEP", {"System Name": "DCW-01 Domestic Cold Water", "Size": "50 mm"})
tray = element("IfcCableCarrierSegment", "Cable Tray:Ladder 300 x 50", GF,
               [(box(7.5, 4.5, 3.0, 13.4, 4.8, 3.05), S["tray"])], "IfcCableCarrierSegmentType", "CABLELADDERSEGMENT")
props(tray, "AJ_MEP", {"System Name": "LV Containment", "Size": "300x50"})

# -------------------------------------------------------------------- rooms
ROOMS = [
    (GF, "001", "Living Room", (T, T, 0.0, 7.0, D - T, L1 - 0.2)),
    (GF, "002", "Bedroom", (7.0 + IT, T, 0.0, W - T, 4.94, L1 - 0.2)),
    (GF, "003", "Kitchen", (7.0 + IT, 5.06, 0.0, W - T, D - T, L1 - 0.2)),
    (FF, "101", "Family Room", (T, T, L1, 7.0, D - T, ROOF - 0.2)),
    (FF, "102", "Bedroom 1", (7.0 + IT, T, L1, W - T, 4.94, ROOF - 0.2)),
    (FF, "103", "Bedroom 2", (7.0 + IT, 5.06, L1, W - T, D - T, ROOF - 0.2)),
]
for storey, number, name, b in ROOMS:
    sp = root.create_entity(f, ifc_class="IfcSpace", name=number, predefined_type="INTERNAL")
    sp.LongName = name
    shape(sp, [(box(*b), S["room"])])
    aggregate.assign_object(f, products=[sp], relating_object=storey)
    x0, y0, z0, x1, y1, z1 = b
    qto(sp, "Qto_SpaceBaseQuantities", {"NetFloorArea": round((x1 - x0) * (y1 - y0), 2),
                                        "Height": (z1 - z0) * MM})

f.write(OUT)
print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} kB, "
      f"{len(f.by_type('IfcProduct'))} products)")
