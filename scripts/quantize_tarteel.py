import os
from onnxruntime.quantization import quantize_dynamic, QuantType

D = 'www/models/tarteel'

def q(src, dst):
    try:
        quantize_dynamic(src, dst, op_types_to_quantize=['MatMul'], weight_type=QuantType.QInt8)
        os.remove(src)
        print('quantized %s: %.1f MB' % (dst, os.path.getsize(dst) / 1e6))
    except Exception as e:
        print('WARNING: keeping full model for', dst, e)
        if os.path.exists(dst):
            os.remove(dst)
        os.replace(src, dst)

q(os.path.join(D, 'encoder-fp32.onnx'), os.path.join(D, 'encoder.onnx'))
if os.path.exists(os.path.join(D, 'decoder-fp32.onnx')):
    q(os.path.join(D, 'decoder-fp32.onnx'), os.path.join(D, 'decoder.onnx'))
print(sorted(os.listdir(D)))
