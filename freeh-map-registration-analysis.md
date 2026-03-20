# Free-H Map Registration: Deep Analysis of DarkSoldier27's "More H-Maps" Zipmod

## Executive Summary

A Free-H map zipmod for Koikatsu Sunshine requires **6 types of data files** packed inside a `.zipmod` (which is just a `.zip`). The core registration mechanism uses **Unity asset bundles** containing serialized C# `MonoBehaviour` objects that the game reads at runtime through Sideloader's asset redirection. The critical field that makes a map appear in Free-H is `isFreeH: 1` in the `MapInfo` MonoBehaviour.

---

## 1. Zipmod File Structure

### More H-Maps v1.4 (46 maps)
```
zipmod root/
  manifest.xml                          # Mod metadata (GUID, name, version, game target)
  mhm_map_thumbnail.jpg                 # Preview image for mod managers
  abdata/
    map/list/mapinfo/MHM000.unity3d     # MAP REGISTRATION (MapInfo MonoBehaviour)
    map/list/mapthumbnailinfo/MHM000.unity3d  # THUMBNAIL REGISTRY (MapThumbnailInfo MonoBehaviour)
    map/scene/mhm001..046.unity3d       # SCENE BUNDLES (actual 3D map scenes, 1.5MB-329MB each)
    map/thumbnail/mhm001..046.unity3d   # THUMBNAIL IMAGES (320x180 Sprites, ~200KB each)
    h/common/mhm001..046.unity3d        # H-POINT PREFABS (position data for H actions, 287KB-2.5MB)
    studio/info/
      KKSMHM/Map_KKSMHM.csv            # STUDIO MAP LIST (KKS Studio, Category 73)
      KKSMHM/MapCategory_KKSMHM_old.cs_ # STUDIO CATEGORY DEFINITION
      MHM/Map_MHM.csv                   # STUDIO MAP LIST (generic, Category 0)
```

### Comparison: DeathWeasel Pool Map v1.0 (1 map)
```
zipmod root/
  manifest.xml
  abdata/
    map/list/mapinfo/poolmap.unity3d
    map/list/mapthumbnailinfo/poolmap.unity3d
    map/scene/poolmap.unity3d
    map/thumbnail/poolmap.unity3d
    h/common/poolmap.unity3d
    h/list/poolmap.unity3d              # COLLIDER DATA (HCameraVanishData - wall hide on camera)
    vr/common/poolmap.unity3d           # VR H-POINTS (same prefabs but with VR components)
    studio/info/.../Map_poolmap.csv
```

Note: MHM does NOT include `h/list/` (camera vanish/collider data) or `vr/common/` bundles. DeathWeasel includes both.

---

## 2. manifest.xml Format

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest schema-ver="1">
  <guid>DS27.KKS_More_H_Maps</guid>
  <name>More H-Maps</name>
  <version>1.4</version>
  <author>DarkSoldier27</author>
  <description>Maps from different games ported to Koikatsu Sunshine for Free H-Mode and Studio</description>
  <website>https://www.patreon.com/darksoldier27</website>
  <game>Koikatsu Sunshine</game>
