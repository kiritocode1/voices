import onnx
from onnxconverter_common import float16

models = [
    "public/models/onnx/vector_estimator.onnx",
    "public/models/onnx/vocoder.onnx",
    "public/models/onnx/text_encoder.onnx",
    "public/models/onnx/duration_predictor.onnx"
]

def convert_to_float16(model_path):
    output_path = model_path.replace(".onnx", "_quant.onnx")
    print(f"Converting {model_path} -> {output_path} (Float16)...")
    
    try:
        model = onnx.load(model_path)
        model_fp16 = float16.convert_float_to_float16(model)
        onnx.save(model_fp16, output_path)
        print(f"Successfully converted {model_path}")
    except Exception as e:
        print(f"Failed to convert {model_path}: {e}")

if __name__ == "__main__":
    for model in models:
        convert_to_float16(model)
