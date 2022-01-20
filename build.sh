emcmake cmake -S . -B build
cd build 
emmake make

cp -r scran.* ../wasm

cd ..
