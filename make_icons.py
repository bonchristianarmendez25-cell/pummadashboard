from PIL import Image
import os
import shutil

src = "MOCKBOAT LOGO.png"
if not os.path.exists(src):
    print("MOCKBOAT LOGO.png not found - skipping")
    exit(0)

img = Image.open(src).convert("RGBA")
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
base = "android/app/src/main/res"

for folder, size in sizes.items():
    d = os.path.join(base, folder)
    os.makedirs(d, exist_ok=True)
    resized = img.resize((size, size), Image.LANCZOS)
    # Regular icons
    resized.save(os.path.join(d, "ic_launcher.png"))
    resized.save(os.path.join(d, "ic_launcher_round.png"))
    # Foreground for adaptive icons
    resized.save(os.path.join(d, "ic_launcher_foreground.png"))
    print("Done: " + folder)

# Remove adaptive icon XML files that override our PNG
# These are in mipmap-anydpi-v26 and tell Android to use vector drawables instead
anydpi = os.path.join(base, "mipmap-anydpi-v26")
if os.path.exists(anydpi):
    shutil.rmtree(anydpi)
    print("Removed mipmap-anydpi-v26 (adaptive icon override)")

# Also overwrite the drawable ic_launcher_background if it exists
for folder in sizes.keys():
    bg_path = os.path.join(base, folder, "ic_launcher_background.png")
    if os.path.exists(bg_path):
        img.resize((sizes[folder], sizes[folder]), Image.LANCZOS).save(bg_path)

print("All icons applied successfully!")
