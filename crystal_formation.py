import bpy
import math
import random
from mathutils import Vector

# -----------------------------
# Scene reset
# -----------------------------
random.seed(42)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

if bpy.data.worlds:
    world = bpy.data.worlds[0]
else:
    world = bpy.data.worlds.new("World")

bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.012, 0.012, 0.02, 1.0)
    bg.inputs[1].default_value = 0.7

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 180
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
try:
    scene.eevee.use_bloom = True
    scene.eevee.bloom_intensity = 0.15
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 0.4
except AttributeError:
    pass  # Older Blender versions

# -----------------------------
# Material helpers
# -----------------------------
def make_crystal_material(name, base_color, roughness, transmission, ior, emission_color, emission_strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    for n in list(nodes):
        nodes.remove(n)

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (700, 0)

    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (220, 0)
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Roughness"].default_value = roughness
    # Blender 4.x renamed Transmission → Transmission Weight
    if "Transmission Weight" in principled.inputs:
        principled.inputs["Transmission Weight"].default_value = transmission
    elif "Transmission" in principled.inputs:
        principled.inputs["Transmission"].default_value = transmission
    principled.inputs["IOR"].default_value = ior
    principled.inputs["Specular IOR Level"].default_value = 0.75

    emission = nodes.new("ShaderNodeEmission")
    emission.location = (220, -220)
    emission.inputs["Color"].default_value = emission_color
    emission.inputs["Strength"].default_value = emission_strength

    mix = nodes.new("ShaderNodeAddShader")
    mix.location = (470, -30)

    links.new(principled.outputs[0], mix.inputs[0])
    links.new(emission.outputs[0], mix.inputs[1])
    links.new(mix.outputs[0], out.inputs[0])

    return mat, emission


def make_rock_material():
    mat = bpy.data.materials.new("GeodeRock")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = nodes.get("Principled BSDF")
    out = nodes.get("Material Output")

    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-540, 180)
    noise.inputs["Scale"].default_value = 10.0
    noise.inputs["Detail"].default_value = 8.0
    noise.inputs["Roughness"].default_value = 0.55

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 180)
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (0.07, 0.06, 0.06, 1.0)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (0.2, 0.17, 0.16, 1.0)

    bump = nodes.new("ShaderNodeBump")
    bump.location = (-300, -20)
    bump.inputs["Strength"].default_value = 0.3

    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Specular IOR Level"].default_value = 0.3

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


# -----------------------------
# Build geode base + parent
# -----------------------------
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
formation = bpy.context.active_object
formation.name = "CrystalFormation"

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.1, location=(0, 0, 0))
rock = bpy.context.active_object
rock.name = "GeodeRock"
rock.parent = formation
rock.data.materials.append(make_rock_material())

# Slightly flatten base so formation feels grounded
bpy.ops.object.modifier_add(type='SIMPLE_DEFORM')
rock.modifiers[-1].deform_method = 'TAPER'
rock.modifiers[-1].deform_axis = 'Z'
rock.modifiers[-1].factor = -0.45

# -----------------------------
# Crystal materials
# -----------------------------
materials = []

amethyst, amethyst_em = make_crystal_material(
    "Crystal_Amethyst",
    (0.32, 0.08, 0.52, 1.0),
    roughness=0.08,
    transmission=0.2,
    ior=1.45,
    emission_color=(0.54, 0.15, 0.9, 1.0),
    emission_strength=0.65,
)
materials.append((amethyst, amethyst_em, 0.55))

quartz, quartz_em = make_crystal_material(
    "Crystal_Quartz",
    (0.92, 0.95, 1.0, 1.0),
    roughness=0.04,
    transmission=0.95,
    ior=1.46,
    emission_color=(0.7, 0.9, 1.0, 1.0),
    emission_strength=0.22,
)
materials.append((quartz, quartz_em, 0.2))

citrine, citrine_em = make_crystal_material(
    "Crystal_Citrine",
    (0.95, 0.65, 0.25, 1.0),
    roughness=0.09,
    transmission=0.35,
    ior=1.44,
    emission_color=(1.0, 0.62, 0.2, 1.0),
    emission_strength=0.45,
)
materials.append((citrine, citrine_em, 0.35))

