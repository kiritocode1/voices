import onnx
from onnxconverter_common import float16
import os

# Map source (original) -> destination (quantized path used by app)
models = {
    "model/onnx/vector_estimator.onnx": "public/models/onnx/vector_estimator_quant.onnx",
    "model/onnx/vocoder.onnx": "public/models/onnx/vocoder_quant.onnx",
    "model/onnx/text_encoder.onnx": "public/models/onnx/text_encoder_quant.onnx",
    "model/onnx/duration_predictor.onnx": "public/models/onnx/duration_predictor_quant.onnx"
}

def convert_to_float16(mod_path, out_path):
    print(f"Converting {mod_path} -> {out_path} (Float16)...")
    
    if not os.path.exists(mod_path):
        print(f"Error: Source file {mod_path} not found!")
        return

    try:
        model = onnx.load(mod_path)
        model_fp16 = float16.convert_float_to_float16(model)
        onnx.save(model_fp16, out_path)
        print(f"Successfully converted {out_path}")
    except Exception as e:
        print(f"Failed to convert {mod_path}: {e}")

if __name__ == "__main__":
    for src, dst in models.items():
        convert_to_float16(src, dst)
