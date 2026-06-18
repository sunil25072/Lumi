import os
import shutil

src_dir = r"C:\Users\SunilKumarKethananei\.gemini\antigravity\brain\d0ebffbe-c928-4c2e-a026-e224c501bae0"
dst_dir = r"Pages\Templates"

files = {
    "cyberpunk_template_1779184729359.png": "cyberpunk.png",
    "pixar_template_1779184747687.png": "pixar.png",
    "fantasy_template_1779184767351.png": "fantasy.png",
    "astronaut_template_1779184786109.png": "astronaut.png"
}

for src_name, dst_name in files.items():
    src_path = os.path.join(src_dir, src_name)
    dst_path = os.path.join(dst_dir, dst_name)
    
    print(f"Copying {src_path} -> {dst_path}")
    try:
        shutil.copy(src_path, dst_path)
        print("Success")
    except Exception as e:
        print(f"Error copying {src_name}: {e}")
