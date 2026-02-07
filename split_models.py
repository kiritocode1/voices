import os
import math

# Target chunk size: 80MB (well under GitHub's 100MB limit)
CHUNK_SIZE = 80 * 1024 * 1024 

models_dir = "public/models/onnx"
models_to_check = [
    "vector_estimator.onnx", 
    "vocoder.onnx", # Just in case it grows or is close to limit
    "text_encoder.onnx",
    "duration_predictor.onnx"
]

def split_file(file_path):
    if not os.path.exists(file_path):
        print(f"Skipping {file_path} (not found)")
        return

    file_size = os.path.getsize(file_path)
    
    if file_size <= CHUNK_SIZE:
        print(f"Skipping {file_path} (Small enough: {file_size/1024/1024:.2f}MB)")
        return

    print(f"Splitting {file_path} ({file_size/1024/1024:.2f}MB)...")
    
    with open(file_path, 'rb') as f:
        part_num = 0
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            
            part_name = f"{file_path}.part{part_num}"
            with open(part_name, 'wb') as part_file:
                part_file.write(chunk)
            
            print(f"  Created {part_name} ({len(chunk)/1024/1024:.2f}MB)")
            part_num += 1

    print(f"Done splitting {file_path}. You can now delete the original.")

if __name__ == "__main__":
    for model in models_to_check:
        full_path = os.path.join(models_dir, model)
        split_file(full_path)
