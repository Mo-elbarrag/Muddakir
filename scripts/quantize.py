import os
from onnxruntime.quantization import quantize_dynamic, QuantType

src = 'www/models/tajweed-fp32.onnx'
dst = 'www/models/tajweed-int8.onnx'

try:
    quantize_dynamic(src, dst, op_types_to_quantize=['MatMul'], weight_type=QuantType.QInt8)
    os.remove(src)
    print('model quantized for mobile: %.1f MB' % (os.path.getsize(dst) / 1e6))
except Exception as e:
    print('WARNING: quantization failed, using full model:', e)
    if os.path.exists(dst):
        os.remove(dst)
    os.replace(src, dst)
