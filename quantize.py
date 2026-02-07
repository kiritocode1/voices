import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

models = [
    "public/models/onnx/vector_estimator.onnx",
    "public/models/onnx/vocoder.onnx",
    "public/models/onnx/text_encoder.onnx",
    "public/models/onnx/duration_predictor.onnx"
]

def quantize_model(model_path):
    output_path = model_path.replace(".onnx", "_quant.onnx")
    print(f"Quantizing {model_path} -> {output_path}...")
    
    try:
        quantize_dynamic(
            model_input=model_path,
            model_output=output_path,
            weight_type=QuantType.QUInt8
        )
        print(f"Successfully quantized {model_path}")
    except Exception as e:
        print(f"Failed to quantize {model_path}: {e}")

if __name__ == "__main__":
    for model in models:
        quantize_model(model)