</manifest>
```

Key fields:
- `guid`: Unique identifier, must not conflict with other mods
- `game`: Must be "Koikatsu Sunshine" for KKS

---

## 3. The MapInfo Bundle (CRITICAL - Free-H Registration)

**File**: `abdata/map/list/mapinfo/MHM000.unity3d`
**Unity Version**: 2019.4.9f1
**Format**: UnityFS v6
**Size**: 12,552 bytes

### Bundle Contents (3 objects):

1. **MonoScript** (PathID=-6905328049679234590)
   - Class: `MapInfo`
   - Namespace: (empty)
   - Assembly: `Assembly-CSharp.dll`

2. **AssetBundle** (PathID=1)
   - Internal name: `map/list/mapinfo/00.unity3d` (maps to base game naming)
   - AssetBundleName: `map/list/mapinfo/MHM000.unity3d`
   - Container key: `mhm_kks_map_list`

3. **MonoBehaviour** (PathID=7597697142816420955) -- THE MAP DATA
   - m_Name: `MHM_KKS_Map_List`
   - Script reference: points to the MapInfo MonoScript
   - `param`: Array of 46 map entries

### MapInfo Entry Schema (per map):

```json
{
  "MapName": "Public Bus",           // Internal name
  "DisplayName": "Public Bus",       // Shown in UI
  "No": 7301,                        // UNIQUE MAP ID (critical - must not conflict)
  "Sort": 7301,                      // Sort order in map list
  "AssetBundleName": "map/scene/mhm001.unity3d",  // Path to scene bundle
  "AssetName": "MHM_REAL_001",       // Scene name inside the bundle
  "isGate": 0,                       // 0=not a gate/entrance map
  "is2D": 0,                         // 0=3D map
  "isWarning": 0,                    // Warning flag
  "State": 0,                        // 0=always available, 1=conditional
  "LookFor": 100,                    // Camera distance? (always 100 in mods)
  "isOutdoors": 1,                   // 1=outdoor, 0=indoor (affects lighting?)
  "isFreeH": 1,                      // *** 1=APPEARS IN FREE-H MAP SELECT ***
  "isSpH": 0,                        // Special H flag
  "isSky": 1,                        // Has sky rendering
  "isH": 1,                          // 1=H-compatible (has H-points)
  "ThumbnailMorningID": 3001,        // Thumbnail ID for morning
  "ThumbnailDayTimeID": 3002,        // Thumbnail ID for daytime
  "ThumbnailEveningID": 3003,        // Thumbnail ID for evening
  "ThumbnailNightID": 3004           // Thumbnail ID for night
}
```

### Critical Fields for Free-H:
- **`isFreeH: 1`** -- This is THE flag that makes the map selectable in Free-H mode
- **`isH: 1`** -- Indicates H-points exist (h/common bundle has the prefabs)
- **`No`** -- Must be unique across all mods. MHM uses 7301-7346, JRPG uses 8101-8133, DeathWeasel uses 7550+
- **`State: 0`** -- MHM uses 0 (always available). Base game uses 1 for some maps (conditional)
- **`isGate: 0`** -- MHM maps are not gate/entrance maps (base game uses 1 for entrance areas)

### Base Game Comparison:
Base game `mapinfo/00.unity3d` has 36 entries. Some have `isH: 0` (no H-points, just navigation maps) and `isGate: 1` (entrance areas). DLC `mapinfo/70.unity3d` has 1 entry for the Suite room.

---

## 4. The MapThumbnailInfo Bundle

**File**: `abdata/map/list/mapthumbnailinfo/MHM000.unity3d`
**Size**: 19,456 bytes

### MonoBehaviour Schema:
- m_Name: `MHM_thumbnail_list`
- Script class: `MapThumbnailInfo` (Assembly-CSharp.dll)
- `param`: Array mapping thumbnail IDs to sprite assets

### Thumbnail Entry Schema:
```json
{
  "Name": "Public Bus",
  "ID": 3001,                              // Matches ThumbnailMorningID in MapInfo
  "Bundle": "map/thumbnail/mhm001.unity3d", // Path to thumbnail bundle
  "Asset": "sp_map_7301_00"                 // Sprite asset name inside bundle
}
```

Each map has 4 thumbnail entries (morning/day/evening/night), with naming convention:
- Morning: `sp_map_{mapNo}_00`
- Daytime: `sp_map_{mapNo}_01`
- Evening: `sp_map_{mapNo}_02`
- Night:   `sp_map_{mapNo}_03`

The thumbnail IDs are sequential: map 7301 uses IDs 3001-3004, map 7302 uses 3005-3008, etc.

---

## 5. Thumbnail Bundles (map/thumbnail/)

**Files**: `abdata/map/thumbnail/mhm001.unity3d` etc.
**Size**: ~177-251KB each

### Contents per bundle:
- 4 Texture2D assets (320x180 pixels each)
- 4 Sprite assets (referencing the textures)
- Container keys like: `assets/scenes/mhm001 - public bus/sp_map_7301_00.png`

These are standard Unity sprite atlas bundles. Each contains 4 variants of the same map thumbnail for different times of day.

---

## 6. H-Point Bundles (h/common/)

**Files**: `abdata/h/common/mhm001.unity3d` etc.
**Size**: 287KB-2.5MB each

### Container Structure:
Each bundle contains exactly 3 prefabs:
```
assets/scenes/mhm001 - public bus/hpoint_3p_{mapNo}.prefab    # 3P H-points
assets/scenes/mhm001 - public bus/hpoint_{mapNo}.prefab       # Normal H-points
assets/scenes/mhm001 - public bus/hpoint_add_{mapNo}.prefab   # Additional H-points
```

### Key MonoScript Classes Used:
- **`H.HPointData`** -- Defines an H-point position with:
  - `_categorys`: Array of H animation category IDs (e.g., 1011, 1101)
  - `_targets`, `_objTargets`, `_groups`, `_objGroups`: Target objects
  - `_offsetPos`, `_offsetAngle`: Position/rotation offsets
  - `_experience`: Experience requirement
- **`HBeaconEffect`** -- Visual beacon effect at H-point locations
- **`PAP.Assist.BillBoard`** -- Billboard rendering for beacons
- **`ARPGFX.ARPGFXRotation`** -- Rotation effect

### Object Type Counts (mhm001):
```
GameObject: 513, Transform: 513, MonoBehaviour: 360,
ParticleSystem: 153, ParticleSystemRenderer: 153,
MeshRenderer: 153, MeshFilter: 153, Mesh: 3,
CapsuleCollider: 51, Animator: 51,
Material: 5, Texture2D: 5, Shader: 4,
AnimationClip: 2, AnimatorController: 1, MonoScript: 5
```

Each H-point consists of ~10 GameObjects (point itself + beacon effects + colliders).

---

## 7. Scene Bundles (map/scene/)

**Files**: `abdata/map/scene/mhm001.unity3d` etc.
**Size**: 1.5MB to 329MB (highly variable)

### Key Properties:
- **IsStreamedSceneAssetBundle: true** -- These are Unity scene bundles (not regular asset bundles)
- Container key format: `Assets/Scenes/MHM001 - Public Bus/MHM_REAL_001.unity`
- The AssetName in MapInfo must match the scene name in the container

These contain the actual 3D environment: meshes, materials, textures, lighting, etc.

---

## 8. Camera Vanish/Collider Data (h/list/)

**NOT present in MHM mod**, but present in DeathWeasel mods.

### Schema (HCameraVanishData):
```json
{
  "m_Name": "map_col_7550",
  "param": [
    {
      "nameCollider": "Wall_01_collider",
      "nameVisibleObj": ["Wall_01"]
    }
  ]
}
```

This controls which objects become invisible when the camera clips through walls. The CSV file references these as `h/list/, map_col_{mapNo}` but they're optional.

---

## 9. Studio Map CSV Format

### CSV Header:
```
Map							  Colliders
ID,Category,Name,Bundle Path,File Path,Manifest,Bundle Path,File Path
```

### Two CSV Variants in MHM:

**Map_KKSMHM.csv** (KKS Studio with category):
```
7301,73,Public Bus,map/scene/mhm001.unity3d,MHM_REAL_001,,h/list/,map_col_7301
```
Category 73 corresponds to the `.cs_` file defining the studio category.

**Map_MHM.csv** (generic, category 0):
```
7301,0,Public Bus,map/scene/mhm001.unity3d,MHM_REAL_001,,h/list/,map_col_7301
```

### .cs_ Category Definition:
```
カテゴリー,名称
73,MHM
```

---

## 10. ID Numbering Conventions

| Mod | Map No Range | Thumbnail ID Range | Studio Category |
|-----|-------------|-------------------|-----------------|
| Base Game | 0-35 | 0-120+ | N/A |
| DLC (70) | 36 | 117-120 | N/A |
| MHM | 7301-7346 | 3001-3184 | 73 |
| JRPG HM | 8101-8133 | 81001-81132 | 81 |
| DeathWeasel Pool | 7550 | 7550-7553 | N/A |

---

## 11. Available Tools

### On System:
- **SB3Utility v24.3.3** (GUI + Script)
  - Location: `[MODDING] Tools/SB3Utility v24.3.3/SB3UtilityGUI.exe`
  - Can open, inspect, and edit Unity asset bundles
  - Can create asset bundles via scripting
  - Available in both KK and KKS game directories

- **ZipStudio v0.2.1**
  - Location: `[MODDING] Tools/ZipStudio v0.2.1/ZipStudio.exe`
  - For creating/editing zipmod files

- **dnSpy v6.1.5**
  - Location: `[MODDING] Tools/dnSpy v6.1.5/dnSpy.exe`
  - .NET decompiler -- can inspect Assembly-CSharp.dll to understand MapInfo class

- **KKManager**
  - Location: `[UTILITY] KKManager/KKManager.exe`
  - Includes its own SB3Utility copy

- **UnityPy 1.25.0** (Python library)
  - Already installed and working
  - Can read AND write Unity asset bundles programmatically
  - Confirmed working with all bundle types in these mods

### NOT Available:
- UABE (Unity Asset Bundle Extractor) -- not installed
- AssetStudio -- not installed

---

## 12. Bundle Creation Requirements

To create a Free-H map zipmod, you need to create these Unity asset bundles:

### Bundle 1: mapinfo (REQUIRED)
- Unity version: 2019.4.9f1
- Contains: MonoScript(MapInfo) + MonoBehaviour(MapInfo data) + AssetBundle metadata
- The MonoBehaviour must have the exact field schema matching the `MapInfo` class in Assembly-CSharp.dll
- Container key can be arbitrary (e.g., `mhm_kks_map_list`)

### Bundle 2: mapthumbnailinfo (REQUIRED for thumbnails)
- Contains: MonoScript(MapThumbnailInfo) + MonoBehaviour(thumbnail registry) + AssetBundle metadata
- Maps thumbnail IDs to sprite asset names in thumbnail bundles

### Bundle 3: map/thumbnail (REQUIRED for thumbnails)
- Contains: Texture2D (320x180) + Sprite assets
- 4 per map (morning/day/evening/night)

### Bundle 4: h/common (REQUIRED for H-mode)
- Contains: 3 prefabs per map (hpoint_{no}, hpoint_3p_{no}, hpoint_add_{no})
- Each prefab contains HPointData MonoBehaviours defining H-action positions

### Bundle 5: map/scene (REQUIRED)
- Streamed scene asset bundle containing the actual 3D map
- This is the most complex to create -- requires Unity Editor

### Bundle 6: h/list (OPTIONAL)
- Camera vanish collider data
- Not required but improves visual quality when camera clips through walls

### Bundle 7: vr/common (OPTIONAL)
- VR-specific H-point prefabs
- Same structure as h/common but with VR components

---

## 13. Key Insight: UnityPy for Programmatic Bundle Creation

Since UnityPy 1.25.0 is installed and can read all these bundles, it can potentially also be used to:
1. Clone an existing mapinfo bundle and modify the MonoBehaviour data
2. Create thumbnail bundles from PNG images
3. Potentially create mapthumbnailinfo bundles

The most challenging parts to create programmatically are:
- **map/scene/** -- Requires Unity Editor to build scene bundles
- **h/common/** -- Requires Unity Editor to build prefab bundles with correct component references

The data/metadata bundles (mapinfo, mapthumbnailinfo) are simpler and could potentially be created by cloning and modifying existing bundles.
