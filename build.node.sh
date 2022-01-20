emcmake cmake -S . -B build -DCOMPILE_NODE=1
cd build 
emmake make

cp -r scran.* ../wasm_node

cd ..
