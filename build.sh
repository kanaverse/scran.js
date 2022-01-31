#!/bin/bash

set -e
set -u

mode=$(echo $1 | sed "s/\/$//")
if [ $mode != "module" ] && [ $mode != "main" ]
then
    echo "need to specify 'module' or 'main' as the first argument"
    exit 1
fi

# Copying over the Javascript files.
destdir=$mode
rm -rf ${destdir}
mkdir -p ${destdir}
cp js/*.js $destdir

if [ $mode != "main" ]
then
    cat js/wasm.js | grep -v "NODE ONLY" > $destdir/wasm.js
fi

# Building the Wasm files.
builddir=build_$mode
if [ $mode == "main" ]
then
    node_flag=ON
else
    node_flag=OFF
fi

if [ ! -e $builddir ]
then
    emcmake cmake -S . -B $builddir -DCOMPILE_NODE=${node_flag} -DCMAKE_BUILD_TYPE=Release
fi

cd $builddir
emmake make

final=../${destdir}/wasm
mkdir -p ${final}
cp -r scran.* ${final}

if [ $mode == "main" ]
then
    # For easier testing.
    mkdir -p ../js/wasm
    cp -r scran.* ../js/wasm
fi