# -----------------------------
# Generate spikes from center
# -----------------------------
crystal_count = 85
for i in range(crystal_count):
    direction = Vector((
        random.uniform(-1.0, 1.0),
        random.uniform(-1.0, 1.0),
        random.uniform(-0.35, 1.0),
    ))

    if direction.length < 0.1:
        continue

    direction.normalize()

    # Keep most crystals on upper hemisphere to expose structure
    if direction.z < -0.15:
        direction.z *= 0.25
        direction.normalize()

    base_radius = random.uniform(0.025, 0.085)
    tip_radius = base_radius * random.uniform(0.02, 0.25)
    depth = random.uniform(0.45, 1.6) * (0.65 + max(direction.z, -0.2))

    # Add a few large hero crystals
    if random.random() < 0.08:
        base_radius *= random.uniform(1.5, 2.3)
        depth *= random.uniform(1.2, 1.9)

    location = direction * random.uniform(0.12, 0.35)

    bpy.ops.mesh.primitive_cone_add(
        vertices=6,
        radius1=base_radius,
        radius2=tip_radius,
        depth=max(depth, 0.18),
        location=location,
    )
    crystal = bpy.context.active_object
    crystal.name = f"Crystal_{i:03d}"
    crystal.parent = formation

    # Point cone axis outward from center
    crystal.rotation_mode = 'QUATERNION'
    crystal.rotation_quaternion = direction.to_track_quat('Z', 'Y')

    # Slight jitter for natural look
    crystal.scale = (
        random.uniform(0.85, 1.15),
        random.uniform(0.85, 1.15),
        random.uniform(0.9, 1.2),
    )

    mat, _, _ = random.choice(materials)
    crystal.data.materials.append(mat)

# -----------------------------
# Animation: rotation + emission pulse
# -----------------------------
formation.rotation_euler = (0.0, 0.0, 0.0)
formation.keyframe_insert(data_path="rotation_euler", frame=1)
formation.rotation_euler = (0.0, 0.0, math.radians(360.0))
formation.keyframe_insert(data_path="rotation_euler", frame=180)

if formation.animation_data and formation.animation_data.action:
    for fcurve in formation.animation_data.action.fcurves:
        for kp in fcurve.keyframe_points:
            kp.interpolation = 'LINEAR'

for idx, (mat, emission_node, base_strength) in enumerate(materials):
    # 3 pulse cycles over the timeline with phase offsets per material
    phase = idx * 8
    keyframes = [
        (1 + phase, base_strength * 0.55),
        (31 + phase, base_strength * 1.45),
        (61 + phase, base_strength * 0.55),
        (91 + phase, base_strength * 1.35),
        (121 + phase, base_strength * 0.55),
        (151 + phase, base_strength * 1.5),
        (180, base_strength * 0.55),
    ]

    for frame, value in keyframes:
        frame = max(1, min(180, frame))
        emission_node.inputs["Strength"].default_value = value
        emission_node.inputs["Strength"].keyframe_insert(data_path="default_value", frame=frame)

    if mat.node_tree.animation_data and mat.node_tree.animation_data.action:
        for fcurve in mat.node_tree.animation_data.action.fcurves:
            for kp in fcurve.keyframe_points:
                kp.interpolation = 'SINE'

# -----------------------------
# Lighting
# -----------------------------
bpy.ops.object.light_add(type='AREA', location=(2.8, -2.2, 3.4))
key = bpy.context.active_object
key.data.energy = 950
key.data.color = (1.0, 0.95, 0.9)
key.data.size = 3.4

bpy.ops.object.light_add(type='POINT', location=(-2.2, 1.5, 1.8))
fill = bpy.context.active_object
fill.data.energy = 240
fill.data.color = (0.6, 0.72, 1.0)

bpy.ops.object.light_add(type='SPOT', location=(0.0, -3.5, 2.6))
rim = bpy.context.active_object
rim.data.energy = 520
rim.data.color = (0.72, 0.44, 1.0)
rim.data.spot_size = math.radians(58)
rim.data.spot_blend = 0.35
rim.rotation_euler = (math.radians(64), 0.0, 0.0)

# -----------------------------
# Camera setup
# -----------------------------
bpy.ops.object.camera_add(location=(4.4, -4.6, 2.8), rotation=(math.radians(66), 0, math.radians(42)))
cam = bpy.context.active_object
cam.data.lens = 58
cam.data.dof.use_dof = True
cam.data.dof.focus_object = formation
cam.data.dof.aperture_fstop = 2.8
scene.camera = cam

# Render output path (preview)
scene.render.filepath = "//crystal_preview.png"

print("Crystal geode scene generated. Ready to render preview.")
