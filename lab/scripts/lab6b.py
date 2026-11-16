import os, time, collections
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

fp32, opt, int8 = 'onnx/muaalem.onnx', 'onnx/muaalem-opt.onnx', 'onnx/muaalem-int8.onnx'

t = time.time()
so = ort.SessionOptions()
so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
so.optimized_model_filepath = opt
so.add_session_config_entry('session.optimized_model_external_initializers_file_name', 'muaalem-opt.onnx.data')
so.add_session_config_entry('session.optimized_model_external_initializers_min_size_in_bytes', '1024')
ort.InferenceSession(fp32, so, providers=['CPUExecutionProvider'])
print(f'optimized (constant folding) in {time.time() - t:.0f}s')

t = time.time()
quantize_dynamic(opt, int8, weight_type=QuantType.QInt8,
                 op_types_to_quantize=['MatMul', 'Gemm'], use_external_data_format=True)
print(f'quantized int8 in {time.time() - t:.0f}s')

def total(prefix):
    return sum(os.path.getsize(os.path.join('onnx', f)) for f in os.listdir('onnx') if f.startswith(prefix)) / 1e6
print(f'sizes: fp32 {total("muaalem.onnx"):.0f} MB | int8 {total("muaalem-int8"):.0f} MB')
for name, p in (('opt', opt), ('int8', int8)):
    g = onnx.load(p, load_external_data=False).graph
    ops = collections.Counter(n.op_type for n in g.node)
    print(name, 'MatMul:', ops.get('MatMul', 0), '| MatMulInteger:', ops.get('MatMulInteger', 0),
          '| DynamicQuantizeLinear:', ops.get('DynamicQuantizeLinear', 0))
