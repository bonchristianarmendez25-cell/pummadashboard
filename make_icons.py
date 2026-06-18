from PIL import Image
import os

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
    resized.save(os.path.join(d, "ic_launcher.png"))
    resized.save(os.path.join(d, "ic_launcher_round.png"))
    print("Done: " + folder)
print("All icons applied!")
